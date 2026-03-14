import 'package:device_calendar/device_calendar.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

/// Native device calendar integration for scheduled orders & table reservations.
/// Provides calendar picker bottom sheet and event creation with 1-hour reminder.
class CalendarService {
  static final DeviceCalendarPlugin _plugin = DeviceCalendarPlugin();

  /// Request calendar permissions. Returns true if granted.
  static Future<bool> requestPermissions() async {
    var result = await _plugin.hasPermissions();
    if (result.isSuccess && (result.data == true)) return true;

    result = await _plugin.requestPermissions();
    return result.isSuccess && (result.data == true);
  }

  /// Retrieve all writable calendars from the device.
  static Future<List<Calendar>> getCalendars() async {
    final result = await _plugin.retrieveCalendars();
    if (!result.isSuccess || result.data == null) return [];
    // Filter to writable calendars only
    return result.data!.where((c) => !(c.isReadOnly ?? true)).toList();
  }

  /// Show calendar picker bottom sheet, then save the event to selected calendar.
  /// Returns true if event was saved successfully.
  static Future<bool> showCalendarPickerAndSave({
    required BuildContext context,
    required String title,
    required String description,
    required DateTime startTime,
    required Duration duration,
    String? location,
  }) async {
    final hasPermission = await requestPermissions();
    if (!hasPermission) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('calendar.permission_denied'.tr()),
            backgroundColor: Colors.amber,
          ),
        );
      }
      return false;
    }

    final calendars = await getCalendars();
    if (calendars.isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('calendar.no_calendars'.tr()),
            backgroundColor: Colors.amber,
          ),
        );
      }
      return false;
    }

    // If only one calendar, use it directly
    if (calendars.length == 1) {
      return _saveEvent(
        context: context,
        calendarId: calendars.first.id!,
        title: title,
        description: description,
        startTime: startTime,
        duration: duration,
        location: location,
      );
    }

    // Multiple calendars — show picker
    if (!context.mounted) return false;
    final selectedCalendar = await _showCalendarPicker(context, calendars);
    if (selectedCalendar == null) return false;

    return _saveEvent(
      context: context,
      calendarId: selectedCalendar.id!,
      title: title,
      description: description,
      startTime: startTime,
      duration: duration,
      location: location,
    );
  }

  /// Save event to the specified calendar with a 1-hour reminder.
  static Future<bool> _saveEvent({
    required BuildContext context,
    required String calendarId,
    required String title,
    required String description,
    required DateTime startTime,
    required Duration duration,
    String? location,
  }) async {
    try {
      final event = Event(
        calendarId,
        title: title,
        description: description,
        start: startTime,
        end: startTime.add(duration),
        reminders: [Reminder(minutes: 60)], // 1 hour before
      );
      event.location = location;

      final result = await _plugin.createOrUpdateEvent(event);
      if (result?.isSuccess == true) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text('calendar.event_added'.tr())),
                ],
              ),
              backgroundColor: Colors.green,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('❌ Calendar event error: $e');
      return false;
    }
  }

  /// Show bottom sheet with calendar list for user selection.
  static Future<Calendar?> _showCalendarPicker(
    BuildContext context,
    List<Calendar> calendars,
  ) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return showModalBottomSheet<Calendar>(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.85,
        expand: false,
        builder: (ctx, scrollController) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Drag handle
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white24 : Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                // Title
                Text(
                  'calendar.select_calendar'.tr(),
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 16),
                // Scrollable calendar list
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: calendars.length,
                    itemBuilder: (ctx, index) =>
                        _buildCalendarTile(ctx, calendars[index], isDark),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static Widget _buildCalendarTile(BuildContext ctx, Calendar cal, bool isDark) {
    // Parse calendar color
    final calColor = cal.color != null
        ? Color(cal.color! | 0xFF000000)  // Ensure alpha is set
        : Colors.blue;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        onTap: () => Navigator.pop(ctx, cal),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF5F5F5),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: calColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      cal.name ?? 'calendar.unknown'.tr(),
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (cal.accountName != null && cal.accountName!.isNotEmpty)
                      Text(
                        cal.accountName!,
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.black45,
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: isDark ? Colors.white38 : Colors.black26),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Convenience Methods ───

  /// Add a scheduled order event to the calendar.
  static Future<bool> addOrderEvent({
    required BuildContext context,
    required DateTime deliveryTime,
    required String businessName,
    String? orderNumber,
    List<Map<String, dynamic>>? items,
    double? grandTotal,
    String? deliveryMethod, // 'delivery', 'pickup', 'dineIn'
  }) {
    // Build title with delivery type — visible in calendar overview
    String modeLabel;
    if (deliveryMethod == 'pickup') {
      modeLabel = 'calendar.pickup_mode'.tr();
    } else if (deliveryMethod == 'dineIn') {
      modeLabel = 'calendar.dine_in_mode'.tr();
    } else {
      modeLabel = 'calendar.delivery_mode'.tr();
    }
    final title = 'LOKMA $modeLabel – $businessName';

    // Build rich description with order details
    final buf = StringBuffer();

    // Header line
    if (orderNumber != null) {
      buf.writeln('🧾 ${'calendar.order_label'.tr()} #$orderNumber');
    }
    buf.writeln('🏪 $businessName');
    buf.writeln('');

    // Delivery method
    if (deliveryMethod == 'pickup') {
      buf.writeln('📦 ${'calendar.pickup_mode'.tr()}');
    } else if (deliveryMethod == 'dineIn') {
      buf.writeln('🍽️ ${'calendar.dine_in_mode'.tr()}');
    } else {
      buf.writeln('🚴 ${'calendar.delivery_mode'.tr()}');
    }

    // Scheduled time
    final timeStr = '${deliveryTime.hour.toString().padLeft(2, '0')}:${deliveryTime.minute.toString().padLeft(2, '0')}';
    buf.writeln('⏰ $timeStr ${'calendar.oclock'.tr()}');
    buf.writeln('');

    // Order items
    if (items != null && items.isNotEmpty) {
      buf.writeln('── ${'calendar.items_label'.tr()} ──');
      for (final item in items) {
        final name = item['productName'] ?? '';
        final qty = item['quantity'] ?? 1;
        final price = (item['totalPrice'] as num?)?.toDouble() ?? 0.0;
        buf.writeln('• ${qty}x $name — ${price.toStringAsFixed(2).replaceAll('.', ',')} €');
      }
      buf.writeln('');
    }

    // Grand total
    if (grandTotal != null) {
      buf.writeln('💰 ${'calendar.total_label'.tr()}: ${grandTotal.toStringAsFixed(2).replaceAll('.', ',')} €');
    }

    return showCalendarPickerAndSave(
      context: context,
      title: title,
      description: buf.toString().trim(),
      startTime: deliveryTime,
      duration: const Duration(minutes: 30),
      location: businessName,
    );
  }

  /// Add a table reservation event to the calendar.
  static Future<bool> addReservationEvent({
    required BuildContext context,
    required DateTime reservationTime,
    required String businessName,
    required int partySize,
    List<int>? tableCardNumbers,
  }) {
    final title = 'calendar.reservation_event_title'.tr(args: [businessName]);
    final tableInfo = tableCardNumbers != null && tableCardNumbers.isNotEmpty
        ? '\n${'calendar.table_card'.tr()}: ${tableCardNumbers.join(", ")}'
        : '';
    final desc = 'calendar.reservation_event_description'.tr(
      args: ['$partySize', businessName],
    ) + tableInfo;

    return showCalendarPickerAndSave(
      context: context,
      title: title,
      description: desc,
      startTime: reservationTime,
      duration: const Duration(hours: 2),
      location: businessName,
    );
  }
}
