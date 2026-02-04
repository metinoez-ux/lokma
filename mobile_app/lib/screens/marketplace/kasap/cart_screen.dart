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
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:lokma_app/services/fcm_service.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/services/order_service.dart';
import 'package:lokma_app/screens/orders/rating_screen.dart';
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

  /// 🎨 BRAND COLOUR - Dynamic resolution per Design System Protocol
  Color get _accentColor {
    final brandColorHex = _butcherData?['brandColor']?.toString();
    if (brandColorHex != null && brandColorHex.isNotEmpty) {
      // Strip '#' and prepend 'FF' for alpha
      final hex = brandColorHex.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    }
    // Fallback to LOKMA Rose-500
    return const Color(0xFFF43F5E);
  }

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
    
    // Fallback to FirebaseAuth if provider state not synced
    final firebaseUser = FirebaseAuth.instance.currentUser;
    
    if (currentUser == null && firebaseUser == null) {
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

      // Use firebaseUser as fallback if currentUser is null
      // CRITICAL: Ensure userId is never empty
      String userId = '';
      if (currentUser?.uid != null && currentUser!.uid.isNotEmpty) {
        userId = currentUser.uid;
      } else if (firebaseUser?.uid != null && firebaseUser!.uid.isNotEmpty) {
        userId = firebaseUser.uid;
      }
      
      // Double-check userId is not empty
      if (userId.isEmpty) {
        Navigator.pop(context); // Close loading dialog
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Kullanıcı bilgisi alınamadı. Lütfen tekrar giriş yapın.')),
        );
        return;
      }
      
      final userDisplayName = currentUser?.displayName ?? firebaseUser?.displayName ?? firebaseUser?.email ?? 'User';
      final userEmail = currentUser?.email ?? firebaseUser?.email ?? '';
      final userPhone = currentUser?.phoneNumber ?? firebaseUser?.phoneNumber ?? '';
      final userAddress = currentUser?.address;

      final orderData = {
        'userId': userId,
        'userDisplayName': userDisplayName,
        'userEmail': userEmail,
        'userPhone': userPhone,
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
        'deliveryAddress': !_isPickUp ? userAddress : null,
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
    
    // 🍊 LIEFERANDO-STYLE: White background with tabs
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Sepetim',
          style: TextStyle(
            color: Colors.black87,
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.black87, size: 20),
          onPressed: () {
            // Use GoRouter's pop for proper navigation
            if (context.canPop()) {
              context.pop();
            } else {
              // Fallback to restoran if no history
              context.go('/restoran');
            }
          },
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(49),
          child: Column(
            children: [
              Container(
                color: Colors.grey.shade200,
                height: 1,
              ),
              TabBar(
                controller: _tabController,
                indicatorColor: const Color(0xFFEC131E),
                indicatorWeight: 3,
                labelColor: Colors.black87,
                unselectedLabelColor: Colors.grey,
                labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                tabs: const [
                  Tab(text: 'Sepet'),
                  Tab(text: 'Aktif Siparişler'),
                  Tab(text: 'Tamamlanan'),
                ],
              ),
            ],
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Sepet
          _buildCartTabContent(cart, kermesCart),
          // Tab 2: Aktif Siparişler
          _buildActiveOrdersTab(),
          // Tab 3: Tamamlanan
          _buildOrderHistoryTab(),
        ],
      ),
    );
  }
  
  /// Sepet Tab İçeriği
  Widget _buildCartTabContent(CartState cart, KermesCartState kermesCart) {
    final bothEmpty = cart.items.isEmpty && kermesCart.isEmpty;
    
    if (bothEmpty) {
      return _buildEmptyCart();
    }
    
    return _buildLieferandoCartContent(cart, kermesCart);
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
    final authState = ref.watch(authProvider);
    final userId = authState.user?.uid;
    
    if (userId == null) {
      return _buildLoginPrompt();
    }
    
    return StreamBuilder<List<LokmaOrder>>(
      stream: OrderService().getUserOrdersStream(userId),
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
          return const Center(child: CircularProgressIndicator(color: Color(0xFFEC131E)));
        }
        
        final allOrders = snapshot.data ?? [];
        final activeOrders = allOrders.where((o) => _isActiveOrder(o.status)).toList();
        
        if (activeOrders.isEmpty) {
          return _buildEmptyOrders('Aktif siparişiniz yok', Icons.pending_outlined);
        }
        
        return ListView.builder(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
          itemCount: activeOrders.length,
          itemBuilder: (context, index) => _buildLokmaOrderCard(activeOrders[index], isActive: true),
        );
      },
    );
  }
  
  /// Sipariş Geçmişi Tab'ı - Lieferando Style
  Widget _buildOrderHistoryTab() {
    final authState = ref.watch(authProvider);
    final userId = authState.user?.uid;
    
    if (userId == null) {
      return _buildLoginPrompt();
    }
    
    return StreamBuilder<List<LokmaOrder>>(
      stream: OrderService().getUserOrdersStream(userId),
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
          return const Center(child: CircularProgressIndicator(color: Color(0xFFEC131E)));
        }
        
        final allOrders = snapshot.data ?? [];
        final completedOrders = allOrders.where((o) => !_isActiveOrder(o.status)).toList();
        
        if (completedOrders.isEmpty) {
          return _buildEmptyOrders('Henüz tamamlanmış siparişiniz yok', Icons.history);
        }
        
        return ListView.builder(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
          itemCount: completedOrders.length,
          itemBuilder: (context, index) => _buildLokmaOrderCard(completedOrders[index], isActive: false),
        );
      },
    );
  }
  
  bool _isActiveOrder(OrderStatus status) {
    return status == OrderStatus.pending ||
           status == OrderStatus.accepted ||
           status == OrderStatus.preparing ||
           status == OrderStatus.ready ||
           status == OrderStatus.onTheWay;
  }
  
  /// Giriş yapın prompt
  Widget _buildLoginPrompt() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.login, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          const Text(
            'Siparişlerinizi görmek için giriş yapın',
            style: TextStyle(color: Colors.grey, fontSize: 16),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEC131E),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
            ),
            onPressed: () => context.go('/profile'),
            child: const Text('Giriş Yap', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
  
  /// Boş siparişler view
  Widget _buildEmptyOrders(String message, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            message,
            style: const TextStyle(color: Colors.black87, fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            'Sipariş vermek için bir işletme seçin!',
            style: TextStyle(color: Colors.grey[600], fontSize: 14),
          ),
        ],
      ),
    );
  }
  
  /// Lieferando-style Sipariş Kartı
  Widget _buildLokmaOrderCard(LokmaOrder order, {required bool isActive}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with business info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Business image placeholder
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.store, color: Colors.grey[400], size: 30),
                ),
                const SizedBox(width: 12),
                // Business info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.butcherName,
                        style: const TextStyle(
                          color: Colors.black87,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${_getStatusText(order.status)} • ${_formatDate(order.createdAt)}',
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${order.items.length} ürün • €${order.totalAmount.toStringAsFixed(2)}',
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                    ],
                  ),
                ),
                // Status badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getStatusColor(order.status).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _getStatusText(order.status),
                    style: TextStyle(
                      color: _getStatusColor(order.status),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Action buttons for completed orders (Lieferando style)
          if (!isActive) ...[
            Container(
              width: double.infinity,
              height: 1,
              color: Colors.grey.shade200,
            ),
            // Puan Ver button
            InkWell(
              onTap: () => _rateOrder(order),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: const Center(
                  child: Text(
                    'Puan Ver',
                    style: TextStyle(
                      color: Colors.black87,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
            Container(
              width: double.infinity,
              height: 1,
              color: Colors.grey.shade200,
            ),
            // Tekrar Sipariş Ver button
            InkWell(
              onTap: () => _reorder(order),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: const BoxDecoration(
                  color: Color(0xFFEC131E),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(12),
                    bottomRight: Radius.circular(12),
                  ),
                ),
                child: const Center(
                  child: Text(
                    'Tekrar Sipariş Ver',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
  
  Color _getStatusColor(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return Colors.orange;
      case OrderStatus.accepted:
        return Colors.blue;
      case OrderStatus.preparing:
        return Colors.purple;
      case OrderStatus.ready:
        return Colors.green;
      case OrderStatus.onTheWay:
        return Colors.teal;
      case OrderStatus.delivered:
        return Colors.green;
      case OrderStatus.cancelled:
        return Colors.red;
    }
  }

  String _getStatusText(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return 'Beklemede';
      case OrderStatus.accepted:
        return 'Onaylandı';
      case OrderStatus.preparing:
        return 'Hazırlanıyor';
      case OrderStatus.ready:
        return 'Hazır';
      case OrderStatus.onTheWay:
        return 'Yolda';
      case OrderStatus.delivered:
        return 'Teslim Edildi';
      case OrderStatus.cancelled:
        return 'İptal';
    }
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    
    if (diff.inDays == 0) {
      return 'Bugün ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else if (diff.inDays == 1) {
      return 'Dün';
    } else {
      return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    }
  }
  
  /// Puan Ver - Navigate to rating screen
  void _rateOrder(LokmaOrder order) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RatingScreen(
          orderId: order.id,
          businessId: order.butcherId,
          businessName: order.butcherName,
          userId: order.userId,
        ),
      ),
    );
  }
  
  /// Tekrar Sipariş Ver - Add items to cart and navigate to business
  void _reorder(LokmaOrder order) {
    // Navigate to the business page
    context.go('/kasap/${order.butcherId}');
    
    // Show a snackbar
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${order.butcherName} sayfasına yönlendiriliyorsunuz'),
        backgroundColor: const Color(0xFFEC131E),
        duration: const Duration(seconds: 2),
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🍊 LIEFERANDO-STYLE CART LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  
  Widget _buildLieferandoCartContent(CartState cart, KermesCartState kermesCart) {
    final hasKermes = kermesCart.isNotEmpty;
    final hasKasap = cart.items.isNotEmpty;
    
    // Calculate totals
    final kermesTotal = hasKermes ? kermesCart.totalAmount : 0.0;
    final kasapTotal = hasKasap ? cart.totalAmount : 0.0;
    final grandTotal = kermesTotal + kasapTotal;
    
    return Stack(
      children: [
        // Scrollable content
        SingleChildScrollView(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 8, bottom: 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 🚴 Delivery Info Pill (Lieferando style)
              _buildLieferandoDeliveryPill(),
              const SizedBox(height: 16),
              
              // 🟡 Minimum Order Bar (Yellow - Lieferando style)
              if (hasKasap && _butcherData?['minOrderAmount'] != null)
                _buildLieferandoMinimumBar(cart.totalAmount),
              
              // 📦 Kermes Items (if any)
              if (hasKermes) ...[
                _buildLieferandoSectionHeader(kermesCart.eventName ?? 'Kermes'),
                ...kermesCart.items.map((item) => _buildLieferandoKermesItem(item)),
                const SizedBox(height: 16),
              ],
              
              // 🥩 Kasap Items (if any)  
              if (hasKasap) ...[
                if (hasKermes) const Divider(height: 32),
                if (_butcherData != null)
                  _buildLieferandoSectionHeader(_butcherData!['companyName'] ?? 'Kasap'),
                ...cart.items.map((item) => _buildLieferandoCartItem(item)),
                const SizedBox(height: 16),
              ],
              
              // 💰 Price Summary
              _buildLieferandoPriceSummary(kermesTotal, kasapTotal, grandTotal),
              
              const SizedBox(height: 100), // Space for button
            ],
          ),
        ),
        
        // 🟠 Fixed Bottom Checkout Button + Legal Footer
        Positioned(
          left: 16,
          right: 16,
          bottom: 16,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildLieferandoCheckoutButton(grandTotal),
              const SizedBox(height: 12),
              // Legal terms footer (Lieferando style)
              _buildLegalTermsFooter(),
            ],
          ),
        ),
      ],
    );
  }
  
  /// 😴 3D Pill Tab Switch for Gel Al / Kurye
  Widget _buildLieferandoDeliveryPill() {
    if (!_canDeliver) {
      // Only pickup available - show static pill
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.store_outlined,
              color: _accentColor, // 🎨 BRAND COLOUR
              size: 20,
            ),
            const SizedBox(width: 10),
            const Text(
              'Gel Al',
              style: TextStyle(
                color: Colors.black87,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    // 3D Switch for Gel Al / Kurye
    return ThreeDimensionalPillTabBar(
      selectedIndex: _isPickUp ? 0 : 1,
      onTabSelected: (index) {
        setState(() => _isPickUp = index == 0);
      },
      tabs: const [
        TabItem(title: 'Gel Al', icon: Icons.store_outlined),
        TabItem(title: 'Kurye', icon: Icons.delivery_dining),
      ],
    );
  }
  
  /// 🟡 Lieferando-style minimum order bar (yellow)
  Widget _buildLieferandoMinimumBar(double currentTotal) {
    final minOrder = (_butcherData!['minOrderAmount'] as num).toDouble();
    final remaining = minOrder - currentTotal;
    final isReached = remaining <= 0;
    
    if (isReached) return const SizedBox.shrink();
    
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF9C4), // Light yellow
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(color: Colors.black87, fontSize: 14),
                children: [
                  const TextSpan(text: 'Noch '),
                  TextSpan(
                    text: '${remaining.toStringAsFixed(2)} €',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const TextSpan(text: ' bis der Mindestbestellwert erreicht ist'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  /// Section header (e.g., restaurant name)
  Widget _buildLieferandoSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: const TextStyle(
          color: Colors.black87,
          fontSize: 16,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
  
  /// 📦 Lieferando-style Kermes item
  Widget _buildLieferandoKermesItem(dynamic item) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE))),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name + Price on same line
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        item.menuItem.name,
                        style: const TextStyle(
                          color: Colors.black87,
                          fontWeight: FontWeight.w500,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    Text(
                      '${item.totalPrice.toStringAsFixed(2)} €',
                      style: const TextStyle(
                        color: Colors.black87,
                        fontWeight: FontWeight.w500,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Quantity controls
                Row(
                  children: [
                    // Delete button
                    GestureDetector(
                      onTap: () => ref.read(kermesCartProvider.notifier).removeItem(item.menuItem.id),
                      child: const Icon(Icons.delete_outline, color: Colors.grey, size: 22),
                    ),
                    const SizedBox(width: 16),
                    // Quantity
                    Text(
                      '${item.quantity}',
                      style: const TextStyle(
                        color: Colors.black87,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 16),
                    // Add button
                    GestureDetector(
                      onTap: () => ref.read(kermesCartProvider.notifier).addItem(item.menuItem),
                      child: const Icon(Icons.add, color: Colors.black87, size: 22),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  /// 🥩 Lieferando-style Kasap cart item
  Widget _buildLieferandoCartItem(CartItem item) {
    final productName = item.product.name;
    final quantity = item.quantity;
    final totalPrice = item.totalPrice;
    final unitType = item.product.unitType?.toLowerCase() ?? 'adet';
    final isKg = unitType == 'kg';
    
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name + Price on same line
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  productName,
                  style: const TextStyle(
                    color: Colors.black87,
                    fontWeight: FontWeight.w500,
                    fontSize: 15,
                  ),
                ),
              ),
              Text(
                '${totalPrice.toStringAsFixed(2)} €',
                style: const TextStyle(
                  color: Colors.black87,
                  fontWeight: FontWeight.w500,
                  fontSize: 15,
                ),
              ),
            ],
          ),
          
          // Unit info for kg items
          if (isKg)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${item.product.price.toStringAsFixed(2)} €/kg',
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
              ),
            ),
          
          const SizedBox(height: 8),
          
          // Quantity controls (Lieferando style: trash + count + plus)
          Row(
            children: [
              // Delete/minus button
              GestureDetector(
                onTap: () {
                  if (quantity > 1) {
                    ref.read(cartProvider.notifier).updateQuantity(item.product.sku, quantity - 1);
                  } else {
                    ref.read(cartProvider.notifier).removeFromCart(item.product.sku);
                  }
                },
                child: Icon(
                  quantity == 1 ? Icons.delete_outline : Icons.remove,
                  color: Colors.grey[700],
                  size: 22,
                ),
              ),
              const SizedBox(width: 16),
              // Quantity
              Text(
                isKg ? '${(quantity / 1000).toStringAsFixed(1)} kg' : '${quantity.toInt()}',
                style: const TextStyle(
                  color: Colors.black87,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(width: 16),
              // Add button
              GestureDetector(
                onTap: () {
                  ref.read(cartProvider.notifier).updateQuantity(
                    item.product.sku, 
                    isKg ? quantity + 100 : quantity + 1,
                  );
                },
                child: Icon(Icons.add, color: Colors.grey[700], size: 22),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  /// 💰 Price Summary
  Widget _buildLieferandoPriceSummary(double kermesTotal, double kasapTotal, double grandTotal) {
    return Column(
      children: [
        const SizedBox(height: 8),
        // Subtotal
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Zwischensumme',
              style: TextStyle(color: Colors.black87, fontSize: 14),
            ),
            Text(
              '${grandTotal.toStringAsFixed(2)} €',
              style: const TextStyle(color: Colors.black87, fontSize: 14),
            ),
          ],
        ),
        const SizedBox(height: 8),
        // Service fee (if applicable)
        if (!_isPickUp && _butcherData?['deliveryFee'] != null) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Lieferkosten',
                style: TextStyle(color: Colors.grey, fontSize: 14),
              ),
              Text(
                '${(_butcherData!['deliveryFee'] as num).toStringAsFixed(2)} €',
                style: const TextStyle(color: Colors.grey, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
  
  /// 🟠 Orange Checkout Button (Lieferando pill style)
  Widget _buildLieferandoCheckoutButton(double total) {
    return GestureDetector(
      onTap: () {
        // Check minimum order for ALL orders (both pickup and delivery)
        if (_butcherData?['minOrderAmount'] != null) {
          final minOrder = (_butcherData!['minOrderAmount'] as num).toDouble();
          if (total < minOrder) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Minimum sipariş tutarı: ${minOrder.toStringAsFixed(2)} €'),
                backgroundColor: Colors.orange,
              ),
            );
            return;
          }
        }
        _submitOrder();
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: _accentColor, // 🎨 BRAND COLOUR
          borderRadius: BorderRadius.circular(28), // Pill shape
          boxShadow: [
            BoxShadow(
              color: _accentColor.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Center(
          child: Text(
            'Siparişi Onayla · ${total.toStringAsFixed(2)} €',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
  
  /// 📜 Legal Terms Footer (Lieferando style)
  Widget _buildLegalTermsFooter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: RichText(
        textAlign: TextAlign.center,
        text: TextSpan(
          style: TextStyle(
            color: Colors.grey[600],
            fontSize: 11,
            height: 1.4,
          ),
          children: [
            const TextSpan(text: 'Siparişi Onayla butonuna tıklayarak sepet içeriğini, girdiğiniz bilgileri, '),
            WidgetSpan(
              child: GestureDetector(
                onTap: () => _openPrivacyPolicy(),
                child: Text(
                  'Gizlilik Politikamızı',
                  style: TextStyle(
                    color: Colors.grey[700],
                    fontSize: 11,
                    decoration: TextDecoration.underline,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const TextSpan(text: ' ve '),
            WidgetSpan(
              child: GestureDetector(
                onTap: () => _openTermsOfUse(),
                child: Text(
                  'Kullanım Koşullarımızı',
                  style: TextStyle(
                    color: Colors.grey[700],
                    fontSize: 11,
                    decoration: TextDecoration.underline,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const TextSpan(text: ' kabul etmiş olursunuz.'),
          ],
        ),
      ),
    );
  }
  
  void _openPrivacyPolicy() {
    // TODO: Navigate to privacy policy page or open web URL
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Gizlilik Politikası yakında eklenecek')),
    );
  }
  
  void _openTermsOfUse() {
    // TODO: Navigate to terms of use page or open web URL
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Kullanım Koşulları yakında eklenecek')),
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
            
            // 🛒 LIEFERANDO-STYLE: Dynamic Minimum Order Progress
            if (_butcherData?['minOrderAmount'] != null)
              Builder(builder: (context) {
                final minOrder = (_butcherData!['minOrderAmount'] as num).toDouble();
                final currentTotal = cart.totalAmount;
                final remaining = minOrder - currentTotal;
                final progress = (currentTotal / minOrder).clamp(0.0, 1.0);
                final isReached = remaining <= 0;
                
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isReached 
                        ? const Color(0xFF4CAF50).withOpacity(0.1)
                        : const Color(0xFFFFF3CD), // Yellow/amber background like Lieferando
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isReached 
                          ? const Color(0xFF4CAF50).withOpacity(0.3)
                          : const Color(0xFFFFE082),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isReached ? Icons.check_circle : Icons.info_outline,
                            color: isReached ? const Color(0xFF4CAF50) : const Color(0xFFF57C00),
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              isReached
                                  ? 'Minimum sipariş tutarına ulaşıldı ✓'
                                  : 'Noch ${remaining.toStringAsFixed(2)} € bis der Mindestbestellwert erreicht ist',
                              style: TextStyle(
                                color: isReached ? const Color(0xFF2E7D32) : const Color(0xFF5D4037),
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (!isReached) ...[
                        const SizedBox(height: 10),
                        // Progress bar
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: progress,
                            backgroundColor: const Color(0xFFFFE082),
                            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFF57C00)),
                            minHeight: 6,
                          ),
                        ),
                        const SizedBox(height: 6),
                        // Progress text
                        Text(
                          '${currentTotal.toStringAsFixed(2)} € / ${minOrder.toStringAsFixed(2)} €',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              }),

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

  // 🎨 LIEFERANDO-STYLE: Minimalist delivery info bar
  Widget _buildDeliveryToggle() {
    final deliveryFee = _butcherData?['deliveryFee'] as num?;
    final estimatedTime = _butcherData?['deliveryTime'] ?? '20-35';
    
    return GestureDetector(
      onTap: () {
        // Toggle between pickup and delivery
        if (_canDeliver || _isPickUp) {
          setState(() => _isPickUp = !_isPickUp);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _isPickUp ? Icons.store_outlined : Icons.local_shipping_outlined,
              color: _accentColor, // 🎨 BRAND COLOUR
              size: 20,
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _isPickUp ? 'Gel Al' : 'Kurye',
                  style: const TextStyle(
                    color: Colors.black87,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                Text(
                  _isPickUp ? '15-20 Dk.' : '$estimatedTime Dk.',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const Spacer(),
            if (!_isPickUp && deliveryFee != null)
              Text(
                '+${deliveryFee.toStringAsFixed(2)} €',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 13,
                ),
              ),
            const SizedBox(width: 8),
            Icon(
              Icons.keyboard_arrow_down,
              color: Colors.grey[500],
              size: 20,
            ),
          ],
        ),
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

  // 🎨 LIEFERANDO-STYLE: Payment method selector
  Widget _buildPaymentToggle() {
    final methodLabel = _paymentMethod == 'cash' ? 'Nakit Ödeme' : 'Kart ile Ödeme';
    final methodIcon = _paymentMethod == 'cash' ? Icons.payments_outlined : Icons.credit_card_outlined;
    
    return GestureDetector(
      onTap: () {
        // Toggle payment method
        setState(() {
          _paymentMethod = _paymentMethod == 'cash' ? 'card' : 'cash';
        });
        if (_paymentMethod == 'card') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Kart ödemesi yakında aktif olacak!')),
          );
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(
          children: [
            Icon(
              methodIcon,
              color: _accentColor, // 🎨 BRAND COLOUR
              size: 22,
            ),
            const SizedBox(width: 12),
            Text(
              methodLabel,
              style: const TextStyle(
                color: Colors.black87,
                fontWeight: FontWeight.w500,
                fontSize: 14,
              ),
            ),
            const Spacer(),
            Icon(
              Icons.chevron_right,
              color: Colors.grey[400],
              size: 22,
            ),
          ],
        ),
      ),
    );
  }

  // 🎨 LIEFERANDO-STYLE: Minimalist cart item
  Widget _buildCartItem(CartItem item) {
    final productName = item.product.name.isNotEmpty ? item.product.name : 'Ürün';
    final unitType = item.product.unitType.isNotEmpty ? item.product.unitType : 'adet';
    final quantity = item.quantity;
    final totalPrice = item.totalPrice;
    final unitPrice = item.product.price;
    
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left side: Product info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product name
                Text(
                  productName,
                  style: const TextStyle(
                    color: Colors.black87,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                
                // Unit info (for kg products)
                if (unitType == 'kg')
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${quantity.toInt()}g x ${unitPrice.toStringAsFixed(2)} €/kg',
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 13,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          
          // Right side: Controls + Price
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Trash button (always deletes)
              GestureDetector(
                onTap: () {
                  ref.read(cartProvider.notifier).removeFromCart(item.product.sku);
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  child: Icon(
                    Icons.delete_outline,
                    color: Colors.grey[500],
                    size: 20,
                  ),
                ),
              ),
              
              // Quantity
              Container(
                width: 32,
                alignment: Alignment.center,
                child: Text(
                  '${quantity.toInt()}',
                  style: const TextStyle(
                    color: Colors.black87,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ),
              
              // Plus button
              GestureDetector(
                onTap: () {
                  ref.read(cartProvider.notifier).updateQuantity(item.product.sku, quantity + 1);
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  child: const Icon(
                    Icons.add,
                    color: Colors.black87,
                    size: 20,
                  ),
                ),
              ),
              
              const SizedBox(width: 12),
              
              // Price
              SizedBox(
                width: 64,
                child: Text(
                  '${totalPrice.toStringAsFixed(2)} €',
                  style: const TextStyle(
                    color: Colors.black87,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
