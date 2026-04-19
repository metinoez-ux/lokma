import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/services/weather_service.dart';
import 'package:lokma_app/screens/kermes/kermes_parking_screen.dart';
import 'package:lokma_app/services/kermes_badge_service.dart';
import 'package:lokma_app/services/kermes_feature_service.dart';

const Color bgDark = Color(0xFF0A0C10);
const Color surfaceObsidian = Color(0xFF111318);
const Color primaryRuby = Color(0xFF9B111E);
const Color accentRuby = Color(0xFF7A0D18);
const Color lightText = Color(0xFFE2E8F0);
const Color mutedGray = Color(0xFF94A3B8);

class KermesExtendedInfo extends StatefulWidget {
  final KermesEvent event;
  final Position? currentPosition;
  final VoidCallback? onMenuTap;

  const KermesExtendedInfo({
    super.key,
    required this.event,
    this.currentPosition,
    this.onMenuTap,
  });

  @override
  State<KermesExtendedInfo> createState() => _KermesExtendedInfoState();
}

class _KermesExtendedInfoState extends State<KermesExtendedInfo> {
  WeatherForecast? _weatherForecast;
  bool _isLoadingWeather = true;
  int _selectedDayIndex = 0;

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
        setState(() {
          _isLoadingWeather = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingWeather = false;
        });
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

