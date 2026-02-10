import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/providers/auth_provider.dart';
import 'package:lokma_app/models/butcher_product.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/widgets/order_confirmation_dialog.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:lokma_app/widgets/kermes/order_qr_dialog.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:lokma_app/services/fcm_service.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/services/order_service.dart';
import 'package:lokma_app/screens/orders/rating_screen.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';

class CartScreen extends ConsumerStatefulWidget {
  final bool initialPickUp;
  final bool initialDineIn;
  const CartScreen({super.key, this.initialPickUp = false, this.initialDineIn = false});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  late bool _isPickUp;
  late bool _isDineIn;
  String? _scannedTableNumber; // QR-scanned table number for dine-in
  bool _canDeliver = false;
  bool _checkingDelivery = true;
  String _paymentMethod = 'cash';
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = TimeOfDay.now();
  Map<String, dynamic>? _butcherData;
  bool _loadingButcherParams = true;
  bool _isSubmitting = false;
  OpeningHoursHelper? _hoursHelper;
  String _orderNote = '';

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
    _isPickUp = widget.initialPickUp;
    _isDineIn = widget.initialDineIn;
    // If dine-in, ensure pickup is false
    if (_isDineIn) _isPickUp = false;
    _tabController = TabController(length: 2, vsync: this);
    
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
      
      // Build full delivery address from Firestore user document
      String? userAddress;
      if (!_isPickUp && !_isDineIn) {
        try {
          final userDoc = await FirebaseFirestore.instance.collection('users').doc(userId).get();
          if (userDoc.exists) {
            final userData = userDoc.data()!;
            final street = userData['address'] ?? '';
            final houseNumber = userData['houseNumber'] ?? '';
            final postalCode = userData['postalCode'] ?? '';
            final city = userData['city'] ?? '';
            
            // Build full address: "Street HouseNumber, PLZ City"
            final streetPart = houseNumber.isNotEmpty ? '$street $houseNumber' : street;
            userAddress = [streetPart, '$postalCode $city'].where((s) => s.trim().isNotEmpty).join(', ');
          }
        } catch (e) {
          debugPrint('Error fetching user address: $e');
          userAddress = currentUser?.address; // Fallback
        }
      }

