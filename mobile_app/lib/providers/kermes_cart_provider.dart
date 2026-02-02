import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/kermes_model.dart';

/// Kermes sepet öğesi
class KermesCartItem {
  final KermesMenuItem menuItem;
  final int quantity;
  final String eventId;
  final String eventName;

  KermesCartItem({
    required this.menuItem,
    required this.quantity,
    required this.eventId,
    required this.eventName,
  });

  double get totalPrice => menuItem.price * quantity;

  KermesCartItem copyWith({int? quantity}) {
    return KermesCartItem(
      menuItem: menuItem,
      quantity: quantity ?? this.quantity,
      eventId: eventId,
      eventName: eventName,
    );
  }

  /// JSON'a dönüştür (persistence için)
  Map<String, dynamic> toJson() {
    return {
      'menuItem': {
        'name': menuItem.name,
        'description': menuItem.description,
        'price': menuItem.price,
        'imageUrl': menuItem.imageUrl,
      },
      'quantity': quantity,
      'eventId': eventId,
      'eventName': eventName,
    };
  }

  /// JSON'dan oluştur
  factory KermesCartItem.fromJson(Map<String, dynamic> json) {
    final menuItemJson = json['menuItem'] as Map<String, dynamic>;
    return KermesCartItem(
      menuItem: KermesMenuItem(
        name: menuItemJson['name'] ?? '',
        description: menuItemJson['description'],
        price: (menuItemJson['price'] ?? 0.0).toDouble(),
        imageUrl: menuItemJson['imageUrl'],
      ),
      quantity: json['quantity'] ?? 1,
      eventId: json['eventId'] ?? '',
      eventName: json['eventName'] ?? '',
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

  /// Sepete ürün ekle
  /// Farklı kermes'ten ekleme yapılıyorsa false döner (uyarı gösterilmeli)
  /// Aynı kermes'ten ekleme yapılıyorsa true döner
  bool addToCart(KermesMenuItem menuItem, String eventId, String eventName) {
    // Farklı bir kermes'ten ekleme yapılıyorsa false döndür
    // UI'da kullanıcıya uyarı gösterilmeli
    if (state.eventId != null && state.eventId != eventId) {
      return false; // Ekleme yapılmadı, çakışma var
    }

    _addItemInternal(menuItem, eventId, eventName);
    _saveCartToStorage(); // Kalıcı kaydet
    return true; // Başarıyla eklendi
  }

  /// Sepeti temizle ve yeni kermes'ten ekle (kullanıcı onayladıktan sonra)
  void clearAndAddFromNewKermes(KermesMenuItem menuItem, String eventId, String eventName) {
    state = KermesCartState(
      eventId: eventId,
      eventName: eventName,
      items: [
        KermesCartItem(
          menuItem: menuItem,
          quantity: 1,
          eventId: eventId,
          eventName: eventName,
        ),
      ],
    );
    _saveCartToStorage(); // Kalıcı kaydet
  }

  /// Farklı bir kermes'ten mi ekleme yapılıyor kontrol et
  bool isFromDifferentKermes(String eventId) {
    return state.eventId != null && state.eventId != eventId;
  }

  /// Mevcut kermes bilgisi
  String? get currentKermesName => state.eventName;

  /// İç ekleme metoduName
  void _addItemInternal(KermesMenuItem menuItem, String eventId, String eventName) {
    // Aynı ürün var mı kontrol et (menuItem.name ile eşleştir)
    final existingIndex = state.items.indexWhere(
      (item) => item.menuItem.name == menuItem.name,
    );

    if (existingIndex >= 0) {
      // Miktarı artır
      final updatedItems = List<KermesCartItem>.from(state.items);
      final existingItem = updatedItems[existingIndex];
      updatedItems[existingIndex] = existingItem.copyWith(
        quantity: existingItem.quantity + 1,
      );
      state = KermesCartState(
        eventId: state.eventId ?? eventId,
        eventName: state.eventName ?? eventName,
        items: updatedItems,
      );
    } else {
      // Yeni ürün ekle
      state = KermesCartState(
        eventId: state.eventId ?? eventId,
        eventName: state.eventName ?? eventName,
        items: [
          ...state.items,
          KermesCartItem(
            menuItem: menuItem,
            quantity: 1,
            eventId: eventId,
            eventName: eventName,
          ),
        ],
      );
    }
  }

  /// Sepetten ürün çıkar (miktarı azalt)
  void removeFromCart(String menuItemName) {
    final existingIndex = state.items.indexWhere(
      (item) => item.menuItem.name == menuItemName,
    );

    if (existingIndex < 0) return;

    final existingItem = state.items[existingIndex];
    
    if (existingItem.quantity <= 1) {
      // Tamamen kaldır
      final newItems = state.items.where(
        (item) => item.menuItem.name != menuItemName,
      ).toList();
      
      state = KermesCartState(
        eventId: newItems.isEmpty ? null : state.eventId,
        eventName: newItems.isEmpty ? null : state.eventName,
        items: newItems,
      );
    } else {
      // Miktarı azalt
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
    _saveCartToStorage(); // Kalıcı kaydet
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

  /// Belirli bir ürünün miktarını al
  int getQuantity(String menuItemName) {
    final item = state.items.where(
      (item) => item.menuItem.name == menuItemName,
    ).firstOrNull;
    return item?.quantity ?? 0;
  }

  /// Sepeti temizle
  void clearCart() {
    state = KermesCartState();
    _saveCartToStorage(); // Kalıcı kaydet (boş olarak)
  }
}

/// Kermes sepet provider'ı
final kermesCartProvider = NotifierProvider<KermesCartNotifier, KermesCartState>(() {
  return KermesCartNotifier();
});
