import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import '../services/sponsored_ad_service.dart';
import '../utils/currency_utils.dart';

/// Bottom sheet that shows sponsored product details + nearest market CTA
class SponsoredProductSheet extends StatefulWidget {
  final SponsoredAd ad;
  final double? userLat;
  final double? userLng;

  const SponsoredProductSheet({
    super.key,
    required this.ad,
    this.userLat,
    this.userLng,
  });

  @override
  State<SponsoredProductSheet> createState() => _SponsoredProductSheetState();
}

class _SponsoredProductSheetState extends State<SponsoredProductSheet> {
  NearestMarketMatch? _nearestMarket;
  bool _isLoading = true;
  bool _isAddingToCart = false;

  @override
  void initState() {
    super.initState();
    _findNearestMarket();
  }

  Future<void> _findNearestMarket() async {
    if (widget.userLat == null || widget.userLng == null) {
      setState(() => _isLoading = false);
      return;
    }

    final match = await SponsoredAdService().findNearestCheapestMarket(
      ad: widget.ad,
      userLat: widget.userLat!,
      userLng: widget.userLng!,
      maxDistanceKm: widget.ad.targetRadius,
    );

    if (mounted) {
      setState(() {
        _nearestMarket = match;
        _isLoading = false;
      });
    }
  }

  void _onBuyFromMarket() async {
    if (_nearestMarket == null) return;

    HapticFeedback.mediumImpact();
    setState(() => _isAddingToCart = true);

    // Record conversion
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId != null) {
      await SponsoredAdService().recordConversion(
        widget.ad.id,
        userId,
        _nearestMarket!.businessId,
        productId: _nearestMarket!.productId,
      );
    }

    if (mounted) {
      Navigator.of(context).pop(); // Close bottom sheet
      // Navigate to the market's store page
      context.push('/kasap/${_nearestMarket!.businessId}?mode=teslimat');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final onSurface = Theme.of(context).colorScheme.onSurface;

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Sponsored badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'sponsored_ads.sponsored'.tr(),
                          style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),

                      const SizedBox(height: 12),

                      // Banner image -- buyuk gorsel
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: AspectRatio(
                          aspectRatio: 2.0, // Daha buyuk gorsel
                          child: CachedNetworkImage(
                            imageUrl: widget.ad.bannerImageUrl,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(
                              color: isDark
                                  ? const Color(0xFF2C2C2E)
                                  : Colors.grey.shade100,
                              child: const Center(
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2)),
                            ),
                            errorWidget: (_, __, ___) => Container(
                              color: isDark
                                  ? const Color(0xFF2C2C2E)
                                  : Colors.grey.shade100,
                              child: Icon(Icons.image_outlined,
                                  color: Colors.grey.shade400, size: 48),
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Advertiser info row
                      Row(
                        children: [
                          if (widget.ad.advertiserLogo != null) ...[
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                    color: Colors.grey.shade300, width: 0.5),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(7),
                                child: CachedNetworkImage(
                                  imageUrl: widget.ad.advertiserLogo!,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                          ],
                          Expanded(
                            child: Text(
                              widget.ad.advertiserName,
                              style: TextStyle(
                                color: Colors.grey.shade500,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 12),

                      // Product title
                      Text(
                        widget.ad.title,
                        style: TextStyle(
                          color: onSurface,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                      ),

                      if (widget.ad.subtitle != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          widget.ad.subtitle!,
                          style: TextStyle(
                            color: Colors.grey.shade500,
                            fontSize: 14,
                            height: 1.4,
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // Divider
                      Divider(color: Colors.grey.shade300, height: 1),

                      const SizedBox(height: 20),

                      // Nearest market section
                      Text(
                        'sponsored_ads.buy_from_nearby'.tr(),
                        style: TextStyle(
                          color: onSurface,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),

                      const SizedBox(height: 12),

                      if (_isLoading)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 24),
                          child: Center(
                            child: Column(
                              children: [
                                const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'sponsored_ads.searching_nearby'.tr(),
                                  style: TextStyle(
                                    color: Colors.grey.shade500,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else if (_nearestMarket != null)
                        _buildMarketMatchCard(isDark, onSurface)
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 24),
                          child: Center(
                            child: Column(
                              children: [
                                Icon(Icons.location_off_outlined,
                                    color: Colors.grey.shade400, size: 32),
                                const SizedBox(height: 8),
                                Text(
                                  'sponsored_ads.no_nearby_market'.tr(),
                                  style: TextStyle(
                                    color: Colors.grey.shade500,
                                    fontSize: 14,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ),

                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),

              // Bottom CTA button
              if (!_isLoading && _nearestMarket != null)
                Container(
                  padding: EdgeInsets.fromLTRB(
                    20,
                    12,
                    20,
                    MediaQuery.of(context).padding.bottom + 12,
                  ),
                  decoration: BoxDecoration(
                    color: bgColor,
                    border: Border(
                      top: BorderSide(
                        color: isDark
                            ? Colors.grey.shade800
                            : Colors.grey.shade200,
                        width: 0.5,
                      ),
                    ),
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isAddingToCart ? null : _onBuyFromMarket,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA184A),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(25),
                        ),
                        elevation: 0,
                      ),
                      child: _isAddingToCart
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.shopping_cart_outlined,
                                    size: 18),
                                const SizedBox(width: 8),
                                Text(
                                  'sponsored_ads.go_to_store'.tr(),
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
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
      },
    );
  }

  Widget _buildMarketMatchCard(bool isDark, Color onSurface) {
    final market = _nearestMarket!;
    final borderColor = isDark ? Colors.grey.shade800 : Colors.grey.shade200;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF8F8F8),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: 0.5),
      ),
      child: Column(
        children: [
          // Market info row
          Row(
            children: [
              // Market logo
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF3A3A3C) : Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: borderColor, width: 0.5),
                ),
                child: market.businessLogoUrl != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(9),
                        child: CachedNetworkImage(
                          imageUrl: market.businessLogoUrl!,
                          fit: BoxFit.cover,
                        ),
                      )
                    : Icon(Icons.store_outlined,
                        color: Colors.grey.shade400, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      market.businessName,
                      style: TextStyle(
                        color: onSurface,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(Icons.location_on_outlined,
                            color: Colors.grey.shade500, size: 13),
                        const SizedBox(width: 3),
                        Text(
                          '${market.distanceKm.toStringAsFixed(1)} km',
                          style: TextStyle(
                            color: Colors.grey.shade500,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Price badge
              if (market.price != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    CurrencyUtils.formatCurrency(market.price!),
                    style: const TextStyle(
                      color: Color(0xFF4CAF50),
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),

          // Product name (if found)
          if (market.productName != null && market.productName!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF3A3A3C) : Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.inventory_2_outlined,
                      color: Colors.grey.shade500, size: 14),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      market.productName!,
                      style: TextStyle(
                        color: onSurface.withOpacity(0.8),
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
