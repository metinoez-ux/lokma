import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/kermes_model.dart';
import '../../kermes/kermes_pos_screen.dart';

/// Wrapper tab to load KermesEvent from Firestore and feed it to KermesPOSScreen.
/// POS requires a full KermesEvent object (for menu data), so this wrapper
/// streams the event doc and renders the POS screen once loaded.
class StaffPosWrapperTab extends ConsumerWidget {
  final String kermesId;
  final String staffId;
  final String staffName;
  final List<String> allowedSections;

  const StaffPosWrapperTab({
    super.key,
    required this.kermesId,
    required this.staffId,
    required this.staffName,
    this.allowedSections = const [],
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(kermesId)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const CircularProgressIndicator(
                  color: Color(0xFFEA184A),
                ),
                const SizedBox(height: 16),
                Text(
                  'POS yukleniyor...',
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.grey,
                  ),
                ),
              ],
            ),
          );
        }

        if (!snapshot.hasData || !snapshot.data!.exists) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 48,
                  color: isDark ? Colors.white24 : Colors.grey.shade300,
                ),
                const SizedBox(height: 16),
                Text(
                  'Kermes verisi bulunamadi',
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.grey,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          );
        }

        final data = snapshot.data!.data() as Map<String, dynamic>;
        final event = _buildKermesEvent(kermesId, data);

        return KermesPOSScreen(
          event: event,
          staffId: staffId,
          staffName: staffName,
          allowedSections: allowedSections,
        );
      },
    );
  }

  /// Build a KermesEvent from Firestore doc data.
  /// Only populates fields needed for POS (menu, title, id, basic config).
  KermesEvent _buildKermesEvent(String id, Map<String, dynamic> data) {
    // Parse menu items
    final menuData = data['menu'] as List<dynamic>? ?? [];
    final menuItems = menuData
        .map((item) => KermesMenuItem.fromJson(item as Map<String, dynamic>))
        .toList();

    // Parse features
    final features = List<String>.from(data['features'] ?? []);

    return KermesEvent(
      id: id,
      city: data['city'] ?? '',
      title: data['title'] ?? data['name'] ?? 'Kermes',
      address: data['address'] ?? '',
      phoneNumber: data['phoneNumber'] ?? data['phone'] ?? '',
      startDate: _parseDate(data['startDate']),
      endDate: _parseDate(data['endDate']),
      latitude: (data['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (data['longitude'] as num?)?.toDouble() ?? 0.0,
      menu: menuItems,
      parking: const [],
      weatherForecast: const [],
      openingTime: data['openingTime'] ?? '10:00',
      closingTime: data['closingTime'] ?? '22:00',
      features: features,
      hasPfandSystem: data['hasPfandSystem'] ?? false,
      pfandAmount: (data['pfandAmount'] as num?)?.toDouble() ?? 0.25,
      showKdv: data['showKdv'] ?? false,
      kdvRate: (data['kdvRate'] as num?)?.toDouble() ?? 7.0,
      pricesIncludeKdv: data['pricesIncludeKdv'] ?? true,
      hasTakeaway: data['hasTakeaway'] ?? true,
      hasDineIn: data['hasDineIn'] ?? false,
      isMenuOnly: data['isMenuOnly'] ?? false,
      hasDelivery: data['hasDelivery'] ?? false,
    );
  }

  DateTime _parseDate(dynamic value) {
    if (value == null) return DateTime.now();
    if (value is Timestamp) return value.toDate();
    if (value is String) return DateTime.tryParse(value) ?? DateTime.now();
    return DateTime.now();
  }
}
