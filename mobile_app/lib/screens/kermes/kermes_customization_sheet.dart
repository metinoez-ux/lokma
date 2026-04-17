import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/kermes_model.dart';
import '../../../models/product_option.dart';
import '../../../providers/kermes_cart_provider.dart';
import '../../../utils/currency_utils.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';

/// Multi-step customization bottom sheet for Kermes menu items.
/// Shows option groups (radio/checkbox) with progressive reveal,
/// quantity selector, and dynamic price calculation.
class KermesCustomizationSheet extends ConsumerStatefulWidget {
  final KermesMenuItem item;
  final String eventId;
  final String eventName;
  final List<SelectedOption>? initialSelections;
  final int? initialQuantity;
  final bool editMode;
  final void Function(List<SelectedOption> newOptions)? onEdit;

  const KermesCustomizationSheet({
    super.key,
    required this.item,
    required this.eventId,
    required this.eventName,
    this.initialSelections,
    this.initialQuantity,
    this.editMode = false,
    this.onEdit,
  });

  @override
  ConsumerState<KermesCustomizationSheet> createState() =>
      _KermesCustomizationSheetState();
}

class _KermesCustomizationSheetState
    extends ConsumerState<KermesCustomizationSheet> {
  final Map<String, Set<String>> _selections = {};
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    if (widget.initialQuantity != null) _quantity = widget.initialQuantity!;
    for (final group in widget.item.optionGroups) {
      _selections[group.id] = {};
      // Edit modunda mevcut secenekleri yukle
      if (widget.initialSelections != null) {
        for (final sel in widget.initialSelections!) {
          if (sel.groupId == group.id) {
            _selections[group.id]!.add(sel.optionId);
          }
        }
      } else {
        for (final option in group.options) {
          if (option.defaultSelected) {
            _selections[group.id]!.add(option.id);
          }
        }
      }
    }
  }

  bool get _allRequiredGroupsSelected {
    for (final group in widget.item.optionGroups) {
      if (group.required) {
        final selected = _selections[group.id] ?? {};
        if (selected.length < group.minSelect) return false;
      }
    }
    return true;
  }

  double get _optionsTotal {
    double total = 0;
    for (final group in widget.item.optionGroups) {
      final selectedIds = _selections[group.id] ?? {};
      for (final option in group.options) {
        if (selectedIds.contains(option.id)) {
          total += option.priceModifier;
        }
      }
    }
    return total;
  }

  double get _unitPrice => widget.item.price + _optionsTotal;
  double get _totalPrice => _unitPrice * _quantity;

  List<SelectedOption> get _selectedOptions {
    final List<SelectedOption> result = [];
    for (final group in widget.item.optionGroups) {
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
        selected.clear();
        selected.add(option.id);
      } else {
        if (selected.contains(option.id)) {
          selected.remove(option.id);
        } else {
          if (group.maxSelect > 0 && selected.length >= group.maxSelect) return;
          selected.add(option.id);
        }
      }
    });
  }

  void _addToCart() {
    if (widget.editMode && widget.onEdit != null) {
      widget.onEdit!(_selectedOptions);
      // Not: Edit mode quantity degisimleri kermes_cart_provider'da ayri yonetilir veya cagirildigi yerden halledilir
      Navigator.pop(context);
      HapticFeedback.heavyImpact();
      return;
    }
    final cartNotifier = ref.read(kermesCartProvider.notifier);
    final added = cartNotifier.addToCart(
      widget.item,
      widget.eventId,
      widget.eventName,
      selectedOptions: _selectedOptions,
      quantity: _quantity, // <-- FIX: Artik miktar ekleniyor
    );
    if (added) {
      Navigator.pop(context);
      HapticFeedback.heavyImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = const Color(0xFFEA184A);
    final bg = isDark ? const Color(0xFF1A1A1A) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white54 : Colors.black45;
    final divider = isDark ? Colors.white12 : Colors.grey[200]!;
    final item = widget.item;

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

          // Scrollable content
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),

                  // Product image
                  if (item.allImages.isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: SizedBox(
                        width: double.infinity,
                        height: 180,
                        child: LokmaNetworkImage(
                          imageUrl: item.allImages.first,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  if (item.allImages.isNotEmpty) const SizedBox(height: 14),

                  // Product name
                  Text(
                    item.name,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: textPrimary,
                    ),
                  ),

                  // Secondary name
                  if (item.secondaryName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.secondaryName!,
                      style: TextStyle(
                        fontSize: 14,
                        color: textSecondary,
                      ),
                    ),
                  ],

                  const SizedBox(height: 4),

                  // Price
                  Text(
                    '${CurrencyUtils.getCurrencySymbol()}${item.price.toStringAsFixed(2).replaceAll('.', ',')}',
                    style: TextStyle(
                      fontSize: 17,
                      color: textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),

                  // Description
                  if (item.description != null && item.description!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      item.description!,
                      style: TextStyle(
                        fontSize: 14,
                        color: textSecondary,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
                      ),
                    ),
                  ],

                  // Option groups
                  if (item.optionGroups.isNotEmpty) ...[
                    Divider(color: divider, height: 24),
                    ..._buildVisibleOptionGroups(
                        isDark, textPrimary, textSecondary, accent, divider),
                  ],

                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // Bottom bar: quantity + add button
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 12,
              bottom: MediaQuery.of(context).viewInsets.bottom +
                  MediaQuery.of(context).padding.bottom +
                  12,
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
                        color: isDark ? Colors.white10 : Colors.grey[200],
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _qtyButton(
                            icon: _quantity <= 1
                                ? Icons.delete_outline
                                : Icons.remove,
                            color: _quantity <= 1
                                ? textSecondary
                                : textPrimary,
                            onTap: () {
                              if (_quantity <= 1) {
                                Navigator.pop(context);
                                return;
                              }
                              setState(() => _quantity--);
                            },
                          ),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 14),
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
                            color: isDark
                                ? Colors.white70
                                : const Color(0xFF3A3A3C),
                            onTap: () => setState(() => _quantity++),
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
                          onPressed:
                              _allRequiredGroupsSelected ? _addToCart : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accent,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor:
                                isDark ? Colors.white12 : Colors.grey[300],
                            disabledForegroundColor:
                                isDark ? Colors.white30 : Colors.grey,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(24)),
                            elevation: 0,
                          ),
                          child: Text(
                            widget.editMode
                                ? 'Guncelle  ${CurrencyUtils.getCurrencySymbol()}${_totalPrice.toStringAsFixed(2).replaceAll('.', ',')}'
                                : '${'marketplace.add_to_cart'.tr()}  ${CurrencyUtils.getCurrencySymbol()}${_totalPrice.toStringAsFixed(2).replaceAll('.', ',')}',
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w600),
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

  // Progressive option groups rendering
  List<Widget> _buildVisibleOptionGroups(bool isDark, Color textPrimary,
      Color textSecondary, Color accent, Color divider) {
    final groups = List<OptionGroup>.from(widget.item.optionGroups);
    groups.sort((a, b) {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return 0;
    });

    final List<Widget> widgets = [];
    for (final group in groups) {
      bool allPreviousRequiredSatisfied = true;
      for (final prev in groups) {
        if (identical(prev, group)) break;
        if (prev.required) {
          final selected = _selections[prev.id] ?? {};
          if (selected.length < prev.minSelect) {
            allPreviousRequiredSatisfied = false;
            break;
          }
        }
      }
      if (!allPreviousRequiredSatisfied) break;
      widgets.add(_buildOptionGroup(
          group, isDark, textPrimary, textSecondary, accent, divider));
    }
    return widgets;
  }

  Widget _buildOptionGroup(OptionGroup group, bool isDark, Color textPrimary,
      Color textSecondary, Color accent, Color divider) {
    final selectedIds = _selections[group.id] ?? {};

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Group header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                group.name,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: textPrimary,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: group.required
                    ? (isDark
                        ? Colors.white24
                        : const Color(0xFF3A3A3C))
                    : (isDark ? Colors.white10 : Colors.grey[100]),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                group.required
                    ? 'marketplace.required_field'.tr()
                    : 'common.optional'.tr(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: group.required ? Colors.white : textSecondary,
                  letterSpacing: 0.2,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        // Options
        ...group.options.map((option) {
          final isSelected = selectedIds.contains(option.id);
          return InkWell(
            onTap: () => _toggleOption(group, option),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Icon(
                    group.isRadio
                        ? (isSelected
                            ? Icons.radio_button_checked
                            : Icons.radio_button_unchecked)
                        : (isSelected
                            ? Icons.check_box
                            : Icons.check_box_outline_blank),
                    color: isSelected ? accent : textSecondary,
                    size: 22,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      option.name,
                      style: TextStyle(
                        fontSize: 15,
                        color: textPrimary,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.w500,
                      ),
                    ),
                  ),
                  if (option.priceModifier != 0)
                    Text(
                      option.priceModifier > 0
                          ? '+${CurrencyUtils.getCurrencySymbol()}${option.priceModifier.toStringAsFixed(2).replaceAll('.', ',')}'
                          : '-${CurrencyUtils.getCurrencySymbol()}${option.priceModifier.abs().toStringAsFixed(2).replaceAll('.', ',')}',
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

  Widget _qtyButton({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        width: 36,
        height: 36,
        decoration: const BoxDecoration(shape: BoxShape.circle),
        child: Icon(icon, color: color, size: 20),
      ),
    );
  }
}
