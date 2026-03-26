import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:lokma_app/utils/time_utils.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/services/stripe_payment_service.dart';
import 'package:lokma_app/widgets/main_scaffold.dart';

/// OpenTable-style Reservation Booking Screen
/// - Checks availability against maxReservationTables per time slot
/// - Respects business opening hours
/// - Creates reservation in pending state
/// - Writes to: businesses/{businessId}/reservations
class ReservationBookingScreen extends ConsumerStatefulWidget {
  final String businessId;
  final String businessName;
  final bool isPreOrder;
  final bool requirePreorderPayment;

  const ReservationBookingScreen({
    super.key,
    required this.businessId,
    required this.businessName,
    this.isPreOrder = false,
    this.requirePreorderPayment = false,
  });

  @override
  ConsumerState<ReservationBookingScreen> createState() => _ReservationBookingScreenState();
}

class _ReservationBookingScreenState extends ConsumerState<ReservationBookingScreen> {
  // --- State ---
  int _partySize = 2;
  DateTime _selectedDate = DateTime.now();
  String? _selectedTime;
  final TextEditingController _notesController = TextEditingController();
  bool _isSubmitting = false;

  // Business data loaded from Firestore
  int _maxReservationTables = 0;
  String _openingHoursRaw = '';
  List<String> _availableTimeSlots = [];
  Map<String, int> _slotReservationCounts = {}; // time -> count of existing reservations
  bool _isLoadingSlots = true;

  // Accent color (butonlar icin)
  static const Color _accent = Color(0xFFEA184A);
  // Section ve summary ikonlari icin koyu gri
  static const Color _iconGrey = Color(0xFF555555);

  @override
  void initState() {
    super.initState();
    _loadBusinessData();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  /// Load business data (opening hours, maxReservationTables) then build slots
  Future<void> _loadBusinessData() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.businessId)
          .get();
      
      if (!mounted) return;
      
      final data = doc.data();
      if (data != null) {
        _maxReservationTables = data['maxReservationTables'] as int? ?? 0;
        _openingHoursRaw = data['openingHours']?.toString() ?? '';
      }
      
