import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'legal_report_sheet.dart';
import 'package:lokma_app/services/business_deals_service.dart';

import 'package:lokma_app/services/google_places_service.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/product_favorites_provider.dart';
import 'package:lokma_app/models/butcher_product.dart';
import 'package:lokma_app/data/product_catalog_data.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'cart_screen.dart';
import 'product_customization_sheet.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import '../../../utils/currency_utils.dart';

class BusinessDetailScreen extends ConsumerStatefulWidget {
  final String businessId;
  final int initialDeliveryMode;
  final String? initialTableNumber;
  final bool closedAcknowledged;
  
  const BusinessDetailScreen({super.key, required this.businessId, this.initialDeliveryMode = 0, this.initialTableNumber, this.closedAcknowledged = false});

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
        final openingHelper = OpeningHoursHelper(data['openingHours']);
        final isOpen = openingHelper.isOpenAt(DateTime.now());
        final preOrderEnabled = data['preOrderEnabled'] as bool? ?? false;
        
        if (!isOpen && !_closedDialogShown && !widget.closedAcknowledged) {
          _closedDialogShown = true;
          _showClosedBusinessDialog(preOrderEnabled: preOrderEnabled);
        }

        final googlePlaceId = data['googlePlaceId'] as String?;
        if (googlePlaceId != null && googlePlaceId.isNotEmpty && _placeDetails == null) {
          try {
            final details = await GooglePlacesService.getPlaceDetails(googlePlaceId);
            if (mounted) setState(() => _placeDetails = details);
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

  // 🆕 Kapalı işletme uyarı popup'ı — Beautiful Bottom Sheet
  void _showClosedBusinessDialog({bool preOrderEnabled = false}) {
    // Get business name
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    final businessName = data?['businessName'] ?? data?['companyName'] ?? 'common.business'.tr();
    
    // Calculate next opening time
    final openingHelper = OpeningHoursHelper(data?['openingHours']);
    final nextOpen = openingHelper.getNextOpenDateTime(DateTime.now());
    String? nextOpenText;
    if (nextOpen != null) {
      final dayNames = [
        'common.day_monday'.tr(),
        'common.day_tuesday'.tr(),
        'common.day_wednesday'.tr(),
        'common.day_thursday'.tr(),
        'common.day_friday'.tr(),
        'common.day_saturday'.tr(),
        'common.day_sunday'.tr(),
      ];
      final now = DateTime.now();
      final isToday = nextOpen.day == now.day && nextOpen.month == now.month && nextOpen.year == now.year;
      final tomorrow = now.add(const Duration(days: 1));
      final isTomorrow = nextOpen.day == tomorrow.day && nextOpen.month == tomorrow.month && nextOpen.year == tomorrow.year;
      
      final timeStr = '${nextOpen.hour.toString().padLeft(2, '0')}:${nextOpen.minute.toString().padLeft(2, '0')}';
      if (isToday) {
        nextOpenText = tr('marketplace.opens_today', namedArgs: {'time': timeStr});
      } else if (isTomorrow) {
        nextOpenText = tr('marketplace.opens_tomorrow', namedArgs: {'time': timeStr});
      } else {
        nextOpenText = tr('marketplace.opens_on_day', namedArgs: {'day': dayNames[nextOpen.weekday - 1], 'time': timeStr});
      }
    }
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      final isDark = Theme.of(context).brightness == Brightness.dark;
      final sheetBg = isDark ? const Color(0xFF1C1C1E) : Colors.white;
      final textPrimary = isDark ? Colors.white : const Color(0xFF3E3E40);
      final textSecondary = isDark ? Colors.white70 : Colors.black54;
      final handleColor = isDark ? Colors.white24 : Colors.black12;
      final accent = _getAccent(context);

      showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
        barrierColor: Colors.black54,
        builder: (sheetCtx) {
          return Container(
            decoration: BoxDecoration(
              color: sheetBg,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            ),
            padding: EdgeInsets.only(
              left: 24,
              right: 24,
              top: 0,
              bottom: MediaQuery.of(sheetCtx).viewInsets.bottom + 32,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Drag handle ──
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 20),
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: handleColor,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                // ── Clock icon + Business name ──
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.schedule_rounded, color: Colors.amber, size: 26),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        businessName,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // ── "Şu an kapalı" badge ──
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: isDark ? 0.15 : 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.access_time_filled_rounded, color: Colors.amber, size: 18),
                      const SizedBox(width: 10),
                      Text(
                        'marketplace.currently_closed'.tr(),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: Colors.amber,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Next opening time badge ──
                if (nextOpenText != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.blue.withValues(alpha: isDark ? 0.15 : 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.blue.withValues(alpha: 0.25)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.event_available_rounded, color: Colors.blue, size: 18),
                        const SizedBox(width: 10),
                        Text(
                          nextOpenText,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Colors.blue,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 16),

                // ── Body text ──
                Text(
                  preOrderEnabled
                      ? 'marketplace.closed_but_preorder'.tr()
                      : 'marketplace.closed_but_browse'.tr(),
                  style: TextStyle(
                    fontSize: 15,
                    height: 1.5,
                    color: textSecondary,
                  ),
                ),

                // ── Pre-order active badge ──
                if (preOrderEnabled) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: isDark ? 0.15 : 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle_rounded, color: Colors.green, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'marketplace.pre_order_active'.tr(),
                            style: const TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 28),

                // ── Primary CTA: See menu ──
                FilledButton(
                  onPressed: () => Navigator.pop(sheetCtx),
                  style: FilledButton.styleFrom(
                    backgroundColor: accent,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 52),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  child: Text(
                    preOrderEnabled
                        ? 'marketplace.see_menu_and_order'.tr()
                        : 'marketplace.see_menu'.tr(),
                  ),
                ),

                const SizedBox(height: 10),

                // ── Secondary: Go back ──
                TextButton(
                  onPressed: () {
                    Navigator.pop(sheetCtx);
                    context.pop();
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: textSecondary,
                    minimumSize: const Size(double.infinity, 44),
                    textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                  ),
                  child: Text('common.close'.tr()),
                ),
              ],
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

  // --- Actions ---

  void _callStore() async {
    final phone = _butcherDoc?['shopPhone'] as String?;
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
            ..._buildHoursListThemed(isDark),
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
    final sortOptions = ['En Alakalı', 'En Yeni', 'En Yüksek Puan', 'En Düşük Puan'];
    String selectedSort = 'En Alakalı';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setStateModal) {
          // Sorting Logic
          List sortedReviews = List.from(reviews);
          if (selectedSort == 'En Yeni') {
            sortedReviews.sort((a, b) => (b['time'] ?? 0).compareTo(a['time'] ?? 0));
          } else if (selectedSort == 'En Yüksek Puan') {
            sortedReviews.sort((a, b) => (b['rating'] ?? 0).compareTo(a['rating'] ?? 0));
          } else if (selectedSort == 'En Düşük Puan') {
            sortedReviews.sort((a, b) => (a['rating'] ?? 0).compareTo(b['rating'] ?? 0));
          }
          // 'En Alakalı' uses default API order

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
                               Text('$rating', style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 42, fontWeight: FontWeight.w600)),
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
                       Icon(FontAwesomeIcons.google, color: Theme.of(context).colorScheme.surface, size: 28),
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
                      Text('Yorumlar', style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 16, fontWeight: FontWeight.w600)),
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
                    ? Center(child: Text('marketplace.no_review_yet'.tr(), style: TextStyle(color: Colors.white54)))
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
                                    child: review['profile_photo_url'] == null ? Icon(Icons.person, color: Theme.of(context).colorScheme.surface) : null,
                                  ),
                                  SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(review['author_name'] ?? 'common.guest'.tr(), style: TextStyle(color: Theme.of(context).colorScheme.surface, fontWeight: FontWeight.w600)),
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
                    Image.asset('assets/images/tuna_logo.png', height: 60, errorBuilder: (_,__,___) => Text('TUNA', style: TextStyle(fontFamily: 'Cursive', fontSize: 40, color: Theme.of(context).colorScheme.surface, fontWeight: FontWeight.w600))),
                    SizedBox(height: 16),
                    Text(
                      'Avrupa\'nın En Güvenilir Helal Et Markası',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 18, fontWeight: FontWeight.w600),
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
                       '1987 yılında Köln\'de küçük bir kasap dükkanı olarak başlayan yolculuğumuz, bugün Avrupa\'nın en modern helal et entegre tesislerinden birine dönüştü.',
                       style: TextStyle(color: Colors.white70, fontSize: 15, height: 1.5),
                     ),
                     SizedBox(height: 24),
                     
