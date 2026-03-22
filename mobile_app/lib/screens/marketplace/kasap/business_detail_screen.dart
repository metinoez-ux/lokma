import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:lokma_app/utils/time_utils.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'legal_report_sheet.dart';
import 'package:lokma_app/services/business_deals_service.dart';

import 'package:lokma_app/services/google_places_service.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/product_favorites_provider.dart';
import 'package:lokma_app/models/butcher_product.dart';
import 'package:lokma_app/data/product_catalog_data.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/providers/table_group_provider.dart';
import 'cart_screen.dart';
import 'product_customization_sheet.dart';
import 'reservation_booking_screen.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import '../../../utils/currency_utils.dart';
import 'package:flutter_svg/flutter_svg.dart';

class BusinessDetailScreen extends ConsumerStatefulWidget {
  final String businessId;
  final int initialDeliveryMode;
  final String? initialTableNumber;
  final bool closedAcknowledged;
  final String? groupSessionId;
  
  const BusinessDetailScreen({super.key, required this.businessId, this.initialDeliveryMode = 0, this.initialTableNumber, this.closedAcknowledged = false, this.groupSessionId});

  @override
  ConsumerState<BusinessDetailScreen> createState() => _BusinessDetailScreenState();
}

class _BusinessDetailScreenState extends ConsumerState<BusinessDetailScreen> {
  // Theme-aware colors (resolved in build method)
  // 🎨 BRAND COLOUR: Fallback when no brandColor in Firestore
  static const Color _defaultBrandColor = Color(0xFFFB335B);  // LOKMA brand color
  
  // 🎨 BRAND COLOUR: Get merchant's brand color from Firestore
  // Reads 'brandColor' field (hex string like '#FF5733') from business document
  Color _getAccent(BuildContext context) {
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    
    // 🎨 BRAND COLOUR: Check for brandColor field in Firestore (hex format: #RRGGBB)
    final brandColorHex = data?['brandColor']?.toString();
    if (brandColorHex != null && brandColorHex.isNotEmpty) {
      try {
        // Parse hex color (e.g., "#FF5733" or "FF5733")
        String hex = brandColorHex.replaceAll('#', '');
        if (hex.length == 6) {
          return Color(int.parse('FF$hex', radix: 16));
        }
      } catch (e) {
        // Fall through to defaults if parsing fails
      }
    }
    
    // Check for legacy brand field
    final brand = data?['brand']?.toString().toLowerCase();
    if (brand == 'tuna') {
      return const Color(0xFFFB335B); // 🎨 BRAND COLOUR: TUNA pink/magenta
    } else if (brand == 'akdeniz_toros') {
      return const Color(0xFF1B5E20); // 🎨 BRAND COLOUR: Akdeniz Toros green
    }
    
    // 🎨 BRAND COLOUR: Default fallback
    return _defaultBrandColor;
  }
  
  String _selectedCategory = 'Tümü';

  final Map<String, GlobalKey> _categoryKeys = {};
  final Map<String, GlobalKey> _tabKeys = {};
  bool _isUserScrolling = true;
  final ScrollController _chipScrollController = ScrollController();

  // Sliding pill indicator state
  double _pillLeft = 0;
  double _pillWidth = 60;
  bool _pillInitialized = false;
  final GlobalKey _chipRowKey = GlobalKey();

  // Minimum order banner state
  bool _minOrderReached = false;
  bool _showMinOrderSuccess = false;
  Timer? _minOrderSuccessTimer;

