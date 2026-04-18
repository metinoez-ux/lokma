                      // ➕ Quantity & Cart Wrapper
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF222224) : const Color(0xFFF8F8F8),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isDark ? Colors.white.withOpacity(0.04) : Colors.grey.shade200,
                            width: 1,
                          ),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // ➕ Quantity controls — separate bordered buttons
                            // When NOT in cart: +/- adjust local selection (quantity picker)
                            // When IN cart: +/- directly adjust cart quantity
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                // Minus button
                                GestureDetector(
                                  onTap: () {
                                    if (inCart) {
                                      if (productCartItems.isNotEmpty) {
                                        ref.read(cartProvider.notifier).removeFromCart(productCartItems.first.uniqueKey);
                                      }
                                    } else {
                                      final current = _selections[product.sku] ?? defaultQty;
                                      if (current > defaultQty) {
                                        setState(() => _selections[product.sku] = current - stepQty);
                                      }
                                    }
                                  },
                                  child: Container(
                                    width: 34,
                                    height: 34,
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF2A2A2C) : Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isDark ? Colors.white.withOpacity(0.15) : Colors.grey.shade300,
                                        width: 1,
                                      ),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      '—',
                                      style: TextStyle(
                                        color: (inCart || (selectedQty > defaultQty)) ? textPrimary : textSecondary.withOpacity(0.3),
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                                // Quantity display
                                Expanded(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      FittedBox(
                                        fit: BoxFit.scaleDown,
                                        child: Text(
                                          displayQtyText,
                                          style: TextStyle(
                                            color: textPrimary,
                                            fontSize: 18,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                      if (unitLabel.isNotEmpty)
                                        Text(
                                          unitLabel,
                                          style: TextStyle(
                                            color: textSecondary,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                // Plus button
                                GestureDetector(
                                  onTap: isAvailable ? () {
                                    if (inCart) {
                                      if (product.optionGroups.isNotEmpty) {
                                        _showProductBottomSheet(product);
                                      } else {
                                        final data = _butcherDoc?.data() as Map<String, dynamic>?;
                                        final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
                                        HapticFeedback.mediumImpact();
                                        _quickAddToCart(
                                          product,
                                          isByWeight ? stepQty : 1,
                                          widget.businessId,
                                          butcherName,
                                          onSuccess: () => setState(() {}),
                                        );
                                      }
                                    } else {
                                      final current = _selections[product.sku] ?? defaultQty;
                                      setState(() => _selections[product.sku] = current + stepQty);
                                    }
                                  } : null,
                                  child: Container(
                                    width: 34,
                                    height: 34,
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF2A2A2C) : Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isDark ? Colors.white.withOpacity(0.15) : Colors.grey.shade300,
                                        width: 1,
                                      ),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      '+',
                                      style: TextStyle(
                                        color: accent,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            
                            const SizedBox(height: 8),
                            
                            // 🛒 Sepete Ekle / Sepette button — BRAND RED
                            GestureDetector(
                              onTap: isAvailable ? () {
                                if (inCart) {
                                  // Already in cart — go to cart or show sheet
                                  _showProductBottomSheet(product);
                                } else {
                                  // NOT in cart — add selected quantity
                                  if (product.optionGroups.isNotEmpty) {
                                    _showProductBottomSheet(product);
                                  } else {
                                    final data = _butcherDoc?.data() as Map<String, dynamic>?;
                                    final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
                                    final qtyToAdd = _selections[product.sku] ?? defaultQty;
                                    HapticFeedback.mediumImpact();
                                    _quickAddToCart(
                                      product,
                                      qtyToAdd,
                                      widget.businessId,
                                      butcherName,
                                      onSuccess: () {
                                        setState(() => _selections.remove(product.sku));
                                      }
                                    );
                                  }
                                }
                              } : null,
                              child: Container(
                                width: double.infinity,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: inCart ? Colors.green.shade600 : accent,
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: [
                                    BoxShadow(
                                      color: (inCart ? Colors.green : accent).withOpacity(0.3),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        inCart ? Icons.check_circle_outline : Icons.shopping_cart_outlined,
                                        color: Colors.white,
                                        size: 14,
                                      ),
                                      const SizedBox(width: 4),
                                      Flexible(
                                        child: FittedBox(
                                          fit: BoxFit.scaleDown,
                                          child: Text(
                                            inCart
                                              ? 'cart.in_cart_price'.tr(namedArgs: {'price': totalPrice.toStringAsFixed(2), 'currency': CurrencyUtils.getCurrencySymbol()})
                                              : 'cart.add_to_cart_price'.tr(namedArgs: {'price': previewPrice.toStringAsFixed(2), 'currency': CurrencyUtils.getCurrencySymbol()}),
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 13,
                                              fontWeight: FontWeight.w700,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
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
                      ),
