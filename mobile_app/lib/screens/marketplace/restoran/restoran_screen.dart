import 'dart:async';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../kasap/reservation_booking_screen.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:lokma_app/services/table_group_service.dart';
import 'package:lokma_app/providers/table_group_provider.dart';
import 'package:lokma_app/providers/bottom_nav_provider.dart';
import 'package:lokma_app/screens/customer/group_table_order_screen.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:lokma_app/widgets/address_selection_sheet.dart';
import 'package:lokma_app/widgets/open_partners_map_sheet.dart';
import '../../../utils/currency_utils.dart';
import '../../../providers/search_provider.dart';
import 'package:lokma_app/widgets/group_order_setup_sheet.dart';
import 'package:lokma_app/widgets/marketplace_group_share_sheet.dart';
import 'package:lokma_app/models/table_group_session_model.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Business type labels for display
/// Business type keys for i18n lookup
const List<String> BUSINESS_TYPE_KEYS = [
  'kasap', 'market', 'restoran', 'fastfood', 'pastane', 'cicekci',
  'cigkofte', 'cafe', 'catering', 'firin', 'kermes', 'aktar',
  'icecek', 'kozmetik', 'sarkuteri', 'petshop', 'tursu', 'balik',
  'kuruyemis', 'ciftci',
];

