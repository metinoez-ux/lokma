import 'dart:async';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/widgets/kermes_card.dart';
import 'package:lokma_app/services/kermes_favorite_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:lokma_app/utils/time_utils.dart' as time_utils;
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:lokma_app/widgets/address_selection_sheet.dart';
import 'package:go_router/go_router.dart';

/// Kermes Listesi - Yemek segmenti ile ayni UI yapisi
/// Theme-aware, smart search, toggle switches, filter bottom sheet
class KermesListScreen extends ConsumerStatefulWidget {
  const KermesListScreen({super.key});

  @override
  ConsumerState<KermesListScreen> createState() => _KermesListScreenState();
}

class _KermesListScreenState extends ConsumerState<KermesListScreen> {
  // ============== BRAND COLORS ==============
  static const Color lokmaPink = Color(0xFFF41C54);

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

  // Delivery mode: 'teslimat', 'gelal', 'masa'
  String _deliveryMode = 'gelal'; // Kermes default: Gel Al

  // Quick filters
  bool _filterKidsActivities = false;
  bool _filterOutdoor = false;
  bool _filterFamilyArea = false;
  bool _filterCardPayment = false;
  bool _filterFreeEntry = false;
  bool _filterHelal = false;
  bool _filterVegetarian = false;
  bool _filterLiveMusic = false;
  bool _filterParking = false;
  bool _filterTuna = false;
  bool _filterAkdenizToros = false;

  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _kermesSubscription;

  // Eyalet kisaltma mapping
  static const Map<String, List<String>> stateAliases = {
    'nordrhein-westfalen': ['nrw', 'nordrhein westfalen', 'nordrhein'],
    'baden-württemberg': ['bw', 'baden wurttemberg', 'baden württemberg', 'baden wuerttemberg'],
    'bayern': ['by', 'bavaria', 'bavyera'],
    'niedersachsen': ['ni', 'lower saxony'],
    'hessen': ['he', 'hessen'],
    'sachsen': ['sn', 'saxony'],
    'rheinland-pfalz': ['rp', 'rheinland pfalz', 'rhineland palatinate'],
    'schleswig-holstein': ['sh'],
    'brandenburg': ['bb'],
    'mecklenburg-vorpommern': ['mv', 'mecklenburg vorpommern'],
    'thüringen': ['th', 'thuringen', 'thuringia'],
    'sachsen-anhalt': ['st', 'sachsen anhalt', 'saxony anhalt'],
    'hamburg': ['hh'],
    'berlin': ['be'],
    'bremen': ['hb'],
    'saarland': ['sl'],
  };

  // Ulke kisaltma mapping 
  static const Map<String, List<String>> countryAliases = {
    'almanya': ['deutschland', 'germany', 'de'],
    'avusturya': ['osterreich', 'austria', 'at', 'oesterreich'],
    'hollanda': ['niederlande', 'netherlands', 'nl', 'holland'],
    'fransa': ['frankreich', 'france', 'fr'],
    'belcika': ['belgien', 'belgium', 'be', 'belcika'],
    'turkiye': ['turkey', 'tr', 'turkei'],
    'sirbistan': ['serbien', 'serbia', 'rs'],
    'macaristan': ['ungarn', 'hungary', 'hu'],
    'bulgaristan': ['bulgarien', 'bulgaria', 'bg'],
    'isvicre': ['schweiz', 'switzerland', 'ch'],
  };

  @override
  void initState() {
    super.initState();
    _loadFavorites();
    _loadKermesEvents();
  }

