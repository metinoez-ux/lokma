import 'dart:math';
import 'package:geolocator/geolocator.dart';

class TravelInfo {
  final Duration duration;
  final Duration delay;
  final double distanceKm;
  final bool isWalking;

  TravelInfo({
    required this.duration,
    required this.delay,
    required this.distanceKm,
    required this.isWalking,
  });
}

class TrafficService {
  // Simulate getting travel info
  static Future<TravelInfo> getTravelInfo(
    double startLat,
    double startLng,
    double endLat,
    double endLng,
  ) async {
    // 1. Calculate straight-line distance
    final distanceMeters = Geolocator.distanceBetween(
      startLat,
      startLng,
      endLat,
      endLng,
    );
    
    // Estimate real distance (usually ~1.3x straight line)
    final distanceKm = (distanceMeters / 1000) * 1.3;

    // Check if it's walking distance (e.g., < 0.5 km)
    if (distanceKm < 0.5) {
      // Average walking speed ~5 km/h
      final walkingMinutes = (distanceKm / 5) * 60;
      
      await Future.delayed(const Duration(milliseconds: 300));

      return TravelInfo(
        duration: Duration(minutes: walkingMinutes.round()),
        delay: Duration.zero,
        distanceKm: distanceKm,
        isWalking: true,
      );
    }

    // 2. Estimate driving duration
    // Assume average speed of 50 km/h for mixed city/highway
    final baseMinutes = (distanceKm / 50) * 60;
    
    // 3. Simulate traffic delay
    // Random delay between 0 and 30 minutes, weighted by distance
    final random = Random();
    final delayMinutes = random.nextInt(30);
    
    // Total duration
    final totalDuration = Duration(minutes: baseMinutes.round() + delayMinutes);
    final delayDuration = Duration(minutes: delayMinutes);

    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 500));

    return TravelInfo(
      duration: totalDuration,
      delay: delayDuration,
      distanceKm: distanceKm,
      isWalking: false,
    );
  }
}
