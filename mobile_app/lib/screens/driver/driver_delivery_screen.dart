import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../providers/driver_provider.dart';
import '../../services/order_service.dart';
import '../staff/staff_delivery_screen.dart';

/// Driver Delivery Screen - Shows pending deliveries from ALL assigned businesses
/// This screen is for couriers (drivers) who are assigned to multiple businesses
class DriverDeliveryScreen extends ConsumerStatefulWidget {
  const DriverDeliveryScreen({super.key});

  @override
  ConsumerState<DriverDeliveryScreen> createState() => _DriverDeliveryScreenState();
}

class _DriverDeliveryScreenState extends ConsumerState<DriverDeliveryScreen> {
  final OrderService _orderService = OrderService();
  String? _driverName;
  String? _driverPhone;
  bool _isLoading = false;
  bool _checkedActiveDelivery = false;

  @override
  void initState() {
    super.initState();
    _loadDriverInfo();
    _checkForActiveDelivery();
  }

  /// Check if user has an active delivery and redirect if so
  Future<void> _checkForActiveDelivery() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    // Listen once for active delivery
    final activeDelivery = await _orderService
        .getMyActiveDeliveryStream(user.uid)
        .first;
    
    if (activeDelivery != null && mounted) {
      // User has an active delivery - redirect to it
      _checkedActiveDelivery = true;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ActiveDeliveryScreen(orderId: activeDelivery.id),
        ),
      );
    } else {
      if (mounted) {
        setState(() => _checkedActiveDelivery = true);
      }
    }
  }

  Future<void> _loadDriverInfo() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final doc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      if (doc.exists) {
        final data = doc.data()!;
        setState(() {
          _driverName = data['name'] ?? data['displayName'] ?? 'Sürücü';
          _driverPhone = data['phone'] ?? data['phoneNumber'] ?? '';
        });
      }
    }
  }

  Future<void> _claimDelivery(LokmaOrder order) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || _driverName == null) return;

    // Confirm dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Teslimatı Üstlen'),
        content: Text(
          'Bu siparişi üstlenmek istediğinize emin misiniz?\n\n'
          '🏪 ${order.butcherName}\n'
          '📍 ${order.deliveryAddress ?? "Adres yok"}\n'
          '💰 ${order.totalAmount.toStringAsFixed(2)}€',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('İptal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
            child: const Text('Üstlen', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);

    final success = await _orderService.claimDelivery(
      orderId: order.id,
      courierId: user.uid,
      courierName: _driverName!,
      courierPhone: _driverPhone ?? '',
    );

    setState(() => _isLoading = false);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Teslimat üstlenildi! Konum takibi başladı.'),
          backgroundColor: Colors.green,
        ),
      );
      // Navigate to active delivery screen
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ActiveDeliveryScreen(orderId: order.id),
        ),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('❌ Teslimat zaten başka biri tarafından üstlenilmiş.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final driverState = ref.watch(driverProvider);
    final businessIds = driverState.driverInfo?.assignedBusinesses ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('🚗 Teslimatlarım'),
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
        actions: [
          // Show assigned business count
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${businessIds.length} İşletme',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),
        ],
      ),
      body: driverState.isLoading
          ? const Center(child: CircularProgressIndicator())
          : !driverState.isDriver
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.warning_amber_rounded, size: 80, color: Colors.orange),
                      SizedBox(height: 16),
                      Text(
                        'Sürücü yetkisi bulunamadı',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Lütfen yöneticinize başvurun',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                )
              : businessIds.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.store_mall_directory_outlined, size: 80, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'Henüz işletme atanmamış',
                            style: TextStyle(fontSize: 18, color: Colors.grey),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'Admin panelinden işletme ataması yapılmalı',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : _isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : StreamBuilder<List<LokmaOrder>>(
                          stream: _orderService.getDriverDeliveriesStream(businessIds),
                          builder: (context, snapshot) {
                            if (snapshot.connectionState == ConnectionState.waiting) {
                              return const Center(child: CircularProgressIndicator());
                            }

                            if (!snapshot.hasData || snapshot.data!.isEmpty) {
                              return Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.check_circle_outline, size: 80, color: Colors.grey[400]),
                                    const SizedBox(height: 16),
                                    Text(
                                      'Bekleyen teslimat yok',
                                      style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      '${businessIds.length} işletme izleniyor',
                                      style: TextStyle(color: Colors.grey[500]),
                                    ),
                                  ],
                                ),
                              );
                            }

                            final orders = snapshot.data!;
                            return ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: orders.length,
                              itemBuilder: (context, index) {
                                final order = orders[index];
                                return _buildDeliveryCard(order);
                              },
                            );
                          },
                        ),
    );
  }

  Widget _buildDeliveryCard(LokmaOrder order) {
    final isReady = order.status == 'ready';
    final isPreparing = order.status == 'preparing';
    final statusColor = isReady ? Colors.green : isPreparing ? Colors.orange : Colors.grey;
    final statusText = isReady ? '✅ HAZIR' : isPreparing ? '🍳 Hazırlanıyor' : '⏳ Bekliyor';

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: isReady ? 8 : 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: isReady ? const BorderSide(color: Colors.green, width: 2) : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with business name and status badge
            Row(
              children: [
                // Business badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '🏪 ${order.butcherName}',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue),
                  ),
                ),
                const Spacer(),
                // Status badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(fontWeight: FontWeight.bold, color: statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Order ID
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '#${order.id.substring(0, 6).toUpperCase()}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.orange,
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Customer & Address
            Row(
              children: [
                const Icon(Icons.person, size: 20, color: Colors.grey),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    order.userName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (order.deliveryAddress != null) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on, size: 20, color: Colors.red),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      order.deliveryAddress!,
                      style: TextStyle(color: Colors.grey[700]),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],

            // Price
            Row(
              children: [
                const Icon(Icons.euro, size: 20, color: Colors.green),
                const SizedBox(width: 8),
                Text(
                  '${order.totalAmount.toStringAsFixed(2)}€',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                    color: Colors.green,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Claim button - NOW ALWAYS ACTIVE (Industry standard: immediate claim)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _claimDelivery(order),
                icon: Icon(
                  isReady ? Icons.motorcycle : Icons.add_task,
                  color: Colors.white,
                ),
                label: Text(
                  isReady 
                      ? '🚗 BEN ÜSTLENİYORUM' 
                      : isPreparing 
                          ? '👨‍🍳 Hazırlanıyor - ÜSTLENİYORUM'
                          : '⏳ Bekleyen - ÜSTLENİYORUM',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isReady ? Colors.green : Colors.orange,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
