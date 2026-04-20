import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'dart:ui';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/services/kermes_favorite_service.dart';
import '../../services/kermes_badge_service.dart';
import '../../services/kermes_favorite_service.dart';
import '../../screens/kermes/kermes_detail_screen.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../utils/currency_utils.dart';
import 'package:google_fonts/google_fonts.dart';
import 'brand_info_sheet.dart';

class KermesCard extends StatefulWidget {
  final KermesEvent event;
  final Position? currentPosition;
  final VoidCallback? onFavoriteChanged;

  const KermesCard({
    super.key,
    required this.event,
    this.currentPosition,
    this.onFavoriteChanged,
  });

  @override
  State<KermesCard> createState() => _KermesCardState();
}

class _KermesCardState extends State<KermesCard> {
  bool _isFavorite = false;

  List<KermesBadge> _activeBadges = [];

  // Colors
  static const Color cardLight = Colors.white;

  @override
  void initState() {
    super.initState();
    _checkFavorite();
    _loadBadges();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadBadges() async {
    if (widget.event.activeBadgeIds.isEmpty) {
      if (mounted && _activeBadges.isNotEmpty) {
        setState(() => _activeBadges = []);
      }
      return;
    }

    final allBadges = await KermesBadgeService.instance.loadBadges();
    if (mounted) {
      setState(() {
        List<KermesBadge> initialBadges = widget.event.activeBadgeIds
            .where((id) => allBadges.containsKey(id))
            .map((id) => allBadges[id]!)
            .toList();

        // 🟢 Location-based Brand Swapping (TUNA vs Akdeniz Toros)
        bool isTurkey = false;
        if (widget.currentPosition != null) {
           final lat = widget.currentPosition!.latitude;
           final lng = widget.currentPosition!.longitude;
           // Bounding box for Turkey
           if (lat >= 35.8 && lat <= 42.1 && lng >= 25.6 && lng <= 44.8) {
               isTurkey = true;
           }
        }

        List<KermesBadge> finalBadges = [];
        for (var badge in initialBadges) {
            String bName = badge.label.toLowerCase();
            if (bName.contains('tuna') || bName.contains('toros')) {
                if (isTurkey) {
                    // Try to find Toros instead
                    final torosBadge = allBadges.values.where((b) => b.label.toLowerCase().contains('toros')).firstOrNull;
                    if (torosBadge != null) {
                      if (!finalBadges.any((b) => b.id == torosBadge.id)) finalBadges.add(torosBadge);
                    } else {
                      if (!finalBadges.any((b) => b.id == badge.id)) finalBadges.add(badge);
                    }
                } else {
                    // Try to find Tuna instead
                    final tunaBadge = allBadges.values.where((b) => b.label.toLowerCase().contains('tuna')).firstOrNull;
                    if (tunaBadge != null) {
                      if (!finalBadges.any((b) => b.id == tunaBadge.id)) finalBadges.add(tunaBadge);
                    } else {
                      if (!finalBadges.any((b) => b.id == badge.id)) finalBadges.add(badge);
                    }
                }
            } else {
                if (!finalBadges.any((b) => b.id == badge.id)) {
                   finalBadges.add(badge);
                }
            }
        }

        _activeBadges = finalBadges;
      });
    }
  }

  @override
  void didUpdateWidget(KermesCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    // Prevent infinite setState loop:
    // 1. Lists in Dart are not equal even if contents are same, so we join to string.
    // 2. Position's timestamp changes constantly, so only reload if lat/lng meaningfully changed.
    final oldLat = oldWidget.currentPosition?.latitude?.toStringAsFixed(3) ?? '';
    final oldLng = oldWidget.currentPosition?.longitude?.toStringAsFixed(3) ?? '';
    final newLat = widget.currentPosition?.latitude?.toStringAsFixed(3) ?? '';
    final newLng = widget.currentPosition?.longitude?.toStringAsFixed(3) ?? '';
    
    final locationChanged = (oldLat != newLat) || (oldLng != newLng);
    final badgesChanged = oldWidget.event.activeBadgeIds.join(',') != widget.event.activeBadgeIds.join(',');

    if (locationChanged || badgesChanged) {
      _loadBadges();
    }
  }

  Future<void> _checkFavorite() async {
    final isFav =
        await KermesFavoriteService.instance.isFavorite(widget.event.id);
    if (mounted) {
      setState(() => _isFavorite = isFav);
    }
  }

  Future<void> _toggleFavorite() async {
    final newState =
        await KermesFavoriteService.instance.toggleFavorite(widget.event);
    if (mounted) {
      setState(() => _isFavorite = newState);
      HapticFeedback.lightImpact();
      widget.onFavoriteChanged?.call();
    }
  }

  void _showBadgeDetailsBottomSheet(KermesBadge badge) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        
        return Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).padding.bottom + 24,
            top: 12,
            left: 24,
            right: 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Bottom sheet handle
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey[700] : Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
                margin: const EdgeInsets.only(bottom: 24),
              ),
              if (badge.iconUrl.isNotEmpty) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: LokmaNetworkImage(
                    imageUrl: badge.iconUrl,
                    height: 80,
                    fit: BoxFit.contain,
                    placeholder: (context, url) =>
                        const SizedBox(height: 80, child: Center(child: CircularProgressIndicator())),
                    errorWidget: (context, url, error) =>
                        const SizedBox(height: 80, child: Icon(Icons.verified, size: 60, color: Colors.grey)),
                  ),
                ),
                const SizedBox(height: 20),
              ],
              Text(
                badge.label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 16),
              if (badge.description.isNotEmpty)
                Text(
                  badge.description,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    height: 1.5,
                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                  ),
                )
              else
                Text(
                  'Bu kermes ${badge.label} onaylı ürünler ve sertifikalı tedarikçiler ile çalışmaktadır.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    height: 1.5,
                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                  ),
                ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFB335B),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Tamam',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String? _getImagePath() {
    if (widget.event.headerImage != null &&
        widget.event.headerImage!.isNotEmpty) {
      return widget.event.headerImage;
    } else if (widget.event.flyers.isNotEmpty) {
      return widget.event.flyers.first;
    } else if (widget.event.menu.isNotEmpty &&
        widget.event.menu
            .any((m) => m.imageUrl != null || m.imageUrls.isNotEmpty)) {
      final item = widget.event.menu
          .firstWhere((m) => m.imageUrl != null || m.imageUrls.isNotEmpty);
      return item.imageUrls.isNotEmpty ? item.imageUrls.first : item.imageUrl;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    // Theme Colors (Marketplace Standards)
    final Color cardDark =
        const Color(0xFF1E1E1E); // Refined dark mode card color
    final Color textDark = const Color(0xFF2D3748);
    final Color primaryRose = const Color(0xFFE50914);

    final String? _rawPath = _getImagePath();
    final String? imagePath = (_rawPath != null && _rawPath.isNotEmpty) ? _rawPath : null;
    final bool isNetworkImage =
        imagePath != null && imagePath.startsWith('http');

    // Date formatting for "01.04 - 07.04.2026"
    final DateFormat formatter = DateFormat('dd.MM.yyyy');
    final String dateRangeText =
        '${DateFormat('dd.MM').format(widget.event.startDate)} - ${formatter.format(widget.event.endDate)}';

    // Address format logic
    final parts = <String>[];
    if (widget.event.city.isNotEmpty) {
      if (widget.event.postalCode.isNotEmpty) {
        parts.add('${widget.event.postalCode} ${widget.event.city}');
      } else {
        parts.add(widget.event.city);
      }
    }
    if (widget.event.state != null &&
        widget.event.state!.isNotEmpty &&
        widget.event.country.toLowerCase() == 'almanya') {
      parts.add(widget.event.state!);
    }
    if (widget.event.country.isNotEmpty) {
      parts.add('${_getLocalizedCountry(widget.event.country)} ${_getCountryFlag(widget.event.country)}');
    }
    final formattedLocation = parts.join(' • ');

    // Live/Countdown logic
    final now = DateTime.now();
    final isLive = now.isAfter(widget.event.startDate) &&
        now.isBefore(widget.event.endDate);
    final daysLeft = widget.event.startDate.difference(now).inDays;

    // Banner top right status logic
    String bannerRightText = '';
    final DateTime today = DateTime(now.year, now.month, now.day);
    final DateTime startDateLocal = DateTime(widget.event.startDate.year,
        widget.event.startDate.month, widget.event.startDate.day);
    final DateTime endDateLocal = DateTime(widget.event.endDate.year,
        widget.event.endDate.month, widget.event.endDate.day);

    if (today.isBefore(startDateLocal)) {
      final int daysUntilStart = startDateLocal.difference(today).inDays;
      bannerRightText =
          'kermes.days_remaining'.tr(args: [daysUntilStart.toString()]);
    } else if (today.isAfter(endDateLocal)) {
      bannerRightText = 'kermes.ended'.tr();
    } else if (today.isAtSameMomentAs(endDateLocal)) {
      bannerRightText = 'kermes.last_day'.tr();
    } else {
      final currentDay = today.difference(startDateLocal).inDays + 1;
      bannerRightText = 'kermes.day_ordinal'.tr(args: [currentDay.toString()]);
    }

    // Wallet-stack: Blue date card peeks from behind main card
    const double bannerHeight = 120.0; // Full blue wallet card height
    const double bannerPeekHeight = 30.0; // Visible peek strip

    if (isLive) {
      // currently open
    } else if (daysLeft == 0) {
      // starting today
    } else if (daysLeft > 0) {
      // days remaining
    } else {
      // has ended
    }

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.of(context, rootNavigator: true).push(
          MaterialPageRoute(
            builder: (context) => KermesDetailScreen(
              event: widget.event,
              currentPosition: widget.currentPosition,
            ),
          ),
        );
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        margin: const EdgeInsets.only(bottom: 16),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // 🗓️ DATE BANNER (Nested Wallet Style)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                height: bannerHeight,
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF2D2D2D)
                      : const Color(0xFF4A4A4A),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Stack(
                  children: [
                    Align(
                      alignment: Alignment.topCenter,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          dateRangeText,
                          style: GoogleFonts.inter(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    if (bannerRightText.isNotEmpty)
                      Positioned(
                        right: 16,
                        top: 6,
                        child: Text(
                          bannerRightText,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // ⬜ MAIN FRONT CARD
            Container(
              margin: const EdgeInsets.only(top: bannerPeekHeight),
              decoration: BoxDecoration(
                color: isDark ? cardDark : cardLight,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                    spreadRadius: 0,
                  ),
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
                border: Border(
                  top: BorderSide.none,
                  bottom: BorderSide(
                    color: isDark
                        ? Colors.white.withOpacity(0.08)
                        : Colors.black.withOpacity(0.08),
                    width: 0.5,
                  ),
                  left: BorderSide(
                    color: isDark
                        ? Colors.white.withOpacity(0.08)
                        : Colors.black.withOpacity(0.08),
                    width: 0.5,
                  ),
                  right: BorderSide(
                    color: isDark
                        ? Colors.white.withOpacity(0.08)
                        : Colors.black.withOpacity(0.08),
                    width: 0.5,
                  ),
                ),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // --- TOP SECTION: IMAGE ---
                  Stack(
                    children: [
                      SizedBox(
                        height: 230,
                        width: double.infinity,
                        child: imagePath != null
                            ? (isNetworkImage
                                ? LokmaNetworkImage(
                                    imageUrl: imagePath,
                                    fit: BoxFit.cover,
                                    fadeInDuration: Duration.zero,
                                    fadeOutDuration: Duration.zero,
                                    useOldImageOnUrlChange: true,
                                    placeholder: (context, url) =>
                                        Container(color: Colors.grey[200]),
                                    errorWidget: (context, url, error) =>
                                        Container(
                                      color: Colors.grey[200],
                                      child: const Center(
                                          child: Icon(Icons.image_not_supported,
                                              color: Colors.grey)),
                                    ),
                                  )
                                : Image.asset(imagePath, fit: BoxFit.cover))
                            : _buildFallbackGradient(),
                      ),

                      // Top Right: Favorite Button
                      Positioned(
                        top: 12,
                        right: 12,
                        child: GestureDetector(
                          onTap: _toggleFavorite,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(50),
                            child: BackdropFilter(
                              filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                color: Colors.white.withOpacity(0.2),
                                child: Icon(
                                  _isFavorite
                                      ? Icons.favorite
                                      : Icons.favorite_outline,
                                  color:
                                      _isFavorite ? primaryRose : Colors.white,
                                  size: 24,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                      // Top Left: Dynamic Badges (Zertifikate)
                      if (_activeBadges.isNotEmpty)
                        Positioned(
                          top: 12,
                          left: 12,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: _activeBadges.map((badge) {
                              // Parse badge colors from Firestore
                              final bgColor = Color(int.parse(
                                  badge.colorHex.replaceFirst('#', '0xFF')));
                              final textColor = Color(int.parse(
                                  badge.textColorHex.replaceFirst('#', '0xFF')));
                              final bool hasIcon = badge.iconUrl.isNotEmpty;

                              return GestureDetector(
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  final labelLower = badge.label.toLowerCase();
                                  if (labelLower.contains('tuna')) {
                                    BrandInfoSheet.show(context, forcedBrand: 'tuna');
                                  } else if (labelLower.contains('toros')) {
                                    BrandInfoSheet.show(context, forcedBrand: 'toros');
                                  } else {
                                    _showBadgeDetailsBottomSheet(badge);
                                  }
                                },
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 6),
                                  child: Container(
                                    padding: hasIcon
                                        ? EdgeInsets.zero
                                        : const EdgeInsets.symmetric(
                                            horizontal: 12, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: hasIcon ? Colors.transparent : bgColor,
                                      borderRadius: hasIcon ? BorderRadius.circular(8) : BorderRadius.circular(50),
                                      border: hasIcon ? null : Border.all(color: Colors.white24, width: 0.5),
                                      boxShadow: [
                                        if (!hasIcon)
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.25),
                                            blurRadius: 4,
                                            offset: const Offset(0, 2),
                                          ),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (hasIcon)
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(8),
                                            child: LokmaNetworkImage(
                                              imageUrl: badge.iconUrl,
                                              height: 33,
                                              fit: BoxFit.contain,
                                              placeholder: (context, url) => Container(
                                                color: Colors.transparent,
                                                height: 33,
                                                width: 33,
                                              ),
                                              errorWidget: (context, url, error) =>
                                                  Icon(Icons.verified, color: textColor, size: 20),
                                            ),
                                          )
                                        else if (badge.label.isNotEmpty) ...[
                                          Icon(Icons.verified, color: textColor, size: 14),
                                          const SizedBox(width: 4),
                                          Text(
                                            badge.label,
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: textColor,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Icon(
                                            Icons.info_outline,
                                            color: textColor.withOpacity(0.8),
                                            size: 14,
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),

                      // Bottom Right: Modalities
                      Positioned(
                        bottom: 12,
                        right: 12,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                          if (widget.event.isMenuOnly)
                              _buildModalityPill(Icons.restaurant_menu,
                                  'kermes.no_orders'.tr()),
                            if (!widget.event.isMenuOnly &&
                                widget.event.hasDineIn)
                              _buildModalityPill(Icons.table_restaurant,
                                  'kermes.dine_in_service'.tr()),
                            if (!widget.event.isMenuOnly &&
                                widget.event.hasTakeaway)
                              _buildModalityPill(Icons.phone_iphone,
                                  'kermes.order_via_app'.tr()),
                          ],
                        ),
                      ),
                    ],
                  ),

                  // --- BOTTOM SECTION: CONTENT ---
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title Header
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    widget.event.title,
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                      height: 1.2,
                                      color: isDark ? Colors.white : textDark,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Icon(Icons.location_on_outlined,
                                          size: 15, color: primaryRose),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: Text(
                                          formattedLocation,
                                          style: TextStyle(
                                            color: isDark
                                                ? Colors.grey[300]
                                                : Colors.grey[700],
                                            fontSize: 14.5,
                                            fontWeight: FontWeight.w500,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 8),

                        // Thin Full-width Divider
                        const SizedBox(height: 8),
                        Divider(
                            color: isDark ? Colors.grey[800] : Colors.grey[200],
                            height: 1),
                        const SizedBox(height: 12),

                        // Info Row (Distance + Courier)
                        Row(
                          children: [
                            GestureDetector(
                              onTap: () {
                                if (widget.currentPosition == null) return;
                                HapticFeedback.lightImpact();
                                final lat = widget.event.latitude;
                                final lng = widget.event.longitude;
                                final label =
                                    Uri.encodeComponent(widget.event.title);
                                final addressStr =
                                    Uri.encodeComponent(widget.event.address);
                                // Apple Maps with driving directions
                                final url = (lat == 0.0 && lng == 0.0 && widget.event.address.isNotEmpty)
                                    ? Uri.parse('https://maps.apple.com/?daddr=$addressStr&dirflg=d&t=m&q=$label')
                                    : Uri.parse('https://maps.apple.com/?daddr=$lat,$lng&dirflg=d&t=m&q=$label');
                                launchUrl(url,
                                    mode: LaunchMode.externalApplication);
                              },
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _buildIconText(Icons.near_me,
                                      '$_distanceKm km', primaryRose, isDark),
                                  const SizedBox(width: 12),
                                  _buildIconText(
                                      Icons.directions_car,
                                      '~$_travelTime',
                                      primaryRose,
                                      isDark),
                                ],
                              ),
                            ),
                            const Spacer(),
                            if (widget.event.hasDelivery)
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.delivery_dining,
                                      size: 17,
                                      color: isDark
                                          ? Colors.green[400]
                                          : const Color(0xFF059669)),
                                  const SizedBox(width: 5),
                                  Text(
                                    'kermes.courier_fee'.tr(args: [
                                      widget.event.deliveryFee > 0
                                          ? '${widget.event.deliveryFee.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}'
                                          : 'kermes.free_delivery'.tr()
                                    ]),
                                    style: TextStyle(
                                      color: isDark
                                          ? Colors.green[400]
                                          : const Color(0xFF059669),
                                      fontSize: 15, // Bir tık daha büyütüldü
                                      fontWeight: FontWeight.w700, // Daha net olsun diye w700'e çekildi
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ],
                    ),
                  ), // --- SPONSORED PRODUCTS (Reklam Altyapisi) ---
                  if (widget.event.sponsoredMenuItems.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: _buildSponsoredProductsSection(isDark),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- Helpers ---
  String _getLocalizedCountry(String rawCountry) {
    if (rawCountry.isEmpty) return rawCountry;
    
    final lang = context.locale.languageCode;
    final lower = rawCountry.toLowerCase();
    
    // Check if it's Norway
    final isNorway = lower.contains("norve") || lower.contains("norway") || lower.contains("norwegen");
    // Check if it's Germany
    final isGermany = lower.contains("alman") || lower.contains("german") || lower.contains("deutsch");
    
    if (lang == 'de') {
      if (isNorway) return "Norwegen";
      if (isGermany) return "Deutschland";
    } else if (lang == 'tr') {
      if (isNorway) return "Norveç";
      if (isGermany) return "Almanya";
    } else if (lang == 'nl') {
       if (isNorway) return "Noorwegen";
       if (isGermany) return "Duitsland";
    } else if (lang == 'en') {
       if (isNorway) return "Norway";
       if (isGermany) return "Germany";
    } else if (lang == 'fr') {
       if (isNorway) return "Norvège";
       if (isGermany) return "Allemagne";
    } else if (lang == 'it') {
       if (isNorway) return "Norvegia";
       if (isGermany) return "Germania";
    } else if (lang == 'es') {
       if (isNorway) return "Noruega";
       if (isGermany) return "Alemania";
    }
    return rawCountry.split(' ').first;
  }

  String _getCountryFlag(String country) {
    final lower = country.toLowerCase()
        .replaceAll('\u0131', 'i')
        .replaceAll('\u00fc', 'u')
        .replaceAll('\u00f6', 'o')
        .replaceAll('\u015f', 's')
        .replaceAll('\u00e7', 'c')
        .replaceAll('\u011f', 'g');
    if (lower.contains('avusturya') || lower.contains('austria') || lower.contains('osterreich') || lower == 'at') return '\u{1F1E6}\u{1F1F9}';
    if (lower.contains('sirbistan') || lower.contains('serbia') || lower.contains('serbien') || lower == 'rs') return '\u{1F1F7}\u{1F1F8}';
    if (lower.contains('bulgaristan') || lower.contains('bulgaria') || lower.contains('bulgarien') || lower == 'bg') return '\u{1F1E7}\u{1F1EC}';
    if (lower.contains('turkiye') || lower.contains('turkey') || lower.contains('turkei') || lower == 'tr') return '\u{1F1F9}\u{1F1F7}';
    if (lower.contains('hollanda') || lower.contains('netherlands') || lower.contains('niederlande') || lower == 'nl') return '\u{1F1F3}\u{1F1F1}';
    if (lower.contains('fransa') || lower.contains('france') || lower.contains('frankreich') || lower == 'fr') return '\u{1F1EB}\u{1F1F7}';
    if (lower.contains('belcika') || lower.contains('belgium') || lower.contains('belgien') || lower == 'be') return '\u{1F1E7}\u{1F1EA}';
    if (lower.contains('isvicre') || lower.contains('switzerland') || lower.contains('schweiz') || lower == 'ch') return '\u{1F1E8}\u{1F1ED}';
    if (lower.contains('macaristan') || lower.contains('hungary') || lower.contains('ungarn') || lower == 'hu') return '🇭🇺';
    if (lower.contains('norvec') || lower.contains('norway') || lower.contains('norwegen') || lower == 'no') return '🇳🇴';
    if (lower.contains('danimarka') || lower.contains('denmark') || lower.contains('danemark') || lower == 'dk') return '🇩🇰';
    if (lower.contains('isvec') || lower.contains('sweden') || lower.contains('schweden') || lower == 'se') return '🇸🇪';
    if (lower.contains('ispanya') || lower.contains('spain') || lower.contains('spanien') || lower == 'es') return '🇪🇸';
    if (lower.contains('romanya') || lower.contains('romania') || lower.contains('rumanien') || lower == 'ro') return '🇷🇴';
    if (lower.contains('italya') || lower.contains('italy') || lower.contains('italien') || lower == 'it') return '🇮🇹';
    if (lower.contains('meksika') || lower.contains('mexico') || lower.contains('mexiko') || lower == 'mx') return '🇲🇽';
    if (lower.contains('yunanistan') || lower.contains('greece') || lower.contains('griechenland') || lower == 'gr') return '🇬🇷';
    if (lower.contains('almanya') || lower.contains('germany') || lower.contains('deutschland') || lower == 'de') return '🇩🇪';
    return ''; // Varsayilan olarak bilmedigimiz yerlere Almanya bayragi basmamak icin bos ceviriyoruz.
  }

  String get _distanceKm {
    if (widget.currentPosition == null || (widget.event.latitude == 0.0 && widget.event.longitude == 0.0)) return '~';
    final dist = Geolocator.distanceBetween(
          widget.currentPosition!.latitude,
          widget.currentPosition!.longitude,
          widget.event.latitude,
          widget.event.longitude,
        ) /
        1000;
    return dist.toStringAsFixed(0);
  }

  String get _travelTime {
    if (widget.currentPosition == null || (widget.event.latitude == 0.0 && widget.event.longitude == 0.0)) return '-- dk';
    final dist = Geolocator.distanceBetween(
          widget.currentPosition!.latitude,
          widget.currentPosition!.longitude,
          widget.event.latitude,
          widget.event.longitude,
        ) /
        1000;
    final totalMins = (dist / 80 * 60).round(); // ortalama 80 km/h surus hizi
    if (totalMins < 60) return '$totalMins dk';
    final days = totalMins ~/ (24 * 60);
    final hours = (totalMins % (24 * 60)) ~/ 60;
    final mins = totalMins % 60;
    final parts = <String>[];
    if (days > 0) parts.add('$days g\u00fcn');
    if (hours > 0) parts.add('$hours sa');
    if (mins > 0) parts.add('$mins dk');
    return parts.join(' ');
  }

  Widget _buildFallbackGradient() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2C3E50), Color(0xFF4CA1AF)],
        ),
      ),
      child: const Center(
          child: Icon(Icons.storefront, size: 50, color: Colors.white24)),
    );
  }

  Widget _buildIconText(
      IconData icon, String text, Color iconColor, bool isDark) {
    return Row(
      children: [
        Icon(icon, size: 18, color: iconColor),
        const SizedBox(width: 4),
        Text(
          text,
          style: TextStyle(
            color: isDark ? Colors.grey[300] : Colors.grey[700],
            fontSize: 14.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  // --- SPONSORED PRODUCTS SECTION (Reklam Altyapisi) ---
  // Lieferando/Wolt "Gesponsert" tarzi horizontal kaydirmali reklam alani
  // Ileride Firestore'dan sponsoredProductIds ile doldurulacak
  Widget _buildSponsoredProductsSection(bool isDark) {
    final sponsoredItems = <KermesMenuItem>[];
    for (final idx in widget.event.sponsoredMenuItems) {
      if (idx >= 0 && idx < widget.event.menu.length) {
        sponsoredItems.add(widget.event.menu[idx]);
      }
    }
    if (sponsoredItems.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2A2520) : const Color(0xFFDBE0A9),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'kermes.featured'.tr(),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.grey[800]!.withOpacity(0.6)
                        : Colors.white.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'kermes.ad_label'.tr(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.grey[400] : Colors.grey[500],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Horizontal Product Cards
          SizedBox(
            height: 170,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: sponsoredItems.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                return _buildSponsoredProductCard(
                    sponsoredItems[index], isDark);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSponsoredProductCard(KermesMenuItem item, bool isDark) {
    final hasImage = item.allImages.isNotEmpty;
    final imageUrl = hasImage ? item.allImages.first : null;

    return Container(
      width: 130,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product Image
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            child: hasImage && imageUrl != null && imageUrl.startsWith('http')
                ? LokmaNetworkImage(
                    imageUrl: imageUrl,
                    width: 130,
                    height: 85,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      width: 130,
                      height: 85,
                      color: isDark ? Colors.grey[800] : Colors.grey[100],
                      child: Icon(Icons.restaurant,
                          color: Colors.grey[400], size: 24),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      width: 130,
                      height: 85,
                      color: isDark ? Colors.grey[800] : Colors.grey[100],
                      child: Icon(Icons.restaurant,
                          color: Colors.grey[400], size: 24),
                    ),
                  )
                : Container(
                    width: 130,
                    height: 85,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isDark
                            ? [const Color(0xFF2C3E50), const Color(0xFF34495E)]
                            : [
                                const Color(0xFFF8F4EF),
                                const Color(0xFFF0E8DD)
                              ],
                      ),
                    ),
                    child: Icon(
                      Icons.restaurant_menu,
                      color: isDark ? Colors.grey[600] : Colors.grey[400],
                      size: 28,
                    ),
                  ),
          ),
          // Product Info
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                      height: 1.2,
                    ),
                  ),
                  const Spacer(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${item.price.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward_ios,
                        size: 12,
                        color: isDark ? Colors.grey[600] : Colors.grey[400],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModalityPill(IconData icon, String tooltip) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(50),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            color: Colors.black.withOpacity(0.5),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: Colors.white, size: 13),
                const SizedBox(width: 4),
                Text(
                  tooltip,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10, 
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
