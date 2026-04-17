import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/widgets/mira_3d_switch.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';

class ButchersScreen extends ConsumerStatefulWidget {
  const ButchersScreen({super.key});

  @override
  ConsumerState<ButchersScreen> createState() => _ButchersScreenState();
}

class _ButchersScreenState extends ConsumerState<ButchersScreen> {
  // Dark theme colors
  static const Color darkBg = Color(0xFF1C1B18);
  static const Color accent = Color(0xFFEA184A);
  
  bool _isPickup = true; // Gel Al vs Kurye
  bool _showOnlyTuna = true; // Default
  double _maxDistance = 50.0; // Default 50km as per screenshot
  final TextEditingController _searchController = TextEditingController();

  // Helper to extract today's hours
  String _getTodayHours(dynamic hoursData) {
    if (hoursData == null) return 'Keine Zeiten';
    if (hoursData is String) return hoursData; 
    
    // Handle Array (New Google Import)
    if (hoursData is List) {
       if (hoursData.isEmpty) return 'Keine Zeiten';
       
       final now = DateTime.now();
       final engDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
       final trDays = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
       final deDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
       
       final todayIndex = now.weekday - 1; 

       // Try to find a string starting with today's name
       for (var item in hoursData) {
          if (item is! String) continue;
          if (item.trim().isEmpty) continue;
          
          final lower = item.toLowerCase();
          
          // Check against English, Turkish, German
          if (lower.startsWith(engDays[todayIndex].toLowerCase()) || 
              lower.startsWith(trDays[todayIndex].toLowerCase()) ||
              lower.startsWith(deDays[todayIndex].toLowerCase())) {
             
             // Found. Strip the "Day: " prefix
             // Format: "Monday: 09:00 - 18:00" -> "09:00 - 18:00"
             final parts = item.split(': ');
             if (parts.length > 1) {
                 return parts.sublist(1).join(': ').trim(); 
             }
             return item; // Fallback if no colon space
          }
       }
       return 'Keine Zeiten';
    }

    if (hoursData is Map) {
      final now = DateTime.now();
      // Map keys are usually english or turkish? Google Places returns English keys.
      // But Admin Panel seed uses: keys from `details.opening_hours.weekday_text` which are "Monday: ..." ?
      // No, let's look at Route.
      // Route code: day = parts[0].toLowerCase(); hours[day] = ...
      // If Route uses `weekday_text` from Google, it depends on `language=tr` param!
      // Step 1192: `language=tr`.
      // Google TR keys: "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi", "pazar".
      
      final days = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'];
      final todayKey = days[now.weekday - 1]; // weekday 1=Mon
      
      var val = hoursData[todayKey] ?? hoursData[todayKey.toLowerCase()];
      if (val == null) {
          // Fallback to English if TR failed
          final engDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          val = hoursData[engDays[now.weekday - 1]];
      }
      
      if (val is String) return val;
    }
    return 'Keine Zeiten';
  }

  // Calculate dynamic Open/Closed status
  bool _isShopOpenNow(dynamic hoursData, {dynamic deliveryHoursData, dynamic pickupHoursData}) {
    // Check openingHours first
    if (hoursData != null && _checkTimeOpen(hoursData)) return true;
    // Fallback: check deliveryHours
    if (deliveryHoursData != null && _checkTimeOpen(deliveryHoursData)) return true;
    // Fallback: check pickupHours
    if (pickupHoursData != null && _checkTimeOpen(pickupHoursData)) return true;
    // If no hours data at all, default to open
    if (hoursData == null && deliveryHoursData == null && pickupHoursData == null) return true;
    return false;
  }

