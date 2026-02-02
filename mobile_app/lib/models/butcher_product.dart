class ButcherProduct {
  final String butcherId;
  final String id;
  final String sku;
  final String masterId;
  final String name;
  final String description;
  final double price;
  final String category;
  final String unitType; // 'kg' or 'ad'
  final String? imageUrl;
  final List<String> tags;
  final bool inStock;
  final double minQuantity;
  final double stepQuantity;
  final bool isCustom;
  final bool allowBackorder;
  final DateTime? expectedRestockDate;

  ButcherProduct({
    required this.butcherId,
    required this.id,
    required this.sku,
    required this.masterId,
    required this.name,
    required this.description,
    required this.category,
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
      name: getVal<String>('name') ?? '',
      description: getVal<String>('description') ?? '',
      category: getVal<String>('category') ?? 'Diğer',
      price: (data['price'] ?? 0).toDouble(), // Price always from Butcher
      unitType: getVal<String>('unit') ?? 'kg',
      imageUrl: imgUrl,
      tags: List<String>.from(data['tags'] ?? masterData?['tags'] ?? []),
      inStock: data['isAvailable'] ?? true,
      minQuantity: (getVal<String>('unit') == 'ad') ? 1.0 : 0.5,
      stepQuantity: (getVal<String>('unit') == 'ad') ? 1.0 : 0.5,
      isCustom: data['isCustom'] ?? false,
      allowBackorder: data['allowBackorder'] ?? false,
      expectedRestockDate: data['expectedRestockDate'] != null 
          ? DateTime.tryParse(data['expectedRestockDate']) 
          : null,
    );
  }
}
