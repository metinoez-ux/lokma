import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/sponsored_ad_service.dart';
import 'sponsored_product_sheet.dart';

/// Slim sponsored banner card -- daha ince format, normal isletme kartlarindan farkli
/// Market listesine arada bir eklenir (her 5-6 isletme kartindan sonra)
class SponsoredBannerCard extends StatefulWidget {
  final SponsoredAd ad;
  final double? userLat;
  final double? userLng;

  const SponsoredBannerCard({
    super.key,
    required this.ad,
    this.userLat,
    this.userLng,
  });

  @override
  State<SponsoredBannerCard> createState() => _SponsoredBannerCardState();
}

class _SponsoredBannerCardState extends State<SponsoredBannerCard> {
  bool _impressionRecorded = false;

  @override
  void initState() {
    super.initState();
    _recordImpression();
  }

  void _recordImpression() {
    if (_impressionRecorded) return;
    _impressionRecorded = true;
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId != null) {
      SponsoredAdService().recordImpression(widget.ad.id, userId);
    }
  }

  void _onTap() {
    HapticFeedback.lightImpact();

    // Record click
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId != null) {
      SponsoredAdService().recordClick(widget.ad.id, userId);
    }

    // Open product detail bottom sheet
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SponsoredProductSheet(
        ad: widget.ad,
        userLat: widget.userLat,
        userLng: widget.userLng,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final borderColor = isDark ? Colors.grey.shade800 : Colors.grey.shade200;

    return GestureDetector(
      onTap: _onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor, width: 0.5),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Banner image -- slim, tam genislik
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              child: AspectRatio(
                aspectRatio: 3.5, // Daha ince gorsel -- 3.5:1 oran
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CachedNetworkImage(
                      imageUrl: widget.ad.bannerImageUrl,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade100,
                        child: const Center(
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      ),
                      errorWidget: (_, __, ___) => Container(
                        color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade100,
                        child: Icon(Icons.image_outlined, color: Colors.grey.shade400, size: 32),
                      ),
                    ),
                    // "Reklam" / "Sponsored" badge - sol ust
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.55),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'sponsored_ads.sponsored'.tr(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ),
                    // Advertiser logo - sag ust
                    if (widget.ad.advertiserLogo != null)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(6),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.15),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(5),
                            child: CachedNetworkImage(
                              imageUrl: widget.ad.advertiserLogo!,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // Alt bilgi satiri -- sadece icerik varsa goster
            if (widget.ad.title.isNotEmpty || (widget.ad.subtitle != null && widget.ad.subtitle!.isNotEmpty) || widget.ad.productPrice != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (widget.ad.title.isNotEmpty)
                        Text(
                          widget.ad.title,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (widget.ad.subtitle != null && widget.ad.subtitle!.isNotEmpty) ...[
                          const SizedBox(height: 1),
                          Text(
                            widget.ad.subtitle!,
                            style: TextStyle(
                              color: Colors.grey.shade500,
                              fontSize: 11,
                              fontWeight: FontWeight.w300,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (widget.ad.productPrice != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      '${widget.ad.productPrice!.toStringAsFixed(2)} \u20AC',
                      style: TextStyle(
                        color: const Color(0xFFFB335B),
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  const SizedBox(width: 8),
                  // CTA arrow
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFB335B).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.arrow_forward_rounded,
                      color: Color(0xFFFB335B),
                      size: 16,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
