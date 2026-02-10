import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

/// Business type labels for display
const Map<String, String> BUSINESS_TYPE_LABELS = {
  'kasap': 'Kasap',
  'market': 'Market',
  'restoran': 'Restoran',
  'fastfood': 'Fastfood',
  'pastane': 'Pastane & Tatlıcı',
  'cicekci': 'Çiçekçi',
  'cigkofte': 'Çiğ Köfteci',
  'cafe': 'Kafe',
  'catering': 'Catering',
  'firin': 'Fırın',
  'kermes': 'Kermes',
  'aktar': 'Aktar',
  'icecek': 'İçecek',
  'kozmetik': 'Kozmetik',
  'sarkuteri': 'Şarküteri',
  'petshop': 'Pet Shop',
  'tursu': 'Turşu',
  'balik': 'Balık',
  'kuruyemis': 'Kuru Yemiş',
  'ciftci': 'Çiftçi',
};

/// Yemek/Restoran Keşif Ekranı - LOKMA
/// Dinamik sektörler - Firestore'dan çekilir
class RestoranScreen extends ConsumerStatefulWidget {
  const RestoranScreen({super.key});

  @override
  ConsumerState<RestoranScreen> createState() => _RestoranScreenState();
}

class _RestoranScreenState extends ConsumerState<RestoranScreen> {
  // Theme colors
  // Theme colors
  static const Color lokmaPink = Color(0xFFF43F5E); // Rose-500 brand color
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
  String _userAddress = 'Konum alınıyor...';
  bool _isLoadingLocation = true;
  double? _userLat;
  double? _userLng;
  
  // Distance slider (km) - Yemek için dinamik işletme mesafeleri
  double _maxDistance = 10.0;
  
  // Dynamic categories from Firestore
  Map<String, int> _businessTypeCounts = {};
  List<DocumentSnapshot> _allBusinesses = [];
  bool _isLoading = true;
  
  // Dynamic sector types from Firestore 'sectors' collection
  Set<String> _yemekSectorTypes = {};
  
  // 🆕 Canlı Firestore stream subscription
  StreamSubscription<QuerySnapshot>? _businessesSubscription;
  
  // Sorting option
  String _sortOption = 'nearest'; // nearest, rating, tuna, az, za
  
  // 🆕 Hızlı Filtreler (Lieferando tarzı)
  bool _filterDiscounts = false;      // İndirimli ürünler
  bool _filterCash = false;           // Nakit ödeme kabul
  bool _filterFreeDelivery = false;   // Ücretsiz teslimat
  bool _filterMealCards = false;      // Yemek kartı kabul
  bool _filterHighRating = false;     // 4+ yıldız
  bool _filterOpenNow = false;        // Şimdi açık
  bool _filterTunaApproved = false;   // Tuna Onaylı
  bool _filterVegetarian = false;     // Vejetaryen

  @override
  void initState() {
    super.initState();
    // Location now comes from cached userLocationProvider - no API call here!
    _loadSectorsAndBusinesses();
  }
  
