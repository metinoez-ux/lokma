import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class KermesBadge {
  final String id;
  final String label;
  final String description;
  final String iconUrl;
  final String colorHex;
  final String textColorHex;
  final bool isActive;

  KermesBadge({
    required this.id,
    required this.label,
    required this.description,
    required this.iconUrl,
    required this.colorHex,
    required this.textColorHex,
    required this.isActive,
  });

  factory KermesBadge.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return KermesBadge(
      id: doc.id,
      label: data['name'] ?? data['label'] ?? '',
      description: data['description'] ?? '',
      iconUrl: data['iconUrl'] ?? '',
      colorHex: data['colorHex'] ?? '#EA184A',
      textColorHex: data['textColorHex'] ?? '#FFFFFF',
      isActive: data['isActive'] ?? true,
    );
  }
}

class KermesBadgeService {
  KermesBadgeService._();
  static final KermesBadgeService instance = KermesBadgeService._();

  Map<String, KermesBadge>? _cachedBadges;

  Future<Map<String, KermesBadge>> loadBadges() async {
    if (_cachedBadges != null) return _cachedBadges!;

    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('kermes_badges')
          .where('isActive', isEqualTo: true)
          .get();

      final badges = <String, KermesBadge>{};
      for (var doc in snapshot.docs) {
        final badge = KermesBadge.fromFirestore(doc);
        badges[badge.id] = badge;
      }
      
      _cachedBadges = badges;
      return _cachedBadges!;
    } catch (e) {
      debugPrint('Error loading kermes badges: $e');
      return {};
    }
  }
}
