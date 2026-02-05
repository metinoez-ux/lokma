import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/order_service.dart';
import '../../services/location_tracking_service.dart';

/// Staff Delivery Screen - Shows pending deliveries for staff to claim
class StaffDeliveryScreen extends StatefulWidget {
  final String businessId;
  
  const StaffDeliveryScreen({super.key, required this.businessId});

  @override
  State<StaffDeliveryScreen> createState() => _StaffDeliveryScreenState();
}

class _StaffDeliveryScreenState extends State<StaffDeliveryScreen> {
  final OrderService _orderService = OrderService();
  String? _staffName;
  String? _staffPhone;
  bool _isLoading = false;
  bool _checkedActiveDelivery = false;

  @override
  void initState() {
    super.initState();
    _loadStaffInfo();
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

  Future<void> _loadStaffInfo() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final doc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      if (doc.exists) {
        final data = doc.data()!;
        setState(() {
          _staffName = data['name'] ?? data['displayName'] ?? 'Personel';
          _staffPhone = data['phone'] ?? data['phoneNumber'] ?? '';
        });
      }
    }
  }

  Future<void> _claimDelivery(LokmaOrder order) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || _staffName == null) return;

    // Confirm dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Teslimatı Üstlen'),
        content: Text(
          'Bu siparişi üstlenmek istediğinize emin misiniz?\n\n'
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
      courierName: _staffName!,
      courierPhone: _staffPhone ?? '',
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bekleyen Teslimatlar'),
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : StreamBuilder<List<LokmaOrder>>(
              stream: _orderService.getReadyDeliveriesStream(widget.businessId),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle_outline, 
                             size: 80, color: Colors.grey[400]),
                        const SizedBox(height: 16),
                        Text(
                          'Bekleyen teslimat yok',
                          style: TextStyle(
                            fontSize: 18,
                            color: Colors.grey[600],
                          ),
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
    // Status-based colors
    final isReady = order.status == 'ready';
    final isPreparing = order.status == 'preparing';
    final statusColor = isReady 
        ? Colors.green 
        : isPreparing 
            ? Colors.orange 
            : Colors.grey;
    final statusText = isReady 
        ? '✅ HAZIR' 
        : isPreparing 
            ? '🍳 Hazırlanıyor' 
            : '⏳ Bekliyor';
    
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: isReady ? 8 : 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: isReady ? BorderSide(color: Colors.green, width: 2) : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with status badge
            Row(
              children: [
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
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: statusColor,
                    ),
                  ),
                ),
                const Spacer(),
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
            const Divider(height: 24),
            
            // Customer info
            Row(
              children: [
                const Icon(Icons.person, color: Colors.grey, size: 20),
                const SizedBox(width: 8),
                Text(
                  order.userName,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            // Address
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on, color: Colors.red, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    order.deliveryAddress ?? 'Adres belirtilmemiş',
                    style: TextStyle(color: Colors.grey[700]),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Items summary
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${order.items.length} ürün',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    order.items.map((i) => i.name).take(3).join(', ') +
                        (order.items.length > 3 ? '...' : ''),
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
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
                      ? '🚗 BEN ÜSTLENDİM' 
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
                    borderRadius: BorderRadius.circular(30),
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

/// Active Delivery Screen - For courier who claimed the order
class ActiveDeliveryScreen extends StatefulWidget {
  final String orderId;
  
  const ActiveDeliveryScreen({super.key, required this.orderId});

  @override
  State<ActiveDeliveryScreen> createState() => _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends State<ActiveDeliveryScreen> {
  final OrderService _orderService = OrderService();
  final LocationTrackingService _locationService = LocationTrackingService();

  @override
  void initState() {
    super.initState();
    // Location tracking starts when order is ready (in build method)
  }

  @override
  void dispose() {
    _locationService.stopTracking();
    super.dispose();
  }

  Future<void> _completeDelivery() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Teslimat Tamamla'),
        content: const Text('Siparişi teslim ettiniz mi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hayır'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Evet, Teslim Ettim', 
                              style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      _locationService.stopTracking();
      await _orderService.completeDelivery(widget.orderId);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Teslimat tamamlandı!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  Future<void> _startDelivery() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('🚗 Yola Çık'),
        content: const Text('Siparişi aldınız ve yola çıkıyor musunuz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hayır'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
            child: const Text('Evet, Yola Çıkıyorum', 
                              style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      _locationService.startTracking(widget.orderId);
      await _orderService.startDelivery(widget.orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('🚗 Yoldasınız! İyi teslimatlar.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  Future<void> _cancelDelivery() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('⚠️ Teslimatı İptal Et'),
        content: const Text('Bu teslimatı iptal etmek istediğinizden emin misiniz? Sipariş tekrar havuza düşecek.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hayır'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Evet, İptal Et', 
                              style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      _locationService.stopTracking();
      await _orderService.cancelClaim(widget.orderId);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('❌ Teslimat iptal edildi'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _callCustomer(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Telefon açılamadı')),
        );
      }
    }
  }

  Future<void> _openNavigation(String? address) async {
    if (address == null || address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Adres bulunamadı')),
      );
      return;
    }
    
    final encodedAddress = Uri.encodeComponent(address);
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$encodedAddress');
    
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Harita açılamadı')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Aktif Teslimat'),
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.cancel_outlined),
            tooltip: 'Teslimatı İptal Et',
            onPressed: _cancelDelivery,
          ),
        ],
      ),
      body: StreamBuilder<LokmaOrder?>(
        stream: _orderService.getOrderStream(widget.orderId),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final order = snapshot.data!;
          final isReady = order.status == 'ready';
          final isOnTheWay = order.status == 'onTheWay';
          final isPreparing = order.status == 'preparing';
          final isWaiting = !isReady && !isOnTheWay;
          
          // Payment info
          final paymentMethod = order.paymentMethod ?? 'cash';
          final isPaid = paymentMethod == 'card' || paymentMethod == 'online';
          
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Status banner for waiting orders
                if (isWaiting)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isPreparing 
                        ? Colors.orange.withOpacity(isDark ? 0.3 : 0.1) 
                        : Colors.grey.withOpacity(isDark ? 0.3 : 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isPreparing ? Colors.orange : Colors.grey,
                        width: 2,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          isPreparing ? Icons.restaurant : Icons.hourglass_empty,
                          color: isPreparing ? Colors.orange : Colors.grey,
                          size: 32,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isPreparing ? '👨‍🍳 Sipariş Hazırlanıyor' : '⏳ Sipariş Bekleniyor',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: theme.colorScheme.onSurface,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Sipariş hazır olunca "YOL AL" butonu aktif olacak',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                
                // Order ID Card
                Card(
                  color: isDark ? theme.cardColor : null,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        const Icon(Icons.receipt_long, color: Colors.orange, size: 28),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Sipariş #${order.id.substring(0, 6).toUpperCase()}',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: theme.colorScheme.onSurface,
                                ),
                              ),
                              Text(
                                order.butcherName,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 12),
                
                // Customer Info Card
                Card(
                  color: isDark ? theme.cardColor : null,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '👤 Müşteri',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: theme.colorScheme.onSurface.withOpacity(0.7),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    order.userName,
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    order.userPhone,
                                    style: TextStyle(
                                      fontSize: 16,
                                      color: theme.colorScheme.onSurface.withOpacity(0.8),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Call Button
                            ElevatedButton.icon(
                              onPressed: () => _callCustomer(order.userPhone),
                              icon: const Icon(Icons.phone, color: Colors.white),
                              label: const Text('ARA', style: TextStyle(color: Colors.white)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(20),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 12),
                
                // Address Card with Navigation
                Card(
                  color: isDark ? theme.cardColor : null,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '📍 Teslimat Adresi',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: theme.colorScheme.onSurface.withOpacity(0.7),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                order.deliveryAddress ?? 'Adres belirtilmemiş',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: theme.colorScheme.onSurface,
                                ),
                              ),
                            ),
                            // Navigation Button
                            ElevatedButton.icon(
                              onPressed: () => _openNavigation(order.deliveryAddress),
                              icon: const Icon(Icons.navigation, color: Colors.white),
                              label: const Text('NAVİGASYON', style: TextStyle(color: Colors.white, fontSize: 12)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.blue,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(20),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 12),
                
                // Payment & Total Card
                Card(
                  color: isDark ? theme.cardColor : null,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        // Payment Method
                        Row(
                          children: [
                            Icon(
                              isPaid ? Icons.credit_card : Icons.payments,
                              color: isPaid ? Colors.green : Colors.orange,
                              size: 28,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isPaid ? '✅ ÖDENDİ' : '💵 KAPIDA ÖDEME',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: isPaid ? Colors.green : Colors.orange,
                                    ),
                                  ),
                                  Text(
                                    isPaid 
                                      ? 'Online ödeme yapıldı' 
                                      : 'Müşteriden tahsil edilecek',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: theme.colorScheme.onSurface.withOpacity(0.7),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 24),
                        // Total Amount
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'TOPLAM',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: theme.colorScheme.onSurface.withOpacity(0.7),
                              ),
                            ),
                            Text(
                              '${order.totalAmount.toStringAsFixed(2)}€',
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                                color: isPaid ? Colors.green : Colors.orange,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                
                // ETA Card (only when on the way)
                if (isOnTheWay && order.etaMinutes != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Card(
                      color: Colors.blue.withOpacity(isDark ? 0.3 : 0.1),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Icon(Icons.schedule, color: Colors.blue, size: 28),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '⏱️ Tahmini Varış',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: theme.colorScheme.onSurface.withOpacity(0.7),
                                    ),
                                  ),
                                  Text(
                                    '${order.etaMinutes} dakika',
                                    style: const TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.blue,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                
                // Delivery Notes Card (if exists)
                if (order.notes != null && order.notes!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Card(
                      color: Colors.amber.withOpacity(isDark ? 0.2 : 0.1),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.note_alt, color: Colors.amber, size: 22),
                                const SizedBox(width: 8),
                                Text(
                                  '📝 Müşteri Notu',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: theme.colorScheme.onSurface.withOpacity(0.7),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              order.notes!,
                              style: TextStyle(
                                fontSize: 15,
                                color: theme.colorScheme.onSurface,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                
                // Order Items Card
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Card(
                    color: isDark ? theme.cardColor : null,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.shopping_bag, color: Colors.orange, size: 22),
                              const SizedBox(width: 8),
                              Text(
                                '🛒 Sipariş İçeriği (${order.items.length} ürün)',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          ...order.items.map((item) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              children: [
                                Container(
                                  width: 28,
                                  height: 28,
                                  decoration: BoxDecoration(
                                    color: Colors.orange.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Center(
                                    child: Text(
                                      '${item.quantity}x',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.orange,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    item.name,
                                    style: TextStyle(
                                      fontSize: 15,
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                ),
                                Text(
                                  '${(item.price * item.quantity).toStringAsFixed(2)}€',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: theme.colorScheme.onSurface.withOpacity(0.8),
                                  ),
                                ),
                              ],
                            ),
                          )),
                        ],
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(height: 24),
                
                // Action Button (3-state)
                SizedBox(
                  height: 56,
                  child: isOnTheWay 
                    ? ElevatedButton.icon(
                        onPressed: _completeDelivery,
                        icon: const Icon(Icons.check_circle, color: Colors.white, size: 28),
                        label: const Text(
                          '✅ TESLİMAT TAMAMLANDI',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(30),
                          ),
                        ),
                      )
                    : isReady
                      ? ElevatedButton.icon(
                          onPressed: _startDelivery,
                          icon: const Icon(Icons.motorcycle, color: Colors.white, size: 28),
                          label: const Text(
                            '🚗 YOL AL',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.orange,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30),
                            ),
                          ),
                        )
                      : Container(
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey[800] : Colors.grey[300],
                            borderRadius: BorderRadius.circular(30),
                          ),
                          child: Center(
                            child: Text(
                              isPreparing ? '🍳 Hazırlanıyor - Bekle...' : '⏳ Sipariş Bekleniyor...',
                              style: TextStyle(
                                color: isDark ? Colors.grey[400] : Colors.grey[600],
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        ),
                ),
                
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }
}
