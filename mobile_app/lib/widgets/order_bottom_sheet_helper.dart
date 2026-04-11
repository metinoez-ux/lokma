import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:lokma_app/services/order_service.dart';
import 'package:lokma_app/utils/currency_utils.dart';

class OrderBottomSheetHelper {
  static void showOrderDetailGlobal(BuildContext ctx, String orderId, [DateTime? pendingAt]) async {
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
                            // Order type line above business name
                            OrderBottomSheetHelper.buildOrderTypeInlineGlobal(order, isDark),
                            const SizedBox(height: 6),
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
                              '${'notifications.order_number'.tr()} #${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
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
                      // Status & Dates Logic
                      if (order.status == OrderStatus.delivered && (order.isScheduledOrder || order.scheduledTime != null))
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1B5E20).withOpacity(0.3) : const Color(0xFFE8F5E9),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: isDark ? const Color(0xFF4CAF50).withOpacity(0.3) : const Color(0xFFA5D6A7)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.check_circle, size: 16, color: isDark ? const Color(0xFF81C784) : const Color(0xFF2E7D32)),
                                  const SizedBox(width: 8),
                                  Text(
                                    'orders.status_delivered'.tr(),
                                    style: TextStyle(
                                      color: isDark ? const Color(0xFF81C784) : const Color(0xFF2E7D32),
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${'notifications.scheduled_delivery'.tr()}: ${order.scheduledTime!.day.toString().padLeft(2, '0')}.${order.scheduledTime!.month.toString().padLeft(2, '0')}.${order.scheduledTime!.year} ${order.scheduledTime!.hour.toString().padLeft(2, '0')}:${order.scheduledTime!.minute.toString().padLeft(2, '0')}',
                                style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[700], fontSize: 13),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                () {
                                  final dt = pendingAt ?? order.createdAt;
                                  return '${'common.date'.tr()} / ${'orders.status_delivered'.tr()}: ${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}  ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                                }(),
                                style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[700], fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                        )
                      else ...[
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
                        // Scheduled delivery/pickup time
                        if (order.isScheduledOrder || order.scheduledTime != null) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF3E2723) : const Color(0xFFFFF3E0),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: isDark ? const Color(0xFFFFB74D).withOpacity(0.3) : const Color(0xFFFFE0B2),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.schedule, size: 16, color: isDark ? const Color(0xFFFFB74D) : const Color(0xFFE65100)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    order.scheduledTime != null
                                        ? '${'notifications.scheduled_delivery'.tr()}: ${order.scheduledTime!.day.toString().padLeft(2, '0')}.${order.scheduledTime!.month.toString().padLeft(2, '0')}.${order.scheduledTime!.year} ${order.scheduledTime!.hour.toString().padLeft(2, '0')}:${order.scheduledTime!.minute.toString().padLeft(2, '0')}'
                                        : 'notifications.scheduled_delivery'.tr(),
                                    style: TextStyle(
                                      color: isDark ? const Color(0xFFFFB74D) : const Color(0xFFE65100),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                      const SizedBox(height: 16),
                      // Items header
                      Text(
                        'notifications.products_header'.tr(),
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
                                '${item.quantity.toStringAsFixed(item.quantity == item.quantity.roundToDouble() ? 0 : 1)}x',
                                style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[700], fontSize: 14, fontWeight: FontWeight.w700),
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
                            'notifications.total'.tr(),
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
                      // ── Delivery address ────────────────────────────
                      if (order.deliveryAddress != null && order.deliveryAddress!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Divider(color: isDark ? Colors.grey[800] : Colors.grey[200], height: 16),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.location_on, size: 16, color: Colors.grey[500]),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'notifications.delivery_address_label'.tr(),
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w400,
                                      color: isDark ? Colors.grey[500] : Colors.grey[500],
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    order.deliveryAddress!,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w400,
                                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                      // ── Payment method card with timestamp ────────────────
                      if (order.paymentMethod != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey[900] : Colors.grey[50],
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'notifications.payment_method_label'.tr(),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                                  letterSpacing: 0.3,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.payment, size: 16, color: Colors.grey[600]),
                                      const SizedBox(width: 8),
                                      Text(
                                        OrderBottomSheetHelper._getPaymentMethodLabel(order.paymentMethod!),
                                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: isDark ? Colors.white : Colors.black87),
                                      ),
                                    ],
                                  ),
                                  Builder(
                                    builder: (context) {
                                      final now = DateTime.now();
                                      final diff = now.difference(order.updatedAt);
                                      String relativeTime;
                                      if (diff.inMinutes < 1) {
                                        relativeTime = 'notifications.just_now'.tr();
                                      } else if (diff.inMinutes < 60) {
                                        relativeTime = 'notifications.minutes_ago'.tr(args: ['${diff.inMinutes}']);
                                      } else if (diff.inHours < 24) {
                                        relativeTime = 'notifications.hours_ago'.tr(args: ['${diff.inHours}']);
                                      } else {
                                        relativeTime = 'notifications.days_ago'.tr(args: ['${diff.inDays}']);
                                      }
                                      return Text(
                                        '${'notifications.last_action_label'.tr()}: $relativeTime',
                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[500]),
                                      );
                                    },
                                  ),
                                ],
                              ),
                            ],
                          ),
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
          SnackBar(content: Text('${'notifications.error_prefix'.tr()}: $e')),
        );
      }
    }
  }


  static Widget buildOrderTypeInlineGlobal(LokmaOrder order, bool isDark) {
    final IconData icon;
    final String label;
    final Color color;

    if (order.tableSessionId != null) {
      icon = Icons.restaurant;
      label = 'orders.label_table'.tr();
      color = const Color(0xFF9C27B0);
    } else {
      switch (order.orderType) {
        case OrderType.delivery:
          icon = Icons.delivery_dining;
          label = 'notifications.delivery_order_label'.tr();
          color = isDark ? Colors.grey[400]! : Colors.grey[600]!;
          break;
        case OrderType.pickup:
          icon = Icons.storefront;
          label = 'notifications.pickup_order_label'.tr();
          color = isDark ? Colors.grey[400]! : Colors.grey[600]!;
          break;
        case OrderType.dineIn:
          icon = Icons.restaurant;
          label = 'orders.label_table'.tr();
          color = const Color(0xFF9C27B0);
          break;
      }
    }


    return Row(
      children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }


  static String _getPaymentMethodLabel(String method) {
    switch (method.toLowerCase()) {
      case 'cash':
        return 'orders.payment_cash'.tr();
      case 'card':
      case 'online':
        return 'orders.payment_card'.tr();
      case 'cardondelivery':
      case 'card_on_delivery':
      case 'kapidakart':
        return 'notifications.payment_card_on_delivery'.tr();
      case 'card_nfc':
        return 'notifications.payment_card_nfc'.tr();
      default:
        return method;
    }
  }


  static Color _getStatusColor(OrderStatus status) {
    switch (status) {
      case OrderStatus.delivered:
      case OrderStatus.served:
        return const Color(0xFF4CAF50);
      case OrderStatus.cancelled:
        return const Color(0xFFF44336);
      case OrderStatus.onTheWay:
        return const Color(0xFF2196F3);
      case OrderStatus.preparing:
      case OrderStatus.ready:
        return const Color(0xFFFF9800);
      default:
        return const Color(0xFF9E9E9E);
    }
  }

}

