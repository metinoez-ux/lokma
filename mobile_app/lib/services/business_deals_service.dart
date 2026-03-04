import 'package:cloud_firestore/cloud_firestore.dart';

/// Business Deals Service — Lieferando-style merchant-managed promotions.
/// Businesses create their own deals via admin portal.
/// Platform cost = 0 (business absorbs the discount).
class BusinessDealsService {
  static final _db = FirebaseFirestore.instance;

  /// Get active deals for a specific business
  static Future<List<BusinessDeal>> getActiveDeals(String businessId) async {
    final now = DateTime.now();

    final query = await _db
        .collection('businesses')
        .doc(businessId)
        .collection('deals')
        .where('isActive', isEqualTo: true)
        .get();

    final deals = <BusinessDeal>[];
    for (final doc in query.docs) {
      final data = doc.data();

      // Check validity period
      final validFrom = (data['validFrom'] as Timestamp?)?.toDate();
      final validUntil = (data['validUntil'] as Timestamp?)?.toDate();

      if (validFrom != null && now.isBefore(validFrom)) continue;
      if (validUntil != null && now.isAfter(validUntil)) continue;

      deals.add(BusinessDeal.fromFirestore(doc.id, data));
    }

    return deals;
  }

  /// Check if a business has any active deals (for badge display)
  static Future<bool> hasActiveDeals(String businessId) async {
    final deals = await getActiveDeals(businessId);
    return deals.isNotEmpty;
  }

  /// Get the best deal text for a business card badge
  static Future<String?> getBestDealBadge(String businessId) async {
    final deals = await getActiveDeals(businessId);
    if (deals.isEmpty) return null;

    // Sort by discount value (best deal first)
    deals.sort((a, b) => b.discountValue.compareTo(a.discountValue));
    final best = deals.first;

    switch (best.dealType) {
      case DealType.percentOff:
        return '${best.discountValue.toStringAsFixed(0)}% indirim';
      case DealType.freeDelivery:
        return 'Ücretsiz Teslimat';
      case DealType.buyXGetY:
        return '${best.buyX} Al ${best.getY} Öde';
      case DealType.fixedOff:
        return '${best.discountValue.toStringAsFixed(0)}€ indirim';
    }
  }

  /// Apply a deal discount to an order amount
  static double applyDeal(BusinessDeal deal, double orderAmount, {int itemCount = 1}) {
    switch (deal.dealType) {
      case DealType.percentOff:
        var discount = orderAmount * (deal.discountValue / 100);
        if (deal.maxDiscount != null && discount > deal.maxDiscount!) {
          discount = deal.maxDiscount!;
        }
        return discount;
      case DealType.fixedOff:
        return deal.discountValue > orderAmount ? orderAmount : deal.discountValue;
      case DealType.freeDelivery:
        return 0; // Handled at checkout level
      case DealType.buyXGetY:
        return 0; // Handled at item level
    }
  }
}

enum DealType { percentOff, fixedOff, freeDelivery, buyXGetY }

class BusinessDeal {
  final String id;
  final String title;
  final String? description;
  final DealType dealType;
  final double discountValue;
  final double? maxDiscount;
  final double? minOrderAmount;
  final int? buyX;
  final int? getY;
  final DateTime? validFrom;
  final DateTime? validUntil;
  final bool isActive;

  const BusinessDeal({
    required this.id,
    required this.title,
    required this.dealType,
    required this.discountValue,
    this.description,
    this.maxDiscount,
    this.minOrderAmount,
    this.buyX,
    this.getY,
    this.validFrom,
    this.validUntil,
    this.isActive = true,
  });

  factory BusinessDeal.fromFirestore(String id, Map<String, dynamic> data) {
    return BusinessDeal(
      id: id,
      title: data['title'] as String? ?? '',
      description: data['description'] as String?,
      dealType: _parseDealType(data['dealType'] as String?),
      discountValue: (data['discountValue'] as num?)?.toDouble() ?? 0,
      maxDiscount: (data['maxDiscount'] as num?)?.toDouble(),
      minOrderAmount: (data['minOrderAmount'] as num?)?.toDouble(),
      buyX: data['buyX'] as int?,
      getY: data['getY'] as int?,
      validFrom: (data['validFrom'] as Timestamp?)?.toDate(),
      validUntil: (data['validUntil'] as Timestamp?)?.toDate(),
      isActive: data['isActive'] as bool? ?? true,
    );
  }

  static DealType _parseDealType(String? type) {
    switch (type) {
      case 'fixed_off':
        return DealType.fixedOff;
      case 'free_delivery':
        return DealType.freeDelivery;
      case 'buy_x_get_y':
        return DealType.buyXGetY;
      default:
        return DealType.percentOff;
    }
  }

  /// Human-readable badge text
  String get badgeText {
    switch (dealType) {
      case DealType.percentOff:
        return '%${discountValue.toStringAsFixed(0)} indirim';
      case DealType.fixedOff:
        return '${discountValue.toStringAsFixed(0)}€ indirim';
      case DealType.freeDelivery:
        return 'Ücretsiz Teslimat';
      case DealType.buyXGetY:
        return '${buyX ?? 2} Al ${getY ?? 1} Öde';
    }
  }
}
