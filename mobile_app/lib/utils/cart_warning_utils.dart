import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import '../providers/cart_provider.dart';
import '../providers/kermes_cart_provider.dart';
import '../providers/group_order_provider.dart';
import '../models/kermes_group_order_model.dart';

class CartWarningUtils {
  /// Check if adding a normal Kasap/Restoran item conflicts with an existing cart
  static bool checkConflictForNormalCart(WidgetRef ref, String newBusinessId) {
    // 0. Is there an active group order?
    final groupState = ref.read(groupOrderProvider);
    if (groupState.currentOrder != null &&
        groupState.currentOrder!.status == GroupOrderStatus.collecting) {
      return true;
    }

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
    // 0. Is there an active group order?
    final groupState = ref.read(groupOrderProvider);
    if (groupState.currentOrder != null &&
        groupState.currentOrder!.status == GroupOrderStatus.collecting) {
      return true;
    }

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

  /// Check if starting a group order conflicts with existing carts
  static bool checkConflictForGroupOrder(WidgetRef ref) {
    // Normal sepet dolu mu?
    final normalCart = ref.read(cartProvider);
    if (normalCart.isNotEmpty) return true;

    // Kermes sepeti dolu mu?
    final kermesCart = ref.read(kermesCartProvider);
    if (kermesCart.isNotEmpty) return true;

    return false;
  }

  /// Check if there is an active group order (collecting state)
  static bool hasActiveGroupOrder(WidgetRef ref) {
    final groupState = ref.read(groupOrderProvider);
    return groupState.currentOrder != null &&
        groupState.currentOrder!.status == GroupOrderStatus.collecting;
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
                'marketplace.farkli_sepet'.tr(),
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
              'marketplace.farkli_sepet_desc'.tr(),
              style: TextStyle(
                  color: Theme.of(dialogContext).brightness == Brightness.dark
                      ? Colors.white70
                      : Colors.black87,
                  fontSize: 15),
            ),
            const SizedBox(height: 12),
            Text(
              'marketplace.onayliyor_musunuz'.tr(args: [targetBusinessName]),
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
              
              // Clear both carts + group order to guarantee mutual exclusivity
              ref.read(cartProvider.notifier).clearCart();
              ref.read(kermesCartProvider.notifier).clearCart();
              ref.read(groupOrderProvider.notifier).clearOrder();
              
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
            child: Text('cart.change_cart'.tr()),
          ),
        ],
      ),
    );
  }
}
