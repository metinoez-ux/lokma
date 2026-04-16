import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers/staff_notifications_provider.dart';
import '../../models/kermes_order_model.dart';
import '../../widgets/kermes/order_qr_dialog.dart';

class StaffNotificationsScreen extends ConsumerStatefulWidget {
  const StaffNotificationsScreen({super.key});

  @override
  ConsumerState<StaffNotificationsScreen> createState() => _StaffNotificationsScreenState();
}

class _StaffNotificationsScreenState extends ConsumerState<StaffNotificationsScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) markAllStaffNotificationsAsRead();
    });
  }

  String _formatDate(dynamic createdAt) {
    DateTime? dt;
    try {
      if (createdAt is Timestamp) {
        dt = createdAt.toDate().toLocal();
      } else if (createdAt is String && createdAt.isNotEmpty) {
        dt = DateTime.parse(createdAt).toLocal();
      }
    } catch (_) {}

    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Az once';
    if (diff.inMinutes < 60) return '${diff.inMinutes} dk once';
    if (diff.inHours < 24) return '${diff.inHours} saat once';
    if (diff.inDays == 1) return 'Dun ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    return '${dt.day.toString().padLeft(2,'0')}.${dt.month.toString().padLeft(2,'0')}.${dt.year} ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
  }

  String _dateGroup(dynamic createdAt) {
    DateTime? dt;
    try {
      if (createdAt is Timestamp) {
        dt = createdAt.toDate().toLocal();
      } else if (createdAt is String && createdAt.isNotEmpty) {
        dt = DateTime.parse(createdAt).toLocal();
      }
    } catch (_) {}
    if (dt == null) return 'Eskiler';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final itemDay = DateTime(dt.year, dt.month, dt.day);
    final diff = today.difference(itemDay).inDays;
    if (diff == 0) return 'Bugun';
    if (diff == 1) return 'Dun';
    if (diff < 7) return 'Bu Hafta';
    return 'Daha Once';
  }

  IconData _iconForType(Map<String, dynamic> notif) {
    final type = notif['type'] as String?;
    switch (type) {
      case 'kermes_assignment': return Icons.assignment_ind;
      case 'parking_emergency':
      case 'kermes_parking': return Icons.local_parking;
      case 'order_status':
      case 'kermes_order_created': return Icons.receipt_long;
      case 'new_delivery': return Icons.delivery_dining;
      case 'supply_alarm': 
      case 'supply_alarm_status': {
         final st = notif['status'] as String?;
         if (st == 'on_the_way') return Icons.directions_run_rounded;
         if (st == 'completed') return Icons.check_circle_outline_rounded;
         if (st == 'rejected') return Icons.cancel_rounded;
         return Icons.campaign;
      }
      case 'chat_message': return Icons.chat;
      default: return Icons.notifications;
    }
  }

  Color _colorForType(Map<String, dynamic> notif, bool isRead) {
    if (isRead) return Colors.grey;
    final type = notif['type'] as String?;
    switch (type) {
      case 'kermes_assignment': return Colors.purple;
      case 'parking_emergency':
      case 'kermes_parking': return Colors.orange;
      case 'new_delivery': return Colors.amber;
      case 'supply_alarm': 
      case 'supply_alarm_status': {
         final st = notif['status'] as String?;
         if (st == 'on_the_way') return Colors.orange;
         if (st == 'completed') return Colors.green;
         if (st == 'rejected') return Colors.red;
         return Colors.teal;
      }
      case 'chat_message': return Colors.teal;
      default: return Colors.blue;
    }
  }

  void _markRead(Map<String, dynamic> notif) {
    final id = notif['id'];
    if (id == null || id.toString().trim().isEmpty) return;
    markStaffNotificationAsRead(id.toString());
  }

  void _showNotificationDetailSheet(BuildContext context, Map<String, dynamic> data) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final type = data['type'] as String?;
    final body = data['body'] as String? ?? '';
    final imageUrl = data['imageUrl'] as String?;
    final vehiclePlate = data['vehiclePlate'] as String? ?? '';
    final vehicleColor = data['vehicleColor'] as String? ?? '';
    final vehicleBrand = data['vehicleBrand'] as String? ?? '';
    final isParking = type == 'kermes_parking';
    final isDeleted = type == 'roster_deleted';
    final isParkingOrDeleted = isParking || isDeleted;
    final isRoster = type == 'kermes_assignment' || type == 'roster_shift';

    // Roster Action specific variables
    bool isActionProcessing = false;
    String? supplyReplyText;
    final isSupplyAlarm = type == 'supply_alarm' || type == 'supply_alarm_status';
    String? rosterResponse = data['response'] as String?; // 'accepted' | 'rejected'

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(margin: const EdgeInsets.only(top: 12, bottom: 8), width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[500], borderRadius: BorderRadius.circular(2))),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  // 1) Mesaj
                  if (!isRoster)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isParkingOrDeleted
                            ? (isDark ? Colors.red[900]!.withOpacity(0.15) : Colors.red[50])
                            : (isDark ? Colors.orange[900]!.withOpacity(0.15) : Colors.orange[50]),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: isParkingOrDeleted ? (isDark ? Colors.red[800]!.withOpacity(0.3) : Colors.red[100]!) : (isDark ? Colors.orange[800]!.withOpacity(0.3) : Colors.orange[100]!)),
                      ),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(isDeleted ? Icons.cancel : Icons.warning_amber_rounded, size: 18, color: isParkingOrDeleted ? (isDark ? Colors.red[300] : Colors.red[700]) : (isDark ? Colors.orange[300] : Colors.orange[700])),
                        const SizedBox(width: 8),
                        Expanded(child: Text(body, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 1.4, color: Theme.of(ctx).colorScheme.onSurface))),
                      ]),
                    ),
                  if (!isRoster) const SizedBox(height: 10),

                  // 2) Arac bilgisi - Alman plaka stili
                  if (isParking && vehiclePlate.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: IntrinsicHeight(
                        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF1A1A1A), width: 2.5),
                            ),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              Container(
                                width: 24,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF003399),
                                  borderRadius: BorderRadius.only(
                                    topLeft: Radius.circular(3),
                                    bottomLeft: Radius.circular(3),
                                  ),
                                ),
                                child: Column(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: [
                                  Text('*', style: TextStyle(color: Colors.yellow[600], fontSize: 8, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 1),
                                  const Text('D', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900)),
                                ]),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                child: Center(
                                  child: Text(
                                    vehiclePlate.toUpperCase(),
                                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 2, color: Color(0xFF1A1A1A), fontFamily: 'monospace'),
                                  ),
                                ),
                              ),
                            ]),
                          ),
                          if (vehicleColor.isNotEmpty || vehicleBrand.isNotEmpty) ...[
                            const SizedBox(width: 10),
                            Expanded(
                              child: Container(
                                decoration: BoxDecoration(
                                  color: isDark ? Colors.white.withOpacity(0.08) : Colors.white,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: isDark ? Colors.white54 : const Color(0xFF1A1A1A), width: 2.5),
                                ),
                                child: Center(
                                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                                    if (vehicleColor.isNotEmpty)
                                      Text(vehicleColor, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: isDark ? Colors.white : const Color(0xFF1A1A1A))),
                                    if (vehicleBrand.isNotEmpty) ...[
                                      if (vehicleColor.isNotEmpty) const SizedBox(height: 1),
                                      Text(vehicleBrand, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: isDark ? Colors.white : const Color(0xFF1A1A1A))),
                                    ],
                                  ]),
                                ),
                              ),
                            ),
                          ],
                        ]),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // 3) Resim - tam boyut
                  if (imageUrl != null && imageUrl.isNotEmpty) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Image.network(
                        imageUrl,
                        width: double.infinity,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Container(
                          height: 80,
                          decoration: BoxDecoration(color: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF0F0F2), borderRadius: BorderRadius.circular(14)),
                          child: Center(child: Icon(Icons.broken_image_rounded, color: Colors.grey[500], size: 32)),
                        ),
                        loadingBuilder: (_, child, progress) {
                          if (progress == null) return child;
                          return Container(height: 120, alignment: Alignment.center, child: CircularProgressIndicator(strokeWidth: 2, color: isDark ? Colors.grey[400] : Colors.grey[600]));
                        },
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // 4) Roster Shift Action (Interactive)
                  if (isSupplyAlarm) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? Colors.white12 : Colors.grey.shade200),
                      ),
                      child: Column(
                        children: [
                           (() {
                              final st = data['status'] as String? ?? 'pending';
                              Color c = Colors.red;
                              IconData? ic = Icons.campaign;
                              String? svgAsset;
                              if (st == 'on_the_way') { c = Colors.orange; svgAsset = 'assets/icons/man_run1.svg'; }
                              else if (st == 'completed' || type == 'supply_alarm_status') { c = Colors.green; svgAsset = 'assets/icons/package_ok1.svg'; }
                              else if (st == 'rejected') { c = Colors.red; ic = Icons.cancel_rounded; }
                              
                              return Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(color: c.withOpacity(0.1), shape: BoxShape.circle),
                                child: svgAsset != null
                                    ? SvgPicture.asset(svgAsset, width: 36, height: 36, colorFilter: ColorFilter.mode(c, BlendMode.srcIn))
                                    : Icon(ic, size: 36, color: c),
                              );
                           })(),
                           const SizedBox(height: 16),
                           Text(data['itemName'] ?? 'Malzeme', textAlign: TextAlign.center, style: const TextStyle(fontSize: 20.0, fontWeight: FontWeight.w800)),
                           const SizedBox(height: 8),
                           Text(body, textAlign: TextAlign.center, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black87, height: 1.4)),
                           const SizedBox(height: 24),
                           
                           (() {
                             final rId = data['requestId'] as String?;
                             final kId = data['kermesId'] as String?;
                             if (rId == null || kId == null || rId.trim().isEmpty || kId.trim().isEmpty) {
                               return const Text('Eksik talep verisi.', style: TextStyle(color: Colors.red));
                             }
                             
                             return FutureBuilder<Map<String, dynamic>?>(
                                future: () async {
                                   final sSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(kId).collection('supply_requests').doc(rId).get();
                                   if (!sSnap.exists) return null;
                                   final res = sSnap.data() as Map<String, dynamic>;
                                   final uId = res['requestedByUid'] as String?;
                                   if (uId != null) {
                                      try {
                                         final rSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(kId).collection('rosters').where('userId', isEqualTo: uId).get();
                                         if (rSnap.docs.isNotEmpty) {
                                             res['rSection'] = rSnap.docs.first.data()['role'];
                                         }
                                         
                                         final uDoc = await FirebaseFirestore.instance.collection('users').doc(uId).get();
                                         if (uDoc.exists) {
                                            final ud = uDoc.data()!;
                                            final fullName = ud['fullName'] ?? ud['displayName'];
                                            final fn = ud['firstName'];
                                            final ln = ud['lastName'];
                                            if (fn != null && fn.toString().trim().isNotEmpty) {
                                                res['requestedByName'] = '${fn} ${ln ?? ''}'.trim();
                                            } else if (fullName != null && fullName.toString().trim().isNotEmpty) {
                                                res['requestedByName'] = fullName;
                                            }
                                            return res;
                                         }
                                         
                                         final aSnap = await FirebaseFirestore.instance.collection('admins').doc(uId).get();
                                         if (aSnap.exists) {
                                             if (aSnap.data()?['name'] != null && aSnap.data()!['name'].toString().trim().isNotEmpty) {
                                                 res['requestedByName'] = aSnap.data()!['name'];
                                             }
                                             if (res['rSection'] == null) {
                                                res['rSection'] = aSnap.data()?['sectionId'];
                                             }
                                             return res;
                                         }
                                      } catch (_) {}
                                   }
                                   return res;
                                }(),
                                builder: (ctx, snap) {
                                  if (snap.connectionState == ConnectionState.waiting) return const Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator());
                                  if (!snap.hasData || snap.data == null) {
                                     if (type == 'supply_alarm_status') return const Text('Bu bir durum güncellemesidir.\n(Talep sistemden silinmiş olabilir)', textAlign: TextAlign.center);
                                     return const Text('Talep detaylarına ulaşılamadı.', style: TextStyle(color: Colors.grey));
                                  }
                                  
                                  final reqData = snap.data!;
                                  String who = reqData['requestedByName'] ?? 'Personel';
                                  if (who.trim().isEmpty || who.trim() == 'Personel ' || who.trim() == 'null') who = 'Personel';

                                  final section = reqData['rSection'] as String?;
                                  bool isWomen = section != null && (section.toLowerCase().contains('women') || section.toLowerCase().contains('kadin') || section.toLowerCase().contains('kadın'));
                                  if (isWomen) {
                                      final parts = who.split(' ');
                                      who = parts.map((p) => p.isNotEmpty ? '${p[0]}${'*' * (p.length > 5 ? 5 : p.length - 1)}' : '').join(' ');
                                  }
                                  String zone = reqData['requestedZone'] ?? '-';
                                  String sectionLabel = '';
                                  if (section != null && section.isNotEmpty) {
                                      final sl = section.toLowerCase();
                                      if (sl.contains('women') || sl.contains('kadin') || sl.contains('kadın')) sectionLabel = 'Kadınlar Bölümü';
                                      else if (sl.contains('men') || sl.contains('erkek')) sectionLabel = 'Erkekler Bölümü';
                                      else if (sl.contains('ocakbasi') || sl.contains('ocakbaşı')) sectionLabel = 'Ocakbaşı';
                                      else sectionLabel = section[0].toUpperCase() + section.substring(1).replaceAll('_', ' ');
                                  }
                                  if (sectionLabel.isNotEmpty) {
                                      if (zone.toLowerCase() != sectionLabel.toLowerCase()) {
                                          zone = '$sectionLabel - $zone';
                                      } else {
                                          zone = sectionLabel;
                                      }
                                  }
                                  
                                  final status = reqData['status'] ?? 'pending';
                                  final urgency = reqData['urgency'] ?? 'normal';
                                  final adminReply = reqData['adminReply'] as String?;
                                  
                                  String rTimeStr = '-';
                                  String uTimeStr = '-';
                                  int? diffMins;
                                  if (reqData['createdAt'] != null) {
                                     final ts = reqData['createdAt'] as Timestamp;
                                     final dt = ts.toDate();
                                     rTimeStr = '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                                     
                                     if (reqData['updatedAt'] != null) {
                                        final uts = reqData['updatedAt'] as Timestamp;
                                        final uDt = uts.toDate();
                                        uTimeStr = '${uDt.day.toString().padLeft(2, '0')}.${uDt.month.toString().padLeft(2, '0')}.${uDt.year} ${uDt.hour.toString().padLeft(2, '0')}:${uDt.minute.toString().padLeft(2, '0')}';
                                        diffMins = uDt.difference(dt).inMinutes;
                                     }
                                  }

                                  Color statusColor = Colors.orange;
                                  String statusText = 'Bekliyor';
                                  if (status == 'on_the_way') { statusColor = Colors.blue; statusText = 'Yolda / Onaylandı'; }
                                  else if (status == 'completed') { statusColor = Colors.green; statusText = 'Tamamlandı'; if (diffMins != null) statusText += '\n($diffMins dakika sürdü)'; }
                                  else if (status == 'rejected') { statusColor = Colors.red; statusText = 'Reddedildi'; if (diffMins != null) statusText += '\n($diffMins dakika sürdü)'; }
                                  
                                  Widget buildRow(String label, String val, {Color? c}) {
                                     return Padding(
                                       padding: const EdgeInsets.only(bottom: 10),
                                       child: Row(
                                         mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                         crossAxisAlignment: CrossAxisAlignment.start,
                                         children: [
                                           Text(label, style: TextStyle(color: isDark ? Colors.white54 : Colors.black54, fontWeight: FontWeight.w600)),
                                           const SizedBox(width: 8),
                                           Expanded(child: Text(val, textAlign: TextAlign.right, style: TextStyle(color: c ?? (isDark ? Colors.white : Colors.black), fontWeight: FontWeight.w800))),
                                         ],
                                       ),
                                     );
                                  }
                                  
                                  return Column(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 6),
                                        decoration: BoxDecoration(
                                          color: isDark ? const Color(0xFF1C1C1E) : const Color(0xFFF2F2F7),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(color: isDark ? Colors.white10 : Colors.black12)
                                        ),
                                        child: Column(
                                          children: [
                                            buildRow('Durum:', statusText, c: statusColor),
                                            buildRow('İstek Zamanı:', rTimeStr),
                                            buildRow('Cevap Zamanı:', uTimeStr),
                                            buildRow('İsteyen:', who),
                                            buildRow('Bölüm:', zone),
                                            if (urgency == 'super_urgent')
                                              buildRow('Aciliyet:', 'Süper Acil', c: Colors.red),
                                            if (adminReply != null && adminReply.trim().isNotEmpty)
                                              buildRow('Yetkili Notu:', adminReply, c: Colors.amber.shade700),
                                          ],
                                        ),
                                      ),
                                      
                                      if (type == 'supply_alarm' && status == 'pending') ...[
                                         const SizedBox(height: 20),
                                         if (isActionProcessing)
                                           const Column(children: [CircularProgressIndicator(), SizedBox(height: 10), Text('İşleniyor...')])
                                         else
                                           Column(
                                             children: [
                                                TextField(
                                                  onChanged: (v) => supplyReplyText = v,
                                                  decoration: InputDecoration(
                                                    hintText: 'Özel not (opsiyonel)...',
                                                    isDense: true,
                                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                                  ),
                                                ),
                                                const SizedBox(height: 12),
                                                Column(
                                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                                  children: [
                                                    ElevatedButton.icon(
                                                      style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                                                      icon: const Icon(Icons.check, size: 18),
                                                      label: const Text('YOLA ÇIKAR', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                                      onPressed: () async {
                                                        setSheetState(() => isActionProcessing = true);
                                                        final note = (supplyReplyText != null && supplyReplyText!.trim().isNotEmpty) ? supplyReplyText!.trim() : 'Tamam, getiriyorum.';
                                                        await _submitSupplyReply(data, 'on_the_way', note);
                                                        setSheetState(() { data['status'] = 'on_the_way'; isActionProcessing = false; });
                                                      }
                                                    ),
                                                    const SizedBox(height: 12),
                                                    ElevatedButton.icon(
                                                      style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                                                      icon: const Icon(Icons.close, size: 18),
                                                      label: const Text('REDDET', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                                      onPressed: () async {
                                                        setSheetState(() => isActionProcessing = true);
                                                        final note = (supplyReplyText != null && supplyReplyText!.trim().isNotEmpty) ? supplyReplyText!.trim() : 'Reddedildi.';
                                                        await _submitSupplyReply(data, 'rejected', note);
                                                        setSheetState(() { data['status'] = 'rejected'; isActionProcessing = false; });
                                                      }
                                                    ),
                                                  ]
                                                ),
                                             ]
                                           )
                                      ]
                                    ]
                                  );
                               }
                             );
                           })()
                        ]
                      )
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (isRoster) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? Colors.white12 : Colors.grey.shade200),
                        boxShadow: isDark ? [] : [
                          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 4))
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), shape: BoxShape.circle),
                            child: const Icon(Icons.assignment_ind_rounded, size: 36, color: Colors.blue),
                          ),
                          const SizedBox(height: 16),
                          Text(data['kermesName'] ?? 'Yeni Vardiya Ataması', textAlign: TextAlign.center, style: const TextStyle(fontSize: 20.0, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 8),
                          Text('Yeni bir göreve / mesai saatine atandınız.', textAlign: TextAlign.center, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black87, height: 1.4)),
                          const SizedBox(height: 24),
                          
                          // Details Box
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF1C1C1E) : const Color(0xFFF2F2F7),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: isDark ? Colors.white10 : Colors.black12)
                            ),
                            child: Column(
                              children: [
                                (() {
                                  String dStr = data['dateSpan'] ?? data['date'] ?? '-';
                                  if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(dStr)) {
                                    final parts = dStr.split('-');
                                    dStr = '${parts[2]}.${parts[1]}.${parts[0]}';
                                  }
                                  return _rosterDetailRow('Tarih:', dStr, isDark);
                                })(),
                                const SizedBox(height: 10),
                                _rosterDetailRow('Saat:', '${data['startTime'] ?? '-'} - ${data['endTime'] ?? '-'}', isDark),
                                const SizedBox(height: 10),
                                if (data['zone'] != null && data['zone'].toString().isNotEmpty) ...[
                                  _rosterDetailRow('Bölüm:', data['zone'], isDark),
                                  const SizedBox(height: 10),
                                ],
                                _rosterDetailRow('Görev:', data['role'] ?? '-', isDark),
                                if (data['address'] != null && data['address'].toString().isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  _rosterDetailRow('Adres:', data['address'], isDark),
                                ],
                                if (data['adminName'] != null && data['adminName'].toString().isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  _rosterDetailRow('Yetkili:', '${data['adminName']} ${data['adminPhone'] != null ? '(${data['adminPhone']})' : ''}', isDark),
                                ],
                              ],
                            ),
                          ),
                          
                          const SizedBox(height: 30),
                          
                          (() {
                            bool canRevise = false;
                            
                            if (rosterResponse == null) {
                               canRevise = true;
                            } else {
                               if (data['respondedAt'] != null) {
                                  DateTime? dt;
                                  if (data['respondedAt'] is Timestamp) {
                                    dt = (data['respondedAt'] as Timestamp).toDate();
                                  } else if (data['respondedAt'] is int) {
                                    dt = DateTime.fromMillisecondsSinceEpoch(data['respondedAt'] as int);
                                  }
                                  if (dt != null && DateTime.now().difference(dt).inMinutes <= 30) {
                                    canRevise = true;
                                  }
                               } else {
                                  // Fallback to createdAt for legacy records without respondedAt, but give 30m buffer
                                  if (data['createdAt'] != null) {
                                    DateTime? dt;
                                    if (data['createdAt'] is Timestamp) {
                                      dt = (data['createdAt'] as Timestamp).toDate();
                                    } else if (data['createdAt'] is String) {
                                      dt = DateTime.tryParse(data['createdAt'] as String);
                                    } else if (data['createdAt'] is int) {
                                      dt = DateTime.fromMillisecondsSinceEpoch(data['createdAt'] as int);
                                    }
                                    if (dt != null && DateTime.now().difference(dt).inMinutes <= 30) {
                                      canRevise = true;
                                    }
                                  }
                               }
                            }
                            
                            if (isActionProcessing) {
                              return Column(
                                children: [
                                  const CircularProgressIndicator(),
                                  const SizedBox(height: 10),
                                  const Text('İşleniyor...', style: TextStyle(fontWeight: FontWeight.w600)),
                                ]
                              );
                            } else if (rosterResponse != null && !canRevise) {
                              return Column(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                                    decoration: BoxDecoration(
                                      color: rosterResponse == 'accepted' ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: rosterResponse == 'accepted' ? Colors.green.withOpacity(0.3) : Colors.red.withOpacity(0.3)),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(rosterResponse == 'accepted' ? Icons.check_circle : Icons.cancel, color: rosterResponse == 'accepted' ? Colors.green : Colors.red),
                                        const SizedBox(width: 8),
                                        Text(
                                          rosterResponse == 'accepted' ? 'Görevi Kabul Ettiniz' : 'Görevi Reddettiniz',
                                          style: TextStyle(fontWeight: FontWeight.bold, color: rosterResponse == 'accepted' ? Colors.green : Colors.red),
                                        )
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text('Revize süresi (30dk) sona ermiştir.', style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black54)),
                                ],
                              );
                            } else {
                              return Row(
                                children: [
                                  Expanded(
                                    child: TextButton(
                                      style: TextButton.styleFrom(
                                        backgroundColor: rosterResponse == 'rejected' ? Colors.red.withOpacity(0.2) : Colors.red.withOpacity(0.05),
                                        foregroundColor: Colors.red,
                                        padding: const EdgeInsets.symmetric(vertical: 16),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(12),
                                          side: rosterResponse == 'rejected' ? const BorderSide(color: Colors.red, width: 2) : BorderSide.none,
                                        ),
                                      ),
                                      onPressed: () async {
                                        if (rosterResponse == 'rejected') return;
                                        setSheetState(() => isActionProcessing = true);
                                        await _submitRosterAction(data, 'rejected');
                                        setSheetState(() {
                                          isActionProcessing = false;
                                          rosterResponse = 'rejected';
                                        });
                                      },
                                      child: Text(rosterResponse == 'rejected' ? 'Reddettiniz' : 'Üstlenemiyorum', style: const TextStyle(fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: rosterResponse == 'accepted' ? Colors.green.shade700 : Colors.green,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 16),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(12),
                                          side: rosterResponse == 'accepted' ? const BorderSide(color: Colors.white, width: 2) : BorderSide.none,
                                        ),
                                        elevation: rosterResponse == 'accepted' ? 4 : 0,
                                      ),
                                      onPressed: () async {
                                        if (rosterResponse == 'accepted') return;
                                        setSheetState(() => isActionProcessing = true);
                                        await _submitRosterAction(data, 'accepted');
                                        setSheetState(() {
                                          isActionProcessing = false;
                                          rosterResponse = 'accepted';
                                        });
                                      },
                                      child: Text(rosterResponse == 'accepted' ? 'Kabul Ettiniz' : 'Görevi Kabul Et', style: const TextStyle(fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                ],
                              );
                            }
                          })(),
                        ]
                      )
                    )
                  ],

                  const SizedBox(height: 16),
                ]),
              ),
            ),
          ],
        ),
      )),
    );
  }

  Future<void> _submitSupplyReply(Map<String, dynamic> data, String status, String replyMessage) async {
    try {
      final kermesId = data['kermesId'] as String?;
      final requestId = data['requestId'] as String?;
      final notifId = data['id'] as String?;
      final uid = FirebaseAuth.instance.currentUser?.uid;
      
      if (kermesId != null && kermesId.trim().isNotEmpty && requestId != null && requestId.trim().isNotEmpty) {
        await FirebaseFirestore.instance.collection('kermes_events').doc(kermesId).collection('supply_requests').doc(requestId).update({
           'status': status,
           'adminReply': replyMessage,
           'adminReplyBy': uid,
           'updatedAt': FieldValue.serverTimestamp()
        });
      }
      if (uid != null && uid.trim().isNotEmpty && notifId != null && notifId.trim().isNotEmpty) {
         await FirebaseFirestore.instance.collection('users').doc(uid).collection('notifications').doc(notifId).update({
            'status': status
         });
      }
    } catch (e) {
      debugPrint('Supply reply error: $e');
    }
  }

  Widget _rosterDetailRow(String label, String value, bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: isDark ? Colors.white54 : Colors.black54, fontWeight: FontWeight.w600)),
        Text(value, style: TextStyle(color: isDark ? Colors.white : Colors.black, fontWeight: FontWeight.w800)),
      ],
    );
  }

  Future<void> _submitRosterAction(Map<String, dynamic> data, String action) async {
    try {
      final batchId = data['batchId'] as String?;
      final kermesId = data['kermesId'] as String?;
      final notifId = data['id'] as String?;
      final uid = FirebaseAuth.instance.currentUser?.uid;

      if (kermesId != null && batchId != null && batchId.isNotEmpty) {
        // Update rosters in kermes
        final rostersSnap = await FirebaseFirestore.instance
            .collection('kermes_events')
            .doc(kermesId)
            .collection('rosters')
            .where('batchId', isEqualTo: batchId)
            .get();

        if (rostersSnap.docs.isNotEmpty) {
          final batch = FirebaseFirestore.instance.batch();
          for (var doc in rostersSnap.docs) {
            batch.update(doc.reference, {'status': action, 'updatedAt': FieldValue.serverTimestamp()});
          }
          await batch.commit();
        }
      }

      if (uid != null && notifId != null) {
        // Update local notification state
        await FirebaseFirestore.instance
            .collection('users')
            .doc(uid)
            .collection('notifications')
            .doc(notifId)
            .update({'response': action, 'respondedAt': FieldValue.serverTimestamp()});
            
        // Mutate local data map so UI sees it immediately
        data['response'] = action;
        data['respondedAt'] = Timestamp.now();
      }
    } catch (e) {
      debugPrint('Roster action update error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final notificationsAsync = ref.watch(staffNotificationsProvider);

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F0F0F) : const Color(0xFFF2F2F7),
      appBar: AppBar(
        title: const Text(
          'Bildirimler',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.done_all, size: 18),
            label: const Text('Tumu Oku', style: TextStyle(fontSize: 12)),
            onPressed: () => markAllStaffNotificationsAsRead(),
          ),
        ],
      ),
      body: notificationsAsync.when(
        data: (notifications) {
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_off_outlined,
                      size: 72,
                      color: isDark ? Colors.grey[700] : Colors.grey[300]),
                  const SizedBox(height: 16),
                  Text(
                    'Henuz bildirim yok',
                    style: TextStyle(
                      fontSize: 16,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            );
          }

          // Gruplama
          final List<dynamic> listItems = [];
          String? lastGroup;
          for (final notif in notifications) {
            final group = _dateGroup(notif['createdAt']);
            if (group != lastGroup) {
              listItems.add(group);
              lastGroup = group;
            }
            listItems.add(notif);
          }

          return ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            itemCount: listItems.length,
            itemBuilder: (context, index) {
              final item = listItems[index];

              // Grup baslik
              if (item is String) {
                return Padding(
                  padding: const EdgeInsets.only(top: 18, bottom: 6, left: 4),
                  child: Text(
                    item,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                      color: isDark ? Colors.grey[500] : Colors.grey[500],
                    ),
                  ),
                );
              }

              final notif = item as Map<String, dynamic>;
              final isRead = notif['read'] as bool? ?? true;
              final type = notif['type'] as String?;
              String title = notif['title'] as String? ?? 'Bildirim';
              String body = notif['body'] as String? ?? '';
              
              if (type == 'supply_alarm' || type == 'supply_alarm_status') {
                 title = title.replaceAll('🏃‍♂️', '').replaceAll('🏃‍♀️', '').replaceAll('🏃', '').replaceAll('❌', '').replaceAll('✅', '').replaceAll('🚨', '').replaceAll('🔥', '').trim();
                 if (title.startsWith('SÜPER ACİL:')) title = title.replaceFirst('SÜPER ACİL:', '').trim();
                 if (title.startsWith('ACİL:')) title = title.replaceFirst('ACİL:', '').trim();
                 body = body.replaceAll(RegExp(r'[\u{10000}-\u{10FFFF}]|[\u{2000}-\u{2BFF}]', unicode: true), '').trim();
              }
              
              final dateStr = _formatDate(notif['createdAt']);
              final imageUrl = notif['imageUrl'] as String?;
              final iconColor = _colorForType(notif, isRead);
              final iconData = _iconForType(notif);
              
              String? svgAsset;
              if (type == 'supply_alarm_status') {
                 final st = notif['status'] as String?;
                 if (st == 'on_the_way') svgAsset = 'assets/icons/man_run1.svg';
                 else if (st == 'completed') svgAsset = 'assets/icons/package_ok1.svg';
              }

              final bool isOrder = type != null && type.contains('order');
              // Allow all non-order notifications to open the detail sheet so no message is ever "unclickable"
              final bool hasDetail = !isOrder;

              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () async {
                  _markRead(notif);
                  if (hasDetail) {
                    _showNotificationDetailSheet(context, notif);
                  } else if (isOrder) {
                    // Müşteri bildirimleri gibi, ordere doğrudan yönlendir:
                    final dataMap = notif['data'] as Map<String, dynamic>? ?? {};
                    final oid = notif['orderId'] ?? notif['kermesOrderId'] ?? dataMap['orderId'] ?? dataMap['kermesOrderId'];
                    if (oid != null && oid.toString().isNotEmpty) {
                      showDialog(
                        context: context,
                        barrierDismissible: false,
                        builder: (_) => Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400] : Colors.grey[600])),
                      );
                      try {
                        final doc = await FirebaseFirestore.instance.collection('kermes_orders').doc(oid.toString()).get();
                        if (doc.exists && context.mounted) {
                          Navigator.pop(context); // loading kapat
                          final kermesOrder = KermesOrder.fromDocument(doc);
                          showDialog(
                            context: context,
                            builder: (_) => OrderQRDialog(
                              orderId: kermesOrder.id,
                              orderNumber: kermesOrder.orderNumber,
                              kermesId: kermesOrder.kermesId,
                              kermesName: kermesOrder.kermesName,
                              totalAmount: kermesOrder.totalAmount,
                              isPaid: kermesOrder.isPaid,
                            ),
                          );
                        } else if (context.mounted) {
                          Navigator.pop(context);
                        }
                      } catch (e) {
                        if (context.mounted) Navigator.pop(context);
                      }
                    }
                  }
                },
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: isRead
                        ? (isDark ? const Color(0xFF1C1C1E) : Colors.white)
                        : (isDark ? const Color(0xFF1A1A30) : const Color(0xFFEFF6FF)),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isRead
                          ? (isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade200)
                          : iconColor.withOpacity(0.5),
                      width: isRead ? 0.5 : 1.5,
                    ),
                    boxShadow: isRead
                        ? []
                        : [
                            BoxShadow(
                              color: iconColor.withOpacity(0.08),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            )
                          ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (imageUrl != null && imageUrl.isNotEmpty)
                        ClipRRect(
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
                          child: Image.network(
                            imageUrl,
                            height: 140,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => const SizedBox(),
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Ikon
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: iconColor.withOpacity(isRead ? 0.08 : 0.15),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: svgAsset != null 
                                  ? Center(child: SvgPicture.asset(svgAsset, width: 22, height: 22, colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn)))
                                  : Icon(iconData, color: iconColor, size: 22),
                            ),
                            const SizedBox(width: 12),
                            // Metin
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    style: TextStyle(
                                      fontWeight: isRead ? FontWeight.w600 : FontWeight.w800,
                                      fontSize: isRead ? 15 : 16,
                                      color: isDark ? Colors.white : Colors.black87,
                                      height: 1.2,
                                    ),
                                  ),
                                  if (body.isNotEmpty) ...[
                                    const SizedBox(height: 5),
                                    Text(
                                      body,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                        color: isDark ? Colors.white70 : Colors.black.withOpacity(0.65),
                                        height: 1.4,
                                      ),
                                    ),
                                  ],
                                  if (dateStr.isNotEmpty) ...[
                                    const SizedBox(height: 7),
                                    Text(
                                      dateStr,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: isDark ? Colors.grey[400] : Colors.grey[500],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 6),
                            if (!isRead)
                              Container(
                                width: 10,
                                height: 10,
                                margin: const EdgeInsets.only(top: 2),
                                decoration: const BoxDecoration(
                                  color: Colors.red,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            if (hasDetail)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Icon(Icons.chevron_right, size: 18, color: isDark ? Colors.grey[600] : Colors.grey[400]),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('Yuklenemedi: $err', style: const TextStyle(color: Colors.red)),
        ),
      ),
    );
  }
}