  bool _checkTimeOpen(dynamic hoursData) {
    if (hoursData == null) return false;
    
    // Get string for today
    final formatted = _getTodayHours(hoursData); 
    
    // Normalize
    final lower = formatted.toLowerCase();
    
    // Strict Closed Checks
    if (lower.contains('kapalı') || lower.contains('closed') || lower.contains('geschlossen') || formatted == 'Keine Zeiten') return false;
    if (formatted.trim() == '-' || formatted.trim() == '') return false;
    
    if (lower.contains('24 saat') || lower.contains('open 24')) return true;

    try {
      final now = DateTime.now();
      
      // Support Split Shifts: "09:00 - 12:00, 13:00 - 18:00"
      final ranges = formatted.split(',');

      for (var range in ranges) {
          // Expected: "09:00 - 22:00" or "09:00 – 22:00"
          final cleaned = range.replaceAll('–', '-').trim(); 
          if (cleaned.isEmpty || cleaned == '-') continue;

          final parts = cleaned.split('-');
          if (parts.length != 2) continue; // Skip invalid format

          final startParts = parts[0].trim().split(':');
          final endParts = parts[1].trim().split(':');
          
          if (startParts.length < 2 || endParts.length < 2) continue;
          
          // Verify they are numbers
          if (int.tryParse(startParts[0]) == null || int.tryParse(endParts[0]) == null) continue;

          final start = DateTime(now.year, now.month, now.day, int.parse(startParts[0]), int.parse(startParts[1]));
          var end = DateTime(now.year, now.month, now.day, int.parse(endParts[0]), int.parse(endParts[1]));
          
          // Handle overnight (e.g. 18:00 - 02:00)
          if (end.isBefore(start) || end.isAtSameMomentAs(start)) {
             end = end.add(const Duration(days: 1));
             if (now.isAfter(start)) return true;
          }

          if (now.isAfter(start) && now.isBefore(end)) {
             return true;
          }
      }
      
      return false;
    } catch (e) {
      return false; // Fail safe
    }
  }

  
  // Location
  Position? _userPosition;
  
  // Dummy Banners
  final List<Map<String, dynamic>> _banners = [
    {
      'title': 'Rindergoulasch',
      'subtitle': 'Zart, aus bester Keule',
      'image': 'assets/images/kasap_card.png',
    },
    {
      'title': 'Frisches Hackfleisch',
      'subtitle': 'Täglich frisch, 100% Rind',
      'image': 'assets/images/kasap_card.png',
    },
    {
      'title': 'Kuzu Pirzola',
      'subtitle': 'Premium Qualität, Halal-zertifiziert',
      'image': 'assets/images/kasap_card.png',
    },
  ];

  // Stream cache to prevent rebuild flickering
  late Stream<QuerySnapshot> _butchersStream;

  @override
  void initState() {
    super.initState();
    _getUserLocation();
    
    // Initialize stream once to prevent re-subscription on UI updates (like toggles)
    _butchersStream = FirebaseFirestore.instance
        .collection('businesses')
        .where('isActive', isEqualTo: true)
        .snapshots();

    // Auto-seed for Admin Panel synchronization (One-off trigger or check)
    // Auto-seed disabled to prevent duplicates. Use Admin Panel Sync instead.
    // WidgetsBinding.instance.addPostFrameCallback((_) {
    //    ButcherDataSeeder.seedButchers(context);
    // });
  }

  @override
  void dispose() {
    super.dispose();
  }


