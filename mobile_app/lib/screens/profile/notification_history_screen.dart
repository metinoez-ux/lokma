import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../orders/courier_tracking_screen.dart';
import '../../services/order_service.dart';
import '../../services/chat_service.dart';

class NotificationHistoryScreen extends StatefulWidget {
  const NotificationHistoryScreen({super.key});

  @override
  State<NotificationHistoryScreen> createState() => _NotificationHistoryScreenState();
}

class _NotificationHistoryScreenState extends State<NotificationHistoryScreen> {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  
  @override
  void initState() {
    super.initState();
    timeago.setLocaleMessages('tr', timeago.TrMessages());
    _markAllAsRead();
  }

  Future<void> _markAllAsRead() async {
    final user = _auth.currentUser;
    if (user == null) return;

    try {
      final unreadDocs = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .collection('notifications')
          .where('read', isEqualTo: false)
          .get();

      if (unreadDocs.docs.isEmpty) return;

      final batch = FirebaseFirestore.instance.batch();
      for (var doc in unreadDocs.docs) {
        batch.update(doc.reference, {'read': true});
      }
      await batch.commit();
    } catch (e) {
      debugPrint('Error marking notifications as read: $e');
    }
  }

  // ── Status helpers ──────────────────────────────────────────────────────
  // 'iconData' = Material Icon (preferred), 'icon' = emoji fallback
  static final _statusMeta = <String, Map<String, dynamic>>{
    'pending':   {'label': 'Sipariş Verildi',    'icon': '', 'color': 0xFFFF9800, 'iconData': Icons.receipt_long_rounded},
    'accepted':  {'label': 'Onaylandı',          'icon': '', 'color': 0xFF4CAF50, 'iconData': Icons.check_circle_outline_rounded},
    'preparing': {'label': 'Hazırlanıyor',       'icon': '', 'color': 0xFF2196F3, 'iconData': Icons.room_service, 'assetIcon': 'assets/icons/food_preparing.png'},
    'ready':     {'label': 'Hazır',              'icon': '', 'color': 0xFF9C27B0, 'iconData': Icons.inventory_2_rounded, 'assetIcon': 'assets/icons/food_ready.png'},
    'onTheWay':       {'label': 'Yola Çıktı',          'icon': '', 'color': 0xFF00BCD4, 'iconData': Icons.delivery_dining},
    'readyForPickup': {'label': 'Alınmaya Hazır',      'icon': '', 'color': 0xFF007AFF, 'iconData': Icons.storefront_rounded},
    'delivered': {'label': 'Teslim Edildi',      'icon': '', 'color': 0xFF4CAF50, 'iconData': Icons.done_all_rounded},
    'served':    {'label': 'Servis Edildi',      'icon': '', 'color': 0xFF4CAF50, 'iconData': Icons.restaurant_rounded},
    'completed': {'label': 'Tamamlandı',         'icon': '', 'color': 0xFF4CAF50, 'iconData': Icons.verified_rounded},
    'rejected':  {'label': 'Reddedildi',         'icon': '', 'color': 0xFFFB335B, 'iconData': Icons.cancel_outlined},
    'cancelled': {'label': 'İptal Edildi',       'icon': '', 'color': 0xFFFB335B, 'iconData': Icons.block_rounded},
  };

  Map<String, dynamic> _meta(String status) =>
      _statusMeta[status] ?? {'label': status, 'icon': '', 'color': 0xFF9E9E9E, 'iconData': Icons.info_outline};

