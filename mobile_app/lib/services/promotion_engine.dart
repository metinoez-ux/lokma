import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../models/promotion_models.dart';

/// ─────────────────────────────────────────────────────────────────────────────
/// Promotion Engine — Merkezi sepet hesaplama motoru
/// Tüm 16 promosyon tipini destekler.
/// ─────────────────────────────────────────────────────────────────────────────

class PromotionResult {
  /// Instant discount applied to the cart total
  final double discount;

  /// Whether delivery should be free
  final bool freeDelivery;

  /// Cashback amount to be credited AFTER order completion
  final double cashbackAmount;

  /// List of applied promotions with details
  final List<AppliedPromotion> appliedPromotions;

  /// Human-readable summary text
  final String summaryText;

  const PromotionResult({
    this.discount = 0,
    this.freeDelivery = false,
    this.cashbackAmount = 0,
    this.appliedPromotions = const [],
    this.summaryText = '',
  });

  bool get hasAnyPromotion =>
      discount > 0 || freeDelivery || cashbackAmount > 0;

  Map<String, dynamic> toFirestoreMap() => {
        'promotionDiscount': discount,
        'freeDeliveryByPromotion': freeDelivery,
        'cashbackAmount': cashbackAmount,
        'appliedPromotions': appliedPromotions.map((p) => p.toMap()).toList(),
      };
}

class AppliedPromotion {
  final String promotionId;
  final String title;
  final PromotionType type;
  final double discountAmount;
  final String badgeText;

  const AppliedPromotion({
    required this.promotionId,
    required this.title,
    required this.type,
    required this.discountAmount,
    required this.badgeText,
  });

  Map<String, dynamic> toMap() => {
        'promotionId': promotionId,
        'title': title,
        'type': type.name,
        'discountAmount': discountAmount,
        'badgeText': badgeText,
      };
}

/// Simple cart item representation for promotion calculation
class CartItemInfo {
  final String productId;
  final String productName;
  final double unitPrice;
  final int quantity;
  final String? category;

  const CartItemInfo({
    required this.productId,
    required this.productName,
    required this.unitPrice,
    required this.quantity,
    this.category,
  });

  double get totalPrice => unitPrice * quantity;
}

class PromotionEngine {
  static final _db = FirebaseFirestore.instance;

  /// Fetch all active promotions for a business
  static Future<List<BusinessPromotion>> fetchActivePromotions(
      String businessId) async {
    try {
      final query = await _db
          .collection('businesses')
          .doc(businessId)
          .collection('promotions')
          .where('isActive', isEqualTo: true)
          .get();

      final promotions = <BusinessPromotion>[];
      for (final doc in query.docs) {
        final promo =
            BusinessPromotion.fromFirestore(doc.id, businessId, doc.data());
        if (promo.isCurrentlyValid) {
          promotions.add(promo);
        }
      }
      return promotions;
    } catch (e) {
      debugPrint('PromotionEngine: Error fetching promotions: $e');
      return [];
    }
  }

