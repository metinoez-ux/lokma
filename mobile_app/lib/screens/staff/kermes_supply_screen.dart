import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class KermesSupplyScreen extends StatefulWidget {
  final String kermesId;
  final List<String> userPrepZones;
  final String userSection;
  final List<String> userRoles;
  final String userName;

  const KermesSupplyScreen({
    super.key,
    required this.kermesId,
    required this.userPrepZones,
    this.userSection = '',
    this.userRoles = const [],
    this.userName = '',
  });

  @override
  State<KermesSupplyScreen> createState() => _KermesSupplyScreenState();
}

class _KermesSupplyScreenState extends State<KermesSupplyScreen> {
  final TextEditingController _customCtrl = TextEditingController();
  List<Map<String, dynamic>> _categories = [];
  bool _isLoadingCats = true;
  String _currentUserName = '';
  DateTime? _eventEndDate;

  bool get isSupplier => widget.userRoles.any((r) => 
      r.toLowerCase().contains('tedarik') || 
      r.toLowerCase().contains('stok') || 
      r.toLowerCase().contains('lojistik') || 
      r.toLowerCase().contains('malzeme') || 
      r.toLowerCase().contains('depo') || 
      r.toLowerCase().contains('alım') || 
      r.toLowerCase().contains('satınalma') || 
      r.toLowerCase().contains('satın alma') || 
      r.toLowerCase().contains('supplier'));


  @override
  void initState() {
    super.initState();
    _fetchCategories();
    _fetchCurrentUserName();
  }

