import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/kermes_model.dart';
import '../../../models/product_option.dart';
import '../../kermes/kermes_pos_screen.dart';

/// Wrapper tab: kermes_events/{id}/products alt koleksiyonundan urunleri okur
/// (Eskiden bos olan 'menu' arrayini kullaniyordu)
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
    final db = FirebaseFirestore.instance;

    // Event bilgisi + urunler paralel stream
    return StreamBuilder<List<Object>>(
      stream: _combineStreams(db),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const CircularProgressIndicator(color: Color(0xFFEA184A)),
                const SizedBox(height: 16),
                Text(
                  'POS yukleniyor...',
                  style: TextStyle(color: isDark ? Colors.white54 : Colors.grey),
                ),
              ],
            ),
          );
        }

        if (snapshot.hasError || !snapshot.hasData) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 48,
                    color: isDark ? Colors.white24 : Colors.grey.shade300),
                const SizedBox(height: 16),
                Text(
                  'Yukleme hatasi',
                  style: TextStyle(color: isDark ? Colors.white54 : Colors.grey, fontSize: 16),
                ),
              ],
            ),
          );
        }

        final eventDoc = snapshot.data![0] as DocumentSnapshot;
        final productDocs = snapshot.data![1] as List<DocumentSnapshot>;

        if (!eventDoc.exists) {
          return Center(
            child: Text(
              'Kermes verisi bulunamadi',
              style: TextStyle(color: isDark ? Colors.white54 : Colors.grey),
            ),
          );
        }

        final data = eventDoc.data() as Map<String, dynamic>;
        final menuItems = productDocs
            .map((doc) => _parseMenuItem(doc))
            .where((item) => item != null)
            .cast<KermesMenuItem>()
            .toList();

        final event = _buildKermesEvent(kermesId, data, menuItems);

        return KermesPOSScreen(
          event: event,
          staffId: staffId,
          staffName: staffName,
          allowedSections: allowedSections,
        );
      },
    );
  }

  /// Event doc + products koleksiyonunu birlestiren stream
  /// Products subcollection degistiginde aninda yansir
  Stream<List<Object>> _combineStreams(FirebaseFirestore db) {
    final productsStream = db
        .collection('kermes_events')
        .doc(kermesId)
        .collection('products')
        .where('isAvailable', isEqualTo: true)
        .snapshots();

    // Products degistiginde event doc'u da taze cek
    return productsStream.asyncMap((productsSnap) async {
      final eventDoc = await db.collection('kermes_events').doc(kermesId).get();
      return <Object>[eventDoc, productsSnap.docs];
    });
  }

  /// Firestore products koleksiyonundaki bir belgeyi KermesMenuItem'a donustur
  KermesMenuItem? _parseMenuItem(DocumentSnapshot doc) {
    try {
      final d = doc.data() as Map<String, dynamic>;

      // Aktif mi? (isActive veya isAvailable kontrolu)
      final isActive = d['isActive'] as bool? ?? true;
      final isAvailable = d['isAvailable'] as bool? ?? true;
      if (!isActive || !isAvailable) return null;

      // Stok kontrolu
      if (d['outOfStock'] == true) return null;

      // isim: multilingual map veya string
      String name;
      final nameField = d['name'];
      if (nameField is Map) {
        name = (nameField['tr'] as String?)?.isNotEmpty == true
            ? nameField['tr'] as String
            : (nameField['de'] as String? ?? doc.id);
      } else {
        name = (nameField as String?) ?? doc.id;
      }

      // Fiyat: int veya double
      final priceRaw = d['sellingPrice'] ?? d['price'];
      final price = (priceRaw as num?)?.toDouble() ?? 0.0;

      // Kategori
      final category = d['category'] as String? ??
          ((d['categories'] as List?)?.isNotEmpty == true
              ? (d['categories'] as List).first as String
              : null);

      // Resim
      final imageUrl = d['imageUrl'] as String? ??
          ((d['imageUrls'] as List?)?.isNotEmpty == true
              ? (d['imageUrls'] as List).first as String
              : null);

      // prepZones - bu koleksiyonda yoksa bos birakilir
      final prepZones = (d['prepZones'] as List?)
              ?.map((z) => z.toString())
              .toList() ??
          [];

      // optionGroups parsing
      final List<OptionGroup> optionGroups = [];
      final ogData = d['optionGroups'];
      if (ogData is Iterable) {
        optionGroups.addAll(ogData.map((g) => OptionGroup.fromMap(g as Map<String, dynamic>)));
      } else if (ogData is Map) {
        optionGroups.addAll(ogData.values.map((g) => OptionGroup.fromMap(g as Map<String, dynamic>)));
      }

      return KermesMenuItem(
        name: name,
        price: price,
        category: category,
        imageUrl: imageUrl,
        prepZones: prepZones,
        isAvailable: true,
        optionGroups: optionGroups,
      );
    } catch (_) {
      return null;
    }
  }

  KermesEvent _buildKermesEvent(
      String id, Map<String, dynamic> data, List<KermesMenuItem> menuItems) {
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
