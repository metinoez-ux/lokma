import 'dart:ui';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/screens/kermes/kermes_menu_screen.dart';
import 'package:lokma_app/services/kermes_favorite_service.dart';
import '../../services/kermes_badge_service.dart';
import '../../services/kermes_favorite_service.dart';
import '../../screens/kermes/kermes_menu_screen.dart';
import '../../screens/kermes/kermes_detail_screen.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../utils/currency_utils.dart';
import 'package:google_fonts/google_fonts.dart';

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
    if (widget.event.activeBadgeIds.isEmpty) return;

    final allBadges = await KermesBadgeService.instance.loadBadges();
    if (mounted) {
      setState(() {
        _activeBadges = widget.event.activeBadgeIds
            .where((id) => allBadges.containsKey(id))
            .map((id) => allBadges[id]!)
            .toList();
      });
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

    final String? imagePath = _getImagePath();
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
      parts.add(widget.event.country);
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
        margin: const EdgeInsets.only(bottom: 8),
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
                  gradient: LinearGradient(
                    colors: isDark
                        ? [const Color(0xFF1E3A8A), const Color(0xFF1E40AF)]
                        : [const Color(0xFFDBEAFE), const Color(0xFFBFDBFE)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Stack(
                  children: [
                    Align(
                      alignment: Alignment.topCenter,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.calendar_month,
                                size: 14,
                                color: isDark
                                    ? Colors.white
                                    : const Color(0xFF1E3A8A)),
                            const SizedBox(width: 6),
                            Text(
                              dateRangeText,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w300,
                                letterSpacing: 0.5,
                                color: isDark
                                    ? Colors.white
                                    : const Color(0xFF1E3A8A),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (bannerRightText.isNotEmpty)
                      Positioned(
                        right: 12,
                        top: 5,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isDark
                                ? Colors.black26
                                : Colors.white.withOpacity(0.5),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            bannerRightText,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isDark
                                  ? Colors.white
                                  : const Color(0xFF1E3A8A),
                            ),
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
                                ? CachedNetworkImage(
                                    imageUrl: imagePath,
                                    fit: BoxFit.cover,
                                    memCacheHeight: 600,
                                    maxWidthDiskCache: 800,
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

                      // Bottom Left: Dynamic Badges (Zertifikate)
                      if (_activeBadges.isNotEmpty)
                        Positioned(
                          bottom: 12,
                          left: 12,
                          child: Row(
                            children: _activeBadges.map((badge) {
                              return Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black
                                            .withOpacity(0.15),
                                        blurRadius: 4,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: ClipOval(
                                    child: CachedNetworkImage(
                                      imageUrl: badge.iconUrl,
                                      height: 34,
                                      width: 34,
                                      fit: BoxFit.cover,
                                      placeholder: (context, url) => Container(
                                        color: Colors.grey[200],
                                        height: 34,
                                        width: 34,
                                      ),
                                      errorWidget: (context, url, error) =>
                                          const SizedBox.shrink(),
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
                                  'delivery_modes.dine_in'.tr()),
                            if (!widget.event.isMenuOnly &&
                                widget.event.hasTakeaway)
                              _buildModalityPill(Icons.shopping_bag_outlined,
                                  'delivery_modes.pickup'.tr()),
                            if (!widget.event.isMenuOnly &&
                                widget.event.hasDelivery)
                              _buildModalityPill(
                                Icons.two_wheeler,
                                widget.event.deliveryFee > 0
                                    ? '${'delivery_modes.delivery'.tr()} (${widget.event.deliveryFee.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()})'
                                    : '${'delivery_modes.delivery'.tr()} (${'kermes.free_delivery'.tr()})',
                              ),
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
                                      Icon(Icons.flag,
                                          size: 14, color: primaryRose),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: Text(
                                          formattedLocation,
                                          style: TextStyle(
                                            color: isDark
                                                ? Colors.grey[400]
                                                : Colors.grey[500],
                                            fontSize: 13,
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
                            if (widget.currentPosition != null)
                              GestureDetector(
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  final lat = widget.event.latitude;
                                  final lng = widget.event.longitude;
                                  final label =
                                      Uri.encodeComponent(widget.event.title);
                                  // Apple Maps with driving directions
                                  final url = Uri.parse(
                                      'https://maps.apple.com/?daddr=$lat,$lng&dirflg=d&t=m&q=$label');
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
                                        '~$_travelTime ${'delivery_modes.minutes_short'.tr()}',
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
                                  Icon(Icons.two_wheeler,
                                      size: 16,
                                      color: isDark
                                          ? Colors.green[400]
                                          : const Color(0xFF059669)),
                                  const SizedBox(width: 5),
                                  Text(
                                    'kermes.courier_fee'.tr(args: [
                                      widget.event.deliveryFee > 0
                                          ? '${widget.event.deliveryFee}${CurrencyUtils.getCurrencySymbol()}'
                                          : 'kermes.free_delivery'.tr()
                                    ]),
                                    style: TextStyle(
                                      color: isDark
                                          ? Colors.green[400]
                                          : const Color(0xFF059669),
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
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
  String get _distanceKm {
    if (widget.currentPosition == null) return '';
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
    if (widget.currentPosition == null) return '';
    final dist = Geolocator.distanceBetween(
          widget.currentPosition!.latitude,
          widget.currentPosition!.longitude,
          widget.event.latitude,
          widget.event.longitude,
        ) /
        1000;
    final mins = (dist / 60 * 60).round();
    return mins.toString();
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
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 4),
        Text(
          text,
          style: TextStyle(
            color: isDark ? Colors.grey[400] : Colors.grey[500],
            fontSize: 12,
            fontWeight: FontWeight.w500,
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
                ? CachedNetworkImage(
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
                Icon(icon, color: Colors.white, size: 12),
                const SizedBox(width: 4),
                Text(
                  tooltip,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
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