  String get _travelTimeText {
    final totalMinutes = (_distanceKm / 80 * 60).round();
    final hours = totalMinutes ~/ 60;
    final minutes = totalMinutes % 60;
    if (hours > 0) {
      return '${hours}s ${minutes}dk';
    }
    return '${minutes}dk';
  }

  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          const SizedBox(height: 16),
          if (_hasAnyFeature()) ...[
            _buildFeaturesSection(),
            const SizedBox(height: 16),
          ],
          _buildLocationCard(),
          const SizedBox(height: 16),
          _buildParkingCard(),
          const SizedBox(height: 24),
          _buildWeatherSection(),
          const SizedBox(height: 24),
          _buildContactCard(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildLocationCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF18181B) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[200]!),
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD32F2F).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.location_on, color: Color(0xFFD32F2F), size: 18),
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'LOKASYON',
                            style: TextStyle(
                              color: isDark ? Colors.grey[400] : Colors.grey[500],
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2,
                            ),
                          ),
                          Text(
                            '${widget.event.city}, ${widget.event.country.split(' ').first}',
                            style: TextStyle(
                              color: isDark ? Colors.white : Colors.black87,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              // Süre ve mesafe badges
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildMiniInfoBadge(Icons.directions_car, _travelTimeText, const Color(0xFFD32F2F)),
                  const SizedBox(width: 6),
                  _buildMiniInfoBadge(Icons.near_me, '${_distanceKm.toInt()}km', isDark ? Colors.grey[400]! : Colors.grey[600]!),
                ],
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Adres
          Text(
            widget.event.address,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 16,
              fontWeight: FontWeight.w600,
              height: 1.3,
            ),
          ),

          const SizedBox(height: 20),

          // Navigasyon butonu
          GestureDetector(
            onTap: _openMaps,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFD32F2F),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.navigation, color: Colors.white, size: 18),
                  SizedBox(width: 12),
                  Text(
                    'NAVİGASYON',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
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

  Widget _buildMiniInfoBadge(IconData icon, String text, Color iconColor) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[100],
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: iconColor, size: 12),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  /// Park Kartı
  Widget _buildParkingCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const parkingImageUrl =
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80';

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
        height: 120,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[200]!),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Background image
            Positioned.fill(
              child: Image.network(
                parkingImageUrl,
                fit: BoxFit.cover,
                color: Colors.black.withOpacity(isDark ? 0.7 : 0.4),
                colorBlendMode: BlendMode.darken,
                errorBuilder: (_, __, ___) => Container(color: isDark ? const Color(0xFF18181B) : Colors.grey[300]),
              ),
            ),

            // Content
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  // Sol taraf - Büyük mavi P logosu
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF2563EB).withOpacity(0.3),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'P',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  // Sağ taraf - Metin bilgisi
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Park Bilgisi',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: const Color(0xFF34D399),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF34D399).withOpacity(0.6),
                                    blurRadius: 8,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'Müsait Park Alanı',
                              style: TextStyle(
                                color: Color(0xFF34D399),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Sağ ok ikonu
                  Icon(
                    Icons.arrow_forward_ios,
                    color: Colors.white.withOpacity(0.7),
                    size: 16,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Hava Durumu Bölümü - Canlı API verisi
  Widget _buildWeatherSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Loading state
    if (_isLoadingWeather) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF18181B) : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[200]!),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: Color(0xFF60A5FA)),
        ),
      );
    }

    // API verisi yoksa fallback
    if (_weatherForecast == null) {
      return _buildFallbackWeatherSection();
    }

    final dailySummaries = _weatherForecast!.getDailySummaries();
    final selectedDayHourly = _selectedDayIndex < dailySummaries.length
        ? _weatherForecast!
            .getHourlyForDay(dailySummaries[_selectedDayIndex].date)
        : <HourlyWeather>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.circle, color: Color(0xFF22C55E), size: 6),
                    SizedBox(width: 4),
                    Text(
                      'CANLI',
                      style: TextStyle(
                        color: Color(0xFF22C55E),
                        fontSize: 8,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${widget.event.city.toUpperCase()} HAVA DURUMU',
                style: TextStyle(
                  color: isDark ? Colors.grey[400] : Colors.grey[500],
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
        ),

        // Günlük hava durumu kartları
        SizedBox(
          height: 180,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: dailySummaries.length.clamp(0, 5),
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final day = dailySummaries[index];
              final isSelected = index == _selectedDayIndex;
              final dayName = _getTurkishDayName(day.date);

              return GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  setState(() {
                    _selectedDayIndex = index;
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 130,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFD32F2F) : (isDark ? const Color(0xFF18181B) : Colors.white),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected
                          ? Colors.transparent
                          : (isDark ? Colors.white.withOpacity(0.05) : Colors.grey[200]!),
                      width: 1,
                    ),
                    boxShadow: [
                      if (!isDark && !isSelected)
                        BoxShadow(
                          color: Colors.black.withOpacity(0.03),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      if (isSelected)
                        BoxShadow(
                          color: const Color(0xFFD32F2F).withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 6),
                        ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Gün adı
                      Text(
                        dayName.toUpperCase(),
                        style: TextStyle(
                          color: isSelected
                              ? Colors.white.withOpacity(0.9)
                              : (isDark ? Colors.grey[400] : Colors.grey[500]),
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        '${day.date.day}.${day.date.month}',
                        style: TextStyle(
                          color: isSelected
                              ? Colors.white.withOpacity(0.7)
                              : (isDark ? Colors.grey[500] : Colors.grey[400]),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Hava durumu ikonu ve sıcaklık
                      Row(
                        children: [
                          Image.network(
                            day.iconUrl,
                            width: 32,
                            height: 32,
                            errorBuilder: (_, __, ___) => Icon(
                              Icons.wb_sunny,
                              color: Colors.yellow.shade600,
                              size: 28,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '${day.avgTemperature.round()}°',
                            style: TextStyle(
                              color: isSelected ? Colors.white : (isDark ? Colors.white : Colors.black87),
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -1,
                            ),
                          ),
                        ],
                      ),

                      const Spacer(),

                      // Alt bilgiler
                      Container(
                        padding: const EdgeInsets.only(top: 6),
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(
                              color: isSelected
                                  ? Colors.white.withOpacity(0.2)
                                  : (isDark ? Colors.white.withOpacity(0.08) : Colors.grey[100]!),
                            ),
                          ),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Icon(Icons.water_drop,
                                    color: isSelected ? Colors.white.withOpacity(0.8) : Colors.blue.shade400,
                                    size: 10),
                                const SizedBox(width: 4),
                                Text(
                                  '%${day.maxRainProbability.round()}',
                                  style: TextStyle(
                                    color: isSelected ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Icon(Icons.air,
                                    color: isSelected ? Colors.white.withOpacity(0.8) : Colors.grey[400],
                                    size: 10),
                                const SizedBox(width: 4),
                                Text(
                                  '${day.avgWindSpeed.round()}km/s',
                                  style: TextStyle(
                                    color: isSelected ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                    fontSize: 9,
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
                ),
              );
            },
          ),
        ),

        // Saatlik hava durumu
        if (selectedDayHourly.isNotEmpty) ...[
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'SAATLİK TAHMİN',
              style: TextStyle(
                color: isDark ? Colors.grey[500] : Colors.grey[400],
                fontSize: 9,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.5,
              ),
            ),
          ),
          SizedBox(
            height: 85,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: selectedDayHourly.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final hour = selectedDayHourly[index];
                return Container(
                  width: 60,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF18181B) : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[200]!),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${hour.dateTime.hour}:00',
                        style: TextStyle(
                          color: isDark ? Colors.grey[400] : Colors.grey[500],
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Image.network(
                        hour.iconUrl,
                        width: 24,
                        height: 24,
                        errorBuilder: (_, __, ___) => Icon(
                          Icons.wb_sunny,
                          color: Colors.yellow.shade600,
                          size: 20,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${hour.temperature.round()}°',
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],

        const SizedBox(height: 24),
      ],
    );
  }

  /// Fallback hava durumu - API başarısız olursa eski sisteme dön
  Widget _buildFallbackWeatherSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (widget.event.weatherForecast.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 16),
          child: Text(
            '${widget.event.city.toUpperCase()} KERMES GÜNLERİ\nTAHMİNİ HAVA DURUMU',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[500],
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
              height: 1.5,
            ),
          ),
        ),
        SizedBox(
          height: 160,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: widget.event.weatherForecast.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final weather = widget.event.weatherForecast[index];
              final dayNumber = index + 1;

              return Container(
                width: 140,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF18181B) : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[200]!),
                  boxShadow: [
                    if (!isDark)
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$dayNumber. KERMES GÜNÜ',
                      style: TextStyle(
                        color: isDark ? Colors.grey[400] : Colors.grey[500],
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Icon(weather.icon, color: Colors.yellow.shade600, size: 28),
                        const SizedBox(width: 8),
                        Text(
                          '${weather.temp.round()}°',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        Icon(Icons.water_drop, color: Colors.blue.shade400, size: 12),
                        const SizedBox(width: 6),
                        Text(
                          '%${weather.rainProbability}',
                          style: TextStyle(
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  String _getTurkishDayName(DateTime date) {
    return DateFormat('EEEE', context.locale.languageCode).format(date);
  }

  /// İletişim Kartı
  Widget _buildContactCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF18181B) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[200]!),
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFD32F2F).withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.person, color: Color(0xFFD32F2F), size: 24),
          ),
          const SizedBox(width: 16),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'YETKİLİ KİŞİ',
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[500],
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.event.contactName?.isNotEmpty == true
                      ? widget.event.contactName!
                      : (widget.event.title.isNotEmpty
                          ? widget.event.title
                          : 'Yetkili Kişi'),
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  widget.event.phoneNumber.isNotEmpty
                      ? widget.event.phoneNumber
                      : '+49 XXX XXX XXXX',
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),

          // Call button
          GestureDetector(
            onTap: _callPhone,
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.call, color: Color(0xFF10B981), size: 24),
            ),
          ),
        ],
      ),
    );
  }

  void _openMaps() async {
    final url = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=${widget.event.latitude},${widget.event.longitude}');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  void _callPhone() async {
    final phone = widget.event.phoneNumber.isNotEmpty
        ? widget.event.phoneNumber
        : '+49 XXX XXX XXXX';
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  bool _hasAnyFeature() {
    final e = widget.event;
    if (e.features.isNotEmpty || e.customFeatures.isNotEmpty) return true;
    return e.hasKidsActivities ||
        e.hasFamilyArea ||
        e.hasOutdoor ||
        e.hasCreditCardPayment ||
        e.hasIndoorArea ||
        e.hasVegetarian ||
        e.hasAccessible ||
        e.hasParking;
  }

  Widget _buildFeaturesSection() {
    final event = widget.event;
    final displayFeatures = <Widget>[];

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
      'free_entry': event.hasFreeEntry,
    };

    for (final badgeId in event.activeBadgeIds) {
      final badge = _activeBadges[badgeId];
      if (badge != null && badge.isActive) {
        final bgColor =
            Color(int.parse(badge.colorHex.replaceFirst('#', '0xFF')));
        final textColor =
            Color(int.parse(badge.textColorHex.replaceFirst('#', '0xFF')));

        displayFeatures.add(Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: bgColor.withOpacity(0.15),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: bgColor.withOpacity(0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (badge.iconUrl.isNotEmpty) ...[
                // Not adding CachedNetworkImage here to avoid extra imports if untouched,
                // actually using standard Image.network to keep it lightweight.
                Image.network(
                  badge.iconUrl,
                  width: 14,
                  height: 14,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) =>
                      const SizedBox.shrink(),
                ),
                const SizedBox(width: 6),
              ],
              Text(
                badge.label.toUpperCase(),
                style: TextStyle(
                  color: textColor,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ));
      }
    }

    for (final feature in _globalFeatures.take(8)) {
      final featureId = feature.id;
      final isActive = event.features.contains(featureId) ||
          (legacyFeatureMap[featureId] ?? false);
      if (isActive) {
        displayFeatures.add(_buildDynamicFeatureChip(
          emoji: feature.icon,
          iconUrl: feature.iconUrl,
          label: 'kermes.feature_$featureId'.tr() != 'kermes.feature_$featureId'
              ? 'kermes.feature_$featureId'.tr()
              : feature.label,
          color: feature.colorValue,
        ));
      }
    }

    for (final customFeature in event.customFeatures.take(3)) {
      if (customFeature.isNotEmpty) {
        displayFeatures.add(_buildDynamicFeatureChip(
          emoji: '✨',
          label: customFeature,
          color: primaryRuby,
        ));
      }
    }

    if (displayFeatures.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          clipBehavior: Clip.none,
          child: Row(
            children: displayFeatures.map((widget) {
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: widget,
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildDynamicFeatureChip({
    required String emoji,
    String? iconUrl,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.25),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (iconUrl != null && iconUrl.isNotEmpty) ...[
            Image.network(
              iconUrl,
              width: 14,
              height: 14,
              errorBuilder: (_, __, ___) => Text(emoji, style: const TextStyle(fontSize: 12)),
            ),
            const SizedBox(width: 6),
          ] else if (emoji.isNotEmpty) ...[
            Text(emoji, style: const TextStyle(fontSize: 12)),
            const SizedBox(width: 6),
          ],
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: Theme.of(context).colorScheme.surface,
              fontSize: 9,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
