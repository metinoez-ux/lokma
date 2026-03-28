// Kermes Menu Sablonlari (Schablone/Templates)
//
// Butun Kermes etkinlikleri icin kullanilabilecek standart menu sablonlari.
// "Four Days - Fiyat Listesi 2025" referans alinarak AI ile kategorize edilmistir.
//
// Multi-step (combo) menuler OptionGroup ile tanimlanmistir:
//   - "Menu" olan urunler: Ana urun + Yan urun secimi + Icecek secimi
//   - Combo urunler: Ana urun + eklentiler
//
// i18n: Her kategori ve urun adi TR + DE + EN destekler.

import '../models/kermes_model.dart';
import '../models/product_option.dart';

// ============================================================
// i18n KATEGORI TANIMLARI
// ============================================================

const Map<String, dynamic> _catIzgara = {'tr': 'Izgara', 'de': 'Grill', 'en': 'Grill'};
const Map<String, dynamic> _catOzel = {'tr': 'Ozel', 'de': 'Spezial', 'en': 'Special'};
const Map<String, dynamic> _catTavuk = {'tr': 'Tavuk', 'de': 'Hahnchen', 'en': 'Chicken'};
const Map<String, dynamic> _catSnacks = {'tr': 'Patates & Snack', 'de': 'Pommes & Snacks', 'en': 'Fries & Snacks'};
const Map<String, dynamic> _catHamur = {'tr': 'Hamur Isleri', 'de': 'Teigwaren', 'en': 'Pastries'};
const Map<String, dynamic> _catTatli = {'tr': 'Tatlilar', 'de': 'Desserts', 'en': 'Desserts'};
const Map<String, dynamic> _catIcecek = {'tr': 'Icecekler', 'de': 'Getranke', 'en': 'Drinks'};

/// Sablon kategori sirasi (i18n key -> TR fallback)
const List<Map<String, dynamic>> kermesMenuCategoryOrder = [
  _catIzgara,
  _catOzel,
  _catTavuk,
  _catSnacks,
  _catHamur,
  _catTatli,
  _catIcecek,
];

/// Locale'e gore kategori adini cozumle
String resolveCategory(dynamic categoryData, {String locale = 'tr'}) {
  if (categoryData == null) return '';
  if (categoryData is String) return categoryData;
  if (categoryData is Map) {
    if (categoryData.containsKey(locale)) return categoryData[locale].toString();
    if (categoryData.containsKey('tr')) return categoryData['tr'].toString();
    if (categoryData.values.isNotEmpty) return categoryData.values.first.toString();
  }
  return '';
}


// ============================================================
// ORTAK OPTION GROUP SABLONLARI (Reusable)
// ============================================================

/// Standart yan urun secimi (Grill / Tavuk menuleri icin)
final OptionGroup kermesStandardSideGroup = OptionGroup(
  id: 'side_dish',
  name: 'Yan Urun Sec / Beilage wahlen',
  required: true,
  type: 'radio',
  minSelect: 1,
  maxSelect: 1,
  options: [
    const ProductOption(id: 'pommes', name: 'Pommes', priceModifier: 0),
    const ProductOption(id: 'pilav', name: 'Pirinc Pilavi / Reis', priceModifier: 0),
    const ProductOption(id: 'salata', name: 'Salata / Salat', priceModifier: 0),
    const ProductOption(id: 'bulgur', name: 'Bulgur Pilavi / Bulgur', priceModifier: 0),
  ],
);

/// Standart icecek secimi (Menu urunleri icin)
final OptionGroup kermesStandardDrinkGroup = OptionGroup(
  id: 'drink',
  name: 'Icecek Sec / Getrank wahlen',
  required: true,
  type: 'radio',
  minSelect: 1,
  maxSelect: 1,
  options: [
    const ProductOption(id: 'ayran', name: 'Ayran', priceModifier: 0),
    const ProductOption(id: 'uludag', name: 'Uludag', priceModifier: 0),
    const ProductOption(id: 'su', name: 'Su / Wasser', priceModifier: 0),
    const ProductOption(id: 'cay', name: 'Cay / Schwarzer Tee', priceModifier: -0.50),
  ],
);

/// Burger eklenti secimi
final OptionGroup kermesBurgerExtrasGroup = OptionGroup(
  id: 'burger_extras',
  name: 'Ekstra / Extras',
  required: false,
  type: 'checkbox',
  minSelect: 0,
  maxSelect: 3,
  options: [
    const ProductOption(id: 'cheese', name: 'Ekstra Peynir / Extra Kase', priceModifier: 1.00),
    const ProductOption(id: 'jalapeno', name: 'Jalapeno', priceModifier: 0.50),
    const ProductOption(id: 'bacon', name: 'Sucuk / Sucuk-Streifen', priceModifier: 1.50),
  ],
);