  Future<void> _loadSectorsAndBusinesses() async {
    // First load sectors to know which types are Yemek
    try {
      final sectorsSnapshot = await FirebaseFirestore.instance
          .collection('sectors')
          .where('category', isEqualTo: 'yemek')
          .where('isActive', isEqualTo: true)
          .get();
      
      _yemekSectorTypes = sectorsSnapshot.docs
          .map((doc) => doc.id.toLowerCase())
          .toSet();
      
      debugPrint('🍽️ Yemek sector types: $_yemekSectorTypes');
    } catch (e) {
      debugPrint('❌ Error loading sectors: $e');
      // Fallback to hardcoded list
      _yemekSectorTypes = {'restoran', 'pastane', 'cigkofte', 'firin', 'catering', 'kermes', 'cafe'};
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
        
        // Skip NON-YEMEK types (direct ID check)
        if (!_yemekSectorTypes.contains(businessType.toLowerCase())) continue;
        
        if (isActive) {
          typeCounts[businessType] = (typeCounts[businessType] ?? 0) + 1;
        }
      }
      
      debugPrint('📊 Business types: $typeCounts');
      
      if (mounted) {
        setState(() {
          _allBusinesses = snapshot.docs;
          _businessTypeCounts = typeCounts;
          _isLoading = false;
        });
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

  // Helper to extract business type from Firestore document
  // Firestore uses 'type' (String) or 'types' (List<String>) - NOT 'businessType'
  static String _extractBusinessType(Map<String, dynamic> data) {
    // Try 'type' field first (String)
    final typeField = data['type'];
    if (typeField is String && typeField.isNotEmpty) {
      return typeField.toLowerCase();
    }
    // Try 'types' array (take first element)
    final typesField = data['types'];
    if (typesField is List && typesField.isNotEmpty) {
      return (typesField.first as String? ?? 'other').toLowerCase();
    }
    // Fallback to 'businessType' for backwards compatibility
    final businessType = data['businessType'];
    if (businessType is String && businessType.isNotEmpty) {
      return businessType.toLowerCase();
    }
    return 'other';
  }

  // =====================================================
  // ID-BASED SECTOR MATCHING (No fuzzy matching needed!)
  // =====================================================
  // Admin Portal saves sector IDs (from sectors collection) to business.types array
  // So we just need to check if any business type ID is in our yemek sector IDs set
  
  /// Check if business belongs to Yemek sector
  /// Uses direct ID matching - no string parsing or fuzzy matching needed
  bool _hasYemekSector(Map<String, dynamic> data) {
    // Get all sector IDs from the business
    final Set<String> businessSectorIds = {};
    
    // Check 'type' field (single sector ID)
    final typeField = data['type'];
    if (typeField is String && typeField.isNotEmpty) {
      businessSectorIds.add(typeField.toLowerCase());
    }
    
    // Check 'types' field (multiple sector IDs)
    final typesField = data['types'];
    if (typesField is List) {
      for (final t in typesField) {
        if (t is String && t.isNotEmpty) {
          businessSectorIds.add(t.toLowerCase());
        }
      }
    }
    
    // Direct ID matching - check if any business sector is in Yemek sectors
    final hasMatch = businessSectorIds.intersection(_yemekSectorTypes).isNotEmpty;
    
    if (hasMatch) {
      debugPrint('✅ Yemek sector: ${data['companyName']} has ${businessSectorIds.intersection(_yemekSectorTypes)}');
    } else {
      debugPrint('❌ Not Yemek: ${data['companyName']} has $businessSectorIds, need $_yemekSectorTypes');
    }
    
    return hasMatch;
  }
  
  // 🆕 Check if business is currently open based on openingHours
  bool _isBusinessOpenNow(Map<String, dynamic> data) {
    final openingHours = data['openingHours'];
    if (openingHours == null) return true; // No info = assume open
    
    final now = DateTime.now();
    final weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    final todayName = weekdays[now.weekday - 1];
    
    // openingHours can be List<String> (Google format) or Map<String, String>
    String? todayHours;
    
    if (openingHours is List) {
      // Google format: ["Monday: 09:00 – 18:00", "Tuesday: 09:00 – 18:00", ...]
      for (final entry in openingHours) {
        if (entry is String && entry.startsWith(todayName)) {
          todayHours = entry;
          break;
        }
      }
    } else if (openingHours is Map) {
      // Map format: {"monday": "09:00-18:00", ...}
      todayHours = openingHours[todayName.toLowerCase()] as String?;
    }
    
    if (todayHours == null || todayHours.toLowerCase().contains('closed') || todayHours.toLowerCase().contains('kapalı')) {
      return false;
    }
    
    // Try to parse hours - format: "09:00 – 18:00" or "09:00-18:00"
    final timeRegex = RegExp(r'(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})');
    final match = timeRegex.firstMatch(todayHours);
    
    if (match != null) {
      final openHour = int.parse(match.group(1)!);
      final openMinute = int.parse(match.group(2)!);
      final closeHour = int.parse(match.group(3)!);
      final closeMinute = int.parse(match.group(4)!);
      
      final openTime = DateTime(now.year, now.month, now.day, openHour, openMinute);
      final closeTime = DateTime(now.year, now.month, now.day, closeHour, closeMinute);
      
      return now.isAfter(openTime) && now.isBefore(closeTime);
    }
    
    return true; // Can't parse = assume open
  }
  
  // Filter businesses based on current filters
  List<DocumentSnapshot> get _filteredBusinesses {
    debugPrint('🔍 Filtering: deliveryMode=$_deliveryMode, categoryFilter=$_categoryFilter, onlyTuna=$_onlyTuna, maxDistance=$_maxDistance');
    debugPrint('🔍 User location: lat=$_userLat, lng=$_userLng');
    debugPrint('🔍 Total businesses before filter: ${_allBusinesses.length}');
    
    final filtered = _allBusinesses.where((doc) {
      final data = doc.data() as Map<String, dynamic>;
      final businessType = _extractBusinessType(data);
      final isActive = data['isActive'] as bool? ?? true;
      // TUNA Partner check - check multiple possible field names
      final brandLabel = data['brandLabel'] as String?;
      final brand = data['brand'] as String?; // Some records use 'brand' instead of 'brandLabel'
      final tags = data['tags'] as List<dynamic>?;
      final hasTunaTag = tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
      final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) || 
                            (brandLabel?.toLowerCase() == 'tuna') ||
                            (brand?.toLowerCase() == 'tuna') ||
                            hasTunaTag;
      
      // Skip inactive
      if (!isActive) return false;
      
      // DEBUG: Log each business
      debugPrint('📋 Business: ${data['companyName']} | type: $businessType | tuna: $isTunaPartner');
      
      // SECTOR FILTER: Only show businesses in Yemek sector (ID-based matching)
      if (!_hasYemekSector(data)) return false;
      
      // TUNA filter
      if (_onlyTuna && !isTunaPartner) return false;
      
      // Delivery mode filter
      if (_deliveryMode == 'teslimat') {
        final offersDelivery = data['offersDelivery'] as bool? ?? true; // Default to true if missing
        if (!offersDelivery) return false;
      } else if (_deliveryMode == 'gelal') {
        final offersPickup = data['offersPickup'] as bool? ?? true; // Default to true if missing
        if (!offersPickup) return false;
      } else if (_deliveryMode == 'masa') {
        // Masa mode: show businesses with reservation OR dine-in features
        final hasReservation = data['hasReservation'] as bool? ?? false;
        final tableCapacity = data['tableCapacity'] as int? ?? 0;
        final hasDineInQR = data['hasDineInQR'] as bool? ?? false;
        final hasWaiterOrder = data['hasWaiterOrder'] as bool? ?? false;
        if (!hasReservation && tableCapacity <= 0 && !hasDineInQR && !hasWaiterOrder) return false;
      }
      
      // Category filter
      if (_categoryFilter != 'all' && businessType != _categoryFilter.toLowerCase()) return false;
      
      // Distance filter - only if user location is available AND slider is not at max
      if (_userLat != null && _userLng != null && _maxDistance < 200) {
        // Try to get lat/lng from multiple possible locations in Firebase data
        double? lat;
        double? lng;
        
        // 1. Try root level lat/lng (num safe cast)
        if (data['lat'] is num) lat = (data['lat'] as num).toDouble();
        if (data['lng'] is num) lng = (data['lng'] as num).toDouble();
        
        // 2. Fallback to address.lat/lng
        if (lat == null || lng == null) {
          final address = data['address'] as Map<String, dynamic>?;
          if (address != null) {
            if (address['lat'] is num) lat = (address['lat'] as num).toDouble();
            if (address['lng'] is num) lng = (address['lng'] as num).toDouble();
          }
        }
        
        // 3. Try placeDetails.lat/lng (Google Places import)
        if (lat == null || lng == null) {
          final placeDetails = data['placeDetails'] as Map<String, dynamic>?;
          if (placeDetails != null) {
            if (placeDetails['lat'] is num) lat = (placeDetails['lat'] as num).toDouble();
            if (placeDetails['lng'] is num) lng = (placeDetails['lng'] as num).toDouble();
          }
        }
        
        if (lat != null && lng != null) {
          final distanceMeters = Geolocator.distanceBetween(
            _userLat!, _userLng!, lat, lng
          );
          final distanceKm = distanceMeters / 1000;
          debugPrint('📍 ${data['companyName']}: lat=$lat, lng=$lng, distance=${distanceKm.toStringAsFixed(1)}km, maxDist=$_maxDistance');
          if (distanceKm > _maxDistance) return false;
        } else {
          // No lat/lng - HIDE this business when distance filter is active
          debugPrint('⚠️ ${data['companyName']}: No lat/lng found - HIDING');
          return false;
        }
      }
      
      // 🆕 HIZLI FİLTRELER
      
      // İndirimler filtresi
      if (_filterDiscounts) {
        final hasDiscounts = data['hasActiveDiscounts'] as bool? ?? false;
        if (!hasDiscounts) return false;
      }
      
      // Nakit ödeme filtresi
      if (_filterCash) {
        final acceptsCash = data['acceptsCash'] as bool? ?? true; // Default true (most accept cash)
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
      
      // Tuna Onaylı filtresi
      if (_filterTunaApproved) {
        final isTunaApproved = data['isTunaApproved'] as bool? ?? false;
        if (!isTunaApproved) return false;
      }
      
      // Vejetaryen filtresi
      if (_filterVegetarian) {
        final offersVegetarian = data['offersVegetarian'] as bool? ?? false;
        if (!offersVegetarian) return false;
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
          final brandA = dataA['brand'] as String?;
          final tagsA = dataA['tags'] as List<dynamic>?;
          final hasTunaTagA = tagsA?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
          final isTunaA = (dataA['isTunaPartner'] as bool? ?? false) || 
                          (brandLabelA?.toLowerCase() == 'tuna') || 
                          (brandA?.toLowerCase() == 'tuna') || 
                          hasTunaTagA;
          
          final brandLabelB = dataB['brandLabel'] as String?;
          final brandB = dataB['brand'] as String?;
          final tagsB = dataB['tags'] as List<dynamic>?;
          final hasTunaTagB = tagsB?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
          final isTunaB = (dataB['isTunaPartner'] as bool? ?? false) || 
                          (brandLabelB?.toLowerCase() == 'tuna') || 
                          (brandB?.toLowerCase() == 'tuna') || 
                          hasTunaTagB;
          
          if (isTunaA && !isTunaB) return -1;
          if (!isTunaA && isTunaB) return 1;
          return 0;
          
        case 'az': // A-Z Isim
          final nameA = (dataA['companyName'] ?? dataA['businessName'] ?? '').toString().toLowerCase();
          final nameB = (dataB['companyName'] ?? dataB['businessName'] ?? '').toString().toLowerCase();
          return nameA.compareTo(nameB);
          
        case 'za': // Z-A Isim
          final nameA = (dataA['companyName'] ?? dataA['businessName'] ?? '').toString().toLowerCase();
          final nameB = (dataB['companyName'] ?? dataB['businessName'] ?? '').toString().toLowerCase();
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

    debugPrint('🍽️ Filtered & Sorted result: ${result.length} businesses (Sort: $_sortOption)');
    return result;
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
              clipBehavior: Clip.hardEdge, // Overflow'u kesin gizle
              expandedHeight: 220, // Genişletilmiş yükseklik
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
                      // FX: Wrap in SingleChildScrollView to prevent overflow errors when header collapses
                      child: SingleChildScrollView(
                        physics: const NeverScrollableScrollPhysics(),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Kompakt Konum Başlığı (her zaman görünür)
                            _buildCompactLocationHeader(),
                            
                            // Aşağıdaki filtreler scroll ile kaybolur
                            if (expandRatio > 0.05) ...[
                              Opacity(
                                opacity: expandRatio,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    // Delivery mode tabs
                                    _buildDeliveryModeTabs(),
                                    
                                    // Arama çubuğu (teslimat/gel al altında)
                                    _buildSearchBar(),
                                    
                                    // Distance slider - Gel-Al ve Rezervasyon modunda göster (Kurye'de gizle)
                                    if (_deliveryMode == 'gelal' || _deliveryMode == 'masa')
                                      _buildDistanceSlider()
                                    else
                                      // Kurye modunda sadece TUNA toggle göster
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
            
            // Restaurant List
            SliverPadding(
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 120),
              sliver: _buildRestaurantSliverList(),
            ),
          ],
        ),
      ),
    );
  }

  // Kompakt konum başlığı (LOKMA logo, şehir+sokak, kalp ikonu)
  Widget _buildCompactLocationHeader() {
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
                context.push('/my-info');
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.location_on, color: lokmaPink, size: 16),
                  const SizedBox(width: 4),
                  Expanded(
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
                  const SizedBox(width: 4),
                  Icon(Icons.keyboard_arrow_down, color: Colors.grey[400], size: 16),
                ],
              ),
            ),
          ),
          
