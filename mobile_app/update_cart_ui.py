import re

file_path = "lib/screens/marketplace/kasap/cart_screen.dart"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the gradient container section at the bottom of cart screen
old_pattern = r"child: Container\(\s*padding: EdgeInsets\.fromLTRB\(20, 14, 20, MediaQuery\.of\(context\)\.padding\.bottom \+ 4\),\s*decoration: BoxDecoration\(\s*gradient: LinearGradient\(.*?_buildScannedTableBanner\(\),\s*// UNIFIED Lieferando Footer.*?\}\),\s*\],\s*\),\s*\),\s*\)"

new_ui = """child: Builder(
            builder: (context) {
              final minOrder = (_butcherData?['minDeliveryOrder'] as num?)?.toDouble() ?? (_butcherData?['minOrderAmount'] as num?)?.toDouble() ?? 10.0;
              final isDelivery = !_isPickUp && !_isDineIn;
              final remaining = minOrder - grandTotal;
              final isSuccess = remaining <= 0;
              
              final isDark = Theme.of(context).brightness == Brightness.dark;
              
              final infoCardColor = isSuccess
                  ? (isDark ? const Color(0xFF67C973) : const Color(0xFF67C973))
                  : (isDark ? const Color(0xFF4A4A4A) : const Color(0xFFE0E0E0));
              final infoTextColor = isSuccess
                  ? Colors.white
                  : (isDark ? Colors.white : Colors.black87);
              final infoIconColor = infoTextColor;
              
              final frontWallColor = Theme.of(context).scaffoldBackgroundColor;

              final bottomPadding = MediaQuery.of(context).padding.bottom;
              final cartButtonHeight = 54.0; 
              final textRowHeight = 44.0;
              final frontLipHeight = 16.0;

              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildScannedTableBanner(),
                  if (!isDelivery)
                    Container(
                      color: frontWallColor,
                      padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding + 16),
                      child: _buildLieferandoCheckoutButton(grandTotal),
                    )
                  else
                    Container(
                      margin: EdgeInsets.only(top: 0),
                      height: cartButtonHeight + textRowHeight + frontLipHeight + bottomPadding + 20,
                      child: Stack(
                        alignment: Alignment.bottomCenter,
                        clipBehavior: Clip.none,
                        children: [
                          Positioned(
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.only(top: 14, left: 16, right: 16),
                              decoration: BoxDecoration(
                                color: infoCardColor,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                              ),
                              alignment: Alignment.topCenter,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    isSuccess ? Icons.check_circle_outline : Icons.pedal_bike,
                                    size: 16,
                                    color: infoIconColor,
                                  ),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: Text(
                                      isSuccess
                                          ? 'marketplace.min_order_success'.tr()
                                          : 'marketplace.min_order_add_text'.tr(namedArgs: {
                                              'amount': remaining.toStringAsFixed(2),
                                              'currency': CurrencyUtils.getCurrencySymbol(),
                                              'minOrder': minOrder.toStringAsFixed(0),
                                            }),
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: infoTextColor,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Positioned(
                            top: textRowHeight,
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              decoration: BoxDecoration(
                                color: frontWallColor,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: bottomPadding + 14,
                            left: 16, 
                            right: 16,
                            child: _buildLieferandoCheckoutButton(grandTotal),
                          ),
                        ],
                      ),
                    ),
                ],
              );
            },
          )"""

modified = re.sub(old_pattern, new_ui, content, flags=re.DOTALL)
if modified == content:
    print("WARNING: Pattern not found or identical")
else:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(modified)
    print("Updated cart_screen.dart successfully")
