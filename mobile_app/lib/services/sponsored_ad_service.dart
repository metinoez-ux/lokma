import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter/foundation.dart';

/// Sponsored ad data model
class SponsoredAd {
  final String id;
  final String advertiserName;
  final String? advertiserLogo;
  final String bannerImageUrl;
  final String title;
  final String? subtitle;
  final double? productPrice;
  final List<String> productKeywords;
  final List<String>? targetProductIds;
  final List<String>? targetCategories;
  final double targetRadius;
  final GeoPoint? targetLocation;
  final List<String> targetBusinessTypes;
  final String pricingModel; // 'cpc', 'cpm', 'fixed_daily'
  final double bidAmount;
  final double dailyBudget;
  final double totalBudget;
  final double spentAmount;
  final DateTime startDate;
  final DateTime endDate;
  final bool isActive;
  final int impressions;
  final int clicks;
  final int conversions;
  final int priority;

  SponsoredAd({
    required this.id,
    required this.advertiserName,
    this.advertiserLogo,
    required this.bannerImageUrl,
    required this.title,
    this.subtitle,
    this.productPrice,
    required this.productKeywords,
    this.targetProductIds,
    this.targetCategories,
    required this.targetRadius,
    this.targetLocation,
    required this.targetBusinessTypes,
    required this.pricingModel,
    required this.bidAmount,
    required this.dailyBudget,
    required this.totalBudget,
    required this.spentAmount,
    required this.startDate,
    required this.endDate,
    required this.isActive,
    required this.impressions,
    required this.clicks,
    required this.conversions,
    required this.priority,
  });

  factory SponsoredAd.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return SponsoredAd(
      id: doc.id,
      advertiserName: data['advertiserName'] ?? '',
      advertiserLogo: data['advertiserLogo'],
      bannerImageUrl: data['bannerImageUrl'] ?? '',
      title: data['title'] ?? '',
      subtitle: data['subtitle'],
      productPrice: (data['productPrice'] as num?)?.toDouble(),
      productKeywords: List<String>.from(data['productKeywords'] ?? []),
      targetProductIds: data['targetProductIds'] != null
          ? List<String>.from(data['targetProductIds'])
          : null,
      targetCategories: data['targetCategories'] != null
          ? List<String>.from(data['targetCategories'])
          : null,
      targetRadius: (data['targetRadius'] as num?)?.toDouble() ?? 10.0,
      targetLocation: data['targetLocation'] as GeoPoint?,
      targetBusinessTypes: List<String>.from(data['targetBusinessTypes'] ?? ['market']),
      pricingModel: data['pricingModel'] ?? 'fixed_daily',
      bidAmount: (data['bidAmount'] as num?)?.toDouble() ?? 0.0,
      dailyBudget: (data['dailyBudget'] as num?)?.toDouble() ?? 0.0,
      totalBudget: (data['totalBudget'] as num?)?.toDouble() ?? 0.0,
      spentAmount: (data['spentAmount'] as num?)?.toDouble() ?? 0.0,
      startDate: (data['startDate'] as Timestamp?)?.toDate() ?? DateTime.now(),
      endDate: (data['endDate'] as Timestamp?)?.toDate() ?? DateTime.now(),
      isActive: data['isActive'] ?? false,
      impressions: data['impressions'] ?? 0,
      clicks: data['clicks'] ?? 0,
      conversions: data['conversions'] ?? 0,
      priority: data['priority'] ?? 0,
    );
  }

  /// Kampanya butcesi dolmus mu?
  bool get isBudgetExhausted => spentAmount >= totalBudget;

  /// Kampanya suresi gecmis mi?
  bool get isExpired => DateTime.now().isAfter(endDate);

  /// Kampanya gosterilebilir mi?
  bool get isEligible => isActive && !isBudgetExhausted && !isExpired;
}

/// Nearest market match result
class NearestMarketMatch {
  final String businessId;
  final String businessName;
  final String? productId;
  final String? productName;
  final double? price;
  final double distanceKm;
  final String? businessLogoUrl;

  NearestMarketMatch({
    required this.businessId,
    required this.businessName,
    this.productId,
    this.productName,
    this.price,
    required this.distanceKm,
    this.businessLogoUrl,
  });
}

/// Sponsored ad service -- Firestore queries + geospatial matching
class SponsoredAdService {
  static final SponsoredAdService _instance = SponsoredAdService._internal();
  factory SponsoredAdService() => _instance;
  SponsoredAdService._internal();