/// Get localized business type label
String getBusinessTypeLabel(String typeKey) {
  if (typeKey.isEmpty || typeKey == 'other') return '';
  final key = 'marketplace.business_type_$typeKey';
  final translated = tr(key);
  // If translation returns the key itself, it means no translation was found
  if (translated == key) return '';
  return translated;
}

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
  static const Color lokmaPink = Color(0xFFFB335B); // Rose-500 brand color
  static const Color tunaGreen = Color(0xFF4CAF50);

  // Dynamic card background getter for theme-aware colors
  Color get cardBg => Theme.of(context).cardTheme.color ?? Colors.white;

  // Delivery mode
  String _deliveryMode = 'teslimat'; // Varsayılan: Kurye

  // QR scan state for Masa mode
  String? _scannedTableNumber;
  String? _scannedBusinessId; // ignore: unused_field
  String? _scannedBusinessName;

  // Category filter - 'all' or specific businessType
  String _categoryFilter = 'all';

  // TUNA filter
  bool _onlyTuna = false;

  // Location
  final String _userAddress = 'marketplace.getting_location'.tr(); // ignore: unused_field
  bool _isLoadingLocation = true; // ignore: unused_field
  double? _userLat;
  double? _userLng;

  // Distance slider (km) - Yemek için dinamik işletme mesafeleri
  double _maxDistance = 10.0;
  bool _sliderAutoSet = false; // Auto-snap slider to nearest business once

  // Dynamic categories from Firestore
  Map<String, int> _businessTypeCounts = {}; // ignore: unused_field
  List<DocumentSnapshot> _allBusinesses = [];
  bool _isLoading = true;

  // Dynamic sector types from Firestore 'sectors' collection
  Set<String> _yemekSectorTypes = {};

  // 🆕 Canlı Firestore stream subscription
  StreamSubscription<QuerySnapshot>? _businessesSubscription;

  // Sorting option
  String _sortOption = 'nearest'; // nearest, rating, tuna, az, za

  // 🆕 Hızlı Filtreler (Lieferando tarzı)
  bool _filterDiscounts = false; // İndirimli ürünler
  bool _filterCash = false; // Nakit ödeme kabul
  bool _filterFreeDelivery = false; // Ücretsiz teslimat

  // 🆕 Active Session UI
  String? _activeSessionId;
  bool _filterMealCards = false; // Yemek kartı kabul
  bool _filterHighRating = false; // 4+ yıldız
  bool _filterOpenNow = false; // Şimdi açık
  bool _filterTunaApproved = false; // Tuna Onaylı
  bool _filterVegetarian = false; // Vejetaryen

  @override
  void initState() {
    super.initState();
    // Location now comes from cached userLocationProvider - no API call here!
    _loadSectorsAndBusinesses();
    _checkActiveSession();
  }

  Future<void> _checkActiveSession() async {
    // Need a short delay to ensure provider is ready if it's called too early
    await Future.delayed(const Duration(milliseconds: 100));
    if (!mounted) return;
    final sessionId =
        await ref.read(tableGroupProvider.notifier).checkCachedSession();
    if (mounted && sessionId != null) {
      setState(() {
        _activeSessionId = sessionId;
      });
    }
  }

  Future<void> _loadSectorsAndBusinesses() async {
    // First load sectors to know which types are Yemek
    try {
      final sectorsSnapshot = await FirebaseFirestore.instance
          .collection('sectors')
          .where('category', isEqualTo: 'yemek')
          .where('isActive', isEqualTo: true)
          .get();

      _yemekSectorTypes =
          sectorsSnapshot.docs.map((doc) => doc.id.toLowerCase()).toSet();

      debugPrint('🍽️ Yemek sector types: $_yemekSectorTypes');
    } catch (e) {
      debugPrint('❌ Error loading sectors: $e');
      // Fallback to hardcoded list
      _yemekSectorTypes = {
        'restoran',
        'pastane',
        'cigkofte',
        'firin',
        'catering',
        'kermes',
        'cafe'
      };
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
      debugPrint(
          '📊 Live update: ${snapshot.docs.length} businesses from Firestore');

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
        // 🚀 PERFORMANCE: Pre-seed search provider with loaded businesses
        // This eliminates the need for search to fetch from Firestore separately
        ref.read(searchProvider.notifier).seedBusinessData(snapshot.docs);
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

  Timer? _masaIdleTimer;

  void _setScannedTable(String? tableNum, String? bId, String? bName) {
    setState(() {
      _scannedTableNumber = tableNum;
      _scannedBusinessId = bId;
      _scannedBusinessName = bName;
    });

    _masaIdleTimer?.cancel();

    if (tableNum != null) {
      _masaIdleTimer = Timer(const Duration(minutes: 15), () {
        if (!mounted) return;

        setState(() {
          _scannedTableNumber = null;
          _scannedBusinessId = null;
          _scannedBusinessName = null;
        });

        ref.read(cartProvider.notifier).clearCart();

        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                const SizedBox(width: 8),
                Text('marketplace.session_timeout_warning'.tr()),
              ],
            ),
            content: const Text(
                '15 dakikadır siparişinizi tamamlamadınız. Masanın başka müşterilere açılabilmesi için masa numaranız sıfırlanmıştır.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text('common.ok'.tr()),
              ),
            ],
          ),
        );
      });
    }
  }

  @override
  void dispose() {
    _masaIdleTimer?.cancel();
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
    final hasMatch =
        businessSectorIds.intersection(_yemekSectorTypes).isNotEmpty;

    if (hasMatch) {
      debugPrint(
          '✅ Yemek sector: ${data['companyName']} has ${businessSectorIds.intersection(_yemekSectorTypes)}');
    } else {
      debugPrint(
          '❌ Not Yemek: ${data['companyName']} has $businessSectorIds, need $_yemekSectorTypes');
    }

    return hasMatch;
  }

  // Check if business is currently open based on openingHours, deliveryHours, and pickupHours
  bool _isBusinessOpenNow(Map<String, dynamic> data) {
    final now = DateTime.now();
    
    // 1. Check general openingHours first
    final openingHoursData = data['openingHours'];
    if (openingHoursData != null) {
      final openingHelper = OpeningHoursHelper(openingHoursData);
      if (openingHelper.isOpenAt(now)) return true;
    }
    
    // 2. Fallback: Check deliveryHours (Kurier-Öffnungszeiten)
    //    These are stored as List<String> arrays like ["Montag: 11:30 - 22:00", ...]
    final deliveryHoursData = data['deliveryHours'];
    if (deliveryHoursData != null) {
      final deliveryHelper = OpeningHoursHelper(deliveryHoursData);
      if (deliveryHelper.isOpenAt(now)) return true;
    }
    
    // 3. Fallback: Check pickupHours (Abhol-Öffnungszeiten)
    final pickupHoursData = data['pickupHours'];
    if (pickupHoursData != null) {
      final pickupHelper = OpeningHoursHelper(pickupHoursData);
      if (pickupHelper.isOpenAt(now)) return true;
    }
    
    // 4. If no hours data exists at all, default to open (avoid blocking sales)
    if (openingHoursData == null && deliveryHoursData == null && pickupHoursData == null) {
      return true;
    }
    
    return false;
  }

  // Filter businesses based on current filters
  List<DocumentSnapshot> get _filteredBusinesses {
    debugPrint(
        '🔍 Filtering: deliveryMode=$_deliveryMode, categoryFilter=$_categoryFilter, onlyTuna=$_onlyTuna, maxDistance=$_maxDistance');
    debugPrint('🔍 User location: lat=$_userLat, lng=$_userLng');
    debugPrint('🔍 Total businesses before filter: ${_allBusinesses.length}');

    final filtered = _allBusinesses.where((doc) {
      final data = doc.data() as Map<String, dynamic>;
      final businessType = _extractBusinessType(data);
      final isActive = data['isActive'] as bool? ?? true;
      // TUNA Partner check - check multiple possible field names
      final brandLabel = data['brandLabel'] as String?;
      final brand = data['brand']
          as String?; // Some records use 'brand' instead of 'brandLabel'
      final tags = data['tags'] as List<dynamic>?;
      final hasTunaTag =
          tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
      final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) ||
          (brandLabel?.toLowerCase() == 'tuna') ||
          (brand?.toLowerCase() == 'tuna') ||
          hasTunaTag;

      // Skip inactive
      if (!isActive) return false;

      // DEBUG: Log each business
      debugPrint(
          '📋 Business: ${data['companyName']} | type: $businessType | tuna: $isTunaPartner');

      // SECTOR FILTER: Only show businesses in Yemek sector (ID-based matching)
      if (!_hasYemekSector(data)) return false;

      // TUNA filter
      if (_onlyTuna && !isTunaPartner) return false;

      // Delivery mode filter
      if (_deliveryMode == 'teslimat') {
        final offersDelivery = data['offersDelivery'] as bool? ??
            true; // Default to true if missing
        if (!offersDelivery) return false;
      } else if (_deliveryMode == 'gelal') {
        final offersPickup =
            data['offersPickup'] as bool? ?? true; // Default to true if missing
        if (!offersPickup) return false;
      } else if (_deliveryMode == 'masa') {
        // Masa mode: show businesses with reservation OR dine-in features
        final hasReservation = data['hasReservation'] as bool? ?? false;
        final tableCapacity = data['tableCapacity'] as int? ?? 0;
        final hasDineInQR = data['hasDineInQR'] as bool? ?? false;
        final hasWaiterOrder = data['hasWaiterOrder'] as bool? ?? false;
        if (!hasReservation &&
            tableCapacity <= 0 &&
            !hasDineInQR &&
            !hasWaiterOrder) {
          return false;
        }
      }

      // Category filter
      if (_categoryFilter != 'all' &&
          businessType != _categoryFilter.toLowerCase()) {
        return false;
      }

      // Distance filter
      if (_userLat != null && _userLng != null) {
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
            if (placeDetails['lat'] is num) {
              lat = (placeDetails['lat'] as num).toDouble();
            }
            if (placeDetails['lng'] is num) {
              lng = (placeDetails['lng'] as num).toDouble();
            }
          }
        }

        if (lat != null && lng != null) {
          final distanceMeters =
              Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
          final distanceKm = distanceMeters / 1000;
          
          if (_deliveryMode == 'teslimat') {
            final double deliveryRadius =
                (data['deliveryRadius'] as num?)?.toDouble() ?? 5.0;
            if (distanceKm > deliveryRadius) {
              debugPrint(
                  '🛑 ${data['companyName']} out of delivery radius: ${distanceKm.toStringAsFixed(1)}km > ${deliveryRadius}km');
              return false;
            }
          } else {
            if (_maxDistance < 200 && distanceKm > _maxDistance) return false;
          }
        } else {
          // No lat/lng - HIDE this business when distance filter is active
          if (_deliveryMode == 'teslimat' || _maxDistance < 200) {
            debugPrint('⚠️ ${data['companyName']}: No lat/lng found - HIDING');
            return false;
          }
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
        final acceptsCash = data['acceptsCash'] as bool? ??
            true; // Default true (most accept cash)
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
          final hasTunaTagA =
              tagsA?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
          final isTunaA = (dataA['isTunaPartner'] as bool? ?? false) ||
              (brandLabelA?.toLowerCase() == 'tuna') ||
              (brandA?.toLowerCase() == 'tuna') ||
              hasTunaTagA;

          final brandLabelB = dataB['brandLabel'] as String?;
          final brandB = dataB['brand'] as String?;
          final tagsB = dataB['tags'] as List<dynamic>?;
          final hasTunaTagB =
              tagsB?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
          final isTunaB = (dataB['isTunaPartner'] as bool? ?? false) ||
              (brandLabelB?.toLowerCase() == 'tuna') ||
              (brandB?.toLowerCase() == 'tuna') ||
              hasTunaTagB;

          if (isTunaA && !isTunaB) return -1;
          if (!isTunaA && isTunaB) return 1;
          return 0;

        case 'az': // A-Z Isim
          final nameA = (dataA['companyName'] ?? dataA['businessName'] ?? '')
              .toString()
              .toLowerCase();
          final nameB = (dataB['companyName'] ?? dataB['businessName'] ?? '')
              .toString()
              .toLowerCase();
          return nameA.compareTo(nameB);

        case 'za': // Z-A Isim
          final nameA = (dataA['companyName'] ?? dataA['businessName'] ?? '')
              .toString()
              .toLowerCase();
          final nameB = (dataB['companyName'] ?? dataB['businessName'] ?? '')
              .toString()
              .toLowerCase();
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
              if (addr != null && addr['lat'] is num) {
                latA = (addr['lat'] as num).toDouble();
              }
              if (addr != null && addr['lng'] is num) {
                lngA = (addr['lng'] as num).toDouble();
              }
            }

            // Get coordinates B
            if (dataB['lat'] is num) latB = (dataB['lat'] as num).toDouble();
            if (dataB['lng'] is num) lngB = (dataB['lng'] as num).toDouble();
            if (latB == null || lngB == null) {
              final addr = dataB['address'] as Map<String, dynamic>?;
              if (addr != null && addr['lat'] is num) {
                latB = (addr['lat'] as num).toDouble();
              }
              if (addr != null && addr['lng'] is num) {
                lngB = (addr['lng'] as num).toDouble();
              }
            }

            if (latA == null || lngA == null) return 1;
            if (latB == null || lngB == null) return -1;

            final distA =
                Geolocator.distanceBetween(_userLat!, _userLng!, latA, lngA);
            final distB =
                Geolocator.distanceBetween(_userLat!, _userLng!, latB, lngB);
            return distA.compareTo(distB);
          }
          return 0;
      }
    });

    debugPrint(
        '🍽️ Filtered & Sorted result: ${result.length} businesses (Sort: $_sortOption)');
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
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              pinned: true,
              floating: false,
              clipBehavior: Clip.hardEdge,
              expandedHeight: (_deliveryMode == 'gelal' || _deliveryMode == 'masa') ? 210 : 175,
              collapsedHeight:
                  120,
              automaticallyImplyLeading: false,
              flexibleSpace: LayoutBuilder(
                builder: (context, constraints) {
                  final expandedHeight = (_deliveryMode == 'gelal' || _deliveryMode == 'masa') ? 210.0 : 175.0;
                  final collapsedHeight = 120.0;
                  final currentHeight = constraints.maxHeight;
                  final expandRatio = ((currentHeight - collapsedHeight) /
                          (expandedHeight - collapsedHeight))
                      .clamp(0.0, 1.0);

                  return ClipRect(
                    child: Container(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      child: SingleChildScrollView(
                        physics: const NeverScrollableScrollPhysics(),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Location header (her zaman görünür)
                            _buildCompactLocationHeader(),

                            // Scroll ile kaybolan elementler
                            if (expandRatio > 0.05) ...[
                              Opacity(
                                opacity: expandRatio,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    // Delivery mode tabs
                                    _buildDeliveryModeTabs(),

                                    // Arama Çubuğu
                                    _buildSearchBar(),

                                    // Mesafe aralığını Gel Al ve Masa modlarında göster
                                    if (_deliveryMode == 'gelal' ||
                                        _deliveryMode == 'masa')
                                      _buildDistanceSlider(),
                                  ],
                                ),
                              ),
                            ] else ...[
                              // Collapsed state: sadece arama çubuğu görünür, mesafe ve tabs gizli
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

            // 🆕 Masa Hero Header (QR Okut vs) if in masa mode
            if (_deliveryMode == 'masa')
              if (_scannedTableNumber == null) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 8.0, bottom: 8.0),
                    child: _buildMasaHeroHeader(),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                    child: Text(
                      tr('home.table_reservation'),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? Colors.white
                            : Colors.black87,
                        letterSpacing: -0.3,
                      ),
                    ),
                  ),
                ),
              ] else ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 8.0, bottom: 8.0),
                    child: _buildScannedTableBanner(),
                  ),
                ),
              ],

            // "Bei X Partnern bestellen" header — Lieferando style
            if (!_isLoading && _filteredBusinesses.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 2, 20, 8),
                  child: Text(
                    _deliveryMode == 'masa' 
                        ? tr('marketplace.reserve_table_at_partners', namedArgs: {'count': '${_filteredBusinesses.length}'})
                        : tr('marketplace.order_at_partners', namedArgs: {'count': '${_filteredBusinesses.length}'}),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                      letterSpacing: -0.2,
                    ),
                  ),
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

    String cityName = 'marketplace.getting_location'.tr();
    String streetInfo = '';
    bool isLoading = true;

    locationAsync.when(
      data: (location) {
        isLoading = false;
        if (location.isValid) {
          cityName =
              location.city.isNotEmpty ? location.city : location.address;
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
          cityName = location.address.isNotEmpty
              ? location.address
              : 'marketplace.location_permission_denied'.tr();
        }
      },
      loading: () {
        isLoading = true;
        cityName = 'marketplace.getting_location'.tr();
      },
      error: (e, st) {
        isLoading = false;
        cityName = 'marketplace.location_failed'.tr();
      },
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 2),
      child: Row(
        children: [

          // Location info — compact pill shape
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                HapticFeedback.lightImpact();
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (context) => AddressSelectionSheet(),
                );
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.location_on, color: lokmaPink, size: 14),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          isLoading ? 'marketplace.getting_location'.tr() : cityName,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                          ),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                        if (streetInfo.isNotEmpty)
                          Text(
                            streetInfo,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                              fontSize: 10,
                              fontWeight: FontWeight.w400,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(Icons.keyboard_arrow_down,
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3), size: 14),
                ],
              ),
            ),
          ),

          const SizedBox(width: 4),

          // Bildirim zili (notification bell)
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/notification-history');
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              child: StreamBuilder<QuerySnapshot>(
                stream: FirebaseAuth.instance.currentUser != null
                    ? FirebaseFirestore.instance
                        .collection('users')
                        .doc(FirebaseAuth.instance.currentUser!.uid)
                        .collection('notifications')
                        .where('read', isEqualTo: false)
                        .snapshots()
                    : null,
                builder: (context, snapshot) {
                  final unreadCount = snapshot.data?.docs.length ?? 0;
                  final isDark = Theme.of(context).brightness == Brightness.dark;

                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // Bell icon - white outline style for contrast
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.08)
                              : Colors.grey.shade100,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          unreadCount > 0
                              ? Icons.notifications_rounded
                              : Icons.notifications_outlined,
                          color: unreadCount > 0
                              ? lokmaPink
                              : (isDark ? Colors.white70 : Colors.grey[800]),
                          size: 24,
                        ),
                      ),
                      // Badge - red to match other badges
                      if (unreadCount > 0)
                        Positioned(
                          top: -2,
                          right: -4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFFF3B30), Color(0xFFE5222D)],
                              ),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: Theme.of(context).scaffoldBackgroundColor,
                                width: 1.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFFF3B30).withValues(alpha: 0.4),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Text(
                              unreadCount > 99 ? '99+' : '$unreadCount',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
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

          const SizedBox(width: 2),

          // Favoriler (kalp ikonu) - favoriler sayfasına git
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/favorites');
            },
            child: Container(
              padding:
                  const EdgeInsets.only(left: 8, right: 8, top: 6, bottom: 6),
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
                          top: -2,
                          right: -4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFFF3B30), Color(0xFFE5222D)],
                              ),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: Theme.of(context).scaffoldBackgroundColor,
                                width: 1.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFFF3B30).withValues(alpha: 0.4),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Text(
                              '${favorites.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
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
      padding: const EdgeInsets.only(left: 16, right: 16, top: 8, bottom: 2),
      child: GestureDetector(
        onTap: () {
          // 🆕 Lieferando tarzı: Arama'ya tıklayınca SmartSearchScreen'e git
          context.push('/search?segment=yemek');
        },
        child: Container(
          height: 48,
          padding: const EdgeInsets.only(left: 16, right: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark
                ? Colors.grey[800]
                : const Color(0xFFF2EEE9),
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color:
                    Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
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
                  tr('discovery.search_food_restaurant_cuisine'),
                  style: TextStyle(color: Colors.grey[600], fontSize: 13, fontWeight: FontWeight.w200),
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

    // 🧪 EXPERIMENT: Testing new LOKMA brand color #F41C54
    const accent = Color(0xFFF41C54);

    return ThreeDimensionalPillTabBar(
      selectedIndex: selectedIndex,
      activeColor: accent,
      tabs: [
        TabItem(
            title: tr('delivery_modes.delivery'), icon: Icons.delivery_dining),
        TabItem(
            title: tr('delivery_modes.pickup'),
            icon: Icons.shopping_bag_outlined),
        TabItem(title: tr('delivery_modes.dine_in'), icon: Icons.restaurant),
      ],
      onTabSelected: (index) {
        String newMode = 'teslimat';
        if (index == 1) newMode = 'gelal';
        if (index == 2) newMode = 'masa';
        Future.microtask(() {
          ref.read(bottomNavVisibilityProvider.notifier).setVisible(newMode != 'masa');
        });

        setState(() {
          _deliveryMode = newMode;
          // Reset auto-set so slider re-snaps to nearest business for new mode
          _sliderAutoSet = false;
          _currentStepIndex = 9; // Reset to 10km default
          _maxDistance = 10.0;
          // Reset QR scan state when leaving Masa mode
          if (newMode != 'masa') {
            _scannedTableNumber = null;
            _scannedBusinessId = null;
            _scannedBusinessName = null;
          }
        });
        // Re-trigger auto-set for the new delivery mode
        _autoSetSliderToNearestBusiness();
      },
    );
  }

  // Sabit km adımları: 1-10 (×1), 10-50 (×10), 50-200 (×50)
  static const List<double> _kmSteps = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, // 1-10 km (her 1 km)
    20, 30, 40, 50, // 10-50 km (her 10 km)
    100, 150, 200, // 50-200 km (her 50 km)
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
        final distanceMeters =
            Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
        final distanceKm = (distanceMeters / 1000).round();
        if (distanceKm >= 1 && distanceKm <= 200) {
          kmSet.add(distanceKm);
        }
      }
    }
    return kmSet;
  }

  int _currentStepIndex = 9; // Varsayılan: 10 km (index 9)
  final double _lastSliderValue = 10.0; // ignore: unused_field

  /// Auto-snap slider to nearest business distance (respects delivery mode)
  void _autoSetSliderToNearestBusiness() {
    if (_userLat == null || _userLng == null || _allBusinesses.isEmpty) return;

    // Teslimat modunda slider gizli, deliveryRadius zaten filtreliyor
    // maxDistance'i yuksek tutarak ekstra filtrelemeyi engelle
    if (_deliveryMode == 'teslimat') {
      if (mounted) {
        setState(() {
          _sliderAutoSet = true;
          _maxDistance = 200.0; // Effectively disabled -- deliveryRadius handles it
        });
      }
      debugPrint('🎯 Auto-set: teslimat mode, maxDistance=200 (deliveryRadius handles filtering)');
      return;
    }

    // Gel Al mode defaults to 5km
    if (_deliveryMode == 'gelal') {
      if (mounted) {
        setState(() {
          _sliderAutoSet = true;
          _currentStepIndex = 4; // 5 km is at index 4 (1,2,3,4,5)
          _maxDistance = 5.0;
        });
      }
      debugPrint('🎯 Auto-set: gelal mode, maxDistance defaulting to 5.0km');
      return;
    }

    double nearestKm = double.infinity;

    for (final doc in _allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      if (!_hasYemekSector(data)) continue;
      final isActive = data['isActive'] as bool? ?? true;
      if (!isActive) continue;

      // Also check delivery mode compatibility
      if (_deliveryMode == 'teslimat') {
        final offersDelivery = data['offersDelivery'] as bool? ?? true;
        if (!offersDelivery) continue;
      } else if (_deliveryMode == 'gelal') {
        final offersPickup = data['offersPickup'] as bool? ?? true;
        if (!offersPickup) continue;
      } else if (_deliveryMode == 'masa') {
        final hasReservation = data['hasReservation'] as bool? ?? false;
        final tableCapacity = data['tableCapacity'] as int? ?? 0;
        final hasDineInQR = data['hasDineInQR'] as bool? ?? false;
        final hasWaiterOrder = data['hasWaiterOrder'] as bool? ?? false;
        if (!hasReservation &&
            tableCapacity <= 0 &&
            !hasDineInQR &&
            !hasWaiterOrder) {
          continue;
        }
      }

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
        final distKm =
            Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng) / 1000;
        if (distKm < nearestKm) nearestKm = distKm;
      }
    }

    // If no matching business found, keep default (10km)
    if (nearestKm == double.infinity) {
      if (mounted) {
        setState(() => _sliderAutoSet = true);
      }
      debugPrint(
          '🎯 Auto-set: no matching business for mode=$_deliveryMode, keeping default 10km');
      return;
    }

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
      debugPrint(
          '🎯 Auto-set slider: nearest business at ${nearestKm.toStringAsFixed(1)}km → step ${_kmSteps[targetIndex]}km');
    }
  }

  Widget _buildDistanceSlider() {
    final businessKms = _businessKmSet;
    final currentKm = _kmSteps[_currentStepIndex];
    final hasBusinessAtCurrent = businessKms.contains(currentKm.toInt());
    final isDark = Theme.of(context).brightness == Brightness.dark;

    int nearestKm = _kmSteps.first.toInt();
    if (businessKms.isNotEmpty) {
      final sortedKms = businessKms.toList()..sort();
      nearestKm = sortedKms.first;
    }

    String distanceLabel;
    if (_currentStepIndex == _kmSteps.length - 1) {
      distanceLabel = 'Tümü';
    } else {
      distanceLabel = '${currentKm.toInt()} km';
    }

    String nearestLabel = '$nearestKm km';

    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 6),
      child: Row(
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.near_me, color: lokmaPink, size: 14),
              const SizedBox(width: 4),
              Text(
                nearestLabel,
                style: const TextStyle(
                  color: lokmaPink,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
          Expanded(
            child: SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: lokmaPink,
                inactiveTrackColor: isDark ? Colors.grey[600] : Colors.grey[400],
                thumbColor: lokmaPink,
                overlayColor: lokmaPink.withValues(alpha: 0.2),
                trackHeight: 4,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
                tickMarkShape: const RoundSliderTickMarkShape(tickMarkRadius: 0),
                activeTickMarkColor: Colors.transparent,
                inactiveTickMarkColor: Colors.transparent,
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
          const SizedBox(width: 8),
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
        final hasTunaTag =
            tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
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
      if (_userLat != null && _userLng != null) {
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
            if (placeDetails['lat'] is num) {
              lat = (placeDetails['lat'] as num).toDouble();
            }
            if (placeDetails['lng'] is num) {
              lng = (placeDetails['lng'] as num).toDouble();
            }
          }
        }

        if (lat != null && lng != null) {
          final distanceMeters =
              Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
          final distanceKm = distanceMeters / 1000;

          if (_deliveryMode == 'teslimat') {
            final double deliveryRadius =
                (data['deliveryRadius'] as num?)?.toDouble() ?? 5.0;
            if (distanceKm > deliveryRadius) continue;
          } else {
            if (_maxDistance < 200 && distanceKm > _maxDistance) continue;
          }
        } else {
          if (_deliveryMode == 'teslimat' || _maxDistance < 200) {
            continue;
          }
        }
      }

      // Count this business type
      typeCounts[businessType] = (typeCounts[businessType] ?? 0) + 1;
    }

    return typeCounts;
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
          final doc = restaurants[index];
          final data = doc.data() as Map<String, dynamic>;
          return _buildRestaurantCard(doc.id, data);
        },
        childCount: restaurants.length,
      ),
    );
  }

  /// 🆕 Check if business is available for the currently selected mode
  /// Returns tuple: (isAvailable, unavailableReason, startTime)
  ({
    bool isAvailable,
    String? reason,
    String? startTime,
    String? deliveryTime,
    String? pickupTime
  }) _checkAvailabilityForMode(
    Map<String, dynamic> data,
    String mode,
  ) {
    final now = DateTime.now();
    final currentHour = now.hour;
    final currentMinute = now.minute;

    // ── Extract today's start times from per-day arrays (admin portal format) ──
    String? deliveryStartTime = data['deliveryStartTime'] as String?;
    String? pickupStartTime = data['pickupStartTime'] as String?;
    final deliveryTodayStart = _extractTodayStartFromArray(data['deliveryHours'], now);
    final pickupTodayStart = _extractTodayStartFromArray(data['pickupHours'], now);
    // Per-day array takes priority over single value
    if (deliveryTodayStart != null) deliveryStartTime = deliveryTodayStart;
    if (pickupTodayStart != null) pickupStartTime = pickupTodayStart;

    // 🆕 First check openingHours — if business is closed per its schedule, mark unavailable
    if (!_isBusinessOpenNow(data)) {
      return (
        isAvailable: false,
        reason: 'marketplace.currently_closed'.tr(),
        startTime: null,
        deliveryTime: deliveryStartTime,
        pickupTime: pickupStartTime
      );
    }

    // Check if current time is before delivery start
    bool deliveryUnavailable = false;
    if (deliveryStartTime != null && deliveryStartTime.isNotEmpty) {
      final parsed = _parseTimeString(deliveryStartTime);
      if (parsed != null) {
        if (currentHour < parsed.$1 ||
            (currentHour == parsed.$1 && currentMinute < parsed.$2)) {
          deliveryUnavailable = true;
        }
      }
    }

    // Check if current time is before pickup start
    bool pickupUnavailable = false;
    if (pickupStartTime != null && pickupStartTime.isNotEmpty) {
      final parsed = _parseTimeString(pickupStartTime);
      if (parsed != null) {
        if (currentHour < parsed.$1 ||
            (currentHour == parsed.$1 && currentMinute < parsed.$2)) {
          pickupUnavailable = true;
        }
      }
    }

    // Check temporary pause for delivery mode
    final temporaryDeliveryPaused =
        data['temporaryDeliveryPaused'] as bool? ?? false;
    final temporaryPickupPaused =
        data['temporaryPickupPaused'] as bool? ?? false;

    if (mode == 'teslimat') {
      if (temporaryDeliveryPaused) {
        String pauseMsg = 'marketplace.courier_not_available'.tr();
        final dpUntil = data['deliveryPauseUntil'];
        if (dpUntil != null) {
          final DateTime dt = dpUntil is Timestamp ? dpUntil.toDate() : (dpUntil is DateTime ? dpUntil : DateTime.now());
          final mins = dt.difference(DateTime.now()).inMinutes;
          if (mins > 0) {
            pauseMsg = tr('marketplace.delivery_resumes_in', namedArgs: {'minutes': '$mins'});
          }
        }
        return (
          isAvailable: false,
          reason: pauseMsg,
          startTime: null,
          deliveryTime: deliveryStartTime,
          pickupTime: pickupStartTime
        );
      }
      if (deliveryUnavailable) {
        return (
          isAvailable: false,
          reason: tr('marketplace.delivery_from', namedArgs: {'time': deliveryStartTime!}),
          startTime: deliveryStartTime,
          deliveryTime: deliveryStartTime,
          pickupTime: pickupStartTime
        );
      }
      return (
        isAvailable: true,
        reason: null,
        startTime: null,
        deliveryTime: deliveryStartTime,
        pickupTime: pickupStartTime
      );
    } else if (mode == 'gelal') {
      if (temporaryPickupPaused) {
        String pauseMsg = tr('marketplace.pickup_paused');
        final ppUntil = data['pickupPauseUntil'];
        if (ppUntil != null) {
          final DateTime dt = ppUntil is Timestamp ? ppUntil.toDate() : (ppUntil is DateTime ? ppUntil : DateTime.now());
          final mins = dt.difference(DateTime.now()).inMinutes;
          if (mins > 0) {
            pauseMsg = tr('marketplace.pickup_resumes_in', namedArgs: {'minutes': '$mins'});
          }
        }
        return (
          isAvailable: false,
          reason: pauseMsg,
          startTime: null,
          deliveryTime: deliveryStartTime,
          pickupTime: pickupStartTime
        );
      }
      if (pickupUnavailable) {
        return (
          isAvailable: false,
          reason: tr('marketplace.pickup_from', namedArgs: {'time': pickupStartTime!}),
          startTime: pickupStartTime,
          deliveryTime: deliveryStartTime,
          pickupTime: pickupStartTime
        );
      }
      return (
        isAvailable: true,
        reason: null,
        startTime: null,
        deliveryTime: deliveryStartTime,
        pickupTime: pickupStartTime
      );
    }

    return (
      isAvailable: true,
      reason: null,
      startTime: null,
      deliveryTime: deliveryStartTime,
      pickupTime: pickupStartTime
    );
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

  /// Extract today's start time from a per-day hours array (e.g. ["Montag: 11:30 - 22:00", ...]).
  /// Returns the start time string (e.g. "11:30") or null if today is closed or data is missing.
  String? _extractTodayStartFromArray(dynamic hoursData, DateTime now) {
    if (hoursData == null) return null;
    List<String> lines = [];
    if (hoursData is List) {
      lines = hoursData.map((e) => e.toString().trim()).where((l) => l.isNotEmpty).toList();
    } else if (hoursData is String && hoursData.isNotEmpty) {
      lines = hoursData.split(RegExp(r'\r?\n')).where((l) => l.trim().isNotEmpty).toList();
    }
    if (lines.isEmpty) return null;

    // Map all day name variants to weekday index (1=Monday .. 7=Sunday)
    final dayAliases = <String, int>{
      'Pazartesi': 1, 'Monday': 1, 'Montag': 1,
      'Salı': 2, 'Tuesday': 2, 'Dienstag': 2,
      'Çarşamba': 3, 'Wednesday': 3, 'Mittwoch': 3,
      'Perşembe': 4, 'Thursday': 4, 'Donnerstag': 4,
      'Cuma': 5, 'Friday': 5, 'Freitag': 5,
      'Cumartesi': 6, 'Saturday': 6, 'Samstag': 6,
      'Pazar': 7, 'Sunday': 7, 'Sonntag': 7,
    };

    // Find today's line
    for (final line in lines) {
      for (final entry in dayAliases.entries) {
        if (line.startsWith(entry.key) && entry.value == now.weekday) {
          // Check if closed
          final lower = line.toLowerCase();
          if (lower.contains('kapalı') || lower.contains('closed') || lower.contains('geschlossen')) {
            return null;
          }
          // Extract time part after ":"
          final colonIdx = line.indexOf(':');
          if (colonIdx < 0) return null;
          final timePart = line.substring(colonIdx + 1).trim();
          // Extract the first HH:MM (start time)
          final timeMatch = RegExp(r'(\d{1,2}:\d{2})').firstMatch(timePart);
          return timeMatch?.group(1);
        }
      }
    }
    return null;
  }

  /// 🆕 Show unified dialog for closed/unavailable business (merges list + detail popups)
  void _showClosedBusinessDialog(
      BuildContext context, String businessName, String? reason, Map<String, dynamic> businessData) {
    final preOrderEnabled = businessData['preOrderEnabled'] as bool? ?? false;
    
    // Calculate next opening time - use deliveryHours/pickupHours as fallback
    OpeningHoursHelper openingHelper;
    if (businessData['openingHours'] != null) {
      openingHelper = OpeningHoursHelper(businessData['openingHours']);
    } else if (businessData['deliveryHours'] != null) {
      openingHelper = OpeningHoursHelper(businessData['deliveryHours']);
    } else {
      openingHelper = OpeningHoursHelper(businessData['pickupHours']);
    }
    final nextOpen = openingHelper.getNextOpenDateTime(DateTime.now());
    String? nextOpenText;
    if (nextOpen != null) {
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
        // Use localized day names
        final dayKeys = ['day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday', 'day_saturday', 'day_sunday'];
        final dayName = tr('common.${dayKeys[nextOpen.weekday - 1]}');
        nextOpenText = tr('marketplace.opens_on_day', namedArgs: {'day': dayName, 'time': timeStr});
      }
    }
    
    showDialog(
      context: context,
      builder: (ctx) {
        final theme = Theme.of(ctx);
        final onSurface = theme.colorScheme.onSurface;
        final surfaceVariant = theme.colorScheme.surfaceContainerHighest;
        
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: theme.dialogBackgroundColor,
          title: Stack(
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: surfaceVariant.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.storefront_outlined, color: onSurface.withValues(alpha: 0.7), size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 28),
                      child: Text(
                        businessName,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: onSurface,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              Positioned(
                top: 4,
                right: 4,
                child: GestureDetector(
                  onTap: () => Navigator.pop(ctx),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: onSurface.withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.close, size: 18, color: onSurface.withValues(alpha: 0.5)),
                  ),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status info row - reason + next opening + pre-order pill combined
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: surfaceVariant.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (reason != null)
                      Row(
                        children: [
                          Icon(Icons.schedule_outlined, color: onSurface.withValues(alpha: 0.5), size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              reason,
                              style: TextStyle(
                                fontWeight: FontWeight.w400,
                                color: onSurface.withValues(alpha: 0.7),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    // Pre-order pill right under the status
                    if (preOrderEnabled) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF3E3E40),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 14),
                            const SizedBox(width: 6),
                            Text(
                              tr('marketplace.pre_order_active'),
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w400, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (nextOpenText != null) ...[
                      Divider(color: onSurface.withValues(alpha: 0.1), height: 16),
                      Row(
                        children: [
                          Icon(Icons.event_available_outlined, color: lokmaPink, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              nextOpenText,
                              style: TextStyle(
                                fontWeight: FontWeight.w500,
                                color: lokmaPink,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text(
                preOrderEnabled
                    ? 'marketplace.closed_but_preorder'.tr()
                    : 'marketplace.closed_but_browse'.tr(),
                style: TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  fontWeight: FontWeight.w300,
                  color: onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 20),
              // Full-width CTA pill button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    final businessId = _currentBusinessIdForDialog;
                    if (businessId != null) {
                      context.push('/business/$businessId?mode=$_deliveryMode&closedAck=true');
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: lokmaPink,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  ),
                  child: Text(
                    preOrderEnabled ? tr('marketplace.see_menu_and_order') : tr('marketplace.see_menu'),
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              // "Find Open Businesses" text link
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => OpenPartnersMapSheet(
                        allBusinesses: _allBusinesses,
                        userLat: _userLat,
                        userLng: _userLng,
                        deliveryMode: _deliveryMode,
                        activeSegment: 'essen',
                        sectorTypes: _yemekSectorTypes,
                      ),
                    );
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: onSurface.withValues(alpha: 0.7),
                  ),
                  child: Text(
                    'marketplace.find_open_businesses'.tr(),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: onSurface.withValues(alpha: 0.7),
                    ),
                  ),
                ),
              ),
            ],
          ),
          actionsPadding: EdgeInsets.zero,
          actions: const [],
        );
      },
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
    final hasTunaTag =
        tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
    final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) ||
        (brandLabel?.toLowerCase() == 'tuna') ||
        (brand?.toLowerCase() == 'tuna') ||
        hasTunaTag;

    // 🆕 Availability check based on current mode
    final availability = _checkAvailabilityForMode(data, _deliveryMode);
    final isAvailable = availability.isAvailable;
    final unavailableReason = availability.reason;

    // Compute banner height offset for overlay icons (TUNA, favorite)
    // 1-line banner ≈ 28px, 2-line banner ≈ 42px, add 10px gap
    double bannerTopOffset = 12;
    if (!isAvailable) {
      final hasTimeInfo = (availability.deliveryTime != null && availability.deliveryTime!.isNotEmpty) ||
          (availability.pickupTime != null && availability.pickupTime!.isNotEmpty);
      bannerTopOffset = hasTimeInfo ? 52 : 36;
    }

    final rating = (data['rating'] as num?)?.toDouble() ?? 4.0;
    final reviewCount = (data['reviewCount'] as num?)?.toInt() ?? 0;
    final imageUrl = data['imageUrl'] as String?;
    final logoUrl = data['logoUrl'] as String?;
    final cuisineType = data['cuisineType'] as String?;

    // Business type label
    final typeLabel = getBusinessTypeLabel(businessType);

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
        final distanceMeters =
            Geolocator.distanceBetween(_userLat!, _userLng!, lat, lng);
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
          _showClosedBusinessDialog(context, name, unavailableReason, data);
        } else {
          context.push('/business/$id?mode=$_deliveryMode');
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.dark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.black.withValues(alpha: 0.06),
            width: 0.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).brightness == Brightness.dark
                  ? Colors.black.withValues(alpha: 0.3)
                  : Colors.black.withValues(alpha: 0.15),
              blurRadius: 12,
              offset: const Offset(0, 3),
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
                    SizedBox(
                      height: 230,
                      width: double.infinity,
                      child: imageUrl != null && imageUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: imageUrl,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => Container(
                                color: const Color(0xFF2A2A28),
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
                                color: const Color(0xFF2A2A28),
                                child: const Center(
                                  child: Icon(Icons.restaurant,
                                      color: lokmaPink, size: 48),
                                ),
                              ),
                            )
                          : Container(
                              color: const Color(0xFF1C1C1E),
                              child: const Center(
                                child: Icon(Icons.restaurant,
                                    color: lokmaPink, size: 48),
                              ),
                            ),
                    ),

                    // 🆕 Darker overlay for unavailable businesses (keep image dim)
                    if (!isAvailable)
                      Positioned.fill(
                        child: Container(
                          color: Colors.black.withValues(alpha: 
                              0.4), // Slightly lighter dark overlay
                        ),
                      ),

                    // 🆕 Thin top-aligned banner for unavailable businesses (Overlying the image)
                    if (!isAvailable) ...[
                      // Build time info string like Lieferando: "Lieferung ab 16:15 · Abholen ab 12:00"
                      () {
                        final deliveryTime = availability.deliveryTime;
                        final pickupTime = availability.pickupTime;
                        final preOrderEnabled = data['preOrderEnabled'] as bool? ?? false;
                        
                        // Build time parts
                        final timeParts = <String>[];
                        if (deliveryTime != null && deliveryTime.isNotEmpty) {
                          timeParts.add('${tr('marketplace.delivery_from_short', namedArgs: {'time': deliveryTime})}');
                        }
                        if (pickupTime != null && pickupTime.isNotEmpty) {
                          timeParts.add('${tr('marketplace.pickup_from_short', namedArgs: {'time': pickupTime})}');
                        }
                        final timeInfo = timeParts.isNotEmpty ? timeParts.join(' · ') : null;
                        
                        // Main status text
                        final statusText = preOrderEnabled
                            ? '${unavailableReason ?? 'marketplace.currently_closed'.tr()} (${tr('marketplace.pre_order_active')})'
                            : unavailableReason ?? 'marketplace.currently_closed'.tr();
                        
                        return Positioned(
                          top: 0,
                          left: 0,
                          right: 0,
                          child: Container(
                            padding: EdgeInsets.symmetric(vertical: timeInfo != null ? 5 : 6),
                            color: const Color(0xFF2A2A28),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  statusText,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                                if (timeInfo != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    timeInfo,
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.7),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w400,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      }(),
                    ],

                    // 🆕 Overlay for table reservation warning
                    if (_deliveryMode == 'masada' && (data['hasReservation'] as bool? ?? false))
                      Positioned(
                        bottom: 0,
                        left: 0,
                        right: 0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                          color: Colors.black.withValues(alpha: 0.65),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.info_outline, color: Colors.white, size: 14),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  tr('marketplace.business_approval_required'),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
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
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurface
                                      .withValues(alpha: 0.2),
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
                                  child: Icon(Icons.store,
                                      color: lokmaPink, size: 24),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                    // 🏷️ TUNA brand badge (TOP LEFT) — kapalı banner ile birlikte dinamik hizalı
                    // Kapalı banner yüksekliği: padding 6 * 2 + fontSize 12 ≈ 34px
                    if (isTunaPartner)
                      Positioned(
                        left: 12,
                        top: bannerTopOffset,
                        child: Opacity(
                          opacity: 1.0, // Her durumda tam görünür
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFA01E22), // TUNA dark red
                              borderRadius:
                                  BorderRadius.circular(16), // Pill shape
                              boxShadow: [
                                BoxShadow(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurface
                                      .withValues(alpha: 0.3),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.verified, color: Colors.white, size: 14),
                                SizedBox(width: 4),
                                Text(
                                  'TUNA',
                                  style: TextStyle(
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
                      ),

                    // ♥️ Favorite button (TOP RIGHT) — TUNA ile aynı top hizası (her iki durumda da eşit)
                    Positioned(
                      top: bannerTopOffset,
                      right: 12,
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          ref
                              .read(butcherFavoritesProvider.notifier)
                              .toggleFavorite(id);
                        },
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withValues(alpha: 0.5),
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

                    // 🪑 Online Masa Rezervasyonu badge (BOTTOM RIGHT, above Group Order)
                    if (data['hasReservation'] == true)
                      Positioned(
                        right: 12,
                        bottom: data['dineInEnabled'] == true ? 48 : 12,
                        child: Opacity(
                          opacity: isAvailable ? 1.0 : 0.7,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: lokmaPink.withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(14),
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
                                SvgPicture.asset(
                                  'assets/images/icon_masa_rezervasyon.svg',
                                  width: 16,
                                  height: 16,
                                  colorFilter: const ColorFilter.mode(
                                    Colors.white,
                                    BlendMode.srcIn,
                                  ),
                                ),
                                Text(
                                  'marketplace.online_table_reservation_badge'.tr(),
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                    // Grup Siparis badge (BOTTOM RIGHT) - only for dine-in enabled businesses
                    if (data['dineInEnabled'] == true)
                      Positioned(
                        right: 12,
                        bottom: 12,
                        child: Opacity(
                          opacity: isAvailable ? 1.0 : 0.7,
                          child: GestureDetector(
                            onTap: () async {
                              HapticFeedback.lightImpact();
                              if (!isAvailable) {
                                _currentBusinessIdForDialog = id;
                                _showClosedBusinessDialog(context, name, unavailableReason, data);
                                return;
                              }

                              final session = await showModalBottomSheet<TableGroupSession>(
                                context: context,
                                useRootNavigator: true,
                                shape: const RoundedRectangleBorder(
                                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                                ),
                                backgroundColor: Theme.of(context).brightness == Brightness.dark 
                                    ? const Color(0xFF2A2A28) 
                                    : Colors.white,
                                isScrollControlled: true,
                                builder: (ctx) => GroupOrderSetupSheet(
                                  businessId: id,
                                  businessName: name,
                                ),
                              );

                              if (session != null && context.mounted) {
                                // 1. Show share sheet
                                await showModalBottomSheet(
                                  context: context,
                                  useRootNavigator: true,
                                  isScrollControlled: true,
                                  backgroundColor: Colors.transparent,
                                  builder: (ctx) => MarketplaceGroupShareSheet(
                                    session: session,
                                  ),
                                );
                                
                                // 2. Navigate to Kasap / Menu
                                if (context.mounted) {
                                  context.push('/kasap/$id?mode=$_deliveryMode');
                                }
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: const Color(0xFF2E7D32).withValues(alpha: 0.9),
                                borderRadius: BorderRadius.circular(14),
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
                                  const Icon(Icons.groups_rounded, color: Colors.white, size: 16),
                                  const SizedBox(width: 6),
                                  Text(
                                    tr('marketplace.group_order_badge'),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.3,
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

                Builder(
                  builder: (context) {
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
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
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.star,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .tertiary,
                                      size: 16),
                                  const SizedBox(width: 6),
                                  Text(
                                    rating
                                        .toStringAsFixed(1)
                                        .replaceAll('.', ','),
                                    style: TextStyle(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface
                                          .withValues(alpha: 0.9),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  if (reviewText.isNotEmpty) ...[
                                    const SizedBox(width: 4),
                                    Text(
                                      reviewText,
                                      style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withValues(alpha: 0.7),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w400,
                                      ),
                                    ),
                                  ],
                                  Text(
                                    ' · ',
                                    style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withValues(alpha: 0.7),
                                        fontSize: 13),
                                  ),
                                  Expanded(
                                    child: Text(
                                      cuisineType != null &&
                                              cuisineType.isNotEmpty
                                          ? cuisineType
                                          : typeLabel,
                                      style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withValues(alpha: 0.7),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w400,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Builder(
                                builder: (context) {
                                  final deliveryFee =
                                      (data['deliveryFee'] as num?)
                                              ?.toDouble() ??
                                          0.0;
                                  final minOrderAmount =
                                      (data['minDeliveryOrder'] as num?)?.toDouble() ??
                                      (data['minOrderAmount'] as num?)?.toDouble() ??
                                          10.0;
                                  // ignore: unused_local_variable
                                  final freeDeliveryThreshold =
                                      (data['freeDeliveryThreshold'] as num?)
                                          ?.toDouble();

                                  if (_deliveryMode == 'teslimat') {
                                    final hasMinOrder = minOrderAmount > 0;

                                    return Row(
                                      children: [
                                        Icon(Icons.delivery_dining,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withValues(alpha: 0.7),
                                            size: 16),
                                        const SizedBox(width: 6),
                                        if (deliveryFee == 0)
                                          Text(
                                            tr('marketplace.free_delivery_label'),
                                            style: TextStyle(
                                                color: tunaGreen,
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600),
                                          )
                                        else
                                          Text(
                                            '${deliveryFee.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()} ${tr('common.delivery')}',
                                            style: TextStyle(
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .onSurface
                                                  .withValues(alpha: 0.7),
                                              fontSize: 13,
                                              fontWeight: FontWeight.w400,
                                            ),
                                          ),
                                        if (hasMinOrder) ...[
                                          Text(' · ',
                                              style: TextStyle(
                                                  color: Theme.of(context)
                                                      .colorScheme
                                                      .onSurface
                                                      .withValues(alpha: 0.7),
                                                  fontSize: 13)),
                                          Icon(Icons.shopping_basket_outlined,
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .onSurface
                                                  .withValues(alpha: 0.7),
                                              size: 14),
                                          const SizedBox(width: 6),
                                          Text(
                                            'Min. ${minOrderAmount.toStringAsFixed(0)} ${CurrencyUtils.getCurrencySymbol()}',
                                            style: TextStyle(
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .onSurface
                                                  .withValues(alpha: 0.7),
                                              fontSize: 13,
                                              fontWeight: FontWeight.w400,
                                            ),
                                          ),
                                        ],
                                      ],
                                    );
                                  } else {
                                    final hasReservation = data['hasReservation'] as bool? ?? false;
                                    return Row(
                                      children: [
                                        Icon(Icons.location_on_outlined,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withValues(alpha: 0.7),
                                            size: 14),
                                        const SizedBox(width: 4),
                                        Text(
                                          distanceText.isNotEmpty
                                              ? distanceText
                                              : '—',
                                          style: TextStyle(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withValues(alpha: 0.7),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w400,
                                          ),
                                        ),
                                        if (hasReservation) ...[
                                          Text(' · ',
                                              style: TextStyle(
                                                  color: Theme.of(context)
                                                      .colorScheme
                                                      .onSurface
                                                      .withValues(alpha: 0.7),
                                                  fontSize: 13)),
                                          GestureDetector(
                                            onTap: () {
                                              HapticFeedback.lightImpact();
                                              Navigator.push(
                                                context,
                                                MaterialPageRoute(
                                                  builder: (_) => ReservationBookingScreen(
                                                    businessId: id,
                                                    businessName: data['companyName'] as String? ?? data['name'] as String? ?? '',
                                                  ),
                                                ),
                                              );
                                            },
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(Icons.event_seat,
                                                    color: lokmaPink,
                                                    size: 14),
                                                const SizedBox(width: 4),
                                                Icon(Icons.schedule,
                                                    color: lokmaPink,
                                                    size: 14),
                                                const SizedBox(width: 4),
                                                Flexible(
                                                  child: Text(
                                                    tr('marketplace.reservation_available'),
                                                    style: TextStyle(
                                                      color: lokmaPink,
                                                      fontSize: 13,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ],
                                    );
                                  }
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showCartBottomSheet(
    BuildContext context, {
    required String businessName,
    required String businessId,
    required int itemCount,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle bar
                  Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Business name
                  Text(
                    businessName.toUpperCase(),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.onSurface,
                      letterSpacing: 0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),

                  // Item count
                  Text(
                    '$itemCount ${tr('cart.items')}',
                    style: TextStyle(
                      fontSize: 14,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Continue ordering button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        context.push(
                            '/business/$businessId?mode=$_deliveryMode');
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: lokmaPink,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        tr('cart.continue_ordering'),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Delete order button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      onPressed: () {
                        ref.read(cartProvider.notifier).clearCart();
                        Navigator.pop(ctx);
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor:
                            Theme.of(context).colorScheme.onSurface,
                        side: BorderSide(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.2),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        tr('cart.delete_order'),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
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
                ? 'marketplace.no_business_in_category'.tr()
                : 'marketplace.no_business_nearby'.tr(),
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
                  // Header Bar — Lieferando style with text buttons
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Cancel pill button
                        GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            Navigator.pop(context);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.15),
                              ),
                            ),
                            child: Text(
                              tr('marketplace.filter_cancel'),
                              style: const TextStyle(
                                color: Color(0xFF3E3E40),
                                fontSize: 14,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ),
                        ),
                        // Results Count in center
                        Flexible(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              tr('marketplace.show_businesses', args: ['$totalResults']),
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                        // Reset pill button
                        GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            setState(() {
                              _sortOption = 'nearest';
                              _categoryFilter = 'all';
                              _onlyTuna = false;
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
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.15),
                              ),
                            ),
                            child: Text(
                              tr('marketplace.filter_reset'),
                              style: const TextStyle(
                                color: Color(0xFF3E3E40),
                                fontSize: 14,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
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

                          // 🐟 TUNA Sertifika Filtresi - Premium toggle
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              setState(() => _onlyTuna = !_onlyTuna);
                              setStateSheet(() {});
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  // TUNA branded pill badge
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFA01E22),
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: _onlyTuna ? [
                                        BoxShadow(
                                          color: const Color(0xFFA01E22).withValues(alpha: 0.4),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ] : null,
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.verified, color: Colors.white, size: 16),
                                        SizedBox(width: 6),
                                        Text(
                                          'TUNA',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: 1.5,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  // Descriptive text
                                  Expanded(
                                    child: Text(
                                      tr('marketplace.filter_tuna_description'),
                                      style: TextStyle(
                                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  // iOS-style Switch toggle
                                  SizedBox(
                                    height: 28,
                                    child: Switch.adaptive(
                                      value: _onlyTuna,
                                      activeColor: Colors.white,
                                      activeTrackColor: lokmaPink,
                                      onChanged: (val) {
                                        HapticFeedback.lightImpact();
                                        setState(() => _onlyTuna = val);
                                        setStateSheet(() {});
                                      },
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 24),

                          // Sıralama Section Header
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              tr('marketplace.sort_section'),
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurface
                                    .withValues(alpha: 0.5),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),

                          // Sıralama Options (radio style — single select)
                          _buildFilterListItem(
                            title: tr('marketplace.sort_nearest'),
                            subtitle: 'marketplace.sort_by_distance'.tr(),
                            isSelected: _sortOption == 'nearest',
                            useRadio: true,
                            onTap: () {
                              setState(() => _sortOption = 'nearest');
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: tr('marketplace.sort_best_rating'),
                            subtitle: tr('marketplace.filter_high_rating_subtitle'),
                            isSelected: _sortOption == 'rating',
                            useRadio: true,
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
                              tr('marketplace.business_type_section'),
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurface
                                    .withValues(alpha: 0.5),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),

                          // Tümü Option (radio — single select)
                          _buildFilterListItem(
                            title: tr('marketplace.filter_all'),
                            subtitle: 'marketplace.sort_show_all'.tr(),
                            isSelected: _categoryFilter == 'all',
                            useRadio: true,
                            onTap: () {
                              setState(() => _categoryFilter = 'all');
                              setStateSheet(() {});
                            },
                          ),

                          // Dynamic Category Options
                          ...sortedTypes.map((entry) {
                            final typeKey = entry.key;
                            final count = entry.value;
                            final label =
                                getBusinessTypeLabel(typeKey);

                            return _buildFilterListItem(
                              title: label,
                              subtitle: tr('marketplace.business_count', args: ['$count']),
                              isSelected: _categoryFilter == typeKey,
                              useRadio: true,
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
                              tr('marketplace.quick_filters_section'),
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurface
                                    .withValues(alpha: 0.5),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),

                          _buildFilterListItem(
                            title: tr('marketplace.filter_campaigns_title'),
                            subtitle: 'marketplace.filter_campaigns'.tr(),
                            isSelected: _filterDiscounts,
                            onTap: () {
                              setState(
                                  () => _filterDiscounts = !_filterDiscounts);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: tr('marketplace.filter_cash_title'),
                            subtitle: 'marketplace.filter_cash'.tr(),
                            isSelected: _filterCash,
                            onTap: () {
                              setState(() => _filterCash = !_filterCash);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: tr('marketplace.filter_free_delivery_title'),
                            subtitle: 'marketplace.filter_free_delivery'.tr(),
                            isSelected: _filterFreeDelivery,
                            onTap: () {
                              setState(() =>
                                  _filterFreeDelivery = !_filterFreeDelivery);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: tr('marketplace.filter_meal_cards_title'),
                            subtitle:
                                tr('marketplace.filter_meal_cards_subtitle'),
                            isSelected: _filterMealCards,
                            onTap: () {
                              setState(
                                  () => _filterMealCards = !_filterMealCards);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: tr('marketplace.filter_high_rating_title'),
                            subtitle: tr('marketplace.filter_high_rating_subtitle'),
                            isSelected: _filterHighRating,
                            onTap: () {
                              setState(
                                  () => _filterHighRating = !_filterHighRating);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: tr('marketplace.filter_open_now_title'),
                            subtitle: 'marketplace.filter_open_now'.tr(),
                            isSelected: _filterOpenNow,
                            onTap: () {
                              setState(() => _filterOpenNow = !_filterOpenNow);
                              setStateSheet(() {});
                            },
                          ),

                          _buildFilterListItem(
                            title: tr('marketplace.filter_vegetarian_title'),
                            subtitle: 'marketplace.filter_vegetarian'.tr(),
                            isSelected: _filterVegetarian,
                            onTap: () {
                              setState(
                                  () => _filterVegetarian = !_filterVegetarian);
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
                    padding: EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardBg,
                      boxShadow: [
                        BoxShadow(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.3),
                          blurRadius: 10,
                          offset: Offset(0, -2),
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
                            tr('marketplace.show_businesses', args: ['$totalResults']),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.surface,
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
    bool useRadio = false,
  }) {
    return Builder(
      builder: (context) {
        final textColor = Theme.of(context).colorScheme.onSurface;
        final subtitleColor =
            Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);

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
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: tunaGreen.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                tr('marketplace.filter_recommended'),
                                style:
                                    const TextStyle(color: tunaGreen, fontSize: 10),
                              ),
                            ),
                          ],
                        ],
                      ),
                      SizedBox(height: 2),
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
                // Radio (round) or Checkbox (square) based on useRadio
                useRadio
                  ? Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected ? lokmaPink : subtitleColor,
                          width: 2,
                        ),
                      ),
                      child: isSelected
                          ? Center(
                              child: Container(
                                width: 12,
                                height: 12,
                                decoration: BoxDecoration(
                                  color: lokmaPink,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            )
                          : null,
                    )
                  : Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: isSelected ? lokmaPink : Colors.transparent,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: isSelected ? lokmaPink : subtitleColor,
                          width: 1.5,
                        ),
                      ),
                      child: isSelected
                          ? Icon(Icons.check,
                              color: Theme.of(context).colorScheme.surface,
                              size: 16)
                          : null,
                    ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Extracted Hero UI for Masa when no table is scanned yet
  Widget _buildMasaHeroHeader() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ============================
        // 4A) ACTIVE SESSION BUTTON
        // ============================
        if (_activeSessionId != null) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: GestureDetector(
              onTap: () async {
                // Attempt to resume the session first to get valid data
                final notifier = ref.read(tableGroupProvider.notifier);
                final success =
                    await notifier.resumeSession(_activeSessionId!);
                if (success && mounted) {
                  final session = ref.read(tableGroupProvider).session;
                  if (session != null) {
                    Navigator.of(context, rootNavigator: true).push(
                      MaterialPageRoute(
                        builder: (_) => GroupTableOrderScreen(
                          businessId: session.businessId,
                          businessName: session.businessName,
                          tableNumber: session.tableNumber,
                          sessionId: session.id,
                        ),
                      ),
                    );
                  }
                } else if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(tr('home.session_expired'))));
                  setState(() {
                    _activeSessionId = null;
                  });
                  notifier.clearSession();
                }
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                    vertical: 14, horizontal: 16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.teal.shade500,
                      Colors.teal.shade600,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.teal.withValues(alpha: 0.2),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .surface
                            .withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.history,
                        size: 20,
                        color: Theme.of(context).colorScheme.surface,
                      ),
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr('home.return_active_order'),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color:
                                  Theme.of(context).colorScheme.surface,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            tr('home.return_active_desc'),
                            style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context)
                                  .colorScheme
                                  .surface
                                  .withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward_ios,
                      size: 16,
                      color: Theme.of(context)
                          .colorScheme
                          .surface
                          .withValues(alpha: 0.7),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],

        // ============================
        // HERO QR SCAN BUTTON
        // ============================
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: GestureDetector(
            onTap: _showMasaQrScanSheet,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFFFB335B),
                    Color(0xFFE91E63),
                    Color(0xFFD81B60),
                  ],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .surface
                          .withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.qr_code_scanner,
                      size: 30,
                      color: Theme.of(context).colorScheme.surface,
                    ),
                  ),
                  SizedBox(height: 12),
                  Text(
                    tr('home.order_with_qr'),
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w500,
                      color: Theme.of(context).colorScheme.surface,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tr('home.scan_qr_table'),
                    style: TextStyle(
                      fontSize: 13,
                      color: Theme.of(context)
                          .colorScheme
                          .surface
                          .withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // =====================================================
  // 🔳 MASA SCANNED TABLE BANNER
  // =====================================================

  /// 🔳 Banner shown when Masa delivery mode is active and a table is scanned
  Widget _buildScannedTableBanner() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Colors.green.withValues(alpha: isDark ? 0.2 : 0.12),
              Colors.green.withValues(alpha: isDark ? 0.1 : 0.06),
            ],
          ),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.check_circle,
                  color: Colors.green, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Masa $_scannedTableNumber${_scannedBusinessName != null ? ' — $_scannedBusinessName' : ''}',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  Text(
                    'QR kod ile doğrulandı ✓',
                    style: TextStyle(fontSize: 12, color: Colors.green[700]),
                  ),
                ],
              ),
            ),
            GestureDetector(
              onTap: () {
                setState(() {
                  _scannedTableNumber = null;
                  _scannedBusinessId = null;
                  _scannedBusinessName = null;
                });
                _showMasaQrScanSheet();
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Değiştir',
                  style: TextStyle(
                      color: Colors.green[700],
                      fontSize: 12,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 📷 QR Scanner Bottom Sheet (Masa mode)
  void _showMasaQrScanSheet() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        bool isScanned = false;

        return Container(
          height: MediaQuery.of(context).size.height * 0.75,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF2A2A28) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3),
                blurRadius: 30,
                offset: const Offset(0, -10),
              ),
            ],
          ),
          child: Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              const SizedBox(height: 20),

              // Header
              Icon(Icons.qr_code_scanner, size: 36, color: lokmaPink),
              const SizedBox(height: 12),
              Text(
                'Masanızdaki QR Kodu Okutun',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Sipariş vermek için masanızdaki QR kodu taratın',
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),

              const SizedBox(height: 24),

              // Camera Scanner
              Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 32),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border:
                        Border.all(color: lokmaPink.withValues(alpha: 0.4), width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: lokmaPink.withValues(alpha: 0.1),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: MobileScanner(
                      onDetect: (capture) {
                        if (isScanned) return;
                        final barcodes = capture.barcodes;
                        if (barcodes.isEmpty) return;

                        final rawValue = barcodes.first.rawValue ?? '';
                        if (rawValue.isEmpty) return;

                        isScanned = true;

                        // Extract table number + businessId from QR data
                        // Format: https://lokma.web.app/dinein/{businessId}/table/{num}
                        // Simple: "masa:5", "table:5", "MASA-5", or just "5"
                        String tableNum = rawValue;
                        String? businessId;

                        final urlMatch = RegExp(r'/dinein/([^/]+)/table/(\d+)')
                            .firstMatch(rawValue);
                        if (urlMatch != null) {
                          businessId = urlMatch.group(1)!;
                          tableNum = urlMatch.group(2)!;
                        } else {
                          // Try /table/{num} format without businessId
                          final tableMatch =
                              RegExp(r'/table/(\d+)').firstMatch(rawValue);
                          if (tableMatch != null) {
                            tableNum = tableMatch.group(1)!;
                          } else if (rawValue.toLowerCase().contains('masa')) {
                            final match = RegExp(r'(\d+)').firstMatch(rawValue);
                            tableNum = match?.group(1) ?? rawValue;
                          } else if (rawValue.toLowerCase().contains('table')) {
                            final match = RegExp(r'(\d+)').firstMatch(rawValue);
                            tableNum = match?.group(1) ?? rawValue;
                          }
                        }

                        // Success haptic + close
                        HapticFeedback.heavyImpact();
                        Navigator.pop(ctx);

                        _handleMasaQrScanned(tableNum, businessId);
                      },
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Manual entry option
              TextButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _showMasaManualTableEntry();
                },
                icon: Icon(Icons.edit, size: 18, color: lokmaPink),
                label: Text(
                  'Manuel masa numarası gir',
                  style: TextStyle(color: lokmaPink, fontSize: 14),
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  /// 🔢 Manual Table Number Entry Dialog (Masa mode)
  void _showMasaManualTableEntry() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final controller = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.restaurant, color: lokmaPink, size: 24),
            const SizedBox(width: 8),
            Text(
              'Masa Numarası',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ],
        ),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Örn: 5',
            hintStyle: TextStyle(color: Colors.grey[500]),
            filled: true,
            fillColor: isDark ? Colors.grey[800] : Colors.grey[100],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            prefixIcon: Icon(Icons.tag, color: lokmaPink),
          ),
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('İptal', style: TextStyle(color: Colors.grey[500])),
          ),
          FilledButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isNotEmpty) {
                Navigator.pop(ctx);
                _handleMasaQrScanned(text, null);
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: lokmaPink,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(tr('common.confirm')),
          ),
        ],
      ),
    );
  }

  /// 🎯 Handle QR table scanned — check for active group session
  Future<void> _handleMasaQrScanned(String tableNum, String? businessId) async {
    // If businessId came from QR code, try to resolve business name
    String? businessName;

    if (businessId != null && businessId.isNotEmpty) {
      try {
        final doc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(businessId)
            .get();
        if (doc.exists) {
          final data = doc.data()!;
          businessName = data['companyName'] as String? ??
              data['businessName'] as String? ??
              'İşletme';
        }
      } catch (e) {
        debugPrint('Error resolving business: $e');
      }
    }

    // If no businessId, try to use the first visible Masa business
    if (businessId == null || businessId.isEmpty) {
      final masaBusinesses = _filteredBusinesses;
      if (masaBusinesses.isNotEmpty) {
        final first = masaBusinesses.first;
        businessId = first.id;
        final data = first.data() as Map<String, dynamic>;
        businessName = data['companyName'] as String? ??
            data['businessName'] as String? ??
            'İşletme';
      }
    }

    if (businessId == null || businessId.isEmpty) {
      // No business found — just set table number
      _setScannedTable(tableNum, null, null);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle,
                    color: Theme.of(context).colorScheme.surface, size: 20),
                const SizedBox(width: 8),
                Text('Masa $tableNum seçildi ✓'),
              ],
            ),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            duration: const Duration(seconds: 2),
          ),
        );
      }
      return;
    }

    // Check for active group session at this table
    try {
      final activeSession = await TableGroupService.instance
          .findActiveSession(businessId, tableNum);

      if (!mounted) return;

      if (activeSession != null) {
        final user = FirebaseAuth.instance.currentUser;
        bool isAlreadyInGroup = false;

        if (user != null) {
          isAlreadyInGroup = activeSession.hostUserId == user.uid ||
              activeSession.participants.any((p) => p.userId == user.uid);
        }

        if (isAlreadyInGroup) {
          // Bypass dialog, directly enter the group session
          _setScannedTable(tableNum, businessId, businessName);
          Navigator.of(context, rootNavigator: true).push(
            MaterialPageRoute(
              builder: (_) => GroupTableOrderScreen(
                businessId: businessId ?? '',
                businessName: businessName ?? 'İşletme',
                tableNumber: tableNum,
                sessionId: activeSession.id,
              ),
            ),
          );
        } else {
          // Active session found — show join dialog
          _showMasaJoinGroupDialog(
              activeSession, tableNum, businessId, businessName ?? 'İşletme');
        }
      } else {
        // No active session — show create or solo option
        // Clear any old, stale session cache completely
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove('table_group_session_id');
        ref.read(tableGroupProvider.notifier).clearSession();

        _showMasaCreateGroupDialog(
            tableNum, businessId, businessName ?? 'İşletme');
      }
    } catch (e) {
      debugPrint('Error checking group session: $e');
      // Fallback: just set table number
      if (mounted) {
        _setScannedTable(tableNum, businessId, businessName);
      }
    }
  }

  /// 🤝 Join existing group session dialog
  void _showMasaJoinGroupDialog(
    dynamic activeSession,
    String tableNum,
    String businessId,
    String businessName,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final participantCount = (activeSession as dynamic).participantCount ?? 1;
    final pinController = TextEditingController();
    final nameController = TextEditingController();
    final user = FirebaseAuth.instance.currentUser;
    final isAnonymous = user?.isAnonymous ?? true;
    String? pinError;

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.white,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
              24,
              24,
              24,
              24 +
                  MediaQuery.of(context).padding.bottom +
                  MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Icon(Icons.groups, size: 48, color: lokmaPink),
              const SizedBox(height: 12),
              Text(
                'Masa $tableNum — Aktif Grup Siparişi',
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                'Bu masada $participantCount kişilik aktif bir grup siparişi var.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.grey[600]),
              ),
              const SizedBox(height: 20),

              // Name input for anonymous users
              if (isAnonymous) ...[
                Text(
                  'İsminiz',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: nameController,
                  textCapitalization: TextCapitalization.words,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Örn: Ahmet',
                    hintStyle: TextStyle(color: Colors.grey[400]),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: Colors.grey[300]!),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: lokmaPink, width: 2),
                    ),
                    filled: true,
                    fillColor:
                        isDark ? const Color(0xFF2A2A28) : Colors.grey[50],
                    prefixIcon:
                        Icon(Icons.person_outline, color: Colors.grey[400]),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Hesap oluşturmak zorunlu değil — sadece gruba isminizle katılın.',
                  style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                ),
                const SizedBox(height: 16),
              ],

              // PIN entry
              Text(
                'Grup PIN Kodu',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white70 : Colors.black54,
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: 200,
                child: TextField(
                  controller: pinController,
                  autofocus: true,
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 12,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: '• • • •',
                    hintStyle:
                        TextStyle(color: Colors.grey[400], letterSpacing: 12),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                          color: pinError != null
                              ? Colors.red
                              : Colors.grey[300]!),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                          color: pinError != null ? Colors.red : lokmaPink,
                          width: 2),
                    ),
                    filled: true,
                    fillColor:
                        isDark ? const Color(0xFF2A2A28) : Colors.grey[50],
                  ),
                  onChanged: (_) {
                    if (pinError != null) {
                      setSheetState(() => pinError = null);
                    }
                  },
                ),
              ),
              if (pinError != null) ...[
                const SizedBox(height: 8),
                Text(
                  pinError!,
                  style: const TextStyle(
                      color: Colors.red,
                      fontSize: 13,
                      fontWeight: FontWeight.w500),
                ),
              ],
              const SizedBox(height: 20),

              // Join group button
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () async {
                    final pin = pinController.text.trim();
                    if (pin.length != 4) {
                      setSheetState(
                          () => pinError = '4 haneli PIN kodu giriniz');
                      return;
                    }
                    try {
                      final groupNotifier =
                          ref.read(tableGroupProvider.notifier);
                      final success = await groupNotifier.joinSession(
                        activeSession.id,
                        pin: pin,
                        displayName:
                            isAnonymous ? nameController.text.trim() : null,
                      );
                      if (success && mounted) {
                        Navigator.pop(ctx);
                        _setScannedTable(tableNum, businessId, businessName);
                        Navigator.of(context, rootNavigator: true).push(
                          MaterialPageRoute(
                            builder: (_) => GroupTableOrderScreen(
                              businessId: businessId,
                              businessName: businessName,
                              tableNumber: tableNum,
                              sessionId: activeSession.id,
                            ),
                          ),
                        );
                      }
                    } catch (e) {
                      if (e.toString().contains('WRONG_PIN')) {
                        setSheetState(
                            () => pinError = 'Yanlış PIN kodu girdiniz.');
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                  'Yanlış PIN kodu girdiniz. Lütfen grup siparişini başlatan kişiye kodu sorun.'),
                              backgroundColor: Colors.red,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      } else {
                        setSheetState(() => pinError = 'Hata: $e');
                      }
                    }
                  },
                  icon: const Icon(Icons.group_add),
                  label: Text('marketplace.join_group'.tr(),
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  style: FilledButton.styleFrom(
                    backgroundColor: lokmaPink,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),

              const SizedBox(height: 10),

              // Solo dine-in option
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _setScannedTable(tableNum, businessId, businessName);
                    if (businessId.isNotEmpty) {
                      context
                          .push('/kasap/$businessId?mode=masa&table=$tableNum');
                    }
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.grey[600],
                    side: BorderSide(color: Colors.grey[300]!),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text('marketplace.single_order'.tr(),
                      style: TextStyle(fontSize: 16, color: Colors.grey[600])),
                ),
              ),
              const SizedBox(height: 16),

              // Reset Session Option
              TextButton(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (confirmCtx) => AlertDialog(
                      title: Text(tr('auth.close_session')),
                      content: const Text(
                        'Şifreye ulaşamıyor musunuz? Masadaki mevcut sipariş oturumunu kapatıp baştan başlayabilirsiniz. Bu işlem mevcut gruptakilerin siparişe devam etmesini engeller. Devam etmek istiyor musunuz?',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(confirmCtx),
                          child: Text('common.give_up'.tr(),
                              style: TextStyle(color: Colors.grey)),
                        ),
                        TextButton(
                          onPressed: () async {
                            Navigator.pop(confirmCtx); // close confirm dialog
                            Navigator.pop(ctx); // close join bottom sheet

                            // Cancel current session
                            try {
                              await TableGroupService.instance
                                  .cancelSession(activeSession.id);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                        'Önceki oturum kapatıldı. Şimdi yeni bir başlangıç yapabilirsiniz.'),
                                    backgroundColor: Colors.green,
                                  ),
                                );
                                // Show create dialog directly after cleanup
                                _showMasaCreateGroupDialog(
                                    tableNum, businessId, businessName);
                              }
                            } catch (e) {
                              debugPrint('Hata cancelling session: $e');
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Hata: $e'),
                                    backgroundColor: Colors.red,
                                  ),
                                );
                              }
                            }
                          },
                          child: Text('marketplace.yes_close_session'.tr(),
                              style: TextStyle(
                                  color: Colors.red,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  );
                },
                child: const Text(
                  'Şifreyi Öğrenemiyorum / Oturumu Sıfırla',
                  style: TextStyle(
                      color: Colors.red,
                      fontSize: 13,
                      decoration: TextDecoration.underline),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  /// 🆕 Create new group session dialog
  void _showMasaCreateGroupDialog(
    String tableNum,
    String businessId,
    String businessName,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.white,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
            24, 24, 24, 24 + MediaQuery.of(context).padding.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Icon(Icons.restaurant, size: 48, color: lokmaPink),
            const SizedBox(height: 12),
            Text(
              'Masa $tableNum — $businessName',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              'Birden fazla kişi mi sipariş verecek?',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),

            // Start group order
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _createAndNavigateGroupFromMasa(
                      tableNum, businessId, businessName);
                },
                icon: const Icon(Icons.groups),
                label: Text('marketplace.start_group_order'.tr(),
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                style: FilledButton.styleFrom(
                  backgroundColor: lokmaPink,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),

            const SizedBox(height: 10),

            // Solo dine-in
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _setScannedTable(tableNum, businessId, businessName);
                  if (businessId.isNotEmpty) {
                    context
                        .push('/kasap/$businessId?mode=masa&table=$tableNum');
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Row(
                          children: [
                            Icon(Icons.check_circle,
                                color: Theme.of(context).colorScheme.surface,
                                size: 20),
                            const SizedBox(width: 8),
                            Text('Masa $tableNum doğrulandı ✓'),
                          ],
                        ),
                        backgroundColor: Colors.green,
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  }
                },
                icon: Icon(Icons.person, color: Colors.grey[600]),
                label: Text(
                  'Tek Kişi Sipariş',
                  style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.grey[300]!),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  /// Create new group session and navigate
  Future<void> _createAndNavigateGroupFromMasa(
    String tableNum,
    String businessId,
    String businessName,
  ) async {
    try {
      final groupNotifier = ref.read(tableGroupProvider.notifier);
      final session = await groupNotifier.createSession(
        businessId: businessId,
        businessName: businessName,
        tableNumber: tableNum,
      );

      if (session == null || !mounted) return;

      _setScannedTable(tableNum, businessId, businessName);

      // Show PIN to host before navigating
      final pin = session.groupPin ?? '----';
      final isDark = Theme.of(context).brightness == Brightness.dark;

      await showModalBottomSheet(
        context: context,
        useRootNavigator: true,
        isDismissible: false,
        enableDrag: false,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.white,
        builder: (ctx) => SafeArea(
            child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: lokmaPink.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.lock_outline, size: 40, color: lokmaPink),
              ),
              const SizedBox(height: 16),
              Text(
                'Grup PIN Kodu',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 16),
              // Large PIN display
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2A2A28) : Colors.grey[100],
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                      color: lokmaPink.withValues(alpha: 0.3), width: 2),
                ),
                child: Text(
                  pin.split('').join(' '),
                  style: TextStyle(
                    fontSize: 40,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 8,
                    color: lokmaPink,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Bu kodu masadaki diğer kişilerle paylaşın.\nGruba katılmak için bu PIN gerekli.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 14, color: Colors.grey[600], height: 1.5),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.check_circle_outline),
                  label: Text('common.ok_got_it'.tr(),
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  style: FilledButton.styleFrom(
                    backgroundColor: lokmaPink,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        )),
      );

      // Navigate to group order screen after PIN is acknowledged
      if (mounted) {
        Navigator.of(context, rootNavigator: true).push(
          MaterialPageRoute(
            builder: (_) => GroupTableOrderScreen(
              businessId: businessId,
              businessName: businessName,
              tableNumber: tableNum,
              sessionId: ref.read(tableGroupProvider).session?.id,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Grup oluşturulurken hata: $e'),
              backgroundColor: Colors.red),
        );
      }
    }
  }
}
