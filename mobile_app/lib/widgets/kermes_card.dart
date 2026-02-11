import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/screens/kermes/kermes_menu_screen.dart';
import 'package:lokma_app/screens/kermes/kermes_parking_screen.dart';
import 'package:lokma_app/services/kermes_favorite_service.dart';
import 'package:lokma_app/services/kermes_feature_service.dart';
import 'package:intl/intl.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

class KermesCard extends StatefulWidget {
  final KermesEvent event;
  final Position? currentPosition;
  final VoidCallback? onFavoriteChanged;
  final bool isExpanded;
  final VoidCallback? onExpandToggle;

  const KermesCard({
    super.key,
    required this.event,
    this.currentPosition,
    this.onFavoriteChanged,
    this.isExpanded = false,
    this.onExpandToggle,
  });

  @override
  State<KermesCard> createState() => _KermesCardState();
}

class _KermesCardState extends State<KermesCard> with SingleTickerProviderStateMixin {
  bool _isFavorite = false;
  List<KermesFeature> _globalFeatures = [];
  late AnimationController _expandController;
  late Animation<double> _expandAnimation;
  
  // Colors from HTML/Tailwind config
  static const Color primaryRose = Color(0xFFFB335B);
  static const Color cardLight = Colors.white;
  static const Color cardDark = Color(0xFF1F2937);
  static const Color textDark = Color(0xFF111827);
  static const Color textLight = Color(0xFFF3F4F6);
  static const Color surfaceObsidian = Color(0xFF1E293B);

  @override
  void initState() {
    super.initState();
    _checkFavorite();
    _loadFeatures();
    
    _expandController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _expandAnimation = CurvedAnimation(
      parent: _expandController,
      curve: Curves.easeInOut,
    );
    
    if (widget.isExpanded) {
      _expandController.value = 1.0;
    }
  }
  
