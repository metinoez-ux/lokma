import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/platform_brand.dart';

final platformBrandsProvider = StreamProvider<List<PlatformBrand>>((ref) {
  return FirebaseFirestore.instance
      .collection('platform_brands')
      .where('isActive', isEqualTo: true)
      .snapshots()
      .handleError((error) {
        debugPrint('❌ [platformBrandsProvider] ERROR: $error');
        throw error;
      })
      .map((snapshot) {
    debugPrint('🔥 [platformBrandsProvider] Fetch success! Found ${snapshot.docs.length} active brands.');
    return snapshot.docs.map((doc) => PlatformBrand.fromFirestore(doc)).toList();
  });
});
