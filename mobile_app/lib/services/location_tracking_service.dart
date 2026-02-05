import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'order_service.dart';

/// Location Tracking Service for courier delivery tracking
/// Updates courier location every 3 minutes during active delivery
class LocationTrackingService {
  static final LocationTrackingService _instance = LocationTrackingService._internal();
  factory LocationTrackingService() => _instance;
  LocationTrackingService._internal();

  final OrderService _orderService = OrderService();
  
  Timer? _locationTimer;
  String? _activeOrderId;
  bool _isTracking = false;

  bool get isTracking => _isTracking;
  String? get activeOrderId => _activeOrderId;

  /// Request location permissions
  Future<bool> requestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      debugPrint('[LocationTracking] Location services are disabled');
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        debugPrint('[LocationTracking] Location permission denied');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      debugPrint('[LocationTracking] Location permission permanently denied');
      return false;
    }

    return true;
  }

  /// Start tracking for a specific order
  Future<bool> startTracking(String orderId) async {
    if (_isTracking) {
      debugPrint('[LocationTracking] Already tracking order: $_activeOrderId');
      return false;
    }

    final hasPermission = await requestPermission();
    if (!hasPermission) {
      debugPrint('[LocationTracking] No location permission');
      return false;
    }

    _activeOrderId = orderId;
    _isTracking = true;

    // Send initial location immediately
    await _updateLocation();

    // Start periodic updates every 3 minutes (180 seconds)
    _locationTimer = Timer.periodic(
      const Duration(minutes: 3),
      (_) => _updateLocation(),
    );

    debugPrint('[LocationTracking] Started tracking order: $orderId');
    return true;
  }

  /// Stop tracking
  void stopTracking() {
    _locationTimer?.cancel();
    _locationTimer = null;
    _isTracking = false;
    _activeOrderId = null;
    debugPrint('[LocationTracking] Stopped tracking');
  }

  /// Update current location to Firestore
  Future<void> _updateLocation() async {
    if (!_isTracking || _activeOrderId == null) return;

    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 30),
      );

      await _orderService.updateCourierLocation(
        orderId: _activeOrderId!,
        lat: position.latitude,
        lng: position.longitude,
      );

      debugPrint('[LocationTracking] Updated location: ${position.latitude}, ${position.longitude}');
    } catch (e) {
      debugPrint('[LocationTracking] Error updating location: $e');
    }
  }

  /// Get current position once
  Future<Position?> getCurrentPosition() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;

    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 30),
      );
    } catch (e) {
      debugPrint('[LocationTracking] Error getting position: $e');
      return null;
    }
  }

  /// Calculate distance between two points in meters
  double calculateDistance(
    double startLat,
    double startLng,
    double endLat,
    double endLng,
  ) {
    return Geolocator.distanceBetween(startLat, startLng, endLat, endLng);
  }

  /// Dispose resources
  void dispose() {
    stopTracking();
  }
}
