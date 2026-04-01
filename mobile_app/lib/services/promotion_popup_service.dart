import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/promotion_models.dart';

/// PromotionPopupService — manages popup display logic and frequency control.
///
/// Responsibilities:
/// 1. Fetch active promotions with showAsPopup == true
/// 2. Check frequency limits (max 1/day per user, max 3 per campaign)
/// 3. Record impressions, clicks, redemptions
/// 4. Delegate to the correct popup widget format
class PromotionPopupService {
  static final _db = FirebaseFirestore.instance;

  /// Max popups to show per day per user
  static const _maxPopupsPerDay = 1;

  /// Max times a single promotion is shown to a user
  static const _maxShowsPerPromotion = 3;

  /// Delay after app open before showing popup (ms)
  static const popupDelayMs = 2500;

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch active popup promotions across all businesses
  // ───────────────────────────────────────────────────────────────────────────

  /// Get all active promotions that should show as popups.
  /// Returns promotions sorted by priority.
  static Future<List<BusinessPromotion>> getActivePopupPromotions() async {
    final now = DateTime.now();

    // Query all businesses — in production this could be optimized with
    // a top-level "activePopups" collection for performance. For now,
    // we query Firestore collectionGroup which works across sub-collections.
    final query = await _db
        .collectionGroup('promotions')
        .where('isActive', isEqualTo: true)
        .where('showAsPopup', isEqualTo: true)
        .get();

    final promotions = <BusinessPromotion>[];
    for (final doc in query.docs) {
      // Extract businessId from path: businesses/{businessId}/promotions/{promotionId}
      final pathParts = doc.reference.path.split('/');
      final businessId = pathParts.length >= 2 ? pathParts[1] : '';

      final promo = BusinessPromotion.fromFirestore(doc.id, businessId, doc.data());

      // Check date validity
      if (promo.validFrom != null && now.isBefore(promo.validFrom!)) continue;
      if (promo.validUntil != null && now.isAfter(promo.validUntil!)) continue;

      // Check if currently valid (day, hour, redemption limits)
      if (!promo.isCurrentlyValid) continue;

      promotions.add(promo);
    }

    // Sort by priority: first-order > buyXGetY > percentOff > fixedOff > freeDelivery
    promotions.sort((a, b) => _priority(a.type).compareTo(_priority(b.type)));

    return promotions;
  }