      await _loadSlotsForDate(_selectedDate);
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingSlots = false);
      }
    }
  }

  /// Generate time slots based on business opening hours and load reservation counts
  Future<void> _loadSlotsForDate(DateTime date) async {
    setState(() => _isLoadingSlots = true);

    // 1. Generate slots from opening hours (30-min intervals)
    final slots = _generateTimeSlotsFromHours(date);

    // 2. Query existing reservations for this date
    final dayStart = DateTime(date.year, date.month, date.day);
    final dayEnd = dayStart.add(const Duration(days: 1));

    try {
      final reservationsSnap = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.businessId)
          .collection('reservations')
          .where('reservationDate', isGreaterThanOrEqualTo: Timestamp.fromDate(dayStart))
          .where('reservationDate', isLessThan: Timestamp.fromDate(dayEnd))
          .get();

      // Count reservations per time slot (only pending/confirmed)
      final counts = <String, int>{};
      for (final doc in reservationsSnap.docs) {
        final status = doc.data()['status'] as String? ?? '';
        if (status != 'pending' && status != 'confirmed') continue;
        final resDate = (doc.data()['reservationDate'] as Timestamp).toDate();
        final timeKey = '${resDate.hour.toString().padLeft(2, '0')}:${resDate.minute.toString().padLeft(2, '0')}';
        counts[timeKey] = (counts[timeKey] ?? 0) + 1;
      }

      if (!mounted) return;
      setState(() {
        _availableTimeSlots = slots;
        _slotReservationCounts = counts;
        _isLoadingSlots = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _availableTimeSlots = slots;
        _slotReservationCounts = {};
        _isLoadingSlots = false;
      });
    }
  }

  /// Get readable opening hours for the selected day
  String _getSelectedDayHours() {
    if (_openingHoursRaw.isEmpty) return '';
    
    // Map weekday number to English day names used in the data
    const dayNames = {
      1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
      4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday',
    };
    
    final dayEn = dayNames[_selectedDate.weekday] ?? '';
    final dayLocalized = DateFormat('EEEE', context.locale.languageCode).format(_selectedDate);
    
    // Check if this day is marked as Closed
    final closedPattern = RegExp('$dayEn:\\s*Closed', caseSensitive: false);
    if (closedPattern.hasMatch(_openingHoursRaw)) {
      return 'reservation.day_closed'.tr(args: [dayLocalized]);
    }
    
    // Try to find the time range for this day
    // Supports both 24h ("11:30 - 22:00") and AM/PM ("11:30 AM - 10:00 PM")
    final dayPattern = RegExp(
      '$dayEn:\\s*(\\d{1,2}[:.\\s]?\\d{0,2}\\s*(?:AM|PM)?)\\s*[\u2013\\-]\\s*(\\d{1,2}[:.\\s]?\\d{0,2}\\s*(?:AM|PM)?)',
      caseSensitive: false,
    );
    final match = dayPattern.firstMatch(_openingHoursRaw);
    
    if (match != null) {
      final open = normalizeTimeString(match.group(1)!.trim());
      final close = normalizeTimeString(match.group(2)!.trim());
      return '$dayLocalized: $open \u2013 $close';
    }
    
    // Fallback: try general time range
    final timeRangeRegex = RegExp(r'(\d{1,2})[:.](\d{2})\s*(?:AM|PM)?\s*[\u2013\-]\s*(\d{1,2})[:.](\d{2})\s*(?:AM|PM)?');
    final generalMatch = timeRangeRegex.firstMatch(_openingHoursRaw);
    if (generalMatch != null) {
      final rawMatch = generalMatch.group(0) ?? '';
      // Normalize both sides of the range
      final rangeSep = rawMatch.contains('\u2013') ? '\u2013' : '-';
      final rangeParts = rawMatch.split(rangeSep);
      if (rangeParts.length == 2) {
        return '$dayLocalized: ${normalizeTimeString(rangeParts[0].trim())} \u2013 ${normalizeTimeString(rangeParts[1].trim())}';
      }
      return '$dayLocalized: $rawMatch';
    }
    
    return '';
  }

  /// Parse opening hours and generate 30-min time slots for the given day
  List<String> _generateTimeSlotsFromHours(DateTime date) {
    // Try to parse opening hours (format: "Mo-Sa: 10:00-22:00" or similar)
    // Fallback to default restaurant hours if not parseable
    
    int openHour = 11;
    int openMinute = 0;
    int closeHour = 22;
    int closeMinute = 0;

    if (_openingHoursRaw.isNotEmpty) {
      // Support both 24h and AM/PM, dot and colon separators
      final timeRangeRegex = RegExp(r'(\d{1,2})[:.](\d{2})\s*(?:AM|PM)?\s*[\u2013\-]\s*(\d{1,2})[:.](\d{2})\s*(?:AM|PM)?', caseSensitive: false);
      final matches = timeRangeRegex.allMatches(_openingHoursRaw);
      
      if (matches.isNotEmpty) {
        final match = matches.first;
        // Normalize each side through normalizeTimeString for AM/PM conversion
        final rawOpen = match.group(0)!;
        final sep = rawOpen.contains('\u2013') ? '\u2013' : '-';
        final parts = rawOpen.split(sep);
        if (parts.length == 2) {
          final openNorm = normalizeTimeString(parts[0].trim());
          final closeNorm = normalizeTimeString(parts[1].trim());
          final openParts = openNorm.split(':');
          final closeParts = closeNorm.split(':');
          if (openParts.length == 2 && closeParts.length == 2) {
            openHour = int.tryParse(openParts[0]) ?? openHour;
            openMinute = int.tryParse(openParts[1]) ?? openMinute;
            closeHour = int.tryParse(closeParts[0]) ?? closeHour;
            closeMinute = int.tryParse(closeParts[1]) ?? closeMinute;
          }
        }
      }
    }

    // Generate 30-min slots
    final slots = <String>[];
    var current = DateTime(date.year, date.month, date.day, openHour, openMinute);
    final closing = DateTime(date.year, date.month, date.day, closeHour, closeMinute);
    
    // Last reservation slot is 1 hour before closing
    final lastSlot = closing.subtract(const Duration(hours: 1));

    while (current.isBefore(lastSlot) || current.isAtSameMomentAs(lastSlot)) {
      final timeStr = '${current.hour.toString().padLeft(2, '0')}:${current.minute.toString().padLeft(2, '0')}';
      slots.add(timeStr);
      current = current.add(const Duration(minutes: 30));
    }

    return slots;
  }

  bool _isSlotFull(String time) {
    if (_maxReservationTables <= 0) return false;
    final count = _slotReservationCounts[time] ?? 0;
    return count >= _maxReservationTables;
  }

  int _slotRemainingCount(String time) {
    if (_maxReservationTables <= 0) return 999;
    final count = _slotReservationCounts[time] ?? 0;
    return _maxReservationTables - count;
  }

  Future<void> _submitReservation() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      _showSnackBar('reservation.please_login_first'.tr(), isError: true);
      return;
    }
    if (_selectedTime == null) {
      _showSnackBar('reservation.please_select_time'.tr(), isError: true);
      return;
    }
    if (_isSlotFull(_selectedTime!)) {
      _showSnackBar('reservation.time_slot_full'.tr(), isError: true);
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      // Build reservation datetime
      final timeParts = _selectedTime!.split(':');
      final reservationDateTime = DateTime(
        _selectedDate.year,
        _selectedDate.month,
        _selectedDate.day,
        int.parse(timeParts[0]),
        int.parse(timeParts[1]),
      );

      // Don't allow past reservations
      if (reservationDateTime.isBefore(DateTime.now())) {
        _showSnackBar('reservation.past_time_error'.tr(), isError: true);
        setState(() => _isSubmitting = false);
        return;
      }

      // Double-check availability with a fresh query before submitting
      final slotStart = reservationDateTime;
      final slotEnd = reservationDateTime.add(const Duration(minutes: 30));

      final existingSnap = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.businessId)
          .collection('reservations')
          .where('reservationDate', isGreaterThanOrEqualTo: Timestamp.fromDate(slotStart))
          .where('reservationDate', isLessThan: Timestamp.fromDate(slotEnd))
          .get();

      // Filter client-side for active reservations only
      final activeCount = existingSnap.docs.where((doc) {
        final status = doc.data()['status'] as String? ?? '';
        return status == 'pending' || status == 'confirmed';
      }).length;

      if (_maxReservationTables > 0 && activeCount >= _maxReservationTables) {
        if (!mounted) return;
        _showSnackBar('reservation.time_slot_full'.tr(), isError: true);
        await _loadSlotsForDate(_selectedDate); // Refresh slot counts
        setState(() => _isSubmitting = false);
        return;
      }

      // Get customer FCM token for push notifications
      String? customerFcmToken;
      try {
        customerFcmToken = await FirebaseMessaging.instance.getToken();
      } catch (_) {}

      final docRef = FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.businessId)
          .collection('reservations')
          .doc();

      final double cartTotal = widget.isPreOrder ? ref.read(cartProvider).totalAmount : 0.0;
      bool paymentSuccessful = false;
      Map<String, dynamic>? feeBreakdown;
      String? paymentIntentId;

      if (widget.isPreOrder && widget.requirePreorderPayment && cartTotal > 0) {
        // Collect payment first
        final paymentResult = await StripePaymentService.processPayment(
          amount: cartTotal,
          businessId: widget.businessId,
          orderId: docRef.id,
          customerEmail: user.email?.isNotEmpty == true ? user.email : null,
        );

        if (!paymentResult.success) {
          if (!paymentResult.wasCancelled && mounted) {
            _showSnackBar(paymentResult.error ?? 'Ödeme tamamlanamadı', isError: true);
          }
          if (mounted) setState(() => _isSubmitting = false);
          return;
        }

        paymentSuccessful = true;
        feeBreakdown = paymentResult.feeBreakdown?.toMap();
        paymentIntentId = paymentResult.paymentIntentId;
      }

      await docRef.set({
        'userId': user.uid,
        'userName': user.displayName ?? 'common.guest'.tr(),
        'userEmail': user.email ?? '',
        'userPhone': user.phoneNumber ?? '',
        'customerFcmToken': customerFcmToken,
        'partySize': _partySize,
        'reservationDate': Timestamp.fromDate(reservationDateTime),
        'notes': _notesController.text.trim(),
        'status': 'pending', // pending → confirmed/rejected by staff
        'confirmedBy': null, // Staff member name who confirms/rejects
        'createdAt': FieldValue.serverTimestamp(),
        'businessId': widget.businessId,
        'businessName': widget.businessName,
        // For reminder notifications
        'reminder24hSent': false,
        'reminder2hSent': false,
        
        if (widget.isPreOrder) 'isPreOrder': true,
        if (widget.isPreOrder) 'preOrderItems': ref.read(cartProvider).items.map((e) => e.toMap()).toList(),
        if (widget.isPreOrder) 'preOrderTotal': cartTotal,
        
        // Continuous Tab (Phase 2)
        if (widget.isPreOrder) 'tabStatus': paymentSuccessful ? 'pre_paid' : 'pre_ordered',
        if (widget.isPreOrder) 'prePaidAmount': paymentSuccessful ? cartTotal : 0.0,
        if (widget.isPreOrder) 'tabItems': ref.read(cartProvider).items.map((e) => e.toMap()).toList(),
        if (widget.isPreOrder) 'pendingBalance': paymentSuccessful ? 0.0 : cartTotal,
        if (paymentSuccessful) 'paymentStatus': 'paid',
        if (paymentIntentId != null) 'paymentIntentId': paymentIntentId,
        if (feeBreakdown != null) 'feeBreakdown': feeBreakdown,
      });

      if (widget.isPreOrder) {
        ref.read(cartProvider.notifier).clearCart();
      }

      if (!mounted) return;

      _showPendingConfirmationDialog();
    } catch (e) {
      _showSnackBar('reservation.create_error'.tr(args: [e.toString()]), isError: true);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// Show "pending confirmation" dialog (not auto-confirmed)
  void _showPendingConfirmationDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dialogBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final cardBg = isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white70 : Colors.black54;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: dialogBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        icon: SizedBox(
          width: 64,
          height: 64,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(Icons.table_restaurant, color: const Color(0xFFEA184A), size: 52),
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.access_time, color: Color(0xFFEA184A), size: 22),
                ),
              ),
            ],
          ),
        ),
        title: Text('reservation.request_received'.tr(), style: TextStyle(color: textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Reservation details card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  _buildDetailRow(Icons.store, widget.businessName, textPrimary),
                  const SizedBox(height: 8),
                  _buildDetailRow(Icons.calendar_today,
                      DateFormat('d MMMM yyyy, EEEE', context.locale.languageCode).format(_selectedDate), textPrimary),
                  const SizedBox(height: 8),
                  _buildDetailRow(Icons.access_time, 'reservation.time_prefix'.tr(args: [_selectedTime ?? '']), textPrimary),
                  const SizedBox(height: 8),
                  _buildDetailRow(Icons.people, 'reservation.party_count'.tr(args: ['$_partySize']), textPrimary),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2C2C2C) : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: textSecondary, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'reservation.await_confirmation'.tr(),
                      style: TextStyle(fontSize: 12, color: textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: Text('common.ok'.tr(), style: TextStyle(color: _accent, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String text, Color textColor) {
    return Row(
      children: [
        Icon(icon, size: 16, color: _accent),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: textColor)),
        ),
      ],
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red[700] : Colors.green[700],
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cartState = ref.watch(cartProvider);
    final kermesCartState = ref.watch(kermesCartProvider);
    final cartItemCount = cartState.items.length + kermesCartState.items.length;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white70 : Colors.black54;

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, color: textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          children: [
            Text(
              'reservation.table_reservation'.tr(),
              style: TextStyle(color: textPrimary, fontSize: 18, fontWeight: FontWeight.w600),
            ),
            Text(
              widget.businessName,
              style: TextStyle(color: textSecondary, fontSize: 13),
            ),
          ],
        ),
        centerTitle: true,
      ),
      bottomNavigationBar: GlassBottomBar(
        currentIndex: 0, // 'Yemek' is index 0
        cartItemCount: cartItemCount,
        onTap: (index) {
          HapticFeedback.lightImpact();
          // Because ReservationBookingScreen is pushed inside a navigation stack
          // we should pop until first route and use go_router for navigation
          Navigator.of(context).popUntil((route) => route.isFirst);
          context.go(MainScaffold.items[index].path);
        },
        items: MainScaffold.items,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Party Size
            _buildSectionCard(
              cardBg: cardBg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.people, color: isDark ? Colors.grey[400] : _iconGrey, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'reservation.party_size_label'.tr(),
                        style: TextStyle(
                          color: textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: 10,
                      itemBuilder: (context, index) {
                        final size = index + 1;
                        final isSelected = size == _partySize;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setState(() => _partySize = size);
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? _accent
                                    : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[200]),
                                borderRadius: BorderRadius.circular(12),
                                border: isSelected
                                    ? null
                                    : Border.all(
                                        color: isDark ? Colors.white12 : Colors.black12,
                                      ),
                                boxShadow: isSelected
                                    ? [
                                        BoxShadow(
                                          color: _accent.withValues(alpha: 0.3),
                                          blurRadius: 8,
                                          offset: const Offset(0, 3),
                                        )
                                      ]
                                    : null,
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '$size',
                                style: TextStyle(
                                  color: isSelected ? Colors.white : textPrimary,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 2. Date Picker
            _buildSectionCard(
              cardBg: cardBg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.calendar_today, color: isDark ? Colors.grey[400] : _iconGrey, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'reservation.date_label'.tr(),
                        style: TextStyle(
                          color: textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 72,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: 14, // Next 14 days
                      itemBuilder: (context, index) {
                        final date = DateTime.now().add(Duration(days: index));
                        final isSelected = _selectedDate.year == date.year &&
                            _selectedDate.month == date.month &&
                            _selectedDate.day == date.day;
                        final isToday = index == 0;

                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setState(() {
                                _selectedDate = date;
                                _selectedTime = null;
                              });
                              _loadSlotsForDate(date);
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 60,
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? _accent
                                    : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[200]),
                                borderRadius: BorderRadius.circular(12),
                                border: isSelected
                                    ? null
                                    : Border.all(
                                        color: isDark ? Colors.white12 : Colors.black12,
                                      ),
                                boxShadow: isSelected
                                    ? [
                                        BoxShadow(
                                          color: _accent.withValues(alpha: 0.3),
                                          blurRadius: 8,
                                          offset: const Offset(0, 3),
                                        )
                                      ]
                                    : null,
                              ),
                              alignment: Alignment.center,
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    isToday
                                        ? 'reservation.today'.tr()
                                        : DateFormat('EEE', context.locale.languageCode).format(date),
                                    style: TextStyle(
                                      color: isSelected ? Colors.white70 : textSecondary,
                                      fontSize: 11,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${date.day}',
                                    style: TextStyle(
                                      color: isSelected ? Colors.white : textPrimary,
                                      fontSize: 20,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    DateFormat('MMM', context.locale.languageCode).format(date),
                                    style: TextStyle(
                                      color: isSelected ? Colors.white70 : textSecondary,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 3. Time Slots with Availability
            _buildSectionCard(
              cardBg: cardBg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.access_time, color: isDark ? Colors.grey[400] : _iconGrey, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'reservation.time_label'.tr(),
                        style: TextStyle(
                          color: textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  // Opening hours for selected day only
                  if (_openingHoursRaw.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          Icon(Icons.access_time, size: 14, color: textSecondary),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              _getSelectedDayHours(),
                              style: TextStyle(color: textSecondary, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 8),
                  if (_isLoadingSlots)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: CircularProgressIndicator(color: _accent),
                      ),
                    )
                  else if (_availableTimeSlots.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          children: [
                            Icon(Icons.event_busy, color: Colors.grey[400], size: 40),
                            const SizedBox(height: 8),
                            Text(
                              'reservation.no_slots_available'.tr(),
                              style: TextStyle(color: textSecondary, fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _availableTimeSlots.map((time) {
                        final isSelected = _selectedTime == time;
                        final isFull = _isSlotFull(time);
                        final remaining = _slotRemainingCount(time);
                        
                        // Disable past times for today
                        final isToday = _selectedDate.year == DateTime.now().year &&
                            _selectedDate.month == DateTime.now().month &&
                            _selectedDate.day == DateTime.now().day;
                        final timeParts = time.split(':');
                        final slotDateTime = DateTime(
                          _selectedDate.year,
                          _selectedDate.month,
                          _selectedDate.day,
                          int.parse(timeParts[0]),
                          int.parse(timeParts[1]),
                        );
                        final isPast = isToday && slotDateTime.isBefore(DateTime.now());
                        final isDisabled = isPast || isFull;

                        return GestureDetector(
                          onTap: isDisabled
                              ? null
                              : () {
                                  HapticFeedback.selectionClick();
                                  setState(() => _selectedTime = time);
                                },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isFull
                                  ? (isDark ? Colors.red[900]!.withValues(alpha: 0.3) : Colors.red[50])
                                  : isPast
                                      ? (isDark ? Colors.grey[800] : Colors.grey[300])
                                      : isSelected
                                          ? _accent
                                          : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[200]),
                              borderRadius: BorderRadius.circular(10),
                              border: isFull
                                  ? Border.all(color: Colors.red.withValues(alpha: 0.3))
                                  : isSelected || isPast
                                      ? null
                                      : Border.all(
                                          color: isDark ? Colors.white12 : Colors.black12,
                                        ),
                              boxShadow: isSelected && !isDisabled
                                  ? [
                                      BoxShadow(
                                        color: _accent.withValues(alpha: 0.3),
                                        blurRadius: 8,
                                        offset: const Offset(0, 3),
                                      )
                                    ]
                                  : null,
                            ),
                            child: Column(
                              children: [
                                Text(
                                  time,
                                  style: TextStyle(
                                    color: isFull
                                        ? Colors.red[400]
                                        : isPast
                                            ? Colors.grey
                                            : isSelected
                                                ? Colors.white
                                                : textPrimary,
                                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                                    fontSize: 14,
                                    decoration: isFull ? TextDecoration.lineThrough : null,
                                  ),
                                ),
                                if (isFull)
                                  Text(
                                    'reservation.slot_full_label'.tr(),
                                    style: TextStyle(
                                      color: Colors.red[400],
                                      fontSize: 9,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  )
                                else if (_maxReservationTables > 0 && remaining <= 3)
                                  Text(
                                    'reservation.slots_remaining'.tr(args: ['$remaining']),
                                    style: TextStyle(
                                      color: isSelected ? Colors.white70 : Colors.amber[700],
                                      fontSize: 9,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 4. Notes
            _buildSectionCard(
              cardBg: cardBg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.note_alt_outlined, color: isDark ? Colors.grey[400] : _iconGrey, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'reservation.notes_label'.tr(),
                        style: TextStyle(
                          color: textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'reservation.optional'.tr(),
                        style: TextStyle(color: textSecondary, fontSize: 12),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _notesController,
                    maxLines: 3,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => FocusScope.of(context).unfocus(),
                    style: TextStyle(color: textPrimary),
                    decoration: InputDecoration(
                      hintText:
                          'reservation.notes_hint'.tr(),
                      hintStyle: TextStyle(color: textSecondary, fontSize: 13),
                      filled: true,
                      fillColor: isDark ? const Color(0xFF2A2A2A) : Colors.grey[100],
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 5. Summary + Submit Button
            _buildSectionCard(
              cardBg: cardBg,
              child: Column(
                children: [
                  // Summary row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildSummaryItem(
                        Icons.people,
                        'reservation.party_count'.tr(args: ['$_partySize']),
                        textPrimary,
                        textSecondary,
                      ),
                      _buildSummaryItem(
                        Icons.calendar_today,
                        DateFormat('d MMM', context.locale.languageCode).format(_selectedDate),
                        textPrimary,
                        textSecondary,
                      ),
                      _buildSummaryItem(
                        Icons.access_time,
                        _selectedTime ?? '--:--',
                        textPrimary,
                        textSecondary,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  // Submit button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _selectedTime == null || _isSubmitting || _isSlotFull(_selectedTime ?? '')
                          ? null
                          : _submitReservation,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _accent,
                        disabledBackgroundColor: Colors.grey,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 3,
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2.5,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.restaurant, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  widget.isPreOrder && widget.requirePreorderPayment
                                      ? ('reservation.pay_and_reserve'.tr() == 'reservation.pay_and_reserve' ? 'Öde & Rezervasyonu Tamamla' : 'reservation.pay_and_reserve'.tr())
                                      : 'reservation.send_request'.tr(),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'reservation.business_approval_required'.tr(),
                    style: TextStyle(color: textSecondary, fontSize: 11),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({required Color cardBg, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _buildSummaryItem(
    IconData icon,
    String text,
    Color textPrimary,
    Color textSecondary,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        Icon(icon, color: isDark ? Colors.grey[400] : _iconGrey, size: 24),
        const SizedBox(height: 4),
        Text(
          text,
          style: TextStyle(
            color: textPrimary,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
