import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/providers/auth_provider.dart';
import 'package:lokma_app/models/butcher_product.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/widgets/order_confirmation_dialog.dart';
import 'package:lokma_app/widgets/kermes/order_qr_dialog.dart';
import 'package:lokma_app/services/fcm_service.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  bool _isPickUp = true;
  bool _canDeliver = false;
  bool _checkingDelivery = true;
  String _paymentMethod = 'cash';
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = TimeOfDay.now();
  Map<String, dynamic>? _butcherData;
  bool _loadingButcherParams = true;
  bool _isSubmitting = false;
  OpeningHoursHelper? _hoursHelper;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    
    // Pulse animation for active orders indicator
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    
    // Initial default - will be updated after fetching business hours
    final now = DateTime.now();
    _selectedDate = now;
    _selectedTime = TimeOfDay(hour: now.hour, minute: now.minute);
    
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _fetchButcherDetails();
      _checkDeliverySupport();
      _updateEarliestPickupTime();
    });
  }

  Future<void> _fetchButcherDetails() async {
    final cart = ref.read(cartProvider);
    if (cart.butcherId == null) {
      if (mounted) setState(() => _loadingButcherParams = false);
      return;
    }

    try {
      final doc = await FirebaseFirestore.instance.collection('businesses').doc(cart.butcherId).get();
      if (doc.exists && mounted) {
        final data = doc.data();
        setState(() {
          _butcherData = data;
          _loadingButcherParams = false;
          // Create hours helper if hours exist
          if (data != null && data['openingHours'] != null) {
            _hoursHelper = OpeningHoursHelper(data['openingHours']);
          }
        });
      }
    } catch (e) {
      debugPrint('Error fetching butcher details: $e');
      if (mounted) setState(() => _loadingButcherParams = false);
    }
  }

  Future<void> _checkDeliverySupport() async {
    final cart = ref.read(cartProvider);
    
    try {
      final butcherId = cart.butcherId ?? (cart.items.isNotEmpty ? cart.items.first.product.butcherId : null);
      if (butcherId == null) {
         if (mounted) setState(() => _checkingDelivery = false);
         return;
      }

      final doc = await FirebaseFirestore.instance.collection('businesses').doc(butcherId).get();
      if (doc.exists && mounted) {
        final data = doc.data();
        setState(() {
          _canDeliver = data?['supportsDelivery'] ?? false;
          _checkingDelivery = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching delivery support: $e');
      if (mounted) setState(() => _checkingDelivery = false);
    }
  }

  void _updateEarliestPickupTime() {
    if (_hoursHelper == null) return;
    
    try {
      final now = DateTime.now();
      final nextOpen = _hoursHelper!.getNextOpenDateTime(now);
      
      if (nextOpen != null) {
        // Add 30 minutes prep time
        final earliest = nextOpen.add(const Duration(minutes: 30));
        
        if (mounted) {
          setState(() {
            _selectedDate = earliest;
            _selectedTime = TimeOfDay(hour: earliest.hour, minute: earliest.minute);
          });
        }
      }
    } catch (e) {
      debugPrint('Error calculating earliest pickup time: $e');
    }
  }

  Future<void> _submitOrder() async {
    if (_isSubmitting) return;
    
    final cart = ref.read(cartProvider);
    final authState = ref.read(authProvider);
    final currentUser = authState.appUser;
    
    if (currentUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen önce giriş yapın')),
      );
      return;
    }

    if (cart.items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sepetiniz boş')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      showDialog(
        context: context, 
        barrierDismissible: false, 
        builder: (c) => const Center(child: CircularProgressIndicator())
      );

      // Get FCM token
      String? fcmToken;
      try {
        fcmToken = await FCMService().refreshToken();
      } catch (e) {
        debugPrint('FCM token error: $e');
      }

      // Build order data
      final pickupDateTime = DateTime(
        _selectedDate.year,
        _selectedDate.month,
        _selectedDate.day,
        _selectedTime.hour,
        _selectedTime.minute,
      );

      final orderData = {
        'userId': currentUser.uid,
        'userDisplayName': currentUser.displayName ?? currentUser.email ?? 'User',
        'userEmail': currentUser.email ?? '',
        'userPhone': currentUser.phoneNumber ?? '',
        'fcmToken': fcmToken,
        'butcherId': cart.butcherId,
        'butcherName': cart.butcherName,
        'items': cart.items.map((item) => {
          'productId': item.product.id,
          'productName': item.product.name,
          'quantity': item.quantity,
          'unit': item.product.unitType,
          'unitPrice': item.product.price,
          'totalPrice': item.totalPrice,
          'imageUrl': item.product.imageUrl,
        }).toList(),
        'totalAmount': cart.totalAmount,
        'deliveryMethod': _isPickUp ? 'pickup' : 'delivery',
        'pickupTime': _isPickUp ? Timestamp.fromDate(pickupDateTime) : null,
        'deliveryAddress': !_isPickUp ? currentUser.address : null,
        'paymentMethod': _paymentMethod,
        'paymentStatus': _paymentMethod == 'cash' ? 'pending' : 'pending',
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      // Save order
      final orderRef = await FirebaseFirestore.instance.collection('meat_orders').add(orderData);
      
      Navigator.pop(context); // Close loading

      // Clear cart
      ref.read(cartProvider.notifier).clearCart();

      // Show success dialog
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => OrderConfirmationDialog(
            pickupDate: pickupDateTime,
            businessHours: _hoursHelper?.getHoursStringForDate(pickupDateTime),
            businessName: _butcherData?['companyName'],
          ),
        );
      }

    } catch (e) {
      Navigator.pop(context); // Close loading
      debugPrint('Order error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sipariş hatası: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final kermesCart = ref.watch(kermesCartProvider);
    
    // Sepetteki ürün sayısı
    final cartItemCount = cart.items.length + (kermesCart.isNotEmpty ? kermesCart.items.length : 0);
    
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        title: Text(
          'Sepetim',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: Theme.of(context).colorScheme.onSurface),
          onPressed: () => context.go('/'),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFF43F5E),
          indicatorWeight: 3,
          labelColor: Theme.of(context).primaryColor,
          unselectedLabelColor: Colors.grey,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shopping_cart_outlined, size: 18),
                  const SizedBox(width: 6),
                  const Text('Sepet'),
                  if (cartItemCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF43F5E),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$cartItemCount',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Tab(
              child: StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance
                    .collection('kermes_orders')
                    .where('status', whereIn: ['pending', 'preparing', 'ready'])
                    .limit(10)
                    .snapshots(),
                builder: (context, snapshot) {
                  final hasActiveOrders = snapshot.hasData && snapshot.data!.docs.isNotEmpty;
                  return Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.pending_outlined, size: 18),
                      const SizedBox(width: 6),
                      const Text('Aktif'),
                      if (hasActiveOrders) ...[
                        const SizedBox(width: 6),
                        AnimatedBuilder(
                          animation: _pulseAnimation,
                          builder: (context, child) {
                            return Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.orange.withOpacity(_pulseAnimation.value),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.orange.withOpacity(_pulseAnimation.value * 0.5),
                                    blurRadius: 4,
                                    spreadRadius: 1,
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
            const Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.history, size: 18),
                  SizedBox(width: 6),
                  Text('Geçmiş'),
                ],
              ),
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Sepet
          _buildCartTab(cart, kermesCart),
          // Tab 2: Aktif Siparişler
          _buildActiveOrdersTab(),
          // Tab 3: Sipariş Geçmişi
          _buildOrderHistoryTab(),
        ],
      ),
    );
  }
  
  /// Sepet Tab'ı
  Widget _buildCartTab(CartState cart, KermesCartState kermesCart) {
    final bothEmpty = cart.items.isEmpty && kermesCart.isEmpty;
    
    if (bothEmpty) {
      return _buildEmptyCart();
    }
    
    return _buildCombinedCartContent(cart, kermesCart);
  }
  
  /// Aktif Siparişler Tab'ı
  Widget _buildActiveOrdersTab() {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('kermes_orders')
          .where('status', whereIn: ['pending', 'preparing', 'ready'])
          .limit(50)
          .snapshots(),
      builder: (context, snapshot) {
        // Debug için snapshot durumunu kontrol et
        if (snapshot.hasError) {
          return Center(
            child: Text(
              'Hata: ${snapshot.error}',
              style: const TextStyle(color: Colors.red),
            ),
          );
        }
        
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Color(0xFFF43F5E)));
        }
        
        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return _buildEmptyOrders('Aktif siparişiniz yok', Icons.pending_outlined);
        }
        
        // Client-side sıralama
        final orders = snapshot.data!.docs
            .map((doc) => KermesOrder.fromDocument(doc))
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        
        return ListView.builder(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
          itemCount: orders.length,
          itemBuilder: (context, index) => _buildOrderCard(orders[index], isActive: true),
        );
      },
    );
  }
  
  /// Sipariş Geçmişi Tab'ı
  Widget _buildOrderHistoryTab() {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('kermes_orders')
          .where('status', whereIn: ['delivered', 'cancelled'])
          .limit(50)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Text(
              'Hata: ${snapshot.error}',
              style: const TextStyle(color: Colors.red),
            ),
          );
        }
        
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Color(0xFFF43F5E)));
        }
        
        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return _buildEmptyOrders('Henüz tamamlanmış siparişiniz yok', Icons.history);
        }
        
        // Client-side sıralama
        final orders = snapshot.data!.docs
            .map((doc) => KermesOrder.fromDocument(doc))
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        
        return ListView.builder(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
          itemCount: orders.length,
          itemBuilder: (context, index) => _buildOrderCard(orders[index], isActive: false),
        );
      },
    );
  }
  
  /// Boş siparişler view
  Widget _buildEmptyOrders(String message, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Colors.grey.shade600),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(color: Colors.grey.shade400, fontSize: 16),
          ),
        ],
      ),
    );
  }
  
  /// Sipariş kartı
  Widget _buildOrderCard(KermesOrder order, {required bool isActive}) {
    Color statusColor;
    IconData statusIcon;
    
    switch (order.status) {
      case KermesOrderStatus.pending:
        statusColor = Colors.orange;
        statusIcon = Icons.schedule;
        break;
      case KermesOrderStatus.preparing:
        statusColor = Colors.blue;
        statusIcon = Icons.restaurant;
        break;
      case KermesOrderStatus.ready:
        statusColor = Colors.green;
        statusIcon = Icons.check_circle;
        break;
      case KermesOrderStatus.delivered:
        statusColor = Colors.grey;
        statusIcon = Icons.done_all;
        break;
      case KermesOrderStatus.cancelled:
        statusColor = Colors.red;
        statusIcon = Icons.cancel;
        break;
    }
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isActive ? Border.all(color: statusColor.withOpacity(0.5), width: 1) : Border.all(color: Colors.grey.withOpacity(0.1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Kermes adı + Durum
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  order.kermesName,
                  style: const TextStyle(
                    color: Colors.black87,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, size: 14, color: statusColor),
                    const SizedBox(width: 4),
                    Text(
                      order.statusLabel,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          
          // Sipariş No + Tarih
          Row(
            children: [
              Text(
                'Sipariş: ${order.id}',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
              ),
              const Spacer(),
              Text(
                DateFormat('dd.MM.yyyy HH:mm').format(order.createdAt),
                style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),
          
          // Ürünler
          ...order.items.take(3).map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Text(
                  '${item.quantity}x',
                  style: const TextStyle(color: Color(0xFFF43F5E), fontWeight: FontWeight.bold),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.name,
                    style: const TextStyle(color: Colors.black87, fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  '${item.totalPrice.toStringAsFixed(2)} €',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
          )),
          if (order.items.length > 3)
            Text(
              '+${order.items.length - 3} ürün daha',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
            ),
          
          const SizedBox(height: 12),
          const Divider(color: Colors.grey, height: 1),
          const SizedBox(height: 12),
          
          // Footer: Teslimat + Ödeme + Toplam
          Row(
            children: [
              // Teslimat türü
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.blue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  order.deliveryTypeLabel,
                  style: const TextStyle(color: Colors.blue, fontSize: 11),
                ),
              ),
              const SizedBox(width: 8),
              // Ödeme türü
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  order.paymentMethodLabel,
                  style: const TextStyle(color: Colors.green, fontSize: 11),
                ),
              ),
              const Spacer(),
              // Toplam
              Text(
                '${order.totalAmount.toStringAsFixed(2)} €',
                style: const TextStyle(
                  color: Colors.black87,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          
          // QR Kod Butonu
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                showOrderQRDialog(
                  context,
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  kermesId: order.kermesId,
                  kermesName: order.kermesName,
                  totalAmount: order.totalAmount,
                  isPaid: order.isPaid,
                );
              },
              icon: const Icon(Icons.qr_code, size: 20),
              label: const Text('Hesabı Göster'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF43F5E),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  /// Kombine sepet içeriği - Kasap + Kermes
  Widget _buildCombinedCartContent(CartState cart, KermesCartState kermesCart) {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Kermes Sepeti (varsa)
          if (kermesCart.isNotEmpty) ...[
            _buildKermesCartSection(kermesCart),
            if (cart.items.isNotEmpty) const SizedBox(height: 24),
          ],
          
          // Kasap Sepeti (varsa)
          if (cart.items.isNotEmpty)
            _buildCartContent(cart),
        ],
      ),
    );
  }
  
  /// Kermes sepet bölümü
  Widget _buildKermesCartSection(KermesCartState kermesCart) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF43F5E).withOpacity(0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF43F5E).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.restaurant_menu, color: Color(0xFFF43F5E), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      kermesCart.eventName ?? 'Kermes Siparişi',
                      style: const TextStyle(
                        color: Colors.black87,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      '${kermesCart.totalItems} ürün',
                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ],
                ),
              ),
              // Kermes sepetini temizle
              IconButton(
                onPressed: () => ref.read(kermesCartProvider.notifier).clearCart(),
                icon: const Icon(Icons.close, color: Colors.grey, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Ürünler
          ...kermesCart.items.map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                // Miktar
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF43F5E),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Center(
                    child: Text(
                      '${item.quantity}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Ürün adı
                Expanded(
                  child: Text(
                    item.menuItem.name,
                    style: const TextStyle(color: Colors.black87, fontSize: 14),
                  ),
                ),
                // Fiyat
                Text(
                  '€${item.totalPrice.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: Color(0xFF4CAF50),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          )),
          
          const Divider(color: Colors.black12),
          
          // Toplam
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Kermes Toplamı',
                style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold),
              ),
              Text(
                '€${kermesCart.totalAmount.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Color(0xFF4CAF50),
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Kermese Git butonu
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () {
                // Sepetteki kermesin menüsüne git
                final eventId = kermesCart.eventId;
                if (eventId != null) {
                  context.go('/kermes/$eventId');
                } else {
                  context.go('/kermesler');
                }
              },
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFF43F5E)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text(
                'Kermes Menüsüne Dön',
                style: TextStyle(color: Color(0xFFF43F5E), fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyCart() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shopping_cart_outlined, size: 80, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'Sepetiniz boş',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 20),
          ),
          const SizedBox(height: 8),
          const Text('Kermes menüsünden sipariş verin', style: TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _buildCartContent(CartState cart) {
    try {
      if (cart.items.isEmpty) {
        return _buildEmptyCart();
      }
      
      return SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Delivery Toggle
            _buildDeliveryToggle(),
            const SizedBox(height: 12),
            
            // Minimum Order Info (for delivery)
            if (!_isPickUp && _canDeliver && _butcherData?['minOrderAmount'] != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.orange[400], size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Minimum Sipariş: ${(_butcherData!['minOrderAmount'] as num).toStringAsFixed(0)}€',
                        style: TextStyle(
                          color: Colors.orange[400],
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Time/Date Selection
            _buildTimeSelector(),
            const SizedBox(height: 12),
            
            // Payment Method
            _buildPaymentToggle(),
            const SizedBox(height: 16),
            
            // Cart Items
            Text('Ürünler', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...cart.items.map((item) {
              try {
                return _buildCartItem(item);
              } catch (e) {
                debugPrint('Error building cart item: $e');
                return Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1E1E),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Ürün yüklenemedi',
                    style: TextStyle(color: Colors.red),
                  ),
                );
              }
            }),
            
            const SizedBox(height: 16),
            
            // Total
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2)),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Toplam', style: TextStyle(color: Colors.black87, fontSize: 16)),
                  Text(
                    '€${cart.totalAmount.toStringAsFixed(2)}',
                    style: const TextStyle(color: Color(0xFF4CAF50), fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Submit Button - Pill shaped
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitOrder,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF43F5E),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                      )
                    : const Text(
                        'Siparişi Onayla',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
            
            const SizedBox(height: 16),
          ],
        ),
      );
    } catch (e) {
      debugPrint('Error in _buildCartContent: $e');
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            const Text(
              'Sepet yüklenirken hata oluştu',
              style: TextStyle(color: Colors.white, fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              e.toString(),
              style: const TextStyle(color: Colors.grey, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53935)),
              child: const Text('Ana Sayfaya Dön'),
            ),
          ],
        ),
      );
    }
  }

  Widget _buildDeliveryToggle() {
    // 🆕 Compact pill bar (44px, single-row layout)
    final deliveryFee = _butcherData?['deliveryFee'] as num?;
    
    return Container(
      height: 44,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          // Gel Al
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _isPickUp = true),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeInOut,
                decoration: BoxDecoration(
                  color: _isPickUp ? const Color(0xFFF43F5E) : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.store_outlined,
                      color: _isPickUp ? Colors.white : Colors.grey[600],
                      size: 18,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Gel Al',
                      style: TextStyle(
                        color: _isPickUp ? Colors.white : Colors.grey[600],
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Kurye
          Expanded(
            child: GestureDetector(
              onTap: _canDeliver ? () => setState(() => _isPickUp = false) : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeInOut,
                decoration: BoxDecoration(
                  color: !_isPickUp ? const Color(0xFFF43F5E) : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.local_shipping_outlined,
                      color: !_isPickUp 
                        ? Colors.white 
                        : (_canDeliver ? Colors.grey[600] : Colors.grey[400]),
                      size: 18,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _canDeliver ? 'Kurye' : 'Yok',
                      style: TextStyle(
                        color: !_isPickUp 
                          ? Colors.white 
                          : (_canDeliver ? Colors.grey[600] : Colors.grey[400]),
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    // Compact delivery fee inline
                    if (deliveryFee != null && _canDeliver) ...[
                      const SizedBox(width: 4),
                      Text(
                        '+${deliveryFee.toStringAsFixed(0)}€',
                        style: TextStyle(
                          color: !_isPickUp ? Colors.white70 : Colors.grey[500],
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeSelector() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _isPickUp ? 'Gel Al Zamanı' : 'Teslimat Zamanı',
            style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _selectedDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 7)),
                    );
                    if (date != null) setState(() => _selectedDate = date);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white24),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.calendar_today, color: Colors.grey, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          DateFormat('dd MMM').format(_selectedDate),
                          style: const TextStyle(color: Colors.black87),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () async {
                    final time = await showTimePicker(
                      context: context,
                      initialTime: _selectedTime,
                    );
                    if (time != null) setState(() => _selectedTime = time);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white24),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.access_time, color: Colors.grey, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          _selectedTime.format(context),
                          style: const TextStyle(color: Colors.black87),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentToggle() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _paymentMethod = 'cash'),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _paymentMethod == 'cash' ? const Color(0xFFE53935) : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.money, color: _paymentMethod == 'cash' ? Colors.white : Colors.grey, size: 18),
                    const SizedBox(width: 6),
                    Text(
                      'Nakit',
                      style: TextStyle(
                        color: _paymentMethod == 'cash' ? Colors.white : Colors.grey,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () {
                setState(() => _paymentMethod = 'card');
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Kart ödemesi yakında aktif olacak!')),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _paymentMethod == 'card' ? const Color(0xFFE53935) : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.credit_card, color: _paymentMethod == 'card' ? Colors.white : Colors.grey, size: 18),
                    const SizedBox(width: 6),
                    Text(
                      'Kart',
                      style: TextStyle(
                        color: _paymentMethod == 'card' ? Colors.white : Colors.grey,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCartItem(CartItem item) {
    // Defensive null checks
    final productName = item.product.name.isNotEmpty ? item.product.name : 'Ürün';
    final unitType = item.product.unitType.isNotEmpty ? item.product.unitType : 'adet';
    final quantity = item.quantity;
    final totalPrice = item.totalPrice;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          // Product Image (Left)
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: item.product.imageUrl != null && item.product.imageUrl!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: item.product.imageUrl!,
                    width: 64,
                    height: 64,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      width: 64, height: 64,
                      color: Colors.grey.shade800,
                      child: const Icon(Icons.restaurant, color: Colors.grey, size: 28),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      width: 64, height: 64,
                      color: Colors.grey.shade800,
                      child: const Icon(Icons.restaurant, color: Colors.grey, size: 28),
                    ),
                  )
                : Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade800,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.restaurant, color: Colors.grey, size: 28),
                  ),
          ),
          const SizedBox(width: 14),
          
          // Product Info + Quantity Controls
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product Name
                Text(
                  productName,
                  style: const TextStyle(
                    color: Colors.black87, // Changed from Colors.black87
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 10),
                
                // Quantity Controls Row (Larger Buttons)
                Row(
                  children: [
                    // Minus Button
                    GestureDetector(
                      onTap: () {
                        if (quantity > 1) {
                          ref.read(cartProvider.notifier).updateQuantity(item.product.sku, quantity - 1);
                        } else {
                          ref.read(cartProvider.notifier).removeFromCart(item.product.sku);
                        }
                      },
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade800,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.remove, color: Colors.white, size: 20),
                      ),
                    ),
                    
                    // Quantity Display
                    Container(
                      width: 60,
                      alignment: Alignment.center,
                      child: Text(
                        unitType == 'kg' ? '${quantity.toInt()}g' : '${quantity.toInt()}',
                        style: const TextStyle(
                          color: Colors.black87, 
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    
                    // Plus Button
                    GestureDetector(
                      onTap: () {
                        ref.read(cartProvider.notifier).updateQuantity(item.product.sku, quantity + 1);
                      },
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE53935),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.add, color: Colors.white, size: 20),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Price + Delete Column (Right)
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Price
              Text(
                '${totalPrice.toStringAsFixed(2)} €',
                style: const TextStyle(
                  color: Colors.black87, 
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 12),
              
              // Delete Button
              GestureDetector(
                onTap: () {
                  ref.read(cartProvider.notifier).removeFromCart(item.product.sku);
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  child: Icon(
                    Icons.delete_outline,
                    color: Colors.red.shade400,
                    size: 24,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
