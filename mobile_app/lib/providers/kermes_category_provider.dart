import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class KermesCategory {
  final String id;
  final String name;
  final int order;

  KermesCategory({
    required this.id,
    required this.name,
    required this.order,
  });

  factory KermesCategory.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return KermesCategory(
      id: doc.id,
      name: data['name'] ?? '',
      order: data['order'] ?? 999,
    );
  }
}

final kermesCategoryProvider = FutureProvider<List<KermesCategory>>((ref) async {
  try {
    final snapshot = await FirebaseFirestore.instance
        .collection('kermes_categories')
        .orderBy('order')
        .get();

    return snapshot.docs.map((doc) => KermesCategory.fromFirestore(doc)).toList();
  } catch (e) {
    print('Kermes kategorileri yuklenirken hata: $e');
    return [];
  }
});
