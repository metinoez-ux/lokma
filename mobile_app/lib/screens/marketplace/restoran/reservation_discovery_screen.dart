import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../kasap/reservation_booking_screen.dart';
import '../../../utils/currency_utils.dart';
import 'restoran_screen.dart' show getBusinessTypeLabel;

const Color _lokmaPink = Color(0xFFEA184A);

/// Reservation Discovery Screen
/// Gel-Al style page with distance slider, filters, and business list
/// Only shows businesses with hasReservation == true
class ReservationDiscoveryScreen extends StatefulWidget {
  final List<DocumentSnapshot> allBusinesses;
  final double? userLat;
  final double? userLng;

  const ReservationDiscoveryScreen({
    super.key,
    required this.allBusinesses,
    this.userLat,
    this.userLng,
  });

  @override
  State<ReservationDiscoveryScreen> createState() =>
      _ReservationDiscoveryScreenState();
}

class _ReservationDiscoveryScreenState
    extends State<ReservationDiscoveryScreen> {
  // Distance slider
  static const List<double> _distanceSteps = [1, 2, 3, 5, 10, 15, 20, 30, 50, 100, 200];
  int _currentStepIndex = 10; // 200km default = show all
  double get _maxDistance => _distanceSteps[_currentStepIndex];

  // Search
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  // Product keywords cache for search (businessId -> product names)
  final Map<String, List<String>> _productKeywordsCache = {};
  bool _productsCacheLoaded = false;

  // Filters
  String _categoryFilter = 'all';
  bool _filterOpenNow = false;
  bool _filterHighRating = false;
  bool _onlyTuna = false;

  // Sort
  String _sortMode = 'distance';

  // Computed
  List<_ReservationBusiness> _filteredBusinesses = [];

  @override
  void initState() {
    super.initState();
    _filterBusinesses();
    _loadProductKeywords();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  /// Pre-load product names for all reservation businesses for search
  Future<void> _loadProductKeywords() async {
    for (final doc in widget.allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      if (data['hasReservation'] != true) continue;
      if (data['isActive'] == false) continue;

      try {
        final products = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(doc.id)
            .collection('products')
            .where('isActive', isEqualTo: true)
            .get();

        final keywords = <String>[];
        for (final pDoc in products.docs) {
          final pData = pDoc.data();
          final name = (pData['name'] as String? ?? '').toLowerCase();
          final desc = (pData['description'] as String? ?? '').toLowerCase();
          final cat = (pData['category'] as String? ?? '').toLowerCase();
          if (name.isNotEmpty) keywords.add(name);
          if (desc.isNotEmpty) keywords.add(desc);
          if (cat.isNotEmpty) keywords.add(cat);
        }
        _productKeywordsCache[doc.id] = keywords;
      } catch (_) {}
    }
    _productsCacheLoaded = true;
    // Re-filter if there's an active search query
    if (_searchQuery.isNotEmpty && mounted) {
      _filterBusinesses();
    }
  }

  void _filterBusinesses() {
    final results = <_ReservationBusiness>[];

    debugPrint('RESERVATION_FILTER: Total businesses received: ${widget.allBusinesses.length}');

    for (final doc in widget.allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;

      final name = data['companyName'] as String? ?? 'unknown';
      final hasRes = data['hasReservation'];
      final isActive = data['isActive'];
      debugPrint('RESERVATION_FILTER: $name -> hasReservation=$hasRes, isActive=$isActive');

      // Only reservation-enabled businesses
      if (data['hasReservation'] != true) continue;

      // Active check
      if (data['isActive'] == false) continue;

      // Category filter
      final businessType = (data['businessType'] as String? ?? '').toLowerCase();
      if (_categoryFilter != 'all' && businessType != _categoryFilter.toLowerCase()) continue;

      // Tuna filter
      if (_onlyTuna && data['isTunaPartner'] != true) continue;

      // Search filter
      if (_searchQuery.isNotEmpty) {
        final name = (data['companyName'] as String? ?? '').toLowerCase();
        final type = (data['businessType'] as String? ?? '').toLowerCase();
        final cuisine = (data['cuisineType'] as String? ?? '').toLowerCase();
        final q = _searchQuery.toLowerCase();
        // Check business name, type, cuisine
        bool matched = name.contains(q) || type.contains(q) || cuisine.contains(q);
        // Also check product/menu keywords
        if (!matched && _productKeywordsCache.containsKey(doc.id)) {
          matched = _productKeywordsCache[doc.id]!.any((kw) => kw.contains(q));
        }
        if (!matched) continue;
      }

      // Distance calc
      double? distanceKm;
      if (widget.userLat != null && widget.userLng != null) {
        double? lat, lng;
        if (data['lat'] is num) lat = (data['lat'] as num).toDouble();
        if (data['lng'] is num) lng = (data['lng'] as num).toDouble();
        if (lat == null || lng == null) {
          final address = data['address'] as Map<String, dynamic>?;
          if (address != null) {
            if (address['lat'] is num) lat = (address['lat'] as num).toDouble();
            if (address['lng'] is num) lng = (address['lng'] as num).toDouble();
          }
        }
        if (lat != null && lng != null) {
          distanceKm = _haversineDistance(widget.userLat!, widget.userLng!, lat, lng);
        }
      }

      // Distance filter
      if (distanceKm != null && distanceKm > _maxDistance) continue;

      // Open now filter
      if (_filterOpenNow) {
        final isOpen = data['isOpen'] as bool? ?? true;
        if (!isOpen) continue;
      }

      // High rating filter
      if (_filterHighRating) {
        final rating = (data['rating'] as num?)?.toDouble() ?? 0;
        if (rating < 4.0) continue;
      }

      results.add(_ReservationBusiness(
        docId: doc.id,
        data: data,
        distanceKm: distanceKm,
      ));
    }

    // Sort
    if (_sortMode == 'distance') {
      results.sort((a, b) => (a.distanceKm ?? 999).compareTo(b.distanceKm ?? 999));
    } else if (_sortMode == 'rating') {
      results.sort((a, b) {
        final rA = (a.data['rating'] as num?)?.toDouble() ?? 0;
        final rB = (b.data['rating'] as num?)?.toDouble() ?? 0;
        return rB.compareTo(rA);
      });
    }

    setState(() => _filteredBusinesses = results);
  }

  static double _haversineDistance(double lat1, double lng1, double lat2, double lng2) {
    const earthRadius = 6371.0;
    final dLat = _toRadians(lat2 - lat1);
    final dLng = _toRadians(lng2 - lng1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) * cos(_toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  static double _toRadians(double degrees) => degrees * pi / 180;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;

    return Scaffold(
      backgroundColor: bgColor,
      body: CustomScrollView(
        slivers: [
          // App Bar
          SliverAppBar(
            backgroundColor: bgColor,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            scrolledUnderElevation: 0,
            pinned: true,
            expandedHeight: 175,
            collapsedHeight: 120,
            leading: IconButton(
              icon: Icon(
                Icons.arrow_back_ios_new_rounded,
                color: isDark ? Colors.white : Colors.black87,
                size: 20,
              ),
              onPressed: () => Navigator.pop(context),
            ),
            flexibleSpace: LayoutBuilder(
              builder: (context, constraints) {
                final expandedHeight = 175.0;
                final collapsedHeight = 120.0;
                final currentHeight = constraints.maxHeight;
                final expandRatio = ((currentHeight - collapsedHeight) /
                        (expandedHeight - collapsedHeight))
                    .clamp(0.0, 1.0);

                return ClipRect(
                  child: Container(
                    color: bgColor,
                    child: SingleChildScrollView(
                      physics: const NeverScrollableScrollPhysics(),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Title area
                          SafeArea(
                            bottom: false,
                            child: Padding(
                              padding: const EdgeInsets.only(left: 56, right: 16, top: 8),
                              child: Row(
                                children: [
                                  SvgPicture.asset(
                                    'assets/images/icon_masa_rezervasyon.svg',
                                    width: 24,
                                    height: 24,
                                    colorFilter: ColorFilter.mode(
                                      isDark ? Colors.white : const Color(0xFFEF6C00),
                                      BlendMode.srcIn,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      tr('marketplace.table_reservation'),
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w700,
                                        color: isDark ? Colors.white : Colors.black87,
                                        letterSpacing: -0.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          // Search + Distance (collapsible)
                          if (expandRatio > 0.05) ...[
                            Opacity(
                              opacity: expandRatio,
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                   // Search bar (pill-shaped with filter icon)
                                  Padding(
                                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                                    child: Container(
                                      height: 48,
                                      decoration: BoxDecoration(
                                        color: isDark
                                            ? Colors.white.withOpacity(0.08)
                                            : Colors.grey[100],
                                        borderRadius: BorderRadius.circular(24),
                                      ),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: TextField(
                                              controller: _searchController,
                                              onChanged: (val) {
                                                _searchQuery = val;
                                                _filterBusinesses();
                                              },
                                              style: TextStyle(
                                                fontSize: 14,
                                                color: isDark ? Colors.white : Colors.black87,
                                              ),
                                              decoration: InputDecoration(
                                                hintText: tr('home.search_hint'),
                                                hintStyle: TextStyle(
                                                  color: isDark ? Colors.grey[500] : Colors.grey[400],
                                                  fontSize: 14,
                                                ),
                                                prefixIcon: Icon(
                                                  Icons.search,
                                                  size: 20,
                                                  color: isDark ? Colors.grey[400] : Colors.grey[500],
                                                ),
                                                border: InputBorder.none,
                                                contentPadding: const EdgeInsets.symmetric(vertical: 14),
                                              ),
                                            ),
                                          ),
                                          GestureDetector(
                                            onTap: _showFilterSheet,
                                            child: Container(
                                              width: 36,
                                              height: 36,
                                              margin: const EdgeInsets.only(right: 6),
                                              decoration: BoxDecoration(
                                                color: Theme.of(context).scaffoldBackgroundColor,
                                                shape: BoxShape.circle,
                                              ),
                                              child: Center(
                                                child: Icon(
                                                  Icons.tune,
                                                  color: isDark ? const Color(0xFFEF6C00) : Colors.grey[700],
                                                  size: 20,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),

                                  // Distance slider
                                  _buildDistanceSlider(isDark),
                                ],
                              ),
                            ),
                          ] else ...[
                            // Collapsed: pill search with filter
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                              child: Container(
                                height: 48,
                                decoration: BoxDecoration(
                                  color: isDark
                                      ? Colors.white.withOpacity(0.08)
                                      : Colors.grey[100],
                                  borderRadius: BorderRadius.circular(24),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: TextField(
                                        controller: _searchController,
                                        onChanged: (val) {
                                          _searchQuery = val;
                                          _filterBusinesses();
                                        },
                                        style: TextStyle(
                                          fontSize: 14,
                                          color: isDark ? Colors.white : Colors.black87,
                                        ),
                                        decoration: InputDecoration(
                                          hintText: tr('home.search_hint'),
                                          hintStyle: TextStyle(
                                            color: isDark ? Colors.grey[500] : Colors.grey[400],
                                            fontSize: 14,
                                          ),
                                          prefixIcon: Icon(
                                            Icons.search,
                                            size: 20,
                                            color: isDark ? Colors.grey[400] : Colors.grey[500],
                                          ),
                                          border: InputBorder.none,
                                          contentPadding: const EdgeInsets.symmetric(vertical: 14),
                                        ),
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: _showFilterSheet,
                                      child: Container(
                                        width: 36,
                                        height: 36,
                                        margin: const EdgeInsets.only(right: 6),
                                        decoration: BoxDecoration(
                                          color: Theme.of(context).scaffoldBackgroundColor,
                                          shape: BoxShape.circle,
                                        ),
                                        child: Center(
                                          child: Icon(
                                            Icons.tune,
                                            color: isDark ? const Color(0xFFEF6C00) : Colors.grey[700],
                                            size: 20,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          // Results header
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Text(
                tr('marketplace.reserve_table_at_partners', namedArgs: {'count': '${_filteredBusinesses.length}'}),
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.8),
                  letterSpacing: -0.2,
                ),
              ),
            ),
          ),

          // Business list
          _filteredBusinesses.isEmpty
              ? SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(40),
                    child: Column(
                      children: [
                        Icon(
                          Icons.restaurant_rounded,
                          size: 64,
                          color: isDark ? Colors.grey[600] : Colors.grey[300],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          tr('marketplace.no_stores_yet'),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              : SliverPadding(
                  padding: const EdgeInsets.only(left: 16, right: 16, bottom: 120),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final biz = _filteredBusinesses[index];
                        return _buildBusinessCard(biz, isDark);
                      },
                      childCount: _filteredBusinesses.length,
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  Widget _buildDistanceSlider(bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 2, bottom: 4),
      child: Row(
        children: [
          // Business count (orange, no background)
          Text(
            '${_filteredBusinesses.length}',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFFEF6C00),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 3,
                activeTrackColor: _lokmaPink,
                inactiveTrackColor: isDark
                    ? Colors.white.withOpacity(0.1)
                    : Colors.grey[200],
                thumbColor: _lokmaPink,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 16),
              ),
              child: Slider(
                min: 0,
                max: (_distanceSteps.length - 1).toDouble(),
                divisions: _distanceSteps.length - 1,
                value: _currentStepIndex.toDouble(),
                onChanged: (val) {
                  HapticFeedback.selectionClick();
                  setState(() => _currentStepIndex = val.round());
                  _filterBusinesses();
                },
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withOpacity(0.08)
                  : Colors.grey[100],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${_maxDistance.toInt()} km',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white70 : Colors.black54,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBusinessCard(_ReservationBusiness biz, bool isDark) {
    final data = biz.data;
    final name = data['companyName'] as String? ?? '';
    final businessType = data['businessType'] as String? ?? '';
    final cuisineType = data['cuisineType'] as String? ?? '';
    final rating = (data['rating'] as num?)?.toDouble() ?? 0;
    final ratingCount = (data['ratingCount'] as num?)?.toInt() ?? 0;
    final tableCapacity = data['tableCapacity'] as int? ?? 0;

    // Image - check all possible image fields (same as Yemek segment)
    String? imageUrl;
    final coverImage = data['coverImage'] as String?;
    final mainImage = data['imageUrl'] as String?;
    final logo = data['logoUrl'] as String?;
    imageUrl = coverImage ?? mainImage ?? logo;

    final cardBg = isDark ? const Color(0xFF2C2C2E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: isDark ? null : Border.all(color: Colors.grey.withOpacity(0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.06),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image - tappable to view menu
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/business/${biz.docId}?mode=masa&closedAck=true');
            },
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: SizedBox(
                height: 140,
                width: double.infinity,
                child: imageUrl != null && imageUrl.isNotEmpty
                    ? LokmaNetworkImage(
                        imageUrl: imageUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: isDark ? Colors.grey[800] : Colors.grey[200],
                          child: Center(
                            child: Icon(Icons.restaurant, size: 40, color: Colors.grey[400]),
                          ),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          color: isDark ? Colors.grey[800] : Colors.grey[200],
                          child: Center(
                            child: Icon(Icons.restaurant, size: 40, color: Colors.grey[400]),
                          ),
                        ),
                      )
                    : Container(
                        color: isDark ? Colors.grey[800] : Colors.grey[200],
                        child: Center(
                          child: Icon(Icons.restaurant, size: 40, color: Colors.grey[400]),
                        ),
                      ),
              ),
            ),
          ),
          // Info
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name
                Text(
                  name,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: textColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                // Rating + Type + Distance
                Row(
                  children: [
                    if (rating > 0) ...[
                      Icon(Icons.star_rounded, size: 14, color: Colors.amber[700]),
                      const SizedBox(width: 2),
                      Text(
                        '${rating.toStringAsFixed(1)} ($ratingCount)',
                        style: TextStyle(fontSize: 12, color: subtleColor, fontWeight: FontWeight.w500),
                      ),
                      Text(' · ', style: TextStyle(fontSize: 12, color: subtleColor, fontWeight: FontWeight.w900)),
                    ],
                    Flexible(
                      child: Text(
                        [
                          if (businessType.isNotEmpty) getBusinessTypeLabel(businessType),
                          if (cuisineType.isNotEmpty) cuisineType,
                        ].join(', '),
                        style: TextStyle(fontSize: 12, color: subtleColor),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                // Distance + Reservation badge
                Row(
                  children: [
                    if (biz.distanceKm != null) ...[
                      Icon(Icons.location_on_outlined, size: 13, color: subtleColor),
                      const SizedBox(width: 2),
                      Text(
                        '${biz.distanceKm!.toStringAsFixed(1)} km',
                        style: TextStyle(fontSize: 12, color: subtleColor),
                      ),
                    ],
                    if (tableCapacity > 0) ...[
                      if (biz.distanceKm != null) Text(' · ', style: TextStyle(fontSize: 12, color: subtleColor, fontWeight: FontWeight.w900)),
                      Icon(Icons.table_restaurant_rounded, size: 13, color: subtleColor),
                      const SizedBox(width: 2),
                      Text(
                        '$tableCapacity',
                        style: TextStyle(fontSize: 12, color: subtleColor),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          // Action buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 12),
            child: Row(
              children: [
                // Menu button
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.push('/business/${biz.docId}?mode=masa&closedAck=true');
                    },
                    child: Container(
                      height: 38,
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF3A3A3C) : const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isDark ? Colors.grey[600]! : Colors.grey[300]!,
                          width: 0.5,
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.restaurant_menu_rounded,
                            size: 15,
                            color: isDark ? Colors.white70 : Colors.black87,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            tr('marketplace.view_menu'),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.white70 : Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Reservation button
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      final bizName = data['companyName'] as String? ?? '';
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ReservationBookingScreen(businessId: biz.docId, businessName: bizName),
                        ),
                      );
                    },
                    child: Container(
                      height: 38,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF6C00),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SvgPicture.asset(
                            'assets/images/icon_masa_rezervasyon.svg',
                            width: 13,
                            height: 13,
                            colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            tr('marketplace.reserve_now'),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
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
        ],
      ),
    );
  }

  void _showFilterSheet() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF2C2C2E) : Colors.white;

    // Collect available business types from reservation businesses
    final typeCounts = <String, int>{};
    for (final doc in widget.allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      if (data['hasReservation'] != true) continue;
      if (data['isActive'] == false) continue;
      final bt = (data['businessType'] as String? ?? '').toLowerCase();
      if (bt.isNotEmpty) {
        typeCounts[bt] = (typeCounts[bt] ?? 0) + 1;
      }
    }
    final sortedTypes = typeCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.7,
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: Column(
                children: [
                  // Handle
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          tr('marketplace.filter_title'),
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _categoryFilter = 'all';
                              _filterOpenNow = false;
                              _filterHighRating = false;
                              _onlyTuna = false;
                              _sortMode = 'distance';
                            });
                            setSheetState(() {});
                            _filterBusinesses();
                          },
                          child: Text(
                            tr('marketplace.filter_reset'),
                            style: TextStyle(color: _lokmaPink, fontSize: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Filter list
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Sort section
                          Text(
                            tr('marketplace.sort_section'),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          _filterItem(
                            title: tr('marketplace.sort_nearest'),
                            isSelected: _sortMode == 'distance',
                            useRadio: true,
                            isDark: isDark,
                            onTap: () {
                              setState(() => _sortMode = 'distance');
                              setSheetState(() {});
                              _filterBusinesses();
                            },
                          ),
                          _filterItem(
                            title: tr('marketplace.sort_best_rating'),
                            isSelected: _sortMode == 'rating',
                            useRadio: true,
                            isDark: isDark,
                            onTap: () {
                              setState(() => _sortMode = 'rating');
                              setSheetState(() {});
                              _filterBusinesses();
                            },
                          ),
                          const SizedBox(height: 20),

                          // Category section
                          Text(
                            tr('marketplace.business_type_section'),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          _filterItem(
                            title: tr('marketplace.filter_all'),
                            isSelected: _categoryFilter == 'all',
                            useRadio: true,
                            isDark: isDark,
                            onTap: () {
                              setState(() => _categoryFilter = 'all');
                              setSheetState(() {});
                              _filterBusinesses();
                            },
                          ),
                          ...sortedTypes.map((e) => _filterItem(
                                title: '${getBusinessTypeLabel(e.key)} (${e.value})',
                                isSelected: _categoryFilter == e.key,
                                useRadio: true,
                                isDark: isDark,
                                onTap: () {
                                  setState(() => _categoryFilter = e.key);
                                  setSheetState(() {});
                                  _filterBusinesses();
                                },
                              )),
                          const SizedBox(height: 20),

                          // Quick filters
                          Text(
                            tr('marketplace.quick_filters_section'),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          _filterItem(
                            title: tr('marketplace.filter_open_now_title'),
                            isSelected: _filterOpenNow,
                            isDark: isDark,
                            onTap: () {
                              setState(() => _filterOpenNow = !_filterOpenNow);
                              setSheetState(() {});
                              _filterBusinesses();
                            },
                          ),
                          _filterItem(
                            title: tr('marketplace.filter_high_rating_title'),
                            isSelected: _filterHighRating,
                            isDark: isDark,
                            onTap: () {
                              setState(() => _filterHighRating = !_filterHighRating);
                              setSheetState(() {});
                              _filterBusinesses();
                            },
                          ),
                          _filterItem(
                            title: 'TUNA Partner',
                            isSelected: _onlyTuna,
                            isDark: isDark,
                            onTap: () {
                              setState(() => _onlyTuna = !_onlyTuna);
                              setSheetState(() {});
                              _filterBusinesses();
                            },
                          ),
                          const SizedBox(height: 80),
                        ],
                      ),
                    ),
                  ),
                  // Apply button
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardBg,
                      boxShadow: [
                        BoxShadow(
                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, -2),
                        ),
                      ],
                    ),
                    child: SafeArea(
                      top: false,
                      child: SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: () => Navigator.pop(context),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _lokmaPink,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(25),
                            ),
                          ),
                          child: Text(
                            tr('marketplace.show_businesses', args: ['${_filteredBusinesses.length}']),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.surface,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _filterItem({
    required String title,
    required bool isSelected,
    required bool isDark,
    required VoidCallback onTap,
    bool useRadio = false,
  }) {
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleColor = isDark ? Colors.grey[500]! : Colors.grey[400]!;

    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: TextStyle(fontSize: 15, color: textColor),
              ),
            ),
            if (useRadio)
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected ? _lokmaPink : subtleColor,
                    width: 2,
                  ),
                ),
                child: isSelected
                    ? Center(
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: const BoxDecoration(
                            color: _lokmaPink,
                            shape: BoxShape.circle,
                          ),
                        ),
                      )
                    : null,
              )
            else
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: isSelected ? _lokmaPink : Colors.transparent,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(
                    color: isSelected ? _lokmaPink : subtleColor,
                    width: 1.5,
                  ),
                ),
                child: isSelected
                    ? Icon(Icons.check, color: Theme.of(context).colorScheme.surface, size: 16)
                    : null,
              ),
          ],
        ),
      ),
    );
  }
}

class _ReservationBusiness {
  final String docId;
  final Map<String, dynamic> data;
  final double? distanceKm;

  _ReservationBusiness({
    required this.docId,
    required this.data,
    this.distanceKm,
  });
}