          const SizedBox(width: 8),
          
          // Favoriler (kalp ikonu) - favoriler sayfasına git
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
          context.push('/search?segment=yemek');
        },
        child: Container(
          height: 48,
          padding: const EdgeInsets.only(left: 16, right: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(30),
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
              Icon(Icons.search, color: Colors.grey[600], size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Yemek, restoran veya mutfak ara...',
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
                    child: Icon(Icons.tune, color: lokmaPink, size: 20),
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
    int selectedIndex = 0;
    if (_deliveryMode == 'gelal') selectedIndex = 1;
    if (_deliveryMode == 'masa') selectedIndex = 2;

    return ThreeDimensionalPillTabBar(
      selectedIndex: selectedIndex,
      tabs: const [
        TabItem(title: 'Kurye', icon: Icons.delivery_dining),
        TabItem(title: 'Gel Al', icon: Icons.shopping_bag_outlined),
        TabItem(title: 'Masa', icon: Icons.restaurant),
      ],
      onTabSelected: (index) {
        String newMode = 'teslimat';
        if (index == 1) newMode = 'gelal';
        if (index == 2) newMode = 'masa';
        
        setState(() => _deliveryMode = newMode);
      },
    );
  }

  // Sabit km adımları: 1-10 (×1), 10-50 (×10), 50-200 (×50)
  static const List<double> _kmSteps = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,  // 1-10 km (her 1 km)
    20, 30, 40, 50,                   // 10-50 km (her 10 km)
    100, 150, 200,                    // 50-200 km (her 50 km)
  ];

  // İşletme olan km'leri hesapla (set olarak)
  Set<int> get _businessKmSet {
    if (_userLat == null || _userLng == null) return {};
    
    final kmSet = <int>{};
    for (final doc in _allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      
      // Sadece yemek sektörü işletmelerini dahil et
      if (!_hasYemekSector(data)) continue;
      
      // Koordinat al
      final lat = data['lat'] as double? ?? 
                  (data['address'] as Map<String, dynamic>?)?['lat'] as double?;
      final lng = data['lng'] as double? ?? 
                  (data['address'] as Map<String, dynamic>?)?['lng'] as double?;
      
      if (lat != null && lng != null) {
        final distanceMeters = Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
        final distanceKm = (distanceMeters / 1000).round();
        if (distanceKm >= 1 && distanceKm <= 200) {
          kmSet.add(distanceKm);
        }
      }
    }
    return kmSet;
  }

  int _currentStepIndex = 9; // Varsayılan: 10 km (index 9)
  double _lastSliderValue = 10.0;

  Widget _buildDistanceSlider() {
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
                overlayColor: lokmaPink.withOpacity(0.2),
                trackHeight: 4,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
                // Her km adımını göster - daha büyük ve görünür
                tickMarkShape: const RoundSliderTickMarkShape(tickMarkRadius: 3),
                activeTickMarkColor: Colors.white.withOpacity(0.8),
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
          // Km badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: hasBusinessAtCurrent ? lokmaPink.withOpacity(0.3) : cardBg,
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
          // TUNA pill toggle - hap şeklinde, kırmızı
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() => _onlyTuna = !_onlyTuna);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: _onlyTuna ? const Color(0xFFB71C1C) : Colors.transparent,
                borderRadius: BorderRadius.circular(20), // Pill shape
                border: Border.all(
                  color: _onlyTuna ? const Color(0xFFB71C1C) : Colors.grey.shade400,
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
                    'TUNA',
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
  
  // 🆕 TUNA toggle only (for Kurye mode - no distance slider)
  Widget _buildTunaToggleOnly() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
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
                color: _onlyTuna ? const Color(0xFFB71C1C) : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _onlyTuna ? const Color(0xFFB71C1C) : Colors.grey.shade400,
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
                    'TUNA',
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

  // Calculate dynamic chip counts based on ALL active filters
  Map<String, int> get _filteredTypeCounts {
    final typeCounts = <String, int>{};
    
    for (final doc in _allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      final businessType = _extractBusinessType(data);
      final isActive = data['isActive'] as bool? ?? true;
      
      // Skip inactive
      if (!isActive) continue;
      
      // Skip non-Yemek sector
      if (!_hasYemekSector(data)) continue;
      
      // Apply TUNA filter
      if (_onlyTuna) {
        final brandLabel = data['brandLabel'] as String?;
        final brand = data['brand'] as String?;
        final tags = data['tags'] as List<dynamic>?;
        final hasTunaTag = tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
        final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) || 
                              (brandLabel?.toLowerCase() == 'tuna') ||
                              (brand?.toLowerCase() == 'tuna') ||
                              hasTunaTag;
        if (!isTunaPartner) continue;
      }
      
      // Apply delivery mode filter
      if (_deliveryMode == 'teslimat') {
        final offersDelivery = data['offersDelivery'] as bool? ?? true;
        if (!offersDelivery) continue;
      } else if (_deliveryMode == 'gelal') {
        final offersPickup = data['offersPickup'] as bool? ?? true;
        if (!offersPickup) continue;
      } else if (_deliveryMode == 'masa') {
        final hasReservation = data['hasReservation'] as bool? ?? false;
        final tableCapacity = data['tableCapacity'] as int? ?? 0;
        if (!hasReservation && tableCapacity <= 0) continue;
      }
      
      // Apply distance filter
      if (_userLat != null && _userLng != null && _maxDistance < 200) {
        double? lat;
        double? lng;
        
        // Safe num cast for lat/lng
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
          final distanceMeters = Geolocator.distanceBetween(
            _userLat!, _userLng!, lat, lng
          );
          final distanceKm = distanceMeters / 1000;
          if (distanceKm > _maxDistance) continue;
        }
      }
      
      // Count this business type
      typeCounts[businessType] = (typeCounts[businessType] ?? 0) + 1;
    }
    
    return typeCounts;
  }
  
  Widget _buildDynamicCategoryChips() {
    // Build chips dynamically - use filtered counts that respect all active filters
    final filteredCounts = _filteredTypeCounts;
    final sortedTypes = filteredCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value)); // Sort by count descending
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            // "Tümü" chip
            _buildFilterChip(
              label: 'Tümü',
              isSelected: _categoryFilter == 'all',
              onTap: () => setState(() => _categoryFilter = 'all'),
            ),
            
            // Dynamic chips based on actual businessTypes
            ...sortedTypes.map((entry) {
              final typeKey = entry.key;
              final count = entry.value;
              final label = BUSINESS_TYPE_LABELS[typeKey] ?? typeKey;
              
              return _buildFilterChip(
                label: '$label ($count)',
                isSelected: _categoryFilter == typeKey,
                onTap: () => setState(() => _categoryFilter = typeKey),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isSelected,
    Color? color,
    required VoidCallback onTap,
  }) {
    final chipColor = color ?? lokmaPink;
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        margin: const EdgeInsets.only(right: 8),
        decoration: BoxDecoration(
          color: isSelected ? chipColor : cardBg,
          borderRadius: BorderRadius.circular(20),
          border: isSelected ? null : Border.all(color: Colors.grey.shade400),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.grey[700],
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  // SliverList versiyonu - CustomScrollView için
  Widget _buildRestaurantSliverList() {
    if (_isLoading) {
      return const SliverFillRemaining(
        child: Center(
          child: CircularProgressIndicator(color: lokmaPink),
        ),
      );
    }

    final restaurants = _filteredBusinesses;

    if (restaurants.isEmpty) {
      return SliverFillRemaining(
        child: _buildEmptyState(),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          // İlk item: Count header
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                '${restaurants.length} işletme hizmetinizde',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            );
          }
          
          // Restaurant cards (index-1 because first is header)
          final restaurantIndex = index - 1;
          final doc = restaurants[restaurantIndex];
          final data = doc.data() as Map<String, dynamic>;
          return _buildRestaurantCard(doc.id, data);
        },
        childCount: restaurants.length + 1, // +1 for header
      ),
    );
  }

  Widget _buildRestaurantList() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: lokmaPink),
      );
    }

    final restaurants = _filteredBusinesses;

    if (restaurants.isEmpty) {
      return _buildEmptyState();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Count header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Text(
            '${restaurants.length} işletme hizmetinizde',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        
        // Restaurant list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.only(left: 16, right: 16, bottom: 180),
            itemCount: restaurants.length,
            itemBuilder: (context, index) {
              final doc = restaurants[index];
              final data = doc.data() as Map<String, dynamic>;
              return _buildRestaurantCard(doc.id, data);
            },
          ),
        ),
      ],
    );
  }

  /// 🆕 Check if business is available for the currently selected mode
  /// Returns tuple: (isAvailable, unavailableReason, startTime)
  ({bool isAvailable, String? reason, String? startTime, String? deliveryTime, String? pickupTime}) _checkAvailabilityForMode(
    Map<String, dynamic> data, 
    String mode,
  ) {
    final now = DateTime.now();
    final currentHour = now.hour;
    final currentMinute = now.minute;
    
    final deliveryStartTime = data['deliveryStartTime'] as String?;
    final pickupStartTime = data['pickupStartTime'] as String?;
    
    // Check if current time is before delivery start
    bool deliveryUnavailable = false;
    if (deliveryStartTime != null && deliveryStartTime.isNotEmpty) {
      final parsed = _parseTimeString(deliveryStartTime);
      if (parsed != null) {
        if (currentHour < parsed.$1 || (currentHour == parsed.$1 && currentMinute < parsed.$2)) {
          deliveryUnavailable = true;
        }
      }
    }
    
    // Check if current time is before pickup start
    bool pickupUnavailable = false;
    if (pickupStartTime != null && pickupStartTime.isNotEmpty) {
      final parsed = _parseTimeString(pickupStartTime);
      if (parsed != null) {
        if (currentHour < parsed.$1 || (currentHour == parsed.$1 && currentMinute < parsed.$2)) {
          pickupUnavailable = true;
        }
      }
    }
    
    // Check temporary pause for delivery mode
    final temporaryDeliveryPaused = data['temporaryDeliveryPaused'] as bool? ?? false;
    
    if (mode == 'teslimat') {
      if (temporaryDeliveryPaused) {
        return (isAvailable: false, reason: 'Kurye şu an hizmet vermiyor', startTime: null, deliveryTime: deliveryStartTime, pickupTime: pickupStartTime);
      }
      if (deliveryUnavailable) {
        return (isAvailable: false, reason: 'Teslimat $deliveryStartTime\'ten sonra', startTime: deliveryStartTime, deliveryTime: deliveryStartTime, pickupTime: pickupStartTime);
      }
      return (isAvailable: true, reason: null, startTime: null, deliveryTime: deliveryStartTime, pickupTime: pickupStartTime);
      
    } else if (mode == 'gelal') {
      if (pickupUnavailable) {
        return (isAvailable: false, reason: 'Gel Al $pickupStartTime\'dan', startTime: pickupStartTime, deliveryTime: deliveryStartTime, pickupTime: pickupStartTime);
      }
      return (isAvailable: true, reason: null, startTime: null, deliveryTime: deliveryStartTime, pickupTime: pickupStartTime);
    }
    
    return (isAvailable: true, reason: null, startTime: null, deliveryTime: deliveryStartTime, pickupTime: pickupStartTime);
  }
  
  /// Parse time string like "11:00" into (hour, minute)
  (int, int)? _parseTimeString(String timeStr) {
    final regex = RegExp(r'(\d{1,2}):(\d{2})');
    final match = regex.firstMatch(timeStr);
    if (match != null) {
      return (int.parse(match.group(1)!), int.parse(match.group(2)!));
    }
    return null;
  }
  
  /// 🆕 Show dialog for closed/unavailable business
  void _showClosedBusinessDialog(BuildContext context, String businessName, String? reason) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.schedule, color: Colors.orange, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                businessName,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (reason != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.orange.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.access_time, color: Colors.orange, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        reason,
                        style: const TextStyle(fontWeight: FontWeight.w500, color: Colors.orange),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            const Text(
              'Şu an kapalı, ama yine de menüye göz atabilirsiniz.',
              style: TextStyle(fontSize: 15),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Kapat'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              // Navigate to business detail
              final businessId = _currentBusinessIdForDialog;
              if (businessId != null) {
                context.push('/business/$businessId?mode=$_deliveryMode');
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: lokmaPink,
              foregroundColor: Colors.white,
            ),
            child: const Text('Menüyü Gör'),
          ),
        ],
      ),
    );
  }
  
  String? _currentBusinessIdForDialog;

  /// Lieferando-style restaurant card with large image
  Widget _buildRestaurantCard(String id, Map<String, dynamic> data) {
    final name = data['businessName'] ?? data['companyName'] ?? 'İsimsiz';
    final businessType = data['businessType'] as String? ?? '';
    final brandLabel = data['brandLabel'] as String?;
    final brand = data['brand'] as String?;
    final tags = data['tags'] as List<dynamic>?;
    final hasTunaTag = tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
    final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) || 
                          (brandLabel?.toLowerCase() == 'tuna') || 
                          (brand?.toLowerCase() == 'tuna') || 
                          hasTunaTag;
    
    // 🆕 Availability check based on current mode
    final availability = _checkAvailabilityForMode(data, _deliveryMode);
    final isAvailable = availability.isAvailable;
    final unavailableReason = availability.reason;
    
    final rating = (data['rating'] as num?)?.toDouble() ?? 4.0;
    final reviewCount = (data['reviewCount'] as num?)?.toInt() ?? 0;
    final imageUrl = data['imageUrl'] as String?;
    final logoUrl = data['logoUrl'] as String?;
    final cuisineType = data['cuisineType'] as String?;
    
    // Business type label
    final typeLabel = BUSINESS_TYPE_LABELS[businessType] ?? businessType;
    
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
        if (!isAvailable) {
          // Store business ID for dialog navigation
          _currentBusinessIdForDialog = id;
          _showClosedBusinessDialog(context, name, unavailableReason);
        } else {
          context.push('/business/$id?mode=$_deliveryMode');
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Main card content
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Large image with overlays
                Stack(
                  children: [
                    // Main image - Lieferando style (230px fixed height)
                    // 🆕 Apply ColorFiltered for grayscale when unavailable
                    ColorFiltered(
                      colorFilter: isAvailable 
                          ? const ColorFilter.mode(Colors.transparent, BlendMode.multiply)
                          : const ColorFilter.matrix(<double>[
                              0.2126, 0.7152, 0.0722, 0, 0,
                              0.2126, 0.7152, 0.0722, 0, 0,
                              0.2126, 0.7152, 0.0722, 0, 0,
                              0,      0,      0,      1, 0,
                            ]),
                      child: SizedBox(
                        height: 230,
                        width: double.infinity,
                        child: imageUrl != null && imageUrl.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: imageUrl,
                                fit: BoxFit.cover,
                                placeholder: (context, url) => Container(
                                  color: Colors.grey[200],
                                  child: const Center(
                                    child: SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: lokmaPink,
                                      ),
                                    ),
                                  ),
                                ),
                                errorWidget: (context, url, error) => Container(
                                  color: Colors.grey[200],
                                  child: const Center(
                                    child: Icon(Icons.restaurant, color: lokmaPink, size: 48),
                                  ),
                                ),
                              )
                            : Container(
                                color: Colors.grey[200],
                                child: const Center(
                                  child: Icon(Icons.restaurant, color: lokmaPink, size: 48),
                                ),
                              ),
                      ),
                    ),
                    
                    // 🆕 Dark overlay for unavailable businesses
                    if (!isAvailable)
                      Positioned.fill(
                        child: Container(
                          color: Colors.black.withOpacity(0.35),
                        ),
                      ),
                    
                    // 🆕 Business logo (BOTTOM LEFT - Lieferando style)
                    if (logoUrl != null && logoUrl.isNotEmpty)
                      Positioned(
                        left: 12,
                        bottom: 12,
                        child: Opacity(
                          opacity: isAvailable ? 1.0 : 0.7,
                          child: Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.2),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: CachedNetworkImage(
                                imageUrl: logoUrl,
                                fit: BoxFit.cover,
                                errorWidget: (_, __, ___) => const Center(
                                  child: Icon(Icons.store, color: lokmaPink, size: 24),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    
                    // 🆕 TUNA brand badge (TOP LEFT - four-corner quadrant system)
                    if (isTunaPartner)
                      Positioned(
                        left: 12,
                        top: 12,
                        child: Opacity(
                          opacity: isAvailable ? 1.0 : 0.7,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFB71C1C), // TUNA red
                              borderRadius: BorderRadius.circular(16), // Pill shape
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.3),
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
                      ),
                    
                    // 🆕 Favorite button (TOP RIGHT - fixed position)
                    Positioned(
                      top: 12,
                      right: 12,
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          ref.read(butcherFavoritesProvider.notifier).toggleFavorite(id);
                        },
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.5),
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
                    
                    
                    // 🆕 Cart badge (BOTTOM RIGHT) - only when available
                    if (isAvailable)
                      Builder(
                        builder: (context) {
                          final cartState = ref.watch(cartProvider);
                          if (cartState.butcherId == id && cartState.items.isNotEmpty) {
                            return Positioned(
                              right: 12,
                              bottom: 12,
                              child: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.2),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    Icon(
                                      Icons.shopping_cart_outlined,
                                      color: Theme.of(context).colorScheme.primary,
                                      size: 24,
                                    ),
                                    Positioned(
                                      right: -8,
                                      top: -8,
                                      child: Container(
                                        padding: const EdgeInsets.all(4),
                                        decoration: BoxDecoration(
                                          color: Theme.of(context).colorScheme.primary,
                                          shape: BoxShape.circle,
                                        ),
                                        constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                                        child: Center(
                                          child: Text(
                                            '${cartState.items.length}',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
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
                          return const SizedBox.shrink();
                        },
                      ),
                  ],
                ),
                
                // Info section (below image) - Fixed height for consistent cards
                // 🆕 Reduced opacity for unavailable businesses
                Opacity(
                  opacity: isAvailable ? 1.0 : 0.6,
                  child: Container(
                    height: 114, // Fixed height for consistent card sizes
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Business name
                        Text(
                          name,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        
                        // Rating + Type (Lieferando style: ★ 4.5 (200+) · Türkisch, Döner)
                        Row(
                          children: [
                            const Icon(Icons.star, color: Colors.amber, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              rating.toStringAsFixed(1),
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (reviewText.isNotEmpty) ...[
                              const SizedBox(width: 2),
                              Text(
                                reviewText,
                                style: TextStyle(
                                  color: Colors.grey[700],
                                  fontSize: 14,
                                ),
                              ),
                            ],
                            Expanded(
                              child: Text(
                                ' · ${cuisineType != null && cuisineType.isNotEmpty ? cuisineType : typeLabel}',
                                style: TextStyle(
                                  color: Colors.grey[700],
                                  fontSize: 14,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        
                        // 🆕 Lieferando-style info row - changes based on mode
                        const SizedBox(height: 4),
                        Builder(
                          builder: (context) {
                            // Read business delivery settings
                            final prepTimeMin = (data['prepTimeMin'] as num?)?.toInt() ?? 15;
                            final prepTimeMax = (data['prepTimeMax'] as num?)?.toInt() ?? 30;
                            final deliveryFee = (data['deliveryFee'] as num?)?.toDouble() ?? 0.0;
                            final minOrderAmount = (data['minOrderAmount'] as num?)?.toDouble() ?? 10.0;
                            final freeDeliveryThreshold = (data['freeDeliveryThreshold'] as num?)?.toDouble();
                            
                            if (_deliveryMode == 'teslimat') {
                              // DELIVERY MODE: Show prep time + delivery fee + min order
                              // Calculate estimated delivery time = prep time + travel time (3 min/km)
                              double travelTimeMin = 0;
                              if (distanceText.isNotEmpty) {
                                final kmMatch = RegExp(r'([\d.]+)').firstMatch(distanceText);
                                if (kmMatch != null) {
                                  final km = double.tryParse(kmMatch.group(1) ?? '0') ?? 0;
                                  travelTimeMin = km * 3; // ~3 min per km
                                }
                              }
                              final totalMin = prepTimeMin + travelTimeMin.round();
                              final totalMax = prepTimeMax + travelTimeMin.round() + 5;
                              
                              final hasDeliveryFee = deliveryFee > 0;
                              final hasMinOrder = minOrderAmount > 0;
                              final hasFreeDelivery = freeDeliveryThreshold != null && freeDeliveryThreshold > 0;
                              
                              return Row(
                                children: [
                                  // Delivery time
                                  Icon(Icons.access_time, color: Colors.grey[600], size: 14),
                                  const SizedBox(width: 4),
                                  Text(
                                    '$totalMin-$totalMax dk',
                                    style: TextStyle(
                                      color: Colors.grey[700],
                                      fontSize: 13,
                                    ),
                                  ),
                                  
                                  // Delivery fee
                                  if (hasDeliveryFee || hasFreeDelivery) ...[
                                    Text(' · ', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                    Icon(Icons.delivery_dining, color: Colors.grey[600], size: 14),
                                    const SizedBox(width: 4),
                                    if (hasFreeDelivery)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF2E7D32).withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          deliveryFee > 0 ? '${deliveryFee.toStringAsFixed(2).replaceAll('.', ',')}€' : 'Ücretsiz',
                                          style: TextStyle(
                                            color: deliveryFee > 0 ? Colors.grey[700] : const Color(0xFF2E7D32),
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      )
                                    else
                                      Text(
                                        '${deliveryFee.toStringAsFixed(2).replaceAll('.', ',')}€',
                                        style: TextStyle(
                                          color: Colors.grey[700],
                                          fontSize: 13,
                                        ),
                                      ),
                                  ],
                                  
                                  // Min order
                                  if (hasMinOrder) ...[
                                    Text(' · ', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                    Icon(Icons.shopping_basket_outlined, color: Colors.grey[600], size: 14),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Min. ${minOrderAmount.toStringAsFixed(0)}€',
                                      style: TextStyle(
                                        color: Colors.grey[700],
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ],
                              );
                            } else {
                              // PICKUP MODE: Just show distance (Lieferando style)
                              return Row(
                                children: [
                                  Icon(Icons.location_on_outlined, color: Colors.grey[600], size: 14),
                                  const SizedBox(width: 4),
                                  Text(
                                    distanceText.isNotEmpty ? distanceText : '—',
                                    style: TextStyle(
                                      color: Colors.grey[700],
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              );
                            }
                          },
                        ),

                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.store_outlined, color: Colors.grey[500], size: 64),
          const SizedBox(height: 16),
          Text(
            _categoryFilter != 'all'
                ? 'Bu kategoride işletme bulunamadı'
                : 'Yakınızda işletme bulunamadı',
            style: TextStyle(color: Colors.grey[700], fontSize: 16),
          ),
          if (_categoryFilter != 'all' || _onlyTuna)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: TextButton(
                onPressed: () {
                  setState(() {
                    _categoryFilter = 'all';
                    _onlyTuna = false;
                  });
                },
                child: const Text(
                  'Filtreleri Temizle',
                  style: TextStyle(color: lokmaPink),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showFilterBottomSheet() {
    showModalBottomSheet(
      context: context,
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
                          child: Text(
                            'İptal',
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7), fontSize: 15),
                          ),
                        ),
                        // Results Count
                        Text(
                          'Filtrele',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 17,
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
                              _filterTunaApproved = false;
                              _filterVegetarian = false;
                            });
                            setStateSheet(() {});
                          },
                          child: Text(
                            'Sıfırla',
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7), fontSize: 15),
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  Divider(color: Theme.of(context).dividerColor, height: 1),
                  
                  // Scrollable Content
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 20),
                          
                          // Sıralama Section Header
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              'Sıralama',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          
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
                          
                          const SizedBox(height: 24),
                          
                          // İşletme Türü Section Header (2. Bölüm)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              'İşletme Türü',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          
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
                            final label = BUSINESS_TYPE_LABELS[typeKey] ?? typeKey;
                            
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
                          
                          const SizedBox(height: 24),
                          
                          // 🆕 Hızlı Filtreler Section Header (3. Bölüm)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              'Hızlı Filtreler',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
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
                            title: 'Tuna Onaylı',
                            subtitle: 'Tuna tarafından onaylı işletmeler',
                            isSelected: _filterTunaApproved,
                            onTap: () {
                              setState(() => _filterTunaApproved = !_filterTunaApproved);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Vejetaryen',
                            subtitle: 'Vejetaryen menü sunan işletmeler',
                            isSelected: _filterVegetarian,
                            onTap: () {
                              setState(() => _filterVegetarian = !_filterVegetarian);
                              setStateSheet(() {});
                            },
                          ),
                          
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
                          color: Colors.black.withOpacity(0.3),
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
    return Builder(
      builder: (context) {
        final textColor = Theme.of(context).colorScheme.onSurface;
        final subtitleColor = Theme.of(context).colorScheme.onSurface.withOpacity(0.5);
        
        return InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
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
                            style: TextStyle(
                              color: textColor,
                              fontSize: 15,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                          if (isPremium) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: tunaGreen.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'Önerilen',
                                style: TextStyle(color: tunaGreen, fontSize: 10),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          color: subtitleColor,
                          fontSize: 12,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                ),
                // Round Checkbox
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: isSelected ? lokmaPink : Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? lokmaPink : subtitleColor,
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
      },
    );
  }

  Widget _buildSortOption(String label, String value, IconData icon, StateSetter setStateSheet, {bool isPremium = false}) {
    final isSelected = _sortOption == value;
    
    return InkWell(
      onTap: () {
        setState(() => _sortOption = value);
        setStateSheet(() {}); // Update sheet UI
        Navigator.pop(context); // Close sheet
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Icon(
              icon,
              color: isSelected ? lokmaPink : Colors.grey[600],
              size: 24,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.grey[400],
                  fontSize: 16,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            if (isPremium) ...[
               Container(
                 padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                 decoration: BoxDecoration(
                   color: tunaGreen.withOpacity(0.2),
                   borderRadius: BorderRadius.circular(4),
                   border: Border.all(color: tunaGreen.withOpacity(0.5)),
                 ),
                 child: const Text('Önerilen', style: TextStyle(color: tunaGreen, fontSize: 10)),
               ),
               const SizedBox(width: 12),
            ],
            if (isSelected)
              const Icon(Icons.check, color: lokmaPink, size: 20),
          ],
        ),
      ),
    );
  }
}
