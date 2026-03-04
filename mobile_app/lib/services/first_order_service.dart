import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// First Order Service — Wolt style first-N-orders automatic discount.
/// Applies decreasing discounts to the first 3 orders for new users.
class FirstOrderService {
  static final _db = FirebaseFirestore.instance;

  /// Discount tiers for new users
  static const List<double> _discountTiers = [5.0, 3.0, 2.0]; // 1st, 2nd, 3rd order

  /// Check if user qualifies for a first-order discount
  /// Returns the discount amount, or 0 if not eligible.
  static Future<FirstOrderDiscount?> checkDiscount(String userId) async {
    final userDoc = await _db.collection('users').doc(userId).get();
    final data = userDoc.data();
    if (data == null) return null;

    final orderCount = (data['completedOrderCount'] as int?) ?? 0;

    if (orderCount >= _discountTiers.length) return null; // No more discounts

    return FirstOrderDiscount(
      orderNumber: orderCount + 1,
      discountAmount: _discountTiers[orderCount],
      totalTiers: _discountTiers.length,
      remainingDiscounts: _discountTiers.length - orderCount,
    );
  }

  /// Increment order count after successful delivery
  static Future<void> incrementOrderCount(String userId) async {
    await _db.collection('users').doc(userId).set({
      'completedOrderCount': FieldValue.increment(1),
    }, SetOptions(merge: true));
  }

  /// Get current discount banner text for cart
  static Future<String?> getBannerText() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return null;

    final discount = await checkDiscount(user.uid);
    if (discount == null) return null;

    return '🎉 ${discount.orderNumber}. siparişine '
        '${discount.discountAmount.toStringAsFixed(0)}€ indirim!';
  }
}

class FirstOrderDiscount {
  final int orderNumber;
  final double discountAmount;
  final int totalTiers;
  final int remainingDiscounts;

  const FirstOrderDiscount({
    required this.orderNumber,
    required this.discountAmount,
    required this.totalTiers,
    required this.remainingDiscounts,
  });
}
