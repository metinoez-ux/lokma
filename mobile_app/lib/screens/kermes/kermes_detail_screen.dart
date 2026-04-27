import '../../utils/currency_utils.dart';
import '../../widgets/kermes/kermes_menu_item_tile.dart';
import '../../widgets/brand_info_sheet.dart';
import 'widgets/kermes_video_header.dart';
import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:math' as math;
import 'dart:ui';
import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:intl/intl.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:lokma_app/data/kermes_menu_templates.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/models/product_option.dart';
import 'package:lokma_app/providers/kermes_category_provider.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:lokma_app/screens/kermes/kermes_checkout_sheet.dart';
import 'package:lokma_app/utils/distance_utils.dart';
import 'package:lokma_app/widgets/kermes/order_setup_dialog.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import 'package:lokma_app/widgets/kermes/kermes_qr_scanner_sheet.dart';
import 'package:lokma_app/providers/group_order_provider.dart';
import 'package:lokma_app/widgets/kermes/group_order_share_sheet.dart';
import 'package:lokma_app/widgets/kermes/floating_group_order_button.dart';
import 'package:lokma_app/screens/kermes/kermes_group_order_screen.dart';
import 'package:lokma_app/screens/kermes/kermes_customization_sheet.dart';
import 'package:lokma_app/screens/kermes/kermes_parking_screen.dart';
import 'package:lokma_app/screens/kermes/kermes_product_detail_sheet.dart';
import 'package:lokma_app/services/kermes_badge_service.dart';
import 'package:lokma_app/services/kermes_feature_service.dart';
import 'package:lokma_app/services/weather_service.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter_svg/flutter_svg.dart';

// Tailwind Colors mapped from HTML
const Color primaryRuby = Color(0xFFD32F2F);
const Color accentRuby = Color(0xFFB71C1C);
const Color lightText = Color(0xFFF3F4F6);

class KermesDetailScreen extends ConsumerStatefulWidget {
  final KermesEvent event;
  final Position? currentPosition;
  final String? initialTableNumber;
  final String? initialSectionId;

  const KermesDetailScreen({
    super.key,
    required this.event,
    this.currentPosition,
    this.initialTableNumber,
    this.initialSectionId,
  });

  @override
  ConsumerState<KermesDetailScreen> createState() => _KermesDetailScreenState();
}

class _KermesDetailScreenState extends ConsumerState<KermesDetailScreen> {
  static const Color lokmaPink = Color(0xFFEA184A);
  final GlobalKey _shareBoundaryKey = GlobalKey();
  bool _isSharing = false;

  WeatherForecast? _weatherForecast;
  CurrentWeather? _currentWeather;
  bool _isLoadingWeather = true;
  List<KermesFeature> _globalFeatures = [];
  Map<String, KermesBadge> _activeBadges = {};

  // Realtime event document listener
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>?
      _eventSubscription;
  KermesEvent? _liveEvent;
  KermesEvent get _currentEvent => _liveEvent ?? widget.event;

  // Realtime products listener
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>?
      _productsSubscription;
      
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>?
      _globalImageSubscription;
  List<KermesMenuItem>? _liveMenu;

  final ValueNotifier<String> _selectedCategory = ValueNotifier('');

  // Scroll spy controller and keys
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _sectionKeys = {};
  final Map<String, GlobalKey> _tabKeys = {};
  bool _isUserScrolling = true;

  // Chip ScrollController
  final ScrollController _chipScrollController = ScrollController();

  // Sliding pill indicator state
  final ValueNotifier<double> _pillLeft = ValueNotifier(0.0);
  final ValueNotifier<double> _pillWidth = ValueNotifier(60.0);
  bool _isFavorite = false;
  final ValueNotifier<bool> _pillInitialized = ValueNotifier(false);
  final GlobalKey _chipRowKey = GlobalKey();

  // Delivery mode toggle
  late int _deliveryModeIndex;

  // Search
  bool _showSearchBar = false;
  String _menuSearchQuery = '';

  // Aktif grup siparisi (persistence)
  String? _activeGroupOrderId;

  List<({int absoluteIndex, String title, IconData icon, String subtitle})>
      get _availableModes {
    if (_currentEvent.isMenuOnly) return [];
    final modes =
        <({int absoluteIndex, String title, IconData icon, String subtitle})>[];
    if (_currentEvent.hasDelivery) {
      modes.add((
        absoluteIndex: 0,
        title: 'kermes.delivery_home'.tr(),
        icon: Icons.delivery_dining,
        subtitle: 'kermes.delivery_home_sub'.tr()
      ));
    }
    if (_currentEvent.hasTakeaway) {
      modes.add((
        absoluteIndex: 1,
        title: 'kermes.delivery_takeaway'.tr(),
        icon: Icons.shopping_bag_outlined,
        subtitle: 'kermes.delivery_takeaway_sub'.tr()
      ));
    }
    if (_currentEvent.hasDineIn) {
      modes.add((
        absoluteIndex: 2,
        title: 'kermes.delivery_dinein'.tr(),
        icon: Icons.restaurant,
        subtitle: 'kermes.delivery_dinein_sub'.tr()
      ));
    }
    return modes;
  }

  String? _menuBackgroundImageUrl;

  @override
  void initState() {
    super.initState();
    _loadGlobalFeatures();
    _loadGlobalMenuImage();
    _loadBadges();
    _listenToProducts();
    _listenToEventDocument();
    _scrollController.addListener(_onMenuScroll);

    final modes = _availableModes;
    if (modes.isNotEmpty) {
      _deliveryModeIndex = modes.first.absoluteIndex;
    } else {
      _deliveryModeIndex = 0;
    }

    // Aktif grup siparisi var mi kontrol et
    _checkActiveGroupOrder();
  }

  Future<void> _checkActiveGroupOrder() async {
    final orderId = await ref.read(groupOrderProvider.notifier).restoreSession();
    if (orderId != null && mounted) {
      setState(() => _activeGroupOrderId = orderId);
    }
  }

