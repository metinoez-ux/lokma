import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/butcher_product.dart';
import '../models/product_option.dart';

// ─── Storage key ───────────────────────────────────────────────────────────
const _kCartKey = 'lokma_cart_v2';

class CartItem {
  final ButcherProduct product;
  final double quantity;
  final List<SelectedOption> selectedOptions;
  final String? note; // Per-item note (food-related)
  final String? recipientName; // "Kimin için?" — person this item is for
  final bool isFreeDrink; // 🥤 Gratis İçecek — platform promotion

  CartItem({
    required this.product,
    required this.quantity,
    this.selectedOptions = const [],
    this.note,
    this.recipientName,
    this.isFreeDrink = false,
  });

  /// Unique key: SKU + sorted option IDs
  String get uniqueKey {
    final prefix = isFreeDrink ? 'FREE_DRINK|' : '';
    if (selectedOptions.isEmpty) return '$prefix${product.sku}';
    final optionKeys = selectedOptions.map((o) => '${o.groupId}:${o.optionId}').toList()..sort();
    return '$prefix${product.sku}|${optionKeys.join(',')}';
  }

  double get optionsTotal =>
      selectedOptions.fold(0.0, (sum, o) => sum + o.priceModifier);

  double get unitPrice => product.price + optionsTotal;

  double get originalPrice => unitPrice * quantity;

  /// Effective price: 0.00 for free drinks
  double get totalPrice => isFreeDrink ? 0.0 : unitPrice * quantity;

  // ─── Serialization ────────────────────────────────────────────────────────

  Map<String, dynamic> toMap() {
    return {
      'product': product.toMap(),
      'quantity': quantity,
      'selectedOptions': selectedOptions.map((o) => o.toMap()).toList(),
      'note': note,
      'recipientName': recipientName,
      'isFreeDrink': isFreeDrink,
    };
  }

  factory CartItem.fromMap(Map<String, dynamic> map) {
    return CartItem(
      product: ButcherProduct.fromMap(map['product'] as Map<String, dynamic>),
      quantity: (map['quantity'] ?? 1).toDouble(),
      selectedOptions: (map['selectedOptions'] as List<dynamic>?)
          ?.map((o) => SelectedOption.fromMap(o as Map<String, dynamic>))
          .toList() ?? [],
      note: map['note'] as String?,
      recipientName: map['recipientName'] as String?,
      isFreeDrink: map['isFreeDrink'] ?? false,
    );
  }
}

class CartState {
  final String? butcherId;
  final String? butcherName;
  final List<CartItem> items;

  CartState({
    this.items = const [],
    this.butcherId,
    this.butcherName,
  });

  double get totalAmount => items.fold(0, (sum, item) => sum + item.totalPrice);
  bool get isEmpty => items.isEmpty;
  bool get isNotEmpty => items.isNotEmpty;

  /// 🥤 Free drink helpers
  bool get hasFreeDrink => items.any((item) => item.isFreeDrink);
  CartItem? get freeDrinkItem =>
      items.cast<CartItem?>().firstWhere((item) => item!.isFreeDrink, orElse: () => null);

  // ─── Serialization ────────────────────────────────────────────────────────

  Map<String, dynamic> toMap() {
    return {
      'butcherId': butcherId,
      'butcherName': butcherName,
      'items': items.map((i) => i.toMap()).toList(),
    };
  }

  factory CartState.fromMap(Map<String, dynamic> map) {
    return CartState(
      butcherId: map['butcherId'] as String?,
      butcherName: map['butcherName'] as String?,
      items: (map['items'] as List<dynamic>?)
          ?.map((i) => CartItem.fromMap(i as Map<String, dynamic>))
          .toList() ?? [],
    );
  }
}

