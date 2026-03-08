import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/cupertino.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../../utils/i18n_utils.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:google_places_flutter/google_places_flutter.dart';
import 'package:google_places_flutter/model/prediction.dart';
import 'package:geocoding/geocoding.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/providers/auth_provider.dart';
import 'package:lokma_app/models/butcher_product.dart';
import 'package:lokma_app/widgets/order_confirmation_dialog.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:lokma_app/services/fcm_service.dart';
import 'package:lokma_app/services/order_service.dart';
import 'package:lokma_app/services/table_group_service.dart';
import 'package:lokma_app/services/table_session_service.dart';
import 'package:lokma_app/providers/table_group_provider.dart';
import 'package:lokma_app/screens/customer/group_table_order_screen.dart';
import 'package:lokma_app/screens/orders/rating_screen.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:lokma_app/screens/marketplace/kasap/product_customization_sheet.dart';
import 'package:lokma_app/models/product_option.dart';
import '../../../utils/currency_utils.dart';
import '../../../services/stripe_payment_service.dart';
import '../../../services/coupon_service.dart';
import '../../../services/first_order_service.dart';

class CartScreen extends ConsumerStatefulWidget {
  final bool initialPickUp;
  final bool initialDineIn;
  final String? initialTableNumber;
  final int initialTab;
  const CartScreen({super.key, this.initialPickUp = false, this.initialDineIn = false, this.initialTableNumber, this.initialTab = 0});

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
  final TextEditingController _tableNumberController = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = TimeOfDay.now();
  Map<String, dynamic>? _butcherData;
  bool _loadingButcherParams = true;
  bool _isSubmitting = false;
  OpeningHoursHelper? _hoursHelper;
  String _orderNote = '';
  DateTime? _selectedPickupSlot; // 🆕 Selected pickup time for Gel Al
  DateTime? _scheduledDeliverySlot; // 🆕 Scheduled delivery time for Kurye (null = ASAP)
  bool _scheduledInfoDismissed = false; // 🆕 Info note dismiss state

  // 🌟 Sponsored Products ("Bir şey mi unuttun?")
  List<Map<String, dynamic>> _sponsoredProductsList = [];
  bool _loadingSponsoredProducts = false;
  final Set<String> _sponsoredItemIds = {}; // Track IDs added from sponsored section

  // 🥤 Gratis İçecek (Free Drink Promotion)
  List<Map<String, dynamic>> _freeDrinkProducts = [];
  bool _loadingFreeDrinks = false;

  // 📦 Item Unavailability Preferences ("Falls Artikel nicht verfügbar")
  String _unavailabilityPreference = 'refund'; // 'substitute' | 'refund' | 'perItem'
  final Map<String, String> _perItemPreferences = {}; // productId → 'substitute' | 'refund'

  // 📍 Delivery Address Management
  Map<String, String>? _selectedDeliveryAddress; // null = use profile default

  // 🎟️ Coupon/Promo Code
  final CouponService _couponService = CouponService();
  CouponResult? _appliedCoupon;
  bool _isValidatingCoupon = false;

  // 💰 Wallet Balance
  double _walletBalance = 0.0;
  bool _useWallet = false;

  // ❄️ Cold Chain Banner
  bool _showColdChainBanner = false; // true = show full expanded banner

  /// 🎨 BRAND COLOUR - Dynamic resolution per Design System Protocol
  Color get _accentColor {
    final brandColorHex = _butcherData?['brandColor']?.toString();
    if (brandColorHex != null && brandColorHex.isNotEmpty) {
      // Strip '#' and prepend 'FF' for alpha
      final hex = brandColorHex.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    }
    // Fallback to LOKMA Rose-500
    return const Color(0xFFFB335B);
  }