  Widget _buildActiveGroupBanner(bool isDark) {
    final groupState = ref.watch(groupOrderProvider);
    final order = groupState.currentOrder;
    return GestureDetector(
      onTap: () {
        if (_activeGroupOrderId != null) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => KermesGroupOrderScreen(
                event: _currentEvent,
                groupOrderId: _activeGroupOrderId!,
              ),
            ),
          );
        }
      },
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [lokmaPink.withOpacity(0.15), lokmaPink.withOpacity(0.05)],
          ),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: lokmaPink.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: lokmaPink.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.groups, color: lokmaPink, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Aktif Grup Siparisi',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  if (order != null)
                    Text(
                      '${order.participantCount} katilimci - ${order.totalItems} urun',
                      style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                    ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 16, color: lokmaPink),
          ],
        ),
      ),
    );
  }

  /// QR kod okuyucuyu ac - grup siparisine katilmak icin
  Future<void> _openQrScanner() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const KermesQrScannerSheet(),
    );

    if (result == null || !mounted) return;

    // URL'den grup siparis ID'sini cikar
    String? groupOrderId;
    if (result.contains('/group/')) {
      final uri = Uri.tryParse(result);
      if (uri != null) {
        final segments = uri.pathSegments;
        final groupIndex = segments.indexOf('group');
        if (groupIndex >= 0 && groupIndex + 1 < segments.length) {
          groupOrderId = segments[groupIndex + 1];
        }
      }
    }

    if (groupOrderId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Gecersiz QR kodu'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    // PIN giris dialogunu goster
    _showPinEntryDialog(groupOrderId);
  }

  /// 4 haneli PIN giris dialogu (QR ile katilim icin)
  void _showPinEntryDialog(String groupOrderId) {
    final pinController = TextEditingController();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        bool isVerifying = false;
        String? errorText;

        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: lokmaPink.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.lock, color: lokmaPink, size: 28),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Grup PIN Kodu',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Grup sahibinden aldiginiz 4 haneli PIN kodunu girin',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[500],
                      fontWeight: FontWeight.normal,
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: pinController,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    maxLength: 4,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 12,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                    decoration: InputDecoration(
                      counterText: '',
                      hintText: '----',
                      hintStyle: TextStyle(
                        fontSize: 28,
                        letterSpacing: 12,
                        color: Colors.grey[400],
                      ),
                      filled: true,
                      fillColor: isDark ? Colors.grey.shade800 : Colors.grey.shade50,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                      errorText: errorText,
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: isVerifying
                          ? null
                          : () async {
                              final pin = pinController.text.trim();
                              if (pin.length != 4) {
                                setDialogState(() => errorText = '4 haneli PIN girin');
                                return;
                              }

                              setDialogState(() {
                                isVerifying = true;
                                errorText = null;
                              });

                              HapticFeedback.mediumImpact();

                              final userId = FirebaseAuth.instance.currentUser?.uid ??
                                  'anon_${DateTime.now().millisecondsSinceEpoch}';
                              final userName = FirebaseAuth.instance.currentUser?.displayName ?? 'Misafir';

                              final success = await ref.read(groupOrderProvider.notifier).joinGroupOrder(
                                    orderId: groupOrderId,
                                    userId: userId,
                                    userName: userName,
                                    enteredPin: pin,
                                    requirePin: true,
                                  );

                              if (!mounted) return;

                              if (success) {
                                Navigator.pop(ctx);
                                // Grup siparis ekranina git
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => KermesGroupOrderScreen(
                                      event: _currentEvent,
                                      groupOrderId: groupOrderId,
                                    ),
                                  ),
                                );
                              } else {
                                setDialogState(() {
                                  isVerifying = false;
                                  errorText = ref.read(groupOrderProvider).error ?? 'Yanlis PIN';
                                });
                                HapticFeedback.heavyImpact();
                              }
                            },
                      style: FilledButton.styleFrom(
                        backgroundColor: lokmaPink,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: isVerifying
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Text(
                              'Gruba Katil',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
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

  void _loadGlobalMenuImage() {
    try {
      _globalImageSubscription?.cancel();
      _globalImageSubscription = FirebaseFirestore.instance.collection('settings').doc('kermes_system').snapshots().listen((doc) {
        if (doc.exists && mounted) {
          setState(() {
            _menuBackgroundImageUrl = doc.data()?['menuImageUrl'] as String?;
          });
        }
      });
    } catch (e) {
      debugPrint('Error loading global menu image: $e');
    }
  }

  @override
  void dispose() {
    _globalImageSubscription?.cancel();
    _scrollController.removeListener(_onMenuScroll);
    _scrollController.dispose();
    _chipScrollController.dispose();
    _productsSubscription?.cancel();
    _eventSubscription?.cancel();
    super.dispose();
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

  bool _weatherFetched = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_weatherFetched) {
      _weatherFetched = true;
      _fetchLiveWeather();
    }
  }

  Future<void> _fetchLiveWeather() async {
    try {
      final localeCode = context.locale.languageCode;
      
      final results = await Future.wait([
        WeatherService.getForecast(
            lat: _currentEvent.latitude, lon: _currentEvent.longitude, locale: localeCode),
        WeatherService.getCurrentWeather(
            lat: _currentEvent.latitude, lon: _currentEvent.longitude, locale: localeCode),
      ]);
      final forecast = results[0] as WeatherForecast?;
      CurrentWeather? current = results[1] as CurrentWeather?;

      // Fallback: API limit asildiysa, forecast'ten anlik hava durumunu turet
      if (current == null &&
          forecast != null &&
          forecast.hourlyForecasts.isNotEmpty) {
        final now = DateTime.now();
        final nearest = forecast.hourlyForecasts.reduce((a, b) =>
            (a.dateTime.difference(now).abs() <
                    b.dateTime.difference(now).abs())
                ? a
                : b);
        current = CurrentWeather(
          temperature: nearest.temperature,
          feelsLike: nearest.feelsLike,
          description: nearest.description,
          icon: nearest.icon,
          windSpeed: nearest.windSpeed,
          humidity: 0,
        );
      }

      if (mounted) {
        setState(() {
          _weatherForecast = forecast;
          _currentWeather = current;
          _isLoadingWeather = false;
        });
      }
    } catch (e) {
      debugPrint('Weather API Error in screen: $e');
      if (mounted) {
        setState(() => _isLoadingWeather = false);
      }
    }
  }

  double get _distanceKm {
    Position? pos = widget.currentPosition;
    if (pos == null) {
      final loc = ref.read(userLocationProvider).value;
      if (loc != null && loc.latitude != 0.0) {
        pos = Position(
          latitude: loc.latitude, longitude: loc.longitude,
          timestamp: DateTime.now(), accuracy: 0.0, altitude: 0.0,
          heading: 0.0, speed: 0.0, speedAccuracy: 0.0,
          altitudeAccuracy: 0.0, headingAccuracy: 0.0,
        );
      }
    }
    
    if (pos == null || (_currentEvent.latitude == 0.0 && _currentEvent.longitude == 0.0)) return 0.0;
    return Geolocator.distanceBetween(
          pos.latitude,
          pos.longitude,
          _currentEvent.latitude,
          _currentEvent.longitude,
        ) /
        1000;
  }

String _getLocalizedCountry(String rawCountry) {
    if (rawCountry.isEmpty) return rawCountry;
    
    final lang = context.locale.languageCode;
    final cc = _currentEvent.countryCode.toUpperCase();
    
    if (cc.isNotEmpty) {
      return _localizeCountryCode(cc, lang) ?? rawCountry;
    }
    return rawCountry;
  }

  static String? _localizeCountryCode(String cc, String lang) {
    const table = <String, Map<String, String>>{
      'DE': {'de': 'Deutschland', 'tr': 'Almanya', 'en': 'Germany', 'nl': 'Duitsland', 'fr': 'Allemagne', 'it': 'Germania', 'es': 'Alemania'},
      'NO': {'de': 'Norwegen', 'tr': 'Norvec', 'en': 'Norway', 'nl': 'Noorwegen', 'fr': 'Norvege', 'it': 'Norvegia', 'es': 'Noruega'},
      'TR': {'de': 'Turkei', 'tr': 'Turkiye', 'en': 'Turkey', 'nl': 'Turkije', 'fr': 'Turquie', 'it': 'Turchia', 'es': 'Turquia'},
      'AT': {'de': 'Osterreich', 'tr': 'Avusturya', 'en': 'Austria', 'nl': 'Oostenrijk', 'fr': 'Autriche', 'it': 'Austria', 'es': 'Austria'},
      'RS': {'de': 'Serbien', 'tr': 'Sirbistan', 'en': 'Serbia', 'nl': 'Servie', 'fr': 'Serbie', 'it': 'Serbia', 'es': 'Serbia'},
      'BG': {'de': 'Bulgarien', 'tr': 'Bulgaristan', 'en': 'Bulgaria', 'nl': 'Bulgarije', 'fr': 'Bulgarie', 'it': 'Bulgaria', 'es': 'Bulgaria'},
      'HU': {'de': 'Ungarn', 'tr': 'Macaristan', 'en': 'Hungary', 'nl': 'Hongarije', 'fr': 'Hongrie', 'it': 'Ungheria', 'es': 'Hungria'},
      'FR': {'de': 'Frankreich', 'tr': 'Fransa', 'en': 'France', 'nl': 'Frankrijk', 'fr': 'France', 'it': 'Francia', 'es': 'Francia'},
      'NL': {'de': 'Niederlande', 'tr': 'Hollanda', 'en': 'Netherlands', 'nl': 'Nederland', 'fr': 'Pays-Bas', 'it': 'Paesi Bassi', 'es': 'Paises Bajos'},
      'BE': {'de': 'Belgien', 'tr': 'Belcika', 'en': 'Belgium', 'nl': 'Belgie', 'fr': 'Belgique', 'it': 'Belgio', 'es': 'Belgica'},
      'CH': {'de': 'Schweiz', 'tr': 'Isvicre', 'en': 'Switzerland', 'nl': 'Zwitserland', 'fr': 'Suisse', 'it': 'Svizzera', 'es': 'Suiza'},
      'MX': {'de': 'Mexiko', 'tr': 'Meksika', 'en': 'Mexico', 'nl': 'Mexico', 'fr': 'Mexique', 'it': 'Messico', 'es': 'Mexico'},
      'DK': {'de': 'Danemark', 'tr': 'Danimarka', 'en': 'Denmark', 'nl': 'Denemarken', 'fr': 'Danemark', 'it': 'Danimarca', 'es': 'Dinamarca'},
      'SE': {'de': 'Schweden', 'tr': 'Isvec', 'en': 'Sweden', 'nl': 'Zweden', 'fr': 'Suede', 'it': 'Svezia', 'es': 'Suecia'},
      'RO': {'de': 'Rumanien', 'tr': 'Romanya', 'en': 'Romania', 'nl': 'Roemenie', 'fr': 'Roumanie', 'it': 'Romania', 'es': 'Rumania'},
      'IT': {'de': 'Italien', 'tr': 'Italya', 'en': 'Italy', 'nl': 'Italie', 'fr': 'Italie', 'it': 'Italia', 'es': 'Italia'},
      'ES': {'de': 'Spanien', 'tr': 'Ispanya', 'en': 'Spain', 'nl': 'Spanje', 'fr': 'Espagne', 'it': 'Spagna', 'es': 'Espana'},
      'GR': {'de': 'Griechenland', 'tr': 'Yunanistan', 'en': 'Greece', 'nl': 'Griekenland', 'fr': 'Grece', 'it': 'Grecia', 'es': 'Grecia'},
      'PL': {'de': 'Polen', 'tr': 'Polonya', 'en': 'Poland', 'nl': 'Polen', 'fr': 'Pologne', 'it': 'Polonia', 'es': 'Polonia'},
      'HR': {'de': 'Kroatien', 'tr': 'Hirvatistan', 'en': 'Croatia', 'nl': 'Kroatie', 'fr': 'Croatie', 'it': 'Croazia', 'es': 'Croacia'},
    };
    
    final countryMap = table[cc];
    if (countryMap == null) return null;
    return countryMap[lang] ?? countryMap['de'];
  }

  Future<void> _openMaps() async {
    final lat = _currentEvent.latitude;
    final lng = _currentEvent.longitude;
    final addressStr = Uri.encodeComponent(_currentEvent.address);
    
    if (lat != 0.0 && lng != 0.0) {
      if (Platform.isAndroid) {
        final uri = Uri.parse('geo:0,0?q=$lat,$lng');
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
          return;
        }
      } else if (Platform.isIOS) {
        final appleUrl = Uri.parse('http://maps.apple.com/?daddr=$lat,$lng');
        if (await canLaunchUrl(appleUrl)) {
          await launchUrl(appleUrl, mode: LaunchMode.externalApplication);
          return;
        }
        final googleUrl = Uri.parse('comgooglemaps://?daddr=$lat,$lng&directionsmode=driving');
        if (await canLaunchUrl(googleUrl)) {
          await launchUrl(googleUrl, mode: LaunchMode.externalApplication);
          return;
        }
      }
    } else if (_currentEvent.address.isNotEmpty) {
      if (Platform.isAndroid) {
        final uri = Uri.parse('geo:0,0?q=$addressStr');
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
          return;
        }
      } else if (Platform.isIOS) {
        final appleUrl = Uri.parse('http://maps.apple.com/?daddr=$addressStr');
        if (await canLaunchUrl(appleUrl)) {
          await launchUrl(appleUrl, mode: LaunchMode.externalApplication);
          return;
        }
        final googleUrl = Uri.parse('comgooglemaps://?daddr=$addressStr&directionsmode=driving');
        if (await canLaunchUrl(googleUrl)) {
          await launchUrl(googleUrl, mode: LaunchMode.externalApplication);
          return;
        }
      }
    }
    
    final fallbackUrl = (lat == 0.0 && lng == 0.0 && _currentEvent.address.isNotEmpty)
        ? Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$addressStr')
        : Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
        
    if (await canLaunchUrl(fallbackUrl)) {
      await launchUrl(fallbackUrl, mode: LaunchMode.externalApplication);
    }
  }

  String _getTurkishDayName(DateTime date) {
    return DateFormat('EEEE', context.locale.languageCode).format(date);
  }

  DateTime _lastScrollTime = DateTime.now();

  void _onMenuScroll() {
    if (!_isUserScrolling || _menuSearchQuery.isNotEmpty) return;

    final now = DateTime.now();
    if (now.difference(_lastScrollTime).inMilliseconds < 100) return;
    _lastScrollTime = now;

    if (_scrollController.hasClients && _scrollController.offset < 10) {
      if (_selectedCategory.value != 'marketplace.category_all'.tr()) {
        HapticFeedback.selectionClick();
        _selectedCategory.value = 'marketplace.category_all'.tr();
        Future.delayed(const Duration(milliseconds: 50), () {
          if (mounted) {
            _scrollChipBarToSelected('marketplace.category_all'.tr());
            _updatePillPosition('marketplace.category_all'.tr());
          }
        });
      }
      return;
    }

    final RenderObject? ancestor = context.findRenderObject();
    if (ancestor == null) return;

    String? visibleCategory;
    for (var entry in _sectionKeys.entries) {
      final key = entry.value;
      if (key.currentContext != null) {
        final RenderBox? box =
            key.currentContext!.findRenderObject() as RenderBox?;
        if (box != null) {
          final position = box.localToGlobal(Offset.zero,
              ancestor: ancestor);
          if (position.dy > 150 && position.dy < 400) {
            visibleCategory = entry.key;
            break;
          }
        }
      }
    }

    if (visibleCategory != null && visibleCategory != _selectedCategory.value) {
      HapticFeedback.selectionClick();
      _selectedCategory.value = visibleCategory!;
      Future.delayed(const Duration(milliseconds: 50), () {
        if (mounted) {
          _scrollChipBarToSelected(visibleCategory!);
          _updatePillPosition(visibleCategory!);
        }
      });
    }
  }

  void _scrollChipBarToSelected(String category) {
    if (!_chipScrollController.hasClients) return;
    final tabKey = _tabKeys[category];
    if (tabKey == null || tabKey.currentContext == null) return;

    final RenderBox? chipBox =
        tabKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null) return;

    final chipPosition = chipBox.localToGlobal(Offset.zero);
    final chipWidth = chipBox.size.width;
    final viewportWidth = _chipScrollController.position.viewportDimension;

    final chipCenter = chipPosition.dx + chipWidth / 2;
    final viewportCenter = viewportWidth / 2;
    final scrollDelta = chipCenter - viewportCenter;

    final targetOffset = (_chipScrollController.offset + scrollDelta).clamp(
      0.0,
      _chipScrollController.position.maxScrollExtent,
    );

    _chipScrollController.animateTo(
      targetOffset,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
    );
  }

  void _updatePillPosition([String? cat]) {
    final category = cat ?? _selectedCategory.value;
    final tabKey = _tabKeys[category];
    if (tabKey?.currentContext == null || _chipRowKey.currentContext == null)
      return;

    final RenderBox? chipBox =
        tabKey?.currentContext?.findRenderObject() as RenderBox?;
    final RenderBox? rowBox =
        _chipRowKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null || rowBox == null) return;

    final chipPos = chipBox.localToGlobal(Offset.zero, ancestor: rowBox);

    if (mounted) {
      _pillLeft.value = chipPos.dx;
      _pillWidth.value = chipBox.size.width;
      _pillInitialized.value = true;
    }
  }

  void _selectCategory(String category) {
    if (_selectedCategory.value == category) return;
    _selectedCategory.value = category;
    _isUserScrolling = false;

    _scrollChipBarToSelected(category);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition(category);
    });

    if (category == 'marketplace.category_all'.tr()) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut);
      }
    } else {
      final key = _sectionKeys[category];
      if (key != null &&
          key.currentContext != null &&
          _scrollController.hasClients) {
        final RenderBox? targetBox =
            key.currentContext!.findRenderObject() as RenderBox?;
        final RenderBox? scrollableBox =
            context.findRenderObject() as RenderBox?;

        if (targetBox != null && scrollableBox != null) {
          final targetPosition =
              targetBox.localToGlobal(Offset.zero, ancestor: scrollableBox);
          final scrollTarget =
              _scrollController.offset + targetPosition.dy - 190;
          _scrollController.animateTo(
            scrollTarget.clamp(0.0, _scrollController.position.maxScrollExtent),
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      }
    }

    Future.delayed(const Duration(milliseconds: 350), () {
      if (mounted) _isUserScrolling = true;
    });
  }

  /// Realtime listener for products subcollection
  void _listenToProducts() {
    _productsSubscription = FirebaseFirestore.instance
        .collection('kermes_events')
        .doc(widget.event.id)
        .collection('products')
        .snapshots()
        .listen((snapshot) {
      if (!mounted) return;
      final items = <KermesMenuItem>[];
      for (final doc in snapshot.docs) {
        try {
          items.add(KermesMenuItem.fromJson(doc.data()));
        } catch (e) {
          debugPrint('Error parsing live product ${doc.id}: $e');
        }
      }
      setState(() => _liveMenu = items);
      debugPrint('[KERMES-LIVE] Products updated: ${items.length} items');
    }, onError: (e) {
      debugPrint('[KERMES-LIVE] Products stream error: $e');
    });
  }

  /// Realtime listener for the kermes event document (address, parking, etc.)
  void _listenToEventDocument() {
    _eventSubscription = FirebaseFirestore.instance
        .collection('kermes_events')
        .doc(widget.event.id)
        .snapshots()
        .listen((docSnap) {
      if (!mounted || !docSnap.exists) return;
      final data = docSnap.data()!;

      // Parse address
      String fullAddress = widget.event.address;
      String city = widget.event.city;
      String postalCode = widget.event.postalCode;

      if (data['address'] is Map) {
        final addressData = data['address'] as Map;
        fullAddress = addressData['fullAddress']?.toString() ?? '';
        city = addressData['city']?.toString() ?? widget.event.city;
        if (fullAddress.isEmpty) {
          final street = addressData['street']?.toString() ?? '';
          final pc = addressData['postalCode']?.toString() ?? '';
          fullAddress = '$street, $pc $city'.trim();
        }
      } else if (data['address'] is String) {
        fullAddress = data['address'] as String;
        city = data['city']?.toString() ?? widget.event.city;
      }
      postalCode = data['postalCode']?.toString() ?? widget.event.postalCode;

      // Parse parking
      final parkingList = <KermesParkingInfo>[];
      if (data['parkingLocations'] is List) {
        for (final p in data['parkingLocations']) {
          if (p is Map) {
            parkingList.add(KermesParkingInfo(
              street: p['street']?.toString() ?? '',
              city: p['city']?.toString() ?? '',
              postalCode: p['postalCode']?.toString() ?? '',
              country: p['country']?.toString() ?? '',
              images: (p['images'] as List<dynamic>?)
                      ?.map((e) => e.toString())
                      .toList() ??
                  [],
              note: (p['note']?.toString().isNotEmpty == true)
                  ? p['note'].toString()
                  : null,
              latitude: (p['lat'] as num?)?.toDouble(),
              longitude: (p['lng'] as num?)?.toDouble(),
            ));
          }
        }
      }

      // Parse coordinates
      double lat = widget.event.latitude;
      double lng = widget.event.longitude;
      if (data['latitude'] is num) {
         final dbLat = (data['latitude'] as num).toDouble();
         if (dbLat != 0.0) lat = dbLat;
      }
      if (data['longitude'] is num) {
         final dbLng = (data['longitude'] as num).toDouble();
         if (dbLng != 0.0) lng = dbLng;
      }

      // Parse Dates from stream
      DateTime parseDate(dynamic val, DateTime fallback) {
        if (val == null) return fallback;
        if (val is Timestamp) return val.toDate();
        if (val is String) return DateTime.tryParse(val) ?? fallback;
        return fallback;
      }
      final newStartDate = parseDate(data['startDate'], widget.event.startDate);
      final newEndDate = parseDate(data['endDate'], widget.event.endDate);

      final e = widget.event;
      final prev = _liveEvent;
      if (fullAddress != (prev?.address ?? e.address) ||
          city != (prev?.city ?? e.city) ||
          postalCode != (prev?.postalCode ?? e.postalCode) ||
          lat != (prev?.latitude ?? e.latitude) ||
          lng != (prev?.longitude ?? e.longitude) ||
          newStartDate != (prev?.startDate ?? e.startDate) ||
          newEndDate != (prev?.endDate ?? e.endDate) ||
          parkingList.length != (prev?.parking ?? e.parking).length) {
        setState(() {
          _liveEvent = KermesEvent(
            id: e.id,
            city: city,
            postalCode: postalCode,
            country: data['country']?.toString() ?? e.country,
            state: data['state']?.toString() ?? e.state,
            title: data['name']?.toString() ??
                data['title']?.toString() ??
                e.title,
            address: fullAddress,
            phoneNumber: e.phoneNumber,
            startDate: newStartDate,
            endDate: newEndDate,
            latitude: lat,
            longitude: lng,
            menu: e.menu,
            parking: parkingList.isNotEmpty ? parkingList : e.parking,
            weatherForecast: e.weatherForecast,
            hasKidsActivities: e.hasKidsActivities,
            hasFamilyArea: e.hasFamilyArea,
            hasOutdoor: e.hasOutdoor,
            hasIndoorArea: e.hasIndoorArea,
            hasCreditCardPayment: e.hasCreditCardPayment,
            hasVegetarian: e.hasVegetarian,
            hasAccessible: e.hasAccessible,
            hasHalal: e.hasHalal,
            hasWifi: e.hasWifi,
            hasLiveMusic: e.hasLiveMusic,
            hasPrayerRoom: e.hasPrayerRoom,
            hasFreeEntry: e.hasFreeEntry,
            hasParking: e.hasParking,
            hasSleepingAccommodation: e.hasSleepingAccommodation,
            hasArgelatoIceCream: e.hasArgelatoIceCream,
            openingTime: data['openingTime']?.toString() ?? e.openingTime,
            closingTime: data['closingTime']?.toString() ?? e.closingTime,
            sponsor: e.sponsor,
            features: e.features,
            customFeatures: e.customFeatures,
            hasDelivery: e.hasDelivery,
            deliveryFee: e.deliveryFee,
            minCartForFreeDelivery: e.minCartForFreeDelivery,
            minOrderAmount: e.minOrderAmount,
            isMenuOnly: e.isMenuOnly,
            hasTakeaway: e.hasTakeaway,
            hasDineIn: e.hasDineIn,
            contactName: data['contactName']?.toString() ?? e.contactName,
            contactPhone: data['contactPhone']?.toString() ?? e.contactPhone,
            headerImage: data['headerImage']?.toString() ?? e.headerImage,
            logoUrl: data['logoUrl']?.toString(),
            generalParkingNote:
                data['generalParkingNote']?.toString() ?? e.generalParkingNote,
            activeBadgeIds: (data['activeBadgeIds'] as List<dynamic>?)
                    ?.map((x) => x.toString())
                    .toList() ??
                e.activeBadgeIds,
            acceptsDonations: data['acceptsDonations'] == true,
            selectedDonationFundId:
                data['selectedDonationFundId']?.toString() ??
                    e.selectedDonationFundId,
            selectedDonationFundName:
                data['selectedDonationFundName']?.toString() ??
                    e.selectedDonationFundName,
            isSilaYolu: data['isSilaYolu'] == true,
            sectionDefs: e.sectionDefs,
          );
        });
      }
    }, onError: (e) {
      debugPrint('[KERMES-LIVE] Event stream error: $e');
    });
  }

  List<KermesMenuItem> get _eventMenu {
    // Prefer realtime data, fallback to initial snapshot
    if (_liveMenu != null && _liveMenu!.isNotEmpty) return _liveMenu!;
    if (_currentEvent.menu.isNotEmpty) return _currentEvent.menu;
    return [];
  }

  List<String> get _categoriesWithoutAll {
    final uniqueCategories = <String>{};
    for (final item in _eventMenu) {
      final category = _getCategoryForItem(item);
      if (category.isNotEmpty) {
        uniqueCategories.add(category);
      }
    }
    final categoriesAsync = ref.read(kermesCategoryProvider);
    final sortOrder = categoriesAsync.maybeWhen(
      data: (cats) => cats.map((c) => c.name).toList(),
      orElse: () => const [
        'Ana Yemek',
        'Çorba',
        'Tatlı',
        'İçecek',
        'Aperatif',
        'Grill',
        'Diğer'
      ],
    );
    final sorted = uniqueCategories.toList();
    sorted.sort((a, b) {
      final indexA = sortOrder.indexOf(a);
      final indexB = sortOrder.indexOf(b);
      final orderA = indexA == -1 ? 999 : indexA;
      final orderB = indexB == -1 ? 999 : indexB;
      return orderA.compareTo(orderB);
    });
    return sorted;
  }

  List<String> get _categories {
    return ['marketplace.category_all'.tr(), ..._categoriesWithoutAll];
  }

  String _getCategoryForItem(KermesMenuItem item) {
    // i18n: categoryData varsa locale'e gore cozumle
    if (item.categoryData != null) {
      final locale = context.locale.languageCode;
      final resolved = resolveCategory(item.categoryData, locale: locale);
      if (resolved.isNotEmpty) return resolved;
    }
    if (item.category != null && item.category!.isNotEmpty) {
      return item.category!;
    }
    final name = item.name.toLowerCase();
    if (name.contains('cay') ||
        name.contains('ayran') ||
        name.contains('kahve') ||
        name.contains('su') ||
        name.contains('kola') ||
        name.contains('fanta') ||
        name.contains('sprite')) {
      return 'Icecekler';
    } else if (name.contains('baklava') ||
        name.contains('kunefe') ||
        name.contains('lokum') ||
        name.contains('dondurma') ||
        name.contains('kadayif') ||
        name.contains('sutlac') ||
        name.contains('lokma') ||
        name.contains('tulumba') ||
        name.contains('revani')) {
      return 'Tatlilar';
    } else if (name.contains('corba') ||
        name.contains('mercimek') ||
        name.contains('ezogelin')) {
      return 'Corba';
    } else {
      return 'Ana Yemek';
    }
  }

  String _getTranslatedCategory(String category) {
    if (category == 'marketplace.category_all'.tr()) return category;
    final map = {
      'ana yemek': 'kermes.cat_main_course',
      'çorba': 'kermes.cat_soups',
      'corba': 'kermes.cat_soups',
      'tatlı': 'kermes.cat_desserts',
      'tatli': 'kermes.cat_desserts',
      'tatlilar': 'kermes.cat_desserts',
      'içecek': 'kermes.cat_drinks',
      'icecek': 'kermes.cat_drinks',
      'icecekler': 'kermes.cat_drinks',
      'aperatif': 'kermes.cat_snacks',
      'grill': 'kermes.cat_grill',
      'diğer': 'kermes.cat_others',
      'diger': 'kermes.cat_others',
      'hamur isleri': 'kermes.cat_pastries'
    };
    final key = map[category.toLowerCase()];
    if (key != null) {
      final translated = key.tr();
      if (translated != key) return translated;
    }
    return category;
  }

  Map<String, List<KermesMenuItem>> get _groupedMenu {
    final grouped = <String, List<KermesMenuItem>>{};
    for (final category in _categoriesWithoutAll) {
      grouped[category] = [];
    }
    for (final item in _eventMenu) {
      final category = _getCategoryForItem(item);
      grouped[category]?.add(item);
    }
    grouped.removeWhere((key, value) => value.isEmpty);
    return grouped;
  }

  int get _totalItems => ref.read(kermesCartProvider).totalItems;
  double get _totalPrice => ref.read(kermesCartProvider).totalAmount;

  /// Grup siparisi olustur: isim sor + Firestore session + share sheet + navigate
  Future<void> _startGroupOrder({
    required String deliveryType,
    String? tableNo,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    final defaultName = user?.displayName ?? user?.email?.split('@').first ?? '';

    // Host ismini ve suresini sor
    final nameController = TextEditingController(text: defaultName);
    int selectedDuration = 20; // Varsayılan 20dk
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final setupData = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2)),
                ),
                const SizedBox(height: 20),
                Icon(Icons.groups, size: 40, color: const Color(0xFFEA184A)),
                const SizedBox(height: 12),
                Text('Grup Siparisi Baslat', style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                )),
                const SizedBox(height: 8),
                Text(
                  'Diger katilimcilar sizi bu isimle gorecek',
                  style: TextStyle(color: Colors.grey[500], fontSize: 13),
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: nameController,
                  autofocus: true,
                  textCapitalization: TextCapitalization.words,
                  style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 16),
                  decoration: InputDecoration(
                    hintText: 'Adiniz Soyadiniz',
                    hintStyle: TextStyle(color: Colors.grey[500]),
                    prefixIcon: const Icon(Icons.person, color: Color(0xFFEA184A)),
                    filled: true,
                    fillColor: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFFEA184A), width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Siparis Suresi', style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  )),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [15, 20, 30, 45].map((mins) {
                    final isSel = selectedDuration == mins;
                    return GestureDetector(
                      onTap: () => setSheetState(() => selectedDuration = mins),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: isSel ? const Color(0xFFEA184A) : (isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isSel ? const Color(0xFFEA184A) : Colors.transparent),
                        ),
                        child: Text('$mins dk', style: TextStyle(
                          color: isSel ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                          fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                          fontSize: 13,
                        )),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      final name = nameController.text.trim();
                      if (name.isNotEmpty) {
                        Navigator.pop(ctx, {'name': name, 'duration': selectedDuration});
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA184A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Grubu Olustur ve Paylas', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (setupData == null || !mounted) return;

    final String hostName = setupData['name'];
    final int duration = setupData['duration'];

    final orderId = await ref.read(groupOrderProvider.notifier).createGroupOrder(
      kermesId: _currentEvent.id,
      kermesName: _currentEvent.title ?? _currentEvent.city,
      hostName: hostName,
      hostUserId: user?.uid,
      expirationMinutes: duration,
    );

    if (orderId == null || !mounted) return;

    // Share sheet goster (QR + Link + PIN)
    final groupState = ref.read(groupOrderProvider);
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => GroupOrderShareSheet(
        orderId: orderId,
        kermesName: _currentEvent.title ?? _currentEvent.city,
        hostName: hostName,
        expirationMinutes: duration,
        expiresAt: DateTime.now().add(Duration(minutes: duration)),
        groupPin: groupState.currentOrder?.groupPin,
      ),
    );

    if (!mounted) return;

    // Grup siparis ekranina git
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => KermesGroupOrderScreen(
          event: _currentEvent,
          groupOrderId: orderId,
          tableNumber: tableNo,
        ),
      ),
    );
  }

  Future<void> _addToCart(KermesMenuItem item) async {
    HapticFeedback.lightImpact();

    if (_currentEvent.isMenuOnly) {
      _showMenuOnlyDialog();
      return;
    }

    // Sepet bos ise: once siparis baglami popup'ini goster
    final cartState = ref.read(kermesCartProvider);
    if (cartState.isEmpty && cartState.deliveryType == null) {
      // Deep link'ten gelen masa bilgisi varsa (QR'dan gelen kullanici)
      // Teslimat turu ve masa zaten belli, sadece Bireysel/Grup sor
      if (widget.initialTableNumber != null) {
        final setupResult = await showModalBottomSheet<OrderSetupResult>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (ctx) => OrderSetupBottomSheet(
            kermesName: _currentEvent.title ?? _currentEvent.city,
            hasDineIn: true,
            hasTakeaway: false,
            hasDelivery: false,
            preSelectedDelivery: DeliveryType.masada,
            preSelectedTable: widget.initialTableNumber,
          ),
        );

        if (setupResult == null) return;

        // Grup siparisi secildiyse: gercek grup session olustur
        if (setupResult.isGroupOrder) {
          await _startGroupOrder(
            deliveryType: 'masada',
            tableNo: widget.initialTableNumber,
          );
          return;
        }

        ref.read(kermesCartProvider.notifier).setOrderContext(
          deliveryType: 'masada',
          isGroupOrder: false,
          tableNo: widget.initialTableNumber,
        );
      } else {
        final setupResult = await showModalBottomSheet<OrderSetupResult>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (ctx) => OrderSetupBottomSheet(
            kermesName: _currentEvent.title ?? _currentEvent.city,
            hasDineIn: _currentEvent.hasDineIn,
            hasTakeaway: _currentEvent.hasTakeaway,
            hasDelivery: _currentEvent.hasDelivery,
            onScanQR: (scanCtx) async {
              final result = await showModalBottomSheet<String>(
                context: scanCtx,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => const KermesQrScannerSheet(),
              );
              return result;
            },
          ),
        );

        if (setupResult == null) return;

        // Grup siparisi secildiyse: gercek grup session olustur
        if (setupResult.isGroupOrder) {
          await _startGroupOrder(
            deliveryType: setupResult.deliveryType.name,
            tableNo: setupResult.tableNo,
          );
          return;
        }

        ref.read(kermesCartProvider.notifier).setOrderContext(
          deliveryType: setupResult.deliveryType.name,
          isGroupOrder: false,
          tableNo: setupResult.tableNo,
        );
      }
    }

    // Multi-step: show customization sheet if item has option groups
    if (item.isComboMenu) {
      final result = await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        useSafeArea: true,
        builder: (ctx) => KermesCustomizationSheet(
          item: item,
          eventId: _currentEvent.id,
          eventName: _currentEvent.city,
        ),
      );
      
      if (result is Map) {
         _showDifferentKermesWarning(
           item, 
           options: result['options'] as List<SelectedOption>?, 
           quantity: result['quantity'] as int? ?? 1,
         );
      }
      return;
    }

    final cartNotifier = ref.read(kermesCartProvider.notifier);
    final added =
        cartNotifier.addToCart(item, _currentEvent.id, _currentEvent.city);
    if (!added) _showDifferentKermesWarning(item);
  }

  void _removeFromCart(KermesMenuItem item) {
    HapticFeedback.lightImpact();
    ref.read(kermesCartProvider.notifier).removeFromCart(item.name);
  }

  void _showMenuOnlyDialog() {
    final phone = _currentEvent.contactPhone ?? '';
    final name = _currentEvent.contactName ?? 'kermes.default_contact_name'.tr();
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Theme.of(dialogContext).brightness == Brightness.dark
            ? const Color(0xFF1E1E1E)
            : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.info_outline, color: const Color(0xFFE50D6B), size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'kermes.digital_menu_only'.tr(),
                style: TextStyle(
                  color: Theme.of(dialogContext).brightness == Brightness.dark
                      ? Colors.white
                      : Colors.black87,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('kermes.no_online_order'.tr(),
                style: TextStyle(
                    color: Theme.of(dialogContext).brightness == Brightness.dark
                        ? Colors.white70
                        : Colors.black87,
                    fontSize: 15)),
            const SizedBox(height: 12),
            Text('kermes.contact_staff_questions'.tr(),
                style: TextStyle(
                    color: Theme.of(dialogContext).brightness == Brightness.dark
                        ? Colors.white54
                        : Colors.black54,
                    fontSize: 14)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(dialogContext).brightness == Brightness.dark
                    ? Colors.white.withOpacity(0.05)
                    : Colors.black.withOpacity(0.05),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.person,
                      size: 20,
                      color:
                          Theme.of(dialogContext).brightness == Brightness.dark
                              ? Colors.white70
                              : Colors.black54),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$name\n$phone',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Theme.of(dialogContext).brightness ==
                                Brightness.dark
                            ? Colors.white
                            : Colors.black87,
                        fontSize: 14,
                      ),
                    ),
                  )
                ],
              ),
            )
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext),
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE50D6B),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10))),
            child: Text('common.ok'.tr()),
          ),
        ],
      ),
    );
  }

  void _showDifferentKermesWarning(KermesMenuItem item, {List<SelectedOption>? options, int quantity = 1}) {
    final currentKermesName =
        ref.read(kermesCartProvider.notifier).currentKermesName;
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Theme.of(dialogContext).brightness == Brightness.dark
            ? const Color(0xFF1E1E1E)
            : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 28),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'kermes.different_kermes_order'.tr(),
                style: TextStyle(
                  color: Theme.of(dialogContext).brightness == Brightness.dark
                      ? Colors.white
                      : Colors.black87,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                'marketplace.clear_cart_warning'
                    .tr(args: [currentKermesName ?? '']),
                style: TextStyle(
                    color: Theme.of(dialogContext).brightness == Brightness.dark
                        ? Colors.white70
                        : Colors.black87,
                    fontSize: 15)),
            const SizedBox(height: 12),
            Text(
                'marketplace.clear_cart_warning_desc'
                    .tr(args: [_currentEvent.city]),
                style: TextStyle(
                    color: Theme.of(dialogContext).brightness == Brightness.dark
                        ? Colors.white54
                        : Colors.black54,
                    fontSize: 14)),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text('common.cancel'.tr(),
                  style: const TextStyle(color: Colors.grey, fontSize: 15))),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              ref.read(kermesCartProvider.notifier).clearAndAddFromNewKermes(
                  item, _currentEvent.id, _currentEvent.city, selectedOptions: options ?? [], quantity: quantity);
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text('marketplace.cart_updated_for_city'
                      .tr(args: [_currentEvent.city])),
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  behavior: SnackBarBehavior.floating));
            },
            style: ElevatedButton.styleFrom(
                backgroundColor: lokmaPink,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10))),
            child: Text(tr('cart.change_cart')),
          ),
        ],
      ),
    );
  }

  int _getCartQuantity(KermesMenuItem item) {
    return ref.read(kermesCartProvider.notifier).getQuantity(item.name);
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
                    placeholder: (context, url) => const SizedBox(
                        height: 80,
                        child: Center(child: CircularProgressIndicator())),
                    errorWidget: (context, url, error) => const SizedBox(
                        height: 80,
                        child:
                            Icon(Icons.verified, size: 60, color: Colors.grey)),
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
                  'kermes.badge_certified_text'.tr(namedArgs: {'badge': badge.label}),
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
                    backgroundColor: Color(
                        int.parse(badge.colorHex.replaceFirst('#', '0xFF'))),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    'kermes.understood'.tr(),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(int.parse(
                          badge.textColorHex.replaceFirst('#', '0xFF'))),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _getInviteText(String lang) {
    if (lang.startsWith('de')) return 'Verfolgen Sie Kermes-Veranstaltungen mit der LOKMA-App! Bestellen Sie Lieferung, Abholung oder Dine-in für ein völlig neues Erlebnis!\n\nIhr seid alle herzlich zu unserer Kermes eingeladen, wir erwarten euch!';
    if (lang.startsWith('nl')) return 'Volg Kermes-evenementen met de LOKMA-app! Bestel voor bezorging, afhaal of dine-in voor een compleet nieuwe ervaring!\n\nJullie zijn allemaal van harte uitgenodigd op onze Kermes, we verwachten jullie!';
    if (lang.startsWith('fr')) return 'Suivez les événements Kermes avec l\'application LOKMA ! Commandez en livraison, à emporter ou sur place pour une toute nouvelle expérience !\n\nVous êtes tous chaleureusement invités à notre Kermes, nous vous attendons !';
    if (lang.startsWith('en')) return 'Follow Kermes events with the LOKMA App! Order delivery, pickup, or dine-in for a completely new experience!\n\nYou are all warmly invited to our Kermes, we are waiting for you!';
    return 'LOKMA App ile Kermesleri takip edin! Evinize sipariş verin, Gel-Al veya Masaya Servis ile yeni bir deneyim yaşayın!\n\nHepiniz kermesimize davetlisiniz, bekliyoruz!';
  }

  String _getSearchText(String lang) {
    if (lang.startsWith('de')) return 'Suchen Sie nach "LOKMA" in den App Stores';
    if (lang.startsWith('nl')) return 'Zoek naar "LOKMA" in de App Stores';
    if (lang.startsWith('fr')) return 'Recherchez "LOKMA" dans les magasins d\'applications';
    if (lang.startsWith('en')) return 'Search for "LOKMA" on the App Stores';
    return 'App Store veya Google Play\'de "LOKMA" aratın';
  }

  Widget _buildOffScreenShareCard() {
    final lang = context.locale.languageCode;
    // We wrap everything in a slightly tinted outer container with extra padding,
    // so WhatsApp thumbnail generator limits its crop to this outer container,
    // leaving the actual white card with rounded boundaries completely intact.
    return Container(
      width: 480,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      color: const Color(0xFFF5F0E8), // Subtle Lokma Brand Background
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 16,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Image curved like a modern card, giving it a polaroid/flyer vibe
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: _buildHeroSection(context, isForShare: true),
          ),
          
          // 2. The seamlessly integrated footer text area on the same white background
          Padding(
            padding: const EdgeInsets.only(top: 24, bottom: 8, left: 12, right: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Image.asset(
                  'assets/images/logo_lokma_red.png',
                  height: 48,
                  errorBuilder: (context, error, stackTrace) => const Icon(Icons.fastfood, color: lokmaPink, size: 48),
                ),
                const SizedBox(height: 18),
                Text(
                  _getInviteText(lang),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFF151515),
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    height: 1.35,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Natively drawn App Store Badge
                    Container(
                      width: 146,
                      height: 42,
                      decoration: BoxDecoration(
                        color: Colors.black,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const FaIcon(FontAwesomeIcons.apple, color: Colors.white, size: 24),
                          const SizedBox(width: 8),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text('Download on the', style: TextStyle(color: Colors.white, fontSize: 10, height: 1)),
                              Text('App Store', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600, height: 1.1)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Natively drawn Google Play Badge
                    Container(
                      width: 146,
                      height: 42,
                      decoration: BoxDecoration(
                        color: Colors.black,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const FaIcon(FontAwesomeIcons.googlePlay, color: Colors.white, size: 20),
                          const SizedBox(width: 8),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text('GET IT ON', style: TextStyle(color: Colors.white, fontSize: 10, height: 1)),
                              Text('Google Play', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600, height: 1.1)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  _getSearchText(lang),
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Future<void> _shareKermes() async {
    HapticFeedback.lightImpact();
    // Use the localized text as the payload payload caption
    final event = _currentEvent;
    final lang = context.locale.languageCode;
    final dateStr = '${event.startDate.day}.${event.startDate.month}.${event.startDate.year} - ${event.endDate.day}.${event.endDate.month}.${event.endDate.year}';
    final timeStr = '10:00 - 22:00';
    
    final countryName = event.country.isNotEmpty ? _getLocalizedCountry(event.country) : '';
    final addressStr = '${_getCleanAddress()}\n${event.postalCode} ${event.city}\n$countryName'.trim();
    
    final downloadText = "*App Store veya Google Play'de LOKMA aratın ve uygulamayı indirin.*";
    
    final text = '*${event.title}*\n\nTarih: $dateStr\nSaat: $timeStr\n\n*Adres:*\n$addressStr\n\n${_getInviteText(lang)}\n\n$downloadText';

    setState(() => _isSharing = true);
    
    try {
      // 1. Wait a frame to ensure the boundary has potentially painted
      await Future.delayed(const Duration(milliseconds: 100));
      
      // 2. Find the RepaintBoundary correctly rendered offscreen
      final boundary = _shareBoundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) {
        // Fallback to old text share if boundary missing unexpectedly
        Share.share(text, subject: event.title);
        return;
      }
      
      // 3. Convert to Image (dpr 2.5 for high quality retina output)
      final image = await boundary.toImage(pixelRatio: 2.5);
      final byteData = await image.toByteData(format: ImageByteFormat.png);
      final pngBytes = byteData!.buffer.asUint8List();

      // 4. Save to temporary file
      final tempDir = await getTemporaryDirectory();
      final file = await File('${tempDir.path}/kermes_davetiye_${event.id}.png').create();
      await file.writeAsBytes(pngBytes);

      // 5. Share
      await Share.shareXFiles([XFile(file.path)], text: text, subject: event.title);
    } catch (e) {
      debugPrint('Share image capture failed: $e');
      Share.share(text, subject: event.title); // fallback
    } finally {
      if (mounted) setState(() => _isSharing = false);
    }
  }

  /// Normalize Turkish/German/special characters for flexible search
  /// cay -> cay, doner -> doner, etc.
  String _normalizeForSearch(String text) {
    final buffer = StringBuffer();
    for (final c in text.toLowerCase().runes) {
      switch (c) {
        case 0x00FC: // u umlaut
        case 0x00FB: // u circumflex
          buffer.write('u');
          break;
        case 0x00F6: // o umlaut
        case 0x00F4: // o circumflex
          buffer.write('o');
          break;
        case 0x015F: // s cedilla
          buffer.write('s');
          break;
        case 0x00E7: // c cedilla
          buffer.write('c');
          break;
        case 0x011F: // g breve
          buffer.write('g');
          break;
        case 0x0131: // dotless i
          buffer.write('i');
          break;
        case 0x0130: // dotted I
          buffer.write('i');
          break;
        case 0x00E4: // a umlaut
        case 0x00E2: // a circumflex
        case 0x00E0: // a grave
          buffer.write('a');
          break;
        case 0x00DF: // eszett
          buffer.write('ss');
          break;
        case 0x00E9: // e acute
        case 0x00E8: // e grave
        case 0x00EA: // e circumflex
          buffer.write('e');
          break;
        case 0x00EE: // i circumflex
          buffer.write('i');
          break;
        default:
          buffer.writeCharCode(c);
      }
    }
    return buffer.toString();
  }

  void _showMenuSearchOverlay() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF2B2929) : const Color(0xFFF9F9F9);
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final hintColor = isDark ? Colors.grey[400] : Colors.grey[500];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final query = _normalizeForSearch(_menuSearchQuery);
            final searchResults = _eventMenu
                .where((p) =>
                    _normalizeForSearch(p.name).contains(query) ||
                    (_normalizeForSearch(p.description ?? '')
                        .contains(query)) ||
                    _normalizeForSearch(p.category ?? '').contains(query))
                .toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.9,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey[400],
                        borderRadius: BorderRadius.circular(2)),
                  ),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: cardColor,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: isDark
                                      ? Colors.grey[700]!
                                      : Colors.grey[300]!,
                                  width: 1.5),
                            ),
                            child: TextField(
                              autofocus: true,
                              cursorColor: lokmaPink,
                              style: TextStyle(
                                  color: textColor,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w500),
                              decoration: InputDecoration(
                                hintText: 'marketplace.search_in_menu'.tr(),
                                hintStyle: TextStyle(
                                    color: hintColor,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w500),
                                prefixIcon: Icon(Icons.search,
                                    color: isDark
                                        ? Colors.grey[300]
                                        : Colors.grey[600],
                                    size: 22),
                                border: InputBorder.none,
                                contentPadding:
                                    const EdgeInsets.symmetric(vertical: 14),
                                suffixIcon: _menuSearchQuery.isNotEmpty
                                    ? IconButton(
                                        icon: Icon(Icons.close,
                                            color: textColor, size: 20),
                                        onPressed: () {
                                          setModalState(
                                              () => _menuSearchQuery = '');
                                          setState(() => _menuSearchQuery = '');
                                        },
                                      )
                                    : null,
                              ),
                              onChanged: (val) {
                                setModalState(() => _menuSearchQuery = val);
                                setState(() => _menuSearchQuery = val);
                              },
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        TextButton(
                          onPressed: () {
                            if (_menuSearchQuery.isEmpty) {
                              setState(() => _menuSearchQuery = '');
                            }
                            Navigator.pop(context);
                          },
                          child: Text('common.cancel'.tr(),
                              style: TextStyle(
                                  color: lokmaPink,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, thickness: 1),
                  Expanded(
                    child: _menuSearchQuery.isEmpty
                        ? Center(
                            child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.search,
                                  size: 60, color: hintColor?.withOpacity(0.5)),
                              const SizedBox(height: 16),
                              Text('marketplace.search_for_products'.tr(),
                                  style: TextStyle(
                                      color: hintColor, fontSize: 16)),
                            ],
                          ))
                        : searchResults.isEmpty
                            ? Center(
                                child: Text('marketplace.no_results'.tr(),
                                    style: TextStyle(
                                        color: hintColor, fontSize: 16)))
                            : Consumer(
                                builder: (context, cartRef, _) {
                                  // Watch cart so this rebuilds on add/remove
                                  cartRef.watch(kermesCartProvider);
                                  return ListView.builder(
                                    padding: const EdgeInsets.all(16),
                                    itemCount: searchResults.length,
                                    itemBuilder: (context, index) {
                                      final item = searchResults[index];
                                      final cartQuantity =
                                          _getCartQuantity(item);
                                      return _buildMenuItem(item, cartQuantity,
                                          isDark: isDark);
                                    },
                                  );
                                },
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

  void _showCategorySelector() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white54 : Colors.black45;
    final handleColor = isDark ? Colors.white24 : Colors.black12;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.6,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle + Close button
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                      color: handleColor,
                      borderRadius: BorderRadius.circular(2)),
                ),
                Positioned(
                  right: 12,
                  child: IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: Icon(Icons.close, color: textSecondary, size: 22),
                  ),
                ),
              ],
            ),
            // Title
            Padding(
              padding: const EdgeInsets.only(left: 20, bottom: 12),
              child: Text(tr('marketplace.categories'),
                  style: TextStyle(
                      color: textPrimary,
                      fontSize: 22,
                      fontWeight: FontWeight.w600)),
            ),
            // Category list
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: _categories.length,
                itemBuilder: (context, index) {
                  final catName = _categories[index];
                  final isSelected = _selectedCategory.value == catName;

                  // Get product names for this category
                  String productPreview = '';
                  final allProducts = _eventMenu;
                  if (catName == 'marketplace.category_all'.tr()) {
                    productPreview =
                        allProducts.take(4).map((p) => p.name).join(', ');
                  } else {
                    final catProducts = allProducts
                        .where((p) => _getCategoryForItem(p) == catName)
                        .toList();
                    productPreview =
                        catProducts.take(4).map((p) => p.name).join(', ');
                  }
                  if (productPreview.length > 60) {
                    productPreview = '${productPreview.substring(0, 57)}...';
                  }

                  return InkWell(
                    onTap: () {
                      Navigator.pop(context);
                      _selectCategory(catName);
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  catName,
                                  style: TextStyle(
                                    color: textPrimary,
                                    fontWeight: isSelected
                                        ? FontWeight.w600
                                        : FontWeight.w400,
                                    fontSize: 17,
                                  ),
                                ),
                                if (productPreview.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    productPreview,
                                    style: TextStyle(
                                        color: textSecondary, fontSize: 13),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ],
                            ),
                          ),
                          if (isSelected)
                            Icon(Icons.check, color: textPrimary, size: 22),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_selectedCategory.value.isEmpty) {
      _selectedCategory.value = 'marketplace.category_all'.tr();
    }
    for (final category in _categoriesWithoutAll) {
      _sectionKeys.putIfAbsent(category, () => GlobalKey());
    }

    // Watch cart and category state for updates
    ref.watch(kermesCartProvider);
    ref.watch(kermesCategoryProvider);

    // Force pill recalculation after every build to fix stale positioning
    // (e.g. after returning from checkout sheet or product detail modal)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition();
    });

    final scaffoldBg = Theme.of(context).scaffoldBackgroundColor;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.grey[400]! : Colors.grey[600]!;

    final grouped = _groupedMenu;
    final menuKeys = _sectionKeys;

    final availableModes = _availableModes;
    final selectedTabIndex =
        availableModes.indexWhere((m) => m.absoluteIndex == _deliveryModeIndex);
    final validTabIndex = selectedTabIndex >= 0 ? selectedTabIndex : 0;

    return Scaffold(
      backgroundColor:
          isDark ? const Color(0xFF2B2929) : const Color(0xFFF9F9F9),
      body: Stack(
        children: [
          // Hidden offstage boundary for augmented share UI
          Transform.translate(
            offset: const Offset(-10000, -10000),
            child: RepaintBoundary(
              key: _shareBoundaryKey,
              child: _buildOffScreenShareCard(),
            ),
          ),
          
          CustomScrollView(
            controller: _scrollController,
            physics: const BouncingScrollPhysics(),
            slivers: [
              // SliverAppBar for search and navigation
              SliverAppBar(
                pinned: true,
                floating: true,
                snap: true,
                expandedHeight: 0,
                toolbarHeight: 56,
                backgroundColor: scaffoldBg,
                surfaceTintColor: Colors.transparent,
                automaticallyImplyLeading: false,
                title: GestureDetector(
                  onTap: () => _showMenuSearchOverlay(),
                  child: Container(
                    height: 40,
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF2A2A2A)
                          : const Color(0xFFF5F0E8),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        const SizedBox(width: 12),
                        Icon(Icons.search,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _menuSearchQuery.isNotEmpty ? _menuSearchQuery : 'customer.menude_ara'.tr(),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: _menuSearchQuery.isNotEmpty
                                  ? (isDark ? Colors.white : Colors.black87)
                                  : (isDark
                                      ? Colors.grey[400]
                                      : Colors.grey[600]),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                    ),
                  ),
                ),
                leading: Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: isDark
                            ? Colors.white.withOpacity(0.1)
                            : Colors.black.withOpacity(0.05),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.arrow_back_ios_new,
                          color: isDark ? Colors.white : Colors.black87,
                          size: 18),
                    ),
                  ),
                ),
                actions: [
                  // QR kod okuyucu (grup siparisi katilimi)
                  GestureDetector(
                    onTap: () => _openQrScanner(),
                    child: Icon(Icons.qr_code_scanner_rounded,
                        color: lokmaPink,
                        size: 24),
                  ),
                  const SizedBox(width: 16),
                ],
              ),
              // Hero Section (Card format)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(left: 8, right: 8, top: 8),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: _buildHeroSection(context),
                  ),
                ),
              ),
              if (_globalFeatures.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                    child: _buildFeaturesRow(),
                  ),
                ),

              // Menu ve Siparis Card
              SliverToBoxAdapter(
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  child: GestureDetector(
                    onTap: () {
                      // Scroll to first category
                      if (_categoriesWithoutAll.isNotEmpty) {
                        _selectCategory(_categoriesWithoutAll.first);
                      }
                    },
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: SizedBox(
                        height: 200,
                        width: double.infinity,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            // Background image
                            _menuBackgroundImageUrl != null && _menuBackgroundImageUrl!.isNotEmpty
                                ? LokmaNetworkImage(
                                    imageUrl: _menuBackgroundImageUrl!,
                                    fit: BoxFit.cover,
                                  )
                                : Container(
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [
                                          const Color(0xFF2D1B00),
                                          const Color(0xFF1A0E00)
                                        ],
                                      ),
                                    ),
                                  ),
                            // Gradient overlay
                            Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.bottomLeft,
                                  end: Alignment.topRight,
                                  colors: [
                                    Colors.black.withOpacity(0.85),
                                    Colors.black.withOpacity(0.3),
                                    Colors.transparent,
                                  ],
                                ),
                              ),
                            ),

                          // Dynamic Sponsor / Certificate Badges
                          if (_currentEvent.activeBadgeIds.isNotEmpty && _activeBadges != null)
                            Positioned(
                              top: 16,
                              left: 16,
                              child: _buildDynamicBadges(context),
                            ),
                            // Bottom content
                            Positioned(
                              bottom: 20,
                              left: 20,
                              right: 20,
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                                width: 6,
                                                height: 6,
                                                decoration: BoxDecoration(
                                                    color: primaryRuby,
                                                    shape: BoxShape.circle)),
                                            const SizedBox(width: 8),
                                            Text('kermes.lezzet_soleni'.tr(),
                                                style: TextStyle(
                                                    color: Colors.white
                                                        .withOpacity(0.7),
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                    letterSpacing: 2)),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text('kermes.menu_and_order'.tr(),
                                            style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 26,
                                                fontWeight: FontWeight.bold,
                                                height: 1.1)),
                                        const SizedBox(height: 4),
                                        Text(
                                            'kermes.kermes_flavor_desc'.tr(),
                                            style: TextStyle(
                                                color: Colors.white
                                                    .withOpacity(0.85),
                                                fontSize: 14,
                                                fontWeight: FontWeight.w500)),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: primaryRuby,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.arrow_forward,
                                        color: Colors.white, size: 20),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // Info Cards (before menu)
              SliverToBoxAdapter(
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLocationCard(),
                      const SizedBox(height: 20),
                      _buildWeatherSection(),
                      const SizedBox(height: 20),
                      _buildAdminAndContactCard(),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),

              // 3. Category Chip Tabs
              SliverPersistentHeader(
                pinned: true,
                delegate: _KermesCategoryHeaderDelegate(
                  child: Container(
                    color: scaffoldBg,
                    height: 52,
                    child: Column(
                      children: [
                        AnimatedBuilder(
                          animation: Listenable.merge([
                            _selectedCategory,
                            _pillLeft,
                            _pillWidth,
                            _pillInitialized,
                          ]),
                          builder: (context, _) {
                            return Row(
                          children: [
                            Expanded(
                              child: SingleChildScrollView(
                                controller: _chipScrollController,
                                scrollDirection: Axis.horizontal,
                                padding: const EdgeInsets.only(
                                    left: 16, right: 4, top: 4, bottom: 8),
                                child: Stack(
                                  alignment: Alignment.centerLeft,
                                  children: [
                                    // 1. Sliding pill indicator
                                    if (_pillInitialized.value)
                                      AnimatedPositioned(
                                        duration:
                                            const Duration(milliseconds: 400),
                                        curve: Curves.easeOutBack,
                                        left: _pillLeft.value,
                                        top: 0,
                                        bottom: 0,
                                        child: AnimatedContainer(
                                          duration:
                                              const Duration(milliseconds: 400),
                                          curve: Curves.easeOutBack,
                                          width: _pillWidth.value,
                                          decoration: BoxDecoration(
                                            color: isDark
                                                ? Colors.white
                                                : const Color(0xFF3E3E3F),
                                            borderRadius:
                                                BorderRadius.circular(50),
                                            boxShadow: [
                                              BoxShadow(
                                                color: (isDark
                                                        ? Colors.white
                                                        : Colors.black)
                                                    .withOpacity(0.12),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    // 2. Chip texts row
                                    Row(
                                      key: _chipRowKey,
                                      children: _categories.map((category) {
                                        _tabKeys.putIfAbsent(
                                            category, () => GlobalKey());
                                        final isSelected =
                                            category == _selectedCategory.value;

                                        return Padding(
                                          padding:
                                              const EdgeInsets.only(right: 6),
                                          child: GestureDetector(
                                            onTap: () {
                                              HapticFeedback.selectionClick();
                                              _selectCategory(category);
                                            },
                                            child: Container(
                                              key: _tabKeys[category],
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 16,
                                                      vertical: 7),
                                              decoration: BoxDecoration(
                                                color: Colors.transparent,
                                                borderRadius:
                                                    BorderRadius.circular(50),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  AnimatedDefaultTextStyle(
                                                    duration: const Duration(
                                                        milliseconds: 300),
                                                    curve: Curves.easeOutCubic,
                                                    style: TextStyle(
                                                      color: isSelected
                                                          ? (isDark
                                                              ? Colors.black
                                                              : Colors.white)
                                                          : (isDark
                                                              ? Colors.white70
                                                              : Colors.black54),
                                                      fontWeight: isSelected
                                                          ? FontWeight.w700
                                                          : FontWeight.w500,
                                                      fontSize: 14,
                                                    ),
                                                    child: Text(
                                                      _getTranslatedCategory(category),
                                                    ),
                                                  ),
                                                  // Cart count badge
                                                  Builder(builder: (context) {
                                                    final kermesCart =
                                                        ref.watch(
                                                            kermesCartProvider);
                                                    final catCartCount = category ==
                                                            'marketplace.category_all'.tr()
                                                        ? kermesCart.totalItems
                                                        : kermesCart.items
                                                            .where((ci) =>
                                                                ci.menuItem
                                                                    .category ==
                                                                category)
                                                            .fold<int>(
                                                                0,
                                                                (sum, ci) =>
                                                                    sum +
                                                                    ci.quantity);
                                                    if (catCartCount <= 0)
                                                      return const SizedBox
                                                          .shrink();
                                                    return Padding(
                                                      padding:
                                                          const EdgeInsets.only(
                                                              left: 6),
                                                      child: AnimatedContainer(
                                                        duration:
                                                            const Duration(
                                                                milliseconds:
                                                                    300),
                                                        curve:
                                                            Curves.easeOutBack,
                                                        width: 20,
                                                        height: 20,
                                                        decoration:
                                                            BoxDecoration(
                                                          color: isSelected
                                                              ? (isDark
                                                                  ? Colors
                                                                      .black87
                                                                  : Colors
                                                                      .white)
                                                              : Colors.red,
                                                          shape:
                                                              BoxShape.circle,
                                                        ),
                                                        alignment:
                                                            Alignment.center,
                                                        child: Text(
                                                          '$catCartCount',
                                                          style: TextStyle(
                                                            fontSize: 11,
                                                            fontWeight:
                                                                FontWeight.w600,
                                                            color: isSelected
                                                                ? (isDark
                                                                    ? Colors
                                                                        .white
                                                                    : Colors
                                                                        .black87)
                                                                : Colors.white,
                                                          ),
                                                        ),
                                                      ),
                                                    );
                                                  }),
                                                ],
                                              ),
                                            ),
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            // ≡ More icon (Lieferando-style, no border)
                            GestureDetector(
                              onTap: _showCategorySelector,
                              child: Padding(
                                padding:
                                    const EdgeInsets.only(right: 12, left: 2),
                                child: Icon(
                                  Icons.format_list_bulleted,
                                  color:
                                      isDark ? Colors.white70 : Colors.black54,
                                  size: 22,
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                        Divider(
                            height: 1,
                            thickness: 0.5,
                            color: isDark
                                ? Colors.white.withOpacity(0.1)
                                : Colors.grey[300]),
                      ],
                    ),
                  ),
                ),
              ),

              // 4. Products List
              if (_groupedMenu.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.restaurant_menu,
                            size: 64,
                            color:
                                isDark ? Colors.grey[700] : Colors.grey[400]),
                        const SizedBox(height: 16),
                        Text(
                          'kermes.no_menu_items'.tr(),
                          style: TextStyle(color: textSecondary, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final category = _categoriesWithoutAll[index];
                      if (!grouped.containsKey(category))
                        return const SizedBox.shrink();
                      final categoryItems = grouped[category]!;
                      if (categoryItems.isEmpty) return const SizedBox.shrink();

                      return Container(
                        key: menuKeys[category],
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Category Header (business_detail_screen pattern)
                            Container(
                              width: double.infinity,
                              color: isDark
                                  ? const Color(0xFF2C2C2C).withOpacity(0.6)
                                  : const Color(0xFFF2EEE9),
                              padding:
                                  const EdgeInsets.fromLTRB(16, 10, 16, 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      _getTranslatedCategory(category),
                                      style: TextStyle(
                                        color:
                                            isDark ? lokmaPink : Colors.black87,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                                  ),
                                  Builder(builder: (context) {
                                    final catCartCount = grouped[category]!
                                        .fold<int>(
                                            0,
                                            (sum, item) =>
                                                sum + _getCartQuantity(item));
                                    if (catCartCount <= 0)
                                      return const SizedBox.shrink();
                                    return Container(
                                      width: 24,
                                      height: 24,
                                      decoration: BoxDecoration(
                                        color: isDark
                                            ? Colors.white
                                            : Colors.black87,
                                        shape: BoxShape.circle,
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        '$catCartCount',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: isDark
                                              ? Colors.black
                                              : Colors.white,
                                        ),
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                            // Items
                            ...categoryItems.map((item) {
                              final cartQuantity = _getCartQuantity(item);
                              return _buildMenuItem(item, cartQuantity,
                                  isDark: isDark);
                            }),
                            // Extra bottom padding for last item
                            if (index == _categoriesWithoutAll.length - 1)
                              const SizedBox(height: 120)
                            else
                              const SizedBox(height: 16),
                          ],
                        ),
                      );
                    },
                    childCount: _categoriesWithoutAll.length,
                  ),
                ),
            ], // slivers end
          ), // CustomScrollView end

          // Floating grup siparisi butonu
          FloatingGroupOrderButton(
            onTap: () {
              if (_activeGroupOrderId != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => KermesGroupOrderScreen(
                      event: _currentEvent,
                      groupOrderId: _activeGroupOrderId!,
                    ),
                  ),
                );
              }
            },
          ),

        ], // Stack children end
      ), // Stack end
      bottomNavigationBar: (_totalItems > 0 && !_currentEvent.isMenuOnly)
          ? _buildCartBar()
          : null,
    );
  }
  String _getCleanAddress() {
    String addr = _currentEvent.address.trim();
    if (addr.isEmpty) return addr;
    final pc = _currentEvent.postalCode.trim();
    final city = _currentEvent.city.trim();
    
    if (pc.isNotEmpty && city.isNotEmpty) {
      final suffixes = [
        ', $pc $city',
        ' $pc $city',
        ',$pc $city',
        ', $pc, $city',
      ];
      
      for (final suffix in suffixes) {
        if (addr.toLowerCase().endsWith(suffix.toLowerCase())) {
          return addr.substring(0, addr.length - suffix.length).trim().replaceAll(RegExp(r',$'), '');
        }
      }
    }
    return addr;
  }

  String _getCountryFlag(String country) {
    final lower = country
        .toLowerCase()
        .replaceAll('\u0131', 'i') // ı -> i
        .replaceAll('\u00fc', 'u') // ue -> u
        .replaceAll('\u00f6', 'o') // oe -> o
        .replaceAll('\u015f', 's') // s-cedilla -> s
        .replaceAll('\u00e7', 'c') // c-cedilla -> c
        .replaceAll('\u011f', 'g'); // g-breve -> g
    if (lower.contains('avusturya') ||
        lower.contains('austria') ||
        lower.contains('osterreich') ||
        lower == 'at') return '\u{1F1E6}\u{1F1F9}';
    if (lower.contains('sirbistan') ||
        lower.contains('serbia') ||
        lower.contains('serbien') ||
        lower == 'rs') return '\u{1F1F7}\u{1F1F8}';
    if (lower.contains('bulgaristan') ||
        lower.contains('bulgaria') ||
        lower.contains('bulgarien') ||
        lower == 'bg') return '\u{1F1E7}\u{1F1EC}';
    if (lower.contains('turkiye') ||
        lower.contains('turkey') ||
        lower.contains('turkei') ||
        lower == 'tr') return '\u{1F1F9}\u{1F1F7}';
    if (lower.contains('hollanda') ||
        lower.contains('netherlands') ||
        lower.contains('niederlande') ||
        lower == 'nl') return '\u{1F1F3}\u{1F1F1}';
    if (lower.contains('fransa') ||
        lower.contains('france') ||
        lower.contains('frankreich') ||
        lower == 'fr') return '\u{1F1EB}\u{1F1F7}';
    if (lower.contains('belcika') ||
        lower.contains('belgium') ||
        lower.contains('belgien') ||
        lower == 'be') return '\u{1F1E7}\u{1F1EA}';
    if (lower.contains('isvicre') ||
        lower.contains('switzerland') ||
        lower.contains('schweiz') ||
        lower == 'ch') return '\u{1F1E8}\u{1F1ED}';
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
    return ''; // Varsayilan Almanya hatasini giderdik
  }

  Widget _buildHeroSection(BuildContext context, {bool isForShare = false}) {
    return Container(
      height: 440,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E).withOpacity(0.9),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background Image
          _currentEvent.headerImage != null &&
                  _currentEvent.headerImage!.isNotEmpty
              ? (_currentEvent.headerImage!.toLowerCase().contains('.mp4') || _currentEvent.headerImage!.toLowerCase().contains('video%2F'))
                  ? KermesVideoHeader(
                      videoUrl: _currentEvent.headerImage!,
                      fit: BoxFit.cover,
                      scrollController: _scrollController,
                    )
                  : LokmaNetworkImage(
                      imageUrl: _currentEvent.headerImage!,
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
                  Colors.black.withOpacity(0.55),
                  Colors.black.withOpacity(0.15),
                  Colors.transparent,
                ],
              ),
            ),
          ),

          // Top Badges Row (Tuna on Left, Kermes Logo on Right)
          Positioned(
            top: 56,
            left: 16,
            right: 24,
            child: SizedBox(
              height: 60, // Sabit yükseklik ile dikeyde tam merkezleme
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Sol: Dynamic Sponsor / Certificate Badges (Tuna vs.)
                  if (_currentEvent.activeBadgeIds.isNotEmpty && _activeBadges != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: _buildDynamicBadges(context, alignment: CrossAxisAlignment.start),
                    ),
                  
                  // Sağ: Kermes Custom Logo
                  if (_currentEvent.logoUrl != null && _currentEvent.logoUrl!.isNotEmpty)
                    Align(
                      alignment: Alignment.centerRight,
                      child: Builder(
                        builder: (context) {
                          final bool isPng = _currentEvent.logoUrl!.toLowerCase().contains('.png');
                          return Container(
                            height: 60,
                            constraints: const BoxConstraints(minWidth: 60, maxWidth: 140),
                            decoration: isPng ? null : BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(50), // Pill shape
                              border: Border.all(color: Colors.white, width: 2),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.15),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                )
                              ],
                            ),
                            child: isPng
                              ? LokmaNetworkImage(
                                  imageUrl: _currentEvent.logoUrl!,
                                  fit: BoxFit.contain, // Fit entire logo natively
                                )
                              : ClipRRect(
                                  borderRadius: BorderRadius.circular(50),
                                  child: LokmaNetworkImage(
                                    imageUrl: _currentEvent.logoUrl!,
                                    fit: BoxFit.contain, // Fit entire logo securely
                                  ),
                                ),
                          );
                        }
                      ),
                    ),
                ],
              ),
            ),
          ),
          // Top Action Buttons
          if (!isForShare)
            Positioned(
              top: 12,
              left: 16,
              right: 16,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildGlassButton(
                      Icons.arrow_back, () => Navigator.pop(context)),
                  Row(
                    children: [
                      _buildGlassButton(
                        _isFavorite ? Icons.favorite : Icons.favorite_border,
                        () {
                          HapticFeedback.lightImpact();
                          setState(() {
                            _isFavorite = !_isFavorite;
                          });
                        },
                        color:
                            _isFavorite ? const Color(0xFFE50055) : Colors.white,
                      ),
                      const SizedBox(width: 12),
                      _buildGlassButton(Icons.share, () => _shareKermes()),
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
                    Flexible(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: primaryRuby.withOpacity(0.9),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _currentEvent.city.toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${_getLocalizedCountry(_currentEvent.country).split(' ').first} ${_getCountryFlag(_currentEvent.country)}',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Title
                Text(
                  _currentEvent.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    fontWeight: FontWeight.bold,
                    height: 1.1,
                    letterSpacing: -0.5,
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
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
                    Builder(
                      builder: (context) {
                        final now = DateTime.now();
                        final start = _currentEvent.startDate;
                        final end = _currentEvent.endDate;
                        String countdownText;
                        if (now.isBefore(start)) {
                          final days = start.difference(now).inDays;
                          if (days == 0) {
                            countdownText = 'kermes.starts_today'.tr();
                          } else if (days == 1) {
                            countdownText = 'kermes.starts_tomorrow'.tr();
                          } else {
                            countdownText = 'kermes.starts_in_days'.tr(namedArgs: {'days': '$days'});
                          }
                        } else if (now.isAfter(end)) {
                          countdownText = 'kermes.event_ended'.tr();
                        } else {
                          final days = end.difference(now).inDays;
                          if (days == 0) {
                            countdownText = 'kermes.last_day'.tr();
                          } else if (days == 1) {
                            countdownText = 'kermes.ends_tomorrow'.tr();
                          } else {
                            countdownText = 'kermes.ends_in_days'.tr(namedArgs: {'days': '$days'});
                          }
                        }
                        return Text(
                          countdownText,
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.9),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1,
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Glassmorphic Date & Time Card
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.15),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 12.0, sigmaY: 12.0),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.35),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.white.withOpacity(0.15)),
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
                              child: Icon(Icons.calendar_today,
                                  color: Colors.white.withOpacity(0.9),
                                  size: 18),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'kermes.date_label'.tr(),
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.5),
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      '${_currentEvent.startDate.day}.${_currentEvent.startDate.month} - ${_currentEvent.endDate.day}.${_currentEvent.endDate.month}.${_currentEvent.endDate.year}',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
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
                                    'kermes.time_label'.tr(),
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.5),
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
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
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
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
                              child: Icon(Icons.schedule,
                                  color: Colors.white.withOpacity(0.9),
                                  size: 18),
                            ),
                          ],
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

  Widget _buildGlassButton(IconData icon, VoidCallback onTap,
      {Color color = Colors.white}) {
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
              child: Icon(icon, color: color, size: 20),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFeaturesRow() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white.withOpacity(0.9) : Colors.black87;
    final bg = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: _globalFeatures.map((f) {
          return Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: bg,
                border: Border.all(color: bg),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (f.iconUrl != null && f.iconUrl!.isNotEmpty) ...[
                    LokmaNetworkImage(
                      imageUrl: f.iconUrl!,
                      width: 32,
                      height: 32,
                    ),
                    const SizedBox(width: 8),
                  ] else if (f.icon.isNotEmpty) ...[
                    Text(
                      f.icon, 
                      style: const TextStyle(fontSize: 22),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    'kermes.feature_${f.id}'.tr() != 'kermes.feature_${f.id}'
                        ? 'kermes.feature_${f.id}'.tr()
                        : f.label,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.5,
                      height: 1.2,
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
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor =
        isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ],
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
                      child:
                          Icon(Icons.location_on, color: textColor, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'kermes.location_caps'.tr(),
                            style: TextStyle(
                              color: subtleTextColor,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1,
                            ),
                          ),
                          Text(
                            '${_currentEvent.city}, ${_getLocalizedCountry(_currentEvent.country)}',
                            style: TextStyle(
                              color: textColor,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: dividerBg,
                      border: Border.all(color: dividerBg),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.near_me, color: subtleTextColor, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          ((widget.currentPosition == null && (ref.read(userLocationProvider).value == null || ref.read(userLocationProvider).value!.latitude == 0.0)) || 
                           (_currentEvent.latitude == 0.0 && _currentEvent.longitude == 0.0))
                            ? '~ km'
                            : '${_distanceKm.toStringAsFixed(1)} km',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.directions_car, color: lokmaPink, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        ((widget.currentPosition != null || (ref.read(userLocationProvider).value != null && ref.read(userLocationProvider).value!.latitude != 0.0)) && !(_currentEvent.latitude == 0.0 && _currentEvent.longitude == 0.0)) 
                            ? '${DistanceUtils.calculateEstimatedDrivingMinutes(_distanceKm)} Dk.' 
                            : '-- Dk.',
                        style: const TextStyle(
                          color: lokmaPink,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  )
                ],
              ),
            ],
          ),
          Text(
            [
              if (_currentEvent.address.isNotEmpty) _getCleanAddress(),
              if (_currentEvent.postalCode.isNotEmpty ||
                  _currentEvent.city.isNotEmpty)
                '${_currentEvent.postalCode} ${_currentEvent.city}'.trim(),
              if (_currentEvent.state?.isNotEmpty == true) _currentEvent.state!,
              if (_currentEvent.country.isNotEmpty) 
                _getLocalizedCountry(_currentEvent.country),
            ].join('\n'),
            style: TextStyle(
              color: isDark ? Colors.white.withOpacity(0.9) : Colors.black87,
              fontSize: 15,
              fontWeight: FontWeight.w500,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: _openMaps,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2196F3),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.navigation, color: Colors.white, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'kermes.directions'.tr(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              ...[
                const SizedBox(width: 12),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) =>
                            KermesParkingScreen(event: _currentEvent),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2196F3).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.local_parking,
                              color: const Color(0xFF2196F3), size: 16),
                          const SizedBox(width: 6),
                          Text(
                            'kermes.parking_info'.tr(),
                            style: TextStyle(
                              color: const Color(0xFF2196F3),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildParkingCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor =
        isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (context) => KermesParkingScreen(event: _currentEvent),
        );
      },
      child: Container(
        height: 128,
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(24),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4))
                ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned.fill(
              child: Opacity(
                opacity: 0.5,
                child: LokmaNetworkImage(
                  imageUrl:
                      'https://lh3.googleusercontent.com/aida-public/AB6AXuCghDSwUkHQ0hd_B-McJJ4fZPGP8zjK929y42shgv2J-MhJ392FInWVjplw_iuK_8Us9DBl_U8KTvA_Ta8idIJiKv_mnOJBrLM_A9DJmJYQA5p0PG-nI6sW97x-t_mZlqnsqwl9JFl73dwWa--SMG6BWh3zFYa31muxxpjbsG95nxmIWM6pz_B_90aqy3LThEiqT5dvrKWS3KmdN9GFxNmQo0oEx3uX6n4BA_0EGwpo6KT0wuFf9qJ6XjOUlIn9_HK_uE8PQkwHbrae',
                  fit: BoxFit.cover,
                  color: isDark ? Colors.grey : Colors.grey.shade400,
                  colorBlendMode: BlendMode.saturation,
                  errorWidget: (context, url, error) =>
                      Container(color: cardBg),
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
                          Text(
                            'kermes.parking_status'.tr(),
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
                        'kermes.parking_info'.tr(),
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
                            'kermes.parking_empty'.tr(),
                            style:
                                TextStyle(color: subtleTextColor, fontSize: 12),
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
                    child: Icon(Icons.local_parking,
                        color: textColor.withOpacity(0.8), size: 24),
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
    return DateFormat('d MMMM', context.locale.languageCode).format(date);
  }

  /// OpenWeatherMap ikon kodunu Flutter Material ikona cevirir
  Widget _weatherIcon(String iconCode, {double size = 28, Color? color}) {
    IconData icon;
    Color iconColor;
    switch (iconCode.substring(0, 2)) {
      case '01': // clear sky
        icon = iconCode.endsWith('n')
            ? Icons.nightlight_round
            : Icons.wb_sunny_rounded;
        iconColor =
            color ?? (iconCode.endsWith('n') ? Colors.blueGrey : Colors.amber);
        break;
      case '02': // few clouds
        icon = iconCode.endsWith('n')
            ? Icons.nights_stay_rounded
            : Icons.cloud_queue_rounded;
        iconColor = color ??
            (iconCode.endsWith('n') ? Colors.blueGrey : Colors.amber.shade700);
        break;
      case '03': // scattered clouds
        icon = Icons.cloud_rounded;
        iconColor = color ?? Colors.grey;
        break;
      case '04': // broken clouds
        icon = Icons.cloud_rounded;
        iconColor = color ?? Colors.grey.shade600;
        break;
      case '09': // shower rain
        icon = Icons.grain_rounded;
        iconColor = color ?? Colors.blue.shade400;
        break;
      case '10': // rain
        icon = Icons.water_drop_rounded;
        iconColor = color ?? Colors.blue;
        break;
      case '11': // thunderstorm
        icon = Icons.thunderstorm_rounded;
        iconColor = color ?? Colors.deepPurple;
        break;
      case '13': // snow
        icon = Icons.ac_unit_rounded;
        iconColor = color ?? Colors.lightBlue.shade200;
        break;
      case '50': // mist
        icon = Icons.foggy;
        iconColor = color ?? Colors.grey.shade400;
        break;
      default:
        icon = Icons.wb_cloudy_rounded;
        iconColor = color ?? Colors.grey;
    }
    return Icon(icon, size: size, color: iconColor);
  }

  Widget _buildAdminAndContactCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor =
        isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Kermes İrtibat Top Section
          Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDark ? Colors.grey[800] : Colors.grey[100],
                    border: Border.all(color: dividerBg, width: 2),
                  ),
                  child: Icon(
                    Icons.person,
                    color: isDark ? Colors.blue[400] : Colors.blue[600],
                    size: 26,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'kermes.default_contact_name'.tr(),
                        style: TextStyle(
                          color: textColor,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _currentEvent.contactName?.isNotEmpty == true &&
                                _currentEvent.contactName != 'Kermes Yetkilisi' &&
                                _currentEvent.contactName != 'Yetkili'
                            ? _currentEvent.contactName!
                            : 'kermes.contact_questions'.tr(),
                        style: TextStyle(
                          color: subtleTextColor,
                          fontSize: 14,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Bize Ulaşın Bottom Section
          if (_currentEvent.phoneNumber.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 24, right: 24, bottom: 24),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withOpacity(0.05)
                      : Colors.black.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'kermes.phone'.tr(),
                            style: TextStyle(
                              color: subtleTextColor,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _currentEvent.phoneNumber,
                            style: TextStyle(
                              color: textColor,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    // Telefon Butonu (SVG)
                    InkWell(
                      onTap: () async {
                        final uri = Uri.parse('tel:${_currentEvent.phoneNumber.replaceAll(RegExp(r'[^\d+]'), '')}');
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri);
                        }
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isDark ? Colors.grey[800] : Colors.grey[200],
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: SvgPicture.asset(
                          'assets/icons/telephone-call_74451.svg',
                          width: 24,
                          height: 24,
                          colorFilter: isDark 
                              ? const ColorFilter.mode(Colors.white, BlendMode.srcIn) 
                              : null,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    // WhatsApp Butonu (SVG)
                    InkWell(
                      onTap: () async {
                        final cleanPhone = _currentEvent.phoneNumber.replaceAll(RegExp(r'\D'), '');
                        final waUrl = 'https://wa.me/$cleanPhone';
                        final uri = Uri.parse(waUrl);
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF25D366).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: SvgPicture.asset(
                          'assets/icons/whatsapp_134937.svg',
                          width: 24,
                          height: 24,
                        ),
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

  Widget _buildWeatherSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor =
        isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);
    final accentBlue = const Color(0xFF2563EB);

    if (_isLoadingWeather) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration:
                      BoxDecoration(color: dividerBg, shape: BoxShape.circle),
                  child:
                      const Icon(Icons.wb_sunny, color: Colors.amber, size: 20),
                ),
                const SizedBox(width: 12),
                Text('Hava durumu yukleniyor...',
                    style: TextStyle(color: subtleTextColor, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 16),
            LinearProgressIndicator(
                color: accentBlue, backgroundColor: dividerBg),
          ],
        ),
      );
    }

    final now = DateTime.now();
    final start = _currentEvent.startDate;
    final end = _currentEvent.endDate;

    // API'den gelen tum günlük özetleri alıyoruz
    final dailySummaries = _weatherForecast?.getDailySummaries() ?? [];

    // Kullanıcının isteği: Kermes açık olmasa bile, API'dan gelen mevcut hava durumunu direkt gösterelim.
    // O yüzden tarih filtrelemesini kaldırdık.
    final eventDailySummaries = dailySummaries;

    // Bugunun saatlik tahminleri
    final todayHourly = List<HourlyWeather>.from(_weatherForecast?.getHourlyForDay(now) ?? []);
    
    if (_currentWeather != null) {
      final nowHourly = HourlyWeather(
        dateTime: now,
        temperature: _currentWeather!.temperature,
        feelsLike: _currentWeather!.feelsLike,
        rainProbability: todayHourly.isNotEmpty ? todayHourly.first.rainProbability : 0, 
        windSpeed: _currentWeather!.windSpeed,
        description: _currentWeather!.description,
        icon: _currentWeather!.icon,
      );
      
      if (todayHourly.isEmpty || todayHourly.first.dateTime.hour > now.hour) {
        todayHourly.insert(0, nowHourly);
      } else if (todayHourly.first.dateTime.hour == now.hour) {
        todayHourly[0] = nowHourly;
      } else {
        // Eger ilk öğe geçmişte kalmışsa (mesela 14:00, biz 14:40'tayız), 
        // araya sıkıştırma veya eskisini tutma kararı alabiliriz. 
        // Genelde forecast apisi geçmişi atmaz, ama emin olmak için en başa ekleyelim (eğer yoksa).
        bool hasNow = false;
        for (int i = 0; i < todayHourly.length; i++) {
          if (todayHourly[i].dateTime.hour == now.hour) {
            todayHourly[i] = nowHourly;
            hasNow = true;
            break;
          }
        }
        if (!hasNow) {
          todayHourly.insert(0, nowHourly);
          todayHourly.sort((a, b) => a.dateTime.compareTo(b.dateTime));
        }
      }
    }
    final isEventDay =
        !now.isBefore(DateTime(start.year, start.month, start.day)) &&
            !now.isAfter(DateTime(end.year, end.month, end.day));

    // Hava durumu bulunabilir mi?
    final hasForecast = eventDailySummaries.isNotEmpty;

    // Kermesin kacinci gunu
    int _getEventDayNumber(DateTime date) {
      return DateTime(date.year, date.month, date.day)
              .difference(DateTime(start.year, start.month, start.day))
              .inDays +
          1;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // HEADER
          Row(
            children: [
              // Anlık hava durumu varsa: büyük derece ortada, ikon sağ üstte
              if (_currentWeather != null)
                SizedBox(
                  width: 58,
                  height: 58,
                  child: Stack(
                    children: [
                      // Arka plan daire
                      Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          color: dividerBg,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${_currentWeather!.temperature.round()}°',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            height: 1,
                          ),
                        ),
                      ),
                      // Sağ üst köşede hava ikonu
                      Positioned(
                        top: 0,
                        right: 0,
                        child: Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color:
                                isDark ? const Color(0xFF2A2A2A) : Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child:
                                _weatherIcon(_currentWeather!.icon, size: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(
                    gradient:
                        LinearGradient(colors: [Colors.amber, Colors.orange]),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.wb_sunny_rounded,
                      color: Colors.white, size: 20),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'kermes.weather_title'.tr(),
                      style: TextStyle(
                        color: subtleTextColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${_currentEvent.city} - ${'kermes.event_days_forecast'.tr()}',
                      style: TextStyle(
                        color: textColor,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Hava durumu yoksa bilgilendirme
          if (!hasForecast) ...[
            const SizedBox(height: 24),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: dividerBg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Icon(Icons.cloud_off_outlined,
                      color: subtleTextColor, size: 40),
                  const SizedBox(height: 12),
                  Text(
                    'kermes.weather_not_available'.tr(),
                    style: TextStyle(
                        color: textColor,
                        fontSize: 15,
                        fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    now.isBefore(start)
                        ? 'kermes.weather_approx'.tr()
                        : 'kermes.weather_fetch_failed'.tr(),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: subtleTextColor, fontSize: 12, height: 1.5),
                  ),
                ],
              ),
            ),
          ],

          // ======= BUGUNUN SAATLIK TAHMINI =======
          if (hasForecast && todayHourly.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(
              children: [
                Text(
                  'kermes.today_caps'.tr(),
                  style: TextStyle(
                      color: subtleTextColor,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2),
                ),
                if (isEventDay) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'kermes.kermes_day_nth'.tr(args: [_getEventDayNumber(now).toString()]),
                      style: const TextStyle(
                          color: Colors.green,
                          fontSize: 10,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            // Saatlik yatay scroll
            SizedBox(
              height: 100,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: todayHourly.length,
                separatorBuilder: (_, __) => const SizedBox(width: 4),
                itemBuilder: (context, i) {
                  final h = todayHourly[i];
                  final isNow = h.dateTime.hour == now.hour;
                  return Container(
                    width: 64,
                    padding:
                        const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                    decoration: BoxDecoration(
                      color: isNow ? accentBlue.withOpacity(0.15) : dividerBg,
                      borderRadius: BorderRadius.circular(14),
                      border: isNow
                          ? Border.all(
                              color: accentBlue.withOpacity(0.4), width: 1.5)
                          : null,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Text(
                          isNow
                              ? 'Simdi'
                              : '${h.dateTime.hour.toString().padLeft(2, '0')}:00',
                          style: TextStyle(
                            color: isNow ? accentBlue : subtleTextColor,
                            fontSize: 11,
                            fontWeight:
                                isNow ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                        _weatherIcon(h.icon, size: 28),
                        Text(
                          '${h.temperature.round()}°',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],

          // ======= GUNLUK TAHMIN (ETKINLIK GUNLERI) =======
          if (hasForecast) ...[
            const SizedBox(height: 20),
            Text(
              'kermes.event_days_caps'.tr(),
              style: TextStyle(
                  color: subtleTextColor,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2),
            ),
            const SizedBox(height: 12),
            ...eventDailySummaries.map((day) {
              final dayNum = _getEventDayNumber(day.date);
              final isToday = day.date.year == now.year &&
                  day.date.month == now.month &&
                  day.date.day == now.day;

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isToday ? accentBlue.withOpacity(0.08) : dividerBg,
                  borderRadius: BorderRadius.circular(16),
                  border: isToday
                      ? Border.all(color: accentBlue.withOpacity(0.3))
                      : null,
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        // Tarih + Gun
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    '${day.date.day} ${_formatDateShort(day.date).split(' ').last}',
                                    style: TextStyle(
                                        color: textColor,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    _getTurkishDayName(day.date),
                                    style: TextStyle(
                                        color: subtleTextColor,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  if (dayNum > 0 && 
                                      !day.date.isBefore(DateTime(start.year, start.month, start.day)) &&
                                      !day.date.isAfter(DateTime(end.year, end.month, end.day))) ...[
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 6, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: isToday
                                            ? Colors.green.withOpacity(0.15)
                                            : Colors.orange.withOpacity(0.12),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        isToday
                                            ? 'kermes.today_day'.tr(namedArgs: {'day': '$dayNum'})
                                            : 'kermes.nth_day'.tr(namedArgs: {'day': '$dayNum'}),
                                        style: TextStyle(
                                          color: isToday
                                              ? Colors.green
                                              : Colors.orange,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                  ],
                                  Expanded(
                                    child: Text(
                                      day.description,
                                      style: TextStyle(
                                          color: subtleTextColor,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        // Hava ikonu + sicaklik
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _weatherIcon(day.icon, size: 32),
                            const SizedBox(width: 4),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${day.maxTemperature.round()}°',
                                  style: TextStyle(
                                      color: textColor,
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800),
                                ),
                                Text(
                                  '${day.minTemperature.round()}°',
                                  style: TextStyle(
                                      color: subtleTextColor,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Detay satiri: Ruzgar + Yagis
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark
                            ? Colors.white.withOpacity(0.03)
                            : Colors.black.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.air, color: subtleTextColor, size: 14),
                              const SizedBox(width: 4),
                              Text(
                                '${day.avgWindSpeed.round()} km/h',
                                style: TextStyle(
                                    color: subtleTextColor,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                          Container(width: 1, height: 14, color: dividerBg),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.water_drop,
                                color: Colors.blue,
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${day.maxRainProbability.round()}%',
                                style: TextStyle(
                                  color: Colors.blue,
                                  fontSize: 12,
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
            }).toList(),
          ],
        ],
      ),
    );
  }

  Widget _buildAdminCard() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor =
        isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);

    return Container(
      padding: const EdgeInsets.all(24),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ],
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
                  color: isDark ? Colors.grey[800] : Colors.grey[100],
                  border: Border.all(color: dividerBg, width: 2),
                ),
                child: Icon(
                  Icons.admin_panel_settings_rounded,
                  color: isDark ? Colors.amber[400] : Colors.amber[700],
                  size: 26,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _currentEvent.contactName?.isNotEmpty == true ? _currentEvent.contactName! : 'kermes.default_contact_name'.tr(),
                      style: TextStyle(
                        color: textColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'kermes.contact_questions'.tr(),
                      style: TextStyle(
                        color: subtleTextColor,
                        fontSize: 13,
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
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor =
        isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);

    return Container(
      padding: const EdgeInsets.all(24),
      margin: const EdgeInsets.only(bottom: 32),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ],
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
                    'kermes.contact_title'.tr(),
                    style: TextStyle(
                      color: subtleTextColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                    ),
                  ),
                  Text(
                    'kermes.contact_us'.tr(),
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
                    child: const Icon(Icons.phone,
                        color: Color(0xFF4ADE80), size: 20),
                  ),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'kermes.phone'.tr(),
                        style: TextStyle(
                          color: subtleTextColor,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '+49 163 123 4567',
                        style: TextStyle(
                          color: textColor,
                          fontSize: 15,
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

  Widget _buildCartBar() {
    final cartTotal = _totalPrice;
    final itemCount = _totalItems;

    if (itemCount == 0) {
      return const SizedBox.shrink();
    }

    final accent = lokmaPink;
    final currency = CurrencyUtils.getCurrencySymbol();
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    final cartButton = Material(
      color: accent,
      borderRadius: BorderRadius.circular(28),
      elevation: 4,
      shadowColor: accent.withOpacity(0.4),
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: () {
          HapticFeedback.selectionClick();
          showKermesCheckoutSheet(context, _currentEvent);
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              // Cart icon with badge
              Stack(
                clipBehavior: Clip.none,
                children: [
                  SvgPicture.asset(
                    'assets/images/basket_1.svg',
                    width: 24,
                    height: 24,
                    colorFilter: const ColorFilter.mode(
                      Colors.white,
                      BlendMode.srcIn,
                    ),
                  ),
                  Positioned(
                    top: -6,
                    right: -8,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1A1A1A),
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$itemCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 14),
              // Center text
              Expanded(
                child: Text(
                  _deliveryModeIndex == 1
                      ? 'cart.send_order'.tr()
                      : 'cart.view_cart'.tr(), // Masa vs Stand
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              // Price on right
              Text(
                '${cartTotal.toStringAsFixed(2).replaceAll('.', ',')} $currency',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    return Container(
      margin: EdgeInsets.fromLTRB(16, 0, 16, bottomPadding + 12),
      child: cartButton,
    );
  }

  Widget _buildMenuItem(KermesMenuItem item, int cartQuantity,
      {bool isDark = true}) {
    return KermesMenuItemTile(
      item: item,
      cartQuantity: cartQuantity,
      isMenuOnly: _currentEvent.isMenuOnly,
      onAdd: () => _addToCart(item),
      onTap: () {
        showKermesProductDetailSheet(
          context,
          item: item,
          cartQuantity: cartQuantity,
          eventId: _currentEvent.id,
          eventName: _currentEvent.city,
          isMenuOnly: _currentEvent.isMenuOnly,
          contactName: _currentEvent.contactName,
          onAdd: () => _addToCart(item),
          onRemove: () => _removeFromCart(item),
        );
      },
    );
  }

  IconData _getIconForItem(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('kebap') ||
        lower.contains('adana') ||
        lower.contains('döner')) {
      return Icons.kebab_dining;
    } else if (lower.contains('çorba')) {
      return Icons.soup_kitchen;
    } else if (lower.contains('pide') ||
        lower.contains('lahmacun') ||
        lower.contains('gözleme')) {
      return Icons.local_pizza;
    } else if (lower.contains('baklava') ||
        lower.contains('künefe') ||
        lower.contains('lokum') ||
        lower.contains('kadayıf')) {
      return Icons.cake;
    } else if (lower.contains('çay') ||
        lower.contains('kahve') ||
        lower.contains('salep')) {
      return Icons.coffee;
    } else if (lower.contains('ayran') ||
        lower.contains('limon') ||
        lower.contains('şıra')) {
      return Icons.local_drink;
    } else if (lower.contains('dondurma')) {
      return Icons.icecream;
    } else {
      return Icons.restaurant;
    }
  }
  Widget _buildDynamicBadges(BuildContext context, {CrossAxisAlignment alignment = CrossAxisAlignment.start}) {
    bool isTurkey = false;
    if (widget.currentPosition != null) {
      final lat = widget.currentPosition!.latitude;
      final lng = widget.currentPosition!.longitude;
      if (lat >= 35.8 && lat <= 42.1 && lng >= 25.6 && lng <= 44.8) isTurkey = true;
    }
    final uniqueBadges = <String, KermesBadge>{};
    for (final badgeId in _currentEvent.activeBadgeIds) {
      KermesBadge? badge = _activeBadges![badgeId];
      if (badge == null || !badge.isActive) continue;
      String bName = badge.label.toLowerCase();
      if (bName.contains('tuna') || bName.contains('toros')) {
        if (isTurkey) {
          final torosBadge = _activeBadges!.values.where((b) => b.label.toLowerCase().contains('toros')).firstOrNull;
          if (torosBadge != null) badge = torosBadge;
        } else {
          final tunaBadge = _activeBadges!.values.where((b) => b.label.toLowerCase().contains('tuna')).firstOrNull;
          if (tunaBadge != null) badge = tunaBadge;
        }
      }
      uniqueBadges[badge!.id] = badge;
    }
    return Column(
      crossAxisAlignment: alignment,
      mainAxisSize: MainAxisSize.min,
      children: uniqueBadges.values.map((badge) {
        final bgColor = Color(int.parse(badge.colorHex.replaceFirst('#', '0xFF')));
        final textColor = Color(int.parse(badge.textColorHex.replaceFirst('#', '0xFF')));
        final hasIcon = badge.iconUrl.isNotEmpty;
        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            final badgeLower = badge.label.toLowerCase();
            if (badgeLower.contains('tuna')) {
              BrandInfoSheet.show(context, forcedBrand: 'tuna');
            } else if (badgeLower.contains('toros')) {
              BrandInfoSheet.show(context, forcedBrand: 'toros');
            } else {
              _showBadgeDetailsBottomSheet(badge);
            }
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: EdgeInsets.symmetric(horizontal: hasIcon ? 4 : 14, vertical: hasIcon ? 4 : 6),
            decoration: BoxDecoration(
              color: hasIcon ? Colors.transparent : bgColor,
              borderRadius: BorderRadius.circular(50),
              border: hasIcon ? null : Border.all(color: Colors.white24, width: 0.5),
              boxShadow: hasIcon ? null : [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 4, offset: const Offset(0, 2))],
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
                      placeholder: (context, url) => Container(color: Colors.transparent, height: 33, width: 33),
                      errorWidget: (context, url, error) => Icon(Icons.verified, color: textColor, size: 24),
                    ),
                  )
                else ...[
                  Icon(Icons.verified, color: textColor, size: 15),
                  const SizedBox(width: 6),
                  Text(badge.label.toUpperCase(), style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.8)),
                  const SizedBox(width: 8),
                  Icon(Icons.info_outline, color: textColor.withOpacity(0.8), size: 16),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _KermesCategoryHeaderDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;

  _KermesCategoryHeaderDelegate({required this.child});

  @override
  double get minExtent => 52.0;

  @override
  double get maxExtent => 52.0;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return child;
  }

  @override
  bool shouldRebuild(_KermesCategoryHeaderDelegate oldDelegate) {
    return oldDelegate.child != child;
  }

}
