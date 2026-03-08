import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../orders/courier_tracking_screen.dart';
import '../../services/order_service.dart';

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
    'preparing': {'label': 'Hazırlanıyor',       'icon': '', 'color': 0xFF2196F3, 'iconData': Icons.room_service},
    'ready':     {'label': 'Hazır',              'icon': '', 'color': 0xFF9C27B0, 'iconData': Icons.inventory_2_rounded},
    'onTheWay':  {'label': 'Yola Çıktı',        'icon': '', 'color': 0xFF00BCD4, 'iconData': Icons.delivery_dining},
    'delivered': {'label': 'Teslim Edildi',      'icon': '', 'color': 0xFF4CAF50, 'iconData': Icons.done_all_rounded},
    'served':    {'label': 'Servis Edildi',      'icon': '', 'color': 0xFF4CAF50, 'iconData': Icons.restaurant_rounded},
    'completed': {'label': 'Tamamlandı',         'icon': '', 'color': 0xFF4CAF50, 'iconData': Icons.verified_rounded},
    'rejected':  {'label': 'Reddedildi',         'icon': '', 'color': 0xFFF44336, 'iconData': Icons.cancel_outlined},
    'cancelled': {'label': 'İptal Edildi',       'icon': '', 'color': 0xFFF44336, 'iconData': Icons.block_rounded},
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
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        title: Text(
          'Bildirimler',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontWeight: FontWeight.bold,
          ),
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
            return const Center(child: CircularProgressIndicator(color: Color(0xFFFB335B)));
          }

          if (snapshot.hasError) {
            return Center(
              child: Text(
                'Bir hata oluştu.',
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
                    'Henüz bildiriminiz yok.',
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
            final totalAmt = (pendingData['totalAmount'] as num?)?.toDouble();
            final bCity = pendingData['businessCity'] as String? ?? '';
            final bPostal = pendingData['businessPostalCode'] as String? ?? '';

            orderGroups.add(_OrderGroup(
              orderId: entry.key,
              rawOrderNumber: rawNum,
              businessName: bName,
              statuses: statuses,
              latestTimestamp: latestTime,
              totalAmount: totalAmt,
              businessCity: bCity,
              businessPostalCode: bPostal,
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

  _OrderGroup({
    required this.orderId,
    required this.rawOrderNumber,
    required this.businessName,
    required this.statuses,
    this.latestTimestamp,
    this.totalAmount,
    this.businessCity = '',
    this.businessPostalCode = '',
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

  // Full delivery pipeline steps
  static const _pipelineSteps = ['pending', 'accepted', 'preparing', 'ready', 'onTheWay', 'delivered'];

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
      return '${dt.day} ${months[dt.month - 1]} $timeStr';
    }

    // Determine which steps are ACTUALLY completed based on latestStatus position
    // (not all historical notifications — admin may have reverted the status)
    final latestPipelineIndex = _pipelineSteps.indexOf(latestStatus);
    final completedStatuses = <String>{};
    final statusTimestamps = <String, String>{};

    if (latestPipelineIndex >= 0) {
      // Only statuses up to and including the current position are completed
      for (var i = 0; i <= latestPipelineIndex; i++) {
        completedStatuses.add(_pipelineSteps[i]);
        if (allStatusTimestamps.containsKey(_pipelineSteps[i])) {
          statusTimestamps[_pipelineSteps[i]] = allStatusTimestamps[_pipelineSteps[i]]!;
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

    // For cancelled/rejected, just show completed steps + the cancel step
    final stepsToShow = isCancelled
        ? [..._pipelineSteps.where((s) => completedStatuses.contains(s)), latestStatus]
        : List<String>.from(_pipelineSteps);

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[200]!,
        ),
      ),
      child: Column(
        children: [
          // ── Header ─────────────────────────────────────────────────
          InkWell(
            onTap: widget.isFirst ? null : () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Row 1: Order number (left) + Business name (right) + chevron
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          'Sipariş $orderLabel',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (group.businessName.isNotEmpty)
                        Flexible(
                          flex: 0,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 150),
                            child: Text(
                              group.businessName,
                              style: TextStyle(
                                color: isDark ? Colors.grey[300] : Colors.grey[600],
                                fontSize: 13,
                                fontWeight: FontWeight.w400,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.end,
                            ),
                          ),
                        ),
                      if (!widget.isFirst) ...[
                        const SizedBox(width: 2),
                        Icon(
                          _expanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          color: isDark ? Colors.grey[500] : Colors.grey[400],
                          size: 22,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 7),
                  // ── Row 2: Status badge (left) + total amount (right)
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
                            if (meta['iconData'] != null) ...[
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
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      if (group.totalAmount != null && group.totalAmount! > 0)
                        Text(
                          '${group.totalAmount!.toStringAsFixed(2)} €',
                          style: const TextStyle(
                            color: Color(0xFFFB335B),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
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
              color: isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[200]!,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Column(
                children: [
                  ...List.generate(stepsToShow.length, (i) {
                    final stepStatus = stepsToShow[i];
                    final stepMeta = widget.metaFn(stepStatus);
                    final stepColor = Color(stepMeta['color'] as int);
                    final isCompleted = completedStatuses.contains(stepStatus);
                    final isLast = i == stepsToShow.length - 1;
                    // Pending step gets full date+time; others get smart label (date+time only if different day)
                    final timeStr = stepStatus == 'pending'
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
                                      color: isCompleted ? stepColor : Colors.transparent,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: isCompleted
                                            ? stepColor
                                            : (isDark ? Colors.grey[700]! : Colors.grey[350]!),
                                        width: isCompleted ? 0 : 2,
                                      ),
                                      boxShadow: isCurrentStep
                                          ? [BoxShadow(color: stepColor.withValues(alpha: 0.4), blurRadius: 8, spreadRadius: 1)]
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
                                  if (stepMeta['iconData'] != null) ...[
                                    Icon(
                                      stepMeta['iconData'] as IconData,
                                      size: 16,
                                      color: isCompleted
                                          ? Color(stepMeta['color'] as int)
                                          : (isDark ? Colors.grey[600] : Colors.grey[400]),
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
                                          ? Theme.of(context).colorScheme.onSurface
                                          : (isDark ? Colors.grey[600] : Colors.grey[400]),
                                      fontSize: 13,
                                      fontWeight: isCurrentStep ? FontWeight.w700 : (isCompleted ? FontWeight.w500 : FontWeight.w400),
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
                                  color: isDark ? Colors.grey[500] : Colors.grey[500],
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              )
                            else if (!isCompleted)
                              Text(
                                '—',
                                style: TextStyle(
                                  color: isDark ? Colors.grey[700] : Colors.grey[350],
                                  fontSize: 12,
                                ),
                              ),
                          ],
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
                                        ? stepColor.withValues(alpha: 0.4)
                                        : (isDark ? Colors.grey[800] : Colors.grey[300]),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        // Scheduled delivery sub-line
                        if (showScheduled) ...[
                          Row(
                            children: [
                              SizedBox(
                                width: 32,
                                child: Center(
                                  child: Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFF9800).withValues(alpha: 0.3),
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: const Color(0xFFFF9800),
                                        width: 1.5,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const Icon(Icons.calendar_today, size: 13, color: Color(0xFFFF9800)),
                              const SizedBox(width: 5),
                              Text(
                                'Planlanan Teslimat: $pickupTimeStr',
                                style: const TextStyle(
                                  color: Color(0xFFFF9800),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  fontStyle: FontStyle.italic,
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
                                      color: isDark ? Colors.grey[800] : Colors.grey[300],
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
            color: isDark ? Colors.grey[800]!.withValues(alpha: 0.5) : Colors.grey[200]!,
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
                      onPressed: () => _showOrderDetail(context, group.orderId),
                      icon: const Icon(Icons.receipt_long_rounded, size: 16),
                      label: const Text('Siparişi Göster'),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFFFB335B),
                        backgroundColor: const Color(0xFFFB335B).withValues(alpha: 0.08),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
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
                        icon: const Icon(Icons.map_rounded, size: 16),
                        label: const Text('Harita Aç'),
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFF00BCD4),
                          backgroundColor: const Color(0xFF00BCD4).withValues(alpha: 0.08),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
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

  // ── Show order detail ────────────────────────────────────────────────
  void _showOrderDetail(BuildContext ctx, String orderId) async {
    // Show loading indicator
    showDialog(
      context: ctx,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: Color(0xFFFB335B))),
    );

    try {
      final order = await OrderService().getOrder(orderId);
      if (!ctx.mounted) return;
      Navigator.pop(ctx); // dismiss loading

      if (order == null) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          const SnackBar(content: Text('Sipariş bulunamadı')),
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
                                fontWeight: FontWeight.w700,
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
                            '${order.createdAt.day.toString().padLeft(2, '0')}.${order.createdAt.month.toString().padLeft(2, '0')}.${order.createdAt.year}  ${order.createdAt.hour.toString().padLeft(2, '0')}:${order.createdAt.minute.toString().padLeft(2, '0')}',
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
                                  color: const Color(0xFFFB335B),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  '#$posNum',
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
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
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '${order.totalAmount.toStringAsFixed(2)} €',
                            style: const TextStyle(
                              color: Color(0xFFFB335B),
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
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
      OrderStatus.cancelled: const Color(0xFFF44336),
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
              : const Color(0xFFFB335B).withValues(alpha: 0.3),
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
                color: const Color(0xFFFB335B).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.notifications_active_rounded,
                color: Color(0xFFFB335B),
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
                      fontWeight: isRead ? FontWeight.w600 : FontWeight.bold,
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
