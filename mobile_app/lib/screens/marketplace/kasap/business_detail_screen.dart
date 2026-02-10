import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:io';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:lokma_app/services/google_places_service.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/models/butcher_product.dart';
import 'package:lokma_app/data/product_catalog_data.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'cart_screen.dart';
import 'reservation_booking_screen.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:lokma_app/providers/theme_provider.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';

class BusinessDetailScreen extends ConsumerStatefulWidget {
  final String businessId;
  final int initialDeliveryMode;
  final String? initialTableNumber;
  
  const BusinessDetailScreen({super.key, required this.businessId, this.initialDeliveryMode = 0, this.initialTableNumber});

  @override
  ConsumerState<BusinessDetailScreen> createState() => _BusinessDetailScreenState();
}

class _BusinessDetailScreenState extends ConsumerState<BusinessDetailScreen> {
  // Theme-aware colors (resolved in build method)
  // 🎨 BRAND COLOUR: Fallback when no brandColor in Firestore
  static const Color _defaultBrandColor = Color(0xFFD03140);  // LOKMA default red
  static const Color _accentRed = Color(0xFFE53935);    // Legacy red accent
  
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
      return const Color(0xFFE91E63); // 🎨 BRAND COLOUR: TUNA pink/magenta
    } else if (brand == 'akdeniz_toros') {
      return const Color(0xFF1B5E20); // 🎨 BRAND COLOUR: Akdeniz Toros green
    }
    
    // 🎨 BRAND COLOUR: Default fallback
    return _defaultBrandColor;
  }
  
  String _selectedCategory = 'Tümü';

  /// Select a category without causing scroll jumps
  void _selectCategory(String category) {
    if (_selectedCategory == category) return;
    final savedOffset = _scrollController.hasClients ? _scrollController.offset : 0.0;
    setState(() => _selectedCategory = category);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        final maxScroll = _scrollController.position.maxScrollExtent;
        _scrollController.jumpTo(savedOffset.clamp(0.0, maxScroll));
      }
    });
  }
  
  // 🚀 Service Mode (Lieferando-style toggle)
  // 0 = Kurye/Teslimat, 1 = Gel Al/Abholung, 2 = Masa/Dine-in
  late int _deliveryModeIndex;
  bool get _isDeliveryMode => _deliveryModeIndex == 0;
  bool get _isMasaMode => _deliveryModeIndex == 2;
  
  // 🔍 Menu Search
  String _menuSearchQuery = '';
  bool _isSearching = false;
  
  // 📜 Scroll Controller for Lieferando-style search bar
  final ScrollController _scrollController = ScrollController();
  bool _showSearchBar = false; // Shows when scrolled past hero
  final TextEditingController _searchController = TextEditingController();
  
  // 🔄 Dynamic categories loaded from Firestore
  List<Map<String, dynamic>> _categories = [
    {'name': 'Tümü', 'icon': Icons.grid_view, 'emoji': '🏠'},
  ];
  bool _categoriesLoaded = false;

  Map<String, dynamic>? _placeDetails;
  DocumentSnapshot? _butcherDoc;

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
    });
  }
  // 🔄 Real-time subscription for categories
  late final Stream<QuerySnapshot<Map<String, dynamic>>> _categoriesStream;
  
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
              'name': data['name'] ?? 'Kategori',
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
            _categoriesLoaded = true;
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
            _categoriesLoaded = true;
          });
        }
      }
    }, onError: (e) {
      debugPrint('🔴 [LOKMA] Error in categories listener: $e');
      if (mounted) setState(() => _categoriesLoaded = true);
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
      '🍗': Icons.egg_alt,
      '🌯': Icons.lunch_dining,
      '🥙': Icons.lunch_dining,
      '🥤': Icons.local_drink,
      '🥗': Icons.restaurant,
    };
    return emojiToIcon[emoji] ?? Icons.category;
  }


  Future<void> _loadButcherAndReviews() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.businessId)
          .get();
      
      if (!doc.exists) return;

      if (mounted) setState(() => _butcherDoc = doc);

      final data = doc.data();
      if (data == null) return;

      // 🆕 Kapalı işletme kontrolü
      final openingHelper = OpeningHoursHelper(data['openingHours']);
      final isOpen = openingHelper.isOpenAt(DateTime.now());
      final preOrderEnabled = data['preOrderEnabled'] as bool? ?? false;
      
      if (!isOpen) {
        _showClosedBusinessDialog(preOrderEnabled: preOrderEnabled);
      }

      final googlePlaceId = data['googlePlaceId'] as String?;
      if (googlePlaceId != null && googlePlaceId.isNotEmpty) {
        try {
          final details = await GooglePlacesService.getPlaceDetails(googlePlaceId);
          if (mounted) setState(() => _placeDetails = details);
        } catch (e) {
          debugPrint('Google Places Error: $e');
        }
      } 

      // 🆕 Resolve plan features from subscription_plans collection
      final planCode = data['subscriptionPlan'] as String? ?? 'basic';
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
    } catch (e) {
      debugPrint('Error loading data: $e');
    }
  }

  // 🆕 Kapalı işletme uyarı popup'ı
  void _showClosedBusinessDialog({bool preOrderEnabled = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      
      showDialog(
        context: context,
        barrierDismissible: true,
        builder: (dialogContext) {
          final theme = Theme.of(dialogContext);
          final isDark = theme.brightness == Brightness.dark;
          return AlertDialog(
            backgroundColor: theme.dialogBackgroundColor,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Row(
              children: [
                const Icon(Icons.schedule, color: Colors.orange, size: 28),
                const SizedBox(width: 12),
                Text(
                  'İşletme Şu An Kapalı',
                  style: TextStyle(color: theme.colorScheme.onSurface, fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  preOrderEnabled
                      ? 'Bu işletme şu an kapalı, fakat ön sipariş kabul ediyor. Sipariş verirseniz işletme açıldığında hazırlanacaktır.'
                      : 'Bu işletme şu an sipariş kabul etmiyor. Çalışma saatlerinde tekrar deneyebilir veya açık işletmeleri görebilirsiniz.',
                  style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.7), fontSize: 14, height: 1.4),
                ),
                if (preOrderEnabled) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.green.withOpacity(0.3)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.check_circle, color: Colors.green, size: 18),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Ön Sipariş Aktif',
                            style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: Text(
                  preOrderEnabled ? 'Ön Sipariş Ver' : 'Göz At',
                  style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.5)),
                ),
              ),
              if (!preOrderEnabled)
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(dialogContext); // Close dialog
                    context.pop(); // Go back to list
                  },
                  icon: const Icon(Icons.search, size: 18),
                  label: const Text('Açık İşletmeleri Bul'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _getAccent(context),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
            ],
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
    if (brand == null) return 'Bağımsız Kasap';
    switch (brand.toLowerCase()) {
      case 'tuna': return 'TUNA';
      case 'akdeniz_toros': return 'Akdeniz Toros';
      case 'independent': return 'Bağımsız Kasap';
      default: return 'Bağımsız Kasap';
    }
  }

  // --- Actions ---

  void _callStore() async {
    final phone = _butcherDoc?['shopPhone'] as String?;
    if (phone != null && phone.isNotEmpty) {
      final uri = Uri.parse('tel:$phone');
      if (await canLaunchUrl(uri)) await launchUrl(uri);
    }
  }

  void _launchMaps() async {
    final lat = _placeDetails?['geometry']?['location']?['lat'];
    final lng = _placeDetails?['geometry']?['location']?['lng'];
    final address = _butcherDoc?['address']?['street'];

    if (lat != null && lng != null) {
      final Uri uri;
      if (Platform.isIOS) {
        uri = Uri.parse('http://maps.apple.com/?q=$lat,$lng');
      } else {
        uri = Uri.parse('geo:$lat,$lng?q=$lat,$lng');
      }
      
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
         final googleUrl = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
         if (await canLaunchUrl(googleUrl)) await launchUrl(googleUrl);
      }
    } else if (address != null) {
         final Uri uri;
         if (Platform.isIOS) {
            uri = Uri.parse('http://maps.apple.com/?q=${Uri.encodeComponent(address)}');
         } else {
            uri = Uri.parse('geo:0,0?q=${Uri.encodeComponent(address)}');
         }
         
         if (await canLaunchUrl(uri)) {
            await launchUrl(uri);
         } else {
             final googleUrl = Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}');
             if (await canLaunchUrl(googleUrl)) await launchUrl(googleUrl);
         }
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
            Text('Haftalık Çalışma Saatleri', style: TextStyle(color: textColor, fontSize: 20, fontWeight: FontWeight.bold)),
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
                  margin: const EdgeInsets.symmetric(vertical: 16),
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                ),
                
                // Header (Summary)
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  child: Row(
                    children: [
                       Column(
                         crossAxisAlignment: CrossAxisAlignment.start,
                         children: [
                           Row(
                             children: [
                               Text('$rating', style: const TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.bold)),
                               const SizedBox(width: 8),
                               Column(
                                 crossAxisAlignment: CrossAxisAlignment.start,
                                 children: [
                                   Row(children: List.generate(5, (i) => Icon(Icons.star, color: i < rating.round() ? Colors.amber : Colors.grey, size: 14))),
                                   const SizedBox(height: 4),
                                   Text('$total Değerlendirme', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                                 ],
                               ),
                             ],
                           ),
                         ],
                       ),
                       const Spacer(),
                       const Icon(FontAwesomeIcons.google, color: Colors.white, size: 28),
                    ],
                  ),
                ),

                const Divider(color: Colors.white10, height: 1),

                // Sort Dropdown
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Yorumlar', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      PopupMenuButton<String>(
                        initialValue: selectedSort,
                        color: const Color(0xFF2C2C2C),
                        onSelected: (val) => setStateModal(() => selectedSort = val),
                        child: Row(
                          children: [
                            Icon(Icons.sort, color: _getAccent(context), size: 16),
                            const SizedBox(width: 8),
                            Text(selectedSort, style: TextStyle(color: _getAccent(context), fontSize: 13, fontWeight: FontWeight.bold)),
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
                    ? const Center(child: Text('Henüz yorum yapılmamış.', style: TextStyle(color: Colors.white54)))
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
                                    child: review['profile_photo_url'] == null ? const Icon(Icons.person, color: Colors.white) : null,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(review['author_name'] ?? 'Misafir', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                        const SizedBox(height: 2),
                                        Text(review['relative_time_description'] ?? '', style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(color: Colors.amber.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                                    child: Row(
                                      children: [
                                        Text('${review['rating']}', style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 12)),
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
              child: Text('Kategoriler', style: TextStyle(color: textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
            ),
            // Category list
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: _categories.length,
                itemBuilder: (context, index) {
                  final cat = _categories[index];
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
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
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
          decoration: const BoxDecoration(
            color: Color(0xFF1E1E1E),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // 1. Red Brand Header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                decoration: const BoxDecoration(
                  color: Color(0xFFB71C1C), // Deep Red
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 40, height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                    ),
                    Image.asset('assets/images/tuna_logo.png', height: 60, errorBuilder: (_,__,___) => const Text('TUNA', style: TextStyle(fontFamily: 'Cursive', fontSize: 40, color: Colors.white, fontWeight: FontWeight.bold))),
                    const SizedBox(height: 16),
                    const Text(
                      'Avrupa\'nın En Güvenilir Helal Et Markası',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
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
                     const Text(
                       '1987 yılında Köln\'de küçük bir kasap dükkanı olarak başlayan yolculuğumuz, bugün Avrupa\'nın en modern helal et entegre tesislerinden birine dönüştü.',
                       style: TextStyle(color: Colors.white70, fontSize: 15, height: 1.5),
                     ),
                     const SizedBox(height: 24),
                     
                     // Icons Row
                     Row(
                       mainAxisAlignment: MainAxisAlignment.spaceAround,
                       children: [
                         _buildBrandIconElement(Icons.verified, 'Helal Kesim', Colors.green),
                         _buildBrandIconElement(Icons.bolt, 'Şoksuz', Colors.amber),
                         _buildBrandIconElement(Icons.clean_hands, 'Kuru Yolum', Colors.orange),
                       ],
                     ),
                     const SizedBox(height: 32),
                     
                     // Standards List
                     const Text('Tedarik Standartları', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                     const SizedBox(height: 16),
                     _buildCheckItem('Helal Kesim', 'İslami usullere uygun kesim'),
                     _buildCheckItem('Elle Kesim', 'Geleneksel yöntemlerle'),
                     _buildCheckItem('Şoksuz Kesim', 'Elektrik şoku uygulanmaz'),
                     _buildCheckItem('Kuru Yolum', 'Beyaz ette hijyenik temizlik'),

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
                               Icon(Icons.info_outline, color: Colors.orange[800], size: 20),
                               const SizedBox(width: 8),
                               Text('Kuru Yolum Nedir?', style: TextStyle(color: Colors.orange[800], fontWeight: FontWeight.bold)),
                             ],
                           ),
                           const SizedBox(height: 8),
                           const Text(
                             'İslami usullere göre kesimi yapılan tavuğun, haşlama kazanı, ilaçlı ve yüksek sıcaklıkta su kullanılmadan tüylerinin temizlenmesi işlemidir. Kuru yolum işlemi uygulanan tavuklarda bakteri, toz ve necaset bulunmaz.',
                             style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                           ),
                         ],
                       ),
                     ),
                     
                     const SizedBox(height: 24),
                     const Text('Üretim Standartları', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                     const SizedBox(height: 16),
                     _buildCheckItem('Yüksek Et Oranı', 'Kaliteli et kullanımı'),
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
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
            border: Border.all(color: color.withOpacity(0.3), width: 2),
          ),
          child: Icon(icon, color: color, size: 28),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildCheckItem(String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
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
    final handleColor = isDark ? Colors.white24 : Colors.grey.shade300;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        try {
          return Container(
            height: MediaQuery.of(context).size.height * 0.6,
            decoration: BoxDecoration(
              color: sheetBg,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                // Handle
                Container(
                  margin: const EdgeInsets.only(top: 8, bottom: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: handleColor, borderRadius: BorderRadius.circular(2)),
                ),
                
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    children: [
                      // Title
                      Text(
                        _butcherDoc?['companyName'] ?? 'İşletme Bilgileri',
                        style: TextStyle(color: textColor, fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      
                      // Label Badge
                      if (_butcherDoc?['brandLabelActive'] == true)
                        InkWell(
                          onTap: () {
                             Navigator.pop(context); // Close info sheet first
                             _showTunaBrandInfo(); // Open brand info
                          },
                          child: Container(
                            alignment: Alignment.centerLeft,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFD32F2F),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row( // Added Row for Arrow hint
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                   _getBrandLabel(_butcherDoc?['brand']),
                                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.info, color: Colors.white70, size: 14),
                                ],
                              ),
                            ),
                          ),
                        ),

                      const SizedBox(height: 12),
                      
                      // Info Sections - with safe address access
                      Builder(builder: (context) {
                        try {
                          final address = _butcherDoc?['address'];
                          final street = address is Map ? (address['street'] ?? '') : '';
                          final postalCode = address is Map ? (address['postalCode'] ?? '') : '';
                          final city = address is Map ? (address['city'] ?? '') : '';
                          return _buildInfoRow(Icons.location_on, 'Adres', '$street\n$postalCode $city', isDark: isDark);
                        } catch (e) {
                          return _buildInfoRow(Icons.location_on, 'Adres', 'Adres bilgisi yok', isDark: isDark);
                        }
                      }),
                      Divider(color: isDark ? Colors.white10 : Colors.grey.shade300),
                      _buildInfoRow(Icons.phone, 'Telefon', _butcherDoc?['shopPhone']?.toString() ?? 'Belirtilmemiş', isAction: true, onTap: _callStore, isDark: isDark),
                      
                      const SizedBox(height: 12),
                      Text('Çalışma Saatleri', style: TextStyle(color: textColor, fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      
                      // Hours List - wrapped in try-catch builder
                      ..._buildHoursListThemed(isDark),
                      
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ],
            ),
          );
        } catch (e) {
          debugPrint('Error building info sheet: $e');
          return Container(
            height: MediaQuery.of(context).size.height * 0.4,
            decoration: const BoxDecoration(
              color: Color(0xFF1E1E1E),
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: const Center(
              child: Text('Bilgi yüklenirken hata oluştu.', style: TextStyle(color: Colors.white54)),
            ),
          );
        }
      },
    );
  }

  // Safe wrapper for hours list
  List<Widget> _buildHoursListSafe() {
    try {
      return _buildHoursList();
    } catch (e) {
      debugPrint('Error in _buildHoursListSafe: $e');
      return [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text('Çalışma saatleri görüntülenemiyor.', style: TextStyle(color: Colors.white54)),
        )
      ];
    }
  }
  
  // Themed wrapper for hours list  
  List<Widget> _buildHoursListThemed(bool isDark) {
    final textColor = isDark ? Colors.white : Colors.black87;
    final todayHighlight = isDark ? _getAccent(context) : _getAccent(context);
    final subtitleColor = isDark ? Colors.grey[400] : Colors.grey.shade600;
    
    // For simplicity, reuse _buildHoursList and just return - theme colors are handled via the page context
    try {
      return _buildHoursList();
    } catch (e) {
      return [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text('Çalışma saatleri görüntülenemiyor.', style: TextStyle(color: subtitleColor)),
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
        return [
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('Çalışma saatleri bilgisi yükleniyor...', style: TextStyle(color: Colors.white54)),
          )
        ];
      }
      
      final rawData = _butcherDoc!.data();
      if (rawData == null) {
        return [
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('Çalışma saatleri bilgisi bulunamadı.', style: TextStyle(color: Colors.white54)),
          )
        ];
      }
      
      final data = rawData as Map<String, dynamic>;
      final hours = data['openingHours'];

    if (hours == null || hours.toString().trim().isEmpty) {
      return [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text('Çalışma saatleri bilgisi girilmemiş.', style: TextStyle(color: Colors.white54)),
        )
      ];
    }

    final dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    final now = DateTime.now();
    final todayIndex = now.weekday - 1;

    List<String> lines = [];

    
    if (hours is String) {
        lines = hours.split(RegExp(r'\r?\n'));
    } else if (hours is List) {
        // Handle List<dynamic> (e.g. ["Pazartesi: 09:00 - 18:00", ...])
        lines = hours.map((e) => e.toString()).toList();
    } else if (hours is Map) {
        // Handle Map (e.g. {"monday": "09:00", ...} though this is rarer for our schema)
        // Try to convert to list implicitly by iterating days
        // This is a complex fallback, usually our schema is String or List
        return [const Text('Detaylı saat bilgisi için işletmeyi arayın.', style: TextStyle(color: Colors.white54))];
    } else {
         // Fallback for unknown data types
         return [const Text('Saat formatı desteklenmiyor.', style: TextStyle(color: Colors.white54))];
    }

    // Filter out empty lines just in case
    lines = lines.where((l) => l.trim().isNotEmpty).toList();
    
    // --- STANDARDIZATION LOGIC ---
    // Map English days to Turkish if detected
    final Map<String, String> enToTr = {
      'Monday': 'Pazartesi',
      'Tuesday': 'Salı',
      'Wednesday': 'Çarşamba',
      'Thursday': 'Perşembe',
      'Friday': 'Cuma',
      'Saturday': 'Cumartesi',
      'Sunday': 'Pazar'
    };

    List<String> standardizedLines = [];
    for (var line in lines) {
      String cleanLine = line.trim();
      
      // 1. Check for English Day Names and Translate
      for (var entry in enToTr.entries) {
        if (cleanLine.startsWith(entry.key)) {
           cleanLine = cleanLine.replaceFirst(entry.key, entry.value);
           break;
        }
      }

      // 2. Normalize Time Format (12h AM/PM -> 24h)
      // Regex detects patterns like "8:00 AM", "08:00 PM", "7 PM"
      cleanLine = cleanLine.replaceAllMapped(RegExp(r'(\d{1,2})(:(\d{2}))?\s*([AP]M)', caseSensitive: false), (match) {
         int h = int.parse(match.group(1)!);
         int m = match.group(3) != null ? int.parse(match.group(3)!) : 0;
         String period = match.group(4)!.toUpperCase();

         if (period == 'PM' && h < 12) h += 12;
         if (period == 'AM' && h == 12) h = 0;

         return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
      });

      // 3. Normalize Separators (en-dash, em-dash -> hyphen)
      cleanLine = cleanLine.replaceAll('–', '-').replaceAll('—', '-');
      
      // 4. Translate "Closed" -> "Kapalı"
      cleanLine = cleanLine.replaceAll(RegExp(r'Closed', caseSensitive: false), 'Kapalı');

      standardizedLines.add(cleanLine);
    }
    
    lines = standardizedLines;
    // ----------------------------

    if (lines.isEmpty) {
       return [const Text('Saat bilgisi boş.', style: TextStyle(color: Colors.white54))];
    }

    // Check if lines align with day names, if not just show lines as is
    bool structureMatch = lines.any((l) => dayNames.any((d) => l.startsWith(d)));

    if (!structureMatch) {
       return lines.map((line) => Padding(
         padding: const EdgeInsets.symmetric(vertical: 4),
         child: Text(line, style: const TextStyle(color: Colors.white70)),
       )).toList();
    }

    return dayNames.map((dayName) {
        final isToday = dayNames[todayIndex] == dayName;
        
        // Find line with better matching - STRICT MATCHING
        final line = lines.firstWhere(
          (l) {
             // Strict match: Must start with dayName followed by colon or space, 
             // OR be exactly the dayName (though unlikely given the data format)
             return l.startsWith('$dayName:') || l.startsWith('$dayName ');
          },
          orElse: () => '$dayName: Kapalı'
        );
        
        // Clean content
        String content = line.replaceAll('$dayName:', '').replaceAll(dayName, '').trim();
        if (content.isEmpty) content = 'Kapalı';

        // Theme-aware colors
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final dayColor = isToday 
            ? Colors.green 
            : (isDark ? Colors.grey[300] : Colors.black87);
        final hoursColor = isToday 
            ? Colors.green 
            : (isDark ? Colors.white : Colors.black87);

        return Container(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
          decoration: BoxDecoration(
            color: isToday ? Colors.green.withOpacity(0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: isToday ? Border.all(color: Colors.green.withOpacity(0.3)) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(dayName, style: TextStyle(color: dayColor, fontSize: 14, fontWeight: isToday ? FontWeight.bold : FontWeight.w500)),
              Text(content, style: TextStyle(color: hoursColor, fontSize: 14, fontWeight: isToday ? FontWeight.bold : FontWeight.w500)),
            ],
          ),
        );
    }).toList();
    } catch (e) {
      debugPrint('Error building hours list: $e');
      return [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text('Çalışma saatleri görüntülenemiyor.', style: TextStyle(color: Colors.white54)),
        )
      ];
    }
  }

  // Safe Data Access Helper
  String _safeString(Map<String, dynamic>? data, String key, {String fallback = ''}) {
    if (data == null || data[key] == null) return fallback;
    return data[key].toString();
  }

  // Business Category Helpers (NEW!)
  IconData _getCategoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'kasap':
      case 'butcher':
        return Icons.restaurant;
      case 'restoran':
      case 'restaurant':
        return Icons.restaurant_menu;
      case 'imbiss':
        return Icons.lunch_dining;
      case 'market':
        return Icons.shopping_cart;
      case 'pastane':
      case 'bakery':
        return Icons.cake;
      case 'cafe':
        return Icons.coffee;
      case 'cicekci':
      case 'florist':
        return Icons.local_florist;
      case 'catering':
        return Icons.celebration;
      default:
        return Icons.store;
    }
  }

  String _getCategoryLabel(String category) {
    switch (category.toLowerCase()) {
      case 'kasap':
      case 'butcher':
        return 'Kasap';
      case 'restoran':
      case 'restaurant':
        return 'Restoran';
      case 'imbiss':
        return 'Imbiss';
      case 'market':
        return 'Market';
      case 'pastane':
      case 'bakery':
        return 'Pastane';
      case 'cafe':
        return 'Kafe';
      case 'cicekci':
      case 'florist':
        return 'Çiçekçi';
      case 'catering':
        return 'Catering';
      default:
        return 'İşletme';
    }
  }

  Widget _buildServiceBadge(IconData icon, String label, Color color) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  // Lieferando-style compact action button
  Widget _buildQuickAction(IconData icon, String label, VoidCallback onTap, bool isDark) {
    return Material(
      color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[200],
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: isDark ? Colors.white70 : Colors.black54),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: isDark ? Colors.white70 : Colors.black54,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // LIEFERANDO STYLE: Theme-aware color system
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    // Dynamic colors based on theme
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
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
    final showBrandBadge = (data?['brandLabelActive'] ?? false) && 
                           (brand?.toString().toLowerCase() == 'tuna' || brand?.toString().toLowerCase() == 'akdeniz_toros');
    final address = data?['address'] as Map<String, dynamic>?;
    
    // 🎨 BRAND COLOR SYSTEM: Use brand-specific colors when available
    Color accent;
    if (brand?.toString().toLowerCase() == 'tuna') {
      accent = const Color(0xFFE91E63); // 🎨 BRAND COLOUR: TUNA pink/magenta
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
          // Process Products
          List<ButcherProduct> products = [];
          if (snapshot.hasData) {
            products = snapshot.data!.docs.map((doc) {
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
              
              return ButcherProduct.fromFirestore(data, doc.id, butcherId: widget.businessId, masterData: masterMap);
            }).toList();
            // 🔍 Update all products for instant search
            _allProducts = products;
          }

          // Filter by Category
          var filteredProducts = _selectedCategory == 'Tümü' 
              ? products 
              : products.where((p) => p.category == _selectedCategory).toList();
          
          // 🔍 Filter by Menu Search Query
          if (_menuSearchQuery.isNotEmpty) {
            final query = _menuSearchQuery.toLowerCase();
            filteredProducts = filteredProducts.where((p) => 
              p.name.toLowerCase().contains(query) ||
              (p.description?.toLowerCase().contains(query) ?? false)
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
                            border: Border.all(color: Colors.grey.withOpacity(0.3), width: 1),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              const SizedBox(width: 12),
                              Icon(Icons.search, color: accent, size: 22),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _menuSearchQuery.isNotEmpty ? _menuSearchQuery : 'Menüde ara...',
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
                        selectedIndex: _deliveryModeIndex,
                        tabs: [
                          const TabItem(title: 'Kurye', icon: Icons.delivery_dining),
                          const TabItem(title: 'Gel Al', icon: Icons.shopping_bag_outlined),
                          // Show Masa tab if business supports dine-in or reservations
                          if ((data?['hasReservation'] as bool? ?? false) ||
                              (_planFeatures['dineInQR'] == true) ||
                              (_planFeatures['waiterOrder'] == true))
                            const TabItem(title: 'Masa', icon: Icons.restaurant),
                        ],
                        onTabSelected: (index) {
                          setState(() => _deliveryModeIndex = index);
                        },
                      ),
                centerTitle: true,
                actions: [
                  // Search Icon with white circular background
                  Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Material(
                      color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                      shape: const CircleBorder(),
                      elevation: 2,
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: () {
                          _showMenuSearchOverlay();
                        },
                        child: SizedBox(
                          width: 40, height: 40,
                          child: Icon(Icons.search, color: textPrimary, size: 20),
                        ),
                      ),
                    ),
                  ),
                ],
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
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 8)],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: CachedNetworkImage(
                                    imageUrl: data!['logoUrl'],
                                    fit: BoxFit.cover,
                                  ),
                                ),
                              ),
                            ),
                          // Brand Badge (Top Left - matching list view)
                          if (showBrandBadge)
                            Positioned(
                              top: 12,
                              left: 0,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFD32F2F),
                                  borderRadius: BorderRadius.only(
                                    topRight: Radius.circular(8),
                                    bottomRight: Radius.circular(8),
                                  ),
                                ),
                                child: Text(
                                  _getBrandLabel(brand).toUpperCase(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
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
                                  ? accent.withOpacity(0.9) 
                                  : Colors.black.withOpacity(0.4),
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
                                    color: Colors.white,
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
                               data?['companyName'] ?? data?['name'] ?? 'İşletme',
                               style: TextStyle(
                                 color: Theme.of(context).colorScheme.onSurface,
                                 fontSize: 24,
                                 fontWeight: FontWeight.w800,
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
                                   color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
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
                                       color: Theme.of(context).colorScheme.onSurface.withOpacity(0.8),
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
                                   isOpen ? 'Açık' : 'Kapalı',
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
                               'Min. ${data!['minDeliveryOrder']}€',
                               style: TextStyle(
                                 color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
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
                              // Scrollable category chips
                              Expanded(
                                child: ListView.builder(
                                  scrollDirection: Axis.horizontal,
                                  padding: const EdgeInsets.only(left: 16, right: 4, top: 8, bottom: 8),
                                  itemCount: _categories.length,
                                  itemBuilder: (context, index) {
                                    final cat = _categories[index];
                                    final isSelected = _selectedCategory == cat['name'];
                                    return Padding(
                                      padding: const EdgeInsets.only(right: 6),
                                      child: GestureDetector(
                                        onTap: () => _selectCategory(cat['name']),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                          decoration: BoxDecoration(
                                            color: isSelected 
                                              ? (isDark ? Colors.white : Colors.black87) 
                                              : Colors.transparent,
                                            borderRadius: BorderRadius.circular(20),
                                          ),
                                          child: Text(
                                            cat['name'],
                                            style: TextStyle(
                                              color: isSelected 
                                                ? (isDark ? Colors.black : Colors.white) 
                                                : (isDark ? Colors.white70 : Colors.black54),
                                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                              fontSize: 14,
                                            ),
                                          ),
                                        ),
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

              // 4. Products List Header
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                       Text(
                         _selectedCategory == 'Tümü' ? 'Tüm Ürünler' : _selectedCategory, 
                         style: TextStyle(color: textPrimary, fontSize: 20, fontWeight: FontWeight.bold),
                       ),
                       Container(
                         padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                         decoration: BoxDecoration(
                           color: isDark ? Colors.white10 : Colors.black.withOpacity(0.05),
                           borderRadius: BorderRadius.circular(12),
                         ),
                         child: Text(
                           '${filteredProducts.length} Ürün', 
                           style: TextStyle(color: textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                         ),
                       )
                    ],
                  ),
                ),
              ),

              // 5. LIEFERANDO STYLE: Vertical Product List
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: filteredProducts.isEmpty 
                  ? SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(40.0),
                        child: Center(
                            child: Text(
                              'Bu kategoride ürün bulunamadı.', 
                              style: TextStyle(color: textSecondary),
                            )),
                      ),
                    )
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _buildLieferandoProductCard(
                          filteredProducts[index], 
                          ref.watch(cartProvider),
                          isDark: isDark,
                          accent: accent,
                          cardBg: cardBg,
                          textPrimary: textPrimary,
                          textSecondary: textSecondary,
                        ),
                        childCount: filteredProducts.length,
                      ),
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


  Widget _buildProductCard(ButcherProduct product, CartState cart) {
  final currentQty = _selections[product.sku] ?? product.minQuantity;
  final isByWeight = product.unitType == 'kg';
  
  // LOGIC CHANGE: Price Chip now reflects what is IN THE CART, not what is selected
  // Check if item is in cart
  final cartItem = cart.items.firstWhere(
    (item) => item.product.sku == product.sku, 
    orElse: () => CartItem(product: product, quantity: 0) // Dummy empty item with 0 qty
  );
  
  // If in cart (quantity > 0), show that price. Else show 0.
  double displayPrice = 0;
  if (cartItem.quantity > 0) {
      displayPrice = cartItem.totalPrice;
  }

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E), // Dark Card Background
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Image & Badge Area
          Stack(
            children: [
              // Product Image
              AspectRatio(
                aspectRatio: 1.5,
                child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                    ? (product.imageUrl!.startsWith('assets/') 
                        ? Image.asset(
                            product.imageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_,__,___) => Container(
                              color: Colors.grey[800],
                              child: const Icon(Icons.image_not_supported, color: Colors.white24),
                            ),
                          )
                        : Image.network(
                            product.imageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_,__,___) => Container(
                              color: Colors.grey[800],
                              child: const Icon(Icons.image, color: Colors.white24),
                            ),
                          ))
                    : Container(
                        color: Colors.grey[800],
                        child: const Icon(Icons.restaurant, color: Colors.white24, size: 40),
                      ),
              ),
              
              // Out of Stock Badge
              if (!product.inStock)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: product.allowBackorder 
                        ? (product.expectedRestockDate != null ? Colors.blue[800] : Colors.orange[800])
                        : const Color(0xFFD32F2F), // Red Pill if truly out
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                         BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 4, offset:const Offset(0,2))
                      ],
                    ),
                    child: Text(
                      product.allowBackorder 
                        ? (product.expectedRestockDate != null 
                            ? 'GELİYOR: ${product.expectedRestockDate!.day}.${product.expectedRestockDate!.month} ${product.expectedRestockDate!.hour.toString().padLeft(2, '0')}:${product.expectedRestockDate!.minute.toString().padLeft(2, '0')}' 
                            : 'ÖN SİPARİŞ')
                        : 'TÜKENDİ',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                  ),
                ),
            ],
          ),

          // 2. Content Area
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white, 
                      fontWeight: FontWeight.bold, 
                      fontSize: 16
                    ),
                  ),
                  
                  // Description
                  const SizedBox(height: 4),
                  Text(
                    product.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: Colors.grey[400], fontSize: 11, height: 1.2),
                  ),

                  if (product.allowBackorder && !product.inStock)
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.blue[900]?.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.blue[800]!, width: 1),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.event_available, color: Colors.blue[400], size: 14),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  product.expectedRestockDate != null
                                   ? 'Tahmini Stok: ${product.expectedRestockDate!.day}.${product.expectedRestockDate!.month} ${product.expectedRestockDate!.hour.toString().padLeft(2, '0')}:${product.expectedRestockDate!.minute.toString().padLeft(2, '0')}'
                                   : 'Ön Sipariş Verebilirsiniz',
                                  style: TextStyle(
                                    color: Colors.blue[200], 
                                    fontSize: 11, 
                                    fontWeight: FontWeight.bold
                                  ),
                                ),
                                if (product.expectedRestockDate != null)
                                  Text(
                                    'Bu tarihte teslim edilecektir.',
                                    style: TextStyle(color: Colors.blue[100], fontSize: 9),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                  const Spacer(),
                  
                  // Price Tag Row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '${product.price.toStringAsFixed(0)} €',
                        style: const TextStyle(
                          color: Color(0xFFE53935), // Red Price
                          fontWeight: FontWeight.w800, 
                          fontSize: 18
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isByWeight ? 'kg fiyatı' : 'adet fiyatı',
                        style: TextStyle(color: Colors.grey[500], fontSize: 10),
                      ),
                    ],
                  ),
                  
                  if (isByWeight)
                     Padding(
                       padding: const EdgeInsets.only(top: 2),
                       child: Text(
                        'Premium kalite. %100 Yerli.', // Placeholder tagline or extra info
                        style: TextStyle(color: Colors.grey[600], fontSize: 10, fontStyle: FontStyle.italic),
                       ),
                     ),
                ],
              ),
            ),
          ),

          // 3. Action Area (Quantity & Button)
          Container(
            padding: const EdgeInsets.all(12),
            color: const Color(0xFF252525), // Slightly lighter implementation container
            child: Column(
              children: [
                // Quantity Selector (Unified Dark Box)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF151515), // Very dark background for selector
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Decrease
                      _buildQtyBtn(
                        icon: Icons.remove,
                        onTap: () {
                          final newQty = currentQty - product.stepQuantity;
                          if (newQty >= product.minQuantity) {
                             setState(() => _selections[product.sku] = newQty);
                          }
                        },
                      ),
                      
                      // Quantity Text
                      Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            isByWeight 
                                ? (currentQty * 1000).toStringAsFixed(0) 
                                : currentQty.toStringAsFixed(0),
                            style: const TextStyle(
                              color: Colors.white, 
                              fontSize: 16, 
                              fontWeight: FontWeight.bold
                            ),
                          ),
                          Text(
                            isByWeight ? 'gram' : 'adet',
                            style: TextStyle(color: Colors.grey[500], fontSize: 10),
                          ),
                        ],
                      ),

                      // Increase
                      _buildQtyBtn(
                        icon: Icons.add,
                        onTap: () {
                           setState(() => _selections[product.sku] = currentQty + product.stepQuantity);
                        },
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // "Sepete Ekle" Button (Full Width, Dark)
                SizedBox(
                  width: double.infinity,
                  height: 42,
                  child: ElevatedButton(
                    onPressed: (product.inStock || product.allowBackorder) ? () {
                      final data = _butcherDoc?.data() as Map<String, dynamic>?;
                      final butcherName = data?['companyName'] ?? data?['name'] ?? 'Kasap';
                      ref.read(cartProvider.notifier).addToCart(product, currentQty, widget.businessId, butcherName);
                      
                      ScaffoldMessenger.of(context).hideCurrentSnackBar();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF4CAF50),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.check_circle, color: Colors.white, size: 24),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text(
                                      'Sepetinize Eklendi!',
                                      style: TextStyle(
                                        color: Color(0xFF1E1E1E),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      product.name,
                                      style: TextStyle(
                                        color: Colors.grey[700],
                                        fontSize: 13,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          behavior: SnackBarBehavior.floating,
                          backgroundColor: Colors.white,
                          margin: const EdgeInsets.only(bottom: 80, left: 16, right: 16),
                          elevation: 8,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    } : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: (product.inStock || product.allowBackorder) ? _getAccent(context) : Colors.white10, // Light visible gray
                      foregroundColor: (product.inStock || product.allowBackorder) ? Colors.white : Colors.grey[500], // Visible disabled text
                      disabledBackgroundColor: Colors.white10, // Explicit disabled bg
                      disabledForegroundColor: Colors.grey[500], // Explicit disabled text
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 8), // Reduced Padding
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center, // Center checking
                      children: [
                        // Left Side: Icon + Text
                         const Icon(Icons.shopping_basket_outlined, size: 18),
                         const SizedBox(width: 6),
                         Flexible(
                           child: Text(
                             (product.inStock || product.allowBackorder) 
                               ? (product.allowBackorder && !product.inStock ? 'Ön Sipariş' : 'Sepete Ekle')
                               : 'TÜKENDİ',
                             overflow: TextOverflow.ellipsis,
                             style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                           ),
                         ),
                        
                        // Right Side: Price Chip (Only if In Cart > 0)
                        if (displayPrice > 0) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.white24,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${displayPrice.toStringAsFixed(0)} €',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ],
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

  Widget _buildQtyBtn({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 40, height: 40,
        decoration: BoxDecoration(
          color: Colors.white10,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }

  Widget _buildCartBar() {
     final cart = ref.watch(cartProvider);
     
     if (cart.isEmpty) return const SizedBox.shrink();
     
     final isDark = Theme.of(context).brightness == Brightness.dark;
     final barBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
     final barShadow = isDark ? Colors.black54 : Colors.black12;
     final barBorder = isDark ? Colors.white10 : Colors.black12;
     final iconBg = isDark ? Colors.white10 : Colors.grey.shade100;
     final iconColor = isDark ? Colors.white : Colors.black87;
     final subtitleColor = isDark ? Colors.grey : Colors.grey.shade600;
     final priceColor = isDark ? Colors.white : Colors.black87;

     return Container(
       padding: EdgeInsets.only(
         left: 16, right: 16, top: 16, 
         bottom: MediaQuery.of(context).padding.bottom + 16
       ),
       decoration: BoxDecoration(
         color: barBg,
         boxShadow: [BoxShadow(color: barShadow, blurRadius: 10, offset: const Offset(0, -5))],
         border: Border(top: BorderSide(color: barBorder)),
       ),
       child: Row(
         children: [
           Container(
             padding: const EdgeInsets.all(12),
             decoration: BoxDecoration(
               color: iconBg,
               borderRadius: BorderRadius.circular(12),
             ),
             child: Icon(Icons.shopping_bag, color: iconColor, size: 24),
           ),
           const SizedBox(width: 16),
           Column(
             mainAxisSize: MainAxisSize.min,
             crossAxisAlignment: CrossAxisAlignment.start,
             children: [
               Text('${cart.items.length} Ürün', style: TextStyle(color: subtitleColor, fontSize: 12)),
               Text('€${cart.totalAmount.toStringAsFixed(2)}', style: TextStyle(color: priceColor, fontSize: 18, fontWeight: FontWeight.bold)),
             ],
           ),
           const Spacer(),
           ElevatedButton(
             onPressed: () {
               Navigator.of(context).push(
                 MaterialPageRoute(builder: (context) => CartScreen(initialPickUp: _deliveryModeIndex == 1, initialDineIn: _isMasaMode, initialTableNumber: widget.initialTableNumber)),
               );
             },
             style: ElevatedButton.styleFrom(
               backgroundColor: _getAccent(context),
               foregroundColor: Colors.white,
               padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
               shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
             ),
             child: Row(
               children: [
                 Text(_isMasaMode ? 'Siparişi Gönder' : 'Sepete Git', style: const TextStyle(fontWeight: FontWeight.bold)),
                 const SizedBox(width: 8),
                 Icon(_isMasaMode ? Icons.restaurant : Icons.arrow_forward, size: 16),
               ],
             ),
           ),
         ],
       ),
     );
  }

  // LIEFERANDO STYLE: Quick Add Product Bottom Sheet
  void _showProductBottomSheet(ButcherProduct product) {
    final isByWeight = product.unitType == 'kg';
    final cart = ref.read(cartProvider);
    final existingCartItem = cart.items.firstWhere(
      (item) => item.product.sku == product.sku,
      orElse: () => CartItem(product: product, quantity: 0),
    );
    final isEditing = existingCartItem.quantity > 0;
    double selectedQty = isEditing ? existingCartItem.quantity : (_selections[product.sku] ?? product.minQuantity);
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final accent = _getAccent(ctx);
        final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
        
        return StatefulBuilder(
          builder: (context, setStateModal) {
            return Container(
              padding: EdgeInsets.only(
                top: 20,
                left: 20,
                right: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white24 : Colors.black12,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Product Info
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          width: 80,
                          height: 80,
                          color: isDark ? Colors.white10 : Colors.grey[100],
                          child: (product.imageUrl?.isNotEmpty == true)
                            ? Image.network(product.imageUrl!, fit: BoxFit.cover)
                            : Icon(Icons.restaurant_menu, size: 32, color: isDark ? Colors.white24 : Colors.grey[400]),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product.name,
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '€${product.price.toStringAsFixed(2)}${isByWeight ? '/kg' : ''}',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: accent,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  // Quantity Selector
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[100],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Decrease / Delete
                        Material(
                          color: (isEditing && selectedQty <= product.minQuantity)
                            ? Colors.red.withOpacity(0.15)
                            : (isDark ? Colors.white12 : Colors.grey[300]),
                          borderRadius: BorderRadius.circular(8),
                          child: InkWell(
                            onTap: () {
                              if (isEditing && selectedQty <= product.minQuantity) {
                                // Remove from cart
                                ref.read(cartProvider.notifier).removeFromCart(product.sku);
                                setState(() => _selections.remove(product.sku));
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('${product.name} sepetten kaldırıldı'),
                                    duration: const Duration(seconds: 2),
                                    behavior: SnackBarBehavior.floating,
                                    backgroundColor: Colors.red[600],
                                  ),
                                );
                                return;
                              }
                              final newQty = selectedQty - product.stepQuantity;
                              if (newQty >= product.minQuantity) {
                                setStateModal(() => selectedQty = newQty);
                              }
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 44,
                              height: 44,
                              alignment: Alignment.center,
                              child: Icon(
                                (isEditing && selectedQty <= product.minQuantity)
                                  ? Icons.delete_outline
                                  : Icons.remove,
                                color: (isEditing && selectedQty <= product.minQuantity)
                                  ? Colors.red
                                  : (isDark ? Colors.white : Colors.black87),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 24),
                        // Quantity Display
                        Column(
                          children: [
                            Text(
                              isByWeight 
                                ? (selectedQty * 1000).toStringAsFixed(0)
                                : selectedQty.toStringAsFixed(0),
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            Text(
                              isByWeight ? 'gram' : 'adet',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? Colors.white54 : Colors.black45,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 24),
                        // Increase
                        Material(
                          color: accent,
                          borderRadius: BorderRadius.circular(8),
                          child: InkWell(
                            onTap: () {
                              setStateModal(() => selectedQty = selectedQty + product.stepQuantity);
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: const SizedBox(
                              width: 44,
                              height: 44,
                              child: Icon(Icons.add, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Add to Cart Button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () {
                        final data = _butcherDoc?.data() as Map<String, dynamic>?;
                        final butcherName = data?['companyName'] ?? data?['name'] ?? 'Kasap';
                        ref.read(cartProvider.notifier).addToCart(product, selectedQty, widget.businessId, butcherName);
                        setState(() => _selections[product.sku] = selectedQty);
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('${product.name} sepete eklendi'),
                            duration: const Duration(seconds: 2),
                            behavior: SnackBarBehavior.floating,
                            backgroundColor: accent,
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: Text(
                        isEditing
                          ? 'Güncelle - €${(product.price * selectedQty).toStringAsFixed(2)}'
                          : 'Sepete Ekle - €${(product.price * selectedQty).toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
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
    final cartItem = cart.items.firstWhere(
      (item) => item.product.sku == product.sku, 
      orElse: () => CartItem(product: product, quantity: 0),
    );
    final inCart = cartItem.quantity > 0;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: inCart ? Border.all(color: accent.withOpacity(0.5), width: 2) : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        onTap: () => _showProductBottomSheet(product),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product Image
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: 100,
                  height: 100,
                  color: isDark ? Colors.white10 : Colors.grey[100],
                  child: (product.imageUrl?.isNotEmpty == true)
                    ? Image.network(
                        product.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Icon(
                          Icons.restaurant_menu,
                          size: 40,
                          color: isDark ? Colors.white24 : Colors.grey[400],
                        ),
                      )
                    : Icon(
                        Icons.restaurant_menu,
                        size: 40,
                        color: isDark ? Colors.white24 : Colors.grey[400],
                      ),
                ),
              ),
              const SizedBox(width: 14),
              // Product Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name + Price
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            product.name,
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              height: 1.2,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '€${product.price.toStringAsFixed(2)}${isByWeight ? '/kg' : ''}',
                          style: TextStyle(
                            color: accent,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // Description
                    if (product.description.isNotEmpty)
                      Text(
                        product.description,
                        style: TextStyle(
                          color: textSecondary,
                          fontSize: 13,
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    const SizedBox(height: 10),
                    // Stock Status + Add Button
                    Row(
                      children: [
                        // Stock Badge
                        if (!product.inStock && !product.allowBackorder)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.red.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'Stokta Yok',
                              style: TextStyle(color: Colors.red, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          )
                        else if (inCart)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: accent.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.check_circle, color: accent, size: 12),
                                const SizedBox(width: 4),
                                Text(
                                  isByWeight 
                                    ? '${cartItem.quantity.toStringAsFixed(0)}g'
                                    : '${cartItem.quantity.toInt()} adet',
                                  style: TextStyle(color: accent, fontSize: 11, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        const Spacer(),
                        // Add Button
                        if (product.inStock || product.allowBackorder)
                          Material(
                            color: accent,
                            borderRadius: BorderRadius.circular(10),
                            child: InkWell(
                              onTap: () => _showProductBottomSheet(product),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(inCart ? Icons.edit : Icons.add, color: Colors.white, size: 16),
                                    const SizedBox(width: 4),
                                    Text(
                                      inCart ? 'Düzenle' : 'Ekle',
                                      style: const TextStyle(
                                        color: Colors.white,
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
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Reusable action card for Masa section (QR, Garson, Rezervasyon)
  Widget _buildMasaActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = Theme.of(context).colorScheme.onSurface;
    final textSecondary = isDark ? Colors.grey[400]! : Colors.grey[600]!;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [color.withOpacity(0.15), color.withOpacity(0.05)],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_ios, color: color, size: 16),
            ],
          ),
        ),
      ),
    );
  }

  /// MVP: Confirm dine-in with GPS proximity check
  void _startDineInOrder(BuildContext context, Map<String, dynamic>? data) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.restaurant, color: Colors.orange, size: 28),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Masada Sipariş',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.orange.withOpacity(0.3)),
              ),
              child: Column(
                children: [
                  Icon(Icons.location_on, color: Colors.orange, size: 32),
                  const SizedBox(height: 8),
                  Text(
                    data?['companyName'] ?? data?['name'] ?? 'İşletme',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Bu işletmede masada olduğunuzu onaylıyor musunuz?',
                    style: TextStyle(
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 13,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'İptal',
              style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.of(ctx).pop();
              // Set mode to Masa and show confirmation
              setState(() => _deliveryModeIndex = 2);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text('Masada sipariş modu aktif! Menüden ürün ekleyin.'),
                    ],
                  ),
                  backgroundColor: Colors.green,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              );
            },
            icon: const Icon(Icons.check, size: 18),
            label: const Text('Onaylıyorum'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
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

// 🔍 Search Bar Delegate for pinned search bar (Lieferando-style)
class _SearchBarDelegate extends SliverPersistentHeaderDelegate {
  final double height;
  final Widget child;

  _SearchBarDelegate({required this.height, required this.child});

  @override
  double get minExtent => height;

  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return SizedBox.expand(child: child);
  }

  @override
  bool shouldRebuild(_SearchBarDelegate oldDelegate) {
    return height != oldDelegate.height || child != oldDelegate.child;
  }
}

// 🔍 Full-screen menu search page with instant search
class _MenuSearchPage extends StatefulWidget {
  final String initialQuery;
  final ValueChanged<String> onSearch;
  final List<ButcherProduct> products;
  final VoidCallback? onProductTap;

  const _MenuSearchPage({
    required this.initialQuery,
    required this.onSearch,
    required this.products,
    this.onProductTap,
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

  List<ButcherProduct> get _filteredProducts {
    if (_localQuery.length < 2) return [];
    final query = _normalizeTurkish(_localQuery);
    return widget.products.where((p) => 
      _normalizeTurkish(p.name).contains(query) ||
      (p.description != null && _normalizeTurkish(p.description!).contains(query)) ||
      _normalizeTurkish(p.category).contains(query)
    ).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF8F8F8);
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.grey[400] : Colors.grey[600];
    final accent = const Color(0xFFD03140); // Brand color
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
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                // Search Input
                Expanded(
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[100],
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.grey.withOpacity(0.3)),
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
                              hintText: 'Menüde ara...',
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
                        if (_controller.text.isNotEmpty)
                          IconButton(
                            icon: const Icon(Icons.clear, color: Colors.grey, size: 20),
                            onPressed: () {
                              _controller.clear();
                              setState(() => _localQuery = '');
                            },
                          )
                        else
                          const SizedBox(width: 16),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Close Button (X)
                GestureDetector(
                  onTap: () {
                    // Clear the search query when closing without submitting
                    widget.onSearch('');
                    Navigator.of(context).pop();
                  },
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[200],
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
                              'Sonuç bulunamadı',
                              style: TextStyle(color: Colors.grey[500], fontSize: 16),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: groupedProducts.entries.fold<int>(
                          0, (sum, e) => sum + 1 + e.value.length), // Categories + products
                        itemBuilder: (context, index) {
                          // Build flat list with category headers
                          int currentIndex = 0;
                          for (final entry in groupedProducts.entries) {
                            // Category header
                            if (index == currentIndex) {
                              return Padding(
                                padding: const EdgeInsets.only(top: 16, bottom: 8),
                                child: Text(
                                  entry.key,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: textSecondary,
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
    return Column(
      children: [
        InkWell(
          onTap: () {
            // TODO: Add to cart logic
            Navigator.of(context).pop(); // Close search and navigate back
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product info (left side)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '€${product.price.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: textSecondary,
                        ),
                      ),
                      if (product.description != null && product.description!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          product.description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            color: textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // Product image + add button (right side)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        width: 80,
                        height: 80,
                        color: isDark ? Colors.grey[800] : Colors.grey[200],
                        child: (product.imageUrl != null && product.imageUrl!.isNotEmpty)
                            ? Image.network(
                                product.imageUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Icon(
                                  Icons.restaurant_menu,
                                  color: isDark ? Colors.grey[600] : Colors.grey[400],
                                  size: 32,
                                ),
                              )
                            : Icon(
                                Icons.restaurant_menu,
                                color: isDark ? Colors.grey[600] : Colors.grey[400],
                                size: 32,
                              ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // 🎨 BRAND COLOUR: "+" pill button (same style as main menu)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: accent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.add, color: Colors.white, size: 16),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        // Divider (except for last item)
        if (!isLast)
          Divider(
            height: 1,
            thickness: 1,
            color: isDark ? Colors.grey[800] : Colors.grey[300],
          ),
      ],
    );
  }
}
