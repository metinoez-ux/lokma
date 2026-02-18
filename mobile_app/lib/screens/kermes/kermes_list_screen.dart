import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/widgets/kermes_card.dart';
import 'package:lokma_app/services/kermes_favorite_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/providers/user_location_provider.dart';

/// Stitch UI - Kermes Listesi (Light Mode öncelikli, Dark Mode hazır)
/// HTML/Tailwind referansından Flutter'a çevrildi
class KermesListScreen extends ConsumerStatefulWidget {
  const KermesListScreen({super.key});

  @override
  ConsumerState<KermesListScreen> createState() => _KermesListScreenState();
}

class _KermesListScreenState extends ConsumerState<KermesListScreen> {
  // ============== STITCH UI COLOR PALETTE ==============
  // Light Mode
  static const Color lightBg = Color(0xFFE8E8EC); // Light gray for better contrast with white cards
  static const Color cardLight = Colors.white;
  static const Color subtleLight = Color(0xFFF3F4F6); // gray-100
  
  // Dark Mode (ileride kullanılmak üzere)
  static const Color darkBg = Color(0xFF111827); // Gray-900
  static const Color cardDark = Color(0xFF1F2937); // Gray-800
  static const Color subtleDark = Color(0xFF374151); // Gray-700
  
  // Brand Colors
  static const Color primaryRose = Color(0xFFFB335B); // Rose-500
  static const Color roseLight = Color(0xFFFEE2E2); // red-100
  
  // ============== STATE ==============
  bool _isLoading = true;
  List<KermesEvent> _kermesEvents = [];
  Position? _currentPosition;
  String _sortBy = 'date_asc';
  double _maxDistance = 300; // km
  Set<String> _favoriteKermesIds = {};
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  String? _expandedCardId;
  
  String _userAddress = 'Konum alınıyor...';
  bool _isLoadingLocation = true;
  
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _kermesSubscription;
  
  @override
  void initState() {
    super.initState();
    // Location now comes from cached userLocationProvider - no API call here!
    _loadFavorites();
    _loadKermesEvents();
  }
  
  @override
  void dispose() {
    _kermesSubscription?.cancel();
    _searchController.dispose();
    super.dispose();
  }
  
  // ============== LOCATION ==============
  // Location now comes from userLocationProvider (cached, no repeated API calls)
  // Use ref.watch(userLocationProvider) in build methods that need location data
  
  void _updateLocationFromProvider(UserLocation location) {
    if (location.isValid) {
      _currentPosition = Position(
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: DateTime.now(),
        accuracy: 0,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );
      _userAddress = location.street.isNotEmpty ? location.street : location.city;
      _isLoadingLocation = false;
    }
  }

  Future<void> _loadFavorites() async {
    final favorites = await KermesFavoriteService.instance.getFavoriteIds();
    if (mounted) {
      setState(() {
        _favoriteKermesIds = favorites.toSet();
      });
    }
  }
  
  // ============== FIREBASE DATA ==============
  void _loadKermesEvents() {
    setState(() => _isLoading = true);
    _kermesSubscription?.cancel();
    
    _kermesSubscription = FirebaseFirestore.instance
        .collection('kermes_events')
        .snapshots()
        .listen((snapshot) {
      _processKermesSnapshot(snapshot);
    }, onError: (e, stackTrace) {
      debugPrint('❌ Kermes stream error: $e');
      if (mounted) {
        setState(() {
          _kermesEvents = [];
          _isLoading = false;
        });
      }
    });
  }
  
