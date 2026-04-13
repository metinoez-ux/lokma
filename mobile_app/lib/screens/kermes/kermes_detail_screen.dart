import '../../utils/currency_utils.dart';
import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:math' as math;
import 'dart:ui';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/data/kermes_menu_templates.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/providers/kermes_category_provider.dart';
import 'package:lokma_app/screens/kermes/kermes_checkout_sheet.dart';
import 'package:lokma_app/screens/kermes/kermes_customization_sheet.dart';
import 'package:lokma_app/screens/kermes/kermes_parking_screen.dart';
import 'package:lokma_app/screens/kermes/kermes_product_detail_sheet.dart';
import 'package:lokma_app/services/kermes_badge_service.dart';
import 'package:lokma_app/services/kermes_feature_service.dart';
import 'package:lokma_app/services/weather_service.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';

// Tailwind Colors mapped from HTML
const Color primaryRuby = Color(0xFFD32F2F);
const Color accentRuby = Color(0xFFB71C1C);
const Color lightText = Color(0xFFF3F4F6);

class KermesDetailScreen extends ConsumerStatefulWidget {
  final KermesEvent event;
  final Position? currentPosition;

  const KermesDetailScreen({
    super.key,
    required this.event,
    this.currentPosition,
  });

  @override
  ConsumerState<KermesDetailScreen> createState() => _KermesDetailScreenState();
}

class _KermesDetailScreenState extends ConsumerState<KermesDetailScreen> {
  static const Color lokmaPink = Color(0xFFEA184A);
  WeatherForecast? _weatherForecast;
  CurrentWeather? _currentWeather;
  bool _isLoadingWeather = true;
  List<KermesFeature> _globalFeatures = [];
  Map<String, KermesBadge> _activeBadges = {};

  // Realtime event document listener
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _eventSubscription;
  KermesEvent? _liveEvent;
  KermesEvent get _currentEvent => _liveEvent ?? widget.event;

  // Realtime products listener
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _productsSubscription;
  List<KermesMenuItem>? _liveMenu;

String _selectedCategory = '';

  // Scroll spy controller and keys
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _sectionKeys = {};
  final Map<String, GlobalKey> _tabKeys = {};
  bool _isUserScrolling = true;

  // Chip ScrollController
  final ScrollController _chipScrollController = ScrollController();

  // Sliding pill indicator state
  double _pillLeft = 0;
  double _pillWidth = 60;
    bool _isFavorite = false;
  bool _pillInitialized = false;
  final GlobalKey _chipRowKey = GlobalKey();

  // Delivery mode toggle
  late int _deliveryModeIndex;

  // Search
  bool _showSearchBar = false;
  String _menuSearchQuery = '';

  List<({int absoluteIndex, String title, IconData icon, String subtitle})>
      get _availableModes {
    if (_currentEvent.isMenuOnly) return [];
    final modes =
        <({int absoluteIndex, String title, IconData icon, String subtitle})>[];
    if (_currentEvent.hasDelivery) {
      modes.add((
        absoluteIndex: 0,
        title: 'Evine',
        icon: Icons.delivery_dining,
        subtitle: 'gelsin'
      ));
    }
    if (_currentEvent.hasTakeaway) {
      modes.add((
        absoluteIndex: 1,
        title: 'Gel Al',
        icon: Icons.shopping_bag_outlined,
        subtitle: 'Sıra bekleme'
      ));
    }
    if (_currentEvent.hasDineIn) {
      modes.add((
        absoluteIndex: 2,
        title: '(Masa)',
        icon: Icons.restaurant,
        subtitle: 'Kermeste ye'
      ));
    }
    return modes;
  }

  @override
  void initState() {
    super.initState();
    _fetchLiveWeather();
    _loadGlobalFeatures();
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
  }

