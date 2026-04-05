import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import '../providers/cart_provider.dart';
import '../providers/kermes_cart_provider.dart';

class CartWarningUtils {
  /// Check if adding a normal Kasap/Restoran item conflicts with an existing cart
  static bool checkConflictForNormalCart(WidgetRef ref, String newBusinessId) {
    // 1. Is there an active Kermes cart?
    final kermesCart = ref.read(kermesCartProvider);
    if (kermesCart.isNotEmpty) return true;
    
    // 2. Is there an active Kasap/Restoran cart from a DIFFERENT business?
    final normalCart = ref.read(cartProvider);
    if (normalCart.isNotEmpty && normalCart.butcherId != null && normalCart.butcherId != newBusinessId) {
      return true;
    }
    
    return false;
  }

  /// Check if adding a Kermes item conflicts with an existing cart
  static bool checkConflictForKermesCart(WidgetRef ref, String newEventId) {
    // 1. Is there an active normal Kasap/Restoran cart?
    final normalCart = ref.read(cartProvider);
    if (normalCart.isNotEmpty) return true;
    
    // 2. Is there an active Kermes cart from a DIFFERENT Kermes?
    final kermesCart = ref.read(kermesCartProvider);
    if (kermesCart.isNotEmpty && kermesCart.eventId != null && kermesCart.eventId != newEventId) {
      return true;
    }
    
    return false;
  }

  /// Display a uniform warning dialog about clearing the cart
  static void showDifferentCartWarning({
    required BuildContext context,
    required WidgetRef ref,
    required String targetBusinessName,
    required VoidCallback onConfirmClearAndAdd,
  }) {
    HapticFeedback.heavyImpact();
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Theme.of(dialogContext).brightness == Brightness.dark
            ? const Color(0xFF1E1E1E)
            : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'marketplace.farkli_sepet'.tr(fallback: 'Farklı Sepet Uyarısı'),
                style: TextStyle(
                  color: Theme.of(dialogContext).brightness == Brightness.dark
                      ? Colors.white
                      : Colors.black87,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'marketplace.farkli_sepet_desc'.tr(fallback: 'Sepetinizde farklı bir işletmeye veya kermese ait ürünler bulunuyor. Yeni ürünleri eklemek için mevcut sepetinizin temizlenmesi gerekmektedir.'),
              style: TextStyle(
                  color: Theme.of(dialogContext).brightness == Brightness.dark
                      ? Colors.white70
                      : Colors.black87,
                  fontSize: 15),
            ),
            const SizedBox(height: 12),
            Text(
              'marketplace.onayliyor_musunuz'.tr(args: [targetBusinessName], fallback: '$targetBusinessName menüsünden ürün eklemek için sepetiniz temizlenecek. Onaylıyor musunuz?'),
              style: TextStyle(
                  color: Theme.of(dialogContext).brightness == Brightness.dark
                      ? Colors.white54
                      : Colors.black54,
                  fontSize: 14),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text('common.cancel'.tr(),
                style: const TextStyle(color: Colors.grey, fontSize: 15)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              
              // Clear both carts to guarantee mutual exclusivity
              ref.read(cartProvider.notifier).clearCart();
              ref.read(kermesCartProvider.notifier).clearCart();
              
              onConfirmClearAndAdd();
              
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text('marketplace.cart_cleared_and_added'.tr(args: [targetBusinessName])),
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  behavior: SnackBarBehavior.floating));
            },
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEA184A),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10))),
            child: Text('cart.change_cart'.tr(fallback: 'Sepeti Değiştir')),
          ),
        ],
      ),
    );
  }
}
