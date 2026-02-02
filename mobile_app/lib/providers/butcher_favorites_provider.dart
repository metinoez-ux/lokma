import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// Business Favorites Provider - Hybrid Storage
/// - If user is logged in: Syncs with Firestore (persistent across devices)
/// - If user is NOT logged in: Uses SharedPreferences (local cache)

final businessFavoritesProvider = NotifierProvider<BusinessFavoritesNotifier, List<String>>(BusinessFavoritesNotifier.new);

// Backwards compatibility alias
final butcherFavoritesProvider = businessFavoritesProvider;

class BusinessFavoritesNotifier extends Notifier<List<String>> {
  static const String _localPrefsKey = 'favorite_businesses';

  @override
  List<String> build() {
    _loadFavorites();
    return [];
  }

  /// Get current user ID (null if not logged in)
  String? get _userId => FirebaseAuth.instance.currentUser?.uid;

  /// Check if user is logged in
  bool get _isLoggedIn => _userId != null;

  /// Load favorites from appropriate storage
  Future<void> _loadFavorites() async {
    if (_isLoggedIn) {
      // Load from Firestore
      await _loadFromFirestore();
    } else {
      // Load from local storage
      await _loadFromLocal();
    }
  }

  /// Load from SharedPreferences (offline/guest mode)
  Future<void> _loadFromLocal() async {
    final prefs = await SharedPreferences.getInstance();
    final favorites = prefs.getStringList(_localPrefsKey) ?? [];
    state = favorites;
  }

  /// Load from Firestore (logged in user)
  Future<void> _loadFromFirestore() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(_userId)
          .get();
      
      if (doc.exists) {
        final data = doc.data();
        final favorites = (data?['favoriteBusinesses'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ?? [];
        state = favorites;
        
        // Also sync to local for offline access
        final prefs = await SharedPreferences.getInstance();
        await prefs.setStringList(_localPrefsKey, favorites);
      } else {
        // New user - migrate local favorites to Firestore
        await _migrateLocalToFirestore();
      }
    } catch (e) {
      // Fallback to local if Firestore fails
      await _loadFromLocal();
    }
  }

  /// Migrate local favorites to Firestore when user logs in
  Future<void> _migrateLocalToFirestore() async {
    final prefs = await SharedPreferences.getInstance();
    final localFavorites = prefs.getStringList(_localPrefsKey) ?? [];
    
    if (localFavorites.isNotEmpty && _isLoggedIn) {
      try {
        await FirebaseFirestore.instance
            .collection('users')
            .doc(_userId)
            .set({
              'favoriteBusinesses': localFavorites,
            }, SetOptions(merge: true));
        state = localFavorites;
      } catch (e) {
        state = localFavorites;
      }
    }
  }

  /// Toggle favorite status
  Future<void> toggleFavorite(String businessId) async {
    List<String> newFavorites;
    
    if (state.contains(businessId)) {
      newFavorites = state.where((id) => id != businessId).toList();
    } else {
      newFavorites = [...state, businessId];
    }
    
    state = newFavorites;
    
    // Save to appropriate storage
    if (_isLoggedIn) {
      await _saveToFirestore(newFavorites);
    }
    
    // Always save locally for offline access
    await _saveToLocal(newFavorites);
  }

  /// Save to SharedPreferences
  Future<void> _saveToLocal(List<String> favorites) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_localPrefsKey, favorites);
  }

  /// Save to Firestore
  Future<void> _saveToFirestore(List<String> favorites) async {
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(_userId)
          .set({
            'favoriteBusinesses': favorites,
          }, SetOptions(merge: true));
    } catch (e) {
      // Silently fail - local backup exists
    }
  }

  /// Check if a business is favorited
  bool isFavorite(String businessId) {
    return state.contains(businessId);
  }

  /// Refresh favorites (call after login/logout)
  Future<void> refresh() async {
    await _loadFavorites();
  }
}