      final orderData = {
        'userId': userId,
        'userDisplayName': userDisplayName,
        'customerName': userDisplayName, // Alias for admin panel compatibility
        'userEmail': userEmail,
        'userPhone': userPhone,
        'customerPhone': userPhone, // Alias for admin panel compatibility
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
        'deliveryMethod': _isDineIn ? 'dineIn' : (_isPickUp ? 'pickup' : 'delivery'),
        'pickupTime': (_isPickUp || _isDineIn) ? Timestamp.fromDate(pickupDateTime) : null,
        'deliveryAddress': (!_isPickUp && !_isDineIn) ? userAddress : null,
        'paymentMethod': _paymentMethod,
        'paymentStatus': _paymentMethod == 'cash' ? 'pending' : 'pending',
        'status': 'pending',
        if (_orderNote.trim().isNotEmpty) 'orderNote': _orderNote.trim(),
        if (_isDineIn && _scannedTableNumber != null) 'tableNumber': _scannedTableNumber,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      // Save order
      final orderRef = await FirebaseFirestore.instance.collection('meat_orders').add(orderData);

      // UOIP: Persist orderNumber using First-6-Digit standard for cross-platform consistency
      final orderNumber = orderRef.id.substring(0, 6).toUpperCase();
      await orderRef.update({'orderNumber': orderNumber});
      
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
            isPickUp: _isPickUp,
            isDineIn: _isDineIn,
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
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    
    // 🍊 LIEFERANDO-STYLE: Theme-aware background with tabs
    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        backgroundColor: colorScheme.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.chevron_left,
            color: colorScheme.onSurface,
            size: 28,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const SizedBox.shrink(),
        centerTitle: true,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFEC131E),
          indicatorWeight: 3,
          labelColor: colorScheme.onSurface,
          unselectedLabelColor: colorScheme.onSurface.withOpacity(0.5),
          labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          tabs: const [
            Tab(text: 'Sepetim'),
            Tab(text: 'Siparişlerim'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Sepet
          _buildCartTabContent(cart, kermesCart),
          // Tab 2: Siparişlerim (unified chronological list)
          _buildUnifiedOrdersTab(),
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
  
  /// Aktif Siparişler Tab'ı - DEPRECATED, use _buildUnifiedOrdersTab
  Widget _buildActiveOrdersTab() {
    return _buildUnifiedOrdersTab();
  }
  
  /// Birleştirilmiş Siparişler Tab'ı - Kronolojik tek liste
  Widget _buildUnifiedOrdersTab() {
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
              style: TextStyle(color: Colors.red),
            ),
          );
        }
        
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Color(0xFFEC131E)));
        }
        
        final allOrders = snapshot.data ?? [];
        
        if (allOrders.isEmpty) {
          return _buildEmptyOrders('Henüz siparişiniz yok', Icons.receipt_long_outlined);
        }
        
        // Sort: active orders first (by createdAt desc), then completed (by createdAt desc)
        final activeOrders = allOrders.where((o) => _isActiveOrder(o.status)).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        final completedOrders = allOrders.where((o) => !_isActiveOrder(o.status)).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final textColor = isDark ? Colors.white : Colors.black87;
        final subtitleColor = isDark ? Colors.grey[400] : Colors.grey[600];
        
        return ListView(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
          children: [
            // Active orders — shown normally
            if (activeOrders.isNotEmpty) ...[
              for (final order in activeOrders)
                _buildLokmaOrderCard(order, isActive: true),
            ] else ...[
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.check_circle_outline, size: 48, color: Colors.green[300]),
                      const SizedBox(height: 12),
                      Text(
                        'Aktif siparişiniz yok',
                        style: TextStyle(color: subtitleColor, fontSize: 15, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            // Past orders — collapsed section
            if (completedOrders.isNotEmpty) ...[
              const SizedBox(height: 8),
              Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  initiallyExpanded: false,
                  tilePadding: const EdgeInsets.symmetric(horizontal: 4),
                  title: Row(
                    children: [
                      Icon(Icons.history, size: 20, color: subtitleColor),
                      const SizedBox(width: 8),
                      Text(
                        'Geçmiş Siparişler (${completedOrders.length})',
                        style: TextStyle(
                          color: textColor,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  children: [
                    for (final order in completedOrders)
                      _buildLokmaOrderCard(order, isActive: false),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
  
  /// Sipariş Geçmişi Tab'ı - DEPRECATED, use _buildUnifiedOrdersTab
  Widget _buildOrderHistoryTab() {
    return _buildUnifiedOrdersTab();
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
          SizedBox(height: 16),
          Text(
            'Siparişlerinizi görmek için giriş yapın',
            style: TextStyle(color: Colors.grey, fontSize: 16),
          ),
          SizedBox(height: 24),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEC131E),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
            ),
            onPressed: () => context.go('/profile'),
            child: Text('Giriş Yap', style: TextStyle(color: Colors.white)),
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
          SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 18, fontWeight: FontWeight.w600),
          ),
          SizedBox(height: 8),
          Text(
            'Sipariş vermek için bir işletme seçin!',
            style: TextStyle(color: Colors.grey[600], fontSize: 14),
          ),
        ],
      ),
    );
  }
  
  /// Lieferando-style Sipariş Kartı - Simplified & Tappable
  Widget _buildLokmaOrderCard(LokmaOrder order, {required bool isActive}) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    
    return GestureDetector(
      onTap: () => _showOrderDetailSheet(order),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.grey.shade600 : Colors.grey.shade300, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with business info - Lieferando style
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Horizontal image - Business cover/logo from Firestore with Tuna badge
                  order.butcherId.isNotEmpty
                      ? FutureBuilder<DocumentSnapshot>(
                          future: FirebaseFirestore.instance.collection('businesses').doc(order.butcherId).get(),
                          builder: (context, snapshot) {
                            if (snapshot.connectionState == ConnectionState.waiting) {
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  width: 90,
                                  height: 64,
                                  color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                  child: Center(child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28)),
                                ),
                              );
                            }
                            if (!snapshot.hasData || !snapshot.data!.exists) {
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  width: 90,
                                  height: 64,
                                  color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                  child: Center(child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28)),
                                ),
                              );
                            }
                            final businessData = snapshot.data!.data() as Map<String, dynamic>?;
                            final imageUrl = businessData?['imageUrl'] as String?;
                            final brandLabelActive = businessData?['brandLabelActive'] == true;
                            final brand = businessData?['brand']?.toString().trim().toLowerCase();
                            final hasTunaBadge = brandLabelActive && brand == 'tuna';
                            
                            return Stack(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Container(
                                    width: 90,
                                    height: 64,
                                    color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                    child: imageUrl != null && imageUrl.isNotEmpty
                                        ? Image.network(
                                            imageUrl,
                                            fit: BoxFit.cover,
                                            loadingBuilder: (context, child, loadingProgress) {
                                              if (loadingProgress == null) return child;
                                              return Center(child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28));
                                            },
                                            errorBuilder: (_, __, ___) => Center(child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28)),
                                          )
                                        : Center(child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28)),
                                  ),
                                ),
                                // Tuna Badge overlay
                                if (hasTunaBadge)
                                  Positioned(
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFD32F2F),
                                        borderRadius: const BorderRadius.only(
                                          bottomLeft: Radius.circular(12),
                                          bottomRight: Radius.circular(12),
                                        ),
                                      ),
                                      child: Text(
                                        'TUNA',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            );
                          },
                        )
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            width: 90,
                            height: 64,
                            color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                            child: Center(child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28)),
                          ),
                        ),
                  SizedBox(width: 12),
                  // Business info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Order number - always visible
                        Text(
                          'Sipariş No: ${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                          style: TextStyle(
                            color: colorScheme.onSurface.withOpacity(0.5),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.5,
                          ),
                        ),
                        SizedBox(height: 4),
                        // Business name
                        Text(
                          order.butcherName,
                          style: TextStyle(
                            color: colorScheme.onSurface,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 4),
                        // Status and date
                        Text(
                          '${_getStatusText(order.status)} • ${_formatDate(order.createdAt)}',
                          style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6), fontSize: 13),
                        ),
                        SizedBox(height: 4),
                        // "Siparişi Görüntüle" link
                        Text(
                          'Siparişi Görüntüle',
                          style: TextStyle(
                            color: colorScheme.onSurface,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                        SizedBox(height: 4),
                        // Items and price
                        Text(
                          '${order.items.length} ürün • €${order.totalAmount.toStringAsFixed(2)}',
                          style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6), fontSize: 13),
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
            
            // Buttons row - Lieferando style thin pills
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                children: [
                  // Puan Ver button - Dark mode aware
                  SizedBox(
                    width: double.infinity,
                    height: 40,
                    child: ElevatedButton(
                      onPressed: () => _rateOrder(order),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade200,
                        foregroundColor: isDark ? Colors.white : Colors.black,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                        padding: EdgeInsets.zero,
                      ),
                      child: Text(
                        'Puan Ver',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: isDark ? Colors.white : Colors.black,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: 8),
                  // Tekrar Sipariş Ver button - Dark mode aware
                  SizedBox(
                    width: double.infinity,
                    height: 40,
                    child: ElevatedButton(
                      onPressed: () => _reorder(order),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isDark ? const Color(0xFF3A3A3C) : const Color(0xFF1A1A1A),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                        padding: EdgeInsets.zero,
                      ),
                      child: Text(
                        'Tekrar Sipariş Ver',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
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
  
  /// Show order detail bottom sheet - Lieferando style
  void _showOrderDetailSheet(LokmaOrder order) {
    // Fetch brand color from business
    _fetchBrandColor(order.butcherId).then((brandColor) {
      final theme = Theme.of(context);
      final colorScheme = theme.colorScheme;
      final isDark = theme.brightness == Brightness.dark;
      
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (context) => DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) => Container(
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                // Handle bar
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[600] : Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                
                // Close button
                Align(
                  alignment: Alignment.topLeft,
                  child: IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: Icon(Icons.close, color: brandColor, size: 28),
                  ),
                ),
                
                // Scrollable content
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Order date and time header
                        Text(
                          'Sipariş ${_formatDateFull(order.createdAt)}',
                          style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6), fontSize: 14),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '${order.createdAt.hour.toString().padLeft(2, '0')}:${order.createdAt.minute.toString().padLeft(2, '0')}',
                          style: TextStyle(
                            color: colorScheme.onSurface,
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 16),
                        
                        // Status row with expand icon
                        Row(
                          children: [
                            Icon(
                              _getStatusIcon(order.status),
                              color: _getStatusColor(order.status),
                              size: 24,
                            ),
                            SizedBox(width: 12),
                            Text(
                              _getStatusText(order.status),
                              style: TextStyle(
                                color: colorScheme.onSurface,
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const Spacer(),
                            Icon(Icons.keyboard_arrow_down, color: Colors.grey[400]),
                          ],
                        ),
                        SizedBox(height: 20),
                        
                        // Action buttons
                        // Puan Ver button (brand color)
                        Container(
                          width: double.infinity,
                          height: 48,
                          decoration: BoxDecoration(
                            color: brandColor,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: TextButton.icon(
                            onPressed: () {
                              Navigator.pop(context);
                              _rateOrder(order);
                            },
                            icon: const Icon(Icons.star_border, color: Colors.white, size: 20),
                            label: Text(
                              'Puan Ver',
                              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                        SizedBox(height: 12),
                        
                        // Tekrar Sipariş Ver button (black outline)
                        Container(
                          width: double.infinity,
                          height: 48,
                          decoration: BoxDecoration(
                            color: colorScheme.surface,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: colorScheme.onSurface, width: 1.5),
                          ),
                          child: TextButton(
                            onPressed: () {
                              Navigator.pop(context);
                              _reorder(order);
                            },
                            child: Text(
                              'Tekrar Sipariş Ver',
                              style: TextStyle(color: colorScheme.onSurface, fontSize: 15, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                        SizedBox(height: 24),
                        
                        // Divider
                        Container(height: 1, color: Colors.grey.shade200),
                        SizedBox(height: 20),
                        
                        // Delivery/Pickup address section
                        Text(
                          order.orderType == OrderType.delivery ? 'Teslimat Adresi:' : 'Gel Al:',
                          style: TextStyle(
                            color: colorScheme.onSurface,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(Icons.location_on_outlined, color: Colors.grey[600], size: 20),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                order.deliveryAddress ?? order.butcherName,
                                style: TextStyle(color: colorScheme.onSurface.withOpacity(0.7), fontSize: 14),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 12),
                        
                        // Show on map button
                        Container(
                          width: double.infinity,
                          height: 44,
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey.shade800 : Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: TextButton.icon(
                            onPressed: () => _openMapsForBusiness(order.butcherId, order.butcherName),
                            icon: Icon(Icons.navigation_outlined, color: colorScheme.onSurface.withOpacity(0.7), size: 18),
                            label: Text(
                              'Haritada Göster',
                              style: TextStyle(color: colorScheme.onSurface.withOpacity(0.7), fontSize: 14, fontWeight: FontWeight.w500),
                            ),
                          ),
                        ),
                        SizedBox(height: 24),
                        
                        // Divider
                        Container(height: 1, color: Colors.grey.shade200),
                        SizedBox(height: 20),
                        
                        // Business info and order items
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    order.butcherName,
                                    style: TextStyle(
                                      color: colorScheme.onSurface,
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Sipariş No: ${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                                    style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6), fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                            // Business logo
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                width: 48,
                                height: 48,
                                color: isDark ? Colors.grey.shade700 : Colors.grey.shade200,
                                child: order.butcherId.isNotEmpty
                                    ? Image.network(
                                        'https://firebasestorage.googleapis.com/v0/b/lokma-app.firebasestorage.app/o/businesses%2F${order.butcherId}%2Flogo.jpg?alt=media',
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => Icon(Icons.store, color: Colors.grey[400], size: 24),
                                      )
                                    : Icon(Icons.store, color: Colors.grey[400], size: 24),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 16),
                        
                        // Order items list
                        ...order.items.map((item) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Text(
                                '${item.quantity.toInt()}',
                                style: TextStyle(color: colorScheme.onSurface, fontSize: 14),
                              ),
                              SizedBox(width: 16),
                              Expanded(
                                child: Text(
                                  item.name,
                                  style: TextStyle(color: colorScheme.onSurface, fontSize: 14),
                                ),
                              ),
                              Text(
                                '€${(item.price * item.quantity).toStringAsFixed(2)}',
                                style: TextStyle(color: colorScheme.onSurface, fontSize: 14),
                              ),
                            ],
                          ),
                        )),
                        SizedBox(height: 16),
                        
                        // Divider
                        Container(height: 1, color: isDark ? Colors.grey.shade700 : Colors.grey.shade200),
                        SizedBox(height: 16),
                        
                        // Total
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Ödenen Toplam',
                              style: TextStyle(
                                color: colorScheme.onSurface,
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              '€${order.totalAmount.toStringAsFixed(2)}',
                              style: TextStyle(
                                color: colorScheme.onSurface,
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 8),
                        
                        // View receipt link
                        GestureDetector(
                          onTap: () => _showReceiptSheet(order, brandColor),
                          child: Text(
                            'Fişi Görüntüle',
                            style: TextStyle(
                              color: brandColor,
                              fontSize: 14,
                              decoration: TextDecoration.underline,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        SizedBox(height: 32),
                        
                        // Help section
                        Container(height: 1, color: isDark ? Colors.grey.shade700 : Colors.grey.shade200),
                        SizedBox(height: 24),
                        
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Bir sorun mu var?',
                                    style: TextStyle(
                                      color: colorScheme.onSurface,
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Yardımcımız size yardımcı olabilir',
                                    style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6), fontSize: 13),
                                  ),
                                  SizedBox(height: 12),
                                  GestureDetector(
                                    onTap: () => _openSupportChat(order),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                      decoration: BoxDecoration(
                                        color: brandColor,
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        'Sohbeti Başlat',
                                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Help illustration placeholder
                            Container(
                              width: 80,
                              height: 80,
                              decoration: BoxDecoration(
                                color: brandColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(40),
                              ),
                              child: Icon(Icons.support_agent, color: brandColor.withOpacity(0.5), size: 40),
                            ),
                          ],
                        ),
                        SizedBox(height: 120), // Extra padding for bottom navbar
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    });
  }
  
  /// Fetch brand color from Firestore
  Future<Color> _fetchBrandColor(String businessId) async {
    if (businessId.isEmpty) return const Color(0xFFEC131E);
    try {
      final doc = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(businessId)
          .get();
      if (doc.exists) {
        final data = doc.data();
        final brandColorHex = data?['brandColor'] as String?;
        if (brandColorHex != null && brandColorHex.isNotEmpty) {
          final hex = brandColorHex.replaceAll('#', '');
          return Color(int.parse('FF$hex', radix: 16));
        }
      }
    } catch (e) {
      debugPrint('Error fetching brand color: $e');
    }
    return const Color(0xFFEC131E); // Default LOKMA red
  }
  
  /// Open maps for business location
  Future<void> _openMapsForBusiness(String businessId, String businessName) async {
    try {
      // First get business address from Firestore
      final doc = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(businessId)
          .get();
      
      String query = businessName;
      double? lat;
      double? lng;
      
      if (doc.exists) {
        final data = doc.data();
        
        // Try to get coordinates first (most accurate)
        if (data?['lat'] is num) lat = (data!['lat'] as num).toDouble();
        if (data?['lng'] is num) lng = (data!['lng'] as num).toDouble();
        
        // Handle address - can be String or Map
        final addressField = data?['address'];
        String? addressStr;
        String? city = data?['city'] as String?;
        
        if (addressField is String && addressField.isNotEmpty) {
          // Address is a simple string
          addressStr = addressField;
        } else if (addressField is Map<String, dynamic>) {
          // Address is a Map with structured data
          final streetName = addressField['streetName'] as String?;
          final streetNumber = addressField['streetNumber'] as String?;
          final postalCode = addressField['postalCode'] as String?;
          final cityFromAddress = addressField['city'] as String?;
          
          // Try to get lat/lng from address map if not already found
          if (lat == null && addressField['lat'] is num) {
            lat = (addressField['lat'] as num).toDouble();
          }
          if (lng == null && addressField['lng'] is num) {
            lng = (addressField['lng'] as num).toDouble();
          }
          
          // Build address string
          final parts = <String>[];
          if (streetName != null && streetName.isNotEmpty) {
            parts.add(streetNumber != null ? '$streetName $streetNumber' : streetName);
          }
          if (postalCode != null && postalCode.isNotEmpty) {
            parts.add(postalCode);
          }
          if (cityFromAddress != null && cityFromAddress.isNotEmpty) {
            city = cityFromAddress;
          }
          if (city != null && city.isNotEmpty) {
            parts.add(city);
          }
          
          if (parts.isNotEmpty) {
            addressStr = parts.join(', ');
          }
        }
        
        if (addressStr != null && addressStr.isNotEmpty) {
          query = addressStr;
        } else if (city != null && city.isNotEmpty) {
          query = '$businessName, $city';
        }
      }
      
      Uri mapsUrl;
      
      // If we have coordinates, use them for more accurate navigation
      if (lat != null && lng != null) {
        // Apple Maps with coordinates
        mapsUrl = Uri.parse('https://maps.apple.com/?ll=$lat,$lng&q=${Uri.encodeComponent(businessName)}');
      } else {
        // Fallback to search query
        final encodedQuery = Uri.encodeComponent(query);
        mapsUrl = Uri.parse('https://maps.apple.com/?q=$encodedQuery');
      }
      
      debugPrint('Opening maps URL: $mapsUrl');
      
      if (await canLaunchUrl(mapsUrl)) {
        await launchUrl(mapsUrl, mode: LaunchMode.externalApplication);
      } else {
        // Fallback to Google Maps if Apple Maps fails
        final googleUrl = lat != null && lng != null
            ? Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng')
            : Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(query)}');
        if (await canLaunchUrl(googleUrl)) {
          await launchUrl(googleUrl, mode: LaunchMode.externalApplication);
        }
      }
    } catch (e) {
      debugPrint('Error opening maps: $e');
      // Show snackbar for user feedback
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Harita açılırken hata oluştu: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
  
  /// Open support chat
  void _openSupportChat(LokmaOrder order) {
    // Navigate to support or open email
    final subject = Uri.encodeComponent('Sipariş Desteği: ${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}');
    final body = Uri.encodeComponent('Sipariş No: ${order.id}\nİşletme: ${order.butcherName}\n\nMesajınız:');
    final mailtoUri = Uri.parse('mailto:destek@lokma.app?subject=$subject&body=$body');
    launchUrl(mailtoUri);
  }
  
  /// Show nostalgic receipt sheet
  void _showReceiptSheet(LokmaOrder order, Color brandColor) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Color(0xFFFFFDE7), // Yellowish receipt paper color
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              
              // Close button
              Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(Icons.close, color: Colors.grey[600], size: 24),
                ),
              ),
              
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    children: [
                      // Receipt header - dashed line
                      _buildDashedLine(),
                      SizedBox(height: 16),
                      
                      // Business name - centered in monospace
                      Text(
                        order.butcherName.toUpperCase(),
                        style: TextStyle(
                          fontFamily: 'Courier',
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.onSurface,
                          letterSpacing: 2,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 4),
                      Text(
                        'LOKMA',
                        style: TextStyle(
                          fontFamily: 'Courier',
                          fontSize: 12,
                          color: Colors.grey[600],
                          letterSpacing: 3,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 16),
                      _buildDashedLine(),
                      SizedBox(height: 16),
                      
                      // Order info
                      _buildReceiptRow('SİPARİŞ NO:', order.orderNumber ?? order.id.substring(0, 6).toUpperCase()),
                      SizedBox(height: 4),
                      _buildReceiptRow('TARİH:', DateFormat('dd.MM.yyyy').format(order.createdAt)),
                      SizedBox(height: 4),
                      _buildReceiptRow('SAAT:', DateFormat('HH:mm').format(order.createdAt)),
                      SizedBox(height: 4),
                      _buildReceiptRow('TİP:', order.orderType == OrderType.delivery ? 'TESLİMAT' : 'GEL AL'),
                      SizedBox(height: 16),
                      _buildDashedLine(),
                      SizedBox(height: 16),
                      
                      // Items header
                      Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Text(
                              'ÜRÜN',
                              style: TextStyle(
                                fontFamily: 'Courier',
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                            ),
                          ),
                          SizedBox(
                            width: 40,
                            child: Text(
                              'AD.',
                              style: TextStyle(
                                fontFamily: 'Courier',
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          SizedBox(
                            width: 60,
                            child: Text(
                              'FİYAT',
                              style: TextStyle(
                                fontFamily: 'Courier',
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                              textAlign: TextAlign.right,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 8),
                      
                      // Items
                      ...order.items.map((item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: Text(
                                item.name.toUpperCase(),
                                style: TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Theme.of(context).colorScheme.onSurface,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            SizedBox(
                              width: 40,
                              child: Text(
                                '${item.quantity.toInt()}',
                                style: TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Theme.of(context).colorScheme.onSurface,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                            SizedBox(
                              width: 60,
                              child: Text(
                                '€${(item.price * item.quantity).toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Theme.of(context).colorScheme.onSurface,
                                ),
                                textAlign: TextAlign.right,
                              ),
                            ),
                          ],
                        ),
                      )),
                      
                      SizedBox(height: 16),
                      _buildDashedLine(),
                      SizedBox(height: 16),
                      
                      // Total
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'TOPLAM',
                            style: TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                          Text(
                            '€${order.totalAmount.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 24),
                      _buildDashedLine(),
                      SizedBox(height: 24),
                      
                      // Thank you message
                      Text(
                        'TEŞEKKÜR EDERİZ!',
                        style: TextStyle(
                          fontFamily: 'Courier',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.onSurface,
                          letterSpacing: 2,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Afiyet olsun',
                        style: TextStyle(
                          fontFamily: 'Courier',
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 16),
                      
                      // Barcode simulation
                      Container(
                        height: 50,
                        margin: const EdgeInsets.symmetric(horizontal: 40),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(30, (index) => Container(
                            width: index % 3 == 0 ? 3 : 1.5,
                            height: 50,
                            color: Theme.of(context).colorScheme.onSurface,
                            margin: const EdgeInsets.symmetric(horizontal: 1),
                          )),
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        order.id.substring(0, 12).toUpperCase(),
                        style: TextStyle(
                          fontFamily: 'Courier',
                          fontSize: 10,
                          color: Theme.of(context).colorScheme.onSurface,
                          letterSpacing: 3,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 24),
                      _buildDashedLine(),
                      SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  /// Build dashed line for receipt
  Widget _buildDashedLine() {
    return Row(
      children: List.generate(40, (index) => Expanded(
        child: Container(
          height: 1,
          color: index % 2 == 0 ? Colors.grey[400] : Colors.transparent,
        ),
      )),
    );
  }
  
  /// Build receipt row
  Widget _buildReceiptRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontFamily: 'Courier',
            fontSize: 12,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'Courier',
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
      ],
    );
  }
  
  /// Get status icon
  IconData _getStatusIcon(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return Icons.schedule;
      case OrderStatus.accepted:
        return Icons.check_circle_outline;
      case OrderStatus.preparing:
        return Icons.restaurant;
      case OrderStatus.ready:
        return Icons.inventory_2_outlined;
      case OrderStatus.onTheWay:
        return Icons.delivery_dining;
      case OrderStatus.delivered:
        return Icons.check_circle;
      case OrderStatus.cancelled:
        return Icons.cancel_outlined;
    }
  }
  
  /// Format date with month name
  String _formatDateFull(DateTime date) {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    return '${date.day} ${months[date.month - 1]}';
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
    // Always show actual date: DD.MM.YY HH:MM
    return '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year.toString().substring(2)} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
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
          isDelivery: order.orderType == OrderType.delivery,
          courierId: order.courierId,
          courierName: order.courierName,
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
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
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
                    SizedBox(width: 4),
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
          SizedBox(height: 8),
          
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
          SizedBox(height: 12),
          
          // Ürünler
          ...order.items.take(3).map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Text(
                  '${item.quantity}x',
                  style: TextStyle(color: Color(0xFFF43F5E), fontWeight: FontWeight.bold),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.name,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 13),
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
          
          SizedBox(height: 12),
          const Divider(color: Colors.grey, height: 1),
          SizedBox(height: 12),
          
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
                  style: TextStyle(color: Colors.blue, fontSize: 11),
                ),
              ),
              SizedBox(width: 8),
              // Ödeme türü
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  order.paymentMethodLabel,
                  style: TextStyle(color: Colors.green, fontSize: 11),
                ),
              ),
              const Spacer(),
              // Toplam
              Text(
                '${order.totalAmount.toStringAsFixed(2)} €',
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          
          // QR Kod Butonu
          SizedBox(height: 12),
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
              label: Text('Hesabı Göster'),
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
            if (cart.items.isNotEmpty) SizedBox(height: 24),
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
              SizedBox(height: 16),
              
              // 🟡 Minimum Order Bar (Yellow - Lieferando style) - ONLY for Kurye mode
              if (hasKasap && _butcherData != null && !_isPickUp && !_isDineIn)
                _buildLieferandoMinimumBar(cart.totalAmount),
              
              // 📦 Kermes Items (if any)
              if (hasKermes) ...[
                _buildLieferandoSectionHeader(kermesCart.eventName ?? 'Kermes'),
                ...kermesCart.items.map((item) => _buildLieferandoKermesItem(item)),
                SizedBox(height: 16),
              ],
              
              // 🥩 Kasap Items (if any)  
              if (hasKasap) ...[
                if (hasKermes) const Divider(height: 32),
                if (_butcherData != null)
                  _buildLieferandoSectionHeader(_butcherData!['companyName'] ?? 'Kasap'),
                ...cart.items.map((item) => _buildLieferandoCartItem(item)),
                SizedBox(height: 16),
              ],
              
              // 💰 Price Summary
              _buildLieferandoPriceSummary(kermesTotal, kasapTotal, grandTotal),
              
              SizedBox(height: 100), // Space for button
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
              _buildScannedTableBanner(),
              _buildLieferandoCheckoutButton(grandTotal),
              SizedBox(height: 12),
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
            SizedBox(width: 10),
            Text(
              'Gel Al',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    // 3D Switch for Kurye / Gel Al / Masa
    return ThreeDimensionalPillTabBar(
      selectedIndex: _isDineIn ? 2 : (_isPickUp ? 1 : 0), // Kurye=0, Gel Al=1, Masa=2
      onTabSelected: (index) {
        setState(() {
          _isPickUp = index == 1;
          _isDineIn = index == 2;
          if (!_isDineIn) _scannedTableNumber = null; // Reset QR on mode switch
        });
      },
      tabs: const [
        TabItem(title: 'Kurye', icon: Icons.delivery_dining), // LEFT
        TabItem(title: 'Gel Al', icon: Icons.store_outlined), // MIDDLE
        TabItem(title: 'Masa', icon: Icons.restaurant),       // RIGHT
      ],
    );
  }
  
  /// 🟡 Lieferando-style minimum order bar (yellow warning or green success)
  Widget _buildLieferandoMinimumBar(double currentTotal) {
    final minOrder = (_butcherData?['minOrderAmount'] as num?)?.toDouble() ?? 10.0;
    final remaining = minOrder - currentTotal;
    final isReached = remaining <= 0;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    if (isReached) {
      // ✅ SUCCESS: Minimum reached - show green bar (Lieferando style)
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1B3A1B) : const Color(0xFFE8F5E9),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF4CAF50).withOpacity(isDark ? 0.5 : 0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: const Color(0xFF4CAF50),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.check, color: Colors.white, size: 14),
            ),
            SizedBox(width: 10),
            Text(
              'Harika! Teslimat şimdi mümkün',
              style: TextStyle(
                color: isDark ? const Color(0xFF81C784) : const Color(0xFF2E7D32),
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }
    
    // 🟡 WARNING: Below minimum - show yellow/amber bar
    final barBg = isDark ? const Color(0xFF3A2E00) : const Color(0xFFFFF9C4);
    final textColor = isDark ? const Color(0xFFFFD54F) : const Color(0xFF5D4037);
    final iconColor = isDark ? const Color(0xFFFFD54F) : const Color(0xFFF9A825);
    
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: barBg,
        borderRadius: BorderRadius.circular(8),
        border: isDark ? Border.all(color: const Color(0xFFFFD54F).withOpacity(0.3)) : null,
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, color: iconColor, size: 20),
          SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(color: textColor, fontSize: 14),
                children: [
                  TextSpan(
                    text: '${remaining.toStringAsFixed(2).replaceAll('.', ',')} €',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const TextSpan(text: ' daha ekle, min. sipariş '),
                  TextSpan(
                    text: '${minOrder.toStringAsFixed(0)} €',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
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
        style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
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
                        style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                          fontWeight: FontWeight.w500,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    Text(
                      '${item.totalPrice.toStringAsFixed(2)} €',
                      style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                        fontWeight: FontWeight.w500,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                // Quantity controls
                Row(
                  children: [
                    // Delete button
                    GestureDetector(
                      onTap: () => ref.read(kermesCartProvider.notifier).removeItem(item.menuItem.id),
                      child: const Icon(Icons.delete_outline, color: Colors.grey, size: 22),
                    ),
                    SizedBox(width: 16),
                    // Quantity
                    Text(
                      '${item.quantity}',
                      style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    SizedBox(width: 16),
                    // Add button
                    GestureDetector(
                      onTap: () => ref.read(kermesCartProvider.notifier).addItem(item.menuItem),
                      child: Icon(Icons.add, color: Theme.of(context).colorScheme.onSurface, size: 22),
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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // LEFT: Product name and details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  productName,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontWeight: FontWeight.w500,
                    fontSize: 15,
                  ),
                ),
                if (isKg)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${item.product.price.toStringAsFixed(2)} €/kg',
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                    ),
                  ),
              ],
            ),
          ),
          
          // RIGHT: Price + Quantity controls (Lieferando style)
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Price
              Text(
                '${totalPrice.toStringAsFixed(2)} €',
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.w500,
                  fontSize: 15,
                ),
              ),
              SizedBox(height: 8),
              // Quantity controls: - number +
              Builder(
                builder: (context) {
                  final isDark = Theme.of(context).brightness == Brightness.dark;
                  return Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: isDark ? Colors.grey.shade600 : Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Minus/Delete button
                        GestureDetector(
                          onTap: () {
                            final step = isKg ? 100.0 : 1.0;
                            final minQty = isKg ? 100.0 : 1.0;
                            if (quantity > minQty) {
                              ref.read(cartProvider.notifier).updateQuantity(item.product.sku, quantity - step);
                            } else {
                              ref.read(cartProvider.notifier).removeFromCart(item.product.sku);
                            }
                          },
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            child: Icon(
                              quantity == 1 ? Icons.delete_outline : Icons.remove,
                              color: isDark ? Colors.grey[400] : Colors.grey[700],
                              size: 18,
                            ),
                          ),
                        ),
                        // Quantity
                        Container(
                          constraints: const BoxConstraints(minWidth: 32),
                          alignment: Alignment.center,
                          child: Text(
                            isKg ? '${(quantity / 1000).toStringAsFixed(1)}' : '${quantity.toInt()}',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        // Plus button
                        GestureDetector(
                          onTap: () {
                            ref.read(cartProvider.notifier).updateQuantity(
                              item.product.sku, 
                              isKg ? quantity + 100 : quantity + 1,
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            child: Icon(Icons.add, color: isDark ? Colors.grey[400] : Colors.grey[700], size: 18),
                          ),
                        ),
                      ],
                    ),
                  );
                },
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
        SizedBox(height: 8),
        // Subtotal
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Ara Toplam',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
            ),
            Text(
              '${grandTotal.toStringAsFixed(2)} €',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
            ),
          ],
        ),
        SizedBox(height: 8),
        // Service fee (if applicable)
        if (!_isPickUp && !_isDineIn && _butcherData?['deliveryFee'] != null) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Teslimat Ücreti',
                style: TextStyle(color: Colors.grey, fontSize: 14),
              ),
              Text(
                '${(_butcherData!['deliveryFee'] as num).toStringAsFixed(2)} €',
                style: TextStyle(color: Colors.grey, fontSize: 14),
              ),
            ],
          ),
          SizedBox(height: 8),
        ],
      ],
    );
  }
  
  /// 🟠 Orange Checkout Button (Lieferando pill style)
  Widget _buildLieferandoCheckoutButton(double total) {
    return GestureDetector(
      onTap: () {
        // 🪑 DINE-IN QR GATE: Require QR scan before checkout
        if (_isDineIn && _scannedTableNumber == null) {
          _showQrScanSheet();
          return;
        }
        // Check minimum order ONLY for Kurye (delivery) mode - Gel Al has no minimum
        if (!_isPickUp && !_isDineIn) {
          final minOrder = (_butcherData?['minOrderAmount'] as num?)?.toDouble() ?? 10.0;
          if (total < minOrder) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Kurye için minimum sipariş tutarı: ${minOrder.toStringAsFixed(0)} €'),
                backgroundColor: Colors.orange,
              ),
            );
            return;
          }
        }
        _showCheckoutSheet(total);
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
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_isDineIn && _scannedTableNumber == null) ...[
                const Icon(Icons.qr_code_scanner, color: Colors.white, size: 20),
                const SizedBox(width: 8),
              ],
              Text(
                (_isDineIn && _scannedTableNumber == null)
                    ? 'QR Kod Tara · ${total.toStringAsFixed(2)} €'
                    : 'Siparişi Onayla · ${total.toStringAsFixed(2)} €',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  /// 📱 QR Scan Bottom Sheet for Dine-In Table Verification
  void _showQrScanSheet() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = _accentColor;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.75,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A2E) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 30,
                offset: const Offset(0, -10),
              ),
            ],
          ),
          child: Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              
              const SizedBox(height: 20),
              
              // Header
              Icon(Icons.qr_code_scanner, size: 36, color: accent),
              const SizedBox(height: 12),
              Text(
                'Masanızdaki QR Kodu Okutun',
                style: TextStyle(
                  fontSize: 20, 
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Sipariş vermek için masanızdaki QR kodu taratın',
                style: TextStyle(
                  fontSize: 14, 
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
              
              const SizedBox(height: 24),
              
              // Camera Scanner
              Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 32),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: accent.withOpacity(0.4), width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: accent.withOpacity(0.1),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: MobileScanner(
                      onDetect: (capture) {
                        final barcodes = capture.barcodes;
                        if (barcodes.isEmpty) return;
                        
                        final rawValue = barcodes.first.rawValue ?? '';
                        if (rawValue.isEmpty) return;
                        
                        // Extract table number from QR data
                        // QR format could be: "masa:5", "table:5", "MASA-5", or just "5"
                        String tableNum = rawValue;
                        if (rawValue.toLowerCase().contains('masa')) {
                          final match = RegExp(r'(\d+)').firstMatch(rawValue);
                          tableNum = match?.group(1) ?? rawValue;
                        } else if (rawValue.toLowerCase().contains('table')) {
                          final match = RegExp(r'(\d+)').firstMatch(rawValue);
                          tableNum = match?.group(1) ?? rawValue;
                        }
                        
                        // Success haptic + close
                        HapticFeedback.heavyImpact();
                        Navigator.pop(ctx);
                        
                        setState(() {
                          _scannedTableNumber = tableNum;
                        });
                        
                        // Show success snackbar
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Row(
                              children: [
                                const Icon(Icons.check_circle, color: Colors.white, size: 20),
                                const SizedBox(width: 8),
                                Text('Masa $tableNum doğrulandı ✓'),
                              ],
                            ),
                            backgroundColor: Colors.green,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Manual entry option
              TextButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _showManualTableEntry();
                },
                icon: Icon(Icons.edit, size: 18, color: accent),
                label: Text(
                  'Manuel masa numarası gir',
                  style: TextStyle(color: accent, fontSize: 14),
                ),
              ),
              
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }
  
  /// 🔢 Manual Table Number Entry Dialog
  void _showManualTableEntry() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final controller = TextEditingController();
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1E2E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.restaurant, color: _accentColor, size: 24),
            const SizedBox(width: 8),
            Text(
              'Masa Numarası',
              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
            ),
          ],
        ),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          autofocus: true,
          style: TextStyle(
            fontSize: 24, 
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
          textAlign: TextAlign.center,
          decoration: InputDecoration(
            hintText: 'Örn: 5',
            hintStyle: TextStyle(color: Colors.grey[500]),
            filled: true,
            fillColor: isDark ? Colors.white.withOpacity(0.05) : Colors.grey[100],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: _accentColor, width: 2),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('İptal', style: TextStyle(color: Colors.grey[500])),
          ),
          ElevatedButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isNotEmpty) {
                HapticFeedback.mediumImpact();
                Navigator.pop(ctx);
                setState(() => _scannedTableNumber = text);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Row(
                      children: [
                        const Icon(Icons.check_circle, color: Colors.white, size: 20),
                        const SizedBox(width: 8),
                        Text('Masa $text seçildi ✓'),
                      ],
                    ),
                    backgroundColor: Colors.green,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    duration: const Duration(seconds: 2),
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _accentColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Onayla'),
          ),
        ],
      ),
    );
  }
  
  /// 🪑 Scanned Table Banner — shows in cart when table QR is verified
  Widget _buildScannedTableBanner() {
    if (!_isDineIn || _scannedTableNumber == null) return const SizedBox.shrink();
    
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.green.withOpacity(isDark ? 0.2 : 0.1),
            Colors.green.withOpacity(isDark ? 0.1 : 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.green.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.restaurant, color: Colors.green, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Masa $_scannedTableNumber',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                Text(
                  'QR kod ile doğrulandı ✓',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.green[700],
                  ),
                ),
              ],
            ),
          ),
          // Change table button
          GestureDetector(
            onTap: () {
              setState(() => _scannedTableNumber = null);
              _showQrScanSheet();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.08) : Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Değiştir',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ),
          ),
        ],
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
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      kermesCart.eventName ?? 'Kermes Siparişi',
                      style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      '${kermesCart.totalItems} ürün',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
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
          SizedBox(height: 16),
          
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
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 12),
                // Ürün adı
                Expanded(
                  child: Text(
                    item.menuItem.name,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
                  ),
                ),
                // Fiyat
                Text(
                  '€${item.totalPrice.toStringAsFixed(2)}',
                  style: TextStyle(
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
              Text(
                'Kermes Toplamı',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.bold),
              ),
              Text(
                '€${kermesCart.totalAmount.toStringAsFixed(2)}',
                style: TextStyle(
                  color: Color(0xFF4CAF50),
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          
          SizedBox(height: 16),
          
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
              child: Text(
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
          SizedBox(height: 16),
          Text(
            'Sepetiniz boş',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 20),
          ),
          SizedBox(height: 8),
          Text('Kermes menüsünden sipariş verin', style: TextStyle(color: Colors.grey)),
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
            SizedBox(height: 12),
            
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
                          SizedBox(width: 10),
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
                        SizedBox(height: 10),
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
                        SizedBox(height: 6),
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
            SizedBox(height: 12),
            
            // Payment Method
            _buildPaymentToggle(),
            SizedBox(height: 16),
            
            // Cart Items
            Text('Ürünler', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 18, fontWeight: FontWeight.bold)),
            SizedBox(height: 12),
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
                  child: Text(
                    'Ürün yüklenemedi',
                    style: TextStyle(color: Colors.red),
                  ),
                );
              }
            }),
            
            SizedBox(height: 16),
            
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
                  Text('Toplam', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 16)),
                  Text(
                    '€${cart.totalAmount.toStringAsFixed(2)}',
                    style: TextStyle(color: Color(0xFF4CAF50), fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            
            SizedBox(height: 16),
            
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
                    ? SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                      )
                    : Text(
                        'Siparişi Onayla',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
            
            SizedBox(height: 16),
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
            SizedBox(height: 16),
            Text(
              'Sepet yüklenirken hata oluştu',
              style: TextStyle(color: Colors.white, fontSize: 18),
            ),
            SizedBox(height: 8),
            Text(
              e.toString(),
              style: TextStyle(color: Colors.grey, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53935)),
              child: Text('Ana Sayfaya Dön'),
            ),
          ],
        ),
      );
    }
  }

  /// 🛒 CHECKOUT CONFIRMATION BOTTOM SHEET
  void _showCheckoutSheet(double total) {
    // Auth gate: giriş yapmamışsa login'e yönlendir
    final authState = ref.read(authProvider);
    final firebaseUser = FirebaseAuth.instance.currentUser;
    if (authState.appUser == null && firebaseUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sipariş vermek için giriş yapmalısınız'),
          backgroundColor: Colors.orange,
        ),
      );
      context.push('/login');
      return;
    }

    final cart = ref.read(cartProvider);
    final deliveryFee = (!_isPickUp && !_isDineIn ? (_butcherData?['deliveryFee'] as num?)?.toDouble() ?? 2.50 : 0.0);
    final grandTotal = total + deliveryFee;
    final noteController = TextEditingController(text: _orderNote);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        final scrollController = ScrollController();
        bool hasScrolledForKeyboard = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final bottomInset = MediaQuery.of(ctx).viewInsets.bottom;
            // Auto-scroll to bottom (note field) when keyboard opens — once only
            if (bottomInset > 0 && !hasScrolledForKeyboard) {
              hasScrolledForKeyboard = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (scrollController.hasClients) {
                  scrollController.animateTo(
                    scrollController.position.maxScrollExtent,
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                }
              });
            } else if (bottomInset == 0) {
              hasScrolledForKeyboard = false;
            }
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.85,
              ),
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle bar
                  Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Row(
                      children: [
                        Text(
                          'Sipariş Özeti',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        const Spacer(),
                        IconButton(
                          onPressed: () => Navigator.pop(ctx),
                          icon: Icon(Icons.close, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  // Scrollable content
                  Flexible(
                    child: GestureDetector(
                      onTap: () => FocusScope.of(ctx).unfocus(),
                      child: SingleChildScrollView(
                      controller: scrollController,
                      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomInset),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 📍 DELIVERY ADDRESS (only for delivery — not pickup or dine-in)
                          if (!_isPickUp && !_isDineIn) ...[
                            _buildCheckoutSectionHeader('📍', 'Teslimat Adresi'),
                            const SizedBox(height: 8),
                            FutureBuilder<DocumentSnapshot>(
                              future: FirebaseFirestore.instance
                                  .collection('users')
                                  .doc(firebaseUser?.uid ?? authState.appUser?.uid)
                                  .get(),
                              builder: (context, snapshot) {
                                if (snapshot.connectionState == ConnectionState.waiting) {
                                  return Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                                  );
                                }
                                final userData = snapshot.data?.data() as Map<String, dynamic>?;
                                final street = userData?['address'] ?? '';
                                final houseNumber = userData?['houseNumber'] ?? '';
                                final postalCode = userData?['postalCode'] ?? '';
                                final city = userData?['city'] ?? '';
                                final streetFull = houseNumber.isNotEmpty ? '$street $houseNumber' : street;
                                final fullAddress = [streetFull, '$postalCode $city'].where((s) => s.trim().isNotEmpty).join(', ');
                                final hasAddress = fullAddress.trim().isNotEmpty && street.toString().trim().isNotEmpty;

                                return Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: hasAddress ? Colors.grey.shade300 : Colors.orange.shade300,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(
                                        hasAddress ? Icons.location_on : Icons.warning_amber_rounded,
                                        color: hasAddress ? _accentColor : Colors.orange,
                                        size: 22,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          hasAddress ? fullAddress : 'Adres bilgisi bulunamadı.\nProfil ayarlarından adres ekleyin.',
                                          style: TextStyle(
                                            color: hasAddress ? Theme.of(context).colorScheme.onSurface : Colors.orange.shade700,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ),
                                      if (hasAddress)
                                        Icon(Icons.check_circle, color: Colors.green, size: 20),
                                    ],
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 20),
                          ],

                          // 🏪 GEL AL / MASA info
                          if (_isPickUp || _isDineIn) ...[
                            _buildCheckoutSectionHeader(_isDineIn ? '🪑' : '🏪', _isDineIn ? 'Masada Sipariş' : 'Gel Al'),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey.shade300),
                              ),
                              child: Row(
                                children: [
                                  Icon(_isDineIn ? Icons.restaurant : Icons.store, color: _accentColor, size: 22),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _butcherData?['companyName'] ?? cart.butcherName ?? 'İşletme',
                                      style: TextStyle(
                                        color: Theme.of(context).colorScheme.onSurface,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                  Icon(Icons.check_circle, color: Colors.green, size: 20),
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                          ],

                          // 💳 PAYMENT METHOD
                          _buildCheckoutSectionHeader('💳', 'Ödeme Yöntemi'),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () {
                                      setSheetState(() {});
                                      setState(() => _paymentMethod = 'cash');
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      decoration: BoxDecoration(
                                        color: _paymentMethod == 'cash' ? _accentColor : Colors.transparent,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            (_isPickUp || _isDineIn) ? Icons.store_outlined : Icons.payments_outlined,
                                            size: 18,
                                            color: _paymentMethod == 'cash' ? Colors.white : Colors.grey[600],
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            (_isPickUp || _isDineIn) ? 'İşletmede Öde' : 'Kapıda Nakit',
                                            style: TextStyle(
                                              color: _paymentMethod == 'cash' ? Colors.white : Theme.of(context).colorScheme.onSurface,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 13,
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
                                      setSheetState(() {});
                                      setState(() => _paymentMethod = 'card');
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      decoration: BoxDecoration(
                                        color: _paymentMethod == 'card' ? _accentColor : Colors.transparent,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Icons.credit_card,
                                            size: 18,
                                            color: _paymentMethod == 'card' ? Colors.white : Colors.grey[600],
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            'Kart ile',
                                            style: TextStyle(
                                              color: _paymentMethod == 'card' ? Colors.white : Theme.of(context).colorScheme.onSurface,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Payment methods info row (animated)
                          AnimatedSize(
                            duration: const Duration(milliseconds: 250),
                            curve: Curves.easeInOut,
                            child: _paymentMethod == 'card'
                                ? Padding(
                                    padding: const EdgeInsets.only(top: 10),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                      decoration: BoxDecoration(
                                        color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: Colors.grey.shade200),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(Icons.info_outline, size: 16, color: Colors.grey[500]),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              'Apple Pay · Google Pay · Visa · Mastercard',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600],
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                : const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 20),

                          // 🛒 ORDER ITEMS
                          _buildCheckoutSectionHeader('🛒', 'Sipariş Detayı'),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            child: Column(
                              children: [
                                ...cart.items.map((item) => Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Row(
                                    children: [
                                      Text(
                                        '${item.quantity}x',
                                        style: TextStyle(
                                          color: _accentColor,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          item.product.name,
                                          style: TextStyle(
                                            color: Theme.of(context).colorScheme.onSurface,
                                            fontSize: 14,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        '${item.totalPrice.toStringAsFixed(2)} €',
                                        style: TextStyle(
                                          color: Theme.of(context).colorScheme.onSurface,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ],
                                  ),
                                )),
                                const Divider(),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('Ara Toplam', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                    Text('${total.toStringAsFixed(2)} €', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 13)),
                                  ],
                                ),
                                if (!_isPickUp && !_isDineIn) ...[
                                  const SizedBox(height: 4),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('Teslimat Ücreti', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                      Text('${deliveryFee.toStringAsFixed(2)} €', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 13)),
                                    ],
                                  ),
                                ],
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('Toplam', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.bold, fontSize: 16)),
                                    Text('${grandTotal.toStringAsFixed(2)} €', style: TextStyle(color: _accentColor, fontWeight: FontWeight.bold, fontSize: 16)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),

                          // 📝 ORDER NOTE
                          _buildCheckoutSectionHeader('📝', 'Sipariş Notu (opsiyonel)'),
                          const SizedBox(height: 8),
                          TextField(
                            controller: noteController,
                            maxLines: 3,
                            minLines: 2,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => FocusScope.of(ctx).unfocus(),
                            decoration: InputDecoration(
                              hintText: 'Ör: Kapı zili çalışmıyor, lütfen arayın…',
                              hintStyle: TextStyle(color: Colors.grey[500], fontSize: 13),
                              filled: true,
                              fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: Colors.grey.shade300),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: Colors.grey.shade300),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: _accentColor),
                              ),
                              contentPadding: const EdgeInsets.all(14),
                            ),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                    ),
                  ),
                  // Bottom button
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                    decoration: BoxDecoration(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 10,
                          offset: const Offset(0, -4),
                        ),
                      ],
                    ),
                    child: GestureDetector(
                      onTap: _isSubmitting ? null : () {
                        _orderNote = noteController.text;
                        Navigator.pop(ctx);
                        _submitOrder();
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        decoration: BoxDecoration(
                          color: _isSubmitting ? Colors.grey : _accentColor,
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: _accentColor.withOpacity(0.3),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Center(
                          child: _isSubmitting
                              ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                              : Text(
                                  'Siparişi Gönder · ${grandTotal.toStringAsFixed(2)} €',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ),
                ],
               ),
            );
           },
         );
       },
     );
   }

  /// Section header helper for checkout sheet
  Widget _buildCheckoutSectionHeader(String emoji, String title) {
    return Row(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 16)),
        const SizedBox(width: 6),
        Text(
          title,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
      ],
    );
  }

  // 🎨 LIEFERANDO-STYLE: Minimalist delivery info bar
  Widget _buildDeliveryToggle() {
    final deliveryFee = _butcherData?['deliveryFee'] as num?;
    final estimatedTime = _butcherData?['deliveryTime'] ?? '20-35';
    
    return GestureDetector(
      onTap: () {
        // Toggle between pickup and delivery (not for dine-in; dine-in uses 3-tab bar)
        if (_isDineIn) return;
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
              _isDineIn ? Icons.restaurant : (_isPickUp ? Icons.store_outlined : Icons.local_shipping_outlined),
              color: _accentColor, // 🎨 BRAND COLOUR
              size: 20,
            ),
            SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _isDineIn ? 'Masa' : (_isPickUp ? 'Gel Al' : 'Kurye'),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                Text(
                  _isDineIn ? 'Masada Sipariş' : (_isPickUp ? '15-20 Dk.' : '$estimatedTime Dk.'),
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const Spacer(),
            if (!_isPickUp && !_isDineIn && deliveryFee != null)
              Text(
                '+${deliveryFee.toStringAsFixed(2)} €',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 13,
                ),
              ),
            SizedBox(width: 8),
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
            _isDineIn ? 'Sipariş Zamanı' : (_isPickUp ? 'Gel Al Zamanı' : 'Teslimat Zamanı'),
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 12),
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
                        SizedBox(width: 8),
                        Text(
                          DateFormat('dd MMM').format(_selectedDate),
                          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(width: 12),
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
                        SizedBox(width: 8),
                        Text(
                          _selectedTime.format(context),
                          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
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
            SizedBox(width: 12),
            Text(
              methodLabel,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
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
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
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
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
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
                  child: Icon(
                    Icons.add,
                    color: Theme.of(context).colorScheme.onSurface,
                    size: 20,
                  ),
                ),
              ),
              
              SizedBox(width: 12),
              
              // Price
              SizedBox(
                width: 64,
                child: Text(
                  '${totalPrice.toStringAsFixed(2)} €',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
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
