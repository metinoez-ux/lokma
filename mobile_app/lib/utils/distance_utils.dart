class DistanceUtils {
  /// Calculates a smarter mocked ETA based on varying speed zones (city vs highway).
  /// This yields much more realistic driving times than a flat multiplier.
  static int calculateEstimatedDrivingMinutes(double distanceKm) {
    if (distanceKm <= 3.0) {
      // Very close: Traffic lights, parking, slow city streets (approx 17 km/h)
      return (distanceKm * 3.5).ceil();
    } else if (distanceKm <= 10.0) {
      // Inter-city driving (approx 30 km/h avg)
      return (10.5 + (distanceKm - 3.0) * 2.0).ceil();
    } else if (distanceKm <= 30.0) {
      // Main roads or outer ring roads, some highway (approx 55 km/h avg)
      return (24.5 + (distanceKm - 10.0) * 1.1).ceil();
    } else if (distanceKm <= 100.0) {
      // Mostly Autobahn (approx 75 km/h avg)
      return (46.5 + (distanceKm - 30.0) * 0.8).ceil();
    } else {
      // Long distance highway (approx 93 km/h avg)
      return (102.5 + (distanceKm - 100.0) * 0.65).ceil();
    }
  }
}
