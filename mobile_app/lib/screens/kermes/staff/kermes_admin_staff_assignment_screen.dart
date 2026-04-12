import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class KermesAdminStaffAssignmentScreen extends StatefulWidget {
  final String kermesId;
  final String kermesTitle;

  const KermesAdminStaffAssignmentScreen({
    Key? key,
    required this.kermesId,
    required this.kermesTitle,
  }) : super(key: key);

  @override
  State<KermesAdminStaffAssignmentScreen> createState() => _KermesAdminStaffAssignmentScreenState();
}

class _KermesAdminStaffAssignmentScreenState extends State<KermesAdminStaffAssignmentScreen> {
  bool _isLoading = true;
  Map<String, dynamic> _kermesData = {};
  List<Map<String, dynamic>> _staffList = [];
  
  // Available roles for assignment
  final List<String> _baseRoles = [
    'Kermes Admini',
    'Genel Sorumlu (Yetkisiz)', // Just means in assignedStaff but no special role
    'Sürücü',
    'Garson'
  ];
  
  List<String> _prepZones = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final kSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
      if (!kSnap.exists) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }
      
      final data = kSnap.data()!;
      
      // Extract prep zones to make them available as roles
      final Map<String, dynamic> pzMap = data['prepZoneAssignments'] ?? {};
      _prepZones = pzMap.keys.toList();
      _prepZones.sort();

      // Gather ALL distinct UIDs
      Set<String> allUids = {};
      allUids.addAll(List<String>.from(data['kermesAdmins'] ?? []));
      allUids.addAll(List<String>.from(data['assignedStaff'] ?? []));
      allUids.addAll(List<String>.from(data['assignedWaiters'] ?? []));
      allUids.addAll(List<String>.from(data['assignedDrivers'] ?? []));
      
      for (final entry in pzMap.entries) {
        allUids.addAll(List<String>.from(entry.value ?? []));
      }
      
      // Fetch user docs
      List<Map<String, dynamic>> usersData = [];
      if (allUids.isNotEmpty) {
        final List<String> uidList = allUids.toList();
        for (int i = 0; i < uidList.length; i += 10) {
          final chunk = uidList.sublist(i, i + 10 > uidList.length ? uidList.length : i + 10);
          final uSnap = await FirebaseFirestore.instance.collection('users').where(FieldPath.documentId, whereIn: chunk).get();
          for (var doc in uSnap.docs) {
            usersData.add({...doc.data(), 'uid': doc.id});
          }
        }
      }

      // Merge data
      for (var u in usersData) {
        final uid = u['uid'];
        List<String> userRoles = [];
        if (List<String>.from(data['kermesAdmins'] ?? []).contains(uid)) userRoles.add('Kermes Admini');
        if (List<String>.from(data['assignedDrivers'] ?? []).contains(uid)) userRoles.add('Sürücü');
        if (List<String>.from(data['assignedWaiters'] ?? []).contains(uid)) userRoles.add('Garson');
        
        for (final entry in pzMap.entries) {
          if (List<String>.from(entry.value ?? []).contains(uid)) {
            userRoles.add(entry.key);
          }
        }
        
        if (userRoles.isEmpty && List<String>.from(data['assignedStaff'] ?? []).contains(uid)) {
          userRoles.add('Genel Sorumlu (Yetkisiz)');
        }
        
        u['currentRoles'] = userRoles;
      }
      
      // Sort alphabetically
      usersData.sort((a, b) {
        final nameA = a['name'] ?? a['displayName'] ?? '';
        final nameB = b['name'] ?? b['displayName'] ?? '';
        return nameA.compareTo(nameB);
      });

      if (mounted) {
        setState(() {
          _kermesData = data;
          _staffList = usersData;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching staff: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showAddStaffModal() {
    final TextEditingController phoneController = TextEditingController();
    bool searching = false;
    String? errorMsg;
    String phonePrefix = '+49';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final isDark = Theme.of(context).brightness == Brightness.dark;
            return Container(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
                left: 24, right: 24, top: 24,
              ),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Personel Ekle', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('Eklemek istediğiniz personelin telefon numarasını girin. Kişi sistemde kayıtlı olmalıdır.', style: TextStyle(color: isDark ? Colors.white54 : Colors.black54)),
                  const SizedBox(height: 24),
                  
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.withOpacity(0.4)),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(phonePrefix, style: const TextStyle(fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: phoneController,
                          keyboardType: TextInputType.phone,
                          decoration: InputDecoration(
                            hintText: 'Örn: 15730000000',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  
                  if (errorMsg != null) ...[
                    const SizedBox(height: 12),
                    Text(errorMsg!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                  ],
                  
                  const SizedBox(height: 32),
                  SizedBox(
                    height: 50,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.purple,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: searching ? null : () async {
                        final val = phoneController.text.trim();
                        if (val.isEmpty) return;
                        
                        // normalize
                        String searchPhone = val;
                        if (searchPhone.startsWith('0')) searchPhone = searchPhone.substring(1);
                        if (!searchPhone.startsWith('+')) searchPhone = '$phonePrefix$searchPhone';

                        setModalState(() { searching = true; errorMsg = null; });
                        
                        try {
                          final snap1 = await FirebaseFirestore.instance.collection('users').where('phone', isEqualTo: searchPhone).get();
                          final snap2 = await FirebaseFirestore.instance.collection('users').where('phoneNumber', isEqualTo: searchPhone).get();
                          
                          String? foundUid;
                          if (snap1.docs.isNotEmpty) foundUid = snap1.docs.first.id;
                          else if (snap2.docs.isNotEmpty) foundUid = snap2.docs.first.id;
                          
                          if (foundUid == null) {
                            setModalState(() {
                              errorMsg = 'Bu numara ile kayıtlı LOKMA kullanıcısı bulunamadı. Lütfen kişinin LOKMA uygulamasını indirip üye olduğundan emin olun.';
                              searching = false;
                            });
                            return;
                          }
                          
                          // Add to assignedStaff array safely
                          await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).update({
                            'assignedStaff': FieldValue.arrayUnion([foundUid])
                          });
                          
                          if (mounted) {
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Personel başarıyla kermes ekibine eklendi!'), backgroundColor: Colors.green));
                            _fetchData(); // Reload
                          }
                          
                        } catch (e) {
                          setModalState(() {
                            errorMsg = 'Bir hata oluştu: $e';
                            searching = false;
                          });
                        }
                      },
                      child: searching 
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Personeli Bul ve Ekle', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            );
          }
        );
      }
    );
  }

  void _showRoleEditorModal(Map<String, dynamic> staff) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final String uid = staff['uid'];
    final String name = staff['name'] ?? staff['displayName'] ?? 'Adsız';
    
    // Copy current state for local toggling
    Set<String> localRoles = Set<String>.from(staff['currentRoles'] as List<String>);
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.85,
              padding: const EdgeInsets.only(top: 24, left: 20, right: 20),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: Colors.purple.withOpacity(0.15),
                        child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(color: Colors.purple, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            Text(staff['phone'] ?? '', style: TextStyle(fontSize: 13, color: isDark ? Colors.white54 : Colors.black54)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 32),
                  
                  Expanded(
                    child: ListView(
                      children: [
                        const Text('Ana Roller', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey)),
                        const SizedBox(height: 8),
                        ..._baseRoles.map((role) {
                          return CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            controlAffinity: ListTileControlAffinity.leading,
                            activeColor: Colors.purple,
                            title: Text(role, style: TextStyle(color: role == 'Kermes Admini' ? Colors.redAccent : null)),
                            value: localRoles.contains(role),
                            onChanged: (val) {
                              setModalState(() {
                                if (val == true) {
                                  localRoles.add(role);
                                  // Special: if assigning a specific role, they don't need the 'Genel Sorumlu (Yetkisiz)' marker
                                  if (role != 'Genel Sorumlu (Yetkisiz)') {
                                    localRoles.remove('Genel Sorumlu (Yetkisiz)');
                                  }
                                } else {
                                  localRoles.remove(role);
                                }
                              });
                            },
                          );
                        }),
                        
                        const Divider(height: 32),
                        const Text('Mutfak / Bölüm Atamaları', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey)),
                        const SizedBox(height: 8),
                        ..._prepZones.map((zone) {
                          return CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            controlAffinity: ListTileControlAffinity.leading,
                            activeColor: Colors.orange,
                            title: Text(zone),
                            value: localRoles.contains(zone),
                            onChanged: (val) {
                              setModalState(() {
                                if (val == true) {
                                  localRoles.add(zone);
                                  localRoles.remove('Genel Sorumlu (Yetkisiz)');
                                } else {
                                  localRoles.remove(zone);
                                }
                              });
                            },
                          );
                        }),
                      ],
                    ),
                  ),
                  
                  Container(
                    padding: const EdgeInsets.only(top: 16, bottom: 32),
                    child: Row(
                      children: [
                        // Remove entirely
                        IconButton(
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.red.withOpacity(0.1),
                            foregroundColor: Colors.red,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.all(14),
                          ),
                          icon: const Icon(Icons.person_remove),
                          onPressed: () async {
                            final confirm = await showDialog<bool>(
                              context: context,
                              builder: (c) => AlertDialog(
                                title: const Text('Kermesten Çıkar'),
                                content: const Text('Bu personeli kermes ekibinden tamamen çıkarmak istediğinize emin misiniz?'),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('İptal')),
                                  TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Evet, Çıkar', style: TextStyle(color: Colors.red))),
                                ],
                              )
                            );
                            if (confirm == true) {
                              setModalState(() => saving = true);
                              await _removeStaffEntirely(uid);
                              if (mounted) Navigator.pop(ctx);
                            }
                          },
                        ),
                        const SizedBox(width: 12),
                        // Save roles
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.purple,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: saving ? null : () async {
                              setModalState(() => saving = true);
                              await _saveRoles(uid, localRoles);
                              if (mounted) Navigator.pop(ctx);
                            },
                            child: saving 
                                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                : const Text('Rolleri Kaydet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }
        );
      }
    );
  }

  Future<void> _saveRoles(String uid, Set<String> selectedRoles) async {
    try {
      // We pull current doc state just to be safe
      final kSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
      if (!kSnap.exists) return;
      final data = kSnap.data()!;
      
      final kermesAdmins = List<String>.from(data['kermesAdmins'] ?? []);
      final assignedDrivers = List<String>.from(data['assignedDrivers'] ?? []);
      final assignedWaiters = List<String>.from(data['assignedWaiters'] ?? []);
      final assignedStaff = List<String>.from(data['assignedStaff'] ?? []);
      final prepZoneAssignments = Map<String, dynamic>.from(data['prepZoneAssignments'] ?? {});
      
      // Update arrays based on selections
      if (selectedRoles.contains('Kermes Admini')) { if (!kermesAdmins.contains(uid)) kermesAdmins.add(uid); }
      else { kermesAdmins.remove(uid); }
      
      if (selectedRoles.contains('Sürücü')) { if (!assignedDrivers.contains(uid)) assignedDrivers.add(uid); }
      else { assignedDrivers.remove(uid); }
      
      if (selectedRoles.contains('Garson')) { if (!assignedWaiters.contains(uid)) assignedWaiters.add(uid); }
      else { assignedWaiters.remove(uid); }
      
      // Prep zones
      for (final zone in _prepZones) {
        List<String> zUids = List<String>.from(prepZoneAssignments[zone] ?? []);
        if (selectedRoles.contains(zone)) {
          if (!zUids.contains(uid)) zUids.add(uid);
        } else {
          zUids.remove(uid);
        }
        prepZoneAssignments[zone] = zUids;
      }
      
      // Keep them in assignedStaff universally if they are part of the kermes
      if (!assignedStaff.contains(uid)) assignedStaff.add(uid);
      
      await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).update({
        'kermesAdmins': kermesAdmins,
        'assignedDrivers': assignedDrivers,
        'assignedWaiters': assignedWaiters,
        'assignedStaff': assignedStaff,
        'prepZoneAssignments': prepZoneAssignments,
      });
      
      _fetchData(); // reload UI
    } catch (e) {
      debugPrint('Error saving roles: $e');
    }
  }

  Future<void> _removeStaffEntirely(String uid) async {
    try {
      final kSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
      if (!kSnap.exists) return;
      final data = kSnap.data()!;
      
      final kermesAdmins = List<String>.from(data['kermesAdmins'] ?? [])..remove(uid);
      final assignedDrivers = List<String>.from(data['assignedDrivers'] ?? [])..remove(uid);
      final assignedWaiters = List<String>.from(data['assignedWaiters'] ?? [])..remove(uid);
      final assignedStaff = List<String>.from(data['assignedStaff'] ?? [])..remove(uid);
      final prepZoneAssignments = Map<String, dynamic>.from(data['prepZoneAssignments'] ?? {});
      
      for (final key in prepZoneAssignments.keys) {
        List<String> zUids = List<String>.from(prepZoneAssignments[key])..remove(uid);
        prepZoneAssignments[key] = zUids;
      }
      
      await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).update({
        'kermesAdmins': kermesAdmins,
        'assignedDrivers': assignedDrivers,
        'assignedWaiters': assignedWaiters,
        'assignedStaff': assignedStaff,
        'prepZoneAssignments': prepZoneAssignments,
      });
      
      _fetchData(); // reload UI
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Personel kermesten çıkarıldı'), backgroundColor: Colors.green));
    } catch (e) {
      debugPrint('Error removing staff: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Personel ve Roller'),
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddStaffModal,
        backgroundColor: Colors.purple,
        icon: const Icon(Icons.person_add_alt_1, color: Colors.white),
        label: const Text('Personel Ekle', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : ListView.separated(
            padding: const EdgeInsets.only(bottom: 100, top: 12),
            itemCount: _staffList.length,
            separatorBuilder: (_, __) => Divider(color: isDark ? Colors.white10 : Colors.black12, indent: 20, endIndent: 20),
            itemBuilder: (context, index) {
              final staff = _staffList[index];
              final name = staff['name'] ?? staff['displayName'] ?? 'Adsız';
              final roles = staff['currentRoles'] as List<String>;
              
              return InkWell(
                onTap: () => _showRoleEditorModal(staff),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: Colors.purple.withOpacity(0.15),
                        child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(color: Colors.purple, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            const SizedBox(height: 4),
                            if (roles.isNotEmpty)
                              Wrap(
                                spacing: 6, runSpacing: 6,
                                children: roles.map((r) => Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: r == 'Kermes Admini' ? Colors.red.withOpacity(0.1) : Colors.purple.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: r == 'Kermes Admini' ? Colors.red.withOpacity(0.3) : Colors.purple.withOpacity(0.2)),
                                  ),
                                  child: Text(
                                    r, 
                                    style: TextStyle(
                                      fontSize: 11, 
                                      color: r == 'Kermes Admini' ? Colors.redAccent : (isDark ? Colors.purple.shade200 : Colors.purple.shade700),
                                      fontWeight: r == 'Kermes Admini' ? FontWeight.bold : FontWeight.normal
                                    )
                                  ),
                                )).toList(),
                              )
                            else
                              Text('Henüz bir rol atanmamış', style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontStyle: FontStyle.italic)),
                          ],
                        ),
                      ),
                      const Icon(Icons.edit, size: 18, color: Colors.grey),
                    ],
                  ),
                ),
              );
            },
          ),
    );
  }
}
