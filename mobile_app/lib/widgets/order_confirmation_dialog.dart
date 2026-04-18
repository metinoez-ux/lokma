import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

class OrderConfirmationDialog extends StatelessWidget {
  final DateTime pickupDate;
  final String? businessHours;
  final String? businessName;
  final bool isPickUp;
  final bool isDineIn;
  final bool isScheduledOrder;
  final DateTime? scheduledDate;
  final String? businessType;
  final VoidCallback? onDismiss;
  final VoidCallback? onClearCart;
  final VoidCallback? onSaveToCalendar;

  const OrderConfirmationDialog({
    super.key,
    required this.pickupDate,
    this.businessHours,
    this.businessName,
    this.isPickUp = true,
    this.isDineIn = false,
    this.isScheduledOrder = false,
    this.businessType,
    this.scheduledDate,
    this.onDismiss,
    this.onClearCart,
    this.onSaveToCalendar,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1A1A1A);
    final subtextColor = isDark ? Colors.grey[400]! : Colors.grey.shade600;
    const accentColor = Color(0xFFEA184A);

    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 28),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 24),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ✅ Checkmark
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded,
                    color: Colors.green, size: 36),
              ),

              const SizedBox(height: 20),

              // Title
              Text(
                'order_confirmation.title'.tr(),
                style: TextStyle(
                  color: textColor,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isScheduledOrder && scheduledDate != null
                    ? (businessName != null
                        ? 'order_confirmation.scheduled_by'
                            .tr(namedArgs: {'businessName': businessName!})
                        : 'order_confirmation.scheduled_confirmed'.tr())
                    : (businessName != null
                        ? 'order_confirmation.preparing_by'
                            .tr(namedArgs: {'businessName': businessName!})
                        : 'order_confirmation.order_forwarded'.tr()),
                textAlign: TextAlign.center,
                style:
                    TextStyle(color: subtextColor, fontSize: 14, height: 1.4),
              ),

              const SizedBox(height: 24),

              // Divider
              Divider(
                  color: isDark ? Colors.white10 : Colors.grey.shade200,
                  height: 1),

              const SizedBox(height: 16),

              // Mode info
              _buildModeInfo(
                  context, textColor, subtextColor, accentColor, isDark),

              const SizedBox(height: 16),

              // Mode-specific hint
              Text(
                isDineIn
                    ? 'order_confirmation.dine_in_hint'.tr()
                    : (isPickUp
                        ? 'order_confirmation.pickup_hint'.tr()
                        : 'order_confirmation.delivery_hint'.tr()),
                textAlign: TextAlign.center,
                style:
                    TextStyle(color: subtextColor, fontSize: 13, height: 1.4),
              ),

              const SizedBox(height: 12),

              // Segment-aware farewell message
              Text(
                _getSegmentMessage(),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: accentColor,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),

              const SizedBox(height: 16),

              // Notification reminder
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_active_outlined,
                      color: subtextColor, size: 16),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      'order_confirmation.notification_reminder'.tr(),
                      style: TextStyle(
                          color: subtextColor,
                          fontSize: 12,
                          fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              if (onSaveToCalendar != null) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onSaveToCalendar,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF2F2F7),
                      foregroundColor: textColor,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.calendar_month, color: accentColor, size: 20),
                        const SizedBox(width: 8),
                        Text('checkout.save_calendar'.tr(),
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Action Button (Tamam)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    // 1. Clear cart
                    if (onClearCart != null) onClearCart!();
                    // 2. Dismiss dialog
                    Navigator.of(context, rootNavigator: true).pop();
                    // 3. Notify parent to route back securely
                    if (onDismiss != null) onDismiss!();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: Text('order_confirmation.ok_button'.tr(),
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModeInfo(BuildContext context, Color textColor,
      Color subtextColor, Color accentColor, bool isDark) {
    if (isDineIn) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.restaurant, color: accentColor, size: 20),
          const SizedBox(width: 8),
          Text(
            'order_confirmation.served_at_table'.tr(),
            style: TextStyle(
                color: textColor, fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ],
      );
    } else if (isPickUp) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.store_outlined, color: subtextColor, size: 20),
          const SizedBox(width: 8),
          Text(
            '${_formatPickupDay(context)}, ${_formatPickupClock()}',
            style: TextStyle(
                color: textColor, fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ],
      );
    } else {
      // Scheduled delivery order — show scheduled date/time
      if (isScheduledOrder && scheduledDate != null) {
        return Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.calendar_today, color: accentColor, size: 20),
                const SizedBox(width: 8),
                Text(
                  _formatScheduledDay(context),
                  style: TextStyle(
                      color: textColor,
                      fontSize: 16,
                      fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.schedule, color: accentColor, size: 20),
                const SizedBox(width: 8),
                Text(
                  _formatScheduledClock(),
                  style: TextStyle(
                      color: accentColor,
                      fontSize: 22,
                      fontWeight: FontWeight.w700),
                ),
                Text(
                  ' ${'order_confirmation.time_suffix'.tr()}',
                  style: TextStyle(
                      color: textColor,
                      fontSize: 16,
                      fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        );
      }
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.delivery_dining, color: subtextColor, size: 22),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              'order_confirmation.estimated_time'.tr(),
              style: TextStyle(
                  color: textColor, fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      );
    }
  }

  String _formatPickupDay(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final checkDate =
        DateTime(pickupDate.year, pickupDate.month, pickupDate.day);

    if (checkDate == today) {
      return 'order_confirmation.today'.tr();
    } else if (checkDate == tomorrow) {
      return 'order_confirmation.tomorrow'.tr();
    } else {
      // Use locale-aware date formatting
      final locale = context.locale.toString();
      final formatter = DateFormat('EEEE, d MMMM', locale);
      return formatter.format(pickupDate);
    }
  }

  String _formatPickupClock() {
    return '${pickupDate.hour.toString().padLeft(2, '0')}:${pickupDate.minute.toString().padLeft(2, '0')}';
  }

  String _formatScheduledDay(BuildContext context) {
    final date = scheduledDate!;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final checkDate = DateTime(date.year, date.month, date.day);

    if (checkDate == today) {
      return 'order_confirmation.today'.tr();
    } else if (checkDate == tomorrow) {
      return 'order_confirmation.tomorrow'.tr();
    } else {
      final locale = context.locale.toString();
      final formatter = DateFormat('EEEE, d MMMM', locale);
      return formatter.format(date);
    }
  }

  String _formatScheduledClock() {
    final date = scheduledDate!;
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  /// Segment-aware farewell message
  String _getSegmentMessage() {
    final type = (businessType ?? '').toLowerCase();

    // Market segment types
    const marketTypes = {
      'kasap',
      'market',
      'balik',
      'sarkuteri',
      'kuruyemis',
      'ciftci',
      'petshop',
      'kozmetik',
      'eticaret'
    };

    if (type == 'kermes') {
      return 'order_confirmation.thanks_kermes'.tr();
    } else if (marketTypes.contains(type)) {
      return 'order_confirmation.thanks_market'.tr();
    } else {
      // Default: yemek/restoran/kahve etc.
      return 'order_confirmation.bon_appetit'.tr();
    }
  }
}