  /// Calculate total discount for the given cart items
  /// Note: perUserDailyLimit requires async Firestore check
  static Future<PromotionResult> calculateDiscount({
    required List<BusinessPromotion> promotions,
    required List<CartItemInfo> cartItems,
    required double orderSubtotal,
    required double deliveryFee,
    required String deliveryMethod, // 'delivery', 'pickup', 'dineIn'
    required String businessId,
    String? userId,
    bool isFirstOrder = false,
    String? userSegment, // 'vip', 'new', 'returning'
  }) async {
    if (promotions.isEmpty || cartItems.isEmpty) {
      return const PromotionResult();
    }

    // ─── Grup-A Best-Wins Guard ─────────────────────────────────────
    // Genel sepet indirimleri (percentOff, fixedOff, happyHour, flashSale,
    // segmentCampaign, firstOrderSurprise, pushPromo) birbirleriyle çakışır.
    // Sadece en yüksek indirim veren uygulanır.
    const groupATypes = {
      PromotionType.percentOff,
      PromotionType.fixedOff,
      PromotionType.happyHour,
      PromotionType.flashSale,
      PromotionType.segmentCampaign,
      PromotionType.firstOrderSurprise,
      PromotionType.pushPromo,
    };

    final groupAPromos = promotions.where((p) => groupATypes.contains(p.type)).toList();
    final nonGroupAPromos = promotions.where((p) => !groupATypes.contains(p.type)).toList();

    // Pre-calculate which Grup-A promo gives the highest discount
    BusinessPromotion? bestGroupAPromo;
    double bestGroupADiscount = 0;

    for (final promo in groupAPromos) {
      double estimated = 0;
      if (promo.type == PromotionType.percentOff ||
          promo.type == PromotionType.happyHour ||
          promo.type == PromotionType.flashSale) {
        estimated = orderSubtotal * (promo.value / 100);
      } else if (promo.type == PromotionType.fixedOff) {
        estimated = promo.value > orderSubtotal ? orderSubtotal : promo.value;
      } else {
        // segmentCampaign, firstOrderSurprise, pushPromo
        estimated = promo.valueType == 'percent'
            ? orderSubtotal * (promo.value / 100)
            : (promo.value > orderSubtotal ? orderSubtotal : promo.value);
      }
      if (estimated > bestGroupADiscount) {
        bestGroupADiscount = estimated;
        bestGroupAPromo = promo;
      }
    }

    // Merge: best Grup-A promo (if any) + all non-Grup-A promos
    final effectivePromos = <BusinessPromotion>[
      ...nonGroupAPromos,
      if (bestGroupAPromo != null) bestGroupAPromo,
    ];

    double totalDiscount = 0;
    bool freeDelivery = false;
    double cashbackAmount = 0;
    final applied = <AppliedPromotion>[];
    final summaryParts = <String>[];

    for (final promo in effectivePromos) {
      // Check delivery method eligibility
      if (!promo.validDeliveryMethods.contains(deliveryMethod) &&
          deliveryMethod != 'dineIn') {
        continue;
      }

      // Check min order amount
      if (promo.minOrderAmount != null &&
          orderSubtotal < promo.minOrderAmount!) {
        continue;
      }

      // Check new customers only
      if (promo.newCustomersOnly && !isFirstOrder) continue;

      // Check segment targeting
      if (promo.targetSegment != null &&
          promo.targetSegment!.isNotEmpty &&
          promo.targetSegment != userSegment) {
        continue;
      }

      // Per-user daily limit check
      if (promo.perUserDailyLimit != null && userId != null) {
        try {
          final today = DateTime.now();
          final todayKey = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
          final usageDoc = await _db
              .collection('businesses')
              .doc(businessId)
              .collection('promotions')
              .doc(promo.id)
              .collection('userDailyUsage')
              .doc('${userId}_$todayKey')
              .get();
          final usedToday = usageDoc.data()?['count'] as int? ?? 0;
          if (usedToday >= promo.perUserDailyLimit!) continue;
        } catch (_) {
          // On error, allow usage (fail-open to not block orders)
        }
      }

      // Calculate discount based on type
      double discount = 0;

      switch (promo.type) {
        // ─── YÜZDE İNDİRİM ────────────────────────────────────────────
        case PromotionType.percentOff:
        case PromotionType.happyHour:
        case PromotionType.flashSale:
          discount = orderSubtotal * (promo.value / 100);
          summaryParts.add('${promo.displayBadge}');
          break;

        // ─── SABİT İNDİRİM ────────────────────────────────────────────
        case PromotionType.fixedOff:
          discount = promo.value > orderSubtotal ? orderSubtotal : promo.value;
          summaryParts.add('${promo.value.toStringAsFixed(0)}€ İndirim');
          break;

        // ─── ÜCRETSİZ TESLİMAT ────────────────────────────────────────
        case PromotionType.freeDelivery:
          if (deliveryMethod == 'delivery') {
            freeDelivery = true;
            discount = deliveryFee; // Save the delivery fee
            summaryParts.add('Ücretsiz Teslimat');
          }
          break;

        // ─── BUY X GET Y (BOGO) ───────────────────────────────────────
        case PromotionType.buyXGetY:
          final buyX = promo.buyX ?? 2;
          final getY = promo.getY ?? 1;
          // Find items with enough quantity
          for (final item in cartItems) {
            if (item.quantity >= buyX) {
              // Free items = floor(quantity / buyX) * getY
              final freeCount =
                  (item.quantity ~/ buyX) * getY;
              // Discount = cheapest item price * free count
              discount += item.unitPrice * freeCount;
            }
          }
          if (discount > 0) {
            summaryParts.add('$buyX Al ${getY} Öde');
          }
          break;

        // ─── MİNİMUM SİPARİŞ İNDİRİMİ ────────────────────────────────
        case PromotionType.minOrderDiscount:
          if (promo.minOrderAmount != null &&
              orderSubtotal >= promo.minOrderAmount!) {
            discount = promo.valueType == 'percent'
                ? orderSubtotal * (promo.value / 100)
                : (promo.value > orderSubtotal ? orderSubtotal : promo.value);
            summaryParts.add(
                '${promo.minOrderAmount!.toStringAsFixed(0)}€+ → ${promo.value.toStringAsFixed(0)}${promo.valueType == 'percent' ? '%' : '€'} İndirim');
          }
          break;

        // ─── CASHBACK ─────────────────────────────────────────────────
        case PromotionType.cashback:
          final percent = promo.cashbackPercent ?? promo.value;
          cashbackAmount += orderSubtotal * (percent / 100);
          summaryParts.add(
              '💸 %${percent.toStringAsFixed(0)} Cashback');
          break;

        // ─── PUAN KARTI (STEMPELKARTE) ────────────────────────────────
        case PromotionType.loyaltyCard:
          // Loyalty card is tracked separately — no instant discount
          // Stamp progress is managed in user document
          summaryParts.add('🎖 Puan Kazanıldı');
          break;

        // ─── ÇARK ÇEVİR ─────────────────────────────────────────────
        case PromotionType.spinWheel:
          // Spin wheel result is determined at order completion
          // No instant discount — reward is applied post-order
          summaryParts.add('🎰 Sipariş sonrası çark hakkı');
          break;

        // ─── BUNDLE / COMBO PAKET ─────────────────────────────────────
        case PromotionType.bundleDeal:
          if (promo.bundleProductIds.isNotEmpty && promo.bundlePrice != null) {
            // Check if all bundle products are in cart
            final cartProductIds =
                cartItems.map((i) => i.productId).toSet();
            final allInCart = promo.bundleProductIds
                .every((pid) => cartProductIds.contains(pid));
            if (allInCart) {
              // Calculate regular total of bundle items
              double bundleRegularTotal = 0;
              for (final item in cartItems) {
                if (promo.bundleProductIds.contains(item.productId)) {
                  bundleRegularTotal += item.unitPrice;
                }
              }
              discount = bundleRegularTotal - promo.bundlePrice!;
              if (discount < 0) discount = 0;
              summaryParts.add(
                  '📦 Paket: ${promo.bundlePrice!.toStringAsFixed(2)}€');
            }
          }
          break;

        // ─── ÜRÜN BAZLI İNDİRİM ──────────────────────────────────────
        case PromotionType.productDiscount:
          if (promo.targetProductId != null) {
            for (final item in cartItems) {
              if (item.productId == promo.targetProductId) {
                discount += item.totalPrice * (promo.value / 100);
              }
            }
          } else if (promo.validCategories.isNotEmpty) {
            // Category-based discount
            for (final item in cartItems) {
              if (item.category != null &&
                  promo.validCategories.contains(item.category)) {
                discount += item.totalPrice * (promo.value / 100);
              }
            }
          }
          if (discount > 0) {
            summaryParts.add(
                '🏷️ %${promo.value.toStringAsFixed(0)} Ürün İndirimi');
          }
          break;

        // ─── SEPET BÜYÜTÜCÜ (X€ üstü → Y bedava) ─────────────────────
        case PromotionType.cartBooster:
          if (promo.boosterThreshold != null &&
              orderSubtotal >= promo.boosterThreshold!) {
            // Cart booster gives a reward (free item, extra discount, etc.)
            // If value > 0, it's a fixed discount for reaching the threshold
            discount = promo.value;
            summaryParts.add(
                '🛒 ${promo.boosterThreshold!.toStringAsFixed(0)}€+ → ${promo.value.toStringAsFixed(0)}€ Hediye');
          }
          break;

        // ─── SEGMENTLİ KAMPANYA ───────────────────────────────────────
        case PromotionType.segmentCampaign:
          // Already filtered by segment check above
          discount = promo.valueType == 'percent'
              ? orderSubtotal * (promo.value / 100)
              : (promo.value > orderSubtotal ? orderSubtotal : promo.value);
          summaryParts.add('🎯 ${promo.displayBadge}');
          break;

        // ─── İLK SİPARİŞ SÜRPRİZİ ───────────────────────────────────
        case PromotionType.firstOrderSurprise:
          if (isFirstOrder) {
            discount = promo.valueType == 'percent'
                ? orderSubtotal * (promo.value / 100)
                : (promo.value > orderSubtotal ? orderSubtotal : promo.value);
            summaryParts.add('💳 İlk Sipariş Sürprizi');
          }
          break;

        // ─── PUSH-ONLY PROMOSYON ──────────────────────────────────────
        case PromotionType.pushPromo:
          // Push promos are typically redeemed via a special code
          // For now, apply like a fixed/percent discount
          discount = promo.valueType == 'percent'
              ? orderSubtotal * (promo.value / 100)
              : (promo.value > orderSubtotal ? orderSubtotal : promo.value);
          summaryParts.add('📲 ${promo.displayBadge}');
          break;
      }

      if (discount > 0) {
        totalDiscount += discount;
        applied.add(AppliedPromotion(
          promotionId: promo.id,
          title: promo.title,
          type: promo.type,
          discountAmount: discount,
          badgeText: promo.displayBadge,
        ));
      }
    }

    // Ensure discount doesn't exceed subtotal
    if (totalDiscount > orderSubtotal) {
      totalDiscount = orderSubtotal;
    }

    return PromotionResult(
      discount: totalDiscount,
      freeDelivery: freeDelivery,
      cashbackAmount: cashbackAmount,
      appliedPromotions: applied,
      summaryText: summaryParts.join(' + '),
    );
  }

