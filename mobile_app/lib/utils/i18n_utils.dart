import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

class I18nUtils {
  /// Extracts the localized string from a Firestore Map based on the current locale.
  /// Enforces the "Graceful Fallback" rule: Current Locale -> 'tr' -> first available.
  static String getLocalizedText(BuildContext context, dynamic textData) {
    if (textData == null) return '';

    // If it's already a string, just return it (legacy data support)
    if (textData is String) {
      if (textData.isEmpty) return '';
      return textData;
    }

    // If it's a map (new i18n structure)
    if (textData is Map<String, dynamic> || textData is Map) {
      final map = textData as Map;
      if (map.isEmpty) return '';

      final currentLocale = context.locale.languageCode;

      // 1. Try exact match
      if (map.containsKey(currentLocale) && map[currentLocale] != null && map[currentLocale].toString().trim().isNotEmpty) {
        return map[currentLocale].toString().trim();
      }

      // 2. Fallback to Turkish ('tr')
      if (map.containsKey('tr') && map['tr'] != null && map['tr'].toString().trim().isNotEmpty) {
        return map['tr'].toString().trim();
      }

      // 3. Ultimate fallback (first valid string)
      for (final value in map.values) {
        if (value != null && value.toString().trim().isNotEmpty) {
          return value.toString().trim();
        }
      }
    }

    return textData.toString();
  }
}
