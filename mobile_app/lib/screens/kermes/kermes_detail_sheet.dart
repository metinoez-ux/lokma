import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:geolocator/geolocator.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/screens/kermes/kermes_menu_screen.dart';
import 'package:lokma_app/screens/kermes/kermes_parking_screen.dart';
import 'package:lokma_app/services/kermes_feature_service.dart';
import 'package:lokma_app/services/weather_service.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

// LOKMA Kermes LUXURY DARK THEME renkleri
const Color bgDark = Color(0xFF0A0C10);
const Color surfaceObsidian = Color(0xFF111318);
const Color primaryRuby = Color(0xFF9B111E);
const Color accentRuby = Color(0xFF7A0D18);
const Color lightText = Color(0xFFE2E8F0);
const Color mutedGray = Color(0xFF94A3B8);

/// Modern bottom sheet tarzında Kermes detay ekranı
/// Luxury Dark Theme - Stitch tasarımından Flutter'a uyarlanmıştır
class KermesDetailSheet extends StatefulWidget {
  final KermesEvent event;
  final Position? currentPosition;
  final bool isFavorite;
  final VoidCallback onFavoriteToggle;
  
  const KermesDetailSheet({
    super.key,
    required this.event,
    this.currentPosition,
    this.isFavorite = false,
    required this.onFavoriteToggle,
  });
  
  /// Bottom sheet olarak göster
  static void show(
    BuildContext context, {
    required KermesEvent event,
    Position? currentPosition,
    bool isFavorite = false,
    required VoidCallback onFavoriteToggle,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.7),
      builder: (context) => KermesDetailSheet(
        event: event,
        currentPosition: currentPosition,
        isFavorite: isFavorite,
        onFavoriteToggle: onFavoriteToggle,
      ),
    );
  }

  @override
  State<KermesDetailSheet> createState() => _KermesDetailSheetState();
}

class _KermesDetailSheetState extends State<KermesDetailSheet> {
  late bool _isFavorite;
  Timer? _countdownTimer;
  
  // Countdown değerleri
  int _days = 0;
  int _hours = 0;
  int _minutes = 0;
  bool _isCountingToEnd = false; // false = start'a sayıyor, true = end'e sayıyor
  
  // Live Weather Data
  WeatherForecast? _weatherForecast;
  bool _isLoadingWeather = true;
  int _selectedDayIndex = 0;
  
  // Global Kermes Features (Firestore'dan)
  List<KermesFeature> _globalFeatures = [];
  
  @override
  void initState() {
    super.initState();
    _isFavorite = widget.isFavorite;
    _updateCountdown();
    _countdownTimer = Timer.periodic(const Duration(minutes: 1), (_) => _updateCountdown());
    _fetchLiveWeather();
    _loadGlobalFeatures();
  }
  
