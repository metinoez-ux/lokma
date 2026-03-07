import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/butcher_product.dart';
import '../models/product_option.dart';

class CartItem {
  final ButcherProduct product;
  final double quantity;
  final List<SelectedOption> selectedOptions;
  final String? note; // Per-item note (e.g. "Hasan Usta", "Yonca Hanım")
  final bool isFreeDrink; // 🥤 Gratis İçecek — platform promotion

  CartItem({
    required this.product,
    required this.quantity,
    this.selectedOptions = const [],
    this.note,
    this.isFreeDrink = false,
  });

  /// Unique key: SKU + sorted option IDs (same product, different options = different cart items)
  /// Free drink items get a special prefix to avoid merging with paid items
  String get uniqueKey {
    final prefix = isFreeDrink ? 'FREE_DRINK|' : '';
    if (selectedOptions.isEmpty) return '$prefix${product.sku}';
    final optionKeys = selectedOptions.map((o) => '${o.groupId}:${o.optionId}').toList()..sort();
    return '$prefix${product.sku}|${optionKeys.join(',')}';
  }

  double get optionsTotal =>
      selectedOptions.fold(0.0, (sum, o) => sum + o.priceModifier);

  double get unitPrice => product.price + optionsTotal;

  /// Original price (before free drink discount)
  double get originalPrice => unitPrice * quantity;

  /// Effective price: 0.00 for free drinks
  double get totalPrice => isFreeDrink ? 0.0 : unitPrice * quantity;
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
  CartItem? get freeDrinkItem => items.cast<CartItem?>().firstWhere((item) => item!.isFreeDrink, orElse: () => null);
}

class CartNotifier extends Notifier<CartState> {
  @override
  CartState build() {
    return CartState();
  }

  void addToCart(ButcherProduct product, double quantity, String currentButcherId, String currentButcherName, {List<SelectedOption> selectedOptions = const [], String? note}) {
    if (quantity <= 0) return;

    // Check if adding from a different butcher
    if (state.butcherId != null && state.butcherId != currentButcherId) {
       state = CartState(
         butcherId: currentButcherId,
         butcherName: currentButcherName,
         items: [CartItem(product: product, quantity: quantity, selectedOptions: selectedOptions, note: note)],
       );
       return;
    }

    // Build a temporary item to get its unique key
    final newItem = CartItem(product: product, quantity: quantity, selectedOptions: selectedOptions, note: note);

    // Check if same product + same options already exists
    final existingIndex = state.items.indexWhere((item) => item.uniqueKey == newItem.uniqueKey);

    if (existingIndex >= 0) {
      // Update quantity
      final updatedItems = List<CartItem>.from(state.items);
      final existingItem = updatedItems[existingIndex];
      updatedItems[existingIndex] = CartItem(
        product: product,
        quantity: existingItem.quantity + quantity,
        selectedOptions: selectedOptions,
        note: existingItem.note,
      );
      state = CartState(
        items: updatedItems,
        butcherId: state.butcherId ?? currentButcherId,
        butcherName: state.butcherName ?? currentButcherName,
      );
    } else {
      // Add new item
      state = CartState(
        items: [...state.items, newItem],
        butcherId: state.butcherId ?? currentButcherId,
        butcherName: state.butcherName ?? currentButcherName,
      );
    }
  }

  void removeFromCart(String uniqueKey) {
    final newItems = state.items.where((item) => item.uniqueKey != uniqueKey).toList();
    state = CartState(
      items: newItems,
      butcherId: newItems.isEmpty ? null : state.butcherId,
      butcherName: newItems.isEmpty ? null : state.butcherName,
    );
  }

  void clearCart() {
    state = CartState(items: []);
  }

  /// 🥤 Add a free drink to cart (max 1 per order, quantity locked at 1)
  void addFreeDrinkItem(ButcherProduct product, String currentButcherId, String currentButcherName) {
    // Already have a free drink? Replace it
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
  }

  /// 🥤 Remove the free drink from cart
  void removeFreeDrinkItem() {
    final newItems = state.items.where((item) => !item.isFreeDrink).toList();
    state = CartState(
      items: newItems,
      butcherId: newItems.isEmpty ? null : state.butcherId,
      butcherName: newItems.isEmpty ? null : state.butcherName,
    );
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
         isFreeDrink: existing.isFreeDrink,
       );
       state = CartState(
         items: updatedItems,
         butcherId: state.butcherId,
         butcherName: state.butcherName,
       );
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
        isFreeDrink: existing.isFreeDrink,
      );
      state = CartState(
        items: updatedItems,
        butcherId: state.butcherId,
        butcherName: state.butcherName,
      );
    }
  }
}

final cartProvider = NotifierProvider<CartNotifier, CartState>(() {
  return CartNotifier();
});
