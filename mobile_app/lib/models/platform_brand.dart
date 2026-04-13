import 'package:cloud_firestore/cloud_firestore.dart';

class PlatformBrand {
  final String id;
  final String name;
  final String iconUrl;
  final bool? isLegacyTuna;
  final bool? isLegacyToros;
  final bool isActive;

  PlatformBrand({
    required this.id,
    required this.name,
    required this.iconUrl,
    this.isLegacyTuna,
    this.isLegacyToros,
    required this.isActive,
  });

  factory PlatformBrand.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return PlatformBrand(
      id: doc.id,
      name: data['name'] ?? '',
      iconUrl: data['iconUrl'] ?? data['logoUrl'] ?? '',
      isLegacyTuna: data['isLegacyTuna'],
      isLegacyToros: data['isLegacyToros'],
      isActive: data['isActive'] ?? true,
    );
  }
}
