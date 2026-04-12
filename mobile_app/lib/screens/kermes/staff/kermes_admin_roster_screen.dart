import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'kermes_schedule_screen.dart' show KermesRoster;

class KermesAdminRosterScreen extends StatefulWidget {
  final String kermesId;
  final String kermesTitle;
  final List<dynamic> assignedStaffIds;

  const KermesAdminRosterScreen({
    Key? key,
    required this.kermesId,
    required this.kermesTitle,
    required this.assignedStaffIds,
  }) : super(key: key);

  @override
  State<KermesAdminRosterScreen> createState() => _KermesAdminRosterScreenState();
}

class _KermesAdminRosterScreenState extends State<KermesAdminRosterScreen> {
  bool _isLoading = true;
  List<KermesRoster> _allRosters = [];
  Map<String, String> _userNames = {};
  Map<String, String> _userGenders = {};
  bool _isSuperAdmin = false;
  String _adminGender = '';

  @override
  void initState() {
    super.initState();
    initializeDateFormatting('tr_TR', null).then((_) {
      _fetchData();
    });
  }

  Future<void> _fetchData() async {
    try {
      // 1. Get current admin roles/gender
      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid != null) {
         final adminDoc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
         if (adminDoc.exists) {
            final ad = adminDoc.data()!;
            _adminGender = (ad['gender'] ?? ad['profile']?['gender'] ?? '').toString().toLowerCase();
            final roles = List<String>.from(ad['roles'] ?? []);
            _isSuperAdmin = roles.contains('super_admin');
         }
      }

      List<dynamic> staffIds = widget.assignedStaffIds;
      if (staffIds.isEmpty) {
        final kSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
        if (kSnap.exists) {
           final d = kSnap.data()!;
           final List<dynamic> s = d['assignedStaff'] ?? [];
           final List<dynamic> d_ = d['assignedDrivers'] ?? [];
           final List<dynamic> w = d['assignedWaiters'] ?? [];
           staffIds = [...s, ...d_, ...w].toSet().toList();
        }
      }
      
      // Fetch names & genders for assigned staff (chunking for >30)
      final Map<String, String> names = {};
      final Map<String, String> genders = {};
      if (staffIds.isNotEmpty) {
        for (var i = 0; i < staffIds.length; i += 30) {
          final chunk = staffIds.sublist(i, i + 30 > staffIds.length ? staffIds.length : i + 30);
          final snap = await FirebaseFirestore.instance.collection('users')
              .where(FieldPath.documentId, whereIn: chunk)
              .get();
          for (final doc in snap.docs) {
            final data = doc.data();
            names[doc.id] = (data['name'] ?? data['profile']?['name'] ?? 'İsimsiz Görevli').toString();
            genders[doc.id] = (data['gender'] ?? data['profile']?['gender'] ?? '').toString().toLowerCase();
          }
        }
      }
      
      // Fetch all rosters (without double orderBy to prevent Firebase index errors)
      final snap = await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .collection('rosters')
          .get();
          
      final list = snap.docs.map((d) => KermesRoster.fromFirestore(d)).toList();
      
      // Memory Sorting (First by date, then by startTime)
      list.sort((a, b) {
        final dateCmp = a.date.compareTo(b.date);
        if (dateCmp != 0) return dateCmp;
        return a.startTime.compareTo(b.startTime);
      });

      if (mounted) {
        setState(() {
          _allRosters = list;
          _userNames = names;
          _userGenders = genders;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching master rosters $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _deleteRoster(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vardiyayı Sil'),
        content: const Text('Bu vardiyayı silmek istediğinize emin misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('İptal')),
          TextButton(
            onPressed: () => Navigator.pop(context, true), 
            child: const Text('Sil', style: TextStyle(color: Colors.red)),
          ),
        ],
      )
    );

    if (confirm != true) return;

    try {
      await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .collection('rosters')
          .doc(id)
          .delete();

      setState(() {
        _allRosters.removeWhere((r) => r.id == id);
      });
      
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vardiya silindi'), backgroundColor: Colors.green));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Hata oluştu'), backgroundColor: Colors.red));
    }
  }

  // Quick form state for modal
  String _formUserId = '';
  String _formRole = '';
  DateTime? _formDate;
  TimeOfDay? _formStart;
  TimeOfDay? _formEnd;

  void _showAddModal() async {
    List<dynamic> staffIds = widget.assignedStaffIds;
    if (staffIds.isEmpty) {
      final kSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
      if (kSnap.exists) {
         final d = kSnap.data()!;
         staffIds = [...(d['assignedStaff']??[]), ...(d['assignedDrivers']??[]), ...(d['assignedWaiters']??[])].toSet().toList();
      }
    }
    
    _formUserId = staffIds.isNotEmpty ? staffIds.first : '';
    _formRole = 'Garson';
    _formDate = DateTime.now();
    _formStart = const TimeOfDay(hour: 8, minute: 0);
    _formEnd = const TimeOfDay(hour: 16, minute: 0);

    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              margin: EdgeInsets.only(top: kToolbarHeight),
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
              ),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Yeni Vardiya Ekle', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 24),
                    
                    // Personel
                    DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'Görevli Personel', border: OutlineInputBorder()),
                      value: _formUserId.isEmpty ? null : _formUserId,
                      items: staffIds.map((uid) {
                        return DropdownMenuItem<String>(
                          value: uid,
                          child: Text(_userNames[uid] ?? 'Bilinmeyen ($uid)'),
                        );
                      }).toList(),
                      onChanged: (val) => setModalState(() => _formUserId = val ?? ''),
                    ),
                    const SizedBox(height: 16),
                    
                    // Rol
                    DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'Görev / Rol', border: OutlineInputBorder()),
                      value: _formRole,
                      items: ['Genel Sorumlu', 'Garson', 'Sürücü / Nakliye', 'Ocakbaşı - Kumpir', 'Güvenlik', 'Temizlik', 'Tatlı Standı', 'İçecek Standı']
                          .map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                      onChanged: (val) => setModalState(() => _formRole = val ?? ''),
                    ),
                    const SizedBox(height: 16),

                    // Tarih
                    ListTile(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.withOpacity(0.3))),
                      title: const Text('Tarih'),
                      trailing: Text(_formDate != null ? DateFormat('dd.MM.yyyy').format(_formDate!) : 'Seçiniz', style: const TextStyle(fontWeight: FontWeight.bold)),
                      onTap: () async {
                        final date = await showDatePicker(
                          context: context,
                          initialDate: _formDate ?? DateTime.now(),
                          firstDate: DateTime.now().subtract(const Duration(days: 30)),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (date != null) setModalState(() => _formDate = date);
                      },
                    ),
                    const SizedBox(height: 16),

                    // Saatler
                    Row(
                      children: [
                         Expanded(
                           child: ListTile(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.withOpacity(0.3))),
                            title: const Text('Başlangıç', style: TextStyle(fontSize: 12)),
                            subtitle: Text(_formStart?.format(context) ?? '--:--', style: const TextStyle(fontWeight: FontWeight.bold)),
                            onTap: () async {
                              final time = await showTimePicker(context: context, initialTime: _formStart!);
                              if (time != null) setModalState(() => _formStart = time);
                            },
                          ),
                         ),
                         const SizedBox(width: 16),
                         Expanded(
                           child: ListTile(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: Colors.grey.withOpacity(0.3))),
                            title: const Text('Bitiş', style: TextStyle(fontSize: 12)),
                            subtitle: Text(_formEnd?.format(context) ?? '--:--', style: const TextStyle(fontWeight: FontWeight.bold)),
                            onTap: () async {
                              final time = await showTimePicker(context: context, initialTime: _formEnd!);
                              if (time != null) setModalState(() => _formEnd = time);
                            },
                          ),
                         ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () => _saveRoster(context),
                      child: const Text('Ekle', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            );
          }
        );
      }
    );
  }

  Future<void> _saveRoster(BuildContext modalContext) async {
    if (_formUserId.isEmpty || _formRole.isEmpty || _formDate == null || _formStart == null || _formEnd == null) return;
    
    final dateStr = DateFormat('yyyy-MM-dd').format(_formDate!);
    final startStr = '${_formStart!.hour.toString().padLeft(2, '0')}:${_formStart!.minute.toString().padLeft(2, '0')}';
    final endStr = '${_formEnd!.hour.toString().padLeft(2, '0')}:${_formEnd!.minute.toString().padLeft(2, '0')}';

    // 1. Çakışma Kontrolü (Overlap Check)
    final hasOverlap = _allRosters.any((r) {
      if (r.userId != _formUserId) return false;
      if (r.date != dateStr) return false;
      // Overlap mantığı: r.startTime < endStr VE startStr < r.endTime
      return (r.startTime.compareTo(endStr) < 0 && startStr.compareTo(r.endTime) < 0);
    });

    if (hasOverlap) {
      if (mounted) {
        Navigator.pop(modalContext); // Modalı kapat
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Çakışma: O saatlerde personelin zaten vardiyası var.', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 4),
        ));
      }
      return; 
    }

    try {
      final docRef = await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .collection('rosters')
          .add({
        'kermesId': widget.kermesId,
        'userId': _formUserId,
        'role': _formRole,
        'date': dateStr,
        'startTime': startStr,
        'endTime': endStr,
        'createdAt': FieldValue.serverTimestamp(),
        'createdBy': FirebaseAuth.instance.currentUser?.uid,
      });

      if (mounted) {
        Navigator.pop(modalContext);
        _fetchData(); // reload
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vardiya eklendi'), backgroundColor: Colors.green));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Hata oluştu'), backgroundColor: Colors.red));
    }
  }

  Color _getRoleColor(String role) {
    switch ((role).toLowerCase()) {
      case 'genel sorumlu': return Colors.purple;
      case 'garson': return Colors.teal;
      case 'sürücü / nakliye': return Colors.amber;
      case 'ocakbaşı - kumpir': return Colors.orange;
      case 'güvenlik': return Colors.blueGrey;
      case 'temizlik': return Colors.cyan;
      case 'tatlı standı': return Colors.pink;
      case 'içecek standı': return Colors.blue;
      case 'gözleme': return Colors.yellow.shade700;
      default: return Colors.grey;
    }
  }

  String _getInitials(String name) {
    if (name.isEmpty) return '?';
    final parts = name.trim().split(' ').where((s) => s.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // 1. Gender Filter
    final bool isMaleAdmin = _adminGender == 'male' || _adminGender == 'erkek';
    final bool isFemaleAdmin = _adminGender == 'female' || _adminGender == 'kadin';

    final allowedRosters = _allRosters.where((r) {
      if (_isSuperAdmin) return true;
      final staffGender = _userGenders[r.userId] ?? '';
      final isMaleStaff = staffGender == 'male' || staffGender == 'erkek';
      final isFemaleStaff = staffGender == 'female' || staffGender == 'kadin';
      
      if (isFemaleAdmin && isMaleStaff) return false;
      if (isMaleAdmin && isFemaleStaff) return false;
      return true;
    }).toList();

    // 2. Group by Date -> Role
    final Map<String, Map<String, List<KermesRoster>>> grouped = {};
    for (final r in allowedRosters) {
      if (!grouped.containsKey(r.date)) grouped[r.date] = {};
      if (!grouped[r.date]!.containsKey(r.role)) grouped[r.date]![r.role] = [];
      grouped[r.date]![r.role]!.add(r);
    }

    final sortedDates = grouped.keys.toList()..sort();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vardiya Yönetimi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        centerTitle: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddModal,
        backgroundColor: Colors.blue.shade600,
        elevation: 4,
        icon: const Icon(Icons.add_task, color: Colors.white),
        label: const Text('Vardiya Ekle', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : allowedRosters.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.event_busy, size: 64, color: Colors.grey.withOpacity(0.5)),
                  const SizedBox(height: 16),
                  const Text('Henüz vardiya atanmadı.', style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.only(top: 16, bottom: 120, left: 16, right: 16),
              itemCount: sortedDates.length,
              itemBuilder: (context, index) {
                final dateStr = sortedDates[index];
                final rolesMap = grouped[dateStr]!;
                final sortedRoles = rolesMap.keys.toList()..sort();
                
                DateTime? d;
                try { d = DateTime.parse(dateStr); } catch (_) {}
                final formattedDate = d != null ? DateFormat('EEEE, d MMMM', 'tr_TR').format(d) : dateStr;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // DATE HEADER
                      Row(
                        children: [
                          Expanded(child: Divider(color: Colors.grey.withOpacity(0.3))),
                          Container(
                            margin: const EdgeInsets.symmetric(horizontal: 12),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.blue.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.blue.withOpacity(0.2)),
                            ),
                            child: Text(
                              formattedDate,
                              style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.blue.shade300 : Colors.blue.shade700, fontSize: 13),
                            ),
                          ),
                          Expanded(child: Divider(color: Colors.grey.withOpacity(0.3))),
                        ],
                      ),
                      const SizedBox(height: 16),
                      
                      // ROLES GROUP
                      ...sortedRoles.map((role) {
                        final list = rolesMap[role]!;
                        final roleColor = _getRoleColor(role);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey.shade900 : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.withOpacity(0.15)),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(isDark ? 0.2 : 0.03),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Role Header
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                decoration: BoxDecoration(
                                  border: Border(bottom: BorderSide(color: Colors.grey.withOpacity(0.1))),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: roleColor.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Icon(Icons.assignment_ind, size: 16, color: roleColor),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(role, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                          Text('${list.length} Personel Görevlendirildi', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              
                              // Staff Cards Array
                              ListView.separated(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: list.length,
                                separatorBuilder: (_, __) => Divider(height: 1, color: Colors.grey.withOpacity(0.1)),
                                itemBuilder: (context, idx) {
                                  final roster = list[idx];
                                  final staffName = _userNames[roster.userId] ?? 'Bilinmiyor';
                                  
                                  return InkWell(
                                    onLongPress: () => _showDeleteOptions(roster),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                      child: Row(
                                        children: [
                                          // Avatar
                                          Container(
                                            width: 40,
                                            height: 40,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              gradient: LinearGradient(
                                                colors: [roleColor.withOpacity(0.2), roleColor.withOpacity(0.05)],
                                                begin: Alignment.topLeft,
                                                end: Alignment.bottomRight,
                                              ),
                                              border: Border.all(color: roleColor.withOpacity(0.3)),
                                            ),
                                            alignment: Alignment.center,
                                            child: Text(
                                              _getInitials(staffName),
                                              style: TextStyle(fontWeight: FontWeight.bold, color: roleColor, fontSize: 13),
                                            ),
                                          ),
                                          const SizedBox(width: 14),
                                          
                                          // Details
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(staffName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                                const SizedBox(height: 6),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: roleColor.withOpacity(0.1),
                                                    borderRadius: BorderRadius.circular(12),
                                                    border: Border.all(color: roleColor.withOpacity(0.2)),
                                                  ),
                                                  child: Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      Icon(Icons.schedule, size: 12, color: roleColor.withOpacity(0.8)),
                                                      const SizedBox(width: 4),
                                                      Text(
                                                        '${roster.startTime} - ${roster.endTime}',
                                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isDark ? roleColor.withOpacity(0.9) : roleColor),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          
                                          // Delete Button
                                          IconButton(
                                            icon: const Icon(Icons.delete_outline, size: 20),
                                            color: Colors.red.withOpacity(0.7),
                                            onPressed: () => _showDeleteOptions(roster),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
