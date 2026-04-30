import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'package:lokma_app/models/kermes_model.dart';
import '../../providers/kermes_cart_provider.dart';
import '../../providers/cart_provider.dart'; // Needed for CartWarningUtils
import '../../utils/currency_utils.dart';
import '../../utils/cart_warning_utils.dart';
import 'kermes_customization_sheet.dart';

const Color _lokmaPink = Color(0xFFEA184A);

/// Kermes product detail bottom sheet -- yemek segment ProductCustomizationSheet parity
void showKermesProductDetailSheet(
  BuildContext context, {
  required KermesMenuItem item,
  required int cartQuantity,
  required String eventId,
  required String eventName,
  required bool isMenuOnly,
  String? contactName,
  String? contactPhone,
  required VoidCallback onAdd,
  required VoidCallback onRemove,
}) {
  if (item.isComboMenu) {
    // Combo menu (multi-step) urunler icin *her zaman* doğrudan customization sheet
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (ctx) => KermesCustomizationSheet(
        item: item,
        eventId: eventId,
        eventName: eventName,
      ),
    );
    return;
  }

  // Zaten sepetteyse veya non-combo ise normal detay sheet goster
  HapticFeedback.lightImpact();
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _KermesProductSheet(
      item: item,
      cartQuantity: cartQuantity,
      eventId: eventId,
      eventName: eventName,
      isMenuOnly: isMenuOnly,
      contactName: contactName,
      contactPhone: contactPhone,
      onAdd: onAdd,
      onRemove: onRemove,
    ),
  );
}

