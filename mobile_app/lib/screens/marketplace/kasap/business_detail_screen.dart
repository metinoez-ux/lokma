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
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:lokma_app/providers/theme_provider.dart';

class BusinessDetailScreen extends ConsumerStatefulWidget {
  final String businessId;
  
  const BusinessDetailScreen({super.key, required this.businessId});

  @override
  ConsumerState<BusinessDetailScreen> createState() => _BusinessDetailScreenState();
}

class _BusinessDetailScreenState extends ConsumerState<BusinessDetailScreen> {
  // Theme-aware colors (resolved in build method)
  // LIEFERANDO STYLE: Dynamic light/dark theme support
  static const Color _accentOrange = Color(0xFFFF8000); // Lieferando orange
  static const Color _accentRed = Color(0xFFE53935);    // Legacy red accent
  
  // Helper to get theme-aware accent color (for use in helper methods)
  // Uses brand color when available, otherwise falls back to theme accent
  Color _getAccent(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Check for brand color
    final data = _butcherDoc?.data() as Map<String, dynamic>?;
    final brand = data?['brand']?.toString().toLowerCase();
    
    if (brand == 'tuna') {
      return const Color(0xFFB71C1C); // TUNA brand red
    } else if (brand == 'akdeniz_toros') {
      return const Color(0xFF1B5E20); // Akdeniz Toros green
    }
    
    return isDark ? _accentRed : _accentOrange;
  }
  
  String _selectedCategory = 'Tümü';
  
  // 🔄 Dynamic categories loaded from Firestore
  List<Map<String, dynamic>> _categories = [
    {'name': 'Tümü', 'icon': Icons.grid_view, 'emoji': '🏠'},
  ];
  bool _categoriesLoaded = false;

  Map<String, dynamic>? _placeDetails;
  DocumentSnapshot? _butcherDoc;
  
  // Local Cart/Selection State (simple map: sku -> quantity)
  final Map<String, double> _selections = {};

