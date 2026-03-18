import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:lokma_app/utils/time_utils.dart' as time_utils;

/// Bottom-sheet map showing open partners, filtered by segment and delivery mode.
/// Shows distance rings, km badges on markers, and tap-to-reveal info cards.
class OpenPartnersMapSheet extends StatefulWidget {
  final List<DocumentSnapshot> allBusinesses;
  final double? userLat;
  final double? userLng;
  final String deliveryMode;

  /// Active bottom-tab segment: 'essen' or 'markt'
  final String activeSegment;

  /// Sector type IDs that belong to this segment (from Firestore or fallback)
  final Set<String> sectorTypes;

  const OpenPartnersMapSheet({
    super.key,
    required this.allBusinesses,
    this.userLat,
    this.userLng,
    this.deliveryMode = 'teslimat',
    this.activeSegment = 'essen',
    this.sectorTypes = const {},
  });

  @override
  State<OpenPartnersMapSheet> createState() => _OpenPartnersMapSheetState();
}

class _OpenPartnersMapSheetState extends State<OpenPartnersMapSheet>
    with TickerProviderStateMixin {
  late final MapController _mapController;
  late AnimationController _pulseController;

  final List<_OpenBusiness> _openBusinesses = [];

  /// Currently selected business for the info card
  _OpenBusiness? _selectedBusiness;

  /// Current map zoom level for dynamic label scaling
  double _currentZoom = 13;

  static const Color openGreen = Color(0xFF2E7D32);
  static const Color lokmaPink = Color(0xFFFB335B);

  // Distance ring radii in meters
  static const List<double> _ringRadiiM = [5000, 10000, 15000];
  static const List<String> _ringLabels = ['5 km', '10 km', '15 km'];

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _extractOpenBusinesses();
    _currentZoom = _calculateZoom();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  /// Check if a business belongs to the active segment's sector types.
  bool _matchesSegment(Map<String, dynamic> data) {
    if (widget.sectorTypes.isEmpty) return true; // no filter = show all

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

    final businessType = data['businessType'];
    if (businessType is String && businessType.isNotEmpty) {
      businessSectorIds.add(businessType.toLowerCase());
    }

    return businessSectorIds.intersection(widget.sectorTypes).isNotEmpty;
  }

  /// Check delivery-mode availability for this business.
  bool _isAvailableForMode(Map<String, dynamic> data, double? distanceKm) {
    final mode = widget.deliveryMode;

    if (mode == 'teslimat') {
      final offersDelivery = data['offersDelivery'] as bool? ?? true;
      if (!offersDelivery) return false;
      final paused = data['temporaryDeliveryPaused'] as bool? ?? false;
      if (paused) return false;
      // Check delivery radius
      if (distanceKm != null) {
        final radius = (data['deliveryRadius'] as num?)?.toDouble() ?? 5.0;
        if (distanceKm > radius) return false;
      }
      return true;
    } else if (mode == 'gelal') {
      final offersPickup = data['offersPickup'] as bool? ?? true;
      if (!offersPickup) return false;
      final paused = data['temporaryPickupPaused'] as bool? ?? false;
      if (paused) return false;
      return true;
    }
    // masa / default – just open is enough
    return true;
  }

  void _extractOpenBusinesses() {
    final now = DateTime.now();

    for (final doc in widget.allBusinesses) {
      final data = doc.data() as Map<String, dynamic>;
      final isActive = data['isActive'] as bool? ?? true;
      if (!isActive) continue;

      // Segment filter
      if (!_matchesSegment(data)) continue;

      // Check if open
      final openingHelper = OpeningHoursHelper(data['openingHours']);
      if (!openingHelper.isOpenAt(now)) continue;

      // Extract lat/lng
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
          if (placeDetails['lat'] is num) {
            lat = (placeDetails['lat'] as num).toDouble();
          }
          if (placeDetails['lng'] is num) {
            lng = (placeDetails['lng'] as num).toDouble();
          }
        }
      }

      if (lat == null || lng == null) continue;

      // Calculate distance from user
      double? distanceKm;
      if (widget.userLat != null && widget.userLng != null) {
        final distanceM = Geolocator.distanceBetween(
          widget.userLat!,
          widget.userLng!,
          lat,
          lng,
        );
        distanceKm = distanceM / 1000;
      }

      // Delivery-mode filter
      if (!_isAvailableForMode(data, distanceKm)) continue;

      final name =
          (data['businessName'] ?? data['companyName'] ?? '').toString();
      final logoUrl = data['logoUrl'] as String?;

      // Get today's closing time from hours string (e.g. "09:00 - 22:00")
      String? closingTime;
      int? minutesUntilClose;
      final hoursStr = openingHelper.getHoursStringForDate(now);
      if (hoursStr != null) {
        final cleaned = hoursStr.replaceAll('\u2013', '-').trim();
        final rangeParts = cleaned.split('-');
        if (rangeParts.length == 2) {
          closingTime = time_utils.normalizeTimeString(rangeParts[1].trim());
          final timeParts = closingTime!.split(':');
          if (timeParts.length == 2) {
            final closeHour = int.tryParse(timeParts[0].trim()) ?? 0;
            final closeMinute = int.tryParse(timeParts[1].trim()) ?? 0;
            final closeDateTime = DateTime(
              now.year, now.month, now.day, closeHour, closeMinute,
            );
            minutesUntilClose = closeDateTime.difference(now).inMinutes;
            if (minutesUntilClose < 0) minutesUntilClose = null;
          }
        }
      }

      _openBusinesses.add(_OpenBusiness(
        id: doc.id,
        name: name,
        lat: lat,
        lng: lng,
        distanceKm: distanceKm,
        logoUrl: logoUrl,
        closingTime: closingTime,
        minutesUntilClose: minutesUntilClose,
        openingHoursData: data['openingHours'],
      ));
    }

    // Sort by distance
    _openBusinesses.sort((a, b) {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm!.compareTo(b.distanceKm!);
    });
  }

  LatLng _calculateCenter() {
    if (widget.userLat != null && widget.userLng != null) {
      return LatLng(widget.userLat!, widget.userLng!);
    }
    if (_openBusinesses.isEmpty) {
      return LatLng(51.0504, 6.2011);
    }
    double sumLat = 0, sumLng = 0;
    for (final b in _openBusinesses) {
      sumLat += b.lat;
      sumLng += b.lng;
    }
    return LatLng(
        sumLat / _openBusinesses.length, sumLng / _openBusinesses.length);
  }

  double _calculateZoom() {
    if (_openBusinesses.isEmpty) return 13;
    if (_openBusinesses.length == 1) return 14;

    double minLat = double.infinity, maxLat = -double.infinity;
    double minLng = double.infinity, maxLng = -double.infinity;

    for (final b in _openBusinesses) {
      minLat = min(minLat, b.lat);
      maxLat = max(maxLat, b.lat);
      minLng = min(minLng, b.lng);
      maxLng = max(maxLng, b.lng);
    }

    if (widget.userLat != null && widget.userLng != null) {
      minLat = min(minLat, widget.userLat!);
      maxLat = max(maxLat, widget.userLat!);
      minLng = min(minLng, widget.userLng!);
      maxLng = max(maxLng, widget.userLng!);
    }

    final latDiff = maxLat - minLat;
    final lngDiff = maxLng - minLng;
    final maxDiff = max(latDiff, lngDiff);

    if (maxDiff < 0.01) return 15;
    if (maxDiff < 0.05) return 13;
    if (maxDiff < 0.1) return 12;
    if (maxDiff < 0.5) return 10;
    return 9;
  }

  /// Estimated travel time string.
  String _estimatedTravelTime(double km) {
    if (widget.deliveryMode == 'gelal' || widget.deliveryMode == 'masa') {
      // Walking / driving estimate: ~40 km/h average car in city
      final minutes = (km / 40 * 60).round();
      if (minutes < 1) return '< 1 Min.';
      return '~$minutes Min.';
    }
    // Lieferung — courier estimate: ~25 km/h average
    final minutes = (km / 25 * 60).round();
    if (minutes < 1) return '< 1 Min.';
    return '~$minutes Min.';
  }

  /// Mode label for header subtitle
  String _modeLabel() {
    switch (widget.deliveryMode) {
      case 'teslimat':
        return 'marketplace.mode_delivery'.tr();
      case 'gelal':
        return 'marketplace.mode_pickup'.tr();
      case 'masa':
        return 'marketplace.mode_dine_in'.tr();
      default:
        return '';
    }
  }

  /// Segment label for header
  String _segmentLabel() {
    switch (widget.activeSegment) {
      case 'essen':
        return 'navigation.essen'.tr();
      case 'markt':
        return 'navigation.markt'.tr();
      default:
        return '';
    }
  }

  void _onMarkerTap(_OpenBusiness business) {
    HapticFeedback.lightImpact();
    setState(() {
      _selectedBusiness =
          (_selectedBusiness?.id == business.id) ? null : business;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    if (_openBusinesses.isEmpty) {
      return _buildEmptyState(isDark, bottomPadding);
    }

    return _buildMapView(isDark, bottomPadding);
  }

  Widget _buildEmptyState(bool isDark, double bottomPadding) {
    return Container(
      padding: EdgeInsets.fromLTRB(24, 8, 24, 20 + bottomPadding),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[600] : Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          Icon(
            Icons.storefront_outlined,
            size: 56,
            color: isDark ? Colors.grey[500] : Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            'marketplace.no_open_partners_title'.tr(),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.black,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'marketplace.no_open_partners_body'.tr(),
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: lokmaPink,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
              ),
              child: Text(
                'checkout.go_back'.tr(),
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapView(bool isDark, double bottomPadding) {
    final center = _calculateCenter();
    final zoom = _calculateZoom();

    return Container(
      height: MediaQuery.of(context).size.height * 0.78,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Stack(
        children: [
          Column(
            children: [
              // Header
              _buildHeader(isDark),
              // Map
              Expanded(
                child: ClipRRect(
                  child: FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: center,
                      initialZoom: zoom,
                      onPositionChanged: (camera, hasGesture) {
                        if (camera.zoom != _currentZoom) {
                          setState(() => _currentZoom = camera.zoom);
                        }
                      },
                      onTap: (_, __) {
                        // Dismiss info card on map tap
                        if (_selectedBusiness != null) {
                          setState(() => _selectedBusiness = null);
                        }
                      },
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.lokma.app',
                      ),

                      // ── Distance Rings ──
                      if (widget.userLat != null && widget.userLng != null)
                        CircleLayer(
                          circles: List.generate(_ringRadiiM.length, (i) {
                            final opacity = 0.06 - (i * 0.015);
                            final borderOpacity = 0.35 - (i * 0.08);
                            return CircleMarker(
                              point: LatLng(
                                  widget.userLat!, widget.userLng!),
                              radius: _ringRadiiM[i],
                              useRadiusInMeter: true,
                              color: lokmaPink.withValues(
                                  alpha: opacity.clamp(0.01, 0.1)),
                              borderColor: lokmaPink.withValues(
                                  alpha: borderOpacity.clamp(0.1, 0.5)),
                              borderStrokeWidth: 1.5,
                            );
                          }),
                        ),

                      // ── Ring Labels ──
                      if (widget.userLat != null && widget.userLng != null)
                        MarkerLayer(
                          rotate: true,
                          markers: List.generate(_ringRadiiM.length, (i) {
                            // Place label at the north edge of each ring
                            final radiusDeg = _ringRadiiM[i] / 111320;
                            return Marker(
                              point: LatLng(
                                widget.userLat! + radiusDeg,
                                widget.userLng!,
                              ),
                              width: 48,
                              height: 20,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: (isDark
                                          ? Colors.black
                                          : Colors.white)
                                      .withValues(alpha: 0.8),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: lokmaPink.withValues(alpha: 0.3),
                                    width: 0.5,
                                  ),
                                ),
                                child: Text(
                                  _ringLabels[i],
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                    color: lokmaPink,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            );
                          }),
                        ),

                      // ── User location marker ──
                      if (widget.userLat != null && widget.userLng != null)
                        MarkerLayer(
                          rotate: true,
                          markers: [
                            Marker(
                              point:
                                  LatLng(widget.userLat!, widget.userLng!),
                              width: 20,
                              height: 20,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.blue,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                      color: Colors.white, width: 2.5),
                                  boxShadow: [
                                    BoxShadow(
                                      color:
                                          Colors.blue.withValues(alpha: 0.3),
                                      blurRadius: 6,
                                      spreadRadius: 2,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),

                      // ── Business markers ──
                      MarkerLayer(
                        rotate: true,
                        markers: _openBusinesses.map((business) {
                          final isSelected =
                              _selectedBusiness?.id == business.id;
                          final closingSoon =
                              business.minutesUntilClose != null &&
                                  business.minutesUntilClose! <= 30;

                          // Scale factor: at zoom 13 = 1.0, at zoom 18 = ~1.8
                          final scaleFactor = (1.0 + (_currentZoom - 13) * 0.16).clamp(0.8, 2.0);
                          final markerWidth = (130 * scaleFactor).clamp(100.0, 260.0);
                          final markerHeight = (72 * scaleFactor).clamp(60.0, 144.0);

                          return Marker(
                            point: LatLng(business.lat, business.lng),
                            width: markerWidth,
                            height: markerHeight,
                            child: GestureDetector(
                              onTap: () => _onMarkerTap(business),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Pulsing marker dot
                                  SizedBox(
                                    width: 36,
                                    height: 36,
                                    child: Stack(
                                      alignment: Alignment.center,
                                      children: [
                                        // Pulse ring
                                        AnimatedBuilder(
                                          animation: _pulseController,
                                          builder: (context, child) {
                                            return Container(
                                              width: 24 +
                                                  (_pulseController.value *
                                                      12),
                                              height: 24 +
                                                  (_pulseController.value *
                                                      12),
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                border: Border.all(
                                                  color: (isSelected
                                                          ? lokmaPink
                                                          : openGreen)
                                                      .withValues(
                                                    alpha: 0.5 *
                                                        (1 -
                                                            _pulseController
                                                                .value),
                                                  ),
                                                  width: 2,
                                                ),
                                              ),
                                            );
                                          },
                                        ),
                                        // Core dot
                                        Container(
                                          width: (isSelected ? 26 : 22) * scaleFactor,
                                          height: (isSelected ? 26 : 22) * scaleFactor,
                                          decoration: BoxDecoration(
                                            color: isSelected
                                                ? lokmaPink
                                                : openGreen,
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                                color: Colors.white,
                                                width: 2),
                                            boxShadow: [
                                              BoxShadow(
                                                color: (isSelected
                                                        ? lokmaPink
                                                        : openGreen)
                                                    .withValues(alpha: 0.4),
                                                blurRadius: 6,
                                                spreadRadius: 1,
                                              ),
                                            ],
                                          ),
                                          child: Icon(
                                            widget.activeSegment == 'markt'
                                                ? Icons.shopping_cart
                                                : Icons.restaurant,
                                            color: Colors.white,
                                            size: (isSelected ? 13 : 11) * scaleFactor,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Flag badge with name + distance
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: closingSoon
                                          ? const Color(0xFFFFF3E0)
                                          : (isDark
                                              ? Colors.black
                                                  .withValues(alpha: 0.8)
                                              : Colors.white
                                                  .withValues(alpha: 0.95)),
                                      borderRadius:
                                          BorderRadius.circular(8),
                                      border: Border.all(
                                        color: closingSoon
                                            ? Colors.orange
                                                .withValues(alpha: 0.5)
                                            : (isSelected
                                                ? lokmaPink
                                                    .withValues(alpha: 0.5)
                                                : Colors.transparent),
                                        width: isSelected || closingSoon
                                            ? 1
                                            : 0,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black
                                              .withValues(alpha: 0.15),
                                          blurRadius: 4,
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        // Open/closed indicator dot
                                        Container(
                                          width: 6 * scaleFactor,
                                          height: 6 * scaleFactor,
                                          margin: EdgeInsets.only(right: 3 * scaleFactor),
                                          decoration: BoxDecoration(
                                            color: openGreen,
                                            shape: BoxShape.circle,
                                            boxShadow: [
                                              BoxShadow(
                                                color: openGreen.withValues(alpha: 0.5),
                                                blurRadius: 3,
                                                spreadRadius: 0.5,
                                              ),
                                            ],
                                          ),
                                        ),
                                        // Name
                                        Flexible(
                                          child: Text(
                                            business.name.length > 12
                                                ? '${business.name.substring(0, 11)}...'
                                                : business.name,
                                            style: TextStyle(
                                              fontSize: 10.5 * scaleFactor,
                                              fontWeight: FontWeight.w600,
                                              color: closingSoon
                                                  ? const Color(0xFFE65100)
                                                  : (isDark
                                                      ? Colors.white
                                                      : Colors.black87),
                                            ),
                                            maxLines: 1,
                                            overflow:
                                                TextOverflow.ellipsis,
                                          ),
                                        ),
                                        // Distance pill
                                        if (business.distanceKm != null) ...[
                                          const SizedBox(width: 4),
                                          Container(
                                            padding:
                                                const EdgeInsets.symmetric(
                                                    horizontal: 4,
                                                    vertical: 1),
                                            decoration: BoxDecoration(
                                              color: lokmaPink
                                                  .withValues(alpha: 0.12),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              '${business.distanceKm!.toStringAsFixed(1)}km',
                                              style: TextStyle(
                                                fontSize: 9.5 * scaleFactor,
                                                fontWeight: FontWeight.w700,
                                                color: lokmaPink,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
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

          // ── Info Card (bottom overlay) ──
          if (_selectedBusiness != null)
            Positioned(
              bottom: bottomPadding + 12,
              left: 12,
              right: 12,
              child: _buildInfoCard(isDark),
            ),
        ],
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    final modeLabel = _modeLabel();
    final segLabel = _segmentLabel();

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Column(
        children: [
          // Drag handle
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[600] : Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Row(
            children: [
              Icon(Icons.location_on, color: openGreen, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'marketplace.open_partners_map_title'.tr(),
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                    if (segLabel.isNotEmpty || modeLabel.isNotEmpty)
                      Text(
                        [segLabel, modeLabel]
                            .where((s) => s.isNotEmpty)
                            .join(' · '),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: openGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_openBusinesses.length}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: openGreen,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: (isDark ? Colors.white : Colors.black)
                        .withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.close,
                      size: 18,
                      color: isDark ? Colors.grey[400] : Colors.grey[600]),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  /// Info card shown when a marker is tapped.
  Widget _buildInfoCard(bool isDark) {
    final b = _selectedBusiness!;

    final openingHelper = OpeningHoursHelper(b.openingHoursData);
    final hoursStr = openingHelper.getHoursStringForDate(DateTime.now());
    String hoursText = 'marketplace.hours_unknown'.tr();
    if (hoursStr != null && hoursStr.isNotEmpty) {
      hoursText = hoursStr.replaceAll('–', '–').trim();
    }

    final closingSoon =
        b.minutesUntilClose != null && b.minutesUntilClose! <= 30;

    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(16),
      color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Name + logo row
            Row(
              children: [
                // Logo
                if (b.logoUrl != null && b.logoUrl!.isNotEmpty)
                  Container(
                    width: 40,
                    height: 40,
                    margin: const EdgeInsets.only(right: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 4,
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: b.logoUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(
                          color: isDark
                              ? Colors.grey[800]
                              : Colors.grey[200],
                          child: Icon(Icons.store,
                              color: lokmaPink, size: 20),
                        ),
                      ),
                    ),
                  ),
                Expanded(
                  child: Text(
                    b.name,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                // Close button
                GestureDetector(
                  onTap: () => setState(() => _selectedBusiness = null),
                  child: Icon(Icons.close,
                      size: 20,
                      color: isDark ? Colors.grey[400] : Colors.grey[500]),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Info chips row
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                // Distance
                if (b.distanceKm != null)
                  _infoChip(
                    Icons.navigation_outlined,
                    '${b.distanceKm!.toStringAsFixed(1)} km',
                    lokmaPink,
                    isDark,
                  ),
                // Estimated travel time
                if (b.distanceKm != null)
                  _infoChip(
                    Icons.schedule_outlined,
                    _estimatedTravelTime(b.distanceKm!),
                    Colors.blue,
                    isDark,
                  ),
                // Opening hours
                _infoChip(
                  Icons.access_time_outlined,
                  hoursText,
                  openGreen,
                  isDark,
                ),
              ],
            ),

            // Closing soon warning
            if (closingSoon) ...[
              const SizedBox(height: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF3E2723)
                      : const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isDark
                        ? const Color(0xFF6D4C41)
                        : const Color(0xFFFFCC80),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded,
                        color: isDark
                            ? const Color(0xFFFFB74D)
                            : const Color(0xFFE65100),
                        size: 16),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        tr('marketplace.closes_in_minutes', namedArgs: {
                          'minutes': b.minutesUntilClose.toString()
                        }),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: isDark
                              ? const Color(0xFFFFCC80)
                              : const Color(0xFFE65100),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 14),

            // CTA Button
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton.icon(
                onPressed: () {
                  HapticFeedback.lightImpact();
                  Navigator.pop(context);
                  context.push(
                      '/kasap/${b.id}?mode=${widget.deliveryMode}');
                },
                icon: Icon(
                  widget.activeSegment == 'markt'
                      ? Icons.shopping_bag_outlined
                      : Icons.restaurant_menu,
                  size: 18,
                ),
                label: Text(
                  widget.activeSegment == 'markt'
                      ? 'marketplace.go_to_market'.tr()
                      : 'marketplace.go_to_restaurant'.tr(),
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: lokmaPink,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoChip(
      IconData icon, String text, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Data class for open businesses with coordinates and extra info.
class _OpenBusiness {
  final String id;
  final String name;
  final double lat;
  final double lng;
  final double? distanceKm;
  final String? logoUrl;
  final String? closingTime;
  final int? minutesUntilClose;
  final dynamic openingHoursData;

  const _OpenBusiness({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    this.distanceKm,
    this.logoUrl,
    this.closingTime,
    this.minutesUntilClose,
    this.openingHoursData,
  });
}