/// Dondurma cesidi secimi (Kunefe + Dondurma icin)
final OptionGroup kermesDondurmaFlavorGroup = OptionGroup(
  id: 'ice_cream_flavor',
  name: 'Dondurma Cesidi / Eissorte',
  required: true,
  type: 'radio',
  minSelect: 1,
  maxSelect: 1,
  options: [
    const ProductOption(id: 'vanilya', name: 'Vanilya / Vanille', priceModifier: 0),
    const ProductOption(id: 'kaymak', name: 'Kaymak / Sahne', priceModifier: 0),
    const ProductOption(id: 'cikolata', name: 'Cikolata / Schokolade', priceModifier: 0),
    const ProductOption(id: 'antep', name: 'Antep Fistigi / Pistazie', priceModifier: 0.50),
  ],
);

/// Kumpir icerigi secimi
final OptionGroup kermesKumpirToppingsGroup = OptionGroup(
  id: 'kumpir_toppings',
  name: 'Kumpir Icerigi / Kumpir-Zutaten',
  required: false,
  type: 'checkbox',
  minSelect: 0,
  maxSelect: 5,
  options: [
    const ProductOption(id: 'butter', name: 'Tereyagi / Butter', priceModifier: 0),
    const ProductOption(id: 'cheese', name: 'Kasar Peyniri / Kase', priceModifier: 0),
    const ProductOption(id: 'corn', name: 'Misir / Mais', priceModifier: 0),
    const ProductOption(id: 'olive', name: 'Zeytin / Oliven', priceModifier: 0),
    const ProductOption(id: 'sausage', name: 'Sosis / Wurst', priceModifier: 1.00),
    const ProductOption(id: 'pickle', name: 'Tursu / Gurke', priceModifier: 0),
  ],
);


// ============================================================
// FOUR DAYS STANDART KERMES MENU SABLONU
// ============================================================

