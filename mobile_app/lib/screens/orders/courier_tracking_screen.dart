import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/order_service.dart';

/// Courier Tracking Screen - Customer views courier location on map
class CourierTrackingScreen extends StatefulWidget {
  final String orderId;
  
  const CourierTrackingScreen({super.key, required this.orderId});

  @override
  State<CourierTrackingScreen> createState() => _CourierTrackingScreenState();
}

class _CourierTrackingScreenState extends State<CourierTrackingScreen> {
  final OrderService _orderService = OrderService();
  final MapController _mapController = MapController();
  LokmaOrder? _order;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kurye Takibi'),
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

    return Column(
      children: [
        // Courier info header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
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
                    initialZoom: 15,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.lokma.app',
                    ),
                    MarkerLayer(
                      markers: [
                        // Courier marker
                        Marker(
                          point: courierPosition,
                          width: 50,
                          height: 50,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.orange,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.3),
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
                      ],
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
        
        // Order summary footer
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
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
                      '#${order.id.substring(0, 6).toUpperCase()}',
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

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);
    
    if (diff.inMinutes < 1) {
      return 'Az önce';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes} dk önce';
    } else {
      return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _callCourier(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}
