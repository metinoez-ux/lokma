import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'dart:convert';

/// Product Favorites Provider - Enhanced with businessId + productName
/// Stores List<FavoriteProduct> with {sku, businessId, productName, imageUrl, price}
/// Backward compatible: migrates old SKU-only lists automatically

class FavoriteProduct {
  final String sku;
  final String businessId;
  final String productName;
  final String imageUrl;
  final double price;

  const FavoriteProduct({
    required this.sku,
    required this.businessId,
    this.productName = '',
    this.imageUrl = '',
    this.price = 0,
  });

  Map<String, dynamic> toMap() => {
    'sku': sku,
    'businessId': businessId,
    'productName': productName,
    'imageUrl': imageUrl,
    'price': price,
  };

  factory FavoriteProduct.fromMap(Map<String, dynamic> map) => FavoriteProduct(
    sku: map['sku']?.toString() ?? '',
    businessId: map['businessId']?.toString() ?? '',
    productName: map['productName']?.toString() ?? '',
    imageUrl: map['imageUrl']?.toString() ?? '',
    price: (map['price'] ?? 0).toDouble(),
  );

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is FavoriteProduct && sku == other.sku;

  @override
  int get hashCode => sku.hashCode;
}

/// Detailed favorites provider (primary source of truth)
final productFavoritesDetailedProvider = NotifierProvider<ProductFavoritesDetailedNotifier, List<FavoriteProduct>>(ProductFavoritesDetailedNotifier.new);

/// Simple SKU list provider (derived) - backward compatible for simple isFavorite checks
final productFavoritesProvider = Provider<List<String>>((ref) {
  return ref.watch(productFavoritesDetailedProvider).map((fp) => fp.sku).toList();
});

class ProductFavoritesDetailedNotifier extends Notifier<List<FavoriteProduct>> {
  static const String _localPrefsKey = 'favorite_products_detailed';
  static const String _legacyPrefsKey = 'favorite_products';

  @override
  List<FavoriteProduct> build() {
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
    final jsonString = prefs.getString(_localPrefsKey);
    
    if (jsonString != null && jsonString.isNotEmpty) {
      try {
        final List<dynamic> decoded = json.decode(jsonString);
        state = decoded.map((e) => FavoriteProduct.fromMap(e as Map<String, dynamic>)).toList();
        return;
      } catch (_) {}
    }
    
    // Fallback: migrate from legacy SKU-only list
    final legacySkus = prefs.getStringList(_legacyPrefsKey) ?? [];
    if (legacySkus.isNotEmpty) {
      state = legacySkus.map((sku) => FavoriteProduct(sku: sku, businessId: '')).toList();
      await _saveToLocal(state);
    }
  }

  Future<void> _loadFromFirestore() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(_userId)
          .get();
      
      if (doc.exists) {
        final data = doc.data();
        
        // Try detailed format first from Firestore
        final detailed = data?['favoriteProductsDetailed'] as List<dynamic>?;
        if (detailed != null && detailed.isNotEmpty) {
          state = detailed
              .map((e) => FavoriteProduct.fromMap(e as Map<String, dynamic>))
              .toList();
          await _saveToLocal(state);
          return;
        }
        
        // Firestore'da favoriteProductsDetailed yok -- once local storage kontrol et
        // (Firestore yazimi basarisiz olmus olabilir ama local'de detayli veri var)
        final localDetailed = await _tryLoadDetailedFromLocal();
        if (localDetailed != null && localDetailed.isNotEmpty) {
          state = localDetailed;
          // Local'deki detayli veriyi Firestore'a da yaz (sync)
          await _saveToFirestore(localDetailed);
          return;
        }
        
        // Son care: legacy SKU-only format
        final legacySkus = (data?['favoriteProducts'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ?? [];
        if (legacySkus.isNotEmpty) {
          state = legacySkus.map((sku) => FavoriteProduct(sku: sku, businessId: '')).toList();
          await _saveToFirestore(state);
          await _saveToLocal(state);
        }
      }
    } catch (e) {
      debugPrint('_loadFromFirestore error: $e');
      await _loadFromLocal();
    }
  }

  /// Local storage'dan detayli veri okuma denemesi
  Future<List<FavoriteProduct>?> _tryLoadDetailedFromLocal() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(_localPrefsKey);
    
    if (jsonString != null && jsonString.isNotEmpty) {
      try {
        final List<dynamic> decoded = json.decode(jsonString);
        final items = decoded.map((e) => FavoriteProduct.fromMap(e as Map<String, dynamic>)).toList();
        // Sadece detayli veri varsa don (en az bir tane productName dolu olmali)
        if (items.any((fp) => fp.productName.isNotEmpty || fp.businessId.isNotEmpty)) {
          return items;
        }
      } catch (_) {}
    }
    return null;
  }

  Future<void> toggleFavorite(String productSku, {String businessId = '', String productName = '', String imageUrl = '', double price = 0}) async {
    List<FavoriteProduct> newFavorites;
    
    if (state.any((fp) => fp.sku == productSku)) {
      newFavorites = state.where((fp) => fp.sku != productSku).toList();
    } else {
      newFavorites = [...state, FavoriteProduct(
        sku: productSku,
        businessId: businessId,
        productName: productName,
        imageUrl: imageUrl,
        price: price,
      )];
    }
    
    state = newFavorites;
    
    if (_isLoggedIn) {
      await _saveToFirestore(newFavorites);
    }
    await _saveToLocal(newFavorites);
  }

  Future<void> _saveToLocal(List<FavoriteProduct> favorites) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = json.encode(favorites.map((fp) => fp.toMap()).toList());
    await prefs.setString(_localPrefsKey, jsonString);
    // Also maintain legacy key for backward compat
    await prefs.setStringList(_legacyPrefsKey, favorites.map((fp) => fp.sku).toList());
  }

  Future<void> _saveToFirestore(List<FavoriteProduct> favorites) async {
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(_userId)
          .set({
            'favoriteProductsDetailed': favorites.map((fp) => fp.toMap()).toList(),
            // Keep legacy field for backward compat
            'favoriteProducts': favorites.map((fp) => fp.sku).toList(),
          }, SetOptions(merge: true));
    } catch (e) {
      // Silently fail - local backup exists
    }
  }

  bool isFavorite(String productSku) {
    return state.any((fp) => fp.sku == productSku);
  }

  Future<void> refresh() async {
    await _loadFavorites();
  }
}