class _KermesProductSheet extends ConsumerStatefulWidget {
  final KermesMenuItem item;
  final int cartQuantity;
  final String eventId;
  final String eventName;
  final bool isMenuOnly;
  final String? contactName;
  final String? contactPhone;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  const _KermesProductSheet({
    required this.item,
    required this.cartQuantity,
    required this.eventId,
    required this.eventName,
    required this.isMenuOnly,
    this.contactName,
    this.contactPhone,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  ConsumerState<_KermesProductSheet> createState() => _KermesProductSheetState();
}

class _KermesProductSheetState extends ConsumerState<_KermesProductSheet> {
  int _quantity = 1;
  final _noteController = TextEditingController();
  String? _recipientName;

  KermesMenuItem get item => widget.item;

  @override
  void initState() {
    super.initState();
    _quantity = widget.cartQuantity > 0 ? widget.cartQuantity : 1;
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  double get _effectivePrice => item.isDiscounted ? item.discountPrice! : item.price;
  double get _totalPrice => _effectivePrice * _quantity;

  String _buildNotePreview() {
    final hasRecipient = _recipientName?.trim().isNotEmpty ?? false;
    final hasNote = _noteController.text.trim().isNotEmpty;
    if (hasRecipient && hasNote) {
      return '${_recipientName!.trim()} · ${_noteController.text.trim()}';
    } else if (hasRecipient) {
      return _recipientName!.trim();
    } else if (hasNote) {
      return _noteController.text.trim();
    }
    return tr('marketplace.add_note_hint');
  }

  void _showNoteSheet(bool isDark) {
    final recipientController = TextEditingController(text: _recipientName ?? '');
    final noteSheetController = TextEditingController(text: _noteController.text);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom,
            ),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A28) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Drag handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.grey[600] : Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Title
                  Text(
                    'cart.your_note'.tr(),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Recipient field
                  Text(
                    'cart.note_recipient_label'.tr(),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'cart.note_recipient_hint_desc'.tr(),
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[400] : Colors.grey[500],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF5F0E8),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                        width: 1,
                      ),
                    ),
                    child: TextField(
                      controller: recipientController,
                      maxLength: 40,
                      maxLines: 1,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 15,
                      ),
                      onChanged: (_) => setSheetState(() {}),
                      decoration: InputDecoration(
                        hintText: 'cart.note_recipient_placeholder'.tr(),
                        hintStyle: TextStyle(
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                          fontSize: 14,
                        ),
                        prefixIcon: Icon(
                          Icons.person_outline,
                          color: isDark ? Colors.grey[500] : Colors.grey[400],
                          size: 20,
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Note field
                  Text(
                    'cart.note_food_label'.tr(),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'cart.note_allergy_disclaimer'.tr(),
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[400] : Colors.grey[500],
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      '${noteSheetController.text.length}/160',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.grey[500] : Colors.grey[400],
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    constraints: const BoxConstraints(minHeight: 80),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF5F0E8),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                        width: 1,
                      ),
                    ),
                    child: TextField(
                      controller: noteSheetController,
                      maxLength: 160,
                      maxLines: 3,
                      minLines: 2,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 15,
                      ),
                      onChanged: (_) => setSheetState(() {}),
                      decoration: InputDecoration(
                        hintText: 'cart.note_placeholder'.tr(),
                        hintStyle: TextStyle(
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                          fontSize: 14,
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.all(16),
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Action buttons
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => Navigator.pop(ctx),
                          child: Container(
                            height: 50,
                            alignment: Alignment.center,
                            child: Text(
                              'common.cancel'.tr(),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: isDark ? Colors.white70 : Colors.black54,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              _recipientName = recipientController.text.trim();
                              _noteController.text = noteSheetController.text.trim();
                            });
                            Navigator.pop(ctx);
                          },
                          child: Container(
                            height: 50,
                            decoration: BoxDecoration(
                              color: _lokmaPink,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              'common.save'.tr(),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showMenuOnlyDialog() {
    final phone = widget.contactPhone ?? '';
    final name = widget.contactName ?? 'Yetkili';
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Theme.of(dialogContext).brightness == Brightness.dark
            ? const Color(0xFF1E1E1E)
            : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.info_outline, color: const Color(0xFFE50D6B), size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Sadece Dijital Menü',
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
                'Bu Kermes henüz dijital online sipariş alma imkanı sunmuyor.',
                style: TextStyle(
                    color: Theme.of(dialogContext).brightness == Brightness.dark
                        ? Colors.white70
                        : Colors.black87,
                    fontSize: 15)),
            const SizedBox(height: 12),
            Text(
                'Sorularınız için Kermes Yetkilisine danışabilirsiniz:',
                style: TextStyle(
                    color: Theme.of(dialogContext).brightness == Brightness.dark
                        ? Colors.white54
                        : Colors.black54,
                    fontSize: 14)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(dialogContext).brightness == Brightness.dark
                    ? Colors.white.withOpacity(0.05)
                    : Colors.black.withOpacity(0.05),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                   Icon(Icons.person, size: 20, color: Theme.of(dialogContext).brightness == Brightness.dark ? Colors.white70 : Colors.black54),
                   const SizedBox(width: 8),
                   Expanded(
                     child: Text(
                       '$name\n$phone',
                       style: TextStyle(
                         fontWeight: FontWeight.w600,
                         color: Theme.of(dialogContext).brightness == Brightness.dark ? Colors.white : Colors.black87,
                         fontSize: 14,
                       ),
                     ),
                   )
                ],
              ),
            )
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext),
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE50D6B),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10))),
            child: Text('common.ok'.tr()),
          ),
        ],
      ),
    );
  }

  void _addToCartAndClose() {
    if (widget.isMenuOnly) {
       _showMenuOnlyDialog();
       return;
    }
    
    // Multi-step: show customization sheet for combo items
    if (item.isComboMenu) {
      // Capture parent navigator context before popping
      final parentNavigator = Navigator.of(context);
      final parentContext = parentNavigator.context;
      Navigator.pop(context); // Close product detail sheet first
      // Use Future.delayed to ensure previous sheet is fully dismissed
      Future.delayed(const Duration(milliseconds: 200), () {
        if (parentContext.mounted) {
          showModalBottomSheet(
            context: parentContext,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            useSafeArea: true,
            builder: (ctx) => KermesCustomizationSheet(
              item: item,
              eventId: widget.eventId,
              eventName: widget.eventName,
            ),
          );
        }
      });
      return;
    }

    if (CartWarningUtils.handleCartConflict(
      context: context,
      ref: ref,
      targetBusinessName: '${widget.eventName} Kermesi',
      targetId: widget.eventId,
      isKermes: true,
      onConfirmClearAndAdd: _executeAddToCartAndClose,
    )) {
      return;
    }
    _executeAddToCartAndClose();
  }

  void _executeAddToCartAndClose() {
    // Set quantity in cart
    final cartNotifier = ref.read(kermesCartProvider.notifier);
    
    // Remove existing if any, then add with correct quantity
    final existingQty = cartNotifier.getQuantity(item.name);
    if (existingQty > 0) {
      // Remove all existing
      for (int i = 0; i < existingQty; i++) {
        cartNotifier.removeFromCart(item.name);
      }
    }
    // Add with desired quantity
    for (int i = 0; i < _quantity; i++) {
      cartNotifier.addToCart(item, widget.eventId, widget.eventName);
    }
    
    Navigator.pop(context);
    HapticFeedback.heavyImpact();
  }

  Widget _qtyButton({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        child: Icon(icon, color: color, size: 22),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF1A1A1A) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white54 : Colors.black45;
    final divider = isDark ? Colors.white12 : Colors.grey[200]!;
    final images = item.allImages;
    final hasImage = images.isNotEmpty;
    final displayImageUrl = hasImage ? images.first : null;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? Colors.white24 : Colors.black12,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Scrollable Content
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(
                left: 16, right: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom > 0 ? 8 : 0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),

                  // Product Image (full width, 180px)
                  if (hasImage)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: SizedBox(
                        width: double.infinity,
                        height: 180,
                        child: LokmaNetworkImage(
                          imageUrl: displayImageUrl!,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => Container(
                            color: _lokmaPink.withOpacity(0.1),
                            child: const Center(
                              child: Icon(Icons.restaurant, size: 48, color: _lokmaPink),
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (hasImage) const SizedBox(height: 14),

                  // Product Name
                  Text(
                    item.name,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: textPrimary,
                    ),
                  ),
                  if (item.secondaryName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.secondaryName!,
                      style: TextStyle(
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: textSecondary,
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),

                  // Price (with discount support)
                  if (item.isDiscounted) ...[
                    Row(
                      children: [
                        Text(
                          '${CurrencyUtils.getCurrencySymbol()}${item.price.toStringAsFixed(2)}',
                          style: TextStyle(
                            fontSize: 14,
                            color: textSecondary,
                            fontWeight: FontWeight.w500,
                            decoration: TextDecoration.lineThrough,
                            decorationColor: textSecondary,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${CurrencyUtils.getCurrencySymbol()}${item.discountPrice!.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 18,
                            color: Colors.red,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ] else
                    Text(
                      'ab ${CurrencyUtils.getCurrencySymbol()}${item.price.toStringAsFixed(2)}',
                      style: TextStyle(
                        fontSize: 17,
                        color: textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),

                  // Description
                  if (item.description != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      item.detailedDescription ?? item.description!,
                      style: TextStyle(
                        fontSize: 14,
                        color: textSecondary,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
                      ),
                    ),
                  ],

                  // Allergens
                  if (item.allergens.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Divider(color: divider, height: 1),
                    const SizedBox(height: 12),
                    Text(
                      'Allergenhinweise',
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? Colors.white70 : const Color(0xFF3A3A3C),
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                        decorationColor: isDark ? Colors.white70 : const Color(0xFF3A3A3C),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: item.allergens.map((allergen) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.amber.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.amber.withOpacity(0.3)),
                        ),
                        child: Text(
                          allergen,
                          style: TextStyle(
                            color: isDark ? Colors.amber[200] : Colors.amber[800],
                            fontSize: 12,
                          ),
                        ),
                      )).toList(),
                    ),
                  ],

                  // Ingredients
                  if (item.ingredients.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Divider(color: divider, height: 1),
                    const SizedBox(height: 12),
                    Text(
                      'Zutaten',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: item.ingredients.map((ingredient) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isDark ? Colors.grey[800] : Colors.grey[200],
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          ingredient,
                          style: TextStyle(
                            color: isDark ? Colors.grey[300] : Colors.grey[700],
                            fontSize: 12,
                          ),
                        ),
                      )).toList(),
                    ),
                  ],

                  // Note chip (tappable, matching yemek segment)
                  const SizedBox(height: 16),
                  Divider(color: divider, height: 1),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => _showNoteSheet(isDark),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[100],
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.edit_note_rounded, color: _lokmaPink, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _buildNotePreview(),
                              style: TextStyle(
                                color: (_noteController.text.trim().isNotEmpty || (_recipientName?.trim().isNotEmpty ?? false))
                                    ? textPrimary
                                    : textSecondary,
                                fontSize: 13,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (_noteController.text.trim().isNotEmpty || (_recipientName?.trim().isNotEmpty ?? false))
                            Icon(Icons.check_circle, color: _lokmaPink, size: 16),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // Bottom Bar: Quantity + Add Button (matching yemek segment)
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 12,
              bottom: MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 12,
            ),
            decoration: BoxDecoration(
              color: bg,
              border: Border(top: BorderSide(color: divider)),
            ),
            child: Row(
              children: [
                // Quantity selector pill
                Container(
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white10 : Colors.grey[200],
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _qtyButton(
                        icon: _quantity <= 1 ? Icons.delete_outline : Icons.remove,
                        color: _quantity <= 1 ? textSecondary : textPrimary,
                        onTap: () {
                          if (_quantity <= 1) {
                            // Remove from cart entirely and close
                            if (widget.cartQuantity > 0) {
                              final cartNotifier = ref.read(kermesCartProvider.notifier);
                              final existingQty = cartNotifier.getQuantity(item.name);
                              for (int i = 0; i < existingQty; i++) {
                                cartNotifier.removeFromCart(item.name);
                              }
                            }
                            Navigator.pop(context);
                            return;
                          }
                          setState(() => _quantity--);
                        },
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Text(
                          _quantity.toString(),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: textPrimary,
                          ),
                        ),
                      ),
                      _qtyButton(
                        icon: Icons.add,
                        color: isDark ? Colors.white70 : const Color(0xFF3A3A3C),
                        onTap: () {
                          setState(() => _quantity++);
                        },
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 12),

                // Add to cart button
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: _addToCartAndClose,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _lokmaPink,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                        elevation: 0,
                      ),
                      child: Text(
                        widget.cartQuantity > 0
                            ? '${tr('marketplace.update_item')}  ${CurrencyUtils.getCurrencySymbol()}${_totalPrice.toStringAsFixed(2)}'
                            : '${tr('marketplace.add_to_cart')}  ${CurrencyUtils.getCurrencySymbol()}${_totalPrice.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