  Future<void> _processKermesSnapshot(QuerySnapshot<Map<String, dynamic>> snapshot) async {
    try {
      debugPrint('📌 kermes_events total docs: ${snapshot.docs.length}');
      
      if (snapshot.docs.isNotEmpty) {
        final List<KermesEvent> loadedEvents = [];
        
        for (final doc in snapshot.docs) {
          try {
            final data = doc.data();
            
            // Filter by isActive
            if (data['isActive'] != true) continue;
            
            // Filter out archived events
            if (data['isArchived'] == true) continue;
            
            // Parse dates
            DateTime startDate;
            DateTime endDate;
            
            if (data['startDate'] != null) {
              startDate = (data['startDate'] as Timestamp).toDate();
            } else if (data['date'] != null) {
              startDate = (data['date'] as Timestamp).toDate();
            } else {
              startDate = DateTime.now();
            }
            
            if (data['endDate'] != null) {
              endDate = (data['endDate'] as Timestamp).toDate();
            } else {
              endDate = startDate.add(const Duration(hours: 12));
            }
            
            // Skip past events
            if (endDate.isBefore(DateTime.now().subtract(const Duration(days: 1)))) {
              continue;
            }
            
            // Parse menu items
            List<KermesMenuItem> menuItems = [];
            try {
              final productsSnapshot = await FirebaseFirestore.instance
                  .collection('kermes_events')
                  .doc(doc.id)
                  .collection('products')
                  .get();
              
              if (productsSnapshot.docs.isNotEmpty) {
                for (final productDoc in productsSnapshot.docs) {
                  final productData = productDoc.data();
                  
                  List<String> allergens = [];
                  if (productData['allergens'] != null) {
                    if (productData['allergens'] is List) {
                      allergens = (productData['allergens'] as List).map((e) => e.toString()).toList();
                    } else if (productData['allergens'] is String) {
                      allergens = (productData['allergens'] as String).split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
                    }
                  }
                  
                  List<String> ingredients = [];
                  if (productData['ingredients'] != null) {
                    if (productData['ingredients'] is List) {
                      ingredients = (productData['ingredients'] as List).map((e) => e.toString()).toList();
                    } else if (productData['ingredients'] is String) {
                      ingredients = (productData['ingredients'] as String).split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
                    }
                  }
                  
                  List<String> imageUrls = [];
                  if (productData['imageUrls'] != null && productData['imageUrls'] is List) {
                    imageUrls = (productData['imageUrls'] as List).map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
                  }
                  
                  menuItems.add(KermesMenuItem(
                    name: productData['name'] ?? '',
                    price: (productData['price'] ?? 0).toDouble(),
                    description: productData['description'],
                    secondaryName: productData['secondaryName'],
                    detailedDescription: productData['detailedDescription'],
                    imageUrl: productData['imageUrl'],
                    imageUrls: imageUrls,
                    category: productData['category'],
                    allergens: allergens,
                    ingredients: ingredients,
                    hasPfand: productData['hasPfand'] == true,
                    isAvailable: productData['isAvailable'] ?? true,
                  ));
                }
              }
            } catch (e) {
              debugPrint('⚠️ Could not load products: $e');
            }
            
            // Parse parking info
            List<KermesParkingInfo> parkingInfo = [];
            if (data['parkingLocations'] != null && data['parkingLocations'] is List) {
              final locations = data['parkingLocations'] as List;
              for (final loc in locations) {
                if (loc is Map) {
                  final street = loc['street']?.toString() ?? '';
                  final city = loc['city']?.toString() ?? '';
                  final postalCode = loc['postalCode']?.toString() ?? '';
                  final country = loc['country']?.toString() ?? '';
                  final note = loc['note']?.toString() ?? '';
                  
                  String fullAddr = street;
                  if (city.isNotEmpty) fullAddr += ', $city';
                  if (postalCode.isNotEmpty) fullAddr = '$postalCode $fullAddr';
                  
                  parkingInfo.add(KermesParkingInfo(
                    street: street,
                    city: city,
                    postalCode: postalCode,
                    country: country,
                    address: fullAddr,
                    description: note.isNotEmpty ? note : fullAddr,
                    note: note.isNotEmpty ? note : null,
                  ));
                }
              }
            }
            
            // Parse address
            String fullAddress = '';
            String city = 'Bilinmiyor';
            
            if (data['address'] is Map) {
              final addressData = data['address'] as Map;
              fullAddress = addressData['fullAddress']?.toString() ?? '';
              city = addressData['city']?.toString() ?? 'Bilinmiyor';
              
              if (fullAddress.isEmpty) {
                final street = addressData['street']?.toString() ?? '';
                final postalCode = addressData['postalCode']?.toString() ?? '';
                fullAddress = '$street, $postalCode $city'.trim();
              }
            } else if (data['address'] is String) {
              fullAddress = data['address'] as String;
              city = data['location']?.toString() ?? 'Bilinmiyor';
            }
            
            // Parse contact info
            String phoneNumber = '';
            String? contactName;
            
            if (data['contact'] != null && data['contact'] is Map) {
              final contactData = data['contact'] as Map;
              phoneNumber = contactData['phone']?.toString() ?? '';
              contactName = contactData['name']?.toString();
            } else {
              phoneNumber = data['contactPhone']?.toString() ?? data['phoneNumber']?.toString() ?? '';
              contactName = data['contactName']?.toString();
            }
            
            // Parse hours
            String openingTime = '10:00';
            String closingTime = '20:00';
            if (data['dailyHours'] != null && data['dailyHours'] is Map) {
              final dailyHours = data['dailyHours'] as Map<String, dynamic>;
              openingTime = dailyHours['open']?.toString() ?? '10:00';
              closingTime = dailyHours['close']?.toString() ?? '20:00';
            } else {
              openingTime = data['openingTime']?.toString() ?? '10:00';
              closingTime = data['closingTime']?.toString() ?? '20:00';
            }
            
            final features = (data['features'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
            final customFeatures = (data['customFeatures'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
            
            String country = 'Almanya';
            if (data['address'] is Map && (data['address'] as Map)['country'] == 'DE') {
              country = 'Almanya';
            } else if (data['country'] != null) {
              country = data['country'].toString();
            }
            
            final event = KermesEvent(
              id: doc.id,
              city: city,
              country: country,
              state: data['state'],
              title: data['name'] ?? data['title'] ?? 'Kermes',
              address: fullAddress,
              phoneNumber: phoneNumber,
              startDate: startDate,
              endDate: endDate,
              latitude: (data['latitude'] ?? data['lat'] ?? 51.0)?.toDouble() ?? 51.0,
              longitude: (data['longitude'] ?? data['lng'] ?? 6.0)?.toDouble() ?? 6.0,
              menu: menuItems,
              parking: parkingInfo,
              weatherForecast: [],
              hasKidsActivities: features.contains('kids') || features.contains('kids_area'),
              hasFamilyArea: features.contains('family_area') || features.contains('family_tents'),
              hasOutdoor: features.contains('outdoor'),
              hasIndoorArea: features.contains('indoor'),
              hasCreditCardPayment: features.contains('card_payment'),
              hasVegetarian: features.contains('vegetarian'),
              hasAccessible: features.contains('accessible'),
              hasHalal: features.contains('halal'),
              hasWifi: features.contains('wifi'),
              hasLiveMusic: features.contains('live_music'),
              hasPrayerRoom: features.contains('prayer_room'),
              hasFreeEntry: features.contains('free_entry'),
              hasParking: features.contains('parking'),
              hasArgelatoIceCream: features.contains('argelato_ice_cream'),
              hasSleepingAccommodation: features.contains('sleeping_accommodation'),
              features: features,
              customFeatures: customFeatures,
              hasDelivery: data['hasDelivery'] == true,
              deliveryFee: (data['deliveryFee'] ?? 0).toDouble(),
              minCartForFreeDelivery: (data['minCartForFreeDelivery'] ?? 0).toDouble(),
              minOrderAmount: (data['minOrderAmount'] ?? 0).toDouble(),
              contactName: contactName,
              headerImage: data['headerImage']?.toString(),
              openingTime: openingTime,
              closingTime: closingTime,
            );
            
            loadedEvents.add(event);
          } catch (docError, stackTrace) {
            debugPrint('❌ Error parsing kermes doc ${doc.id}: $docError');
            debugPrint('   Stack: ${stackTrace.toString().split('\n').take(5).join('\n')}');
          }
        }
        
        loadedEvents.sort((a, b) => a.startDate.compareTo(b.startDate));
        _kermesEvents = loadedEvents;
        debugPrint('✅ ${loadedEvents.length} kermes loaded');
      } else {
        _kermesEvents = [];
      }
    } catch (e, stackTrace) {
      debugPrint('❌ Error loading kermes: $e');
      debugPrint('   Stack: ${stackTrace.toString().split('\n').take(10).join('\n')}');
      _kermesEvents = [];
    }
    
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }
  
  // ============== FILTERING ==============
  List<KermesEvent> get _filteredEvents {
    var events = List<KermesEvent>.from(_kermesEvents);
    
    // Favorites filter
    if (_sortBy == 'favorites') {
      events = events.where((event) => _favoriteKermesIds.contains(event.id)).toList();
    }
    
    // Search filter
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      events = events.where((event) {
        return event.city.toLowerCase().contains(query) ||
               event.title.toLowerCase().contains(query) ||
               event.country.toLowerCase().contains(query) ||
               (event.state?.toLowerCase().contains(query) ?? false);
      }).toList();
    }
    
    // Distance filter
    if (_currentPosition != null && _maxDistance < 300) {
      events = events.where((event) {
        final distance = Geolocator.distanceBetween(
          _currentPosition!.latitude,
          _currentPosition!.longitude,
          event.latitude,
          event.longitude,
        ) / 1000;
        return distance <= _maxDistance;
      }).toList();
    }
    
    // Sort
    events.sort((a, b) {
      if (_sortBy == 'date_asc' || _sortBy == 'favorites') {
        return a.startDate.compareTo(b.startDate);
      } else if (_sortBy == 'distance_asc' && _currentPosition != null) {
        final distA = _getDistance(a);
        final distB = _getDistance(b);
        return distA.compareTo(distB);
      }
      return 0;
    });
    
    return events;
  }
  
  double _getDistance(KermesEvent event) {
    if (_currentPosition == null) return 0;
    return Geolocator.distanceBetween(
      _currentPosition!.latitude,
      _currentPosition!.longitude,
      event.latitude,
      event.longitude,
    ) / 1000;
  }
  
  // ============== FILTER SHEET ==============
  void _showFilterSheet() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey[600] : Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Sıralama',
              style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            
            _buildFilterOption(
              icon: Icons.calendar_today,
              title: 'En Yakın Tarih',
              isSelected: _sortBy == 'date_asc',
              onTap: () {
                setState(() => _sortBy = 'date_asc');
                Navigator.pop(context);
              },
            ),
            
            _buildFilterOption(
              icon: Icons.near_me,
              title: 'En Yakın Mesafe',
              isSelected: _sortBy == 'distance_asc',
              onTap: () {
                setState(() => _sortBy = 'distance_asc');
                Navigator.pop(context);
              },
            ),
            
            _buildFilterOption(
              icon: Icons.favorite,
              title: 'Favorilerim',
              isSelected: _sortBy == 'favorites',
              onTap: () {
                _loadFavorites();
                setState(() => _sortBy = 'favorites');
                Navigator.pop(context);
              },
            ),
            
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
  
  Widget _buildFilterOption({
    required IconData icon,
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: isSelected ? primaryRose.withOpacity(0.1) : (Theme.of(context).brightness == Brightness.dark ? Colors.grey[800] : Colors.grey[50]),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? primaryRose : (Theme.of(context).brightness == Brightness.dark ? Colors.grey[700]! : Colors.grey[200]!),
            width: 2,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: isSelected ? primaryRose : Colors.grey[600], size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  color: isSelected ? primaryRose : (Theme.of(context).brightness == Brightness.dark ? Colors.white70 : Colors.grey[800]),
                  fontSize: 16,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: primaryRose, size: 22),
          ],
        ),
      ),
    );
  }
  
  // ============== BUILD ==============
  @override
  Widget build(BuildContext context) {
    // Watch location from cached provider (no API call!)
    final locationAsync = ref.watch(userLocationProvider);
    locationAsync.whenData((location) {
      _updateLocationFromProvider(location);
    });
    
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? darkBg : lightBg;
    final cardColor = isDark ? cardDark : cardLight;
    final textColor = isDark ? Colors.white : Colors.grey[900]!;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    
    // Status bar ayarı tema bazlı
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
    ));
    
    return Container(
        color: bgColor, // Arka plan rengi container'da
        child: SafeArea(
          bottom: false, // Footer için alt boşluk bırakma
          child: CustomScrollView(
            physics: const ClampingScrollPhysics(),
            slivers: [
              // ===== STICKY HEADER =====
              SliverAppBar(
                backgroundColor: bgColor.withOpacity(0.95),
                surfaceTintColor: Colors.transparent,
                pinned: true,
                floating: false,
                expandedHeight: 170, // Genişletilmiş yükseklik
                collapsedHeight: 80, // Daraltılmış yükseklik (sadece arama)
                automaticallyImplyLeading: false,
                flexibleSpace: LayoutBuilder(
                  builder: (context, constraints) {
                    // Scroll oranını hesapla (0 = tamamen kapalı, 1 = tamamen açık)
                    final expandedHeight = 170.0;
                    final collapsedHeight = 80.0;
                    final currentHeight = constraints.maxHeight;
                    final expandRatio = ((currentHeight - collapsedHeight) / 
                                         (expandedHeight - collapsedHeight)).clamp(0.0, 1.0);
                    
                    return ClipRect(
                      child: Container(
                        color: bgColor.withOpacity(0.95),
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: SingleChildScrollView(
                          physics: const NeverScrollableScrollPhysics(),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const SizedBox(height: 12),
                              
                              // Location Header (sadece expanded durumda görünür)
                              if (expandRatio > 0.1) ...[
                                Opacity(
                                  opacity: expandRatio,
                                  child: _buildLocationHeader(),
                                ),
                                const SizedBox(height: 12),
                              ],
                              
                              // Search Bar (her zaman görünür)
                              _buildSearchBar(isDark, cardColor, textColor, subtleTextColor),
                              
                              // Distance slider (sadece expanded durumda)
                              if (expandRatio > 0.3)
                                Opacity(
                                  opacity: expandRatio,
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: _buildDistanceSlider(isDark),
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
              
              // Event Count
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Text(
                  '${_filteredEvents.length} kermes bulundu',
                  style: TextStyle(
                    color: subtleTextColor,
                    fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ),
            
            // Event List
            _isLoading
                ? const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator(color: primaryRose)),
                  )
                : _filteredEvents.isEmpty
                    ? SliverFillRemaining(
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.celebration_outlined, size: 64, color: subtleTextColor),
                              const SizedBox(height: 16),
                              Text(
                                'Kermes bulunamadı',
                                style: TextStyle(color: subtleTextColor, fontSize: 16),
                              ),
                            ],
                          ),
                          ),
                        )
                      : SliverPadding(
                          padding: const EdgeInsets.only(bottom: 120),
                          sliver: SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final event = _filteredEvents[index];
                                return KermesCard(
                                  event: event,
                                  currentPosition: _currentPosition,
                                  onFavoriteChanged: _loadFavorites,
                                  isExpanded: _expandedCardId == event.id,
                                  onExpandToggle: () {
                                    setState(() {
                                      if (_expandedCardId == event.id) {
                                        _expandedCardId = null;
                                      } else {
                                        _expandedCardId = event.id;
                                      }
                                    });
                                  },
                                );
                              },
                              childCount: _filteredEvents.length,
                            ),
                          ),
                        ),
          ],
        ),
      ),
    );
  }

  // ============== HEADER WIDGET ==============
  Widget _buildLocationHeader() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.grey[900]!;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[500]!;
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Left: Location
        Expanded(
          child: GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
            },
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isDark ? primaryRose.withOpacity(0.2) : roseLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.location_on, color: primaryRose, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MEVCUT KONUM',
                        style: TextStyle(
                          color: subtleTextColor,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              _userAddress,
                              style: TextStyle(
                                color: textColor,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 2),
                          Icon(Icons.expand_more, color: subtleTextColor, size: 18),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        
        // Right: Favorite Toggle with padding for badge overflow
        Padding(
          padding: const EdgeInsets.only(right: 8, top: 4),
          child: GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() {
                _sortBy = _sortBy == 'favorites' ? 'date_asc' : 'favorites';
              });
            },
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  _favoriteKermesIds.isNotEmpty ? Icons.favorite : Icons.favorite_outline,
                  color: _favoriteKermesIds.isNotEmpty ? primaryRose : (isDark ? Colors.grey[500] : Colors.grey[400]),
                  size: 24,
                ),
                if (_favoriteKermesIds.isNotEmpty)
                  Positioned(
                    top: -4,
                    right: -6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: primaryRose,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.white, width: 1),
                      ),
                      child: Text(
                        '${_favoriteKermesIds.length}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
  
  // ============== SEARCH BAR ==============
  // ============== SEARCH BAR ==============
  Widget _buildSearchBar(bool isDark, Color cardColor, Color textColor, Color subtleTextColor) {
    return Container(
      height: 48,
      padding: const EdgeInsets.only(left: 16, right: 8),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(Icons.search, color: subtleTextColor, size: 22),
          const SizedBox(width: 12),
          // Search Input
          Expanded(
            child: TextField(
              controller: _searchController,
              onChanged: (value) {
                setState(() => _searchQuery = value);
              },
              style: TextStyle(color: textColor, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Kermes, Menü, Şehir...',
                hintStyle: TextStyle(color: subtleTextColor),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          const SizedBox(width: 8),
          
          // Integrated Filter Button
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              _showFilterSheet();
            },
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[800] : const Color(0xFFF5F5F5),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Icon(Icons.tune, color: subtleTextColor, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  // ============== DISTANCE SLIDER ==============
  Widget _buildDistanceSlider(bool isDark) {
    // En yakın kermes mesafesini dinamik olarak hesapla
    double nearestKermesDistance = 5; // Default fallback
    if (_currentPosition != null && _kermesEvents.isNotEmpty) {
      final distances = _kermesEvents.map((e) => _getDistance(e)).toList();
      distances.sort();
      nearestKermesDistance = distances.first.clamp(1, 300);
    }
    
    // Slider min değeri: en yakın kermes mesafesi (en az 1km)
    final sliderMin = nearestKermesDistance.clamp(1.0, 50.0);
    
    // Eğer _maxDistance slider aralığının altındaysa düzelt
    if (_maxDistance < sliderMin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _maxDistance = 300);
      });
    }
    
    String distanceLabel;
    if (_maxDistance >= 300) {
      distanceLabel = 'Tümü';
    } else {
      distanceLabel = '${_maxDistance.round()} km';
    }
    
    // Sol tarafta en yakın kermes bilgisi
    String nearestLabel = '${nearestKermesDistance.round()} km';
    
    return Row(
      children: [
        // Sol: En yakın kermes mesafesi
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: primaryRose.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.near_me, color: primaryRose, size: 14),
              const SizedBox(width: 4),
              Text(
                nearestLabel,
                style: TextStyle(
                  color: primaryRose,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: primaryRose,
              inactiveTrackColor: isDark ? Colors.grey[600] : Colors.grey[400],
              thumbColor: primaryRose,
              overlayColor: primaryRose.withOpacity(0.2),
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
              // Tick marks for visibility
              tickMarkShape: const RoundSliderTickMarkShape(tickMarkRadius: 3),
              activeTickMarkColor: Colors.white.withOpacity(0.8),
              inactiveTickMarkColor: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
            child: Slider(
              value: _maxDistance.clamp(sliderMin, 300),
              min: sliderMin,
              max: 300,
              divisions: 15, // Daha fazla adım için tick marks göster
              onChanged: (value) {
                // Haptic feedback on value change
                if (value.round() != _maxDistance.round()) {
                  HapticFeedback.selectionClick();
                }
                setState(() => _maxDistance = value);
              },
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Sağ: Seçili max mesafe
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isDark ? Colors.grey[800] : Colors.grey[100],
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            distanceLabel,
            style: TextStyle(
              color: isDark ? Colors.grey[300] : Colors.grey[700],
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
