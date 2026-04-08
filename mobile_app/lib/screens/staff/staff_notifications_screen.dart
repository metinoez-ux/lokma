import 'package:cloud_firestore/cloud_firestore.dart';
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
      case 'parking_emergency': return Icons.local_parking;
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
      case 'parking_emergency': return Colors.orange;
      case 'new_delivery': return Colors.amber;
      case 'chat_message': return Colors.teal;
      default: return Colors.blue;
    }
  }

  void _markRead(Map<String, dynamic> notif) {
    final id = notif['id'];
    // Bos veya null ID'ye Firestore erisimi engelle
    if (id == null || id.toString().trim().isEmpty) return;
    markStaffNotificationAsRead(id.toString());
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
              final iconColor = _colorForType(type, isRead);
              final iconData = _iconForType(type);

              return GestureDetector(
                onTap: () => _markRead(notif),
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
                  child: Padding(
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
                              // Baslik
                              Text(
                                title,
                                style: TextStyle(
                                  fontWeight: isRead ? FontWeight.w600 : FontWeight.w800,
                                  fontSize: isRead ? 15 : 16,
                                  color: isDark ? Colors.white : Colors.black87,
                                  height: 1.2,
                                ),
                              ),
                              // Gövde
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
                              // Zaman damgasi
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
                        // Okunmamis - kirmizi nokta sag ust
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
                      ],
                    ),
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
