import 'package:flutter/material.dart';

class OpeningHoursHelper {
  final dynamic openingHours; // Can be string block or Map
  
  OpeningHoursHelper([this.openingHours]);

  // Normalize and find hours string for a specific date
  String? _getHoursStringForDate(DateTime date) {
    if (openingHours == null) return null;

    final dayNamesTr = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    final dayNamesEng = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    final dayNamesDe = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    
    final dayIndex = date.weekday - 1;
    final dayTr = dayNamesTr[dayIndex];
    final dayEng = dayNamesEng[dayIndex];
    final dayDe = dayNamesDe[dayIndex];

    if (openingHours is Map) {
       final map = openingHours as Map;
       // Try Turkish Key
       if (map.containsKey(dayTr)) return map[dayTr]?.toString();
       // Try English Key
       if (map.containsKey(dayEng)) return map[dayEng]?.toString();
       // Try German Key
       if (map.containsKey(dayDe)) return map[dayDe]?.toString();
       
       // Try Case-Insensitive Scan
       for (var key in map.keys) {
         final k = key.toString().trim().toLowerCase();
         if (k == dayTr.toLowerCase() || k == dayEng.toLowerCase() || k == dayDe.toLowerCase()) {
           return map[key]?.toString();
         }
       }
    } else if (openingHours is String) {
       // Robust Regex Parsing
       // Match "Pazartesi: 09:00 - 18:00" or "Monday: ..." ignoring case and leading/trailing junk
       final block = openingHours.toString();
       
       // Regex to find the line starting with the day name (Tr or Eng) followed by colon
       // We capture until the end of the line (newline) to support comma-separated shifts (e.g. "09:00-12:00, 13:00-18:00")
       // If multiple days are on the same line (e.g. "Mon: 9-5, Tue: 9-5"), the subsequent days will be included in the capture group,
       // but the isOpenAt logic splits by comma and ignores invalid time ranges, so it degrades gracefully.
       final dayPattern = RegExp(
         '(${RegExp.escape(dayTr)}|${RegExp.escape(dayEng)}|${RegExp.escape(dayDe)})\\s*:\\s*([^\\n]+)', 
         caseSensitive: false,
         multiLine: true
       );
       
       final match = dayPattern.firstMatch(block);
       if (match != null) {
         return match.group(2)?.trim();
       }
    } else if (openingHours is List) {
       // Support for Google Places List<String> format: "Monday: 09:00 - 18:00"
       for (var item in openingHours) {
          if (item is! String) continue;
          
          final parts = item.split(':');
          if (parts.isEmpty) continue;
          
          final dayPart = parts[0].trim().toLowerCase();
          if (dayPart == dayTr.toLowerCase() || dayPart == dayEng.toLowerCase() || dayPart == dayDe.toLowerCase()) {
             // Found match. Strip "Day:"
             if (parts.length > 1) {
                 return parts.sublist(1).join(':').trim(); 
             }
             return item;
          }
       }
    }
    return null;
  }

  // Public wrapper for getting hours string
  String? getHoursStringForDate(DateTime date) {
    return _getHoursStringForDate(date);
  }

  // Robust time parser handling "HH:MM", "HH:MM AM/PM", and "HH"
  ({int hour, int minute})? _parseTime(String timeStr) {
    if (timeStr.isEmpty) return null;
    try {
      final normalized = timeStr.toUpperCase().replaceAll('.', ':').trim();
      final isPM = normalized.contains('PM');
      final isAM = normalized.contains('AM');
      
      final cleanStr = normalized.replaceAll(RegExp(r'[A-Za-z\s]'), '');
      if (cleanStr.isEmpty) return null;
      
      final parts = cleanStr.split(':');
      int hour = int.parse(parts[0].trim());
      int minute = parts.length > 1 ? int.parse(parts[1].trim()) : 0;
      
      if (isPM && hour < 12) hour += 12;
      if (isAM && hour == 12) hour = 0;
      
      return (hour: hour, minute: minute);
    } catch (e) {
      debugPrint('Error parsing time string $timeStr: $e');
      return null;
    }
  }

  bool _isTimeInScheduleDay(DateTime time, DateTime scheduleDate) {
    return _getCloseTimeIfOpen(time, scheduleDate) != null;
  }

