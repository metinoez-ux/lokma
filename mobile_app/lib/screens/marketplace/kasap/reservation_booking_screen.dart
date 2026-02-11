import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:intl/intl.dart';

/// OpenTable-style Reservation Booking Screen
/// - Checks availability against maxReservationTables per time slot
/// - Respects business opening hours
/// - Creates reservation in pending state
/// - Writes to: businesses/{businessId}/reservations
class ReservationBookingScreen extends StatefulWidget {
  final String businessId;
  final String businessName;

  const ReservationBookingScreen({
    super.key,
    required this.businessId,
    required this.businessName,
  });

  @override
  State<ReservationBookingScreen> createState() => _ReservationBookingScreenState();
}

class _ReservationBookingScreenState extends State<ReservationBookingScreen> {
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

  // Accent color
  static const Color _accent = Color(0xFFFB335B);

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
    const dayNamesTr = {
      1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba',
      4: 'Perşembe', 5: 'Cuma', 6: 'Cumartesi', 7: 'Pazar',
    };
    
    final dayEn = dayNames[_selectedDate.weekday] ?? '';
    final dayTr = dayNamesTr[_selectedDate.weekday] ?? '';
    
    // Check if this day is marked as Closed
    final closedPattern = RegExp('$dayEn:\\s*Closed', caseSensitive: false);
    if (closedPattern.hasMatch(_openingHoursRaw)) {
      return '$dayTr: Kapalı';
    }
    
    // Try to find the time range for this day
    // Pattern: "Monday: 11:30 AM – 10:00 PM" or "Monday: 11:30 AM - 10:00 PM"
    final dayPattern = RegExp(
      '$dayEn:\\s*(\\d{1,2}:\\d{2}\\s*(?:AM|PM)?)\\s*[–\\-]\\s*(\\d{1,2}:\\d{2}\\s*(?:AM|PM)?)',
      caseSensitive: false,
    );
    final match = dayPattern.firstMatch(_openingHoursRaw);
    
    if (match != null) {
      final open = _parseTimeToHHMM(match.group(1)!.trim());
      final close = _parseTimeToHHMM(match.group(2)!.trim());
      return '$dayTr: $open – $close';
    }
    
    // Fallback: try general time range
    final timeRangeRegex = RegExp(r'(\d{1,2}):(\d{2})\s*(?:AM|PM)?\s*[–\-]\s*(\d{1,2}):(\d{2})\s*(?:AM|PM)?');
    final generalMatch = timeRangeRegex.firstMatch(_openingHoursRaw);
    if (generalMatch != null) {
      return '$dayTr: ${generalMatch.group(0)}';
    }
    
