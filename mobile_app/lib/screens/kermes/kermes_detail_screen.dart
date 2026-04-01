import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/services/weather_service.dart';
import 'package:lokma_app/screens/kermes/kermes_parking_screen.dart';
import 'package:lokma_app/services/kermes_badge_service.dart';
import 'package:lokma_app/services/kermes_feature_service.dart';
import 'package:lokma_app/screens/kermes/kermes_menu_screen.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cached_network_image/cached_network_image.dart';

// Tailwind Colors mapped from HTML
const Color primaryRuby = Color(0xFFD32F2F);
const Color accentRuby = Color(0xFFB71C1C);
const Color lightText = Color(0xFFF3F4F6);

class KermesDetailScreen extends StatefulWidget {
  final KermesEvent event;
  final Position? currentPosition;

  const KermesDetailScreen({
    super.key,
    required this.event,
    this.currentPosition,
  });

  @override
  State<KermesDetailScreen> createState() => _KermesDetailScreenState();
}

class _KermesDetailScreenState extends State<KermesDetailScreen> {
  WeatherForecast? _weatherForecast;
  bool _isLoadingWeather = true;
  List<KermesFeature> _globalFeatures = [];
  Map<String, KermesBadge> _activeBadges = {};

  @override
  void initState() {
    super.initState();
    _fetchLiveWeather();
    _loadGlobalFeatures();
    _loadBadges();
  }

  Future<void> _loadBadges() async {
    final badges = await KermesBadgeService.instance.loadBadges();
    if (mounted) {
      setState(() => _activeBadges = badges);
    }
  }

  Future<void> _loadGlobalFeatures() async {
    final features = await KermesFeatureService.getActiveFeatures();
    if (mounted) {
      setState(() => _globalFeatures = features);
    }
  }

  Future<void> _fetchLiveWeather() async {
    try {
      final forecast = await WeatherService.getForecast(
        lat: widget.event.latitude,
        lon: widget.event.longitude,
      );

      if (mounted && forecast != null) {
        setState(() {
          _weatherForecast = forecast;
          _isLoadingWeather = false;
        });
      } else if (mounted) {
        setState(() => _isLoadingWeather = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingWeather = false);
      }
    }
  }

  double get _distanceKm {
    if (widget.currentPosition == null) return 0;
    return Geolocator.distanceBetween(
          widget.currentPosition!.latitude,
          widget.currentPosition!.longitude,
          widget.event.latitude,
          widget.event.longitude,
        ) /
        1000;
  }

  Future<void> _openMaps() async {
    final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=${widget.event.latitude},${widget.event.longitude}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  String _getTurkishDayName(DateTime date) {
    const days = [
      'Pazartesi',
      'Salı',
      'Çarşamba',
      'Perşembe',
      'Cuma',
      'Cumartesi',
      'Pazar'
    ];
    return days[date.weekday - 1];
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF050505) : const Color(0xFFF9F9F9),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 120),
        child: Column(
          children: [
            _buildHeroSection(context),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildMenuBanner(context),
                  const SizedBox(height: 20),
                  if (_globalFeatures.isNotEmpty) ...[
                    _buildFeaturesRow(),
                    const SizedBox(height: 20),
                  ],
                  _buildLocationCard(),
                  const SizedBox(height: 20),
                  _buildParkingCard(),
                  const SizedBox(height: 20),
                  _buildWeatherSection(),
                  const SizedBox(height: 20),
                  _buildAdminCard(),
                  _buildContactCard(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroSection(BuildContext context) {
    return Container(
      height: 440,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF141416).withOpacity(0.9),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background Image
          widget.event.headerImage != null && widget.event.headerImage!.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: widget.event.headerImage!,
                  fit: BoxFit.cover,
                  color: Colors.black.withOpacity(0.1),
                  colorBlendMode: BlendMode.darken,
                )
              : Container(color: const Color(0xFF1E1E1E)),

          // Gradient Overlay
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [
                  Colors.black,
                  Colors.black.withOpacity(0.3),
                  Colors.transparent,
                ],
              ),
            ),
          ),

