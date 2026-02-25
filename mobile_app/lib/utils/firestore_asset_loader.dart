import 'dart:convert';
import 'dart:ui';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

/// A custom AssetLoader for easy_localization.
/// 
/// It first loads the local JSON file (from assets/translations) as a fallback,
/// then attempts to fetch the live translations from Firestore (`translations/{locale}`).
/// If Firestore succeeds, it merges the remote translations over the local ones.
class FirestoreAssetLoader extends AssetLoader {
  final String assetPath;

  const FirestoreAssetLoader({this.assetPath = 'assets/translations'});

  @override
  Future<Map<String, dynamic>> load(String path, Locale locale) async {
    final langCode = locale.languageCode;
    Map<String, dynamic> localTranslations = {};

    // 1. Load Local JSON Fallback
    try {
      final jsonString = await rootBundle.loadString('$assetPath/$langCode.json');
      localTranslations = jsonDecode(jsonString) as Map<String, dynamic>;
      debugPrint('✅ local fallback loaded for $langCode');
    } catch (e) {
      debugPrint('⚠️ Warning: Could not load local asset $assetPath/$langCode.json: $e');
    }

    // 2. Fetch Live from Firestore with a strict 2-second timeout
    // We cannot block the app startup for minutes waiting for translations.
    try {
       final docSnap = await FirebaseFirestore.instance
           .collection('translations')
           .doc(langCode)
           .get(const GetOptions(source: Source.serverAndCache))
           .timeout(const Duration(seconds: 2));
       
       if (docSnap.exists && docSnap.data() != null) {
          final remoteTranslations = docSnap.data()!;
          debugPrint('🌐 Firestore translations loaded for $langCode');
          
          // Merge Remote over Local (Remote takes precedence)
          return _mergeMaps(localTranslations, remoteTranslations);
       } else {
          debugPrint('⚠️ Warning: No remote translation document found for $langCode. Using local only.');
       }
    } catch (e) {
       debugPrint('❌ Error fetching translations from Firestore for $langCode (likely timeout): $e');
       // Fall back to local translations silently
    }

    // Return whatever we managed to load (local or empty)
    return localTranslations;
  }

  /// Deep merges two maps. Values in `remote` override values in `local`.
  Map<String, dynamic> _mergeMaps(Map<String, dynamic> local, Map<String, dynamic> remote) {
    final merged = Map<String, dynamic>.from(local);

    remote.forEach((key, value) {
      if (value is Map<String, dynamic> && merged[key] is Map<String, dynamic>) {
        // Recursively merge nested maps
        merged[key] = _mergeMaps(merged[key] as Map<String, dynamic>, value);
      } else {
        // Override with remote value
        merged[key] = value;
      }
    });

    return merged;
  }
}
