import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geocoding/geocoding.dart';
import '../../services/kermes_order_service.dart';
import '../../models/kermes_order_model.dart';
import '../../utils/currency_utils.dart';
import '../orders/order_chat_screen.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../services/chat_service.dart';

/// Courier Tracking Screen - Customer views courier location on map
class KermesCourierTrackingScreen extends StatefulWidget {
  final String orderId;
  
  const KermesCourierTrackingScreen({super.key, required this.orderId});

  @override
  State<KermesCourierTrackingScreen> createState() => _KermesCourierTrackingScreenState();
}

class _KermesCourierTrackingScreenState extends State<KermesCourierTrackingScreen>
    with SingleTickerProviderStateMixin {
  final KermesOrderService _orderService = KermesOrderService();
  final MapController _mapController = MapController();
  KermesOrder? _order;
  
  // Geocoded delivery address
  LatLng? _deliveryPosition;
  bool _geocodingAttempted = false;
  
  // Business location from Firestore
  LatLng? _businessPosition;
  String? _businessName;
  String? _businessLogoUrl;
  bool _businessFetched = false;
  
  // Auto-refresh
  Timer? _refreshTimer;
  int _refreshKey = 0;
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

  /// Fetch business location from Firestore using kermesId
  Future<void> _fetchBusinessLocation(String kermesId) async {
    if (_businessFetched) return;
    _businessFetched = true;
    
    try {
      final doc = await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(kermesId)
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
            _businessName = data['name'] as String? ?? data['businessName'] as String? ?? data['title'] as String?;
            _businessLogoUrl = data['logoUrl'] as String? ?? data['imageUrl'] as String?;
          });
          _centerMapOnAvailablePositions();
          debugPrint('[CourierTracking] Business: $_businessName, logo: $_businessLogoUrl');
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
    
    if (hasB && hasD) {
      final bounds = LatLngBounds.fromPoints([_businessPosition!, _deliveryPosition!]);
      try {
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: bounds,
            padding: const EdgeInsets.all(60),
          ),
        );
      } catch (_) {
        _mapController.move(_businessPosition!, 14);
      }
    } else if (hasB) {
      _mapController.move(_businessPosition!, 14);
    } else if (hasD) {
      _mapController.move(_deliveryPosition!, 14);
    }
  }

  static const Color _brandColor = Color(0xFFEA184A);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('orders.courier_tracking')),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: tr('orders.refresh'),
            onPressed: () {
              setState(() {
                _refreshKey++;
              });
              // Simple haptic for refresh
              // HapticFeedback.lightImpact(); (If we import services)
            },
          ),
          IconButton(
            icon: StreamBuilder<int>(
              stream: ChatService().getUnreadCountStream(widget.orderId, FirebaseAuth.instance.currentUser?.uid ?? '', isKermes: true),
              builder: (context, badgeSnap) {
                final unreadCount = badgeSnap.data ?? 0;
                return Stack(
                  children: [
                    const Icon(Icons.chat_bubble_outline),
                    if (unreadCount > 0)
                      Positioned(
                        right: 0,
                        top: 0,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 12,
                            minHeight: 12,
                          ),
                          child: Text(
                            '$unreadCount',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
            tooltip: tr('orders.send_message'),
            onPressed: () {
              if (_order != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => OrderChatScreen(
                      orderId: widget.orderId,
                      orderNumber: _order!.orderNumber ?? widget.orderId.substring(0, 6).toUpperCase(),
                      recipientName: _order!.courierName != null ? '${tr('orders.courier')}: ${_order!.courierName}' : tr('orders.messaging'),
                      recipientRole: 'courier',
                    ),
                  ),
                );
              }
            },
          ),
          if (_order?.courierPhone != null)
            IconButton(
              icon: const Icon(Icons.phone),
              onPressed: () => _callCourier(_order!.courierPhone!),
            ),
        ],
      ),
      body: StreamBuilder<KermesOrder?>(
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
          if (order.address != null && !_geocodingAttempted) {
            _geocodeDeliveryAddress(order.address!);
          }

          // Fetch business location from Firestore
          if (!_businessFetched) {
            _fetchBusinessLocation(order.kermesId);
          }

          // Check if courier is on the way
          if (order.status != KermesOrderStatus.onTheWay) {
            return _buildNotOnTheWayView(order);
          }

          return _buildTrackingView(order);
        },
      ),
    );
  }

  Widget _buildNotOnTheWayView(KermesOrder order) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF121212) : Colors.grey[50]!;
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    
    // Status step data
    final steps = [
      _StatusStep('Siparis Alindi', Icons.receipt_long_rounded, KermesOrderStatus.pending),
      _StatusStep('Hazirlaniyor', Icons.restaurant_rounded, KermesOrderStatus.preparing),
      _StatusStep('Hazir', Icons.check_circle_rounded, KermesOrderStatus.ready),
      _StatusStep('Yolda', Icons.delivery_dining_rounded, KermesOrderStatus.onTheWay),
      _StatusStep('Teslim Edildi', Icons.home_rounded, KermesOrderStatus.delivered),
    ];
    
    int currentStepIndex = steps.indexWhere((s) => s.status == order.status);
    if (currentStepIndex < 0) currentStepIndex = 0;
    
    // Status-specific message
    String statusTitle;
    String statusSubtitle;
    Color accentColor;
    IconData headerIcon;
    
    switch (order.status) {
      case KermesOrderStatus.pending:
        statusTitle = 'Siparisimiz Alindi';
        statusSubtitle = 'Siparisimiz mutfaga iletildi, kisa surede hazirlanmaya baslanacak.';
        accentColor = _brandColor;
        headerIcon = Icons.receipt_long_rounded;
        break;
      case KermesOrderStatus.preparing:
        statusTitle = 'Hazirlaniyor';
        statusSubtitle = 'Siparisimiz su an mutfakta ozenle hazirlaniyor.';
        accentColor = Colors.orange;
        headerIcon = Icons.restaurant_rounded;
        break;
      case KermesOrderStatus.ready:
        statusTitle = 'Hazir, Kurye Bekleniyor';
        statusSubtitle = 'Siparisimiz hazir! Kurye gelip alacak ve size ulastiracak.';
        accentColor = Colors.amber;
        headerIcon = Icons.access_time_rounded;
        break;
      case KermesOrderStatus.delivered:
        statusTitle = 'Teslim Edildi';
        statusSubtitle = 'Siparisimiz basariyla teslim edildi. Afiyet olsun!';
        accentColor = Colors.green;
        headerIcon = Icons.check_circle_rounded;
        break;
      case KermesOrderStatus.cancelled:
        statusTitle = 'Iptal Edildi';
        statusSubtitle = 'Siparisimiz iptal edildi.';
        accentColor = Colors.red;
        headerIcon = Icons.cancel_rounded;
        break;
      default:
        statusTitle = 'Siparis Durumu';
        statusSubtitle = 'Siparisimiz isleniyor...';
        accentColor = Colors.grey;
        headerIcon = Icons.info_rounded;
    }
    
    return Container(
      color: bgColor,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Status header card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: accentColor.withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(headerIcon, color: accentColor, size: 36),
                  ),
                  const SizedBox(height: 16),
                  Text(statusTitle, style: TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.black87,
                  )),
                  const SizedBox(height: 8),
                  Text(statusSubtitle, textAlign: TextAlign.center, style: TextStyle(
                    fontSize: 14, color: isDark ? Colors.grey[400] : Colors.grey[600],
                    height: 1.4,
                  )),
                  const SizedBox(height: 16),
                  // Order number badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: accentColor.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('#', style: TextStyle(fontSize: 18, color: accentColor.withValues(alpha: 0.5))),
                        const SizedBox(width: 4),
                        Text(
                          order.orderNumber ?? order.id.substring(0, 6).toUpperCase(),
                          style: TextStyle(
                            fontSize: 28, fontWeight: FontWeight.w900,
                            color: accentColor, letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Progress steps
            if (order.status != KermesOrderStatus.cancelled &&
                order.status != KermesOrderStatus.delivered)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: cardColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Siparis Durumu', style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    )),
                    const SizedBox(height: 16),
                    ...List.generate(steps.length, (i) {
                      final step = steps[i];
                      final isActive = i <= currentStepIndex;
                      final isCurrent = i == currentStepIndex;
                      final isLast = i == steps.length - 1;
                      
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Dot + line
                          Column(
                            children: [
                              Container(
                                width: isCurrent ? 28 : 20,
                                height: isCurrent ? 28 : 20,
                                decoration: BoxDecoration(
                                  color: isActive ? accentColor : (isDark ? Colors.grey[700] : Colors.grey[300]),
                                  shape: BoxShape.circle,
                                  border: isCurrent ? Border.all(color: accentColor.withValues(alpha: 0.3), width: 3) : null,
                                ),
                                child: Icon(
                                  step.icon,
                                  size: isCurrent ? 14 : 10,
                                  color: isActive ? Colors.white : Colors.grey,
                                ),
                              ),
                              if (!isLast)
                                Container(
                                  width: 2,
                                  height: 24,
                                  color: isActive && i < currentStepIndex
                                      ? accentColor
                                      : (isDark ? Colors.grey[700] : Colors.grey[300]),
                                ),
                            ],
                          ),
                          const SizedBox(width: 12),
                          // Label
                          Padding(
                            padding: EdgeInsets.only(top: isCurrent ? 4 : 0),
                            child: Text(
                              step.label,
                              style: TextStyle(
                                fontSize: isCurrent ? 15 : 13,
                                fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w400,
                                color: isActive
                                    ? (isDark ? Colors.white : Colors.black87)
                                    : (isDark ? Colors.grey[600] : Colors.grey[400]),
                              ),
                            ),
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            
            const SizedBox(height: 16),
            
            // Order items summary
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.shopping_bag_rounded, size: 18, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                      const SizedBox(width: 8),
                      Text('Siparis Detayi', style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      )),
                      const Spacer(),
                      Text('${order.items.length} urun', style: TextStyle(
                        fontSize: 12, color: isDark ? Colors.grey[500] : Colors.grey[500],
                      )),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ...order.items.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _brandColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text('${item.quantity}x', style: const TextStyle(
                            color: _brandColor, fontWeight: FontWeight.w700, fontSize: 13,
                          )),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(item.name, style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w500,
                          color: isDark ? Colors.white : Colors.black87,
                        ))),
                        Text('${item.totalPrice.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(
                          fontSize: 13, color: isDark ? Colors.grey[400] : Colors.grey[600],
                        )),
                      ],
                    ),
                  )),
                  Divider(color: isDark ? Colors.grey[700] : Colors.grey[200]),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Toplam', style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : Colors.black87,
                      )),
                      Text('${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}', style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700, color: Colors.green,
                      )),
                    ],
                  ),
                ],
              ),
            ),
            
            // Delivery address
            if (order.address != null && order.address!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: cardColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.blue.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.location_on_rounded, color: Colors.blue, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(order.address!, style: TextStyle(
                      fontSize: 13, color: isDark ? Colors.grey[300] : Colors.grey[700],
                      height: 1.3,
                    ))),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTrackingView(KermesOrder order) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    LatLng courierPosition = const LatLng(41.0082, 28.9784);
    bool hasLocation = false;

    if (order.courierLocation != null) {
      courierPosition = LatLng(
        order.courierLocation!['lat']!,
        order.courierLocation!['lng']!,
      );
      hasLocation = true;
    }

    final businessPosition = _businessPosition;

    double? distanceKm;
    int? etaMinutes;
    if (hasLocation && _deliveryPosition != null) {
      final distanceMeters = Geolocator.distanceBetween(
        courierPosition.latitude, courierPosition.longitude,
        _deliveryPosition!.latitude, _deliveryPosition!.longitude,
      );
      distanceKm = distanceMeters / 1000;
      etaMinutes = ((distanceKm / 30) * 60).ceil();
      if (etaMinutes < 1) etaMinutes = 1;
    }

    return Stack(
      children: [
        // Full-screen map
        SizedBox.expand(
          child: FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: hasLocation
                  ? courierPosition
                  : (businessPosition ?? _deliveryPosition ?? const LatLng(41.0082, 28.9784)),
              initialZoom: 14,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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
                            height: 72,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // GPS Pin with logo inside
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: _brandColor, width: 3),
                                    boxShadow: [
                                      BoxShadow(
                                        color: _brandColor.withOpacity(0.3),
                                        blurRadius: 10,
                                        spreadRadius: 2,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: ClipOval(
                                    child: _businessLogoUrl != null && _businessLogoUrl!.isNotEmpty
                                        ? Image.network(
                                            _businessLogoUrl!,
                                            width: 42,
                                            height: 42,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) => const Icon(
                                              Icons.storefront,
                                              color: _brandColor,
                                              size: 24,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.storefront,
                                            color: _brandColor,
                                            size: 24,
                                          ),
                                  ),
                                ),
                                if (_businessName != null)
                                  Container(
                                    margin: const EdgeInsets.only(top: 2),
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
                                border: Border.all(color: Colors.white, width: 2),
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
                                      border: Border.all(color: Colors.white, width: 2),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.3),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: const Icon(
                                      Icons.delivery_dining,
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
              // Info banner - only show after initial load, softer message
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
        // Re-center FAB
        Positioned(
          top: MediaQuery.of(context).padding.top + 12,
          right: 12,
          child: Column(
            children: [
              _mapFAB(Icons.my_location, () {
                if (hasLocation) {
                  _mapController.move(courierPosition, 15);
                }
              }, isDark),
              const SizedBox(height: 8),
              _mapFAB(Icons.fit_screen, () {
                _centerMapOnAvailablePositions();
              }, isDark),
            ],
          ),
        ),

        // Modern bottom sheet overlay
        DraggableScrollableSheet(
          initialChildSize: 0.32,
          minChildSize: 0.15,
          maxChildSize: 0.65,
          snap: true,
          snapSizes: const [0.15, 0.32, 0.65],
          builder: (context, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.15),
                    blurRadius: 20,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: ListView(
                controller: scrollController,
                padding: EdgeInsets.zero,
                children: [
                  // Drag handle
                  Center(
                    child: Container(
                      margin: const EdgeInsets.only(top: 10, bottom: 12),
                      width: 40, height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.grey[600] : Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),

                  // Courier info row
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        // Avatar
                        Container(
                          width: 52, height: 52,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [_brandColor, _brandColor.withOpacity(0.7)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.delivery_dining, color: Colors.white, size: 28),
                        ),
                        const SizedBox(width: 14),
                        // Name + status
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _formatCourierName(order.courierName),
                                style: TextStyle(
                                  fontSize: 17, fontWeight: FontWeight.w700,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Container(
                                    width: 8, height: 8,
                                    decoration: const BoxDecoration(
                                      color: Colors.green,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    tr('orders.on_the_way'),
                                    style: TextStyle(
                                      fontSize: 13, color: Colors.green.shade600,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (order.lastLocationUpdate != null) ...[
                                    Text(
                                      '  ·  ${_formatTime(order.lastLocationUpdate!)}',
                                      style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[500] : Colors.grey[400]),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                        // Action buttons
                        if (order.courierPhone != null && order.courierPhone!.isNotEmpty)
                          _actionCircle(Icons.phone, Colors.green, () => _callCourier(order.courierPhone!)),
                        const SizedBox(width: 8),
                        _actionCircle(Icons.chat_bubble_outline, Colors.blue, () {
                          if (_order != null) {
                            Navigator.push(context, MaterialPageRoute(
                              builder: (_) => OrderChatScreen(
                                orderId: widget.orderId,
                                orderNumber: _order!.orderNumber ?? widget.orderId.substring(0, 6).toUpperCase(),
                                recipientName: tr('orders.courier'),
                                recipientRole: 'courier',
                              ),
                            ));
                          }
                        }),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // ETA + Distance pills
                  if (distanceKm != null && etaMinutes != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Row(
                        children: [
                          _infoPill(Icons.timer_outlined, '~$etaMinutes dk', Colors.amber),
                          const SizedBox(width: 10),
                          _infoPill(Icons.route, '${distanceKm.toStringAsFixed(1)} km', Colors.blue),
                        ],
                      ),
                    ),

                  Divider(height: 28, color: isDark ? Colors.grey[800] : Colors.grey[200], indent: 20, endIndent: 20),

                  // Legend
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Wrap(
                      spacing: 16, runSpacing: 8,
                      children: [
                        _buildLegendItem(Colors.red.shade600, Icons.moped, tr('orders.courier'), isDark),
                        _buildLegendItem(_brandColor, Icons.storefront, tr('orders.business'), isDark),
                        _buildLegendItem(Colors.blue.shade700, Icons.home, tr('orders.delivery'), isDark),
                      ],
                    ),
                  ),

                  Divider(height: 28, color: isDark ? Colors.grey[800] : Colors.grey[200], indent: 20, endIndent: 20),

                  // Order summary header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        const Icon(Icons.receipt_long, color: _brandColor, size: 18),
                        const SizedBox(width: 8),
                        Text('#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15,
                            color: isDark ? Colors.white : Colors.black87)),
                        const SizedBox(width: 8),
                        Text('${order.items.length} urun',
                          style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[500] : Colors.grey[500])),
                        const Spacer(),
                        Text('${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.green)),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Order items
                  ...order.items.map((item) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: _brandColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text('${item.quantity}x', style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700, color: _brandColor)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(item.name, style: TextStyle(
                          fontSize: 13, color: isDark ? Colors.white : Colors.black87))),
                        Text('${(item.price * item.quantity).toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                            color: isDark ? Colors.grey[400] : Colors.grey[600])),
                      ],
                    ),
                  )),

                  const SizedBox(height: 20),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _mapFAB(IconData icon, VoidCallback onTap, bool isDark) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44, height: 44,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 8, offset: const Offset(0, 2)),
          ],
        ),
        child: Icon(icon, size: 22, color: isDark ? Colors.white : Colors.black87),
      ),
    );
  }

  Widget _actionCircle(IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 42, height: 42,
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: color, size: 20),
      ),
    );
  }

  Widget _infoPill(IconData icon, String text, MaterialColor color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.shade50,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color.shade700),
          const SizedBox(width: 5),
          Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color.shade700)),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, IconData icon, String label, bool isDark) {
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
        Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: isDark ? Colors.grey[300] : Colors.grey[800])),
      ],
    );
  }

  String _formatCourierName(String? fullName) {
    if (fullName == null || fullName.trim().isEmpty) return tr('orders.courier');
    final parts = fullName.trim().split(' ');
    if (parts.isEmpty) return tr('orders.courier');
    String mask(String word) {
      if (word.length <= 1) return word;
      if (word.length == 2) return '${word[0]}*';
      return '${word[0]}${'*' * (word.length - 2)}${word[word.length - 1]}';
    }
    return parts.map((p) => mask(p)).join(' ');
  }

  String _formatTime(DateTime time) {
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

class _StatusStep {
  final String label;
  final IconData icon;
  final KermesOrderStatus status;
  const _StatusStep(this.label, this.icon, this.status);
}
