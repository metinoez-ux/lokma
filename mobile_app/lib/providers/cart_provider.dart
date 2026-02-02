import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/butcher_product.dart';

class CartItem {
  final ButcherProduct product;
  final double quantity;

  CartItem({required this.product, required this.quantity});

  double get totalPrice => product.price * quantity;
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
  bool get isNotEmpty => items.isNotEmpty; // Added explicit getter
}

class CartNotifier extends Notifier<CartState> {
  @override
  CartState build() {
    return CartState();
  }

  void addToCart(ButcherProduct product, double quantity, String currentButcherId, String currentButcherName) {
    if (quantity <= 0) return;

    // Check if adding from a different butcher
    if (state.butcherId != null && state.butcherId != currentButcherId) {
       // Ideally show a dialog to user before clearing, but for now we enforce single butcher cart
       // Or we can just throw error/return false and let UI handle it.
       // For this task, we assume the UI handles the check or we auto-reset. 
       // Let's AUTO-RESET for simplicity as consistent with "Fresh Cart".
       state = CartState(
         butcherId: currentButcherId,
         butcherName: currentButcherName,
         items: [CartItem(product: product, quantity: quantity)],
       );
       return;
    }

    // Check if item already exists
    final existingIndex = state.items.indexWhere((item) => item.product.sku == product.sku);

    if (existingIndex >= 0) {
      // Update quantity
      final updatedItems = List<CartItem>.from(state.items);
      final existingItem = updatedItems[existingIndex];
      updatedItems[existingIndex] = CartItem(
        product: product,
        quantity: existingItem.quantity + quantity,
      );
      state = CartState(
        items: updatedItems,
        butcherId: state.butcherId ?? currentButcherId,
        butcherName: state.butcherName ?? currentButcherName,
      );
    } else {
      // Add new item
      state = CartState(
        items: [...state.items, CartItem(product: product, quantity: quantity)],
        butcherId: state.butcherId ?? currentButcherId,
        butcherName: state.butcherName ?? currentButcherName,
      );
    }
  }

  void removeFromCart(String sku) {
    final newItems = state.items.where((item) => item.product.sku != sku).toList();
    state = CartState(
      items: newItems,
      butcherId: newItems.isEmpty ? null : state.butcherId,
      butcherName: newItems.isEmpty ? null : state.butcherName,
    );
  }

  void clearCart() {
    state = CartState(items: []);
  }

  void updateQuantity(String sku, double quantity) {
    if (quantity <= 0) {
      removeFromCart(sku);
      return;
    }

    final index = state.items.indexWhere((item) => item.product.sku == sku);
    if (index >= 0) {
       final updatedItems = List<CartItem>.from(state.items);
       updatedItems[index] = CartItem(product: updatedItems[index].product, quantity: quantity);
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
