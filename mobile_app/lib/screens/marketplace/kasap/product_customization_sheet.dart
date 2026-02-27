import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/butcher_product.dart';
import '../../../models/product_option.dart';
import '../../../providers/cart_provider.dart';
import '../../../utils/i18n_utils.dart';
import '../../../utils/currency_utils.dart';

/// Lieferando-style product customization bottom sheet.
///
/// Shows: product info, required option groups (radio), optional extras (checkbox),
/// Sonderwunsch removals, quantity selector, and dynamic price.
class ProductCustomizationSheet extends ConsumerStatefulWidget {
  final ButcherProduct product;
  final String businessId;
  final String businessName;
  final CartItem? existingItem;

  const ProductCustomizationSheet({
    super.key,
    required this.product,
    required this.businessId,
    required this.businessName,
    this.existingItem,
  });

  @override
  ConsumerState<ProductCustomizationSheet> createState() =>
      _ProductCustomizationSheetState();
}

class _ProductCustomizationSheetState
    extends ConsumerState<ProductCustomizationSheet> {
  /// Map<groupId, Set<optionId>> for selected options
  final Map<String, Set<String>> _selections = {};
  double _quantity = 1;
  final _noteController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final existing = widget.existingItem;
    if (existing != null && existing.selectedOptions.isNotEmpty) {
      // Editing: restore previous selections
      _quantity = existing.quantity;
      if (existing.note != null) _noteController.text = existing.note!;
      // Build selections from existing cart item
      for (final group in widget.product.optionGroups) {
        _selections[group.id] = {};
      }
      for (final opt in existing.selectedOptions) {
        _selections.putIfAbsent(opt.groupId, () => {});
        _selections[opt.groupId]!.add(opt.optionId);
      }
    } else {
      // New item: use defaults
      _quantity = widget.product.unitType == 'kg'
          ? widget.product.minQuantity
          : 1;
      for (final group in widget.product.optionGroups) {
        _selections[group.id] = {};
        for (final option in group.options) {
          if (option.defaultSelected) {
            _selections[group.id]!.add(option.id);
          }
        }
      }
    }
  }

  bool get _allRequiredGroupsSelected {
    for (final group in widget.product.optionGroups) {
      if (group.required) {
        final selected = _selections[group.id] ?? {};
        if (selected.length < group.minSelect) return false;
      }
    }
    return true;
  }

  double get _optionsTotal {
    double total = 0;
    for (final group in widget.product.optionGroups) {
      final selectedIds = _selections[group.id] ?? {};
      for (final option in group.options) {
        if (selectedIds.contains(option.id)) {
          total += option.priceModifier;
        }
      }
    }
    return total;
  }

  double get _unitPrice => widget.product.price + _optionsTotal;
  double get _totalPrice => _unitPrice * _quantity;

  List<SelectedOption> get _selectedOptions {
    final List<SelectedOption> result = [];
    for (final group in widget.product.optionGroups) {
      final selectedIds = _selections[group.id] ?? {};
      for (final option in group.options) {
        if (selectedIds.contains(option.id)) {
          result.add(SelectedOption(
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceModifier: option.priceModifier,
          ));
        }
      }
    }
    return result;
  }

  void _toggleOption(OptionGroup group, ProductOption option) {
    setState(() {
      final selected = _selections[group.id] ??= {};
      if (group.isRadio) {
        // Radio: single selection
        selected.clear();
        selected.add(option.id);
      } else {
        // Checkbox: toggle
        if (selected.contains(option.id)) {
          selected.remove(option.id);
        } else {
          // Check max limit
          if (group.maxSelect > 0 && selected.length >= group.maxSelect) return;
          selected.add(option.id);
        }
      }
    });
  }

  void _addToCart() {
  final noteText = _noteController.text.trim().isNotEmpty ? _noteController.text.trim() : null;
  final cartNotifier = ref.read(cartProvider.notifier);
  
  // If editing, remove the old variant first (options may have changed → different uniqueKey)
  if (widget.existingItem != null) {
    cartNotifier.removeFromCart(widget.existingItem!.uniqueKey);
  }
  
  cartNotifier.addToCart(
    widget.product,
    _quantity,
    widget.businessId,
    widget.businessName,
    selectedOptions: _selectedOptions,
    note: noteText,
  );
  Navigator.pop(context);
  
  final localizedName = I18nUtils.getLocalizedText(context, widget.product.nameData);
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(widget.existingItem != null 
        ? 'marketplace.updated_in_cart'.tr(args: [localizedName]) 
        : 'marketplace.added_to_cart'.tr(args: [localizedName])),
      duration: const Duration(seconds: 2),
      behavior: SnackBarBehavior.floating,
      backgroundColor: const Color(0xFFFB335B),
    ),
  );
}

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = const Color(0xFFFB335B);
    final bg = isDark ? const Color(0xFF1A1A1A) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white54 : Colors.black45;
    final divider = isDark ? Colors.white12 : Colors.grey[200]!;
    final product = widget.product;
    final isByWeight = product.unitType == 'kg';

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
          // ── Handle ──
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

          // ── Scrollable Content ──
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),

                  // ── Product Header ──
                  _buildProductHeader(product, isByWeight, isDark, textPrimary, textSecondary, accent),

                  if (product.optionGroups.isNotEmpty) ...[
                    Divider(color: divider, height: 24),

                    // ── Option Groups (sorted: required first, progressive reveal) ──
                    ..._buildVisibleOptionGroups(isDark, textPrimary, textSecondary, accent, divider),
                  ],

                  // ── Note Field (optional, only after all required options selected) ──
                  if (_allRequiredGroupsSelected) ...[
                    TextField(
                      controller: _noteController,
                      maxLength: 40,
                      style: TextStyle(
                        color: textPrimary,
                        fontSize: 14,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Not ekle (opsiyonel)  Ör: Hasan Usta',
                        hintStyle: TextStyle(color: textSecondary, fontSize: 13),
                        prefixIcon: Icon(Icons.edit_note_rounded, color: accent, size: 20),
                        filled: true,
                        fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        counterText: '',
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        isDense: true,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // ── Bottom Bar: Quantity + Add Button ──
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 12,
              bottom: MediaQuery.of(context).padding.bottom + 12,
            ),
            decoration: BoxDecoration(
              color: bg,
              border: Border(top: BorderSide(color: divider)),
            ),
            child: Opacity(
              opacity: _allRequiredGroupsSelected ? 1.0 : 0.4,
              child: IgnorePointer(
                ignoring: !_allRequiredGroupsSelected,
                child: Row(
                  children: [
                    // Quantity selector
                    Container(
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white10 : Colors.grey[100],
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _qtyButton(
                            icon: _quantity <= (isByWeight ? product.minQuantity : 1)
                                ? Icons.delete_outline
                                : Icons.remove,
                            color: _quantity <= (isByWeight ? product.minQuantity : 1)
                                ? textSecondary
                                : textPrimary,
                            onTap: () {
                              if (_quantity <= (isByWeight ? product.minQuantity : 1)) {
                                Navigator.pop(context);
                                return;
                              }
                              setState(() => _quantity -= isByWeight ? product.stepQuantity : 1);
                            },
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            child: Text(
                              isByWeight
                                  ? '${(_quantity * 1000).toStringAsFixed(0)}g'
                                  : _quantity.toStringAsFixed(0),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: textPrimary,
                              ),
                            ),
                          ),
                          _qtyButton(
                            icon: Icons.add,
                            color: accent,
                            onTap: () {
                              setState(() => _quantity += isByWeight ? product.stepQuantity : 1);
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
                          onPressed: _allRequiredGroupsSelected ? _addToCart : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accent,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: isDark ? Colors.white12 : Colors.grey[300],
                            disabledForegroundColor: isDark ? Colors.white30 : Colors.grey,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          child: Text(
                            '${widget.existingItem != null ? 'marketplace.update_item'.tr() : 'marketplace.add_to_cart'.tr()}  ${CurrencyUtils.getCurrencySymbol()}${_totalPrice.toStringAsFixed(2)}',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Product Header ──
  Widget _buildProductHeader(ButcherProduct product, bool isByWeight,
      bool isDark, Color textPrimary, Color textSecondary, Color accent) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Image (if available)
        if (product.imageUrl?.isNotEmpty == true)
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              width: double.infinity,
              height: 180,
              child: Image.network(
                product.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          ),
        if (product.imageUrl?.isNotEmpty == true) const SizedBox(height: 14),

        // Name
        Text(
          I18nUtils.getLocalizedText(context, product.nameData),
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: textPrimary,
          ),
        ),
        const SizedBox(height: 4),

        // Price
        Text(
          '${'marketplace.from_price'.tr()} ${CurrencyUtils.getCurrencySymbol()}${product.price.toStringAsFixed(2)}${isByWeight ? '/kg' : ''}',
          style: TextStyle(
            fontSize: 14,
            color: textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),

        // Description
        if (product.description.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            I18nUtils.getLocalizedText(context, product.descriptionData),
            style: TextStyle(
              fontSize: 13,
              color: textSecondary,
              height: 1.4,
            ),
          ),
        ],

        // Produktinfo link
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () => _showProduktinfo(product),
          child: Text(
            'marketplace.product_info'.tr(),
            style: TextStyle(
              fontSize: 13,
              color: accent,
              fontWeight: FontWeight.w600,
              decoration: TextDecoration.underline,
              decorationColor: accent,
            ),
          ),
        ),
      ],
    );
  }

  // ── Sorted & Progressive Option Groups ──
  List<Widget> _buildVisibleOptionGroups(bool isDark,
      Color textPrimary, Color textSecondary, Color accent, Color divider) {
    final groups = List<OptionGroup>.from(widget.product.optionGroups);
    // Sort: required groups first, optional groups last
    groups.sort((a, b) {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return 0;
    });

    final List<Widget> widgets = [];
    for (final group in groups) {
      // Check if all PREVIOUS required groups have been satisfied
      bool allPreviousRequiredSatisfied = true;
      for (final prev in groups) {
        if (identical(prev, group)) break; // reached current group
        if (prev.required) {
          final selected = _selections[prev.id] ?? {};
          if (selected.length < prev.minSelect) {
            allPreviousRequiredSatisfied = false;
            break;
          }
        }
      }

      if (!allPreviousRequiredSatisfied) break; // stop rendering further groups

      widgets.add(_buildOptionGroup(group, isDark, textPrimary, textSecondary, accent, divider));
    }

    return widgets;
  }

  // ── Option Group ──
  Widget _buildOptionGroup(OptionGroup group, bool isDark,
      Color textPrimary, Color textSecondary, Color accent, Color divider) {
    final selectedIds = _selections[group.id] ?? {};

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Group header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              group.name,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: textPrimary,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: group.required
                    ? accent.withValues(alpha: 0.12)
                    : (isDark ? Colors.white10 : Colors.grey[100]),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                group.required ? 'marketplace.required_field'.tr() : 'common.optional'.tr(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: group.required ? accent : textSecondary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        // Options list
        ...group.options.map((option) {
          final isSelected = selectedIds.contains(option.id);
          return InkWell(
            onTap: () => _toggleOption(group, option),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  // Radio / Checkbox icon
                  Icon(
                    group.isRadio
                        ? (isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked)
                        : (isSelected ? Icons.check_box : Icons.check_box_outline_blank),
                    color: isSelected ? accent : textSecondary,
                    size: 22,
                  ),
                  const SizedBox(width: 12),
                  // Option name
                  Expanded(
                    child: Text(
                      option.name,
                      style: TextStyle(
                        fontSize: 14,
                        color: textPrimary,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ),
                  // Price modifier
                  if (option.priceModifier != 0)
                    Text(
                      option.priceModifier > 0
                          ? '+${CurrencyUtils.getCurrencySymbol()}${option.priceModifier.toStringAsFixed(2)}'
                          : '−${CurrencyUtils.getCurrencySymbol()}${option.priceModifier.abs().toStringAsFixed(2)}',
                      style: TextStyle(
                        fontSize: 14,
                        color: textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                ],
              ),
            ),
          );
        }),

        Divider(color: divider, height: 20),
      ],
    );
  }

  // ── Quantity button helper ──
  Widget _qtyButton({required IconData icon, required Color color, required VoidCallback onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, color: color, size: 20),
        ),
      ),
    );
  }

  // ── Produktinfo Modal (Lieferando Style) ──
  void _showProduktinfo(ButcherProduct product) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white54 : Colors.black45;
    final bg = isDark ? const Color(0xFF1A1A1A) : Colors.white;
    final dividerColor = isDark ? Colors.white12 : Colors.black12;
    final warningBg = isDark ? const Color(0xFF2C2C2C) : const Color(0xFFF5F5F5);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(ctx).size.height * 0.85,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 8),
              child: Container(
                width: 36, height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.black12,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Header with back button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(ctx).pop(),
                    child: Icon(Icons.arrow_back, color: textPrimary, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'marketplace.product_info'.tr(),
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Divider(height: 1, color: dividerColor),
            // Content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Product name
                    Text(
                      I18nUtils.getLocalizedText(context, product.nameData),
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: textPrimary),
                    ),
                    const SizedBox(height: 24),
                    // Allergene Section
                    Row(
                      children: [
                        Text('marketplace.allergens'.tr(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: textPrimary)),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: product.allergens.isNotEmpty
                                ? const Color(0xFFE8F5E9)
                                : (isDark ? Colors.white10 : Colors.grey[200]),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            product.allergens.isNotEmpty ? 'marketplace.confirmed_by_seller'.tr() : 'marketplace.not_confirmed_by_seller'.tr(),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: product.allergens.isNotEmpty ? const Color(0xFF2E7D32) : textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (product.allergens.isNotEmpty)
                      ...product.allergens.map((allergen) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Icon(Icons.eco_outlined, size: 18, color: textSecondary),
                            const SizedBox(width: 8),
                            Expanded(child: Text(allergen, style: TextStyle(fontSize: 14, color: textPrimary))),
                          ],
                        ),
                      ))
                    else
                      Text('marketplace.no_info_available'.tr(), style: TextStyle(fontSize: 14, color: textSecondary)),
                    const SizedBox(height: 20),
                    Divider(color: dividerColor),
                    const SizedBox(height: 16),
                    // Zusatzstoffe Section
                    Row(
                      children: [
                        Text('marketplace.additives'.tr(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: textPrimary)),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: product.additives.isNotEmpty
                                ? const Color(0xFFE8F5E9)
                                : (isDark ? Colors.white10 : Colors.grey[200]),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            product.additives.isNotEmpty ? 'marketplace.confirmed_by_seller'.tr() : 'marketplace.not_confirmed_by_seller'.tr(),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: product.additives.isNotEmpty ? const Color(0xFF2E7D32) : textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (product.additives.isNotEmpty)
                      ...product.additives.map((additive) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Icon(Icons.science_outlined, size: 18, color: textSecondary),
                            const SizedBox(width: 8),
                            Expanded(child: Text(additive, style: TextStyle(fontSize: 14, color: textPrimary))),
                          ],
                        ),
                      ))
                    else
                      Text('marketplace.no_info_available'.tr(), style: TextStyle(fontSize: 14, color: textSecondary)),
                    const SizedBox(height: 24),
                    // Haftungsausschluss / Disclaimer
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: warningBg,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.warning_amber_rounded, size: 24, color: isDark ? Colors.amber : Colors.amber[700]),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'marketplace.disclaimer_text'.tr(),
                              style: TextStyle(fontSize: 13, color: textSecondary, height: 1.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Rechtliche Bedenken melden
                    GestureDetector(
                      onTap: () {
                        // TODO: Navigate to legal concerns form
                      },
                      child: Text(
                        'marketplace.report_legal_concerns'.tr(),
                        style: TextStyle(
                          fontSize: 14,
                          color: isDark ? Colors.white70 : Colors.black54,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
