import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:easy_localization/easy_localization.dart';

/// Coupon validation result
class CouponResult {
  final bool isValid;
  final String? errorMessage;
  final String? code;
  final String? discountType; // 'percentage', 'fixed', or 'free_delivery'
  final double? discountValue;
  final double? maxDiscount;
  final double? calculatedDiscount;
  final String? couponId;
  final String? couponType; // 'promo', 'referral', 'first_order', 'business_deal'

  CouponResult({
    required this.isValid,
    this.errorMessage,
    this.code,
    this.discountType,
    this.discountValue,
    this.maxDiscount,
    this.calculatedDiscount,
    this.couponId,
    this.couponType,
  });

  factory CouponResult.error(String message) => CouponResult(
        isValid: false,
        errorMessage: message,
      );
}

/// Coupon Service — validates and applies promo codes
class CouponService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Validate a coupon code against order details
  Future<CouponResult> validateCoupon({
    required String code,
    required double orderAmount,
    String? businessId,
    String? userId,
  }) async {
    final normalizedCode = code.trim().toUpperCase();

    if (normalizedCode.isEmpty) {
      return CouponResult.error('coupon.enter_code'.tr());
    }

    // Find coupon by code
    final query = await _db
        .collection('coupons')
        .where('code', isEqualTo: normalizedCode)
        .where('isActive', isEqualTo: true)
        .limit(1)
        .get();

    if (query.docs.isEmpty) {
      return CouponResult.error('coupon.invalid_code'.tr());
    }

    final doc = query.docs.first;
    final data = doc.data();

    // Check validity period
    final now = DateTime.now();
    final validFrom = (data['validFrom'] as Timestamp?)?.toDate();
    final validUntil = (data['validUntil'] as Timestamp?)?.toDate();

    if (validFrom != null && now.isBefore(validFrom)) {
      return CouponResult.error('coupon.not_yet_active'.tr());
    }

    if (validUntil != null && now.isAfter(validUntil)) {
      return CouponResult.error('coupon.expired'.tr());
    }

    // Check usage limit
    final usageLimit = data['usageLimit'] as int?;
    final usedCount = data['usedCount'] as int? ?? 0;
    if (usageLimit != null && usedCount >= usageLimit) {
      return CouponResult.error('coupon.usage_limit_reached'.tr());
    }

    // Check minimum order amount
    final minOrderAmount = (data['minOrderAmount'] as num?)?.toDouble() ?? 0;
    if (orderAmount < minOrderAmount) {
      return CouponResult.error(
          'coupon.min_order_required'.tr(namedArgs: {'amount': minOrderAmount.toStringAsFixed(2)}));
    }

    // Check business restriction
    final couponBusinessId = data['businessId'] as String?;
    if (couponBusinessId != null &&
        couponBusinessId.isNotEmpty &&
        businessId != null &&
        couponBusinessId != businessId) {
      return CouponResult.error('coupon.not_valid_for_business'.tr());
    }

    // Check per-user limit
    final perUserLimit = data['perUserLimit'] as int?;
    if (perUserLimit != null && userId != null) {
      final userUsages = await _db
          .collection('coupons')
          .doc(doc.id)
          .collection('usages')
          .where('userId', isEqualTo: userId)
          .get();
      if (userUsages.docs.length >= perUserLimit) {
        return CouponResult.error('coupon.already_used'.tr());
      }
    }

    // Read coupon type
    final couponType = data['couponType'] as String? ?? 'promo';

    // Calculate discount
    final discountType = data['discountType'] as String? ?? 'percentage';
    final discountValue = (data['discountValue'] as num?)?.toDouble() ?? 0;
    final maxDiscount = (data['maxDiscount'] as num?)?.toDouble();

    double calculatedDiscount;
    if (discountType == 'percentage') {
      calculatedDiscount = orderAmount * (discountValue / 100);
      if (maxDiscount != null && calculatedDiscount > maxDiscount) {
        calculatedDiscount = maxDiscount;
      }
    } else if (discountType == 'free_delivery') {
      // Free delivery — discount equals delivery fee (handled at checkout)
      calculatedDiscount = 0; // Will be applied at checkout as free delivery
    } else {
      // fixed
      calculatedDiscount = discountValue;
      if (calculatedDiscount > orderAmount) {
        calculatedDiscount = orderAmount;
      }
    }

    return CouponResult(
      isValid: true,
      code: normalizedCode,
      discountType: discountType,
      discountValue: discountValue,
      maxDiscount: maxDiscount,
      calculatedDiscount: calculatedDiscount,
      couponId: doc.id,
      couponType: couponType,
    );
  }

  /// Apply a coupon to an order (increment usage count)
  Future<void> applyCoupon({
    required String couponId,
    required String orderId,
    required String userId,
  }) async {
    await _db.collection('coupons').doc(couponId).update({
      'usedCount': FieldValue.increment(1),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    // Log usage
    await _db
        .collection('coupons')
        .doc(couponId)
        .collection('usages')
        .add({
      'orderId': orderId,
      'userId': userId,
      'usedAt': FieldValue.serverTimestamp(),
    });
  }
}
