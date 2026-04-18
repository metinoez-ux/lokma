import 'package:flutter/material.dart';
import '../../../widgets/brand_info_sheet.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../../providers/butcher_favorites_provider.dart';
import '../../../utils/currency_utils.dart';
import '../../../models/table_group_session_model.dart';
import '../../../providers/platform_brands_provider.dart';
import '../../../widgets/group_order_setup_sheet.dart';
import '../../../widgets/marketplace_group_share_sheet.dart';

class WalletBusinessCard extends ConsumerWidget {
  final Map<String, dynamic> data;
  final String id;
  final String name;
  final String? logoUrl;
  final String? imageUrl;
  final bool isAvailable;
  final String unavailableReason;
  final bool isTunaPartner;
  final String deliveryMode;
  final double rating;
  final String reviewText;
  final String typeLabel;
  final String? cuisineType;
  final double distance;
  final Function() onTap;
  final Function(BuildContext, String, String, Map<String, dynamic>)
      showClosedDialog;

  const WalletBusinessCard({
    super.key,
    required this.data,
    required this.id,
    required this.name,
    this.logoUrl,
    this.imageUrl,
    required this.isAvailable,
    required this.unavailableReason,
    required this.isTunaPartner,
    required this.deliveryMode,
    required this.rating,
    required this.reviewText,
    required this.typeLabel,
    this.cuisineType,
    required this.distance,
    required this.onTap,
    required this.showClosedDialog,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const Color lokmaPink = Color(0xFFF04A41);
    const Color tunaGreen = Color(0xFF2E7D32);
    final isFavorite = ref.watch(butcherFavoritesProvider).contains(id);
    
    // Helper for robust type extraction
    bool checkIsMarket(Map<String, dynamic> d) {
      final str = [
        d['type'],
        d['types'],
        d['businessType'],
        d['cuisineType'],
        d['category'],
        d['tags'],
      ].join(' ').toLowerCase();
      
      // If ANY of the classification fields contain "market", "markt" (German), or "bakkal", treat it as a market!
      return str.contains('market') || str.contains('markt') || str.contains('bakkal') || str.contains('grocery');
    }
    
    // 🆕 PLATFORM BRANDS & BADGES (Dynamic Sync)
    final bool isMarket = checkIsMarket(data);
    final platformBrandsAsync = ref.watch(platformBrandsProvider);
    final activeBrandIds = List<String>.from(data['activeBrandIds'] ?? []);
    final bool hasNewBrandSystem = data.containsKey('activeBrandIds') && (data['activeBrandIds'] as List).isNotEmpty;
    final List<Map<String, dynamic>> activeBadges = [];
    platformBrandsAsync.whenData((brands) {
      // KURAL 1: Platform Badge (activeBrandIds) = Admin karari, isletme tipi farketmez
      for (final brand in brands) {
        if (activeBrandIds.contains(brand.id)) {
          activeBadges.add({
            'name': brand.name,
            'iconUrl': brand.iconUrl,
          });
        }
      }

      // KURAL 3: Legacy fallback - SADECE yeni sistem YOKSA (activeBrandIds bos ise)
      if (activeBadges.isEmpty && !hasNewBrandSystem && data['brandLabelActive'] == true) {
        bool showLegacyTuna = data['brand'] == 'tuna' || isTunaPartner;
        if (showLegacyTuna) {
          try {
            final dynamicBrand = brands.firstWhere((b) => b.name.toLowerCase().contains('tuna'));
            activeBadges.add({'name': dynamicBrand.name, 'iconUrl': dynamicBrand.iconUrl});
          } catch (e) {
            activeBadges.add({'name': 'TUNA', 'iconUrl': 'assets/images/tuna_logo_pill.png', 'isLegacyTuna': true});
          }
        }
        bool showLegacyToros = data['brand'] == 'akdeniz_toros';
        if (showLegacyToros) {
          try {
            final dynamicBrand = brands.firstWhere((b) => b.name.toLowerCase().contains('toros'));
            activeBadges.add({'name': dynamicBrand.name, 'iconUrl': dynamicBrand.iconUrl});
          } catch (e) {
            activeBadges.add({'name': 'Akdeniz Toros', 'iconUrl': 'assets/images/akdeniz_toros_logo_pill.png', 'isLegacyToros': true});
          }
        }
      }
    });

    // In case whenData hasn't executed synchronously (loading state)
    if (activeBadges.isEmpty && !hasNewBrandSystem && (platformBrandsAsync.isLoading || platformBrandsAsync.hasError)) {
      if (data['brandLabelActive'] == true) {
        bool showLegacyTuna = data['brand'] == 'tuna' || isTunaPartner;
        if (showLegacyTuna) {
          activeBadges.add({'name': 'TUNA', 'iconUrl': 'assets/images/tuna_logo_pill.png', 'isLegacyTuna': true});
        }
        bool showLegacyToros = data['brand'] == 'akdeniz_toros';
        if (showLegacyToros) {
          activeBadges.add({'name': 'Akdeniz Toros', 'iconUrl': 'assets/images/akdeniz_toros_logo_pill.png', 'isLegacyToros': true});
        }
      }
    }

    final String distanceText = distance < 1
        ? '${(distance * 1000).toInt()} m'
        : '${distance.toStringAsFixed(1).replaceAll('.', ',')} km';

    // Kalınlık ve Padding değerleri (Wallet Efekti)
    const double bannerHeight = 26.0;

    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 0, vertical: 8),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // 🟥 Arka Plan (Kapalı Banner - Wallet Arka Cebi Etkisi)
            if (!isAvailable)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  width: double.infinity,
                  height: bannerHeight +
                      20, // Alt kartın altına inmesi için ekstra yükseklik
                  padding: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: const Color(0xFF282726),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(16),
                      topRight: Radius.circular(16),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.info_outline,
                          color: Colors.white.withOpacity(0.9), size: 14),
                      const SizedBox(width: 6),
                      Text(
                        unavailableReason,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                          letterSpacing: 0.5,
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // ⬜ Ana Kart (Ön Yüz)
            Container(
              margin: EdgeInsets.only(top: !isAvailable ? bannerHeight : 0),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border(
                  top: !isAvailable
                      ? BorderSide.none
                      : BorderSide(
                          color: Theme.of(context).brightness == Brightness.dark
                              ? Colors.white.withOpacity(0.08)
                              : Colors.black.withOpacity(0.08),
                        ),
                  bottom: BorderSide(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.white.withOpacity(0.08)
                        : Colors.black.withOpacity(0.08),
                  ),
                  left: BorderSide(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.white.withOpacity(0.08)
                        : Colors.black.withOpacity(0.08),
                  ),
                  right: BorderSide(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.white.withOpacity(0.08)
                        : Colors.black.withOpacity(0.08),
                  ),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.black.withOpacity(0.5)
                        : Colors.black.withOpacity(0.1),
                    blurRadius: 12,
                    spreadRadius: 0,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(!isAvailable ? 16 : 15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Stack(
                      children: [
                        SizedBox(
                          height: 230,
                          width: double.infinity,
                          child: imageUrl != null && imageUrl!.isNotEmpty
                              ? LokmaNetworkImage(
                                  imageUrl: imageUrl!,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    color: Theme.of(context).brightness ==
                                            Brightness.dark
                                        ? const Color(0xFF2A2A28)
                                        : Colors.grey[200],
                                    child: Center(
                                      child: CircularProgressIndicator(
                                        color: lokmaPink,
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  ),
                                  errorWidget: (context, url, error) =>
                                      Container(
                                    color: Theme.of(context).brightness ==
                                            Brightness.dark
                                        ? const Color(0xFF2A2A28)
                                        : Colors.grey[200],
                                    child: const Center(
                                      child: Icon(Icons.restaurant,
                                          color: lokmaPink, size: 48),
                                    ),
                                  ),
                                )
                              : Container(
                                  color: Theme.of(context).brightness ==
                                          Brightness.dark
                                      ? const Color(0xFF2A2A28)
                                      : Colors.grey[200],
                                  child: const Center(
                                    child: Icon(Icons.restaurant,
                                        color: lokmaPink, size: 48),
                                  ),
                                ),
                        ),
                        if (!isAvailable)
                          Positioned.fill(
                            child: Container(
                              color: Colors.black.withOpacity(0.4),
                            ),
                          ),

                        // Masa Rezervasyonu badge overlay warning
                        if (deliveryMode == 'masada' &&
                            (data['hasReservation'] as bool? ?? false))
                          Positioned(
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  vertical: 4, horizontal: 8),
                              color: Colors.black.withOpacity(0.65),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.info_outline,
                                      color: Colors.white, size: 14),
                                  const SizedBox(width: 4),
                                  Flexible(
                                    child: Text(
                                      tr('marketplace.business_approval_required'),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      textAlign: TextAlign.center,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                        // ==========================================
                        // 3. BOTTOM-RIGHT CORNER: Contextual Event Badges
                        // ==========================================
                        Positioned(
                          right: 12,
                          bottom: 12,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              if (data['hasReservation'] == true &&
                                  deliveryMode == 'masada')
                                Opacity(
                                  opacity: isAvailable ? 1.0 : 0.7,
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: lokmaPink.withOpacity(0.9),
                                      borderRadius: BorderRadius.circular(14),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black
                                              .withOpacity(0.3),
                                          blurRadius: 4,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        SvgPicture.asset(
                                          'assets/images/icon_masa_rezervasyon.svg',
                                          width: 16,
                                          height: 16,
                                          colorFilter: const ColorFilter.mode(
                                              Colors.white, BlendMode.srcIn),
                                        ),
                                        Text(
                                          'marketplace.online_table_reservation_badge'
                                              .tr(),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 0.3,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              if (deliveryMode == 'masada' &&
                                  (data['groupOrderLinkEnabled'] == true ||
                                      data['groupOrderTableEnabled'] == true ||
                                      data['dineInEnabled'] == true))
                                Opacity(
                                  opacity: isAvailable ? 1.0 : 0.7,
                                  child: GestureDetector(
                                    onTap: () async {
                                      HapticFeedback.lightImpact();
                                      if (!isAvailable) {
                                        showClosedDialog(context, name,
                                            unavailableReason, data);
                                        return;
                                      }

                                      final session =
                                          await showModalBottomSheet<
                                              TableGroupSession>(
                                        context: context,
                                        useRootNavigator: true,
                                        shape: const RoundedRectangleBorder(
                                          borderRadius: BorderRadius.vertical(
                                              top: Radius.circular(24)),
                                        ),
                                        backgroundColor:
                                            Theme.of(context).brightness ==
                                                    Brightness.dark
                                                ? const Color(0xFF2A2A28)
                                                : Colors.white,
                                        isScrollControlled: true,
                                        builder: (ctx) => GroupOrderSetupSheet(
                                          businessId: id,
                                          businessName: name,
                                        ),
                                      );

                                      if (session != null && context.mounted) {
                                        await showModalBottomSheet(
                                          context: context,
                                          useRootNavigator: true,
                                          isScrollControlled: true,
                                          backgroundColor: Colors.transparent,
                                          builder: (ctx) =>
                                              MarketplaceGroupShareSheet(
                                                  session: session),
                                        );
                                        if (context.mounted) {
                                          final encodedName =
                                              Uri.encodeComponent(name);
                                          final tableNum =
                                              session.tableNumber.isNotEmpty
                                                  ? session.tableNumber
                                                  : 'delivery';
                                          context.push(
                                              '/kasap/$id?mode=$deliveryMode&groupSessionId=${session.id}&businessName=$encodedName&table=$tableNum');
                                        }
                                      }
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 5),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF2E7D32)
                                            .withOpacity(0.9),
                                        borderRadius: BorderRadius.circular(14),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black
                                                .withOpacity(0.3),
                                            blurRadius: 4,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.groups_rounded,
                                              color: Colors.white, size: 16),
                                          const SizedBox(width: 6),
                                          Text(
                                            tr('marketplace.group_order_badge'),
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              letterSpacing: 0.3,
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

                        // ==========================================
                        // 4. BOTTOM-LEFT CORNER: Logo Identity
                        // ==========================================
                        if (logoUrl != null && logoUrl!.isNotEmpty)
                          Positioned(
                            left: 12,
                            bottom: 12,
                            child: Opacity(
                              opacity: isAvailable ? 1.0 : 0.7,
                              child: Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surface,
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface
                                          .withOpacity(0.2),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: LokmaNetworkImage(
                                    imageUrl: logoUrl!,
                                    fit: BoxFit.cover,
                                    errorWidget: (_, __, ___) => const Center(
                                      child: Icon(Icons.store,
                                          color: lokmaPink, size: 24),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: GoogleFonts.inter(
                              color: Theme.of(context).colorScheme.onSurface,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.star,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .tertiary,
                                      size: 16),
                                  const SizedBox(width: 6),
                                  Text(
                                    rating
                                        .toStringAsFixed(1)
                                        .replaceAll('.', ','),
                                    style: GoogleFonts.inter(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface
                                          .withOpacity(0.9),
                                      fontSize: 14,
                                      fontWeight: FontWeight.w400,
                                    ),
                                  ),
                                  if (reviewText.isNotEmpty) ...[
                                    const SizedBox(width: 4),
                                    Text(
                                      reviewText,
                                      style: GoogleFonts.inter(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withOpacity(0.7),
                                        fontSize: 14,
                                        fontWeight: FontWeight.w400,
                                      ),
                                    ),
                                  ],
                                  Text(
                                    ' · ',
                                    style: GoogleFonts.inter(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface
                                          .withOpacity(0.7),
                                      fontSize: 13,
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(
                                      cuisineType != null &&
                                              cuisineType!.isNotEmpty
                                          ? cuisineType!
                                          : typeLabel,
                                      style: GoogleFonts.inter(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withOpacity(0.7),
                                        fontSize: 14,
                                        fontWeight: FontWeight.w400,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Builder(
                                builder: (context) {
                                  final deliveryFee =
                                      (data['deliveryFee'] as num?)
                                              ?.toDouble() ??
                                          0.0;
                                  final minOrderAmount =
                                      (data['minDeliveryOrder'] as num?)
                                              ?.toDouble() ??
                                          (data['minOrderAmount'] as num?)
                                              ?.toDouble() ??
                                          10.0;

                                  if (deliveryMode == 'teslimat') {
                                    final hasMinOrder = minOrderAmount > 0;
                                    return Row(
                                      children: [
                                        Icon(Icons.delivery_dining,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.7),
                                            size: 16),
                                        const SizedBox(width: 6),
                                        if (deliveryFee == 0)
                                          Text(
                                            tr('marketplace.free_delivery_label'),
                                            style: GoogleFonts.inter(
                                                color: tunaGreen,
                                                fontSize: 14,
                                                fontWeight: FontWeight.w400),
                                          )
                                        else
                                          Text(
                                            '${deliveryFee.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()} ${tr('common.delivery')}',
                                            style: GoogleFonts.inter(
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .onSurface
                                                  .withOpacity(0.7),
                                              fontSize: 14,
                                              fontWeight: FontWeight.w400,
                                            ),
                                          ),
                                        if (hasMinOrder) ...[
                                          Text(' · ',
                                              style: GoogleFonts.inter(
                                                  color: Theme.of(context)
                                                      .colorScheme
                                                      .onSurface
                                                      .withOpacity(0.7),
                                                  fontSize: 13)),
                                          Icon(Icons.shopping_basket_outlined,
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .onSurface
                                                  .withOpacity(0.7),
                                              size: 14),
                                          const SizedBox(width: 6),
                                          Text(
                                            'Min. ${minOrderAmount.toStringAsFixed(0)} ${CurrencyUtils.getCurrencySymbol()}',
                                            style: GoogleFonts.inter(
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .onSurface
                                                  .withOpacity(0.7),
                                              fontSize: 14,
                                              fontWeight: FontWeight.w400,
                                            ),
                                          ),
                                        ],
                                      ],
                                    );
                                  } else {
                                    final hasReservation =
                                        data['hasReservation'] as bool? ??
                                            false;
                                    return Row(
                                      children: [
                                        Icon(Icons.location_on_outlined,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.7),
                                            size: 14),
                                        const SizedBox(width: 4),
                                        Text(
                                          distanceText,
                                          style: GoogleFonts.inter(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.8),
                                            fontSize: 14,
                                            fontWeight: FontWeight.w400,
                                          ),
                                        ),
                                        if (hasReservation &&
                                            deliveryMode == 'masada') ...[
                                          Text(' · ',
                                              style: GoogleFonts.inter(
                                                  color: Theme.of(context)
                                                      .colorScheme
                                                      .onSurface
                                                      .withOpacity(0.7),
                                                  fontSize: 13)),
                                          SvgPicture.asset(
                                            'assets/images/icon_masa_rezervasyon.svg',
                                            width: 14,
                                            height: 14,
                                            colorFilter: ColorFilter.mode(
                                              lokmaPink,
                                              BlendMode.srcIn,
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            'Rezervasyon',
                                            style: GoogleFonts.inter(
                                              color: lokmaPink,
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ]
                                      ],
                                    );
                                  }
                                },
                              ),
                              Builder(
                                builder: (context) {
                                  // KURAL 2: Hazir Paket Yazi Ibaresi = sellsTunaProducts / sellsTorosProducts
                                  bool actuallySellsTuna = data['sellsTunaProducts'] == true;
                                  bool actuallySellsToros = data['sellsTorosProducts'] == true;

                                  if (activeBadges.isNotEmpty) return const SizedBox.shrink();

                                  return Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (actuallySellsTuna)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 6),
                                          child: Row(
                                            children: [
                                              const Icon(Icons.shopping_bag_outlined, size: 13, color: Color(0xFFEA184A)),
                                              const SizedBox(width: 4),
                                              Text(
                                                'TUNA Hazır Paket Ürünleri',
                                                style: GoogleFonts.inter(
                                                  color: const Color(0xFFEA184A),
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      if (actuallySellsToros)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 6),
                                          child: Row(
                                            children: [
                                              const Icon(Icons.shopping_bag_outlined, size: 13, color: Color(0xFF1B5E20)),
                                              const SizedBox(width: 4),
                                              Text(
                                                'Akdeniz Toros Hazır Paket Ürünleri',
                                                style: GoogleFonts.inter(
                                                  color: const Color(0xFF1B5E20),
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                    ],
                                  );
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ==========================================
            // 1. TOP-LEFT CORNER: Brand & Status Badges (ABSOLUTE)
            // ==========================================
            Positioned(
              left: 12,
              top: !isAvailable ? bannerHeight + 12 : 12,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ...activeBadges.map((badge) {
                    final isLegacyTuna = badge['isLegacyTuna'] == true;
                    final isLegacyToros = badge['isLegacyToros'] == true;
                    final Color badgeColor = isLegacyTuna 
                      ? const Color(0xFFA01E22) 
                      : (isLegacyToros ? const Color(0xFF1B5E20) : Theme.of(context).colorScheme.surface);
                    final Color textColor = (isLegacyTuna || isLegacyToros) 
                      ? Colors.white 
                      : Theme.of(context).colorScheme.onSurface;

                    final bool hasIcon = badge['iconUrl'] != null && badge['iconUrl'].toString().isNotEmpty;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          if (isLegacyTuna || badge['name'].toString().toLowerCase().contains('tuna')) {
                            BrandInfoSheet.show(context, forcedBrand: 'tuna');
                          } else if (isLegacyToros || badge['name'].toString().toLowerCase().contains('toros')) {
                            BrandInfoSheet.show(context, forcedBrand: 'toros');
                          }
                        },
                        child: Container(
                          padding: hasIcon
                              ? EdgeInsets.zero
                              : const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: hasIcon ? Colors.transparent : badgeColor,
                            borderRadius: hasIcon ? BorderRadius.circular(8) : BorderRadius.circular(16),
                            boxShadow: [
                              if (!hasIcon)
                                BoxShadow(
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3),
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
                                  child: badge['iconUrl'].toString().startsWith('assets/')
                                      ? Image.asset(
                                          badge['iconUrl'],
                                          height: 38,
                                          fit: BoxFit.contain,
                                        )
                                      : LokmaNetworkImage(
                                          imageUrl: badge['iconUrl'],
                                          height: 38,
                                          fit: BoxFit.contain,
                                          placeholder: (context, url) => Container(
                                            color: Colors.transparent,
                                            height: 38,
                                            width: 38,
                                          ),
                                          errorWidget: (context, url, error) =>
                                              const SizedBox.shrink(),
                                        ),
                                )
                              else if (isLegacyTuna)
                                Text(
                                  'TUNA',
                                  style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                                )
                              else if (isLegacyToros)
                                Text(
                                  'TOROS',
                                  style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                                )
                              else ...[
                                Icon(Icons.verified, color: textColor, size: 14),
                                const SizedBox(width: 4),
                                Text(
                                  badge['name'],
                                  style: TextStyle(
                                    color: textColor,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                  // Add future top-left badges here (e.g., Sponsored, Verified) with SizedBox(height: 6)
                ],
              ),
            ),

            // ==========================================
            // 2. TOP-RIGHT CORNER: Action Buttons (ABSOLUTE)
            // ==========================================
            Positioned(
              top: !isAvailable ? bannerHeight + 12 : 12,
              right: 12,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      ref
                          .read(butcherFavoritesProvider.notifier)
                          .toggleFavorite(id);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withOpacity(0.5),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isFavorite ? Icons.favorite : Icons.favorite_border,
                        color: isFavorite ? lokmaPink : Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                  // Add future top-right buttons here with SizedBox(height: 6)
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showTunaBrandInfo(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, controller) => Container(
          decoration: const BoxDecoration(
            color: Color(0xFF1E1E1E),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // 1. Red Brand Header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                decoration: const BoxDecoration(
                  color: Color(0xFFEA184A), // Deep Red
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 40, height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                    ),
                    Image.asset('assets/images/tuna_logo_pill.png', height: 40, errorBuilder: (_,__,___) => const Text('TUNA', style: TextStyle(fontFamily: 'Cursive', fontSize: 40, color: Colors.white, fontWeight: FontWeight.w600))),
                    const SizedBox(height: 16),
                    Text(
                      'marketplace.tuna_subtitle'.tr(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              
               Expanded(
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.all(24),
                  children: [
                     // Intro Text
                     Text(
                       '${'marketplace.tuna_description_1'.tr()}\n\n${'marketplace.tuna_description_2'.tr()}',
                       style: const TextStyle(color: Colors.white70, fontSize: 15, height: 1.5),
                     ),
                     const SizedBox(height: 24),
                     
                     // Icons Row
                     Row(
                       mainAxisAlignment: MainAxisAlignment.spaceAround,
                       children: [
                         _buildBrandIconElement(Icons.verified, 'Halal-Schlachtung', Colors.green),
                         _buildBrandIconElement(Icons.bolt, 'Ohne Betäubung', Colors.amber),
                         _buildBrandIconElement(Icons.clean_hands, 'marketplace.kuru_yolum'.tr(), Colors.amber),
                       ],
                     ),
                     const SizedBox(height: 32),
                     
                     // Standards List
                     Text('marketplace.supply_standards'.tr(), style: const TextStyle(color: Color(0xFFE0E0E0), fontSize: 18, fontWeight: FontWeight.w600)),
                     const SizedBox(height: 16),
                     _buildCheckItem('marketplace.helal_kesim'.tr(), 'marketplace.helal_kesim_desc'.tr()),
                     _buildCheckItem('marketplace.elle_kesim'.tr(), 'marketplace.elle_kesim_desc'.tr()),
                     _buildCheckItem('marketplace.soksuz_kesim'.tr(), 'marketplace.soksuz_kesim_desc'.tr()),
                     _buildCheckItem('marketplace.kuru_yolum'.tr(), 'marketplace.kuru_yolum_desc'.tr()),

                     const SizedBox(height: 24),
                     
                     // Kuru Yolum Info Box
                     Container(
                       padding: const EdgeInsets.all(16),
                       decoration: BoxDecoration(
                         color: const Color(0xFF2C1B1B), // Dark Reddish Tint
                         borderRadius: BorderRadius.circular(12),
                         border: Border.all(color: const Color(0xFF4A2A2A)),
                       ),
                       child: Column(
                         crossAxisAlignment: CrossAxisAlignment.start,
                         children: [
                           Row(
                             children: [
                               Icon(Icons.info_outline, color: Colors.amber[800], size: 20),
                               const SizedBox(width: 8),
                               Text('marketplace.what_is_kuru_yolum'.tr(), style: TextStyle(color: Colors.amber[800], fontWeight: FontWeight.w600)),
                             ],
                           ),
                           const SizedBox(height: 8),
                           Text(
                             'marketplace.kuru_yolum_full_desc'.tr(),
                             style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                           ),
                         ],
                       ),
                     ),
                     
                     const SizedBox(height: 24),
                     Text('marketplace.production_standards'.tr(), style: const TextStyle(color: Color(0xFFE0E0E0), fontSize: 18, fontWeight: FontWeight.w600)),
                     const SizedBox(height: 16),
                     _buildCheckItem('marketplace.yuksek_et_orani'.tr(), 'marketplace.yuksek_et_orani_desc'.tr()),
                     _buildCheckItem('marketplace.without_e621'.tr(), 'marketplace.no_msg'.tr()),
                     _buildCheckItem('marketplace.without_mms'.tr(), 'marketplace.pure_meat'.tr()),
                     _buildCheckItem('marketplace.gluten_free'.tr(), 'marketplace.no_wheat'.tr()),
                     
                     const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBrandIconElement(IconData icon, String label, Color color) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
            border: Border.all(color: color.withOpacity(0.3), width: 2),
          ),
          child: Icon(icon, color: color, size: 28),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildCheckItem(String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Color(0xFFE0E0E0), fontWeight: FontWeight.w600, fontSize: 15)),
                Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