  @override
  void dispose() {
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

  Future<void> _fetchLiveWeather() async {
    try {
      // Tahmin ve anlık hava durumunu paralel cek
      final results = await Future.wait([
        WeatherService.getForecast(lat: _currentEvent.latitude, lon: _currentEvent.longitude),
        WeatherService.getCurrentWeather(lat: _currentEvent.latitude, lon: _currentEvent.longitude),
      ]);
      final forecast = results[0] as WeatherForecast?;
      CurrentWeather? current = results[1] as CurrentWeather?;

      // Fallback: API limit asildiysa, forecast'ten anlik hava durumunu turet
      if (current == null && forecast != null && forecast.hourlyForecasts.isNotEmpty) {
        final now = DateTime.now();
        final nearest = forecast.hourlyForecasts.reduce((a, b) =>
          (a.dateTime.difference(now).abs() < b.dateTime.difference(now).abs()) ? a : b
        );
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
          _currentEvent.latitude,
          _currentEvent.longitude,
        ) /
        1000;
  }

  Future<void> _openMaps() async {
    final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=${_currentEvent.latitude},${_currentEvent.longitude}');
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

void _onMenuScroll() {
    if (!_isUserScrolling || _menuSearchQuery.isNotEmpty) return;

    if (_scrollController.hasClients && _scrollController.offset < 10) {
      if (_selectedCategory != 'marketplace.category_all'.tr()) {
        HapticFeedback.selectionClick();
        setState(() => _selectedCategory = 'marketplace.category_all'.tr());
        Future.delayed(const Duration(milliseconds: 50), () {
          if (mounted) {
            _scrollChipBarToSelected('marketplace.category_all'.tr());
            _updatePillPosition('marketplace.category_all'.tr());
          }
        });
      }
      return;
    }

    String? visibleCategory;
    for (var entry in _sectionKeys.entries) {
      final key = entry.value;
      if (key.currentContext != null) {
        final RenderBox? box =
            key.currentContext!.findRenderObject() as RenderBox?;
        if (box != null) {
          final position = box.localToGlobal(Offset.zero,
              ancestor: context.findRenderObject());
          if (position.dy > 150 && position.dy < 400) {
            visibleCategory = entry.key;
            break;
          }
        }
      }
    }

    if (visibleCategory != null && visibleCategory != _selectedCategory) {
      HapticFeedback.selectionClick();
      setState(() {
        _selectedCategory = visibleCategory!;
      });
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
    final category = cat ?? _selectedCategory;
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
      setState(() {
        _pillLeft = chipPos.dx;
        _pillWidth = chipBox.size.width;
        _pillInitialized = true;
      });
    }
  }

  void _selectCategory(String category) {
    if (_selectedCategory == category) return;
    setState(() => _selectedCategory = category);
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
              images: (p['images'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
              note: (p['note']?.toString().isNotEmpty == true) ? p['note'].toString() : null,
              latitude: (p['lat'] as num?)?.toDouble(),
              longitude: (p['lng'] as num?)?.toDouble(),
            ));
          }
        }
      }
      
      // Parse coordinates
      double lat = widget.event.latitude;
      double lng = widget.event.longitude;
      if (data['latitude'] is num) lat = (data['latitude'] as num).toDouble();
      if (data['longitude'] is num) lng = (data['longitude'] as num).toDouble();
      
      final e = widget.event;
      final prev = _liveEvent;
      if (fullAddress != (prev?.address ?? e.address) ||
          city != (prev?.city ?? e.city) ||
          postalCode != (prev?.postalCode ?? e.postalCode) ||
          lat != (prev?.latitude ?? e.latitude) ||
          lng != (prev?.longitude ?? e.longitude) ||
          parkingList.length != (prev?.parking ?? e.parking).length) {
        setState(() {
          _liveEvent = KermesEvent(
            id: e.id,
            city: city,
            postalCode: postalCode,
            country: data['country']?.toString() ?? e.country,
            state: data['state']?.toString() ?? e.state,
            title: data['name']?.toString() ?? data['title']?.toString() ?? e.title,
            address: fullAddress,
            phoneNumber: e.phoneNumber,
            startDate: e.startDate,
            endDate: e.endDate,
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
            generalParkingNote: data['generalParkingNote']?.toString() ?? e.generalParkingNote,
            activeBadgeIds: (data['activeBadgeIds'] as List<dynamic>?)?.map((x) => x.toString()).toList() ?? e.activeBadgeIds,
            acceptsDonations: data['acceptsDonations'] == true,
            selectedDonationFundId: data['selectedDonationFundId']?.toString() ?? e.selectedDonationFundId,
            selectedDonationFundName: data['selectedDonationFundName']?.toString() ?? e.selectedDonationFundName,
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

  void _addToCart(KermesMenuItem item) {
    HapticFeedback.lightImpact();
    
    if (_currentEvent.isMenuOnly) {
       _showMenuOnlyDialog();
       return;
    }
    
    // Multi-step: show customization sheet if item has option groups
    if (item.isComboMenu) {
      showModalBottomSheet(
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
    final name = _currentEvent.contactName ?? 'Yetkili';
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
                'Sadece Dijital Menü',
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
                'Bu Kermes henüz dijital online sipariş alma imkanı sunmuyor.',
                style: TextStyle(
                    color: Theme.of(dialogContext).brightness == Brightness.dark
                        ? Colors.white70
                        : Colors.black87,
                    fontSize: 15)),
            const SizedBox(height: 12),
            Text(
                'Sorularınız için Kermes Yetkilisine danışabilirsiniz:',
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
                   Icon(Icons.person, size: 20, color: Theme.of(dialogContext).brightness == Brightness.dark ? Colors.white70 : Colors.black54),
                   const SizedBox(width: 8),
                   Expanded(
                     child: Text(
                       '$name\n$phone',
                       style: TextStyle(
                         fontWeight: FontWeight.w600,
                         color: Theme.of(dialogContext).brightness == Brightness.dark ? Colors.white : Colors.black87,
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

  void _showDifferentKermesWarning(KermesMenuItem item) {
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
                'Farklı Kermes Siparişi',
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
                '${_currentEvent.city} kermesinden ürün eklemek için mevcut sepetiniz temizlenecek.',
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
                  item, _currentEvent.id, _currentEvent.city);
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
                  child: CachedNetworkImage(
                    imageUrl: badge.iconUrl,
                    height: 80,
                    fit: BoxFit.contain,
                    placeholder: (context, url) =>
                        const SizedBox(height: 80, child: Center(child: CircularProgressIndicator())),
                    errorWidget: (context, url, error) =>
                        const SizedBox(height: 80, child: Icon(Icons.verified, size: 60, color: Colors.grey)),
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
                  'Bu kermes ${badge.label} onaylı ürünler ve sertifikalı tedarikçiler ile çalışmaktadır.',
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
                    backgroundColor: Color(int.parse(badge.colorHex.replaceFirst('#', '0xFF'))),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    'Anladım',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(int.parse(badge.textColorHex.replaceFirst('#', '0xFF'))),
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

  void _shareKermes() {
    HapticFeedback.lightImpact();
    final event = _currentEvent;
    final text = '${event.title}\n${event.startDate.day}.${event.startDate.month}.${event.startDate.year} - ${event.endDate.day}.${event.endDate.month}.${event.endDate.year}\n${event.address}, ${event.postalCode} ${event.city}';
    Share.share(text, subject: event.title);
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
                    (_normalizeForSearch(p.description ?? '').contains(query)) ||
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
                                  color: isDark ? Colors.grey[700]! : Colors.grey[300]!, width: 1.5),
                            ),
                            child: TextField(
                              autofocus: true,
                              cursorColor: lokmaPink,
                              style: TextStyle(color: textColor, fontSize: 16, fontWeight: FontWeight.w500),
                              decoration: InputDecoration(
                                hintText: 'marketplace.search_in_menu'.tr(),
                                hintStyle:
                                    TextStyle(color: hintColor, fontSize: 15, fontWeight: FontWeight.w500),
                                prefixIcon: Icon(Icons.search,
                                    color: isDark ? Colors.grey[300] : Colors.grey[600], size: 22),
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
                                  size: 60,
                                  color: hintColor?.withOpacity(0.5)),
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
                                      final cartQuantity = _getCartQuantity(item);
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
                  width: 36, height: 4,
                  decoration: BoxDecoration(color: handleColor, borderRadius: BorderRadius.circular(2)),
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
              child: Text(tr('marketplace.categories'), style: TextStyle(color: textPrimary, fontSize: 22, fontWeight: FontWeight.w600)),
            ),
            // Category list
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: _categories.length,
                itemBuilder: (context, index) {
                  final catName = _categories[index];
                  final isSelected = _selectedCategory == catName;
                  
                  // Get product names for this category
                  String productPreview = '';
                  final allProducts = _eventMenu;
                  if (catName == 'marketplace.category_all'.tr()) {
                    productPreview = allProducts.take(4).map((p) => p.name).join(', ');
                  } else {
                    final catProducts = allProducts.where((p) => _getCategoryForItem(p) == catName).toList();
                    productPreview = catProducts.take(4).map((p) => p.name).join(', ');
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
                                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                                    fontSize: 17,
                                  ),
                                ),
                                if (productPreview.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    productPreview,
                                    style: TextStyle(color: textSecondary, fontSize: 13),
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
    
if (_selectedCategory.isEmpty) {
      _selectedCategory = 'marketplace.category_all'.tr();
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
      backgroundColor: isDark ? const Color(0xFF2B2929) : const Color(0xFFF9F9F9),
      body: Stack(
        children: [
          CustomScrollView(
            cacheExtent: 10000,
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
                  color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF5F0E8),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    const SizedBox(width: 12),
                    Icon(Icons.search, color: isDark ? Colors.grey[400] : Colors.grey[600], size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _menuSearchQuery.isNotEmpty ? _menuSearchQuery : 'Menude ara...',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: _menuSearchQuery.isNotEmpty ? (isDark ? Colors.white : Colors.black87) : (isDark ? Colors.grey[400] : Colors.grey[600]),
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
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white.withOpacity(0.1) : Colors.black.withOpacity(0.05),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.arrow_back_ios_new, color: isDark ? Colors.white : Colors.black87, size: 18),
                ),
              ),
            ),
            actions: [
              GestureDetector(
                onTap: () => _shareKermes(),
                child: Icon(Icons.share_outlined, color: isDark ? Colors.white : Colors.black87, size: 22),
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
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                child: _buildFeaturesRow(),
              ),
            ),

          // Menu ve Siparis Card
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: GestureDetector(
                onTap: () {
                  // Scroll to first category
                  if (_categoriesWithoutAll.isNotEmpty) {
                    _selectCategory(_categoriesWithoutAll.first);
                  }
                },
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        // Background image
                        _currentEvent.menu.isNotEmpty && _currentEvent.menu.first.allImages.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: _currentEvent.menu.first.allImages.first,
                              fit: BoxFit.cover,
                            )
                          : Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [const Color(0xFF2D1B00), const Color(0xFF1A0E00)],
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
                        // Populer badge
                        Positioned(
                          top: 16,
                          right: 16,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: primaryRuby.withOpacity(0.9),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.star, color: Colors.white, size: 12),
                                SizedBox(width: 4),
                                Text('POPULER', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
                              ],
                            ),
                          ),
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
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(width: 6, height: 6, decoration: BoxDecoration(color: primaryRuby, shape: BoxShape.circle)),
                                        const SizedBox(width: 8),
                                        Text('LEZZET SOLENI', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2)),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    const Text('Menu ve Siparis', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold, height: 1.1)),
                                    const SizedBox(height: 4),
                                    Text('Kebaplar, tatlilar ve sokak lezzetlerini kesfet.', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
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
                                child: const Icon(Icons.arrow_forward, color: Colors.white, size: 20),
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
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
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
                      Row(
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
                                  if (_pillInitialized)
                                    AnimatedPositioned(
                                      duration: const Duration(milliseconds: 400),
                                      curve: Curves.easeOutBack,
                                      left: _pillLeft,
                                      top: 0,
                                      bottom: 0,
                                      child: AnimatedContainer(
                                        duration: const Duration(milliseconds: 400),
                                        curve: Curves.easeOutBack,
                                        width: _pillWidth,
                                        decoration: BoxDecoration(
                                          color: isDark
                                              ? Colors.white
                                              : const Color(0xFF3E3E3F),
                                          borderRadius: BorderRadius.circular(50),
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
                                      _tabKeys.putIfAbsent(category, () => GlobalKey());
                                      final isSelected = category == _selectedCategory;

                                      return Padding(
                                        padding: const EdgeInsets.only(right: 6),
                                        child: GestureDetector(
                                          onTap: () {
                                            HapticFeedback.selectionClick();
                                            _selectCategory(category);
                                          },
                                          child: Container(
                                            key: _tabKeys[category],
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 16, vertical: 7),
                                            decoration: BoxDecoration(
                                              color: Colors.transparent,
                                              borderRadius: BorderRadius.circular(50),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                AnimatedDefaultTextStyle(
                                                  duration: const Duration(milliseconds: 300),
                                                  curve: Curves.easeOutCubic,
                                                  style: TextStyle(
                                                    color: isSelected
                                                        ? (isDark ? Colors.black : Colors.white)
                                                        : (isDark ? Colors.white70 : Colors.black54),
                                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                                    fontSize: 14,
                                                  ),
                                                  child: Text(category),
                                                ),
                                                // Cart count badge
                                                Builder(builder: (context) {
                                                  final kermesCart = ref.watch(kermesCartProvider);
                                                  final catCartCount = category == 'Alle'
                                                      ? kermesCart.totalItems
                                                      : kermesCart.items
                                                          .where((ci) => ci.menuItem.category == category)
                                                          .fold<int>(0, (sum, ci) => sum + ci.quantity);
                                                  if (catCartCount <= 0) return const SizedBox.shrink();
                                                  return Padding(
                                                    padding: const EdgeInsets.only(left: 6),
                                                    child: AnimatedContainer(
                                                      duration: const Duration(milliseconds: 300),
                                                      curve: Curves.easeOutBack,
                                                      width: 20,
                                                      height: 20,
                                                      decoration: BoxDecoration(
                                                        color: isSelected
                                                            ? (isDark ? Colors.black87 : Colors.white)
                                                            : Colors.red,
                                                        shape: BoxShape.circle,
                                                      ),
                                                      alignment: Alignment.center,
                                                      child: Text(
                                                        '$catCartCount',
                                                        style: TextStyle(
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.w600,
                                                          color: isSelected
                                                              ? (isDark ? Colors.white : Colors.black87)
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
                              padding: const EdgeInsets.only(right: 12, left: 2),
                              child: Icon(
                                Icons.format_list_bulleted,
                                color: isDark ? Colors.white70 : Colors.black54,
                                size: 22,
                              ),
                            ),
                          ),
                        ],
                      ),
                    Divider(height: 1, thickness: 0.5, color: isDark ? Colors.white.withOpacity(0.1) : Colors.grey[300]),
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
                        color: isDark ? Colors.grey[700] : Colors.grey[400]),
                    const SizedBox(height: 16),
                    Text(
                      'Menüde ürün bulunmuyor',
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
                          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  category,
                                  style: TextStyle(
                                    color: isDark ? lokmaPink : Colors.black87,
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
                                    color:
                                        isDark ? Colors.white : Colors.black87,
                                    shape: BoxShape.circle,
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    '$catCartCount',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color:
                                          isDark ? Colors.black : Colors.white,
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
            ],  // slivers end
          ),  // CustomScrollView end
        ],  // Stack children end
      ),  // Stack end
      bottomNavigationBar: (_totalItems > 0 && !_currentEvent.isMenuOnly)
          ? _buildCartBar()
          : null,
    );
  }

  String _getCountryFlag(String country) {
    final lower = country.toLowerCase()
        .replaceAll('\u0131', 'i') // ı -> i
        .replaceAll('\u00fc', 'u') // ue -> u
        .replaceAll('\u00f6', 'o') // oe -> o
        .replaceAll('\u015f', 's') // s-cedilla -> s
        .replaceAll('\u00e7', 'c') // c-cedilla -> c
        .replaceAll('\u011f', 'g'); // g-breve -> g
    if (lower.contains('avusturya') || lower.contains('austria') || lower.contains('osterreich') || lower == 'at') return '\u{1F1E6}\u{1F1F9}';
    if (lower.contains('sirbistan') || lower.contains('serbia') || lower.contains('serbien') || lower == 'rs') return '\u{1F1F7}\u{1F1F8}';
    if (lower.contains('bulgaristan') || lower.contains('bulgaria') || lower.contains('bulgarien') || lower == 'bg') return '\u{1F1E7}\u{1F1EC}';
    if (lower.contains('turkiye') || lower.contains('turkey') || lower.contains('turkei') || lower == 'tr') return '\u{1F1F9}\u{1F1F7}';
    if (lower.contains('hollanda') || lower.contains('netherlands') || lower.contains('niederlande') || lower == 'nl') return '\u{1F1F3}\u{1F1F1}';
    if (lower.contains('fransa') || lower.contains('france') || lower.contains('frankreich') || lower == 'fr') return '\u{1F1EB}\u{1F1F7}';
    if (lower.contains('belcika') || lower.contains('belgium') || lower.contains('belgien') || lower == 'be') return '\u{1F1E7}\u{1F1EA}';
    if (lower.contains('isvicre') || lower.contains('switzerland') || lower.contains('schweiz') || lower == 'ch') return '\u{1F1E8}\u{1F1ED}';
    if (lower.contains('macaristan') || lower.contains('hungary') || lower.contains('ungarn') || lower == 'hu') return '\u{1F1ED}\u{1F1FA}';
    return '\u{1F1E9}\u{1F1EA}'; // Varsayilan Almanya
  }

Widget _buildHeroSection(BuildContext context) {
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
          _currentEvent.headerImage != null && _currentEvent.headerImage!.isNotEmpty
              ? CachedNetworkImage(
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
                  Colors.black,
                  Colors.black.withOpacity(0.3),
                  Colors.transparent,
                ],
              ),
            ),
          ),

          // Top Action Buttons
          Positioned(
            top: 12,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildGlassButton(Icons.arrow_back, () => Navigator.pop(context)),
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
                      color: _isFavorite ? const Color(0xFFE50055) : Colors.white,
                    ),
                    const SizedBox(width: 12),
                    _buildGlassButton(Icons.share, () => _shareKermes()),
                  ],
                ),
              ],
            ),
          ),

          // Dynamic Sponsor / Certificate Badges
          if (_currentEvent.activeBadgeIds.isNotEmpty && _activeBadges != null)
            Positioned(
              top: 56,
              left: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: _currentEvent.activeBadgeIds.map((badgeId) {
                  final badge = _activeBadges![badgeId];
                  if (badge == null || !badge.isActive) return const SizedBox.shrink();

                  final bgColor = Color(int.parse(badge.colorHex.replaceFirst('#', '0xFF')));
                  final textColor = Color(int.parse(badge.textColorHex.replaceFirst('#', '0xFF')));

                  final hasIcon = badge.iconUrl.isNotEmpty;

                  return GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      _showBadgeDetailsBottomSheet(badge);
                    },
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: EdgeInsets.symmetric(
                                      horizontal: hasIcon ? 4 : 14, vertical: hasIcon ? 4 : 6),
                      decoration: BoxDecoration(
                        color: hasIcon ? Colors.transparent : bgColor,
                        borderRadius: BorderRadius.circular(50),
                        border: hasIcon ? null : Border.all(color: Colors.white24, width: 0.5),
                        boxShadow: hasIcon ? null : [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (hasIcon)
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.25),
                                    blurRadius: 6,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.all(3),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(24),
                                child: CachedNetworkImage(
                                  imageUrl: badge.iconUrl,
                                  height: 48, // Detay sayfasinda biraz daha buyuk
                                  width: 48,
                                  fit: BoxFit.contain,
                                  placeholder: (context, url) => Container(
                                    color: Colors.transparent,
                                    height: 48,
                                    width: 48,
                                  ),
                                  errorWidget: (context, url, error) =>
                                      Icon(Icons.verified, color: textColor, size: 24),
                                ),
                              ),
                            )
                          else ...[
                            Icon(Icons.verified, color: textColor, size: 15),
                            const SizedBox(width: 6),
                            Text(
                              badge.label.toUpperCase(),
                              style: TextStyle(
                                color: textColor,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Icon(
                              Icons.info_outline,
                              color: textColor.withOpacity(0.8),
                              size: 16,
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }).toList(),
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
                        _currentEvent.city.toUpperCase(),
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
                      '${_currentEvent.country.split(' ').first} ${_getCountryFlag(_currentEvent.country)}',
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
                  _currentEvent.title,
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
                    Builder(
                      builder: (context) {
                        final now = DateTime.now();
                        final start = _currentEvent.startDate;
                        final end = _currentEvent.endDate;
                        String countdownText;
                        if (now.isBefore(start)) {
                          final days = start.difference(now).inDays;
                          if (days == 0) {
                            countdownText = 'BUGÜN BASLIYOR!';
                          } else if (days == 1) {
                            countdownText = 'YARIN BASLIYOR!';
                          } else {
                            countdownText = 'BASLAMASINA $days G\u00dcN';
                          }
                        } else if (now.isAfter(end)) {
                          countdownText = 'KERMES SONA ERDI';
                        } else {
                          final days = end.difference(now).inDays;
                          if (days == 0) {
                            countdownText = 'SON G\u00dcN!';
                          } else if (days == 1) {
                            countdownText = 'YARIN SONA ERIYOR';
                          } else {
                            countdownText = 'BITMESINE $days G\u00dcN';
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
                                      '${_currentEvent.startDate.day}.${_currentEvent.startDate.month} - ${_currentEvent.endDate.day}.${_currentEvent.endDate.month}.${_currentEvent.endDate.year}',
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

  Widget _buildGlassButton(IconData icon, VoidCallback onTap, {Color color = Colors.white}) {
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
                   if (f.iconUrl != null && f.iconUrl!.isNotEmpty) ...[
                     CachedNetworkImage(
                       imageUrl: f.iconUrl!,
                       width: 14,
                       height: 14,
                     ),
                     const SizedBox(width: 8),
                   ] else if (f.icon.isNotEmpty) ...[
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
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
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
                            '${_currentEvent.city}, ${_currentEvent.country.split(' ').first}',
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
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
                  const SizedBox(height: 6),
                  Text(
                    '${(_distanceKm * 2.5 + 3).ceil()} Dk.',
                    style: TextStyle(
                      color: subtleTextColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  )
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            [
              if (_currentEvent.address.isNotEmpty) _currentEvent.address,
              if (_currentEvent.postalCode.isNotEmpty || _currentEvent.city.isNotEmpty)
                '${_currentEvent.postalCode} ${_currentEvent.city}'.trim(),
              if (_currentEvent.state?.isNotEmpty == true) _currentEvent.state!,
              if (_currentEvent.country.isNotEmpty) _currentEvent.country,
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
                      children: const [
                        Icon(Icons.navigation, color: Colors.white, size: 16),
                        SizedBox(width: 6),
                        Text(
                          'Yol Tarifi',
                          style: TextStyle(
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
                        builder: (_) => KermesParkingScreen(event: _currentEvent),
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
                          Icon(Icons.local_parking, color: const Color(0xFF2196F3), size: 16),
                          const SizedBox(width: 6),
                          Text(
                            'Park Bilgisi',
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
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

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

  /// OpenWeatherMap ikon kodunu Flutter Material ikona cevirir
  Widget _weatherIcon(String iconCode, {double size = 28, Color? color}) {
    IconData icon;
    Color iconColor;
    switch (iconCode.substring(0, 2)) {
      case '01': // clear sky
        icon = iconCode.endsWith('n') ? Icons.nightlight_round : Icons.wb_sunny_rounded;
        iconColor = color ?? (iconCode.endsWith('n') ? Colors.blueGrey : Colors.amber);
        break;
      case '02': // few clouds
        icon = iconCode.endsWith('n') ? Icons.nights_stay_rounded : Icons.cloud_queue_rounded;
        iconColor = color ?? (iconCode.endsWith('n') ? Colors.blueGrey : Colors.amber.shade700);
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
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Kermes Yetkilisi Top Section
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
                        _currentEvent.contactName ?? 'Kermes Yetkilisi',
                        style: TextStyle(
                          color: textColor,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Sorularınız için iletişime geçebilirsiniz.',
                        style: TextStyle(
                          color: subtleTextColor,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Bize Ulaşın Bottom Section
          Padding(
            padding: const EdgeInsets.only(left: 24, right: 24, bottom: 24),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.03),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.phone, color: Colors.green, size: 20),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Telefon',
                          style: TextStyle(
                            color: subtleTextColor,
                            fontSize: 12,
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
    final subtleTextColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    final dividerBg = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);
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
                  width: 40, height: 40,
                  decoration: BoxDecoration(color: dividerBg, shape: BoxShape.circle),
                  child: const Icon(Icons.wb_sunny, color: Colors.amber, size: 20),
                ),
                const SizedBox(width: 12),
                Text('Hava durumu yukleniyor...', style: TextStyle(color: subtleTextColor, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 16),
            LinearProgressIndicator(color: accentBlue, backgroundColor: dividerBg),
          ],
        ),
      );
    }

    final now = DateTime.now();
    final start = _currentEvent.startDate;
    final end = _currentEvent.endDate;

    // Etkinlik gunleri icin filtrelenecek
    final dailySummaries = _weatherForecast?.getDailySummaries() ?? [];
    
    // Sadece etkinlik gunlerine denk gelen tahminleri filtrele
    final eventDailySummaries = dailySummaries.where((day) {
      final dayDate = DateTime(day.date.year, day.date.month, day.date.day);
      final startDate = DateTime(start.year, start.month, start.day);
      final endDate = DateTime(end.year, end.month, end.day);
      return !dayDate.isBefore(startDate) && !dayDate.isAfter(endDate);
    }).toList();

    // Bugunun saatlik tahminleri (etkinlik suresi icindeyse)
    final todayHourly = _weatherForecast?.getHourlyForDay(now) ?? [];
    final isEventDay = !now.isBefore(DateTime(start.year, start.month, start.day)) && 
                       !now.isAfter(DateTime(end.year, end.month, end.day));

    // Hava durumu bulunabilir mi?
    final hasForecast = eventDailySummaries.isNotEmpty;

    // Kermesin kacinci gunu
    int _getEventDayNumber(DateTime date) {
      return DateTime(date.year, date.month, date.day)
          .difference(DateTime(start.year, start.month, start.day)).inDays + 1;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
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
                  width: 58, height: 58,
                  child: Stack(
                    children: [
                      // Arka plan daire
                      Container(
                        width: 58, height: 58,
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
                        top: 0, right: 0,
                        child: Container(
                          width: 22, height: 22,
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: _weatherIcon(_currentWeather!.icon, size: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  width: 40, height: 40,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(colors: [Colors.amber, Colors.orange]),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.wb_sunny_rounded, color: Colors.white, size: 20),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'KERMES ALANI HAVA DURUMU',
                      style: TextStyle(
                        color: subtleTextColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${_currentEvent.city} - Etkinlik Günleri Tahmini',
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
                  Icon(Icons.cloud_off_outlined, color: subtleTextColor, size: 40),
                  const SizedBox(height: 12),
                  Text(
                    'Hava durumu henuz mevcut degil',
                    style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    now.isBefore(start)
                      ? 'Etkinlik yaklaştıkca hava durumu burada görünecek. Tahminler genellikle 5 gün öncesinden itibaren mevcut olur.'
                      : 'Kermes alani icin hava durumu verisi alinamadi.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: subtleTextColor, fontSize: 12, height: 1.5),
                  ),
                ],
              ),
            ),
          ],

          // ======= BUGUNUN SAATLIK TAHMINI =======
          if (hasForecast && isEventDay && todayHourly.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(
              children: [
                Text(
                  'BUGÜN',
                  style: TextStyle(color: subtleTextColor, fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1.2),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Kermesin ${_getEventDayNumber(now)}. Günü',
                    style: const TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                ),
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
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                    decoration: BoxDecoration(
                      color: isNow ? accentBlue.withOpacity(0.15) : dividerBg,
                      borderRadius: BorderRadius.circular(14),
                      border: isNow ? Border.all(color: accentBlue.withOpacity(0.4), width: 1.5) : null,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Text(
                          isNow ? 'Simdi' : '${h.dateTime.hour.toString().padLeft(2, '0')}:00',
                          style: TextStyle(
                            color: isNow ? accentBlue : subtleTextColor,
                            fontSize: 11,
                            fontWeight: isNow ? FontWeight.w700 : FontWeight.w500,
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
              'ETKİNLİK GÜNLERİ',
              style: TextStyle(color: subtleTextColor, fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1.2),
            ),
            const SizedBox(height: 12),
            ...eventDailySummaries.map((day) {
              final dayNum = _getEventDayNumber(day.date);
              final isToday = day.date.year == now.year && day.date.month == now.month && day.date.day == now.day;
              
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isToday ? accentBlue.withOpacity(0.08) : dividerBg,
                  borderRadius: BorderRadius.circular(16),
                  border: isToday ? Border.all(color: accentBlue.withOpacity(0.3)) : null,
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
                                    style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    _getTurkishDayName(day.date),
                                    style: TextStyle(color: subtleTextColor, fontSize: 13, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: isToday ? Colors.green.withOpacity(0.15) : Colors.orange.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      isToday ? 'Bugün - ${dayNum}. Gün' : '${dayNum}. Gün',
                                      style: TextStyle(
                                        color: isToday ? Colors.green : Colors.orange,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    day.description,
                                    style: TextStyle(color: subtleTextColor, fontSize: 12, fontWeight: FontWeight.w500),
                                    overflow: TextOverflow.ellipsis,
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
                                  style: TextStyle(color: textColor, fontSize: 20, fontWeight: FontWeight.w800),
                                ),
                                Text(
                                  '${day.minTemperature.round()}°',
                                  style: TextStyle(color: subtleTextColor, fontSize: 13, fontWeight: FontWeight.w500),
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
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white.withOpacity(0.03) : Colors.black.withOpacity(0.03),
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
                                style: TextStyle(color: subtleTextColor, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                          Container(width: 1, height: 14, color: dividerBg),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.water_drop,
                                color: day.maxRainProbability > 50 ? Colors.blue : subtleTextColor,
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${day.maxRainProbability.round()}%',
                                style: TextStyle(
                                  color: day.maxRainProbability > 50 ? Colors.blue : subtleTextColor,
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
                          _currentEvent.contactName ?? 'Kermes Yetkilisi',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                    const SizedBox(height: 4),
                    Text(
                      'Sorulariniz icin iletisime gecebilirsiniz.',
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
                  const Icon(Icons.shopping_basket,
                      color: Colors.white, size: 24),
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
    final hasImage = item.imageUrl != null && item.imageUrl!.isNotEmpty;
    final isAvailable = item.isAvailable;
    final isSoldOut = !isAvailable;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    final accent = lokmaPink;

    // The ADD button or count badge (business_detail_screen pattern)
    final bool inCart = cartQuantity > 0;

    // + button with image overlay (36px) or standalone (44px)
    Widget buildAddButton({required double size}) {
      if (_currentEvent.isMenuOnly) return const SizedBox.shrink();
      return GestureDetector(
        onTap: isAvailable
            ? () {
                HapticFeedback.mediumImpact();
                _addToCart(item);
              }
            : null,
        child: inCart
            ? Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white : Colors.black87,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.15),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '$cartQuantity',
                  style: TextStyle(
                    color: isDark ? Colors.black : Colors.white,
                    fontSize: size == 36 ? 14 : 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              )
            : Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black
                          .withOpacity(size == 36 ? 0.1 : 0.05),
                      blurRadius: size == 36 ? 6 : 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.add,
                  color: accent,
                  size: size == 36 ? 20 : 24,
                ),
              ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Opacity(
          opacity: isAvailable ? 1.0 : 0.55,
          child: InkWell(
            onTap: isAvailable
                ? () {
                    HapticFeedback.selectionClick();
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
                  }
                : null,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 16),
              color: Colors.transparent,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Product Info (Left)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title
                        Text(
                          item.name,
                          style: TextStyle(
                            color: isAvailable ? textColor : subtleTextColor,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            height: 1.2,
                            letterSpacing: -0.2,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (isSoldOut) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.orange.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'marketplace.sold_out'.tr(),
                              style: const TextStyle(
                                color: Colors.orange,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        if (item.isComboMenu && !isSoldOut) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(Icons.tune_rounded, size: 13, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                              const SizedBox(width: 4),
                              Text(
                                'Secenekli',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w500,
                                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 6),
                        // Description
                        if (item.description != null &&
                            item.description!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10.0),
                            child: Text(
                              item.description!,
                              style: TextStyle(
                                color: isDark ? Colors.grey[400] : Colors.grey[600],
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                                height: 1.3,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        const SizedBox(height: 2),
                        // Price (with discount support)
                        if (item.isDiscounted) ...[
                          Row(
                            children: [
                              Text(
                                '${item.price.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                                style: TextStyle(
                                  color: subtleTextColor,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  decoration: TextDecoration.lineThrough,
                                  decorationColor: subtleTextColor,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${item.discountPrice!.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ] else
                          Text(
                            '${item.price.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                            style: TextStyle(
                              color: isAvailable ? textColor : subtleTextColor,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),

                  // Image & Add Button (Right) - business_detail_screen pattern
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (hasImage)
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                width: 100,
                                height: 100,
                                color:
                                    isDark ? Colors.white10 : Colors.grey[100],
                                child: CachedNetworkImage(
                                  imageUrl: item.imageUrl!,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => Icon(
                                    _getIconForItem(item.name),
                                    size: 40,
                                    color: isDark
                                        ? Colors.white24
                                        : Colors.grey[400],
                                  ),
                                ),
                              ),
                            ),
                            // + button overlay: bottom-right corner
                            if (isAvailable)
                              Positioned(
                                right: -4,
                                bottom: -4,
                                child: buildAddButton(size: 36),
                              ),
                          ],
                        )
                      else if (isAvailable)
                        buildAddButton(size: 44),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        // Separator Line (business_detail_screen pattern)
        Divider(
          height: 1,
          thickness: 0.5,
          color: isDark
              ? Colors.white.withOpacity(0.05)
              : Colors.grey.withOpacity(0.2),
        ),
      ],
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