  @override
  Widget build(BuildContext context) {
    final user = _auth.currentUser;
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: Text(tr('profile.notifications'))),
        body: Center(child: Text(tr('auth.need_to_login'))),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? Theme.of(context).scaffoldBackgroundColor : Colors.white,
      appBar: AppBar(
        backgroundColor: isDark ? Theme.of(context).scaffoldBackgroundColor : Colors.white,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        elevation: 0,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.notifications_rounded, size: 20, color: Theme.of(context).colorScheme.onSurface),
            const SizedBox(width: 6),
            Text(
              tr('profile.notifications'),
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600,
                fontSize: 17,
              ),
            ),
          ],
        ),
        centerTitle: true,
        leading: IconButton(
          padding: const EdgeInsets.all(12),
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          icon: Icon(Icons.arrow_back_ios, color: Theme.of(context).iconTheme.color),
          onPressed: () {
            if (GoRouter.of(context).canPop()) {
              context.pop();
            } else {
              context.go('/');
            }
          },
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .collection('notifications')
            .orderBy('createdAt', descending: true)
            .limit(100)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
          }

          if (snapshot.hasError) {
            return Center(
              child: Text(
                'marketplace.error_occurred'.tr(),
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
              ),
            );
          }

          final docs = snapshot.data?.docs ?? [];

          if (docs.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_off_outlined,
                    size: 80,
                    color: isDark ? Colors.grey[700] : Colors.grey[300],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    tr('notifications.no_notifications_yet'),
                    style: TextStyle(
                      fontSize: 18,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            );
          }

          // ── Group by orderId ──────────────────────────────────────
          final List<_OrderGroup> orderGroups = [];
          final List<Map<String, dynamic>> genericNotifications = [];

          // Collect all order_status notifications grouped by orderId
          final Map<String, List<Map<String, dynamic>>> orderMap = {};

          for (final doc in docs) {
            final data = doc.data() as Map<String, dynamic>;
            final type = data['type'] as String?;
            final orderId = data['orderId'] as String?;

            if (type == 'order_status' && orderId != null && orderId.isNotEmpty) {
              orderMap.putIfAbsent(orderId, () => []);
              orderMap[orderId]!.add(data);
            } else {
              genericNotifications.add(data);
            }
          }

          // Convert map into ordered groups (most recent first)
          for (final entry in orderMap.entries) {
            final statuses = entry.value;
            // Sort statuses ascending by createdAt (oldest first → timeline order)
            statuses.sort((a, b) {
              final aTime = (a['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
              final bTime = (b['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
              return aTime.compareTo(bTime);
            });

            // The latest status determines the card sort key
            final latestTime = statuses.last['createdAt'] as Timestamp?;
            final rawNum = statuses.first['rawOrderNumber'] as String? ?? '';
            final bName = statuses.last['businessName'] as String? ??
                          statuses.first['businessName'] as String? ?? '';

            // Extract extra data from pending notification (first one)
            final pendingData = statuses.firstWhere(
              (s) => s['status'] == 'pending',
              orElse: () => statuses.first,
            );
            // Try to get totalAmount from any status notification
            double? totalAmt = (pendingData['totalAmount'] as num?)?.toDouble();
            if (totalAmt == null) {
              for (final s in statuses) {
                final amt = (s['totalAmount'] as num?)?.toDouble();
                if (amt != null && amt > 0) {
                  totalAmt = amt;
                  break;
                }
              }
            }
            final bCity = pendingData['businessCity'] as String? ?? '';
            final bPostal = pendingData['businessPostalCode'] as String? ?? '';

            // Detect order type from notification data
            String oType = 'delivery';
            for (final s in statuses) {
              final dm = s['deliveryMethod'] as String? ?? s['orderType'] as String? ?? '';
              if (dm.isNotEmpty) {
                oType = dm;
                break;
              }
            }

            orderGroups.add(_OrderGroup(
              orderId: entry.key,
              rawOrderNumber: rawNum,
              businessName: bName,
              statuses: statuses,
              latestTimestamp: latestTime,
              totalAmount: totalAmt,
              businessCity: bCity,
              businessPostalCode: bPostal,
              orderType: oType,
            ));
          }

          // Sort: active orders first, then by latest timestamp
          const activeStatuses = {'pending', 'accepted', 'preparing', 'ready', 'onTheWay'};
          orderGroups.sort((a, b) {
            final aLatestStatus = a.statuses.last['status'] as String? ?? '';
            final bLatestStatus = b.statuses.last['status'] as String? ?? '';
            final aActive = activeStatuses.contains(aLatestStatus) ? 0 : 1;
            final bActive = activeStatuses.contains(bLatestStatus) ? 0 : 1;
            if (aActive != bActive) return aActive.compareTo(bActive);
            // Within same priority, most recent first
            final aMs = a.latestTimestamp?.millisecondsSinceEpoch ?? 0;
            final bMs = b.latestTimestamp?.millisecondsSinceEpoch ?? 0;
            return bMs.compareTo(aMs);
          });

          // Build combined list: order groups + generic notifications
          // interleaved by timestamp
          final List<dynamic> combined = [];
          int oi = 0, gi = 0;

          while (oi < orderGroups.length || gi < genericNotifications.length) {
            final oTime = oi < orderGroups.length
                ? (orderGroups[oi].latestTimestamp?.millisecondsSinceEpoch ?? 0)
                : -1;
            final gTime = gi < genericNotifications.length
                ? ((genericNotifications[gi]['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0)
                : -1;

            if (oTime >= gTime && oi < orderGroups.length) {
              combined.add(orderGroups[oi]);
              oi++;
            } else {
              combined.add(genericNotifications[gi]);
              gi++;
            }
          }

          return ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            itemCount: combined.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = combined[index];
              if (item is _OrderGroup) {
                return _OrderTimelineCard(
                  group: item,
                  isDark: isDark,
                  isFirst: index == 0,
                  metaFn: _meta,
                );
              } else {
                return _GenericNotificationCard(
                  data: item as Map<String, dynamic>,
                  isDark: isDark,
                );
              }
            },
          );
        },
      ),
    );
  }
}

// ── Data model for grouped order notifications ────────────────────────────
class _OrderGroup {
  final String orderId;
  final String rawOrderNumber;
  final String businessName;
  final List<Map<String, dynamic>> statuses;
  final Timestamp? latestTimestamp;
  final double? totalAmount;
  final String businessCity;
  final String businessPostalCode;
  final String orderType; // 'delivery', 'pickup', 'dineIn'

  _OrderGroup({
    required this.orderId,
    required this.rawOrderNumber,
    required this.businessName,
    required this.statuses,
    this.latestTimestamp,
    this.totalAmount,
    this.businessCity = '',
    this.businessPostalCode = '',
    this.orderType = 'delivery',
  });
}

// ── Order timeline card ───────────────────────────────────────────────────
class _OrderTimelineCard extends StatefulWidget {
  final _OrderGroup group;
  final bool isDark;
  final bool isFirst;
  final Map<String, dynamic> Function(String) metaFn;

  const _OrderTimelineCard({
    required this.group,
    required this.isDark,
    required this.isFirst,
    required this.metaFn,
  });

  @override
  State<_OrderTimelineCard> createState() => _OrderTimelineCardState();
}

class _OrderTimelineCardState extends State<_OrderTimelineCard> {
  late bool _expanded;

  // Full pipeline steps (dynamic based on order type)
  static const _deliveryPipeline = ['pending', 'accepted', 'preparing', 'ready', 'onTheWay', 'delivered'];
  static const _pickupPipeline = ['pending', 'accepted', 'preparing', 'ready', 'readyForPickup', 'delivered'];

  List<String> get _pipelineSteps {
    final ot = widget.group.orderType.toLowerCase();
    return ot == 'pickup' ? _pickupPipeline : _deliveryPipeline;
  }

