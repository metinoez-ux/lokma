import 'dart:async';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geocoding/geocoding.dart' as geo;
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
  String _userCountryCode = '';
  String _sortBy = 'distance_asc';
  double _maxDistance = 50; // default: 50km
  Set<String> _favoriteKermesIds = {};
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  // Scope mode: controls whether slider or region filter is active
  // 'nearby' = slider, 'state' = eyalet, 'country' = ulke
  String _scopeMode = 'nearby';

  // Step-based slider (matches yemek screen pattern)
  static const List<double> _kmSteps = [
    5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200,
  ];
  int _currentStepIndex = 7; // default: 50km (index 7)


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
      _userCountryCode = location.countryCode.toUpperCase();
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
      debugPrint('[KERMES-REALTIME] Snapshot geldi: ${snapshot.docs.length} doc, ${snapshot.docChanges.length} degisiklik');
      for (final change in snapshot.docChanges) {
        final data = change.doc.data();
        debugPrint('[KERMES-REALTIME] ${change.type.name}: ${change.doc.id} -> startDate=${data?['startDate']}, name=${data?['name']}');
      }
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
            
            // 1. Fallback to old 'menu' array if exists
            if (data['menu'] != null) {
              try {
                final menuList = data['menu'] as List<dynamic>;
                for (final item in menuList) {
                  try {
                    menuItems.add(KermesMenuItem.fromJson(item as Map<String, dynamic>));
                  } catch (e) {
                    debugPrint('Error parsing legacy menu item: $e');
                  }
                }
              } catch (e) {
                debugPrint('Error parsing legacy menu array: $e');
              }
            }

            // 2. Fetch from 'products' subcollection
            try {
              final productsSnapshot = await FirebaseFirestore.instance
                  .collection('kermes_events')
                  .doc(doc.id)
                  .collection('products')
                  .get();

              if (productsSnapshot.docs.isNotEmpty) {
                for (final productDoc in productsSnapshot.docs) {
                  final productData = productDoc.data();
                  try {
                    // Override legacy menu array item if it exists, otherwise add it
                    final parsedProduct = KermesMenuItem.fromJson(productData);
                    final existingIndex = menuItems.indexWhere((m) => m.name == parsedProduct.name);
                    if (existingIndex >= 0) {
                      menuItems[existingIndex] = parsedProduct;
                    } else {
                      menuItems.add(parsedProduct);
                    }
                  } catch (e) {
                    debugPrint('Error parsing product ${productDoc.id}: $e');
                  }
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
              city = data['city']?.toString() ?? data['location']?.toString() ?? 'Bilinmiyor';
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

            // Koordinat cozumleme: Coklu kaynaktan kontrol et
            double eventLat = 0.0;
            double eventLng = 0.0;

            // 1. Dogrudan toplevel latitude/longitude veya lat/lng
            if (data['latitude'] != null) eventLat = (data['latitude'] as num).toDouble();
            else if (data['lat'] != null) eventLat = (data['lat'] as num).toDouble();

            if (data['longitude'] != null) eventLng = (data['longitude'] as num).toDouble();
            else if (data['lng'] != null) eventLng = (data['lng'] as num).toDouble();

            // 2. address map icindeki lat/lng
            if ((eventLat == 0.0 || eventLng == 0.0) && data['address'] is Map) {
              final addrMap = data['address'] as Map;
              if (addrMap['lat'] != null) eventLat = (addrMap['lat'] as num).toDouble();
              else if (addrMap['latitude'] != null) eventLat = (addrMap['latitude'] as num).toDouble();
              if (addrMap['lng'] != null) eventLng = (addrMap['lng'] as num).toDouble();
              else if (addrMap['longitude'] != null) eventLng = (addrMap['longitude'] as num).toDouble();
            }

            // 3. location map icindeki lat/lng
            if ((eventLat == 0.0 || eventLng == 0.0) && data['location'] is Map) {
              final locMap = data['location'] as Map;
              if (locMap['lat'] != null) eventLat = (locMap['lat'] as num).toDouble();
              if (locMap['lng'] != null) eventLng = (locMap['lng'] as num).toDouble();
            }

            // 4. GeoPoint turu
            if ((eventLat == 0.0 || eventLng == 0.0) && data['geoPoint'] is GeoPoint) {
              final gp = data['geoPoint'] as GeoPoint;
              eventLat = gp.latitude;
              eventLng = gp.longitude;
            }
            if ((eventLat == 0.0 || eventLng == 0.0) && data['coordinates'] is GeoPoint) {
              final gp = data['coordinates'] as GeoPoint;
              eventLat = gp.latitude;
              eventLng = gp.longitude;
            }

            // 5. postalCode veya sehir bazli geocoding (fallback)
            if ((eventLat == 0.0 && eventLng == 0.0) || (eventLat == 51.0 && eventLng == 6.0)) {
              if (fullAddress.isNotEmpty) {
                try {
                  final locations = await geo.locationFromAddress(fullAddress);
                  if (locations.isNotEmpty) {
                    eventLat = locations.first.latitude;
                    eventLng = locations.first.longitude;
                    debugPrint('Geocoded kermes "${data['name']}" address "$fullAddress" -> ($eventLat, $eventLng)');
                    // Firestore'a da yazalim ki bir daha geocode etmeyelim
                    try {
                      doc.reference.update({'latitude': eventLat, 'longitude': eventLng});
                    } catch (_) {}
                  }
                } catch (geoErr) {
                  debugPrint('Geocoding failed for "$fullAddress": $geoErr');
                  // Fallback: en azindan sehir isminden dene
                  if (city != 'Bilinmiyor') {
                    try {
                      final cityLocations = await geo.locationFromAddress('$city, Germany');
                      if (cityLocations.isNotEmpty) {
                        eventLat = cityLocations.first.latitude;
                        eventLng = cityLocations.first.longitude;
                        debugPrint('Geocoded kermes city "$city" -> ($eventLat, $eventLng)');
                        try {
                          doc.reference.update({'latitude': eventLat, 'longitude': eventLng});
                        } catch (_) {}
                      }
                    } catch (_) {
                      eventLat = 51.0;
                      eventLng = 6.0;
                    }
                  } else {
                    eventLat = 51.0;
                    eventLng = 6.0;
                  }
                }
              } else {
                eventLat = 51.0;
                eventLng = 6.0;
              }
            }

            debugPrint('Creating KermesEvent ${doc.id} with coords: ($eventLat, $eventLng)');
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
              latitude: eventLat,
              longitude: eventLng,
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
              isMenuOnly: data['isMenuOnly'] == true,
              hasTakeaway: true, // Kermesler için her zaman Gel-Al açıktır
              hasDineIn: true, // Kermesler için her zaman Yerinde (Masa) açıktır
              contactName: contactName,
              headerImage: data['headerImage']?.toString(),
              openingTime: openingTime,
              closingTime: closingTime,
              sponsor: sponsor,
              activeBadgeIds: (data['activeBadgeIds'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
              acceptsDonations: data['acceptsDonations'] == true,
              selectedDonationFundId: data['selectedDonationFundId']?.toString(),
              selectedDonationFundName: data['selectedDonationFundName']?.toString(),
              isSilaYolu: data['isSilaYolu'] == true,
              sectionDefs: _parseSectionDefs(data['tableSectionsV2']),
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

  // ============== SECTION DEFS PARSING ==============
  List<KermesSectionDef> _parseSectionDefs(dynamic rawSections) {
    if (rawSections == null) return [];
    try {
      if (rawSections is List) {
        return rawSections
            .where((e) => e is Map)
            .map((e) => KermesSectionDef.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
      }
      if (rawSections is Map) {
        // tableSectionsV2 Map<sectionId, sectionData> formatinda olabilir
        return rawSections.entries.map((entry) {
          final data = entry.value is Map ? Map<String, dynamic>.from(entry.value as Map) : <String, dynamic>{};
          data['id'] = entry.key.toString();
          return KermesSectionDef.fromJson(data);
        }).toList();
      }
    } catch (e) {
      debugPrint('Error parsing sectionDefs: $e');
    }
    return [];
  }

  // ============== SMART SEARCH + FILTERING ==============
  List<KermesEvent> get _filteredEvents {
    var events = List<KermesEvent>.from(_kermesEvents);

    // Favorites filter
    if (_sortBy == 'favorites') {
      events = events.where((event) => _favoriteKermesIds.contains(event.id)).toList();
    }

    // Delivery mode filter kaldirildi - tum kermesler gosterilir
    // (Toggle switch UI'den cikarildi)

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

    // Distance & scope filter
    final locationAsync = ref.read(userLocationProvider);
    final userState = locationAsync.value?.state ?? '';

    if (_scopeMode == 'nearby') {
      // Slider-based distance filter
      if (_currentPosition != null) {
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
    } else if (_scopeMode == 'state') {
      // Eyalet filtresi
      if (userState.isNotEmpty) {
        final userStateLower = _normalizeTurkish(userState.toLowerCase());
        events = events.where((event) {
          if (event.state == null || event.state!.isEmpty) return true;
          return _statesMatch(userStateLower, _normalizeTurkish(event.state!.toLowerCase()));
        }).toList();
      }
    } else if (_scopeMode == 'silaYolu') {
      events = events.where((e) => e.isSilaYolu).toList();
    }
    // _scopeMode == 'country' -> no distance filter, show all in that country

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
      } else if (_sortBy == 'date_desc') {
        return b.startDate.compareTo(a.startDate);
      } else if (_sortBy == 'distance_asc' && _currentPosition != null) {
        final distA = _getDistance(a);
        final distB = _getDistance(b);
        return distA.compareTo(distB);
      } else if (_sortBy == 'distance_desc' && _currentPosition != null) {
        final distA = _getDistance(a);
        final distB = _getDistance(b);
        return distB.compareTo(distA);
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

  Widget _buildSortChip({
    required IconData icon,
    required String label,
    required bool isActive,
    required bool ascending,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isActive
              ? lokmaPink.withOpacity(0.12)
              : (isDark ? Colors.grey[800] : Colors.grey[200]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? lokmaPink : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isActive ? lokmaPink : (isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                color: isActive ? lokmaPink : (isDark ? Colors.grey[300] : Colors.grey[700]),
              ),
            ),
            if (isActive) ...[
              const SizedBox(width: 2),
              Icon(
                ascending ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                size: 12,
                color: lokmaPink,
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// State adi / kisaltma eslesmesi -- alias tablosunu kullanir
  bool _statesMatch(String userState, String eventState) {
    if (userState == eventState) return true;
    if (userState.contains(eventState) || eventState.contains(userState)) return true;
    for (final entry in stateAliases.entries) {
      final fullName = _normalizeTurkish(entry.key);
      final aliases = entry.value.map(_normalizeTurkish).toList();
      final allNames = [fullName, ...aliases];
      final userMatchesThis = allNames.any((n) => userState.contains(n) || n.contains(userState));
      if (userMatchesThis) {
        final eventMatchesThis = allNames.any((n) => eventState.contains(n) || n.contains(eventState));
        if (eventMatchesThis) return true;
      }
    }
    return false;
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
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.15),
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
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.15),
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
                          
                          if (_userCountryCode != 'TR') ...[
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
                                                  color: const Color(0xFFA01E22).withOpacity(0.4),
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
                                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
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
                            const SizedBox(height: 24),
                          ],

                          if (_userCountryCode == 'TR') ...[
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
                                                  color: const Color(0xFFD97706).withOpacity(0.4),
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
                                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
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
                          ],

                          // Siralama Section
                          _buildSectionHeader('kermes.sort_section_title'.tr()),

                          _buildFilterListItem(
                            title: 'kermes.sort_nearest_date'.tr(),
                            subtitle: 'kermes.sort_by_date'.tr(),
                            isSelected: _sortBy == 'date_asc',
                            useRadio: true,
                            onTap: () {
                              setState(() => _sortBy = 'date_asc');
                              setStateSheet(() {});
                            },
                          ),
                          _buildFilterListItem(
                            title: 'kermes.sort_nearest_distance'.tr(),
                            subtitle: 'kermes.sort_by_distance'.tr(),
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
                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3),
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
          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
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
              expandedHeight: 185,
              collapsedHeight: 120,
              automaticallyImplyLeading: false,
              flexibleSpace: LayoutBuilder(
                builder: (context, constraints) {
                  final expandedHeight = 185.0;
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
                                    // Delivery mode tabs kaldirildi
                                    // Search bar + scope dropdown
                                    _buildSearchBar(),

                                    // Distance slider + scope chip - her zaman goster
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

            // Event Count + Sort Shortcuts
            if (!_isLoading && _filteredEvents.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                  child: Row(
                    children: [
                      Text(
                        'kermes.events_found_count'.tr(args: [_filteredEvents.length.toString()]),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.8),
                          letterSpacing: -0.2,
                        ),
                      ),
                      const Spacer(),
                      // Tarih siralama toggle
                      _buildSortChip(
                        icon: Icons.calendar_today_rounded,
                        label: _sortBy == 'date_asc' ? 'kermes.sort_date_old'.tr() : _sortBy == 'date_desc' ? 'kermes.sort_date_new'.tr() : 'kermes.sort_date_default'.tr(),
                        isActive: _sortBy == 'date_asc' || _sortBy == 'date_desc',
                        ascending: _sortBy == 'date_asc',
                        onTap: () {
                          HapticFeedback.lightImpact();
                          setState(() {
                            if (_sortBy == 'date_asc') {
                              _sortBy = 'date_desc';
                            } else {
                              _sortBy = 'date_asc';
                            }
                          });
                        },
                      ),
                      const SizedBox(width: 8),
                      // Mesafe siralama toggle
                      _buildSortChip(
                        icon: Icons.near_me_rounded,
                        label: _sortBy == 'distance_asc' ? 'kermes.sort_distance_near'.tr() : _sortBy == 'distance_desc' ? 'kermes.sort_distance_far'.tr() : 'kermes.sort_distance_default'.tr(),
                        isActive: _sortBy == 'distance_asc' || _sortBy == 'distance_desc',
                        ascending: _sortBy == 'distance_asc',
                        onTap: () {
                          HapticFeedback.lightImpact();
                          setState(() {
                            if (_sortBy == 'distance_asc') {
                              _sortBy = 'distance_desc';
                            } else {
                              _sortBy = 'distance_asc';
                            }
                          });
                        },
                      ),
                    ],
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
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4)),
                              const SizedBox(height: 16),
                              Text(
                                'kermes.no_events_found'.tr(),
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                                  fontSize: 16,
                                ),
                              ),
                              if (_searchQuery.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  'marketplace.no_results_for_query'.tr(args: [_searchQuery]),
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3),
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
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                        if (streetInfo.isNotEmpty)
                          Text(
                            streetInfo,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.65),
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(Icons.keyboard_arrow_down,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3),
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
                              ? Colors.white.withOpacity(0.08)
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
                              ? Colors.white.withOpacity(0.08)
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
          _maxDistance = 120;
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
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Icon(Icons.search, color: isDark ? Colors.grey[400] : Colors.grey[500], size: 22),
            const SizedBox(width: 10),
            // Search input
            Expanded(
              child: TextField(
                controller: _searchController,
                onChanged: (value) {
                  setState(() => _searchQuery = value);
                },
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 15,
                  fontWeight: FontWeight.w400,
                ),
                decoration: InputDecoration(
                  hintText: 'Kermes ara: sehir, eyalet, menu...',
                  hintStyle: TextStyle(
                    color: isDark ? Colors.grey[300] : Colors.grey[600],
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                  ),
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

  // ============== DISTANCE SLIDER (Yemek stili) ==============
  Widget _buildDistanceSlider() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentKm = _kmSteps[_currentStepIndex];
    final isNearby = _scopeMode == 'nearby';

    // En yakin kermes mesafesini bul
    int nearestKm = 0;
    if (_currentPosition != null && _kermesEvents.isNotEmpty) {
      double minDist = double.infinity;
      for (final event in _kermesEvents) {
        final dist = Geolocator.distanceBetween(
          _currentPosition!.latitude,
          _currentPosition!.longitude,
          event.latitude,
          event.longitude,
        ) / 1000;
        if (dist < minDist) minDist = dist;
      }
      nearestKm = minDist.isFinite ? minDist.round() : 0;
    }

    final String nearestLabel = nearestKm > 0 ? '$nearestKm km' : '';

    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Sadece ikon + label + slider grileşir
          Expanded(
            child: Opacity(
              opacity: isNearby ? 1.0 : 0.4,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (nearestLabel.isNotEmpty) ...[
                    Icon(Icons.near_me,
                        color: isDark ? lokmaPink : Colors.grey[700], size: 14),
                    const SizedBox(width: 4),
                    Text(
                      nearestLabel,
                      style: TextStyle(
                        color: isDark ? lokmaPink : Colors.grey[700],
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ] else ...[
                    Icon(Icons.near_me,
                        color: isDark ? lokmaPink : Colors.grey[700], size: 14),
                  ],
                  const SizedBox(width: 4),
                  Expanded(
                    child: SizedBox(
                      height: 36,
                      child: SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          activeTrackColor: lokmaPink,
                          inactiveTrackColor:
                              isDark ? Colors.grey[600] : Colors.grey[300],
                          thumbColor: lokmaPink,
                          overlayColor: lokmaPink.withValues(alpha: 0.2),
                          trackHeight: 4,
                          thumbShape: const RoundSliderThumbShape(
                              enabledThumbRadius: 8),
                          tickMarkShape: const RoundSliderTickMarkShape(
                              tickMarkRadius: 0),
                          activeTickMarkColor: Colors.transparent,
                          inactiveTickMarkColor: Colors.transparent,
                        ),
                        child: Slider(
                          value: _currentStepIndex.toDouble(),
                          min: 0,
                          max: (_kmSteps.length - 1).toDouble(),
                          divisions: _kmSteps.length - 1,
                          onChanged: isNearby
                              ? (value) {
                                  final newIndex = value.round();
                                  if (newIndex != _currentStepIndex) {
                                    HapticFeedback.selectionClick();
                                    setState(() {
                                      _currentStepIndex = newIndex;
                                      _maxDistance = _kmSteps[newIndex];
                                    });
                                  }
                                }
                              : null,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 4),
          // Dropdown her zaman tam opak - Opacity dışında
          _buildScopeDropdown(compact: true),
        ],
      ),
    );
  }

  // ============== SCOPE DROPDOWN ==============
  // compact: true -> slider row'unun saginda kucuk chip olarak gosterilir
  // compact: false -> search bar icinde (eski davranis, artik kullanilmiyor)
  Widget _buildScopeDropdown({bool compact = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final locationAsync = ref.read(userLocationProvider);
    final userState = locationAsync.value?.state ?? '';
    final bundeslandShort = _getBundeslandAbbr(userState);

    // Current scope label & icon
    String scopeLabel;
    IconData scopeIcon;
    Color? activeColor;
    switch (_scopeMode) {
      case 'state':
        scopeLabel = bundeslandShort.isNotEmpty ? bundeslandShort : 'Eyalet';
        scopeIcon = Icons.map_outlined;
        activeColor = lokmaPink;
        break;
      case 'country':
        scopeLabel = _userCountryCode == 'TR' ? 'TR' : _userCountryCode == 'DE' ? 'DE' : 'Ulke';
        scopeIcon = Icons.public;
        activeColor = lokmaPink;
        break;
      case 'silaYolu':
        scopeLabel = 'Sila';
        scopeIcon = Icons.route;
        activeColor = lokmaPink;
        break;
      case 'map':
        scopeLabel = 'Harita';
        scopeIcon = Icons.map;
        activeColor = lokmaPink;
        break;
      default:
        // nearby: show current km from slider
        scopeLabel = _currentStepIndex == _kmSteps.length - 1
            ? 'Tumu'
            : '${_kmSteps[_currentStepIndex].toInt()} km';
        scopeIcon = Icons.near_me;
        activeColor = null;
    }

    final isActive = _scopeMode != 'nearby';
    final chipBg = isActive
        ? lokmaPink
        : (isDark ? Colors.grey[800] : Colors.grey[100]);
    final textColor = isActive
        ? Colors.white
        : (isDark ? Colors.grey[300]! : Colors.grey[700]!);

    return PopupMenuButton<String>(
      onSelected: (value) {
        HapticFeedback.lightImpact();
        if (value == 'map') {
          // Harita modunu aktif et ve hemen haritayi ac
          setState(() => _scopeMode = 'map');
          _showKermesMapSheet();
          return;
        }
        setState(() {
          _scopeMode = value;
          if (value == 'nearby') {
            _maxDistance = _kmSteps[_currentStepIndex];
          } else if (value == 'state') {
            _maxDistance = 110;
          } else if (value == 'country') {
            _maxDistance = 999;
          } else if (value == 'silaYolu') {
            _maxDistance = 999;
          }
        });
      },
      color: isDark ? const Color(0xFF2A2A28) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      offset: const Offset(0, 40),
      itemBuilder: (context) => [
        _buildScopeMenuItem(
          value: 'nearby',
          icon: Icons.near_me,
          label: 'Yakin Cevre',
          subtitle: 'Mesafe cubugu ile',
          isSelected: _scopeMode == 'nearby',
          isDark: isDark,
        ),
        _buildScopeMenuItem(
          value: 'state',
          icon: Icons.map_outlined,
          label: bundeslandShort.isNotEmpty ? '$bundeslandShort - Eyalet' : 'Eyalet',
          subtitle: userState.isNotEmpty ? userState : 'Bulundugunuz eyalet',
          isSelected: _scopeMode == 'state',
          isDark: isDark,
        ),
        _buildScopeMenuItem(
          value: 'country',
          icon: Icons.public,
          label: _userCountryCode == 'TR' ? 'Turkiye' : _userCountryCode == 'DE' ? 'Almanya' : 'Ulke',
          subtitle: 'Tum ulke genelinde',
          isSelected: _scopeMode == 'country',
          isDark: isDark,
        ),
        _buildScopeMenuItem(
          value: 'silaYolu',
          icon: Icons.route,
          label: 'Sila Yolu Kermesleri',
          subtitle: 'Almanya guzergahindaki kermesler',
          isSelected: _scopeMode == 'silaYolu',
          isDark: isDark,
        ),
        const PopupMenuDivider(),
        _buildScopeMenuItem(
          value: 'map',
          icon: Icons.map,
          label: 'Harita Gorunumu',
          subtitle: 'Kermesleri haritada goster',
          isSelected: _scopeMode == 'map',
          isDark: isDark,
        ),
      ],
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: chipBg,
          borderRadius: BorderRadius.circular(20),
          border: isActive ? null : Border.all(
            color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
            width: 0.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(scopeIcon, size: 13, color: textColor),
            const SizedBox(width: 4),
            Text(
              scopeLabel,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: textColor,
              ),
            ),
            const SizedBox(width: 2),
            Icon(Icons.keyboard_arrow_down, size: 14, color: isActive ? Colors.white70 : (isDark ? Colors.grey[500] : Colors.grey[400])),
          ],
        ),
      ),
    );
  }

  // ============== KERMES MAP SHEET ==============
  void _showKermesMapSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _KermesMapSheet(
        events: _filteredEvents,
        userLat: _currentPosition?.latitude,
        userLng: _currentPosition?.longitude,
      ),
    ).then((_) {
      // Harita kapaninca scope'u nearby'a dondur
      if (mounted && _scopeMode == 'map') {
        setState(() => _scopeMode = 'country');
      }
    });
  }

  PopupMenuItem<String> _buildScopeMenuItem({
    required String value,
    required IconData icon,
    required String label,
    required String subtitle,
    required bool isSelected,
    required bool isDark,
    bool disabled = false,
  }) {
    return PopupMenuItem<String>(
      value: disabled ? null : value,
      enabled: !disabled,
      child: Row(
        children: [
          Icon(
            icon,
            size: 20,
            color: disabled
                ? (isDark ? Colors.grey[600] : Colors.grey[400])
                : isSelected
                    ? lokmaPink
                    : (isDark ? Colors.grey[300] : Colors.grey[700]),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                    color: disabled
                        ? (isDark ? Colors.grey[600] : Colors.grey[400])
                        : (isDark ? Colors.white : Colors.grey[900]),
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: disabled
                        ? (isDark ? Colors.grey[700] : Colors.grey[350])
                        : (isDark ? Colors.grey[500] : Colors.grey[500]),
                  ),
                ),
              ],
            ),
          ),
          if (isSelected)
            Icon(Icons.check_circle, size: 18, color: lokmaPink),
        ],
      ),
    );
  }

  /// Bundesland tam adini kısaltmaya cevir ("Nordrhein-Westfalen" -> "NRW")
  String _getBundeslandAbbr(String fullName) {
    if (fullName.isEmpty) return '';
    final norm = _normalizeTurkish(fullName.toLowerCase());
    const abbrs = {
      'nordrhein-westfalen': 'NRW',
      'nordrhein westfalen': 'NRW',
      'nrw': 'NRW',
      'bayern': 'BY',
      'bavaria': 'BY',
      'berlin': 'BE',
      'hamburg': 'HH',
      'bremen': 'HB',
      'hessen': 'HE',
      'niedersachsen': 'NI',
      'lower saxony': 'NI',
      'sachsen': 'SN',
      'saxony': 'SN',
      'sachsen-anhalt': 'ST',
      'sachsen anhalt': 'ST',
      'thuringen': 'TH',
      'thuringia': 'TH',
      'thüringen': 'TH',
      'brandenburgo': 'BB',
      'brandenburg': 'BB',
      'mecklenburg-vorpommern': 'MV',
      'mecklenburg vorpommern': 'MV',
      'rheinland-pfalz': 'RP',
      'rheinland pfalz': 'RP',
      'rhineland palatinate': 'RP',
      'saarland': 'SL',
      'schleswig-holstein': 'SH',
      'schleswig holstein': 'SH',
      'bw': 'BW',
      'bad wurttemberg': 'BW',
      'bad württemberg': 'BW',
      'baden-württemberg': 'BW',
      'baden württemberg': 'BW',
    };
    for (final entry in abbrs.entries) {
      if (norm.contains(_normalizeTurkish(entry.key))) return entry.value;
    }
    // Bilinmiyorsa ilk 4 harf buyuk harf
    return fullName.length > 4 ? fullName.substring(0, 4).toUpperCase() : fullName.toUpperCase();
  }
}

// ============================================================
//  KERMES MAP SHEET
// ============================================================
class _KermesMapSheet extends StatefulWidget {
  final List<KermesEvent> events;
  final double? userLat;
  final double? userLng;

  const _KermesMapSheet({
    required this.events,
    this.userLat,
    this.userLng,
  });

  @override
  State<_KermesMapSheet> createState() => _KermesMapSheetState();
}

class _KermesMapSheetState extends State<_KermesMapSheet>
    with SingleTickerProviderStateMixin {
  late final MapController _mapController;
  late AnimationController _pulseController;
  KermesEvent? _selectedEvent;
  double _currentZoom = 8;

  static const Color lokmaPink = Color(0xFFEA184A);
  static const List<double> _ringRadiiM = [25000, 50000, 100000];
  static const List<String> _ringLabels = ['25 km', '50 km', '100 km'];

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  LatLng _calculateCenter() {
    if (widget.userLat != null && widget.userLng != null) {
      return LatLng(widget.userLat!, widget.userLng!);
    }
    if (widget.events.isEmpty) return LatLng(51.1657, 10.4515); // Germany center
    double sumLat = 0, sumLng = 0;
    for (final e in widget.events) {
      sumLat += e.latitude;
      sumLng += e.longitude;
    }
    return LatLng(sumLat / widget.events.length, sumLng / widget.events.length);
  }

  double _calculateZoom() {
    if (widget.events.isEmpty) return 6;
    if (widget.events.length == 1) return 12;
    double minLat = double.infinity, maxLat = -double.infinity;
    double minLng = double.infinity, maxLng = -double.infinity;
    for (final e in widget.events) {
      if (e.latitude < minLat) minLat = e.latitude;
      if (e.latitude > maxLat) maxLat = e.latitude;
      if (e.longitude < minLng) minLng = e.longitude;
      if (e.longitude > maxLng) maxLng = e.longitude;
    }
    final diff = (maxLat - minLat) > (maxLng - minLng)
        ? (maxLat - minLat)
        : (maxLng - minLng);
    if (diff < 0.05) return 13;
    if (diff < 0.2) return 11;
    if (diff < 1.0) return 9;
    if (diff < 3.0) return 7;
    return 5;
  }

  String _distanceText(KermesEvent event) {
    if (widget.userLat == null || widget.userLng == null) return '';
    final dist = Geolocator.distanceBetween(
      widget.userLat!, widget.userLng!,
      event.latitude, event.longitude,
    ) / 1000;
    if (dist < 1) return '${(dist * 1000).round()} m';
    return '${dist.toStringAsFixed(1)} km';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final center = _calculateCenter();
    final zoom = _calculateZoom();

    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Stack(
        children: [
          Column(
            children: [
              // Handle + header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                child: Column(
                  children: [
                    Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.grey[600] : Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: lokmaPink.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.map, color: lokmaPink, size: 18),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Kermes Haritasi',
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  color: isDark ? Colors.white : Colors.black,
                                ),
                              ),
                              Text(
                                '${widget.events.length} kermes gosteriliyor',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: Icon(
                            Icons.close,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Map
              Expanded(
                child: ClipRRect(
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(20),
                  ),
                  child: FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: center,
                      initialZoom: zoom,
                      onPositionChanged: (camera, _) {
                        if (camera.zoom != _currentZoom) {
                          setState(() => _currentZoom = camera.zoom);
                        }
                      },
                      onTap: (_, __) {
                        if (_selectedEvent != null) {
                          setState(() => _selectedEvent = null);
                        }
                      },
                    ),
                    children: [
                      TileLayer(
                        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.lokma.app',
                      ),
                      // Distance rings around user
                      if (widget.userLat != null && widget.userLng != null)
                        CircleLayer(
                          circles: List.generate(_ringRadiiM.length, (i) {
                            final opacity = 0.05 - (i * 0.01);
                            return CircleMarker(
                              point: LatLng(widget.userLat!, widget.userLng!),
                              radius: _ringRadiiM[i],
                              useRadiusInMeter: true,
                              color: lokmaPink.withValues(alpha: opacity.clamp(0.01, 0.08)),
                              borderColor: lokmaPink.withValues(alpha: 0.3 - (i * 0.07)),
                              borderStrokeWidth: 1.5,
                            );
                          }),
                        ),
                      // Ring labels
                      if (widget.userLat != null && widget.userLng != null)
                        MarkerLayer(
                          rotate: true,
                          markers: List.generate(_ringRadiiM.length, (i) {
                            final radiusDeg = _ringRadiiM[i] / 111320;
                            return Marker(
                              point: LatLng(widget.userLat! + radiusDeg, widget.userLng!),
                              width: 52,
                              height: 22,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.8),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: lokmaPink.withValues(alpha: 0.25), width: 0.5),
                                ),
                                child: Text(
                                  _ringLabels[i],
                                  style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: lokmaPink),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            );
                          }),
                        ),
                      // User location marker
                      if (widget.userLat != null && widget.userLng != null)
                        MarkerLayer(
                          rotate: true,
                          markers: [
                            Marker(
                              point: LatLng(widget.userLat!, widget.userLng!),
                              width: 20,
                              height: 20,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.blue,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2.5),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.blue.withValues(alpha: 0.4),
                                      blurRadius: 6,
                                      spreadRadius: 2,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      // Kermes markers
                      MarkerLayer(
                        rotate: true,
                        markers: widget.events.map((event) {
                          final isSelected = _selectedEvent?.id == event.id;
                          final scaleFactor = (1.0 + (_currentZoom - 8) * 0.12).clamp(0.7, 2.0);

                          return Marker(
                            point: LatLng(event.latitude, event.longitude),
                            width: 120 * scaleFactor,
                            height: 75 * scaleFactor,
                            child: GestureDetector(
                              onTap: () {
                                HapticFeedback.lightImpact();
                                setState(() {
                                  _selectedEvent = (_selectedEvent?.id == event.id) ? null : event;
                                });
                              },
                              child: ClipRect(
                                child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Pulsing pin
                                  SizedBox(
                                    width: 28,
                                    height: 28,
                                    child: Stack(
                                      alignment: Alignment.center,
                                      children: [
                                        AnimatedBuilder(
                                          animation: _pulseController,
                                          builder: (context, child) => Container(
                                            width: 20 + (_pulseController.value * 12),
                                            height: 20 + (_pulseController.value * 12),
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: lokmaPink.withValues(alpha: 0.5 * (1 - _pulseController.value)),
                                                width: 2,
                                              ),
                                            ),
                                          ),
                                        ),
                                        Container(
                                          width: (isSelected ? 26 : 22) * scaleFactor,
                                          height: (isSelected ? 26 : 22) * scaleFactor,
                                          decoration: BoxDecoration(
                                            color: isSelected ? lokmaPink : const Color(0xFF2E7D32),
                                            shape: BoxShape.circle,
                                            border: Border.all(color: Colors.white, width: 2),
                                            boxShadow: [
                                              BoxShadow(
                                                color: (isSelected ? lokmaPink : const Color(0xFF2E7D32)).withValues(alpha: 0.4),
                                                blurRadius: 6,
                                                spreadRadius: 1,
                                              ),
                                            ],
                                          ),
                                          child: Icon(
                                            Icons.festival,
                                            color: Colors.white,
                                            size: (isSelected ? 13 : 11) * scaleFactor,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Name badge
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? lokmaPink
                                          : (isDark ? Colors.black.withValues(alpha: 0.8) : Colors.white.withValues(alpha: 0.95)),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: isSelected ? Colors.transparent : lokmaPink.withValues(alpha: 0.2),
                                        width: 0.5,
                                      ),
                                      boxShadow: [
                                        BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 4),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Flexible(
                                          child: Text(
                                            event.title.length > 13
                                                ? '${event.title.substring(0, 12)}...'
                                                : (event.title),
                                            style: TextStyle(
                                              fontSize: 10 * scaleFactor,
                                              fontWeight: FontWeight.w600,
                                              color: isSelected ? Colors.white : (isDark ? Colors.white : Colors.black87),
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                               ),
                              ), // ClipRect
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(height: bottomPadding),
            ],
          ),
          // Selected event info card
          if (_selectedEvent != null)
            Positioned(
              bottom: bottomPadding + 16,
              left: 12,
              right: 12,
              child: _buildInfoCard(isDark),
            ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(bool isDark) {
    final event = _selectedEvent!;
    final dist = _distanceText(event);

    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF2A2A28) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
          border: Border.all(
            color: lokmaPink.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: lokmaPink.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.festival, color: lokmaPink, size: 22),
            ),
            const SizedBox(width: 12),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    event.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      if (dist.isNotEmpty) ...[
                        Icon(Icons.near_me, size: 12, color: lokmaPink),
                        const SizedBox(width: 3),
                        Text(
                          dist,
                          style: TextStyle(fontSize: 12, color: lokmaPink, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(width: 8),
                      ],
                      if (event.city != null)
                        Flexible(
                          child: Text(
                            event.city!,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Navigate button
            GestureDetector(
              onTap: () {
                HapticFeedback.mediumImpact();
                Navigator.pop(context);
                // Navigasyonu context kullanarak yap
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: lokmaPink,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Incele',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
