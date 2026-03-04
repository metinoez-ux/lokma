import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// Product Favorites Provider - Hybrid Storage (mirrors BusinessFavoritesNotifier pattern)
/// - If user is logged in: Syncs with Firestore (persistent across devices)
/// - If user is NOT logged in: Uses SharedPreferences (local cache)

final productFavoritesProvider = NotifierProvider<ProductFavoritesNotifier, List<String>>(ProductFavoritesNotifier.new);

class ProductFavoritesNotifier extends Notifier<List<String>> {
  static const String _localPrefsKey = 'favorite_products';

  @override
  List<String> build() {
    _loadFavorites();
    return [];
  }

  String? get _userId => FirebaseAuth.instance.currentUser?.uid;
  bool get _isLoggedIn => _userId != null;

  Future<void> _loadFavorites() async {
    if (_isLoggedIn) {
      await _loadFromFirestore();
    } else {
      await _loadFromLocal();
    }
  }

  Future<void> _loadFromLocal() async {
    final prefs = await SharedPreferences.getInstance();
    final favorites = prefs.getStringList(_localPrefsKey) ?? [];
    state = favorites;
  }

  Future<void> _loadFromFirestore() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(_userId)
          .get();
      
      if (doc.exists) {
        final data = doc.data();
        final favorites = (data?['favoriteProducts'] as List<dynamic>?)
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
      await _loadFromLocal();
    }
  }

  Future<void> _migrateLocalToFirestore() async {
    final prefs = await SharedPreferences.getInstance();
    final localFavorites = prefs.getStringList(_localPrefsKey) ?? [];
    
    if (localFavorites.isNotEmpty && _isLoggedIn) {
      try {
        await FirebaseFirestore.instance
            .collection('users')
            .doc(_userId)
            .set({
              'favoriteProducts': localFavorites,
            }, SetOptions(merge: true));
        state = localFavorites;
      } catch (e) {
        state = localFavorites;
      }
    }
  }

  Future<void> toggleFavorite(String productSku) async {
    List<String> newFavorites;
    
    if (state.contains(productSku)) {
      newFavorites = state.where((id) => id != productSku).toList();
    } else {
      newFavorites = [...state, productSku];
    }
    
    state = newFavorites;
    
    if (_isLoggedIn) {
      await _saveToFirestore(newFavorites);
    }
    await _saveToLocal(newFavorites);
  }

  Future<void> _saveToLocal(List<String> favorites) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_localPrefsKey, favorites);
  }

  Future<void> _saveToFirestore(List<String> favorites) async {
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(_userId)
          .set({
            'favoriteProducts': favorites,
          }, SetOptions(merge: true));
    } catch (e) {
      // Silently fail - local backup exists
    }
  }

  bool isFavorite(String productSku) {
    return state.contains(productSku);
  }

  Future<void> refresh() async {
    await _loadFavorites();
  }
}