  final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Aktif sponsored reklamlari getir
  /// Market segmenti icin filtrelenmis, bid+priority'ye gore siralanmis
  Future<List<SponsoredAd>> getActiveSponsoredAds({
    double? userLat,
    double? userLng,
    int limit = 5,
  }) async {
    try {
      final now = Timestamp.now();
      final query = _db
          .collection('sponsoredAds')
          .where('isActive', isEqualTo: true)
          .where('startDate', isLessThanOrEqualTo: now)
          .where('endDate', isGreaterThanOrEqualTo: now)
          .orderBy('endDate')
          .orderBy('priority', descending: true)
          .limit(limit * 2); // Fetch extra for client-side filtering

      final snapshot = await query.get();

      final ads = snapshot.docs
          .map((doc) => SponsoredAd.fromFirestore(doc))
          .where((ad) => ad.isEligible)
          .where((ad) {
        // Geospatial filter: only show ads within targetRadius
        if (userLat != null && userLng != null && ad.targetLocation != null) {
          final distanceMeters = Geolocator.distanceBetween(
            userLat,
            userLng,
            ad.targetLocation!.latitude,
            ad.targetLocation!.longitude,
          );
          final distanceKm = distanceMeters / 1000;
          return distanceKm <= ad.targetRadius;
        }
        // No location targeting = global ad
        return true;
      }).toList();

      // Sort by bid amount (highest first), then by priority
      ads.sort((a, b) {
        final bidCompare = b.bidAmount.compareTo(a.bidAmount);
        if (bidCompare != 0) return bidCompare;
        return b.priority.compareTo(a.priority);
      });

      return ads.take(limit).toList();
    } catch (e) {
      debugPrint('SponsoredAdService: Error fetching ads: $e');
      return [];
    }
  }

  /// Impression kaydet
  Future<void> recordImpression(String adId, String userId) async {
    try {
      await _db.collection('sponsoredAdEvents').add({
        'adId': adId,
        'eventType': 'impression',
        'userId': userId,
        'timestamp': FieldValue.serverTimestamp(),
        'cost': 0, // Impression icin maliyet CPM modelinde hesaplanir
      });
      // Increment impression counter
      await _db.collection('sponsoredAds').doc(adId).update({
        'impressions': FieldValue.increment(1),
      });
    } catch (e) {
      debugPrint('SponsoredAdService: Error recording impression: $e');
    }
  }

  /// Click kaydet
  Future<void> recordClick(String adId, String userId) async {
    try {
      await _db.collection('sponsoredAdEvents').add({
        'adId': adId,
        'eventType': 'click',
        'userId': userId,
        'timestamp': FieldValue.serverTimestamp(),
        'cost': 0, // CPC modelde bid amount kadar maliyet
      });
      // Increment click counter
      await _db.collection('sponsoredAds').doc(adId).update({
        'clicks': FieldValue.increment(1),
      });
    } catch (e) {
      debugPrint('SponsoredAdService: Error recording click: $e');
    }
  }

  /// Conversion kaydet (sepete ekleme)
  Future<void> recordConversion(String adId, String userId, String businessId, {String? productId}) async {
    try {
      await _db.collection('sponsoredAdEvents').add({
        'adId': adId,
        'eventType': 'add_to_cart',
        'userId': userId,
        'businessId': businessId,
        'productId': productId,
        'timestamp': FieldValue.serverTimestamp(),
        'cost': 0,
      });
      await _db.collection('sponsoredAds').doc(adId).update({
        'conversions': FieldValue.increment(1),
      });
    } catch (e) {
      debugPrint('SponsoredAdService: Error recording conversion: $e');
    }
  }

