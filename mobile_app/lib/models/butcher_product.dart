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
  final List<String> allergens;
  final List<String> additives;
  final bool outOfStock;
  final double? appSellingPrice;
  final double? inStorePrice;

  /// Effective price shown in the app (delivery + pickup)
  double get effectiveAppPrice => appSellingPrice ?? price;
  /// Effective in-store / ESL price
  double get effectiveInStorePrice => inStorePrice ?? price;

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
    this.allergens = const [],
    this.additives = const [],
    this.outOfStock = false,
    this.appSellingPrice,
    this.inStorePrice,
  });

  factory ButcherProduct.fromFirestore(Map<String, dynamic> data, String id, {required String butcherId, Map<String, dynamic>? masterData}) {
    // Helper to get value from either source
    T? getVal<T>(String key) {
      if (data.containsKey(key) && data[key] != null) return data[key] as T;
      if (masterData != null && masterData.containsKey(key)) return masterData[key] as T;
      return null;
    }

    // Special handling for Image URL: Check Firestore, then Master
    String? imgUrl = data['imageUrl'] ?? data['image'];
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
      price: (data['sellingPrice'] ?? data['price'] ?? masterData?['sellingPrice'] ?? masterData?['price'] ?? 0).toDouble(), // sellingPrice first (Admin Portal), then legacy price
      unitType: getVal<String>('unit') ?? 'adet', // Default to 'adet' not 'kg'
      imageUrl: imgUrl,
      tags: _parseList(data['tags'] ?? masterData?['tags']),
      inStock: data['isAvailable'] ?? true,
      minQuantity: (getVal<String>('unit') == 'kg') ? 0.5 : 1.0, // Only kg uses 0.5
      stepQuantity: (getVal<String>('unit') == 'kg') ? 0.5 : 1.0, // Only kg uses 0.5
      isCustom: data['isCustom'] ?? false,
      allowBackorder: data['allowBackorder'] ?? false,
      expectedRestockDate: data['expectedRestockDate'] != null 
          ? DateTime.tryParse(data['expectedRestockDate']) 
          : null,
      optionGroups: _parseOptionGroups(data['optionGroups']),
      allergens: _parseList(data['allergens'] ?? masterData?['allergens']),
      additives: _parseList(data['additives'] ?? masterData?['additives']),
      outOfStock: data['outOfStock'] ?? false,
      appSellingPrice: (data['appSellingPrice'] ?? masterData?['appSellingPrice']) != null
          ? (data['appSellingPrice'] ?? masterData?['appSellingPrice']).toDouble()
          : null,
      inStorePrice: (data['inStorePrice'] ?? masterData?['inStorePrice']) != null
          ? (data['inStorePrice'] ?? masterData?['inStorePrice']).toDouble()
          : null,
    );
  }

  static List<String> _parseList(dynamic value) {
    if (value == null) return [];
    if (value is Iterable) return value.map((e) => e.toString()).toList();
    if (value is Map) return value.values.map((e) => e.toString()).toList();
    return [];
  }

  static List<OptionGroup> _parseOptionGroups(dynamic value) {
    if (value == null) return [];
    if (value is Iterable) {
      return value.map((g) => OptionGroup.fromMap(g as Map<String, dynamic>)).toList();
    }
    if (value is Map) {
      return value.values.map((g) => OptionGroup.fromMap(g as Map<String, dynamic>)).toList();
    }
    return [];
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

  /// Serialize to a plain Map for JSON persistence (SharedPreferences)
  Map<String, dynamic> toMap() {
    return {
      'butcherId': butcherId,
      'id': id,
      'sku': sku,
      'masterId': masterId,
      'name': name,
      'nameData': nameData,
      'description': description,
      'descriptionData': descriptionData,
      'category': category,
      'categoryData': categoryData,
      'price': price,
      'unitType': unitType,
      'imageUrl': imageUrl,
      'tags': tags,
      'inStock': inStock,
      'minQuantity': minQuantity,
      'stepQuantity': stepQuantity,
      'isCustom': isCustom,
      'allowBackorder': allowBackorder,
      'expectedRestockDate': expectedRestockDate?.toIso8601String(),
      'optionGroups': optionGroups.map((g) => g.toMap()).toList(),
      'allergens': allergens,
      'additives': additives,
      'outOfStock': outOfStock,
      'appSellingPrice': appSellingPrice,
      'inStorePrice': inStorePrice,
    };
  }

  /// Deserialize from a plain Map (loaded from SharedPreferences)
  factory ButcherProduct.fromMap(Map<String, dynamic> map) {
    return ButcherProduct(
      butcherId: map['butcherId'] ?? '',
      id: map['id'] ?? '',
      sku: map['sku'] ?? map['id'] ?? '',
      masterId: map['masterId'] ?? '',
      name: _extractString(map['nameData'] ?? map['name']),
      nameData: map['nameData'],
      description: _extractString(map['descriptionData'] ?? map['description']),
      descriptionData: map['descriptionData'],
      category: _extractString(map['categoryData'] ?? map['category'], fallback: 'Diğer'),
      categoryData: map['categoryData'],
      price: (map['price'] ?? 0).toDouble(),
      unitType: map['unitType'] ?? 'adet',
      imageUrl: map['imageUrl'],
      tags: List<String>.from(map['tags'] ?? []),
      inStock: map['inStock'] ?? true,
      minQuantity: (map['minQuantity'] ?? 1.0).toDouble(),
      stepQuantity: (map['stepQuantity'] ?? 1.0).toDouble(),
      isCustom: map['isCustom'] ?? false,
      allowBackorder: map['allowBackorder'] ?? false,
      expectedRestockDate: map['expectedRestockDate'] != null
          ? DateTime.tryParse(map['expectedRestockDate'])
          : null,
      optionGroups: (map['optionGroups'] as List<dynamic>?)
          ?.map((g) => OptionGroup.fromMap(g as Map<String, dynamic>))
          .toList() ?? [],
      allergens: List<String>.from(map['allergens'] ?? []),
      additives: List<String>.from(map['additives'] ?? []),
      outOfStock: map['outOfStock'] ?? false,
      appSellingPrice: map['appSellingPrice'] != null
          ? (map['appSellingPrice']).toDouble()
          : null,
      inStorePrice: map['inStorePrice'] != null
          ? (map['inStorePrice']).toDouble()
          : null,
    );
  }
}

