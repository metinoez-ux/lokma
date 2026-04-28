import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:flutter/foundation.dart';

/// Cached user location data - fetched once, used everywhere
/// Prevents repeated Google Geocoding API calls across screens
class UserLocation {
  final double latitude;
  final double longitude;
  final String address;
  final String street;
  final String city;
  final String state;
  final String countryCode;
  final bool hasPermission;
  final String? error;

  const UserLocation({
    required this.latitude,
    required this.longitude,
    required this.address,
    required this.street,
    required this.city,
    this.state = '',
    this.countryCode = '',
    this.hasPermission = true,
    this.error,
  });

  /// Empty/loading state
  factory UserLocation.empty() => const UserLocation(
    latitude: 0,
    longitude: 0,
    address: '',
    street: '',
    city: '',
    state: '',
    countryCode: '',
    hasPermission: false,
  );

  /// Permission denied state (Fallback to Hückelhoven)
  factory UserLocation.denied() => const UserLocation(
    latitude: 51.0494,
    longitude: 6.2238,
    address: 'Hückelhoven (Varsayılan Konum)',
    street: 'Varsayılan',
    city: 'Hückelhoven',
    state: 'NRW',
    countryCode: 'DE',
    hasPermission: false,
    error: 'Konum izni verilmedi',
  );

  bool get isValid => latitude != 0 && longitude != 0;

  String _normalize(String text) {
    return text
        .toLowerCase()
        .replaceAll('i̇', 'i')
        .replaceAll('ı', 'i')
        .replaceAll('ğ', 'g')
        .replaceAll('ü', 'u')
        .replaceAll('ş', 's')
        .replaceAll('ö', 'o')
        .replaceAll('ç', 'c');
  }

  /// Robust country inference check for Turkey, since Google Places
  /// autocomplete sometimes omits the countryCode for certain cities.
  bool get isTurkeyRegion {
    if (countryCode.toUpperCase() == 'TR') return true;
    
    final lowerCity = _normalize(city);
    final lowerAddr = _normalize(address);
    
    if (lowerAddr.contains('turkiye') || lowerAddr.contains('turkey')) {
      return true;
    }
    
    final trProvinces = {
      'adana','adiyaman','afyon','afyonkarahisar','agri','aksaray','amasya','ankara','antalya','ardahan',
      'artvin','aydin','balikesir','bartin','batman','bayburt','bilecik','bingol','bitlis',
      'bolu','burdur','bursa','canakkale','cankiri','corum','denizli','diyarbakir','duzce','edirne',
      'elazig','erzincan','erzurum','eskisehir','gaziantep','giresun','gumushane','hakkari','hatay','igdir',
      'isparta','istanbul','izmir','kahramanmaras','karabuk','karaman','kars','kastamonu','kayseri','kirikkale',
      'kirklareli','kirsehir','kilis','kocaeli','konya','kutahya','malatya','manisa','mardin','mersin',
      'mugla','mus','nevsehir','nigde','ordu','osmaniye','rize','sakarya','samsun','siirt',
      'sinop','sivas','sanliurfa','sirnak','tekirdag','tokat','trabzon','tunceli','usak','van',
      'yalova','yozgat','zonguldak', 'bigadi'
    };
    
    return trProvinces.any((p) => lowerCity.contains(p) || lowerAddr.contains(p));
  }
}

/// Location state notifier - fetches once, caches for entire app session
class UserLocationNotifier extends Notifier<AsyncValue<UserLocation>> {
  bool _hasFetched = false;

  @override
  AsyncValue<UserLocation> build() {
    // Auto-fetch on first access, but don't await it here to prevent blocking
    Future.microtask(() => fetchLocation());
    return const AsyncValue.loading();
  }

