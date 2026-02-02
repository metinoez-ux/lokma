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
  final bool hasPermission;
  final String? error;

  const UserLocation({
    required this.latitude,
    required this.longitude,
    required this.address,
    required this.street,
    required this.city,
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
    hasPermission: false,
  );

  /// Permission denied state
  factory UserLocation.denied() => const UserLocation(
    latitude: 0,
    longitude: 0,
    address: 'Konum izni verilmedi',
    street: '',
    city: '',
    hasPermission: false,
    error: 'Konum izni verilmedi',
  );

  bool get isValid => latitude != 0 && longitude != 0 && hasPermission;
}

/// Location state notifier - fetches once, caches for entire app session
class UserLocationNotifier extends Notifier<AsyncValue<UserLocation>> {
  bool _hasFetched = false;

  @override
  AsyncValue<UserLocation> build() {
    // Auto-fetch on first access
    fetchLocation();
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
    state = const AsyncValue.loading();

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

      // Get current position
      debugPrint('📍 Getting current position...');
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      debugPrint('📍 Got position: lat=${position.latitude}, lng=${position.longitude}');

      // Reverse geocoding (THIS IS THE GOOGLE API CALL - only happens once now!)
      debugPrint('📍 Calling reverse geocoding API (CACHED - only once per session)...');
      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );

      String address = '';
      String street = '';
      String city = '';

      if (placemarks.isNotEmpty) {
        final place = placemarks.first;
        street = place.thoroughfare ?? '';
        final number = place.subThoroughfare ?? '';
        city = place.locality ?? place.administrativeArea ?? '';

        // Build address string
        final addressParts = <String>[];
        if (street.isNotEmpty) addressParts.add(street);
        if (number.isNotEmpty) addressParts.add(number);
        final streetPart = addressParts.join(' ');

        if (streetPart.isNotEmpty && city.isNotEmpty) {
          address = '$streetPart, $city';
        } else if (city.isNotEmpty) {
          address = city;
        } else if (streetPart.isNotEmpty) {
          address = streetPart;
        }
      }

      debugPrint('📍 Location cached: $address');
      _hasFetched = true;
      state = AsyncValue.data(UserLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        address: address,
        street: street,
        city: city,
        hasPermission: true,
      ));
    } catch (e, st) {
      debugPrint('❌ Error fetching location: $e');
      _hasFetched = true;
      state = AsyncValue.error(e, st);
    }
  }

  /// Force refresh location (e.g., user pulled to refresh)
  Future<void> refresh() => fetchLocation(forceRefresh: true);
}

/// Global location provider - shared across all screens
final userLocationProvider = NotifierProvider<UserLocationNotifier, AsyncValue<UserLocation>>(() {
  return UserLocationNotifier();
});
