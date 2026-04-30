import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/kermes_order_model.dart';
import '../models/butcher_product.dart';
import '../widgets/kermes/payment_method_dialog.dart';

/// Provides a real-time stream of ACTIVE Kermes orders for the current user.
final activeKermesOrdersProvider = StreamProvider<List<KermesOrder>>((ref) {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) {
    return Stream.value([]);
  }

  return FirebaseFirestore.instance
      .collection('kermes_orders')
      .where('userId', isEqualTo: user.uid)
      .snapshots()
      .map((snapshot) {
        return snapshot.docs
            .map((doc) => KermesOrder.fromDocument(doc))
            .where((order) => order.status != KermesOrderStatus.cancelled && order.status != KermesOrderStatus.delivered)
            .toList();
      });
});
