import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geocoding/geocoding.dart';
import '../../services/order_service.dart';

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
  bool _businessFetched = false;
  
  // Auto-refresh
  Timer? _refreshTimer;
  int _refreshKey = 0;
  
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
    
    // Auto-refresh every 30 seconds
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) {
        setState(() {
          _refreshKey++;
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
          });
          debugPrint('[CourierTracking] 🏪 Business location: $lat, $lng');
        }
      }
    } catch (e) {
      debugPrint('[CourierTracking] Failed to fetch business location: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Kurye Takibi'),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () {
                setState(() {
                  _refreshKey++;
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.refresh, size: 16, color: Colors.white),
                    SizedBox(width: 4),
                    Text('Güncelle', style: TextStyle(fontSize: 12, color: Colors.white)),
                  ],
                ),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
        actions: [
          if (_order?.courierPhone != null)
            IconButton(
              icon: const Icon(Icons.phone),
              onPressed: () => _callCourier(_order!.courierPhone!),
            ),
        ],
      ),
      body: StreamBuilder<LokmaOrder?>(
        key: ValueKey(_refreshKey),
        stream: _orderService.getOrderStream(widget.orderId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData) {
            return const Center(child: Text('Sipariş bulunamadı'));
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
        statusColor = Colors.orange;
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
        // Courier info header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              // Courier avatar
              CircleAvatar(
                radius: 28,
                backgroundColor: Colors.orange.shade100,
                child: const Icon(Icons.person, color: Colors.orange, size: 32),
              ),
              const SizedBox(width: 16),
              
              // Courier info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.courierName ?? 'Kurye',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.green.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.motorcycle, 
                                   size: 14, color: Colors.green.shade700),
                              const SizedBox(width: 4),
                              Text(
                                'Yolda',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.green.shade700,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (order.etaMinutes != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            '~${order.etaMinutes} dk',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                    // Distance & ETA info
                    if (distanceKm != null && etaMinutes != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.route, size: 13, color: Colors.blue.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  '${distanceKm.toStringAsFixed(1)} km',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.blue.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.timer_outlined, size: 13, color: Colors.orange.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  '~$etaMinutes dk',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.orange.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              
              // Call button
              if (order.courierPhone != null && order.courierPhone!.isNotEmpty)
                IconButton(
                  onPressed: () => _callCourier(order.courierPhone!),
                  icon: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.green,
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: const Icon(Icons.phone, color: Colors.white),
                  ),
                ),
            ],
          ),
        ),
        
        // Last update info
        if (order.lastLocationUpdate != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.grey[100],
            child: Text(
              'Son güncelleme: ${_formatTime(order.lastLocationUpdate!)}',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
              ),
            ),
          ),
        
        // Map
        Expanded(
          child: hasLocation
              ? FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: courierPosition,
                    initialZoom: 14,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.lokma.app',
                    ),
                    // Static markers (business + delivery)
                    MarkerLayer(
                      markers: [
                        // 🏪 Business marker (where order was picked up)
                        if (businessPosition != null)
                          Marker(
                            point: businessPosition,
                            width: 44,
                            height: 44,
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.orange,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.3),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.storefront,
                                color: Colors.white,
                                size: 22,
                              ),
                            ),
                          ),
                        // 📍 Delivery address marker (customer location)
                        if (_deliveryPosition != null)
                          Marker(
                            point: _deliveryPosition!,
                            width: 44,
                            height: 44,
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.blue.shade700,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.3),
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
                    // 🏍️ Animated courier marker (hopping)
                    AnimatedBuilder(
                      animation: _hopAnimation,
                      builder: (context, child) {
                        return MarkerLayer(
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
                                    border: Border.all(color: Colors.white, width: 2),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.3),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.motorcycle,
                                    color: Colors.white,
                                    size: 28,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ],
                )
              : Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const CircularProgressIndicator(),
                      const SizedBox(height: 16),
                      Text(
                        'Kurye konumu bekleniyor...',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    ],
                  ),
                ),
        ),

        // Legend bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Colors.grey[50],
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildLegendItem(Colors.red.shade600, Icons.motorcycle, 'Kurye'),
              _buildLegendItem(Colors.orange, Icons.storefront, 'İşletme'),
              _buildLegendItem(Colors.blue.shade700, Icons.home, 'Teslimat'),
            ],
          ),
        ),
        
        // Order summary footer
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 4,
                offset: const Offset(0, -2),
              ),
            ],
          ),
          child: Row(
            children: [
              const Icon(Icons.receipt_long, color: Colors.orange),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '${order.items.length} ürün',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '${order.totalAmount.toStringAsFixed(2)}€',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.green,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLegendItem(Color color, IconData icon, String label) {
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
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
      ],
    );
  }

  String _formatTime(DateTime time) {
    // Ensure both times are in UTC for accurate comparison
    final nowUtc = DateTime.now().toUtc();
    final timeUtc = time.toUtc();
    final diff = nowUtc.difference(timeUtc);
    
    if (diff.isNegative || diff.inSeconds < 30) {
      return 'Az önce';
    } else if (diff.inMinutes < 1) {
      return '${diff.inSeconds} sn önce';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes} dk önce';
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