  @override
  void didUpdateWidget(KermesCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isExpanded != oldWidget.isExpanded) {
      if (widget.isExpanded) {
        _expandController.forward();
      } else {
        _expandController.reverse();
      }
    }
  }
  
  @override
  void dispose() {
    _expandController.dispose();
    super.dispose();
  }

  Future<void> _loadFeatures() async {
    final features = await KermesFeatureService.instance.loadFeatures();
    if (mounted) {
      setState(() => _globalFeatures = features);
    }
  }

  Future<void> _checkFavorite() async {
    final isFav = await KermesFavoriteService.instance.isFavorite(widget.event.id);
    if (mounted) {
      setState(() => _isFavorite = isFav);
    }
  }

  Future<void> _toggleFavorite() async {
    final newState = await KermesFavoriteService.instance.toggleFavorite(widget.event);
    if (mounted) {
      setState(() => _isFavorite = newState);
      HapticFeedback.lightImpact();
      widget.onFavoriteChanged?.call();
    }
  }
  
  void _callPhone() async {
    final phone = widget.event.phoneNumber.isNotEmpty ? widget.event.phoneNumber : '';
    if (phone.isEmpty) return;
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // 1. Image Logic
    String? imagePath;
    bool isNetworkImage = false;

    if (widget.event.headerImage != null && widget.event.headerImage!.isNotEmpty) {
      imagePath = widget.event.headerImage;
    } else if (widget.event.flyers.isNotEmpty) {
      imagePath = widget.event.flyers.first;
    } else if (widget.event.menu.isNotEmpty && 
               widget.event.menu.any((m) => m.imageUrl != null || m.imageUrls.isNotEmpty)) {
        final item = widget.event.menu.firstWhere((m) => m.imageUrl != null || m.imageUrls.isNotEmpty);
        imagePath = item.imageUrls.isNotEmpty ? item.imageUrls.first : item.imageUrl;
    }
    if (imagePath != null && (imagePath.startsWith('http') || imagePath.startsWith('https'))) {
      isNetworkImage = true;
    }

    // 2. Date Text
    final startFormat = DateFormat('d.M').format(widget.event.startDate);
    final endFormat = DateFormat('d.M.yyyy').format(widget.event.endDate);
    final dateRangeText = '$startFormat - $endFormat';

    // 3. Status/Countdown
    final now = DateTime.now();
    final isLive = now.isAfter(widget.event.startDate) && now.isBefore(widget.event.endDate);
    final daysLeft = widget.event.startDate.difference(now).inDays;
    
    String statusText = '';
    List<Color> badgeGradient = [Colors.blue, Colors.indigo];
    IconData? badgeIcon = Icons.hourglass_top;

    if (isLive) {
      statusText = 'ŞU AN AÇIK';
      badgeGradient = [Colors.green, Colors.teal];
      badgeIcon = Icons.storefront;
    } else if (daysLeft == 0) {
      statusText = 'BUGÜN BAŞLIYOR';
      badgeGradient = [Colors.orange, Colors.deepOrange];
      badgeIcon = Icons.today;
    } else if (daysLeft > 0) {
      statusText = '$daysLeft gün kaldı';
      badgeGradient = [Colors.blue, Colors.indigo];
    } else {
      statusText = 'SONA ERDİ';
      badgeGradient = [Colors.grey, Colors.blueGrey];
      badgeIcon = Icons.event_busy;
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? cardDark : cardLight,
        borderRadius: BorderRadius.circular(24),
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
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          width: 1.5,
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
                height: 192,
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
                            placeholder: (context, url) => Container(color: Colors.grey[200]),
                            errorWidget: (context, url, error) => Container(
                              color: Colors.grey[200],
                              child: const Center(child: Icon(Icons.image_not_supported, color: Colors.grey)),
                            ),
                          )
                        : Image.asset(imagePath, fit: BoxFit.cover))
                    : _buildFallbackGradient(),
              ),

              // Top Left: Date Badge
              Positioned(
                top: 12,
                left: 12,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      color: isDark ? Colors.black.withOpacity(0.6) : Colors.white.withOpacity(0.9),
                      child: Text(
                        dateRangeText,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.grey[800],
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
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
                          _isFavorite ? Icons.favorite : Icons.favorite_outline,
                          color: _isFavorite ? primaryRose : Colors.white,
                          size: 24,
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // Bottom Right: Countdown Badge
              Positioned(
                bottom: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: LinearGradient(colors: badgeGradient),
                    boxShadow: [
                       BoxShadow(color: badgeGradient.last.withOpacity(0.4), blurRadius: 8, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (badgeIcon != null) ...[
                        Icon(badgeIcon, color: Colors.white, size: 14),
                        const SizedBox(width: 4),
                      ],
                      Text(
                        statusText,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // --- CONTENT SECTION ---
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title Header - Tappable for expand/collapse
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    widget.onExpandToggle?.call();
                  },
                  behavior: HitTestBehavior.opaque,
                  child: Row(
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
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                height: 1.2,
                                color: isDark ? Colors.white : textDark,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(Icons.flag, size: 16, color: primaryRose),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    '${widget.event.country} • ${widget.event.city}',
                                    style: TextStyle(
                                      color: isDark ? Colors.grey[400] : Colors.grey[500],
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
                      AnimatedRotation(
                        turns: widget.isExpanded ? 0.25 : 0,
                        duration: const Duration(milliseconds: 300),
                        child: Icon(
                          Icons.chevron_right,
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                          size: 28,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Tags
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _buildFeatureTags(isDark),
                ),

                const SizedBox(height: 16),
                
                // Divider
                Divider(color: isDark ? Colors.grey[800] : Colors.grey[100], height: 1),
                const SizedBox(height: 16),

                // Info Row (Distance + Courier)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (widget.currentPosition != null)
                      Row(
                        children: [
                          _buildIconText(Icons.near_me, '${_distanceKm} km', primaryRose, isDark),
                          const SizedBox(width: 12),
                          _buildIconText(Icons.directions_car, '~${_travelTime} dk', primaryRose, isDark),
                        ],
                      )
                    else 
                      const SizedBox(),

                    if (widget.event.hasDelivery)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: (isDark ? Colors.green.withOpacity(0.2) : const Color(0xFFECFDF5)),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.local_shipping, size: 14, color: Colors.green),
                            const SizedBox(width: 6),
                            Text(
                              'Kurye: ${widget.event.deliveryFee > 0 ? '${widget.event.deliveryFee}€' : 'Bedava'}',
                              style: TextStyle(
                                color: isDark ? Colors.green[400] : const Color(0xFF059669),
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),

                // --- COLLAPSIBLE DETAIL SECTION ---
                SizeTransition(
                  sizeFactor: _expandAnimation,
                  axisAlignment: -1,
                  child: Column(
                    children: [
                      const SizedBox(height: 16),
                      Divider(color: isDark ? Colors.grey[800] : Colors.grey[200], height: 1),
                      const SizedBox(height: 16),
                      
                      // --- PARK BİLGİSİ ---
                      if (widget.event.hasParking)
                        _buildParkingCard(isDark),
                      
                      if (widget.event.hasParking) const SizedBox(height: 12),
                      
                      // --- HAVA DURUMU PREVIEW ---
                      if (widget.event.weatherForecast.isNotEmpty)
                        _buildWeatherPreview(isDark),
                      
                      if (widget.event.weatherForecast.isNotEmpty) const SizedBox(height: 12),
                      
                      // --- YETKİLİ KİŞİ ---
                      if (widget.event.phoneNumber.isNotEmpty || widget.event.contactName?.isNotEmpty == true)
                        _buildContactCard(isDark),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // CTA Button
                Container(
                  width: double.infinity,
                  height: 52,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(26), // Tam pill şekli
                    gradient: const LinearGradient(
                      colors: [primaryRose, Color(0xFFE11D48)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFE11D48).withOpacity(0.25),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => KermesMenuScreen(
                              event: widget.event,
                            ),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(26),
                      child: const Center(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.shopping_bag, color: Colors.white, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Menüyü Gör & Sipariş Ver',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
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

  // --- Compact Info Card (for Parking, etc) ---
  Widget _buildCompactInfoCard({
    required IconData icon,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    required Color statusColor,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? surfaceObsidian.withOpacity(0.4) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[200]!),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Icon(icon, color: Colors.white, size: 20),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: isDark ? Colors.white : textDark,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- Park İmkanları Card (Tappable) ---
  Widget _buildParkingCard(bool isDark) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => KermesParkingScreen(event: widget.event),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? surfaceObsidian.withOpacity(0.4) : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[200]!),
        ),
        child: Row(
          children: [
            // Park icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Center(
                child: Text(
                  'P',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Text content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Park İmkanları',
                    style: TextStyle(
                      color: isDark ? Colors.white : textDark,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: Color(0xFF34D399),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Müsait park alanı',
                        style: TextStyle(
                          color: Color(0xFF34D399),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Right arrow
            Icon(
              Icons.chevron_right,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              size: 24,
            ),
          ],
        ),
      ),
    );
  }

  // --- Weather Preview (Mini version) ---

  Widget _buildWeatherPreview(bool isDark) {
    final forecasts = widget.event.weatherForecast.take(3).toList();
    
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? surfaceObsidian.withOpacity(0.4) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.wb_sunny, color: Colors.orange[400], size: 18),
              const SizedBox(width: 8),
              Text(
                'Hava Durumu',
                style: TextStyle(
                  color: isDark ? Colors.white : textDark,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: forecasts.map((weather) {
              return Column(
                children: [
                  Icon(weather.icon, color: Colors.blue[400], size: 24),
                  const SizedBox(height: 4),
                  Text(
                    '${weather.temp.round()}°',
                    style: TextStyle(
                      color: isDark ? Colors.white : textDark,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    '%${weather.rainProbability}',
                    style: TextStyle(
                      color: Colors.blue[400],
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // --- Contact Card ---
  Widget _buildContactCard(bool isDark) {
    final contactName = widget.event.contactName?.isNotEmpty == true 
        ? widget.event.contactName! 
        : widget.event.title;
    final phone = widget.event.phoneNumber;
    
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? surfaceObsidian.withOpacity(0.4) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[200]!),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.asset(
                'assets/images/admin_icon.png',
                fit: BoxFit.cover,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Yetkili Kişi',
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[500],
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  contactName,
                  style: TextStyle(
                    color: isDark ? Colors.white : textDark,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (phone.isNotEmpty)
                  Text(
                    phone,
                    style: TextStyle(
                      color: isDark ? Colors.grey[400] : Colors.grey[500],
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
          if (phone.isNotEmpty)
            GestureDetector(
              onTap: _callPhone,
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.call, color: Color(0xFF10B981), size: 20),
              ),
            ),
        ],
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
    ) / 1000;
    return dist.toStringAsFixed(0);
  }
  
  String get _travelTime {
    if (widget.currentPosition == null) return '';
    final dist = Geolocator.distanceBetween(
      widget.currentPosition!.latitude,
      widget.currentPosition!.longitude,
      widget.event.latitude,
      widget.event.longitude,
    ) / 1000;
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
      child: const Center(child: Icon(Icons.storefront, size: 50, color: Colors.white24)),
    );
  }

  List<Widget> _buildFeatureTags(bool isDark) {
    final tags = <Widget>[];
    final event = widget.event;
    
    final legacyFeatureMap = {
      'family_area': event.hasFamilyArea,
      'outdoor': event.hasOutdoor,
      'indoor': event.hasIndoorArea,
      'kids_area': event.hasKidsActivities,
      'card_payment': event.hasCreditCardPayment,
      'parking': event.hasParking,
      'vegetarian': event.hasVegetarian,
      'accessible': event.hasAccessible,
      'halal': event.hasHalal,
      'wifi': event.hasWifi,
      'live_music': event.hasLiveMusic,
      'prayer_room': event.hasPrayerRoom,
    };
    
    for (final feature in _globalFeatures.take(5)) {
      final featureId = feature.id;
      final isActive = event.features.contains(featureId) || 
                       (legacyFeatureMap[featureId] ?? false);
      
      if (isActive) {
        tags.add(_buildDynamicColorTag(feature.icon, feature.label, feature.colorValue, isDark));
      }
    }
    
    for (final customFeature in event.customFeatures.take(3)) {
      if (customFeature.isNotEmpty) {
        tags.add(_buildDynamicColorTag('✨', customFeature, primaryRose, isDark));
      }
    }
    
    return tags;
  }

  Widget _buildDynamicColorTag(String emoji, String text, Color color, bool isDark) {
    final bg = isDark ? color.withOpacity(0.2) : color.withOpacity(0.1);
    final textColor = isDark ? color.withOpacity(0.9) : color;
    final border = isDark ? color.withOpacity(0.3) : color.withOpacity(0.2);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 12)),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              color: textColor,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIconText(IconData icon, String text, Color iconColor, bool isDark) {
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
}
