import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:lokma_app/widgets/address_selection_sheet.dart';
import '../../../utils/currency_utils.dart';

/// Business type labels for display
const Map<String, String> MARKET_TYPE_LABELS = {
  'kasap': 'Kasap',
  'market': 'Market',
  'cicekci': 'Çiçekçi',
  'aktar': 'Aktar',
  'kuruyemis': 'Kuru Yemiş',
  'balik': 'Balık',
  'tursu': 'Turşu',
  'sarkuteri': 'Şarküteri',
  'petshop': 'Pet Shop',
  'kozmetik': 'Kozmetik',
  'eticaret': 'E-Ticaret',
};

/// Marketler Keşif Ekranı - LOKMA
/// UI/UX consistent with RestoranScreen
class MarketScreen extends ConsumerStatefulWidget {
  const MarketScreen({super.key});

  @override
  ConsumerState<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends ConsumerState<MarketScreen> {
  // Theme colors
  // Theme colors
  static const Color lokmaPink = Color(0xFFFB335B); // Rose-500 brand color
  static const Color tunaGreen = Color(0xFF4CAF50);
  
  // Dynamic card background getter for theme-aware colors
  Color get cardBg => Theme.of(context).cardTheme.color ?? Colors.white;

  // Delivery mode
  String _deliveryMode = 'teslimat'; // Varsayılan: Kurye
  
  // Category filter - 'all' or specific businessType
  String _categoryFilter = 'all';
  
  // TUNA filter
  bool _onlyTuna = false;
  
  // Location
  final String _userAddress = 'Konum alınıyor...';
  bool _isLoadingLocation = true;
  double? _userLat;
  double? _userLng;
  
  // Distance slider (km) - Market için max 15 km
  double _maxDistance = 100.0;
  bool _sliderAutoSet = false; // Auto-snap slider to nearest business once
  
  // Dynamic categories from Firestore
  Map<String, int> _businessTypeCounts = {};
  List<DocumentSnapshot> _allBusinesses = [];
  bool _isLoading = true;
  
  // 🆕 Canlı Firestore stream subscription
  StreamSubscription<QuerySnapshot>? _businessesSubscription;
  
  // Dynamic sector types from Firestore 'sectors' collection
  Set<String> _marketSectorTypes = {};
  
  // Sorting option
  String _sortOption = 'nearest'; // nearest, rating, tuna, az, za
  
  // 🆕 Hızlı Filtreler (Lieferando tarzı)
  bool _filterDiscounts = false;      // İndirimli ürünler
  bool _filterCash = false;           // Nakit ödeme kabul
  bool _filterFreeDelivery = false;   // Ücretsiz teslimat
  bool _filterMealCards = false;      // Yemek kartı kabul
  bool _filterHighRating = false;     // 4+ yıldız
  bool _filterOpenNow = false;        // Şimdi açık
  bool _filterVegetarian = false;     // Vejetaryen
  bool _filterTunaProducts = false;   // 🔴 TUNA/Toros ürünleri satan işletmeler

  @override
  void initState() {
    super.initState();
    // Location now comes from cached userLocationProvider - no API call here!
    _loadSectorsAndBusinesses();
  }
  
  Future<void> _loadSectorsAndBusinesses() async {
    // First load sectors to know which types are Market
    try {
      final sectorsSnapshot = await FirebaseFirestore.instance
          .collection('sectors')
          .where('category', isEqualTo: 'market')
          .where('isActive', isEqualTo: true)
          .get();
      
      _marketSectorTypes = sectorsSnapshot.docs
          .map((doc) => doc.id.toLowerCase())
          .toSet();
      
      debugPrint('🛒 Market sector types: $_marketSectorTypes');
    } catch (e) {
      debugPrint('❌ Error loading sectors: $e');
      // Fallback to hardcoded list
      _marketSectorTypes = {'kasap', 'market', 'cicekci', 'aktar', 'eticaret', 'kuruyemis'};
    }
    
    // Then load businesses
    _loadAllBusinesses();
  }

  /// 🆕 Canlı Firestore stream ile işletmeleri dinle
  void _loadAllBusinesses() {
    // Cancel previous subscription if exists
    _businessesSubscription?.cancel();
    
    // Listen to ALL businesses with real-time updates
    _businessesSubscription = FirebaseFirestore.instance
        .collection('businesses')
        .snapshots()
        .listen((snapshot) {
      debugPrint('📊 Live update: ${snapshot.docs.length} businesses from Firestore');
      
      // Count by type for dynamic chips
      final typeCounts = <String, int>{};
      for (final doc in snapshot.docs) {
        final data = doc.data();
        final businessType = _extractBusinessType(data);
        final isActive = data['isActive'] as bool? ?? true;
        
        // Skip NON-MARKET types
        if (!_marketSectorTypes.contains(businessType.toLowerCase())) continue;
        
        if (isActive) {
          typeCounts[businessType] = (typeCounts[businessType] ?? 0) + 1;
        }
      }
      
      debugPrint('📊 Market types: $typeCounts');
      
      if (mounted) {
        setState(() {
          _allBusinesses = snapshot.docs;
          _businessTypeCounts = typeCounts;
          _isLoading = false;
        });
        // Auto-snap slider to nearest business (only once)
        if (!_sliderAutoSet) {
          _autoSetSliderToNearestBusiness();
        }
      }
    }, onError: (e) {
      debugPrint('❌ Error loading businesses: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    });
  }
  
  @override
  void dispose() {
    _businessesSubscription?.cancel();
    super.dispose();
  }

  // Location now comes from userLocationProvider (cached, no repeated API calls)

  // Helper to extract business type
  static String _extractBusinessType(Map<String, dynamic> data) {
    final typeField = data['type'];
    if (typeField is String && typeField.isNotEmpty) {
      return typeField.toLowerCase();
    }
    final typesField = data['types'];
    if (typesField is List && typesField.isNotEmpty) {
      return (typesField.first as String? ?? 'other').toLowerCase();
    }
    final businessType = data['businessType'];
    if (businessType is String && businessType.isNotEmpty) {
      return businessType.toLowerCase();
    }
    return 'other';
  }

  bool _hasMarketSector(Map<String, dynamic> data) {
    final Set<String> businessSectorIds = {};
    
    final typeField = data['type'];
    if (typeField is String && typeField.isNotEmpty) {
      businessSectorIds.add(typeField.toLowerCase());
    }
    
    final typesField = data['types'];
    if (typesField is List) {
      for (final t in typesField) {
        if (t is String && t.isNotEmpty) {
          businessSectorIds.add(t.toLowerCase());
        }
      }
    }
    
    return businessSectorIds.intersection(_marketSectorTypes).isNotEmpty;
  }
  
  // 🆕 Check if business is currently open based on openingHours
  bool _isBusinessOpenNow(Map<String, dynamic> data) {
    final openingHelper = OpeningHoursHelper(data['openingHours']);
    return openingHelper.isOpenAt(DateTime.now());
  }
  
  // Filter businesses based on current filters
  List<DocumentSnapshot> get _filteredBusinesses {
    final filtered = _allBusinesses.where((doc) {
      final data = doc.data() as Map<String, dynamic>;
      final businessType = _extractBusinessType(data);
      final isActive = data['isActive'] as bool? ?? true;
      // TUNA Partner check - use correct field names
      final brandLabel = data['brandLabel'] as String?;
      final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) || 
                            (brandLabel == 'tuna');
      
      // Skip inactive
      if (!isActive) return false;
      
      // SECTOR FILTER: Only show businesses in Market sector
      if (!_hasMarketSector(data)) return false;
      
      // TUNA filter
      if (_onlyTuna && !isTunaPartner) return false;
      
      // Delivery mode filter
      if (_deliveryMode == 'teslimat') {
        final offersDelivery = data['offersDelivery'] as bool? ?? true;
        if (!offersDelivery) return false;
      } else if (_deliveryMode == 'gelal') {
        final offersPickup = data['offersPickup'] as bool? ?? true;
        if (!offersPickup) return false;
      }
      
      // Category filter
      if (_categoryFilter != 'all' && businessType != _categoryFilter.toLowerCase()) return false;
      
      // Distance filter
      debugPrint('🔍 Distance check: _userLat=$_userLat, _userLng=$_userLng, _maxDistance=$_maxDistance');
      if (_userLat != null && _userLng != null && _maxDistance < 200) {
        double? lat;
        double? lng;
        
        if (data['lat'] is num) lat = (data['lat'] as num).toDouble();
        if (data['lng'] is num) lng = (data['lng'] as num).toDouble();
        
        if (lat == null || lng == null) {
          final address = data['address'] as Map<String, dynamic>?;
          if (address != null) {
            if (address['lat'] is num) lat = (address['lat'] as num).toDouble();
            if (address['lng'] is num) lng = (address['lng'] as num).toDouble();
          }
        }
        
        if (lat == null || lng == null) {
          final placeDetails = data['placeDetails'] as Map<String, dynamic>?;
          if (placeDetails != null) {
            if (placeDetails['lat'] is num) lat = (placeDetails['lat'] as num).toDouble();
            if (placeDetails['lng'] is num) lng = (placeDetails['lng'] as num).toDouble();
          }
        }
        
        if (lat != null && lng != null) {
          final distanceMeters = Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
          final distanceKm = distanceMeters / 1000;
          debugPrint('📏 ${data['companyName']}: lat=$lat, lng=$lng, dist=${distanceKm.toStringAsFixed(1)}km, max=$_maxDistance');
          if (distanceKm > _maxDistance) {
            debugPrint('❌ ${data['companyName']} filtered out: ${distanceKm.toStringAsFixed(1)}km > $_maxDistance');
            return false;
          }

          if (_deliveryMode == 'teslimat') {
            final double deliveryRadius = (data['deliveryRadius'] as num?)?.toDouble() ?? 5.0;
            if (distanceKm > deliveryRadius) {
              debugPrint('🛑 ${data['companyName']} out of delivery radius: ${distanceKm.toStringAsFixed(1)}km > ${deliveryRadius}km');
              return false;
            }
          }
        } else {
          // No lat/lng - HIDE this business when distance filter is active
          debugPrint('⚠️ ${data['companyName']}: No lat/lng found, HIDING');
          return false;
        }
      } else {
        debugPrint('⏭️ Distance filter skipped: userLat=$_userLat, maxDist=$_maxDistance');
      }
      
      // 🆕 HIZLI FİLTRELER
      
      // İndirimler filtresi
      if (_filterDiscounts) {
        final hasDiscounts = data['hasActiveDiscounts'] as bool? ?? false;
        if (!hasDiscounts) return false;
      }
      
      // Nakit ödeme filtresi
      if (_filterCash) {
        final acceptsCash = data['acceptsCash'] as bool? ?? true;
        if (!acceptsCash) return false;
      }
      
      // Ücretsiz teslimat filtresi
      if (_filterFreeDelivery) {
        final deliveryFee = (data['deliveryFee'] as num?)?.toDouble() ?? 0.0;
        if (deliveryFee > 0) return false;
      }
      
      // Yemek kartı filtresi
      if (_filterMealCards) {
        final acceptsMealCards = data['acceptsMealCards'] as bool? ?? false;
        if (!acceptsMealCards) return false;
      }
      
      // 4+ Yıldız filtresi
      if (_filterHighRating) {
        final rating = (data['rating'] as num?)?.toDouble() ?? 0.0;
        if (rating < 4.0) return false;
      }
      
      // Şimdi Açık filtresi
      if (_filterOpenNow) {
        if (!_isBusinessOpenNow(data)) return false;
      }
      
      // Vejetaryen filtresi
      if (_filterVegetarian) {
        final offersVegetarian = data['offersVegetarian'] as bool? ?? false;
        if (!offersVegetarian) return false;
      }
      
      // 🔴 TUNA/Toros Ürünleri filtresi
      if (_filterTunaProducts) {
        final sellsTunaProducts = data['sellsTunaProducts'] as bool? ?? false;
        final sellsTorosProducts = data['sellsTorosProducts'] as bool? ?? false;
        if (!sellsTunaProducts && !sellsTorosProducts) return false;
      }
      
      return true;
    }).toList();
    
    // Apply sorting
    final result = List<DocumentSnapshot>.from(filtered);
    
    result.sort((a, b) {
      final dataA = a.data() as Map<String, dynamic>;
      final dataB = b.data() as Map<String, dynamic>;
      
      switch (_sortOption) {
        case 'rating': // En İyi Puan
          final ratingA = (dataA['rating'] as num?)?.toDouble() ?? 0.0;
          final ratingB = (dataB['rating'] as num?)?.toDouble() ?? 0.0;
          return ratingB.compareTo(ratingA);
          
        case 'tuna': // Tuna Sıralaması (Premium Tuna marks first)
          final brandLabelA = dataA['brandLabel'] as String?;
          final isTunaA = (dataA['isTunaPartner'] as bool? ?? false) || (brandLabelA == 'tuna');
          
          final brandLabelB = dataB['brandLabel'] as String?;
          final isTunaB = (dataB['isTunaPartner'] as bool? ?? false) || (brandLabelB == 'tuna');
          
          if (isTunaA && !isTunaB) return -1;
          if (!isTunaA && isTunaB) return 1;
          return 0;
          
        case 'az': // A-Z Isim
          final nameA = (dataA['businessName'] ?? dataA['companyName'] ?? '').toString().toLowerCase();
          final nameB = (dataB['businessName'] ?? dataB['companyName'] ?? '').toString().toLowerCase();
          return nameA.compareTo(nameB);
          
        case 'za': // Z-A Isim
          final nameA = (dataA['businessName'] ?? dataA['companyName'] ?? '').toString().toLowerCase();
          final nameB = (dataB['businessName'] ?? dataB['companyName'] ?? '').toString().toLowerCase();
          return nameB.compareTo(nameA);
          
        case 'nearest':
        default:
          // Distance sort
          if (_userLat != null && _userLng != null) {
            double? latA, lngA, latB, lngB;
            
            // Get coordinates A
            if (dataA['lat'] is num) latA = (dataA['lat'] as num).toDouble();
            if (dataA['lng'] is num) lngA = (dataA['lng'] as num).toDouble();
            if (latA == null || lngA == null) {
              final addr = dataA['address'] as Map<String, dynamic>?;
              if (addr != null && addr['lat'] is num) latA = (addr['lat'] as num).toDouble();
              if (addr != null && addr['lng'] is num) lngA = (addr['lng'] as num).toDouble();
            }
            
            // Get coordinates B
            if (dataB['lat'] is num) latB = (dataB['lat'] as num).toDouble();
            if (dataB['lng'] is num) lngB = (dataB['lng'] as num).toDouble();
            if (latB == null || lngB == null) {
              final addr = dataB['address'] as Map<String, dynamic>?;
              if (addr != null && addr['lat'] is num) latB = (addr['lat'] as num).toDouble();
              if (addr != null && addr['lng'] is num) lngB = (addr['lng'] as num).toDouble();
            }
            
            if (latA == null || lngA == null) return 1;
            if (latB == null || lngB == null) return -1;
            
            final distA = Geolocator.distanceBetween(_userLat!, _userLng!, latA, lngA);
            final distB = Geolocator.distanceBetween(_userLat!, _userLng!, latB, lngB);
            return distA.compareTo(distB);
          }
          return 0;
      }
    });

    debugPrint('✅ Filtered & Sorted result: ${result.length} businesses (Sort: $_sortOption)');
    return result;
  }

  // Calculate dynamic chip counts
  Map<String, int> get _filteredTypeCounts {
    final typeCounts = <String, int>{};
    
    for (final doc in _allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      final businessType = _extractBusinessType(data);
      final isActive = data['isActive'] as bool? ?? true;
      
      if (!isActive) continue;
      if (!_hasMarketSector(data)) continue;
      
      if (_onlyTuna) {
        final brandLabel = data['brandLabel'] as String?;
        final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) || 
                              (brandLabel == 'tuna');
        if (!isTunaPartner) continue;
      }
      
      if (_deliveryMode == 'teslimat') {
        final offersDelivery = data['offersDelivery'] as bool? ?? true;
        if (!offersDelivery) continue;
      } else if (_deliveryMode == 'gelal') {
        final offersPickup = data['offersPickup'] as bool? ?? true;
        if (!offersPickup) continue;
      }
      
      // Distance filter
      if (_userLat != null && _userLng != null && _maxDistance < 200) {
        double? lat;
        double? lng;
        
        if (data['lat'] is num) lat = (data['lat'] as num).toDouble();
        if (data['lng'] is num) lng = (data['lng'] as num).toDouble();
        
        if (lat == null || lng == null) {
          final address = data['address'] as Map<String, dynamic>?;
          if (address != null) {
            if (address['lat'] is num) lat = (address['lat'] as num).toDouble();
            if (address['lng'] is num) lng = (address['lng'] as num).toDouble();
          }
        }
        
        if (lat != null && lng != null) {
          final distanceMeters = Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
          final distanceKm = distanceMeters / 1000;
          if (distanceKm > _maxDistance) continue;

          if (_deliveryMode == 'teslimat') {
            final double deliveryRadius = (data['deliveryRadius'] as num?)?.toDouble() ?? 5.0;
            if (distanceKm > deliveryRadius) continue;
          }
        }
      }
      
      typeCounts[businessType] = (typeCounts[businessType] ?? 0) + 1;
    }
    
    return typeCounts;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            // Collapsing Header - Pinned (konum + arama her zaman görünür)
            SliverAppBar(
              backgroundColor: Theme.of(context).scaffoldBackgroundColor,
              pinned: true,
              floating: false,
              clipBehavior: Clip.hardEdge,
              expandedHeight: 220, // Genişletilmiş yükseklik - Yemek ile aynı
              collapsedHeight: 110, // Daraltılmış yükseklik (sadece konum + arama)
              automaticallyImplyLeading: false,
              flexibleSpace: LayoutBuilder(
                builder: (context, constraints) {
                  // Scroll oranını hesapla (0 = tamamen açık, 1 = tamamen kapalı)
                  final expandedHeight = 220.0;
                  final collapsedHeight = 110.0;
                  final currentHeight = constraints.maxHeight;
                  final expandRatio = ((currentHeight - collapsedHeight) / 
                                       (expandedHeight - collapsedHeight)).clamp(0.0, 1.0);
                  
                  return ClipRect(
                    child: Container(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      child: SingleChildScrollView(
                        physics: const NeverScrollableScrollPhysics(),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Location header (her zaman görünür)
                            _buildLocationHeader(),
                            
                            // Aşağıdaki filtreler scroll ile kaybolur
                            if (expandRatio > 0.05) ...[
                              Opacity(
                                opacity: expandRatio,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    // Delivery mode tabs
                                    _buildDeliveryModeTabs(),
                                    
                                    // Search bar (teslimat/gel al altında)
                                    _buildSearchBar(),
                                    
                                    // Sadece gel-al modunda Mesafe, diğerlerinde TUNA toggle
                                    if (_deliveryMode == 'gelal')
                                      _buildDistanceSliderWithTuna()
                                    else if (_deliveryMode == 'teslimat' || _deliveryMode == 'masa')
                                      _buildTunaToggleOnly(),
                                  ],
                                ),
                              ),
                            ] else ...[
                              // Collapsed state: sadece arama çubuğu
                              _buildSearchBar(),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            
            // Market List
            SliverPadding(
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 120),
              sliver: _buildMarketSliverList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationHeader() {
    // Get location from cached provider (no API call!)
    final locationAsync = ref.watch(userLocationProvider);
    
    String cityName = 'Konum alınıyor...';
    String streetInfo = '';
    bool isLoading = true;
    
    locationAsync.when(
      data: (location) {
        isLoading = false;
        if (location.isValid) {
          cityName = location.city.isNotEmpty ? location.city : location.address;
          streetInfo = location.street;
          // Update local variables for filtering (lat/lng)
          _userLat = location.latitude;
          _userLng = location.longitude;
          _isLoadingLocation = false;
          // Re-trigger auto-set when location becomes available
          if (!_sliderAutoSet && _allBusinesses.isNotEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _autoSetSliderToNearestBusiness();
            });
          }
        } else {
          cityName = location.address.isNotEmpty ? location.address : 'Konum izni verilmedi';
        }
      },
      loading: () {
        isLoading = true;
        cityName = 'Konum alınıyor...';
      },
      error: (e, st) {
        isLoading = false;
        cityName = 'Konum alınamadı';
      },
    );
    
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Row(
        children: [

          // Location info (şehir + sokak alt satırda)
          Expanded(
            child: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (context) => AddressSelectionSheet(),
                ).then((_) {
                  // Re-trigger auto-set when bottom sheet closes (location might have changed)
                  if (mounted && _allBusinesses.isNotEmpty) {
                    _autoSetSliderToNearestBusiness();
                  }
                });
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.location_on, color: lokmaPink, size: 16),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Şehir (ana satır)
                        Text(
                          isLoading ? 'Konum alınıyor...' : cityName,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                        // Sokak (alt satır - varsa)
                        if (streetInfo.isNotEmpty)
                          Text(
                            streetInfo,
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 11,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(Icons.keyboard_arrow_down, color: Colors.grey[400], size: 16),
                ],
              ),
            ),
          ),
          
          const SizedBox(width: 8),
          
          // Favoriler (kalp ikonu)
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/favorites');
            },
            child: Container(
              padding: const EdgeInsets.only(left: 8, right: 8, top: 6, bottom: 6),
              child: Builder(
                builder: (context) {
                  final favorites = ref.watch(butcherFavoritesProvider);
                  final hasAny = favorites.isNotEmpty;
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Icon(
                        hasAny ? Icons.favorite : Icons.favorite_border,
                        color: lokmaPink,
                        size: 24,
                      ),
                      if (hasAny)
                        Positioned(
                          top: -4,
                          right: -6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: lokmaPink,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: Colors.white, width: 1),
                            ),
                            child: Text(
                              '${favorites.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: GestureDetector(
        onTap: () {
          // 🆕 Lieferando tarzı: Arama'ya tıklayınca SmartSearchScreen'e git
          context.push('/search?segment=market');
        },
        child: Container(
          height: 48,
          padding: const EdgeInsets.only(left: 16, right: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark 
                ? Colors.grey[800] 
                : Colors.grey[200],
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(Icons.search, color: Colors.grey[600], size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Market, ürün veya şehir ara...',
                  style: TextStyle(color: Colors.grey[500], fontSize: 14),
                ),
              ),
              const SizedBox(width: 8),
              // Integrated Filter Button
              GestureDetector(
                onTap: _showFilterBottomSheet,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Icon(
                      Icons.tune, 
                      color: (_filterDiscounts || _filterCash || _filterFreeDelivery || 
                              _filterMealCards || _filterHighRating || _filterOpenNow || 
                              _filterVegetarian || _filterTunaProducts) 
                          ? lokmaPink 
                          : Colors.grey[600],
                      size: 20,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDeliveryModeTabs() {
    // Map current mode to index
    int selectedIndex = _deliveryMode == 'gelal' ? 1 : 0;

    return ThreeDimensionalPillTabBar(
      selectedIndex: selectedIndex,
      tabs: [
        TabItem(title: tr('delivery_modes.delivery'), icon: Icons.delivery_dining),
        TabItem(title: tr('delivery_modes.pickup'), icon: Icons.shopping_bag_outlined),
      ],
      onTabSelected: (index) {
        String newMode = index == 1 ? 'gelal' : 'teslimat';
        setState(() => _deliveryMode = newMode);
      },
    );
  }

  // Sabit km adımları: Market için 5-100 km
  static const List<double> _kmSteps = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

  // İşletme olan km'leri hesapla (set olarak)
  Set<int> get _businessKmSet {
    if (_userLat == null || _userLng == null) return {};
    
    final kmSet = <int>{};
    for (final doc in _allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      
      // Sadece market sektörü işletmelerini dahil et
      if (!_hasMarketSector(data)) continue;
      
      // Koordinat al
      final lat = data['lat'] as double? ?? 
                  (data['address'] as Map<String, dynamic>?)?['lat'] as double?;
      final lng = data['lng'] as double? ?? 
                  (data['address'] as Map<String, dynamic>?)?['lng'] as double?;
      
      if (lat != null && lng != null) {
        final distanceMeters = Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
        final distanceKm = (distanceMeters / 1000).round();
        if (distanceKm >= 1 && distanceKm <= 100) {
          kmSet.add(distanceKm);
        }
      }
    }
    return kmSet;
  }

  int _currentStepIndex = 9; // Varsayılan: 100 km (index 9)

  /// Auto-snap slider to nearest market business distance
  void _autoSetSliderToNearestBusiness() {
    if (_userLat == null || _userLng == null || _allBusinesses.isEmpty) return;
    
    double nearestKm = double.infinity;
    
    for (final doc in _allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      if (!_hasMarketSector(data)) continue;
      final isActive = data['isActive'] as bool? ?? true;
      if (!isActive) continue;
      
      double? lat, lng;
      if (data['lat'] is num) lat = (data['lat'] as num).toDouble();
      if (data['lng'] is num) lng = (data['lng'] as num).toDouble();
      if (lat == null || lng == null) {
        final addr = data['address'] as Map<String, dynamic>?;
        if (addr != null) {
          if (addr['lat'] is num) lat = (addr['lat'] as num).toDouble();
          if (addr['lng'] is num) lng = (addr['lng'] as num).toDouble();
        }
      }
      
      if (lat != null && lng != null) {
        final distKm = Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng) / 1000;
        if (distKm < nearestKm) nearestKm = distKm;
      }
    }
    
    if (nearestKm == double.infinity) return;
    
    // Find the first step index that covers the nearest business
    int targetIndex = _kmSteps.length - 1; // fallback to max
    for (int i = 0; i < _kmSteps.length; i++) {
      if (_kmSteps[i] >= nearestKm) {
        targetIndex = i;
        break;
      }
    }
    
    if (mounted) {
      setState(() {
        _currentStepIndex = targetIndex;
        _maxDistance = _kmSteps[targetIndex];
        _sliderAutoSet = true;
      });
      debugPrint('🎯 Market auto-set slider: nearest at ${nearestKm.toStringAsFixed(1)}km → step ${_kmSteps[targetIndex]}km');
    }
  }

  Widget _buildDistanceSliderWithTuna() {
    final businessKms = _businessKmSet;
    final currentKm = _kmSteps[_currentStepIndex];
    final hasBusinessAtCurrent = businessKms.contains(currentKm.toInt());
    
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Row(
        children: [
          Icon(Icons.location_on_outlined, color: lokmaPink, size: 18),
          Expanded(
            child: SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: lokmaPink,
                inactiveTrackColor: Theme.of(context).brightness == Brightness.dark 
                    ? Colors.grey[600] 
                    : Colors.grey[400],
                thumbColor: lokmaPink,
                overlayColor: lokmaPink.withValues(alpha: 0.2),
                trackHeight: 4,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
                // Her km adımını göster - daha büyük ve görünür
                tickMarkShape: const RoundSliderTickMarkShape(tickMarkRadius: 3),
                activeTickMarkColor: Colors.white.withValues(alpha: 0.8),
                inactiveTickMarkColor: Theme.of(context).brightness == Brightness.dark 
                    ? Colors.grey[400] 
                    : Colors.grey[600],
              ),
              child: Slider(
                value: _currentStepIndex.toDouble(),
                min: 0,
                max: (_kmSteps.length - 1).toDouble(),
                divisions: _kmSteps.length - 1,
                onChanged: (value) {
                  final newIndex = value.round();
                  
                  if (newIndex != _currentStepIndex) {
                    final newKm = _kmSteps[newIndex];
                    final hasBusinessHere = businessKms.contains(newKm.toInt());
                    
                    // İşletme olan km'de güçlü feedback, diğerlerinde hafif
                    if (hasBusinessHere) {
                      HapticFeedback.mediumImpact(); // Güçlü titreme - işletme var!
                    } else {
                      HapticFeedback.selectionClick(); // Hafif titreme - normal adım
                    }
                    
                    setState(() {
                      _currentStepIndex = newIndex;
                      _maxDistance = newKm;
                    });
                  }
                },
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: hasBusinessAtCurrent ? lokmaPink.withValues(alpha: 0.3) : cardBg,
              borderRadius: BorderRadius.circular(8),
              border: hasBusinessAtCurrent ? Border.all(color: lokmaPink, width: 1) : Border.all(color: Colors.grey.shade300),
            ),
            child: Text(
              '${currentKm.toInt()} km',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface, 
                fontSize: 12, 
                fontWeight: hasBusinessAtCurrent ? FontWeight.bold : FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          // TUNA Kasaplar pill toggle - hap şeklinde, kırmızı
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() => _onlyTuna = !_onlyTuna);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: _onlyTuna ? const Color(0xFFFB335B) : Colors.transparent,
                borderRadius: BorderRadius.circular(20), // Pill shape
                border: Border.all(
                  color: _onlyTuna ? const Color(0xFFFB335B) : Colors.grey.shade400,
                  width: 1.5,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _onlyTuna ? Icons.check_box : Icons.check_box_outline_blank,
                    color: _onlyTuna ? Colors.white : Colors.grey[600],
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'TUNA Kasaplar',
                    style: TextStyle(
                      color: _onlyTuna ? Colors.white : Colors.grey[600],
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
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
  
  // 🆕 TUNA Marketler toggle only (for Kurye mode - no distance slider)
  Widget _buildTunaToggleOnly() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() => _onlyTuna = !_onlyTuna);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: _onlyTuna ? const Color(0xFFFB335B) : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _onlyTuna ? const Color(0xFFFB335B) : Colors.grey.shade400,
                  width: 1.5,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _onlyTuna ? Icons.check_box : Icons.check_box_outline_blank,
                    color: _onlyTuna ? Colors.white : Colors.grey[600],
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'TUNA Marketler',
                    style: TextStyle(
                      color: _onlyTuna ? Colors.white : Colors.grey[600],
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
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

  // TUNA pill toggle - same style as category chips but RED (tunaGreen for market)


  // Sliver version of market list for CustomScrollView
  Widget _buildMarketSliverList() {
    if (_isLoading) {
      return const SliverFillRemaining(
        child: Center(
          child: CircularProgressIndicator(color: tunaGreen),
        ),
      );
    }

    final markets = _filteredBusinesses;

    if (markets.isEmpty) {
      return SliverFillRemaining(
        child: _buildEmptyState(),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          if (index == 0) {
            // Count header as first item
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                tr('discovery.businesses_at_service', namedArgs: {'count': markets.length.toString()}),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            );
          }
          final doc = markets[index - 1];
          final data = doc.data() as Map<String, dynamic>;
          return _buildMarketCard(doc.id, data);
        },
        childCount: markets.length + 1, // +1 for header
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.store_outlined, size: 64, color: Colors.grey[500]),
          const SizedBox(height: 16),
          Text(
            'Bu kriterlere uygun market bulunamadı',
            style: TextStyle(color: Colors.grey[700], fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            'Filtreleri değiştirmeyi deneyin',
            style: TextStyle(color: Colors.grey[600], fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildMarketCard(String id, Map<String, dynamic> data) {
    final name = data['businessName'] ?? data['companyName'] ?? 'İsimsiz';
    final businessType = _extractBusinessType(data);
    // TUNA Partner check - use correct field name
    final brandLabel = data['brandLabel'] as String?;
    final brand = data['brand'] as String?;
    final tags = data['tags'] as List<dynamic>?;
    final hasTunaTag = tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
    final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) ||
                          (brandLabel?.toLowerCase() == 'tuna') ||
                          (brand?.toLowerCase() == 'tuna') ||
                          hasTunaTag;
    
    // 🆕 Gelişmiş Sipariş Saatleri
    final deliveryStartTime = data['deliveryStartTime'] as String?;
    final pickupStartTime = data['pickupStartTime'] as String?;
    // 🆕 Geçici Kurye Kapatma
    final temporaryDeliveryPaused = data['temporaryDeliveryPaused'] as bool? ?? false;
    
    final rating = (data['rating'] as num?)?.toDouble() ?? 4.0;
    final reviewCount = (data['reviewCount'] as num?)?.toInt() ?? 0;
    final imageUrl = data['imageUrl'] as String?;
    final logoUrl = data['logoUrl'] as String?;
    
    // Business type label
    final typeLabel = MARKET_TYPE_LABELS[businessType] ?? businessType;
    
    // Calculate distance
    String distanceText = '';
    if (_userLat != null && _userLng != null) {
      double? lat;
      double? lng;
      
      if (data['lat'] is num) lat = (data['lat'] as num).toDouble();
      if (data['lng'] is num) lng = (data['lng'] as num).toDouble();
      
      if (lat == null || lng == null) {
        final address = data['address'] as Map<String, dynamic>?;
        if (address != null) {
          if (address['lat'] is num) lat = (address['lat'] as num).toDouble();
          if (address['lng'] is num) lng = (address['lng'] as num).toDouble();
        }
      }
      
      if (lat != null && lng != null) {
        final distanceMeters = Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
        final distanceKm = distanceMeters / 1000;
        distanceText = '${distanceKm.toStringAsFixed(1)} km';
      }
    }
    
    // Favorite state
    final favorites = ref.watch(butcherFavoritesProvider);
    final isFavorite = favorites.contains(id);
    
    // Availability state
    final isOpen = _isBusinessOpenNow(data);
    
    // Review count text
    String reviewText = '';
    if (reviewCount > 0) {
      if (reviewCount >= 1000) {
        reviewText = '(${(reviewCount / 1000).toStringAsFixed(1)}k+)';
      } else {
        reviewText = '($reviewCount)';
      }
    }
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/kasap/$id');
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Large image with overlays
            Stack(
              children: [
                // Main image - Lieferando style (tall)
                AspectRatio(
                  aspectRatio: 16 / 10, // Taller like Lieferando
                  child: imageUrl != null && imageUrl.isNotEmpty
                      ? Image.network(
                            imageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              color: Colors.grey[200],
                              child: const Center(
                                child: Icon(Icons.store, color: tunaGreen, size: 48),
                              ),
                            ),
                          )
                        : Container(
                            color: Colors.grey[200],
                            child: const Center(
                              child: Icon(Icons.store, color: tunaGreen, size: 48),
                            ),
                          ),
                  ),
                
                // 🆕 Darker overlay for unavailable businesses
                if (!isOpen)
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.4), // Slightly lighter dark overlay
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(12),  // Match main card radius
                          topRight: Radius.circular(12), // Match main card radius
                        ),
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
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: Theme.of(context).brightness == Brightness.dark 
                            ? const Color(0xFF5A5A5C) 
                            : Colors.grey.shade100.withValues(alpha: 0.9), // lighter background
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(12),  // Match main card radius
                          topRight: Radius.circular(12), // Match main card radius
                        ),
                      ),
                      child: Center(
                        child: Text(
                          'Şu an kapalı',
                          style: TextStyle(
                            color: Theme.of(context).brightness == Brightness.dark 
                                ? Colors.white 
                                : Colors.black87,
                            fontSize: 12, // Thinner, smaller font
                            fontWeight: FontWeight.w500, // Medium weight
                            letterSpacing: 0.2, // Tighter letter spacing
                          ),
                        ),
                      ),
                    ),
                  ),
                
                // Business logo (bottom left, overlapping) - only show if logo exists
                if (logoUrl != null && logoUrl.isNotEmpty)
                  Positioned(
                    left: 12,
                    bottom: -24,
                    child: Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.2),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          logoUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(Icons.store, color: tunaGreen, size: 24),
                          ),
                        ),
                      ),
                    ),
                  ),
                
                // TUNA brand badge (top left) - synced from admin panel
                if (isTunaPartner)
                  Positioned(
                    left: 12,
                    top: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFB335B), // TUNA red
                        borderRadius: BorderRadius.circular(16), // Pill shape
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Text(
                        'TUNA',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                  ),
                
                // 🆕 Teslimat/Gel Al başlangıç saati badge'leri (Lieferando benzeri)
                if (deliveryStartTime != null && deliveryStartTime.isNotEmpty ||
                    pickupStartTime != null && pickupStartTime.isNotEmpty)
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.85),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (deliveryStartTime != null && deliveryStartTime.isNotEmpty) ...[
                            const Icon(Icons.delivery_dining, color: Colors.white, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              'Teslimat $deliveryStartTime\'ten sonra',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                          if (deliveryStartTime != null && deliveryStartTime.isNotEmpty &&
                              pickupStartTime != null && pickupStartTime.isNotEmpty)
                            const Text(' • ', style: TextStyle(color: Colors.white70, fontSize: 11)),
                          if (pickupStartTime != null && pickupStartTime.isNotEmpty) ...[
                            const Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              'Gel Al $pickupStartTime\'dan',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                
                // 🆕 Geçici Kurye Kapatma Banner
                if (temporaryDeliveryPaused)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade700,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.pause_circle_outline, color: Colors.white, size: 16),
                          SizedBox(width: 6),
                          Text(
                            '🚚 Kurye şu an hizmet vermiyor',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                
                // Favorite button (top right) - moved below banner
                Positioned(
                  top: 48,
                  right: 12,
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      ref.read(butcherFavoritesProvider.notifier).toggleFavorite(id);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isFavorite ? Icons.favorite : Icons.favorite_border,
                        color: isFavorite ? lokmaPink : Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            
            // Info section (below image)
            // Info section (below image)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 28, 16, 16), // Extra top padding for logo overlap
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Business name
                  Text(
                    name,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 18,
                      fontWeight: FontWeight.w600, // Reduced from w700
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  
                  // Rating + Type (Lieferando style: ★ 4.7 (220+) · Market)
                  Builder(
                    builder: (context) {
                      final isDark = Theme.of(context).brightness == Brightness.dark;
                      final textColor = isDark ? Colors.white.withValues(alpha: 0.9) : Colors.black87;
                      final starColor = isDark ? Color(0xFFFF9529) : Color(0xFFFF9529);

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.star, color: starColor, size: 16),
                              const SizedBox(width: 6),
                              Text(
                                rating.toStringAsFixed(1).replaceAll('.', ','),
                                style: TextStyle(
                                  color: textColor,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600, // Reduced from w700
                                ),
                              ),
                              if (reviewText.isNotEmpty) ...[
                                const SizedBox(width: 4),
                                Text(
                                  reviewText,
                                  style: TextStyle(
                                    color: textColor,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w400,
                                  ),
                                ),
                              ],
                              Text(
                                ' · ',
                                style: TextStyle(color: textColor, fontSize: 15),
                              ),
                              Text(
                                typeLabel,
                                style: TextStyle(
                                  color: textColor,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w400,
                                ),
                              ),
                            ],
                          ),
                          
                          const SizedBox(height: 6),
                          
                          // Delivery Info Row
                          Builder(
                            builder: (context) {
                              // Read business delivery settings
                              final deliveryFee = (data['deliveryFee'] as num?)?.toDouble() ?? 0.0;
                              final minOrderAmount = (data['minOrderAmount'] as num?)?.toDouble() ?? 10.0;
                              final freeDeliveryThreshold = (data['freeDeliveryThreshold'] as num?)?.toDouble();
                              
                              if (_deliveryMode == 'teslimat') {
                                final hasFreeDelivery = freeDeliveryThreshold != null && freeDeliveryThreshold > 0;
                                final hasMinOrder = minOrderAmount > 0;
                                
                                return Row(
                                  children: [
                                    // Delivery fee
                                    Icon(Icons.directions_bike, color: textColor, size: 16),
                                    const SizedBox(width: 6),
                                    if (hasFreeDelivery && deliveryFee == 0)
                                      Text(
                                        'Ücretsiz',
                                        style: TextStyle(color: textColor, fontSize: 15),
                                      )
                                    else
                                      Text(
                                        '${deliveryFee.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()} Teslimat',
                                        style: TextStyle(
                                          color: textColor,
                                          fontSize: 15,
                                          fontWeight: FontWeight.w400,
                                        ),
                                      ),
                                    
                                    // Min order
                                    if (hasMinOrder) ...[
                                      Text(' · ', style: TextStyle(color: textColor, fontSize: 15)),
                                      Icon(Icons.shopping_basket_outlined, color: textColor, size: 16),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Min. ${minOrderAmount.toStringAsFixed(0)} ${CurrencyUtils.getCurrencySymbol()}',
                                        style: TextStyle(
                                          color: textColor,
                                          fontSize: 15,
                                          fontWeight: FontWeight.w400,
                                        ),
                                      ),
                                    ],
                                  ],
                                );
                              } else {
                                // PICKUP MODE
                                if (distanceText.isEmpty) return const SizedBox.shrink();
                                return Row(
                                  children: [
                                    Icon(Icons.location_on_outlined, color: textColor, size: 16),
                                    const SizedBox(width: 4),
                                    Text(
                                      distanceText,
                                      style: TextStyle(
                                        color: textColor,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w400,
                                      ),
                                    ),
                                  ],
                                );
                              }
                            },
                          ),
                        ],
                      );
                    }
                  ),

                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showFilterBottomSheet() {
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: cardBg,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateSheet) {
            // Get dynamic category counts
            final filteredCounts = _filteredTypeCounts;
            final sortedTypes = filteredCounts.entries.toList()
              ..sort((a, b) => b.value.compareTo(a.value));
            
            // Calculate total results
            final totalResults = _filteredBusinesses.length;
            
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.85,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header Bar
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // İptal Button
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text(
                            'İptal',
                            style: TextStyle(color: lokmaPink, fontSize: 16),
                          ),
                        ),
                        // Results Count
                        const Text(
                          'Filtrele',
                          style: TextStyle(
                            color: Colors.black87,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        // Sıfırla Button
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _sortOption = 'nearest';
                              _categoryFilter = 'all';
                              // 🆕 Reset quick filters
                              _filterDiscounts = false;
                              _filterCash = false;
                              _filterFreeDelivery = false;
                              _filterMealCards = false;
                              _filterHighRating = false;
                              _filterOpenNow = false;
                              _filterVegetarian = false;
                              _filterTunaProducts = false;
                            });
                            setStateSheet(() {});
                          },
                          child: const Text(
                            'Sıfırla',
                            style: TextStyle(color: lokmaPink, fontSize: 16),
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  Divider(color: Colors.grey[300], height: 1),
                  
                  // Scrollable Content
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 20),
                          
                          // Sıralama Section Header
                          Text(
                            'Sıralama',
                            style: TextStyle(
                              color: Colors.grey[800],
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 12),
                          
                          // Sıralama Options (List style with checkbox)
                          _buildFilterListItem(
                            title: 'En Yakın',
                            subtitle: 'Mesafeye göre sırala',
                            isSelected: _sortOption == 'nearest',
                            onTap: () {
                              setState(() => _sortOption = 'nearest');
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'En İyi Puan',
                            subtitle: 'Yüksek puanlı işletmeler',
                            isSelected: _sortOption == 'rating',
                            onTap: () {
                              setState(() => _sortOption = 'rating');
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Tuna Sıralaması',
                            subtitle: 'Önerilen işletmeler',
                            isSelected: _sortOption == 'tuna',
                            onTap: () {
                              setState(() => _sortOption = 'tuna');
                              setStateSheet(() {});
                            },
                            isPremium: true,
                          ),
                          
                          const SizedBox(height: 24),
                          
                          // 🆕 Hızlı Filtreler Section Header
                          Text(
                            'Hızlı Filtreler',
                            style: TextStyle(
                              color: Colors.grey[800],
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 12),
                          
                          // 🔴 TUNA/Toros Ürünleri Filtresi (EN ÜSTTE)
                          Builder(
                            builder: (context) {
                              // Bölge tespiti: işletmelerin çoğunluğu Türkiye'de ise Akdeniz Toros, değilse TUNA
                              // Şimdilik basit: Türkiye için Toros, Avrupa için TUNA
                              final isTurkeyRegion = Localizations.localeOf(context).languageCode == 'tr';
                              return _buildFilterListItem(
                                title: isTurkeyRegion ? 'Akdeniz Toros Ürünleri' : 'TUNA Ürünleri',
                                subtitle: isTurkeyRegion 
                                    ? '🟢 Akdeniz Toros markalı ürünler satan işletmeler'
                                    : '🔴 TUNA markalı ürünler satan işletmeler',
                                isSelected: _filterTunaProducts,
                                onTap: () {
                                  setState(() => _filterTunaProducts = !_filterTunaProducts);
                                  setStateSheet(() {});
                                },
                                isPremium: true,
                              );
                            },
                          ),
                          
                          _buildFilterListItem(
                            title: 'İndirimler',
                            subtitle: 'Aktif kampanyası olan işletmeler',
                            isSelected: _filterDiscounts,
                            onTap: () {
                              setState(() => _filterDiscounts = !_filterDiscounts);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Nakit Ödeme',
                            subtitle: 'Nakit ödeme kabul eden işletmeler',
                            isSelected: _filterCash,
                            onTap: () {
                              setState(() => _filterCash = !_filterCash);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Ücretsiz Teslimat',
                            subtitle: 'Teslimat ücreti olmayan işletmeler',
                            isSelected: _filterFreeDelivery,
                            onTap: () {
                              setState(() => _filterFreeDelivery = !_filterFreeDelivery);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Yemek Kartı',
                            subtitle: 'Sodexo, Ticket vb. kabul eden işletmeler',
                            isSelected: _filterMealCards,
                            onTap: () {
                              setState(() => _filterMealCards = !_filterMealCards);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: '4+ Yıldız',
                            subtitle: 'Yüksek puanlı işletmeler',
                            isSelected: _filterHighRating,
                            onTap: () {
                              setState(() => _filterHighRating = !_filterHighRating);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Şimdi Açık',
                            subtitle: 'Şu anda açık olan işletmeler',
                            isSelected: _filterOpenNow,
                            onTap: () {
                              setState(() => _filterOpenNow = !_filterOpenNow);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Vejetaryen',
                            subtitle: 'Vejetaryen ürünler sunan işletmeler',
                            isSelected: _filterVegetarian,
                            onTap: () {
                              setState(() => _filterVegetarian = !_filterVegetarian);
                              setStateSheet(() {});
                            },
                          ),
                          
                          const SizedBox(height: 24),
                          
                          // İşletme Türü Section Header
                          Text(
                            'İşletme Türü',
                            style: TextStyle(
                              color: Colors.grey[800],
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 12),
                          
                          // Tümü Option
                          _buildFilterListItem(
                            title: 'Tümü',
                            subtitle: 'Tüm işletmeleri göster',
                            isSelected: _categoryFilter == 'all',
                            onTap: () {
                              setState(() => _categoryFilter = 'all');
                              setStateSheet(() {});
                            },
                          ),
                          
                          // Dynamic Category Options
                          ...sortedTypes.map((entry) {
                            final typeKey = entry.key;
                            final count = entry.value;
                            final label = MARKET_TYPE_LABELS[typeKey] ?? typeKey;
                            
                            return _buildFilterListItem(
                              title: label,
                              subtitle: '$count işletme',
                              isSelected: _categoryFilter == typeKey,
                              onTap: () {
                                setState(() => _categoryFilter = typeKey);
                                setStateSheet(() {});
                              },
                            );
                          }),
                          
                          const SizedBox(height: 100), // Space for button
                        ],
                      ),
                    ),
                  ),
                  
                  // Bottom Result Button
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardBg,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.3),
                          blurRadius: 10,
                          offset: const Offset(0, -2),
                        ),
                      ],
                    ),
                    child: SafeArea(
                      top: false,
                      child: SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: () => Navigator.pop(context),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: lokmaPink,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(25),
                            ),
                          ),
                          child: Text(
                            '$totalResults İşletme Göster',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
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
  
  Widget _buildFilterListItem({
    required String title,
    required String subtitle,
    required bool isSelected,
    required VoidCallback onTap,
    bool isPremium = false,
  }) {
    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.black87,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (isPremium) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: tunaGreen.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Önerilen',
                            style: TextStyle(color: lokmaPink, fontSize: 10),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            // Checkbox - Radio style (circle) for single select, checkbox for multi
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: isSelected ? lokmaPink : Colors.transparent,
                borderRadius: BorderRadius.circular(12), // Round like Yemek
                border: Border.all(
                  color: isSelected ? lokmaPink : Colors.grey[400]!,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check, color: Colors.white, size: 14)
                  : null,
            ),
          ],
        ),
      ),
    );
  }

}