  Future<void> _fetchCurrentUserName() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      try {
        final doc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
        if (doc.exists && doc.data()!['fullName'] != null) {
          setState(() {
            _currentUserName = doc.data()!['fullName'];
          });
        } else {
           final adminDoc = await FirebaseFirestore.instance.collection('admins').doc(uid).get();
           if (adminDoc.exists && adminDoc.data()!['name'] != null) {
              setState(() {
                _currentUserName = adminDoc.data()!['name'];
              });
           }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  Future<void> _fetchCategories() async {
    try {
      final doc = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
      if (doc.exists) {
        final data = doc.data()!;
        if (data['endDate'] != null) {
           _eventEndDate = (data['endDate'] as Timestamp).toDate();
        }
        final cats = data['supplyCategories'] as List<dynamic>? ?? [];
        if (mounted) {
           setState(() {
              _categories = cats.map((c) => Map<String, dynamic>.from(c)).where((c) {
                 if (c['allowedZones'] != null && (c['allowedZones'] as List).isNotEmpty) {
                    final allowed = List<String>.from(c['allowedZones']);
                    return widget.userPrepZones.any((zone) => allowed.contains(zone));
                 }
                 return true;
              }).toList();
              _isLoadingCats = false;
           });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingCats = false);
    }
  }

  Future<void> _submitRequest(String itemName, String requestedZone, {String category = 'custom', String urgency = 'normal'}) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    
    // Check if same item is already requested and pending/on_the_way
    final recent = await FirebaseFirestore.instance.collection('kermes_events')
         .doc(widget.kermesId)
         .collection('supply_requests')
         .where('itemName', isEqualTo: itemName)
         .where('status', whereIn: ['pending', 'on_the_way'])
         .get();
         
    if (recent.docs.isNotEmpty) {
       if (!mounted) return;
       ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('''$itemName ${'supply_already_requested'.tr()}''')));
       return;
    }

    try {
      String fullRequestedZone = requestedZone;
      bool isWomen = widget.userSection.toLowerCase().contains('kadın') || 
                     widget.userSection.toLowerCase().contains('kadin') || 
                     widget.userSection.toLowerCase().contains('hanım') ||
                     widget.userRoles.any((r) => r.toLowerCase().contains('hanim') || r.toLowerCase().contains('kadin'));
                     
      bool isMen = widget.userSection.toLowerCase().contains('erkek');

      if (!fullRequestedZone.toLowerCase().contains('hanım') && !fullRequestedZone.toLowerCase().contains('erkek') && !fullRequestedZone.toLowerCase().contains('kadın')) {
         if (isWomen) {
            fullRequestedZone = 'Hanımlar Bölümü - $fullRequestedZone';
         } else if (isMen) {
            fullRequestedZone = 'Erkekler Bölümü - $fullRequestedZone';
         } else if (widget.userSection.isNotEmpty && widget.userSection != 'Genel Alan') {
            fullRequestedZone = '${widget.userSection} - $fullRequestedZone';
         }
      }
      
      String finalUserName = _currentUserName.isNotEmpty ? _currentUserName : (widget.userName.isNotEmpty ? widget.userName : 'Personel');
      
      if (isWomen && finalUserName != 'Personel') {
          final parts = finalUserName.split(' ').where((p) => p.isNotEmpty).toList();
          finalUserName = parts.map((p) => '${p[0].toUpperCase()}${'*' * (p.length > 3 ? 3 : p.length - 1)}').join(' ');
      }

      await FirebaseFirestore.instance.collection('kermes_events')
          .doc(widget.kermesId)
          .collection('supply_requests')
          .add({
             'requestedByUid': uid,
             'requestedByName': finalUserName,
             'requestedZone': fullRequestedZone,
             'category': category,
             'itemName': itemName,
             'status': 'pending',
             'urgency': urgency,
             'createdAt': FieldValue.serverTimestamp(),
          });
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('''${'supply_request_sent'.tr()} $itemName'''),
            backgroundColor: Colors.green,
         ));
      }
    } catch(e) {
      // ignore
    }
  }

  
  Future<void> _askUrgencyAndSubmit(String itemName, {String category = 'custom'}) async {
    String selectedZone = 'Genel Alan';
    if (widget.userPrepZones.length == 1) {
       selectedZone = widget.userPrepZones.first;
    } else if (widget.userPrepZones.length > 1) {
       final zoneResult = await showDialog<String>(
          context: context,
          builder: (ctx) {
            final isDark = Theme.of(ctx).brightness == Brightness.dark;
            return AlertDialog(
               shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
               backgroundColor: isDark ? const Color(0xFF222222) : Colors.white,
               title: Text('Hangi İstasyon?', style: TextStyle(color: isDark ? Colors.white : Colors.black, fontWeight: FontWeight.bold)),
               content: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: widget.userPrepZones.map((z) => Padding(
                     padding: const EdgeInsets.only(bottom: 8),
                     child: ListTile(
                        title: Text(z, style: const TextStyle(fontWeight: FontWeight.bold)),
                        onTap: () => Navigator.pop(ctx, z),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        tileColor: isDark ? Colors.white10 : Colors.grey.shade100,
                     ),
                  )).toList(),
               )
            );
          }
       );
       if (zoneResult == null) return; // User cancelled
       selectedZone = zoneResult;
    }

    bool hasNextDay = false;
    if (_eventEndDate != null) {
       final now = DateTime.now();
       final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);
       if (_eventEndDate!.isAfter(endOfDay)) {
          hasNextDay = true;
       }
    }

    if (!mounted) return;
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final dIsDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: dIsDark ? const Color(0xFF222222) : Colors.white,
          title: Text('Aciliyet Durumu', style: TextStyle(color: dIsDark ? Colors.white : Colors.black, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
               Text('$itemName siparişiniz için aciliyet belirleyin:', style: const TextStyle(fontSize: 15)),
               const SizedBox(height: 20),
               ElevatedButton.icon(
                 style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
                 icon: const Icon(Icons.local_fire_department),
                 label: const Text('Hemen Gelsin (Süper Acil)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                 onPressed: () => Navigator.pop(ctx, 'super_urgent'),
               ),
               const SizedBox(height: 12),
               OutlinedButton.icon(
                 style: OutlinedButton.styleFrom(foregroundColor: dIsDark ? Colors.white : Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
                 icon: const Icon(Icons.hourglass_bottom),
                 label: const Text('1-2 Saat İçinde Olur'),
                 onPressed: () => Navigator.pop(ctx, 'normal'),
               ),
               if (hasNextDay) ...[
                 const SizedBox(height: 12),
                 OutlinedButton.icon(
                   style: OutlinedButton.styleFrom(foregroundColor: Colors.blue, side: const BorderSide(color: Colors.blue), padding: const EdgeInsets.symmetric(vertical: 14)),
                   icon: const Icon(Icons.calendar_today),
                   label: const Text('Yarın İçin', style: TextStyle(fontWeight: FontWeight.bold)),
                   onPressed: () => Navigator.pop(ctx, 'for_tomorrow'),
                 ),
               ]
            ]
          )
        );
      }
    );

    if (result != null) {
      if (!mounted) return;
      await _submitRequest(itemName, selectedZone, category: category, urgency: result);
    }
  }

  String _getDisplayZone(Map<String, dynamic> d) {
      String displayZone = d['requestedZone'] ?? 'Genel Alan';
      String reqName = d['requestedByName']?.toString() ?? '';
      
      bool alreadyHasGender = displayZone.toLowerCase().contains('hanım') || displayZone.toLowerCase().contains('kadın') || displayZone.toLowerCase().contains('erkek');
      if (alreadyHasGender) return displayZone;

      bool isWomen = reqName.contains('*') || widget.userSection.toLowerCase().contains('hanım') || widget.userSection.toLowerCase().contains('kadın');
      
      if (isWomen) {
           return "Hanımlar Bölümü - $displayZone";
      } else if (reqName != 'Personel') {
           return "Erkekler Bölümü - $displayZone";
      }
      return displayZone;
  }

  Widget _buildStatusBadge(String status, {String? urgency}) {
    if (status == 'completed') {
       return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(8)),
          child: Text('supply_status_completed'.tr(), style: TextStyle(color: Colors.black54, fontSize: 12, fontWeight: FontWeight.bold)),
       );
    } else if (status == 'on_the_way') {
       return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: Colors.amber.shade200, borderRadius: BorderRadius.circular(8)),
          child: Text('supply_status_on_the_way'.tr(), style: TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold)),
       );
    } else if (status == 'cancelled') {
       return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(8)),
          child: const Text('İptal Edildi', style: TextStyle(color: Colors.black54, fontSize: 12, fontWeight: FontWeight.bold)),
       );
    } else if (status == 'rejected') {
       return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: Colors.red.shade200, borderRadius: BorderRadius.circular(8)),
          child: Text('Reddedildi', style: TextStyle(color: Colors.red.shade900, fontSize: 12, fontWeight: FontWeight.bold)),
       );
    }

    // Pending
    if (urgency == 'super_urgent') {
      return const Text('⚠️ SÜPER ACİL', style: TextStyle(color: Colors.red, fontSize: 13, fontWeight: FontWeight.bold));
    } else if (urgency == 'for_tomorrow') {
      return Container(
         padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
         decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8)),
         child: const Text('Yarın İçin', style: TextStyle(color: Colors.blue, fontSize: 12, fontWeight: FontWeight.bold)),
      );
    }

    return Container(
       padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
       decoration: BoxDecoration(color: Colors.orange.shade100, borderRadius: BorderRadius.circular(8)),
       child: const Text('Bekliyor', style: TextStyle(color: Colors.orange, fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }

  void _showSupplyDetailSheet(BuildContext context, QueryDocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = d['status'] as String? ?? 'pending';
    final urgency = d['urgency'] as String? ?? 'normal';
    
    // Format timestamp
    String rTimeStr = '-';
    String uTimeStr = '-';
    int? diffMins;
    if (d['createdAt'] != null) {
       final ts = d['createdAt'] as Timestamp;
       final dt = ts.toDate();
       rTimeStr = '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
       
       if (d['updatedAt'] != null) {
          final uts = d['updatedAt'] as Timestamp;
          final uDt = uts.toDate();
          uTimeStr = '${uDt.day.toString().padLeft(2, '0')}.${uDt.month.toString().padLeft(2, '0')}.${uDt.year} ${uDt.hour.toString().padLeft(2, '0')}:${uDt.minute.toString().padLeft(2, '0')}';
          diffMins = uDt.difference(dt).inMinutes;
       }
    }

    Color statusColor = Colors.orange;
    String statusText = 'Bekliyor';
    IconData statusIcon = Icons.access_time_filled;
    if (status == 'on_the_way') { statusColor = Colors.amber; statusText = 'Yolda / Hazırlanıyor'; statusIcon = Icons.local_shipping; }
    String formatDuration(int m) {
      if (m < 60) return '$m dakika';
      if (m < 24 * 60) return '${m ~/ 60} saat${m % 60 == 0 ? '' : ' ${m % 60} dk'}';
      return '${m ~/ (24 * 60)} gün${(m % (24 * 60)) ~/ 60 == 0 ? '' : ' ${(m % (24 * 60)) ~/ 60} saat'}';
    }

    if (status == 'completed') { statusColor = Colors.green; statusText = 'Tamamlandı'; if (diffMins != null) statusText += '\n(${formatDuration(diffMins)} sürdü)'; statusIcon = Icons.check_circle; }
    else if (status == 'rejected') { statusColor = Colors.red; statusText = 'Reddedildi'; if (diffMins != null) statusText += '\n(${formatDuration(diffMins)} sürdü)'; statusIcon = Icons.cancel; }
    else if (status == 'cancelled') { statusColor = Colors.grey; statusText = 'İptal Edildi'; statusIcon = Icons.cancel; }
    
    if (urgency == 'super_urgent' && status == 'pending') {
       statusColor = Colors.red;
    }
    
    final isMine = d['requestedByUid'] == FirebaseAuth.instance.currentUser?.uid;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.only(top: 12),
        decoration: BoxDecoration(
          color: Theme.of(ctx).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(child: Container(width: 40, height: 5, decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(10)))),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Colors.blueAccent),
                    const SizedBox(width: 10),
                    Text('Talep Detayları', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Theme.of(ctx).colorScheme.onSurface)),
                    const Spacer(),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx), padding: EdgeInsets.zero, constraints: const BoxConstraints()),
                  ]
                ),
              ),
              const Divider(height: 30),
              
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Item name
                    Text(d['itemName'] ?? 'Malzeme', textAlign: TextAlign.center, style: const TextStyle(fontSize: 22.0, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 20),
                    
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E1E1E) : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
                      ),
                      child: Column(
                        children: [
                           _buildDetailRow('Durum', Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                              Icon(statusIcon, color: statusColor, size: 18),
                              const SizedBox(width: 6),
                              Expanded(child: Text(statusText, style: TextStyle(color: statusColor, fontWeight: FontWeight.w800, fontSize: 15)))
                           ]), isDark),
                           const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1)),
                           _buildDetailRow('Aciliyet', Text(urgency == 'super_urgent' ? '🔥 SÜPER ACİL' : (urgency == 'for_tomorrow' ? '📅 Yarın İçin' : 'Normal'), style: TextStyle(color: urgency == 'super_urgent' ? Colors.red : (urgency == 'for_tomorrow' ? Colors.blue : (isDark ? Colors.white70 : Colors.black87)), fontWeight: (urgency == 'super_urgent' || urgency == 'for_tomorrow') ? FontWeight.w800 : FontWeight.w500)), isDark),
                           const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1)),
                           _buildDetailRow('İsteyen', Text(d['requestedByName'] ?? '-', style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)), isDark),
                           const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1)),
                           _buildDetailRow('Konum', Text(_getDisplayZone(d), style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)), isDark),
                           const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1)),
                           _buildDetailRow('İstek Zamanı', Text(rTimeStr, style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)), isDark),
                           if (uTimeStr != '-' && uTimeStr != rTimeStr) ...[
                              const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1)),
                              _buildDetailRow('Cevap Zamanı', Text(uTimeStr, style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)), isDark),
                           ],
                           if (d['adminReply'] != null && d['adminReply'].toString().isNotEmpty) ...[
                              const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider(height: 1)),
                              _buildDetailRow('Admin Notu', Text(d['adminReply'], style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)), isDark),
                           ],
                        ]
                      )
                    ),
                    const SizedBox(height: 20),
                    if (isSupplier && status == 'pending') ...[
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                           style: ElevatedButton.styleFrom(backgroundColor: Colors.amber.shade600, foregroundColor: Colors.white, elevation: 0, padding: const EdgeInsets.symmetric(vertical: 14)),
                           icon: const Icon(Icons.local_shipping),
                           label: const Text('HAZIRLANIYOR / YOLDA', style: TextStyle(fontWeight: FontWeight.bold)),
                           onPressed: () {
                              doc.reference.update({'status': 'on_the_way', 'updatedAt': FieldValue.serverTimestamp()});
                              Navigator.pop(ctx);
                           },
                        )
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                           style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade50, foregroundColor: Colors.red, elevation: 0, 
                                                           side: BorderSide(color: Colors.red.shade300), padding: const EdgeInsets.symmetric(vertical: 14)),
                           icon: const Icon(Icons.cancel),
                           label: const Text('Talebi Reddet / İptal Et', style: TextStyle(fontWeight: FontWeight.bold)),
                           onPressed: () {
                              doc.reference.update({'status': 'cancelled', 'updatedAt': FieldValue.serverTimestamp()});
                              Navigator.pop(ctx);
                           },
                        )
                      ),
                    ] else if (isSupplier && status == 'on_the_way') ...[
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                           style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white, elevation: 0, padding: const EdgeInsets.symmetric(vertical: 14)),
                           icon: const Icon(Icons.check_circle_outline),
                           label: const Text('TESLİM EDİLDİ / TAMAMLANDI', style: TextStyle(fontWeight: FontWeight.bold)),
                           onPressed: () {
                              doc.reference.update({'status': 'completed', 'updatedAt': FieldValue.serverTimestamp()});
                              Navigator.pop(ctx);
                           },
                        )
                      ),
                    ] else if (isMine && status == 'pending') ...[
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                           style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade50, foregroundColor: Colors.red, elevation: 0, 
                                                           side: BorderSide(color: Colors.red.shade300), padding: const EdgeInsets.symmetric(vertical: 14)),
                           icon: const Icon(Icons.cancel),
                           label: const Text('Talebi İptal Et', style: TextStyle(fontWeight: FontWeight.bold)),
                           onPressed: () {
                              doc.reference.update({'status': 'cancelled', 'updatedAt': FieldValue.serverTimestamp()});
                              Navigator.pop(ctx);
                           },
                        )
                      )
                    ],
                  ],
                )
              ),
              const SizedBox(height: 30),
            ]
          )
        )
      )
    );
  }

  Widget _buildDetailRow(String label, Widget child, bool isDark) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 100, child: Text(label, style: TextStyle(color: isDark ? Colors.white54 : Colors.black54, fontSize: 13, fontWeight: FontWeight.w600))),
        Expanded(child: child),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.grey.shade50,
      appBar: AppBar(
        title: Text('supply_alarm_title'.tr()),
        backgroundColor: Colors.red.shade700,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // QUICK REQUEST SECTION
            Theme(
               data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
               child: ExpansionTile(
                 initiallyExpanded: false,
                 backgroundColor: isDark ? Colors.black26 : Colors.white,
                 collapsedBackgroundColor: isDark ? Colors.black26 : Colors.white,
                 title: Text('supply_quick_request'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                 childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
                 children: [
                    if (_isLoadingCats)
                       const Center(child: CircularProgressIndicator())
                    else if (_categories.isNotEmpty)
                       ..._categories.map((cat) => Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                             Text(cat['title'] ?? '', style: TextStyle(fontSize: 13, color: isDark ? Colors.white54 : Colors.black54)),
                             const SizedBox(height: 5),
                             Wrap(
                                spacing: 6, runSpacing: 6,
                                children: (cat['items'] as List<dynamic>? ?? []).map((item) => InkWell(
                                   onTap: () => _askUrgencyAndSubmit(item as String, category: cat['title']),
                                   borderRadius: BorderRadius.circular(20),
                                   child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                         color: isDark ? const Color(0xFFE5E5E5) : Colors.white,
                                         border: Border.all(color: Colors.red.shade700, width: 1.0),
                                         borderRadius: BorderRadius.circular(16)
                                      ),
                                      child: Text(item, style: TextStyle(color: Colors.red.shade900, fontSize: 12, fontWeight: FontWeight.bold)),
                                   ),
                                )).toList(),
                             ),
                             const SizedBox(height: 12),
                          ],
                       ))
                    else
                       Text('supply_no_items'.tr()),
                       
                    const Divider(),
                    Row(
                      children: [
                         Expanded(
                           child: TextField(
                             controller: _customCtrl,
                             decoration: InputDecoration(
                                hintText: 'Listede yoksa buraya yazın...',
                                hintStyle: TextStyle(color: isDark ? Colors.white30 : Colors.black38),
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                             ),
                           ),
                         ),
                         const SizedBox(width: 10),
                         ElevatedButton(
                           style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white),
                           onPressed: () {
                              if (_customCtrl.text.trim().isNotEmpty) {
                                 _askUrgencyAndSubmit(_customCtrl.text.trim());
                                 _customCtrl.clear();
                              }
                           },
                           child: const Text('Gönder'),
                         )
                      ],
                    )
                 ],
               ),
            ),
            
            Container(
               height: 5,
               color: isDark ? Colors.black : Colors.grey.shade200,
            ),
            
            // LIVE REQUESTS LIST
            Container(
               padding: const EdgeInsets.all(16),
               alignment: Alignment.centerLeft,
               child: const Text('Canlı İhtiyaç Listesi (Herkes Görür)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),
            
            StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance.collection('kermes_events')
                   .doc(widget.kermesId)
                   .collection('supply_requests')
                   .orderBy('createdAt', descending: true)
                   .limit(30)
                   .snapshots(),
                builder: (context, snapshot) {
                   if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                   }
                   if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                      return Center(
                         child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                               Icon(Icons.check_circle_outline, size: 64, color: isDark ? Colors.white24 : Colors.grey.shade300),
                               const SizedBox(height: 16),
                               const Text('Şu an hiç malzeme ihtiyacı yok.', style: TextStyle(color: Colors.grey)),
                            ],
                         ),
                      );
                   }
                   
                   final docs = snapshot.data!.docs;
                   final pendingDocs = docs.where((doc) {
                      final d = doc.data() as Map<String, dynamic>;
                      return d['status'] == 'pending' || d['status'] == 'on_the_way' || d['status'] == 'super_urgent';
                   }).toList();
                   
                   final completedDocs = docs.where((doc) {
                      final d = doc.data() as Map<String, dynamic>;
                      return d['status'] == 'completed' || d['status'] == 'rejected' || d['status'] == 'cancelled';
                   }).toList();
                   
                   Widget buildCard(QueryDocumentSnapshot doc) {
                         final d = doc.data() as Map<String, dynamic>;
                         final isMine = d['requestedByUid'] == FirebaseAuth.instance.currentUser?.uid;
                         final status = d['status'] as String? ?? 'pending';
                         
                         return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                               color: status == 'completed' ? (isDark ? Colors.white10 : Colors.grey.shade100) : (isDark ? const Color(0xFF2A2A2A) : Colors.white),
                               border: Border.all(color: status == 'on_the_way' ? Colors.amber : (status == 'completed' ? Colors.transparent : Colors.red.withValues(alpha: 0.3))),
                               borderRadius: BorderRadius.circular(12),
                            ),
                            child: Material(
                               color: Colors.transparent,
                               child: InkWell(
                                  borderRadius: BorderRadius.circular(12),
                                  onTap: () => _showSupplyDetailSheet(context, doc),
                                  child: Padding(
                                     padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                     child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                           CircleAvatar(
                                              backgroundColor: status == 'completed' ? Colors.grey : (status == 'on_the_way' ? Colors.amber : Colors.red.shade100),
                                              child: Icon(status == 'completed' ? Icons.check : (status == 'on_the_way' ? Icons.local_shipping : Icons.campaign), 
                                                 color: status == 'completed' ? Colors.white : (status == 'on_the_way' ? Colors.white : Colors.red)),
                                           ),
                                           const SizedBox(width: 12),
                                           Expanded(
                                              child: Column(
                                                 crossAxisAlignment: CrossAxisAlignment.start,
                                                 children: [
                                                    Text(d['itemName'] ?? '', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, decoration: (status == 'completed' || status == 'cancelled' || status == 'rejected') ? TextDecoration.lineThrough : null)),
                                                    const SizedBox(height: 2),
                                                    Text("${d['requestedByName']} • ${_getDisplayZone(d)}", style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : Colors.black87)),
                                                    if (isMine && status == 'pending') ...[
                                                       const SizedBox(height: 8),
                                                       InkWell(
                                                         onTap: () => doc.reference.update({'status': 'cancelled', 'updatedAt': FieldValue.serverTimestamp()}),
                                                         child: Text('İptal Et', style: TextStyle(color: Colors.red.shade400, fontWeight: FontWeight.bold, fontSize: 13, decoration: TextDecoration.underline)),
                                                       )
                                                    ]
                                                 ],
                                              ),
                                           ),
                                           const SizedBox(width: 8),
                                           _buildStatusBadge(status, urgency: d['urgency']),
                                        ],
                                     ),
                                  ),
                               ),
                            ),
                         );
                   }

                   return ListView(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      padding: const EdgeInsets.only(left: 16, right: 16, bottom: 40),
                      children: [
                        ...pendingDocs.map((doc) => buildCard(doc)),
                        if (completedDocs.isNotEmpty)
                           Theme(
                             data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                             child: ExpansionTile(
                               tilePadding: EdgeInsets.zero,
                               title: Text('Tamamlananlar (${completedDocs.length})', style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                               children: completedDocs.map((doc) => Opacity(opacity: 0.6, child: buildCard(doc))).toList(),
                             ),
                           )
                      ],
                   );
                },
             ),
          ],
        ),
      ),
    );
  }
}