  /// Select a category and scroll to its section
  void _selectCategory(String category) {
    if (_selectedCategory == category) return;
    setState(() => _selectedCategory = category);
    _isUserScrolling = false;
    
    // Auto-scroll the chip bar to show the selected chip fully
    _scrollChipBarToSelected(category);
    
    // Slide the pill to the new chip position
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition(category);
    });
    
    if (category == 'Tümü') {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      }
    } else {
      final key = _categoryKeys[category];
      if (key != null && key.currentContext != null && _scrollController.hasClients) {
        // Calculate the position using RenderBox relative to the scrollable viewport
        final RenderBox? targetBox = key.currentContext!.findRenderObject() as RenderBox?;
        final RenderBox? scrollableBox = context.findRenderObject() as RenderBox?;
        
        if (targetBox != null && scrollableBox != null) {
          final targetPosition = targetBox.localToGlobal(Offset.zero, ancestor: scrollableBox);
          // Offset by current scroll position minus sticky header height (status bar + search bar + category tabs)
          final scrollTarget = _scrollController.offset + targetPosition.dy - 190;
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

  /// Auto-scroll the horizontal chip bar so the selected chip is fully visible and centered
  void _scrollChipBarToSelected(String category) {
    if (!_chipScrollController.hasClients) return;
    final tabKey = _tabKeys[category];
    if (tabKey == null || tabKey.currentContext == null) return;
    
    final RenderBox? chipBox = tabKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null) return;
    
    // Get the chip's position relative to the viewport
    final chipPosition = chipBox.localToGlobal(Offset.zero);
    final chipWidth = chipBox.size.width;
    final screenWidth = MediaQuery.of(context).size.width;
    
    // Calculate where this chip should be scrolled to (centered)
    final chipCenter = chipPosition.dx + chipWidth / 2;
    final viewportCenter = screenWidth / 2;
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

  /// Measure selected chip position and update pill indicator
  void _updatePillPosition([String? cat]) {
    final category = cat ?? _selectedCategory;
    final tabKey = _tabKeys[category];
    if (tabKey?.currentContext == null || _chipRowKey.currentContext == null) return;
    
    final RenderBox? chipBox = tabKey!.currentContext!.findRenderObject() as RenderBox?;
    final RenderBox? rowBox = _chipRowKey.currentContext!.findRenderObject() as RenderBox?;
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

  void _onMenuScroll() {
    if (!_isUserScrolling || _menuSearchQuery.isNotEmpty) return;

    // When scrolled to the very top, always select 'Tümü'
    if (_scrollController.hasClients && _scrollController.offset < 10) {
      if (_selectedCategory != 'Tümü') {
        HapticFeedback.selectionClick();
        setState(() => _selectedCategory = 'Tümü');
        // Delay chip scroll to avoid conflicting with main scroll
        Future.delayed(const Duration(milliseconds: 50), () {
          if (mounted) {
            _scrollChipBarToSelected('Tümü');
            _updatePillPosition('Tümü');
          }
        });
      }
      return;
    }

    String? visibleCategory;

    for (var entry in _categoryKeys.entries) {
      final key = entry.value;
      if (key.currentContext != null) {
        final RenderBox? box = key.currentContext!.findRenderObject() as RenderBox?;
        if (box != null) {
          final position = box.localToGlobal(Offset.zero, ancestor: context.findRenderObject());
          // 200 to 400 is roughly where the sticky header is.
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
      // Delay chip scroll to avoid conflicting with main scroll
      Future.delayed(const Duration(milliseconds: 50), () {
        if (mounted) {
          _scrollChipBarToSelected(visibleCategory!);
          _updatePillPosition(visibleCategory!);
        }
      });
    }
  }
  
  // 🚀 Service Mode (Lieferando-style toggle)
  // 0 = Kurye/Teslimat, 1 = Gel Al/Abholung, 2 = Masa/Dine-in
  late int _deliveryModeIndex;
  bool get _isMasaMode => _deliveryModeIndex == 2;
  bool get _isGroupMode => widget.groupSessionId != null;

  // Masa Pre-Order Prompt state
  bool _masaPreOrderPromptShown = false;
  bool _masaPreOrderEnabled = false; // true = pre-order, false = just browsing
  
  // 🛒 Market-type detection: grid layout for these business types
  static const Set<String> _marketTypes = {
    'kasap', 'market', 'balik', 'sarkuteri', 'kuruyemis', 
    'ciftci', 'petshop', 'kozmetik', 'eticaret',
  };
  
  bool get _isMarketType {
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    if (data == null) return false;
    final type = (data['type'] as String?)?.toLowerCase() ?? '';
    if (_marketTypes.contains(type)) return true;
    // Also check types array
    final types = data['types'];
    if (types is List) {
      return types.any((t) => t is String && _marketTypes.contains(t.toLowerCase()));
    }
    return false;
  }

  // 🔍 Menu Search
  String _menuSearchQuery = '';
  
  // 📜 Scroll Controller for Lieferando-style search bar
  final ScrollController _scrollController = ScrollController();
  bool _showSearchBar = false; // Shows when scrolled past hero
  final TextEditingController _searchController = TextEditingController();
  
  // 🔄 Dynamic categories loaded from Firestore
  List<Map<String, dynamic>> _categories = [
    {'name': 'Tümü', 'icon': Icons.grid_view, 'emoji': '🏠'},
  ];

  Map<String, dynamic>? _placeDetails;
  DocumentSnapshot? _butcherDoc;
  StreamSubscription<DocumentSnapshot>? _businessSubscription;
  bool _closedDialogShown = false;

  // 🆕 Plan features resolved from subscription_plans collection
  Map<String, dynamic> _planFeatures = {};
  
  // Local Cart/Selection State (simple map: sku -> quantity)
  final Map<String, double> _selections = {};
  
  // 🔍 Store all loaded products for instant search
  List<ButcherProduct> _allProducts = [];

  @override
  void initState() {
    super.initState();
    _deliveryModeIndex = widget.initialDeliveryMode;
    _loadButcherAndReviews();
    _setupCategoriesListener(); // 🔄 Real-time listener for categories
    
    // Listen to scroll to show/hide search bar
    _scrollController.addListener(() {
      final shouldShow = _scrollController.offset > 150; // After hero image
      if (shouldShow != _showSearchBar) {
        setState(() => _showSearchBar = shouldShow);
      }
      _onMenuScroll(); // Sync sticky headers
    });
  }

  @override
  void dispose() {
    _businessSubscription?.cancel();
    _chipScrollController.dispose();
    _minOrderSuccessTimer?.cancel();
    super.dispose();
  }
  // 🔄 Real-time subscription for categories
  late final Stream<QuerySnapshot<Map<String, dynamic>>> _categoriesStream;
  
  // 🆕 Helper: Extract localized string from a potentially multi-language name field
  // Handles both String and Map<String, dynamic> (e.g. {tr: 'Dana Eti', de: 'Rindfleisch', en: 'Beef'})
  String _getLocalizedCategoryName(dynamic name) {
    if (name is String) return name;
    if (name is Map) {
      // Try device locale first, then 'tr' fallback, then first available
      String locale = 'tr';
      try {
        locale = context.locale.languageCode;
      } catch (_) {
        // context.locale may not be available yet during initState/early callbacks
      }
      return (name[locale] ?? name['tr'] ?? name.values.firstOrNull ?? 'common.category'.tr()).toString();
    }
    return 'common.category'.tr();
  }
  
  // 🆕 Setup real-time listener for categories from Firestore subcollection
  void _setupCategoriesListener() {
    debugPrint('🔵 [LOKMA] Setting up real-time categories listener for: ${widget.businessId}');
    
    _categoriesStream = FirebaseFirestore.instance
        .collection('businesses')
        .doc(widget.businessId)
        .collection('categories')
        .snapshots();
    
    _categoriesStream.listen((snapshot) {
      debugPrint('🔵 [LOKMA] Categories update received: ${snapshot.docs.length} categories');
      
      if (snapshot.docs.isNotEmpty) {
        final dynamicCategories = <Map<String, dynamic>>[
          {'name': 'Tümü', 'icon': Icons.grid_view, 'emoji': '🏠'},
        ];
        
        // Sort by order field client-side
        final sortedDocs = snapshot.docs.toList()
          ..sort((a, b) => ((a.data()['order'] ?? 0) as int).compareTo((b.data()['order'] ?? 0) as int));
        
        for (final doc in sortedDocs) {
          final data = doc.data();
          debugPrint('🔵 [LOKMA] Category: ${data['name']} - isActive: ${data['isActive']}');
          if (data['isActive'] == true) {
            dynamicCategories.add({
              'id': doc.id,
              'name': _getLocalizedCategoryName(data['name']),
              'emoji': data['icon'] ?? '📦',
              'icon': _getIconFromEmoji(data['icon'] ?? '📦'),
              'order': data['order'] ?? 0,
            });
          }
        }
        
        debugPrint('🔵 [LOKMA] Total active categories: ${dynamicCategories.length}');
        
        if (mounted) {
          setState(() {
            _categories = dynamicCategories;
          });
        }
      } else {
        debugPrint('🟡 [LOKMA] No categories found, using fallback');
        // Fallback to default categories if none exist
        if (mounted) {
          setState(() {
            _categories = [
              {'name': 'Tümü', 'icon': Icons.grid_view, 'emoji': '🏠'},
              {'name': 'Tüm Ürünler', 'icon': Icons.shopping_bag, 'emoji': '🛒'},
            ];
          });
        }
      }
    }, onError: (e) {
      debugPrint('🔴 [LOKMA] Error in categories listener: $e');
    });
  }
  
  // Helper to convert emoji to Material Icon
  IconData _getIconFromEmoji(String emoji) {
    final emojiToIcon = {
      '🥩': Icons.restaurant,
      '🍖': Icons.restaurant_menu,
      '🐄': Icons.restaurant,
      '🐑': Icons.restaurant_menu,
      '🐔': Icons.egg_alt,
      '🍗': Icons.egg_alt,
      '🥓': Icons.inventory_2,
      '🌭': Icons.fastfood,
      '🧀': Icons.breakfast_dining,
      '🥛': Icons.local_drink,
      '🍳': Icons.egg,
      '🥗': Icons.eco,
      '🍞': Icons.bakery_dining,
      '🍕': Icons.local_pizza,
      '🍔': Icons.lunch_dining,
      '🍜': Icons.ramen_dining,
      '⭐': Icons.star,
      '📦': Icons.inventory_2,
      '🛒': Icons.shopping_bag,
      '🏠': Icons.grid_view,
      '🌯': Icons.kebab_dining,
      '🥙': Icons.lunch_dining,
      '🥤': Icons.local_drink,
    };
    return emojiToIcon[emoji] ?? Icons.category;
  }


  void _loadButcherAndReviews() {
    try {
      _businessSubscription = FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.businessId)
          .snapshots()
          .listen((doc) async {
        if (!doc.exists) {
          debugPrint('🔴 [LOKMA] Business document NOT FOUND: ${widget.businessId}');
          return;
        }
        debugPrint('🟢 [LOKMA] Business document loaded: ${widget.businessId}');
        if (mounted) setState(() => _butcherDoc = doc);

        final data = doc.data();
        if (data == null) return;

        // 🆕 Kapalı işletme kontrolü
        // Check if open: openingHours first, then deliveryHours/pickupHours as fallback
        bool isOpen = false;
        if (data['openingHours'] != null) {
          isOpen = OpeningHoursHelper(data['openingHours']).isOpenAt(DateTime.now());
        }
        if (!isOpen && data['deliveryHours'] != null) {
          isOpen = OpeningHoursHelper(data['deliveryHours']).isOpenAt(DateTime.now());
        }
        if (!isOpen && data['pickupHours'] != null) {
          isOpen = OpeningHoursHelper(data['pickupHours']).isOpenAt(DateTime.now());
        }
        // If no hours data at all, default to open
        if (data['openingHours'] == null && data['deliveryHours'] == null && data['pickupHours'] == null) {
          isOpen = true;
        }
        final preOrderEnabled = data['preOrderEnabled'] as bool? ?? false;
        
        if (!isOpen && !_closedDialogShown && !widget.closedAcknowledged) {
          _closedDialogShown = true;
          _showClosedBusinessDialog(preOrderEnabled: preOrderEnabled);
        }

        final googlePlaceId = data['googlePlaceId'] as String?;
        if (_placeDetails == null) {
          try {
            Map<String, dynamic>? details;
            if (googlePlaceId != null && googlePlaceId.isNotEmpty) {
              details = await GooglePlacesService.getPlaceDetails(googlePlaceId);
            } else {
              final bName = data['businessName'] ?? data['companyName'] ?? '';
              final cCity = data['address'] is Map ? (data['address']['city'] ?? '') : '';
              final fAddr = _formatAddress(data['address']);
              if (bName.toString().isNotEmpty) {
                details = await GooglePlacesService.getBusinessDetails(bName, cCity, fullAddress: fAddr);
              }
            }
            if (mounted && details != null) {
              setState(() => _placeDetails = details);
            }
          } catch (e) {
            debugPrint('Google Places Error: $e');
          }
        }

        // 🆕 Resolve plan features from subscription_plans collection
        final planCode = data['subscriptionPlan'] as String? ?? 'basic';
        if (_planFeatures.isEmpty) {
          try {
            final planSnap = await FirebaseFirestore.instance
                .collection('subscription_plans')
                .where('code', isEqualTo: planCode)
                .limit(1)
                .get();
            if (planSnap.docs.isNotEmpty) {
              final planData = planSnap.docs.first.data();
              if (mounted) {
                setState(() => _planFeatures = (planData['features'] as Map<String, dynamic>?) ?? {});
              }
            }
          } catch (e) {
            debugPrint('Error loading plan features: $e');
          }
        }
      }, onError: (e) {
        debugPrint('Error loading data: $e');
      });
    } catch (e) {
      debugPrint('Error loading data: $e');
    }
  }

  // Compact closed-business popup (China-Thai style)
  void _showClosedBusinessDialog({bool preOrderEnabled = false}) {
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    final businessName = data?['businessName'] ?? data?['companyName'] ?? 'common.business'.tr();
    
    // Calculate next opening time
    OpeningHoursHelper openingHelper;
    if (data?['openingHours'] != null) {
      openingHelper = OpeningHoursHelper(data?['openingHours']);
    } else if (data?['deliveryHours'] != null) {
      openingHelper = OpeningHoursHelper(data?['deliveryHours']);
    } else {
      openingHelper = OpeningHoursHelper(data?['pickupHours']);
    }
    final nextOpen = openingHelper.getNextOpenDateTime(DateTime.now());
    String nextOpenText = '';
    if (nextOpen != null) {
      final timeStr = '${nextOpen.hour.toString().padLeft(2, '0')}:${nextOpen.minute.toString().padLeft(2, '0')}';
      final now = DateTime.now();
      final isToday = nextOpen.day == now.day && nextOpen.month == now.month && nextOpen.year == now.year;
      final tomorrow = now.add(const Duration(days: 1));
      final isTomorrow = nextOpen.day == tomorrow.day && nextOpen.month == tomorrow.month && nextOpen.year == tomorrow.year;
      
      if (isToday) {
        nextOpenText = tr('marketplace.opens_today', namedArgs: {'time': timeStr});
      } else if (isTomorrow) {
        nextOpenText = tr('marketplace.opens_tomorrow', namedArgs: {'time': timeStr});
      } else {
        final dayNames = [
          'common.day_monday'.tr(), 'common.day_tuesday'.tr(), 'common.day_wednesday'.tr(),
          'common.day_thursday'.tr(), 'common.day_friday'.tr(), 'common.day_saturday'.tr(), 'common.day_sunday'.tr(),
        ];
        nextOpenText = tr('marketplace.opens_on_day', namedArgs: {'day': dayNames[nextOpen.weekday - 1], 'time': timeStr});
      }
    }
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      
      final accent = _getAccent(context);
      
      showDialog(
        context: context,
        barrierDismissible: true,
        builder: (dialogCtx) {
          return Dialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            insetPadding: const EdgeInsets.symmetric(horizontal: 32),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Title: business name + opens at time
                  Text(
                    nextOpenText.isNotEmpty
                        ? '$businessName\n$nextOpenText'
                        : businessName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                  ),
                  
                  const SizedBox(height: 12),
                  
                  // Subtitle
                  Text(
                    preOrderEnabled
                        ? 'marketplace.closed_but_preorder_short'.tr()
                        : 'marketplace.closed_plan_later'.tr(),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: Theme.of(dialogCtx).colorScheme.onSurface.withValues(alpha: 0.6),
                      height: 1.4,
                    ),
                  ),
                  
                  const SizedBox(height: 20),
                  
                  // Primary CTA: Weiter / Continue
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.pop(dialogCtx),
                      style: FilledButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: Text(
                        'common.continue_button'.tr(),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 8),
                  
                  // Secondary: Find open businesses
                  TextButton(
                    onPressed: () {
                      Navigator.pop(dialogCtx);
                      context.go('/');
                    },
                    child: Text(
                      'marketplace.find_open_businesses'.tr(),
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Theme.of(dialogCtx).colorScheme.onSurface.withValues(alpha: 0.7),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    });
  }

  // 🔍 LIEFERANDO-STYLE: Full-screen search overlay
  void _showMenuSearchOverlay() {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: true,
        pageBuilder: (context, animation, secondaryAnimation) {
          return _MenuSearchPage(
            initialQuery: _menuSearchQuery,
            products: _allProducts,
            businessId: widget.businessId,
            businessName: (_butcherDoc?.data() as Map<String, dynamic>?)?['companyName'] ?? 
                          (_butcherDoc?.data() as Map<String, dynamic>?)?['name'] ?? 'common.butcher'.tr(),
            onSearch: (query) {
              setState(() {
                _menuSearchQuery = query;
                _searchController.text = query;
              });
            },
          );
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 200),
      ),
    );
  }

  // --- Helper Methods ---

  // Strict Open/Closed Logic (Synced with ButchersScreen)
  // DEPRECATED: Now using OpeningHoursHelper
  // Removed _isShopOpenNow and _getTodayHours


  // Format address: handles both String and Map<String, dynamic>
  String _formatAddress(dynamic address) {
    if (address is String) return address;
    if (address is Map) {
      final street = address['street'] ?? '';
      final houseNumber = address['houseNumber'] ?? '';
      final postalCode = address['postalCode'] ?? address['zipCode'] ?? address['zip'] ?? '';
      final city = address['city'] ?? '';
      final country = address['country'] ?? '';
      final parts = <String>[];
      if (street.toString().isNotEmpty) {
        final streetFull = houseNumber.toString().isNotEmpty 
            ? '${street} ${houseNumber}' 
            : street.toString();
        parts.add(streetFull);
      }
      if (postalCode.toString().isNotEmpty || city.toString().isNotEmpty) {
        final cityFull = [postalCode, city].where((s) => s.toString().isNotEmpty).join(' ');
        parts.add(cityFull);
      }
      if (country.toString().isNotEmpty) parts.add(country.toString());
      return parts.join(', ');
    }
    return address?.toString() ?? '';
  }

  String _getBrandLabel(String? brand) {
    if (brand == null) return 'marketplace.independent_butcher'.tr();
    switch (brand.toLowerCase()) {
      case 'tuna': return 'TUNA';
      case 'akdeniz_toros': return 'Akdeniz Toros';
      case 'independent': return 'marketplace.independent_butcher'.tr();
      default: return 'marketplace.independent_butcher'.tr();
    }
  }

  // 🕐 Lieferando-style: Estimated delivery/pickup time for chip subtitles
  String? _getEstimatedDeliveryTime() {
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    if (data == null) return null;
    
    // Check Firestore fields first (future Admin Portal support)
    final deliveryMin = data['estimatedDeliveryMin'] as int?;
    final deliveryMax = data['estimatedDeliveryMax'] as int?;
    final unit = tr('delivery_modes.minutes_short');
    
    if (deliveryMin != null && deliveryMax != null) {
      return '$deliveryMin-$deliveryMax $unit';
    }
    if (deliveryMin != null) {
      return '~$deliveryMin $unit';
    }
    
    // Smart default
    return '20-40 $unit';
  }
  
  String? _getEstimatedPickupTime() {
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    if (data == null) return null;
    
    // Check Firestore fields first
    final pickupMin = data['estimatedPickupMinutes'] as int?;
    final unit = tr('delivery_modes.minutes_short');
    
    if (pickupMin != null) {
      return '~$pickupMin $unit';
    }
    
    // Smart default
    return '~15 $unit';
  }

  String? _getEstimatedDineInTime() {
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    if (data == null) return null;
    
    // Check Firestore fields first (for future when businesses specify this)
    final dineInMin = data['estimatedDineInMinutes'] as int?;
    final unit = tr('delivery_modes.minutes_short');
    
    if (dineInMin != null) {
      return '~$dineInMin $unit';
    }
    
    // Smart default for Dine-in
    return '~10 $unit';
  }

  // --- Actions ---

  void _callStore() async {
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    final phone = data?['shopPhone']?.toString();
    if (phone != null && phone.isNotEmpty) {
      final uri = Uri.parse('tel:$phone');
      if (await canLaunchUrl(uri)) await launchUrl(uri);
    }
  }

  void _showWeeklyHours() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sheetBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final handleColor = isDark ? Colors.white24 : Colors.grey.shade300;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: sheetBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(color: handleColor, borderRadius: BorderRadius.circular(2)),
            ),
            Text('marketplace.weekly_hours'.tr(), style: TextStyle(color: textColor, fontSize: 20, fontWeight: FontWeight.w600)),
            const SizedBox(height: 24),
            _buildGeneralHoursTab(isDark, textColor, isDark ? Colors.grey : Colors.grey.shade600, _getAccent(context)),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  void _showRatings() {
    final rating = _placeDetails?['rating'] ?? 0.0;
    final total = _placeDetails?['user_ratings_total'] ?? 0;
    List reviews = List.from(_placeDetails?['reviews'] ?? []);
    
    // Sort options
    final sortOptions = ['Relevanteste', 'Neueste', 'Beste Bewertung', 'Niedrigste Bewertung'];
    String selectedSort = 'Relevanteste';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setStateModal) {
          // Sorting Logic
          List sortedReviews = List.from(reviews);
          if (selectedSort == 'Neueste') {
            sortedReviews.sort((a, b) => (b['time'] ?? 0).compareTo(a['time'] ?? 0));
          } else if (selectedSort == 'Beste Bewertung') {
            sortedReviews.sort((a, b) => (b['rating'] ?? 0).compareTo(a['rating'] ?? 0));
          } else if (selectedSort == 'Niedrigste Bewertung') {
            sortedReviews.sort((a, b) => (a['rating'] ?? 0).compareTo(b['rating'] ?? 0));
          }
          // 'Relevanteste' uses default API order

          return Container(
            height: MediaQuery.of(context).size.height * 0.85,
            decoration: const BoxDecoration(
              color: Color(0xFF1E1E1E),
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                Container(
                  margin: EdgeInsets.symmetric(vertical: 16),
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                ),
                
                // Header (Summary)
                Padding(
                  padding: EdgeInsets.fromLTRB(24, 0, 24, 24),
                  child: Row(
                    children: [
                       Column(
                         crossAxisAlignment: CrossAxisAlignment.start,
                         children: [
                           Row(
                             children: [
                               Text('$rating', style: const TextStyle(color: Color(0xFFE0E0E0), fontSize: 42, fontWeight: FontWeight.w600)),
                               const SizedBox(width: 8),
                               Column(
                                 crossAxisAlignment: CrossAxisAlignment.start,
                                 children: [
                                   Row(children: List.generate(5, (i) => Icon(Icons.star, color: i < rating.round() ? Colors.amber : Colors.grey, size: 14))),
                                   SizedBox(height: 4),
                                   Text('marketplace.reviews_count'.tr(namedArgs: {'count': '$total'}), style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                                 ],
                               ),
                             ],
                           ),
                         ],
                       ),
                       Spacer(),
                       Icon(FontAwesomeIcons.google, color: const Color(0xFFE0E0E0), size: 28),
                    ],
                  ),
                ),

                Divider(color: Colors.white10, height: 1),

                // Sort Dropdown
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('marketplace.reviews'.tr(), style: const TextStyle(color: Color(0xFFE0E0E0), fontSize: 16, fontWeight: FontWeight.w600)),
                      PopupMenuButton<String>(
                        initialValue: selectedSort,
                        color: const Color(0xFF2C2C2C),
                        onSelected: (val) => setStateModal(() => selectedSort = val),
                        child: Row(
                          children: [
                            Icon(Icons.sort, color: _getAccent(context), size: 16),
                            const SizedBox(width: 8),
                            Text(selectedSort, style: TextStyle(color: _getAccent(context), fontSize: 13, fontWeight: FontWeight.w600)),
                          ],
                        ),
                        itemBuilder: (context) => sortOptions.map((opt) => PopupMenuItem(
                          value: opt,
                          child: Text(opt, style: TextStyle(color: selectedSort == opt ? _getAccent(context) : Colors.white)),
                        )).toList(),
                      ),
                    ],
                  ),
                ),

                // Review List
                Expanded(
                  child: sortedReviews.isEmpty 
                    ? Center(child: Text('marketplace.no_review_yet'.tr(), style: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? Colors.white54 : Colors.black45)))
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                        itemCount: sortedReviews.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 24),
                        itemBuilder: (context, index) {
                          final review = sortedReviews[index];
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    backgroundImage: NetworkImage(review['profile_photo_url'] ?? ''),
                                    backgroundColor: Colors.grey[800],
                                    radius: 16,
                                    child: review['profile_photo_url'] == null ? const Icon(Icons.person, color: Color(0xFFE0E0E0)) : null,
                                  ),
                                  SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(review['author_name'] ?? 'common.guest'.tr(), style: const TextStyle(color: Color(0xFFE0E0E0), fontWeight: FontWeight.w600)),
                                        const SizedBox(height: 2),
                                        Text(review['relative_time_description'] ?? '', style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(color: Colors.amber.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
                                    child: Row(
                                      children: [
                                        Text('${review['rating']}', style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.w600, fontSize: 12)),
                                        const SizedBox(width: 4),
                                        const Icon(Icons.star, color: Colors.amber, size: 10),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                review['text'] ?? '',
                                style: TextStyle(color: Colors.grey[300], fontSize: 14, height: 1.5),
                              ),
                            ],
                          );
                        },
                      ),
                ),
              ],
            ),
          );
        }
      ),
    );
  }

  // --- Modals ---

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
              child: Text('Kategoriler', style: TextStyle(color: textPrimary, fontSize: 22, fontWeight: FontWeight.w600)),
            ),
            // Category list
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: _categories.where((c) => c['name'] == 'Tümü' || _allProducts.any((p) => p.category == c['name'])).length,
                itemBuilder: (context, index) {
                  // Only show categories with products (or 'Tümü')
                  final visibleCategories = _categories.where((c) => c['name'] == 'Tümü' || _allProducts.any((p) => p.category == c['name'])).toList();
                  final cat = visibleCategories[index];
                  final catName = cat['name'] as String;
                  final isSelected = _selectedCategory == catName;
                  
                  // Get product names for this category
                  String productPreview = '';
                  if (catName == 'Tümü') {
                    productPreview = _allProducts.take(4).map((p) => p.name).join(', ');
                  } else {
                    final catProducts = _allProducts.where((p) => p.category == catName).toList();
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

  void _showTunaBrandInfo() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, controller) => Container(
          decoration: BoxDecoration(
            color: Color(0xFF1E1E1E),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // 1. Red Brand Header
              Container(
                width: double.infinity,
                padding: EdgeInsets.fromLTRB(24, 32, 24, 24),
                decoration: BoxDecoration(
                  color: Color(0xFFFB335B), // Deep Red
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 40, height: 4,
                      margin: EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                    ),
                    Image.asset('assets/images/tuna_logo.png', height: 60, errorBuilder: (_,__,___) => const Text('TUNA', style: TextStyle(fontFamily: 'Cursive', fontSize: 40, color: Colors.white, fontWeight: FontWeight.w600))),
                    SizedBox(height: 16),
                    Text(
                      'Europas vertrauenswürdigste Halal-Fleischmarke',
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
                       'Unsere Reise begann 1987 als kleine Metzgerei in Köln und hat sich heute zu einer der modernsten integrierten Halal-Fleischproduktionsstätten Europas entwickelt.',
                       style: TextStyle(color: Colors.white70, fontSize: 15, height: 1.5),
                     ),
                     SizedBox(height: 24),
                     
                     // Icons Row
                     Row(
                       mainAxisAlignment: MainAxisAlignment.spaceAround,
                       children: [
                         _buildBrandIconElement(Icons.verified, 'Halal-Schlachtung', Colors.green),
                         _buildBrandIconElement(Icons.bolt, 'Ohne Betäubung', Colors.amber),
                         _buildBrandIconElement(Icons.clean_hands, 'marketplace.kuru_yolum'.tr(), Colors.amber),
                       ],
                     ),
                     SizedBox(height: 32),
                     
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
                             style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                           ),
                         ],
                       ),
                     ),
                     
                     SizedBox(height: 24),
                     Text('marketplace.production_standards'.tr(), style: const TextStyle(color: Color(0xFFE0E0E0), fontSize: 18, fontWeight: FontWeight.w600)),
                     const SizedBox(height: 16),
                     _buildCheckItem('marketplace.yuksek_et_orani'.tr(), 'marketplace.yuksek_et_orani_desc'.tr()),
                     _buildCheckItem('Ohne E621', 'Kein Glutamat/Geschmacksverstärker'),
                     
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
            color: color.withValues(alpha: 0.1),
            shape: BoxShape.circle,
            border: Border.all(color: color.withValues(alpha: 0.3), width: 2),
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
          Icon(Icons.check_circle, color: Colors.green, size: 20),
          SizedBox(width: 12),
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

  void _showInfoSheet() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sheetBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.grey[400]! : Colors.grey.shade600;
    final handleColor = isDark ? Colors.white24 : Colors.grey.shade300;
    final dividerColor = isDark ? Colors.white10 : Colors.grey.shade200;
    final accent = _getAccent(context);
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        try {
          final data = _butcherDoc?.data() as Map<String, dynamic>?;
          
          // Extract address
          final address = data?['address'];
          final street = address is Map ? (address['street'] ?? '') : '';
          final postalCode = address is Map ? (address['postalCode'] ?? '') : '';
          final city = address is Map ? (address['city'] ?? '') : '';
          final hasAddress = street.toString().trim().isNotEmpty;
          final fullAddress = hasAddress ? '$street\n$postalCode $city' : 'marketplace.no_address_info'.tr();
          
          final phone = data?['shopPhone']?.toString() ?? '';
          final hasPhone = phone.trim().isNotEmpty;
          
          // Cuisine type
          final cuisineType = data?['cuisineType']?.toString() ?? '';
          
          // ══ Determine which service tabs to show ══
          final hasDelivery = data?['supportsDelivery'] == true || data?['hasDelivery'] == true;
          final deliveryStart = data?['deliveryStartTime']?.toString() ?? '';
          final deliveryEnd = data?['deliveryEndTime']?.toString() ?? '';
          final pickupStart = data?['pickupStartTime']?.toString() ?? '';
          final pickupEnd = data?['pickupEndTime']?.toString() ?? '';
          // Per-day arrays saved by admin portal
          final deliveryHoursRaw = data?['deliveryHours'];
          final pickupHoursRaw = data?['pickupHours'];
          final List<dynamic>? deliveryHoursArray = deliveryHoursRaw is List ? deliveryHoursRaw : null;
          final List<dynamic>? pickupHoursArray = pickupHoursRaw is List ? pickupHoursRaw : null;
          final hasPickup = pickupStart.trim().isNotEmpty || pickupEnd.trim().isNotEmpty || (pickupHoursArray != null && pickupHoursArray.isNotEmpty);
          
          // Build dynamic tabs list
          final List<Tab> tabs = [
            Tab(
              icon: const Icon(Icons.store, size: 18),
              text: 'marketplace.hours_general'.tr(),
            ),
          ];
          final List<Widget> tabViews = [
            _buildGeneralHoursTab(isDark, textColor, subtitleColor, accent),
          ];
          
          if (hasDelivery) {
            tabs.add(Tab(
              icon: const Icon(Icons.delivery_dining, size: 18),
              text: 'marketplace.hours_delivery'.tr(),
            ));
            tabViews.add(_buildServiceHoursTab(
              deliveryStart, deliveryEnd,
              isDark, textColor, subtitleColor, accent,
              perDayHours: deliveryHoursArray,
            ));
          }
          if (hasPickup) {
            tabs.add(Tab(
              icon: const Icon(Icons.shopping_bag_outlined, size: 18),
              text: 'marketplace.hours_pickup'.tr(),
            ));
            tabViews.add(_buildServiceHoursTab(
              pickupStart, pickupEnd,
              isDark, textColor, subtitleColor, accent,
              perDayHours: pickupHoursArray,
            ));
          }
          
          final showTabs = tabs.length > 1;
          
          return Container(
            height: MediaQuery.of(ctx).size.height * 0.75,
            decoration: BoxDecoration(
              color: sheetBg,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: DefaultTabController(
              length: tabs.length,
              child: Column(
                children: [
                  // ── Handle ──
                  Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 12),
                    width: 40, height: 4,
                    decoration: BoxDecoration(color: handleColor, borderRadius: BorderRadius.circular(2)),
                  ),
                  
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      children: [
                        // ═══ Business Name ═══
                        Text(
                          data?['companyName'] ?? 'marketplace.business_info'.tr(),
                          style: TextStyle(color: textColor, fontSize: 22, fontWeight: FontWeight.w200),
                        ),
                        const SizedBox(height: 6),
                        
                        // Brand Badge — pill style matching business card
                        if (data?['brandLabelActive'] == true)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: InkWell(
                              onTap: () { Navigator.pop(ctx); _showTunaBrandInfo(); },
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFA01E22),
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.2),
                                        blurRadius: 4,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.verified, color: Colors.white, size: 14),
                                      const SizedBox(width: 5),
                                      Text(_getBrandLabel(data?['brand']).toUpperCase(),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 1.2,
                                        )),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        
                        if (data?['brandLabelActive'] != true)
                          const SizedBox(height: 10),

                        // ═══ MAP SECTION — "So findest du uns" ═══
                        if (hasAddress) ...[
                          Text('marketplace.find_us'.tr(),
                            style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.w200)),
                          const SizedBox(height: 10),
                          Builder(
                            builder: (context) {
                              // Extract lat/lng from business document
                              double? lat = (address is Map && address['lat'] is num)
                                  ? (address['lat'] as num).toDouble() : null;
                              double? lng = (address is Map && address['lng'] is num)
                                  ? (address['lng'] as num).toDouble() : null;
                              // Fallback to top-level
                              lat ??= (data?['lat'] is num) ? (data!['lat'] as num).toDouble() : null;
                              lng ??= (data?['lng'] is num) ? (data!['lng'] as num).toDouble() : null;
                              // Fallback to placeDetails
                              lat ??= (data?['placeDetails']?['lat'] is num)
                                  ? (data!['placeDetails']['lat'] as num).toDouble() : null;
                              lng ??= (data?['placeDetails']?['lng'] is num)
                                  ? (data!['placeDetails']['lng'] as num).toDouble() : null;

                              if (lat != null && lng != null) {
                                final center = LatLng(lat, lng);
                                return GestureDetector(
                                  onTap: () {
                                    final query = Uri.encodeComponent('$street, $postalCode $city');
                                    launchUrl(Uri.parse('https://maps.apple.com/?q=$query'));
                                  },
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(14),
                                    child: SizedBox(
                                      height: 160,
                                      width: double.infinity,
                                      child: Stack(
                                        children: [
                                          AbsorbPointer(
                                            child: FlutterMap(
                                              options: MapOptions(
                                                initialCenter: center,
                                                initialZoom: 17,
                                                interactionOptions: const InteractionOptions(
                                                  flags: InteractiveFlag.none,
                                                ),
                                              ),
                                              children: [
                                                TileLayer(
                                                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                                  userAgentPackageName: 'shop.lokma.app',
                                                ),
                                                MarkerLayer(
                                                  rotate: true,
                                                  markers: [
                                                    Marker(
                                                      point: center,
                                                      width: 40,
                                                      height: 40,
                                                      child: const Icon(
                                                        Icons.location_on,
                                                        color: Colors.red,
                                                        size: 40,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                          // "Open in Maps" indicator
                                          Positioned(
                                            bottom: 8, right: 10,
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: Colors.white.withValues(alpha: 0.9),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Icon(Icons.open_in_new, size: 12, color: Colors.black87),
                                                  const SizedBox(width: 4),
                                                  Text('marketplace.open_maps'.tr(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.black87)),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              } else {
                                // Fallback: show placeholder with address
                                return GestureDetector(
                                  onTap: () {
                                    final query = Uri.encodeComponent('$street, $postalCode $city');
                                    launchUrl(Uri.parse('https://maps.apple.com/?q=$query'));
                                  },
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(14),
                                    child: Container(
                                      height: 160,
                                      width: double.infinity,
                                      color: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
                                      child: Center(
                                        child: Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.map_outlined, color: subtitleColor, size: 36),
                                            const SizedBox(height: 6),
                                            Text('$postalCode $city',
                                              style: TextStyle(color: subtitleColor, fontSize: 13)),
                                            const SizedBox(height: 4),
                                            Text('marketplace.open_maps'.tr(),
                                              style: TextStyle(color: Colors.blue, fontSize: 12)),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }
                            },
                          ),
                          const SizedBox(height: 14),
                        ],

                        // ═══ ADDRESS ROW — Lieferando style ═══
                        InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: hasAddress ? () {
                            final query = Uri.encodeComponent('$street, $postalCode $city');
                            launchUrl(Uri.parse('https://maps.apple.com/?q=$query'));
                          } : null,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('common.address'.tr(),
                                        style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600)),
                                      const SizedBox(height: 3),
                                      Text(fullAddress,
                                        style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w100, height: 1.4)),
                                    ],
                                  ),
                                ),
                                if (hasAddress)
                                  Icon(Icons.arrow_forward_ios, color: subtitleColor, size: 14),
                              ],
                            ),
                          ),
                        ),
                        
                        Divider(color: dividerColor, height: 1),
                        
                        // ═══ PHONE ROW — only show if phone exists ═══
                        if (hasPhone) ...[
                          InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: _callStore,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Row(
                                children: [
                                  Container(
                                    width: 40, height: 40,
                                    decoration: BoxDecoration(
                                      color: Colors.blue.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(Icons.phone, color: Colors.blue, size: 20),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('marketplace.phone_label'.tr(),
                                          style: TextStyle(color: subtitleColor, fontSize: 13, fontWeight: FontWeight.w100)),
                                        const SizedBox(height: 3),
                                        Text(phone,
                                          style: TextStyle(
                                            color: Colors.blue,
                                            fontSize: 15, fontWeight: FontWeight.w100,
                                          )),
                                      ],
                                    ),
                                  ),
                                  Icon(Icons.arrow_forward_ios, color: subtitleColor, size: 14),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        
                        // ═══ KÜCHE (CUISINE) SECTION ═══
                        if (cuisineType.trim().isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text('marketplace.cuisine'.tr(),
                            style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.w200)),
                          const SizedBox(height: 6),
                          Text(
                            cuisineType.split(RegExp(r'[,;]')).map((t) => t.trim()).where((t) => t.isNotEmpty).join('  ·  '),
                            style: TextStyle(color: subtitleColor, fontSize: 14, fontWeight: FontWeight.w100),
                          ),
                          const SizedBox(height: 20),
                          Divider(color: dividerColor, height: 1),
                          const SizedBox(height: 16),
                        ],
                        
                        // ═══ BUSINESS HOURS ═══
                        const SizedBox(height: 5),
                        Text('marketplace.business_hours'.tr(),
                          style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600)),
                        // ═══ CLOSING SOON INDICATOR ═══
                        Builder(builder: (context) {
                          final closingSoonText = _getClosingSoonText();
                          if (closingSoonText == null) return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.orange.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                closingSoonText,
                                style: const TextStyle(color: Colors.orange, fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                            ),
                          );
                        }),
                        const SizedBox(height: 12),
                        
                        // Show underline tab bar only if there are multiple tabs
                        if (showTabs) ...[
                          TabBar(
                            indicatorSize: TabBarIndicatorSize.label,
                            dividerColor: dividerColor,
                            indicatorColor: accent,
                            indicatorWeight: 2.5,
                            labelColor: textColor,
                            unselectedLabelColor: subtitleColor,
                            labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w200),
                            unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w100),
                            labelPadding: const EdgeInsets.symmetric(horizontal: 4),
                            tabs: tabs,
                          ),
                          const SizedBox(height: 12),
                          
                          // Tab Content
                          SizedBox(
                            height: 320,
                            child: TabBarView(
                              children: tabViews,
                            ),
                          ),
                        ] else ...[
                          // No tabs needed — just show general hours directly
                          _buildGeneralHoursTab(isDark, textColor, subtitleColor, accent),
                        ],
                        
                        // ═══ IMPRESSUM ═══
                        if (data != null) ...[
                          const SizedBox(height: 24),
                          Divider(color: dividerColor, height: 1),
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF1A1A1A) : const Color(0xFFF5F0E8),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Impressum',
                                  style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600)),
                                const SizedBox(height: 12),
                                _buildImpressumSection(data, textColor, subtitleColor),
                              ],
                            ),
                          ),
                        ],
                        
                        const SizedBox(height: 30),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        } catch (e) {
          debugPrint('Error building info sheet: $e');
          return Container(
            height: MediaQuery.of(context).size.height * 0.4,
            decoration: BoxDecoration(
              color: sheetBg,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Center(
              child: Text('marketplace.info_load_error'.tr(), style: TextStyle(color: subtitleColor)),
            ),
          );
        }
      },
    );
  }

  // ═══ IMPRESSUM SECTION ═══
  Widget _buildImpressumSection(Map<String, dynamic>? data, Color textColor, Color subtitleColor) {
    if (data == null) return const SizedBox.shrink();
    
    final companyName = data['companyName']?.toString() ?? '';
    final businessName = data['businessName']?.toString() ?? data['name']?.toString() ?? '';
    final displayName = companyName.isNotEmpty ? companyName : businessName;
    
    final legalForm = data['legalForm']?.toString() ?? '';
    final managingDirector = data['managingDirector']?.toString() ?? data['ownerName']?.toString() ?? '';
    final authorizedRep = data['authorizedRepresentative']?.toString() ?? '';
    final registerCourt = data['registerCourt']?.toString() ?? '';
    final registerNumber = data['registerNumber']?.toString() ?? '';
    final taxId = data['taxId']?.toString() ?? data['taxNumber']?.toString() ?? '';
    final vatId = data['vatId']?.toString() ?? '';
    final email = data['email']?.toString() ?? data['shopEmail']?.toString() ?? data['contactEmail']?.toString() ?? '';
    final phone = data['phone']?.toString() ?? data['phoneNumber']?.toString() ?? data['contactPhone']?.toString() ?? '';
    
    final address = data['address'];
    final street = address is Map ? (address['street'] ?? '') : '';
    final houseNumber = address is Map ? (address['houseNumber'] ?? '') : '';
    final postalCode = address is Map ? (address['postalCode'] ?? '') : '';
    final city = address is Map ? (address['city'] ?? '') : '';
    final streetFull = houseNumber.toString().trim().isNotEmpty 
      ? '${street} ${houseNumber}' 
      : street.toString();
    final fullAddress = streetFull.toString().trim().isNotEmpty 
      ? '$streetFull\n$postalCode $city' 
      : '';
    
    // Format legal form label
    String legalFormLabel = '';
    const legalFormMap = {
      'gmbh': 'GmbH', 'ug': 'UG (haftungsbeschr\u00e4nkt)', 'ag': 'AG',
      'gbr': 'GbR', 'ohg': 'OHG', 'kg': 'KG', 'gmbh_co_kg': 'GmbH & Co. KG',
      'einzelunternehmen': 'Einzelunternehmen', 'freiberufler': 'Freiberufler',
      'ev': 'e.V.', 'eg': 'eG', 'se': 'SE',
    };
    if (legalForm.isNotEmpty) {
      legalFormLabel = legalFormMap[legalForm] ?? legalForm;
    }

    // Body text style: very small, very thin
    final bodyStyle = TextStyle(color: subtitleColor, fontSize: 11, fontWeight: FontWeight.w300, height: 1.5);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (displayName.isNotEmpty)
          Text(
            displayName + (legalFormLabel.isNotEmpty ? ' ($legalFormLabel)' : ''),
            style: TextStyle(color: textColor, fontSize: 12, fontWeight: FontWeight.w400, height: 1.4),
          ),
        if (fullAddress.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(fullAddress, style: bodyStyle),
          ),
        if (managingDirector.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('${'marketplace.impressum_representative'.tr()}: $managingDirector', style: bodyStyle),
          ),
        if (authorizedRep.isNotEmpty && authorizedRep != managingDirector)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('${'marketplace.impressum_authorized'.tr()}: $authorizedRep', style: bodyStyle),
          ),
        
        // Phone
        if (phone.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(phone, style: bodyStyle),
        ],
        
        // Register info
        if (registerCourt.isNotEmpty || registerNumber.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            [if (registerCourt.isNotEmpty) registerCourt, if (registerNumber.isNotEmpty) registerNumber].join(', '),
            style: bodyStyle,
          ),
        ],
        if (taxId.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('${'marketplace.impressum_tax_id'.tr()}: $taxId', style: bodyStyle),
          ),
        if (vatId.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('${'marketplace.impressum_vat_id'.tr()}: $vatId', style: bodyStyle),
          ),
        // Email - always show label
        const SizedBox(height: 8),
        Text('${'marketplace.impressum_email'.tr()}: ${email.isNotEmpty ? email : "-"}', style: bodyStyle),
        
        // Professional tagline
        const SizedBox(height: 14),
        Divider(color: subtitleColor.withValues(alpha: 0.2), height: 1),
        const SizedBox(height: 10),
        Text(
          _getImpressumTagline(),
          style: TextStyle(color: subtitleColor.withValues(alpha: 0.7), fontSize: 10, fontWeight: FontWeight.w300, height: 1.5),
        ),
      ],
    );
  }
  
  String _getImpressumTagline() {
    final locale = context.locale.languageCode;
    switch (locale) {
      case 'de': return 'Wir sind ein professioneller Anbieter. Erfahre mehr dar\u00fcber, wie wir gemeinsam mit LOKMA die Verbraucherverantwortung \u00fcbernehmen.';
      case 'en': return 'We are a professional provider. Learn more about how we take consumer responsibility together with LOKMA.';
      case 'tr': return 'Profesyonel bir hizmet saglayicisiyiz. LOKMA ile birlikte t\u00fcketici sorumlulugunu nasil \u00fcstlendigimiz hakkinda daha fazla bilgi edinin.';
      case 'nl': return 'Wij zijn een professionele aanbieder. Lees meer over hoe wij samen met LOKMA de consumentenverantwoordelijkheid dragen.';
      case 'fr': return 'Nous sommes un prestataire professionnel. D\u00e9couvrez comment nous assumons ensemble la responsabilit\u00e9 envers les consommateurs avec LOKMA.';
      case 'it': return 'Siamo un fornitore professionale. Scopri come assumiamo la responsabilit\u00e0 verso i consumatori insieme a LOKMA.';
      case 'es': return 'Somos un proveedor profesional. Descubre c\u00f3mo asumimos la responsabilidad del consumidor junto con LOKMA.';
      default: return 'We are a professional provider. Learn more about how we take consumer responsibility together with LOKMA.';
    }
  }

  // ═══ CLOSING SOON HELPER ═══
  String? _getClosingSoonText() {
    try {
      if (_butcherDoc == null) return null;
      final rawData = _butcherDoc!.data();
      if (rawData == null) return null;
      final data = rawData as Map<String, dynamic>;
      final hours = data['openingHours'];
      if (hours == null || hours.toString().trim().isEmpty) return null;

      List<String> lines = [];
      if (hours is String) {
        lines = hours.split(RegExp(r'\r?\n'));
      } else if (hours is List) {
        lines = hours.map((e) => e.toString()).toList();
      } else {
        return null;
      }
      lines = lines.where((l) => l.trim().isNotEmpty).toList();

      // Map English day names to Turkish (data is stored in Turkish)
      final enToTr = {
        'Monday': 'Pazartesi', 'Tuesday': 'Salı', 'Wednesday': 'Çarşamba',
        'Thursday': 'Perşembe', 'Friday': 'Cuma', 'Saturday': 'Cumartesi', 'Sunday': 'Pazar'
      };
      final dayNamesTr = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
      final now = DateTime.now();
      final todayIndex = now.weekday - 1;
      final todayDayName = dayNamesTr[todayIndex];

      // Find today's line
      String? todayLine;
      for (var line in lines) {
        String clean = line.trim();
        for (var entry in enToTr.entries) {
          if (clean.startsWith(entry.key)) {
            clean = clean.replaceFirst(entry.key, entry.value);
            break;
          }
        }
        if (clean.startsWith(todayDayName)) {
          todayLine = clean;
          break;
        }
      }
      if (todayLine == null) return null;

      // Extract closing time (last HH:MM pattern in the line)
      final timeRegex = RegExp(r'(\d{1,2}):(\d{2})');
      final matches = timeRegex.allMatches(todayLine).toList();
      if (matches.isEmpty) return null;

      // Handle AM/PM conversion if present
      String processedLine = todayLine.replaceAllMapped(
        RegExp(r'(\d{1,2})(:\d{2})?\s*([AP]M)', caseSensitive: false),
        (match) {
          int h = int.parse(match.group(1)!);
          int m = match.group(2) != null ? int.parse(match.group(2)!.substring(1)) : 0;
          String period = match.group(3)!.toUpperCase();
          if (period == 'PM' && h < 12) h += 12;
          if (period == 'AM' && h == 12) h = 0;
          return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
        },
      );

      final processedMatches = timeRegex.allMatches(processedLine).toList();
      if (processedMatches.isEmpty) return null;

      // Last time is the closing time
      final lastMatch = processedMatches.last;
      final closeHour = int.parse(lastMatch.group(1)!);
      final closeMinute = int.parse(lastMatch.group(2)!);

      final closeTime = DateTime(now.year, now.month, now.day, closeHour, closeMinute);
      final diff = closeTime.difference(now);
      final remainingMinutes = diff.inMinutes;

      // Only show if within 2 hours (120 minutes) and still open
      if (remainingMinutes <= 0 || remainingMinutes > 120) return null;

      final hrs = remainingMinutes ~/ 60;
      final mins = remainingMinutes % 60;
      final timeStr = hrs > 0
          ? '$hrs:${mins.toString().padLeft(2, '0')}'
          : '${mins}min';

      return 'marketplace.closing_soon'.tr(namedArgs: {'time': timeStr});
    } catch (e) {
      return null;
    }
  }

  // ═══ GENERAL HOURS TAB — day-by-day from openingHours ═══
  Widget _buildGeneralHoursTab(bool isDark, Color textColor, Color subtitleColor, Color accent) {
    try {
      if (_butcherDoc == null) {
        return Center(child: Text('marketplace.hours_loading'.tr(), style: TextStyle(color: subtitleColor)));
      }
      
      final rawData = _butcherDoc!.data();
      if (rawData == null) {
        return Center(child: Text('marketplace.hours_not_found'.tr(), style: TextStyle(color: subtitleColor)));
      }
      
      final data = rawData as Map<String, dynamic>;
      final hours = data['openingHours'];

      if (hours == null || hours.toString().trim().isEmpty) {
        return Center(child: Text('marketplace.business_hours_not_entered'.tr(), style: TextStyle(color: subtitleColor)));
      }

      final dayNamesDisplay = [
        'common.day_monday'.tr(), 'common.day_tuesday'.tr(), 'common.day_wednesday'.tr(),
        'common.day_thursday'.tr(), 'common.day_friday'.tr(), 'common.day_saturday'.tr(), 'common.day_sunday'.tr(),
      ];
      final dayNamesTr = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
      final now = DateTime.now();
      final todayIndex = now.weekday - 1;

      List<String> lines = [];
      if (hours is String) {
        lines = hours.split(RegExp(r'\r?\n'));
      } else if (hours is List) {
        lines = hours.map((e) => e.toString()).toList();
      } else {
        return Center(child: Text('marketplace.call_store_for_hours'.tr(), style: TextStyle(color: subtitleColor)));
      }

      lines = lines.where((l) => l.trim().isNotEmpty).toList();

      final Map<String, String> enToTr = {
        'Monday': 'Pazartesi', 'Tuesday': 'Salı', 'Wednesday': 'Çarşamba',
        'Thursday': 'Perşembe', 'Friday': 'Cuma', 'Saturday': 'Cumartesi', 'Sunday': 'Pazar',
        'Montag': 'Pazartesi', 'Dienstag': 'Salı', 'Mittwoch': 'Çarşamba',
        'Donnerstag': 'Perşembe', 'Freitag': 'Cuma', 'Samstag': 'Cumartesi', 'Sonntag': 'Pazar',
      };
      
      List<String> standardizedLines = [];
      for (var line in lines) {
        String cleanLine = line.trim();
        for (var entry in enToTr.entries) {
          if (cleanLine.startsWith(entry.key)) {
            cleanLine = cleanLine.replaceFirst(entry.key, entry.value);
            break;
          }
        }
        cleanLine = cleanLine.replaceAllMapped(RegExp(r'(\d{1,2})(:\d{2})?\s*([AP]M)', caseSensitive: false), (match) {
          int h = int.parse(match.group(1)!);
          int m = match.group(2) != null ? int.parse(match.group(2)!.substring(1)) : 0;
          String period = match.group(3)!.toUpperCase();
          if (period == 'PM' && h < 12) h += 12;
          if (period == 'AM' && h == 12) h = 0;
          return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
        });
        cleanLine = cleanLine.replaceAll('–', '-').replaceAll('—', '-');
        cleanLine = cleanLine.replaceAll(RegExp(r'Closed', caseSensitive: false), 'Kapalı');
        standardizedLines.add(cleanLine);
      }
      lines = standardizedLines;

      bool structureMatch = lines.any((l) => dayNamesTr.any((d) => l.startsWith(d)));
      
      final bool isOpenNow = OpeningHoursHelper(hours).isOpenAt(now);

      if (!structureMatch) {
        return Column(
          children: [
            _buildOpenStatusHeader(isOpenNow),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: lines.map((line) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Text(line, style: TextStyle(color: textColor, fontSize: 14)),
                )).toList(),
              ),
            ),
          ],
        );
      }

      return Column(
        children: [
          _buildOpenStatusHeader(isOpenNow),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: List.generate(7, (i) {
                final dayNameTr = dayNamesTr[i];
                final dayNameDisplay = dayNamesDisplay[i];
                final isToday = todayIndex == i;
                
                final line = lines.firstWhere(
                  (l) => l.startsWith('$dayNameTr:') || l.startsWith('$dayNameTr '),
                  orElse: () => '$dayNameTr: Kapalı'
                );
                
                String content = line.replaceAll('$dayNameTr:', '').replaceAll(dayNameTr, '').trim();
                if (content.isEmpty || content == 'Kapalı') content = 'common.closed'.tr();

                return _buildDayRow(dayNameDisplay, content, isToday, isDark, textColor, subtitleColor, accent, isOpenNow: isOpenNow);
              }),
            ),
          ),
        ],
      );
    } catch (e) {
      debugPrint('Error building general hours tab: $e');
      return Center(child: Text('marketplace.hours_cannot_display'.tr(), style: TextStyle(color: subtitleColor)));
    }
  }

  // ═══ SERVICE HOURS TAB (Delivery / Pickup) ═══
  // Now reads per-day hours arrays from Firestore (deliveryHours / pickupHours).
  // Falls back to uniform startTime/endTime if per-day data is missing.
  Widget _buildServiceHoursTab(String startTime, String endTime, bool isDark, Color textColor, Color subtitleColor, Color accent, {List<dynamic>? perDayHours}) {
    final dayNamesDisplay = [
      'common.day_monday'.tr(), 'common.day_tuesday'.tr(), 'common.day_wednesday'.tr(),
      'common.day_thursday'.tr(), 'common.day_friday'.tr(), 'common.day_saturday'.tr(), 'common.day_sunday'.tr(),
    ];
    final dayNamesTr = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    final Map<String, String> aliasToTr = {
      'Monday': 'Pazartesi', 'Tuesday': 'Salı', 'Wednesday': 'Çarşamba',
      'Thursday': 'Perşembe', 'Friday': 'Cuma', 'Saturday': 'Cumartesi', 'Sunday': 'Pazar',
      'Montag': 'Pazartesi', 'Dienstag': 'Salı', 'Mittwoch': 'Çarşamba',
      'Donnerstag': 'Perşembe', 'Freitag': 'Cuma', 'Samstag': 'Cumartesi', 'Sonntag': 'Pazar',
    };
    final now = DateTime.now();
    final todayIndex = now.weekday - 1;

    // ── Try per-day array first ──
    if (perDayHours != null && perDayHours.isNotEmpty) {
      final lines = perDayHours.map((e) => e.toString().trim()).where((l) => l.isNotEmpty).toList();
      // Standardize day names to Turkish
      final List<String> standardizedLines = [];
      for (var line in lines) {
        String clean = line;
        for (var entry in aliasToTr.entries) {
          if (clean.startsWith(entry.key)) {
            clean = clean.replaceFirst(entry.key, entry.value);
            break;
          }
        }
        clean = clean.replaceAll('–', '-').replaceAll('—', '-');
        // Normalize AM/PM times to 24h format
        clean = clean.replaceAllMapped(
          RegExp(r'(\d{1,2})(:\d{2})?\s*([AP]M)', caseSensitive: false),
          (match) {
            final rawH = '${match.group(1)!}${match.group(2) ?? ':00'}';
            final period = match.group(3)!.toUpperCase();
            return normalizeTimeString('$rawH $period');
          },
        );
        standardizedLines.add(clean);
      }

      final bool structureMatch = standardizedLines.any((l) => dayNamesTr.any((d) => l.startsWith(d)));
      final bool isOpenNow = OpeningHoursHelper(perDayHours).isOpenAt(now);

      if (structureMatch) {
        return Column(
          children: [
            _buildOpenStatusHeader(isOpenNow),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: List.generate(7, (i) {
                  final dayNameTr = dayNamesTr[i];
                  final line = standardizedLines.firstWhere(
                    (l) => l.startsWith('$dayNameTr:') || l.startsWith('$dayNameTr '),
                    orElse: () => '$dayNameTr: Kapalı',
                  );
                  String content = line.replaceAll('$dayNameTr:', '').replaceAll(dayNameTr, '').trim();
                  final isClosed = content.isEmpty ||
                      content.toLowerCase().contains('kapalı') ||
                      content.toLowerCase().contains('geschlossen') ||
                      content.toLowerCase().contains('closed');
                  if (isClosed) content = 'common.closed'.tr();
                  return _buildDayRow(dayNamesDisplay[i], content, todayIndex == i, isDark, textColor, subtitleColor, accent, isOpenNow: isOpenNow);
                }),
              ),
            ),
          ],
        );
      }
    }

    // ── Fallback: uniform startTime / endTime ──
    final hasCustomHours = startTime.trim().isNotEmpty && endTime.trim().isNotEmpty;
    if (!hasCustomHours) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.schedule, color: subtitleColor, size: 40),
            const SizedBox(height: 12),
            Text('marketplace.same_as_general'.tr(),
              style: TextStyle(color: subtitleColor, fontSize: 16, fontWeight: FontWeight.w300)),
          ],
        ),
      );
    }

    final hoursText = '$startTime - $endTime';
    final isOpenNow = OpeningHoursHelper(null).isOpenWithinTime(startTime, endTime, now);
    
    return Column(
      children: [
        _buildOpenStatusHeader(isOpenNow),
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: List.generate(7, (i) {
              return _buildDayRow(dayNamesDisplay[i], hoursText, todayIndex == i, isDark, textColor, subtitleColor, accent, isOpenNow: isOpenNow);
            }),
          ),
        ),
      ],
    );
  }

  Widget _buildOpenStatusHeader(bool isOpenNow) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(Icons.schedule_rounded, size: 15, color: isOpenNow ? Colors.green : Colors.red),
          const SizedBox(width: 5),
          Text(
            isOpenNow ? 'marketplace.filter_open_now_title'.tr() : 'marketplace.currently_closed'.tr(),
            style: TextStyle(
              color: isOpenNow ? Colors.green : Colors.red,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  // ═══ SINGLE DAY ROW — Lieferando style ═══
  Widget _buildDayRow(String dayName, String hours, bool isToday, bool isDark, Color textColor, Color subtitleColor, Color accent, {bool? isOpenNow}) {
    final isClosed = hours == 'common.closed'.tr() || hours.toLowerCase().contains('kapalı') || hours.toLowerCase().contains('geschlossen') || hours.toLowerCase().contains('closed');
    
    Color todayColor;
    if (isOpenNow != null) {
      todayColor = isOpenNow ? Colors.green : Colors.red;
    } else {
      todayColor = accent;
    }
    
    final dayColor = isToday ? todayColor : (isDark ? Colors.grey[300]! : Colors.black87);
    final hoursColor = isToday ? todayColor : (isClosed ? (isDark ? Colors.grey[500]! : Colors.grey) : textColor);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      margin: const EdgeInsets.only(bottom: 2),
      decoration: isToday ? BoxDecoration(
        color: todayColor.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(6),
      ) : null,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(dayName, style: TextStyle(
            color: dayColor,
            fontSize: 15,
            fontWeight: isToday ? FontWeight.bold : FontWeight.w600,
          )),
          Text(hours, style: TextStyle(
            color: hoursColor,
            fontSize: 15,
            fontWeight: isToday ? FontWeight.bold : FontWeight.w600,
          )),
        ],
      ),
    );
  }


  @override
  Widget build(BuildContext context) {
    // LIEFERANDO STYLE: Theme-aware color system
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    // Dynamic colors based on theme
    final scaffoldBg = isDark ? const Color(0xFF2B2929) : Colors.white;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white70 : Colors.black54;
    final dividerColor = isDark ? Colors.white12 : Colors.black12;
    
    final favoriteButchers = ref.watch(butcherFavoritesProvider);
    final isFavorite = favoriteButchers.contains(widget.businessId);

    // Initial loading state
    if (_butcherDoc == null) {
      return Scaffold(
        backgroundColor: scaffoldBg,
        body: Center(
          child: CircularProgressIndicator(color: _defaultBrandColor), // 🎨 BRAND COLOUR
        ),
      );
    }
    
    // Preparation - Safe Data Access
    final data = _butcherDoc!.data() as Map<String, dynamic>?;
    final brand = data?['brand'];
    // Tab-aware opening hours: use deliveryHours/pickupHours/openingHours based on active tab
    final OpeningHoursHelper openingHelper;
    if (_deliveryModeIndex == 0 && data?['deliveryHours'] != null) {
      openingHelper = OpeningHoursHelper(data?['deliveryHours']);
    } else if (_deliveryModeIndex == 1 && data?['pickupHours'] != null) {
      openingHelper = OpeningHoursHelper(data?['pickupHours']);
    } else {
      openingHelper = OpeningHoursHelper(data?['openingHours']);
    }
    final isOpen = openingHelper.isOpenAt(DateTime.now());

    // Pause detection
    final bool isDeliveryPaused = data?['temporaryDeliveryPaused'] as bool? ?? false;
    final bool isPickupPaused = data?['temporaryPickupPaused'] as bool? ?? false;
    final bool isPausedForCurrentTab = (_deliveryModeIndex == 0 && isDeliveryPaused) ||
        (_deliveryModeIndex == 1 && isPickupPaused);
    // Calculate remaining minutes for pause countdown
    int? pauseRemainingMinutes;
    if (isPausedForCurrentTab) {
      final pauseUntilField = _deliveryModeIndex == 0 ? 'deliveryPauseUntil' : 'pickupPauseUntil';
      final pauseUntilTs = data?[pauseUntilField];
      if (pauseUntilTs != null) {
        final DateTime pauseUntilDt = pauseUntilTs is Timestamp
            ? pauseUntilTs.toDate()
            : (pauseUntilTs is DateTime ? pauseUntilTs : DateTime.now());
        final diff = pauseUntilDt.difference(DateTime.now()).inMinutes;
        if (diff > 0) pauseRemainingMinutes = diff;
      }
    }
    final brandLabel = data?['brandLabel'] as String?;
    final tags = data?['tags'] as List<dynamic>?;
    final hasTunaTag = tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
    final isTunaPartner = (data?['isTunaPartner'] as bool? ?? false) ||
        (brandLabel?.toLowerCase() == 'tuna') ||
        (brand?.toString().toLowerCase() == 'tuna') ||
        hasTunaTag;
    final showBrandBadge = isTunaPartner || (brand?.toString().toLowerCase() == 'akdeniz_toros');
    
    // 🎨 BRAND COLOR SYSTEM: Use brand-specific colors when available
    Color accent;
    if (brand?.toString().toLowerCase() == 'tuna') {
      accent = const Color(0xFFFB335B); // 🎨 BRAND COLOUR: TUNA pink/magenta
    } else if (brand?.toString().toLowerCase() == 'akdeniz_toros') {
      accent = const Color(0xFF1B5E20); // 🎨 BRAND COLOUR: Akdeniz Toros green
    } else {
      accent = _defaultBrandColor; // 🎨 BRAND COLOUR: Default fallback
    }

    return Scaffold(
      backgroundColor: scaffoldBg,
      bottomNavigationBar: _buildCartBar(),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('businesses')
            .doc(widget.businessId)
            .collection('products')
            .where('isActive', isEqualTo: true) // Only show active products
            .snapshots(),
        builder: (context, snapshot) {
          // 🔴 Error handling for stream
          if (snapshot.hasError) {
            debugPrint('🔴 [LOKMA] Products stream error: ${snapshot.error}');
          }
          
          // Process Products
          List<ButcherProduct> products = [];
          if (snapshot.hasData) {
            for (final doc in snapshot.data!.docs) {
              try {
                final data = doc.data() as Map<String, dynamic>;
                final sku = data['masterProductId'] ?? data['masterProductSku'];
                final masterData = MASTER_PRODUCT_CATALOG[sku];
                
                final masterMap = masterData != null ? {
                  'name': masterData.name,
                  'description': masterData.description,
                  'category': masterData.category,
                  'unit': masterData.unitType,
                  'imageAsset': masterData.imagePath,
                  'tags': masterData.tags,
                } : null;
                
                products.add(ButcherProduct.fromFirestore(data, doc.id, butcherId: widget.businessId, masterData: masterMap));
              } catch (e) {
                debugPrint('🔴 [LOKMA] Error parsing product ${doc.id}: $e');
              }
            }
            // 🔍 Update all products for instant search
            _allProducts = products;
          }

          // 🔍 Filter by Menu Search Query
          final bool isSearching = _menuSearchQuery.isNotEmpty;
          List<ButcherProduct> searchResults = [];
          if (isSearching) {
            final query = _menuSearchQuery.toLowerCase();
            searchResults = products.where((p) => 
              p.name.toLowerCase().contains(query) ||
              p.description.toLowerCase().contains(query)
            ).toList();
          }

          return CustomScrollView(
            controller: _scrollController,
            slivers: [
              // 1. LIEFERANDO-STYLE: White Top Bar (separate from hero)
              SliverAppBar(
                expandedHeight: 0, // No expanded height - just the app bar
                floating: false,
                pinned: true,
                backgroundColor: scaffoldBg,
                surfaceTintColor: scaffoldBg,
                elevation: 0,
                toolbarHeight: 56,
                // Back button with white circular background
                leading: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Material(
                    color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                    shape: const CircleBorder(),
                    elevation: 2,
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () {
                        if (context.canPop()) {
                          context.pop();
                        } else {
                          context.go('/restoran');
                        }
                      },
                      child: SizedBox(
                        width: 40, height: 40,
                        child: Icon(Icons.arrow_back_ios_new, color: textPrimary, size: 18),
                      ),
                    ),
                  ),
                ),
                // Title: Search Bar when scrolled, else Service Toggle
                // In masa mode: always show search bar (no toggle needed)
                title: (_showSearchBar || _isMasaMode)
                    ? GestureDetector(
                        onTap: () => _showMenuSearchOverlay(),
                        child: Container(
                          height: 44,
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF5F0E8),
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Row(
                            children: [
                              const SizedBox(width: 12),
                              Icon(Icons.search, color: isDark ? Colors.grey[400] : Colors.grey[600], size: 22),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _menuSearchQuery.isNotEmpty ? _menuSearchQuery : 'marketplace.search_in_menu'.tr(),
                                  style: TextStyle(
                                    fontSize: 14, 
                                    color: _menuSearchQuery.isNotEmpty ? textPrimary : Colors.grey[500],
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 12),
                            ],
                          ),
                        ),
                      )
                    : ThreeDimensionalPillTabBar(
                        margin: EdgeInsets.zero,
                        activeColor: accent,
                        selectedIndex: _deliveryModeIndex,
                        tabs: [
                          TabItem(
                            title: tr('delivery_modes.delivery'),
                            subtitle: _getEstimatedDeliveryTime(),
                            icon: Icons.delivery_dining,
                          ),
                          TabItem(
                            title: tr('delivery_modes.pickup'),
                            subtitle: _getEstimatedPickupTime(),
                            icon: Icons.shopping_bag_outlined,
                          ),
                          // Show Masa tab if business supports dine-in or reservations
                          if ((data?['hasReservation'] as bool? ?? false) ||
                              (_planFeatures['dineInQR'] == true) ||
                              (_planFeatures['waiterOrder'] == true))
                            TabItem(
                              title: tr('delivery_modes.dine_in'), 
                              subtitle: _getEstimatedDineInTime(),
                              icon: Icons.restaurant,
                            ),
                        ],
                        onTabSelected: (index) {
                          setState(() => _deliveryModeIndex = index);
                        },
                      ),
                titleSpacing: 0,
                centerTitle: true,
                actions: [
                  if (!_showSearchBar)
                    Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: GestureDetector(
                        onTap: () => _showMenuSearchOverlay(),
                        child: SizedBox(
                          width: 40, height: 40,
                          child: Icon(Icons.search, color: isDark ? Colors.grey[400] : Colors.grey[600], size: 22),
                        ),
                      ),
                    )
                  else
                    const SizedBox(width: 48),
                ],
              ),
              
              // Small spacer between toggle and card content
              const SliverToBoxAdapter(child: SizedBox(height: 8)),

              // 🔥 ACTIVE DEALS BANNER
              SliverToBoxAdapter(
                child: (_butcherDoc != null)
                    ? FutureBuilder<List<BusinessDeal>>(
                        future: BusinessDealsService.getActiveDeals(_butcherDoc!.id),
                        builder: (context, dealSnap) {
                          if (!dealSnap.hasData || dealSnap.data!.isEmpty) return const SizedBox.shrink();
                          final deals = dealSnap.data!;
                          return Padding(
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [const Color(0xFFFB335B).withValues(alpha: 0.08), const Color(0xFFFF6B6B).withValues(alpha: 0.04)],
                                ),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFFB335B).withValues(alpha: 0.25)),
                              ),
                              child: Row(
                                children: [
                                  const Text('🔥', style: TextStyle(fontSize: 20)),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      deals.map((d) => d.badgeText).join(' \u2022 '),
                                      style: const TextStyle(
                                        color: Color(0xFFFB335B),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      )
                    : const SizedBox.shrink(),
              ),

              // 2. HERO IMAGE (separate sliver, not part of AppBar)
              SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          // Business Image
                          (data?['imageUrl'] != null && (data!['imageUrl'] as String).isNotEmpty)
                              ? CachedNetworkImage(
                                  imageUrl: data['imageUrl'],
                                  fit: BoxFit.cover,
                                )
                              : Image.asset('assets/images/kasap_card.png', fit: BoxFit.cover),
                          
                          // Logo (Bottom Left - Lieferando style)
                          if (data?['logoUrl'] != null && (data!['logoUrl'] as String).isNotEmpty)
                            Positioned(
                              left: 12,
                              bottom: 12,
                              child: Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surface,
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: [BoxShadow(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.2), blurRadius: 8)],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: CachedNetworkImage(
                                    imageUrl: data['logoUrl'],
                                    fit: BoxFit.cover,
                                  ),
                                ),
                              ),
                            ),
                          // Brand Badge (Top Left - standardized pill matching list view)
                          if (showBrandBadge)
                            Positioned(
                              top: 12,
                              left: 12,
                              child: GestureDetector(
                                onTap: isTunaPartner ? _showTunaBrandInfo : null,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFA01E22),
                                    borderRadius: BorderRadius.circular(16),
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
                                      const Icon(Icons.verified, color: Colors.white, size: 14),
                                      const SizedBox(width: 4),
                                      Text(
                                        isTunaPartner ? 'TUNA' : _getBrandLabel(brand).toUpperCase(),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                                      if (isTunaPartner) ...[
                                        const SizedBox(width: 4),
                                        const Icon(Icons.info_outline, color: Colors.white, size: 15),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          // Favorite Heart (Top Right - overlay on image)
                          Positioned(
                            right: 12,
                            top: 12,
                            child: Material(
                              color: isFavorite 
                                  ? accent.withValues(alpha: 0.9) 
                                  : Colors.black.withValues(alpha: 0.4),
                              borderRadius: BorderRadius.circular(20),
                              child: InkWell(
                                onTap: () {
                                  ref.read(butcherFavoritesProvider.notifier).toggleFavorite(widget.businessId);
                                },
                                borderRadius: BorderRadius.circular(20),
                                child: Padding(
                                  padding: const EdgeInsets.all(8),
                                  child: Icon(
                                    isFavorite ? Icons.favorite : Icons.favorite_border,
                                    color: Theme.of(context).colorScheme.surface,
                                    size: 22,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // 2. Lieferando-Style Info Section (Clean & Compact)
              SliverToBoxAdapter(
                 child: Container(
                   padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                   child: Column(
                     crossAxisAlignment: CrossAxisAlignment.start,
                     children: [
                       // 2a. Business Name + Info Button (Lieferando: name + "Über uns")
                       Row(
                         children: [
                           Expanded(
                             child: Column(
                               crossAxisAlignment: CrossAxisAlignment.start,
                               children: [
                                 Text(
                                   data?['companyName'] ?? data?['name'] ?? 'common.business'.tr(),
                                   style: TextStyle(
                                     color: Theme.of(context).colorScheme.onSurface,
                                     fontSize: 24,
                                     fontWeight: FontWeight.w600,
                                     letterSpacing: -0.5,
                                   ),
                                   maxLines: 2,
                                   overflow: TextOverflow.ellipsis,
                                 ),
                                 // In masa mode: show table info + order type
                                 if (_isMasaMode && widget.initialTableNumber != null)
                                   Padding(
                                     padding: const EdgeInsets.only(top: 2),
                                     child: Text(
                                       '(${tr('delivery_modes.dine_in')} ${widget.initialTableNumber}${_isGroupMode ? ' / ${tr('orders.label_group_order')}' : ' / ${tr('cart.single_person_order')}'})',
                                       style: TextStyle(
                                         color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                                         fontSize: 14,
                                         fontWeight: FontWeight.w400,
                                       ),
                                     ),
                                   ),
                               ],
                             ),
                           ),
                           const SizedBox(width: 8),
                           // Info Button (compact Lieferando style)
                           Material(
                             color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[200],
                             borderRadius: BorderRadius.circular(16),
                             child: InkWell(
                               onTap: _showInfoSheet,
                               borderRadius: BorderRadius.circular(16),
                               child: Padding(
                                 padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                 child: Row(
                                   mainAxisSize: MainAxisSize.min,
                                   children: [
                                     Icon(
                                       Icons.info_outline,
                                       color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                       size: 16,
                                     ),
                                     const SizedBox(width: 4),
                                     Text(
                                       'business_details.about_us'.tr(),
                                       style: TextStyle(
                                         color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                         fontSize: 13,
                                         fontWeight: FontWeight.w600,
                                       ),
                                     ),
                                   ],
                                 ),
                               ),
                             ),
                           ),

                         ],
                       ),
                       
                       const SizedBox(height: 8),
                       
                       // 2b. Stats Line (Lieferando: ★ 4.5 · Open/Closed · Delivery info)
                       // In masa mode: simplified - only cuisine type + open/closed
                       Wrap(
                         spacing: 12,
                         runSpacing: 8,
                         crossAxisAlignment: WrapCrossAlignment.center,
                         children: [
                           // Rating (hidden in masa mode)
                           if (!_isMasaMode) ...[
                             if (_placeDetails != null)
                               InkWell(
                                 onTap: _showRatings,
                                 child: Row(
                                   mainAxisSize: MainAxisSize.min,
                                   children: [
                                     const Icon(Icons.star, color: Colors.amber, size: 16),
                                     const SizedBox(width: 4),
                                     Text(
                                       '${_placeDetails!['rating']} (${_placeDetails!['user_ratings_total']}+)',
                                       style: TextStyle(
                                         color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                                         fontSize: 13,
                                         fontWeight: FontWeight.w500,
                                       ),
                                     ),
                                   ],
                                 ),
                               )
                              else if ((data?['rating'] as num?)?.toDouble() != null && (data?['rating'] as num).toDouble() > 0)
                                InkWell(
                                  onTap: _showRatings,
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.star, color: Colors.amber, size: 16),
                                      const SizedBox(width: 4),
                                      Text(
                                        '${(data!['rating'] as num).toDouble().toStringAsFixed(1).replaceAll('.', ',')}${(data['reviewCount'] as num?)?.toInt() != null && (data['reviewCount'] as num).toInt() > 0 ? ' (${data['reviewCount']})' : ''}',
                                        style: TextStyle(
                                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                             
                             // Separator
                             Text('·', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                           ],

                           // Masa Rezervasyon (only shown in masa mode)
                           if (_isMasaMode && (data?["hasReservation"] as bool? ?? false)) ...[
                             GestureDetector(
                               onTap: () {
                                 HapticFeedback.selectionClick();
                                 final butcherName = data?["companyName"] ?? data?["name"] ?? "";
                                 Navigator.of(context).push(
                                   MaterialPageRoute(
                                     builder: (_) => ReservationBookingScreen(
                                       businessId: widget.businessId,
                                       businessName: butcherName,
                                     ),
                                   ),
                                 );
                               },
                               child: Row(
                                 mainAxisSize: MainAxisSize.min,
                                 children: [
                                   SvgPicture.asset(
                                     "assets/images/icon_masa_rezervasyon.svg",
                                     width: 16,
                                     height: 16,
                                     colorFilter: ColorFilter.mode(
                                       Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                       BlendMode.srcIn,
                                     ),
                                   ),
                                   const SizedBox(width: 4),
                                   Text(
                                      tr('marketplace.table_reservation'),
                                     style: TextStyle(
                                       fontSize: 13,
                                       fontWeight: FontWeight.w500,
                                       color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                     ),
                                   ),
                                 ],
                               ),
                             ),
                             Text('·', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                           ],

                           // Business / Cuisine Type
                           if ((data?['cuisineType']?.toString() ?? '').isNotEmpty) ...[
                             Text(
                               data!['cuisineType'].toString(),
                               style: TextStyle(
                                 color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                 fontSize: 13,
                               ),
                             ),
                             Text('·', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                           ] else if ((data?['type']?.toString() ?? '').isNotEmpty) ...[
                             Text(
                               'marketplace.business_type_${data!['type'].toString().toLowerCase()}'.tr(),
                               style: TextStyle(
                                 color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                 fontSize: 13,
                               ),
                             ),
                             Text('·', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                           ],
                           
                           // Open/Closed Status
                           InkWell(
                             onTap: _showWeeklyHours,
                             child: Row(
                               mainAxisSize: MainAxisSize.min,
                               children: [
                                 Container(
                                   width: 6, height: 6,
                                   decoration: BoxDecoration(
                                     color: isPausedForCurrentTab
                                         ? Colors.orange
                                         : (isOpen ? Colors.green : Colors.red),
                                     shape: BoxShape.circle,
                                   ),
                                 ),
                                 const SizedBox(width: 4),
                                 Flexible(
                                   child: Text(
                                     isPausedForCurrentTab
                                         ? (pauseRemainingMinutes != null
                                             ? (_deliveryModeIndex == 0
                                                 ? tr('marketplace.delivery_resumes_in', namedArgs: {'minutes': '$pauseRemainingMinutes'})
                                                 : tr('marketplace.pickup_resumes_in', namedArgs: {'minutes': '$pauseRemainingMinutes'}))
                                             : (_deliveryModeIndex == 0
                                                 ? tr('marketplace.courier_not_available')
                                                 : tr('marketplace.pickup_paused')))
                                         : (isOpen ? tr('business_status.open') : tr('business_status.closed')),
                                     style: TextStyle(
                                       color: isPausedForCurrentTab
                                           ? Colors.orange
                                           : (isOpen ? Colors.green : Colors.red),
                                       fontSize: isPausedForCurrentTab ? 11 : 13,
                                       fontWeight: FontWeight.w600,
                                     ),
                                     maxLines: 1,
                                     overflow: TextOverflow.ellipsis,
                                   ),
                                 ),
                               ],
                             ),
                           ),
                           
                           // Delivery Fee (hidden in masa mode)
                           if (!_isMasaMode && (data?['deliveryFee'] as num?)?.toDouble() != null) ...[
                             Text('·', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                             Row(
                               mainAxisSize: MainAxisSize.min,
                               children: [
                                 Icon(Icons.delivery_dining, size: 14, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                                 const SizedBox(width: 3),
                                 Text(
                                   (data!['deliveryFee'] as num).toDouble() == 0
                                       ? tr('marketplace.free_delivery_label')
                                       : '${(data!['deliveryFee'] as num).toDouble().toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()} ${tr('common.delivery')}',
                                   style: TextStyle(
                                     color: (data!['deliveryFee'] as num).toDouble() == 0
                                         ? const Color(0xFF4CAF50)
                                         : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                     fontSize: 13,
                                     fontWeight: (data!['deliveryFee'] as num).toDouble() == 0 ? FontWeight.w600 : FontWeight.w400,
                                   ),
                                 ),
                               ],
                             ),
                           ],

                           // Min Order (hidden in masa mode)
                           if (!_isMasaMode && (data?['minDeliveryOrder'] ?? 0) > 0) ...[
                             Text('·', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                             Text(
                               'Min. ${data!['minDeliveryOrder']}${CurrencyUtils.getCurrencySymbol()}',
                               style: TextStyle(
                                 color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                 fontSize: 13,
                               ),
                             ),
                           ],

                         ],
                       ),
                     ],
                   ),
                 ),
              ),

              // 3. LIEFERANDO STYLE: Sticky Horizontal Category Tabs
              SliverPersistentHeader(
                pinned: true,
                delegate: _StickyTabDelegate(
                  minHeight: 52,
                  maxHeight: 52,
                  child: Container(
                    color: scaffoldBg,
                    child: Column(
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              // Scrollable category chips with sliding pill
                              Expanded(
                                child: Builder(
                                  builder: (context) {
                                    // Only show categories that have products (or 'Tümü')
                                    final visibleCategories = _categories.where((c) => c['name'] == 'Tümü' || _allProducts.any((p) => p.category == c['name'])).toList();
                                    
                                    // Schedule pill position initialization
                                    if (!_pillInitialized) {
                                      WidgetsBinding.instance.addPostFrameCallback((_) {
                                        if (mounted) _updatePillPosition();
                                      });
                                    }
                                    
                                    return SingleChildScrollView(
                                      controller: _chipScrollController,
                                      scrollDirection: Axis.horizontal,
                                      padding: const EdgeInsets.only(left: 16, right: 4, top: 8, bottom: 8),
                                      child: Stack(
                                        alignment: Alignment.centerLeft,
                                        children: [
                                          // 1. Sliding pill indicator (painted first = behind)
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
                                                  color: isDark ? Colors.white : const Color(0xFF3E3E3F),
                                                  borderRadius: BorderRadius.circular(50),
                                                  boxShadow: [
                                                    BoxShadow(
                                                      color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.12),
                                                      blurRadius: 8,
                                                      offset: const Offset(0, 2),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          // 2. Chip texts row (painted second = on top of pill)
                                          Row(
                                            key: _chipRowKey,
                                            children: visibleCategories.map((cat) {
                                              final catName = cat['name'] as String;
                                              final isSelected = _selectedCategory == catName;
                                              final cartItems = ref.watch(cartProvider).items;
                                              final catCartCount = catName == 'Tümü'
                                                  ? cartItems.fold<int>(0, (sum, ci) => sum + ci.quantity.toInt())
                                                  : cartItems.where((ci) => ci.product.category == catName).fold<int>(0, (sum, ci) => sum + ci.quantity.toInt());
                                              return Padding(
                                                padding: const EdgeInsets.only(right: 6),
                                                child: GestureDetector(
                                                  onTap: () => _selectCategory(catName),
                                                  child: Container(
                                                    key: _tabKeys.putIfAbsent(catName, () => GlobalKey()),
                                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
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
                                                          child: Text(
                                                            catName == 'Tümü' ? tr('business_details.all') : catName,
                                                          ),
                                                        ),
                                                        if (catCartCount > 0) ...[
                                                          const SizedBox(width: 6),
                                                          AnimatedContainer(
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
                                                        ],
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              );
                                            }).toList(),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
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
                        ),
                        Divider(height: 1, color: dividerColor),
                      ],
                    ),
                  ),
                ),
              ),

              // 4. Products List/Grid Generation
              if (isSearching) ...[
                // Flat list/grid for search results
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  sliver: SliverToBoxAdapter(
                    child: Text(
                      'Suchergebnisse (${searchResults.length})', 
                      style: TextStyle(color: textPrimary, fontSize: 20, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: _isMarketType ? const EdgeInsets.symmetric(horizontal: 12) : EdgeInsets.zero,
                  sliver: searchResults.isEmpty 
                    ? SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(40.0),
                          child: Center(
                              child: Text(
                                'marketplace.no_results_found'.tr(), 
                                style: TextStyle(color: textSecondary),
                              )),
                        ),
                      )
                    : _isMarketType
                      // 🛒 MARKET: Grid layout for search results
                      ? SliverGrid(
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            childAspectRatio: 0.56,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                          ),
                          delegate: SliverChildBuilderDelegate(
                            (context, index) => _buildMarketGridCard(
                              searchResults[index],
                              ref.watch(cartProvider),
                              isDark: isDark,
                              accent: accent,
                              cardBg: cardBg,
                              textPrimary: textPrimary,
                              textSecondary: textSecondary,
                            ),
                            childCount: searchResults.length,
                          ),
                        )
                      // 🍽️ RESTORAN: List layout for search results
                      : SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) => _buildLieferandoProductCard(
                              searchResults[index], 
                              ref.watch(cartProvider),
                              isDark: isDark,
                              accent: accent,
                              cardBg: cardBg,
                              textPrimary: textPrimary,
                              textSecondary: textSecondary,
                            ),
                            childCount: searchResults.length,
                          ),
                        ),
                ),
              ] else ...[
              // Category Grouped List/Grid
              ..._categories.where((c) => c['name'] != 'Tümü').expand((cat) {
                final catName = cat['name'] as String;
                final catProducts = products.where((p) => p.category == catName).toList();
                
                if (catProducts.isEmpty) return <Widget>[];

                return <Widget>[
                  SliverToBoxAdapter(
                    child: Container(
                      key: _categoryKeys.putIfAbsent(catName, () => GlobalKey()),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Category Header with cart count badge
                          Builder(builder: (context) {
                            final catCartCount = ref.watch(cartProvider).items
                                .where((ci) => ci.product.category == catName).fold<int>(0, (sum, ci) => sum + ci.quantity.toInt());
                            return Container(
                              width: double.infinity,
                              color: isDark ? const Color(0xFF2C2C2C).withValues(alpha: 0.6) : const Color(0xFFF2EEE9),
                              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      catName,
                                      style: TextStyle(
                                        color: isDark ? accent : textPrimary,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                                  ),
                                  if (catCartCount > 0)
                                    Container(
                                      width: 24,
                                      height: 24,
                                      decoration: BoxDecoration(
                                        color: isDark ? Colors.white : Colors.black87,
                                        shape: BoxShape.circle,
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        '$catCartCount',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: isDark ? Colors.black : Colors.white,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          }),
                          // Products: Grid for market, List for restoran
                          _isMarketType
                            // 🛒 MARKET: 2-column grid
                            ? Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                child: GridView.builder(
                                  physics: const NeverScrollableScrollPhysics(),
                                  shrinkWrap: true,
                                  padding: EdgeInsets.zero,
                                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 2,
                                    childAspectRatio: 0.56,
                                    crossAxisSpacing: 10,
                                    mainAxisSpacing: 10,
                                  ),
                                  itemCount: catProducts.length,
                                  itemBuilder: (context, index) => _buildMarketGridCard(
                                    catProducts[index],
                                    ref.watch(cartProvider),
                                    isDark: isDark,
                                    accent: accent,
                                    cardBg: cardBg,
                                    textPrimary: textPrimary,
                                    textSecondary: textSecondary,
                                  ),
                                ),
                              )
                            // 🍽️ RESTORAN: Vertical list
                            : ListView.builder(
                                physics: const NeverScrollableScrollPhysics(),
                                shrinkWrap: true,
                                padding: EdgeInsets.zero,
                                itemCount: catProducts.length,
                                itemBuilder: (context, index) => _buildLieferandoProductCard(
                                  catProducts[index], 
                                  ref.watch(cartProvider),
                                  isDark: isDark,
                                  accent: accent,
                                  cardBg: cardBg,
                                  textPrimary: textPrimary,
                                  textSecondary: textSecondary,
                                ),
                              ),
                        ],
                      ),
                    ),
                  ),
                ];
              }),
            ],

            // Impressum at bottom of menu
            SliverToBoxAdapter(
              child: Builder(
                builder: (context) {
                  final isDarkMode = Theme.of(context).brightness == Brightness.dark;
                  final textColor = isDarkMode ? Colors.white : Colors.black87;
                  final subtitleColor = isDarkMode ? Colors.grey[400]! : Colors.grey[600]!;
                  final butcherData = _butcherDoc?.data() as Map<String, dynamic>?;
                  
                  if (butcherData == null) return const SizedBox.shrink();
                  
                  return Container(
                    margin: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDarkMode ? const Color(0xFF1A1A1A) : const Color(0xFFF5F0E8),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Impressum',
                          style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 12),
                        _buildImpressumSection(butcherData, textColor, subtitleColor),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Bottom Spacer
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          );
        },
      ),
    );
  }


  Widget _buildCartBar() {
     final cart = ref.watch(cartProvider);
     
     if (cart.isEmpty) {
       // Reset min order state when cart is empty
       if (_minOrderReached) {
         _minOrderReached = false;
         _showMinOrderSuccess = false;
         _minOrderSuccessTimer?.cancel();
       }
       return const SizedBox.shrink();
     }
     
     final isDark = Theme.of(context).brightness == Brightness.dark;
     final accent = _getAccent(context);
     final currency = CurrencyUtils.getCurrencySymbol();

     // Min order value from business data
     final butcherData = _butcherDoc?.data() as Map<String, dynamic>?;
     final minOrder = (butcherData?['minDeliveryOrder'] as num?)?.toDouble() ?? (butcherData?['minOrderAmount'] as num?)?.toDouble() ?? 0.0;
     final cartTotal = cart.totalAmount;
     final remaining = minOrder - cartTotal;
     final isDeliveryMode = _deliveryModeIndex == 0 && !_isMasaMode;
     final itemCount = cart.items.fold<int>(0, (sum, item) => sum + (item.quantity is int ? item.quantity.toInt() : item.quantity.round()));

     // Track min order reached transition
     if (minOrder > 0 && isDeliveryMode) {
       if (remaining <= 0 && !_minOrderReached) {
         // Just reached the minimum!
         _minOrderReached = true;
         _showMinOrderSuccess = true;
         HapticFeedback.mediumImpact();
         _minOrderSuccessTimer?.cancel();
         _minOrderSuccessTimer = Timer(const Duration(seconds: 2), () {
           if (mounted) setState(() => _showMinOrderSuccess = false);
         });
       } else if (remaining > 0 && _minOrderReached) {
         // Dropped below minimum again
         _minOrderReached = false;
         _showMinOrderSuccess = false;
         _minOrderSuccessTimer?.cancel();
       }
     }

     // Should we show the banner?
     final showBanner = minOrder > 0 && isDeliveryMode && (remaining > 0 || _showMinOrderSuccess);
     final isSuccess = remaining <= 0 && _showMinOrderSuccess;

     return Container(
       margin: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(context).padding.bottom + 12),
       child: Column(
         mainAxisSize: MainAxisSize.min,
         children: [
           if (showBanner)
             Container(
               margin: const EdgeInsets.only(bottom: 6),
               padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
               decoration: BoxDecoration(
                 color: isDark ? const Color(0xFF2A2A2C) : const Color(0xFFEEEEEE),
                 borderRadius: BorderRadius.circular(16),
               ),
               child: Row(
                 mainAxisAlignment: MainAxisAlignment.center,
                 children: [
                   Icon(
                     isSuccess ? Icons.check_circle_outline : Icons.pedal_bike,
                     size: 18,
                     color: isSuccess
                         ? (isDark ? const Color(0xFF81C784) : const Color(0xFF2E7D32))
                         : (isDark ? Colors.white70 : Colors.black54),
                   ),
                   const SizedBox(width: 8),
                   Flexible(
                     child: Text(
                       isSuccess
                           ? 'marketplace.min_order_success'.tr()
                           : 'marketplace.min_order_remaining'.tr(namedArgs: {
                               'amount': remaining.toStringAsFixed(2),
                               'currency': currency,
                             }),
                       style: TextStyle(
                         fontSize: 14,
                         fontWeight: FontWeight.w500,
                         color: isSuccess
                             ? (isDark ? const Color(0xFF81C784) : const Color(0xFF2E7D32))
                             : (isDark ? Colors.white70 : Colors.black87),
                       ),
                       textAlign: TextAlign.center,
                     ),
                   ),
                 ],
               ),
             ),
             
           // Cart Button Pill
           Padding(
             padding: EdgeInsets.all(showBanner ? 8.0 : 0.0),
             child: Material(
               color: accent,
               borderRadius: BorderRadius.circular(28),
               elevation: showBanner ? 0 : 4,
               shadowColor: accent.withValues(alpha: 0.4),
               child: InkWell(
                 borderRadius: BorderRadius.circular(28),
                 onTap: () {
                   HapticFeedback.selectionClick();
                   Navigator.of(context).push(
                     MaterialPageRoute(builder: (context) => CartScreen(initialPickUp: _deliveryModeIndex == 1, initialDineIn: _isMasaMode, initialTableNumber: widget.initialTableNumber)),
                   );
                 },
                 child: Padding(
                   padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                   child: Row(
                     children: [
                       // Cart icon with badge
                       Stack(
                         clipBehavior: Clip.none,
                         children: [
                           const Icon(Icons.shopping_basket, color: Colors.white, size: 24),
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
                           _isMasaMode ? 'cart.send_order'.tr() : 'cart.view_cart'.tr(),
                           style: const TextStyle(
                             color: Colors.white,
                             fontSize: 16,
                             fontWeight: FontWeight.w600,
                           ),
                         ),
                       ),
                       // Price on right
                       Text(
                         '${cartTotal.toStringAsFixed(2)} $currency',
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
             ),
           ),
         ],
       ),
     );
  }

  // Instagram-style animated heart overlay for favorite toggle
  void _showFavoriteHeartOverlay(BuildContext ctx, bool isNowFavorite) {
    late OverlayEntry overlayEntry;
    overlayEntry = OverlayEntry(
      builder: (context) => _FavoriteHeartAnimation(
        isAdded: isNowFavorite,
        onComplete: () => overlayEntry.remove(),
      ),
    );
    Overlay.of(ctx).insert(overlayEntry);
  }

  // Masa Pre-Order Prompt - shown on first "+" tap in Masa mode
  void _showMasaPreOrderPrompt(ButcherProduct product) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      isDismissible: false,
      enableDrag: false,
      builder: (ctx) => Container(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[600] : Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 24),
                
                // Icon
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFB335B).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(36),
                  ),
                  child: const Icon(
                    Icons.restaurant_menu_rounded,
                    color: Color(0xFFFB335B),
                    size: 36,
                  ),
                ),
                const SizedBox(height: 20),
                
                // Title
                Text(
                  'masa.preorder_title'.tr(),
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                
                // Description
                Text(
                  'masa.preorder_desc'.tr(),
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                
                // Button 1: Pre-order
                GestureDetector(
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    setState(() {
                      _masaPreOrderPromptShown = true;
                      _masaPreOrderEnabled = true;
                    });
                    Navigator.pop(ctx);
                    // Carry through the original add action
                    if (product.optionGroups.isNotEmpty) {
                      _showProductBottomSheet(product);
                    } else {
                      final data = _butcherDoc?.data() as Map<String, dynamic>?;
                      final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
                      ref.read(cartProvider.notifier).addToCart(
                        product,
                        product.unitType.toLowerCase() == 'kg' ? product.minQuantity : 1,
                        widget.businessId,
                        butcherName,
                      );
                      setState(() {});
                    }
                  },
                  child: Container(
                    width: double.infinity,
                    height: 52,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFB335B),
                      borderRadius: BorderRadius.circular(26),
                    ),
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'masa.preorder_yes'.tr(),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                
                // Button 2: Just browse
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    setState(() {
                      _masaPreOrderPromptShown = true;
                      _masaPreOrderEnabled = false;
                    });
                    Navigator.pop(ctx);
                  },
                  child: Container(
                    width: double.infinity,
                    height: 52,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF5F5F5),
                      borderRadius: BorderRadius.circular(26),
                      border: Border.all(
                        color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                        width: 0.5,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.menu_book_rounded, 
                          color: isDark ? Colors.grey[400] : Colors.grey[700], size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'masa.preorder_no'.tr(),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: isDark ? Colors.grey[300] : Colors.grey[700],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // LIEFERANDO STYLE: Unified Product Bottom Sheet
  void _showProductBottomSheet(ButcherProduct product) {
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ProductCustomizationSheet(
        product: product,
        businessId: widget.businessId,
        businessName: butcherName,
      ),
    );
  }



  // LIEFERANDO STYLE: Horizontal Product Card (List Item)
  Widget _buildLieferandoProductCard(
    ButcherProduct product, 
    CartState cart, {
    required bool isDark,
    required Color accent,
    required Color cardBg,
    required Color textPrimary,
    required Color textSecondary,
  }) {
    final isByWeight = product.unitType == 'kg';
    // Find all cart items for this product (may be multiple with different options)
    final productCartItems = cart.items.where((item) => item.product.sku == product.sku).toList();
    final inCart = productCartItems.isNotEmpty;
    final totalQtyInCart = productCartItems.fold(0.0, (sum, item) => sum + item.quantity);
    
    final isAvailable = (product.inStock || product.allowBackorder) && !product.outOfStock;
    final hasImage = product.imageUrl?.isNotEmpty == true;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Opacity(
          opacity: isAvailable ? 1.0 : 0.55,
          child: InkWell(
            onTap: isAvailable
                ? () => _showProductBottomSheet(product)
                : () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Row(
                          children: [
                            Icon(Icons.remove_shopping_cart_outlined, color: Colors.white, size: 18),
                            const SizedBox(width: 10),
                            Text(
                              product.outOfStock ? 'marketplace.product_out_of_stock_desc'.tr() : 'marketplace.product_not_available_desc'.tr(),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                        duration: const Duration(seconds: 2),
                        behavior: SnackBarBehavior.floating,
                        margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey[800],
                      ),
                    );
                  },
            onLongPress: () {
              HapticFeedback.heavyImpact();
              final favs = ref.read(productFavoritesProvider);
              final wasFav = favs.contains(product.sku);
              ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(
                product.sku,
                businessId: widget.businessId,
                productName: product.name,
                imageUrl: product.imageUrl ?? '',
                price: product.effectiveAppPrice,
              );
              _showFavoriteHeartOverlay(context, !wasFav);
            },
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
                        // Title + favorite heart
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Flexible(
                              child: Text(
                                product.name,
                                style: TextStyle(
                                  color: isAvailable ? textPrimary : textSecondary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  height: 1.2,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (ref.watch(productFavoritesProvider).contains(product.sku)) ...[
                              const SizedBox(width: 4),
                              Icon(
                                Icons.favorite_rounded,
                                color: const Color(0xFFFB335B),
                                size: 14,
                              ),
                            ],
                          ],
                        ),
                        // "Nicht verfügbar" label (Lieferando-style)
                        if (!isAvailable) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: product.outOfStock
                                  ? Colors.orange.withValues(alpha: 0.15)
                                  : (isDark ? Colors.white10 : Colors.grey[200]!),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              product.outOfStock ? 'marketplace.out_of_stock'.tr() : 'marketplace.product_not_available'.tr(),
                              style: TextStyle(
                                color: product.outOfStock ? Colors.orange : textSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 6),
                        // Description (Ingredients)
                        if (product.description.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8.0),
                            child: Text(
                              product.description,
                              style: TextStyle(
                                color: textSecondary,
                                fontSize: 13,
                                height: 1.3,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        // Price
                        Text(
                          '${CurrencyUtils.getCurrencySymbol()}${product.effectiveAppPrice.toStringAsFixed(2)}${isByWeight ? '/kg' : ''}',
                          style: TextStyle(
                            color: isAvailable ? textPrimary : textSecondary,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),

                        
                        // Selected extras inline
                        if (isAvailable && inCart && productCartItems.any((ci) => ci.selectedOptions.isNotEmpty))
                          ...productCartItems.where((ci) => ci.selectedOptions.isNotEmpty).map((ci) =>
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () {
                                    final data = _butcherDoc?.data() as Map<String, dynamic>?;
                                    final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
                                    showModalBottomSheet(
                                      context: context,
                                      isScrollControlled: true,
                                      backgroundColor: Colors.transparent,
                                      builder: (ctx) => ProductCustomizationSheet(
                                        product: product,
                                        businessId: widget.businessId,
                                        businessName: butcherName,
                                        existingItem: ci,
                                      ),
                                    );
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: isDark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFF5F0E8),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey[200]!,
                                        width: 0.5,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(Icons.edit_outlined, size: 12, color: textSecondary.withValues(alpha: 0.5)),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            ci.selectedOptions.map((o) => o.optionName).join(', '),
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: textSecondary,
                                              height: 1.2,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          '${CurrencyUtils.getCurrencySymbol()}${ci.unitPrice.toStringAsFixed(2)}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: textPrimary,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        if (ci.quantity > 0) ...[
                                          const SizedBox(width: 4),
                                          Container(
                                            width: 20,
                                            height: 20,
                                            decoration: BoxDecoration(
                                              color: isDark ? Colors.white : Colors.black87,
                                              shape: BoxShape.circle,
                                            ),
                                            alignment: Alignment.center,
                                            child: Text(
                                              '${ci.quantity.toInt()}',
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w600,
                                                color: Theme.of(context).colorScheme.surface,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Image & Add Button (Right)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Product Image (if any)
                      if (hasImage)
                        Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                width: 100,
                                height: 100,
                                color: isDark ? Colors.white10 : Colors.grey[100],
                                child: Image.network(
                                  product.imageUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Icon(
                                    Icons.restaurant_menu,
                                    size: 40,
                                    color: isDark ? Colors.white24 : Colors.grey[400],
                                  ),
                                ),
                              ),
                            ),

                          ],
                        ),
                        
                      if (hasImage) const SizedBox(height: 12),
                      
                      // Action Button (+ / Qty Badge) - Lieferando style
                      if (isAvailable)
                        GestureDetector(
                          onTap: () {
                            // Masa pre-order prompt check
                            if (_isMasaMode && !_masaPreOrderPromptShown) {
                              _showMasaPreOrderPrompt(product);
                              return;
                            }
                            
                            // + button tapped directly
                            if (product.optionGroups.isNotEmpty) {
                              // Has options -> open customization sheet
                              _showProductBottomSheet(product);
                            } else {
                              // No options -> add directly to cart
                              final data = _butcherDoc?.data() as Map<String, dynamic>?;
                              final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
                              HapticFeedback.mediumImpact();
                              ref.read(cartProvider.notifier).addToCart(
                                product,
                                isByWeight ? product.minQuantity : 1,
                                widget.businessId,
                                butcherName,
                              );
                              setState(() {});
                            }
                          },
                          child: inCart && product.optionGroups.isEmpty
                            // Show count badge (Lieferando style: dark circle with number)
                            ? Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: isDark ? Colors.white : Colors.black87,
                                  borderRadius: BorderRadius.circular(22),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  '${totalQtyInCart.toInt()}',
                                  style: TextStyle(
                                    color: isDark ? Colors.black : Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              )
                            // Show + button
                            : Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(
                                    color: isDark ? Colors.grey[800]! : Colors.grey[300]!,
                                    width: 1,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.05),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    )
                                  ],
                                ),
                                child: Icon(
                                  Icons.add,
                                  color: accent,
                                  size: 24,
                                ),
                              ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        // Separator Line
        Divider(
          height: 1,
          thickness: 0.5,
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.2),
        ),
      ],
    );
  }

  // 🛒 MARKET GRID CARD: 2-column image-focused card for market/kasap businesses
  Widget _buildMarketGridCard(
    ButcherProduct product,
    CartState cart, {
    required bool isDark,
    required Color accent,
    required Color cardBg,
    required Color textPrimary,
    required Color textSecondary,
  }) {
    final isByWeight = product.unitType == 'kg';
    final productCartItems = cart.items.where((item) => item.product.sku == product.sku).toList();
    final inCart = productCartItems.isNotEmpty;
    final totalQtyInCart = productCartItems.fold(0.0, (sum, item) => sum + item.quantity);
    final isAvailable = (product.inStock || product.allowBackorder) && !product.outOfStock;
    final hasImage = product.imageUrl?.isNotEmpty == true;

    // Default quantity step (in native unit: kg for weight items, pieces for count)
    final stepQty = isByWeight ? (product.stepQuantity > 0 ? product.stepQuantity : 0.5) : 1.0;
    final defaultQty = isByWeight ? (product.minQuantity > 0 ? product.minQuantity : 0.5) : 1.0;

    // When NOT in cart: use local _selections as quantity picker
    // When IN cart: display the cart quantity
    final selectedQty = _selections[product.sku] ?? defaultQty;
    final displayQty = inCart ? totalQtyInCart : selectedQty;
    final unitLabel = isByWeight ? (displayQty >= 1.0 ? 'kg' : 'gram') : 'Adet';
    // Convert kg to grams/kg for display
    final displayQtyText = isByWeight 
        ? (displayQty >= 1.0 
            ? '${displayQty.toStringAsFixed(displayQty == displayQty.roundToDouble() ? 0 : 1)}'
            : '${(displayQty * 1000).toInt()}')
        : '${displayQty.toInt()}';

    // Calculate total price for cart display
    final totalPrice = totalQtyInCart * product.effectiveAppPrice;
    // Calculate preview price (for non-cart state, based on selected qty)
    final previewPrice = selectedQty * product.effectiveAppPrice;

    return Opacity(
      opacity: isAvailable ? 1.0 : 0.55,
      child: GestureDetector(
        onTap: isAvailable
            ? () => _showProductBottomSheet(product)
            : () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Row(
                      children: [
                        Icon(Icons.remove_shopping_cart_outlined, color: Colors.white, size: 18),
                        const SizedBox(width: 10),
                        Text(
                          product.outOfStock ? 'marketplace.product_out_of_stock_desc'.tr() : 'marketplace.product_not_available_desc'.tr(),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                    duration: const Duration(seconds: 2),
                    behavior: SnackBarBehavior.floating,
                    margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey[800],
                  ),
                );
              },
        onLongPress: () {
          HapticFeedback.heavyImpact();
          final favs = ref.read(productFavoritesProvider);
          final wasFav = favs.contains(product.sku);
          ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(
            product.sku,
            businessId: widget.businessId,
            productName: product.name,
            imageUrl: product.imageUrl ?? '',
            price: product.effectiveAppPrice,
          );
          _showFavoriteHeartOverlay(context, !wasFav);
        },
        child: Container(
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade200, width: 0.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 📸 Product Image — landscape 4:3, smaller to give text more room
              AspectRatio(
                aspectRatio: 1.6,
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      hasImage
                          ? CachedNetworkImage(
                              imageUrl: product.imageUrl!,
                              fit: BoxFit.cover,
                              placeholder: (_, __) => Container(
                                color: isDark ? Colors.grey[900] : Colors.grey[100],
                                child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                              ),
                              errorWidget: (_, __, ___) => Container(
                                color: isDark ? Colors.grey[900] : Colors.grey[100],
                                child: Icon(Icons.image_not_supported, color: textSecondary, size: 40),
                              ),
                            )
                          : Container(
                              color: isDark ? Colors.grey[900] : Colors.grey[100],
                              child: Icon(Icons.restaurant_menu, color: textSecondary, size: 40),
                            ),
                      // Out of Stock Badge (top right)
                      if (!isAvailable)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: product.outOfStock
                                  ? Colors.orange.withValues(alpha: 0.85)
                                  : Colors.red.withValues(alpha: 0.85),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              product.outOfStock ? 'Stokta Yok' : tr('marketplace.unavailable'),
                              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),

                      // 🏷️ Cart quantity badge (top left) — shows gram/piece count
                      if (inCart)
                        Positioned(
                          top: 8,
                          left: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: accent,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: accent.withValues(alpha: 0.4),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Text(
                              isByWeight 
                                ? (totalQtyInCart >= 1.0 
                                    ? '${totalQtyInCart.toStringAsFixed(1)} kg' 
                                    : '${(totalQtyInCart * 1000).toInt()} g')
                                : '${totalQtyInCart.toInt()}x',
                              style: const TextStyle(
                                color: Colors.white, 
                                fontSize: 11, 
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // 📝 Product Info — compact padding
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 4, 10, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Name + favorite heart
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              product.name,
                              style: TextStyle(
                                color: textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                height: 1.2,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (ref.watch(productFavoritesProvider).contains(product.sku)) ...[
                            const SizedBox(width: 3),
                            Icon(
                              Icons.favorite_rounded,
                              color: const Color(0xFFFB335B),
                              size: 12,
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      // Price + unit — red accent
                      Row(
                        children: [
                          Text(
                            '${product.effectiveAppPrice.toStringAsFixed(product.effectiveAppPrice == product.effectiveAppPrice.roundToDouble() ? 0 : 2)} ${CurrencyUtils.getCurrencySymbol()}',
                            style: TextStyle(
                              color: accent,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 4),
                          if (isByWeight)
                            Text(
                              'Preis/kg',
                              style: TextStyle(
                                color: textSecondary,
                                fontSize: 10,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      // Description
                      if (product.description.isNotEmpty)
                        Text(
                          product.description,
                          style: TextStyle(
                            color: textSecondary,
                            fontSize: 11,
                            height: 1.3,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      const Spacer(),
                      
                      // ➕ Quantity controls — separate bordered buttons
                      // When NOT in cart: +/- adjust local selection (quantity picker)
                      // When IN cart: +/- directly adjust cart quantity
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Minus button
                          GestureDetector(
                            onTap: () {
                              if (inCart) {
                                if (productCartItems.isNotEmpty) {
                                  ref.read(cartProvider.notifier).removeFromCart(productCartItems.first.uniqueKey);
                                }
                              } else {
                                final current = _selections[product.sku] ?? defaultQty;
                                if (current > defaultQty) {
                                  setState(() => _selections[product.sku] = current - stepQty);
                                }
                              }
                            },
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF2A2A2C) : Colors.grey[100],
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isDark ? Colors.white.withValues(alpha: 0.15) : Colors.grey.shade300,
                                  width: 1,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '—',
                                style: TextStyle(
                                  color: (inCart || (selectedQty > defaultQty)) ? textPrimary : textSecondary.withValues(alpha: 0.3),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          // Quantity display
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    displayQtyText,
                                    style: TextStyle(
                                      color: textPrimary,
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                Text(
                                  unitLabel,
                                  style: TextStyle(
                                    color: textSecondary,
                                    fontSize: 9,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Plus button
                          GestureDetector(
                            onTap: isAvailable ? () {
                              if (inCart) {
                                if (product.optionGroups.isNotEmpty) {
                                  _showProductBottomSheet(product);
                                } else {
                                  final data = _butcherDoc?.data() as Map<String, dynamic>?;
                                  final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
                                  HapticFeedback.mediumImpact();
                                  ref.read(cartProvider.notifier).addToCart(
                                    product,
                                    isByWeight ? stepQty : 1,
                                    widget.businessId,
                                    butcherName,
                                  );
                                  setState(() {});
                                }
                              } else {
                                final current = _selections[product.sku] ?? defaultQty;
                                setState(() => _selections[product.sku] = current + stepQty);
                              }
                            } : null,
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF2A2A2C) : Colors.grey[100],
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isDark ? Colors.white.withValues(alpha: 0.15) : Colors.grey.shade300,
                                  width: 1,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '+',
                                style: TextStyle(
                                  color: accent,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 8),
                      
                      // 🛒 Sepete Ekle / Sepette button — BRAND RED
                      GestureDetector(
                        onTap: isAvailable ? () {
                          if (inCart) {
                            // Already in cart — go to cart or show sheet
                            _showProductBottomSheet(product);
                          } else {
                            // NOT in cart — add selected quantity
                            if (product.optionGroups.isNotEmpty) {
                              _showProductBottomSheet(product);
                            } else {
                              final data = _butcherDoc?.data() as Map<String, dynamic>?;
                              final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
                              final qtyToAdd = _selections[product.sku] ?? defaultQty;
                              HapticFeedback.mediumImpact();
                              ref.read(cartProvider.notifier).addToCart(
                                product,
                                qtyToAdd,
                                widget.businessId,
                                butcherName,
                              );
                              // Reset local selection after adding
                              setState(() => _selections.remove(product.sku));
                            }
                          }
                        } : null,
                        child: Container(
                          width: double.infinity,
                          height: 36,
                          decoration: BoxDecoration(
                            color: inCart ? Colors.green.shade600 : accent,
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: [
                              BoxShadow(
                                color: (inCart ? Colors.green : accent).withValues(alpha: 0.3),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  inCart ? Icons.check_circle_outline : Icons.shopping_cart_outlined,
                                  color: Colors.white,
                                  size: 14,
                                ),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      inCart 
                                        ? 'cart.in_cart_price'.tr(namedArgs: {'price': totalPrice.toStringAsFixed(2), 'currency': CurrencyUtils.getCurrencySymbol()})
                                        : 'cart.add_to_cart_price'.tr(namedArgs: {'price': previewPrice.toStringAsFixed(2), 'currency': CurrencyUtils.getCurrencySymbol()}),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
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
              ),
            ],
          ),
        ),
      ),
    );
  }

}

// LIEFERANDO STYLE: Sticky Header Delegate for Category Tabs
class _StickyTabDelegate extends SliverPersistentHeaderDelegate {
  final double minHeight;
  final double maxHeight;
  final Widget child;

  _StickyTabDelegate({
    required this.minHeight,
    required this.maxHeight,
    required this.child,
  });

  @override
  double get minExtent => minHeight;

  @override
  double get maxExtent => maxHeight;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return SizedBox.expand(child: child);
  }

  @override
  bool shouldRebuild(_StickyTabDelegate oldDelegate) {
    return maxHeight != oldDelegate.maxHeight ||
           minHeight != oldDelegate.minHeight ||
           child != oldDelegate.child;
  }
}

// 🔍 Full-screen menu search page with instant search
class _MenuSearchPage extends StatefulWidget {
  final String initialQuery;
  final ValueChanged<String> onSearch;
  final List<ButcherProduct> products;
  final String businessId;
  final String businessName;

  const _MenuSearchPage({
    required this.initialQuery,
    required this.onSearch,
    required this.products,
    required this.businessId,
    required this.businessName,
  });

  @override
  State<_MenuSearchPage> createState() => _MenuSearchPageState();
}

class _MenuSearchPageState extends State<_MenuSearchPage> {
  late TextEditingController _controller;
  late FocusNode _focusNode;
  String _localQuery = '';

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery);
    _localQuery = widget.initialQuery;
    _focusNode = FocusNode();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🪑 MASA (DINE-IN) HELPERS
  // ═══════════════════════════════════════════════════════════════════════════



  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  // 🇹🇷 Turkish character normalization for easier search
  String _normalizeTurkish(String text) {
    return text
        .toLowerCase()
        .replaceAll('ö', 'o')
        .replaceAll('ü', 'u')
        .replaceAll('ı', 'i')
        .replaceAll('ğ', 'g')
        .replaceAll('ş', 's')
        .replaceAll('ç', 'c')
        .replaceAll('İ', 'i')
        .replaceAll('Ö', 'o')
        .replaceAll('Ü', 'u')
        .replaceAll('Ğ', 'g')
        .replaceAll('Ş', 's')
        .replaceAll('Ç', 'c');
  }

  /// Extract all string values from a localization map (or plain string)
  List<String> _allLocalizedValues(dynamic data) {
    if (data == null) return [];
    if (data is String) return [data];
    if (data is Map) {
      return data.values
          .where((v) => v != null && v.toString().trim().isNotEmpty)
          .map((v) => v.toString().trim())
          .toList();
    }
    return [data.toString()];
  }

  List<ButcherProduct> get _filteredProducts {
    if (_localQuery.length < 2) return [];
    final query = _normalizeTurkish(_localQuery);
    return widget.products.where((p) {
      // Search across ALL language variants of name, description, category
      final allNames = _allLocalizedValues(p.nameData).isNotEmpty 
          ? _allLocalizedValues(p.nameData) 
          : [p.name];
      final allDescs = _allLocalizedValues(p.descriptionData).isNotEmpty 
          ? _allLocalizedValues(p.descriptionData) 
          : [p.description];
      final allCats = _allLocalizedValues(p.categoryData).isNotEmpty 
          ? _allLocalizedValues(p.categoryData) 
          : [p.category];

      return allNames.any((n) => _normalizeTurkish(n).contains(query)) ||
             allDescs.any((d) => _normalizeTurkish(d).contains(query)) ||
             allCats.any((c) => _normalizeTurkish(c).contains(query));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.grey[400] : Colors.grey[600];
    final accent = const Color(0xFFFB335B); // Brand color
    final topPadding = MediaQuery.of(context).padding.top;
    final filtered = _filteredProducts;

    // Group products by category
    final Map<String, List<ButcherProduct>> groupedProducts = {};
    for (final product in filtered) {
      final category = product.category.isNotEmpty ? product.category : 'Diğer';
      groupedProducts.putIfAbsent(category, () => []).add(product);
    }

    return Scaffold(
      backgroundColor: scaffoldBg,
      body: Column(
        children: [
          // Search Bar Header
          Container(
            padding: EdgeInsets.only(
              top: topPadding + 12,
              left: 16,
              right: 16,
              bottom: 12,
            ),
            decoration: BoxDecoration(
              color: scaffoldBg,
            ),
            child: Row(
              children: [
                // Search Input
                Expanded(
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF5F0E8),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Row(
                      children: [
                        const SizedBox(width: 16),
                        Icon(Icons.search, color: accent, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _controller,
                            focusNode: _focusNode,
                            style: TextStyle(fontSize: 16, color: textPrimary),
                            textInputAction: TextInputAction.search,
                            decoration: InputDecoration(
                              hintText: 'marketplace.search_in_menu'.tr(),
                              hintStyle: TextStyle(color: Colors.grey[500], fontSize: 16),
                              border: InputBorder.none,
                              contentPadding: EdgeInsets.zero,
                              isDense: true,
                            ),
                            onChanged: (value) {
                              setState(() => _localQuery = value);
                            },
                            onSubmitted: (value) {
                              widget.onSearch(value);
                              Navigator.of(context).pop();
                            },
                          ),
                        ),
                        const SizedBox(width: 16),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Close Button (X)
                GestureDetector(
                  onTap: () {
                    if (_controller.text.isNotEmpty) {
                      // First tap: clear text
                      _controller.clear();
                      setState(() => _localQuery = '');
                      _focusNode.requestFocus();
                    } else {
                      // Second tap (empty): close search
                      widget.onSearch('');
                      Navigator.of(context).pop();
                    }
                  },
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF5F0E8),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.close, color: textPrimary, size: 20),
                  ),
                ),
              ],
            ),
          ),
          // Search Results
          Expanded(
            child: _localQuery.length < 2
                ? Container(color: scaffoldBg) // Empty when query is short
                : filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_off, size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 12),
                            Text(
                              'marketplace.no_results_found'.tr(),
                              style: TextStyle(color: Colors.grey[500], fontSize: 16),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: groupedProducts.entries.fold<int>(
                          0, (sum, e) => sum + 1 + e.value.length), // Categories + products
                        itemBuilder: (context, index) {
                          // Build flat list with category headers
                          int currentIndex = 0;
                          for (final entry in groupedProducts.entries) {
                            // Category header
                            if (index == currentIndex) {
                              return Container(
                                margin: const EdgeInsets.only(top: 12, bottom: 4),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isDark ? Colors.white.withValues(alpha: 0.04) : const Color(0xFFF2EEE9),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  entry.key,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: textSecondary,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              );
                            }
                            currentIndex++;

                            // Products in this category
                            for (int i = 0; i < entry.value.length; i++) {
                              if (index == currentIndex) {
                                final product = entry.value[i];
                                final isLast = i == entry.value.length - 1;
                                return _buildProductResultItem(
                                  product, 
                                  isDark, 
                                  textPrimary, 
                                  textSecondary!, 
                                  accent, 
                                  isLast,
                                );
                              }
                              currentIndex++;
                            }
                          }
                          return const SizedBox.shrink();
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductResultItem(
    ButcherProduct product, 
    bool isDark, 
    Color textPrimary, 
    Color textSecondary, 
    Color accent,
    bool isLast,
  ) {
    final isByWeight = product.unitType == 'kg';
    final hasImage = product.imageUrl?.isNotEmpty == true;
    final isAvailable = product.inStock || product.allowBackorder;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final dividerColor = isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.withValues(alpha: 0.15);

    return Opacity(
      opacity: isAvailable ? 1.0 : 0.5,
      child: InkWell(
        onTap: () {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (ctx) => ProductCustomizationSheet(
              product: product,
              businessId: widget.businessId,
              businessName: widget.businessName,
            ),
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: cardBg,
            border: Border(
              bottom: BorderSide(color: dividerColor, width: 0.5),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Product Info (Left)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      product.name,
                      style: TextStyle(
                        color: textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (product.description.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        product.description,
                        style: TextStyle(
                          color: textSecondary,
                          fontSize: 13,
                          height: 1.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      '${CurrencyUtils.getCurrencySymbol()}${product.effectiveAppPrice.toStringAsFixed(2)}${isByWeight ? '/kg' : ''}',
                      style: TextStyle(
                        color: textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // Image + Add Button Stack (Right)
              SizedBox(
                width: 72,
                height: 72,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // Product Image
                    if (hasImage)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                          width: 72,
                          height: 72,
                          child: Image.network(
                            product.imageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              color: isDark ? Colors.white10 : Colors.grey[100],
                              child: Icon(Icons.image_not_supported, color: textSecondary, size: 24),
                            ),
                          ),
                        ),
                      )
                    else
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          isByWeight ? Icons.scale : Icons.inventory_2_outlined,
                          color: textSecondary,
                          size: 24,
                        ),
                      ),

                    // Floating + button (bottom-right, overlapping image)
                    if (isAvailable)
                      Positioned(
                        bottom: -6,
                        right: -6,
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: accent,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: accent.withValues(alpha: 0.3),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.add, color: Colors.white, size: 18),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Instagram-style animated heart overlay for favorite toggle feedback
class _FavoriteHeartAnimation extends StatefulWidget {
  final bool isAdded;
  final VoidCallback onComplete;

  const _FavoriteHeartAnimation({required this.isAdded, required this.onComplete});

  @override
  State<_FavoriteHeartAnimation> createState() => _FavoriteHeartAnimationState();
}

class _FavoriteHeartAnimationState extends State<_FavoriteHeartAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnim;
  late Animation<double> _opacityAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 900),
      vsync: this,
    );

    // Scale: 0 -> 1.4 (overshoot bounce) -> 1.0 then hold
    _scaleAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.4).chain(CurveTween(curve: Curves.easeOut)), weight: 35),
      TweenSequenceItem(tween: Tween(begin: 1.4, end: 1.0).chain(CurveTween(curve: Curves.elasticOut)), weight: 25),
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 40),
    ]).animate(_controller);

    // Opacity: fully visible for first 60%, then fade out
    _opacityAnim = TweenSequence<double>([
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 55),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0).chain(CurveTween(curve: Curves.easeIn)), weight: 45),
    ]).animate(_controller);

    _controller.forward().then((_) => widget.onComplete());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        child: Center(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return Opacity(
                opacity: _opacityAnim.value,
                child: Transform.scale(
                  scale: _scaleAnim.value,
                  child: Icon(
                    widget.isAdded ? Icons.favorite : Icons.favorite_border,
                    color: widget.isAdded ? Colors.redAccent : Colors.white,
                    size: 100,
                    shadows: [
                      Shadow(
                        color: Colors.black.withValues(alpha: 0.5),
                        blurRadius: 24,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