  static String _orderTypeLabel(String orderType) {
    switch (orderType.toLowerCase()) {
      case 'delivery':
        return tr('orders.courier_delivery_order');
      case 'pickup':
        return tr('orders.pickup_order');
      case 'dine-in':
      case 'masa':
        return tr('orders.dine_in_order');
      case 'group':
      case 'group_table':
        return tr('orders.group_table_order');
      default:
        return tr('orders.order_generic');
    }
  }

  static IconData _orderTypeIcon(String orderType) {
    switch (orderType.toLowerCase()) {
      case 'delivery':
        return Icons.delivery_dining;
      case 'pickup':
        return Icons.storefront_rounded;
      case 'dine-in':
      case 'masa':
        return Icons.restaurant_rounded;
      case 'group':
      case 'group_table':
        return Icons.groups_rounded;
      default:
        return Icons.receipt_long_rounded;
    }
  }

  @override
  void initState() {
    super.initState();
    _expanded = widget.isFirst;
  }

  @override
  Widget build(BuildContext context) {
    final group = widget.group;
    final isDark = widget.isDark;
    final latest = group.statuses.last;
    final latestStatus = latest['status'] as String? ?? 'pending';
    final meta = widget.metaFn(latestStatus);
    final statusColor = Color(meta['color'] as int);
    final orderLabel = group.rawOrderNumber.isNotEmpty
        ? '#${group.rawOrderNumber}'
        : '#${group.orderId.substring(0, 6).toUpperCase()}';

    // ── Timeline Reset on Revert ──
    // If admin reverted the status (e.g., onTheWay → pending), we only
    // show timeline entries AFTER the latest "pending" notification.
    // This makes the timeline look fresh after a revert.
    List<Map<String, dynamic>> effectiveStatuses = List.from(group.statuses);
    
    // Find the LAST (most recent) pending notification index
    int lastPendingIndex = -1;
    for (int i = effectiveStatuses.length - 1; i >= 0; i--) {
      if (effectiveStatuses[i]['status'] == 'pending') {
        lastPendingIndex = i;
        break;
      }
    }
    // If there's more than one pending (revert happened), trim old entries
    if (lastPendingIndex > 0) {
      effectiveStatuses = effectiveStatuses.sublist(lastPendingIndex);
    }

    // Build timestamps from effective (post-revert) statuses only
    final allStatusTimestamps = <String, String>{};
    final allStatusDateTimes = <String, DateTime>{};
    for (final s in effectiveStatuses) {
      final st = s['status'] as String? ?? '';
      final createdAt = s['createdAt'] as Timestamp?;
      if (createdAt != null) {
        final dt = createdAt.toDate();
        allStatusDateTimes[st] = dt;
        allStatusTimestamps[st] = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      }
    }

    // Order creation date (from pending step)
    final orderDate = allStatusDateTimes['pending'];

    // Smart label: shows 'D Mon HH:mm' when step is on a different day, else just 'HH:mm'
    String smartTimeLabel(String status) {
      final dt = allStatusDateTimes[status];
      final timeStr = allStatusTimestamps[status] ?? '';
      if (dt == null || timeStr.isEmpty) return timeStr;
      if (orderDate == null) return timeStr;
      final sameDay = dt.year == orderDate.year &&
          dt.month == orderDate.month &&
          dt.day == orderDate.day;
      if (sameDay) return timeStr; // Same day → only time
      // Different day → prefix with day+month
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      return '${dt.day} ${months[dt.month - 1]} $timeStr';
    }

    // Smart label for the order's own creation date (pending step)
    String orderCreationLabel() {
      final dt = allStatusDateTimes['pending'];
      final timeStr = allStatusTimestamps['pending'] ?? '';
      if (dt == null || timeStr.isEmpty) return timeStr;
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      return '${dt.day} ${months[dt.month - 1]} | $timeStr';
    }

    // Determine which steps are ACTUALLY completed based on latestStatus position
    // For pickup orders, map Firestore status to pickup pipeline
    final isPickup = widget.group.orderType.toLowerCase() == 'pickup';
    
    // For pickup orders, 'onTheWay' from Firestore maps to 'readyForPickup' in our pipeline
    String effectiveLatestStatus = latestStatus;
    if (isPickup && latestStatus == 'onTheWay') {
      effectiveLatestStatus = 'readyForPickup';
    }
    
    final latestPipelineIndex = _pipelineSteps.indexOf(effectiveLatestStatus);
    final completedStatuses = <String>{};
    final statusTimestamps = <String, String>{};

    if (latestPipelineIndex >= 0) {
      // Only statuses up to and including the current position are completed
      for (var i = 0; i <= latestPipelineIndex; i++) {
        completedStatuses.add(_pipelineSteps[i]);
        final step = _pipelineSteps[i];
        // For readyForPickup, use the 'ready' timestamp
        final tsKey = (step == 'readyForPickup') ? 'ready' : step;
        if (allStatusTimestamps.containsKey(tsKey)) {
          statusTimestamps[step] = allStatusTimestamps[tsKey]!;
        }
      }
    } else {
      // For non-pipeline statuses (cancelled, rejected, served, etc.)
      // mark whatever we have
      completedStatuses.add(latestStatus);
      if (allStatusTimestamps.containsKey(latestStatus)) {
        statusTimestamps[latestStatus] = allStatusTimestamps[latestStatus]!;
      }
      // Also include pipeline steps from effective statuses only
      for (final s in effectiveStatuses) {
        final st = s['status'] as String? ?? '';
        if (_pipelineSteps.contains(st)) {
          completedStatuses.add(st);
          if (allStatusTimestamps.containsKey(st)) {
            statusTimestamps[st] = allStatusTimestamps[st]!;
          }
        }
        // For pickup cancelled orders: if 'ready' is in data, also complete 'readyForPickup'
        if (isPickup && st == 'ready') {
          completedStatuses.add('readyForPickup');
          if (allStatusTimestamps.containsKey('ready')) {
            statusTimestamps['readyForPickup'] = allStatusTimestamps['ready']!;
          }
        }
      }
    }

    // Check for pre-order info
    final pendingData = effectiveStatuses.firstWhere(
      (s) => s['status'] == 'pending',
      orElse: () => effectiveStatuses.first,
    );
    final isPreOrder = pendingData['isPreOrder'] == true;
    final pickupTimeStr = pendingData['pickupTimeStr'] as String?;

    // Determine if cancelled/rejected (use different pipeline)
    final isCancelled = latestStatus == 'cancelled' || latestStatus == 'rejected';

    // Extract cancellation reason from notification data
    String cancellationReason = '';
    if (isCancelled) {
      for (final s in effectiveStatuses) {
        final st = s['status'] as String? ?? '';
        if (st == 'cancelled' || st == 'rejected') {
          // Try direct fields first
          cancellationReason = s['cancellationReason'] as String?
              ?? s['cancelReason'] as String?
              ?? s['reason'] as String?
              ?? '';
          if (cancellationReason.isNotEmpty) break;
          
          // Fallback: parse reason from notification body text
          // Body format: "... - Sebep: {reason}. ..." or "... - Sebep: {reason}"
          final body = s['body'] as String? ?? '';
          if (body.contains('Sebep: ')) {
            final start = body.indexOf('Sebep: ') + 7;
            var end = body.indexOf('.', start);
            if (end < 0 || end > start + 100) end = body.length;
            cancellationReason = body.substring(start, end).trim();
            if (cancellationReason.isNotEmpty) break;
          }
        }
      }
    }

    // For cancelled/rejected, just show completed steps + the cancel step
    final stepsToShow = isCancelled
        ? [..._pipelineSteps.where((s) => completedStatuses.contains(s)), latestStatus]
        : List<String>.from(_pipelineSteps);

    // ── Card surface: mode-adaptive for harmony ──
    // Light: soft warm gray (iOS grouped bg style) — Dark: elevated surface
    final cardBg = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF2EEE9);
    final cardTextColor = isDark ? Colors.white : const Color(0xFF4A4A4C);
    final cardSubtleColor = isDark
        ? Colors.white.withValues(alpha: 0.55)
        : const Color(0xFF3A3A3C).withValues(alpha: 0.55);
    final dividerColor = isDark
        ? Colors.white.withValues(alpha: 0.1)
        : const Color(0xFF3A3A3C).withValues(alpha: 0.08);
    final inactiveDotColor = isDark
        ? Colors.white.withValues(alpha: 0.2)
        : const Color(0xFF3A3A3C).withValues(alpha: 0.18);
    final inactiveTextColor = isDark
        ? Colors.white.withValues(alpha: 0.3)
        : const Color(0xFF3A3A3C).withValues(alpha: 0.35);
    final timelineLineColor = isDark
        ? Colors.white.withValues(alpha: 0.1)
        : const Color(0xFF3A3A3C).withValues(alpha: 0.08);
    final timestampColor = isDark
        ? Colors.white.withValues(alpha: 0.5)
        : const Color(0xFF3A3A3C).withValues(alpha: 0.5);