  // Returns the DateTime when the CURRENT shift ends, if the given time is within an open shift.
  DateTime? _getCloseTimeIfOpen(DateTime time, DateTime scheduleDate) {
    final hoursStr = _getHoursStringForDate(scheduleDate);
    if (hoursStr == null) {
       return null; 
    }
    
    final formatted = hoursStr.trim();
    final lower = formatted.toLowerCase();

    // Strict Closed Checks
    if (lower.contains('kapalı') || lower.contains('closed') || formatted == 'Saatler Yok') return null;
    if (formatted == '-' || formatted.isEmpty) return null;
    if (lower.contains('24 saat') || lower.contains('open 24')) {
      // Return a distant future date to say it never closes
      return time.add(const Duration(days: 365));
    }

    try {
      final now = DateTime(scheduleDate.year, scheduleDate.month, scheduleDate.day); // Base date for parsing logic
      
      // Support multiple ranges: "09:00 - 12:00, 13:00 - 18:00"
      final ranges = formatted.split(',');

      for (var range in ranges) {
          // Normalize en-dash and DOT separator to colon for time parsing
          var cleaned = range.replaceAll('–', '-').replaceAll('.', ':').trim(); 
          if (cleaned.isEmpty || cleaned == '-') continue;

          final parts = cleaned.split('-');
          if (parts.length != 2) continue;

          // Parse start/end relative to the schedule date
          final parsedStart = _parseTime(parts[0]);
          final parsedEnd = _parseTime(parts[1]);
          
          if (parsedStart == null || parsedEnd == null) continue;

          final start = DateTime(now.year, now.month, now.day, parsedStart.hour, parsedStart.minute);
          var end = DateTime(now.year, now.month, now.day, parsedEnd.hour, parsedEnd.minute);
          
          // Overnight handling
          if (end.isBefore(start) || end.isAtSameMomentAs(start)) {
             end = end.add(const Duration(days: 1));
          }
          
          // Include exact start time (>= instead of >) and exclude exact end time (<)
          if ((time.isAtSameMomentAs(start) || time.isAfter(start)) && time.isBefore(end)) {
            return end;
          }
      }
    } catch (e) {
      debugPrint('Error parsing hours in helper: $e');
      // On parsing error, pretend it stays open forever to avoid false closing.
      return time.add(const Duration(days: 365)); 
    }
    
    return null;
  }

  int? getMinutesUntilClose(DateTime time) {
    if (openingHours == null) return null;

    DateTime? closeTime = _getCloseTimeIfOpen(time, time);
    if (closeTime == null) {
      closeTime = _getCloseTimeIfOpen(time, time.subtract(const Duration(days: 1)));
    }
    
    if (closeTime != null) {
      return closeTime.difference(time).inMinutes;
    }
    return null;
  }

  bool isOpenAt(DateTime time) {
    if (openingHours == null) return true;

    // Check if it's currently open based on TODAY's schedule
    if (_isTimeInScheduleDay(time, time)) return true;

    // Check if it's currently open based on YESTERDAY'S schedule (overnight shift)
    if (_isTimeInScheduleDay(time, time.subtract(const Duration(days: 1)))) return true;

    // If data exists effectively but not for this day (e.g. key missing), likely closed.
    return false;
  }

  // Find next open time — checks ALL shifts per day (e.g. "09:00-14:00, 17:00-22:00")
  DateTime? getNextOpenDateTime(DateTime from) {
    // Check next 7 days
    for (int i = 0; i < 7; i++) {
       final date = from.add(Duration(days: i));
       final hoursStr = _getHoursStringForDate(date);
       if (hoursStr == null) continue;
       
       final lower = hoursStr.toLowerCase().trim();
       if (lower.contains('kapalı') || lower.contains('closed') || lower == '-' || lower.isEmpty) continue;
       if (lower.contains('24 saat') || lower.contains('open 24')) {
         // 24-hour — next candidate is start of this day (or now if today)
         final candidate = DateTime(date.year, date.month, date.day, 0, 0);
         if (candidate.isAfter(from)) return candidate;
         continue; // already past
       }
       
       // Parse ALL comma-separated shifts and find the earliest future start
       try {
         final ranges = hoursStr.split(',');
         DateTime? earliest;
         
         for (var range in ranges) {
           var cleaned = range.replaceAll('–', '-').replaceAll('.', ':').trim();
           if (cleaned.isEmpty || cleaned == '-') continue;
           
           final parts = cleaned.split('-');
           if (parts.length < 2) continue;
           
           final parsedStart = _parseTime(parts[0]);
           if (parsedStart == null) continue;
           
           final candidate = DateTime(date.year, date.month, date.day, parsedStart.hour, parsedStart.minute);
           
           if (candidate.isAfter(from)) {
             if (earliest == null || candidate.isBefore(earliest)) {
               earliest = candidate;
             }
           }
         }
         
         if (earliest != null) return earliest;
       } catch (e) { continue; }
    }
    return null;
  }


