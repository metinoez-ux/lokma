import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'package:lokma_app/utils/currency_utils.dart';

/// Kermes urun karti - aynen detail ekranindaki gibi
/// Hem normal siparis hem de grup siparisi ekranlarinda ortak kullanilir
class KermesMenuItemTile extends StatelessWidget {
  final KermesMenuItem item;
  final int cartQuantity;
  final bool isMenuOnly;
  final VoidCallback? onAdd;
  final VoidCallback? onTap;

  static const Color _lokmaPink = Color(0xFFF41C54);

  const KermesMenuItemTile({
    super.key,
    required this.item,
    this.cartQuantity = 0,
    this.isMenuOnly = false,
    this.onAdd,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasImage = item.imageUrl != null && item.imageUrl!.isNotEmpty;
    final isAvailable = item.isAvailable;
    final isSoldOut = !isAvailable;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    final bool inCart = cartQuantity > 0;

    Widget buildAddButton({required double size}) {
      if (isMenuOnly) return const SizedBox.shrink();
      return GestureDetector(
        onTap: isAvailable
            ? () {
                HapticFeedback.mediumImpact();
                onAdd?.call();
              }
            : null,
        child: inCart
            ? Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white : Colors.black87,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.15),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '$cartQuantity',
                  style: TextStyle(
                    color: isDark ? Colors.black : Colors.white,
                    fontSize: size == 36 ? 14 : 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              )
            : Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black
                          .withOpacity(size == 36 ? 0.1 : 0.05),
                      blurRadius: size == 36 ? 6 : 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.add,
                  color: _lokmaPink,
                  size: size == 36 ? 20 : 24,
                ),
              ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Opacity(
          opacity: isAvailable ? 1.0 : 0.55,
          child: InkWell(
            onTap: isAvailable
                ? () {
                    HapticFeedback.selectionClick();
                    onTap?.call();
                  }
                : null,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 16),
              color: Colors.transparent,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Product Info (Left)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title
                        Text(
                          item.name,
                          style: TextStyle(
                            color: isAvailable ? textColor : subtleTextColor,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            height: 1.2,
                            letterSpacing: -0.2,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (isSoldOut) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.orange.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'marketplace.sold_out'.tr(),
                              style: const TextStyle(
                                color: Colors.orange,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        if (item.isComboMenu && !isSoldOut) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(Icons.tune_rounded,
                                  size: 13,
                                  color: isDark
                                      ? Colors.grey[400]
                                      : Colors.grey[600]),
                              const SizedBox(width: 4),
                              Text(
                                'kermes.with_options'.tr(),
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w500,
                                  color: isDark
                                      ? Colors.grey[400]
                                      : Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 6),
                        // Description
                        if (item.description != null &&
                            item.description!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10.0),
                            child: Text(
                              item.description!,
                              style: TextStyle(
                                color: isDark
                                    ? Colors.grey[400]
                                    : Colors.grey[600],
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                                height: 1.3,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        const SizedBox(height: 2),
                        // Price (with discount support)
                        if (item.isDiscounted) ...[
                          Row(
                            children: [
                              Text(
                                '${item.price.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                                style: TextStyle(
                                  color: subtleTextColor,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  decoration: TextDecoration.lineThrough,
                                  decorationColor: subtleTextColor,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${item.discountPrice!.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ] else
                          Text(
                            '${item.price.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                            style: TextStyle(
                              color: isAvailable ? textColor : subtleTextColor,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),

                  // Image & Add Button (Right)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (hasImage)
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                width: 100,
                                height: 100,
                                color:
                                    isDark ? Colors.white10 : Colors.grey[100],
                                child: LokmaNetworkImage(
                                  imageUrl: item.imageUrl!,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => Icon(
                                    _getIconForItem(item.name),
                                    size: 40,
                                    color: isDark
                                        ? Colors.white24
                                        : Colors.grey[400],
                                  ),
                                ),
                              ),
                            ),
                            if (isAvailable)
                              Positioned(
                                right: -4,
                                bottom: -4,
                                child: buildAddButton(size: 36),
                              ),
                          ],
                        )
                      else if (isAvailable)
                        buildAddButton(size: 44),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        // Separator Line
        Divider(
          height: 1,
          thickness: 0.5,
          color: isDark
              ? Colors.white.withOpacity(0.05)
              : Colors.grey.withOpacity(0.2),
        ),
      ],
    );
  }

  static IconData _getIconForItem(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('kebap') ||
        lower.contains('adana') ||
        lower.contains('doner')) {
      return Icons.kebab_dining;
    } else if (lower.contains('corba')) {
      return Icons.soup_kitchen;
    } else if (lower.contains('pide') ||
        lower.contains('lahmacun') ||
        lower.contains('gozleme')) {
      return Icons.local_pizza;
    } else if (lower.contains('baklava') ||
        lower.contains('kunefe') ||
        lower.contains('lokum') ||
        lower.contains('kadayif')) {
      return Icons.cake;
    } else if (lower.contains('cay') ||
        lower.contains('kahve') ||
        lower.contains('salep')) {
      return Icons.coffee;
    } else if (lower.contains('ayran') ||
        lower.contains('limon') ||
        lower.contains('sira')) {
      return Icons.local_drink;
    } else if (lower.contains('dondurma')) {
      return Icons.icecream;
    } else {
      return Icons.restaurant;
    }
  }
}