  /// Record promotion usage after successful order
  static Future<void> recordUsage({
    required String businessId,
    required String orderId,
    required String userId,
    required PromotionResult result,
  }) async {
    try {
      final batch = _db.batch();
      final now = DateTime.now();
      final todayKey = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

      for (final applied in result.appliedPromotions) {
        final promoRef = _db
            .collection('businesses')
            .doc(businessId)
            .collection('promotions')
            .doc(applied.promotionId);

        // Get current promo data to check if daily/weekly counters need reset
        final promoDoc = await promoRef.get();
        final promoData = promoDoc.data() ?? {};

        // ─── Daily counter logic ────────────────────────────────────────
        final lastDailyReset = (promoData['lastDailyReset'] as Timestamp?)?.toDate();
        final isSameDay = lastDailyReset != null &&
            lastDailyReset.year == now.year &&
            lastDailyReset.month == now.month &&
            lastDailyReset.day == now.day;

        // ─── Weekly counter logic ───────────────────────────────────────
        final lastWeeklyReset = (promoData['lastWeeklyReset'] as Timestamp?)?.toDate();
        final isSameWeek = lastWeeklyReset != null &&
            now.difference(lastWeeklyReset).inDays < 7;

        final Map<String, dynamic> updateData = {
          'redemptions': FieldValue.increment(1),
          'totalDiscountGiven': FieldValue.increment(applied.discountAmount),
          'updatedAt': FieldValue.serverTimestamp(),
        };

        // Reset daily counter if new day, otherwise increment
        if (isSameDay) {
          updateData['dailyRedemptions'] = FieldValue.increment(1);
        } else {
          updateData['dailyRedemptions'] = 1;
          updateData['lastDailyReset'] = FieldValue.serverTimestamp();
        }

        // Reset weekly counter if new week, otherwise increment
        if (isSameWeek) {
          updateData['weeklyRedemptions'] = FieldValue.increment(1);
        } else {
          updateData['weeklyRedemptions'] = 1;
          updateData['lastWeeklyReset'] = FieldValue.serverTimestamp();
        }

        batch.update(promoRef, updateData);

        // ─── Per-user daily usage tracking ──────────────────────────────
        final userDailyRef = promoRef
            .collection('userDailyUsage')
            .doc('${userId}_$todayKey');
        batch.set(userDailyRef, {
          'userId': userId,
          'date': todayKey,
          'count': FieldValue.increment(1),
          'lastUsed': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      }

      // Credit cashback to user wallet if applicable
      if (result.cashbackAmount > 0) {
        final userRef = _db.collection('users').doc(userId);
        batch.set(
            userRef,
            {'walletBalance': FieldValue.increment(result.cashbackAmount)},
            SetOptions(merge: true));

        // Record wallet transaction
        final txRef = userRef.collection('wallet_transactions').doc();
        batch.set(txRef, {
          'type': 'cashback',
          'amount': result.cashbackAmount,
          'orderId': orderId,
          'description': 'Cashback iade',
          'createdAt': FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (e) {
      debugPrint('PromotionEngine: Error recording usage: $e');
    }
  }
}