  List<DateTime> getAvailableSlots({bool isPickup = true, int daysToCheck = 3, int prepTimeMinutes = 60, int slotIntervalMinutes = 5, DateTime? startFrom}) {
    List<DateTime> slots = [];
    DateTime now = DateTime.now();

    // Determine starting cursor
    DateTime cursor;
    
    if (startFrom != null) {
      // If startFrom is provided (e.g. Tomorrow for Delivery), respect it strictly.
      cursor = startFrom;
      // If startFrom is in the past relative to now + prepTime, bump it?
      // Usually startFrom will be future (e.g. Tomorrow), so we just start there.
      // But we should roughly align to 00/30 minutes if needed, though usually valid dates are passed.
      if (cursor.minute % slotIntervalMinutes != 0) {
         // Align to next slot boundary
         int remainder = cursor.minute % slotIntervalMinutes;
         cursor = cursor.add(Duration(minutes: slotIntervalMinutes - remainder));
         cursor = cursor.copyWith(second: 0, millisecond: 0, microsecond: 0);
      }
    } else {
      // Default Logic: ASAP (Now + Prep)
      DateTime minStart = now.add(Duration(minutes: prepTimeMinutes)); 
      
      // Round to next slotInterval
      int minute = minStart.minute;
      int remainder = minute % slotIntervalMinutes;
      if (remainder > 0) {
        minStart = minStart.add(Duration(minutes: slotIntervalMinutes - remainder));
      }
      minStart = minStart.copyWith(second: 0, millisecond: 0, microsecond: 0);
      cursor = minStart;
      
      // Smart Start Logic for ASAP:
      // If "ASAP" time is closed, find next open + 30m prep
      if (!isOpenAt(cursor)) {
        final nextOpen = getNextOpenDateTime(cursor);
        if (nextOpen != null) {
          cursor = nextOpen.add(const Duration(minutes: 30));
        } else {
          // Fallback: advance day-by-day to find ANY day with opening hours
          // This prevents the "dead cursor" problem where cursor stays at a closed time
          for (int d = 1; d <= daysToCheck; d++) {
            final futureDate = now.add(Duration(days: d));
            final hrs = _getHoursStringForDate(futureDate);
            if (hrs != null && hrs.trim().isNotEmpty && hrs != '-') {
              final lower = hrs.toLowerCase();
              if (lower.contains('kapalı') || lower.contains('closed')) continue;
              if (lower.contains('24 saat') || lower.contains('open 24')) {
                cursor = DateTime(futureDate.year, futureDate.month, futureDate.day, 0, 30);
                break;
              }
              // Try to parse the first shift's start time
              try {
                final ranges = hrs.split(',');
                for (var range in ranges) {
                  var cleaned = range.replaceAll('–', '-').replaceAll('.', ':').trim();
                  final parts = cleaned.split('-');
                  if (parts.length < 2) continue;
                  final parsedStart = _parseTime(parts[0]);
                  if (parsedStart != null) {
                    cursor = DateTime(futureDate.year, futureDate.month, futureDate.day, parsedStart.hour, parsedStart.minute);
                    cursor = cursor.add(const Duration(minutes: 30)); // prep buffer
                    break;
                  }
                }
                // If we moved cursor to a future date, break outer loop
                if (cursor.isAfter(now.add(const Duration(hours: 12)))) break;
              } catch (_) { continue; }
            }
          }
        }
      }
    }

    // Limit
    DateTime endLimit = (startFrom ?? now).add(Duration(days: daysToCheck));
    
    // Safety break to prevent infinite loops
    int safety = 0;
    
    while(cursor.isBefore(endLimit) && safety < 5000) { // increased for 5-min intervals
      safety++;
      
      // We only add if OPEN
      if (isOpenAt(cursor)) {
        slots.add(cursor);
      }
      
      cursor = cursor.add(Duration(minutes: slotIntervalMinutes));
    }
    return slots;
  }

  // New Helper for 2-Column Picker
  Map<DateTime, List<DateTime>> getAvailableSlotsGroupedByDay({bool isPickup = true, int daysToCheck = 7, int prepTimeMinutes = 60, int slotIntervalMinutes = 15, DateTime? startFrom}) {
    final rawSlots = getAvailableSlots(isPickup: isPickup, daysToCheck: daysToCheck, prepTimeMinutes: prepTimeMinutes, slotIntervalMinutes: slotIntervalMinutes, startFrom: startFrom);
    
    Map<DateTime, List<DateTime>> grouped = {};
    
    for (var slot in rawSlots) {
      // Normalize to Midnight for Key
      final dateKey = DateTime(slot.year, slot.month, slot.day);
      if (!grouped.containsKey(dateKey)) {
        grouped[dateKey] = [];
      }
      grouped[dateKey]!.add(slot);
    }
    
    return grouped;
  }

  bool isOpenWithinTime(String startTime, String endTime, DateTime time) {
    try {
      final parsedStart = _parseTime(startTime);
      final parsedEnd = _parseTime(endTime);
      
      if (parsedStart == null || parsedEnd == null) return true;
      
      final start = DateTime(time.year, time.month, time.day, parsedStart.hour, parsedStart.minute);
      var end = DateTime(time.year, time.month, time.day, parsedEnd.hour, parsedEnd.minute);
      
      if (end.isBefore(start) || end.isAtSameMomentAs(start)) {
         end = end.add(const Duration(days: 1));
      }
      
      return (time.isAtSameMomentAs(start) || time.isAfter(start)) && time.isBefore(end);
    } catch (e) {
      return true; 
    }
  }
}