    return '';
  }
  
  /// Convert "11:30 AM" or "10:00 PM" to 24h "HH:MM" format
  String _parseTimeToHHMM(String timeStr) {
    final isPM = timeStr.toUpperCase().contains('PM');
    final isAM = timeStr.toUpperCase().contains('AM');
    final cleaned = timeStr.replaceAll(RegExp(r'\s*(AM|PM)\s*', caseSensitive: false), '').trim();
    final parts = cleaned.split(':');
    if (parts.length != 2) return cleaned;
    
    var hour = int.tryParse(parts[0]) ?? 0;
    final minute = parts[1];
    
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour == 12) hour = 0;
    
    return '${hour.toString().padLeft(2, '0')}:$minute';
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
      // Try simple parsing: look for time ranges like "10:00-22:00"
      final timeRangeRegex = RegExp(r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})');
      final matches = timeRangeRegex.allMatches(_openingHoursRaw);
      
      if (matches.isNotEmpty) {
        // Use first match as general hours
        final match = matches.first;
        openHour = int.parse(match.group(1)!);
        openMinute = int.parse(match.group(2)!);
        closeHour = int.parse(match.group(3)!);
        closeMinute = int.parse(match.group(4)!);
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
      _showSnackBar('Lütfen önce giriş yapın', isError: true);
      return;
    }
    if (_selectedTime == null) {
      _showSnackBar('Lütfen bir saat seçin', isError: true);
      return;
    }
    if (_isSlotFull(_selectedTime!)) {
      _showSnackBar('Bu saat dilimi dolu, lütfen başka saat seçin', isError: true);
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
        _showSnackBar('Geçmiş bir saat seçemezsiniz', isError: true);
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
        _showSnackBar('Bu saat dolmuş! Lütfen farklı bir saat seçin.', isError: true);
        await _loadSlotsForDate(_selectedDate); // Refresh slot counts
        setState(() => _isSubmitting = false);
        return;
      }

      // Get customer FCM token for push notifications
      String? customerFcmToken;
      try {
        customerFcmToken = await FirebaseMessaging.instance.getToken();
      } catch (_) {}

      await FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.businessId)
          .collection('reservations')
          .add({
        'userId': user.uid,
        'userName': user.displayName ?? 'Misafir',
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
      });

      if (!mounted) return;

      _showPendingConfirmationDialog();
    } catch (e) {
      _showSnackBar('Rezervasyon oluşturulamadı: $e', isError: true);
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
        icon: const Icon(Icons.schedule_send, color: Colors.orange, size: 56),
        title: Text('Rezervasyon Talebiniz Alındı!', style: TextStyle(color: textPrimary)),
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
                      DateFormat('d MMMM yyyy, EEEE', 'tr').format(_selectedDate), textPrimary),
                  const SizedBox(height: 8),
                  _buildDetailRow(Icons.access_time, 'Saat $_selectedTime', textPrimary),
                  const SizedBox(height: 8),
                  _buildDetailRow(Icons.people, '$_partySize Kişi', textPrimary),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(isDark ? 0.15 : 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.orange.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, color: Colors.orange, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Lütfen işletmeden onay bildirimini bekleyin. '
                      'İşletme personeli talebinizi incelediğinde '
                      'bildirim alacaksınız.',
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
            child: const Text('Tamam', style: TextStyle(color: _accent, fontWeight: FontWeight.bold)),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white70 : Colors.black54;

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, color: textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          children: [
            Text(
              'Masa Rezervasyonu',
              style: TextStyle(color: textPrimary, fontSize: 18, fontWeight: FontWeight.w700),
            ),
            Text(
              widget.businessName,
              style: TextStyle(color: textSecondary, fontSize: 13),
            ),
          ],
        ),
        centerTitle: true,
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
                      Icon(Icons.people, color: _accent, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'Kişi Sayısı',
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
                                          color: _accent.withOpacity(0.3),
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
                                  fontWeight: FontWeight.bold,
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
                      Icon(Icons.calendar_today, color: _accent, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'Tarih',
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
                                          color: _accent.withOpacity(0.3),
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
                                        ? 'Bugün'
                                        : DateFormat('EEE', 'tr').format(date),
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
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    DateFormat('MMM', 'tr').format(date),
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
                      Icon(Icons.access_time, color: _accent, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'Saat',
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
                              'Bu tarih için uygun saat bulunamadı',
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
                                  ? (isDark ? Colors.red[900]!.withOpacity(0.3) : Colors.red[50])
                                  : isPast
                                      ? (isDark ? Colors.grey[800] : Colors.grey[300])
                                      : isSelected
                                          ? _accent
                                          : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[200]),
                              borderRadius: BorderRadius.circular(10),
                              border: isFull
                                  ? Border.all(color: Colors.red.withOpacity(0.3))
                                  : isSelected || isPast
                                      ? null
                                      : Border.all(
                                          color: isDark ? Colors.white12 : Colors.black12,
                                        ),
                              boxShadow: isSelected && !isDisabled
                                  ? [
                                      BoxShadow(
                                        color: _accent.withOpacity(0.3),
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
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                    fontSize: 14,
                                    decoration: isFull ? TextDecoration.lineThrough : null,
                                  ),
                                ),
                                if (isFull)
                                  Text(
                                    'DOLU',
                                    style: TextStyle(
                                      color: Colors.red[400],
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  )
                                else if (_maxReservationTables > 0 && remaining <= 3)
                                  Text(
                                    '$remaining kaldı',
                                    style: TextStyle(
                                      color: isSelected ? Colors.white70 : Colors.orange[700],
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
                      Icon(Icons.note_alt_outlined, color: _accent, size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'Notlar',
                        style: TextStyle(
                          color: textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'Opsiyonel',
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
                          'Özel isteklerinizi yazın (ör: doğum günü, çocuk sandalyesi...)',
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
                        '$_partySize Kişi',
                        textPrimary,
                        textSecondary,
                      ),
                      _buildSummaryItem(
                        Icons.calendar_today,
                        DateFormat('d MMM', 'tr').format(_selectedDate),
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
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.restaurant, size: 20),
                                SizedBox(width: 8),
                                Text(
                                  'Rezervasyon Talebi Gönder',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'İşletme onayı gereklidir',
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
            color: Colors.black.withOpacity(0.05),
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
    return Column(
      children: [
        Icon(icon, color: _accent, size: 24),
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
