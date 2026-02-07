import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'order_service.dart';

/// Location Tracking Service for courier delivery tracking
/// Uses Geolocator stream for true background location updates on iOS.
/// The stream survives app backgrounding when UIBackgroundModes includes 'location'.
class LocationTrackingService {
  static final LocationTrackingService _instance = LocationTrackingService._internal();
  factory LocationTrackingService() => _instance;
  LocationTrackingService._internal();

  final OrderService _orderService = OrderService();
  
  StreamSubscription<Position>? _positionSubscription;
  Timer? _heartbeatTimer;
  String? _activeOrderId;
  bool _isTracking = false;
  Position? _lastPosition;

  bool get isTracking => _isTracking;
  String? get activeOrderId => _activeOrderId;

  /// Request location permissions — requests 'Always' for background tracking
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

    // If we only have whenInUse, request Always for background
    if (permission == LocationPermission.whileInUse) {
      debugPrint('[LocationTracking] Have whenInUse, requesting Always for background tracking');
      permission = await Geolocator.requestPermission();
    }

    debugPrint('[LocationTracking] Permission status: $permission');
    return true;
  }

  /// Start tracking for a specific order using position stream
  Future<bool> startTracking(String orderId) async {
    if (_isTracking) {
      if (_activeOrderId == orderId) {
        debugPrint('[LocationTracking] Already tracking this order: $orderId');
        return true;
      }
      // Different order — stop old tracking first
      debugPrint('[LocationTracking] Switching from order $_activeOrderId to $orderId');
      stopTracking();
    }

    final hasPermission = await requestPermission();
    if (!hasPermission) {
      debugPrint('[LocationTracking] No location permission');
      return false;
    }

    _activeOrderId = orderId;
    _isTracking = true;

    // Send initial location immediately
    await _sendCurrentLocation();

    // Start position stream for real-time background updates
    _startPositionStream();

    // Also start a heartbeat timer as fallback (every 1 minute)
    // This ensures Firestore gets updated even if stream events are sparse
    _heartbeatTimer = Timer.periodic(
      const Duration(seconds: 10), // TEST: reduced from 1 minute for testing
      (_) => _sendHeartbeat(),
    );

    debugPrint('[LocationTracking] 🚀 Started background tracking for order: $orderId');
    return true;
  }

  /// Start listening to position stream with Apple-specific background settings
  void _startPositionStream() {
    // Cancel any existing subscription
    _positionSubscription?.cancel();

    late LocationSettings locationSettings;

    if (defaultTargetPlatform == TargetPlatform.iOS) {
      locationSettings = AppleSettings(
        accuracy: LocationAccuracy.high,
        activityType: ActivityType.automotiveNavigation,
        distanceFilter: 50, // Update every 50 meters moved
        pauseLocationUpdatesAutomatically: false, // Don't auto-pause
        showBackgroundLocationIndicator: true, // Blue bar on iOS
        allowBackgroundLocationUpdates: true, // Critical for background
      );
    } else {
      locationSettings = const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 50,
      );
    }

    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen(
      (Position position) {
        _lastPosition = position;
        _writeLocationToFirestore(position);
      },
      onError: (error) {
        debugPrint('[LocationTracking] Stream error: $error');
      },
    );

    debugPrint('[LocationTracking] Position stream started with background support');
  }

  /// Write location update to Firestore
  Future<void> _writeLocationToFirestore(Position position) async {
    if (!_isTracking || _activeOrderId == null) return;

    try {
      await _orderService.updateCourierLocation(
        orderId: _activeOrderId!,
        lat: position.latitude,
        lng: position.longitude,
      );
      debugPrint('[LocationTracking] 📍 Updated: ${position.latitude}, ${position.longitude}');
    } catch (e) {
      debugPrint('[LocationTracking] ❌ Error writing location: $e');
    }
  }

  /// Heartbeat fallback — if stream hasn't fired, send current position
  Future<void> _sendHeartbeat() async {
    if (!_isTracking || _activeOrderId == null) return;

    // If we have a recent position from the stream, use it
    if (_lastPosition != null) {
      await _writeLocationToFirestore(_lastPosition!);
      return;
    }

    // Otherwise get fresh position
    await _sendCurrentLocation();
  }

  /// Get and send current position once
  Future<void> _sendCurrentLocation() async {
    if (!_isTracking || _activeOrderId == null) return;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 30),
        ),
      );
      _lastPosition = position;
      await _writeLocationToFirestore(position);
    } catch (e) {
      debugPrint('[LocationTracking] Error getting initial position: $e');
    }
  }

  /// Stop tracking
  void stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _isTracking = false;
    _activeOrderId = null;
    _lastPosition = null;
    debugPrint('[LocationTracking] ⏹️ Stopped tracking');
  }

  /// Get current position once (for non-tracking uses)
  Future<Position?> getCurrentPosition() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 30),
        ),
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