  static int _priority(PromotionType type) {
    switch (type) {
      case PromotionType.fixedOff:
        return 1;
      case PromotionType.buyXGetY:
        return 2;
      case PromotionType.percentOff:
        return 3;
      case PromotionType.minOrderDiscount:
        return 4;
      case PromotionType.happyHour:
        return 5;
      case PromotionType.freeDelivery:
        return 6;
      case PromotionType.loyaltyCard:
        return 7;
      case PromotionType.flashSale:
        return 0;
      case PromotionType.cashback:
        return 8;
      default:
        return 99;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Frequency control
  // ───────────────────────────────────────────────────────────────────────────

  /// Check if a promotion should be shown to this user.
  static Future<bool> shouldShowPopup(String userId, String promotionId) async {
    final doc = await _db
        .collection('users')
        .doc(userId)
        .collection('promotionImpressions')
        .doc(promotionId)
        .get();

    if (!doc.exists) return true;

    final data = doc.data()!;
    final showCount = data['showCount'] as int? ?? 0;
    final lastShownAt = (data['lastShownAt'] as Timestamp?)?.toDate();

    // Max shows per campaign
    if (showCount >= _maxShowsPerPromotion) return false;

    // Max once per day
    if (lastShownAt != null) {
      final now = DateTime.now();
      if (now.year == lastShownAt.year &&
          now.month == lastShownAt.month &&
          now.day == lastShownAt.day) {
        return false;
      }
    }

    return true;
  }

  /// Check how many popups have already been shown today.
  static Future<int> getTodayPopupCount(String userId) async {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);

    final query = await _db
        .collection('users')
        .doc(userId)
        .collection('promotionImpressions')
        .where('lastShownAt', isGreaterThanOrEqualTo: Timestamp.fromDate(todayStart))
        .get();

    return query.docs.length;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Tracking
  // ───────────────────────────────────────────────────────────────────────────

  /// Record that a popup was shown to the user.
  static Future<void> recordImpression(String userId, BusinessPromotion promo) async {
    final ref = _db
        .collection('users')
        .doc(userId)
        .collection('promotionImpressions')
        .doc(promo.id);

    await ref.set({
      'lastShownAt': FieldValue.serverTimestamp(),
      'showCount': FieldValue.increment(1),
      'dismissed': false,
      'clicked': false,
      'redeemed': false,
      'businessId': promo.businessId,
      'promotionTitle': promo.title,
    }, SetOptions(merge: true));

    // Update promotion stats
    await _db
        .collection('businesses')
        .doc(promo.businessId)
        .collection('promotions')
        .doc(promo.id)
        .update({'impressions': FieldValue.increment(1)});
  }

  /// Record that the user tapped a popup CTA.
  static Future<void> recordClick(String userId, BusinessPromotion promo) async {
    await _db
        .collection('users')
        .doc(userId)
        .collection('promotionImpressions')
        .doc(promo.id)
        .update({'clicked': true});

    await _db
        .collection('businesses')
        .doc(promo.businessId)
        .collection('promotions')
        .doc(promo.id)
        .update({'clicks': FieldValue.increment(1)});
  }

  /// Record that the user dismissed a popup.
  static Future<void> recordDismiss(String userId, String promotionId) async {
    await _db
        .collection('users')
        .doc(userId)
        .collection('promotionImpressions')
        .doc(promotionId)
        .update({'dismissed': true});
  }

  /// Record that a promotion was redeemed on an order.
  static Future<void> recordRedemption(
    String userId,
    BusinessPromotion promo,
    double discountAmount,
  ) async {
    await _db
        .collection('users')
        .doc(userId)
        .collection('promotionImpressions')
        .doc(promo.id)
        .update({'redeemed': true});

    await _db
        .collection('businesses')
        .doc(promo.businessId)
        .collection('promotions')
        .doc(promo.id)
        .update({
      'redemptions': FieldValue.increment(1),
      'totalDiscountGiven': FieldValue.increment(discountAmount),
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main entry point — called from main.dart after 2.5s delay
  // ───────────────────────────────────────────────────────────────────────────

  /// Check for promotions and show popup if applicable.
  /// Call this from the home screen with a 2.5s delay.
  static Future<void> checkAndShowPopup(BuildContext context, String userId) async {
    try {
      // Check daily limit
      final todayCount = await getTodayPopupCount(userId);
      if (todayCount >= _maxPopupsPerDay) return;

      // Get active popup promotions
      final promotions = await getActivePopupPromotions();
      if (promotions.isEmpty) return;

      // Find first eligible promotion for this user
      BusinessPromotion? eligible;
      for (final promo in promotions) {
        if (await shouldShowPopup(userId, promo.id)) {
          // If this is for new customers only, check user's order count
          if (promo.newCustomersOnly) {
            final userDoc = await _db.collection('users').doc(userId).get();
            final completedOrders = userDoc.data()?['completedOrderCount'] as int? ?? 0;
            if (completedOrders > 0) continue;
          }
          eligible = promo;
          break;
        }
      }

      if (eligible == null) return;

      // Verify context is still valid (user hasn't navigated away)
      if (!context.mounted) return;

      // Record impression
      await recordImpression(userId, eligible);

      // Show the popup in the selected format
      _showPopup(context, eligible, userId);
    } catch (e) {
      debugPrint('PromotionPopupService error: $e');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Popup display delegation
  // ───────────────────────────────────────────────────────────────────────────

  static void _showPopup(BuildContext context, BusinessPromotion promo, String userId) {
    switch (promo.popupFormat) {
      case PopupFormat.bottomSheet:
        _showBottomSheet(context, promo, userId);
        break;
      case PopupFormat.centerModal:
        _showCenterModal(context, promo, userId);
        break;
      case PopupFormat.topBanner:
        _showTopBanner(context, promo, userId);
        break;
      case PopupFormat.snackbar:
        _showSnackbar(context, promo, userId);
        break;
    }
  }

  /// Bottom sheet — slides up from bottom, ~40% of screen
  static void _showBottomSheet(BuildContext context, BusinessPromotion promo, String userId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _PromotionBottomSheetContent(
        promotion: promo,
        userId: userId,
      ),
    );
  }

  /// Center modal — popup in the middle with blur background
  static void _showCenterModal(BuildContext context, BusinessPromotion promo, String userId) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (ctx) => _PromotionCenterModalContent(
        promotion: promo,
        userId: userId,
      ),
    );
  }

  /// Top banner — slides down from top
  static void _showTopBanner(BuildContext context, BusinessPromotion promo, String userId) {
    final overlay = Overlay.of(context);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (ctx) => _PromotionTopBannerContent(
        promotion: promo,
        userId: userId,
        onDismiss: () => entry.remove(),
      ),
    );
    overlay.insert(entry);

    // Auto-dismiss after 6 seconds
    Future.delayed(const Duration(seconds: 6), () {
      if (entry.mounted) entry.remove();
    });
  }

  /// Snackbar — notification-style bar at bottom
  static void _showSnackbar(BuildContext context, BusinessPromotion promo, String userId) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Text(
              _getIconForType(promo.type),
              style: const TextStyle(fontSize: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    promo.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      fontSize: 14,
                    ),
                  ),
                  if (promo.description.isNotEmpty)
                    Text(
                      promo.description,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF1E1E2E),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 5),
        action: SnackBarAction(
          label: 'Göster',
          textColor: const Color(0xFFFF6B35),
          onPressed: () {
            recordClick(userId, promo);
            // Navigate to business page
          },
        ),
      ),
    );
  }

  static String _getIconForType(PromotionType type) {
    switch (type) {
      case PromotionType.percentOff: return '🔥';
      case PromotionType.fixedOff: return '🎉';
      case PromotionType.freeDelivery: return '🚚';
      case PromotionType.buyXGetY: return '🎁';
      case PromotionType.minOrderDiscount: return '💰';
      case PromotionType.happyHour: return '⏰';
      case PromotionType.loyaltyCard: return '🎖';
      case PromotionType.flashSale: return '⚡';
      case PromotionType.cashback: return '💸';
      default: return '🎉';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom Sheet Widget
// ─────────────────────────────────────────────────────────────────────────────

class _PromotionBottomSheetContent extends StatelessWidget {
  final BusinessPromotion promotion;
  final String userId;

  const _PromotionBottomSheetContent({
    required this.promotion,
    required this.userId,
  });

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      constraints: BoxConstraints(maxHeight: screenHeight * 0.45),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF2D2D3F), Color(0xFF1A1A2E)],
        ),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white30,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Close button
          Align(
            alignment: Alignment.topRight,
            child: IconButton(
              onPressed: () {
                PromotionPopupService.recordDismiss(userId, promotion.id);
                Navigator.of(context).pop();
              },
              icon: const Icon(Icons.close, color: Colors.white54, size: 22),
            ),
          ),

          // Icon
          Text(
            PromotionPopupService._getIconForType(promotion.type),
            style: const TextStyle(fontSize: 56),
          ),
          const SizedBox(height: 12),

          // Title
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              promotion.title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 8),

          // Description
          if (promotion.description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                promotion.description,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.white70,
                  height: 1.4,
                ),
              ),
            ),
          const SizedBox(height: 20),

          // CTA Button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () {
                  PromotionPopupService.recordClick(userId, promotion);
                  Navigator.of(context).pop();
                  // TODO: Navigate to business page
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFF6B35),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Hemen Sipariş Ver',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Center Modal Widget
// ─────────────────────────────────────────────────────────────────────────────

