import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';

/// Full-screen interactive map picker for fine-tuning delivery location.
///
/// Features:
/// - Satellite / Street view toggle (3D pill)
/// - Draggable pin (map moves, pin stays centered)
/// - Reverse-geocoded address banner
/// - "Finde mich" GPS snap button
/// - Delivery radius circle visualization
/// - Out-of-range detection with dialog
/// - Warning banner when pin drifts far from original position
class DeliveryMapPickerScreen extends StatefulWidget {
  final double initialLat;
  final double initialLng;
  final String addressLabel;
  final double? businessLat;
  final double? businessLng;
  final double deliveryRadiusKm;

  const DeliveryMapPickerScreen({
    super.key,
    required this.initialLat,
    required this.initialLng,
    required this.addressLabel,
    this.businessLat,
    this.businessLng,
    this.deliveryRadiusKm = 5.0,
  });

  @override
  State<DeliveryMapPickerScreen> createState() => _DeliveryMapPickerScreenState();
}

class _DeliveryMapPickerScreenState extends State<DeliveryMapPickerScreen> {
  late final MapController _mapController;
  late LatLng _currentCenter;
  String _resolvedAddress = '';
  bool _isSatellite = false;
  bool _isLoadingAddress = false;
  bool _pinMovedFar = false;
  Timer? _debounceTimer;