/// "Four Days - Fiyat Listesi 2025" baz alinarak olusturulmus
/// butun Kermes etkinlikleri icin kullanilabilecek standart menu sablonu.
///
/// Kullanim:
/// ```dart
/// final myKermesEvent = KermesEvent(
///   ...
///   menu: fourDaysMenuTemplate,
/// );
/// ```
final List<KermesMenuItem> fourDaysMenuTemplate = [

  // ============================================================
  // KATEGORI 1: IZGARA (TR) / GRILL (DE) / GRILL (EN)
  // ============================================================

  // --- Tavuk Sis ---
  KermesMenuItem(
    name: 'Tavuk Sis Durum',
    secondaryName: 'Hahnchenspies in Teigrolle',
    price: 8.00,
    category: 'Izgara',
    categoryData: _catIzgara,
  ),
  KermesMenuItem(
    name: 'Tavuk Sis (1 adet)',
    secondaryName: 'Hahnchenspies (1 Stk.)',
    price: 4.00,
    category: 'Izgara',
    categoryData: _catIzgara,
  ),
  KermesMenuItem(
    name: 'Tavuk Sis Menu',
    secondaryName: 'Hahnchenspies-Teller',
    price: 9.50,
    category: 'Izgara',
    categoryData: _catIzgara,
    optionGroups: [kermesStandardSideGroup, kermesStandardDrinkGroup],
  ),

  // --- Adana ---
  KermesMenuItem(
    name: 'Adana Durum',
    secondaryName: 'Adana Kebap in Teigrolle',
    price: 8.00,
    category: 'Izgara',
    categoryData: _catIzgara,
  ),
  KermesMenuItem(
    name: 'Adana Sis (1 adet)',
    secondaryName: 'Adana Kebap (1x Hackspies)',
    price: 4.00,
    category: 'Izgara',
    categoryData: _catIzgara,
  ),
  KermesMenuItem(
    name: 'Adana Menu',
    secondaryName: 'Adana Kebap-Teller',
    price: 9.50,
    category: 'Izgara',
    categoryData: _catIzgara,
    optionGroups: [kermesStandardSideGroup, kermesStandardDrinkGroup],
  ),

  // --- Et Sis ---
  KermesMenuItem(
    name: 'Et Sis Durum',
    secondaryName: 'Grillspies in Teigrolle',
    price: 8.00,
    category: 'Izgara',
    categoryData: _catIzgara,
  ),
  KermesMenuItem(
    name: 'Et Sis (1 adet)',
    secondaryName: 'Grillspies (1 Stk.)',
    price: 4.00,
    category: 'Izgara',
    categoryData: _catIzgara,
  ),
  KermesMenuItem(
    name: 'Et Sis Menu',
    secondaryName: 'Grillspies-Teller',
    price: 9.50,
    category: 'Izgara',
    categoryData: _catIzgara,
    optionGroups: [kermesStandardSideGroup, kermesStandardDrinkGroup],
  ),


  // ============================================================
  // KATEGORI 2: OZEL (TR) / SPEZIAL (DE) / SPECIAL (EN)
  // ============================================================

  KermesMenuItem(
    name: 'Fried Chicken (Pommes ile)',
    secondaryName: 'Fried Chicken (mit Pommes)',
    price: 10.00,
    category: 'Ozel',
    categoryData: _catOzel,
  ),
  KermesMenuItem(
    name: 'Burger',
    secondaryName: 'Burger',
    price: 8.00,
    category: 'Ozel',
    categoryData: _catOzel,
    optionGroups: [kermesBurgerExtrasGroup],
  ),
  KermesMenuItem(
    name: 'Burger Menu',
    secondaryName: 'Burger Menu',
    price: 12.00,
    category: 'Ozel',
    categoryData: _catOzel,
    optionGroups: [kermesBurgerExtrasGroup, kermesStandardSideGroup, kermesStandardDrinkGroup],
  ),
  KermesMenuItem(
    name: 'Cag Kebabi (Garnitur+Icecek)',
    secondaryName: 'Cag Kebabi',
    price: 10.00,
    category: 'Ozel',
    categoryData: _catOzel,
    optionGroups: [kermesStandardSideGroup, kermesStandardDrinkGroup],
  ),


  // ============================================================
  // KATEGORI 3: TAVUK (TR) / HAHNCHEN (DE) / CHICKEN (EN)
  // ============================================================

  KermesMenuItem(
    name: 'Tavuk (Butun)',
    secondaryName: 'Hahnchen (1/1)',
    price: 14.00,
    category: 'Tavuk',
    categoryData: _catTavuk,
  ),
  KermesMenuItem(
    name: 'Tavuk (Yarim)',
    secondaryName: 'Hahnchen (1/2)',
    price: 8.50,
    category: 'Tavuk',
    categoryData: _catTavuk,
  ),
  KermesMenuItem(
    name: 'Tavuk Menu',
    secondaryName: 'Hahnchen-Teller',
    price: 13.50,
    category: 'Tavuk',
    categoryData: _catTavuk,
    optionGroups: [kermesStandardSideGroup, kermesStandardDrinkGroup],
  ),
  KermesMenuItem(
    name: 'Tavuk Budu Menu',
    secondaryName: 'Hahnchenkeule Menu',
    price: 9.50,
    category: 'Tavuk',
    categoryData: _catTavuk,
    optionGroups: [kermesStandardSideGroup, kermesStandardDrinkGroup],
  ),
  KermesMenuItem(
    name: 'Tavuk Budu (Sade)',
    secondaryName: 'Hahnchenkeule Stuck',
    price: 5.00,
    category: 'Tavuk',
    categoryData: _catTavuk,
  ),


  // ============================================================
  // KATEGORI 4: PATATES & SNACK (TR) / POMMES & SNACKS (DE/EN)
  // ============================================================

  KermesMenuItem(
    name: 'Pommes (Buyuk)',
    secondaryName: 'Pommes (gros)',
    price: 5.00,
    category: 'Patates & Snack',
    categoryData: _catSnacks,
  ),
  KermesMenuItem(
    name: 'Pommes (Kucuk)',
    secondaryName: 'Pommes (klein)',
    price: 3.00,
    category: 'Patates & Snack',
    categoryData: _catSnacks,
  ),
  KermesMenuItem(
    name: 'Cin Patates',
    secondaryName: 'Spiralkartoffel',
    price: 1.50,
    category: 'Patates & Snack',
    categoryData: _catSnacks,
  ),
  KermesMenuItem(
    name: 'Nuggets & Pommes',
    secondaryName: 'Nuggets mit Pommes',
    price: 6.50,
    category: 'Patates & Snack',
    categoryData: _catSnacks,
  ),
  KermesMenuItem(
    name: 'Kumpir',
    secondaryName: 'Kumpir',
    price: 8.00,
    category: 'Patates & Snack',
    categoryData: _catSnacks,
    optionGroups: [kermesKumpirToppingsGroup],
  ),


  // ============================================================
  // KATEGORI 5: HAMUR ISLERI (TR) / TEIGWAREN (DE) / PASTRIES (EN)
  // ============================================================

  KermesMenuItem(
    name: 'Lahmacun',
    secondaryName: 'Turkische Pizza',
    price: 2.00,
    category: 'Hamur Isleri',
    categoryData: _catHamur,
  ),
  KermesMenuItem(
    name: 'Gozleme',
    secondaryName: 'Gozleme',
    price: 3.00,
    category: 'Hamur Isleri',
    categoryData: _catHamur,
  ),
  KermesMenuItem(
    name: 'Borek',
    secondaryName: 'Borek',
    price: 2.50,
    category: 'Hamur Isleri',
    categoryData: _catHamur,
  ),


  // ============================================================
  // KATEGORI 6: TATLILAR (TR) / DESSERTS (DE/EN)
  // ============================================================

  KermesMenuItem(
    name: 'Pasta Cesitleri',
    secondaryName: 'Torten und Kuchen',
    price: 2.00,
    category: 'Tatlilar',
    categoryData: _catTatli,
  ),
  KermesMenuItem(
    name: 'Tatli Cesitleri',
    secondaryName: 'Susgeback',
    price: 4.00,
    category: 'Tatlilar',
    categoryData: _catTatli,
  ),
  KermesMenuItem(
    name: 'Halka Tatli',
    secondaryName: 'Susgeback (Ringform)',
    price: 1.50,
    category: 'Tatlilar',
    categoryData: _catTatli,
  ),
  KermesMenuItem(
    name: 'Kunefe',
    secondaryName: 'Kunefe (gebacken)',
    price: 5.00,
    category: 'Tatlilar',
    categoryData: _catTatli,
  ),
  KermesMenuItem(
    name: 'Kunefe + Dondurma',
    secondaryName: 'Kunefe mit Eis',
    price: 7.00,
    category: 'Tatlilar',
    categoryData: _catTatli,
    optionGroups: [kermesDondurmaFlavorGroup],
  ),
  KermesMenuItem(
    name: 'Dondurma (1 Top)',
    secondaryName: 'Eis (1 Kugel)',
    price: 1.50,
    category: 'Tatlilar',
    categoryData: _catTatli,
    optionGroups: [kermesDondurmaFlavorGroup],
  ),


  // ============================================================
  // KATEGORI 7: ICECEKLER (TR) / GETRANKE (DE) / DRINKS (EN)
  // ============================================================

  KermesMenuItem(
    name: 'Uludag',
    secondaryName: 'Uludag (+Pfand)',
    price: 2.00,
    category: 'Icecekler',
    categoryData: _catIcecek,
    hasPfand: true,
  ),
  KermesMenuItem(
    name: 'Ayran',
    secondaryName: 'Ayran',
    price: 1.50,
    category: 'Icecekler',
    categoryData: _catIcecek,
  ),
  KermesMenuItem(
    name: 'Su & Maden Suyu',
    secondaryName: 'Wasser',
    price: 1.50,
    category: 'Icecekler',
    categoryData: _catIcecek,
  ),
  KermesMenuItem(
    name: 'Cay (Kucuk)',
    secondaryName: 'Schwarzer Tee',
    price: 0.50,
    category: 'Icecekler',
    categoryData: _catIcecek,
  ),
];