class _OrderStatusRow extends StatelessWidget {
  final LokmaOrder order;
  final bool isDark;
  const _OrderStatusRow({required this.order, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final statusLabel = {
      OrderStatus.pending: 'notifications.order_placed'.tr(),
      OrderStatus.accepted: 'notifications.confirmed'.tr(),
      OrderStatus.preparing: 'notifications.preparing'.tr(),
      OrderStatus.ready: 'notifications.ready'.tr(),
      OrderStatus.onTheWay: 'notifications.on_the_way'.tr(),
      OrderStatus.delivered: 'notifications.delivered'.tr(),
      OrderStatus.served: 'notifications.served'.tr(),
      OrderStatus.cancelled: 'notifications.cancelled'.tr(),
    }[order.status] ?? order.status.name;

    final statusColor = {
      OrderStatus.pending: const Color(0xFFFF9800),
      OrderStatus.accepted: const Color(0xFF4CAF50),
      OrderStatus.preparing: const Color(0xFF2196F3),
      OrderStatus.ready: const Color(0xFF9C27B0),
      OrderStatus.onTheWay: const Color(0xFF00BCD4),
      OrderStatus.delivered: const Color(0xFF4CAF50),
      OrderStatus.served: const Color(0xFF4CAF50),
      OrderStatus.cancelled: const Color(0xFFEA184A),
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
        color: statusColor.withOpacity(0.12),
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