  @override
  void dispose() {
    _kermesSubscription?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  // ============== TURKISH CHAR NORMALIZATION ==============
  String _normalizeTurkish(String text) {
    return text
        .replaceAll('ü', 'u')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('Ü', 'U')
        .replaceAll('Ö', 'O')
        .replaceAll('Ş', 'S')
        .replaceAll('Ç', 'C')
        .replaceAll('Ğ', 'G')
        .replaceAll('İ', 'I')
        .replaceAll('ä', 'a')
        .replaceAll('Ä', 'A')
        .replaceAll('ß', 'ss');
  }

  // ============== LOCATION ==============
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
      debugPrint('Kermes stream error: $e');
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
      if (snapshot.docs.isNotEmpty) {
        final List<KermesEvent> loadedEvents = [];

        for (final doc in snapshot.docs) {
          try {
            final data = doc.data();

            if (data['isActive'] != true) continue;
            if (data['isArchived'] == true) continue;

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
              debugPrint('Could not load products: $e');
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
              openingTime = time_utils.normalizeTimeString(dailyHours['open']?.toString() ?? '10:00');
              closingTime = time_utils.normalizeTimeString(dailyHours['close']?.toString() ?? '20:00');
            } else {
              openingTime = time_utils.normalizeTimeString(data['openingTime']?.toString() ?? '10:00');
              closingTime = time_utils.normalizeTimeString(data['closingTime']?.toString() ?? '20:00');
            }

            final features = (data['features'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
            final customFeatures = (data['customFeatures'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();

            String country = 'Almanya';
            if (data['address'] is Map && (data['address'] as Map)['country'] == 'DE') {
              country = 'Almanya';
            } else if (data['country'] != null) {
              country = data['country'].toString();
            }

            // Parse sponsor
            KermesSponsor sponsor = KermesSponsor.none;
            final sponsorStr = data['sponsor']?.toString().toUpperCase() ?? data['brandLabel']?.toString().toUpperCase();
            if (sponsorStr == 'TUNA') {
              sponsor = KermesSponsor.tuna;
            } else if (sponsorStr == 'AKDENIZ TOROS' || sponsorStr == 'AKDENIZ_TOROS') {
              sponsor = KermesSponsor.akdenizToros;
            }

            final event = KermesEvent(
              id: doc.id,
              city: city,
              postalCode: data['postalCode']?.toString() ?? '',
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
              sponsor: sponsor,
            );

            loadedEvents.add(event);
          } catch (docError, stackTrace) {
            debugPrint('Error parsing kermes doc ${doc.id}: $docError');
            debugPrint('   Stack: ${stackTrace.toString().split('\n').take(5).join('\n')}');
          }
        }

        loadedEvents.sort((a, b) => a.startDate.compareTo(b.startDate));
        _kermesEvents = loadedEvents;
      } else {
        _kermesEvents = [];
      }
    } catch (e, stackTrace) {
      debugPrint('Error loading kermes: $e');
      debugPrint('   Stack: ${stackTrace.toString().split('\n').take(10).join('\n')}');
      _kermesEvents = [];
    }

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  // ============== SMART SEARCH + FILTERING ==============
  List<KermesEvent> get _filteredEvents {
    var events = List<KermesEvent>.from(_kermesEvents);

    // Favorites filter
    if (_sortBy == 'favorites') {
      events = events.where((event) => _favoriteKermesIds.contains(event.id)).toList();
    }

    // Delivery mode filter
    if (_deliveryMode == 'teslimat') {
      events = events.where((event) => event.hasDelivery).toList();
    }
    // 'gelal' = hepsini goster (pickup hep mumkun)
    // 'masa' = indoor area olan kermesler (oturma alani)
    if (_deliveryMode == 'masa') {
      events = events.where((event) => event.hasIndoorArea || event.hasFamilyArea).toList();
    }

    // Smart search with normalization
    if (_searchQuery.isNotEmpty) {
      final queryLower = _searchQuery.toLowerCase().trim();
      final queryNormalized = _normalizeTurkish(queryLower);
      final queryWords = queryNormalized.split(RegExp(r'\s+')).where((w) => w.length >= 2).toList();

      if (queryWords.isNotEmpty) {
        events = events.where((event) {
          // Build searchable text from all fields
          final cityNorm = _normalizeTurkish(event.city.toLowerCase());
          final titleNorm = _normalizeTurkish(event.title.toLowerCase());
          final countryNorm = _normalizeTurkish(event.country.toLowerCase());
          final stateNorm = _normalizeTurkish((event.state ?? '').toLowerCase());
          final addressNorm = _normalizeTurkish(event.address.toLowerCase());

          // Eyalet kisaltma eslestirme
          String stateExpanded = stateNorm;
          for (final entry in stateAliases.entries) {
            final fullName = entry.key;
            final aliases = entry.value;
            if (stateNorm.contains(_normalizeTurkish(fullName))) {
              stateExpanded += ' ${aliases.join(' ')}';
              break;
            }
          }

          // Ulke kisaltma eslestirme
          String countryExpanded = countryNorm;
          for (final entry in countryAliases.entries) {
            final key = entry.key;
            final aliases = entry.value;
            if (countryNorm.contains(_normalizeTurkish(key)) ||
                aliases.any((a) => countryNorm.contains(_normalizeTurkish(a)))) {
              countryExpanded += ' ${aliases.join(' ')} $key';
              break;
            }
          }

          // Menu item isimleri
          final menuNames = event.menu.map((m) => _normalizeTurkish(m.name.toLowerCase())).join(' ');

          final searchableText = '$cityNorm $titleNorm $countryExpanded $stateExpanded $addressNorm $menuNames';

          return queryWords.every((word) => searchableText.contains(word));
        }).toList();
      }
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

    // Quick filters
    if (_filterKidsActivities) events = events.where((e) => e.hasKidsActivities).toList();
    if (_filterOutdoor) events = events.where((e) => e.hasOutdoor).toList();
    if (_filterFamilyArea) events = events.where((e) => e.hasFamilyArea).toList();
    if (_filterCardPayment) events = events.where((e) => e.hasCreditCardPayment).toList();
    if (_filterFreeEntry) events = events.where((e) => e.hasFreeEntry).toList();
    if (_filterHelal) events = events.where((e) => e.hasHalal).toList();
    if (_filterVegetarian) events = events.where((e) => e.hasVegetarian).toList();
    if (_filterLiveMusic) events = events.where((e) => e.hasLiveMusic).toList();
    if (_filterParking) events = events.where((e) => e.hasParking).toList();
    
    // Apply TUNA / Akdeniz Toros filters
    if (_filterTuna && _filterAkdenizToros) {
      events = events.where((e) => e.sponsor == KermesSponsor.tuna || e.sponsor == KermesSponsor.akdenizToros).toList();
    } else if (_filterTuna) {
      events = events.where((e) => e.sponsor == KermesSponsor.tuna).toList();
    } else if (_filterAkdenizToros) {
      events = events.where((e) => e.sponsor == KermesSponsor.akdenizToros).toList();
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

  // ============== ACTIVE FILTER COUNT ==============
  int get _activeFilterCount {
    int count = 0;
    if (_filterKidsActivities) count++;
    if (_filterOutdoor) count++;
    if (_filterFamilyArea) count++;
    if (_filterCardPayment) count++;
    if (_filterFreeEntry) count++;
    if (_filterHelal) count++;
    if (_filterVegetarian) count++;
    if (_filterLiveMusic) count++;
    if (_filterParking) count++;
    if (_filterTuna) count++;
    if (_filterAkdenizToros) count++;
    if (_sortBy != 'date_asc') count++;
    return count;
  }

  // ============== FILTER BOTTOM SHEET (Yemek stili) ==============
  void _showFilterBottomSheet() {
    final cardBg = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF2A2A28)
        : Colors.white;

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
            final totalResults = _filteredEvents.length;

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
                        // Cancel
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
                              'Kapat',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 14,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ),
                        ),
                        // Results count
                        Flexible(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              '$totalResults Kermes',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                        // Reset
                        GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            setState(() {
                              _sortBy = 'date_asc';
                              _filterKidsActivities = false;
                              _filterOutdoor = false;
                              _filterFamilyArea = false;
                              _filterCardPayment = false;
                              _filterFreeEntry = false;
                              _filterHelal = false;
                              _filterVegetarian = false;
                              _filterLiveMusic = false;
                              _filterParking = false;
                              _filterTuna = false;
                              _filterAkdenizToros = false;
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
                              'Sifirla',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
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
                          const SizedBox(height: 16),
                          // TUNA Sertifika Filtresi
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              setState(() => _filterTuna = !_filterTuna);
                              setStateSheet(() {});
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFA01E22),
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: _filterTuna
                                          ? [
                                              BoxShadow(
                                                color: const Color(0xFFA01E22).withValues(alpha: 0.4),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ]
                                          : null,
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
                                  Expanded(
                                    child: Text(
                                      'Sadece Tuna onaylu kermesler',
                                      style: TextStyle(
                                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    height: 28,
                                    child: Switch.adaptive(
                                      value: _filterTuna,
                                      activeColor: Colors.white,
                                      activeTrackColor: lokmaPink,
                                      onChanged: (val) {
                                        HapticFeedback.lightImpact();
                                        setState(() => _filterTuna = val);
                                        setStateSheet(() {});
                                      },
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 8),

                          // AKDENİZ TOROS Sertifika Filtresi
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              setState(() => _filterAkdenizToros = !_filterAkdenizToros);
                              setStateSheet(() {});
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFD97706),
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: _filterAkdenizToros
                                          ? [
                                              BoxShadow(
                                                color: const Color(0xFFD97706).withValues(alpha: 0.4),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ]
                                          : null,
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.verified, color: Colors.white, size: 16),
                                        SizedBox(width: 6),
                                        Text(
                                          'AKDENİZ TOROS',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      'Sadece Akdeniz Toros onaylı kermesler',
                                      style: TextStyle(
                                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    height: 28,
                                    child: Switch.adaptive(
                                      value: _filterAkdenizToros,
                                      activeColor: Colors.white,
                                      activeTrackColor: lokmaPink,
                                      onChanged: (val) {
                                        HapticFeedback.lightImpact();
                                        setState(() => _filterAkdenizToros = val);
                                        setStateSheet(() {});
                                      },
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 24),

                          // Siralama Section
                          _buildSectionHeader('SIRALAMA'),

                          _buildFilterListItem(
                            title: 'En Yakin Tarih',
                            subtitle: 'Tarihe gore sirala',
                            isSelected: _sortBy == 'date_asc',
                            useRadio: true,
                            onTap: () {
                              setState(() => _sortBy = 'date_asc');
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'En Yakin Mesafe',
                            subtitle: 'Mesafeye gore sirala',
                            isSelected: _sortBy == 'distance_asc',
                            useRadio: true,
                            onTap: () {
                              setState(() => _sortBy = 'distance_asc');
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Favorilerim',
                            subtitle: 'Sadece favori kermesleri goster',
                            isSelected: _sortBy == 'favorites',
                            useRadio: true,
                            onTap: () {
                              _loadFavorites();
                              setState(() => _sortBy = 'favorites');
                              setStateSheet(() {});
                            },
                          ),

                          const SizedBox(height: 24),

                          // Hizli Filtreler Section
                          _buildSectionHeader('HIZLI FILTRELER'),

                          _buildFilterListItem(
                            title: 'Cocuk Aktiviteleri',
                            subtitle: 'Cocuk alani olan kermesler',
                            isSelected: _filterKidsActivities,
                            onTap: () {
                              setState(() => _filterKidsActivities = !_filterKidsActivities);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Acik Alan',
                            subtitle: 'Dis mekan olan kermesler',
                            isSelected: _filterOutdoor,
                            onTap: () {
                              setState(() => _filterOutdoor = !_filterOutdoor);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Aile Bolumu',
                            subtitle: 'Aile alani olan kermesler',
                            isSelected: _filterFamilyArea,
                            onTap: () {
                              setState(() => _filterFamilyArea = !_filterFamilyArea);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Kart ile Odeme',
                            subtitle: 'Kredi karti kabul eden kermesler',
                            isSelected: _filterCardPayment,
                            onTap: () {
                              setState(() => _filterCardPayment = !_filterCardPayment);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Ucretsiz Giris',
                            subtitle: 'Giris ucreti olmayan kermesler',
                            isSelected: _filterFreeEntry,
                            onTap: () {
                              setState(() => _filterFreeEntry = !_filterFreeEntry);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Helal',
                            subtitle: 'Helal sertifikali kermesler',
                            isSelected: _filterHelal,
                            onTap: () {
                              setState(() => _filterHelal = !_filterHelal);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Vejetaryen',
                            subtitle: 'Vejetaryen secenekli kermesler',
                            isSelected: _filterVegetarian,
                            onTap: () {
                              setState(() => _filterVegetarian = !_filterVegetarian);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Canli Muzik',
                            subtitle: 'Canli muzik olan kermesler',
                            isSelected: _filterLiveMusic,
                            onTap: () {
                              setState(() => _filterLiveMusic = !_filterLiveMusic);
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'Otopark',
                            subtitle: 'Park alani olan kermesler',
                            isSelected: _filterParking,
                            onTap: () {
                              setState(() => _filterParking = !_filterParking);
                              setStateSheet(() {});
                            },
                          ),

                          const SizedBox(height: 100),
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
                            '$totalResults Kermes Goster',
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

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
          fontSize: 13,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildFilterListItem({
    required String title,
    required String subtitle,
    required bool isSelected,
    required VoidCallback onTap,
    bool useRadio = false,
  }) {
    return Builder(
      builder: (context) {
        final textColor = Theme.of(context).colorScheme.onSurface;
        final subtitleColor = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);

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
                      Text(
                        title,
                        style: TextStyle(
                          color: textColor,
                          fontSize: 15,
                          fontWeight: FontWeight.w400,
                        ),
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
                // Radio or Checkbox
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
                                  decoration: const BoxDecoration(
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

  // ============== BUILD ==============
  @override
  Widget build(BuildContext context) {
    // Watch location from cached provider
    final locationAsync = ref.watch(userLocationProvider);
    locationAsync.whenData((location) {
      _updateLocationFromProvider(location);
    });

    // Theme-aware colors (same as RestoranScreen)
    final scaffoldBg = Theme.of(context).scaffoldBackgroundColor;

    // Status bar
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Theme.of(context).brightness == Brightness.dark
          ? Brightness.light
          : Brightness.dark,
      statusBarBrightness: Theme.of(context).brightness,
    ));

    return Container(
      color: scaffoldBg,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          physics: const ClampingScrollPhysics(),
          slivers: [
            // ===== COLLAPSING HEADER =====
            SliverAppBar(
              backgroundColor: scaffoldBg,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              pinned: true,
              floating: false,
              clipBehavior: Clip.hardEdge,
              expandedHeight: 210,
              collapsedHeight: 120,
              automaticallyImplyLeading: false,
              flexibleSpace: LayoutBuilder(
                builder: (context, constraints) {
                  final expandedHeight = 210.0;
                  final collapsedHeight = 120.0;
                  final currentHeight = constraints.maxHeight;
                  final expandRatio = ((currentHeight - collapsedHeight) /
                          (expandedHeight - collapsedHeight))
                      .clamp(0.0, 1.0);

                  return ClipRect(
                    child: Container(
                      color: scaffoldBg,
                      child: SingleChildScrollView(
                        physics: const NeverScrollableScrollPhysics(),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Location header (always visible)
                            _buildCompactLocationHeader(),

                            // Expandable elements
                            if (expandRatio > 0.05) ...[
                              Opacity(
                                opacity: expandRatio,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    // Delivery mode tabs
                                    _buildDeliveryModeTabs(),

                                    // Search bar
                                    _buildSearchBar(),

                                    // Distance slider
                                    _buildDistanceSlider(),
                                  ],
                                ),
                              ),
                            ] else ...[
                              // Collapsed: only search bar visible
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

            // Event Count
            if (!_isLoading && _filteredEvents.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                  child: Text(
                    'kermes.events_found_count'.tr(args: [_filteredEvents.length.toString()]),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ),

            // Event List
            _isLoading
                ? const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator(color: lokmaPink)),
                  )
                : _filteredEvents.isEmpty
                    ? SliverFillRemaining(
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.celebration_outlined,
                                  size: 64,
                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4)),
                              const SizedBox(height: 16),
                              Text(
                                'kermes.no_events_found'.tr(),
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                                  fontSize: 16,
                                ),
                              ),
                              if (_searchQuery.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  'marketplace.no_results_for_query'.tr(args: [_searchQuery]),
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3),
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      )
                    : SliverPadding(
                        padding: const EdgeInsets.only(left: 16, right: 16, bottom: 120),
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

  // ============== COMPACT LOCATION HEADER (Yemek stili) ==============
  Widget _buildCompactLocationHeader() {
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
          // Location info
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
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3),
                      size: 14),
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
                            ),
                            child: Text(
                              unreadCount > 9 ? '9+' : unreadCount.toString(),
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),

          const SizedBox(width: 4),

          // Favoriler (kalp butonu)
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/favorites');
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              child: Builder(
                builder: (context) {
                  final isDark = Theme.of(context).brightness == Brightness.dark;
                  int favCount = _favoriteKermesIds.length;
                  
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // Heart icon
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.08)
                              : Colors.grey.shade100,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          favCount > 0
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          color: favCount > 0
                              ? lokmaPink
                              : (isDark ? Colors.white70 : Colors.grey[800]),
                          size: 24,
                        ),
                      ),
                      // Badge
                      if (favCount > 0)
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
                            ),
                            child: Text(
                              favCount > 9 ? '9+' : favCount.toString(),
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
          const SizedBox(width: 14),
        ],
      ),
    );
  }

  // ============== DELIVERY MODE TABS (Yemek stili) ==============
  Widget _buildDeliveryModeTabs() {
    int selectedIndex = 0;
    if (_deliveryMode == 'gelal') selectedIndex = 1;
    if (_deliveryMode == 'masa') selectedIndex = 2;

    return ThreeDimensionalPillTabBar(
      selectedIndex: selectedIndex,
      activeColor: lokmaPink,
      tabs: [
        TabItem(title: 'Kurye', icon: Icons.delivery_dining),
        TabItem(title: 'Gel Al', icon: Icons.shopping_bag_outlined),
        TabItem(title: 'Yerinde', icon: Icons.festival),
      ],
      onTabSelected: (index) {
        String newMode = 'teslimat';
        if (index == 1) newMode = 'gelal';
        if (index == 2) newMode = 'masa';

        setState(() {
          _deliveryMode = newMode;
          _maxDistance = 300;
        });
      },
    );
  }

  // ============== SEARCH BAR (Yemek stili) ==============
  Widget _buildSearchBar() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 8, bottom: 2),
      child: Container(
        height: 48,
        padding: const EdgeInsets.only(left: 16, right: 8),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[800] : const Color(0xFFF2EEE9),
          borderRadius: BorderRadius.circular(30),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Icon(Icons.search, color: Colors.grey[600], size: 22),
            const SizedBox(width: 12),
            // Search input
            Expanded(
              child: TextField(
                controller: _searchController,
                onChanged: (value) {
                  setState(() => _searchQuery = value);
                },
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 14,
                ),
                decoration: InputDecoration(
                  hintText: 'Kermes ara: sehir, eyalet, menu...',
                  hintStyle: TextStyle(color: Colors.grey[600], fontSize: 13, fontWeight: FontWeight.w200),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Filter Button
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                _showFilterBottomSheet();
              },
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Icon(Icons.tune, color: lokmaPink, size: 20),
                      if (_activeFilterCount > 0)
                        Positioned(
                          top: -4,
                          right: -6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: lokmaPink,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '$_activeFilterCount',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.w600,
                              ),
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
    );
  }

  // ============== DISTANCE SLIDER ==============
  Widget _buildDistanceSlider() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    double nearestKermesDistance = 5;
    if (_currentPosition != null && _kermesEvents.isNotEmpty) {
      final distances = _kermesEvents.map((e) => _getDistance(e)).toList();
      distances.sort();
      nearestKermesDistance = distances.first.clamp(1, 300);
    }

    final sliderMin = nearestKermesDistance.clamp(1.0, 50.0);

    if (_maxDistance < sliderMin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _maxDistance = 300);
      });
    }

    String distanceLabel;
    if (_maxDistance >= 300) {
      distanceLabel = 'Tumu';
    } else {
      distanceLabel = '${_maxDistance.round()} km';
    }

    String nearestLabel = '${nearestKermesDistance.round()} km';

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
                value: _maxDistance.clamp(sliderMin, 300),
                min: sliderMin,
                max: 300,
                divisions: 15,
                onChanged: (value) {
                  if (value.round() != _maxDistance.round()) {
                    HapticFeedback.selectionClick();
                  }
                  setState(() => _maxDistance = value);
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
}
