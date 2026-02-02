
// ignore_for_file: non_constant_identifier_names

class MasterProductData {
  final String sku;
  final String name;
  final String description;
  final String category;
  final String unitType;
  final double defaultMinQuantity;
  final double defaultStepQuantity;
  final String? imagePath;
  final bool isHalal;
  final List<String> tags;

  const MasterProductData({
    required this.sku,
    required this.name,
    required this.description,
    required this.category,
    required this.unitType,
    required this.defaultMinQuantity,
    required this.defaultStepQuantity,
    this.imagePath,
    this.isHalal = true,
    this.tags = const [],
  });
}

// Synced with Admin Portal MASTER_CATALOG
final Map<String, MasterProductData> MASTER_PRODUCT_CATALOG = {
  // Dana Eti
  'MIRA-MEAT-DANA-001': const MasterProductData(
    sku: 'MIRA-MEAT-DANA-001',
    name: 'Dana Antrikot',
    description: 'Özel besi dana etinin en lezzetli kısmı',
    category: 'Dana Eti',
    unitType: 'kg',
    defaultMinQuantity: 0.5,
    defaultStepQuantity: 0.1,
    imagePath: 'assets/images/products/dana_antrikot.png',
    tags: ['premium'],
  ),
  'MIRA-MEAT-DANA-002': const MasterProductData(
    sku: 'MIRA-MEAT-DANA-002',
    name: 'Dana Bonfile',
    description: 'En yumuşak et, özel günler için',
    category: 'Dana Eti',
    unitType: 'kg',
    defaultMinQuantity: 0.5,
    defaultStepQuantity: 0.1,
    imagePath: 'assets/images/products/dana_bonfile.png',
    tags: ['premium'],
  ),
  'MIRA-MEAT-DANA-003': const MasterProductData(
    sku: 'MIRA-MEAT-DANA-003',
    name: 'Dana Kıyma',
    description: 'Az yağlı, günlük taze çekim',
    category: 'Dana Eti',
    unitType: 'kg',
    defaultMinQuantity: 0.5,
    defaultStepQuantity: 0.25,
    imagePath: 'assets/images/products/dana_kiyma.png',
  ),
  'MIRA-MEAT-DANA-004': const MasterProductData(
    sku: 'MIRA-MEAT-DANA-004',
    name: 'Dana Kuşbaşı',
    description: 'Sinirsiz dana but, güveç için',
    category: 'Dana Eti',
    unitType: 'kg',
    defaultMinQuantity: 0.5,
    defaultStepQuantity: 0.25,
    imagePath: 'assets/images/products/dana_kusbasi.png',
  ),
  'MIRA-MEAT-DANA-005': const MasterProductData(
    sku: 'MIRA-MEAT-DANA-005',
    name: 'Dana Kaburga',
    description: 'Fırın ve haşlama için ideal',
    category: 'Dana Eti',
    unitType: 'kg',
    defaultMinQuantity: 1.0,
    defaultStepQuantity: 0.5,
    imagePath: 'assets/images/products/dana_kaburga.png',
  ),
  
  // Kuzu Eti
  'MIRA-MEAT-KUZU-001': const MasterProductData(
    sku: 'MIRA-MEAT-KUZU-001',
    name: 'Kuzu Pirzola',
    description: 'Premium kuzu pirzola, ızgara için',
    category: 'Kuzu Eti',
    unitType: 'kg',
    defaultMinQuantity: 0.5,
    defaultStepQuantity: 0.1,
    imagePath: 'assets/images/products/kuzu_pirzola.png',
    tags: ['premium'],
  ),
  'MIRA-MEAT-KUZU-002': const MasterProductData(
    sku: 'MIRA-MEAT-KUZU-002',
    name: 'Kuzu But',
    description: 'Bütün kuzu but, fırın için',
    category: 'Kuzu Eti',
    unitType: 'kg',
    defaultMinQuantity: 1.0,
    defaultStepQuantity: 0.5,
    imagePath: 'assets/images/products/kuzu_but.png',
  ),
  'MIRA-MEAT-KUZU-003': const MasterProductData(
    sku: 'MIRA-MEAT-KUZU-003',
    name: 'Kuzu Kıyma',
    description: 'Taze çekilmiş kuzu kıyma',
    category: 'Kuzu Eti',
    unitType: 'kg',
    defaultMinQuantity: 0.5,
    defaultStepQuantity: 0.25,
    imagePath: 'assets/images/products/kuzu_kiyma.png',
  ),

  // Tavuk
  'MIRA-MEAT-TAVUK-001': const MasterProductData(
    sku: 'MIRA-MEAT-TAVUK-001',
    name: 'Tavuk Göğsü',
    description: 'Derisiz tavuk göğsü fileto',
    category: 'Tavuk',
    unitType: 'kg',
    defaultMinQuantity: 0.5,
    defaultStepQuantity: 0.25,
    imagePath: 'assets/images/products/tavuk_gogus.png',
  ),
  'MIRA-MEAT-TAVUK-002': const MasterProductData(
    sku: 'MIRA-MEAT-TAVUK-002',
    name: 'Bütün Tavuk',
    description: 'Temizlenmiş bütün tavuk',
    category: 'Tavuk',
    unitType: 'adet',
    defaultMinQuantity: 1,
    defaultStepQuantity: 1,
    imagePath: 'assets/images/products/tavuk_butun.png',
  ),

  // İşlenmiş
  'MIRA-MEAT-ISLEM-001': const MasterProductData(
    sku: 'MIRA-MEAT-ISLEM-001',
    name: 'Dana Sucuk',
    description: '%100 dana eti, helal sertifikalı',
    category: 'İşlenmiş',
    unitType: 'kg',
    defaultMinQuantity: 0.25,
    defaultStepQuantity: 0.25,
    imagePath: 'assets/images/products/sucuk.png',
  ),
  'MIRA-MEAT-ISLEM-002': const MasterProductData(
    sku: 'MIRA-MEAT-ISLEM-002',
    name: 'Pastırma',
    description: 'El yapımı Kayseri pastırması',
    category: 'İşlenmiş',
    unitType: 'kg',
    defaultMinQuantity: 0.25,
    defaultStepQuantity: 0.1,
    imagePath: 'assets/images/products/pastirma.png',
    tags: ['premium'],
  ),
  'MIRA-MEAT-ISLEM-003': const MasterProductData(
    sku: 'MIRA-MEAT-ISLEM-003',
    name: 'Kasap Köfte',
    description: 'Özel baharat karışımlı',
    category: 'İşlenmiş',
    unitType: 'kg',
    defaultMinQuantity: 0.5,
    defaultStepQuantity: 0.25,
    imagePath: 'assets/images/products/kofte_kasap.png',
  ),

  // Özel
  'MIRA-MEAT-OZEL-001': const MasterProductData(
    sku: 'MIRA-MEAT-OZEL-001',
    name: 'Kurban Paketi',
    description: 'Özel kurban kesim paketi',
    category: 'Özel',
    unitType: 'paket',
    defaultMinQuantity: 1,
    defaultStepQuantity: 1,
    imagePath: 'assets/images/products/kurban_paketi.png',
    tags: ['kurban'],
  ),
  'MIRA-MEAT-OZEL-002': const MasterProductData(
    sku: 'MIRA-MEAT-OZEL-002',
    name: 'Mangal Paketi',
    description: 'Pirzola, köfte içeren mangal seti',
    category: 'Özel',
    unitType: 'paket',
    defaultMinQuantity: 1,
    defaultStepQuantity: 1,
    imagePath: 'assets/images/products/mangal_paketi.png',
    tags: ['bbq'],
  ),
};