  /// Fetch location - only calls API if not already fetched
  Future<void> fetchLocation({bool forceRefresh = false}) async {
    // Skip if already fetched (unless force refresh)
    if (_hasFetched && !forceRefresh) {
      debugPrint('📍 Location already cached, skipping API call');
      return;
    }

    debugPrint('📍 Fetching user location (first time or refresh)...');
    
    // SADECE forceRefresh ise loading state'e geçir (ilk açılışta zaten loading olarak başlıyor)
    if (forceRefresh) {
      state = const AsyncValue.loading();
    }

    try {
      // Check permission
      LocationPermission permission = await Geolocator.checkPermission();
      debugPrint('📍 Permission status: $permission');
      
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        debugPrint('📍 Permission after request: $permission');
      }

      if (permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied) {
        debugPrint('📍 Location permission denied!');
        _hasFetched = true;
        state = AsyncValue.data(UserLocation.denied());
        return;
      }

      // Check if location services are enabled (often missed and blocks FOREVER)
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('📍 Location services are disabled!');
        _hasFetched = true;
        state = AsyncValue.data(const UserLocation(
            latitude: 51.0494,
            longitude: 6.2238,
            address: 'Hückelhoven (Varsayılan Konum)',
            street: 'Varsayılan',
            city: 'Hückelhoven',
            state: 'NRW',
            countryCode: 'DE',
            hasPermission: false,
            error: 'Konum servisleri kapalı'));
        return;
      }

      // Get current position - Added timeout to prevent hanging forever
      debugPrint('📍 Getting current position...');
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15), // 15 SECOND TIMEOUT ADDED
      );
      debugPrint('📍 Got position: lat=${position.latitude}, lng=${position.longitude}');

      // Reverse geocoding (THIS IS THE GOOGLE API CALL - only happens once now!)
      debugPrint('📍 Calling reverse geocoding API (CACHED - only once per session)...');
      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      ).timeout(const Duration(seconds: 10)); // 10 SECOND TIMEOUT ADDED

      String address = '';
      String street = '';
      String city = '';
      String regionState = '';
      String countryCode = '';

      if (placemarks.isNotEmpty) {
        final place = placemarks.first;
        street = place.thoroughfare ?? '';
        final number = place.subThoroughfare ?? '';
        city = place.locality ?? place.subAdministrativeArea ?? '';
        regionState = place.administrativeArea ?? '';
        countryCode = place.isoCountryCode ?? '';

        // Include house number in street for display
        if (number.isNotEmpty && street.isNotEmpty) {
          street = '$street $number';
        }

        // Build address string (street already includes number)
        final streetPart = street;

        if (streetPart.isNotEmpty && city.isNotEmpty) {
          address = '$streetPart, $city';
        } else if (city.isNotEmpty) {
          address = city;
        } else if (streetPart.isNotEmpty) {
          address = streetPart;
        }
      }

      debugPrint('📍 Location cached: $address ($countryCode)');
      _hasFetched = true;
      state = AsyncValue.data(UserLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        address: address,
        street: street,
        city: city,
        state: regionState,
        countryCode: countryCode,
        hasPermission: true,
      ));
    } catch (e, st) {
      debugPrint('❌ Error fetching location: $e');
      _hasFetched = true;
      // Timeout ve benzeri hatalar için fallback
      if (e is TimeoutException) {
         state = AsyncValue.data(UserLocation(
            latitude: 0,
            longitude: 0,
            address: 'Konum alınamadı (Zaman aşımı)',
            street: '',
            city: '',
            state: '',
            countryCode: '',
            hasPermission: true, // Izin var ama alamadi
            error: 'Konum zaman aşımı'));
      } else {
         state = AsyncValue.error(e, st);
      }
    }
  }

  /// Force refresh location (e.g., user pulled to refresh)
  Future<void> refresh() => fetchLocation(forceRefresh: true);

  /// Manually set the location (e.g., from an autocomplete place)
  void setLocation(UserLocation newLocation) {
    debugPrint('📍 Manually setting user location: ${newLocation.address}');
    _hasFetched = true;
    state = AsyncValue.data(newLocation);
  }
}

/// Global location provider - shared across all screens
final userLocationProvider = NotifierProvider<UserLocationNotifier, AsyncValue<UserLocation>>(() {
  return UserLocationNotifier();
});
