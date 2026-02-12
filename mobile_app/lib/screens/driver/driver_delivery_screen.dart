import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/driver_provider.dart';
import '../../services/order_service.dart';
import '../staff/staff_delivery_screen.dart';

/// Driver Delivery Screen - Shows pending deliveries from ALL assigned businesses
/// This screen is for couriers (drivers) who are assigned to multiple businesses
class DriverDeliveryScreen extends ConsumerStatefulWidget {
  final bool embedded;
  const DriverDeliveryScreen({super.key, this.embedded = false});

  @override
  ConsumerState<DriverDeliveryScreen> createState() => _DriverDeliveryScreenState();
}

class _DriverDeliveryScreenState extends ConsumerState<DriverDeliveryScreen> {
  final OrderService _orderService = OrderService();
  String? _driverName;
  String? _driverPhone;
  bool _isLoading = false;
  bool _showAllOrders = false;

  @override
  void initState() {
    super.initState();
    _loadDriverInfo();
    _checkForActiveDelivery();
  }

  /// Check if user has an active delivery - no longer redirects
  /// Active deliveries are now shown inline in the main list
  Future<void> _checkForActiveDelivery() async {
    // Active deliveries are shown inline now - no action needed
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

  /// Show bottom sheet with list of assigned businesses and their order counts
  void _showBusinessListSheet(List<String> businessIds) {

    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _BusinessListSheet(
        businessIds: businessIds,
        orderService: _orderService,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final driverState = ref.watch(driverProvider);
    final businessIds = driverState.driverInfo?.assignedBusinesses ?? [];

    const brandBottom = Color(0xFFFE0032);
    const brandTop = Color(0xFFFA4C71);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Container(
          margin: const EdgeInsets.only(left: 4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: () => setState(() => _showAllOrders = false),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: !_showAllOrders ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Teslimatlarım',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: !_showAllOrders ? brandBottom : Colors.white,
                    ),
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => setState(() => _showAllOrders = true),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _showAllOrders ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Tüm Siparişler',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: _showAllOrders ? brandBottom : Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [brandTop, brandBottom],
            ),
          ),
        ),
        actions: [
          // Show assigned business count - tappable
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: GestureDetector(
              onTap: () => _showBusinessListSheet(businessIds),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${businessIds.length}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 2),
                    const Icon(Icons.store, size: 16),
                  ],
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
                      : _showAllOrders
                          ? _buildAllOrdersView(businessIds)
                          : _buildMyDeliveriesView(businessIds),
    );
  }

  /// Build the "Teslimatlarım" view — only claimable (ready) + claimed-by-me orders
  Widget _buildMyDeliveriesView(List<String> businessIds) {
    return StreamBuilder<List<LokmaOrder>>(
      stream: _orderService.getDriverDeliveriesStream(
        businessIds,
        courierId: FirebaseAuth.instance.currentUser?.uid,
      ),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final allOrders = snapshot.data ?? [];

        // Only show ready/accepted/onTheWay — NO pending/preparing in Teslimatlarım
        final claimableOrders = allOrders.where((order) {
          return order.status == OrderStatus.ready ||
              order.status == OrderStatus.accepted ||
              order.status == OrderStatus.onTheWay;
        }).toList();

        if (claimableOrders.isEmpty) {
          return Column(
            children: [
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_outline, size: 80, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'Üstlenebilecek teslimat yok',
                        style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${businessIds.length} işletme izleniyor',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    ],
                  ),
                ),
              ),
              _buildCompletedDeliveriesSection(),
            ],
          );
        }

        return Column(
          children: [
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: claimableOrders.length,
                itemBuilder: (context, index) {
                  return _buildDeliveryCard(claimableOrders[index]);
                },
              ),
            ),
            _buildCompletedDeliveriesSection(),
          ],
        );
      },
    );
  }

  /// Build the "Tüm Siparişler" view — all orders from assigned businesses
  Widget _buildAllOrdersView(List<String> businessIds) {
    return StreamBuilder<List<LokmaOrder>>(
      stream: _orderService.getAllBusinessOrdersStream(businessIds),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.inbox_outlined, size: 80, color: Colors.grey[400]),
                const SizedBox(height: 16),
                Text(
                  'Aktif sipariş yok',
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
        // Group by status
        final statusGroups = <String, List<LokmaOrder>>{};
        for (final order in orders) {
          final key = order.status.name;
          statusGroups.putIfAbsent(key, () => []).add(order);
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Summary bar
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.orange.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.list_alt, color: Colors.orange, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    '${orders.length} aktif sipariş',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.orange),
                  ),
                  const Spacer(),
                  ..._buildStatusSummaryChips(statusGroups),
                ],
              ),
            ),
            // Order cards
            ...orders.map((order) => _buildAllOrderCard(order)),
          ],
        );
      },
    );
  }

  List<Widget> _buildStatusSummaryChips(Map<String, List<LokmaOrder>> groups) {
    final chips = <Widget>[];
    final statusConfig = {
      'pending': ('⏳', Colors.grey),
      'preparing': ('🔥', Colors.orange),
      'ready': ('✅', Colors.green),
      'accepted': ('🚗', Colors.blue),
      'onTheWay': ('🚗', Colors.blue),
    };

    for (final entry in statusConfig.entries) {
      final count = groups[entry.key]?.length ?? 0;
      if (count > 0) {
        chips.add(Container(
          margin: const EdgeInsets.only(left: 6),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: entry.value.$2.withOpacity(0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            '${entry.value.$1} $count',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: entry.value.$2),
          ),
        ));
      }
    }
    return chips;
  }

  /// Read-only order card for the all-orders view
  Widget _buildAllOrderCard(LokmaOrder order) {
    final statusConfig = _getStatusConfig(order.status.name);
    final businessName = order.butcherName;
    final courierId = order.courierId ?? '';
    final isClaimed = courierId.isNotEmpty;
    final isMyOrder = courierId == FirebaseAuth.instance.currentUser?.uid;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isMyOrder 
              ? Colors.blue.withOpacity(0.4)
              : Colors.grey.withOpacity(0.15),
          width: isMyOrder ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: status + order ID
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusConfig.$2.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${statusConfig.$1} ${statusConfig.$3}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: statusConfig.$2,
                  ),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.orange.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.orange,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Business name
          Row(
            children: [
              const Icon(Icons.store, size: 16, color: Colors.grey),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  businessName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Items + total
          Row(
            children: [
              Icon(Icons.shopping_bag_outlined, size: 15, color: Colors.grey[500]),
              const SizedBox(width: 4),
              Text(
                '${order.items.length} ürün',
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
              ),
              const SizedBox(width: 16),
              Text(
                '${order.totalAmount.toStringAsFixed(2)}€',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.green),
              ),
              const Spacer(),
              // Claimed indicator
              if (isClaimed)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isMyOrder ? Colors.blue.withOpacity(0.1) : Colors.purple.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isMyOrder ? '👤 Benim' : '👤 Alındı',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: isMyOrder ? Colors.blue : Colors.purple,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  (String, Color, String) _getStatusConfig(String status) {
    switch (status) {
      case 'pending':
        return ('⏳', Colors.amber, 'Bekliyor');
      case 'preparing':
        return ('🔥', Colors.orange, 'Hazırlanıyor');
      case 'ready':
        return ('✅', Colors.purple, 'Hazır');
      case 'accepted':
        return ('🚗', Colors.blue, 'Kabul Edildi');
      case 'onTheWay':
        return ('🚗', Colors.blue, 'Teslimatta');
      default:
        return ('❓', Colors.grey, status);
    }
  }

  /// Build the completed deliveries section with cash summary
  Widget _buildCompletedDeliveriesSection() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return const SizedBox.shrink();

    return StreamBuilder<List<LokmaOrder>>(
      stream: _orderService.getMyCompletedDeliveriesToday(user.uid),
      builder: (context, snapshot) {
        // Always show the section, even if empty for today
        final completedOrders = snapshot.data ?? [];
        
        // Calculate cash total
        final cashOrders = completedOrders.where((o) => 
          o.paymentMethod == 'cash' || o.paymentMethod == 'nakit'
        ).toList();
        final cashTotal = cashOrders.fold<double>(
          0, (sum, o) => sum + o.totalAmount
        );

        // Calculate card total
        final cardOrders = completedOrders.where((o) => 
          o.paymentMethod == 'card' || o.paymentMethod == 'kart' || o.paymentMethod == 'online'
        ).toList();
        final cardTotal = cardOrders.fold<double>(
          0, (sum, o) => sum + o.totalAmount
        );

        // Calculate total km from deliveryProof
        final totalKm = completedOrders.fold<double>(
          0, (sum, o) {
            final proof = o.deliveryProof;
            if (proof != null && proof['distanceKm'] != null) {
              return sum + (proof['distanceKm'] as num).toDouble();
            }
            return sum;
          }
        );

        final isDark = Theme.of(context).brightness == Brightness.dark;
        final bgColor = isDark ? Colors.grey[900] : Colors.grey[100];
        final borderColor = isDark ? Colors.grey[700] : Colors.grey[300];
        
        return Container(
          constraints: const BoxConstraints(minHeight: 60),
          decoration: BoxDecoration(
            color: bgColor,
            border: Border(top: BorderSide(color: borderColor!)),
          ),
          child: snapshot.connectionState == ConnectionState.waiting
            ? const ListTile(
                leading: Icon(Icons.history, color: Colors.orange),
                title: Text('Yükleniyor...'),
              )
            : ExpansionTile(
            backgroundColor: bgColor,
            collapsedBackgroundColor: bgColor,
            initiallyExpanded: true,
            leading: const Icon(Icons.history, color: Colors.orange),
            title: Text(
              'Bugün: ${completedOrders.length} teslimat',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            subtitle: Row(
              children: [
                // KM Badge
                if (totalKm > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    margin: const EdgeInsets.only(right: 6, top: 4),
                    decoration: BoxDecoration(
                      color: Colors.blue[600],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '🛣️ ${totalKm.toStringAsFixed(1)} km',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
                // Cash Badge
                if (cashTotal > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    margin: const EdgeInsets.only(right: 6, top: 4),
                    decoration: BoxDecoration(
                      color: Colors.green[700],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '💵 ${cashTotal.toStringAsFixed(2)}€',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
                // Card Badge
                if (cardTotal > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: Colors.purple[600],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '💳 ${cardTotal.toStringAsFixed(2)}€',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            children: completedOrders.isEmpty
                ? [
                    const Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        'Bugün henüz teslimat yok',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  ]
                : completedOrders.map((order) => _buildCompletedDeliveryItem(order)).toList(),
          ),
        );
      },
    );
  }

  /// Build a single completed delivery item
  Widget _buildCompletedDeliveryItem(LokmaOrder order) {
    final proof = order.deliveryProof;
    final distanceKm = proof?['distanceKm'] as num?;
    final isCash = order.paymentMethod == 'cash' || order.paymentMethod == 'nakit';
    
    // Extract PLZ and city from delivery address
    String locationInfo = '';
    if (order.deliveryAddress != null && order.deliveryAddress!.isNotEmpty) {
      // Try to extract PLZ and city from address string (e.g., "Straße 123, 44135 Dortmund")
      final addressParts = order.deliveryAddress!.split(',');
      if (addressParts.length >= 2) {
        // Take the last part which usually contains PLZ + City
        locationInfo = addressParts.last.trim();
      } else {
        // Just use the full address
        locationInfo = order.deliveryAddress!;
      }
    }
    
    // Order number (first 6 chars)
    final orderNumber = order.orderNumber ?? order.id.substring(0, 6).toUpperCase();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade200),
      ),
      child: Row(
        children: [
          // Payment method icon
          Icon(
            isCash ? Icons.payments : Icons.credit_card,
            color: isCash ? Colors.green : Colors.purple,
            size: 22,
          ),
          const SizedBox(width: 10),
          // Order info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Order number + business name
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '#$orderNumber',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.orange.shade800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        order.butcherName ?? '',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                // Location + time + km
                Row(
                  children: [
                    Icon(Icons.location_on, size: 12, color: Colors.grey[500]),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        locationInfo.isNotEmpty ? locationInfo : 'Adres yok',
                        style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                // Time + km
                Text(
                  '${order.deliveredAt?.hour.toString().padLeft(2, '0')}:${order.deliveredAt?.minute.toString().padLeft(2, '0')}${distanceKm != null ? ' • ${distanceKm.toStringAsFixed(1)} km' : ''}',
                  style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                ),
              ],
            ),
          ),
          // Price
          Text(
            '${order.totalAmount.toStringAsFixed(2)}€',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 14,
              color: isCash ? Colors.green[700] : Colors.purple[700],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryCard(LokmaOrder order) {
    final currentUserId = FirebaseAuth.instance.currentUser?.uid;
    final isClaimedByMe = order.courierId != null && 
                          order.courierId == currentUserId;
    
    // Status determination
    final isOnTheWay = order.status == OrderStatus.onTheWay || 
                       order.status == OrderStatus.accepted;
    final isReady = order.status == OrderStatus.ready;
    final isPreparing = order.status == OrderStatus.preparing;
    
    // Colors and text based on claim status
    // Colors match admin panel: pending=amber, preparing=orange, ready=purple
    Color statusColor;
    String statusText;
    IconData statusIcon;
    
    if (isClaimedByMe) {
      statusColor = Colors.blue;
      statusText = isOnTheWay ? '🚗 Yolda' : 'Üstlenildi';
      statusIcon = Icons.local_shipping;
    } else if (isReady) {
      statusColor = Colors.purple;
      statusText = 'Hazır';
      statusIcon = Icons.check_circle;
    } else if (isPreparing) {
      statusColor = Colors.orange;
      statusText = 'Hazırlanıyor';
      statusIcon = Icons.restaurant;
    } else {
      statusColor = Colors.amber;
      statusText = 'Bekliyor';
      statusIcon = Icons.hourglass_top;
    }
    
    // Extract PLZ + City for cleaner display
    String shortAddress = order.deliveryAddress ?? 'Adres yok';
    if (order.deliveryAddress != null && order.deliveryAddress!.contains(',')) {
      final parts = order.deliveryAddress!.split(',');
      if (parts.length >= 2) {
        shortAddress = parts.sublist(1).join(',').trim();
      }
    }

    return GestureDetector(
      onTap: isClaimedByMe ? () {
        // Navigate to active delivery screen for claimed orders
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ActiveDeliveryScreen(orderId: order.id),
          ),
        );
      } : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(16),
          border: isClaimedByMe 
              ? Border.all(color: Colors.blue, width: 2) 
              : isReady 
                  ? Border.all(color: Colors.purple, width: 2) 
                  : null,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            // Top header row
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  Icon(statusIcon, size: 18, color: statusColor),
                  const SizedBox(width: 6),
                  Text(
                    statusText,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: statusColor,
                      fontSize: 13,
                    ),
                  ),
                  const Spacer(),
                  // Order number
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isClaimedByMe ? Colors.blue : Colors.orange,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Business name
                  Text(
                    order.butcherName ?? 'İşletme',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  // Address row
                  Row(
                    children: [
                      const Icon(Icons.location_on, size: 16, color: Colors.red),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          shortAddress,
                          style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  // Price row
                  Row(
                    children: [
                      Text(
                        '${order.totalAmount.toStringAsFixed(2)}€',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                          color: Colors.green,
                        ),
                      ),
                      const Spacer(),
                      // Payment method
                      Icon(
                        order.paymentMethod == 'cash' || order.paymentMethod == 'nakit'
                            ? Icons.payments
                            : Icons.credit_card,
                        size: 18,
                        color: order.paymentMethod == 'cash' || order.paymentMethod == 'nakit'
                            ? Colors.green
                            : Colors.purple,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Order notes
                  if (order.notes != null && order.notes!.isNotEmpty) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.amber.withOpacity(0.1),
                        border: Border.all(color: Colors.amber.withOpacity(0.3)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('📝', style: TextStyle(fontSize: 14)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              order.notes!,
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.amber[800],
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  // Action button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: isClaimedByMe 
                          ? () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ActiveDeliveryScreen(orderId: order.id),
                              ),
                            )
                          : isReady 
                              ? () => _claimDelivery(order) 
                              : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isClaimedByMe 
                            ? Colors.blue 
                            : isReady 
                                ? Colors.purple 
                                : Colors.grey[200],
                        foregroundColor: isClaimedByMe || isReady 
                            ? Colors.white 
                            : Colors.grey[500],
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        elevation: isClaimedByMe || isReady ? 2 : 0,
                      ),
                      child: Text(
                        isClaimedByMe 
                            ? '🚗 Devam Et' 
                            : isReady 
                                ? '🚗 Üstlen' 
                                : isPreparing 
                                    ? '👨‍🍳 Hazırlanıyor' 
                                    : '⏳ Bekliyor',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet widget showing assigned businesses with order counts
class _BusinessListSheet extends StatefulWidget {
  final List<String> businessIds;
  final OrderService orderService;

  const _BusinessListSheet({
    required this.businessIds,
    required this.orderService,
  });

  @override
  State<_BusinessListSheet> createState() => _BusinessListSheetState();
}

class _BusinessListSheetState extends State<_BusinessListSheet> {
  /// Open map app picker for a business address
  Future<void> _openBusinessNavigation(String? address) async {
    if (address == null || address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('İşletme adresi bulunamadı')),
      );
      return;
    }
    final encodedAddress = Uri.encodeComponent(address);
    // Show bottom sheet to let user pick maps app
    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'Harita Uygulaması Seçin',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.map, color: Colors.green, size: 28),
                title: const Text('Apple Haritalar'),
                onTap: () async {
                  Navigator.pop(ctx);
                  final appleUri = Uri.parse('maps://?q=$encodedAddress');
                  if (await canLaunchUrl(appleUri)) {
                    await launchUrl(appleUri, mode: LaunchMode.externalApplication);
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.location_on, color: Colors.red, size: 28),
                title: const Text('Google Maps'),
                onTap: () async {
                  Navigator.pop(ctx);
                  final googleAppUri = Uri.parse('comgooglemaps://?q=$encodedAddress');
                  final googleWebUri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$encodedAddress');
                  if (await canLaunchUrl(googleAppUri)) {
                    await launchUrl(googleAppUri, mode: LaunchMode.externalApplication);
                  } else if (await canLaunchUrl(googleWebUri)) {
                    await launchUrl(googleWebUri, mode: LaunchMode.externalApplication);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          const Text(
            'Atanmış İşletmeler',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          // Business list with order counts
          Flexible(
            child: StreamBuilder<List<LokmaOrder>>(
              stream: widget.orderService.getDriverDeliveriesStream(widget.businessIds),
              builder: (context, ordersSnapshot) {
                final allOrders = ordersSnapshot.data ?? [];
                
                return FutureBuilder<List<Map<String, dynamic>>>(
                  future: _fetchBusinessDetails(widget.businessIds, allOrders),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) {
                      return const Center(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: CircularProgressIndicator(),
                        ),
                      );
                    }
                    
                    final businesses = snapshot.data!;
                    
                    return ListView.builder(
                      shrinkWrap: true,
                      itemCount: businesses.length,
                      itemBuilder: (context, index) {
                        final biz = businesses[index];
                        return _buildBusinessRow(context, biz);
                      },
                    );
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Future<List<Map<String, dynamic>>> _fetchBusinessDetails(
    List<String> ids,
    List<LokmaOrder> allOrders,
  ) async {
    final List<Map<String, dynamic>> result = [];
    
    for (final id in ids) {
      // Fetch business name and address
      String name = id;
      String? address;
      try {
        final doc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(id)
            .get();
        if (doc.exists) {
          final data = doc.data();
          name = data?['companyName'] ?? data?['businessName'] ?? data?['name'] ?? id;
          // Build address from fields
          final street = data?['street'] ?? data?['address'] ?? '';
          final plz = data?['postalCode'] ?? data?['plz'] ?? '';
          final city = data?['city'] ?? '';
          if (street.toString().isNotEmpty) {
            address = '$street, $plz $city'.trim();
          }
        }
      } catch (_) {}
      
      // Count orders for this business
      final businessOrders = allOrders.where((o) => o.butcherId == id).toList();
      final pending = businessOrders.where((o) => o.status == OrderStatus.pending).length;
      final preparing = businessOrders.where((o) => o.status == OrderStatus.preparing).length;
      final ready = businessOrders.where((o) => o.status == OrderStatus.ready).length;
      
      result.add({
        'id': id,
        'name': name,
        'address': address,
        'pending': pending,
        'preparing': preparing,
        'ready': ready,
        'total': pending + preparing + ready,
      });
    }
    
    return result;
  }

  Widget _buildBusinessRow(BuildContext context, Map<String, dynamic> biz) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final address = biz['address'] as String?;
    return GestureDetector(
      onTap: () => _openBusinessNavigation(address),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[850] : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade200),
        ),
        child: Row(
          children: [
            // Business icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.orange.shade100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.store,
                color: Colors.orange.shade700,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            // Business name + address
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    biz['name'] as String,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (address != null && address.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      address,
                      style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 4),
                  // Order count badges
                  Row(
                    children: [
                      if ((biz['pending'] as int) > 0)
                        _buildCountBadge(biz['pending'] as int, Colors.amber, '⏳'),
                      if ((biz['preparing'] as int) > 0)
                        _buildCountBadge(biz['preparing'] as int, Colors.orange, '🍳'),
                      if ((biz['ready'] as int) > 0)
                        _buildCountBadge(biz['ready'] as int, Colors.green, '✅'),
                      if ((biz['total'] as int) == 0)
                        Text(
                          'Sipariş yok',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[500],
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            // Navigate button
            if (address != null && address.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.blue,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.navigation, color: Colors.white, size: 14),
                    SizedBox(width: 4),
                    Text('GİT', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                  ],
                ),
              )
            else if ((biz['total'] as int) > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.orange,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${biz['total']}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCountBadge(int count, Color color, String emoji) {
    return Container(
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 10)),
          const SizedBox(width: 2),
          Text(
            '$count',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: HSLColor.fromColor(color).withLightness(0.3).toColor(),
            ),
          ),
        ],
      ),
    );
  }
}
