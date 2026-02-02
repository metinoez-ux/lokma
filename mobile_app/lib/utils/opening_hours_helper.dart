import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class OpeningHoursHelper {
  final dynamic openingHours; // Can be string block or Map
  
  OpeningHoursHelper([this.openingHours]);

  // Normalize and find hours string for a specific date
  String? _getHoursStringForDate(DateTime date) {
    if (openingHours == null) return null;

    final dayNamesTr = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    final dayNamesEng = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    final dayIndex = date.weekday - 1;
    final dayTr = dayNamesTr[dayIndex];
    final dayEng = dayNamesEng[dayIndex];

    if (openingHours is Map) {
       final map = openingHours as Map;
       // Try Turkish Key
       if (map.containsKey(dayTr)) return map[dayTr]?.toString();
       // Try English Key
       if (map.containsKey(dayEng)) return map[dayEng]?.toString();
       
       // Try Case-Insensitive Scan
       for (var key in map.keys) {
         final k = key.toString().trim().toLowerCase();
         if (k == dayTr.toLowerCase() || k == dayEng.toLowerCase()) {
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
         '(${RegExp.escape(dayTr)}|${RegExp.escape(dayEng)})\\s*:\\s*([^\\n]+)', 
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
          final lower = item.toLowerCase();
          
          if (lower.startsWith(dayTr.toLowerCase()) || lower.startsWith(dayEng.toLowerCase())) {
             // Found match. Strip "Day: "
             final parts = item.split(': ');
             if (parts.length > 1) {
                 return parts.sublist(1).join(': ').trim(); 
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

  bool isOpenAt(DateTime time) {
    final hoursStr = _getHoursStringForDate(time);
    if (hoursStr == null) {
       // Safety fallback: If data structure is totally weird or missing, assume OPEN to prevent blocking sales.
       if (openingHours == null) return true; 
       // If data exists effectively but not for this day (e.g. key missing), likely closed.
       return false; 
    }
    
    final formatted = hoursStr.trim();
    final lower = formatted.toLowerCase();

    // Strict Closed Checks
    if (lower.contains('kapalı') || lower.contains('closed') || formatted == 'Saatler Yok') return false;
    if (formatted == '-' || formatted.isEmpty) return false;
    if (lower.contains('24 saat') || lower.contains('open 24')) return true;

    try {
      final now = DateTime(time.year, time.month, time.day); // Base date for parsing logic
      
      // Support multiple ranges: "09:00 - 12:00, 13:00 - 18:00"
      final ranges = formatted.split(',');

      for (var range in ranges) {
          // Normalize en-dash and DOT separator to colon for time parsing
          var cleaned = range.replaceAll('–', '-').replaceAll('.', ':').trim(); 
          if (cleaned.isEmpty || cleaned == '-') continue;

          final parts = cleaned.split('-');
          if (parts.length != 2) continue;

          final startParts = parts[0].trim().split(':');
          final endParts = parts[1].trim().split(':');
          
          if (startParts.length < 2 || endParts.length < 2) continue;

          // Parse start/end relative to the query date
          final start = DateTime(now.year, now.month, now.day, int.parse(startParts[0]), int.parse(startParts[1]));
          var end = DateTime(now.year, now.month, now.day, int.parse(endParts[0]), int.parse(endParts[1]));
          
          // Overnight handling
          if (end.isBefore(start) || end.isAtSameMomentAs(start)) {
             end = end.add(const Duration(days: 1));
          }
          
          // Include exact start time (>= instead of >) and exclude exact end time (<)
          if ((time.isAtSameMomentAs(start) || time.isAfter(start)) && time.isBefore(end)) {
            return true;
          }
      }
    } catch (e) {
      debugPrint('Error parsing hours in helper: $e');
      // On parsing error, default to OPEN to avoid blocking sales?
      return true; 
    }
    
    return false;
  }

  // Find next open time
  DateTime? getNextOpenDateTime(DateTime from) {
    // Check next 7 days (scan efficiently)
    for (int i = 0; i < 7; i++) {
       final date = from.add(Duration(days: i));
       final hoursStr = _getHoursStringForDate(date);
       if (hoursStr == null || hoursStr.toLowerCase().contains('kapalı')) continue;
       
       // Parse start time of this day
       try {
         final cleaned = hoursStr.split(',')[0].replaceAll('–', '-').replaceAll('.', ':').trim();
         final parts = cleaned.split('-');
         if (parts.length < 2) continue;
         
         final startParts = parts[0].trim().split(':');
         final start = TimeOfDay(hour: int.parse(startParts[0]), minute: int.parse(startParts[1]));
         
         final candidate = DateTime(date.year, date.month, date.day, start.hour, start.minute);
         
         if (candidate.isAfter(from)) return candidate;
         // If "today" and open time is past, check if we are currently open (handled by isOpenAt) 
         // or if there is a second shift?
         // This simple logic finds the NEXT START of a shift.
         
       } catch (e) { continue; }
    }
    return null;
  }


  List<DateTime> getAvailableSlots({bool isPickup = true, int daysToCheck = 3, int prepTimeMinutes = 60, DateTime? startFrom}) {
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
      if (cursor.minute != 0 && cursor.minute != 30) {
         // align
         if (cursor.minute < 30) {
            cursor = cursor.copyWith(minute: 30, second: 0, millisecond: 0, microsecond: 0);
         } else {
             cursor = cursor.add(Duration(minutes: 60 - cursor.minute));
             cursor = cursor.copyWith(second: 0, millisecond: 0, microsecond: 0);
         }
      }
    } else {
      // Default Logic: ASAP (Now + Prep)
      DateTime minStart = now.add(Duration(minutes: prepTimeMinutes)); 
      
      // Round to next 30 min
      int minute = minStart.minute;
      if (minute > 0 && minute < 30) {
        minStart = minStart.add(Duration(minutes: 30 - minute));
      } else if (minute > 30) {
        minStart = minStart.add(Duration(minutes: 60 - minute));
      }
      minStart = minStart.copyWith(second: 0, millisecond: 0, microsecond: 0);
      cursor = minStart;
      
      // Smart Start Logic for ASAP:
      // If "ASAP" time is closed, find next open + 30m prep
      if (!isOpenAt(cursor)) {
        final nextOpen = getNextOpenDateTime(cursor);
        if (nextOpen != null) {
          cursor = nextOpen.add(const Duration(minutes: 30));
        }
      }
    }

    // Limit
    DateTime endLimit = (startFrom ?? now).add(Duration(days: daysToCheck));
    
    // Safety break to prevent infinite loops
    int safety = 0;
    
    while(cursor.isBefore(endLimit) && safety < 1000) { // increased safety limit for 7 days
      safety++;
      
      // We only add if OPEN
      if (isOpenAt(cursor)) {
        slots.add(cursor);
      }
      
      cursor = cursor.add(const Duration(minutes: 30));
    }
    return slots;
  }

  // New Helper for 2-Column Picker
  Map<DateTime, List<DateTime>> getAvailableSlotsGroupedByDay({bool isPickup = true, int daysToCheck = 7, int prepTimeMinutes = 60, DateTime? startFrom}) {
    final rawSlots = getAvailableSlots(isPickup: isPickup, daysToCheck: daysToCheck, prepTimeMinutes: prepTimeMinutes, startFrom: startFrom);
    
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
}
