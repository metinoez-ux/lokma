import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../../providers/butcher_favorites_provider.dart';
import '../../../utils/currency_utils.dart';
import '../../../models/table_group_session_model.dart';
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
  final Function(BuildContext, String, String, Map<String, dynamic>) showClosedDialog;

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
    final String distanceText = distance < 1
        ? '${(distance * 1000).toInt()} m'
        : '${distance.toStringAsFixed(1).replaceAll('.', ',')} km';

    // Kalınlık ve Padding değerleri (Wallet Efekti)
    const double bannerHeight = 34.0;

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
                  height: bannerHeight + 20, // Alt kartın altına inmesi için ekstra yükseklik
                  padding: const EdgeInsets.only(top: 6, bottom: 20),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFF2A2A28)
                        : Colors.grey[800],
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(16),
                      topRight: Radius.circular(16),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  alignment: Alignment.topCenter,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.info_outline, color: Colors.white, size: 14),
                      const SizedBox(width: 6),
                      Text(
                        unavailableReason,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
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
                border: Border.all(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? Colors.white.withValues(alpha: 0.08)
                      : Colors.black.withValues(alpha: 0.08),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.black.withValues(alpha: 0.5)
                        : Colors.black.withValues(alpha: 0.1),
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
                              ? CachedNetworkImage(
                                  imageUrl: imageUrl!,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    color: Theme.of(context).brightness == Brightness.dark
                                        ? const Color(0xFF2A2A28)
                                        : Colors.grey[200],
                                    child: Center(
                                      child: CircularProgressIndicator(
                                        color: lokmaPink,
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  ),
                                  errorWidget: (context, url, error) => Container(
                                    color: Theme.of(context).brightness == Brightness.dark
                                        ? const Color(0xFF2A2A28)
                                        : Colors.grey[200],
                                    child: const Center(
                                      child: Icon(Icons.restaurant, color: lokmaPink, size: 48),
                                    ),
                                  ),
                                )
                              : Container(
                                  color: Theme.of(context).brightness == Brightness.dark
                                      ? const Color(0xFF2A2A28)
                                      : Colors.grey[200],
                                  child: const Center(
                                    child: Icon(Icons.restaurant, color: lokmaPink, size: 48),
                                  ),
                                ),
                        ),
                        if (!isAvailable)
                          Positioned.fill(
                            child: Container(
                              color: Colors.black.withValues(alpha: 0.4),
                            ),
                          ),

                        // Masa Rezervasyonu badge overlay warning 
                        if (deliveryMode == 'masada' && (data['hasReservation'] as bool? ?? false))
                          Positioned(
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                              color: Colors.black.withValues(alpha: 0.65),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.info_outline, color: Colors.white, size: 14),
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
                              if (data['hasReservation'] == true && deliveryMode == 'masada')
                                Opacity(
                                  opacity: isAvailable ? 1.0 : 0.7,
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: lokmaPink.withValues(alpha: 0.9),
                                      borderRadius: BorderRadius.circular(14),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.3),
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
                                          colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
                                        ),
                                        Text(
                                          'marketplace.online_table_reservation_badge'.tr(),
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
                                        showClosedDialog(context, name, unavailableReason, data);
                                        return;
                                      }

                                      final session = await showModalBottomSheet<TableGroupSession>(
                                        context: context,
                                        useRootNavigator: true,
                                        shape: const RoundedRectangleBorder(
                                          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                                        ),
                                        backgroundColor: Theme.of(context).brightness == Brightness.dark
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
                                          builder: (ctx) => MarketplaceGroupShareSheet(session: session),
                                        );
                                        if (context.mounted) {
                                          final encodedName = Uri.encodeComponent(name);
                                          final tableNum = session.tableNumber.isNotEmpty ? session.tableNumber : 'delivery';
                                          context.push(
                                              '/kasap/$id?mode=$deliveryMode&groupSessionId=${session.id}&businessName=$encodedName&table=$tableNum');
                                        }
                                      }
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF2E7D32).withValues(alpha: 0.9),
                                        borderRadius: BorderRadius.circular(14),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withValues(alpha: 0.3),
                                            blurRadius: 4,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.groups_rounded, color: Colors.white, size: 16),
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
                                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.2),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: CachedNetworkImage(
                                    imageUrl: logoUrl!,
                                    fit: BoxFit.cover,
                                    errorWidget: (_, __, ___) => const Center(
                                      child: Icon(Icons.store, color: lokmaPink, size: 24),
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
                              fontSize: 15,
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
                                  Icon(Icons.star, color: Theme.of(context).colorScheme.tertiary, size: 16),
                                  const SizedBox(width: 6),
                                  Text(
                                    rating.toStringAsFixed(1).replaceAll('.', ','),
                                    style: GoogleFonts.inter(
                                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.9),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w300,
                                    ),
                                  ),
                                  if (reviewText.isNotEmpty) ...[
                                    const SizedBox(width: 4),
                                    Text(
                                      reviewText,
                                      style: GoogleFonts.inter(
                                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w300,
                                      ),
                                    ),
                                  ],
                                  Text(
                                    ' · ',
                                    style: GoogleFonts.inter(
                                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                      fontSize: 13,
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(
                                      cuisineType != null && cuisineType!.isNotEmpty ? cuisineType! : typeLabel,
                                      style: GoogleFonts.inter(
                                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w300,
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
                                  final deliveryFee = (data['deliveryFee'] as num?)?.toDouble() ?? 0.0;
                                  final minOrderAmount = (data['minDeliveryOrder'] as num?)?.toDouble() ??
                                      (data['minOrderAmount'] as num?)?.toDouble() ??
                                      10.0;

                                  if (deliveryMode == 'teslimat') {
                                    final hasMinOrder = minOrderAmount > 0;
                                    return Row(
                                      children: [
                                        Icon(Icons.delivery_dining,
                                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                            size: 16),
                                        const SizedBox(width: 6),
                                        if (deliveryFee == 0)
                                          Text(
                                            tr('marketplace.free_delivery_label'),
                                            style: GoogleFonts.inter(
                                                color: tunaGreen, fontSize: 13, fontWeight: FontWeight.w300),
                                          )
                                        else
                                          Text(
                                            '${deliveryFee.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()} ${tr('common.delivery')}',
                                            style: GoogleFonts.inter(
                                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                              fontSize: 13,
                                              fontWeight: FontWeight.w300,
                                            ),
                                          ),
                                        if (hasMinOrder) ...[
                                          Text(' · ',
                                              style: GoogleFonts.inter(
                                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                                  fontSize: 13)),
                                          Icon(Icons.shopping_basket_outlined,
                                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                              size: 14),
                                          const SizedBox(width: 6),
                                          Text(
                                            'Min. ${minOrderAmount.toStringAsFixed(0)} ${CurrencyUtils.getCurrencySymbol()}',
                                            style: GoogleFonts.inter(
                                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                              fontSize: 13,
                                              fontWeight: FontWeight.w300,
                                            ),
                                          ),
                                        ],
                                      ],
                                    );
                                  } else {
                                    final hasReservation = data['hasReservation'] as bool? ?? false;
                                    return Row(
                                      children: [
                                        Icon(Icons.location_on_outlined,
                                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                            size: 14),
                                        const SizedBox(width: 4),
                                        Text(
                                          distanceText,
                                          style: GoogleFonts.inter(
                                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w300,
                                          ),
                                        ),
                                        if (hasReservation && deliveryMode == 'masada') ...[
                                          Text(' · ',
                                              style: GoogleFonts.inter(
                                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
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
                  if (isTunaPartner)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFA01E22), // TUNA dark red
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.verified, color: Colors.white, size: 14),
                          SizedBox(width: 4),
                          Text(
                            'TUNA',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
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
                      ref.read(butcherFavoritesProvider.notifier).toggleFavorite(id);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
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
}
