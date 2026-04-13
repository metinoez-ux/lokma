import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers/staff_notifications_provider.dart';

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

  IconData _iconForType(String? type) {
    switch (type) {
      case 'kermes_assignment': return Icons.assignment_ind;
      case 'parking_emergency':
      case 'kermes_parking': return Icons.local_parking;
      case 'order_status':
      case 'kermes_order_created': return Icons.receipt_long;
      case 'new_delivery': return Icons.delivery_dining;
      case 'chat_message': return Icons.chat;
      default: return Icons.notifications;
    }
  }

  Color _colorForType(String? type, bool isRead) {
    if (isRead) return Colors.grey;
    switch (type) {
      case 'kermes_assignment': return Colors.purple;
      case 'parking_emergency':
      case 'kermes_parking': return Colors.orange;
      case 'new_delivery': return Colors.amber;
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
    final isRoster = type == 'kermes_assignment' || type == 'roster_shift';

    // Roster Action specific variables
    bool isActionProcessing = false;
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
                        color: isParking
                            ? (isDark ? Colors.red[900]!.withOpacity(0.15) : Colors.red[50])
                            : (isDark ? Colors.orange[900]!.withOpacity(0.15) : Colors.orange[50]),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: isParking ? (isDark ? Colors.red[800]!.withOpacity(0.3) : Colors.red[100]!) : (isDark ? Colors.orange[800]!.withOpacity(0.3) : Colors.orange[100]!)),
                      ),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(Icons.warning_amber_rounded, size: 18, color: isParking ? (isDark ? Colors.red[300] : Colors.red[700]) : (isDark ? Colors.orange[300] : Colors.orange[700])),
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
                          Text('Yeni Vardiya Ataması', style: TextStyle(fontSize: 20.0, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 8),
                          Text(body, textAlign: TextAlign.center, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black87, height: 1.4)),
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
                                _rosterDetailRow('Tarih:', data['dateSpan'] ?? data['date'] ?? '-', isDark),
                                const SizedBox(height: 10),
                                _rosterDetailRow('Saat:', '${data['startTime'] ?? '-'} / ${data['endTime'] ?? '-'}', isDark),
                                const SizedBox(height: 10),
                                _rosterDetailRow('Görev:', data['role'] ?? '-', isDark),
                              ],
                            ),
                          ),
                          
                          const SizedBox(height: 30),
                          
                          (() {
                            bool canRevise = false;
                            if (data['createdAt'] != null) {
                              DateTime? dt;
                              if (data['createdAt'] is Timestamp) {
                                dt = (data['createdAt'] as Timestamp).toDate();
                              } else if (data['createdAt'] is String) {
                                dt = DateTime.tryParse(data['createdAt'] as String);
                              } else if (data['createdAt'] is int) {
                                dt = DateTime.fromMillisecondsSinceEpoch(data['createdAt'] as int);
                              }
                              
                              if (dt != null) {
                                final diff = DateTime.now().difference(dt);
                                if (diff.inMinutes <= 30) {
                                  canRevise = true;
                                }
                              } else {
                                canRevise = true;
                              }
                            } else {
                              canRevise = true; // Fallback
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
                              return Container(
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
            batch.update(doc.reference, {'status': action});
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
            .update({'response': action});
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
              final title = notif['title'] as String? ?? 'Bildirim';
              final body = notif['body'] as String? ?? '';
              final dateStr = _formatDate(notif['createdAt']);
              final imageUrl = notif['imageUrl'] as String?;
              final iconColor = _colorForType(type, isRead);
              final iconData = _iconForType(type);

              final bool hasDetail = type == 'kermes_parking' || type == 'kermes_flash_sale' || type == 'roster_shift' || type == 'kermes_assignment';

              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  _markRead(notif);
                  if (hasDetail) {
                    _showNotificationDetailSheet(context, notif);
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
                              child: Icon(iconData, color: iconColor, size: 22),
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