class CartNotifier extends Notifier<CartState> {
  @override
  CartState build() {
    // Start with empty state — _loadFromDisk() is called immediately after
    _loadFromDisk();
    return CartState();
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  /// Restore cart from SharedPreferences on startup
  Future<void> _loadFromDisk() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCartKey);
      if (raw != null && raw.isNotEmpty) {
        final map = jsonDecode(raw) as Map<String, dynamic>;
        final loaded = CartState.fromMap(map);
        if (loaded.isNotEmpty) {
          state = loaded;
        }
      }
    } catch (e) {
      // Corrupt cache — ignore and start fresh
    }
  }

  /// Save current cart to SharedPreferences
  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (state.isEmpty) {
        await prefs.remove(_kCartKey);
      } else {
        await prefs.setString(_kCartKey, jsonEncode(state.toMap()));
      }
    } catch (_) {
      // persist failures are non-fatal
    }
  }

  // ─── Cart Mutations ───────────────────────────────────────────────────────

  void addToCart(
    ButcherProduct product,
    double quantity,
    String currentButcherId,
    String currentButcherName, {
    List<SelectedOption> selectedOptions = const [],
    String? note,
    String? recipientName,
  }) {
    if (quantity <= 0) return;

    // Different business -> clear and start fresh
    if (state.butcherId != null && state.butcherId != currentButcherId) {
      state = CartState(
        butcherId: currentButcherId,
        butcherName: currentButcherName,
        items: [CartItem(product: product, quantity: quantity, selectedOptions: selectedOptions, note: note, recipientName: recipientName)],
      );
      _persist();
      return;
    }

    final newItem = CartItem(product: product, quantity: quantity, selectedOptions: selectedOptions, note: note, recipientName: recipientName);
    final existingIndex = state.items.indexWhere((item) => item.uniqueKey == newItem.uniqueKey);

    if (existingIndex >= 0) {
      final updatedItems = List<CartItem>.from(state.items);
      final existingItem = updatedItems[existingIndex];
      updatedItems[existingIndex] = CartItem(
        product: product,
        quantity: existingItem.quantity + quantity,
        selectedOptions: selectedOptions,
        note: existingItem.note,
        recipientName: existingItem.recipientName,
      );
      state = CartState(
        items: updatedItems,
        butcherId: state.butcherId ?? currentButcherId,
        butcherName: state.butcherName ?? currentButcherName,
      );
    } else {
      state = CartState(
        items: [...state.items, newItem],
        butcherId: state.butcherId ?? currentButcherId,
        butcherName: state.butcherName ?? currentButcherName,
      );
    }
    _persist();
  }

  void removeFromCart(String uniqueKey) {
    final newItems = state.items.where((item) => item.uniqueKey != uniqueKey).toList();
    state = CartState(
      items: newItems,
      butcherId: newItems.isEmpty ? null : state.butcherId,
      butcherName: newItems.isEmpty ? null : state.butcherName,
    );
    _persist();
  }

  void clearCart() {
    state = CartState(items: []);
    _persist();
  }

  /// 🥤 Add a free drink (max 1 per order, replaces existing free drink)
  void addFreeDrinkItem(ButcherProduct product, String currentButcherId, String currentButcherName) {
    final itemsWithoutFreeDrink = state.items.where((item) => !item.isFreeDrink).toList();
    final freeDrinkItem = CartItem(
      product: product,
      quantity: 1,
      isFreeDrink: true,
    );
    state = CartState(
      items: [...itemsWithoutFreeDrink, freeDrinkItem],
      butcherId: state.butcherId ?? currentButcherId,
      butcherName: state.butcherName ?? currentButcherName,
    );
    _persist();
  }

  /// 🥤 Remove free drink from cart
  void removeFreeDrinkItem() {
    final newItems = state.items.where((item) => !item.isFreeDrink).toList();
    state = CartState(
      items: newItems,
      butcherId: newItems.isEmpty ? null : state.butcherId,
      butcherName: newItems.isEmpty ? null : state.butcherName,
    );
    _persist();
  }

  void updateQuantity(String uniqueKey, double quantity) {
    if (quantity <= 0) {
      removeFromCart(uniqueKey);
      return;
    }
    final index = state.items.indexWhere((item) => item.uniqueKey == uniqueKey);
    if (index >= 0) {
      final updatedItems = List<CartItem>.from(state.items);
      final existing = updatedItems[index];
      updatedItems[index] = CartItem(
        product: existing.product,
        quantity: quantity,
        selectedOptions: existing.selectedOptions,
        note: existing.note,
        recipientName: existing.recipientName,
        isFreeDrink: existing.isFreeDrink,
      );
      state = CartState(
        items: updatedItems,
        butcherId: state.butcherId,
        butcherName: state.butcherName,
      );
      _persist();
    }
  }

  void updateNote(String uniqueKey, String? note) {
    final index = state.items.indexWhere((item) => item.uniqueKey == uniqueKey);
    if (index >= 0) {
      final updatedItems = List<CartItem>.from(state.items);
      final existing = updatedItems[index];
      updatedItems[index] = CartItem(
        product: existing.product,
        quantity: existing.quantity,
        selectedOptions: existing.selectedOptions,
        note: (note != null && note.trim().isNotEmpty) ? note.trim() : null,
        recipientName: existing.recipientName,
        isFreeDrink: existing.isFreeDrink,
      );
      state = CartState(
        items: updatedItems,
        butcherId: state.butcherId,
        butcherName: state.butcherName,
      );
      _persist();
    }
  }

  void updateRecipientName(String uniqueKey, String? name) {
    final index = state.items.indexWhere((item) => item.uniqueKey == uniqueKey);
    if (index >= 0) {
      final updatedItems = List<CartItem>.from(state.items);
      final existing = updatedItems[index];
      updatedItems[index] = CartItem(
        product: existing.product,
        quantity: existing.quantity,
        selectedOptions: existing.selectedOptions,
        note: existing.note,
        recipientName: (name != null && name.trim().isNotEmpty) ? name.trim() : null,
        isFreeDrink: existing.isFreeDrink,
      );
      state = CartState(
        items: updatedItems,
        butcherId: state.butcherId,
        butcherName: state.butcherName,
      );
      _persist();
    }
  }
}

final cartProvider = NotifierProvider<CartNotifier, CartState>(() {
  return CartNotifier();
});
