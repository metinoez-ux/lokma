import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/kermes_model.dart';
import '../models/product_option.dart';

/// Kermes sepet öğesi
class KermesCartItem {
  final KermesMenuItem menuItem;
  final int quantity;
  final String eventId;
  final String eventName;
  final List<SelectedOption> selectedOptions; // Multi-step combo secenekleri

  KermesCartItem({
    required this.menuItem,
    required this.quantity,
    required this.eventId,
    required this.eventName,
    this.selectedOptions = const [],
  });

  /// Toplam fiyat: urun fiyati + secilen opsiyonlarin fiyat farklari
  double get totalPrice {
    final optionModifier = selectedOptions.fold(0.0, (sum, o) => sum + o.priceModifier);
    return (menuItem.price + optionModifier) * quantity;
  }

  /// Benzersiz kimlik: isim + secilen opsiyonlar (ayni urunden farkli combo secenekleriyle birden fazla olabilir)
  String get uniqueKey {
    if (selectedOptions.isEmpty) return menuItem.name;
    final optionKeys = selectedOptions.map((o) => '${o.groupId}:${o.optionId}').toList()..sort();
    return '${menuItem.name}|${optionKeys.join(',')}';
  }

  KermesCartItem copyWith({int? quantity}) {
    return KermesCartItem(
      menuItem: menuItem,
      quantity: quantity ?? this.quantity,
      eventId: eventId,
      eventName: eventName,
      selectedOptions: selectedOptions,
    );
  }

  /// JSON'a donustur (persistence icin)
  Map<String, dynamic> toJson() {
    return {
      'menuItem': {
        'name': menuItem.name,
        'description': menuItem.description,
        'price': menuItem.price,
        'imageUrl': menuItem.imageUrl,
        'category': menuItem.category,
        'secondaryName': menuItem.secondaryName,
        'hasPfand': menuItem.hasPfand,
      },
      'quantity': quantity,
      'eventId': eventId,
      'eventName': eventName,
      'selectedOptions': selectedOptions.map((o) => o.toMap()).toList(),
    };
  }

  /// JSON'dan olustur
  factory KermesCartItem.fromJson(Map<String, dynamic> json) {
    final menuItemJson = json['menuItem'] as Map<String, dynamic>;
    return KermesCartItem(
      menuItem: KermesMenuItem(
        name: menuItemJson['name'] ?? '',
        description: menuItemJson['description'],
        price: (menuItemJson['price'] ?? 0.0).toDouble(),
        imageUrl: menuItemJson['imageUrl'],
        category: menuItemJson['category'],
        secondaryName: menuItemJson['secondaryName'],
        hasPfand: menuItemJson['hasPfand'] ?? false,
      ),
      quantity: json['quantity'] ?? 1,
      eventId: json['eventId'] ?? '',
      eventName: json['eventName'] ?? '',
      selectedOptions: (json['selectedOptions'] as List<dynamic>?)
          ?.map((o) => SelectedOption.fromMap(o as Map<String, dynamic>))
          .toList() ?? [],
    );
  }
}

/// Kermes sepet durumu
class KermesCartState {
  final String? eventId;
  final String? eventName;
  final List<KermesCartItem> items;

  KermesCartState({
    this.eventId,
    this.eventName,
    this.items = const [],
  });

  int get totalItems => items.fold(0, (sum, item) => sum + item.quantity);
  double get totalAmount => items.fold(0.0, (sum, item) => sum + item.totalPrice);
  bool get isEmpty => items.isEmpty;
  bool get isNotEmpty => items.isNotEmpty;

  /// JSON'a dönüştür
  Map<String, dynamic> toJson() {
    return {
      'eventId': eventId,
      'eventName': eventName,
      'items': items.map((item) => item.toJson()).toList(),
    };
  }

  /// JSON'dan oluştur
  factory KermesCartState.fromJson(Map<String, dynamic> json) {
    final itemsList = (json['items'] as List<dynamic>?)
        ?.map((item) => KermesCartItem.fromJson(item as Map<String, dynamic>))
        .toList() ?? [];
    
    return KermesCartState(
      eventId: json['eventId'],
      eventName: json['eventName'],
      items: itemsList,
    );
  }
}