  @override
  void initState() {
    super.initState();
    _isPickUp = widget.initialPickUp;
    _isDineIn = widget.initialDineIn;
    // Auto-set table number from deep link (QR code on table)
    if (widget.initialTableNumber != null) {
      _scannedTableNumber = widget.initialTableNumber;
      _isDineIn = true;
      _isPickUp = false;
      _paymentMethod = 'payLater';
    }
    // If dine-in, ensure pickup is false
    if (_isDineIn) {
      _isPickUp = false;
      _paymentMethod = 'payLater'; // Default for dine-in
    }
    _tabController = TabController(length: 2, vsync: this, initialIndex: widget.initialTab.clamp(0, 1));
    _checkColdChainBanner();
    
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
      _fetchSponsoredProducts();
      _fetchFreeDrinkProducts();
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
          // If dine-in and business requires payFirst, reset payment method
          if (_isDineIn && data?['dineInPaymentMode'] == 'payFirst' && _paymentMethod == 'payLater') {
            _paymentMethod = 'cash';
          }
        });
      }
    } catch (e) {
      debugPrint('Error fetching butcher details: $e');
      if (mounted) setState(() => _loadingButcherParams = false);
    }
  }

  /// 🌟 Fetch sponsored products for the current business
  Future<void> _fetchSponsoredProducts() async {
    final cart = ref.read(cartProvider);
    final butcherId = cart.butcherId;
    if (butcherId == null) return;

    setState(() => _loadingSponsoredProducts = true);

    try {
      final businessDoc = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(butcherId)
          .get();

      if (!businessDoc.exists) return;
      final businessData = businessDoc.data();
      final List<dynamic> sponsoredIds = businessData?['sponsoredProducts'] ?? [];

      if (sponsoredIds.isEmpty) {
        if (mounted) setState(() => _loadingSponsoredProducts = false);
        return;
      }

      final List<Map<String, dynamic>> fetchedProducts = [];
      for (final productId in sponsoredIds) {
        try {
          final productDoc = await FirebaseFirestore.instance
              .collection('businesses')
              .doc(butcherId)
              .collection('products')
              .doc(productId.toString())
              .get();

          if (productDoc.exists) {
            final pData = productDoc.data()!;
            if (pData['isActive'] != false && pData['isAvailable'] != false) {
              fetchedProducts.add({
                'id': productDoc.id,
                'name': pData['name'] ?? '',
                'nameData': pData['name'],
                'price': (pData['price'] ?? 0).toDouble(),
                'unit': pData['unit'] ?? 'adet',
                'imageUrl': pData['imageUrl'] ?? '',
                'category': pData['category'] ?? '',
                'categoryData': pData['category'],
                'descriptionData': pData['description'],
              });
            }
          }
        } catch (e) {
          debugPrint('Error fetching sponsored product $productId: $e');
        }
      }

      final cartItemIds = cart.items.map((i) => i.product.id).toSet();
      final filtered = fetchedProducts.where((p) => !cartItemIds.contains(p['id'])).toList();

      if (mounted) {
        setState(() {
          _sponsoredProductsList = filtered;
          _loadingSponsoredProducts = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching sponsored products: $e');
      if (mounted) setState(() => _loadingSponsoredProducts = false);
    }
  }

  /// 🥤 Fetch drink-category products for the free drink promotion
  Future<void> _fetchFreeDrinkProducts() async {
    final cart = ref.read(cartProvider);
    final butcherId = cart.butcherId;
    if (butcherId == null) return;

    setState(() => _loadingFreeDrinks = true);

    try {
      // Fetch all products for this business
      final productsSnap = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(butcherId)
          .collection('products')
          .where('isActive', isEqualTo: true)
          .get();

      // Known drink category identifiers (multi-language)
      const drinkCategories = [
        'içecek', 'icecek', 'İçecek', 'İçecekler',
        'getränke', 'Getränke', 'getraenke', 'Getraenke',
        'drinks', 'Drinks', 'beverage', 'Beverage', 'Beverages',
        'boissons', 'Boissons',
        'bebidas', 'Bebidas',
        'bibite', 'Bibite',
        'dranken', 'Dranken',
      ];

      final List<Map<String, dynamic>> drinks = [];
      for (final doc in productsSnap.docs) {
        final data = doc.data();

        // Skip unavailable or out-of-stock
        if (data['isAvailable'] == false || data['outOfStock'] == true) continue;

        // Check category (handle both string and localization map)
        final categoryRaw = data['category'];
        String categoryStr = '';
        if (categoryRaw is String) {
          categoryStr = categoryRaw;
        } else if (categoryRaw is Map) {
          // Try all language keys
          for (final v in categoryRaw.values) {
            if (v != null && drinkCategories.any((dc) => v.toString().toLowerCase() == dc.toLowerCase())) {
              categoryStr = v.toString();
              break;
            }
          }
          if (categoryStr.isEmpty) {
            categoryStr = (categoryRaw['tr'] ?? categoryRaw['de'] ?? categoryRaw.values.first ?? '').toString();
          }
        }

        // Match against known drink categories
        final isDrink = drinkCategories.any((dc) => categoryStr.toLowerCase() == dc.toLowerCase());
        if (!isDrink) continue;

        drinks.add({
          'id': doc.id,
          'name': data['name'] ?? '',
          'nameData': data['name'],
          'price': (data['sellingPrice'] ?? data['price'] ?? 0).toDouble(),
          'unit': data['unit'] ?? 'adet',
          'imageUrl': data['imageUrl'] ?? '',
          'category': categoryStr,
          'categoryData': data['category'],
          'descriptionData': data['description'],
          'masterProductSku': data['masterProductSku'] ?? doc.id,
          'masterId': data['masterId'] ?? '',
        });
      }

      // Filter out products already in cart
      final cartItemIds = cart.items.map((i) => i.product.id).toSet();
      final filtered = drinks.where((p) => !cartItemIds.contains(p['id'])).toList();

      if (mounted) {
        setState(() {
          _freeDrinkProducts = filtered;
          _loadingFreeDrinks = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching free drink products: $e');
      if (mounted) setState(() => _loadingFreeDrinks = false);
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
        const SnackBar(content: Text('cart.login_required')),
      );
      return;
    }

    if (cart.items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('cart.cart_empty')),
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

      final double deliveryFee = (!_isPickUp && !_isDineIn ? (_butcherData?['deliveryFee'] as num?)?.toDouble() ?? 2.50 : 0.0);
      final double couponDiscount = _appliedCoupon?.isValid == true ? (_appliedCoupon!.calculatedDiscount ?? 0) : 0.0;
      // First-order discount: check eligibility and apply
      final firstOrderDiscountObj = await FirstOrderService.checkDiscount(FirebaseAuth.instance.currentUser!.uid);
      final double firstOrderDiscount = firstOrderDiscountObj?.discountAmount ?? 0.0;
      final double subtotalAfterDiscounts = cart.totalAmount + deliveryFee - couponDiscount - firstOrderDiscount;
      // Apply wallet balance if enabled
      final double walletUsed = _useWallet ? (_walletBalance >= subtotalAfterDiscounts ? subtotalAfterDiscounts : _walletBalance) : 0.0;
      final double grandTotal = (subtotalAfterDiscounts - walletUsed).clamp(0.0, double.infinity);

      // Build order data
      // Use selected pickup slot for Gel Al, otherwise build from date/time
      final pickupDateTime = (_isPickUp && _selectedPickupSlot != null)
          ? _selectedPickupSlot!
          : DateTime(
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
          const SnackBar(content: Text('cart.user_info_error')),
        );
        return;
      }
      
      final userDisplayName = currentUser?.displayName ?? firebaseUser?.displayName ?? firebaseUser?.email ?? 'User';
      final userEmail = currentUser?.email ?? firebaseUser?.email ?? '';
      final userPhone = currentUser?.phoneNumber ?? firebaseUser?.phoneNumber ?? '';
      
      // Build full delivery address — prefer selected override, then Firestore profile
      String? userAddress;
      if (!_isPickUp && !_isDineIn) {
        if (_selectedDeliveryAddress != null) {
          // User selected a specific address in checkout
          final s = _selectedDeliveryAddress!;
          final streetPart = (s['houseNumber'] ?? '').isNotEmpty ? '${s['street']} ${s['houseNumber']}' : (s['street'] ?? '');
          userAddress = [streetPart, '${s['postalCode']} ${s['city']}'].where((p) => p.trim().isNotEmpty).join(', ');
        } else {
          try {
            final userDoc = await FirebaseFirestore.instance.collection('users').doc(userId).get();
            if (userDoc.exists) {
              final userData = userDoc.data()!;
              final street = userData['address'] ?? '';
              final houseNumber = userData['houseNumber'] ?? '';
              final postalCode = userData['postalCode'] ?? '';
              final city = userData['city'] ?? '';
              final streetPart = houseNumber.isNotEmpty ? '$street $houseNumber' : street;
              userAddress = [streetPart, '$postalCode $city'].where((s) => s.trim().isNotEmpty).join(', ');
            }
          } catch (e) {
            debugPrint('Error fetching user address: $e');
            userAddress = currentUser?.address;
          }
        }
      }

      // For dine-in orders, find or create a table session so the order appears in staff hub
      String? tableSessionId;
      if (_isDineIn && cart.butcherId != null) {
        final tableNumStr = _scannedTableNumber ?? _tableNumberController.text.trim();
        final tableNum = int.tryParse(tableNumStr);
        if (tableNum != null && tableNum > 0) {
          try {
            final sessionService = TableSessionService();
            var session = await sessionService.getActiveSession(cart.butcherId!, tableNum);
            session ??= await sessionService.createSession(
                businessId: cart.butcherId!,
                tableNumber: tableNum,
                waiterId: userId,
                waiterName: 'Müşteri ($userDisplayName)',
              );
            tableSessionId = session.id;
          } catch (e) {
            debugPrint('Error finding/creating table session: $e');
          }
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
        'items': cart.items.asMap().entries.map((entry) {
          final item = entry.value;
          final positionNumber = entry.key + 1;
          return {
          'productId': item.product.id,
          'productName': item.product.name,
          'quantity': item.quantity,
          'unit': item.product.unitType,
          'unitPrice': item.product.price,
          'totalPrice': item.totalPrice,
          'imageUrl': item.product.imageUrl,
          'positionNumber': positionNumber,
          // 🥤 Free Drink Promotion
          if (item.isFreeDrink) 'isFreeDrink': true,
          if (item.isFreeDrink) 'originalPrice': item.originalPrice,
          if (item.note != null && item.note!.trim().isNotEmpty) 'itemNote': item.note!.trim(),
          if (item.selectedOptions.isNotEmpty)
            'selectedOptions': item.selectedOptions.map((o) => {
              'groupId': o.groupId,
              'groupName': o.groupName,
              'optionId': o.optionId,
              'optionName': o.optionName,
              'priceModifier': o.priceModifier,
            }).toList(),
        };
        }).toList(),
        'totalAmount': cart.totalAmount,
        'deliveryMethod': _isDineIn ? 'dineIn' : (_isPickUp ? 'pickup' : 'delivery'),
        'pickupTime': (_isPickUp || _isDineIn) ? Timestamp.fromDate(pickupDateTime) : null,
        // 🆕 Scheduled Delivery
        if (_scheduledDeliverySlot != null && !_isPickUp && !_isDineIn) ...{
          'scheduledDeliveryTime': Timestamp.fromDate(_scheduledDeliverySlot!),
          'isScheduledOrder': true,
          'deliveryDate': Timestamp.fromDate(_scheduledDeliverySlot!),
          'scheduledDateTime': Timestamp.fromDate(_scheduledDeliverySlot!),
        },
        'deliveryAddress': (!_isPickUp && !_isDineIn) ? userAddress : null,
        'paymentMethod': _paymentMethod,
        'paymentStatus': _paymentMethod == 'payLater' ? 'payLater' : (_paymentMethod == 'card' ? 'pending' : 'paid'),
        'status': 'pending',
        if (_orderNote.trim().isNotEmpty) 'orderNote': _orderNote.trim(),
        if (_isDineIn && (_scannedTableNumber ?? _tableNumberController.text.trim()).isNotEmpty)
          'tableNumber': _scannedTableNumber ?? _tableNumberController.text.trim(),
        if (tableSessionId != null) 'tableSessionId': tableSessionId,
        // Sponsored product conversion tracking
        if (_sponsoredItemIds.isNotEmpty) 'sponsoredItemIds': _sponsoredItemIds.toList(),
        if (_sponsoredItemIds.isNotEmpty) 'hasSponsoredItems': true,
        // 🥤 Free Drink Promotion tracking
        if (cart.hasFreeDrink) 'hasFreeDrink': true,
        // Item unavailability preferences
        'unavailabilityPreference': _unavailabilityPreference,
        if (_unavailabilityPreference == 'perItem' && _perItemPreferences.isNotEmpty)
          'perItemPreferences': _perItemPreferences,
        // Coupon data
        if (_appliedCoupon?.isValid == true) ...{
          'couponCode': _appliedCoupon!.code,
          'couponId': _appliedCoupon!.couponId,
          'couponDiscount': _appliedCoupon!.calculatedDiscount,
          'couponDiscountType': _appliedCoupon!.discountType,
        },
        // First-order discount data
        if (firstOrderDiscount > 0) ...{
          'firstOrderDiscount': firstOrderDiscount,
          'firstOrderTier': firstOrderDiscountObj?.orderNumber,
        },
        // Wallet usage data
        if (walletUsed > 0) ...{
          'walletUsed': walletUsed,
        },
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      // Save order
      final orderRef = await FirebaseFirestore.instance.collection('meat_orders').add(orderData);

      // UOIP: Persist orderNumber using First-6-Digit standard for cross-platform consistency
      final orderNumber = orderRef.id.substring(0, 6).toUpperCase();
      await orderRef.update({'orderNumber': orderNumber});

      // Apply coupon usage tracking
      if (_appliedCoupon?.isValid == true && _appliedCoupon!.couponId != null) {
        await _couponService.applyCoupon(
          couponId: _appliedCoupon!.couponId!,
          orderId: orderRef.id,
          userId: userId,
        );
      }

      // Deduct wallet balance if used
      if (walletUsed > 0) {
        await FirebaseFirestore.instance.collection('users').doc(userId).set({
          'walletBalance': FieldValue.increment(-walletUsed),
        }, SetOptions(merge: true));
        // Record wallet transaction
        await FirebaseFirestore.instance.collection('users').doc(userId).collection('wallet_transactions').add({
          'type': 'order_payment',
          'amount': -walletUsed,
          'orderId': orderRef.id,
          'description': 'marketplace.payment_description'.tr(),
          'createdAt': FieldValue.serverTimestamp(),
        });
      }
      
      if (_paymentMethod == 'card') {
        if (mounted) Navigator.pop(context); // Close initial loading dialog before Stripe sheet

        final paymentResult = await StripePaymentService.processPayment(
          amount: grandTotal,
          businessId: cart.butcherId!,
          orderId: orderRef.id,
          customerEmail: userEmail.isNotEmpty ? userEmail : null,
        );

        if (!paymentResult.success) {
          if (!paymentResult.wasCancelled && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Ödeme hatası: ${paymentResult.error}')),
            );
          }
          await orderRef.update({'status': 'payment_failed', 'paymentStatus': 'failed'});
          if (mounted) setState(() => _isSubmitting = false);
          return; // Stop checkout flow
        }

        // Update payment success
        await orderRef.update({
          'paymentStatus': 'paid',
          if (paymentResult.paymentIntentId != null) 'paymentIntentId': paymentResult.paymentIntentId,
          if (paymentResult.feeBreakdown != null) 'feeBreakdown': paymentResult.feeBreakdown!.toMap(),
        });
      } else {
        if (mounted) Navigator.pop(context); // Close loading for non-card
      }

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
        SnackBar(content: Text('${'cart.order_error'.tr()}: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _pulseController.dispose();
    _tableNumberController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Force rebuild on language change
    context.locale;
    final cart = ref.watch(cartProvider);
    final kermesCart = ref.watch(kermesCartProvider);
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    
    // 🍊 LIEFERANDO-STYLE: Theme-aware background with tabs
    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        backgroundColor: colorScheme.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 38,
        leadingWidth: 56,
        leading: Padding(
          padding: const EdgeInsets.only(left: 4),
          child: IconButton(
            padding: const EdgeInsets.all(12),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            icon: Icon(Icons.arrow_back_ios_new_rounded, color: colorScheme.onSurface, size: 22),
            onPressed: () {
              HapticFeedback.lightImpact();
              if (GoRouter.of(context).canPop()) {
                context.pop();
              } else {
                context.go('/');
              }
            },
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFFB335B),
          indicatorWeight: 3,
          labelColor: colorScheme.onSurface,
          unselectedLabelColor: colorScheme.onSurface.withValues(alpha: 0.5),
          labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          tabs: [
            Tab(text: 'cart.my_cart'.tr()),
            Tab(text: 'cart.my_orders'.tr()),
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
              '${'common.error'.tr()}: ${snapshot.error}',
              style: TextStyle(color: Colors.red),
            ),
          );
        }
        
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Color(0xFFFB335B)));
        }
        
        final allOrders = snapshot.data ?? [];
        
        if (allOrders.isEmpty) {
          return _buildEmptyOrders('cart.no_orders'.tr(), Icons.receipt_long_outlined);
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
                        'cart.no_active_orders'.tr(),
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
                        '${'cart.past_orders'.tr()} (${completedOrders.length})',
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
            'cart.login_to_see_orders'.tr(),
            style: TextStyle(color: Colors.grey, fontSize: 16),
          ),
          SizedBox(height: 24),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFB335B),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
            ),
            onPressed: () => context.go('/profile'),
            child: Text('cart.login'.tr(), style: TextStyle(color: Theme.of(context).colorScheme.surface)),
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
            'cart.select_business'.tr(),
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
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: isDark ? 0.2 : 0.04),
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
                                        color: const Color(0xFFFB335B),
                                        borderRadius: const BorderRadius.only(
                                          bottomLeft: Radius.circular(12),
                                          bottomRight: Radius.circular(12),
                                        ),
                                      ),
                                      child: Text(
                                        'TUNA',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: Theme.of(context).colorScheme.surface,
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
                            color: colorScheme.onSurface.withValues(alpha: 0.5),
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
                          style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 13),
                        ),
                        SizedBox(height: 4),
                        // "Siparişi Görüntüle" link
                        Text(
                          'cart.view_order'.tr(),
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
                          '${order.items.length} ${'cart.items'.tr()} • ${CurrencyUtils.getCurrencySymbol()}${order.totalAmount.toStringAsFixed(2)}',
                          style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  // Status badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(order.status).withValues(alpha: 0.15),
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
                        'cart.rate'.tr(),
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
                        'cart.reorder'.tr(),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.surface,
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
                          '${'cart.order_date'.tr()} ${_formatDateFull(order.createdAt)}',
                          style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 14),
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
                            icon: Icon(Icons.star_border, color: Theme.of(context).colorScheme.surface, size: 20),
                            label: Text(
                              'cart.rate'.tr(),
                              style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 15, fontWeight: FontWeight.w600),
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
                              'cart.reorder'.tr(),
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
                          order.orderType == OrderType.delivery ? 'cart.delivery_address'.tr() : 'cart.pickup'.tr(),
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
                                style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.7), fontSize: 14),
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
                            icon: Icon(Icons.navigation_outlined, color: colorScheme.onSurface.withValues(alpha: 0.7), size: 18),
                            label: Text(
                              'cart.show_on_map'.tr(),
                              style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.7), fontSize: 14, fontWeight: FontWeight.w500),
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
                                    '${'orders.order_no'.tr()}: ${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                                    style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 13),
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
                                '${CurrencyUtils.getCurrencySymbol()}${(item.price * item.quantity).toStringAsFixed(2)}',
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
                              'cart.total_paid'.tr(),
                              style: TextStyle(
                                color: colorScheme.onSurface,
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              '${CurrencyUtils.getCurrencySymbol()}${order.totalAmount.toStringAsFixed(2)}',
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
                            'cart.view_receipt'.tr(),
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
                                    'cart.have_a_problem'.tr(),
                                    style: TextStyle(
                                      color: colorScheme.onSurface,
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'cart.helper_can_assist'.tr(),
                                    style: TextStyle(color: colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 13),
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
                                        'cart.start_chat'.tr(),
                                        style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 13, fontWeight: FontWeight.w600),
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
                                color: brandColor.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(40),
                              ),
                              child: Icon(Icons.support_agent, color: brandColor.withValues(alpha: 0.5), size: 40),
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
    // Provide a default color during initialization or if missing
    if (businessId.isEmpty) return const Color(0xFFFB335B);
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
    // Fallback if network icon doesn't contain a clear dominant color
    return const Color(0xFFFB335B); // Default LOKMA red
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
            content: Text('${'cart.map_error'.tr()}: $e'),
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
                          color: const Color(0xFF3E2723),
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
                      _buildReceiptRow('cart.order_no_label'.tr(), order.orderNumber ?? order.id.substring(0, 6).toUpperCase()),
                      SizedBox(height: 4),
                      _buildReceiptRow('cart.date'.tr(), DateFormat('dd.MM.yyyy').format(order.createdAt)),
                      SizedBox(height: 4),
                      _buildReceiptRow('cart.time'.tr(), DateFormat('HH:mm').format(order.createdAt)),
                      SizedBox(height: 4),
                      _buildReceiptRow('cart.type_label'.tr(), order.orderType == OrderType.delivery ? 'cart.type_delivery'.tr() : 'cart.type_pickup'.tr()),
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
                                color: const Color(0xFF3E2723),
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
                                color: const Color(0xFF3E2723),
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
                                color: const Color(0xFF3E2723),
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
                                  color: const Color(0xFF3E2723),
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
                                  color: const Color(0xFF3E2723),
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                            SizedBox(
                              width: 60,
                              child: Text(
                                '${CurrencyUtils.getCurrencySymbol()}${(item.price * item.quantity).toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: const Color(0xFF3E2723),
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
                              color: const Color(0xFF3E2723),
                            ),
                          ),
                          Text(
                            '${CurrencyUtils.getCurrencySymbol()}${order.totalAmount.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF3E2723),
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
                          color: const Color(0xFF3E2723),
                          letterSpacing: 2,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 8),
                      Text(
                        'marketplace.bon_appetit'.tr(),
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
                            color: const Color(0xFF3E2723),
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
                          color: const Color(0xFF3E2723),
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
            color: const Color(0xFF3E2723),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'Courier',
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF3E2723),
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
      case OrderStatus.served:
        return Icons.table_bar;
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
        return Colors.amber;
      case OrderStatus.accepted:
        return Colors.blue;
      case OrderStatus.preparing:
        return Colors.purple;
      case OrderStatus.ready:
        return Colors.green;
      case OrderStatus.served:
        return Colors.teal;
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
      case OrderStatus.served:
        return 'Servis Edildi';
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
  
  /// Tekrar Sipariş Ver - Add items to cart and navigate to cart
  void _reorder(LokmaOrder order) {
    final cartNotifier = ref.read(cartProvider.notifier);
    cartNotifier.clearCart();

    for (final item in order.items) {
      final product = ButcherProduct(
        butcherId: order.butcherId,
        id: item.sku,
        sku: item.sku,
        masterId: '',
        name: item.name,
        description: '',
        category: '',
        price: item.price,
        unitType: item.unit,
        imageUrl: item.imageUrl,
        minQuantity: item.unit == 'kg' ? 0.5 : 1.0,
        stepQuantity: item.unit == 'kg' ? 0.5 : 1.0,
      );

      final selectedOpts = item.selectedOptions
          .map((o) => SelectedOption.fromMap(o))
          .toList();

      cartNotifier.addToCart(
        product,
        item.quantity,
        order.butcherId,
        order.butcherName,
        selectedOptions: selectedOpts,
        note: item.itemNote,
      );
    }

    context.push('/cart');
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
              
              // ❄️ Cold Chain Banner (Kasap + Kurye only)
              if (hasKasap && _butcherData != null && !_isPickUp && !_isDineIn)
                _buildColdChainBanner(),
              
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
                  _buildLieferandoSectionHeader(
                    _butcherData!['companyName'] ?? 'Kasap',
                    subtitle: [
                      _butcherData!['postalCode']?.toString() ?? '',
                      _butcherData!['city']?.toString() ?? '',
                    ].where((s) => s.isNotEmpty).join(' '),
                  ),
                ...cart.items.asMap().entries.map((entry) => _buildLieferandoCartItem(entry.value, entry.key + 1)),
                SizedBox(height: 16),
              ],
              // ⭐ Sponsored Products ("Bir şey mi unuttun?")
              if (_sponsoredProductsList.isNotEmpty) ...[
                SizedBox(height: 8),
                _buildSponsoredProductsSection(),
                SizedBox(height: 16),
              ],

              // 🥤 Gratis İçecek (Free Drink Promotion)
              if (_freeDrinkProducts.isNotEmpty) ...[
                SizedBox(height: 8),
                _buildFreeDrinkSection(),
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
          color: Theme.of(context).colorScheme.surface,
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
    
    // Determine if this is a Market segment (no Masa option)
    // Mirror _extractBusinessType logic: check 'type' first, then 'types', then 'businessType'
    String bType = 'other';
    final typeField = _butcherData?['type'];
    if (typeField is String && typeField.isNotEmpty) {
      bType = typeField.toLowerCase();
    } else {
      final typesField = _butcherData?['types'];
      if (typesField is List && typesField.isNotEmpty) {
        bType = (typesField.first as String? ?? 'other').toLowerCase();
      } else {
        final businessType = _butcherData?['businessType'];
        if (businessType is String && businessType.isNotEmpty) {
          bType = businessType.toLowerCase();
        }
      }
    }
    const marketTypes = {'kasap', 'market', 'cicekci', 'aktar', 'eticaret', 'kuruyemis', 'balik', 'tursu', 'sarkuteri', 'petshop', 'kozmetik'};
    final isMarketSegment = marketTypes.contains(bType);
    
    if (isMarketSegment) {
      // Market: only Kurye + Gel Al (no Masa)
      return ThreeDimensionalPillTabBar(
        selectedIndex: _isPickUp ? 1 : 0,
        onTabSelected: (index) {
          setState(() {
            _isPickUp = index == 1;
            _isDineIn = false;
            if (_paymentMethod == 'payLater') _paymentMethod = 'cash';
          });
        },
        tabs: const [
          TabItem(title: 'Kurye', icon: Icons.delivery_dining),
          TabItem(title: 'Gel Al', icon: Icons.store_outlined),
        ],
      );
    }
    
    // 3D Switch for Kurye / Gel Al / Masa
    return ThreeDimensionalPillTabBar(
      selectedIndex: _isDineIn ? 2 : (_isPickUp ? 1 : 0), // Kurye=0, Gel Al=1, Masa=2
      onTabSelected: (index) {
        setState(() {
          _isPickUp = index == 1;
          _isDineIn = index == 2;
          if (_isDineIn) {
            // Respect business payment mode setting
            _paymentMethod = (_butcherData?['dineInPaymentMode'] == 'payFirst') ? 'cash' : 'payLater';
          } else {
            _scannedTableNumber = null; // Reset QR on mode switch
            _tableNumberController.clear();
            if (_paymentMethod == 'payLater') _paymentMethod = 'cash';
          }
        });
      },
      tabs: const [
        TabItem(title: 'Kurye', icon: Icons.delivery_dining), // LEFT
        TabItem(title: 'Gel Al', icon: Icons.store_outlined), // MIDDLE
        TabItem(title: 'Masa', icon: Icons.restaurant),       // RIGHT
      ],
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ❄️ COLD CHAIN INFO BANNER
  // ═══════════════════════════════════════════════════════════════════════════
  
  /// Check SharedPreferences if user has seen the cold chain banner before
  Future<void> _checkColdChainBanner() async {
    final prefs = await SharedPreferences.getInstance();
    final hasSeen = prefs.getBool('cold_chain_banner_seen') ?? false;
    if (mounted) {
      setState(() {
        _showColdChainBanner = !hasSeen; // Show full banner if never seen
      });
    }
  }
  
  /// Mark cold chain banner as seen
  Future<void> _dismissColdChainBanner() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('cold_chain_banner_seen', true);
    if (mounted) {
      setState(() {
        _showColdChainBanner = false;
      });
    }
  }
  
  /// Show cold chain info as a bottom sheet dialog
  void _showColdChainInfoSheet() {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A2332) : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: const Color(0xFF4FC3F7).withValues(alpha: 0.4),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Icon
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF4FC3F7).withValues(alpha: 0.2),
                      const Color(0xFF0288D1).withValues(alpha: 0.1),
                    ],
                  ),
                  shape: BoxShape.circle,
                ),
                child: const Text('❄️', style: TextStyle(fontSize: 32)),
              ),
              const SizedBox(height: 16),
              Text(
                'Soğuk Zincir Garantisi',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Et ürünlerimiz max. hızda size ulaşabilecek şekilde soğuk zinciri kırılmadan özel korumalı boxlarda ulaştırılır.\n\nTeslimat süresince ürünleriniz soğuk kalır ve tazeliğini korur.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: isDark ? Colors.grey[300] : Colors.grey[700],
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4FC3F7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Anladım', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
  
  /// Build the cold chain banner widget
  Widget _buildColdChainBanner() {
    // Only show for kasap-type businesses
    final bType = _butcherData?['type']?.toString().toLowerCase() ?? 
                  _butcherData?['businessType']?.toString().toLowerCase() ?? '';
    final isKasap = bType == 'kasap';
    if (!isKasap) return const SizedBox.shrink();
    
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Show full expanded banner (first time)
    if (_showColdChainBanner) {
      return Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey[100],
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFF4FC3F7).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Center(child: Text('❄️', style: TextStyle(fontSize: 16))),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Soğuk Zincir Garantisi',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'marketplace.cold_chain_short_desc'.tr(),
                    style: TextStyle(
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 11.5,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            GestureDetector(
              onTap: _dismissColdChainBanner,
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: Icon(
                  Icons.close_rounded,
                  color: isDark ? Colors.grey[500] : Colors.grey[400],
                  size: 16,
                ),
              ),
            ),
          ],
        ),
      );
    }
    
    // Show collapsed ❄️ inline pill (after dismissal)
    return GestureDetector(
      onTap: _showColdChainInfoSheet,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey[100],
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('❄️', style: TextStyle(fontSize: 13)),
            const SizedBox(width: 6),
            Text(
              'Soğuk Zincir',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.info_outline_rounded,
              color: isDark ? Colors.grey[500] : Colors.grey[400],
              size: 13,
            ),
          ],
        ),
      ),
    );
  }
  
  /// 🟡 Lieferando-style minimum order bar (yellow warning or green success)
  Widget _buildLieferandoMinimumBar(double currentTotal) {
    final minOrder = (_butcherData?['minOrderAmount'] as num?)?.toDouble() ?? 10.0;
    final remaining = minOrder - currentTotal;
    final isReached = remaining <= 0;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    if (isReached) {
      // ✅ SUCCESS: Minimum reached — hide the banner entirely to save space
      return const SizedBox.shrink();
    }
    
    // 🟡 WARNING: Below minimum
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFFFFD54F).withValues(alpha: 0.10) : const Color(0xFFFFF9C4),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, 
            color: isDark ? const Color(0xFFFFD54F) : const Color(0xFFF9A825), 
            size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(
                  color: isDark ? const Color(0xFFFFD54F) : const Color(0xFF5D4037), 
                  fontSize: 13,
                ),
                children: [
                  TextSpan(
                    text: '${remaining.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const TextSpan(text: ' daha ekle, min. sipariş '),
                  TextSpan(
                    text: '${minOrder.toStringAsFixed(0)} ${CurrencyUtils.getCurrencySymbol()}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
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
  Widget _buildLieferandoSectionHeader(String title, {String? subtitle}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (subtitle != null && subtitle.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                subtitle,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ),
        ],
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
                      '${item.totalPrice.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
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
  
  /// 🥩 Cart item — Reference design: Icon | Name + Qty | Price + Delete
  Widget _buildLieferandoCartItem(CartItem item, int positionNumber) {
    final productName = I18nUtils.getLocalizedText(context, item.product.nameData);
    final quantity = item.quantity;
    final totalPrice = item.totalPrice;
    final unitType = item.product.unitType.toLowerCase();
    final isKg = unitType == 'kg';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Quantity display text
    final qtyText = isKg 
        ? '${(quantity * 1000).toInt()}g'
        : '${quantity.toInt()}';
    
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: Row(
        children: [
          // LEFT: Category icon
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[100],
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.restaurant_menu,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          // CENTER: Name + Quantity controls
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
                // Selected options (if any)
                if (item.selectedOptions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      item.selectedOptions.map((o) => o.optionName).join(', '),
                      style: TextStyle(color: Colors.grey[500], fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                // Per-item note display / add button
                GestureDetector(
                  onTap: () => _showNoteDialog(item),
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          item.note != null && item.note!.isNotEmpty
                              ? Icons.edit_note
                              : Icons.note_add_outlined,
                          size: 14,
                          color: item.note != null && item.note!.isNotEmpty
                              ? const Color(0xFFFB335B)
                              : Colors.grey[500],
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            item.note != null && item.note!.isNotEmpty
                                ? item.note!
                                : 'Not ekle',
                            style: TextStyle(
                              fontSize: 11,
                              color: item.note != null && item.note!.isNotEmpty
                                  ? (isDark ? Colors.grey[300] : Colors.grey[700])
                                  : Colors.grey[500],
                              fontStyle: item.note != null && item.note!.isNotEmpty
                                  ? FontStyle.normal
                                  : FontStyle.italic,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Quantity controls: [—]  qty  [+]
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // MINUS button (dark)
                    GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        final step = isKg ? 0.5 : 1.0;
                        final minQty = isKg ? 0.5 : 1.0;
                        if (quantity > minQty) {
                          ref.read(cartProvider.notifier).updateQuantity(item.uniqueKey, quantity - step);
                        } else {
                          ref.read(cartProvider.notifier).removeFromCart(item.uniqueKey);
                        }
                      },
                      child: Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: isDark ? Colors.grey[800] : Colors.grey[900],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        alignment: Alignment.center,
                        child: Icon(Icons.remove, color: Colors.white, size: 16),
                      ),
                    ),
                    // Quantity text
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        qtyText,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    // PLUS button (accent red)
                    GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        ref.read(cartProvider.notifier).updateQuantity(
                          item.uniqueKey,
                          isKg ? quantity + 0.5 : quantity + 1,
                        );
                      },
                      child: Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFB335B),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        alignment: Alignment.center,
                        child: const Icon(Icons.add, color: Colors.white, size: 16),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // RIGHT: Price + Delete icon
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${totalPrice.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () {
                  HapticFeedback.mediumImpact();
                  ref.read(cartProvider.notifier).removeFromCart(item.uniqueKey);
                },
                child: Icon(
                  Icons.delete_outline,
                  color: isDark ? Colors.grey[500] : Colors.grey[400],
                  size: 22,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 📝 Note dialog for a specific cart item
  void _showNoteDialog(CartItem item) {
    final controller = TextEditingController(text: item.note ?? '');
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Ürün Notu',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w600,
          ),
        ),
        content: TextField(
          controller: controller,
          maxLength: 40,
          autofocus: true,
          style: TextStyle(color: isDark ? Colors.white : Colors.black87),
          decoration: InputDecoration(
            hintText: 'Ör: Hasan Usta, Marulsuz...',
            hintStyle: TextStyle(color: Colors.grey[500]),
            filled: true,
            fillColor: isDark ? const Color(0xFF2A2A2A) : Colors.grey[100],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            counterStyle: TextStyle(color: Colors.grey[500]),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              ref.read(cartProvider.notifier).updateNote(item.uniqueKey, null);
              Navigator.pop(ctx);
            },
            child: Text('Sil', style: TextStyle(color: Colors.red[400])),
          ),
          FilledButton(
            onPressed: () {
              ref.read(cartProvider.notifier).updateNote(item.uniqueKey, controller.text);
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(
              backgroundColor: Color(0xFFFB335B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text('Kaydet', style: TextStyle(color: Theme.of(context).colorScheme.surface)),
          ),
        ],
      ),
    );
  }
  
  /// ⭐ Sponsored Products — "Bir şey mi unuttun?" (Lieferando "Gesponsert" style)
  Widget _buildSponsoredProductsSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cart = ref.read(cartProvider);
    final butcherId = cart.butcherId ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header — Lieferando style
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Text(
                'marketplace.forgot_something_de'.tr(),
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              Spacer(),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.transparent,
                ),
                child: Text(
                  'Gesponsert',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.grey[400] : Colors.grey[500],
                  ),
                ),
              ),
            ],
          ),
        ),

        // Horizontal Product Cards — Lieferando layout
        SizedBox(
          height: 200,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _sponsoredProductsList.length,
            separatorBuilder: (_, __) => SizedBox(width: 12),
            itemBuilder: (context, index) {
              final product = _sponsoredProductsList[index];
              final nameRaw = product['name'];
              final name = nameRaw is String ? nameRaw : (nameRaw is Map ? (nameRaw['tr'] ?? nameRaw.values.first ?? '').toString() : '');
              final price = (product['price'] ?? 0) is double ? product['price'] as double : (product['price'] ?? 0).toDouble();
              final unit = (product['unit'] ?? 'adet').toString();
              final imageUrl = (product['imageUrl'] ?? '').toString();

              return Container(
                width: 145,
                decoration: BoxDecoration(
                  color: isDark ? Color(0xFF1E1E1E) : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.06),
                      blurRadius: 10,
                      offset: Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Product Image with + overlay button (Lieferando style)
                    Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
                          child: imageUrl.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: imageUrl,
                                  width: 145,
                                  height: 100,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => Container(
                                    width: 145,
                                    height: 100,
                                    color: isDark ? Colors.grey[800] : Colors.grey[100],
                                    child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28),
                                  ),
                                  errorWidget: (_, __, ___) => Container(
                                    width: 145,
                                    height: 100,
                                    color: isDark ? Colors.grey[800] : Colors.grey[100],
                                    child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28),
                                  ),
                                )
                              : Container(
                                  width: 145,
                                  height: 100,
                                  color: isDark ? Colors.grey[800] : Colors.grey[100],
                                  child: Icon(Icons.restaurant, color: Colors.grey[400], size: 28),
                                ),
                        ),
                        // + button overlay on top-right of image
                        Positioned(
                          top: 6,
                          right: 6,
                          child: GestureDetector(
                            onTap: () => _addSponsoredProduct(product, index, butcherId),
                            child: Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(
                                color: _accentColor,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 4,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Icon(Icons.add, color: Colors.white, size: 18),
                            ),
                          ),
                        ),
                      ],
                    ),
                    // Product Info
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(10, 8, 10, 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isDark ? Colors.white : Colors.black87,
                                height: 1.2,
                              ),
                            ),
                            Spacer(),
                            Text(
                              '${price.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            if (unit.isNotEmpty && unit != 'adet')
                              Text(
                                '/$unit',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.grey[500],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  /// Helper: Add a sponsored product to cart
  void _addSponsoredProduct(Map<String, dynamic> product, int index, String butcherId) {
    HapticFeedback.lightImpact();
    final name = product['name'] is String ? product['name'] as String : (product['name'] is Map ? (product['name']['tr'] ?? product['name'].values.first ?? '').toString() : '');
    final price = product['price'] as double;
    final unit = product['unit'] as String;
    final imageUrl = product['imageUrl'] as String;

    final butcherProduct = ButcherProduct(
      id: product['id'] as String,
      name: name,
      nameData: product['nameData'] ?? product['name'],
      price: price,
      unitType: unit,
      imageUrl: imageUrl,
      category: product['category'] is String ? product['category'] as String : '',
      categoryData: product['categoryData'],
      descriptionData: product['descriptionData'],
      butcherId: butcherId,
      sku: product['id'] as String,
      masterId: '',
      description: '',
      inStock: true,
    );
    ref.read(cartProvider.notifier).addToCart(
      butcherProduct,
      1,
      butcherId,
      _butcherData?['companyName'] ?? '',
    );

    // Track this product as a sponsored conversion
    _sponsoredItemIds.add(product['id'] as String);

    // Remove from sponsored list
    setState(() {
      _sponsoredProductsList.removeAt(index);
    });

    // Haptic feedback
    HapticFeedback.lightImpact();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$name sepete eklendi ⭐'),
        duration: Duration(seconds: 2),
        backgroundColor: _accentColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  /// 🥤 FREE DRINK SECTION — "Her siparişe 1 içecek bedava!"
  Widget _buildFreeDrinkSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cart = ref.read(cartProvider);
    final butcherId = cart.butcherId ?? '';
    final hasFreeDrink = cart.hasFreeDrink;
    final locale = context.locale.languageCode;

    // Localized strings
    final titleMap = {
      'tr': '🎁 1 İçecek Bedava!',
      'de': '🎁 1 Getränk Gratis!',
      'en': '🎁 1 Free Drink!',
      'es': '🎁 1 Bebida Gratis!',
      'fr': '🎁 1 Boisson Gratuite!',
      'it': '🎁 1 Bibita Gratis!',
      'nl': '🎁 1 Drankje Gratis!',
    };
    final subtitleMap = {
      'tr': 'Aşağıdaki içeceklerden birini seç',
      'de': 'Wähle ein Getränk aus',
      'en': 'Choose one of the drinks below',
      'es': 'Elige una bebida',
      'fr': 'Choisissez une boisson',
      'it': 'Scegli una bibita',
      'nl': 'Kies een drankje',
    };
    final selectedMap = {
      'tr': '✅ İçecek seçildi',
      'de': '✅ Getränk ausgewählt',
      'en': '✅ Drink selected',
      'es': '✅ Bebida seleccionada',
      'fr': '✅ Boisson sélectionnée',
      'it': '✅ Bibita selezionata',
      'nl': '✅ Drankje geselecteerd',
    };
    final changeMap = {
      'tr': 'Değiştirmek için başka bir içecek seç',
      'de': 'Wähle ein anderes Getränk zum Ändern',
      'en': 'Select another drink to change',
      'es': 'Selecciona otra bebida para cambiar',
      'fr': 'Sélectionnez une autre boisson pour changer',
      'it': 'Seleziona un\'altra bibita per cambiare',
      'nl': 'Selecteer een ander drankje om te wijzigen',
    };

    final title = titleMap[locale] ?? titleMap['de']!;
    final subtitle = hasFreeDrink
        ? (selectedMap[locale] ?? selectedMap['de']!)
        : (subtitleMap[locale] ?? subtitleMap['de']!);
    final changeText = changeMap[locale] ?? changeMap['de']!;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF065F46).withValues(alpha: isDark ? 0.6 : 0.15),
            Color(0xFF0D9488).withValues(alpha: isDark ? 0.4 : 0.10),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Color(0xFF10B981).withValues(alpha: isDark ? 0.4 : 0.3),
          width: 1.5,
        ),
      ),
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with gift icon and title
          Row(
            children: [
              // Animated gift icon
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF10B981), Color(0xFF059669)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0xFF10B981).withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Text('🎁', style: TextStyle(fontSize: 22)),
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: isDark ? Colors.white : Color(0xFF064E3B),
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: hasFreeDrink ? FontWeight.w600 : FontWeight.w500,
                        color: hasFreeDrink
                            ? Color(0xFF10B981)
                            : (isDark ? Colors.white60 : Color(0xFF065F46)),
                      ),
                    ),
                  ],
                ),
              ),
              // GRATIS pill badge
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF10B981), Color(0xFF059669)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0xFF10B981).withValues(alpha: 0.3),
                      blurRadius: 8,
                    ),
                  ],
                ),
                child: Text(
                  'GRATIS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ],
          ),

          SizedBox(height: 14),

          // Horizontal scrolling drink cards
          SizedBox(
            height: 160,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _freeDrinkProducts.length,
              separatorBuilder: (_, __) => SizedBox(width: 10),
              itemBuilder: (context, index) {
                final product = _freeDrinkProducts[index];
                final name = product['name'] is String
                    ? product['name'] as String
                    : (product['name'] is Map
                        ? (product['name'][locale] ?? product['name']['tr'] ?? product['name']['de'] ?? product['name'].values.first ?? '').toString()
                        : '');
                final price = product['price'] as double;
                final imageUrl = product['imageUrl'] as String;
                final productId = product['id'] as String;

                // Check if this is the currently selected free drink
                final isSelected = hasFreeDrink && cart.freeDrinkItem?.product.id == productId;

                return GestureDetector(
                  onTap: () => _addFreeDrinkToCart(product, butcherId),
                  child: Container(
                    width: 120,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? Color(0xFF10B981).withValues(alpha: isDark ? 0.25 : 0.15)
                          : (isDark ? Color(0xFF1A2E28) : Colors.white),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected
                            ? Color(0xFF10B981)
                            : (isDark ? Colors.grey[700]! : Colors.grey[200]!),
                        width: isSelected ? 2 : 1,
                      ),
                      boxShadow: isSelected
                          ? [BoxShadow(color: Color(0xFF10B981).withValues(alpha: 0.2), blurRadius: 8)]
                          : null,
                    ),
                    child: Stack(
                      children: [
                        Padding(
                          padding: EdgeInsets.all(8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              // Product image or icon
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: isDark ? Colors.grey[800] : Colors.grey[100],
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: imageUrl.isNotEmpty
                                    ? ClipRRect(
                                        borderRadius: BorderRadius.circular(10),
                                        child: Image.network(
                                          imageUrl,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) => Icon(
                                            Icons.local_drink_rounded,
                                            size: 28,
                                            color: Color(0xFF10B981),
                                          ),
                                        ),
                                      )
                                    : Icon(
                                        Icons.local_drink_rounded,
                                        size: 28,
                                        color: Color(0xFF10B981),
                                      ),
                              ),
                              SizedBox(height: 6),

                              // Product name
                              Text(
                                name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? Colors.white : Colors.black87,
                                  height: 1.2,
                                ),
                              ),
                              Spacer(),

                              // Price row: Strikethrough original + GRATIS
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    '${price.toStringAsFixed(2)} €',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w500,
                                      color: isDark ? Colors.grey[500] : Colors.grey[400],
                                      decoration: TextDecoration.lineThrough,
                                      decorationColor: isDark ? Colors.grey[500] : Colors.grey[400],
                                    ),
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    '0,00 €',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF10B981),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // Selected checkmark
                        if (isSelected)
                          Positioned(
                            top: 4,
                            right: 4,
                            child: Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                color: Color(0xFF10B981),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.check, size: 14, color: Colors.white),
                            ),
                          ),

                        // "+" badge for unselected
                        if (!isSelected)
                          Positioned(
                            top: 4,
                            right: 4,
                            child: Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                color: Color(0xFF10B981),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.add, size: 14, color: Colors.white),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Change hint when already selected
          if (hasFreeDrink)
            Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                changeText,
                style: TextStyle(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: isDark ? Colors.white38 : Color(0xFF065F46).withValues(alpha: 0.6),
                ),
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ),
    );
  }

  /// 🥤 Helper: Add a free drink to cart
  void _addFreeDrinkToCart(Map<String, dynamic> product, String butcherId) {
    final locale = context.locale.languageCode;
    final name = product['name'] is String
        ? product['name'] as String
        : (product['name'] is Map
            ? (product['name'][locale] ?? product['name']['tr'] ?? product['name']['de'] ?? product['name'].values.first ?? '').toString()
            : '');
    final price = product['price'] as double;
    final unit = product['unit'] as String;
    final imageUrl = product['imageUrl'] as String;

    final butcherProduct = ButcherProduct(
      id: product['id'] as String,
      name: name,
      nameData: product['nameData'] ?? product['name'],
      price: price,
      unitType: unit,
      imageUrl: imageUrl,
      category: product['category'] is String ? product['category'] as String : '',
      categoryData: product['categoryData'],
      descriptionData: product['descriptionData'],
      butcherId: butcherId,
      sku: product['masterProductSku'] ?? product['id'] as String,
      masterId: product['masterId'] ?? '',
      description: '',
      inStock: true,
    );

    ref.read(cartProvider.notifier).addFreeDrinkItem(
      butcherProduct,
      butcherId,
      _butcherData?['companyName'] ?? '',
    );

    // Haptic feedback
    HapticFeedback.lightImpact();

    final snackMap = {
      'tr': '🥤 $name bedava eklendi!',
      'de': '🥤 $name gratis hinzugefügt!',
      'en': '🥤 $name added for free!',
    };

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(snackMap[locale] ?? snackMap['de']!),
        duration: Duration(seconds: 2),
        backgroundColor: Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );

    setState(() {});
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
              '${grandTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
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
                '${(_butcherData!['deliveryFee'] as num).toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
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
                content: Text('Kurye için minimum sipariş tutarı: ${minOrder.toStringAsFixed(0)} ${CurrencyUtils.getCurrencySymbol()}'),
                backgroundColor: Colors.amber,
              ),
            );
            return;
          }
        }
        _showCheckoutSheet(total);
      },
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: _accentColor, // 🎨 BRAND COLOUR
          borderRadius: BorderRadius.circular(28), // Pill shape
          boxShadow: [
            BoxShadow(
              color: _accentColor.withValues(alpha: 0.3),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_isDineIn && _scannedTableNumber == null) ...[
                Icon(Icons.qr_code_scanner, color: Theme.of(context).colorScheme.surface, size: 20),
                SizedBox(width: 8),
              ],
              Text(
                (_isDineIn && _scannedTableNumber == null)
                    ? 'Masa QR Kodunu Tara · ${total.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}'
                    : 'Ödemeye Geç · ${total.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.surface,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (!(_isDineIn && _scannedTableNumber == null)) ...[
                SizedBox(width: 8),
                Icon(Icons.arrow_forward_rounded, color: Theme.of(context).colorScheme.surface, size: 20),
              ],
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
        bool isScanned = false;

        return Container(
          height: MediaQuery.of(context).size.height * 0.75,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A2E) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3),
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
                  color: Colors.grey.withValues(alpha: 0.3),
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
                'marketplace.scan_qr_to_order'.tr(),
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
                    border: Border.all(color: accent.withValues(alpha: 0.4), width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.1),
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
                        if (isScanned) return;
                        final barcodes = capture.barcodes;
                        if (barcodes.isEmpty) return;
                        
                        final rawValue = barcodes.first.rawValue ?? '';
                        if (rawValue.isEmpty) return;

                        isScanned = true;
                        
                        // Extract table number from QR data
                        // Priority 1: URL format - https://lokma.web.app/dinein/{id}/table/{num}
                        // Priority 2: Simple format - "masa:5", "table:5", "MASA-5", or just "5"
                        String tableNum = rawValue;
                        final urlMatch = RegExp(r'/table/(\d+)').firstMatch(rawValue);
                        if (urlMatch != null) {
                          tableNum = urlMatch.group(1)!;
                        } else if (rawValue.toLowerCase().contains('masa')) {
                          final match = RegExp(r'(\d+)').firstMatch(rawValue);
                          tableNum = match?.group(1) ?? rawValue;
                        } else if (rawValue.toLowerCase().contains('table')) {
                          final match = RegExp(r'(\d+)').firstMatch(rawValue);
                          tableNum = match?.group(1) ?? rawValue;
                        }
                        
                        // Success haptic + close
                        HapticFeedback.heavyImpact();
                        Navigator.pop(ctx);
                        
                        // Check for active group session at this table
                        _handleQrTableScanned(tableNum);
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
                  'marketplace.enter_table_manually'.tr(),
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
            fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
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
                _handleQrTableScanned(text);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _accentColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(tr('common.confirm')),
          ),
        ],
      ),
    );
  }
  
  /// 🔀 Handle QR Table Scanned — check for active group session
  Future<void> _handleQrTableScanned(String tableNum) async {
    final cart = ref.read(cartProvider);
    final businessId = cart.butcherId ?? '';
    final businessName = _butcherData?['name'] ?? 'İşletme';
    
    if (businessId.isEmpty) {
      // No business — just set table number directly
      setState(() => _scannedTableNumber = tableNum);
      return;
    }
    
    // Check for active group session at this table
    try {
      final activeSession = await TableGroupService.instance
          .findActiveSession(businessId, tableNum);
      
      if (!mounted) return;
      
      if (activeSession != null) {
        // Active session found! Show join dialog
        _showJoinGroupDialog(activeSession, tableNum, businessId, businessName);
      } else {
        // No active session — show create or solo option
        _showCreateGroupDialog(tableNum, businessId, businessName);
      }
    } catch (e) {
      debugPrint('Error checking group session: $e');
      // Fallback: just set table number for solo dine-in
      if (mounted) {
        setState(() => _scannedTableNumber = tableNum);
      }
    }
  }
  
  /// 🤝 Join existing group session dialog
  void _showJoinGroupDialog(
    dynamic activeSession,
    String tableNum,
    String businessId,
    String businessName,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final participantCount = (activeSession as dynamic).participantCount ?? 1;
    final pinController = TextEditingController();
    
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24, right: 24, top: 24, bottom: 24 + MediaQuery.of(ctx).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Icon(Icons.groups, size: 48, color: _accentColor),
            const SizedBox(height: 12),
            Text(
              'Masa $tableNum — Aktif Grup Siparişi',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Bu masada $participantCount kişilik aktif bir grup siparişi var.\nKatılmak için PIN kodunu girin.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 16),

            // PIN input
            TextField(
              controller: pinController,
              keyboardType: TextInputType.number,
              maxLength: 4,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 12),
              decoration: InputDecoration(
                hintText: '• • • •',
                counterText: '',
                filled: true,
                fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
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
            const SizedBox(height: 16),
            
            // Join group button
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  final pin = pinController.text.trim();
                  if (pin.length != 4) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(tr('orders.enter_4_digit_pin')), backgroundColor: Colors.orange),
                    );
                    return;
                  }
                  Navigator.pop(ctx);
                  _joinAndNavigateGroup(activeSession.id, tableNum, businessId, businessName, pin);
                },
                icon: const Icon(Icons.group_add),
                label: const Text(
                  'Gruba Katıl',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: _accentColor,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            
            const SizedBox(height: 10),
            
            // Solo dine-in option
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  setState(() => _scannedTableNumber = tableNum);
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.grey[600],
                  side: BorderSide(color: Colors.grey[300]!),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(tr('orders.no_order_by_myself')),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
  
  /// 🆕 Create new group session dialog
  void _showCreateGroupDialog(
    String tableNum,
    String businessId,
    String businessName,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Icon(Icons.restaurant, size: 48, color: _accentColor),
            const SizedBox(height: 12),
            Text(
              'Masa $tableNum',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'marketplace.multiple_people_ordering'.tr(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),
            
            // Start group order
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _createAndNavigateGroup(tableNum, businessId, businessName);
                },
                icon: const Icon(Icons.groups),
                label: const Text(
                  'Grup Siparişi Başlat',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: _accentColor,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            
            const SizedBox(height: 10),
            
            // Solo dine-in
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  setState(() => _scannedTableNumber = tableNum);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Row(
                        children: [
                          Icon(Icons.check_circle, color: Theme.of(context).colorScheme.surface, size: 20),
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
                icon: Icon(Icons.person, color: Colors.grey[600]),
                label: Text(
                  'Tek Kişi Sipariş',
                  style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.grey[300]!),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
  
  /// Navigate to group order screen after joining
  Future<void> _joinAndNavigateGroup(
    String sessionId,
    String tableNum,
    String businessId,
    String businessName,
    String pin,
  ) async {
    try {
      final groupNotifier = ref.read(tableGroupProvider.notifier);
      await groupNotifier.joinSession(sessionId, pin: pin);
      
      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => GroupTableOrderScreen(
              businessId: businessId,
              businessName: businessName,
              tableNumber: tableNum,
              sessionId: ref.read(tableGroupProvider).session?.id,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gruba katılırken hata: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }
  
  /// Create new group session and navigate
  Future<void> _createAndNavigateGroup(
    String tableNum,
    String businessId,
    String businessName,
  ) async {
    try {
      final groupNotifier = ref.read(tableGroupProvider.notifier);
      await groupNotifier.createSession(
        businessId: businessId,
        businessName: businessName,
        tableNumber: tableNum,
      );
      
      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => GroupTableOrderScreen(
              businessId: businessId,
              businessName: businessName,
              tableNumber: tableNum,
              sessionId: ref.read(tableGroupProvider).session?.id,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Grup oluşturulurken hata: $e'), backgroundColor: Colors.red),
        );
      }
    }
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
            Colors.green.withValues(alpha: isDark ? 0.2 : 0.1),
            Colors.green.withValues(alpha: isDark ? 0.1 : 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.15),
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
                color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey[100],
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
  
  Widget _buildEmptyCart() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shopping_cart_outlined, size: 80, color: Colors.grey[400]),
          SizedBox(height: 16),
          Text(
            'marketplace.your_cart_is_empty'.tr(),
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 20, fontWeight: FontWeight.w600),
          ),
          SizedBox(height: 8),
          Text('marketplace.order_from_kermes'.tr(), style: TextStyle(color: Colors.grey)),
          SizedBox(height: 32),
          // "Menüye Dön" butonu
          SizedBox(
            width: 220,
            height: 48,
            child: FilledButton.icon(
              onPressed: () {
                if (Navigator.of(context).canPop()) {
                  Navigator.of(context).pop();
                } else {
                  // Bottom nav tab'taysa ana sayfaya yönlendir
                  context.go('/');
                }
              },
              icon: const Icon(Icons.arrow_back_rounded, size: 20),
              label: const Text(
                'Menüye Dön',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: _accentColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 🛒 CHECKOUT CONFIRMATION BOTTOM SHEET
  Future<void> _showCheckoutSheet(double total) async {
    // Auth gate: giriş yapmamışsa login'e yönlendir
    final authState = ref.read(authProvider);
    final firebaseUser = FirebaseAuth.instance.currentUser;
    if (authState.appUser == null && firebaseUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr('orders.login_required_to_order')),
          backgroundColor: Colors.amber,
        ),
      );
      context.push('/login');
      return;
    }

    final cart = ref.read(cartProvider);
    final deliveryFee = (!_isPickUp && !_isDineIn ? (_butcherData?['deliveryFee'] as num?)?.toDouble() ?? 2.50 : 0.0);
    final couponDiscount = _appliedCoupon?.isValid == true ? (_appliedCoupon!.calculatedDiscount ?? 0) : 0.0;
    // First-order discount for checkout sheet display
    final currentUserId = FirebaseAuth.instance.currentUser?.uid;
    double firstOrderDiscountAmount = 0.0;
    if (currentUserId != null) {
      final foDiscount = await FirstOrderService.checkDiscount(currentUserId);
      firstOrderDiscountAmount = foDiscount?.discountAmount ?? 0.0;
      // Fetch wallet balance
      final userDoc = await FirebaseFirestore.instance.collection('users').doc(currentUserId).get();
      _walletBalance = (userDoc.data()?['walletBalance'] as num?)?.toDouble() ?? 0.0;
    }
    final subtotalAfterDiscounts = total + deliveryFee - couponDiscount - firstOrderDiscountAmount;
    final walletApplied = _useWallet ? (_walletBalance >= subtotalAfterDiscounts ? subtotalAfterDiscounts : _walletBalance) : 0.0;
    final grandTotal = (subtotalAfterDiscounts - walletApplied).clamp(0.0, double.infinity);
    final noteController = TextEditingController(text: _orderNote);
    final couponController = TextEditingController();
    // Pre-fill table number from QR scan
    if (_isDineIn && _scannedTableNumber != null) {
      _tableNumberController.text = _scannedTableNumber!;
    }

    if (!mounted) return;
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (routeContext, animation, secondaryAnimation) {
          return _CheckoutFullPage(
            total: total,
            deliveryFee: deliveryFee,
            couponDiscount: couponDiscount,
            firstOrderDiscountAmount: firstOrderDiscountAmount,
            walletApplied: walletApplied,
            grandTotal: grandTotal,
            noteController: noteController,
            couponController: couponController,
            cart: cart,
            firebaseUser: firebaseUser,
            authState: authState,
            cartScreenState: this,
          );
        },
        transitionsBuilder: (routeContext, animation, secondaryAnimation, child) {
          const begin = Offset(1.0, 0.0);
          const end = Offset.zero;
          const curve = Curves.easeInOutCubic;
          final tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
          return SlideTransition(
            position: animation.drive(tween),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 350),
        reverseTransitionDuration: const Duration(milliseconds: 300),
      ),
    );
  }

  /// 📍 Address Picker Bottom Sheet
  void _showAddressPickerSheet(
    BuildContext ctx,
    StateSetter parentSetSheetState,
    String userId, {
    Map<String, String>? profileAddress,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        return StatefulBuilder(
          builder: (context, setPickerState) {
            return Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle bar
                  const SizedBox(height: 10),
                  Container(
                    width: 40, height: 4,
                    decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
                  ),
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 16, 8),
                    child: Row(
                      children: [
                        Text(
                          'Teslimat Adresi Seç',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black),
                        ),
                        const Spacer(),
                        IconButton(
                          icon: Icon(Icons.close, color: isDark ? Colors.white70 : Colors.black54),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ),
                  Divider(height: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),
                  
                  // Address list
                  Flexible(
                    child: StreamBuilder<QuerySnapshot>(
                      stream: FirebaseFirestore.instance
                          .collection('users')
                          .doc(userId)
                          .collection('savedAddresses')
                          .orderBy('createdAt', descending: false)
                          .snapshots(),
                      builder: (context, snapshot) {
                        final savedAddresses = snapshot.data?.docs ?? [];
                        
                        return ListView(
                          shrinkWrap: true,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          children: [
                            // Profile default address
                            if (profileAddress != null) ...[
                              _buildAddressPickerItem(
                                setPickerState: setPickerState,
                                parentSetSheetState: parentSetSheetState,
                                sheetCtx: sheetCtx,
                                address: profileAddress,
                                label: 'Varsayılan Adres',
                                isSelected: _selectedDeliveryAddress == null,
                                isDefault: true,
                                isDark: isDark,
                                onSelect: () {
                                  setState(() => _selectedDeliveryAddress = null);
                                  parentSetSheetState(() {});
                                  Navigator.pop(sheetCtx);
                                },
                              ),
                              const SizedBox(height: 8),
                            ],
                            
                            // Saved addresses
                            ...savedAddresses.map((doc) {
                              final data = doc.data() as Map<String, dynamic>;
                              final addr = {
                                'street': data['street']?.toString() ?? '',
                                'houseNumber': data['houseNumber']?.toString() ?? '',
                                'postalCode': data['postalCode']?.toString() ?? '',
                                'city': data['city']?.toString() ?? '',
                              };
                              final label = data['label']?.toString() ?? '';
                              final isSelected = _selectedDeliveryAddress != null &&
                                  _selectedDeliveryAddress!['street'] == addr['street'] &&
                                  _selectedDeliveryAddress!['houseNumber'] == addr['houseNumber'] &&
                                  _selectedDeliveryAddress!['postalCode'] == addr['postalCode'] &&
                                  _selectedDeliveryAddress!['city'] == addr['city'];
                              
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: _buildAddressPickerItem(
                                  setPickerState: setPickerState,
                                  parentSetSheetState: parentSetSheetState,
                                  sheetCtx: sheetCtx,
                                  address: addr,
                                  label: label.isNotEmpty ? label : null,
                                  isSelected: isSelected,
                                  isDefault: false,
                                  isDark: isDark,
                                  onSelect: () {
                                    setState(() => _selectedDeliveryAddress = addr);
                                    parentSetSheetState(() {});
                                    Navigator.pop(sheetCtx);
                                  },
                                  onDelete: () async {
                                    await FirebaseFirestore.instance
                                        .collection('users')
                                        .doc(userId)
                                        .collection('savedAddresses')
                                        .doc(doc.id)
                                        .delete();
                                    // If deleted address was selected, clear selection
                                    if (isSelected) {
                                      setState(() => _selectedDeliveryAddress = null);
                                      parentSetSheetState(() {});
                                    }
                                    setPickerState(() {});
                                  },
                                ),
                              );
                            }),
                            
                            const SizedBox(height: 8),
                            // Add new address button
                            GestureDetector(
                              onTap: () => _showNewAddressForm(
                                sheetCtx, 
                                setPickerState,
                                parentSetSheetState,
                                userId,
                                isDark,
                              ),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: _accentColor.withOpacity(0.5),
                                    style: BorderStyle.solid,
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.add_circle_outline, color: _accentColor, size: 20),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Yeni adres ekle',
                                      style: TextStyle(
                                        color: _accentColor,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                        );
                      },
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

  /// Single address row in the picker
  Widget _buildAddressPickerItem({
    required StateSetter setPickerState,
    required StateSetter parentSetSheetState,
    required BuildContext sheetCtx,
    required Map<String, String> address,
    String? label,
    required bool isSelected,
    required bool isDefault,
    required bool isDark,
    required VoidCallback onSelect,
    VoidCallback? onDelete,
  }) {
    final streetFull = (address['houseNumber'] ?? '').isNotEmpty
        ? '${address['street']} ${address['houseNumber']}'
        : (address['street'] ?? '');
    final fullAddress = [streetFull, '${address['postalCode']} ${address['city']}']
        .where((s) => s.trim().isNotEmpty)
        .join(', ');

    return GestureDetector(
      onTap: onSelect,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? _accentColor.withOpacity(0.15) : _accentColor.withOpacity(0.08))
              : (isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? _accentColor : (isDark ? Colors.grey.shade700 : Colors.grey.shade300),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            // Radio indicator
            Container(
              width: 22, height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? _accentColor : (isDark ? Colors.grey[500]! : Colors.grey[400]!),
                  width: isSelected ? 2 : 1.5,
                ),
              ),
              child: isSelected
                  ? Center(child: Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: _accentColor)))
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (label != null)
                    Row(
                      children: [
                        Text(
                          label,
                          style: TextStyle(
                            fontSize: 11,
                            color: isDefault ? Colors.green : _accentColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (isDefault) ...[
                          const SizedBox(width: 4),
                          Icon(Icons.star, size: 12, color: Colors.green),
                        ],
                      ],
                    ),
                  Text(
                    fullAddress,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ],
              ),
            ),
            if (onDelete != null)
              IconButton(
                icon: Icon(Icons.delete_outline, color: Colors.red.shade400, size: 20),
                onPressed: onDelete,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
          ],
        ),
      ),
    );
  }

  /// New Address Form Dialog with Google Places Autocomplete
  void _showNewAddressForm(
    BuildContext parentCtx,
    StateSetter setPickerState,
    StateSetter parentSetSheetState,
    String userId,
    bool isDark,
  ) {
    const String _placesApiKey = 'AIzaSyB8Pvs-P4580Wsk4mT46cvGT7TGlZiLkWo';
    final searchController = TextEditingController();
    final streetController = TextEditingController();
    final houseNumberController = TextEditingController();
    final postalCodeController = TextEditingController();
    final cityController = TextEditingController();
    final labelController = TextEditingController();
    bool _addressSelected = false;

    showModalBottomSheet(
      context: parentCtx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (formCtx) {
        return StatefulBuilder(
          builder: (context, setFormState) {
            final bottomInset = MediaQuery.of(context).viewInsets.bottom;
            return Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
              padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40, height: 4,
                        decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Yeni Adres Ekle',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black),
                    ),
                    const SizedBox(height: 16),

                    // 🔍 Google Places Autocomplete search
                    Text(
                      'Adres Ara',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                    ),
                    const SizedBox(height: 6),
                    GooglePlaceAutoCompleteTextField(
                      textEditingController: searchController,
                      googleAPIKey: _placesApiKey,
                      boxDecoration: const BoxDecoration(),
                      inputDecoration: InputDecoration(
                        hintText: 'Adres aramak için yazın...',
                        hintStyle: TextStyle(color: Colors.grey[500], fontSize: 14),
                        prefixIcon: Icon(Icons.search, color: isDark ? Colors.grey[400] : Colors.grey[600], size: 20),
                        filled: true,
                        fillColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _accentColor)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                      textStyle: TextStyle(color: isDark ? Colors.white : Colors.black, fontSize: 14),
                      debounceTime: 400,
                      countries: const ['de'],
                      isLatLngRequired: true,
                      getPlaceDetailWithLatLng: (prediction) async {
                        // Use reverse geocoding to get structured address components
                        final lat = double.tryParse(prediction.lat ?? '');
                        final lng = double.tryParse(prediction.lng ?? '');
                        if (lat != null && lng != null) {
                          try {
                            final placemarks = await placemarkFromCoordinates(lat, lng).timeout(const Duration(seconds: 8));
                            if (placemarks.isNotEmpty) {
                              final place = placemarks.first;
                              setFormState(() {
                                streetController.text = place.thoroughfare ?? '';
                                houseNumberController.text = place.subThoroughfare ?? '';
                                postalCodeController.text = place.postalCode ?? '';
                                cityController.text = place.locality ?? place.administrativeArea ?? '';
                                _addressSelected = true;
                              });
                            }
                          } catch (e) {
                            debugPrint('Geocoding error: $e');
                            // Fallback: try to parse from description
                            final desc = prediction.description ?? '';
                            final parts = desc.split(',');
                            if (parts.isNotEmpty) {
                              setFormState(() {
                                streetController.text = parts[0].trim();
                                if (parts.length >= 2) {
                                  // Try to parse "PLZ City" from second part
                                  final plzCity = parts[1].trim();
                                  final match = RegExp(r'(\d{5})\s*(.*)').firstMatch(plzCity);
                                  if (match != null) {
                                    postalCodeController.text = match.group(1) ?? '';
                                    cityController.text = match.group(2) ?? '';
                                  } else {
                                    cityController.text = plzCity;
                                  }
                                }
                                _addressSelected = true;
                              });
                            }
                          }
                        }
                      },
                      itemClick: (Prediction prediction) {
                        searchController.text = prediction.description ?? '';
                        searchController.selection = TextSelection.fromPosition(
                          TextPosition(offset: searchController.text.length),
                        );
                      },
                    ),

                    const SizedBox(height: 16),
                    Divider(color: isDark ? Colors.grey[800] : Colors.grey[200]),
                    const SizedBox(height: 8),

                    // Label (optional)
                    _buildAddressTextField(labelController, 'Adres Adı (opsiyonel)', 'Ör: Ev, İş', isDark, textInputAction: TextInputAction.next),
                    const SizedBox(height: 12),

                    // Street + House Number row (auto-filled or manual)
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: _buildAddressTextField(streetController, 'Sokak / Cadde *', 'Ör: Hauptstraße', isDark, textInputAction: TextInputAction.next),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 1,
                          child: _buildAddressTextField(houseNumberController, 'Nr.', '', isDark, textInputAction: TextInputAction.next),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // PLZ + City row
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: _buildAddressTextField(postalCodeController, 'PLZ *', '', isDark, keyboardType: TextInputType.number, textInputAction: TextInputAction.next),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 3,
                          child: _buildAddressTextField(cityController, 'Şehir *', '', isDark, textInputAction: TextInputAction.done),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Buttons
                    Row(
                      children: [
                        // Use without saving
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              if (streetController.text.trim().isEmpty || cityController.text.trim().isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Lütfen sokak ve şehir bilgisi girin'), backgroundColor: Colors.red),
                                );
                                return;
                              }
                              final addr = {
                                'street': streetController.text.trim(),
                                'houseNumber': houseNumberController.text.trim(),
                                'postalCode': postalCodeController.text.trim(),
                                'city': cityController.text.trim(),
                              };
                              setState(() => _selectedDeliveryAddress = addr);
                              parentSetSheetState(() {});
                              Navigator.pop(formCtx); // close form
                              Navigator.pop(parentCtx); // close picker
                            },
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: isDark ? Colors.grey.shade600 : Colors.grey.shade400),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: Text(
                              'Sadece Kullan',
                              style: TextStyle(color: isDark ? Colors.white70 : Colors.black87, fontWeight: FontWeight.w500),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Save and use
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () async {
                              if (streetController.text.trim().isEmpty || cityController.text.trim().isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Lütfen sokak ve şehir bilgisi girin'), backgroundColor: Colors.red),
                                );
                                return;
                              }
                              final addr = {
                                'street': streetController.text.trim(),
                                'houseNumber': houseNumberController.text.trim(),
                                'postalCode': postalCodeController.text.trim(),
                                'city': cityController.text.trim(),
                              };
                              // Save to Firestore
                              await FirebaseFirestore.instance
                                  .collection('users')
                                  .doc(userId)
                                  .collection('savedAddresses')
                                  .add({
                                ...addr,
                                'label': labelController.text.trim(),
                                'createdAt': FieldValue.serverTimestamp(),
                              });
                              setState(() => _selectedDeliveryAddress = addr);
                              parentSetSheetState(() {});
                              setPickerState(() {});
                              if (formCtx.mounted) Navigator.pop(formCtx);
                              if (parentCtx.mounted) Navigator.pop(parentCtx);
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _accentColor,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('Kaydet & Kullan', style: TextStyle(fontWeight: FontWeight.w600)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  /// Build a styled text field for the address form
  Widget _buildAddressTextField(
    TextEditingController controller,
    String label,
    String hint,
    bool isDark, {
    TextInputType keyboardType = TextInputType.text,
    TextInputAction textInputAction = TextInputAction.next,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      style: TextStyle(color: isDark ? Colors.white : Colors.black, fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        floatingLabelBehavior: FloatingLabelBehavior.always,
        labelStyle: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13),
        hintStyle: TextStyle(color: Colors.grey[500], fontSize: 13),
        filled: true,
        fillColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _accentColor)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
    );
  }

  /// 📦 Collapsible Unavailability Preference Section
  Widget _buildCollapsibleUnavailabilitySection(BuildContext ctx, StateSetter setSheetState, CartState cart) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Map preference value to display text
    String selectedLabel;
    switch (_unavailabilityPreference) {
      case 'substitute':
        selectedLabel = 'marketplace.product_unavailable_replace'.tr();
        break;
      case 'refund':
        selectedLabel = 'marketplace.product_unavailable_refund'.tr();
        break;
      case 'perItem':
        selectedLabel = 'marketplace.product_unavailable_choose'.tr();
        break;
      default:
        selectedLabel = 'Ürün ücretini iade et';
    }

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          initiallyExpanded: false,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          collapsedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Row(
            children: [

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'marketplace.if_product_unavailable'.tr(),
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () {
                            showDialog(
                              context: ctx,
                              builder: (dialogCtx) => AlertDialog(
                                backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                title: Row(
                                  children: [
                                    Icon(Icons.info_outline, color: _accentColor, size: 22),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'marketplace.what_if_unavailable'.tr(),
                                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black),
                                      ),
                                    ),
                                  ],
                                ),
                                content: Text(
                                  'Ürünlerimiz genellikle her zaman stoklarımızda mevcuttur. '
                                  'Ancak çok nadir durumlarda, bir ürün geçici olarak tükenmiş olabilir. '
                                  'Siparişinizi mümkün olan en kısa sürede tamamlayabilmemiz için, '
                                  'böyle bir durumda ne yapmamızı istediğinizi önceden bildirmenizi rica ediyoruz. '
                                  'Bu sayede size ulaşmak zorunda kalmadan siparişinizi hızlıca hazırlayabiliriz.',
                                  style: TextStyle(
                                    fontSize: 14,
                                    height: 1.5,
                                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                                  ),
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(dialogCtx),
                                    child: Text('Anladım', style: TextStyle(color: _accentColor, fontWeight: FontWeight.w600)),
                                  ),
                                ],
                              ),
                            );
                          },
                          child: Icon(
                            Icons.info_outline,
                            size: 16,
                            color: isDark ? Colors.grey[500] : Colors.grey[400],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      selectedLabel,
                      style: TextStyle(
                        fontSize: 12,
                        color: _accentColor,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          iconColor: isDark ? Colors.grey[400] : Colors.grey[600],
          collapsedIconColor: isDark ? Colors.grey[400] : Colors.grey[600],
          children: [
            Divider(height: 1, color: isDark ? Colors.grey[700] : Colors.grey[200]),
            const SizedBox(height: 8),
            // Option 1: Substitute
            _buildUnavailabilityOption(
              setSheetState: setSheetState,
              value: 'substitute',
              title: 'marketplace.product_unavailable_replace'.tr(),
              subtitle: 'Eşdeğer veya daha düşük fiyatlı ürün gönderilir',
              isDark: isDark,
            ),
            const SizedBox(height: 4),
            Divider(height: 1, color: isDark ? Colors.grey[700] : Colors.grey[200]),
            const SizedBox(height: 4),
            // Option 2: Refund
            _buildUnavailabilityOption(
              setSheetState: setSheetState,
              value: 'refund',
              title: 'marketplace.product_unavailable_refund'.tr(),
              subtitle: 'Ödeme yönteminize göre otomatik iade',
              isDark: isDark,
            ),
            const SizedBox(height: 4),
            Divider(height: 1, color: isDark ? Colors.grey[700] : Colors.grey[200]),
            const SizedBox(height: 4),
            // Option 3: Per-item
            _buildUnavailabilityOption(
              setSheetState: setSheetState,
              value: 'perItem',
              title: 'marketplace.product_unavailable_choose'.tr(),
              subtitle: 'Her ürün için tercih belirleyin',
              isDark: isDark,
            ),
            // Per-item preferences (only when perItem is selected)
            if (_unavailabilityPreference == 'perItem') ...[
              const SizedBox(height: 16),
              ...cart.items.map((item) {
                final productId = item.product.id;
                final productName = I18nUtils.getLocalizedText(context, item.product.nameData);
                final pref = _perItemPreferences[productId] ?? 'refund';

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        productName,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _buildPerItemChip(
                            setSheetState: setSheetState,
                            productId: productId,
                            chipValue: 'substitute',
                            currentValue: pref,
                            label: 'Alternatif',
                            isDark: isDark,
                          ),
                          const SizedBox(width: 8),
                          _buildPerItemChip(
                            setSheetState: setSheetState,
                            productId: productId,
                            chipValue: 'refund',
                            currentValue: pref,
                            label: 'İade',
                            isDark: isDark,
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }

  /// 📦 Unavailability Preference Section (Lieferando "Falls Artikel nicht verfügbar" style)
  Widget _buildUnavailabilityPreferenceSection(BuildContext ctx, StateSetter setSheetState, CartState cart) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Option 1: Substitute
          _buildUnavailabilityOption(
            setSheetState: setSheetState,
            value: 'substitute',
            title: 'En iyi alternatifle değiştir',
            subtitle: 'Eşdeğer veya daha düşük fiyatlı ürün gönderilir',
            isDark: isDark,
          ),
          const SizedBox(height: 4),
          Divider(height: 1, color: isDark ? Colors.grey[700] : Colors.grey[200]),
          const SizedBox(height: 4),

          // Option 2: Refund
          _buildUnavailabilityOption(
            setSheetState: setSheetState,
            value: 'refund',
            title: 'Ürün ücretini iade et',
            subtitle: 'Ödeme yönteminize göre otomatik iade',
            isDark: isDark,
          ),
          const SizedBox(height: 4),
          Divider(height: 1, color: isDark ? Colors.grey[700] : Colors.grey[200]),
          const SizedBox(height: 4),

          // Option 3: Per-item
          _buildUnavailabilityOption(
            setSheetState: setSheetState,
            value: 'perItem',
            title: 'Her ürün için ayrı seç',
            subtitle: 'Her ürün için tercih belirleyin',
            isDark: isDark,
          ),

          // Allergy info banner
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1A2744) : const Color(0xFFE8EEF8),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 18, color: isDark ? Colors.blue[300] : Colors.blue[600]),
                const SizedBox(width: 10),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.blue[200] : Colors.blue[800],
                        height: 1.4,
                      ),
                      children: [
                        TextSpan(text: 'Alerjiniz varsa, '),
                        TextSpan(
                          text: '"Ürün ücretini iade et"',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        TextSpan(text: ' seçeneğini öneriyoruz.'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Per-item preferences (only when perItem is selected)
          if (_unavailabilityPreference == 'perItem') ...[
            const SizedBox(height: 16),
            ...cart.items.map((item) {
              final productId = item.product.id;
              final productName = I18nUtils.getLocalizedText(context, item.product.nameData);
              final pref = _perItemPreferences[productId] ?? 'substitute';

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      productName,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        _buildPerItemChip(
                          setSheetState: setSheetState,
                          productId: productId,
                          chipValue: 'substitute',
                          currentValue: pref,
                          label: 'Alternatif',
                          isDark: isDark,
                        ),
                        const SizedBox(width: 8),
                        _buildPerItemChip(
                          setSheetState: setSheetState,
                          productId: productId,
                          chipValue: 'refund',
                          currentValue: pref,
                          label: 'İade',
                          isDark: isDark,
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  /// Single radio-style option for unavailability preference
  Widget _buildUnavailabilityOption({
    required StateSetter setSheetState,
    required String value,
    required String title,
    required String subtitle,
    required bool isDark,
  }) {
    final isSelected = _unavailabilityPreference == value;

    return GestureDetector(
      onTap: () {
        setSheetState(() {});
        setState(() {
          _unavailabilityPreference = value;
          // Initialize per-item prefs when selecting perItem
          if (value == 'perItem') {
            final cart = ref.read(cartProvider);
            for (final item in cart.items) {
              _perItemPreferences.putIfAbsent(item.product.id, () => 'substitute');
            }
          }
        });
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Radio circle
            Container(
              width: 22,
              height: 22,
              margin: const EdgeInsets.only(top: 1),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? _accentColor : (isDark ? Colors.grey[500]! : Colors.grey[400]!),
                  width: isSelected ? 2 : 1.5,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _accentColor,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
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

  /// Per-item preference chip (Alternatif / İade)
  Widget _buildPerItemChip({
    required StateSetter setSheetState,
    required String productId,
    required String chipValue,
    required String currentValue,
    required String label,
    required bool isDark,
  }) {
    final isSelected = currentValue == chipValue;

    return GestureDetector(
      onTap: () {
        setSheetState(() {});
        setState(() {
          _perItemPreferences[productId] = chipValue;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? _accentColor.withValues(alpha: 0.2) : _accentColor.withValues(alpha: 0.1))
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? _accentColor
                : (isDark ? Colors.grey[600]! : Colors.grey[300]!),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            color: isSelected
                ? _accentColor
                : (isDark ? Colors.grey[300] : Colors.grey[600]),
          ),
        ),
      ),
    );
  }

  /// 🆕 Gel Al: Apple-style Cupertino wheel picker for pickup time
  Widget _buildPickupTimePicker(StateSetter setSheetState) {
    if (_hoursHelper == null) {
      return const SizedBox.shrink();
    }

    final grouped = _hoursHelper!.getAvailableSlotsGroupedByDay(
      isPickup: true,
      daysToCheck: 3,
      prepTimeMinutes: 30,
    );

    if (grouped.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.orange.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          children: [
            Icon(Icons.info_outline, color: Colors.orange, size: 18),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Şu an müsait zaman dilimi bulunamadı.',
                style: TextStyle(color: Colors.orange, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final now = DateTime.now();
    final dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    final dayKeys = grouped.keys.toList();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Build day labels
    final dayLabels = dayKeys.map((dateKey) {
      final isToday = dateKey.day == now.day && dateKey.month == now.month && dateKey.year == now.year;
      final tomorrow = now.add(const Duration(days: 1));
      final isTomorrow = dateKey.day == tomorrow.day && dateKey.month == tomorrow.month && dateKey.year == tomorrow.year;
      if (isToday) return 'Bugün';
      if (isTomorrow) return 'Yarın';
      return dayNames[dateKey.weekday - 1];
    }).toList();

    // Determine initial day index
    int initialDayIndex = 0;
    if (_selectedPickupSlot != null) {
      final selDate = DateTime(_selectedPickupSlot!.year, _selectedPickupSlot!.month, _selectedPickupSlot!.day);
      final idx = dayKeys.indexWhere((k) => k.year == selDate.year && k.month == selDate.month && k.day == selDate.day);
      if (idx >= 0) initialDayIndex = idx;
    }

    // Time slots for the selected day
    List<DateTime> currentTimeSlots = grouped[dayKeys[initialDayIndex]] ?? [];

    // Determine initial time index
    int initialTimeIndex = 0;
    if (_selectedPickupSlot != null) {
      final idx = currentTimeSlots.indexWhere((s) =>
          s.hour == _selectedPickupSlot!.hour && s.minute == _selectedPickupSlot!.minute);
      if (idx >= 0) initialTimeIndex = idx;
    }

    int currentDayIndex = initialDayIndex;
    int currentTimeIndex = initialTimeIndex;
    final timeController = FixedExtentScrollController(initialItem: initialTimeIndex);

    return StatefulBuilder(
      builder: (context, setPickerState) {
        currentTimeSlots = grouped[dayKeys[currentDayIndex]] ?? [];
        if (currentTimeIndex >= currentTimeSlots.length) {
          currentTimeIndex = 0;
        }

        // Format the selected time for display
        String selectedDisplay = '';
        if (currentTimeSlots.isNotEmpty) {
          final slot = currentTimeSlots[currentTimeIndex];
          selectedDisplay = '${dayLabels[currentDayIndex]}, ${slot.hour.toString().padLeft(2, '0')}:${slot.minute.toString().padLeft(2, '0')}';
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.schedule, color: _accentColor, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Teslim Alma Saati',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                if (_selectedPickupSlot != null) ...[
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _accentColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      selectedDisplay,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: _accentColor,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            // Cupertino-style wheel picker
            Container(
              height: 150,
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[900] : Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Stack(
                children: [
                  // Selection highlight bar
                  Center(
                    child: Container(
                      height: 36,
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: isDark
                            ? Colors.grey[800]!.withValues(alpha: 0.8)
                            : Colors.grey[300]!.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      // Day picker (left wheel)
                      Expanded(
                        flex: 5,
                        child: CupertinoPicker(
                          scrollController: FixedExtentScrollController(initialItem: currentDayIndex),
                          itemExtent: 36,
                          diameterRatio: 1.2,
                          squeeze: 1.1,
                          selectionOverlay: const SizedBox.shrink(),
                          onSelectedItemChanged: (index) {
                            setPickerState(() {
                              currentDayIndex = index;
                              currentTimeIndex = 0;
                              currentTimeSlots = grouped[dayKeys[currentDayIndex]] ?? [];
                              timeController.jumpToItem(0);
                            });
                            // Auto-select first slot of new day
                            if (currentTimeSlots.isNotEmpty) {
                              final slot = currentTimeSlots[0];
                              setSheetState(() {});
                              setState(() {
                                _selectedPickupSlot = slot;
                                _selectedDate = DateTime(slot.year, slot.month, slot.day);
                                _selectedTime = TimeOfDay(hour: slot.hour, minute: slot.minute);
                              });
                            }
                          },
                          children: List.generate(dayLabels.length, (index) {
                            final isSelected = index == currentDayIndex;
                            return Center(
                              child: Text(
                                dayLabels[index],
                                style: TextStyle(
                                  fontSize: isSelected ? 18 : 15,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w400,
                                  color: isSelected
                                      ? Theme.of(context).colorScheme.onSurface
                                      : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.35),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                      // Separator
                      Container(
                        width: 1,
                        height: 100,
                        color: isDark ? Colors.grey[700] : Colors.grey[300],
                      ),
                      // Time picker (right wheel)
                      Expanded(
                        flex: 4,
                        child: CupertinoPicker(
                          scrollController: timeController,
                          itemExtent: 36,
                          diameterRatio: 1.2,
                          squeeze: 1.1,
                          selectionOverlay: const SizedBox.shrink(),
                          onSelectedItemChanged: (index) {
                            setPickerState(() {
                              currentTimeIndex = index;
                            });
                            if (currentTimeSlots.isNotEmpty && index < currentTimeSlots.length) {
                              final slot = currentTimeSlots[index];
                              setSheetState(() {});
                              setState(() {
                                _selectedPickupSlot = slot;
                                _selectedDate = DateTime(slot.year, slot.month, slot.day);
                                _selectedTime = TimeOfDay(hour: slot.hour, minute: slot.minute);
                              });
                            }
                          },
                          children: List.generate(currentTimeSlots.length, (index) {
                            final slot = currentTimeSlots[index];
                            final timeStr = '${slot.hour.toString().padLeft(2, '0')}:${slot.minute.toString().padLeft(2, '0')}';
                            final isSelected = index == currentTimeIndex;
                            return Center(
                              child: Text(
                                timeStr,
                                style: TextStyle(
                                  fontSize: isSelected ? 18 : 15,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w400,
                                  color: isSelected
                                      ? Theme.of(context).colorScheme.onSurface
                                      : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.35),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  /// 🆕 Kurye: Scheduled delivery time picker (ASAP or future slot)
  Widget _buildDeliveryTimePicker(StateSetter setSheetState) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bool isScheduled = _scheduledDeliverySlot != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.schedule, color: _accentColor, size: 18),
            const SizedBox(width: 8),
            Text(
              'Teslimat Zamanı',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        // ASAP / Scheduled 3D pill toggle
        ThreeDimensionalPillTabBar(
          selectedIndex: isScheduled ? 1 : 0,
          onTabSelected: (index) {
            if (index == 0) {
              // ASAP
              _scheduledDeliverySlot = null;
              _scheduledInfoDismissed = false;
              setSheetState(() {});
            } else {
              // İleri tarih — select first available slot
              if (_hoursHelper != null) {
                final grouped = _hoursHelper!.getAvailableSlotsGroupedByDay(
                  isPickup: false,
                  daysToCheck: 7,
                  prepTimeMinutes: 60,
                );
                if (grouped.isNotEmpty) {
                  final firstSlots = grouped.values.first;
                  if (firstSlots.isNotEmpty) {
                    _scheduledDeliverySlot = firstSlots.first;
                    _scheduledInfoDismissed = false;
                    setSheetState(() {});
                  }
                }
              }
            }
          },
          tabs: const [
            TabItem(title: 'En kısa sürede', icon: Icons.bolt),
            TabItem(title: 'İleri tarih', icon: Icons.calendar_today),
          ],
        ),
        // Show wheel picker only when scheduled
        if (isScheduled && _hoursHelper != null) ...[
          const SizedBox(height: 12),
          _buildScheduledDeliveryWheelPicker(setSheetState),
          const SizedBox(height: 12),
          // Info note about scheduled delivery
          if (!_scheduledInfoDismissed)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark
                  ? Theme.of(context).colorScheme.surfaceContainerHighest
                  : Colors.blue.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isDark
                    ? Theme.of(context).colorScheme.outline.withValues(alpha: 0.3)
                    : Colors.blue.withValues(alpha: 0.15),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, size: 16, color: isDark ? Colors.grey[400] : Colors.blue[400]),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Siparişinizi seçtiğiniz saatte teslim etmeye özen gösteriyoruz. Ancak trafik yoğunluğu veya öngörülemeyen sebeplerden dolayı teslimat zamanında hafif farklılıklar olabilir.',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.location_on_outlined, size: 16, color: isDark ? Colors.grey[400] : Colors.blue[400]),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Kuryenizi canlı harita üzerinden gerçek zamanlı takip edebilirsiniz.',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: isDark ? Colors.grey[300] : Colors.blue[700],
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Dismiss button
                Align(
                  alignment: Alignment.centerRight,
                  child: GestureDetector(
                    onTap: () {
                      _scheduledInfoDismissed = true;
                      setSheetState(() {});
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark
                            ? Theme.of(context).colorScheme.outline.withValues(alpha: 0.15)
                            : Colors.blue.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Anladım ✓',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.grey[300] : Colors.blue[700],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  /// 🆕 Cupertino wheel picker for scheduled delivery time (reuses Gel Al pattern)
  Widget _buildScheduledDeliveryWheelPicker(StateSetter setSheetState) {
    final grouped = _hoursHelper!.getAvailableSlotsGroupedByDay(
      isPickup: false,
      daysToCheck: 7,
      prepTimeMinutes: 60,
      slotIntervalMinutes: 15,
    );

    if (grouped.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.orange.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          children: [
            Icon(Icons.info_outline, color: Colors.orange, size: 18),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Uygun teslimat zamanı bulunamadı.',
                style: TextStyle(color: Colors.orange, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final now = DateTime.now();
    final dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    final dayKeys = grouped.keys.toList();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final dayLabels = dayKeys.map((dateKey) {
      final isToday = dateKey.day == now.day && dateKey.month == now.month && dateKey.year == now.year;
      final tomorrow = now.add(const Duration(days: 1));
      final isTomorrow = dateKey.day == tomorrow.day && dateKey.month == tomorrow.month && dateKey.year == tomorrow.year;
      final dateStr = '${dateKey.day.toString().padLeft(2, '0')}.${dateKey.month.toString().padLeft(2, '0')}';
      if (isToday) return 'Bugün, $dateStr';
      if (isTomorrow) return 'Yarın, $dateStr';
      return '${dayNames[dateKey.weekday - 1]}, $dateStr';
    }).toList();

    int initialDayIndex = 0;
    if (_scheduledDeliverySlot != null) {
      final selDate = DateTime(_scheduledDeliverySlot!.year, _scheduledDeliverySlot!.month, _scheduledDeliverySlot!.day);
      final idx = dayKeys.indexWhere((k) => k.year == selDate.year && k.month == selDate.month && k.day == selDate.day);
      if (idx >= 0) initialDayIndex = idx;
    }

    List<DateTime> currentTimeSlots = grouped[dayKeys[initialDayIndex]] ?? [];

    int initialTimeIndex = 0;
    if (_scheduledDeliverySlot != null) {
      final idx = currentTimeSlots.indexWhere((s) =>
          s.hour == _scheduledDeliverySlot!.hour && s.minute == _scheduledDeliverySlot!.minute);
      if (idx >= 0) initialTimeIndex = idx;
    }

    int currentDayIndex = initialDayIndex;
    int currentTimeIndex = initialTimeIndex;
    final timeController = FixedExtentScrollController(initialItem: initialTimeIndex);

    // Selected display badge
    String selectedDisplay = '';
    if (currentTimeSlots.isNotEmpty && currentTimeIndex < currentTimeSlots.length) {
      final slot = currentTimeSlots[currentTimeIndex];
      selectedDisplay = '${dayLabels[currentDayIndex]}, ${slot.hour.toString().padLeft(2, '0')}:${slot.minute.toString().padLeft(2, '0')}';
    }

    return StatefulBuilder(
      builder: (context, setPickerState) {
        currentTimeSlots = grouped[dayKeys[currentDayIndex]] ?? [];
        if (currentTimeIndex >= currentTimeSlots.length) {
          currentTimeIndex = 0;
        }

        if (currentTimeSlots.isNotEmpty) {
          final slot = currentTimeSlots[currentTimeIndex];
          selectedDisplay = '${dayLabels[currentDayIndex]}, ${slot.hour.toString().padLeft(2, '0')}:${slot.minute.toString().padLeft(2, '0')}';
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Selected time badge
            if (_scheduledDeliverySlot != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: _accentColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.schedule, size: 14, color: _accentColor),
                    const SizedBox(width: 6),
                    Text(
                      selectedDisplay,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: _accentColor,
                      ),
                    ),
                  ],
                ),
              ),
            // Cupertino-style wheel picker
            Container(
              height: 150,
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[900] : Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Stack(
                children: [
                  Center(
                    child: Container(
                      height: 36,
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: isDark
                            ? Colors.grey[800]!.withValues(alpha: 0.8)
                            : Colors.grey[300]!.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      // Day picker (left wheel)
                      Expanded(
                        flex: 5,
                        child: CupertinoPicker(
                          scrollController: FixedExtentScrollController(initialItem: currentDayIndex),
                          itemExtent: 40,
                          diameterRatio: 1.5,
                          squeeze: 1.0,
                          useMagnifier: true,
                          magnification: 1.05,
                          selectionOverlay: const SizedBox.shrink(),
                          onSelectedItemChanged: (index) {
                            setPickerState(() {
                              currentDayIndex = index;
                              currentTimeIndex = 0;
                              currentTimeSlots = grouped[dayKeys[currentDayIndex]] ?? [];
                              timeController.jumpToItem(0);
                            });
                            if (currentTimeSlots.isNotEmpty) {
                              final slot = currentTimeSlots[0];
                              setState(() => _scheduledDeliverySlot = slot);
                            }
                          },
                          children: List.generate(dayLabels.length, (index) {
                            final isSelected = index == currentDayIndex;
                            return Center(
                              child: Text(
                                dayLabels[index],
                                style: TextStyle(
                                  fontSize: isSelected ? 18 : 15,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w400,
                                  color: isSelected
                                      ? Theme.of(context).colorScheme.onSurface
                                      : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.35),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 100,
                        color: isDark ? Colors.grey[700] : Colors.grey[300],
                      ),
                      // Time picker (right wheel)
                      Expanded(
                        flex: 4,
                        child: CupertinoPicker(
                          scrollController: timeController,
                          itemExtent: 40,
                          diameterRatio: 1.5,
                          squeeze: 1.0,
                          useMagnifier: true,
                          magnification: 1.05,
                          selectionOverlay: const SizedBox.shrink(),
                          onSelectedItemChanged: (index) {
                            setPickerState(() {
                              currentTimeIndex = index;
                            });
                            if (currentTimeSlots.isNotEmpty && index < currentTimeSlots.length) {
                              final slot = currentTimeSlots[index];
                              setState(() => _scheduledDeliverySlot = slot);
                            }
                          },
                          children: List.generate(currentTimeSlots.length, (index) {
                            final slot = currentTimeSlots[index];
                            final timeStr = '${slot.hour.toString().padLeft(2, '0')}:${slot.minute.toString().padLeft(2, '0')}';
                            final isSelected = index == currentTimeIndex;
                            return Center(
                              child: Text(
                                timeStr,
                                style: TextStyle(
                                  fontSize: isSelected ? 18 : 15,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w400,
                                  color: isSelected
                                      ? Theme.of(context).colorScheme.onSurface
                                      : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.35),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
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

}


// ─────────────────────────────────────────────────────────────────────────────
// 🛒 FULL-PAGE CHECKOUT (replaces the old bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────

class _CheckoutFullPage extends StatefulWidget {
  final double total;
  final double deliveryFee;
  final double couponDiscount;
  final double firstOrderDiscountAmount;
  final double walletApplied;
  final double grandTotal;
  final TextEditingController noteController;
  final TextEditingController couponController;
  final CartState cart;
  final dynamic firebaseUser;
  final dynamic authState;
  final _CartScreenState cartScreenState;

  const _CheckoutFullPage({
    required this.total,
    required this.deliveryFee,
    required this.couponDiscount,
    required this.firstOrderDiscountAmount,
    required this.walletApplied,
    required this.grandTotal,
    required this.noteController,
    required this.couponController,
    required this.cart,
    required this.firebaseUser,
    required this.authState,
    required this.cartScreenState,
  });

  @override
  State<_CheckoutFullPage> createState() => _CheckoutFullPageState();
}

class _CheckoutFullPageState extends State<_CheckoutFullPage> {
  final ScrollController _scrollController = ScrollController();
  bool _hasScrolledForKeyboard = false;

  // Cached futures to prevent re-fetch on every setState (causes tremble)
  late final Future<String?> _bannerTextFuture;
  late final Future<DocumentSnapshot> _userDocFuture;

  // Convenience accessor
  _CartScreenState get parent => widget.cartScreenState;

  @override
  void initState() {
    super.initState();
    _bannerTextFuture = FirstOrderService.getBannerText();
    _userDocFuture = FirebaseFirestore.instance
        .collection('users')
        .doc(widget.firebaseUser?.uid ?? widget.authState.appUser?.uid)
        .get();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    // Auto-scroll when keyboard opens
    if (bottomInset > 0 && !_hasScrolledForKeyboard) {
      _hasScrolledForKeyboard = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      });
    } else if (bottomInset == 0) {
      _hasScrolledForKeyboard = false;
    }

    final accentColor = parent._accentColor;


    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, color: Theme.of(context).colorScheme.onSurface, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Sipariş Özeti',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: _buildStepIndicator(context, accentColor),
        ),
      ),
      body: Column(
        children: [
          // Scrollable content
          Expanded(
            child: GestureDetector(
              onTap: () => FocusScope.of(context).unfocus(),
              child: SingleChildScrollView(
                controller: _scrollController,
                padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 🎉 FIRST ORDER DISCOUNT BANNER (top priority)
                    FutureBuilder<String?>(
                      future: _bannerTextFuture,
                      builder: (context, snap) {
                        if (!snap.hasData || snap.data == null) return const SizedBox.shrink();
                        return Column(
                          children: [
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [const Color(0xFFFF6B6B).withValues(alpha: 0.1), const Color(0xFFFFD93D).withValues(alpha: 0.1)],
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      snap.data!,
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 13, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                        );
                      },
                    ),

                    // 1️⃣ SİPARİŞ DETAYI (Order Items - first)
                    parent._buildCheckoutSectionHeader('', 'Sipariş Detayı'),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          ...widget.cart.items.map<Widget>((item) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              children: [
                                Text('${item.quantity}x', style: TextStyle(color: accentColor, fontWeight: FontWeight.bold, fontSize: 14)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    I18nUtils.getLocalizedText(context, item.product.nameData),
                                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
                                  ),
                                ),
                                Text(
                                  '${item.totalPrice.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600, fontSize: 14),
                                ),
                              ],
                            ),
                          )),
                          const Divider(),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Ara Toplam', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                              Text('${widget.total.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 13)),
                            ],
                          ),
                          if (!parent._isPickUp && !parent._isDineIn) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Teslimat Ücreti', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                Text('${widget.deliveryFee.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 13)),
                              ],
                            ),
                          ],
                          if (parent._appliedCoupon?.isValid == true) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(children: [
                                  const Icon(Icons.local_offer, size: 14, color: Colors.green),
                                  const SizedBox(width: 4),
                                  Text('Kupon İndirimi', style: TextStyle(color: Colors.green[700], fontSize: 13)),
                                ]),
                                Text('-${widget.couponDiscount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Colors.green[700], fontSize: 13, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ],
                          if (widget.firstOrderDiscountAmount > 0) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Hoş Geldin İndirimi', style: TextStyle(color: Colors.orange[700], fontSize: 13)),
                                Text('-${widget.firstOrderDiscountAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Colors.orange[700], fontSize: 13, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ],
                          if (parent._useWallet && widget.walletApplied > 0) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(children: [
                                  const Text('💰', style: TextStyle(fontSize: 14)),
                                  const SizedBox(width: 4),
                                  Text('Cüzdan Bakiyesi', style: TextStyle(color: Colors.green[700], fontSize: 13)),
                                ]),
                                Text('-${widget.walletApplied.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Colors.green[700], fontSize: 13, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ],
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Toplam', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.bold, fontSize: 16)),
                              Text('${widget.grandTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: accentColor, fontWeight: FontWeight.bold, fontSize: 16)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // 2️⃣ TESLİMAT ADRESİ (only for delivery)
                    if (!parent._isPickUp && !parent._isDineIn) ...[
                      parent._buildCheckoutSectionHeader('', 'Teslimat Adresi'),
                      const SizedBox(height: 8),
                      FutureBuilder<DocumentSnapshot>(
                        future: _userDocFuture,
                        builder: (context, snapshot) {
                          if (snapshot.connectionState == ConnectionState.waiting) {
                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                            );
                          }
                          final userData = snapshot.data?.data() as Map<String, dynamic>?;
                          final profileStreet = userData?['address'] ?? '';
                          final profileHouseNumber = userData?['houseNumber'] ?? '';
                          final profilePostalCode = userData?['postalCode'] ?? '';
                          final profileCity = userData?['city'] ?? '';
                          final profileStreetFull = profileHouseNumber.isNotEmpty ? '$profileStreet $profileHouseNumber' : profileStreet;
                          final profileFullAddress = [profileStreetFull, '$profilePostalCode $profileCity'].where((s) => s.trim().isNotEmpty).join(', ');
                          final hasProfileAddress = profileFullAddress.trim().isNotEmpty && profileStreet.toString().trim().isNotEmpty;

                          final displayAddress = parent._selectedDeliveryAddress != null
                              ? [
                                  parent._selectedDeliveryAddress!['houseNumber']!.isNotEmpty 
                                      ? '${parent._selectedDeliveryAddress!['street']} ${parent._selectedDeliveryAddress!['houseNumber']}'
                                      : parent._selectedDeliveryAddress!['street'] ?? '',
                                  '${parent._selectedDeliveryAddress!['postalCode']} ${parent._selectedDeliveryAddress!['city']}'
                                ].where((s) => s.trim().isNotEmpty).join(', ')
                              : profileFullAddress;
                          final hasAddress = parent._selectedDeliveryAddress != null || hasProfileAddress;

                          return GestureDetector(
                            onTap: () => parent._showAddressPickerSheet(
                              context, 
                              setState, 
                              widget.firebaseUser?.uid ?? widget.authState.appUser?.uid ?? '',
                              profileAddress: hasProfileAddress ? {
                                'street': profileStreet.toString(),
                                'houseNumber': profileHouseNumber.toString(),
                                'postalCode': profilePostalCode.toString(),
                                'city': profileCity.toString(),
                              } : null,
                            ),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: !hasAddress ? Border.all(color: Colors.amber.shade300) : null,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    hasAddress ? Icons.location_on : Icons.warning_amber_rounded,
                                    color: hasAddress ? accentColor : Colors.amber,
                                    size: 22,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      hasAddress ? displayAddress : 'Adres bilgisi bulunamadı.\nAdres eklemek için dokunun.',
                                      style: TextStyle(
                                        color: hasAddress ? Theme.of(context).colorScheme.onSurface : Colors.amber.shade700,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  if (hasAddress)
                                    Icon(Icons.edit_outlined, color: Colors.grey[500], size: 18),
                                  if (!hasAddress)
                                    Icon(Icons.add_circle_outline, color: Colors.amber, size: 20),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 20),
                    ],

                    // 3️⃣ TESLİMAT ZAMANI (Delivery time picker)
                    if (!parent._isPickUp && !parent._isDineIn) ...[
                      parent._buildCheckoutSectionHeader('', 'Teslimat Zamanı'),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surface,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: parent._buildDeliveryTimePicker(setState),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // 3️⃣ GEL AL / MASA info
                    if (parent._isPickUp || parent._isDineIn) ...[
                      parent._buildCheckoutSectionHeader('', parent._isDineIn ? 'Masada Sipariş' : 'Gel Al'),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surface,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Icon(parent._isDineIn ? Icons.restaurant : Icons.store, color: accentColor, size: 22),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        parent._butcherData?['companyName'] ?? widget.cart.butcherName ?? 'İşletme',
                                        style: TextStyle(
                                          color: Theme.of(context).colorScheme.onSurface,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                      if (parent._isDineIn && parent._scannedTableNumber != null)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2),
                                          child: Text(
                                            'Masa ${parent._scannedTableNumber}  ✓',
                                            style: TextStyle(
                                              color: Colors.green[700],
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.check_circle, color: Colors.green, size: 20),
                              ],
                            ),
                            // Gel Al: Pickup time
                            if (parent._isPickUp && !parent._isDineIn) ...[
                              const SizedBox(height: 14),
                              const Divider(height: 1),
                              const SizedBox(height: 14),
                              parent._buildPickupTimePicker(setState),
                            ],
                            // Dine-in: Table number
                            if (parent._isDineIn) ...[
                              const SizedBox(height: 12),
                              TextField(
                                controller: parent._tableNumberController,
                                readOnly: parent._scannedTableNumber != null,
                                enabled: parent._scannedTableNumber == null,
                                keyboardType: TextInputType.number,
                                textInputAction: TextInputAction.done,
                                onSubmitted: (_) => FocusScope.of(context).unfocus(),
                                onChanged: parent._scannedTableNumber != null ? null : (val) {
                                  setState(() {
                                    parent._scannedTableNumber = val.trim().isNotEmpty ? val.trim() : null;
                                  });
                                },
                                decoration: InputDecoration(
                                  hintText: parent._scannedTableNumber != null ? 'QR ile belirlendi' : 'Masa numaranızı girin',
                                  hintStyle: TextStyle(color: Colors.grey[500], fontSize: 13),
                                  prefixIcon: Icon(
                                    parent._scannedTableNumber != null ? Icons.lock : Icons.table_bar,
                                    color: parent._scannedTableNumber != null ? Colors.green : accentColor,
                                    size: 20,
                                  ),
                                  filled: true,
                                  fillColor: Theme.of(context).colorScheme.surface,
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: accentColor)),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                  isDense: true,
                                ),
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.onSurface,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // 4️⃣ ÜRÜN BULUNAMAZSA (Item Unavailability)
                    parent._buildCollapsibleUnavailabilitySection(context, setState, widget.cart),
                    const SizedBox(height: 20),

                    // 5️⃣ ÖDEME YÖNTEMİ (Payment Method)
                    parent._buildCheckoutSectionHeader('', 'Ödeme Yöntemi'),
                    const SizedBox(height: 8),
                    // Wallet
                    if (parent._walletBalance > 0) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surface,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Text('💰', style: TextStyle(fontSize: 18)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Cüzdan Bakiyesi', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600, fontSize: 13)),
                                  Text('${parent._walletBalance.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()} mevcut', style: TextStyle(color: Colors.green[700], fontSize: 12)),
                                ],
                              ),
                            ),
                            Switch.adaptive(
                              value: parent._useWallet,
                              activeTrackColor: Colors.green,
                              onChanged: (val) {
                                setState(() => parent._useWallet = val);
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          // Dine-in: payLater
                          if (parent._isDineIn && parent._butcherData?['dineInPaymentMode'] != 'payFirst') ...[
                            GestureDetector(
                              onTap: () {
                                setState(() => parent._paymentMethod = 'payLater');
                              },
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  color: parent._paymentMethod == 'payLater' ? accentColor : Colors.transparent,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.schedule, size: 18, color: parent._paymentMethod == 'payLater' ? Colors.white : Colors.grey[600]),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Sonra Ödeyeceğim',
                                      style: TextStyle(
                                        color: parent._paymentMethod == 'payLater' ? Colors.white : Theme.of(context).colorScheme.onSurface,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 2),
                          ],
                          // Cash / Card pill toggle
                          ThreeDimensionalPillTabBar(
                            selectedIndex: parent._paymentMethod == 'card' ? 1 : 0,
                            onTabSelected: (index) {
                              setState(() => parent._paymentMethod = index == 0 ? 'cash' : 'card');
                            },
                            tabs: [
                              TabItem(
                                title: (parent._isPickUp || parent._isDineIn) ? 'İşletmede Öde' : 'Kapıda Nakit',
                                icon: (parent._isPickUp || parent._isDineIn) ? Icons.store_outlined : Icons.payments_outlined,
                              ),
                              TabItem(
                                title: 'marketplace.pay_by_card'.tr(),
                                icon: Icons.credit_card,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // 6️⃣ KUPON / PROMO KODU
                    parent._buildCheckoutSectionHeader('', 'Kupon / Promo Kodu'),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: widget.couponController,
                            textCapitalization: TextCapitalization.characters,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => FocusScope.of(context).unfocus(),
                            enabled: parent._appliedCoupon?.isValid != true,
                            decoration: InputDecoration(
                              hintText: 'marketplace.enter_coupon'.tr(),
                              hintStyle: TextStyle(color: Colors.grey[500], fontSize: 13),
                              filled: true,
                              fillColor: Theme.of(context).colorScheme.surface,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: accentColor)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              prefixIcon: Icon(Icons.local_offer_outlined, color: Colors.grey[500], size: 20),
                            ),
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14, letterSpacing: 1.2),
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (parent._appliedCoupon?.isValid == true)
                          SizedBox(
                            height: 48,
                            child: OutlinedButton(
                              onPressed: () {
                                setState(() {
                                  parent._appliedCoupon = null;
                                  widget.couponController.clear();
                                });
                              },
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.red,
                                side: const BorderSide(color: Colors.red),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              child: const Icon(Icons.close, size: 20),
                            ),
                          )
                        else
                          SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: parent._isValidatingCoupon ? null : () async {
                                final code = widget.couponController.text.trim();
                                if (code.isEmpty) return;
                                setState(() => parent._isValidatingCoupon = true);
                                final result = await parent._couponService.validateCoupon(
                                  code: code,
                                  orderAmount: widget.total,
                                  businessId: widget.cart.butcherId,
                                  userId: FirebaseAuth.instance.currentUser?.uid,
                                );
                                setState(() {
                                  parent._isValidatingCoupon = false;
                                  parent._appliedCoupon = result;
                                });
                                if (!result.isValid && context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(result.errorMessage ?? 'Geçersiz kupon'), backgroundColor: Colors.red),
                                  );
                                }
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: accentColor,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              child: parent._isValidatingCoupon
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : const Text('Uygula'),
                            ),
                          ),
                      ],
                    ),
                    if (parent._appliedCoupon?.isValid == true)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle, color: Colors.green, size: 18),
                              const SizedBox(width: 6),
                              Text(
                                '${parent._appliedCoupon!.code} uygulandı! -${parent._appliedCoupon!.calculatedDiscount!.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                                style: TextStyle(color: Colors.green[700], fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 20),

                    // 7️⃣ SİPARİŞ NOTU (Order Note - last)
                    parent._buildCheckoutSectionHeader('', 'Sipariş Notu (opsiyonel)'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: widget.noteController,
                      maxLines: 3,
                      minLines: 2,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => FocusScope.of(context).unfocus(),
                      decoration: InputDecoration(
                        hintText: 'Ör: Kapı zili çalışmıyor, lütfen arayın…',
                        hintStyle: TextStyle(color: Colors.grey[500], fontSize: 13),
                        filled: true,
                        fillColor: Theme.of(context).colorScheme.surface,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: accentColor)),
                        contentPadding: const EdgeInsets.all(14),
                      ),
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
          // Bottom submit button
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + MediaQuery.of(context).padding.bottom),
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: GestureDetector(
              onTap: parent._isSubmitting ? null : () {
                // Gel Al: require pickup time
                if (parent._isPickUp && !parent._isDineIn && parent._selectedPickupSlot == null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text('Lütfen bir teslim alma saati seçin'),
                      backgroundColor: Colors.amber,
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  );
                  return;
                }
                // Dine-in: require table number
                if (parent._isDineIn && (parent._scannedTableNumber ?? parent._tableNumberController.text.trim()).isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(tr('orders.please_enter_table_number')),
                      backgroundColor: Colors.amber,
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  );
                  return;
                }
                parent._orderNote = widget.noteController.text;
                Navigator.pop(context);
                parent._submitOrder();
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: parent._isSubmitting ? Colors.grey : accentColor,
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: accentColor.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: parent._isSubmitting
                      ? SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Theme.of(context).colorScheme.surface, strokeWidth: 2.5))
                      : Text(
                          parent._isDineIn && parent._scannedTableNumber != null
                            ? 'Siparişi Gönder · Masa ${parent._scannedTableNumber}'
                            : 'Siparişi Gönder · ${widget.grandTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.surface,
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
  }

  /// Step indicator: ● Sepet (done) → ● Ödeme (current) → ○ Onay
  Widget _buildStepIndicator(BuildContext context, Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        children: [
          _buildStep(context, 'Sepet', 0, accentColor, isDone: true),
          _buildStepConnector(context, accentColor, isDone: true),
          _buildStep(context, 'Ödeme', 1, accentColor, isCurrent: true),
          _buildStepConnector(context, accentColor, isDone: false),
          _buildStep(context, 'Onay', 2, accentColor),
        ],
      ),
    );
  }

  Widget _buildStep(BuildContext context, String label, int index, Color accentColor, {bool isDone = false, bool isCurrent = false}) {
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDone ? accentColor : (isCurrent ? accentColor : Colors.grey.shade300),
              boxShadow: isCurrent ? [
                BoxShadow(color: accentColor.withValues(alpha: 0.3), blurRadius: 8, spreadRadius: 1),
              ] : null,
            ),
            child: Center(
              child: isDone
                  ? const Icon(Icons.check, color: Colors.white, size: 16)
                  : Text(
                      '${index + 1}',
                      style: TextStyle(
                        color: isCurrent ? Colors.white : Colors.grey[600],
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: (isDone || isCurrent) ? accentColor : Colors.grey[500],
              fontSize: 11,
              fontWeight: (isDone || isCurrent) ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepConnector(BuildContext context, Color accentColor, {required bool isDone}) {
    return Container(
      height: 2,
      width: 24,
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDone ? accentColor : Colors.grey.shade300,
        borderRadius: BorderRadius.circular(1),
      ),
    );
  }
}