                     // Icons Row
                     Row(
                       mainAxisAlignment: MainAxisAlignment.spaceAround,
                       children: [
                         _buildBrandIconElement(Icons.verified, 'Helal Kesim', Colors.green),
                         _buildBrandIconElement(Icons.bolt, 'Şoksuz', Colors.amber),
                         _buildBrandIconElement(Icons.clean_hands, 'Kuru Yolum', Colors.amber),
                       ],
                     ),
                     SizedBox(height: 32),
                     
                     // Standards List
                     Text('Tedarik Standartları', style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 18, fontWeight: FontWeight.w600)),
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
                               Text('Kuru Yolum Nedir?', style: TextStyle(color: Colors.amber[800], fontWeight: FontWeight.w600)),
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
                     Text('Üretim Standartları', style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 18, fontWeight: FontWeight.w600)),
                     const SizedBox(height: 16),
                     _buildCheckItem('marketplace.yuksek_et_orani'.tr(), 'marketplace.yuksek_et_orani_desc'.tr()),
                     _buildCheckItem('E621 İçermez', 'Glutamat/Çin tuzu yok'),
                     
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
                Text(title, style: TextStyle(color: Theme.of(context).colorScheme.surface, fontWeight: FontWeight.w600, fontSize: 15)),
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
          // Extract address
          final address = _butcherDoc?['address'];
          final street = address is Map ? (address['street'] ?? '') : '';
          final postalCode = address is Map ? (address['postalCode'] ?? '') : '';
          final city = address is Map ? (address['city'] ?? '') : '';
          final hasAddress = street.toString().trim().isNotEmpty;
          final fullAddress = hasAddress ? '$street\n$postalCode $city' : 'marketplace.no_address_info'.tr();
          
          final phone = _butcherDoc?['shopPhone']?.toString() ?? '';
          final hasPhone = phone.trim().isNotEmpty;
          
          // Cuisine type
          final cuisineType = _butcherDoc?['cuisineType']?.toString() ?? '';
          
          // ══ Determine which service tabs to show ══
          final data = _butcherDoc?.data() as Map<String, dynamic>?;
          final hasDelivery = data?['supportsDelivery'] == true || data?['hasDelivery'] == true;
          final deliveryStart = data?['deliveryStartTime']?.toString() ?? '';
          final deliveryEnd = data?['deliveryEndTime']?.toString() ?? '';
          final pickupStart = data?['pickupStartTime']?.toString() ?? '';
          final pickupEnd = data?['pickupEndTime']?.toString() ?? '';
          final hasPickup = pickupStart.trim().isNotEmpty || pickupEnd.trim().isNotEmpty;
          
          // Build dynamic tabs list
          final List<Tab> tabs = [
            Tab(text: 'marketplace.hours_general'.tr()),
          ];
          final List<Widget> tabViews = [
            _buildGeneralHoursTab(isDark, textColor, subtitleColor, accent),
          ];
          
          if (hasDelivery) {
            tabs.add(Tab(text: 'marketplace.hours_delivery'.tr()));
            tabViews.add(_buildServiceHoursTab(
              deliveryStart, deliveryEnd,
              isDark, textColor, subtitleColor, accent,
            ));
          }
          if (hasPickup) {
            tabs.add(Tab(text: 'marketplace.hours_pickup'.tr()));
            tabViews.add(_buildServiceHoursTab(
              pickupStart, pickupEnd,
              isDark, textColor, subtitleColor, accent,
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
                          _butcherDoc?['companyName'] ?? 'marketplace.business_info'.tr(),
                          style: TextStyle(color: textColor, fontSize: 22, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 6),
                        
                        // Brand Badge
                        if (_butcherDoc?['brandLabelActive'] == true)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: InkWell(
                              onTap: () { Navigator.pop(ctx); _showTunaBrandInfo(); },
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFB335B),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(_getBrandLabel(_butcherDoc?['brand']),
                                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                                      const SizedBox(width: 4),
                                      const Icon(Icons.info_outline, color: Colors.white70, size: 13),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        
                        if (_butcherDoc?['brandLabelActive'] != true)
                          const SizedBox(height: 10),

                        // ═══ MAP SECTION — "So findest du uns" ═══
                        if (hasAddress) ...[
                          Text('marketplace.find_us'.tr(),
                            style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 10),
                          GestureDetector(
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
                                    // OSM Static Map Image
                                    Image.network(
                                      'https://staticmap.openstreetmap.de/staticmap.php?center=$street,$postalCode+$city&zoom=15&size=600x300&maptype=mapnik&markers=$street,$postalCode+$city,red-pushpin',
                                      width: double.infinity,
                                      height: 160,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(
                                        color: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
                                        child: Center(
                                          child: Column(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.map_outlined, color: subtitleColor, size: 36),
                                              const SizedBox(height: 6),
                                              Text('$postalCode $city',
                                                style: TextStyle(color: subtitleColor, fontSize: 13)),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    // Overlay gradient for readability
                                    Positioned(
                                      bottom: 0, left: 0, right: 0,
                                      child: Container(
                                        height: 40,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.topCenter,
                                            end: Alignment.bottomCenter,
                                            colors: [Colors.transparent, Colors.black.withValues(alpha: 0.4)],
                                          ),
                                        ),
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
                                        child: const Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(Icons.open_in_new, size: 12, color: Colors.black87),
                                            SizedBox(width: 4),
                                            Text('Maps', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.black87)),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
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
                                Container(
                                  width: 40, height: 40,
                                  decoration: BoxDecoration(
                                    color: Colors.red.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(Icons.location_on, color: Colors.red, size: 22),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('common.address'.tr(),
                                        style: TextStyle(color: subtitleColor, fontSize: 13, fontWeight: FontWeight.w400)),
                                      const SizedBox(height: 3),
                                      Text(fullAddress,
                                        style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w400, height: 1.4)),
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
                        
                        // ═══ PHONE ROW — Lieferando style ═══
                        InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: hasPhone ? _callStore : null,
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
                                        style: TextStyle(color: subtitleColor, fontSize: 13, fontWeight: FontWeight.w400)),
                                      const SizedBox(height: 3),
                                      Text(hasPhone ? phone : 'marketplace.not_specified'.tr(),
                                        style: TextStyle(
                                          color: hasPhone ? Colors.blue : subtitleColor,
                                          fontSize: 15, fontWeight: FontWeight.w400,
                                        )),
                                    ],
                                  ),
                                ),
                                if (hasPhone)
                                  Icon(Icons.arrow_forward_ios, color: subtitleColor, size: 14),
                              ],
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: 16),
                        
                        // ═══ KÜCHE (CUISINE) SECTION ═══
                        if (cuisineType.trim().isNotEmpty) ...[
                          Text('marketplace.cuisine'.tr(),
                            style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: cuisineType.split(RegExp(r'[,;]')).map((tag) => tag.trim()).where((tag) => tag.isNotEmpty).map((tag) => Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: isDark ? Colors.white12 : Colors.grey.shade300, width: 0.5),
                              ),
                              child: Text(tag,
                                style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.w400)),
                            )).toList(),
                          ),
                          const SizedBox(height: 20),
                          Divider(color: dividerColor, height: 1),
                          const SizedBox(height: 16),
                        ],
                        
                        // ═══ BUSINESS HOURS ═══
                        Text('marketplace.business_hours'.tr(),
                          style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.w600)),
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
                            labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                            unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w400),
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
                          Text('Impressum',
                            style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 12),
                          _buildImpressumSection(data, textColor, subtitleColor),
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
              child: Text('marketplace.info_load_error'.tr(), style: TextStyle(color: Colors.white54)),
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
    
    final address = data['address'];
    final street = address is Map ? (address['street'] ?? '') : '';
    final postalCode = address is Map ? (address['postalCode'] ?? '') : '';
    final city = address is Map ? (address['city'] ?? '') : '';
    final fullAddress = street.toString().trim().isNotEmpty 
      ? '$street, $postalCode $city' 
      : '';
    
    // Format legal form label
    String legalFormLabel = '';
    const legalFormMap = {
      'gmbh': 'GmbH', 'ug': 'UG (haftungsbeschränkt)', 'ag': 'AG',
      'gbr': 'GbR', 'ohg': 'OHG', 'kg': 'KG', 'gmbh_co_kg': 'GmbH & Co. KG',
      'einzelunternehmen': 'Einzelunternehmen', 'freiberufler': 'Freiberufler',
      'ev': 'e.V.', 'eg': 'eG', 'se': 'SE',
    };
    if (legalForm.isNotEmpty) {
      legalFormLabel = legalFormMap[legalForm] ?? legalForm;
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (displayName.isNotEmpty)
          _impressumRow(displayName + (legalFormLabel.isNotEmpty ? ' ($legalFormLabel)' : ''), textColor),
        if (fullAddress.isNotEmpty)
          _impressumRow(fullAddress, subtitleColor),
        if (managingDirector.isNotEmpty)
          _impressumRow('Vertretungsberechtigter: $managingDirector', subtitleColor),
        if (authorizedRep.isNotEmpty && authorizedRep != managingDirector)
          _impressumRow('Vertretungsberechtigt: $authorizedRep', subtitleColor),
        if (registerCourt.isNotEmpty || registerNumber.isNotEmpty)
          _impressumRow(
            [if (registerCourt.isNotEmpty) registerCourt, if (registerNumber.isNotEmpty) registerNumber].join(', '),
            subtitleColor,
          ),
        if (taxId.isNotEmpty)
          _impressumRow('Steuer-Nr.: $taxId', subtitleColor),
        if (vatId.isNotEmpty)
          _impressumRow('USt-IdNr.: $vatId', subtitleColor),
        if (email.isNotEmpty)
          _impressumRow('E-Mail: $email', subtitleColor),
      ],
    );
  }
  
  Widget _impressumRow(String text, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w400, height: 1.4)),
    );
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
        'Thursday': 'Perşembe', 'Friday': 'Cuma', 'Saturday': 'Cumartesi', 'Sunday': 'Pazar'
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
      if (!structureMatch) {
        return ListView(
          padding: EdgeInsets.zero,
          children: lines.map((line) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Text(line, style: TextStyle(color: textColor, fontSize: 14)),
          )).toList(),
        );
      }

      return ListView(
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

          return _buildDayRow(dayNameDisplay, content, isToday, isDark, textColor, subtitleColor, accent);
        }),
      );
    } catch (e) {
      debugPrint('Error building general hours tab: $e');
      return Center(child: Text('marketplace.hours_cannot_display'.tr(), style: TextStyle(color: subtitleColor)));
    }
  }

  // ═══ SERVICE HOURS TAB (Delivery / Pickup) ═══
  Widget _buildServiceHoursTab(String startTime, String endTime, bool isDark, Color textColor, Color subtitleColor, Color accent) {
    final hasCustomHours = startTime.trim().isNotEmpty && endTime.trim().isNotEmpty;
    
    if (!hasCustomHours) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.schedule, color: subtitleColor, size: 40),
            const SizedBox(height: 12),
            Text('marketplace.same_as_general'.tr(),
              style: TextStyle(color: subtitleColor, fontSize: 16, fontWeight: FontWeight.w500)),
          ],
        ),
      );
    }

    final dayNamesDisplay = [
      'common.day_monday'.tr(), 'common.day_tuesday'.tr(), 'common.day_wednesday'.tr(),
      'common.day_thursday'.tr(), 'common.day_friday'.tr(), 'common.day_saturday'.tr(), 'common.day_sunday'.tr(),
    ];
    final now = DateTime.now();
    final todayIndex = now.weekday - 1;
    final hoursText = '$startTime - $endTime';

    return ListView(
      padding: EdgeInsets.zero,
      children: List.generate(7, (i) {
        return _buildDayRow(dayNamesDisplay[i], hoursText, todayIndex == i, isDark, textColor, subtitleColor, accent);
      }),
    );
  }

  // ═══ SINGLE DAY ROW — Lieferando style ═══
  Widget _buildDayRow(String dayName, String hours, bool isToday, bool isDark, Color textColor, Color subtitleColor, Color accent) {
    final isClosed = hours == 'common.closed'.tr() || hours.toLowerCase().contains('kapalı') || hours.toLowerCase().contains('geschlossen') || hours.toLowerCase().contains('closed');
    
    final dayColor = isToday ? accent : (isDark ? Colors.grey[300]! : Colors.black87);
    final hoursColor = isToday ? accent : (isClosed ? (isDark ? Colors.grey[500]! : Colors.grey) : textColor);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: isToday ? accent.withValues(alpha: 0.08) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        border: isToday ? Border.all(color: accent.withValues(alpha: 0.2), width: 1) : null,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(dayName, style: TextStyle(
            color: dayColor,
            fontSize: 15,
            fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
          )),
          Text(hours, style: TextStyle(
            color: hoursColor,
            fontSize: 15,
            fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
          )),
        ],
      ),
    );
  }

  // ═══ Legacy wrappers for backward compatibility ═══
  List<Widget> _buildHoursListThemed(bool isDark) {
    try {
      return _buildHoursList();
    } catch (e) {
      return [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text('marketplace.hours_cannot_display'.tr(), style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey.shade600)),
        )
      ];
    }
  }

  Widget _buildInfoRow(IconData icon, String title, String content, {bool isAction = false, VoidCallback? onTap, bool isDark = true}) {
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.grey : Colors.grey.shade600;
    final iconBgColor = isDark ? Colors.white10 : Colors.grey.shade100;
    final arrowColor = isDark ? Colors.white24 : Colors.grey.shade400;
    
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: iconBgColor, borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, color: _getAccent(context), size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   Text(title, style: TextStyle(color: subtitleColor, fontSize: 12)),
                   const SizedBox(height: 2),
                   Text(content, style: TextStyle(color: isAction ? Colors.blue[400] : textColor, fontSize: 14, height: 1.3)),
                ],
              ),
            ),
            if (isAction) Icon(Icons.arrow_forward_ios, color: arrowColor, size: 12),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildHoursList() {
    try {
      if (_butcherDoc == null) {
        return [Padding(padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text('marketplace.hours_loading'.tr(), style: const TextStyle(color: Colors.white54)))];
      }
      
      final rawData = _butcherDoc!.data();
      if (rawData == null) {
        return [Padding(padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text('marketplace.hours_not_found'.tr(), style: const TextStyle(color: Colors.white54)))];
      }
      
      final data = rawData as Map<String, dynamic>;
      final hours = data['openingHours'];

      if (hours == null || hours.toString().trim().isEmpty) {
        return [Padding(padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text('marketplace.business_hours_not_entered'.tr(), style: const TextStyle(color: Colors.white54)))];
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
        return [Text('marketplace.call_store_for_hours'.tr(), style: const TextStyle(color: Colors.white54))];
      }

      lines = lines.where((l) => l.trim().isNotEmpty).toList();

      final Map<String, String> enToTr = {
        'Monday': 'Pazartesi', 'Tuesday': 'Salı', 'Wednesday': 'Çarşamba',
        'Thursday': 'Perşembe', 'Friday': 'Cuma', 'Saturday': 'Cumartesi', 'Sunday': 'Pazar'
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

      if (lines.isEmpty) {
        return [Text('marketplace.time_info_empty'.tr(), style: const TextStyle(color: Colors.white54))];
      }

      bool structureMatch = lines.any((l) => dayNamesTr.any((d) => l.startsWith(d)));
      if (!structureMatch) {
        return lines.map((line) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(line, style: const TextStyle(color: Colors.white70)),
        )).toList();
      }

      return List.generate(7, (i) {
        final dayNameTr = dayNamesTr[i];
        final dayNameDisplay = dayNamesDisplay[i];
        final isToday = todayIndex == i;
        
        final line = lines.firstWhere(
          (l) => l.startsWith('$dayNameTr:') || l.startsWith('$dayNameTr '),
          orElse: () => '$dayNameTr: Kapalı'
        );
        
        String content = line.replaceAll('$dayNameTr:', '').replaceAll(dayNameTr, '').trim();
        if (content.isEmpty || content == 'Kapalı') content = 'common.closed'.tr();

        final isDark = Theme.of(context).brightness == Brightness.dark;
        final accent = _getAccent(context);
        final dayColor = isToday ? accent : (isDark ? Colors.grey[300] : Colors.black87);
        final hoursColor = isToday ? accent : (isDark ? Colors.white : Colors.black87);

        return Container(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
          decoration: BoxDecoration(
            color: isToday ? accent.withValues(alpha: 0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: isToday ? Border.all(color: accent.withValues(alpha: 0.3)) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(dayNameDisplay, style: TextStyle(color: dayColor, fontSize: 14, fontWeight: isToday ? FontWeight.w600 : FontWeight.w500)),
              Text(content, style: TextStyle(color: hoursColor, fontSize: 14, fontWeight: isToday ? FontWeight.w600 : FontWeight.w500)),
            ],
          ),
        );
      }).toList();
    } catch (e) {
      debugPrint('Error building hours list: $e');
      return [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text('marketplace.business_hours_cannot_be_displayed'.tr(), style: const TextStyle(color: Colors.white54)),
        )
      ];
    }
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
    final openingHelper = OpeningHoursHelper(data?['openingHours']);
    final isOpen = openingHelper.isOpenAt(DateTime.now());
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
                title: _showSearchBar
                    ? GestureDetector(
                        onTap: () => _showMenuSearchOverlay(),
                        child: Container(
                          height: 44,
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[100],
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Row(
                            children: [
                              const SizedBox(width: 12),
                              Icon(Icons.search, color: accent, size: 22),
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
                            TabItem(title: tr('delivery_modes.dine_in'), icon: Icons.restaurant),
                        ],
                        onTabSelected: (index) {
                          setState(() => _deliveryModeIndex = index);
                        },
                      ),
                titleSpacing: 0,
                centerTitle: true,
                actions: const [
                  // Invisible spacer to balance the leading back button
                  // so title (search bar / toggle) stays centered
                  SizedBox(width: 48),
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
                          (_butcherDoc != null && _butcherDoc!['imageUrl'] != null && (_butcherDoc!['imageUrl'] as String).isNotEmpty)
                              ? CachedNetworkImage(
                                  imageUrl: _butcherDoc!['imageUrl'],
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
                                  ],
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
                             child: Text(
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
                           ),
                           const SizedBox(width: 8),
                           // Info Button (compact Lieferando style)
                           Material(
                             color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[200],
                             borderRadius: BorderRadius.circular(8),
                             child: InkWell(
                               onTap: _showInfoSheet,
                               borderRadius: BorderRadius.circular(8),
                               child: Padding(
                                 padding: const EdgeInsets.all(8),
                                 child: Icon(
                                   Icons.info_outline,
                                   color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                   size: 20,
                                 ),
                               ),
                             ),
                           ),

                         ],
                       ),
                       
                       const SizedBox(height: 8),
                       
                       // 2b. Stats Line (Lieferando: ★ 4.5 · Open/Closed · Delivery info)
                       Wrap(
                         spacing: 12,
                         runSpacing: 8,
                         crossAxisAlignment: WrapCrossAlignment.center,
                         children: [
                           // Rating
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
                             ),
                           
                           // Separator
                           Text('·', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                           
                           // Open/Closed Status
                           InkWell(
                             onTap: _showWeeklyHours,
                             child: Row(
                               mainAxisSize: MainAxisSize.min,
                               children: [
                                 Container(
                                   width: 6, height: 6,
                                   decoration: BoxDecoration(
                                     color: isOpen ? Colors.green : Colors.red,
                                     shape: BoxShape.circle,
                                   ),
                                 ),
                                 const SizedBox(width: 4),
                                 Text(
                                   isOpen ? tr('business_status.open') : tr('business_status.closed'),
                                   style: TextStyle(
                                     color: isOpen ? Colors.green : Colors.red,
                                     fontSize: 13,
                                     fontWeight: FontWeight.w600,
                                   ),
                                 ),
                               ],
                             ),
                           ),
                           
                           // Min Order (if applicable)
                           if ((data?['minDeliveryOrder'] ?? 0) > 0) ...[
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
                      'Arama Sonuçları (${searchResults.length})', 
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
                              color: isDark ? const Color(0xFF2C2C2C) : const Color(0xFFE2E2E2),
                              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      catName,
                                      style: TextStyle(
                                        color: isDark ? textPrimary : const Color(0xFF3E3E40),
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
     
     if (cart.isEmpty) return const SizedBox.shrink();
     
     final isDark = Theme.of(context).brightness == Brightness.dark;
     final accent = _getAccent(context);
     final currency = CurrencyUtils.getCurrencySymbol();

     // Min order value from business data
     final butcherData = _butcherDoc?.data() as Map<String, dynamic>?;
     final minOrder = (butcherData?['minOrderAmount'] as num?)?.toDouble() ?? 0.0;
     final cartTotal = cart.totalAmount;
     final remaining = minOrder - cartTotal;
     final isDeliveryMode = _deliveryModeIndex == 0 && !_isMasaMode;
     final itemCount = cart.items.fold<int>(0, (sum, item) => sum + (item.quantity is int ? item.quantity.toInt() : item.quantity.round()));

     return Column(
       mainAxisSize: MainAxisSize.min,
       children: [
         // Minimum order value banner (Lieferando-style) — only in delivery mode
         if (minOrder > 0 && remaining > 0 && isDeliveryMode)
           Container(
             width: double.infinity,
             padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
             color: isDark ? const Color(0xFF2A2A2C) : const Color(0xFFF5F5F5),
             child: Row(
               children: [
                 Icon(Icons.pedal_bike, size: 18, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                 const SizedBox(width: 8),
                 Expanded(
                   child: Text(
                     'checkout.min_order_remaining'.tr(namedArgs: {
                       'amount': remaining.toStringAsFixed(2),
                       'currency': currency,
                     }),
                     style: TextStyle(
                       fontSize: 13,
                       fontWeight: FontWeight.w500,
                       color: isDark ? Colors.grey[300] : Colors.grey[700],
                     ),
                   ),
                 ),
               ],
             ),
           ),
         // ── Lieferando-Style Single Pill Cart Button ──
         Padding(
           padding: EdgeInsets.only(
             left: 16, right: 16, top: 12,
             bottom: MediaQuery.of(context).padding.bottom + 12,
           ),
           child: Material(
             color: accent,
             borderRadius: BorderRadius.circular(28),
             elevation: 4,
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
     );
  }

  // LIEFERANDO STYLE: Quick Add Product Bottom Sheet
  void _showProductBottomSheet(ButcherProduct product) {
    // Route products with optionGroups to the new customization sheet
    if (product.optionGroups.isNotEmpty) {
      final data = _butcherDoc?.data() as Map<String, dynamic>?;
      final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
      // Always open fresh sheet from product listing (edit happens in cart screen)
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
      return;
    }

    final isByWeight = product.unitType == 'kg';
    final cart = ref.read(cartProvider);
    final existingCartItem = cart.items.firstWhere(
      (item) => item.product.sku == product.sku,
      orElse: () => CartItem(product: product, quantity: 0),
    );
    final isEditing = existingCartItem.quantity > 0;
    double selectedQty = isEditing ? existingCartItem.quantity : (_selections[product.sku] ?? (isByWeight ? product.minQuantity : 1));
    final noteController = TextEditingController(text: isEditing ? (existingCartItem.note ?? '') : '');
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final accent = _getAccent(ctx);
        final bg = isDark ? const Color(0xFF1A1A1A) : Colors.white;
        final textPrimary = isDark ? Colors.white : Colors.black87;
        final textSecondary = isDark ? Colors.white54 : Colors.black45;
        final divider = isDark ? Colors.white12 : Colors.grey[200]!;
        
        return StatefulBuilder(
          builder: (context, setStateModal) {
            final totalPrice = product.effectiveAppPrice * selectedQty;
            
            return Container(
              decoration: BoxDecoration(
                color: bg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12, bottom: 4),
                      child: Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: isDark ? Colors.white24 : Colors.black12,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  ),

                  // Scrollable content
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 8),
                          
                          // Product Image (if available)
                          if (product.imageUrl?.isNotEmpty == true) ...[
                            ClipRRect(
                              borderRadius: BorderRadius.circular(14),
                              child: SizedBox(
                                width: double.infinity,
                                height: 180,
                                child: Image.network(
                                  product.imageUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],

                          // Product Name
                          Text(
                            product.name,
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w600,
                              color: textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),

                          // Price
                          Text(
                            '${'marketplace.from_price'.tr()} ${CurrencyUtils.getCurrencySymbol()}${product.effectiveAppPrice.toStringAsFixed(2)}${isByWeight ? '/kg' : ''}',
                            style: TextStyle(
                              fontSize: 14,
                              color: textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),

                          // Description
                          if (product.description.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              product.description,
                              style: TextStyle(
                                fontSize: 13,
                                color: textSecondary,
                                height: 1.4,
                              ),
                            ),
                          ],

                          // Produktinfo link
                          const SizedBox(height: 8),
                          GestureDetector(
                            onTap: () {
                              // Show Produktinfo bottom sheet (Lieferando Style)
                              final warningBg = isDark ? const Color(0xFF2C2C2C) : const Color(0xFFF5F5F5);
                              final dividerClr = isDark ? Colors.white12 : Colors.black12;
                              showModalBottomSheet(
                                context: context,
                                isScrollControlled: true,
                                backgroundColor: Colors.transparent,
                                builder: (ctx2) => Container(
                                  constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx2).size.height * 0.85),
                                  decoration: BoxDecoration(
                                    color: bg,
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                                  ),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      // Handle bar
                                      Padding(
                                        padding: const EdgeInsets.only(top: 12, bottom: 8),
                                        child: Container(width: 36, height: 4, decoration: BoxDecoration(color: isDark ? Colors.white24 : Colors.black12, borderRadius: BorderRadius.circular(2))),
                                      ),
                                      // Header with back button
                                      Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 16),
                                        child: Row(
                                          children: [
                                            GestureDetector(
                                              onTap: () => Navigator.of(ctx2).pop(),
                                              child: Icon(Icons.arrow_back, color: textPrimary, size: 24),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(child: Text('marketplace.product_info'.tr(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary))),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      Divider(height: 1, color: dividerClr),
                                      // Content
                                      Flexible(
                                        child: SingleChildScrollView(
                                          padding: const EdgeInsets.all(20),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              // Product name
                                              Text(product.name, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: textPrimary)),
                                              const SizedBox(height: 24),
                                              // Allergene Section
                                              Row(
                                                children: [
                                                  Text('marketplace.allergens'.tr(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary)),
                                                  const SizedBox(width: 8),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                    decoration: BoxDecoration(
                                                      color: product.allergens.isNotEmpty ? const Color(0xFFE8F5E9) : (isDark ? Colors.white10 : Colors.grey[200]),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Text(
                                                      product.allergens.isNotEmpty ? 'marketplace.confirmed_by_seller'.tr() : 'marketplace.not_confirmed_by_seller'.tr(),
                                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: product.allergens.isNotEmpty ? const Color(0xFF2E7D32) : textSecondary),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 12),
                                              if (product.allergens.isNotEmpty)
                                                ...product.allergens.map((allergen) => Padding(
                                                  padding: const EdgeInsets.only(bottom: 8),
                                                  child: Row(
                                                    children: [
                                                      Icon(Icons.eco_outlined, size: 18, color: textSecondary),
                                                      const SizedBox(width: 8),
                                                      Expanded(child: Text(allergen, style: TextStyle(fontSize: 14, color: textPrimary))),
                                                    ],
                                                  ),
                                                ))
                                              else
                                                Text('marketplace.no_info_available'.tr(), style: TextStyle(fontSize: 14, color: textSecondary)),
                                              const SizedBox(height: 20),
                                              Divider(color: dividerClr),
                                              const SizedBox(height: 16),
                                              // Zusatzstoffe Section
                                              Row(
                                                children: [
                                                  Text('marketplace.additives'.tr(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary)),
                                                  const SizedBox(width: 8),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                    decoration: BoxDecoration(
                                                      color: product.additives.isNotEmpty ? const Color(0xFFE8F5E9) : (isDark ? Colors.white10 : Colors.grey[200]),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Text(
                                                      product.additives.isNotEmpty ? 'marketplace.confirmed_by_seller'.tr() : 'marketplace.not_confirmed_by_seller'.tr(),
                                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: product.additives.isNotEmpty ? const Color(0xFF2E7D32) : textSecondary),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 12),
                                              if (product.additives.isNotEmpty)
                                                ...product.additives.map((additive) => Padding(
                                                  padding: const EdgeInsets.only(bottom: 8),
                                                  child: Row(
                                                    children: [
                                                      Icon(Icons.science_outlined, size: 18, color: textSecondary),
                                                      const SizedBox(width: 8),
                                                      Expanded(child: Text(additive, style: TextStyle(fontSize: 14, color: textPrimary))),
                                                    ],
                                                  ),
                                                ))
                                              else
                                                Text('marketplace.no_info_available'.tr(), style: TextStyle(fontSize: 14, color: textSecondary)),
                                              const SizedBox(height: 24),
                                              // Haftungsausschluss
                                              Container(
                                                padding: const EdgeInsets.all(16),
                                                decoration: BoxDecoration(color: warningBg, borderRadius: BorderRadius.circular(12)),
                                                child: Row(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Icon(Icons.warning_amber_rounded, size: 24, color: isDark ? Colors.amber : Colors.amber[700]),
                                                    const SizedBox(width: 12),
                                                    Expanded(
                                                      child: Text(
                                                        'marketplace.disclaimer_text'.tr(),
                                                        style: TextStyle(fontSize: 13, color: textSecondary, height: 1.5),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              const SizedBox(height: 24),
                                              // Rechtliche Bedenken melden
                                              GestureDetector(
                                                onTap: () {
                                                  showModalBottomSheet(
                                                    context: context,
                                                    isScrollControlled: true,
                                                    backgroundColor: Colors.transparent,
                                                    builder: (_) => DraggableScrollableSheet(
                                                      initialChildSize: 0.85,
                                                      maxChildSize: 0.95,
                                                      minChildSize: 0.5,
                                                      builder: (_, controller) => LegalReportSheet(
                                                        businessId: widget.businessId,
                                                        businessName: _butcherDoc?['companyName'] ?? _butcherDoc?['name'] ?? 'common.business'.tr(),
                                                        productId: product.id,
                                                        productName: product.name,
                                                        productCategory: product.category,
                                                      ),
                                                    ),
                                                  );
                                                },
                                                child: Text('marketplace.report_legal_concerns'.tr(), style: TextStyle(fontSize: 14, color: isDark ? Colors.white70 : Colors.black54, decoration: TextDecoration.underline)),
                                              ),
                                              const SizedBox(height: 16),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                            child: Text(
                              'marketplace.product_info'.tr(),
                              style: TextStyle(
                                fontSize: 13,
                                color: accent,
                                fontWeight: FontWeight.w600,
                                decoration: TextDecoration.underline,
                                decorationColor: accent,
                              ),
                            ),
                          ),

                          Divider(color: divider, height: 24),
                          
                          // Note Field (optional)
                          TextField(
                            controller: noteController,
                            maxLength: 40,
                            style: TextStyle(color: textPrimary, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'marketplace.add_note_hint'.tr(),
                              hintStyle: TextStyle(color: textSecondary, fontSize: 13),
                              prefixIcon: Icon(Icons.edit_note_rounded, color: accent, size: 20),
                              filled: true,
                              fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                              counterText: '',
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              isDense: true,
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                      ),
                    ),
                  ),

                  // Bottom Bar: [trash] [qty] [+]  |  [Ekle €X.XX]
                  Container(
                    padding: EdgeInsets.only(
                      left: 16, right: 16, top: 12,
                      bottom: MediaQuery.of(context).padding.bottom + 12,
                    ),
                    decoration: BoxDecoration(
                      color: bg,
                      border: Border(top: BorderSide(color: divider)),
                    ),
                    child: Row(
                      children: [
                        // Left: Trash / Qty / +
                        Container(
                          decoration: BoxDecoration(
                            color: isDark ? Colors.white10 : Colors.grey[100],
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // Trash / Minus
                              Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () {
                                    if (selectedQty <= (isByWeight ? product.minQuantity : 1)) {
                                      if (isEditing) {
                                        ref.read(cartProvider.notifier).removeFromCart(product.sku);
                                        setState(() => _selections.remove(product.sku));
                                      }
                                      Navigator.pop(context);
                                      return;
                                    }
                                    setStateModal(() => selectedQty -= isByWeight ? product.stepQuantity : 1);
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: SizedBox(
                                    width: 40, height: 40,
                                    child: Icon(
                                      selectedQty <= (isByWeight ? product.minQuantity : 1)
                                          ? Icons.delete_outline
                                          : Icons.remove,
                                      color: selectedQty <= (isByWeight ? product.minQuantity : 1)
                                          ? accent
                                          : textPrimary,
                                      size: 20,
                                    ),
                                  ),
                                ),
                              ),
                              // Quantity
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 14),
                                child: Text(
                                  isByWeight
                                      ? '${(selectedQty * 1000).toStringAsFixed(0)}g'
                                      : selectedQty.toStringAsFixed(0),
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: textPrimary,
                                  ),
                                ),
                              ),
                              // Plus
                              Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () {
                                    setStateModal(() => selectedQty += isByWeight ? product.stepQuantity : 1);
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: SizedBox(
                                    width: 40, height: 40,
                                    child: Icon(Icons.add, color: accent, size: 20),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(width: 12),

                        // Right: Add/Update button with price
                        Expanded(
                          child: SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: () {
                                final data = _butcherDoc?.data() as Map<String, dynamic>?;
                                final butcherName = data?['companyName'] ?? data?['name'] ?? 'common.butcher'.tr();
                                final noteText = noteController.text.trim().isNotEmpty ? noteController.text.trim() : null;
                                HapticFeedback.heavyImpact();
                                ref.read(cartProvider.notifier).addToCart(product, selectedQty, widget.businessId, butcherName, note: noteText);
                                setState(() => _selections[product.sku] = selectedQty);
                                Navigator.pop(context);
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: accent,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ),
                              child: Text(
                                '${isEditing ? 'marketplace.update_item'.tr() : 'marketplace.add_to_cart'.tr()}  ${CurrencyUtils.getCurrencySymbol()}${totalPrice.toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
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
          },
        );
      },
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
                                      color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey[50],
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
                            // ❤️ Product Favorite Heart
                            Positioned(
                              top: 4,
                              right: 4,
                              child: Consumer(
                                builder: (context, ref, _) {
                                  final favs = ref.watch(productFavoritesProvider);
                                  final isFav = favs.contains(product.sku);
                                  return GestureDetector(
                                    onTap: () => ref.read(productFavoritesProvider.notifier).toggleFavorite(product.sku),
                                    child: Container(
                                      width: 28,
                                      height: 28,
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(alpha: 0.35),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        isFav ? Icons.favorite : Icons.favorite_border,
                                        color: isFav ? Colors.redAccent : Colors.white,
                                        size: 16,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                        
                      if (hasImage) const SizedBox(height: 12),
                      
                      // Action Button (+ / Qty Badge) - Lieferando style
                      if (isAvailable)
                        GestureDetector(
                          onTap: () {
                            // + button tapped directly
                            if (product.optionGroups.isNotEmpty) {
                              // Has options → open customization sheet
                              _showProductBottomSheet(product);
                            } else {
                              // No options → add directly to cart
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
    final unitLabel = isByWeight ? 'gram' : 'Adet';

    // When NOT in cart: use local _selections as quantity picker
    // When IN cart: display the cart quantity
    final selectedQty = _selections[product.sku] ?? defaultQty;
    final displayQty = inCart ? totalQtyInCart : selectedQty;
    // Convert kg to grams for display
    final displayQtyGrams = isByWeight ? (displayQty * 1000).toInt() : displayQty.toInt();

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
                      // Name — bigger
                      Text(
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
                              'kg fiyatı',
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
                          // ⊖ Minus button — individual bordered square
                          GestureDetector(
                            onTap: () {
                              if (inCart) {
                                // IN CART: directly remove from cart
                                if (productCartItems.isNotEmpty) {
                                  ref.read(cartProvider.notifier).removeFromCart(productCartItems.first.uniqueKey);
                                }
                              } else {
                                // NOT IN CART: decrease local selection
                                final current = _selections[product.sku] ?? defaultQty;
                                if (current > defaultQty) {
                                  setState(() => _selections[product.sku] = current - stepQty);
                                }
                              }
                            },
                            child: Container(
                              width: 38,
                              height: 38,
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
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          // Quantity display — centered
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '$displayQtyGrams',
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
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
                          // ⊕ Plus button — individual bordered square
                          GestureDetector(
                            onTap: isAvailable ? () {
                              if (inCart) {
                                // IN CART: directly add more to cart
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
                                // NOT IN CART: increase local selection
                                final current = _selections[product.sku] ?? defaultQty;
                                setState(() => _selections[product.sku] = current + stepQty);
                              }
                            } : null,
                            child: Container(
                              width: 38,
                              height: 38,
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
                                  fontSize: 20,
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
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                inCart ? Icons.check_circle_outline : Icons.shopping_cart_outlined,
                                color: Colors.white,
                                size: 15,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                inCart 
                                  ? 'cart.in_cart_price'.tr(namedArgs: {'price': totalPrice.toStringAsFixed(2), 'currency': CurrencyUtils.getCurrencySymbol()})
                                  : 'cart.add_to_cart_price'.tr(namedArgs: {'price': previewPrice.toStringAsFixed(2), 'currency': CurrencyUtils.getCurrencySymbol()}),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
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
                      color: isDark ? const Color(0xFF1E1E1E) : Colors.grey[100],
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
                      color: isDark ? const Color(0xFF1E1E1E) : Colors.grey[200],
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