// ============================================================
// SABLON YARDIMCI FONKSIYONLARI
// ============================================================

/// Sablondan derin kopya olustur (fiyat guncellemeleri icin)
List<KermesMenuItem> createMenuFromTemplate({
  List<KermesMenuItem> template = const [],
  double priceMultiplier = 1.0,
  List<String>? excludeCategories,
  List<String>? onlyCategories,
}) {
  final source = template.isEmpty ? fourDaysMenuTemplate : template;
  
  return source
    .where((item) {
      if (excludeCategories != null && excludeCategories.contains(item.category)) {
        return false;
      }
      if (onlyCategories != null && !onlyCategories.contains(item.category)) {
        return false;
      }
      return true;
    })
    .map((item) => KermesMenuItem(
      name: item.name,
      nameData: item.nameData,
      secondaryName: item.secondaryName,
      price: double.parse((item.price * priceMultiplier).toStringAsFixed(2)),
      description: item.description,
      descriptionData: item.descriptionData,
      detailedDescription: item.detailedDescription,
      detailedDescriptionData: item.detailedDescriptionData,
      imageUrl: item.imageUrl,
      imageUrls: item.imageUrls,
      category: item.category,
      categoryData: item.categoryData,
      allergens: item.allergens,
      ingredients: item.ingredients,
      hasPfand: item.hasPfand,
      isAvailable: item.isAvailable,
      optionGroups: item.optionGroups,
    ))
    .toList();
}

/// Kategorilere gore gruplanmis menu getir (locale-aware)
Map<String, List<KermesMenuItem>> getGroupedMenu(List<KermesMenuItem> menu, {String locale = 'tr'}) {
  final grouped = <String, List<KermesMenuItem>>{};
  for (final item in menu) {
    final cat = item.categoryData != null 
        ? resolveCategory(item.categoryData, locale: locale)
        : (item.category ?? 'Diger');
    grouped.putIfAbsent(cat, () => []);
    grouped[cat]!.add(item);
  }
  return grouped;
}
