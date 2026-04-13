import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

/// Kermes özelliği modeli - Super Admin tarafından yönetilir
class KermesFeature {
  final String id;
  final String label;
  final String icon;
  final String? iconUrl;
  final String? storagePath;
  final String color;
  final bool isActive;
  final int sortOrder;

  const KermesFeature({
    required this.id,
    required this.label,
    required this.icon,
    this.iconUrl,
    this.storagePath,
    required this.color,
    this.isActive = true,
    this.sortOrder = 0,
  });

  factory KermesFeature.fromJson(Map<String, dynamic> json) {
    return KermesFeature(
      id: json['id'] ?? '',
      label: json['label'] ?? '',
      icon: json['icon'] ?? '📌',
      iconUrl: json['iconUrl'] as String?,
      storagePath: json['storagePath'] as String?,
      color: json['color'] ?? '#9333ea',
      isActive: json['isActive'] ?? true,
      sortOrder: json['sortOrder'] ?? 0,
    );
  }

  /// Renk string'ini Color nesnesine dönüştür
  Color get colorValue {
    try {
      final hex = color.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (e) {
      return const Color(0xFF9333EA); // Varsayılan mor
    }
  }
}

/// Kermes özellikleri servisi - Firestore'dan global ayarları çeker
class KermesFeatureService {
  static final KermesFeatureService _instance = KermesFeatureService._internal();
  static KermesFeatureService get instance => _instance;
  
  KermesFeatureService._internal();
  
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  List<KermesFeature>? _cachedFeatures;
  DateTime? _cacheTime;
  static const Duration _cacheExpiry = Duration(minutes: 5);
  
  /// Global Kermes özelliklerini Firestore'dan yükler
  /// Cache mekanizması ile gereksiz çağrıları önler
  Future<List<KermesFeature>> loadFeatures({bool forceRefresh = false}) async {
    // Cache kontrolü
    if (!forceRefresh && 
        _cachedFeatures != null && 
        _cacheTime != null &&
        DateTime.now().difference(_cacheTime!) < _cacheExpiry) {
      return _cachedFeatures!;
    }
    
    try {
      final docSnap = await _firestore
          .collection('settings')
          .doc('kermes_features')
          .get();
      
      if (docSnap.exists) {
        final data = docSnap.data();
        final featuresRaw = data?['features'] as List<dynamic>? ?? [];
        
        final features = featuresRaw
            .map((f) => KermesFeature.fromJson(f as Map<String, dynamic>))
            .where((f) => f.isActive) // Sadece aktif özellikler
            .toList()
            ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
        
        _cachedFeatures = features;
        _cacheTime = DateTime.now();
        
        return features;
      }
    } catch (e) {
      debugPrint('KermesFeatureService: Özellikler yüklenemedi - $e');
    }
    
    // Hata durumunda varsayılan özellikleri döndür
    return _defaultFeatures;
  }
  
  /// Belirli bir feature ID'si için özellik bilgisini getir
  Future<KermesFeature?> getFeature(String id) async {
    final features = await loadFeatures();
    try {
      return features.firstWhere((f) => f.id == id);
    } catch (e) {
      return null;
    }
  }
  
  /// Cache'i temizle (örn: ayarlar değiştiğinde)
  void clearCache() {
    _cachedFeatures = null;
    _cacheTime = null;
  }
  
  /// Varsayılan özellikler (Firestore erişilemezse)
  static const List<KermesFeature> _defaultFeatures = [
    KermesFeature(id: 'family_area', label: 'Aile Bölümü', icon: '👨‍👩‍👧‍👦', color: '#f97316', sortOrder: 1),
    KermesFeature(id: 'outdoor', label: 'Açık Alan', icon: '🌳', color: '#22c55e', sortOrder: 2),
    KermesFeature(id: 'indoor', label: 'Kapalı Alan', icon: '🏠', color: '#3b82f6', sortOrder: 3),
    KermesFeature(id: 'kids_area', label: 'Çocuk Alanı', icon: '🧒', color: '#ec4899', sortOrder: 4),
    KermesFeature(id: 'card_payment', label: 'Kart ile Ödeme', icon: '💳', color: '#8b5cf6', sortOrder: 5),
    KermesFeature(id: 'vegetarian', label: 'Vejetaryen', icon: '🥗', color: '#10b981', sortOrder: 6),
    KermesFeature(id: 'accessible', label: 'Engelli Erişimi', icon: '♿', color: '#06b6d4', sortOrder: 7),
    KermesFeature(id: 'halal', label: 'Helal Gıda', icon: '🍖', color: '#14b8a6', sortOrder: 8),
    KermesFeature(id: 'wifi', label: 'WiFi', icon: '📶', color: '#6366f1', sortOrder: 9),
    KermesFeature(id: 'live_music', label: 'Canlı Müzik', icon: '🎵', color: '#a855f7', sortOrder: 10),
    KermesFeature(id: 'prayer_room', label: 'Mescit', icon: '🕌', color: '#0ea5e9', sortOrder: 11),
    KermesFeature(id: 'parking', label: 'Otopark', icon: '🅿️', color: '#64748b', sortOrder: 12),
  ];
  
  /// Varsayılan özellik listesine dışarıdan erişim
  List<KermesFeature> get defaultFeatures => List.unmodifiable(_defaultFeatures);
  
  /// Static convenience method - kolayca aktif özellikleri getir
  static Future<List<KermesFeature>> getActiveFeatures({bool forceRefresh = false}) {
    return _instance.loadFeatures(forceRefresh: forceRefresh);
  }
}