/// SharedPreferences key
const _kermesCartKey = 'kermes_cart_data';

/// Kermes sepet notifier'ı - Kalıcı (Persistent)
class KermesCartNotifier extends Notifier<KermesCartState> {
  @override
  KermesCartState build() {
    // Uygulama başladığında sepeti yükle
    _loadCartFromStorage();
    return KermesCartState();
  }

  /// Sepeti storage'dan yükle
  Future<void> _loadCartFromStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartJson = prefs.getString(_kermesCartKey);
      if (cartJson != null) {
        final cartData = jsonDecode(cartJson) as Map<String, dynamic>;
        state = KermesCartState.fromJson(cartData);
      }
    } catch (e) {
      // Hata durumunda boş sepet ile devam et
      state = KermesCartState();
    }
  }

  /// Sepeti storage'a kaydet
  Future<void> _saveCartToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartJson = jsonEncode(state.toJson());
      await prefs.setString(_kermesCartKey, cartJson);
    } catch (e) {
      // Kaydetme hatası - sessizce devam et
    }
  }

  /// Sepete urun ekle
  /// Farkli kermes'ten ekleme yapiliyorsa false doner (uyari gosterilmeli)
  /// Ayni kermes'ten ekleme yapiliyorsa true doner
  bool addToCart(KermesMenuItem menuItem, String eventId, String eventName, {List<SelectedOption> selectedOptions = const [], int quantity = 1}) {
    // Farkli bir kermes'ten ekleme yapiliyorsa false dondur
    if (state.eventId != null && state.eventId != eventId) {
      return false;
    }

    _addItemInternal(menuItem, eventId, eventName, selectedOptions: selectedOptions, quantity: quantity);
    _saveCartToStorage();
    return true;
  }

  /// Sepeti temizle ve yeni kermes'ten ekle (kullanici onayladiktan sonra)
  void clearAndAddFromNewKermes(KermesMenuItem menuItem, String eventId, String eventName, {List<SelectedOption> selectedOptions = const [], int quantity = 1}) {
    state = KermesCartState(
      eventId: eventId,
      eventName: eventName,
      items: [
        KermesCartItem(
          menuItem: menuItem,
          quantity: quantity,
          eventId: eventId,
          eventName: eventName,
          selectedOptions: selectedOptions,
        ),
      ],
    );
    _saveCartToStorage();
  }

  /// Farklı bir kermes'ten mi ekleme yapılıyor kontrol et
  bool isFromDifferentKermes(String eventId) {
    return state.eventId != null && state.eventId != eventId;
  }

  /// Mevcut kermes bilgisi
  String? get currentKermesName => state.eventName;

  /// Ic ekleme metodu
  void _addItemInternal(KermesMenuItem menuItem, String eventId, String eventName, {List<SelectedOption> selectedOptions = const [], int quantity = 1}) {
    // Benzersiz key ile eslestir (combo secenekleri dahil)
    final newKey = _buildUniqueKey(menuItem.name, selectedOptions);
    final existingIndex = state.items.indexWhere(
      (item) => item.uniqueKey == newKey,
    );

    if (existingIndex >= 0) {
      // Miktari artir
      final updatedItems = List<KermesCartItem>.from(state.items);
      final existingItem = updatedItems[existingIndex];
      updatedItems[existingIndex] = existingItem.copyWith(
        quantity: existingItem.quantity + quantity,
      );
      state = KermesCartState(
        eventId: state.eventId ?? eventId,
        eventName: state.eventName ?? eventName,
        items: updatedItems,
      );
    } else {
      // Yeni urun ekle
      state = KermesCartState(
        eventId: state.eventId ?? eventId,
        eventName: state.eventName ?? eventName,
        items: [
          ...state.items,
          KermesCartItem(
            menuItem: menuItem,
            quantity: quantity,
            eventId: eventId,
            eventName: eventName,
            selectedOptions: selectedOptions,
          ),
        ],
      );
    }
  }

  /// UniqueKey hesapla (combo menu eslestirmesi icin)
  String _buildUniqueKey(String name, List<SelectedOption> options) {
    if (options.isEmpty) return name;
    final optionKeys = options.map((o) => '${o.groupId}:${o.optionId}').toList()..sort();
    return '$name|${optionKeys.join(',')}';
  }

  /// Sepetten urun cikar (miktari azalt)
  void removeFromCart(String menuItemName) {
    final existingIndex = state.items.indexWhere(
      (item) => item.menuItem.name == menuItemName,
    );

    if (existingIndex < 0) return;

    final existingItem = state.items[existingIndex];
    
    if (existingItem.quantity <= 1) {
      // Sadece bu index'teki urunu kaldir (ayni isimli diger variantlara dokunma)
      final newItems = List<KermesCartItem>.from(state.items);
      newItems.removeAt(existingIndex);
      
      state = KermesCartState(
        eventId: newItems.isEmpty ? null : state.eventId,
        eventName: newItems.isEmpty ? null : state.eventName,
        items: newItems,
      );
    } else {
      // Miktari azalt
      final updatedItems = List<KermesCartItem>.from(state.items);
      updatedItems[existingIndex] = existingItem.copyWith(
        quantity: existingItem.quantity - 1,
      );
      state = KermesCartState(
        eventId: state.eventId,
        eventName: state.eventName,
        items: updatedItems,
      );
    }
    _saveCartToStorage(); // Kalici kaydet
  }

  /// Ürün miktarını belirle
  void setQuantity(String menuItemName, int quantity) {
    if (quantity <= 0) {
      // Ürünü tamamen kaldır
      final newItems = state.items.where(
        (item) => item.menuItem.name != menuItemName,
      ).toList();
      
      state = KermesCartState(
        eventId: newItems.isEmpty ? null : state.eventId,
        eventName: newItems.isEmpty ? null : state.eventName,
        items: newItems,
      );
      _saveCartToStorage(); // Kalıcı kaydet
      return;
    }

    final existingIndex = state.items.indexWhere(
      (item) => item.menuItem.name == menuItemName,
    );

    if (existingIndex >= 0) {
      final updatedItems = List<KermesCartItem>.from(state.items);
      updatedItems[existingIndex] = state.items[existingIndex].copyWith(
        quantity: quantity,
      );
      state = KermesCartState(
        eventId: state.eventId,
        eventName: state.eventName,
        items: updatedItems,
      );
      _saveCartToStorage(); // Kalıcı kaydet
    }
  }

  /// Belirli bir ürünün toplam miktarını al (tüm kombinasyonlardaki miktarını topla)
  int getQuantity(String menuItemName) {
    return state.items
        .where((item) => item.menuItem.name == menuItemName)
        .fold(0, (sum, item) => sum + item.quantity);
  }

  /// Sepetten ürün çıkar (ID ile) - Lieferando cart uyumluluğu
  void removeItem(String itemId) {
    removeFromCart(itemId);
  }

  /// Sepete ürün ekle (KermesMenuItem ile) - Lieferando cart uyumluluğu
  void addItem(KermesMenuItem menuItem) {
    if (state.eventId != null && state.eventName != null) {
      _addItemInternal(menuItem, state.eventId!, state.eventName!);
      _saveCartToStorage();
    }
  }

  /// Sepetteki bir urunu yeni seceneklerle degistir (edit icin)
  void replaceCartItem(String oldUniqueKey, KermesMenuItem menuItem, List<SelectedOption> newOptions) {
    final existingIndex = state.items.indexWhere((item) => item.uniqueKey == oldUniqueKey);
    if (existingIndex < 0) return;

    final existingItem = state.items[existingIndex];
    final updatedItems = List<KermesCartItem>.from(state.items);
    updatedItems[existingIndex] = KermesCartItem(
      menuItem: menuItem,
      quantity: existingItem.quantity,
      eventId: existingItem.eventId,
      eventName: existingItem.eventName,
      selectedOptions: newOptions,
    );
    state = KermesCartState(
      eventId: state.eventId,
      eventName: state.eventName,
      items: updatedItems,
    );
    _saveCartToStorage();
  }

  /// Sepeti temizle
  void clearCart() {
    state = KermesCartState();
    _saveCartToStorage(); // Kalici kaydet (bos olarak)
  }
}

/// Kermes sepet provider'ı
final kermesCartProvider = NotifierProvider<KermesCartNotifier, KermesCartState>(() {
  return KermesCartNotifier();
});