  // Brand color
  static const Color brandOrange = Color(0xFFE8772E);

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _currentCenter = LatLng(widget.initialLat, widget.initialLng);
    _resolvedAddress = widget.addressLabel;
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  /// Reverse-geocode the current center position (debounced)
  void _onMapMoved(LatLng center) {
    _currentCenter = center;

    // Check if pin moved far from original (>500m)
    final distanceM = const Distance().as(
      LengthUnit.Meter,
      LatLng(widget.initialLat, widget.initialLng),
      center,
    );
    final movedFar = distanceM > 500;
    if (movedFar != _pinMovedFar) {
      setState(() => _pinMovedFar = movedFar);
    }

    // Debounce reverse geocoding
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 400), () {
      _reverseGeocode(center);
    });
  }

  Future<void> _reverseGeocode(LatLng pos) async {
    if (!mounted) return;
    setState(() => _isLoadingAddress = true);
    try {
      final placemarks = await placemarkFromCoordinates(pos.latitude, pos.longitude);
      if (placemarks.isNotEmpty && mounted) {
        final p = placemarks.first;
        final street = p.street ?? '';
        final locality = p.locality ?? '';
        final postalCode = p.postalCode ?? '';
        setState(() {
          _resolvedAddress = [
            street,
            if (postalCode.isNotEmpty || locality.isNotEmpty) '$postalCode $locality'.trim(),
          ].where((s) => s.isNotEmpty).join(', ');
          _isLoadingAddress = false;
        });
      }
    } catch (e) {
      debugPrint('[MapPicker] Reverse geocoding failed: $e');
      if (mounted) setState(() => _isLoadingAddress = false);
    }
  }

  /// Snap map to user's current GPS position
  Future<void> _findMe() async {
    HapticFeedback.mediumImpact();
    try {
      // Check permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          return;
        }
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final target = LatLng(position.latitude, position.longitude);
      _mapController.move(target, _mapController.camera.zoom);
      _onMapMoved(target);
    } catch (e) {
      debugPrint('[MapPicker] GPS error: $e');
    }
  }

  /// Check if selected location is within delivery radius and confirm
  void _confirmLocation() {
    HapticFeedback.lightImpact();

    // Check delivery range if business location is provided
    if (widget.businessLat != null && widget.businessLng != null) {
      final distanceM = Geolocator.distanceBetween(
        _currentCenter.latitude,
        _currentCenter.longitude,
        widget.businessLat!,
        widget.businessLng!,
      );
      final radiusM = widget.deliveryRadiusKm * 1000;

      if (distanceM > radiusM) {
        _showOutOfRangeDialog();
        return;
      }
    }

    // Return result
    Navigator.of(context).pop({
      'lat': _currentCenter.latitude,
      'lng': _currentCenter.longitude,
      'address': _resolvedAddress,
    });
  }

  void _showOutOfRangeDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'checkout.partner_no_delivery_title'.tr(),
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 18,
            color: isDark ? Colors.white : Colors.black,
          ),
          textAlign: TextAlign.center,
        ),
        content: Text(
          'checkout.partner_no_delivery_body'.tr(),
          style: TextStyle(
            fontSize: 14,
            color: isDark ? Colors.grey[300] : Colors.grey[700],
            height: 1.5,
          ),
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: brandOrange,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
              ),
              child: const Text('Ok', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusBarHeight = MediaQuery.of(context).padding.top;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    // Tile URL based on satellite vs street
    final tileUrl = _isSatellite
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    return Scaffold(
      body: Stack(
        children: [
          // ── Full-screen Map ──
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _currentCenter,
              initialZoom: 16,
              onPositionChanged: (pos, hasGesture) {
                _onMapMoved(pos.center);
              },
            ),
            children: [
              TileLayer(
                urlTemplate: tileUrl,
                userAgentPackageName: 'com.lokma.app',
              ),

              // 🟢 Delivery radius circle (visible boundary)
              if (widget.businessLat != null && widget.businessLng != null)
                CircleLayer(
                  circles: [
                    CircleMarker(
                      point: LatLng(widget.businessLat!, widget.businessLng!),
                      radius: widget.deliveryRadiusKm * 1000, // meters
                      useRadiusInMeter: true,
                      color: _isSatellite
                          ? brandOrange.withValues(alpha: 0.08)
                          : brandOrange.withValues(alpha: 0.06),
                      borderColor: _isSatellite
                          ? brandOrange.withValues(alpha: 0.70)
                          : brandOrange.withValues(alpha: 0.55),
                      borderStrokeWidth: 2.5,
                    ),
                  ],
                ),

              // Business marker (small dot)
              if (widget.businessLat != null && widget.businessLng != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: LatLng(widget.businessLat!, widget.businessLng!),
                      width: 28,
                      height: 28,
                      child: Container(
                        decoration: BoxDecoration(
                          color: brandOrange,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.3),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.storefront, color: Colors.white, size: 14),
                      ),
                    ),
                  ],
                ),
            ],
          ),

          // ── Center pin (fixed overlay) ──
          Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 40), // offset so pin points at center
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: brandOrange,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.35),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.person, color: Colors.white, size: 22),
                  ),
                  // Pin tail
                  Container(
                    width: 3,
                    height: 10,
                    decoration: BoxDecoration(
                      color: brandOrange,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  // Shadow dot
                  Container(
                    width: 10,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Top: Back button + Satellite/Street toggle ──
          Positioned(
            top: statusBarHeight + 8,
            left: 12,
            right: 12,
            child: Row(
              children: [
                // Back button
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Navigator.of(context).pop();
                  },
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.85),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.chevron_left,
                      color: isDark ? Colors.white : Colors.black,
                      size: 24,
                    ),
                  ),
                ),
                const Spacer(),
                // Satellite / Street toggle
                SizedBox(
                  width: 200,
                  child: ThreeDimensionalPillTabBar(
                    compact: true,
                    selectedIndex: _isSatellite ? 0 : 1,
                    onTabSelected: (i) {
                      setState(() => _isSatellite = i == 0);
                    },
                    tabs: [
                      TabItem(title: 'checkout.satellite'.tr()),
                      TabItem(title: 'checkout.street'.tr()),
                    ],
                  ),
                ),
                const Spacer(),
                const SizedBox(width: 38), // balance
              ],
            ),
          ),

          // ── Address banner ──
          Positioned(
            top: statusBarHeight + 60,
            left: 24,
            right: 24,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '${'checkout.meeting_point'.tr()} ',
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark ? Colors.grey[300] : Colors.grey[700],
                              ),
                            ),
                            TextSpan(
                              text: _isLoadingAddress ? '...' : _resolvedAddress,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: isDark ? Colors.white : Colors.black,
                              ),
                            ),
                          ],
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Warning banner (pin moved far) ──
          if (_pinMovedFar)
            Positioned(
              top: statusBarHeight + 110,
              left: 24,
              right: 24,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF3E2723) : const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? const Color(0xFF6D4C41) : const Color(0xFFFFCC80)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: isDark ? const Color(0xFFFFB74D) : const Color(0xFFE65100), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'checkout.pin_moved_far_warning'.tr(args: [widget.addressLabel]),
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? const Color(0xFFFFCC80) : const Color(0xFF4E342E),
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── "Finde mich" button ──
          Positioned(
            bottom: 190 + bottomPadding,
            right: 16,
            child: GestureDetector(
              onTap: _findMe,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: (isDark ? const Color(0xFF2C2C2E) : Colors.white),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.navigation_rounded, color: brandOrange, size: 18),
                    const SizedBox(width: 6),
                    Text(
                      'checkout.find_me'.tr(),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),


          // ── Bottom Panel ──
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(20, 20, 20, 16 + bottomPadding),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 16,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title row
                  Row(
                    children: [
                      Text(
                        'checkout.set_delivery_location'.tr(),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : Colors.black,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.info_outline,
                        size: 18,
                        color: isDark ? Colors.grey[400] : Colors.grey[500],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // Description
                  Text(
                    'checkout.move_pin_instruction'.tr(),
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Buttons row
                  Row(
                    children: [
                      // Cancel
                      Expanded(
                        child: TextButton(
                          onPressed: () {
                            HapticFeedback.lightImpact();
                            Navigator.of(context).pop();
                          },
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: Text(
                            'checkout.cancel'.tr(),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.white : Colors.black,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Confirm
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: _confirmLocation,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: brandOrange,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            elevation: 0,
                          ),
                          child: Text(
                            'checkout.confirm'.tr(),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