          // Top Action Buttons
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 20,
            right: 20,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildGlassButton(Icons.arrow_back, () => Navigator.pop(context)),
                Row(
                  children: [
                    _buildGlassButton(Icons.favorite_border, () {}),
                    const SizedBox(width: 12),
                    _buildGlassButton(Icons.share, () {}),
                  ],
                ),
              ],
            ),
          ),

          // Bottom Content
          Positioned(
            bottom: 24,
            left: 24,
            right: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Location Badge
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: primaryRuby.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        widget.event.city.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${widget.event.country.split(' ').first} 🇩🇪',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Title
                Text(
                  widget.event.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    fontWeight: FontWeight.bold,
                    height: 1.1,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 16),

                // Countdown Indicator
                Row(
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: primaryRuby.withOpacity(0.5),
                          ),
                        ),
                        Container(
                          width: 4,
                          height: 4,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: primaryRuby,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${DateTime.now().difference(widget.event.startDate).inDays.abs()} GÜN KALDI',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Glassmorphic Date & Time Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white.withOpacity(0.1)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Date
                      Expanded(
                        flex: 12,
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.calendar_today, color: Colors.white.withOpacity(0.9), size: 18),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'TARİH',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.5),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      '${widget.event.startDate.day}.${widget.event.startDate.month} - ${widget.event.endDate.day}.${widget.event.endDate.month}.${widget.event.endDate.year}',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Divider
                      Expanded(
                        flex: 2,
                        child: Center(
                          child: Container(
                            width: 1,
                            height: 32,
                            color: Colors.white.withOpacity(0.2),
                          ),
                        ),
                      ),
                      // Time
                      Expanded(
                        flex: 10,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    'SAAT',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.5),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.centerRight,
                                    child: Text(
                                      '10:00 - 22:00',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.schedule, color: Colors.white.withOpacity(0.9), size: 18),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGlassButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.2),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: ClipOval(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Center(
              child: Icon(icon, color: Colors.white, size: 20),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMenuBanner(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => KermesMenuScreen(
              event: widget.event,
              currentPosition: widget.currentPosition,
            ),
          ),
        );
      },
      child: Container(
        height: 220,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          color: Theme.of(context).colorScheme.surface,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            CachedNetworkImage(
              imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJbRi7Loz4DMKqPn8OxdwybssRuCj0euEnxEc2C3sIHp6PFPWFIxOz6Cl1hciT95IosE2iL3AOdQZla7X1RwTK4ZloveV5PhHcDz2MIcFPkRk1fYTc6j15pKLPVi4nGg1p2FgfsHwmyUCs8CHb-DA_fXZbgYlwwXOLlYtl3y2Zsk3SbNm8_lHiurj651KmrmAse3uiJELB_Abh3LbqDqyDFQdnjAdhne_sjvjeNEnJDhq6P7tR33_Z97ZDVPbNUCIT78xhXY9zlnQM',
              fit: BoxFit.cover,
            ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Colors.black.withOpacity(0.9),
                    Colors.black.withOpacity(0.4),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
            Positioned(
              top: 20,
              right: 20,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    color: primaryRuby.withOpacity(0.9),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.star, color: Colors.white, size: 12),
                        SizedBox(width: 4),
                        Text(
                          'POPÜLER',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 24,
              left: 24,
              right: 24,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: primaryRuby,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'LEZZET ŞÖLENİ',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.8),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 2,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Menü ve\nSipariş',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            height: 1,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Kebaplar, tatlılar ve sokak\nlezzetlerini keşfet.',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.6),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.arrow_forward, color: primaryRuby, size: 24),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeaturesRow() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white.withOpacity(0.9) : Colors.black87;
    final bg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: _globalFeatures.map((f) {
          return Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: bg,
                border: Border.all(color: bg),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  if (f.icon.isNotEmpty) ...[
                    Text(f.icon, style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    f.label,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLocationCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: dividerBg,
                        shape: BoxShape.circle,
                        border: Border.all(color: dividerBg),
                      ),
                      child: Icon(Icons.location_on, color: textColor, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'LOKASYON',
                            style: TextStyle(
                              color: subtleTextColor,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1,
                            ),
                          ),
                          Text(
                            '${widget.event.city}, ${widget.event.country.split(' ').first}',
                            style: TextStyle(
                              color: textColor,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: dividerBg,
                  border: Border.all(color: dividerBg),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(Icons.near_me, color: subtleTextColor, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      '${_distanceKm.toStringAsFixed(1)} km',
                      style: TextStyle(
                        color: textColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            [
              if (widget.event.address.isNotEmpty) widget.event.address,
              if (widget.event.postalCode.isNotEmpty || widget.event.city.isNotEmpty)
                '${widget.event.postalCode} ${widget.event.city}'.trim(),
              if (widget.event.state?.isNotEmpty == true) widget.event.state!,
              if (widget.event.country.isNotEmpty) widget.event.country,
            ].join('\n'),
            style: TextStyle(
              color: isDark ? Colors.white.withOpacity(0.9) : Colors.black87,
              fontSize: 15,
              fontWeight: FontWeight.w500,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _openMaps,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: primaryRuby,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.blue.shade900.withOpacity(0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.navigation, color: Colors.white, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'YOL TARİFİ AL',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildParkingCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (context) => KermesParkingScreen(event: widget.event),
        );
      },
      child: Container(
        height: 128,
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(24),
          boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned.fill(
              child: Opacity(
                opacity: 0.5,
                child: CachedNetworkImage(
                  imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCghDSwUkHQ0hd_B-McJJ4fZPGP8zjK929y42shgv2J-MhJ392FInWVjplw_iuK_8Us9DBl_U8KTvA_Ta8idIJiKv_mnOJBrLM_A9DJmJYQA5p0PG-nI6sW97x-t_mZlqnsqwl9JFl73dwWa--SMG6BWh3zFYa31muxxpjbsG95nxmIWM6pz_B_90aqy3LThEiqT5dvrKWS3KmdN9GFxNmQo0oEx3uX6n4BA_0EGwpo6KT0wuFf9qJ6XjOUlIn9_HK_uE8PQkwHbrae',
                  fit: BoxFit.cover,
                  color: isDark ? Colors.grey : Colors.grey.shade400,
                  colorBlendMode: BlendMode.saturation,
                  errorWidget: (context, url, error) => Container(color: cardBg),
                ),
              ),
            ),
            Positioned.fill(
              child: Container(
                color: cardBg.withOpacity(0.8),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                     crossAxisAlignment: CrossAxisAlignment.start,
                     mainAxisAlignment: MainAxisAlignment.center,
                     children: [
                       Row(
                         children: [
                           const Text(
                             'OTOPARK DURUMU',
                             style: TextStyle(
                               color: Color(0xFF4ADE80),
                               fontSize: 10,
                               fontWeight: FontWeight.bold,
                               letterSpacing: 1,
                             ),
                           ),
                           const SizedBox(width: 8),
                           Container(
                             width: 6,
                             height: 6,
                             decoration: const BoxDecoration(
                               color: Color(0xFF4ADE80),
                               shape: BoxShape.circle,
                             ),
                           ),
                         ],
                       ),
                       const SizedBox(height: 4),
                       Text(
                         'Park Bilgisi',
                         style: TextStyle(
                           color: textColor,
                           fontSize: 18,
                           fontWeight: FontWeight.bold,
                           letterSpacing: -0.5,
                         ),
                       ),
                       const SizedBox(height: 4),
                       Row(
                         children: [
                           Text(
                             'Boş Yer: ',
                             style: TextStyle(color: subtleTextColor, fontSize: 12),
                           ),
                           Text(
                             '150+',
                             style: TextStyle(
                               color: textColor,
                               fontSize: 12,
                               fontWeight: FontWeight.bold,
                             ),
                           ),
                         ],
                       ),
                     ],
                  ),
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: dividerBg,
                      shape: BoxShape.circle,
                      border: Border.all(color: dividerBg),
                    ),
                    child: Icon(Icons.local_parking, color: textColor.withOpacity(0.8), size: 24),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDateShort(DateTime date) {
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return '${date.day} ${months[date.month - 1]}';
  }

  Widget _buildWeatherSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

    if (_isLoadingWeather) {
      return SizedBox(
        height: 144,
        child: Center(child: CircularProgressIndicator(color: textColor)),
      );
    }
    if (_weatherForecast == null) return const SizedBox.shrink();

    final dailySummaries = _weatherForecast!.getDailySummaries();

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: dividerBg,
                  shape: BoxShape.circle,
                  border: Border.all(color: dividerBg),
                ),
                child: const Icon(Icons.wb_sunny, color: Colors.amber, size: 20),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'HAVA DURUMU',
                    style: TextStyle(
                      color: subtleTextColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                    ),
                  ),
                  Text(
                    'Etkinlik Günleri',
                    style: TextStyle(
                      color: textColor,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          Column(
            children: dailySummaries.take(3).map((day) {
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: dividerBg,
                  border: Border.all(color: dividerBg),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        SizedBox(
                          width: 48,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Text(
                                _getTurkishDayName(day.date).substring(0, 3).toUpperCase(),
                                style: TextStyle(
                                  color: textColor,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _formatDateShort(day.date),
                                style: TextStyle(
                                  color: subtleTextColor,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 32,
                          color: dividerBg,
                          margin: const EdgeInsets.symmetric(horizontal: 16),
                        ),
                        Row(
                          children: [
                            CachedNetworkImage(
                              imageUrl: day.iconUrl,
                              width: 20,
                              height: 20,
                              errorWidget: (_, __, ___) => const Icon(Icons.wb_sunny, color: Colors.amber, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Hava Durumu',
                              style: TextStyle(
                                color: textColor,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        Text(
                          '${day.avgTemperature.round()}°',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildAdminCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

    return Container(
      padding: const EdgeInsets.all(24),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  image: const DecorationImage(
                    fit: BoxFit.cover,
                    image: CachedNetworkImageProvider('https://ui-avatars.com/api/?name=Admin+User&background=random'),
                  ),
                  border: Border.all(color: dividerBg, width: 2),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Kermes Yetkilisi',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF3B82F6).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.3)),
                          ),
                          child: const Text(
                            'YETKİLİ',
                            style: TextStyle(
                              color: Color(0xFF60A5FA),
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Sorularınız için iletişime geçebilirsiniz.',
                      style: TextStyle(
                        color: subtleTextColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildContactCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

    return Container(
      padding: const EdgeInsets.all(24),
      margin: const EdgeInsets.only(bottom: 32),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: dividerBg,
                  shape: BoxShape.circle,
                  border: Border.all(color: dividerBg),
                ),
                child: Icon(Icons.contact_support, color: textColor, size: 20),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'İLETİŞİM',
                    style: TextStyle(
                      color: subtleTextColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                    ),
                  ),
                  Text(
                    'Bize Ulaşın',
                    style: TextStyle(
                      color: textColor,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: () async {
              final uri = Uri.parse('tel:+491631234567');
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri);
              }
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: dividerBg,
                border: Border.all(color: dividerBg),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0x1A22C55E),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.phone, color: Color(0xFF4ADE80), size: 20),
                  ),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Telefon',
                        style: TextStyle(
                          color: subtleTextColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '+49 163 123 4567',
                         style: TextStyle(
                          color: textColor,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
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
}