  Future<void> _getUserLocation() async {
    // Permission check
    var status = await Permission.location.request();
    if (status.isGranted) {
      try {
        Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium);
        if (mounted) {
          setState(() {
            _userPosition = position;
          });
        }
      } catch (e) {
        debugPrint('Location error: $e');
      }
    }
  }

  double _calculateDistance(double lat, double lng) {
    if (_userPosition == null) return 999.0;
    double distInMeters = Geolocator.distanceBetween(
      _userPosition!.latitude, 
      _userPosition!.longitude, 
      lat, 
      lng
    );
    return distInMeters / 1000;
  }

  String _getBrandLabel(String? brand) {
    if (brand == null) return 'marketplace.independent_butcher'.tr();
    switch (brand.trim().toLowerCase()) {
      case 'tuna': return 'TUNA';
      case 'akdeniz_toros': return 'Akdeniz Toros';
      case 'independent': return 'marketplace.independent_butcher'.tr();
      default: return 'marketplace.independent_butcher'.tr();
    }
  }

  @override
  Widget build(BuildContext context) {
    final favoriteIds = ref.watch(butcherFavoritesProvider);

    return Scaffold(
      backgroundColor: darkBg,
      body: CustomScrollView(
        slivers: [
          // Hero Banner with 3D Carousel
          SliverAppBar(
            expandedHeight: 280,
            floating: false,
            pinned: true,
            backgroundColor: darkBg,
            leading: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.4),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
              ),
              onPressed: () {
                // Use GoRouter to navigate back - prevents black screen if stack is empty
                if (Navigator.of(context).canPop()) {
                  Navigator.of(context).pop();
                } else {
                  context.go('/'); // Go to home if stack is empty
                }
              },
            ),
            actions: [
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
                            color: Colors.black.withOpacity(0.4),
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
                            decoration: const BoxDecoration(
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
                                fontWeight: FontWeight.w600,
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
                  // Background base image
                  Image.asset(
                    'assets/images/kasap_card.png',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                          color: darkBg,
                    ),
                  ),
                  // Dark gradient overlay
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          darkBg.withOpacity(0.2),
                          darkBg.withOpacity(0.8),
                          darkBg,
                        ],
                        stops: const [0.0, 0.4, 0.7, 1.0],
                      ),
                    ),
                  ),
                  // Isolated 3D Carousel
                  Positioned(
                    top: 50,
                    left: 0,
                    right: 0,
                    height: 140, // Increased height to accommodate dots
                    child: _ButcherBannerCarousel(banners: _banners),
                  ),
                ],
              ),
            ),
          ),
          
          // Main content
          SliverToBoxAdapter(
            child: Container(
              decoration: BoxDecoration(
                color: darkBg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                   const SizedBox(height: 20),
                  
                  // Gel Al / Kurye Toggle - Sliding 3D Design
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: GestureDetector(
                      onTap: () {
                         HapticFeedback.mediumImpact();
                         setState(() => _isPickup = !_isPickup);
                      },
                      onHorizontalDragEnd: (details) {
                        if (details.primaryVelocity! > 0 && _isPickup) {
                          HapticFeedback.selectionClick();
                          setState(() => _isPickup = false); // Swipe Right -> Kurye
                        } else if (details.primaryVelocity! < 0 && !_isPickup) {
                           HapticFeedback.selectionClick();
                          setState(() => _isPickup = true); // Swipe Left -> Gel Al
                        }
                      },
                      child: Container(
                        height: 60, // Slightly taller for better touch target
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              const Color(0xFF1C1B18), // Pure dark neutral
                              const Color(0xFF202020), // Slightly lighter neutral
                            ],
                          ),
                          borderRadius: BorderRadius.circular(40),
                          border: Border.all(color: Colors.white.withOpacity(0.08), width: 0.5),
                          boxShadow: [
                            // Outer glow
                            BoxShadow(
                              color: Colors.black.withOpacity(0.6), // Removed accent glow
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                            BoxShadow(
                              color: Colors.black.withOpacity(0.5),
                              blurRadius: 6,
                              offset: const Offset(0, 3),
                            )
                          ],
                        ),
                        child: Stack(
                          children: [
                            // Subtle inner shadow overlay
                            Container(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(40),
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.black.withOpacity(0.3),
                                    Colors.transparent,
                                    Colors.white.withOpacity(0.03),
                                  ],
                                ),
                              ),
                            ),
                            
                            // Sliding Knob
                            AnimatedAlign(
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeOutBack,
                              alignment: _isPickup ? Alignment.centerLeft : Alignment.centerRight,
                              child: Container(
                                width: (MediaQuery.of(context).size.width - 32) / 2, // Half width
                                margin: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: accent,
                                  borderRadius: BorderRadius.circular(36),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.3),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                    BoxShadow(
                                        color: accent.withOpacity(0.4),
                                        blurRadius: 8,
                                        offset: const Offset(0, 0),
                                    )
                                  ],
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      accent.withOpacity(0.9),
                                      accent,
                                    ],
                                  ),
                                ),
                                  child: Center(
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                        children: [
                                        if (_isPickup)
                                          const Icon(Icons.store_mall_directory, color: Colors.white, size: 18)
                                        else
                                          Image.asset('assets/images/courier_icon.png', color: Colors.white, width: 18, height: 18),
                                        const SizedBox(width: 6),
                                        Text(
                                          _isPickup ? 'ABHOLUNG' : 'KURIER',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 14,
                                            letterSpacing: 1.2,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                              ),
                            ),
                            
                            // Text Labels (Behind Knob)
                            Row(
                              children: [
                                Expanded(
                                  child: Center(
                                    child: AnimatedOpacity(
                                      duration: const Duration(milliseconds: 200),
                                      opacity: _isPickup ? 0.0 : 0.6,
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.store_mall_directory, color: Colors.white, size: 16),
                                          const SizedBox(width: 6),
                                          const Text('ABHOLUNG', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Center(
                                    child: AnimatedOpacity(
                                      duration: const Duration(milliseconds: 200),
                                      opacity: !_isPickup ? 0.0 : 0.6,
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Image.asset('assets/images/courier_icon.png', color: Colors.white, width: 16, height: 16),
                                          const SizedBox(width: 6),
                                          const Text('KURIER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
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
                    ),
                  ),


                  
                  const SizedBox(height: 24),
                  
                  // Combined Filter Card (Tuna + Search + Mesafe) - Original Design
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2A2A28),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withOpacity(0.05)),
                      ),
                      child: Column(
                        children: [
                          // Row 1: Tuna Toggle
                          Row(
                            children: [
                              Container(
                                width: 32, height: 32,
                                decoration: BoxDecoration(
                                  color: accent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Center(
                                  child: Icon(Icons.storefront, color: Colors.white, size: 18),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'marketplace.filter_tuna_verified'.tr(),
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                              Mira3DSwitch(
                                value: _showOnlyTuna,
                                onChanged: (val) => setState(() => _showOnlyTuna = val),
                                activeColor: accent,
                                width: 50,
                                height: 30,
                              ),
                            ],
                          ),
                          
                          const SizedBox(height: 16),
                          
                          // Row 2: Search Bar
                          Container(
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFF2C2C2E),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: TextField(
                              controller: _searchController,
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                              decoration: InputDecoration(
                                hintText: 'marketplace.search_hint_butcher'.tr(),
                                hintStyle: TextStyle(color: Colors.grey[500], fontSize: 14),
                                prefixIcon: Icon(Icons.search, color: Colors.grey[500], size: 20),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              ),
                              onChanged: (val) => setState(() {}),
                            ),
                          ),
                          
                          // Distance slider removed - distance filtering handled via sorting
                        ],
                      ),
                    ),
                  ),


                  
                  // Section Header
                ],
              ),
            ),
          ),
          
          // 3. Results Section (StreamBuilder inside Slivers)
          // 3. Results Section
          StreamBuilder<QuerySnapshot>(
            stream: _butchersStream,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: CircularProgressIndicator(color: accent)),
                );
              }
              if (snapshot.hasError) {
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: Text('marketplace.error_occurred'.tr(), style: const TextStyle(color: Colors.white))),
                );
              }

              // 1. Parse Data
              List<Map<String, dynamic>> allButchers = snapshot.data!.docs.map((doc) {
                final data = doc.data() as Map<String, dynamic>;
                String city = data['address']?['city'] ?? '';
                String id = doc.id;

                // FIXED: Use lat/lng directly from Firebase instead of geocoding
                double distance = 999.0;
                if (_userPosition != null) {
                  // Try to get lat/lng from address object (businesses collection)
                  double? lat = (data['address']?['lat'] is num) 
                      ? (data['address']['lat'] as num).toDouble() 
                      : null;
                  double? lng = (data['address']?['lng'] is num) 
                      ? (data['address']['lng'] as num).toDouble() 
                      : null;
                  
                  // Fallback to top-level lat/lng
                  lat ??= (data['lat'] is num) ? (data['lat'] as num).toDouble() : null;
                  lng ??= (data['lng'] is num) ? (data['lng'] as num).toDouble() : null;
                  
                  // Also try placeDetails.lat/lng (Google Places import)
                  lat ??= (data['placeDetails']?['lat'] is num) 
                      ? (data['placeDetails']['lat'] as num).toDouble() 
                      : null;
                  lng ??= (data['placeDetails']?['lng'] is num) 
                      ? (data['placeDetails']['lng'] as num).toDouble() 
                      : null;
                  
                  if (lat != null && lng != null) {
                    distance = _calculateDistance(lat, lng);
                    debugPrint('📍 $id: lat=$lat, lng=$lng, distance=${distance.toStringAsFixed(1)}km');
                  } else {
                    debugPrint('⚠️ $id: No lat/lng found in Firebase data');
                    distance = 999.0; // No coordinates = far away
                  }
                }
                
                final brand = data['brand'];
                
                // Helper for aggressive market check to isolate premium badges
                bool isMarket = false;
                final str = [
                  data['type'],
                  data['types'],
                  data['businessType'],
                  data['cuisineType'],
                  data['category'],
                  data['tags'],
                ].join(' ').toLowerCase();
                isMarket = str.contains('market') || str.contains('markt') || str.contains('bakkal') || str.contains('grocery');

                String? finalBadgeText;
                if (!isMarket && (data['brandLabelActive'] ?? false)) {
                   if (brand?.toString().trim().toLowerCase() == 'tuna') finalBadgeText = 'TUNA';
                   else if (brand?.toString().trim().toLowerCase() == 'akdeniz_toros') finalBadgeText = 'AKDENIZ';
                }
                
                return {
                  'id': id,
                  'name': data['companyName'] ?? '',
                  'brand': _getBrandLabel(brand),
                  'location': city,
                  'badgeText': finalBadgeText,
                  'hours': data['openingHours'], // Pass raw data (Map or String)
                  'deliveryHours': data['deliveryHours'],
                  'pickupHours': data['pickupHours'],
                  'imageUrl': data['imageUrl'],
                  'rating': (data['rating'] is num) ? data['rating'].toDouble() : 0.0,
                  'reviews': (data['reviewCount'] is num) ? data['reviewCount'].toInt() : 0,
                  'distance': distance,
                  'deliveryRadius': (data['deliveryRadius'] as num?)?.toDouble() ?? 5.0,
                  'phone': data['contactPerson']?['phone'] ?? '',
                  'isFavorite': favoriteIds.contains(id),
                };
              }).toList();

              // 2. Filter & Sort Logic
              List<dynamic> displayList = [];
              
              // Use controller text for query
              String queryText = _searchController.text.trim();
              
              if (queryText.isEmpty) {
                 // --- BROWSE MODE ---
                 // 1. TUNA Filter
                 var filtered = allButchers.where((b) {
                    if (_showOnlyTuna && b['badgeText'] != 'TUNA') return false;
                    
                    if (!_isPickup) {
                      final deliveryRadius = b['deliveryRadius'] as double;
                      if ((b['distance'] as double) > deliveryRadius) return false;
                    }
                    
                    return (b['distance'] as double) <= _maxDistance;
                 }).toList();
                 
                 // 2. Sort: Favorites Top, then Distance
                 filtered.sort((a, b) {
                    bool favA = a['isFavorite'];
                    bool favB = b['isFavorite'];
                    if (favA && !favB) return -1;
                    if (!favA && favB) return 1;
                    return (a['distance'] as double).compareTo(b['distance'] as double);
                 });
                 
                 // 3. Build List with Favorites Header
                 bool hasFavorites = filtered.any((b) => b['isFavorite']);
                 
                 if (hasFavorites) {
                   displayList.add({'type': 'header', 'text': 'Meine Favoriten'});
                   displayList.addAll(filtered.where((b) => b['isFavorite']));
                   
                   var others = filtered.where((b) => !b['isFavorite']).toList();
                   if (others.isNotEmpty) {
                     displayList.add({'type': 'divider'});
                     displayList.add({'type': 'header_small', 'text': 'Alle Metzgereien', 'count': filtered.length});
                     displayList.addAll(others);
                   }
                 } else {
                    displayList.addAll(filtered);
                 }
                 
              } else {
                 // --- SEARCH MODE ---
                 // 1. Matches Search
                 var matches = allButchers.where((b) {
                    if (_showOnlyTuna && b['badgeText'] != 'TUNA') return false;
                    
                    if (!_isPickup) {
                      final deliveryRadius = b['deliveryRadius'] as double;
                      if ((b['distance'] as double) > deliveryRadius) return false;
                    }
                    
                    final q = queryText.toLowerCase();
                    final name = (b['name'] as String).toLowerCase();
                    final loc = (b['location'] as String).toLowerCase();
                    return name.contains(q) || loc.contains(q);
                 }).toList();
                 
                 // 2. Split by Distance
                 var nearby = matches.where((b) => b['distance'] <= _maxDistance).toList();
                 var far = matches.where((b) => b['distance'] > _maxDistance).toList();
                 
                 // 3. Sort by Distance
                 nearby.sort((a, b) => (a['distance'] as double).compareTo(b['distance']));
                 far.sort((a, b) => (a['distance'] as double).compareTo(b['distance']));
                 
                 // 4. Merge
                 displayList.addAll(nearby);
                 
                 if (far.isNotEmpty) {
                   // Add Header for Far items
                   displayList.add({
                     'type': 'header_far', 
                     'text': 'Ergebnisse über ${_maxDistance.toInt()} km',
                     'count': ''
                   });
                   displayList.addAll(far);
                 }
              }

              // 3. Render
              if (displayList.isEmpty) {
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.search_off, size: 60, color: Colors.grey.shade800),
                        const SizedBox(height: 16),
                        Text('marketplace.no_results_found'.tr(), style: TextStyle(color: Colors.grey.shade600)),
                      ],
                    ),
                  ),
                );
              }

              return SliverPadding(
                 padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                 sliver: SliverList(
                   delegate: SliverChildBuilderDelegate(
                     (context, index) {
                       final item = displayList[index];
                       
                       // Check for Special Items (Headers/Dividers)
                       if (item is Map && item.containsKey('type')) {
                         String type = item['type'];
                         
                         if (type == 'header') {
                           return Padding(
                             padding: const EdgeInsets.only(top: 16, bottom: 12),
                             child: Text(item['text'], style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600)),
                           );
                         }
                         if (type == 'header_small') {
                           return Padding(
                             padding: const EdgeInsets.symmetric(vertical: 12),
                             child: Row(
                               mainAxisAlignment: MainAxisAlignment.spaceBetween,
                               children: [
                                 Text(item['text'], style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600)),
                                 Text('${item['count']} Ergebnisse', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
                               ],
                             ),
                           );
                         }
                         if (type == 'header_far') {
                            return Padding(
                              padding: const EdgeInsets.only(top: 24, bottom: 12),
                              child: Row(
                                children: [
                                  const Icon(Icons.travel_explore, color: accent, size: 18),
                                  const SizedBox(width: 8),
                                  Text(item['text'], style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600)),
                                  const SizedBox(width: 8),
                                  Expanded(child: Divider(color: Colors.white.withOpacity(0.1))),
                                ],
                              ),
                            );
                         }
                         if (type == 'divider') {
                           return const Padding(
                             padding: EdgeInsets.symmetric(vertical: 8),
                             child: Divider(color: Colors.white10),
                           );
                         }
                         return const SizedBox();
                       }
                       
                       // Render Butcher
                       return Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                         child: _buildButcherCard(item),
                       );
                     },
                     childCount: displayList.length,
                   ),
                 ),
              );
            },
          ),
          
          // Bottom Padding
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
      // ── Floating Cart Pill FAB ──
      floatingActionButton: Consumer(
        builder: (context, ref, _) {
          final cart = ref.watch(cartProvider);
          if (cart.isEmpty) return const SizedBox.shrink();
          final itemCount = cart.items.fold<int>(0, (sum, item) => sum + (item.quantity is int ? item.quantity.toInt() : item.quantity.round()));
          final total = cart.totalAmount;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _PulsingCartFab(
              itemCount: itemCount,
              total: total,
              onTap: () {
                HapticFeedback.selectionClick();
                context.push('/cart');
              },
            ),
          );
        },
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }


  
  Widget _buildButcherCard(Map<String, dynamic> butcher, {bool isFavoriteSection = false}) {
    // Dynamic status check
    final isOpen = _isShopOpenNow(butcher['hours'], deliveryHoursData: butcher['deliveryHours'], pickupHoursData: butcher['pickupHours']);
    final badgeText = butcher['badgeText'] as String?;

    // Pause detection
    final bool deliveryPaused = butcher['temporaryDeliveryPaused'] as bool? ?? false;
    final bool pickupPaused = butcher['temporaryPickupPaused'] as bool? ?? false;
    String? pauseText;
    if (deliveryPaused) {
      final dpUntil = butcher['deliveryPauseUntil'];
      if (dpUntil != null) {
        final DateTime dt = dpUntil is Timestamp ? dpUntil.toDate() : (dpUntil is DateTime ? dpUntil : DateTime.now());
        final mins = dt.difference(DateTime.now()).inMinutes;
        if (mins > 0) pauseText = tr('marketplace.delivery_resumes_in', namedArgs: {'minutes': '$mins'});
      }
      pauseText ??= tr('marketplace.courier_not_available');
    } else if (pickupPaused) {
      final ppUntil = butcher['pickupPauseUntil'];
      if (ppUntil != null) {
        final DateTime dt = ppUntil is Timestamp ? ppUntil.toDate() : (ppUntil is DateTime ? ppUntil : DateTime.now());
        final mins = dt.difference(DateTime.now()).inMinutes;
        if (mins > 0) pauseText = tr('marketplace.pickup_resumes_in', namedArgs: {'minutes': '$mins'});
      }
      pauseText ??= tr('marketplace.pickup_paused');
    }
    
    // Fallback if needed, but dynamic is preferred
    // final isOpen = butcher['isOpen'] as bool; 
    
    return GestureDetector(
      onTap: () {
        // Use GoRouter for navigation - routes to BusinessDetailScreen
        context.push('/kasap/${butcher['id']}');
      },
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: const Color(0xFF2A2A28), // Darker card bg
          borderRadius: BorderRadius.circular(20),
          border: isFavoriteSection 
            ? Border.all(color: accent.withOpacity(0.3), width: 1)
            : Border.all(color: Colors.white.withOpacity(0.08)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.25),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Image & Badge Section (Left) - Larger Size
            Stack(
              children: [
                Container(
                  width: 110,  // Increased from 80
                  height: 110, // Increased from 80
                  decoration: BoxDecoration(
                    color: const Color(0xFF2C2C2C),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Stack(
                    children: [
                      // Image layer
                      Positioned.fill(
                        child: (butcher['imageUrl'] != null && (butcher['imageUrl'] as String).isNotEmpty)
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(16),
                                child: LokmaNetworkImage(
                                  imageUrl: butcher['imageUrl'],
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    color: Colors.grey.shade900,
                                    child: const Center(
                                      child: CircularProgressIndicator(strokeWidth: 2, color: accent),
                                    ),
                                  ),
                                  errorWidget: (context, url, error) => Icon(
                                    Icons.storefront, 
                                    color: Colors.grey.shade700, 
                                    size: 48
                                  ),
                                  // Optional: optimize connection count?
                                ),
                              )
                            : Icon(Icons.storefront, color: Colors.grey.shade700, size: 48),
                      ),
                      
                      // 🆕 Darker overlay for unavailable businesses (keep image dim)
                      if (!isOpen)
                        Positioned.fill(
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.5), // Dark overlay
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                        ),
                        
                      // 🆕 Thin top-aligned banner for unavailable businesses (Overlying the image)
                      if (!isOpen)
                        Positioned(
                          top: 0,
                          left: 0,
                          right: 0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            decoration: const BoxDecoration(
                              color: Color(0xFF2C2C2E), // Dark grey background
                              borderRadius: BorderRadius.only(
                                topLeft: Radius.circular(16),
                                topRight: Radius.circular(16),
                              ),
                            ),
                            child: Center(
                              child: Text(
                                'marketplace.currently_closed'.tr(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w400,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                
                // Prominent TUNA Badge
                if (badgeText != null)
                  Positioned(
                    top: 8,
                    left: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEA184A),
                        borderRadius: BorderRadius.only(
                          topRight: Radius.circular(8),
                          bottomRight: Radius.circular(8),
                        ),
                      ),
                      child: Text(
                        badgeText.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            
            const SizedBox(width: 14),
            
            // 2. Info Section (Right)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // A. Title & Rating
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          butcher['name'],
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16, // Larger Title
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      // Rating with star
                      if (butcher['rating'] != null && (butcher['rating'] as num) > 0) ...[
                        const SizedBox(width: 8),
                        const Icon(Icons.star, color: Colors.amber, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          '${butcher['rating']} (${butcher['reviews']})',
                          style: const TextStyle(
                            color: Colors.amber, 
                            fontWeight: FontWeight.w600,
                            fontSize: 13
                          ),
                        ),
                      ],
                    ],
                  ),
                  
                  const SizedBox(height: 6),
                  
                  // B. Subtitle (Company • City)
                  Text(
                    '${butcher['brand']} • ${butcher['location']}',
                    style: TextStyle(
                      color: const Color(0xFFA8A8A8), // Between grey[300] and grey[400]
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  
                  const SizedBox(height: 10),
                  
                  // C. Status Badge & Hours
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: pauseText != null
                              ? Colors.orange
                              : (isOpen ? const Color(0xFF2E7D32) : const Color(0xFFEA184A)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          pauseText ?? (isOpen ? 'common.open'.tr() : 'common.closed'.tr()),
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: pauseText != null ? 10 : 12,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _getTodayHours(butcher['hours']),
                          style: TextStyle(
                            color: Colors.grey.shade400,
                            fontSize: 13,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 10),
                  
                  // D. Distance & Phone
                  Row(
                    children: [
                      const Icon(Icons.navigation, color: Color(0xFFEA184A), size: 16),
                      const SizedBox(width: 4),
                      Text(
                        (butcher['distance'] as double) >= 900 
                            ? '...' 
                            : '${(butcher['distance'] as double).toStringAsFixed(1)} km',
                        style: const TextStyle(
                          color: Color(0xFFEA184A),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      Icon(Icons.phone, color: Colors.grey.shade500, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        butcher['phone'],
                        style: TextStyle(
                          color: Colors.grey.shade400, 
                          fontSize: 13,
                          fontWeight: FontWeight.w500
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
// ── Pulsing Cart FAB Pill ──
class _PulsingCartFab extends StatefulWidget {
  final int itemCount;
  final double total;
  final VoidCallback onTap;

  const _PulsingCartFab({required this.itemCount, required this.total, required this.onTap});

  @override
  State<_PulsingCartFab> createState() => _PulsingCartFabState();
}

class _PulsingCartFabState extends State<_PulsingCartFab> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFFEA184A);
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final scale = 1.0 + (_pulseController.value * 0.04); // subtle 1.0 → 1.04
        return Transform.scale(scale: scale, child: child);
      },
      child: Material(
        color: accent,
        borderRadius: BorderRadius.circular(28),
        elevation: 6,
        shadowColor: accent.withOpacity(0.5),
        child: InkWell(
          borderRadius: BorderRadius.circular(28),
          onTap: widget.onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Cart basket icon with badge
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    SvgPicture.asset(
                      'assets/images/basket_1.svg',
                      width: 22,
                      height: 22,
                      colorFilter: const ColorFilter.mode(
                        Colors.white,
                        BlendMode.srcIn,
                      ),
                    ),
                    Positioned(
                      top: -6,
                      right: -8,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '${widget.itemCount}',
                          style: const TextStyle(
                            color: accent,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                Text(
                  '${widget.total.toStringAsFixed(2)} €',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Isolated Banner Widget to prevent parent rebuilds
class _ButcherBannerCarousel extends StatefulWidget {
  final List<Map<String, dynamic>> banners;
  final double height;

  const _ButcherBannerCarousel({
    required this.banners,
    this.height = 140,
  });

  @override
  State<_ButcherBannerCarousel> createState() => _ButcherBannerCarouselState();
}

class _ButcherBannerCarouselState extends State<_ButcherBannerCarousel> {
  int _currentBanner = 0;
  final PageController _bannerController = PageController();
  static const Color accent = Color(0xFFEA184A);

  Widget _build3DCard(Map<String, dynamic> banner) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 40),
      decoration: BoxDecoration(
        color: const Color(0xFF2C2C2C), // Dark Card
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.5),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF2A2A28), Color(0xFF1C1B18)],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: accent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.restaurant, color: accent, size: 28),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          banner['title'],
                          style: const TextStyle(
                            color: Colors.white, // White Title
                            fontWeight: FontWeight.w600,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          banner['subtitle'],
                          style: TextStyle(
                            color: Colors.grey.shade400, // Grey Subtitle
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
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
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 4), _autoScrollBanner);
  }

  @override
  void dispose() {
    _bannerController.dispose();
    super.dispose();
  }

  void _autoScrollBanner() {
    if (!mounted) return;
    setState(() {
      _currentBanner = (_currentBanner + 1) % widget.banners.length;
    });
    if (_bannerController.hasClients) {
      _bannerController.animateToPage(
        _currentBanner,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOut,
      );
    }
    Future.delayed(const Duration(seconds: 4), _autoScrollBanner);
  }



  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        SizedBox(
          height: widget.height,
          child: AnimatedBuilder(
            animation: _bannerController,
            builder: (context, child) {
              return PageView.builder(
                controller: _bannerController,
                onPageChanged: (index) => setState(() => _currentBanner = index),
                itemCount: widget.banners.length,
                itemBuilder: (context, index) {
                  double value = 0;
                  if (_bannerController.position.haveDimensions) {
                    value = index - (_bannerController.page ?? 0);
                    value = (value * 0.4).clamp(-1.0, 1.0);
                  }

                  return Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.001)
                      ..rotateY(value * 0.5)
                      ..scale(1 - (value.abs() * 0.2)),
                    child: Opacity(
                      opacity: 1 - (value.abs() * 0.5),
                      child: _build3DCard(widget.banners[index]),
                    ),
                  );
                },
              );
            },
          ),
        ),
        // Dots moved inside component
        Positioned(
          bottom: -20, // Adjust based on layout needs, or remove if parent handles spacing
          left: 0,
          right: 0,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              widget.banners.length,
              (index) => ApiDot(isActive: _currentBanner == index),
            ),
          ),
        ),
      ],
    );
  }
}

class ApiDot extends StatelessWidget {
  final bool isActive;
  const ApiDot({super.key, required this.isActive});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: isActive ? 24 : 8,
      height: 8,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        color: isActive ? Colors.white : Colors.white.withOpacity(0.4),
      ),
    );
  }
}
