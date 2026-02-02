import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Theme mode preference: system (auto), light, or dark
enum ThemePreference {
  system, // Follow device setting
  light,  // Always light
  dark,   // Always dark
}

/// Provider for theme preference using Riverpod 3.x Notifier
final themePreferenceProvider = NotifierProvider<ThemePreferenceNotifier, ThemePreference>(() {
  return ThemePreferenceNotifier();
});

/// Notifier for theme preference changes (Riverpod 3.x compatible)
class ThemePreferenceNotifier extends Notifier<ThemePreference> {
  static const _key = 'theme_preference';
  
  @override
  ThemePreference build() {
    _loadPreference();
    return ThemePreference.system;
  }
  
  Future<void> _loadPreference() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_key);
    if (value != null) {
      state = ThemePreference.values.firstWhere(
        (e) => e.name == value,
        orElse: () => ThemePreference.system,
      );
    }
  }
  
  Future<void> setPreference(ThemePreference preference) async {
    state = preference;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, preference.name);
  }
}

/// Convert ThemePreference to Flutter's ThemeMode
ThemeMode themePreferenceToMode(ThemePreference preference) {
  switch (preference) {
    case ThemePreference.system:
      return ThemeMode.system;
    case ThemePreference.light:
      return ThemeMode.light;
    case ThemePreference.dark:
      return ThemeMode.dark;
  }
}