    // ── Format order date for header ──
    String headerDateStr = '';
    final pendingDt = allStatusDateTimes['pending'];
    final headerDt = pendingDt ?? (allStatusDateTimes.isNotEmpty ? allStatusDateTimes.values.first : null);
    if (headerDt != null) {
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      headerDateStr = '${headerDt.day} ${months[headerDt.month - 1]} ${headerDt.year}  |  ${headerDt.hour.toString().padLeft(2, '0')}:${headerDt.minute.toString().padLeft(2, '0')}';
    }

    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: isDark ? null : Border.all(
          color: const Color(0xFF3A3A3C).withValues(alpha: 0.08),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.06),
            blurRadius: isDark ? 8 : 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── Header ─────────────────────────────────────────────────
          InkWell(
            onTap: widget.isFirst ? null : () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Row 1: Order type + number (left) + Date+Business (right)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  _orderTypeIcon(group.orderType),
                                  size: 16,
                                  color: cardTextColor,
                                ),
                                const SizedBox(width: 5),
                                Flexible(
                                  child: Text(
                                    _orderTypeLabel(group.orderType),
                                    style: TextStyle(
                                      color: cardTextColor,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              orderLabel,
                              style: TextStyle(
                                color: isDark ? Colors.grey[400] : Colors.grey[600],
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (headerDateStr.isNotEmpty)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  headerDateStr,
                                  style: TextStyle(
                                    color: cardSubtleColor,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w400,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                                if (!widget.isFirst) ...[
                                  const SizedBox(width: 2),
                                  Icon(
                                    _expanded
                                        ? Icons.keyboard_arrow_up_rounded
                                        : Icons.keyboard_arrow_down_rounded,
                                    color: cardSubtleColor,
                                    size: 20,
                                  ),
                                ],
                              ],
                            ),
                          if (group.businessName.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                group.businessName,
                                style: TextStyle(
                                  color: cardSubtleColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w400,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  // ── Row 3: Status badge (left) + total amount (right)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if ((meta['assetIcon'] as String?)?.isNotEmpty == true) ...[
                              Image.asset(meta['assetIcon'] as String, width: 13, height: 13, color: statusColor),
                              const SizedBox(width: 4),
                            ] else if (meta['iconData'] != null) ...[
                              Icon(meta['iconData'] as IconData, size: 13, color: statusColor),
                              const SizedBox(width: 4),
                            ] else if ((meta['icon'] as String?)?.isNotEmpty == true) ...[
                              Text(meta['icon'] as String, style: const TextStyle(fontSize: 11)),
                              const SizedBox(width: 4),
                            ],
                            Text(
                              meta['label'] as String,
                              style: TextStyle(
                                color: statusColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      // ── Checked items counter (live from Firestore) ──
                      StreamBuilder<DocumentSnapshot>(
                        stream: FirebaseFirestore.instance
                            .collection('orders')
                            .doc(group.orderId)
                            .snapshots(),
                        builder: (context, snap) {
                          if (!snap.hasData || !snap.data!.exists) return const SizedBox.shrink();
                          final od = snap.data!.data() as Map<String, dynamic>? ?? {};
                          final items = od['items'] as List<dynamic>? ?? [];
                          final checkedMap = od['checkedItems'] as Map<String, dynamic>? ?? {};
                          if (items.isEmpty) return const SizedBox.shrink();
                          final total = items.length;
                          final checked = checkedMap.values.where((v) => v == true).length;
                          final allDone = checked >= total;
                          return Container(
                            margin: const EdgeInsets.only(right: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: allDone
                                  ? const Color(0xFF22C55E).withValues(alpha: 0.15)
                                  : cardSubtleColor.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.check_rounded,
                                  size: 11,
                                  color: allDone ? const Color(0xFF22C55E) : cardSubtleColor,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  '$checked/$total',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: allDone ? const Color(0xFF22C55E) : cardSubtleColor,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                      if (group.totalAmount != null && group.totalAmount! > 0)
                        Text(
                          '${group.totalAmount!.toStringAsFixed(2)} €',
                          style: TextStyle(
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          // ── Full pipeline timeline (shown when expanded) ───────────
          if (_expanded) ...[
            Divider(
              height: 1,
              color: dividerColor,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Column(
                children: [
                  ...List.generate(stepsToShow.length, (i) {
                    final stepStatus = stepsToShow[i];
                    final stepMeta = widget.metaFn(stepStatus);
                    final isCompleted = completedStatuses.contains(stepStatus);
                    final isLast = i == stepsToShow.length - 1;
                    // Only show timestamp for completed steps — prevents stale timestamps
                    // appearing after admin reverts a status back to an earlier stage
                    final timeStr = !isCompleted
                        ? ''
                        : stepStatus == 'pending'
                            ? orderCreationLabel()
                            : smartTimeLabel(stepStatus);

                    // Determine if this is the "current active" step
                    final isCurrentStep = stepStatus == latestStatus && !isCancelled;

                    // Show scheduled sub-line after pending
                    final showScheduled = stepStatus == 'pending' && isPreOrder && pickupTimeStr != null;

                    return Column(
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Timeline dot
                            SizedBox(
                              width: 32,
                              child: Column(
                                children: [
                                  Container(
                                    width: isCurrentStep ? 16 : 12,
                                    height: isCurrentStep ? 16 : 12,
                                    decoration: BoxDecoration(
                                      color: isCompleted ? const Color(0xFF4CAF50) : Colors.transparent,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: isCompleted
                                            ? const Color(0xFF4CAF50)
                                            : inactiveDotColor,
                                        width: isCompleted ? 0 : 2,
                                      ),
                                      boxShadow: isCurrentStep
                                          ? [BoxShadow(color: const Color(0xFF4CAF50).withValues(alpha: 0.5), blurRadius: 8, spreadRadius: 1)]
                                          : null,
                                    ),
                                    child: isCompleted
                                        ? const Icon(Icons.check_rounded, size: 10, color: Colors.white)
                                        : null,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            // Status label
                            Expanded(
                              child: Row(
                                children: [
                                  if ((stepMeta['assetIcon'] as String?)?.isNotEmpty == true) ...[
                                    Opacity(
                                      opacity: isCompleted ? 1.0 : 0.35,
                                      child: Image.asset(
                                        stepMeta['assetIcon'] as String,
                                        width: 16,
                                        height: 16,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                  ] else if (stepMeta['iconData'] != null) ...[
                                    Icon(
                                      stepMeta['iconData'] as IconData,
                                      size: 16,
                                      color: isCompleted
                                          ? (stepStatus == 'cancelled' || stepStatus == 'rejected'
                                              ? const Color(0xFFF44336)
                                              : cardTextColor)
                                          : inactiveTextColor,
                                    ),
                                    const SizedBox(width: 4),
                                  ] else if ((stepMeta['icon'] as String).isNotEmpty) ...[
                                    Text(
                                      stepMeta['icon'] as String,
                                      style: const TextStyle(fontSize: 14),
                                    ),
                                    const SizedBox(width: 4),
                                  ],
                                  Text(
                                    stepMeta['label'] as String,
                                    style: TextStyle(
                                      color: isCompleted
                                          ? (stepStatus == 'cancelled' || stepStatus == 'rejected'
                                              ? const Color(0xFFF44336)
                                              : cardTextColor)
                                          : inactiveTextColor,
                                      fontSize: 13,
                                      fontWeight: isCurrentStep ? FontWeight.w600 : (isCompleted ? FontWeight.w500 : FontWeight.w400),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Timestamp
                            if (timeStr.isNotEmpty)
                              Text(
                                timeStr,
                                style: TextStyle(
                                  color: timestampColor,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              )
                            else if (!isCompleted)
                              Text(
                                '—',
                                style: TextStyle(
                                  color: inactiveDotColor,
                                  fontSize: 12,
                                ),
                              ),
                          ],
                        ),
                        // Cancellation reason subtitle
                        if ((stepStatus == 'cancelled' || stepStatus == 'rejected') && cancellationReason.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(left: 42, top: 3, bottom: 2),
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                'Sebep: $cancellationReason',
                                style: const TextStyle(
                                  color: Color(0xFFF44336),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w300,
                                ),
                              ),
                            ),
                          ),
                        // Connecting line between steps
                        if (!isLast || showScheduled)
                          Row(
                            children: [
                              SizedBox(
                                width: 32,
                                child: Center(
                                  child: Container(
                                    width: 2,
                                    height: showScheduled ? 16 : 20,
                                    color: isCompleted && (i + 1 < stepsToShow.length && completedStatuses.contains(stepsToShow[i + 1]))
                                        ? const Color(0xFF4CAF50).withValues(alpha: 0.4)
                                        : timelineLineColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        // Scheduled delivery sub-line
                        if (showScheduled) ...[
                          Row(
                            children: [
                              const SizedBox(width: 32),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text.rich(
                                  TextSpan(
                                    children: [
                                      const TextSpan(
                                        text: 'Planlanan Teslimat: ',
                                        style: TextStyle(
                                          color: Color(0xFF4CAF50),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                      TextSpan(
                                        text: pickupTimeStr,
                                        style: TextStyle(
                                          color: cardTextColor,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (!isLast)
                            Row(
                              children: [
                                SizedBox(
                                  width: 32,
                                  child: Center(
                                    child: Container(
                                      width: 2,
                                      height: 16,
                                      color: timelineLineColor,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ],
                    );
                  }),
                ],
              ),
            ),
          ],
          // ── Action buttons (ALWAYS visible) ───────────────────────
          Divider(
            height: 1,
            color: dividerColor,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                // "Siparişi Göster" — always visible
                Expanded(
                  child: SizedBox(
                    height: 36,
                    child: TextButton.icon(
                      onPressed: () {
                          final pendingEntry = group.statuses.firstWhere(
                            (s) => s['status'] == 'pending',
                            orElse: () => group.statuses.first,
                          );
                          final pendingTs = pendingEntry['createdAt'] as Timestamp?;
                          _showOrderDetail(context, group.orderId, pendingTs?.toDate());
                        },
                      icon: const Icon(Icons.receipt_long_rounded, size: 14),
                      label: Text(
                        'common.siparisi_goruntule'.tr(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white,
                        backgroundColor: isDark
                            ? Colors.white.withValues(alpha: 0.12)
                            : const Color(0xFF2C2C2E),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
                // "Mesaj" — chat button for active delivery orders
                if (['onTheWay', 'accepted', 'preparing', 'ready'].contains(latestStatus)) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 36,
                      child: StreamBuilder<int>(
                        stream: ChatService().getUnreadCountStream(
                          group.orderId,
                          FirebaseAuth.instance.currentUser?.uid ?? '',
                        ),
                        builder: (ctx, snap) {
                          final unread = snap.data ?? 0;
                          return TextButton.icon(
                            onPressed: () => _showChatBottomSheet(
                              context,
                              group.orderId,
                              group.rawOrderNumber.isNotEmpty
                                  ? group.rawOrderNumber
                                  : group.orderId.substring(0, 6).toUpperCase(),
                              group.businessName,
                            ),
                            icon: Badge(
                              isLabelVisible: unread > 0,
                              backgroundColor: const Color(0xFFFF3B30),
                              label: Text(
                                '$unread',
                                style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600),
                              ),
                              child: Icon(
                                unread > 0 ? Icons.chat_bubble : Icons.chat_bubble_outline,
                                size: 14,
                              ),
                            ),
                            label: Text(
                              unread > 0 ? 'Mesaj ($unread)' : 'Mesaj',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            style: TextButton.styleFrom(
                              foregroundColor: unread > 0
                                  ? const Color(0xFF4CAF50)
                                  : isDark ? Colors.white.withValues(alpha: 0.7) : const Color(0xFF3A3A3C),
                              backgroundColor: unread > 0
                                  ? const Color(0xFF4CAF50).withValues(alpha: 0.15)
                                  : isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFF3A3A3C).withValues(alpha: 0.08),
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                              textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],
                // "Harita Aç" — only when onTheWay
                if (latestStatus == 'onTheWay') ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 36,
                      child: TextButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => CourierTrackingScreen(orderId: group.orderId),
                            ),
                          );
                        },
                        icon: const Icon(Icons.map_rounded, size: 14),
                        label: Text(
                          'notification.open_map'.tr(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFF00BCD4),
                          backgroundColor: const Color(0xFF00BCD4).withValues(alpha: 0.12),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Chat Bottom Sheet ───────────────────────────────────────────────
  void _showChatBottomSheet(
    BuildContext ctx,
    String orderId,
    String orderNumber,
    String businessName,
  ) {
    final userId = FirebaseAuth.instance.currentUser?.uid ?? '';
    final chatService = ChatService();

    // Mark messages as read when opening
    if (userId.isNotEmpty) {
      chatService.markAllAsRead(orderId, userId);
    }

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        minChildSize: 0.4,
        builder: (sheetCtx, scrollController) {
          return _ChatBottomSheetContent(
            orderId: orderId,
            orderNumber: orderNumber,
            businessName: businessName,
            userId: userId,
            chatService: chatService,
          );
        },
      ),
    );
  }

  // ── Show order detail ────────────────────────────────────────────────
  void _showOrderDetail(BuildContext ctx, String orderId, [DateTime? pendingAt]) async {
    // Show loading indicator
    showDialog(
      context: ctx,
      barrierDismissible: false,
      builder: (_) => Center(child: CircularProgressIndicator(color: Colors.grey[500]!)),
    );

    try {
      final order = await OrderService().getOrder(orderId);
      if (!ctx.mounted) return;
      Navigator.pop(ctx); // dismiss loading

      if (order == null) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text('common.no_results'.tr())),
        );
        return;
      }

      final isDark = Theme.of(ctx).brightness == Brightness.dark;
      final colorScheme = Theme.of(ctx).colorScheme;

      showModalBottomSheet(
        context: ctx,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (sheetCtx) => DraggableScrollableSheet(
          initialChildSize: 0.75,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          builder: (_, scrollCtrl) => Container(
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                // Handle bar
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[600] : Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              order.butcherName,
                              style: TextStyle(
                                color: colorScheme.onSurface,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Sipariş #${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                              style: TextStyle(
                                color: isDark ? Colors.grey[400] : Colors.grey[600],
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(sheetCtx),
                        icon: Icon(Icons.close, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                      ),
                    ],
                  ),
                ),
                Divider(color: isDark ? Colors.grey[800] : Colors.grey[200], height: 20),
                // Items list
                Expanded(
                  child: ListView(
                    controller: scrollCtrl,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    children: [
                      // Status
                      _OrderStatusRow(order: order, isDark: isDark),
                      const SizedBox(height: 16),
                      // Date
                      Row(
                        children: [
                          Icon(Icons.calendar_today, size: 15, color: Colors.grey[500]),
                          const SizedBox(width: 6),
                          Text(
                            () {
                                      final dt = pendingAt ?? order.createdAt;
                                      return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}  ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                                    }(),
                            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Items header
                      Text(
                        'Ürünler',
                        style: TextStyle(
                          color: colorScheme.onSurface,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      // Items
                      ...order.items.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final item = entry.value;
                        final posNum = item.positionNumber ?? (idx + 1);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                margin: const EdgeInsets.only(right: 8, top: 1),
                                decoration: BoxDecoration(
                                  color: isDark ? Colors.grey[700] : Colors.grey[800],
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  '#$posNum',
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                ),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.name,
                                      style: TextStyle(
                                        color: colorScheme.onSurface,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    if (item.itemNote != null && item.itemNote!.isNotEmpty)
                                      Text(
                                        item.itemNote!,
                                        style: TextStyle(color: Colors.grey[500], fontSize: 12, fontStyle: FontStyle.italic),
                                      ),
                                  ],
                                ),
                              ),
                              Text(
                                '${item.quantity} ${item.unit}',
                                style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                '${(item.price * item.quantity).toStringAsFixed(2)} €',
                                style: TextStyle(
                                  color: colorScheme.onSurface,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                      Divider(color: isDark ? Colors.grey[800] : Colors.grey[200], height: 24),
                      // Total
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Toplam',
                            style: TextStyle(
                              color: colorScheme.onSurface,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            '${order.totalAmount.toStringAsFixed(2)} €',
                            style: TextStyle(
                              color: colorScheme.onSurface,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      if (order.notes != null && order.notes!.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.sticky_note_2_outlined, size: 16, color: Colors.grey[500]),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                order.notes!,
                                style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    } catch (e) {
      if (ctx.mounted) {
        Navigator.pop(ctx); // dismiss loading
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text('Hata: $e')),
        );
      }
    }
  }
}

// ── Order status row widget ─────────────────────────────────────────────────
class _OrderStatusRow extends StatelessWidget {
  final LokmaOrder order;
  final bool isDark;
  const _OrderStatusRow({required this.order, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final statusLabel = {
      OrderStatus.pending: 'Sipariş Verildi',
      OrderStatus.accepted: 'Onaylandı',
      OrderStatus.preparing: 'Hazırlanıyor',
      OrderStatus.ready: 'Hazır',
      OrderStatus.onTheWay: 'Yola Çıktı',
      OrderStatus.delivered: 'Teslim Edildi',
      OrderStatus.served: 'Servis Edildi',
      OrderStatus.cancelled: 'İptal Edildi',
    }[order.status] ?? order.status.name;

    final statusColor = {
      OrderStatus.pending: const Color(0xFFFF9800),
      OrderStatus.accepted: const Color(0xFF4CAF50),
      OrderStatus.preparing: const Color(0xFF2196F3),
      OrderStatus.ready: const Color(0xFF9C27B0),
      OrderStatus.onTheWay: const Color(0xFF00BCD4),
      OrderStatus.delivered: const Color(0xFF4CAF50),
      OrderStatus.served: const Color(0xFF4CAF50),
      OrderStatus.cancelled: const Color(0xFFFB335B),
    }[order.status] ?? Colors.grey;

    final statusIcon = {
      OrderStatus.pending: Icons.receipt_long_rounded,
      OrderStatus.accepted: Icons.check_circle_outline_rounded,
      OrderStatus.preparing: Icons.room_service,
      OrderStatus.ready: Icons.inventory_2_rounded,
      OrderStatus.onTheWay: Icons.delivery_dining,
      OrderStatus.delivered: Icons.done_all_rounded,
      OrderStatus.served: Icons.restaurant_rounded,
      OrderStatus.cancelled: Icons.block_rounded,
    }[order.status] ?? Icons.info_outline;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(statusIcon, size: 18, color: statusColor),
          const SizedBox(width: 8),
          Text(
            statusLabel,
            style: TextStyle(
              color: statusColor,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
class _GenericNotificationCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final bool isDark;

  const _GenericNotificationCard({
    required this.data,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final title = data['title'] as String? ?? 'Bildirim';
    final body = data['body'] as String? ?? '';
    final createdAt = data['createdAt'] as Timestamp?;
    final isRead = data['read'] as bool? ?? true;

    String timeString = '';
    if (createdAt != null) {
      timeString = timeago.format(createdAt.toDate(), locale: 'tr');
    }

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isRead
              ? (isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[200]!)
              : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
          width: isRead ? 1 : 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[800] : Colors.grey[100],
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.notifications_active_rounded,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 15,
                      fontWeight: isRead ? FontWeight.w500 : FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    body,
                    style: TextStyle(
                      color: isDark ? Colors.grey[400] : Colors.grey[700],
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  if (timeString.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      timeString,
                      style: TextStyle(
                        color: isDark ? Colors.grey[600] : Colors.grey[500],
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ── Chat Bottom Sheet Content ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

class _ChatBottomSheetContent extends StatefulWidget {
  final String orderId;
  final String orderNumber;
  final String businessName;
  final String userId;
  final ChatService chatService;

  const _ChatBottomSheetContent({
    required this.orderId,
    required this.orderNumber,
    required this.businessName,
    required this.userId,
    required this.chatService,
  });

  @override
  State<_ChatBottomSheetContent> createState() => _ChatBottomSheetContentState();
}

class _ChatBottomSheetContentState extends State<_ChatBottomSheetContent> {
  final TextEditingController _msgController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  String _userName = '';
  String _userRole = 'customer';

  @override
  void initState() {
    super.initState();
    _loadUserInfo();
  }

  Future<void> _loadUserInfo() async {
    if (widget.userId.isEmpty) return;
    try {
      final orderDoc = await FirebaseFirestore.instance
          .collection('meat_orders')
          .doc(widget.orderId)
          .get();
      if (orderDoc.exists) {
        final data = orderDoc.data()!;
        if (data['courierId'] == widget.userId) {
          _userRole = 'courier';
          _userName = data['courierName'] ?? 'Kurye';
        } else if (data['butcherId'] == widget.userId) {
          _userRole = 'business';
          _userName = data['butcherName'] ?? 'İşletme';
        } else {
          _userRole = 'customer';
          _userName = data['userName'] ?? FirebaseAuth.instance.currentUser?.displayName ?? 'Müşteri';
        }
      }
    } catch (_) {}
    if (mounted) setState(() {});
  }

  void _send() {
    final text = _msgController.text.trim();
    if (text.isEmpty || widget.userId.isEmpty) return;

    widget.chatService.sendMessage(
      orderId: widget.orderId,
      senderId: widget.userId,
      senderName: _userName,
      senderRole: _userRole,
      text: text,
    );

    _msgController.clear();
    _focusNode.requestFocus();

    Future.delayed(const Duration(milliseconds: 300), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _msgController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // ── Handle bar ──
          Container(
            margin: const EdgeInsets.only(top: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // ── Header ──
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.chat_bubble, color: Color(0xFF4CAF50), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sipariş #${widget.orderNumber}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        widget.businessName,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(Icons.close, color: Colors.white.withValues(alpha: 0.5), size: 22),
                ),
              ],
            ),
          ),

          Divider(height: 1, color: Colors.white.withValues(alpha: 0.1)),

          // ── Messages ──
          Expanded(
            child: StreamBuilder<List<ChatMessage>>(
              stream: widget.chatService.getMessagesStream(widget.orderId),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(color: Color(0xFF4CAF50)),
                  );
                }

                final messages = snapshot.data ?? [];

                if (messages.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.chat_bubble_outline,
                          size: 48,
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Henüz mesaj yok',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.4),
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Kuryenize mesaj gönderin',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.25),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                // Mark as read
                widget.chatService.markAllAsRead(widget.orderId, widget.userId);

                // Auto-scroll
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (_scrollController.hasClients) {
                    _scrollController.animateTo(
                      _scrollController.position.maxScrollExtent,
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeOut,
                    );
                  }
                });

                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  itemCount: messages.length,
                  itemBuilder: (_, i) => _bubble(messages[i]),
                );
              },
            ),
          ),

          // ── Input area ──
          Container(
            padding: EdgeInsets.only(
              left: 12, right: 8, top: 8,
              bottom: bottomInset > 0 ? 8 : MediaQuery.of(context).padding.bottom + 8,
            ),
            decoration: BoxDecoration(
              color: const Color(0xFF12122A),
              border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: TextField(
                      controller: _msgController,
                      focusNode: _focusNode,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      maxLines: 3,
                      minLines: 1,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: InputDecoration(
                        hintText: 'Mesaj yazın...',
                        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.25)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF4CAF50), Color(0xFF2E7D32)],
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                    onPressed: _send,
                    constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                    padding: EdgeInsets.zero,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _bubble(ChatMessage msg) {
    final isMe = msg.senderId == widget.userId;

    Color bubbleColor;
    switch (msg.senderRole) {
      case 'courier':
        bubbleColor = isMe ? const Color(0xFF2D8B4E) : const Color(0xFF1A3D2A);
        break;
      case 'business':
        bubbleColor = isMe ? const Color(0xFF8B2D2D) : const Color(0xFF3D1A1A);
        break;
      default:
        bubbleColor = isMe ? const Color(0xFF2D4A8B) : const Color(0xFF1A2A3D);
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.7,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(14),
                topRight: const Radius.circular(14),
                bottomLeft: Radius.circular(isMe ? 14 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 14),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (!isMe)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          msg.senderRole == 'courier' ? Icons.delivery_dining : Icons.store,
                          size: 11,
                          color: msg.senderRole == 'courier'
                              ? const Color(0xFF4CAF50)
                              : const Color(0xFFFF9800),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          msg.senderName,
                          style: TextStyle(
                            color: msg.senderRole == 'courier'
                                ? const Color(0xFF4CAF50)
                                : const Color(0xFFFF9800),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                Text(
                  msg.text,
                  style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.3),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${msg.createdAt.hour.toString().padLeft(2, '0')}:${msg.createdAt.minute.toString().padLeft(2, '0')}',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 10),
                    ),
                    if (isMe) ...[
                      const SizedBox(width: 3),
                      Icon(
                        msg.read ? Icons.done_all : Icons.done,
                        size: 13,
                        color: msg.read ? const Color(0xFF42A5F5) : Colors.white.withValues(alpha: 0.4),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
