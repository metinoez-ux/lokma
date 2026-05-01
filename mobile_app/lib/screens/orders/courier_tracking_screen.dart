import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geocoding/geocoding.dart';
import '../../services/order_service.dart';
import '../../utils/currency_utils.dart';
import 'order_chat_screen.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../services/chat_service.dart';

/// Courier Tracking Screen - Customer views courier location on map
class CourierTrackingScreen extends StatefulWidget {
  final String orderId;

  const CourierTrackingScreen({super.key, required this.orderId});

  @override
  State<CourierTrackingScreen> createState() => _CourierTrackingScreenState();
}

class _CourierTrackingScreenState extends State<CourierTrackingScreen>
    with SingleTickerProviderStateMixin {
  final OrderService _orderService = OrderService();
  final MapController _mapController = MapController();
  LokmaOrder? _order;

  // Geocoded delivery address
  LatLng? _deliveryPosition;
  bool _geocodingAttempted = false;

  // Business location from Firestore
  LatLng? _businessPosition;
  String? _businessName;
  bool _businessFetched = false;

  // Auto-refresh
  Timer? _refreshTimer;
  int _refreshKey = 0;
  bool _showOrderDetails = false;
  bool _initialLoadDone = false;

  // Animation for hopping motorcycle marker
  late AnimationController _hopController;
  late Animation<double> _hopAnimation;

  @override
  void initState() {
    super.initState();
    _hopController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..repeat(reverse: true);

    _hopAnimation = Tween<double>(begin: 0, end: -8).animate(
      CurvedAnimation(parent: _hopController, curve: Curves.easeInOut),
    );

    // Auto-refresh every 5 seconds
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) {
        setState(() {
          _refreshKey++;
          if (!_initialLoadDone) _initialLoadDone = true;
        });
        debugPrint('[CourierTracking] Auto-refresh #$_refreshKey');
      }
    });
  }

  @override
  void dispose() {
    _hopController.dispose();
    _refreshTimer?.cancel();
    super.dispose();
  }

  /// Geocode delivery address to get coordinates
  Future<void> _geocodeDeliveryAddress(String address) async {
    if (_geocodingAttempted) return;
    _geocodingAttempted = true;

    try {
      final locations = await locationFromAddress(address);
      if (locations.isNotEmpty && mounted) {
        setState(() {
          _deliveryPosition = LatLng(
            locations.first.latitude,
            locations.first.longitude,
          );
        });
        _centerMapOnAvailablePositions();
      }
    } catch (e) {
      debugPrint('[CourierTracking] Geocoding failed for: $address — $e');
    }
  }

  /// Fetch business location from Firestore using butcherId
  Future<void> _fetchBusinessLocation(String butcherId) async {
    if (_businessFetched) return;
    _businessFetched = true;

    try {
      final doc = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(butcherId)
          .get();

      if (doc.exists && mounted) {
        final data = doc.data()!;
        final lat = data['lat'];
        final lng = data['lng'];
        if (lat != null && lng != null) {
          setState(() {
            _businessPosition = LatLng(
              (lat as num).toDouble(),
              (lng as num).toDouble(),
            );
            _businessName =
                data['name'] as String? ?? data['businessName'] as String?;
          });
          _centerMapOnAvailablePositions();
          debugPrint(
              '[CourierTracking] Business location: $lat, $lng, name: $_businessName');
        }
      }
    } catch (e) {
      debugPrint('[CourierTracking] Failed to fetch business location: $e');
    }
  }

  void _centerMapOnAvailablePositions() {
    if (!mounted) return;

    final hasB = _businessPosition != null;
    final hasD = _deliveryPosition != null;
    
    LatLng? courierPos;
    if (_order?.courierLocation != null) {
      courierPos = LatLng(
        (_order!.courierLocation!['lat'] as num).toDouble(),
        (_order!.courierLocation!['lng'] as num).toDouble(),
      );
    }
    
    final points = <LatLng>[];
    if (_businessPosition != null) points.add(_businessPosition!);
    if (_deliveryPosition != null) points.add(_deliveryPosition!);
    if (courierPos != null) points.add(courierPos);
    
    if (points.isNotEmpty) {
      if (points.length == 1) {
        _mapController.move(points.first, 15);
      } else {
        final bounds = LatLngBounds.fromPoints(points);
        try {
          _mapController.fitCamera(
            CameraFit.bounds(
              bounds: bounds,
              padding: const EdgeInsets.all(60),
            ),
          );
        } catch (_) {
          _mapController.move(points.last, 14);
        }
      }
    }
  }

  static const Color _brandColor = Color(0xFFEA184A);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('orders.courier_tracking')),
      ),
      body: StreamBuilder<LokmaOrder?>(
        key: ValueKey(_refreshKey),
        stream: _orderService.getOrderStream(widget.orderId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData) {
            return Center(child: Text(tr('orders.order_not_found')));
          }

          final order = snapshot.data!;
          _order = order;

          // Geocode delivery address if not done yet
          if (order.deliveryAddress != null && !_geocodingAttempted) {
            _geocodeDeliveryAddress(order.deliveryAddress!);
          }

          // Fetch business location from Firestore
          if (!_businessFetched) {
            _fetchBusinessLocation(order.butcherId);
          }

          // Check if courier is on the way
          if (order.status != OrderStatus.onTheWay) {
            return _buildNotOnTheWayView(order);
          }

          return _buildTrackingView(order);
        },
      ),
    );
  }

  Widget _buildNotOnTheWayView(LokmaOrder order) {
    String statusMessage;
    IconData statusIcon;
    Color statusColor;

    switch (order.status) {
      case OrderStatus.delivered:
        statusMessage = 'Siparişiniz teslim edildi!';
        statusIcon = Icons.check_circle;
        statusColor = Colors.green;
        break;
      case OrderStatus.ready:
        statusMessage = 'Siparişiniz hazır, kurye bekleniyor...';
        statusIcon = Icons.access_time;
        statusColor = Colors.amber;
        break;
      case OrderStatus.preparing:
        statusMessage = 'Siparişiniz hazırlanıyor...';
        statusIcon = Icons.restaurant;
        statusColor = Colors.blue;
        break;
      default:
        statusMessage = 'Sipariş durumu: ${order.status.name}';
        statusIcon = Icons.info;
        statusColor = Colors.grey;
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(statusIcon, size: 80, color: statusColor),
          const SizedBox(height: 24),
          Text(
            statusMessage,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: statusColor,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildTrackingView(LokmaOrder order) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Default center if no location yet (Istanbul)
    LatLng courierPosition = const LatLng(41.0082, 28.9784);
    bool hasLocation = false;

    if (order.courierLocation != null) {
      courierPosition = LatLng(
        order.courierLocation!['lat']!,
        order.courierLocation!['lng']!,
      );
      hasLocation = true;
    }

    // Business location from Firestore (fetched via _fetchBusinessLocation)
    final businessPosition = _businessPosition;

    // Calculate distance and ETA from courier to delivery
    double? distanceKm;
    int? etaMinutes;
    if (hasLocation && _deliveryPosition != null) {
      final distanceMeters = Geolocator.distanceBetween(
        courierPosition.latitude,
        courierPosition.longitude,
        _deliveryPosition!.latitude,
        _deliveryPosition!.longitude,
      );
      distanceKm = distanceMeters / 1000;
      // Estimate ~30 km/h average city delivery speed
      etaMinutes = ((distanceKm / 30) * 60).ceil();
      if (etaMinutes < 1) etaMinutes = 1;
    }

    return Column(
      children: [
        // Map
        Expanded(
          child: Stack(
            children: [
              SizedBox.expand(
                child: FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: hasLocation
                        ? courierPosition
                        : (businessPosition ??
                            _deliveryPosition ??
                            const LatLng(41.0082, 28.9784)),
                    initialZoom: 14,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                      subdomains: const ['a', 'b', 'c', 'd'],
                      userAgentPackageName: 'com.lokma.app',
                    ),
                    // Static markers (business + delivery)
                    MarkerLayer(
                      rotate: true,
                      markers: [
                        // Business marker (where order was picked up)
                        if (businessPosition != null)
                          Marker(
                            point: businessPosition,
                            width: 120,
                            height: 64,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: _brandColor,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                        color: Colors.white, width: 2),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.3),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.storefront,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                ),
                                if (_businessName != null)
                                  Container(
                                    margin: const EdgeInsets.only(top: 2),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(8),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.2),
                                          blurRadius: 4,
                                        ),
                                      ],
                                    ),
                                    child: Text(
                                      _businessName!,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.black87,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        // Delivery address marker (customer location)
                        if (_deliveryPosition != null)
                          Marker(
                            point: _deliveryPosition!,
                            width: 44,
                            height: 44,
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.blue.shade700,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.3),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.home,
                                color: Colors.white,
                                size: 22,
                              ),
                            ),
                          ),
                      ],
                    ),
                    // Animated courier marker (hopping) -- only if location exists
                    if (hasLocation)
                      AnimatedBuilder(
                        animation: _hopAnimation,
                        builder: (context, child) {
                          return MarkerLayer(
                            rotate: true,
                            markers: [
                              Marker(
                                point: courierPosition,
                                width: 50,
                                height: 50,
                                child: Transform.translate(
                                  offset: Offset(0, _hopAnimation.value),
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: Colors.red.shade600,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                          color: Colors.white, width: 2),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.3),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: const Icon(
                                      Icons.moped,
                                      color: Colors.white,
                                      size: 30,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                  ],
                ),
              ),
              // Info banner when courier location is not available
              if (!hasLocation && _initialLoadDone)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    margin: const EdgeInsets.all(12),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.12),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.gps_fixed, color: Colors.amber.shade700, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Kurye konumu guncelleniyor...',
                            style: TextStyle(
                              color: isDark ? Colors.white70 : Colors.black87,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        SizedBox(
                          width: 16, height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.amber.shade700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // Re-center button
              Positioned(
                right: 16,
                bottom: 16,
                child: FloatingActionButton(
                  mini: true,
                  backgroundColor: Colors.white,
                  onPressed: _centerMapOnAvailablePositions,
                  child: Icon(Icons.my_location, color: Colors.blue.shade700),
                ),
              ),
            ],
          ),
        ),

        // Collapsible order details panel
        _buildCollapsibleOrderPanel(order, isDark, distanceKm, etaMinutes),
      ],
    );
  }

  Widget _buildCollapsibleOrderPanel(
      LokmaOrder order, bool isDark, double? distanceKm, int? etaMinutes) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Courier info header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                // Courier avatar
                CircleAvatar(
                  radius: 24,
                  backgroundColor: _brandColor.withOpacity(0.15),
                  child: const Icon(Icons.person, color: _brandColor, size: 28),
                ),
                const SizedBox(width: 16),

                // Courier info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _formatCourierName(order.courierName),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.green.shade100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.delivery_dining,
                                    size: 14, color: Colors.green.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  tr('orders.on_the_way'),
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.green.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Distance & ETA info
                          if (distanceKm != null && etaMinutes != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              '~${etaMinutes} dk (${distanceKm.toStringAsFixed(1)} km)',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),

                // Call button
                if (order.courierPhone != null &&
                    order.courierPhone!.isNotEmpty)
                  IconButton(
                    onPressed: () => _callCourier(order.courierPhone!),
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.green,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(Icons.phone,
                          color: Colors.white, size: 18),
                    ),
                  ),
              ],
            ),
          ),

          Divider(
              height: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),

          // Legend row (always visible, compact)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            color: isDark ? Colors.grey[850] : Colors.grey[50],
            child: Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                _buildLegendItem(Colors.red.shade600, Icons.moped,
                    tr('orders.courier'), isDark),
                _buildLegendItem(_brandColor, Icons.storefront,
                    tr('orders.business'), isDark),
                _buildLegendItem(Colors.blue.shade700, Icons.home,
                    tr('orders.delivery'), isDark),
              ],
            ),
          ),
          // Tappable order summary header
          GestureDetector(
            onTap: () => setState(() => _showOrderDetails = !_showOrderDetails),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long, color: _brandColor, size: 20),
                  const SizedBox(width: 10),
                  Text(
                    '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${order.items.length} ürün',
                    style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                  ),
                  const Spacer(),
                  Text(
                    '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Colors.green,
                    ),
                  ),
                  const SizedBox(width: 8),
                  AnimatedRotation(
                    turns: _showOrderDetails ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child:
                        const Icon(Icons.keyboard_arrow_up, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ),
          // Expandable order items
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Container(
              constraints: const BoxConstraints(maxHeight: 200),
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                itemCount: order.items.length,
                separatorBuilder: (_, __) => Divider(
                    height: 1,
                    color: isDark ? Colors.grey[700] : Colors.grey[200]),
                itemBuilder: (context, index) {
                  final item = order.items[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: _brandColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Center(
                            child: Text(
                              '${item.quantity}x',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: _brandColor,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            item.name,
                            style: const TextStyle(fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          '${(item.price * item.quantity).toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.grey[300] : Colors.grey[700],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            crossFadeState: _showOrderDetails
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 250),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(
      Color color, IconData icon, String label, bool isDark) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: Colors.white, size: 12),
        ),
        const SizedBox(width: 4),
        Text(label,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: isDark ? Colors.grey[300] : Colors.grey[800])),
      ],
    );
  }

  String _formatCourierName(String? fullName) {
    if (fullName == null || fullName.trim().isEmpty)
      return tr('orders.courier');
    final parts = fullName.trim().split(' ');
    if (parts.isEmpty) return '';

    String mask(String word) {
      if (word.length <= 1) return word;
      if (word.length == 2) return '${word[0]}*';
      return '${word[0]}${'*' * (word.length - 2)}${word[word.length - 1]}';
    }

    return parts.map((p) => mask(p)).join(' ');
  }

  String _formatDateAndTime(DateTime time) {
    final local = time.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final year = local.year.toString();
    final hour = local.hour.toString().padLeft(2, '0');
    final min = local.minute.toString().padLeft(2, '0');
    return '$day.$month.$year | $hour:$min';
  }

  String _formatTime(DateTime time) {
    // Ensure both times are in UTC for accurate comparison
    final nowUtc = DateTime.now().toUtc();
    final timeUtc = time.toUtc();
    final diff = nowUtc.difference(timeUtc);

    if (diff.isNegative || diff.inSeconds < 30) {
      return tr('orders.just_now');
    } else if (diff.inMinutes < 1) {
      return tr('orders.seconds_ago', args: [diff.inSeconds.toString()]);
    } else if (diff.inMinutes < 60) {
      return tr('orders.minutes_ago', args: [diff.inMinutes.toString()]);
    } else {
      final localTime = time.toLocal();
      return '${localTime.hour.toString().padLeft(2, '0')}:${localTime.minute.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _callCourier(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}
