import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final productFavoritesProvider = NotifierProvider<ProductFavoritesNotifier, List<String>>(ProductFavoritesNotifier.new);

class ProductFavoritesNotifier extends Notifier<List<String>> {
  static const String _prefsKey = 'favorite_products';

  @override
  List<String> build() {
    _loadFavorites();
    return [];
  }

  Future<void> _loadFavorites() async {
    final prefs = await SharedPreferences.getInstance();
    final favorites = prefs.getStringList(_prefsKey) ?? [];
    state = favorites;
  }

  Future<void> toggleFavorite(String productSku) async {
    final prefs = await SharedPreferences.getInstance();
    if (state.contains(productSku)) {
      state = state.where((id) => id != productSku).toList();
    } else {
      state = [...state, productSku];
    }
    await prefs.setStringList(_prefsKey, state);
  }

  bool isFavorite(String productSku) {
    return state.contains(productSku);
  }
}