  @override
  void initState() {
    super.initState();
    _loadButcherAndReviews();
    _setupCategoriesListener(); // 🔄 Real-time listener for categories
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
        builder: (context) => AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.schedule, color: Colors.orange, size: 28),
              const SizedBox(width: 12),
              const Text(
                'İşletme Şu An Kapalı',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
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
                style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
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
              onPressed: () => Navigator.pop(context),
              child: Text(
                preOrderEnabled ? 'Ön Sipariş Ver' : 'Göz At',
                style: const TextStyle(color: Colors.white54),
              ),
            ),
            if (!preOrderEnabled)
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context); // Close dialog
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
        ),
      );
    });
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
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E1E1E),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
            ),
            const Text('Haftalık Çalışma Saatleri', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            ..._buildHoursList(),
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
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.7,
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
            const Text('Kategori Seçin', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(24),
                itemCount: _categories.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                   final cat = _categories[index];
                   final isSelected = _selectedCategory == cat['name'];
                   return InkWell(
                     onTap: () {
                       setState(() => _selectedCategory = cat['name']);
                       Navigator.pop(context);
                     },
                     child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        decoration: BoxDecoration(
                          color: isSelected ? _getAccent(context) : const Color(0xFF2C2C2C),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isSelected ? _getAccent(context) : Colors.transparent),
                        ),
                        child: Row(
                          children: [
                            Icon(cat['icon'], color: Colors.white, size: 20),
                            const SizedBox(width: 12),
                            Expanded(child: Text(cat['name'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16))),
                            if (isSelected) const Icon(Icons.check_circle, color: Colors.white, size: 20),
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
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        try {
          return Container(
            height: MediaQuery.of(context).size.height * 0.6,
            decoration: const BoxDecoration(
              color: Color(0xFF1E1E1E),
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                // Handle
                Container(
                  margin: const EdgeInsets.only(top: 8, bottom: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                ),
                
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    children: [
                      // Title
                      Text(
                        _butcherDoc?['companyName'] ?? 'İşletme Bilgileri',
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
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
                          return _buildInfoRow(Icons.location_on, 'Adres', '$street\n$postalCode $city');
                        } catch (e) {
                          return _buildInfoRow(Icons.location_on, 'Adres', 'Adres bilgisi yok');
                        }
                      }),
                      const Divider(color: Colors.white10),
                      _buildInfoRow(Icons.phone, 'Telefon', _butcherDoc?['shopPhone']?.toString() ?? 'Belirtilmemiş', isAction: true, onTap: _callStore),
                      
                      const SizedBox(height: 12),
                      const Text('Çalışma Saatleri', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      
                      // Hours List - wrapped in try-catch builder
                      ..._buildHoursListSafe(),
                      
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

  Widget _buildInfoRow(IconData icon, String title, String content, {bool isAction = false, VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, color: _getAccent(context), size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   Text(title, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                   const SizedBox(height: 2),
                   Text(content, style: TextStyle(color: isAction ? Colors.blue[400] : Colors.white, fontSize: 14, height: 1.3)),
                ],
              ),
            ),
            if (isAction) Icon(Icons.arrow_forward_ios, color: Colors.white24, size: 12),
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

        return Container(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          decoration: BoxDecoration(
            color: isToday ? Colors.green.withOpacity(0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: isToday ? Border.all(color: Colors.green.withOpacity(0.3)) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(dayName, style: TextStyle(color: isToday ? Colors.green : Colors.grey[400], fontSize: 13, fontWeight: isToday ? FontWeight.bold : FontWeight.normal)),
              Text(content, style: TextStyle(color: isToday ? Colors.green : Colors.white, fontSize: 13, fontWeight: isToday ? FontWeight.bold : FontWeight.normal)),
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
          child: CircularProgressIndicator(color: isDark ? _accentRed : _accentOrange),
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
    
    // BRAND COLOR SYSTEM: Use brand-specific colors when available
    Color accent;
    if (brand?.toString().toLowerCase() == 'tuna') {
      accent = const Color(0xFFB71C1C); // TUNA brand red
    } else if (brand?.toString().toLowerCase() == 'akdeniz_toros') {
      accent = const Color(0xFF1B5E20); // Akdeniz Toros green
    } else {
      accent = isDark ? _accentRed : _accentOrange; // Default theme accent
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
          }

          // Filter by Category
          final filteredProducts = _selectedCategory == 'Tümü' 
              ? products 
              : products.where((p) => p.category == _selectedCategory).toList();

          return CustomScrollView(
            slivers: [
              // 1. Expanded Header (Image + Title)
              SliverAppBar(
                expandedHeight: 280, // Lieferando-style hero section
                floating: false,
                pinned: true,
                backgroundColor: scaffoldBg,
                leading: IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: Colors.black.withOpacity(0.5), shape: BoxShape.circle),
                    child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                  ),
                  onPressed: () {
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/restoran');
                    }
                  },
                ),
                actions: [
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: Colors.black.withOpacity(0.5), shape: BoxShape.circle),
                      child: Icon(
                        isFavorite ? Icons.favorite : Icons.favorite_border,
                        color: isFavorite ? accent : Colors.white,
                        size: 20,
                      ),
                    ),
                    onPressed: () {
                      ref.read(butcherFavoritesProvider.notifier).toggleFavorite(widget.businessId);
                    },
                  ),
                  Consumer(
                    builder: (context, ref, _) {
                      final cart = ref.watch(cartProvider);
                      final itemCount = cart.items.fold<int>(0, (sum, item) => sum + item.quantity.toInt());
                      
                      return Stack(
                        children: [
                          IconButton(
                            icon: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.5),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.shopping_cart, color: Colors.white, size: 20),
                            ),
                            onPressed: () => context.push('/cart'),
                          ),
                          if (itemCount > 0)
                            Positioned(
                              right: 8,
                              top: 8,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: accent,
                                  shape: BoxShape.circle,
                                ),
                                constraints: const BoxConstraints(
                                  minWidth: 18,
                                  minHeight: 18,
                                ),
                                child: Text(
                                  '$itemCount',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Butcher Image
                       (_butcherDoc != null && _butcherDoc!['imageUrl'] != null && (_butcherDoc!['imageUrl'] as String).isNotEmpty)
                          ? CachedNetworkImage(
                              imageUrl: _butcherDoc!['imageUrl'],
                              fit: BoxFit.cover,
                            )
                          : Image.asset('assets/images/kasap_card.png', fit: BoxFit.cover),
                      
                      // Gradient Overlay (Heavy bottom fade for text)
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                                Colors.transparent, 
                                Colors.black.withOpacity(0.2),
                                scaffoldBg.withOpacity(0.8), 
                                scaffoldBg
                            ],
                            stops: const [0.5, 0.6, 0.85, 1.0],
                          ),
                        ),
                      ),
                      
                      // Title & Location (Bottom Left)
                      Positioned(
                        left: 20, right: 20, bottom: 20,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              data?['companyName'] ?? data?['name'] ?? 'Kasap',
                              style: const TextStyle(
                                color: Colors.white, 
                                fontSize: 26, 
                                fontWeight: FontWeight.w800,
                                height: 1.1,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Icon(Icons.location_on, color: accent, size: 16),
                                const SizedBox(width: 4),
                                Text(
                                  '${address?['city'] ?? 'Konum'}, ${address?['country'] ?? 'DE'}',
                                  style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500),
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

                // 2. Action Bar (Buttons + Chips)
              SliverToBoxAdapter(
                 child: Container(
                   padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2), // More compact
                   child: Column(
                     children: [
                       // 2a. Action Buttons
                       Row(
                         children: [
                           Expanded(
                             child: ElevatedButton.icon(
                               onPressed: _callStore,
                               icon: const Icon(Icons.phone, size: 16), // Smaller Icon
                               label: const Text('Ara', style: TextStyle(fontSize: 13)), // Smaller Text
                               style: ElevatedButton.styleFrom(
                                 backgroundColor: const Color(0xFF2C2C2C),
                                 foregroundColor: Colors.white,
                                 shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                 padding: const EdgeInsets.symmetric(vertical: 8), // Compact Button
                                 elevation: 0,
                               ),
                             ),
                           ),
                           const SizedBox(width: 8),
                           Expanded(
                             child: ElevatedButton.icon(
                               onPressed: _launchMaps,
                               icon: const Icon(Icons.directions, size: 16),
                               label: const Text('Yol Tarifi', style: TextStyle(fontSize: 13)),
                               style: ElevatedButton.styleFrom(
                                 backgroundColor: const Color(0xFF2C2C2C),
                                 foregroundColor: Colors.white,
                                 shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                 padding: const EdgeInsets.symmetric(vertical: 8),
                                 elevation: 0,
                               ),
                             ),
                           ),
                           const SizedBox(width: 8),
                           Expanded(
                             child: ElevatedButton.icon(
                               onPressed: _showInfoSheet,
                               icon: const Icon(Icons.info_outline, size: 16),
                               label: const Text('Bilgi', style: TextStyle(fontSize: 13)),
                               style: ElevatedButton.styleFrom(
                                 backgroundColor: const Color(0xFF2C2C2C),
                                 foregroundColor: Colors.white,
                                 shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                 padding: const EdgeInsets.symmetric(vertical: 8),
                                 elevation: 0,
                               ),
                             ),
                           ),
                         ],
                       ),
                       
                       const SizedBox(height: 8), // More compact
                       
                       // 2b. Status Chips Row
                       Row(
                         children: [
                           // Brand Badge
                           if (showBrandBadge) ...[
                             InkWell(
                               onTap: _showTunaBrandInfo,
                               child: Container(
                                 padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                 decoration: BoxDecoration(
                                   color: const Color(0xFFD32F2F),
                                   borderRadius: BorderRadius.circular(20),
                                 ),
                                 child: Row(
                                   children: [
                                     Text(
                                       _getBrandLabel(brand),
                                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                                     ),
                                     const SizedBox(width: 4),
                                      const Icon(Icons.info, color: Colors.white, size: 12)
                                   ],
                                 ),
                               ),
                             ),
                             const SizedBox(width: 8),
                           ],
                           
                           // Rating Pill
                           if (_placeDetails != null) ...[
                               InkWell(
                                 onTap: _showRatings,
                                 child: Container(
                                   padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                   decoration: BoxDecoration(
                                     color: Colors.amber.withOpacity(0.1),
                                     borderRadius: BorderRadius.circular(20),
                                     border: Border.all(color: Colors.amber.withOpacity(0.3)),
                                   ),
                                   child: Row(
                                     children: [
                                       const Icon(Icons.star, color: Colors.amber, size: 14),
                                       const SizedBox(width: 4),
                                       Text(
                                         '${_placeDetails!['rating']} (${_placeDetails!['user_ratings_total']})',
                                         style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold),
                                       ),
                                     ],
                                   ),
                                 ),
                               ),
                               const SizedBox(width: 8),
                           ],
                           
                           // Open/Closed Status
                           InkWell(
                             onTap: _showWeeklyHours,
                             child: Container(
                               padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                               decoration: BoxDecoration(
                                 color: isOpen ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                                 borderRadius: BorderRadius.circular(20),
                                 border: Border.all(color: isOpen ? Colors.green.withOpacity(0.3) : Colors.red.withOpacity(0.3)),
                               ),
                               child: Row(
                                 children: [
                                   Container(width: 6, height: 6, decoration: BoxDecoration(color: isOpen ? Colors.green : Colors.red, shape: BoxShape.circle)),
                                   const SizedBox(width: 6),
                                   Text(
                                     isOpen ? 'Şu An Açık' : 'Şu An Kapalı',
                                     style: TextStyle(color: isOpen ? Colors.green : Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
                                   ),
                                   const SizedBox(width: 4),
                                   Icon(Icons.keyboard_arrow_down, color: isOpen ? Colors.green : Colors.red, size: 14),
                                 ],
                               ),
                             ),
                           ),
                         ],
                       ),
                       
                       const SizedBox(height: 6), // Compact
                       
                       // 2c. Services & Features Row (NEW!)
                       SingleChildScrollView(
                         scrollDirection: Axis.horizontal,
                         child: Row(
                           children: [
                             // Business Category Badge
                             if (data?['businessCategories'] != null && (data!['businessCategories'] as List).isNotEmpty)
                               _buildServiceBadge(
                                 _getCategoryIcon((data['businessCategories'] as List).first?.toString() ?? 'kasap'),
                                 _getCategoryLabel((data['businessCategories'] as List).first?.toString() ?? 'kasap'),
                                 Colors.orange,
                               ),
                             
                             // Delivery Badge
                             if ((data?['deliveryRadius'] ?? 0) > 0)
                               _buildServiceBadge(
                                 Icons.delivery_dining,
                                 'Teslimat (${data!['deliveryRadius']} km)',
                                 Colors.blue,
                               ),
                             
                             // Card Payment Badge
                             if (data?['acceptsCardPayment'] == true)
                               _buildServiceBadge(
                                 Icons.credit_card,
                                 'Kart Kabul',
                                 Colors.green,
                               ),
                             
                             // Seating Badge
                             if (data?['hasSeating'] == true)
                               _buildServiceBadge(
                                 Icons.chair_alt,
                                 'Oturma (${data!['tableCount'] ?? 0} masa)',
                                 Colors.purple,
                               ),
                             
                             // Min Order Badge
                             if ((data?['minDeliveryOrder'] ?? 0) > 0)
                               _buildServiceBadge(
                                 Icons.euro,
                                 'Min. ${data!['minDeliveryOrder']}€',
                                 Colors.amber,
                               ),
                           ],
                         ),
                       ),
                     ],
                   ),
                 ),
              ),

              // 3. LIEFERANDO STYLE: Sticky Horizontal Category Tabs
              SliverPersistentHeader(
                pinned: true,
                delegate: _StickyTabDelegate(
                  minHeight: 56,
                  maxHeight: 56,
                  child: Container(
                    color: scaffoldBg,
                    child: Column(
                      children: [
                        Expanded(
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            itemCount: _categories.length,
                            itemBuilder: (context, index) {
                              final cat = _categories[index];
                              final isSelected = _selectedCategory == cat['name'];
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: GestureDetector(
                                  onTap: () => setState(() => _selectedCategory = cat['name']),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: isSelected 
                                        ? (isDark ? accent : Colors.black87) 
                                        : (isDark ? cardBg : Colors.white),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: isSelected 
                                          ? Colors.transparent 
                                          : (isDark ? Colors.white24 : Colors.black12),
                                      ),
                                      boxShadow: isSelected ? [
                                        BoxShadow(
                                          color: accent.withOpacity(0.3),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ] : null,
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (cat['emoji'] != null && cat['emoji'] != '🏠') ...[
                                          Text(cat['emoji'], style: const TextStyle(fontSize: 14)),
                                          const SizedBox(width: 6),
                                        ],
                                        Text(
                                          cat['name'],
                                          style: TextStyle(
                                            color: isSelected 
                                              ? Colors.white 
                                              : (isDark ? Colors.white70 : Colors.black87),
                                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
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

     return Container(
       padding: EdgeInsets.only(
         left: 16, right: 16, top: 16, 
         bottom: MediaQuery.of(context).padding.bottom + 16
       ),
       decoration: const BoxDecoration(
         color: Color(0xFF1E1E1E),
         boxShadow: [BoxShadow(color: Colors.black, blurRadius: 10, offset: Offset(0, -5))],
         border: Border(top: BorderSide(color: Colors.white10)),
       ),
       child: Row(
         children: [
           Container(
             padding: const EdgeInsets.all(12),
             decoration: BoxDecoration(
               color: Colors.white10,
               borderRadius: BorderRadius.circular(12),
             ),
             child: const Icon(Icons.shopping_bag, color: Colors.white, size: 24),
           ),
           const SizedBox(width: 16),
           Column(
             mainAxisSize: MainAxisSize.min,
             crossAxisAlignment: CrossAxisAlignment.start,
             children: [
               Text('${cart.items.length} Ürün', style: const TextStyle(color: Colors.grey, fontSize: 12)),
               Text('€${cart.totalAmount.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
             ],
           ),
           const Spacer(),
           ElevatedButton(
             onPressed: () {
               Navigator.of(context).push(
                 MaterialPageRoute(builder: (context) => const CartScreen()),
               );
             },
             style: ElevatedButton.styleFrom(
               backgroundColor: _getAccent(context),
               foregroundColor: Colors.white,
               padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
               shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
             ),
             child: const Row(
               children: [
                 Text('Sepete Git', style: TextStyle(fontWeight: FontWeight.bold)),
                 SizedBox(width: 8),
                 Icon(Icons.arrow_forward, size: 16),
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
    double selectedQty = _selections[product.sku] ?? product.minQuantity;
    
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
                        // Decrease
                        Material(
                          color: isDark ? Colors.white12 : Colors.grey[300],
                          borderRadius: BorderRadius.circular(8),
                          child: InkWell(
                            onTap: () {
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
                              child: Icon(Icons.remove, color: isDark ? Colors.white : Colors.black87),
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
                        'Sepete Ekle - €${(product.price * selectedQty).toStringAsFixed(2)}',
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
