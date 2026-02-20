import 'product_option.dart';

class ButcherProduct {
  final String butcherId;
  final String id;
  final String sku;
  final String masterId;
  final String name; // Fallback or TR value
  final dynamic nameData; // Raw localization map
  final String description; // Fallback or TR value
  final dynamic descriptionData; // Raw localization map
  final double price;
  final String category;
  final dynamic categoryData; // Raw localization map
  final String unitType; // 'kg' or 'ad'
  final String? imageUrl;
  final List<String> tags;
  final bool inStock;
  final double minQuantity;
  final double stepQuantity;
  final bool isCustom;
  final bool allowBackorder;
  final DateTime? expectedRestockDate;
  final List<OptionGroup> optionGroups;

  ButcherProduct({
    required this.butcherId,
    required this.id,
    required this.sku,
    required this.masterId,
    required this.name,
    this.nameData,
    required this.description,
    this.descriptionData,
    required this.category,
    this.categoryData,
    required this.price,
    required this.unitType,
    this.imageUrl,
    this.tags = const [],
    this.inStock = true,
    this.minQuantity = 0.5,
    this.stepQuantity = 0.5,
    this.isCustom = false,
    this.allowBackorder = false,
    this.expectedRestockDate,
    this.optionGroups = const [],
  });

  factory ButcherProduct.fromFirestore(Map<String, dynamic> data, String id, {required String butcherId, Map<String, dynamic>? masterData}) {
    // Helper to get value from either source
    T? getVal<T>(String key) {
      if (data.containsKey(key) && data[key] != null) return data[key] as T;
      if (masterData != null && masterData.containsKey(key)) return masterData[key] as T;
      return null;
    }

    // Special handling for Image URL: Check Firestore, then Master
    String? imgUrl = data['imageUrl'];
    if (imgUrl == null || imgUrl.isEmpty) {
      if (masterData != null && masterData['imageAsset'] != null) {
        imgUrl = masterData['imageAsset'];
      }
    }

    return ButcherProduct(
      butcherId: butcherId,
      id: id,
      sku: data['masterProductSku'] ?? id,
      masterId: data['masterId'] ?? '',
      name: _extractString(getVal<dynamic>('name')),
      nameData: getVal<dynamic>('name'),
      description: _extractString(getVal<dynamic>('description')),
      descriptionData: getVal<dynamic>('description'),
      category: _extractString(getVal<dynamic>('category'), fallback: 'Diğer'),
      categoryData: getVal<dynamic>('category'),
      price: (data['price'] ?? 0).toDouble(), // Price always from Butcher
      unitType: getVal<String>('unit') ?? 'adet', // Default to 'adet' not 'kg'
      imageUrl: imgUrl,
      tags: List<String>.from(data['tags'] ?? masterData?['tags'] ?? []),
      inStock: data['isAvailable'] ?? true,
      minQuantity: (getVal<String>('unit') == 'kg') ? 0.5 : 1.0, // Only kg uses 0.5
      stepQuantity: (getVal<String>('unit') == 'kg') ? 0.5 : 1.0, // Only kg uses 0.5
      isCustom: data['isCustom'] ?? false,
      allowBackorder: data['allowBackorder'] ?? false,
      expectedRestockDate: data['expectedRestockDate'] != null 
          ? DateTime.tryParse(data['expectedRestockDate']) 
          : null,
      optionGroups: (data['optionGroups'] as List<dynamic>?)
          ?.map((g) => OptionGroup.fromMap(g as Map<String, dynamic>))
          .toList() ?? [],
    );
  }

  static String _extractString(dynamic data, {String fallback = ''}) {
    if (data == null) return fallback;
    if (data is String) return data;
    if (data is Map) {
      if (data.containsKey('tr') && data['tr'] != null) return data['tr'].toString();
      if (data.values.isNotEmpty) return data.values.first.toString();
    }
    return fallback;
  }
}