class _PromotionCenterModalContent extends StatelessWidget {
  final BusinessPromotion promotion;
  final String userId;

  const _PromotionCenterModalContent({
    required this.promotion,
    required this.userId,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 340),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF2D2D3F), Color(0xFF1A1A2E)],
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.4),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Close button
              Align(
                alignment: Alignment.topRight,
                child: GestureDetector(
                  onTap: () {
                    PromotionPopupService.recordDismiss(userId, promotion.id);
                    Navigator.of(context).pop();
                  },
                  child: const Icon(Icons.close, color: Colors.white54, size: 22),
                ),
              ),
              const SizedBox(height: 4),

              // Icon
              Text(
                PromotionPopupService._getIconForType(promotion.type),
                style: const TextStyle(fontSize: 56),
              ),
              const SizedBox(height: 16),

              // Title
              Text(
                promotion.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),

              // Description
              if (promotion.description.isNotEmpty)
                Text(
                  promotion.description,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.white70,
                    height: 1.4,
                  ),
                ),
              const SizedBox(height: 20),

              // CTA
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    PromotionPopupService.recordClick(userId, promotion);
                    Navigator.of(context).pop();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF6B35),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Hemen Sipariş Ver',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Banner Widget (Overlay)
// ─────────────────────────────────────────────────────────────────────────────

class _PromotionTopBannerContent extends StatefulWidget {
  final BusinessPromotion promotion;
  final String userId;
  final VoidCallback onDismiss;

  const _PromotionTopBannerContent({
    required this.promotion,
    required this.userId,
    required this.onDismiss,
  });

  @override
  State<_PromotionTopBannerContent> createState() => _PromotionTopBannerContentState();
}

class _PromotionTopBannerContentState extends State<_PromotionTopBannerContent>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _dismiss() {
    _controller.reverse().then((_) {
      PromotionPopupService.recordDismiss(widget.userId, widget.promotion.id);
      widget.onDismiss();
    });
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SlideTransition(
        position: _slideAnimation,
        child: GestureDetector(
          onVerticalDragEnd: (details) {
            if (details.primaryVelocity != null && details.primaryVelocity! < 0) {
              _dismiss();
            }
          },
          child: Container(
            margin: EdgeInsets.only(top: topPadding + 8, left: 12, right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF2D2D3F), Color(0xFF1A1A2E)],
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Text(
                  PromotionPopupService._getIconForType(widget.promotion.type),
                  style: const TextStyle(fontSize: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.promotion.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      if (widget.promotion.description.isNotEmpty)
                        Text(
                          widget.promotion.description,
                          style: const TextStyle(
                            color: Colors.white60,
                            fontSize: 12,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _dismiss,
                  child: const Icon(Icons.close, color: Colors.white54, size: 20),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