  /// Global özellikleri Firestore'dan yükle
  Future<void> _loadGlobalFeatures() async {
    final features = await KermesFeatureService.getActiveFeatures();
    if (mounted) {
      setState(() => _globalFeatures = features);
    }
  }
  
  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }
  
  /// Canlı hava durumu verisi çek (OpenWeatherMap API)
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
  
  void _updateCountdown() {
    final now = DateTime.now();
    final startDate = DateTime(
      widget.event.startDate.year, 
      widget.event.startDate.month, 
      widget.event.startDate.day,
      int.tryParse(widget.event.openingTime.split(':')[0]) ?? 10,
      int.tryParse(widget.event.openingTime.split(':')[1]) ?? 0,
    );
    final endDate = DateTime(
      widget.event.endDate.year, 
      widget.event.endDate.month, 
      widget.event.endDate.day,
      int.tryParse(widget.event.closingTime.split(':')[0]) ?? 22,
      int.tryParse(widget.event.closingTime.split(':')[1]) ?? 0,
    );
    
    Duration difference;
    
    if (now.isBefore(startDate)) {
      // Kermes başlamadı - başlangıca say
      difference = startDate.difference(now);
      _isCountingToEnd = false;
    } else if (now.isBefore(endDate)) {
      // Kermes devam ediyor - bitişe say
      difference = endDate.difference(now);
      _isCountingToEnd = true;
    } else {
      // Kermes bitti
      difference = Duration.zero;
      _isCountingToEnd = true;
    }
    
    setState(() {
      _days = difference.inDays;
      _hours = difference.inHours % 24;
      _minutes = difference.inMinutes % 60;
    });
  }
  
  double get _distanceKm {
    if (widget.currentPosition == null) return 0;
    return Geolocator.distanceBetween(
      widget.currentPosition!.latitude,
      widget.currentPosition!.longitude,
      widget.event.latitude,
      widget.event.longitude,
    ) / 1000;
  }
  
  String get _dateText {
    final start = widget.event.startDate;
    final end = widget.event.endDate;
    return '${start.day}.${start.month} - ${end.day}.${end.month}.${end.year}';
  }
  
  String get _timeText => '${widget.event.openingTime} - ${widget.event.closingTime}';
  
  // Tahmini sürüş süresi (80 km/saat)
  String get _travelTimeText {
    final totalMinutes = (_distanceKm / 80 * 60).round();
    final hours = totalMinutes ~/ 60;
    final minutes = totalMinutes % 60;
    if (hours > 0) {
      return '${hours}s ${minutes}dk';
    }
    return '${minutes}dk';
  }
  
  String _getCountryFlag(String country) {
    final c = country.toLowerCase();
    if (c.contains('almanya') || c.contains('germany') || c.contains('de')) return '🇩🇪';
    if (c.contains('türkiye') || c.contains('turkey') || c.contains('tr')) return '🇹🇷';
    if (c.contains('avusturya') || c.contains('austria') || c.contains('at')) return '🇦🇹';
    if (c.contains('isviçre') || c.contains('switzerland') || c.contains('ch')) return '🇨🇭';
    if (c.contains('hollanda') || c.contains('netherlands') || c.contains('nl')) return '🇳🇱';
    if (c.contains('belçika') || c.contains('belgium') || c.contains('be')) return '🇧🇪';
    if (c.contains('fransa') || c.contains('france') || c.contains('fr')) return '🇫🇷';
    return '🌍';
  }
  
  /// Kermesi paylaş - Güzel davet metni ile
  void _shareKermes() {
    HapticFeedback.lightImpact();
    
    final event = widget.event;
    final flag = _getCountryFlag(event.country);
    final startDate = event.startDate;
    final endDate = event.endDate;
    
    // Tarih formatı
    final dateStr = startDate.day == endDate.day && startDate.month == endDate.month
        ? '${startDate.day}.${startDate.month}.${startDate.year}'
        : '${startDate.day}.${startDate.month} - ${endDate.day}.${endDate.month}.${endDate.year}';
    
    // Güzel davet metni oluştur
    final shareText = '''
🎪 Harika bir etkinliğe davetlisiniz! 🎉

📍 ${event.title.isNotEmpty ? event.title : '${event.city} Kermes'} $flag
📅 $dateStr
⏰ ${event.openingTime} - ${event.closingTime}
📌 ${event.address}, ${event.city}

🍢 Lezzetli yemekler, eğlenceli aktiviteler ve harika bir atmosfer sizi bekliyor!

Gel, birlikte güzel vakit geçirelim! 🤝

---
📱 LOKMA App ile kermes siparişlerini kolayca verebilirsin!
🛒 Menüyü incele, sipariş ver, sıra beklemeden al!
📲 İndir: https://lokma.shop/app

#Kermes #LOKMA #${event.city.replaceAll(' ', '')}
''';

    Share.share(
      shareText,
      subject: '🎪 ${event.title.isNotEmpty ? event.title : '${event.city} Kermes'} Davetiyesi',
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.95,
      minChildSize: 0.5,
      maxChildSize: 0.98,
      builder: (context, scrollController) => Container(
        decoration: BoxDecoration(
          color: bgDark,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(40)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Ana içerik
            CustomScrollView(
              controller: scrollController,
              slivers: [
                // Hero Image
                SliverToBoxAdapter(child: _buildHeroSection()),
                
                // Content
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 160),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      const SizedBox(height: 24),
                      
                      // MENÜ & SİPARİŞ - Full genişlik büyük kart
                      _buildMenuButton(),
                      
                      const SizedBox(height: 24),
                      
                      // Özellikler
                      if (_hasAnyFeature()) _buildFeaturesSection(),
                      
                      // Lokasyon kartı
                      _buildLocationCard(),
                      
                      const SizedBox(height: 16),
                      
                      // Park kartı
                      _buildParkingCard(),
                      
                      const SizedBox(height: 24),
                      
                      // Hava Durumu
                      _buildWeatherSection(),
                      
                      // İletişim
                      _buildContactCard(),
                    ]),
                  ),
                ),
              ],
            ),
            
            // Drag handle
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: IgnorePointer(
                child: Container(
                  height: 30,
                  alignment: Alignment.center,
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  /// Hero Section - 520px yüksekliğinde görsel (HTML tasarımına uygun)
  Widget _buildHeroSection() {
    // Türk kermes yemekleri görseli (Varsayılan)
    const kermesYemekleriUrl = 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80';
    
    // Admin tarafından seçilen görsel varsa onu kullan
    final displayImage = (widget.event.headerImage != null && widget.event.headerImage!.isNotEmpty)
        ? widget.event.headerImage!
        : kermesYemekleriUrl;
    
    return SizedBox(
      height: 520,
      child: Stack(
        children: [
          // Background image with vignette
          Positioned.fill(
            child: ShaderMask(
              shaderCallback: (rect) => LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black,
                  Colors.black.withValues(alpha: 0.6),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.4, 1.0],
              ).createShader(rect),
              blendMode: BlendMode.dstIn,
              child: CachedNetworkImage(
                imageUrl: displayImage,
                fit: BoxFit.cover,
                colorBlendMode: BlendMode.colorBurn,
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
                placeholder: (context, url) => Container(color: Theme.of(context).colorScheme.onSurface),
                errorWidget: (context, url, error) => Container(
                  color: primaryRuby.withValues(alpha: 0.3),
                  child: const Center(
                    child: Icon(Icons.festival, color: primaryRuby, size: 64),
                  ),
                ),
              ),
            ),
          ),
          
          // Gradient overlay - luxury dark version
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.2),
                    Colors.transparent,
                    bgDark,
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),
          
          // Üst bar butonları
          Positioned(
            top: 48,
            left: 24,
            right: 24,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Back button
                _buildGlassButton(
                  icon: Icons.arrow_back,
                  onTap: () => Navigator.pop(context),
                ),
                // Actions
                Row(
                  children: [
                    // Favorite button
                    _buildGlassButton(
                      icon: _isFavorite ? Icons.favorite : Icons.favorite_border,
                      iconColor: primaryRuby,
                      onTap: () {
                        setState(() => _isFavorite = !_isFavorite);
                        widget.onFavoriteToggle();
                        HapticFeedback.lightImpact();
                      },
                    ),
                    const SizedBox(width: 12),
                    // Share button
                    _buildGlassButton(
                      icon: Icons.share,
                      onTap: _shareKermes,
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Alt içerik - Başlık, tarih, countdown
          Positioned(
            bottom: 32,
            left: 24,
            right: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Şehir badge ve ülke
                Row(
                  children: [
                    Flexible(
                      child: Container(
                        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: primaryRuby,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          widget.event.city.toUpperCase(),
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.surface,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2,
                          ),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                      ),
                    ),
                    SizedBox(width: 12),
                    Text(
                      '${widget.event.country} ${_getCountryFlag(widget.event.country)}',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.6),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 12),
                // Title
                Text(
                  widget.event.title.isNotEmpty 
                    ? widget.event.title 
                    : '${widget.event.city} Büyük Türk Festivali',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.surface,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 16),
                
                // Countdown badge
                _buildCountdownBadge(),
                
                const SizedBox(height: 16),
                
                // Tarih ve Saat kartı
                _buildDateTimeCard(),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  /// Countdown Badge (yanıp sönen nokta ile)
  Widget _buildCountdownBadge() {
    final bool isFinished = _days == 0 && _hours == 0 && _minutes == 0 && _isCountingToEnd;
    
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.1)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Yanıp sönen nokta
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: primaryRuby,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: primaryRuby.withValues(alpha: 0.6),
                      blurRadius: 8,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),
              SizedBox(width: 10),
              Text(
                isFinished 
                  ? 'BİTTİ' 
                  : '${_days.toString().padLeft(2, '0')} GÜN : ${_hours.toString().padLeft(2, '0')} SAAT',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.surface,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.5,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          _isCountingToEnd ? 'Bitiyor' : 'Başlıyor',
          style: const TextStyle(
            color: primaryRuby,
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 2,
          ),
        ),
      ],
    );
  }
  
  /// Tarih ve Saat kartı (obsidian tarzı)
  Widget _buildDateTimeCard() {
    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.1)),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
            blurRadius: 50,
            offset: Offset(0, 20),
          ),
        ],
      ),
      child: Row(
        children: [
          // Tarih
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
                  ),
                  child: Icon(Icons.calendar_month, color: Theme.of(context).colorScheme.surface, size: 14),
                ),
                SizedBox(width: 8),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TARİH',
                        style: TextStyle(
                          color: mutedGray,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        _dateText,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.surface,
                          fontSize: 12,
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
          
          // Divider
          Container(
            height: 32,
            width: 1,
            color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.1),
            margin: EdgeInsets.symmetric(horizontal: 8),
          ),
          
          // Saat
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'SAAT',
                      style: TextStyle(
                        color: mutedGray,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.5,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      _timeText,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.surface,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                SizedBox(width: 8),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
                  ),
                  child: Icon(Icons.schedule, color: Theme.of(context).colorScheme.surface, size: 14),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  /// Glass morphism buton (dark theme)
  Widget _buildGlassButton({
    required IconData icon,
    Color iconColor = lightText,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.1)),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
              blurRadius: 50,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        child: Icon(icon, color: iconColor, size: 20),
      ),
    );
  }
  
  /// MENÜ & SİPARİŞ - Full genişlik büyük kart (HTML tasarımına uygun)
  Widget _buildMenuButton() {
    // Türk street food görseli
    const streetFoodUrl = 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80';
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => KermesMenuScreen(event: widget.event),
          ),
        );
      },
      child: Container(
        height: 360,
        decoration: BoxDecoration(
          color: surfaceObsidian,
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
              blurRadius: 50,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Background image
            Positioned.fill(
              child: Image.network(
                streetFoodUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(color: surfaceObsidian),
              ),
            ),
            
            // Gradient overlays
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.2),
                      Colors.black.withValues(alpha: 0.4),
                      bgDark.withValues(alpha: 0.8),
                      bgDark,
                    ],
                    stops: const [0.0, 0.4, 0.7, 1.0],
                  ),
                ),
              ),
            ),
            
            // Popüler badge
            Positioned(
              top: 24,
              right: 24,
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: primaryRuby,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: primaryRuby.withValues(alpha: 0.3),
                      blurRadius: 30,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: Text(
                  '★ Popüler',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.surface,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),
            
            // Alt içerik kartı
            Positioned(
              bottom: 24,
              left: 24,
              right: 24,
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: surfaceObsidian.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.1)),
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                      blurRadius: 20,
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ONLİNE SİPARİŞ',
                          style: TextStyle(
                            color: primaryRuby,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Menü ve\nSipariş',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.surface,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [primaryRuby, Colors.red.shade700],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: primaryRuby.withValues(alpha: 0.3),
                            blurRadius: 30,
                            offset: Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Icon(Icons.restaurant_menu, color: Theme.of(context).colorScheme.surface, size: 24),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  bool _hasAnyFeature() {
    final e = widget.event;
    // Dinamik features veya legacy boolean'lardan biri varsa true
    if (e.features.isNotEmpty || e.customFeatures.isNotEmpty) return true;
    return e.hasKidsActivities || e.hasFamilyArea || e.hasOutdoor || 
           e.hasCreditCardPayment || e.hasIndoorArea || e.hasVegetarian ||
           e.hasAccessible || e.hasParking;
  }
  
  /// Özellikler bölümü - Dinamik global özellikler + legacy boolean desteği
  Widget _buildFeaturesSection() {
    final event = widget.event;
    final displayFeatures = <Widget>[];
    
    // Legacy boolean mapping - ID eşleşmesi için
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
    
    // 1. Global özelliklerden aktif olanları göster
    for (final feature in _globalFeatures.take(8)) {
      final featureId = feature.id;
      
      // Event'te bu özellik aktif mi? (features array veya legacy boolean)
      final isActive = event.features.contains(featureId) || 
                       (legacyFeatureMap[featureId] ?? false);
      
      if (isActive) {
        displayFeatures.add(_buildDynamicFeatureChip(
          emoji: feature.icon,
          label: feature.label,
          color: feature.colorValue,
        ));
      }
    }
    
    // 2. Custom (event-specific) özellikleri de ekle
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
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: displayFeatures,
        ),
        const SizedBox(height: 24),
      ],
    );
  }
  
  /// Dinamik özellik chip'i - Firestore renk desteği
  Widget _buildDynamicFeatureChip({
    required String emoji,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: TextStyle(fontSize: 12)),
          SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: Theme.of(context).colorScheme.surface,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
  
  /// Lokasyon Kartı (obsidian tarzı)
  Widget _buildLocationCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: surfaceObsidian.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
            blurRadius: 50,
            offset: const Offset(0, 20),
          ),
          // Inner sheen
          BoxShadow(
            color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.03),
            blurRadius: 1,
            spreadRadius: 0,
            offset: const Offset(0, 1),
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
                        color: primaryRuby.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: primaryRuby.withValues(alpha: 0.2)),
                      ),
                      child: Icon(Icons.location_on, color: primaryRuby, size: 18),
                    ),
                    SizedBox(width: 10),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'LOKASYON',
                            style: TextStyle(
                              color: mutedGray,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2,
                            ),
                          ),
                          Text(
                            '${widget.event.city}, ${widget.event.country.split(' ').first}',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.surface,
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
                  _buildMiniInfoBadge(Icons.directions_car, _travelTimeText, primaryRuby),
                  SizedBox(width: 6),
                  _buildMiniInfoBadge(Icons.near_me, '${_distanceKm.toInt()}km', mutedGray),
                ],
              ),
            ],
          ),
          
          SizedBox(height: 16),
          
          // Adres
          Text(
            widget.event.address,
            style: TextStyle(
              color: Theme.of(context).colorScheme.surface,
              fontSize: 18,
              fontWeight: FontWeight.w600,
              height: 1.3,
            ),
          ),
          
          SizedBox(height: 20),
          
          // Navigasyon butonu
          GestureDetector(
            onTap: _openMaps,
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: primaryRuby,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: primaryRuby.withValues(alpha: 0.3),
                    blurRadius: 30,
                    offset: Offset(0, 10),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.navigation, color: Theme.of(context).colorScheme.surface, size: 18),
                  SizedBox(width: 12),
                  Text(
                    'NAVİGASYON',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.surface,
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
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: iconColor, size: 12),
          SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(
              color: Theme.of(context).colorScheme.surface,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
  
  /// Park Kartı (obsidian tarzı)
  Widget _buildParkingCard() {
    const parkingImageUrl = 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80';
    
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
        height: 144,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
              blurRadius: 50,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Background image
            Positioned.fill(
              child: Image.network(
                parkingImageUrl,
                fit: BoxFit.cover,
                color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.6),
                colorBlendMode: BlendMode.overlay,
                errorBuilder: (_, __, ___) => Container(color: surfaceObsidian),
              ),
            ),
            
            // Gradient overlay
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      bgDark,
                      surfaceObsidian.withValues(alpha: 0.9),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            
            // Content
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  // Sol taraf - Büyük mavi P logosu
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Color(0xFF2563EB).withValues(alpha: 0.4),
                          blurRadius: 20,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        'P',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.surface,
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 16),
                  // Sağ taraf - Metin bilgisi
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Park Bilgisi',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.surface,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
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
                                    color: const Color(0xFF34D399).withValues(alpha: 0.6),
                                    blurRadius: 8,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Müsait Park Alanı',
                              style: TextStyle(
                                color: const Color(0xFF34D399),
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
                    color: mutedGray.withValues(alpha: 0.5),
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
    // Loading state
    if (_isLoadingWeather) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: surfaceObsidian.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(32),
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
        ? _weatherForecast!.getHourlyForDay(dailySummaries[_selectedDayIndex].date)
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
                  color: const Color(0xFF22C55E).withValues(alpha: 0.2),
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
                  color: mutedGray.withValues(alpha: 0.6),
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
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: isSelected
                          ? [const Color(0xFF2563EB), const Color(0xFF1D4ED8)]
                          : [surfaceObsidian.withValues(alpha: 0.6), surfaceObsidian.withValues(alpha: 0.4)],
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected 
                          ? const Color(0xFF60A5FA).withValues(alpha: 0.5)
                          : Colors.white.withValues(alpha: 0.05),
                      width: isSelected ? 2 : 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: isSelected 
                            ? const Color(0xFF2563EB).withValues(alpha: 0.3)
                            : Colors.black.withValues(alpha: 0.3),
                        blurRadius: 20,
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
                          color: isSelected ? Colors.blue.shade100.withValues(alpha: 0.8) : mutedGray,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        '${day.date.day}.${day.date.month}',
                        style: TextStyle(
                          color: isSelected ? Colors.white.withValues(alpha: 0.6) : mutedGray.withValues(alpha: 0.6),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: 8),
                      
                      // Hava durumu ikonu ve sıcaklık
                      Row(
                        children: [
                          Image.network(
                            day.iconUrl,
                            width: 32,
                            height: 32,
                            errorBuilder: (_, __, ___) => Icon(
                              Icons.wb_sunny,
                              color: Colors.yellow.shade300,
                              size: 28,
                            ),
                          ),
                          SizedBox(width: 6),
                          Text(
                            '${day.avgTemperature.round()}°',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.surface,
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
                              color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.08),
                            ),
                          ),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Icon(Icons.water_drop, 
                                    color: isSelected ? Colors.blue.shade100 : mutedGray, 
                                    size: 10),
                                const SizedBox(width: 4),
                                Text(
                                  '%${day.maxRainProbability.round()}',
                                  style: TextStyle(
                                    color: isSelected ? Colors.blue.shade100 : mutedGray,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Icon(Icons.air, 
                                    color: isSelected ? Colors.blue.shade100 : mutedGray, 
                                    size: 10),
                                const SizedBox(width: 4),
                                Text(
                                  '${day.avgWindSpeed.round()}km/s',
                                  style: TextStyle(
                                    color: isSelected ? Colors.blue.shade100 : mutedGray,
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
                color: mutedGray.withValues(alpha: 0.5),
                fontSize: 9,
                fontWeight: FontWeight.w800,
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
                    color: surfaceObsidian.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${hour.dateTime.hour}:00',
                        style: TextStyle(
                          color: mutedGray,
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
                          color: Colors.yellow,
                          size: 20,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '${hour.temperature.round()}°',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.surface,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
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
              color: mutedGray.withValues(alpha: 0.6),
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
              height: 1.5,
            ),
          ),
        ),
        SizedBox(
          height: 200,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: widget.event.weatherForecast.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final weather = widget.event.weatherForecast[index];
              final dayNumber = index + 1;
              
              return Container(
                width: 150,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF60A5FA).withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$dayNumber. KERMES GÜNÜ',
                      style: TextStyle(
                        color: Colors.blue.shade100.withValues(alpha: 0.8),
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 16),
                    Row(
                      children: [
                        Icon(weather.icon, color: Colors.yellow.shade300, size: 28),
                        SizedBox(width: 8),
                        Text(
                          '${weather.temp.round()}°',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.surface,
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        Icon(Icons.water_drop, color: Colors.blue.shade100, size: 12),
                        const SizedBox(width: 6),
                        Text(
                          '%${weather.rainProbability}',
                          style: TextStyle(color: Colors.blue.shade100, fontSize: 10),
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
    const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    return days[date.weekday - 1];
  }

  
  /// İletişim Kartı (obsidian tarzı)
  Widget _buildContactCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: surfaceObsidian.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
            blurRadius: 50,
            offset: const Offset(0, 20),
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
              color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.05)),
            ),
            child: const Icon(Icons.person, color: primaryRuby, size: 24),
          ),
          SizedBox(width: 16),
          
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'YETKİLİ KİŞİ',
                  style: TextStyle(
                    color: mutedGray,
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  widget.event.contactName?.isNotEmpty == true 
                    ? widget.event.contactName!
                    : (widget.event.title.isNotEmpty ? widget.event.title : 'Yetkili Kişi'),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.surface,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  widget.event.phoneNumber.isNotEmpty ? widget.event.phoneNumber : '+49 XXX XXX XXXX',
                  style: TextStyle(
                    color: mutedGray,
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
                color: const Color(0xFF10B981).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.2)),
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
      'https://www.google.com/maps/search/?api=1&query=${widget.event.latitude},${widget.event.longitude}'
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }
  
  void _callPhone() async {
    final phone = widget.event.phoneNumber.isNotEmpty ? widget.event.phoneNumber : '+49 XXX XXX XXXX';
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }
}