  /// Reklamdaki urunu satan en yakin ve en ucuz marketi bul
  Future<NearestMarketMatch?> findNearestCheapestMarket({
    required SponsoredAd ad,
    required double userLat,
    required double userLng,
    double maxDistanceKm = 10.0,
  }) async {
    try {
      // 1. Market segmentindeki isletmeleri al
      final businessSnapshot = await _db
          .collection('businesses')
          .where('isActive', isEqualTo: true)
          .get();

      final marketBusinesses = businessSnapshot.docs.where((doc) {
        final data = doc.data();
        final type = (data['type'] as String? ?? '').toLowerCase();
        final types = (data['types'] as List<dynamic>?)
            ?.map((t) => t.toString().toLowerCase())
            .toSet() ?? {};

        // Only include businesses matching ad's target business types
        final allTypes = {type, ...types};
        return allTypes.intersection(ad.targetBusinessTypes.map((t) => t.toLowerCase()).toSet()).isNotEmpty;
      }).toList();

      // 2. Mesafe hesapla ve filtrele
      final matchCandidates = <_BusinessDistance>[];
      for (final doc in marketBusinesses) {
        final data = doc.data();
        double? lat, lng;

        if (data['lat'] is num) lat = (data['lat'] as num).toDouble();
        if (data['lng'] is num) lng = (data['lng'] as num).toDouble();

        if (lat == null || lng == null) {
          final address = data['address'] as Map<String, dynamic>?;
          if (address != null) {
            if (address['lat'] is num) lat = (address['lat'] as num).toDouble();
            if (address['lng'] is num) lng = (address['lng'] as num).toDouble();
          }
        }

        if (lat == null || lng == null) continue;

        final distanceMeters = Geolocator.distanceBetween(userLat, userLng, lat, lng);
        final distanceKm = distanceMeters / 1000;

        if (distanceKm <= maxDistanceKm) {
          matchCandidates.add(_BusinessDistance(
            businessId: doc.id,
            businessName: data['businessName'] ?? data['companyName'] ?? '',
            businessLogoUrl: data['logo'] ?? data['logoUrl'],
            distanceKm: distanceKm,
          ));
        }
      }

      if (matchCandidates.isEmpty) return null;

      // 3. Keyword match ile urun ara (en yakin marketten baslayarak)
      matchCandidates.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));

      for (final candidate in matchCandidates.take(5)) {
        // Urunu bu markette ara
        final productMatch = await _findProductInBusiness(
          businessId: candidate.businessId,
          keywords: ad.productKeywords,
          productIds: ad.targetProductIds,
        );

        if (productMatch != null) {
          return NearestMarketMatch(
            businessId: candidate.businessId,
            businessName: candidate.businessName,
            productId: productMatch['id'],
            productName: productMatch['name'],
            price: productMatch['price'],
            distanceKm: candidate.distanceKm,
            businessLogoUrl: candidate.businessLogoUrl,
          );
        }
      }

      // 4. Urun bulunamazsa en yakin marketi dondur (urun bilgisi olmadan)
      final nearest = matchCandidates.first;
      return NearestMarketMatch(
        businessId: nearest.businessId,
        businessName: nearest.businessName,
        distanceKm: nearest.distanceKm,
        businessLogoUrl: nearest.businessLogoUrl,
      );
    } catch (e) {
      debugPrint('SponsoredAdService: Error finding nearest market: $e');
      return null;
    }
  }

  /// Bir isletmede keyword/ID ile urun ara
  Future<Map<String, dynamic>?> _findProductInBusiness({
    required String businessId,
    required List<String> keywords,
    List<String>? productIds,
  }) async {
    try {
      // Spesifik product ID varsa once onu al
      if (productIds != null && productIds.isNotEmpty) {
        for (final pid in productIds) {
          final productDoc = await _db
              .collection('businesses')
              .doc(businessId)
              .collection('products')
              .doc(pid)
              .get();
          if (productDoc.exists) {
            final data = productDoc.data()!;
            return {
              'id': productDoc.id,
              'name': data['name'] ?? data['productName'] ?? '',
              'price': (data['price'] as num?)?.toDouble(),
            };
          }
        }
      }

      // Keyword ile ara
      if (keywords.isNotEmpty) {
        final productsSnapshot = await _db
            .collection('businesses')
            .doc(businessId)
            .collection('products')
            .limit(100)
            .get();

        for (final doc in productsSnapshot.docs) {
          final data = doc.data();
          final name = (data['name'] ?? data['productName'] ?? '').toString().toLowerCase();
          final desc = (data['description'] ?? '').toString().toLowerCase();
          final tags = (data['tags'] as List<dynamic>?)
              ?.map((t) => t.toString().toLowerCase())
              .toList() ?? [];

          for (final keyword in keywords) {
            final kw = keyword.toLowerCase();
            if (name.contains(kw) || desc.contains(kw) || tags.contains(kw)) {
              return {
                'id': doc.id,
                'name': data['name'] ?? data['productName'] ?? '',
                'price': (data['price'] as num?)?.toDouble(),
              };
            }
          }
        }
      }

      return null;
    } catch (e) {
      debugPrint('SponsoredAdService: Error finding product in business: $e');
      return null;
    }
  }
}

class _BusinessDistance {
  final String businessId;
  final String businessName;
  final String? businessLogoUrl;
  final double distanceKm;

  _BusinessDistance({
    required this.businessId,
    required this.businessName,
    this.businessLogoUrl,
    required this.distanceKm,
  });
}
