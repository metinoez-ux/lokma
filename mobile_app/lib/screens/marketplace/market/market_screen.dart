import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:geolocator/geolocator.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/widgets/address_selection_sheet.dart';
import 'package:lokma_app/widgets/open_partners_map_sheet.dart';
import 'package:lokma_app/widgets/sponsored_banner_card.dart';
import 'package:lokma_app/services/sponsored_ad_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../utils/currency_utils.dart';
import 'package:flutter_svg/flutter_svg.dart';

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
  final String _userAddress = 'marketplace.getting_location'.tr(); // ignore: unused_field
  bool _isLoadingLocation = true; // ignore: unused_field
  double? _userLat;
  double? _userLng;
  
  // Distance slider (km) - Market için max 15 km
  double _maxDistance = 100.0;
  bool _sliderAutoSet = false; // Auto-snap slider to nearest business once
  
  // Dynamic categories from Firestore
  Map<String, int> _businessTypeCounts = {}; // ignore: unused_field
  List<DocumentSnapshot> _allBusinesses = [];
  bool _isLoading = true;
  
  // 🆕 Canlı Firestore stream subscription
  StreamSubscription<QuerySnapshot>? _businessesSubscription;
  
  // Dynamic sector types from Firestore 'sectors' collection
  Set<String> _marketSectorTypes = {};
  
  // Sorting option
  String _sortOption = 'nearest'; // nearest, rating, tuna, az, za
  
  // Sponsored ads
  List<SponsoredAd> _sponsoredAds = [];
  
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
    _loadSponsoredAds();
  }
  
  /// TUNA brand info bottom sheet (same as business_detail_screen)
  void _showTunaBrandInfo() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Color(0xFF1E1E1E),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Red Brand Header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                decoration: const BoxDecoration(
                  color: Color(0xFFFB335B),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 40, height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                    ),
                    Image.asset('assets/images/tuna_logo.png', height: 60,
                        errorBuilder: (_, __, ___) => const Text('TUNA',
                            style: TextStyle(fontFamily: 'Cursive', fontSize: 40,
                                color: Colors.white, fontWeight: FontWeight.w600))),
                    const SizedBox(height: 16),
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
                  controller: scrollController,
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(
                      'Unsere Reise begann 1987 als kleine Metzgerei in Köln und hat sich heute zu einer der modernsten integrierten Halal-Fleischproduktionsstätten Europas entwickelt.',
                      style: const TextStyle(color: Colors.white70, fontSize: 15, height: 1.5),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildBrandIconElement(Icons.verified, 'marketplace.helal_kesim'.tr(), Colors.green),
                        _buildBrandIconElement(Icons.bolt, 'marketplace.soksuz_kesim'.tr(), Colors.amber),
                        _buildBrandIconElement(Icons.clean_hands, 'marketplace.kuru_yolum'.tr(), Colors.amber),
                      ],
                    ),
                    const SizedBox(height: 32),
                    Text('marketplace.supply_standards'.tr(),
                        style: const TextStyle(color: Color(0xFFE0E0E0), fontSize: 18, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 16),
                    _buildCheckItem('marketplace.helal_kesim'.tr(), 'marketplace.helal_kesim_desc'.tr()),
                    _buildCheckItem('marketplace.elle_kesim'.tr(), 'marketplace.elle_kesim_desc'.tr()),
                    _buildCheckItem('marketplace.soksuz_kesim'.tr(), 'marketplace.soksuz_kesim_desc'.tr()),
                    _buildCheckItem('marketplace.kuru_yolum'.tr(), 'marketplace.kuru_yolum_desc'.tr()),
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
            color: color.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12), textAlign: TextAlign.center),
      ],
    );
  }

  Widget _buildCheckItem(String title, String desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
                const SizedBox(height: 2),
                Text(desc, style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Sponsored reklamlari yukle
  Future<void> _loadSponsoredAds() async {
    final ads = await SponsoredAdService().getActiveSponsoredAds(
      userLat: _userLat,
      userLng: _userLng,
    );
    if (mounted) {
      setState(() => _sponsoredAds = ads);
    }
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
  
  // Check if business is currently open based on openingHours, deliveryHours, pickupHours
  bool _isBusinessOpenNow(Map<String, dynamic> data) {
    final now = DateTime.now();
    if (data['openingHours'] != null) {
      if (OpeningHoursHelper(data['openingHours']).isOpenAt(now)) return true;
    }
    if (data['deliveryHours'] != null) {
      if (OpeningHoursHelper(data['deliveryHours']).isOpenAt(now)) return true;
    }
    if (data['pickupHours'] != null) {
      if (OpeningHoursHelper(data['pickupHours']).isOpenAt(now)) return true;
    }
    // If no hours data at all, default to open
    if (data['openingHours'] == null && data['deliveryHours'] == null && data['pickupHours'] == null) {
      return true;
    }
    return false;
  }

  String? _currentBusinessIdForDialog;

  /// 🆕 Check if business is available for the currently selected mode (ported from restoran)
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

    final deliveryStartTime = data['deliveryStartTime'] as String?;
    final pickupStartTime = data['pickupStartTime'] as String?;

    // First check openingHours — if business is closed per its schedule, mark unavailable
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
        return (
          isAvailable: false,
          reason: 'marketplace.courier_not_available'.tr(),
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
        return (
          isAvailable: false,
          reason: tr('marketplace.pickup_paused'),
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

  /// 🆕 Show unified dialog for closed/unavailable business (ported from restoran)
  void _showClosedBusinessDialog(
      BuildContext context, String businessName, String? reason, Map<String, dynamic> businessData) {
    final preOrderEnabled = businessData['preOrderEnabled'] as bool? ?? false;
    
    // Calculate next opening time
    // Use deliveryHours/pickupHours as fallback for next opening calculation
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
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    final businessId = _currentBusinessIdForDialog;
                    if (businessId != null) {
                      context.push('/kasap/$businessId?mode=$_deliveryMode&closedAck=true');
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
                        activeSegment: 'markt',
                        sectorTypes: _marketSectorTypes,
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
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              pinned: true,
              floating: false,
              clipBehavior: Clip.hardEdge,
              expandedHeight: _deliveryMode == 'gelal' ? 210 : 175,
              collapsedHeight: 120, // Daraltılmış yükseklik (sadece konum + arama)
              automaticallyImplyLeading: false,
              flexibleSpace: LayoutBuilder(
                builder: (context, constraints) {
                  // Scroll oranını hesapla (0 = tamamen açık, 1 = tamamen kapalı)
                  final expandedHeight = _deliveryMode == 'gelal' ? 210.0 : 175.0;
                  final collapsedHeight = 120.0;
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
                                    
                                    // Sadece gel-al modunda Mesafe slider
                                    if (_deliveryMode == 'gelal')
                                      _buildDistanceSliderWithTuna(),
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
            
            // "Bei X Partnern bestellen" header — matches Essen tab
            if (!_isLoading && _filteredBusinesses.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 7, 20, 8),
                  child: Text(
                    tr('marketplace.order_at_partners', namedArgs: {'count': '${_filteredBusinesses.length}'}),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                      letterSpacing: -0.2,
                    ),
                  ),
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
    
    String cityName = 'marketplace.getting_location'.tr();
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
          cityName = location.address.isNotEmpty ? location.address : 'marketplace.location_permission_denied'.tr();
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
                          color: lokmaPink,
                          size: 20,
                        ),
                      ),
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
          context.push('/search?segment=market');
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
                  style: TextStyle(color: Colors.grey[600], fontSize: 14, fontWeight: FontWeight.w400),
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
    // 🧪 EXPERIMENT: Testing new LOKMA brand color #F41C54
    const accent = Color(0xFFF41C54);

    return ThreeDimensionalPillTabBar(
      selectedIndex: selectedIndex,
      activeColor: accent,
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
    
    // Gel Al mode defaults to 5km
    if (_deliveryMode == 'gelal') {
      if (mounted) {
        setState(() {
          _sliderAutoSet = true;
          _currentStepIndex = 0; // 5 km is at index 0 for Market (5, 10, ...)
          _maxDistance = 5.0;
        });
      }
      debugPrint('🎯 Market auto-set: gelal mode, maxDistance defaulting to 5.0km');
      return;
    }

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
  
  // 🆕 TUNA Marketler toggle only (for Kurye mode - no distance slider)
  // ignore: unused_element
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
                color: _onlyTuna ? const Color(0xFFA01E22) : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _onlyTuna ? const Color(0xFFA01E22) : Colors.grey.shade400,
                  width: 1.5,
                ),
              ),
              child: Text(
                'TUNA',
                style: TextStyle(
                  color: _onlyTuna ? const Color(0xFF69B445) : Colors.grey[600],
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
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

    // Sponsored ads: ilk pozisyona bir reklam, sonra her 6 kartta bir
    // Build mixed list: ads + business cards
    final List<Widget> items = [];
    int adIndex = 0;
    
    // Ilk sirada bir sponsored ad (varsa)
    if (_sponsoredAds.isNotEmpty) {
      items.add(SponsoredBannerCard(
        ad: _sponsoredAds[adIndex % _sponsoredAds.length],
        userLat: _userLat,
        userLng: _userLng,
      ));
      adIndex++;
    }
    
    for (int i = 0; i < markets.length; i++) {
      final doc = markets[i];
      final data = doc.data() as Map<String, dynamic>;
      items.add(_buildMarketCard(doc.id, data));
      
      // Her 6 kartta bir sponsored ad ekle
      if ((i + 1) % 6 == 0 && _sponsoredAds.isNotEmpty) {
        items.add(SponsoredBannerCard(
          ad: _sponsoredAds[adIndex % _sponsoredAds.length],
          userLat: _userLat,
          userLng: _userLng,
        ));
        adIndex++;
      }
    }
    
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => items[index],
        childCount: items.length,
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
    // TUNA Partner check
    final brandLabel = data['brandLabel'] as String?;
    final brand = data['brand'] as String?;
    final tags = data['tags'] as List<dynamic>?;
    final hasTunaTag = tags?.any((t) => t.toString().toLowerCase() == 'tuna') ?? false;
    final isTunaPartner = (data['isTunaPartner'] as bool? ?? false) ||
                          (brandLabel?.toLowerCase() == 'tuna') ||
                          (brand?.toLowerCase() == 'tuna') ||
                          hasTunaTag;
    
    final rating = (data['rating'] as num?)?.toDouble() ?? 4.0;
    final reviewCount = (data['reviewCount'] as num?)?.toInt() ?? 0;
    final imageUrl = data['imageUrl'] as String?;
    final logoUrl = data['logoUrl'] as String?;
    final cuisineType = data['cuisineType'] as String?;
    
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
    
    // 🆕 Mode-aware availability (ported from restoran)
    final availability = _checkAvailabilityForMode(data, _deliveryMode);
    final isAvailable = availability.isAvailable;
    
    // Review count text
    String reviewText = '';
    if (reviewCount > 0) {
      if (reviewCount >= 1000) {
        reviewText = '(${(reviewCount / 1000).toStringAsFixed(1)}k+)';
      } else {
        reviewText = '($reviewCount)';
      }
    }

    // 🆕 Dynamic banner top offset (same logic as restoran)
    // Build the banner text to determine if a banner exists
    String? bannerText;
    if (!isAvailable && availability.reason != null) {
      bannerText = availability.reason;
    }
    final bool hasBanner = bannerText != null;
    final double bannerTopOffset = hasBanner ? 36.0 : 12.0;
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        if (!isAvailable) {
          _currentBusinessIdForDialog = id;
          _showClosedBusinessDialog(context, name, availability.reason, data);
        } else {
          context.push('/kasap/$id');
        }
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
                // Main image - fixed height like restoran (230px)
                SizedBox(
                  height: 230,
                  width: double.infinity,
                  child: imageUrl != null && imageUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            color: Theme.of(context).colorScheme.surfaceContainerHighest,
                            child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                          ),
                          errorWidget: (_, __, ___) => Container(
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
                if (!isAvailable)
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.4),
                      ),
                    ),
                  ),
                  
                // 🆕 Top-aligned availability banner (matching restoran)
                if (hasBanner)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: const BoxDecoration(
                        color: Color(0xFF2C2C2E),
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(12),
                          topRight: Radius.circular(12),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          bannerText!,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                    ),
                  ),
                
                // Business logo (bottom left, overlapping)
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
                        child: CachedNetworkImage(
                          imageUrl: logoUrl,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => const Center(
                            child: Icon(Icons.store, color: tunaGreen, size: 24),
                          ),
                        ),
                      ),
                    ),
                  ),
                
                // 🆕 TUNA brand badge (dynamic offset) - tıklanabilir
                if (isTunaPartner)
                  Positioned(
                    left: 12,
                    top: bannerTopOffset,
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        _showTunaBrandInfo();
                      },
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
                
                // 🆕 Favorite button (dynamic offset, matching restoran)
                Positioned(
                  top: bannerTopOffset,
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

                // 🪑 Online Masa Rezervasyonu badge (BOTTOM RIGHT)
                if (data['hasReservation'] == true)
                  Builder(
                    builder: (context) {
                      final cartState = ref.watch(cartProvider);
                      final hasItemsInCart = cartState.butcherId == id && cartState.items.isNotEmpty;
                      return Positioned(
                        right: 12,
                        bottom: hasItemsInCart ? 66 : 12,
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
                                const Text(
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
                      );
                    },
                  ),

                // 🆕 Cart badge (bottom right) - only when available
                if (isAvailable)
                  Builder(
                    builder: (context) {
                      final cartState = ref.watch(cartProvider);
                      if (cartState.butcherId == id &&
                          cartState.items.isNotEmpty) {
                        return Positioned(
                          right: 12,
                          bottom: 12,
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurface
                                      .withValues(alpha: 0.2),
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
                                  color:
                                      Theme.of(context).colorScheme.primary,
                                  size: 24,
                                ),
                                Positioned(
                                  right: -8,
                                  top: -8,
                                  child: Container(
                                    padding: EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primary,
                                      shape: BoxShape.circle,
                                    ),
                                    constraints: BoxConstraints(
                                        minWidth: 18, minHeight: 18),
                                    child: Center(
                                      child: Text(
                                        '${cartState.items.length}',
                                        style: TextStyle(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .surface,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
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

            // Info section (below image)
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
                          fontWeight: FontWeight.w600,
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
                                  (data['minOrderAmount'] as num?)
                                          ?.toDouble() ??
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
                                // PICKUP MODE
                                if (distanceText.isEmpty) return const SizedBox.shrink();
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
                                      distanceText,
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
                  // Header Bar — Lieferando style with pill buttons
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
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
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
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
                              _filterVegetarian = false;
                              _filterTunaProducts = false;
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
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
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
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
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
                          _buildFilterListItem(
                            title: 'TUNA',
                            subtitle: tr('marketplace.filter_recommended'),
                            isSelected: _sortOption == 'tuna',
                            useRadio: true,
                            isPremium: true,
                            onTap: () {
                              setState(() => _sortOption = 'tuna');
                              setStateSheet(() {});
                            },
                          ),
                          
                          const SizedBox(height: 24),

                          // İşletme Türü Section Header
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              tr('marketplace.business_type_section'),
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
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
                            final label = MARKET_TYPE_LABELS[typeKey] ?? typeKey;
                            
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
                          
                          // 🆕 Hızlı Filtreler Section Header
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              tr('marketplace.quick_filters_section'),
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          
                          // 🔴 TUNA/Toros Ürünleri Filtresi (EN ÜSTTE)
                          Builder(
                            builder: (context) {
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
                            title: tr('marketplace.filter_campaigns_title'),
                            subtitle: 'marketplace.filter_campaigns'.tr(),
                            isSelected: _filterDiscounts,
                            onTap: () {
                              setState(() => _filterDiscounts = !_filterDiscounts);
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
                              setState(() => _filterFreeDelivery = !_filterFreeDelivery);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: tr('marketplace.filter_meal_cards_title'),
                            subtitle: tr('marketplace.filter_meal_cards_subtitle'),
                            isSelected: _filterMealCards,
                            onTap: () {
                              setState(() => _filterMealCards = !_filterMealCards);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: tr('marketplace.filter_high_rating_title'),
                            subtitle: tr('marketplace.filter_high_rating_subtitle'),
                            isSelected: _filterHighRating,
                            onTap: () {
                              setState(() => _filterHighRating = !_filterHighRating);
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
                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3),
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

}
