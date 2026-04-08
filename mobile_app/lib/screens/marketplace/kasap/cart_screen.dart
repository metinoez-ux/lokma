import 'dart:math';
import 'package:lokma_app/config/app_secrets.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
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
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:lokma_app/providers/cart_provider.dart';

import 'package:lokma_app/providers/auth_provider.dart';
import 'package:lokma_app/models/butcher_product.dart';
import 'package:lokma_app/widgets/order_confirmation_dialog.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'reservation_booking_screen.dart';
import '../../auth/login_bottom_sheet.dart';

import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:lokma_app/services/fcm_service.dart';
import 'package:lokma_app/services/order_service.dart';
import 'package:lokma_app/services/table_group_service.dart';
import 'package:lokma_app/services/table_session_service.dart';
import 'package:lokma_app/providers/table_group_provider.dart';
import 'package:lokma_app/screens/customer/group_table_order_screen.dart';
import 'package:lokma_app/screens/orders/rating_screen.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:lokma_app/models/product_option.dart';
import '../../../utils/currency_utils.dart';
import '../../../services/stripe_payment_service.dart';
import '../../../services/coupon_service.dart';
import '../../../services/first_order_service.dart';
import '../../../services/promotion_engine.dart';
import '../../../services/calendar_service.dart';
import 'delivery_map_picker_screen.dart';

class CartScreen extends ConsumerStatefulWidget {
  final bool initialPickUp;
  final bool initialDineIn;
  final String? initialTableNumber;
  final int initialTab;
  final bool isReservationIntent;
  final String? reservationTabId;
  const CartScreen({super.key, this.initialPickUp = false, this.initialDineIn = false, this.initialTableNumber, this.initialTab = 0, this.isReservationIntent = false, this.reservationTabId});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> with TickerProviderStateMixin {

  late AnimationController _pulseController;
  // ignore: unused_field
  late Animation<double> _pulseAnimation;
  late bool _isPickUp;
  late bool _isDineIn;
  String? _scannedTableNumber; // QR-scanned table number for dine-in
  bool _canDeliver = false;
  bool _checkingDelivery = true; // ignore: unused_field
  String? _paymentMethod; // null = not yet selected (user must choose)
  final TextEditingController _tableNumberController = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = TimeOfDay.now();
  Map<String, dynamic>? _butcherData;
  bool _loadingButcherParams = true; // ignore: unused_field
  bool _isSubmitting = false;
  OpeningHoursHelper? _hoursHelper;
  OpeningHoursHelper? _deliveryHoursHelper;  // Kurye-specific hours
  OpeningHoursHelper? _pickupHoursHelper;    // Gel Al-specific hours
  String _orderNote = '';
  DateTime? _selectedPickupSlot; // 🆕 Selected pickup time for Gel Al
  DateTime? _scheduledDeliverySlot; // 🆕 Scheduled delivery time for Kurye (null = ASAP)
  bool _scheduledInfoDismissed = false; // 🆕 Info note dismiss state
  bool _deliveryTimeExplicitlyChosen = false; // 🆕 No default selection
  bool _wantsScheduledDelivery = false; // 🆕 Tracks user intent: true = schedule, false = asap

  // 🌟 Sponsored Products ("Bir şey mi unuttun?")
  List<Map<String, dynamic>> _sponsoredProductsList = [];
  bool _loadingSponsoredProducts = false; // ignore: unused_field
  final Set<String> _sponsoredItemIds = {}; // Track IDs added from sponsored section

  // 🥤 Gratis İçecek (Free Drink Promotion)
  List<Map<String, dynamic>> _freeDrinkProducts = [];
  bool _loadingFreeDrinks = false; // ignore: unused_field

  // 🎯 Promo Preview loading state
  // ignore: unused_field
  bool _loadingPromoPreview = false;

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

  // 📢 Bağış Yuvarlama (Donation Round-Up)
  double _donationAmount = 0.0; // 0 = kapalı, >0 = seçilen bağış tutarı
  bool _donationEnabled = false; // İşletme planında bağış modülü aktif mi?

  // 🪙 Driver Tip
  double _tipAmount = 0.0;

  // 📍 Precise delivery GPS coordinates (from map picker)
  double? _addressLat;
  double? _addressLng;

  // 🎯 Promotion Engine: user segment + live preview
  String? _userSegment; // 'vip', 'new', 'returning' etc.
  PromotionResult? _promoPreviewResult; // live preview for cart UI

  // ❄️ Cold Chain Banner
  bool _showColdChainBanner = false; // true = show full expanded banner

  // Cart listener subscription (listenManual)
  ProviderSubscription<CartState>? _cartSubscription;

  /// 🎨 BRAND COLOUR - Dynamic resolution per Design System Protocol
  Color get _accentColor {
    final brandColorHex = _butcherData?['brandColor']?.toString();
    if (brandColorHex != null && brandColorHex.isNotEmpty) {
      // Strip '#' and prepend 'FF' for alpha
      final hex = brandColorHex.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    }
    // Fallback to LOKMA brand color
    return const Color(0xFFF41C54);
  }

  @override
  void initState() {
    super.initState();
    _isPickUp = widget.initialPickUp;
    _isDineIn = widget.initialDineIn || widget.isReservationIntent;
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

      // M-3: Listen to cart changes and refresh promo preview
      _cartSubscription = ref.listenManual<CartState>(cartProvider, (prev, next) {
        final prevCount = prev?.items.length ?? 0;
        final nextCount = next.items.length;
        final prevTotal = prev?.totalAmount ?? 0;
        final nextTotal = next.totalAmount;
        // Only refresh if item count or total changed meaningfully
        if (prevCount != nextCount || (prevTotal - nextTotal).abs() > 0.01) {
          _refreshPromoPreview();
        }
      });
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

        // 💚 Check if donation round-up module is enabled via subscription plan
        bool donationFlag = false;
        final planCode = data?['subscriptionPlan'] ?? 'basic';
        try {
          final planQuery = await FirebaseFirestore.instance
              .collection('subscription_plans')
              .where('code', isEqualTo: planCode)
              .limit(1)
              .get();
          if (planQuery.docs.isNotEmpty) {
            final planData = planQuery.docs.first.data();
            donationFlag = planData['features']?['donationRoundUp'] == true;
          }
        } catch (e) {
          debugPrint('Error loading plan features: $e');
        }

        if (!mounted) return;
        setState(() {
          _butcherData = data;
          _loadingButcherParams = false;
          // Create hours helper if hours exist
          if (data != null && data['openingHours'] != null) {
            _hoursHelper = OpeningHoursHelper(data['openingHours']);
          }
          // Mode-specific hours helpers (Kurye / Gel Al)
          if (data != null && data['deliveryHours'] != null) {
            _deliveryHoursHelper = OpeningHoursHelper(data['deliveryHours']);
          }
          if (data != null && data['pickupHours'] != null) {
            _pickupHoursHelper = OpeningHoursHelper(data['pickupHours']);
          }
          // If dine-in and business requires payFirst, reset payment method
          if (_isDineIn && data?['dineInPaymentMode'] == 'payFirst' && _paymentMethod == 'payLater') {
            _paymentMethod = null;
          }
          _donationEnabled = donationFlag;
        });

        // 🎯 Fetch user segment for promotion targeting (CUST-3)
        try {
          final userId = FirebaseAuth.instance.currentUser?.uid;
          if (userId != null) {
            final userDoc = await FirebaseFirestore.instance.collection('users').doc(userId).get();
            if (userDoc.exists && mounted) {
              setState(() {
                _userSegment = userDoc.data()?['segment'] as String?;
              });
            }
          }
        } catch (e) {
          debugPrint('Error fetching user segment: $e');
        }

        // 🎯 Trigger initial promo preview (CUST-4)
        _refreshPromoPreview();
      }
    } catch (e) {
      debugPrint('Error fetching butcher details: $e');
      if (mounted) setState(() => _loadingButcherParams = false);
    }
  }

  /// 🎯 Refresh promotion preview for the current cart (CUST-4)
  Future<void> _refreshPromoPreview() async {
    final cart = ref.read(cartProvider);
    final butcherId = cart.butcherId;
    if (butcherId == null || butcherId.isEmpty || cart.items.isEmpty) {
      if (mounted) setState(() => _promoPreviewResult = null);
      return;
    }

    setState(() => _loadingPromoPreview = true);
    try {
      final activePromos = await PromotionEngine.fetchActivePromotions(butcherId);
      if (activePromos.isNotEmpty && mounted) {
        final cartItemInfos = cart.items.map((item) => CartItemInfo(
          productId: item.product.sku,
          productName: item.product.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity.toInt(),
          category: item.product.category,
        )).toList();

        final deliveryMethod = _isDineIn ? 'dineIn' : (_isPickUp ? 'pickup' : 'delivery');
        final deliveryFee = (!_isPickUp && !_isDineIn ? (_butcherData?['deliveryFee'] as num?)?.toDouble() ?? 2.50 : 0.0);
        final userId = FirebaseAuth.instance.currentUser?.uid ?? '';

        final result = await PromotionEngine.calculateDiscount(
          promotions: activePromos,
          cartItems: cartItemInfos,
          orderSubtotal: cart.totalAmount,
          deliveryFee: deliveryFee,
          deliveryMethod: deliveryMethod,
          businessId: butcherId,
          userId: userId,
          userSegment: _userSegment,
        );

        if (mounted) setState(() => _promoPreviewResult = result);
      } else {
        if (mounted) setState(() => _promoPreviewResult = null);
      }
    } catch (e) {
      debugPrint('PromoPreview error: $e');
    }
    if (mounted) setState(() => _loadingPromoPreview = false);
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

  /// Generate a 4-digit PIN code for precise delivery location verification
  String _generateDeliveryPin() {
    final rng = Random();
    return (1000 + rng.nextInt(9000)).toString(); // 1000–9999
  }

  Future<void> _submitOrder() async {
    if (_isSubmitting) return;
    
    // Guard: Block regular order submission if a group session is active
    final groupState = ref.read(tableGroupProvider);
    if (groupState.session != null && _isDineIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('marketplace.group_order_active_warning'.tr()),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }
    
    final cart = ref.read(cartProvider);
    final authState = ref.read(authProvider);
    final currentUser = authState.appUser;
    
    // Fallback to FirebaseAuth if provider state not synced
    final firebaseUser = FirebaseAuth.instance.currentUser;
    
    if (currentUser == null && firebaseUser == null) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => const LoginBottomSheet(),
      );
      return;
    }

    if (cart.items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('cart.cart_empty'.tr())),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
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

      // ─── Promotion Engine: aktif kampanyaları uygula ───────────────────
      PromotionResult promotionResult = const PromotionResult();
      if (cart.butcherId != null && cart.butcherId!.isNotEmpty) {
        try {
          final activePromos = await PromotionEngine.fetchActivePromotions(cart.butcherId!);
          if (activePromos.isNotEmpty) {
            final cartItemInfos = cart.items.map((item) => CartItemInfo(
              productId: item.product.sku,
              productName: item.product.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity.toInt(),
              category: item.product.category,
            )).toList();

            final deliveryMethod = _isDineIn ? 'dineIn' : (_isPickUp ? 'pickup' : 'delivery');
            promotionResult = await PromotionEngine.calculateDiscount(
              promotions: activePromos,
              cartItems: cartItemInfos,
              orderSubtotal: cart.totalAmount,
              deliveryFee: deliveryFee,
              deliveryMethod: deliveryMethod,
              businessId: cart.butcherId!,
              userId: FirebaseAuth.instance.currentUser?.uid ?? '',
              isFirstOrder: firstOrderDiscount > 0,
              userSegment: _userSegment, // CUST-3: segment-based campaigns
            );
          }
        } catch (e) {
          debugPrint('PromotionEngine error: $e');
        }
      }

      final double promoDiscount = promotionResult.discount;
      final double effectiveDeliveryFee = promotionResult.freeDelivery ? 0.0 : deliveryFee;
      final double subtotalAfterDiscounts = cart.totalAmount + effectiveDeliveryFee - couponDiscount - firstOrderDiscount - promoDiscount;
      // Apply wallet balance if enabled
      final double walletUsed = _useWallet ? (_walletBalance >= subtotalAfterDiscounts ? subtotalAfterDiscounts : _walletBalance) : 0.0;
      final double grandTotal = (subtotalAfterDiscounts - walletUsed).clamp(0.0, double.infinity);
      final double grandTotalWithDonation = grandTotal + _donationAmount + _tipAmount;

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
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('cart.user_info_error'.tr())),
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
                waiterName: '${'customer'.tr()} ($userDisplayName)',
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
          if (item.recipientName != null && item.recipientName!.trim().isNotEmpty) 'recipientName': item.recipientName!.trim(),
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
        'pickupTime': _isPickUp ? Timestamp.fromDate(pickupDateTime) : null,
        // 🆕 Scheduled Delivery
        if (_scheduledDeliverySlot != null && !_isPickUp && !_isDineIn) ...{
          'scheduledDeliveryTime': Timestamp.fromDate(_scheduledDeliverySlot!),
          'isScheduledOrder': true,
          'deliveryDate': Timestamp.fromDate(_scheduledDeliverySlot!),
          'scheduledDateTime': Timestamp.fromDate(_scheduledDeliverySlot!),
        },
        'deliveryAddress': (!_isPickUp && !_isDineIn) ? userAddress : null,
        // 📍 Precise GPS pin coordinates + verification PIN
        if (!_isPickUp && !_isDineIn && _addressLat != null && _addressLng != null) ...{
          'deliveryPinLat': _addressLat,
          'deliveryPinLng': _addressLng,
          'hasPrecisePin': true,
          'deliveryPinCode': _generateDeliveryPin(),
        },
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
        // 💚 Bağış Yuvarlama (Donation Round-Up)
        if (_donationAmount > 0) ...{
          'donationAmount': _donationAmount,
          'hasDonation': true,
        },
        // 🪙 Driver Tip
        if (_tipAmount > 0) ...{
          'tipAmount': _tipAmount,
          'hasTip': true,
          'tipType': 'pre_order',
        },
        // 🎯 Promotion Engine data
        if (promoDiscount > 0) ...{
          'promotionDiscount': promoDiscount,
          'appliedPromotions': promotionResult.appliedPromotions.map((p) => p.toMap()).toList(),
        },
        if (promotionResult.freeDelivery) 'freeDeliveryByPromotion': true,
        if (promotionResult.cashbackAmount > 0) 'cashbackAmount': promotionResult.cashbackAmount,
        'grandTotal': grandTotalWithDonation,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      // Save order
      final orderRef = await FirebaseFirestore.instance.collection('meat_orders').add(orderData);

      // UOIP: Persist orderNumber using First-6-Digit standard for cross-platform consistency
      final orderNumber = orderRef.id.substring(0, 6).toUpperCase();
      await orderRef.update({'orderNumber': orderNumber});

      // CRITICAL FIX (BUG-1): Clear cart immediately after order is persisted.
      // Previously clearCart() was only called via the dialog's OK button callback,
      // meaning if the user navigated away or the app was backgrounded, old items
      // would be restored from SharedPreferences on next launch.
      final cartNotifier = ref.read(cartProvider.notifier);
      cartNotifier.clearCart();

      // Apply coupon usage tracking
      if (_appliedCoupon?.isValid == true && _appliedCoupon!.couponId != null) {
        await _couponService.applyCoupon(
          couponId: _appliedCoupon!.couponId!,
          orderId: orderRef.id,
          userId: userId,
        );
      }

      // 🎯 Promotion usage tracking + cashback credit
      if (promotionResult.hasAnyPromotion && cart.butcherId != null) {
        await PromotionEngine.recordUsage(
          businessId: cart.butcherId!,
          orderId: orderRef.id,
          userId: userId,
          result: promotionResult,
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
        final paymentResult = await StripePaymentService.processPayment(
          amount: grandTotalWithDonation,
          businessId: cart.butcherId!,
          orderId: orderRef.id,
          customerEmail: userEmail.isNotEmpty ? userEmail : null,
          tipAmount: _tipAmount, // §3(51) EStG: tip separated from commission, pooled for driver
        );

        if (!paymentResult.success) {
          if (!paymentResult.wasCancelled && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('marketplace.payment_error'.tr(namedArgs: {'error': paymentResult.error ?? ''}))),
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
      }

      // Show success dialog FIRST — cart clearing is handled ONLY after
      // context.go('/restoran') in OrderConfirmationDialog to avoid
      // rebuilding checkout page with an empty cart (causing black screen).
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (dialogCtx) => OrderConfirmationDialog(
            pickupDate: pickupDateTime,
            businessHours: _hoursHelper?.getHoursStringForDate(pickupDateTime),
            businessName: _butcherData?['companyName'],
            businessType: _butcherData?['type'],
            isPickUp: _isPickUp,
            isDineIn: _isDineIn,
            isScheduledOrder: _scheduledDeliverySlot != null && !_isPickUp && !_isDineIn,
            scheduledDate: _scheduledDeliverySlot,
            onDismiss: () {},
            onClearCart: () {
              // Safety net: cart already cleared above after order save,
              // but call again in case of race conditions
              ref.read(cartProvider.notifier).clearCart();
            },
          ),
        );

        // 📅 Takvim Entegrasyonu — tüm ileri tarihli siparişlerde native takvime ekle
        // Kurye, Gel-Al, Masa Rezervasyonu, Kermes — hepsi destekleniyor
        if (_scheduledDeliverySlot != null) {
          // Capture cart items before clearing
          final calendarItems = cart.items.map((item) => {
            'productName': item.product.name,
            'quantity': item.quantity,
            'totalPrice': item.totalPrice,
          }).toList();
          final calendarDeliveryMethod = _isDineIn ? 'dineIn' : (_isPickUp ? 'pickup' : 'delivery');
          // Small delay so confirmation dialog renders first
          Future.delayed(const Duration(milliseconds: 800), () {
            if (mounted) {
              _showCalendarSavePrompt(
                businessName: cart.butcherName ?? _butcherData?['companyName'] ?? 'LOKMA',
                orderNumber: orderNumber,
                items: calendarItems,
                grandTotal: grandTotalWithDonation,
                deliveryMethod: calendarDeliveryMethod,
              );
            }
          });
        }
      }

    } catch (e) {
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
    _cartSubscription?.close();
    _pulseController.dispose();
    _tableNumberController.dispose();
    super.dispose();
  }

  /// Show calendar save prompt after a scheduled order is placed
  void _showCalendarSavePrompt({
    required String businessName,
    String? orderNumber,
    List<Map<String, dynamic>>? items,
    double? grandTotal,
    String? deliveryMethod,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = _accentColor;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Calendar icon
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: accent.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.calendar_month, color: accent, size: 28),
            ),
            const SizedBox(height: 16),
            Text(
              'checkout.save_to_calendar'.tr(),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 8),
            Text(
              'checkout.calendar_prompt'.tr(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 20),
            // Save button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  if (_isDineIn) {
                    CalendarService.addReservationEvent(
                      context: context,
                      reservationTime: _scheduledDeliverySlot!,
                      businessName: businessName,
                      partySize: 1,
                      tableCardNumbers: _scannedTableNumber != null
                          ? [int.tryParse(_scannedTableNumber!) ?? 0]
                          : null,
                    );
                  } else {
                    CalendarService.addOrderEvent(
                      context: context,
                      deliveryTime: _scheduledDeliverySlot!,
                      businessName: businessName,
                      orderNumber: orderNumber,
                      items: items,
                      grandTotal: grandTotal,
                      deliveryMethod: deliveryMethod,
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: accent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(
                  'checkout.save_calendar'.tr(),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                ),
              ),
            ),
            const SizedBox(height: 8),
            // No thanks
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'checkout.no_thanks'.tr(),
                style: TextStyle(
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Force rebuild on language change
    context.locale;
    final cart = ref.watch(cartProvider);
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    
    // 🍊 LIEFERANDO-STYLE: Theme-aware background with tabs
    return Scaffold(
      backgroundColor: colorScheme.surface,
      resizeToAvoidBottomInset: false,
      appBar: AppBar(
        backgroundColor: colorScheme.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: Padding(
          padding: const EdgeInsets.only(left: 8),
          child: Center(
            child: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                if (GoRouter.of(context).canPop()) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
              child: Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: theme.brightness == Brightness.dark ? Colors.grey[800] : const Color(0xFFF5F5F5),
                  shape: BoxShape.circle,
                  boxShadow: theme.brightness == Brightness.dark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 1))],
                ),
                child: Icon(Icons.arrow_back_ios_new, color: colorScheme.onSurface, size: 18),
              ),
            ),
          ),
        ),
        title: Text(
          'checkout.cart_title'.tr(),
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500, color: colorScheme.onSurface),
        ),
        centerTitle: true,
        bottom: widget.isReservationIntent
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(50),
                child: _buildCheckoutStepIndicator(0),
              ),
      ),
      body: _buildCartTabContent(cart),
    );
  }
  
  /// 🔢 Checkout Step Indicator (1-Sepet, 2-Ödeme, 3-Onay)
  /// [onStepTap] is called when user taps a COMPLETED step to go back.
  /// The tapped step index is passed to the callback.
  Widget _buildCheckoutStepIndicator(int currentStep, {void Function(int)? onStepTap}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = _accentColor;
    final labels = [
      tr('checkout.step_cart'),
      tr('checkout.step_payment'),
      tr('checkout.step_confirm'),
    ];
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(labels.length * 2 - 1, (i) {
          // Odd indices are connecting lines
          if (i.isOdd) {
            final stepBefore = i ~/ 2;
            final isCompleted = stepBefore < currentStep;
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 13),
                child: Container(
                  height: 2,
                  color: isCompleted
                      ? accent
                      : (isDark ? Colors.grey[700] : Colors.grey[300]),
                ),
              ),
            );
          }
          
          // Even indices are step circles
          final step = i ~/ 2;
          final isCompleted = step < currentStep;
          final isActive = step == currentStep;
          
          Widget stepWidget = Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isCompleted
                      ? accent
                      : (isActive
                          ? (isDark ? Colors.grey[800] : Colors.white)
                          : Colors.transparent),
                  border: Border.all(
                    color: isCompleted || isActive
                        ? accent
                        : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                    width: isActive ? 2 : 1.5,
                  ),
                ),
                child: Center(
                  child: isCompleted
                      ? Icon(Icons.check, color: Colors.white, size: 16)
                      : Text(
                          '${step + 1}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isDark
                                ? Colors.white
                                : (isActive ? accent : Theme.of(context).colorScheme.onSurface.withOpacity(0.5)),
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                labels[step],
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isActive || isCompleted ? FontWeight.w500 : FontWeight.w400,
                  color: isActive || isCompleted
                      ? Theme.of(context).colorScheme.onSurface
                      : Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                ),
              ),
            ],
          );
          
          // Only completed steps are tappable (to go back)
          if (isCompleted && onStepTap != null) {
            stepWidget = GestureDetector(
              onTap: () => onStepTap(step),
              behavior: HitTestBehavior.opaque,
              child: stepWidget,
            );
          }
          
          return stepWidget;
        }),
      ),
    );
  }
  
  /// Sepet Tab İçeriği
  Widget _buildCartTabContent(CartState cart) {
    if (widget.reservationTabId != null && cart.items.isEmpty) {
      return _buildActiveTabContent(widget.reservationTabId!);
    }

    if (cart.items.isEmpty) {
      return _buildEmptyCart();
    }
    
    return _buildLieferandoCartContent(cart);
  }

  /// 🍽 Masa Adisyonu (Aktif Adisyon) - Phase 4
  Widget _buildActiveTabContent(String tabId) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collectionGroup('reservations')
          .where(FieldPath.documentId, isEqualTo: tabId)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError || !snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return _buildEmptyCart();
        }

        final doc = snapshot.data!.docs.first;
        final data = doc.data() as Map<String, dynamic>;
        final List<dynamic> rawTabItems = data['tabItems'] ?? [];
        final double pendingBalance = (data['pendingBalance'] as num?)?.toDouble() ?? 0.0;
        final String status = data['paymentStatus'] ?? 'pending';

        if (status == 'paid' || status == 'cash_requested') {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle, size: 64, color: Colors.green),
                const SizedBox(height: 16),
                Text(
                  'Hesabınız alındı.\nAfiyet olsun!',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: textColor,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _accentColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  ),
                  onPressed: () {
                    ref.read(cartProvider.notifier).clearCart();
                    context.go('/restoran');
                  },
                  child: const Text('Ana Sayfaya Dön', style: TextStyle(color: Colors.white, fontSize: 16)),
                )
              ],
            ),
          );
        }

        return Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Center(
                    child: Text(
                      '🍽️ Masa Adisyonunuz',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: textColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: Text(
                      'Siparişleriniz hazırlanıyor veya masanıza servis edildi.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (rawTabItems.isEmpty) ...[
                    const Spacer(),
                    const Center(
                      child: Text('Henüz sipariş vermediniz.', style: TextStyle(color: Colors.grey)),
                    ),
                  ] else ...[
                    Container(
                      decoration: BoxDecoration(
                        color: isDark ? Colors.grey[900] : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
                      ),
                      child: Column(
                        children: [
                          for (int i = 0; i < rawTabItems.length; i++) ...[
                            ListTile(
                              title: Text(
                                '${rawTabItems[i]['quantity']}x ${rawTabItems[i]['name']}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: textColor,
                                ),
                              ),
                              subtitle: rawTabItems[i]['price'] != null 
                                  ? Text(CurrencyUtils.formatCurrency((rawTabItems[i]['price'] as num).toDouble()))
                                  : null,
                              trailing: Text(
                                CurrencyUtils.formatCurrency(((rawTabItems[i]['price'] as num?)?.toDouble() ?? 0.0) * ((rawTabItems[i]['quantity'] as num?)?.toInt() ?? 1)),
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: _accentColor,
                                ),
                              ),
                            ),
                            if (i < rawTabItems.length - 1)
                              Divider(height: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // Bottom Settlement Action Bar
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[900] : Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Genel Toplam',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.grey[300] : Colors.grey[700],
                          ),
                        ),
                        Text(
                          CurrencyUtils.formatCurrency(pendingBalance),
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: textColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _accentColor,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        onPressed: pendingBalance > 0 ? () => _showSettlementOptions(context, pendingBalance, tabId, doc.reference) : null,
                        child: const Text(
                          '💳 Hesabı İste / Öde',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  /// Settlement Option Bottom Sheet
  void _showSettlementOptions(BuildContext context, double pendingBalance, String tabId, DocumentReference docRef) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (c) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 4,
                margin: const EdgeInsets.only(bottom: 24),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Text(
                'Hesabı Nasıl Ödemek İstersiniz?',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 24),
              // Nakit Öde
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.money, color: Colors.green),
                ),
                title: const Text('Nakit (Garson Çağır)', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('Garson masanıza gelip hesabı alacaktır.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  Navigator.pop(context);
                  await _requestCashSettlement(docRef);
                },
              ),
              const Divider(height: 32),
              // Kredi Kartı Öde
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _accentColor.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.credit_card, color: _accentColor),
                ),
                title: const Text('Kredi Kartı ile Şimdi Öde', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('Uygulama üzerinden hızlı ve güvenli ödeme.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  Navigator.pop(context);
                  await _processStripeSettlement(docRef, pendingBalance);
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _requestCashSettlement(DocumentReference docRef) async {
    try {
      showDialog(
        context: context, 
        barrierDismissible: false, 
        builder: (c) => const Center(child: CircularProgressIndicator())
      );
      
      await docRef.update({
        'paymentStatus': 'cash_requested',
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Hesap talebiniz iletildi. Bizi tercih ettiğiniz için teşekkürler!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Hesap istenirken hata oluştu: $e')),
      );
    }
  }

  Future<void> _processStripeSettlement(DocumentReference docRef, double amount) async {
    try {
      showDialog(
        context: context, 
        barrierDismissible: false, 
        builder: (c) => const Center(child: CircularProgressIndicator())
      );
      
      // Simulate API call for Payment Intent
      await Future.delayed(const Duration(seconds: 1));
      
      await docRef.update({
        'paymentStatus': 'paid',
        'tabStatus': 'closed',
        'totalAmount': amount, // Fixate final matched amount
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ödeme başarıyla alındı. Teşekkürler!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ödeme başarısız: $e')),
      );
    }
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
          return Center(child: CircularProgressIndicator(color: _accentColor));
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
                          fontWeight: FontWeight.w500,
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
              backgroundColor: const Color(0xFFEA184A),
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
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 18, fontWeight: FontWeight.w500),
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
              color: Theme.of(context).colorScheme.onSurface.withOpacity(isDark ? 0.2 : 0.04),
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
                                        color: const Color(0xFFEA184A),
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
                                          fontWeight: FontWeight.w500,
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
                          'orders.order_number_label'.tr(namedArgs: {'orderNo': order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}),
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
                            fontWeight: FontWeight.w500,
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
                          'cart.view_order'.tr(),
                          style: TextStyle(
                            color: colorScheme.onSurface,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                        SizedBox(height: 4),
                        // Items and price
                        Text(
                          '${order.items.length} ${'cart.items'.tr()} • ${CurrencyUtils.getCurrencySymbol()}${order.totalAmount.toStringAsFixed(2)}',
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
                        fontWeight: FontWeight.w500,
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
                        backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.grey.shade200,
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
                          fontWeight: FontWeight.w500,
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
                          style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6), fontSize: 14),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '${order.createdAt.hour.toString().padLeft(2, '0')}:${order.createdAt.minute.toString().padLeft(2, '0')}',
                          style: TextStyle(
                            color: colorScheme.onSurface,
                            fontSize: 32,
                            fontWeight: FontWeight.w500,
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
                                fontWeight: FontWeight.w500,
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
                              style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 15, fontWeight: FontWeight.w500),
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
                              style: TextStyle(color: colorScheme.onSurface, fontSize: 15, fontWeight: FontWeight.w500),
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
                            fontWeight: FontWeight.w500,
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
                              'cart.show_on_map'.tr(),
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
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    '${'orders.order_no'.tr()}: ${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
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
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Text(
                              '${CurrencyUtils.getCurrencySymbol()}${order.totalAmount.toStringAsFixed(2)}',
                              style: TextStyle(
                                color: colorScheme.onSurface,
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
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
                              fontWeight: FontWeight.w500,
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
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'cart.helper_can_assist'.tr(),
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
                                        'cart.start_chat'.tr(),
                                        style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 13, fontWeight: FontWeight.w500),
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
    // Provide a default color during initialization or if missing
    if (businessId.isEmpty) return const Color(0xFFEA184A);
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
    return const Color(0xFFEA184A); // Default LOKMA red
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
    final subject = Uri.encodeComponent('orders.support_subject'.tr(namedArgs: {'orderNo': order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}));
    final body = Uri.encodeComponent('orders.support_body'.tr(namedArgs: {'orderNo': order.id, 'business': order.butcherName}));
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
                          fontWeight: FontWeight.w500,
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
                              'ARTIKEL',
                              style: TextStyle(
                                fontFamily: 'Courier',
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF3E2723),
                              ),
                            ),
                          ),
                          SizedBox(
                            width: 40,
                            child: Text(
                              'ANZ.',
                              style: TextStyle(
                                fontFamily: 'Courier',
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF3E2723),
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          SizedBox(
                            width: 60,
                            child: Text(
                              'PREIS',
                              style: TextStyle(
                                fontFamily: 'Courier',
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
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
                              fontWeight: FontWeight.w500,
                              color: const Color(0xFF3E2723),
                            ),
                          ),
                          Text(
                            '${CurrencyUtils.getCurrencySymbol()}${order.totalAmount.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
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
                        'VIELEN DANK!',
                        style: TextStyle(
                          fontFamily: 'Courier',
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
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
            fontWeight: FontWeight.w500,
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
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return '${date.day}. ${months[date.month - 1]}';
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
        return 'orders.status_pending'.tr();
      case OrderStatus.accepted:
        return 'orders.status_accepted'.tr();
      case OrderStatus.preparing:
        return 'orders.status_preparing'.tr();
      case OrderStatus.ready:
        return 'orders.status_ready'.tr();
      case OrderStatus.served:
        return 'orders.status_served'.tr();
      case OrderStatus.onTheWay:
        return 'orders.status_on_the_way'.tr();
      case OrderStatus.delivered:
        return 'orders.status_delivered'.tr();
      case OrderStatus.cancelled:
        return 'orders.status_cancelled'.tr();
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
        nameData: item.name,
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
  
  Widget _buildLieferandoCartContent(CartState cart) {
    final hasKasap = cart.items.isNotEmpty;
    
    // Calculate totals
    final kasapTotal = hasKasap ? cart.totalAmount : 0.0;
    final deliveryFee = (!_isPickUp && !_isDineIn) ? ((_butcherData?['deliveryFee'] as num?)?.toDouble() ?? 2.50) : 0.0;
    final grandTotal = kasapTotal + deliveryFee;
    
    return Stack(
      children: [
        // Scrollable content
        SingleChildScrollView(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 8, bottom: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 🚴 Delivery Info Pill (Lieferando style)
              if (!widget.isReservationIntent)
                _buildLieferandoDeliveryPill(),
              
              // 🏪 Business name — simple right-aligned text (always visible)
              if (hasKasap && _butcherData != null)
                Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 6, bottom: 4, right: 2),
                    child: Text(
                      _butcherData!['companyName'] ?? 'Kasap',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                        fontSize: 13,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ),
                ),
              SizedBox(height: 16),
              
              // ❄️ Cold Chain Banner (Kasap + Kurye only)
              if (hasKasap && _butcherData != null && !_isPickUp && !_isDineIn)
                _buildColdChainBanner(),
              
              // No minimum order bar here - integrated into the checkout button at the bottom
              
              // 🥩 Kasap Items (if any)  
              if (hasKasap) ...[
                ...cart.items.asMap().entries.map((entry) => _buildLieferandoCartItem(entry.value, entry.key + 1)),
                // + Urun Ekle button
                if (cart.butcherId != null && cart.butcherId!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        final mode = _isDineIn ? 'masa' : (_isPickUp ? 'gelal' : 'teslimat');
                        context.push('/kasap/${cart.butcherId}?mode=$mode&addMore=true');
                      },
                      child: Builder(
                        builder: (context) {
                          final isDark = Theme.of(context).brightness == Brightness.dark;
                          final labelColor = isDark ? Colors.white : const Color(0xFF424242);
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.add_rounded,
                                  color: labelColor,
                                  size: 20,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _getAddItemLabel(),
                                  style: TextStyle(
                                    color: labelColor,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                SizedBox(height: 16),
              ],
              // 🎯 Promo Preview Banner (CUST-4) — show discount before placing order
              if (_promoPreviewResult != null && _promoPreviewResult!.hasAnyPromotion) ...[
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 0, vertical: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00C853), Color(0xFF00E676)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF00C853).withOpacity(0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      const Text('🎯', style: TextStyle(fontSize: 22)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'marketplace.promo_applied'.tr(namedArgs: {'count': '${_promoPreviewResult!.appliedPromotions.length}'}),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              [
                                if (_promoPreviewResult!.discount > 0)
                                  'marketplace.promo_discount'.tr(namedArgs: {'amount': '${_promoPreviewResult!.discount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}'}),
                                if (_promoPreviewResult!.freeDelivery)
                                  'marketplace.promo_free_delivery'.tr(),
                                if (_promoPreviewResult!.cashbackAmount > 0)
                                  'marketplace.promo_cashback'.tr(namedArgs: {'amount': '${_promoPreviewResult!.cashbackAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}'}),
                              ].join(' · '),
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              // ⭐ Sponsored Products ("Bir şey mi unuttun?")
              if (_sponsoredProductsList.isNotEmpty) ...[
                SizedBox(height: 8),
                _buildSponsoredProductsSection(),
                SizedBox(height: 16),
              ],

              // 🥤 Gratis İçecek (Free Drink Promotion)
              // -- Threshold logic --
              // freeDrinkEnabled: business data'dan, false ise hiç gösterme
              // freeDrinkMinimumOrder: 0 = her zaman, >0 = eşii aşınca göster
              () {
                final bool freeDrinkEnabled = _butcherData?['freeDrinkEnabled'] != false;
                final double threshold = ((_butcherData?['freeDrinkMinimumOrder'] as num?) ?? 0).toDouble();
                final double cartAmount = kasapTotal;

                if (!freeDrinkEnabled || _freeDrinkProducts.isEmpty) return const SizedBox.shrink();

                // Eşiğe ulaşıldı mı?
                final bool thresholdMet = threshold <= 0 || cartAmount >= threshold;

                // Eşiğe yaklaşılıyor mu? (son 5€ veya tutarın %30'u, hangisi küçüksä)
                final double nudgeWindow = threshold > 0 ? (threshold * 0.3).clamp(1.0, 5.0) : 0;
                final bool nearThreshold = !thresholdMet && threshold > 0 && (threshold - cartAmount) <= nudgeWindow;

                return Column(
                  children: [
                    const SizedBox(height: 8),
                    if (!thresholdMet && threshold > 0)
                      _buildFreeDrinkNudgeBanner(
                        remaining: threshold - cartAmount,
                        threshold: threshold,
                        nearThreshold: nearThreshold,
                      ),
                    if (thresholdMet) ...[
                      _buildFreeDrinkSection(),
                      const SizedBox(height: 16),
                    ],
                  ],
                );
              }(),
              
              // 💰 Price Summary
              _buildLieferandoPriceSummary(kasapTotal, grandTotal),
              
              const SizedBox(height: 120),
            ],
          ),
        ),
        // ─── Floating Bottom Checkout Button + Legal ─────────────────────────
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: Theme.of(context).brightness == Brightness.dark
                    ? [
                        const Color(0xFF1C1C1E).withOpacity(0.0),
                        const Color(0xFF1C1C1E).withOpacity(0.95),
                        const Color(0xFF1C1C1E),
                      ]
                    : [
                        Colors.white.withOpacity(0.0),
                        Colors.white.withOpacity(0.95),
                        Colors.white,
                      ],
                stops: const [0.0, 0.25, 0.5],
              ),
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.04),
                  blurRadius: 12,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      child: _buildScannedTableBanner(),
                    ),
                    // UNIFIED Lieferando Footer (combines banner and button)
                    Builder(
                      builder: (context) {
                    final minOrder = (_butcherData?['minDeliveryOrder'] as num?)?.toDouble() ?? (_butcherData?['minOrderAmount'] as num?)?.toDouble() ?? 10.0;
                    final isDelivery = !_isPickUp && !_isDineIn;
                    final isUnderMin = isDelivery && (grandTotal < minOrder);
                    final remaining = minOrder - grandTotal;
                    
                    final isDark = Theme.of(context).brightness == Brightness.dark;
                    final bottomPadding = MediaQuery.of(context).padding.bottom;
                    
                    if (!isUnderMin) {
                      return Padding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, bottomPadding + 12),
                        child: _buildLieferandoCheckoutButton(grandTotal),
                      );
                    }
                    
                    // Wallet-style: pocket illusion 
                    final infoCardColor = isDark ? const Color(0xFF5A5652) : const Color(0xFFE2E2E2);
                    final infoTextColor = isDark ? Colors.white : const Color(0xFF1A1A1A);
                    final infoIconColor = infoTextColor;
                    
                    // Layer 2 (Front Lip): Empty, thinner, sits in front
                    // We use surface color so it seamlessly blends into the solid part of the gradient.
                    final shadowStripColor = Theme.of(context).colorScheme.surface;

                    final cartButtonHeight = 54.0; 
                    final textRowHeight = 30.0;
                    final frontLipHeight = 10.0;

                    return Container(
                      margin: const EdgeInsets.only(top: 0),
                      height: cartButtonHeight + textRowHeight + frontLipHeight + bottomPadding + 12,
                      child: Stack(
                        alignment: Alignment.bottomCenter,
                        clipBehavior: Clip.none,
                        children: [
                          // Layer 1 (Back Wall): Dark wallet card holding the text
                          Positioned(
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              padding: const EdgeInsets.only(top: 8, left: 16, right: 16),
                              decoration: BoxDecoration(
                                color: infoCardColor,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                              ),
                              alignment: Alignment.topCenter,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.pedal_bike,
                                    size: 16,
                                    color: infoIconColor,
                                  ),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Text(
                                      'marketplace.min_order_add_text'.tr(namedArgs: {
                                        'amount': remaining.toStringAsFixed(2),
                                        'currency': CurrencyUtils.getCurrencySymbol(),
                                        'minOrder': minOrder.toStringAsFixed(0),
                                      }),
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: infoTextColor,
                                      ),
                                      textAlign: TextAlign.center,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Layer 2 (Front Lip): Empty, thinner light grey card
                          Positioned(
                            top: textRowHeight, 
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              decoration: BoxDecoration(
                                color: shadowStripColor,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                              ),
                            ),
                          ),
                          // Layer 3 (Front): Cart button floating inside the Front Lip
                          Positioned(
                            bottom: bottomPadding + 10,
                            left: 16, 
                            right: 16,
                            child: _buildLieferandoCheckoutButton(grandTotal, isUnderMin: true),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  ],
);
  }
  
  String? _getEstimatedDeliveryTime() {
    if (_butcherData == null) return null;
    final deliveryMin = _butcherData!['estimatedDeliveryMin'] as int?;
    final deliveryMax = _butcherData!['estimatedDeliveryMax'] as int?;
    final unit = tr('delivery_modes.minutes_short');
    if (deliveryMin != null && deliveryMax != null) return '$deliveryMin-$deliveryMax $unit';
    if (deliveryMin != null) return '~$deliveryMin $unit';
    return '20-40 $unit';
  }

  String? _getEstimatedPickupTime() {
    if (_butcherData == null) return null;
    final pickupMin = _butcherData!['estimatedPickupMinutes'] as int?;
    final unit = tr('delivery_modes.minutes_short');
    if (pickupMin != null) return '~$pickupMin $unit';
    return '~15 $unit';
  }

  String? _getEstimatedDineInTime() {
    if (_butcherData == null) return null;
    final dineInMin = _butcherData!['estimatedDineInMinutes'] as int?;
    final unit = tr('delivery_modes.minutes_short');
    if (dineInMin != null) return '~$dineInMin $unit';
    return '~10 $unit';
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
              'cart.pickup'.tr(),
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w500,
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
        margin: EdgeInsets.zero,
        activeColor: _accentColor, // 🎨 BRAND COLOUR toggle
        selectedIndex: _isPickUp ? 1 : 0,
        onTabSelected: (index) {
          setState(() {
            _isPickUp = index == 1;
            _isDineIn = false;
            if (_paymentMethod == 'payLater') _paymentMethod = null;
          });
        },
        tabs: [
          TabItem(
            title: tr('delivery_modes.delivery'),
            subtitle: _getEstimatedDeliveryTime(),
            icon: Icons.delivery_dining,
          ),
          TabItem(
            title: tr('delivery_modes.pickup'),
            subtitle: _getEstimatedPickupTime(),
            icon: Icons.shopping_bag_outlined,
          ),
        ],
      );
    }
    
    // Restaurant: Kurye / Gel Al / Masa
    return ThreeDimensionalPillTabBar(
      margin: EdgeInsets.zero,
      activeColor: _accentColor, // 🎨 BRAND COLOUR toggle
      selectedIndex: _isDineIn ? 2 : (_isPickUp ? 1 : 0),
      onTabSelected: (index) {
        setState(() {
          _isPickUp = index == 1;
          _isDineIn = index == 2;
          if (_isDineIn) {
            _paymentMethod = (_butcherData?['dineInPaymentMode'] == 'payFirst') ? 'cash' : 'payLater';
          } else {
            _scannedTableNumber = null;
            _tableNumberController.clear();
            if (_paymentMethod == 'payLater') _paymentMethod = null;
          }
        });
      },
      tabs: [
        TabItem(
          title: tr('delivery_modes.delivery'),
          subtitle: _getEstimatedDeliveryTime(),
          icon: Icons.delivery_dining,
        ),
        TabItem(
          title: tr('delivery_modes.pickup'),
          subtitle: _getEstimatedPickupTime(),
          icon: Icons.shopping_bag_outlined,
        ),
        TabItem(
          title: tr('delivery_modes.dine_in'), 
          subtitle: _getEstimatedDineInTime(),
          icon: Icons.restaurant,
        ),
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
              color: const Color(0xFF4FC3F7).withOpacity(0.4),
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
                      const Color(0xFF4FC3F7).withOpacity(0.2),
                      const Color(0xFF0288D1).withOpacity(0.1),
                    ],
                  ),
                  shape: BoxShape.circle,
                ),
                child: const Text('❄️', style: TextStyle(fontSize: 32)),
              ),
              const SizedBox(height: 16),
              Text(
                'marketplace.cold_chain_delivery'.tr(),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Unsere Fleischprodukte werden in speziellen Schutzboxen geliefert, ohne die Kühlkette zu unterbrechen.\n\nWährend der Lieferung bleiben Ihre Produkte gekühlt und frisch.',
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
                  child: Text('common.understood'.tr(), style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
  
  /// Returns context-dependent label for the "+ Add" button
  /// Market -> "Urun Ekle" / "Produkt hinzufugen"
  /// Yemek/Kermes -> "Menuden Ekle" / "Aus dem Menu hinzufugen"
  String _getAddItemLabel() {
    final bType = _butcherData?['type']?.toString().toLowerCase() ??
                  _butcherData?['businessType']?.toString().toLowerCase() ?? '';
    final isMarket = bType == 'market' || bType == 'supermarket' || bType == 'grocery';
    final locale = context.locale.languageCode;
    if (isMarket) {
      // Market segment
      const map = {
        'tr': 'Urun Ekle',
        'de': 'Produkt hinzufugen',
        'en': 'Add Product',
        'es': 'Agregar producto',
        'fr': 'Ajouter un produit',
        'it': 'Aggiungi prodotto',
        'nl': 'Product toevoegen',
      };
      return map[locale] ?? map['de']!;
    } else {
      // Yemek / Kermes segment
      const map = {
        'tr': 'Menuden Ekle',
        'de': 'Aus dem Menu hinzufugen',
        'en': 'Add from Menu',
        'es': 'Agregar del menu',
        'fr': 'Ajouter du menu',
        'it': 'Aggiungi dal menu',
        'nl': 'Toevoegen uit menu',
      };
      return map[locale] ?? map['de']!;
    }
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
          gradient: LinearGradient(
            colors: isDark
                ? [const Color(0xFF0D3B66), const Color(0xFF1A5276)]
                : [const Color(0xFF4FC3F7), const Color(0xFF0288D1)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Center(child: Text('\u2744\uFE0F', style: TextStyle(fontSize: 16))),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'marketplace.cold_chain_delivery'.tr(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'marketplace.cold_chain_short_desc'.tr(),
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.85),
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
                  color: Colors.white.withOpacity(0.7),
                  size: 16,
                ),
              ),
            ),
          ],
        ),
      );
    }
    
    // Show collapsed inline pill (after dismissal)
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF0D3B66).withOpacity(0.6)
            : const Color(0xFF4FC3F7).withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('\u2744\uFE0F', style: TextStyle(fontSize: 12)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              'marketplace.cold_chain_label'.tr(),
              style: TextStyle(
                color: isDark ? const Color(0xFF81D4FA) : const Color(0xFF0277BD),
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
  

  
  /// Section header (e.g., restaurant name)
  Widget _buildLieferandoSectionHeader(String title, {String? subtitle}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : const Color(0xFFF8F8F8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : const Color(0xFFEEEEEE),
        ),
      ),
      child: Row(
        children: [
          // Store icon
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[800] : Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isDark ? Colors.grey[700]! : const Color(0xFFE0E0E0),
              ),
            ),
            child: Icon(
              Icons.storefront_outlined,
              size: 18,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (subtitle != null && subtitle.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      subtitle,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
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
    final imageUrl = item.product.imageUrl;
    
    // Quantity display text
    final qtyText = isKg 
        ? (quantity >= 1.0 
            ? '${quantity.toStringAsFixed(quantity == quantity.roundToDouble() ? 0 : 1)} kg'
            : '${(quantity * 1000).toInt()}g')
        : '${quantity.toInt()}';
    
    return Column(
      children: [
        // ── Spacious row with image: Lieferando-inspired ──
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 🖼️ Product Image Thumbnail
              if (imageUrl != null && imageUrl.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    width: 52,
                    height: 52,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.grey[800] : Colors.grey[100],
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.restaurant, color: Colors.grey[400], size: 24),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.grey[800] : Colors.grey[100],
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.restaurant, color: Colors.grey[400], size: 24),
                    ),
                  ),
                ),
              if (imageUrl != null && imageUrl.isNotEmpty)
                const SizedBox(width: 10),
              
              // Product Info + Controls
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Row 1: Product name + Price
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // #N Position number — plain dark gray
                        Padding(
                          padding: const EdgeInsets.only(top: 2, right: 8),
                          child: Text(
                            '#$positionNumber',
                            style: TextStyle(
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
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
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              // Selected options (if any)
                              if (item.selectedOptions.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 3),
                                  child: Text(
                                    item.selectedOptions.map((o) => o.optionName).join(', '),
                                    style: TextStyle(color: Colors.grey[500], fontSize: 12),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              // 🥤 Free drink badge
                              if (item.isFreeDrink)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF4CAF50).withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.card_giftcard, size: 13, color: Color(0xFF4CAF50)),
                                        SizedBox(width: 4),
                                        Text(
                                          'Gratis',
                                          style: TextStyle(fontSize: 11, color: Color(0xFF4CAF50), fontWeight: FontWeight.w500),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          '${totalPrice.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontWeight: FontWeight.w500,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // Row 2: Note button (left) + Delete + Quantity pill (right)
                    Row(
                      children: [
                        // Note button — subtle chip style (Lieferando reference)
                        GestureDetector(
                          onTap: () => _showNoteDialog(item),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                            decoration: BoxDecoration(
                              color: isDark ? Colors.grey[900] : Colors.grey[50],
                              border: Border.all(
                                color: isDark ? Colors.grey[700]! : const Color(0xFFEFEEEA),
                              ),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  (item.note != null && item.note!.isNotEmpty) ||
                                      (item.recipientName != null && item.recipientName!.isNotEmpty)
                                      ? Icons.edit_note
                                      : Icons.note_add_outlined,
                                  size: 12,
                                  color: isDark ? Colors.grey[500] : const Color(0xFF3E3E3E),
                                ),
                                const SizedBox(width: 3),
                                Flexible(
                                  child: Text(
                                    _buildNoteDisplayText(item),
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w400,
                                      color: (item.note != null && item.note!.isNotEmpty) ||
                                              (item.recipientName != null && item.recipientName!.isNotEmpty)
                                          ? (isDark ? Colors.grey[300] : const Color(0xFF3E3E3E))
                                          : (isDark ? Colors.grey[500] : const Color(0xFF3E3E3E)),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const Spacer(),
                        // 🗑️ Delete icon
                        GestureDetector(
                          onTap: () {
                            HapticFeedback.mediumImpact();
                            ref.read(cartProvider.notifier).removeFromCart(item.uniqueKey);
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(6),
                            child: Icon(
                              Icons.delete_outline,
                              color: isDark ? Colors.grey[400] : Colors.grey[500],
                              size: 20,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // 🔢 Quantity Pill — Lieferando style: single beige pill with flat text
                        Container(
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFFEA184A).withOpacity(0.15) : const Color(0xFFF5F0E8),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: isDark ? const Color(0xFFEA184A).withOpacity(0.4) : const Color(0xFFE8E0D0),
                              width: 0.5,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // Minus button — flat text style
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
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  child: Text(
                                    '–',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w500,
                                      color: isDark ? Colors.white : const Color(0xFF3E3E3E),
                                    ),
                                  ),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 6),
                                child: Text(
                                  qtyText,
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurface,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                              // Plus button — flat text style
                              GestureDetector(
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  ref.read(cartProvider.notifier).updateQuantity(
                                    item.uniqueKey,
                                    isKg ? quantity + 0.5 : quantity + 1,
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  child: Text(
                                    '+',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w500,
                                      color: isDark ? Colors.white : const Color(0xFF3E3E3E),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Subtle divider between items
        Divider(
          height: 1,
          thickness: 1,
          color: isDark ? Colors.grey[800] : const Color(0xFFE8E8E8),
        ),
      ],
    );
  }

  /// Helper to build combined note display text from recipient + food note
  String _buildNoteDisplayText(CartItem item) {
    final hasRecipient = item.recipientName != null && item.recipientName!.isNotEmpty;
    final hasNote = item.note != null && item.note!.isNotEmpty;
    if (_isDineIn) {
      // Masa mode: only show food note
      return hasNote ? item.note! : 'cart.food_note'.tr();
    }
    if (hasRecipient && hasNote) {
      return '${item.recipientName!} · ${item.note!}';
    } else if (hasRecipient) {
      return item.recipientName!;
    } else if (hasNote) {
      return item.note!;
    }
    return 'cart.add_note'.tr();
  }

  /// 📝 Note bottom sheet for a specific cart item — Cyg-inspired design
  void _showNoteDialog(CartItem item) {
    final recipientController = TextEditingController(text: item.recipientName ?? '');
    final noteController = TextEditingController(text: item.note ?? '');
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom,
            ),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A28) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Drag handle ──
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.grey[600] : Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  
                  // ── Title ──
                  Text(
                    _isDineIn ? 'cart.food_note'.tr() : 'cart.your_note'.tr(),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // ═══════════════════════════════════════
                  // FIELD 1: Kimin için? (Recipient Name)
                  // Hidden in Masa/dine-in mode
                  // ═══════════════════════════════════════
                  if (!_isDineIn) ...[
                  Text(
                    'cart.note_recipient_label'.tr(),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'cart.note_recipient_hint_desc'.tr(),
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[400] : Colors.grey[500],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A28) : const Color(0xFFF5F0E8),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: TextField(
                      controller: recipientController,
                      maxLength: 40,
                      maxLines: 1,
                      autofocus: false,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 15,
                      ),
                      onChanged: (_) => setSheetState(() {}),
                      decoration: InputDecoration(
                        hintText: 'cart.note_recipient_placeholder'.tr(),
                        hintStyle: TextStyle(
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                          fontSize: 14,
                        ),
                        prefixIcon: Icon(
                          Icons.person_outline,
                          color: isDark ? Colors.grey[500] : Colors.grey[400],
                          size: 20,
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ],
                  
                  // ═══════════════════════════════════════
                  // FIELD 2: Yemek Notu (Food Note)
                  // ═══════════════════════════════════════
                  Text(
                    'cart.note_food_label'.tr(),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'cart.note_allergy_disclaimer'.tr(),
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[400] : Colors.grey[500],
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  
                  // ── Character counter ──
                  Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      '${noteController.text.length}/160',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.grey[500] : Colors.grey[400],
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  
                  // ── Text input ──
                  Container(
                    constraints: const BoxConstraints(minHeight: 80),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A28) : const Color(0xFFF5F0E8),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: TextField(
                      controller: noteController,
                      maxLength: 160,
                      maxLines: 3,
                      minLines: 2,
                      autofocus: false,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 15,
                      ),
                      onChanged: (_) => setSheetState(() {}),
                      decoration: InputDecoration(
                        hintText: 'cart.note_placeholder'.tr(),
                        hintStyle: TextStyle(
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                          fontSize: 14,
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.all(16),
                        counterText: '', // hide default counter
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  // ── Action buttons ──
                  Row(
                    children: [
                      // Cancel / Delete
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            if ((item.note != null && item.note!.isNotEmpty) ||
                                (item.recipientName != null && item.recipientName!.isNotEmpty)) {
                              ref.read(cartProvider.notifier).updateNote(item.uniqueKey, null);
                              ref.read(cartProvider.notifier).updateRecipientName(item.uniqueKey, null);
                            }
                            Navigator.pop(ctx);
                          },
                          child: Container(
                            height: 50,
                            alignment: Alignment.center,
                            child: Text(
                              'common.cancel'.tr(),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Save
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            final noteText = noteController.text.trim();
                            final recipientText = recipientController.text.trim();
                            ref.read(cartProvider.notifier).updateNote(
                              item.uniqueKey,
                              noteText.isEmpty ? null : noteText,
                            );
                            ref.read(cartProvider.notifier).updateRecipientName(
                              item.uniqueKey,
                              recipientText.isEmpty ? null : recipientText,
                            );
                            Navigator.pop(ctx);
                          },
                          child: Container(
                            height: 50,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: (noteController.text.trim().isNotEmpty || recipientController.text.trim().isNotEmpty)
                                  ? const Color(0xFF3E3E40)
                                  : (isDark ? Colors.grey[800] : Colors.grey[200]),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Text(
                              'common.save'.tr(),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: (noteController.text.trim().isNotEmpty || recipientController.text.trim().isNotEmpty)
                                    ? Colors.white
                                    : (isDark ? Colors.grey[500] : Colors.grey[400]),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
  
  /// ⭐ Sponsored Products — "Bir şey mi unuttun?" (Lieferando "Gesponsert" style)
  Widget _buildSponsoredProductsSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cart = ref.read(cartProvider);
    final butcherId = cart.butcherId ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2A2520) : const Color(0xFFDBE0A9),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Header — Lieferando "Schon gesehen?" style
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'marketplace.forgot_something_de'.tr(),
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                Text(
                  'marketplace.sponsored_de'.tr(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    color: isDark ? Colors.grey[500] : Colors.grey[400],
                  ),
                ),
              ],
            ),
          ),

          // Horizontal Product Cards
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
                    color: isDark ? const Color(0xFF2A2A28) : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product Image with + overlay button
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
                                  color: isDark ? Colors.grey[700] : Colors.grey[800],
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.2),
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
                                  fontWeight: FontWeight.w500,
                                  color: isDark ? Colors.white : Colors.black87,
                                  height: 1.2,
                                ),
                              ),
                              Spacer(),
                              Text(
                                'ab ${price.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
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
      ),
    );
  }

  /// Helper: Add a sponsored product to cart
  void _addSponsoredProduct(Map<String, dynamic> product, int index, String butcherId) {
    HapticFeedback.lightImpact();
    final name = product['name'] is String ? product['name'] as String : (product['name'] is Map ? (product['name']['tr'] ?? product['name'].values.first ?? '').toString() : '');
    final price = product['price'] as double;
    final unit = product['unit'] as String;
    final imageUrl = (product['imageUrl'] as String?) ?? '';

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
        content: Text('marketplace.added_to_cart'.tr(args: [name])),
        duration: Duration(seconds: 2),
        backgroundColor: Theme.of(context).colorScheme.onSurface,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  /// 🥤 FREE DRINK NUDGE BANNER — Eşiğe ulaşılmadığında "X daha ekle" banner'ı
  Widget _buildFreeDrinkNudgeBanner({
    required double remaining,
    required double threshold,
    required bool nearThreshold,
  }) {
    final locale = context.locale.languageCode;
    final currency = CurrencyUtils.getCurrencySymbol();
    final remainingStr = remaining.toStringAsFixed(2);

    final msgMap = {
      'tr': '🥤 ${remainingStr}$currency daha ekle → siparişine bizden bedava içecek!',
      'de': '🥤 Noch ${remainingStr}$currency hinzufügen → Gratis Getränk inklusive!',
      'en': '🥤 Add ${remainingStr}$currency more → get a free drink on us!',
      'es': '🥤 Añade ${remainingStr}$currency más → ¡bebida gratis incluida!',
      'fr': '🥤 Ajoutez encore ${remainingStr}$currency → boisson gratuite offerte!',
      'it': '🥤 Aggiungi ancora ${remainingStr}$currency → bibita gratis inclusa!',
      'nl': '🥤 Voeg nog ${remainingStr}$currency toe → gratis drankje inbegrepen!',
    };
    final msg = msgMap[locale] ?? msgMap['de']!;
    final progress = (1.0 - (remaining / threshold)).clamp(0.0, 1.0);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: nearThreshold
              ? [const Color(0xFF064E3B), const Color(0xFF065F46)]
              : [const Color(0xFF1F2937), const Color(0xFF111827)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: nearThreshold
              ? const Color(0xFF10B981).withOpacity(0.8)
              : const Color(0xFF374151),
          width: nearThreshold ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            msg,
            style: TextStyle(
              color: nearThreshold ? const Color(0xFF6EE7B7) : const Color(0xFF9CA3AF),
              fontSize: 13,
              fontWeight: nearThreshold ? FontWeight.w500 : FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 5,
              backgroundColor: const Color(0xFF374151),
              valueColor: AlwaysStoppedAnimation<Color>(
                nearThreshold ? const Color(0xFF10B981) : const Color(0xFF4B5563),
              ),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${(progress * 100).toStringAsFixed(0)}%',
                style: TextStyle(
                  fontSize: 10,
                  color: nearThreshold ? const Color(0xFF10B981) : const Color(0xFF6B7280),
                ),
              ),
              Text(
                '€${threshold.toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
              ),
            ],
          ),
        ],
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
      'tr': '1 İçecek Bedava!',
      'de': '1 Getränk Gratis!',
      'en': '1 Free Drink!',
      'es': '1 Bebida Gratis!',
      'fr': '1 Boisson Gratuite!',
      'it': '1 Bibita Gratis!',
      'nl': '1 Drankje Gratis!',
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
            Color(0xFF065F46).withOpacity(isDark ? 0.6 : 0.15),
            Color(0xFF0D9488).withOpacity(isDark ? 0.4 : 0.10),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Color(0xFF10B981).withOpacity(isDark ? 0.4 : 0.3),
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
                      color: Color(0xFF10B981).withOpacity(0.3),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                  child: Center(
                    child: Icon(Icons.card_giftcard, size: 22, color: Color(0xFF4CAF50)),
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
                        fontWeight: hasFreeDrink ? FontWeight.w500 : FontWeight.w500,
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
                      color: Color(0xFF10B981).withOpacity(0.3),
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
                final imageUrl = (product['imageUrl'] as String?) ?? '';
                final productId = product['id'] as String;

                // Check if this is the currently selected free drink
                final isSelected = hasFreeDrink && cart.freeDrinkItem?.product.id == productId;

                return GestureDetector(
                  onTap: () => _addFreeDrinkToCart(product, butcherId),
                  child: Container(
                    width: 120,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? Color(0xFF10B981).withOpacity(isDark ? 0.25 : 0.15)
                          : (isDark ? Color(0xFF1A2E28) : Colors.white),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected
                            ? Color(0xFF10B981)
                            : (isDark ? Colors.grey[700]! : Colors.grey[200]!),
                        width: isSelected ? 2 : 1,
                      ),
                      boxShadow: isSelected
                          ? [BoxShadow(color: Color(0xFF10B981).withOpacity(0.2), blurRadius: 8)]
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
                                  fontWeight: FontWeight.w500,
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
                                      fontWeight: FontWeight.w500,
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
                  color: isDark ? Colors.white38 : Color(0xFF065F46).withOpacity(0.6),
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
    final imageUrl = (product['imageUrl'] as String?) ?? '';

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
  Widget _buildLieferandoPriceSummary(double kasapTotal, double grandTotal) {
    return Column(
      children: [
        SizedBox(height: 8),
        // Subtotal
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'checkout.subtotal'.tr(),
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
            ),
            Text(
              '${kasapTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
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
                'cart.delivery_fee'.tr(),
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6), fontSize: 14),
              ),
              Text(
                '${(_butcherData!['deliveryFee'] as num).toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6), fontSize: 14),
              ),
            ],
          ),
          SizedBox(height: 8),
        ],
      ],
    );
  }
  
  /// 🕒 Append items to an active reservation tab (Phase 2)
  Future<void> _appendItemsToTab() async {
    final cartState = ref.read(cartProvider);
    if (cartState.butcherId == null || widget.reservationTabId == null || cartState.items.isEmpty) return;

    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => const Center(child: CircularProgressIndicator()),
      );

      final newItems = cartState.items.map((e) => e.toMap()).toList();
      final addedAmount = cartState.totalAmount;

      final docRef = FirebaseFirestore.instance
          .collection('businesses')
          .doc(cartState.butcherId)
          .collection('reservations')
          .doc(widget.reservationTabId);

      await FirebaseFirestore.instance.runTransaction((transaction) async {
        final snapshot = await transaction.get(docRef);
        if (!snapshot.exists) throw Exception('Tab not found');

        final existingItems = List<dynamic>.from(snapshot.data()?['tabItems'] ?? []);
        existingItems.addAll(newItems);

        final pendingBalance = (snapshot.data()?['pendingBalance'] as num?)?.toDouble() ?? 0.0;

        transaction.update(docRef, {
          'tabItems': existingItems,
          'pendingBalance': pendingBalance + addedAmount,
        });
      });

      // Clear the cart
      ref.read(cartProvider.notifier).clearCart();

      if (!mounted) return;
      Navigator.pop(context); // Close loading dialog
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Siparişiniz adisyona eklendi!'),
          backgroundColor: Colors.green,
        ),
      );

    } catch (e) {
      if (mounted) Navigator.pop(context); // Close loading dialog
      debugPrint('Error appending to tab: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// 🟠 Orange Checkout Button (Lieferando pill style)
  Widget _buildLieferandoCheckoutButton(double total, {bool isUnderMin = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isUnderMin 
        ? (isDark ? const Color(0xFF38383A) : const Color(0xFFE0E0E0)) // Slightly lighter than background to differentiate
        : _accentColor;
    final textColor = isUnderMin 
        ? (isDark ? Colors.white54 : Colors.black54) 
        : Theme.of(context).colorScheme.surface;

    return GestureDetector(
      onTap: () {
        if (isUnderMin) return;
        
        // 🏨 MASA REZERVASYONU ÖN SİPARİŞ VEYA ADİSYON (PHASE 2)
        if (widget.isReservationIntent) {
          if (widget.reservationTabId != null) {
            _appendItemsToTab();
            return;
          }

          final cartState = ref.read(cartProvider);
          if (cartState.butcherId != null) {
             Navigator.push(
               context,
               MaterialPageRoute(
                 builder: (context) => ReservationBookingScreen(
                   businessId: cartState.butcherId!,
                   businessName: cartState.butcherName ?? '',
                   isPreOrder: true,
                   requirePreorderPayment: _butcherData?['reservationConfig']?['requirePreorderPayment'] == true,
                 ),
               ),
             );
          }
          return;
        }

        // 🪑 DINE-IN QR GATE: Require QR scan before checkout
        if (_isDineIn && _scannedTableNumber == null) {
          _showQrScanSheet();
          return;
        }
        _showCheckoutSheet(total);
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(28),
          boxShadow: isUnderMin ? null : [
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
                Icon(Icons.qr_code_scanner, color: textColor, size: 20),
                const SizedBox(width: 8),
              ],
              Text(
                widget.isReservationIntent
                    ? (widget.reservationTabId != null ? 'Siparişi Adisyona Ekle' : 'masa_action_reserve'.tr())
                    : (_isDineIn && _scannedTableNumber == null)
                        ? tr('checkout.scan_table_qr', namedArgs: {'total': '${total.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}'})
                        : tr('checkout.proceed', namedArgs: {'total': '${total.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}'}),
                style: TextStyle(
                  color: textColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (!(_isDineIn && _scannedTableNumber == null)) ...[
                const SizedBox(width: 8),
                Icon(isUnderMin ? Icons.lock_outline : Icons.arrow_forward_rounded, color: textColor, size: 18),
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
            color: isDark ? const Color(0xFF2A2A28) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3),
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
                'QR-Code am Tisch scannen',
                style: TextStyle(
                  fontSize: 20, 
                  fontWeight: FontWeight.w500,
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
        backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.restaurant, color: _accentColor, size: 24),
            const SizedBox(width: 8),
            Text(
              'cart.table_number'.tr(),
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
            fontWeight: FontWeight.w500,
            color: isDark ? Colors.white : Colors.black87,
          ),
          textAlign: TextAlign.center,
          decoration: InputDecoration(
            hintText: 'cart.example_hint'.tr(),
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
            child: Text('common.cancel'.tr(), style: TextStyle(color: Colors.grey[500])),
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
    final businessName = _butcherData?['name'] ?? 'common.business'.tr();
    
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
      backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.white,
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
              'cart.table_group_order'.tr(namedArgs: {'tableNum': '$tableNum'}),
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'marketplace.group_order_active_info'.tr(namedArgs: {'count': '$participantCount'}),
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
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w500, letterSpacing: 12),
              decoration: InputDecoration(
                hintText: '• • • •',
                counterText: '',
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
                label: Text(
                   'group_order.join_group'.tr(),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
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
      backgroundColor: isDark ? const Color(0xFF2A2A28) : Colors.white,
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
                fontWeight: FontWeight.w500,
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
                label: Text(
                  'cart.start_group_order'.tr(),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
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
                          Text('cart.table_verified'.tr(namedArgs: {'tableNum': tableNum})),
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
                  'cart.single_person_order'.tr(),
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
        final sid = ref.read(tableGroupProvider).session?.id;
        context.push('/kasap/$businessId?mode=masa&table=$tableNum&groupSessionId=$sid');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('marketplace.join_group_error'.tr(namedArgs: {'error': e.toString()})), backgroundColor: Theme.of(context).colorScheme.error),
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
        final sid = ref.read(tableGroupProvider).session?.id;
        context.push('/kasap/$businessId?mode=masa&table=$tableNum&groupSessionId=$sid');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('marketplace.create_group_error'.tr(namedArgs: {'error': e.toString()})), backgroundColor: Theme.of(context).colorScheme.error),
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
                    fontWeight: FontWeight.w500,
                    fontSize: 16,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                Text(
                  'cart.table_verified'.tr(namedArgs: {'tableNum': _scannedTableNumber ?? ''}),
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
                'common.change'.tr(),
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
  // ignore: unused_element
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
            TextSpan(text: 'cart.disclaimer_prefix'.tr()),
            WidgetSpan(
              child: GestureDetector(
                onTap: () => _openPrivacyPolicy(),
                child: Text(
                  'cart.privacy_policy'.tr(),
                  style: TextStyle(
                    color: Colors.grey[700],
                    fontSize: 11,
                    decoration: TextDecoration.underline,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            TextSpan(text: 'cart.and_conjunction'.tr()),
            WidgetSpan(
              child: GestureDetector(
                onTap: () => _openTermsOfUse(),
                child: Text(
                  'cart.terms_of_use'.tr(),
                  style: TextStyle(
                    color: Colors.grey[700],
                    fontSize: 11,
                    decoration: TextDecoration.underline,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            TextSpan(text: 'cart.disclaimer_suffix'.tr()),
          ],
        ),
      ),
    );
  }
  
  void _openPrivacyPolicy() {
    // TODO: Navigate to privacy policy page or open web URL
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('cart.privacy_coming_soon'.tr())),
    );
  }
  
  void _openTermsOfUse() {
    // TODO: Navigate to terms of use page or open web URL
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('cart.terms_coming_soon'.tr())),
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
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 20, fontWeight: FontWeight.w500),
          ),
          SizedBox(height: 8),
          Text('marketplace.order_from_kermes'.tr(), style: TextStyle(color: Colors.grey)),
          SizedBox(height: 32),
          // "Menüye Dön" butonu
          SizedBox(
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
              label: Text(
                'marketplace.back_to_menu'.tr(),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                maxLines: 1,
              ),
              style: FilledButton.styleFrom(
                backgroundColor: _accentColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24),
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
                color: isDark ? const Color(0xFF2A2A28) : Colors.white,
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
                          'checkout.select_delivery_address'.tr(),
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: isDark ? Colors.white : Colors.black),
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
                                label: 'cart.default_address'.tr(),
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
                                    color: isDark ? Colors.grey.shade600 : Colors.grey.shade400,
                                    style: BorderStyle.solid,
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.add_circle_outline, color: isDark ? Colors.grey[400]! : Colors.grey[700]!, size: 20),
                                    const SizedBox(width: 8),
                                    Text(
                                      tr('checkout.add_new_address'),
                                      style: TextStyle(
                                        color: isDark ? Colors.grey[400]! : Colors.grey[700]!,
                                        fontWeight: FontWeight.w500,
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
              ? (isDark ? Colors.grey.shade800 : Colors.grey.shade100)
              : (isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? (isDark ? Colors.grey[400]! : Colors.grey[700]!) : (isDark ? Colors.grey.shade700 : Colors.grey.shade300),
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
                  color: isSelected ? (isDark ? Colors.grey[400]! : Colors.grey[700]!) : (isDark ? Colors.grey[500]! : Colors.grey[400]!),
                  width: isSelected ? 2 : 1.5,
                ),
              ),
              child: isSelected
                  ? Center(child: Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: isDark ? Colors.grey[400]! : Colors.grey[700]!)))
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
                            color: isDefault ? Colors.green : (isDark ? Colors.grey[400]! : Colors.grey[600]!),
                            fontWeight: FontWeight.w500,
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
    final String placesApiKey = AppSecrets.googlePlacesApiKey;
    final searchController = TextEditingController();
    final streetController = TextEditingController();
    final houseNumberController = TextEditingController();
    final postalCodeController = TextEditingController();
    final cityController = TextEditingController();
    final labelController = TextEditingController();
    bool isGpsLoading = false;

    showModalBottomSheet(
      context: parentCtx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (formCtx) {
        return StatefulBuilder(
          builder: (context, setFormState) {
            final bottomInset = MediaQuery.of(context).viewInsets.bottom;
            return Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A28) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
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
                    padding: const EdgeInsets.fromLTRB(20, 16, 16, 4),
                    child: Row(
                      children: [
                        Text(
                          'checkout.add_new_address'.tr(),
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black),
                        ),
                        const Spacer(),
                        GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: Container(
                            width: 32, height: 32,
                            decoration: BoxDecoration(
                              color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(Icons.close, size: 18, color: isDark ? Colors.white70 : Colors.black54),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  Flexible(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + bottomInset),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // ── Quick Actions: GPS + Map ──
                          Row(
                            children: [
                              // 📍 Konumumu bul
                              Expanded(
                                child: GestureDetector(
                                  onTap: () async {
                                    HapticFeedback.mediumImpact();
                                    setFormState(() => isGpsLoading = true);
                                    try {
                                      LocationPermission permission = await Geolocator.checkPermission();
                                      if (permission == LocationPermission.denied) {
                                        permission = await Geolocator.requestPermission();
                                        if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
                                          setFormState(() => isGpsLoading = false);
                                          return;
                                        }
                                      }
                                      final position = await Geolocator.getCurrentPosition(
                                        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
                                      ).timeout(const Duration(seconds: 10));
                                      final placemarks = await placemarkFromCoordinates(position.latitude, position.longitude);
                                      if (placemarks.isNotEmpty) {
                                        final place = placemarks.first;
                                        setFormState(() {
                                          streetController.text = place.thoroughfare ?? '';
                                          houseNumberController.text = place.subThoroughfare ?? '';
                                          postalCodeController.text = place.postalCode ?? '';
                                          cityController.text = place.locality ?? place.administrativeArea ?? '';
                                          searchController.text = '${place.thoroughfare ?? ''} ${place.subThoroughfare ?? ''}, ${place.postalCode ?? ''} ${place.locality ?? ''}';
                                          isGpsLoading = false;
                                        });
                                      }
                                    } catch (e) {
                                      debugPrint('GPS error: $e');
                                      setFormState(() => isGpsLoading = false);
                                    }
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50,
                                      borderRadius: BorderRadius.circular(50),
                                      border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        if (isGpsLoading)
                                          SizedBox(
                                            width: 18, height: 18,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: _accentColor),
                                          )
                                        else
                                          Icon(Icons.my_location_rounded, color: _accentColor, size: 20),
                                        const SizedBox(width: 8),
                                        Flexible(
                                          child: Text(
                                            'checkout.find_my_location'.tr(),
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500,
                                              color: isDark ? Colors.white : Colors.black87,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                            maxLines: 1,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              // 🗺️ Haritadan seç
                              Expanded(
                                child: GestureDetector(
                                  onTap: () async {
                                    HapticFeedback.mediumImpact();
                                    // Get current location or default
                                    double lat = 51.0504;
                                    double lng = 6.2280;
                                    try {
                                      final position = await Geolocator.getCurrentPosition(
                                        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
                                      ).timeout(const Duration(seconds: 5));
                                      lat = position.latitude;
                                      lng = position.longitude;
                                    } catch (_) {}

                                    if (!formCtx.mounted) return;
                                    final result = await Navigator.of(formCtx).push<Map<String, dynamic>>(
                                      MaterialPageRoute(
                                        builder: (_) => DeliveryMapPickerScreen(
                                          initialLat: lat,
                                          initialLng: lng,
                                          addressLabel: 'checkout.select_on_map'.tr(),
                                        ),
                                      ),
                                    );

                                    if (result != null) {
                                      final rLat = result['lat'] as double;
                                      final rLng = result['lng'] as double;
                                      // Store coordinates for delivery PIN
                                      setState(() {
                                        _addressLat = rLat;
                                        _addressLng = rLng;
                                      });
                                      try {
                                        final placemarks = await placemarkFromCoordinates(rLat, rLng);
                                        if (placemarks.isNotEmpty) {
                                          final place = placemarks.first;
                                          setFormState(() {
                                            streetController.text = place.thoroughfare ?? '';
                                            houseNumberController.text = place.subThoroughfare ?? '';
                                            postalCodeController.text = place.postalCode ?? '';
                                            cityController.text = place.locality ?? place.administrativeArea ?? '';
                                            searchController.text = result['address'] as String? ?? '';
                                          });
                                        }
                                      } catch (e) {
                                        debugPrint('Reverse geocode error: $e');
                                        final addr = result['address'] as String? ?? '';
                                        setFormState(() => searchController.text = addr);
                                      }
                                    }
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50,
                                      borderRadius: BorderRadius.circular(50),
                                      border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.map_outlined, color: _accentColor, size: 20),
                                        const SizedBox(width: 8),
                                        Flexible(
                                          child: Text(
                                            'checkout.select_on_map'.tr(),
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500,
                                              color: isDark ? Colors.white : Colors.black87,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                            maxLines: 1,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // ── OR divider ──
                          Row(
                            children: [
                              Expanded(child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[300])),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                child: Text(
                                  'checkout.or_search'.tr(),
                                  style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[500] : Colors.grey[500], fontWeight: FontWeight.w500),
                                ),
                              ),
                              Expanded(child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[300])),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // 🔍 Google Places Autocomplete search
                          GooglePlaceAutoCompleteTextField(
                            textEditingController: searchController,
                            googleAPIKey: placesApiKey,
                            boxDecoration: const BoxDecoration(),
                            inputDecoration: InputDecoration(
                              hintText: 'marketplace.search_address_hint'.tr(),
                              hintStyle: TextStyle(color: Colors.grey[500], fontSize: 15),
                              prefixIcon: Icon(Icons.search_rounded, color: _accentColor, size: 22),
                              filled: true,
                              fillColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300)),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300)),
                              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: _accentColor, width: 1.5)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                            ),
                            textStyle: TextStyle(color: isDark ? Colors.white : Colors.black, fontSize: 15),
                            debounceTime: 400,
                            countries: const ['de'],
                            isLatLngRequired: true,
                            getPlaceDetailWithLatLng: (prediction) async {
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
                                    });
                                  }
                                } catch (e) {
                                  debugPrint('Geocoding error: $e');
                                  final desc = prediction.description ?? '';
                                  final parts = desc.split(',');
                                  if (parts.isNotEmpty) {
                                    setFormState(() {
                                      streetController.text = parts[0].trim();
                                      if (parts.length >= 2) {
                                        final plzCity = parts[1].trim();
                                        final match = RegExp(r'(\d{5})\s*(.*)').firstMatch(plzCity);
                                        if (match != null) {
                                          postalCodeController.text = match.group(1) ?? '';
                                          cityController.text = match.group(2) ?? '';
                                        } else {
                                          cityController.text = plzCity;
                                        }
                                      }
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

                          const SizedBox(height: 20),

                          // ── Manual Form Fields ──
                          // Label (optional)
                          _buildAddressTextField(labelController, 'checkout.address_label_optional'.tr(), 'checkout.address_label_hint'.tr(), isDark, textInputAction: TextInputAction.next, prefixIcon: Icons.bookmark_border_rounded),
                          const SizedBox(height: 14),

                          // Street + House Number row
                          Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: _buildAddressTextField(streetController, 'checkout.street_name_required'.tr(), 'checkout.street_name_hint'.tr(), isDark, textInputAction: TextInputAction.next),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                flex: 1,
                                child: _buildAddressTextField(houseNumberController, 'checkout.house_number_short'.tr(), '', isDark, textInputAction: TextInputAction.next),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),

                          // PLZ + City row
                          Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: _buildAddressTextField(postalCodeController, 'checkout.postal_code_required'.tr(), '', isDark, keyboardType: TextInputType.number, textInputAction: TextInputAction.next),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                flex: 3,
                                child: _buildAddressTextField(cityController, 'checkout.city_required'.tr(), '', isDark, textInputAction: TextInputAction.done),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),

                          // ── Premium Buttons ──
                          // Save & Use — primary
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () async {
                                if (streetController.text.trim().isEmpty || cityController.text.trim().isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('cart.please_enter_street_city'.tr()), backgroundColor: Theme.of(context).colorScheme.error),
                                  );
                                  return;
                                }
                                HapticFeedback.mediumImpact();
                                final addr = {
                                  'street': streetController.text.trim(),
                                  'houseNumber': houseNumberController.text.trim(),
                                  'postalCode': postalCodeController.text.trim(),
                                  'city': cityController.text.trim(),
                                };
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
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
                                elevation: 0,
                              ),
                              child: Text('checkout.save_and_use'.tr(), style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 16)),
                            ),
                          ),
                          const SizedBox(height: 10),
                          // Use only — secondary
                          SizedBox(
                            width: double.infinity,
                            child: TextButton(
                              onPressed: () {
                                if (streetController.text.trim().isEmpty || cityController.text.trim().isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('cart.please_enter_street_city'.tr()), backgroundColor: Theme.of(context).colorScheme.error),
                                  );
                                  return;
                                }
                                HapticFeedback.lightImpact();
                                final addr = {
                                  'street': streetController.text.trim(),
                                  'houseNumber': houseNumberController.text.trim(),
                                  'postalCode': postalCodeController.text.trim(),
                                  'city': cityController.text.trim(),
                                };
                                setState(() => _selectedDeliveryAddress = addr);
                                parentSetSheetState(() {});
                                Navigator.pop(formCtx);
                                Navigator.pop(parentCtx);
                              },
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
                              ),
                              child: Text(
                                'checkout.use_only'.tr(),
                                style: TextStyle(
                                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                                  fontWeight: FontWeight.w500,
                                  fontSize: 15,
                                ),
                              ),
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
    IconData? prefixIcon,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      style: TextStyle(color: isDark ? Colors.white : Colors.black, fontSize: 15, fontWeight: FontWeight.w500),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        floatingLabelBehavior: FloatingLabelBehavior.always,
        labelStyle: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[700], fontSize: 14, fontWeight: FontWeight.w500),
        hintStyle: TextStyle(color: Colors.grey[400], fontSize: 14),
        prefixIcon: prefixIcon != null ? Icon(prefixIcon, color: isDark ? Colors.grey[500] : Colors.grey[500], size: 20) : null,
        filled: true,
        fillColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: _accentColor, width: 1.5)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
        selectedLabel = 'marketplace.product_unavailable_refund'.tr();
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
                            fontWeight: FontWeight.w500,
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
                                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: isDark ? Colors.white : Colors.black),
                                      ),
                                    ),
                                  ],
                                ),
                                content: Text(
                                  'marketplace.unavailability_info_text'.tr(),
                                  style: TextStyle(
                                    fontSize: 14,
                                    height: 1.5,
                                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                                  ),
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(dialogCtx),
                                    child: Text('common.understood'.tr(), style: TextStyle(color: _accentColor, fontWeight: FontWeight.w500)),
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
              subtitle: 'marketplace.unavailable_replace_desc'.tr(),
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
              subtitle: 'marketplace.unavailable_refund_desc'.tr(),
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
              subtitle: 'marketplace.unavailable_choose_desc'.tr(),
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
                          fontWeight: FontWeight.w500,
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
                            label: 'marketplace.alternative_label'.tr(),
                            isDark: isDark,
                          ),
                          const SizedBox(width: 8),
                          _buildPerItemChip(
                            setSheetState: setSheetState,
                            productId: productId,
                            chipValue: 'refund',
                            currentValue: pref,
                            label: 'marketplace.refund_label'.tr(),
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
  // ignore: unused_element
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
            title: 'marketplace.product_unavailable_replace'.tr(),
            subtitle: 'marketplace.unavailable_replace_desc'.tr(),
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
            subtitle: 'marketplace.unavailable_refund_desc'.tr(),
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
            subtitle: 'marketplace.unavailable_choose_desc'.tr(),
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
                          style: TextStyle(fontWeight: FontWeight.w500),
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
                        fontWeight: FontWeight.w500,
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
                      fontWeight: FontWeight.w500,
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
              ? (isDark ? _accentColor.withOpacity(0.2) : _accentColor.withOpacity(0.1))
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
            fontWeight: isSelected ? FontWeight.w500 : FontWeight.w500,
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
    // 🎯 Use pickup-specific hours, fallback to general
    final effectiveHelper = _pickupHoursHelper ?? _hoursHelper;
    if (effectiveHelper == null) {
      return const SizedBox.shrink();
    }

    final grouped = effectiveHelper.getAvailableSlotsGroupedByDay(
      isPickup: true,
      daysToCheck: 3,
      prepTimeMinutes: 30,
    );

    if (grouped.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.orange.withOpacity(0.1),
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
    final dayNames = ['common.day_monday', 'common.day_tuesday', 'common.day_wednesday', 'common.day_thursday', 'common.day_friday', 'common.day_saturday', 'common.day_sunday'];
    final dayKeys = grouped.keys.toList();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Build day labels
    final dayLabels = dayKeys.map((dateKey) {
      final isToday = dateKey.day == now.day && dateKey.month == now.month && dateKey.year == now.year;
      final tomorrow = now.add(const Duration(days: 1));
      final isTomorrow = dateKey.day == tomorrow.day && dateKey.month == tomorrow.month && dateKey.year == tomorrow.year;
      if (isToday) return 'checkout.today'.tr();
      if (isTomorrow) return 'checkout.tomorrow'.tr();
      return dayNames[dateKey.weekday - 1].tr();
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
                Icon(Icons.schedule, color: isDark ? Colors.grey[400] : Colors.grey[700], size: 18),
                const SizedBox(width: 8),
                Text(
                  'checkout.pickup'.tr(),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                if (_selectedPickupSlot != null) ...[
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (isDark ? Colors.white : const Color(0xFF1A1A1A)).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      selectedDisplay,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white : const Color(0xFF1A1A1A),
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
                            ? Colors.grey[800]!.withOpacity(0.8)
                            : Colors.grey[300]!.withOpacity(0.5),
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
                                  fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                                  color: isSelected
                                      ? Theme.of(context).colorScheme.onSurface
                                      : Theme.of(context).colorScheme.onSurface.withOpacity(0.35),
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
                                  fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                                  color: isSelected
                                      ? Theme.of(context).colorScheme.onSurface
                                      : Theme.of(context).colorScheme.onSurface.withOpacity(0.35),
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

  /// 🆕 Kurye: Lieferando-style scheduled delivery time picker
  /// Opens as a bottom sheet with "Jetzt / Für später planen" radio,
  /// horizontal day chips, and scrollable 5-min time slot radio list.
  Widget _buildDeliveryTimePicker(StateSetter setSheetState) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Neutral selection color — matches theme
    final selColor = isDark ? Colors.white : Colors.black87;

    // 🎯 Use delivery-specific hours, fallback to general
    final effectiveHelper = _deliveryHoursHelper ?? _hoursHelper;

    // Generate slots with 5-min intervals
    final grouped = effectiveHelper?.getAvailableSlotsGroupedByDay(
      isPickup: false,
      daysToCheck: 7,
      prepTimeMinutes: 60,
      slotIntervalMinutes: 5,
    ) ?? {};

    final now = DateTime.now();
    final dayKeys = grouped.keys.toList();

    // 🎯 Check if business is currently open for delivery
    final bool isCurrentlyOpenForDelivery = effectiveHelper?.isOpenAt(now) ?? true;
    // Get next opening time if closed
    String? nextOpenLabel;
    if (!isCurrentlyOpenForDelivery && effectiveHelper != null) {
      final nextOpen = effectiveHelper.getNextOpenDateTime(now);
      if (nextOpen != null) {
        final timeStr = '${nextOpen.hour.toString().padLeft(2, '0')}:${nextOpen.minute.toString().padLeft(2, '0')}';
        final isToday = nextOpen.day == now.day && nextOpen.month == now.month && nextOpen.year == now.year;
        final tomorrow = now.add(const Duration(days: 1));
        final isTomorrow = nextOpen.day == tomorrow.day && nextOpen.month == tomorrow.month && nextOpen.year == tomorrow.year;
        if (isToday) {
          nextOpenLabel = 'marketplace.opens_today'.tr(namedArgs: {'time': timeStr});
        } else if (isTomorrow) {
          nextOpenLabel = 'marketplace.opens_tomorrow'.tr(namedArgs: {'time': timeStr});
        } else {
          final dayNames = ['common.day_monday', 'common.day_tuesday', 'common.day_wednesday', 'common.day_thursday', 'common.day_friday', 'common.day_saturday', 'common.day_sunday'];
          final dayName = dayNames[nextOpen.weekday - 1].tr();
          nextOpenLabel = 'marketplace.opens_on_day'.tr(namedArgs: {'day': dayName, 'time': timeStr});
        }
      }
    }

    return StatefulBuilder(
      builder: (context, setPickerState) {
        // Determine selected day index
        int selectedDayIndex = 0;
        if (_scheduledDeliverySlot != null && dayKeys.isNotEmpty) {
          final selDate = DateTime(
            _scheduledDeliverySlot!.year,
            _scheduledDeliverySlot!.month,
            _scheduledDeliverySlot!.day,
          );
          final idx = dayKeys.indexWhere((k) =>
              k.year == selDate.year &&
              k.month == selDate.month &&
              k.day == selDate.day);
          if (idx >= 0) selectedDayIndex = idx;
        }

        final currentTimeSlots =
            dayKeys.isNotEmpty ? (grouped[dayKeys[selectedDayIndex]] ?? []) : <DateTime>[];

        // ── When business is closed: show Cupertino wheel directly (like Abholung) ──
        if (!isCurrentlyOpenForDelivery) {
          // Don't auto-select any slot — user must consciously pick a time
          // Just ensure scheduling flags are set so the order is treated as scheduled
          if (!_deliveryTimeExplicitlyChosen) {
            _wantsScheduledDelivery = true;
            _deliveryTimeExplicitlyChosen = true;
          }

          // Day labels for wheel
          final dayLabels = dayKeys.map((dateKey) {
            final isToday = dateKey.day == now.day && dateKey.month == now.month && dateKey.year == now.year;
            final tomorrow = now.add(const Duration(days: 1));
            final isTomorrow = dateKey.day == tomorrow.day && dateKey.month == tomorrow.month && dateKey.year == tomorrow.year;
            if (isToday) return 'checkout.today'.tr();
            if (isTomorrow) return 'checkout.tomorrow'.tr();
            final dayNames = ['common.day_monday', 'common.day_tuesday', 'common.day_wednesday', 'common.day_thursday', 'common.day_friday', 'common.day_saturday', 'common.day_sunday'];
            return dayNames[dateKey.weekday - 1].tr();
          }).toList();

          int currentDayIdx = selectedDayIndex;
          int currentTimeIdx = 0;
          if (_scheduledDeliverySlot != null && currentTimeSlots.isNotEmpty) {
            final idx = currentTimeSlots.indexWhere((s) =>
                s.hour == _scheduledDeliverySlot!.hour && s.minute == _scheduledDeliverySlot!.minute);
            if (idx >= 0) currentTimeIdx = idx;
          }
          final timeCtrl = FixedExtentScrollController(initialItem: currentTimeIdx);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Closed notice
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 16, color: Colors.grey[500]),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'checkout.business_closed_schedule'.tr(),
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey[500],
                        fontWeight: FontWeight.w100,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Lieferzeit label
              Row(
                children: [
                  Icon(Icons.schedule, color: isDark ? Colors.grey[400] : Colors.grey[700], size: 18),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'checkout.delivery_time_label'.tr(),
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (_scheduledDeliverySlot != null) ...[
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: (isDark ? Colors.white : const Color(0xFF1A1A1A)).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${dayLabels.isNotEmpty ? dayLabels[currentDayIdx] : ''}, ${_scheduledDeliverySlot!.hour.toString().padLeft(2, '0')}:${_scheduledDeliverySlot!.minute.toString().padLeft(2, '0')}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),

              // Cupertino wheel picker (same as Abholung)
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
                              ? Colors.grey[800]!.withOpacity(0.8)
                              : Colors.grey[300]!.withOpacity(0.5),
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
                            scrollController: FixedExtentScrollController(initialItem: currentDayIdx),
                            itemExtent: 36,
                            diameterRatio: 1.2,
                            squeeze: 1.1,
                            selectionOverlay: const SizedBox.shrink(),
                            onSelectedItemChanged: (index) {
                              final newSlots = grouped[dayKeys[index]] ?? [];
                              setPickerState(() {
                                currentDayIdx = index;
                                currentTimeIdx = 0;
                                timeCtrl.jumpToItem(0);
                              });
                              if (newSlots.isNotEmpty) {
                                _scheduledDeliverySlot = newSlots.first;
                                _wantsScheduledDelivery = true;
                                _deliveryTimeExplicitlyChosen = true;
                                setSheetState(() {});
                              }
                            },
                            children: List.generate(dayLabels.length, (index) {
                              final isSelected = index == currentDayIdx;
                              return Center(
                                child: Text(
                                  dayLabels[index],
                                  style: TextStyle(
                                    fontSize: isSelected ? 18 : 15,
                                    fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                                    color: isSelected
                                        ? Theme.of(context).colorScheme.onSurface
                                        : Theme.of(context).colorScheme.onSurface.withOpacity(0.35),
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
                            scrollController: timeCtrl,
                            itemExtent: 36,
                            diameterRatio: 1.2,
                            squeeze: 1.1,
                            selectionOverlay: const SizedBox.shrink(),
                            onSelectedItemChanged: (index) {
                              final slots = grouped[dayKeys[currentDayIdx]] ?? [];
                              setPickerState(() {
                                currentTimeIdx = index;
                              });
                              if (slots.isNotEmpty && index < slots.length) {
                                _scheduledDeliverySlot = slots[index];
                                _wantsScheduledDelivery = true;
                                _deliveryTimeExplicitlyChosen = true;
                                setSheetState(() {});
                              }
                            },
                            children: List.generate(currentTimeSlots.length, (index) {
                              final slot = currentTimeSlots[index];
                              final timeStr = '${slot.hour.toString().padLeft(2, '0')}:${slot.minute.toString().padLeft(2, '0')}';
                              final isSelected = index == currentTimeIdx;
                              return Center(
                                child: Text(
                                  timeStr,
                                  style: TextStyle(
                                    fontSize: isSelected ? 18 : 15,
                                    fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                                    color: isSelected
                                        ? Theme.of(context).colorScheme.onSurface
                                        : Theme.of(context).colorScheme.onSurface.withOpacity(0.35),
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
        }

        // ── Business is OPEN: show Jetzt / Für später planen radio flow ──

        // Derive selection state after auto-select
        final bool isScheduled = _scheduledDeliverySlot != null;
        final bool isAsapChosen = _deliveryTimeExplicitlyChosen && !_wantsScheduledDelivery;
        final bool isScheduledChosen = _deliveryTimeExplicitlyChosen && _wantsScheduledDelivery;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── "Jetzt" radio row ──
            _buildTimeRadioRow(
              isDark: isDark,
              selColor: selColor,
              label: 'checkout.now'.tr(),
              isSelected: isAsapChosen,
              icon: Icons.bolt,
              onTap: () {
                _scheduledDeliverySlot = null;
                _deliveryTimeExplicitlyChosen = true;
                _wantsScheduledDelivery = false;
                _scheduledInfoDismissed = false;
                setSheetState(() {});
                setPickerState(() {});
              },
            ),

            const SizedBox(height: 8),

            // ── "Für später planen" radio row ──
            _buildTimeRadioRow(
              isDark: isDark,
              selColor: selColor,
              label: 'checkout.plan_for_later'.tr(),
              isSelected: isScheduledChosen,
              icon: Icons.schedule,
              onTap: () {
                _deliveryTimeExplicitlyChosen = true;
                _wantsScheduledDelivery = true;
                _scheduledInfoDismissed = false;
                if (!isScheduled && dayKeys.isNotEmpty) {
                  final firstSlots = grouped[dayKeys.first] ?? [];
                  if (firstSlots.isNotEmpty) {
                    _scheduledDeliverySlot = firstSlots.first;
                  }
                }
                setSheetState(() {});
                setPickerState(() {});
              },
            ),

            // ── Show time slots only when scheduled ──
            if (isScheduledChosen && dayKeys.isNotEmpty) ...[
              const SizedBox(height: 16),

              // ── Day chips (horizontal scroll) ──
              SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: dayKeys.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (ctx, index) {
                    final dayDate = dayKeys[index];
                    final isToday = dayDate.day == now.day &&
                        dayDate.month == now.month &&
                        dayDate.year == now.year;
                    final tomorrow = now.add(const Duration(days: 1));
                    final isTomorrow = dayDate.day == tomorrow.day &&
                        dayDate.month == tomorrow.month &&
                        dayDate.year == tomorrow.year;

                    String chipLabel;
                    if (isToday) {
                      chipLabel = 'checkout.today'.tr();
                    } else if (isTomorrow) {
                      chipLabel = 'checkout.tomorrow'.tr();
                    } else {
                      final weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
                      final dateStr =
                          '${dayDate.day.toString().padLeft(2, '0')}.${dayDate.month.toString().padLeft(2, '0')}';
                      chipLabel = '${weekdays[dayDate.weekday - 1]}, $dateStr';
                    }

                    final isSelected = index == selectedDayIndex;

                    return GestureDetector(
                      onTap: () {
                        final newSlots = grouped[dayKeys[index]] ?? [];
                        if (newSlots.isNotEmpty) {
                          _scheduledDeliverySlot = newSlots.first;
                          setSheetState(() {});
                          setPickerState(() {});
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? (isDark ? Colors.grey[800] : Colors.grey[200])
                              : (isDark ? Colors.grey[900] : Colors.grey[100]),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isSelected
                                ? (isDark ? Colors.grey[500]! : Colors.grey[500]!)
                                : (isDark ? Colors.grey[700]! : Colors.grey[300]!),
                            width: isSelected ? 1.5 : 1,
                          ),
                        ),
                        child: Text(
                          chipLabel,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight:
                                isSelected ? FontWeight.w500 : FontWeight.w500,
                            color: isSelected
                                ? (isDark ? Colors.white : Colors.black87)
                                : (isDark ? Colors.grey[400] : Colors.grey[600]),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 12),

              // ── Time slot list (scrollable radio buttons) ──
              if (currentTimeSlots.isEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.orange.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline,
                          color: Colors.orange, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'checkout.no_available_slots'.tr(),
                          style: const TextStyle(
                              color: Colors.orange, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                )
              else
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 280),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: currentTimeSlots.length,
                    itemBuilder: (ctx, index) {
                      final slot = currentTimeSlots[index];
                      final timeStr =
                          '${slot.hour.toString().padLeft(2, '0')}:${slot.minute.toString().padLeft(2, '0')}';
                      final isSelected = _scheduledDeliverySlot != null &&
                          slot.hour == _scheduledDeliverySlot!.hour &&
                          slot.minute == _scheduledDeliverySlot!.minute &&
                          slot.day == _scheduledDeliverySlot!.day;

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: GestureDetector(
                          onTap: () {
                            _scheduledDeliverySlot = slot;
                            setSheetState(() {});
                            setPickerState(() {});
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? (isDark ? Colors.grey[800]!.withOpacity(0.6) : Colors.grey[100])
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected
                                    ? (isDark ? Colors.grey[500]! : Colors.grey[500]!)
                                    : (isDark ? Colors.grey[800]! : Colors.grey[200]!),
                                width: isSelected ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  timeStr,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: isSelected
                                        ? FontWeight.w500
                                        : FontWeight.w400,
                                    color: isSelected
                                        ? (isDark ? Colors.white : Colors.black87)
                                        : (isDark
                                            ? Colors.grey[400]
                                            : Colors.grey[700]),
                                  ),
                                ),
                                // Radio indicator — neutral grey
                                Container(
                                  width: 22,
                                  height: 22,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: isSelected
                                          ? (isDark ? Colors.grey[400]! : Colors.grey[600]!)
                                          : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                                      width: 2,
                                    ),
                                  ),
                                  child: isSelected
                                      ? Center(
                                          child: Container(
                                            width: 12,
                                            height: 12,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: isDark ? Colors.grey[300] : Colors.grey[700],
                                            ),
                                          ),
                                        )
                                      : null,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),

              const SizedBox(height: 12),

              // ── Info note about scheduled delivery ──
              if (!_scheduledInfoDismissed)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Theme.of(context).colorScheme.surfaceContainerHighest
                        : Colors.grey[50],
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isDark
                          ? Colors.grey[700]!.withOpacity(0.5)
                          : Colors.grey[300]!,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline,
                              size: 16,
                              color: isDark ? Colors.grey[400] : Colors.grey[500]),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'checkout.scheduled_info'.tr(),
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
                          Icon(Icons.location_on_outlined,
                              size: 16,
                              color: isDark ? Colors.grey[400] : Colors.grey[500]),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'checkout.scheduled_tracking_info'.tr(),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: isDark ? Colors.grey[300] : Colors.grey[600],
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.calendar_today_outlined,
                              size: 16,
                              color: isDark ? Colors.grey[400] : Colors.grey[500]),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'checkout.scheduled_calendar_hint'.tr(),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: isDark ? Colors.grey[300] : Colors.grey[600],
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: GestureDetector(
                          onTap: () {
                            _scheduledInfoDismissed = true;
                            setSheetState(() {});
                            setPickerState(() {});
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? Colors.grey[700]!.withOpacity(0.3)
                                  : Colors.grey[200],
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'checkout.understood'.tr(),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: isDark ? Colors.grey[300] : Colors.grey[700],
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
      },
    );
  }

  /// Helper: builds a single radio row for Jetzt / Für später planen
  Widget _buildTimeRadioRow({
    required bool isDark,
    required Color selColor,
    required String label,
    required bool isSelected,
    required IconData icon,
    required VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: const BoxDecoration(),
        child: Row(
          children: [
            Icon(icon,
                size: 20,
                color: isSelected
                    ? (isDark ? Colors.white : Colors.black87)
                    : (isDark ? Colors.grey[500] : Colors.grey[600])),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                  color: isSelected
                      ? (isDark ? Colors.white : Colors.black87)
                      : (isDark ? Colors.grey[400] : Colors.grey[700]),
                ),
              ),
            ),
            // Radio indicator — brand red
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected
                      ? selColor
                      : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: selColor,
                        ),
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
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

  late Future<DocumentSnapshot> _userDocFuture;

  // 📍 Address geocoding state for map preview
  double? _addressLat;
  double? _addressLng;
  bool _addressGeocoded = false;

  // Convenience accessor
  _CartScreenState get parent => widget.cartScreenState;

  @override
  void initState() {
    super.initState();

    _userDocFuture = FirebaseFirestore.instance
        .collection('users')
        .doc(widget.firebaseUser?.uid ?? widget.authState.appUser?.uid)
        .get();
  }

  // Track which address string was last geocoded to detect changes
  String? _lastGeocodedAddress;

  /// Geocode an address string to lat/lng for the mini map preview
  Future<void> _geocodeAddress(String addressString) async {
    // If already geocoded for the SAME address, skip
    if (_addressGeocoded && _lastGeocodedAddress == addressString) return;
    _addressGeocoded = true;
    _lastGeocodedAddress = addressString;
    try {
      final locations = await locationFromAddress(addressString);
      if (locations.isNotEmpty && mounted) {
        setState(() {
          _addressLat = locations.first.latitude;
          _addressLng = locations.first.longitude;
        });
      }
    } catch (e) {
      debugPrint('[Checkout] Geocoding failed for: $addressString — $e');
    }
  }

  /// Show a legal information bottom sheet (Datenschutz / Nutzungsbedingungen)
  void _showLegalSheet(BuildContext ctx, String title, String content) {
    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        final isDark = Theme.of(sheetCtx).brightness == Brightness.dark;
        return DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          builder: (_, scrollController) => Container(
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A28) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                // Drag handle
                Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[400],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Title
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(title, style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w500,
                          color: Theme.of(sheetCtx).colorScheme.onSurface,
                        )),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.pop(sheetCtx),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey[800] : Colors.grey[200],
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.close, size: 18, color: Theme.of(sheetCtx).colorScheme.onSurface),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                // Content
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(20),
                    child: Text(content, style: TextStyle(
                      fontSize: 13,
                      height: 1.6,
                      color: isDark ? Colors.grey[300] : Colors.grey[700],
                    )),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  /// Returns a user-friendly label for the currently selected payment method
  String _getPaymentMethodLabel(String? method) {
    switch (method) {
      case 'card':
        return 'checkout.card'.tr();
      case 'cash':
        return 'checkout.cash'.tr();
      case 'payLater':
        return 'checkout.pay_later'.tr();
      case 'cardOnDelivery':
        return 'checkout.card_on_delivery'.tr();
      case 'klarna':
        return 'Klarna';
      default:
        return 'checkout.select_payment'.tr();
    }
  }

  /// Reusable row pattern: [red icon] [title / subtitle] [trailing widget]
  Widget _buildCheckoutRow(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    Widget? trailing,
    Widget? badge,
    Color? dividerColor,
    VoidCallback? onTap,
  }) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Icon(icon, color: iconColor, size: 22),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(title, style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14, fontWeight: FontWeight.w400)),
                          if (badge != null) badge,
                        ],
                      ),
                      if (subtitle != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(subtitle, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                        ),
                    ],
                  ),
                ),
                if (trailing != null) trailing,
              ],
            ),
          ),
        ),
        if (dividerColor != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Divider(height: 1, color: dividerColor),
          ),
      ],
    );
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


    final isDark = Theme.of(context).brightness == Brightness.dark;
    final checkoutBg = isDark ? Theme.of(context).colorScheme.surface : Colors.white;

    final neutralIcon = isDark ? Colors.grey[400]! : Colors.grey[700]!;
    const brandRed = Color(0xFFE30613);
    final chevronColor = isDark ? Colors.grey[500]! : Colors.grey[400]!;
    final dividerColor = isDark ? Colors.grey[800]! : const Color(0xFFF0F0F0);
    final sectionDividerColor = isDark ? Colors.grey[900]! : const Color(0xFFF5F0E8);

    return Scaffold(
      backgroundColor: checkoutBg,
      appBar: AppBar(
        backgroundColor: checkoutBg,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: Padding(
          padding: const EdgeInsets.only(left: 8),
          child: Center(
            child: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey[800] : const Color(0xFFF5F5F5),
                  shape: BoxShape.circle,
                  boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 1))],
                ),
                child: Icon(Icons.arrow_back_ios_new, color: Theme.of(context).colorScheme.onSurface, size: 18),
              ),
            ),
          ),
        ),
        title: Text(
          'checkout.title'.tr(),
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: parent._buildCheckoutStepIndicator(1, onStepTap: (step) {
            if (step == 0) {
              Navigator.pop(context);
            }
          }),
        ),
      ),
      body: Stack(
        children: [
          GestureDetector(
            onTap: () => FocusScope.of(context).unfocus(),
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: EdgeInsets.only(bottom: 140 + bottomInset),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ═══════════════════════════════════════
                    // SECTION 1: BESTELLDETAILS
                    // ═══════════════════════════════════════
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: Text('checkout.order_details'.tr(), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                    ),

                    // ── User Info Row ──
                    FutureBuilder<DocumentSnapshot>(
                      future: _userDocFuture,
                      builder: (context, snapshot) {
                        final userData = snapshot.data?.data() as Map<String, dynamic>?;
                        final userName = userData?['displayName'] ?? userData?['name'] ?? '';
                        final userPhone = userData?['phone'] ?? userData?['phoneNumber'] ?? '';
                        // Split name for first/last display
                        final nameParts = userName.toString().trim().split(' ');
                        final firstName = nameParts.isNotEmpty ? nameParts.first : '';
                        final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';
                        return _buildCheckoutRow(
                          context,
                          icon: Icons.person_outline,
                          iconColor: brandRed,
                          title: userName.toString().isNotEmpty ? userName.toString() : 'checkout.user'.tr(),
                          subtitle: userPhone.toString(),
                          trailing: Icon(Icons.chevron_right, color: chevronColor, size: 22),
                          dividerColor: dividerColor,
                          onTap: () {
                            final firstNameCtrl = TextEditingController(text: firstName);
                            final lastNameCtrl = TextEditingController(text: lastName);
                            final phoneCtrl = TextEditingController(text: userPhone.toString());
                            showModalBottomSheet(
                              context: context,
                              isScrollControlled: true,
                              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                              builder: (ctx) => Padding(
                                padding: EdgeInsets.fromLTRB(20, 24, 20, 24 + MediaQuery.of(ctx).viewInsets.bottom),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
                                    const SizedBox(height: 20),
                                    Text('checkout.your_details'.tr(), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                                    const SizedBox(height: 16),
                                    Text('checkout.first_name'.tr(), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                                    const SizedBox(height: 6),
                                    TextField(
                                      controller: firstNameCtrl,
                                      textCapitalization: TextCapitalization.words,
                                      decoration: InputDecoration(
                                        filled: true, fillColor: isDark ? Colors.grey[850] : const Color(0xFFF7F7F7),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                                      ),
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                    ),
                                    const SizedBox(height: 12),
                                    Text('checkout.last_name'.tr(), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                                    const SizedBox(height: 6),
                                    TextField(
                                      controller: lastNameCtrl,
                                      textCapitalization: TextCapitalization.words,
                                      decoration: InputDecoration(
                                        filled: true, fillColor: isDark ? Colors.grey[850] : const Color(0xFFF7F7F7),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                                      ),
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                    ),
                                    const SizedBox(height: 12),
                                    Text('checkout.phone'.tr(), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                                    const SizedBox(height: 6),
                                    TextField(
                                      controller: phoneCtrl,
                                      keyboardType: TextInputType.phone,
                                      decoration: InputDecoration(
                                        filled: true, fillColor: isDark ? Colors.grey[850] : const Color(0xFFF7F7F7),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                                      ),
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                    ),
                                    const SizedBox(height: 20),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: () => Navigator.pop(ctx),
                                            style: OutlinedButton.styleFrom(
                                              padding: const EdgeInsets.symmetric(vertical: 14),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                              side: BorderSide(color: Colors.grey[400]!),
                                            ),
                                            child: Text('checkout.cancel'.tr(), style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w500)),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: ElevatedButton(
                                            onPressed: () async {
                                              final newName = '${firstNameCtrl.text.trim()} ${lastNameCtrl.text.trim()}'.trim();
                                              final newPhone = phoneCtrl.text.trim();
                                              final uid = widget.firebaseUser?.uid ?? widget.authState.appUser?.uid;
                                              if (uid != null && newName.isNotEmpty) {
                                                await FirebaseFirestore.instance.collection('users').doc(uid).update({
                                                  'displayName': newName,
                                                  'phone': newPhone,
                                                });
                                                // Refresh user data
                                                setState(() {
                                                  _userDocFuture = FirebaseFirestore.instance.collection('users').doc(uid).get();
                                                });
                                              }
                                              if (ctx.mounted) Navigator.pop(ctx);
                                            },
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Theme.of(context).colorScheme.onSurface,
                                              foregroundColor: Theme.of(context).colorScheme.surface,
                                              padding: const EdgeInsets.symmetric(vertical: 14),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                              elevation: 0,
                                            ),
                                            child: Text('checkout.save'.tr(), style: const TextStyle(fontWeight: FontWeight.w500)),
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
                    ),

                    // ── Address Row + Map Preview (delivery only) ──
                    if (!parent._isPickUp && !parent._isDineIn)
                      FutureBuilder<DocumentSnapshot>(
                        future: _userDocFuture,
                        builder: (context, snapshot) {
                          if (snapshot.connectionState == ConnectionState.waiting) {
                            return _buildCheckoutRow(context, icon: Icons.location_on_outlined, iconColor: brandRed, title: '...', dividerColor: dividerColor);
                          }
                          final userData = snapshot.data?.data() as Map<String, dynamic>?;
                          final profileStreet = userData?['address'] ?? '';
                          final profileHouseNumber = userData?['houseNumber'] ?? '';
                          final profilePostalCode = userData?['postalCode'] ?? '';
                          final profileCity = userData?['city'] ?? '';
                          final profileStreetFull = profileHouseNumber.toString().isNotEmpty ? '$profileStreet $profileHouseNumber' : profileStreet;

                          final displayStreet = parent._selectedDeliveryAddress != null
                              ? (parent._selectedDeliveryAddress!['houseNumber']!.isNotEmpty
                                  ? '${parent._selectedDeliveryAddress!['street']} ${parent._selectedDeliveryAddress!['houseNumber']}'
                                  : parent._selectedDeliveryAddress!['street'] ?? '')
                              : profileStreetFull.toString();
                          final displayCity = parent._selectedDeliveryAddress != null
                              ? '${parent._selectedDeliveryAddress!['city']}, ${parent._selectedDeliveryAddress!['postalCode']}'
                              : '$profileCity, $profilePostalCode';
                          final hasAddress = displayStreet.toString().trim().isNotEmpty;

                          // Trigger geocoding for map preview if we have an address
                          if (hasAddress) {
                            final fullAddress = '$displayStreet, $displayCity';
                            _geocodeAddress(fullAddress);
                          }

                          // Determine address confirmation status
                          // Level 1: No address at all → red
                          // Level 2: Address exists but no geocoding (lat/lng) → orange warning
                          // Level 3: Fully confirmed → no badge
                          final bool isAddressUnconfirmed = hasAddress && (_addressLat == null || _addressLng == null);

                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Column(
                              children: [
                                // Address text row — tapping opens address picker
                                GestureDetector(
                                  behavior: HitTestBehavior.opaque,
                                  onTap: () {
                                    // Reset geocoding state so it can re-resolve after picker
                                    _addressGeocoded = false;
                                    _addressLat = null;
                                    _addressLng = null;
                                    parent._showAddressPickerSheet(
                                      context, setState,
                                      widget.firebaseUser?.uid ?? widget.authState.appUser?.uid ?? '',
                                      profileAddress: profileStreet.toString().trim().isNotEmpty ? {
                                        'street': profileStreet.toString(), 'houseNumber': profileHouseNumber.toString(),
                                        'postalCode': profilePostalCode.toString(), 'city': profileCity.toString(),
                                      } : null,
                                    );
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2),
                                          child: Icon(Icons.location_on_outlined, color: brandRed, size: 24),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(hasAddress ? displayStreet.toString() : 'checkout.add_address'.tr(),
                                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                                              if (hasAddress) ...[
                                                const SizedBox(height: 2),
                                                Text(displayCity.toString(), style: TextStyle(fontSize: 13, color: Colors.grey[500])),
                                              ],
                                              // Confirmation badge
                                              if (!hasAddress) ...[
                                                const SizedBox(height: 4),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(color: const Color(0xFFFFF9C4), borderRadius: BorderRadius.circular(4)),
                                                  child: Text('checkout.confirm_address'.tr(), style: const TextStyle(fontSize: 11, color: Color(0xFF5D5D5D))),
                                                ),
                                              ] else if (isAddressUnconfirmed) ...[
                                                const SizedBox(height: 4),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFFFF3E0), // orange tint like Lieferando
                                                    borderRadius: BorderRadius.circular(4),
                                                  ),
                                                  child: Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      const Icon(Icons.info_outline, size: 12, color: Color(0xFFE65100)),
                                                      const SizedBox(width: 4),
                                                      Flexible(
                                                        child: Text(
                                                          'checkout.confirm_address_data'.tr(),
                                                          style: const TextStyle(fontSize: 11, color: Color(0xFFE65100), fontWeight: FontWeight.w500),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                        Icon(Icons.chevron_right, color: chevronColor, size: 22),
                                      ],
                                    ),
                                  ),
                                ),

                                // 🗺️ Mini Map Preview — tapping opens full-screen map picker (independent from address picker)
                                if (_addressLat != null && _addressLng != null) ...[
                                  Padding(
                                    padding: const EdgeInsets.only(left: 38),
                                    child: GestureDetector(
                                    onTap: () async {
                                      final result = await Navigator.of(context).push<Map<String, dynamic>>(
                                        MaterialPageRoute(
                                          builder: (_) => DeliveryMapPickerScreen(
                                            initialLat: _addressLat!,
                                            initialLng: _addressLng!,
                                            addressLabel: '$displayStreet, $displayCity',
                                            businessLat: (parent._butcherData?['latitude'] as num?)?.toDouble(),
                                            businessLng: (parent._butcherData?['longitude'] as num?)?.toDouble(),
                                            deliveryRadiusKm: (parent._butcherData?['deliveryRadius'] as num?)?.toDouble() ?? 5.0,
                                            isFineTuning: true,
                                            businessName: parent._butcherData?['name'] as String?,
                                          ),
                                        ),
                                      );
                                      if (result != null && mounted) {
                                        final rLat = result['lat'] as double;
                                        final rLng = result['lng'] as double;
                                        setState(() {
                                          _addressLat = rLat;
                                          _addressLng = rLng;
                                        });
                                        // Sync to parent for _submitOrder
                                        parent._addressLat = rLat;
                                        parent._addressLng = rLng;
                                      }
                                    },
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: SizedBox(
                                        height: 160,
                                        width: double.infinity,
                                        child: Stack(
                                          children: [
                                            IgnorePointer(
                                              child: FlutterMap(
                                                options: MapOptions(
                                                  initialCenter: LatLng(_addressLat!, _addressLng!),
                                                  initialZoom: 16.5,
                                                  interactionOptions: const InteractionOptions(
                                                    flags: InteractiveFlag.none,
                                                  ),
                                                ),
                                                children: [
                                                  TileLayer(
                                                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                                    userAgentPackageName: 'com.lokma.app',
                                                  ),
                                                  MarkerLayer(
                                                    rotate: true,
                                                    markers: [
                                                      Marker(
                                                        point: LatLng(_addressLat!, _addressLng!),
                                                        width: 40,
                                                        height: 40,
                                                        child: Container(
                                                          decoration: BoxDecoration(
                                                            color: brandRed,
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
                                                          child: const Icon(Icons.location_on, color: Colors.white, size: 20),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            // Tap hint overlay
                                            Positioned(
                                              bottom: 8,
                                              right: 8,
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                decoration: BoxDecoration(
                                                  color: Colors.black.withOpacity(0.6),
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Icon(Icons.open_in_full, color: Colors.white, size: 12),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      'checkout.set_delivery_location'.tr(),
                                                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w500),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                ],

                                Divider(height: 1, color: dividerColor),
                              ],
                            ),
                          );
                        },
                      ),

                    // ── Delivery Notes Row (hidden in dine-in) ──
                    if (!parent._isDineIn)
                    _buildCheckoutRow(
                      context,
                      icon: Icons.description_outlined,
                      iconColor: brandRed,
                      title: 'checkout.delivery_notes'.tr(),
                      trailing: (widget.noteController.text.trim().isNotEmpty)
                          ? Icon(Icons.check_circle, color: Colors.grey[700], size: 24)
                          : Icon(Icons.add_circle_outline, color: neutralIcon, size: 24),
                      dividerColor: dividerColor,
                      onTap: () {
                        // Show order note bottom sheet
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          builder: (ctx) => Padding(
                            padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('checkout.delivery_notes'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500)),
                                const SizedBox(height: 12),
                                TextField(
                                  controller: widget.noteController,
                                  maxLines: 3, minLines: 2,
                                  autofocus: true,
                                  textInputAction: TextInputAction.done,
                                  onSubmitted: (_) => Navigator.pop(ctx),
                                  decoration: InputDecoration(
                                    hintText: 'checkout.delivery_notes_hint'.tr(),
                                    hintStyle: TextStyle(color: Colors.grey[500], fontSize: 13),
                                    filled: true, fillColor: Theme.of(context).colorScheme.surface,
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                    contentPadding: const EdgeInsets.all(14),
                                  ),
                                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: () => Navigator.pop(ctx),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Theme.of(ctx).colorScheme.onSurface,
                                      foregroundColor: Theme.of(ctx).colorScheme.surface,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                    ),
                                    child: Text('checkout.done'.tr()),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ).then((_) => setState(() {}));
                      },
                    ),

                    // ── Delivery Time Row ──
                    if (!parent._isPickUp && !parent._isDineIn)
                      _buildCheckoutRow(
                        context,
                        icon: Icons.access_time,
                        iconColor: parent._deliveryTimeExplicitlyChosen ? Colors.grey[600]! : Colors.grey[500]!,
                        title: 'checkout.delivery_time'.tr(),
                        subtitle: !parent._deliveryTimeExplicitlyChosen
                            ? 'checkout.select_time'.tr()
                            : (parent._scheduledDeliverySlot != null
                                ? '📅 ${parent._scheduledDeliverySlot!.day.toString().padLeft(2,'0')}.${parent._scheduledDeliverySlot!.month.toString().padLeft(2,'0')} · ${parent._scheduledDeliverySlot!.hour.toString().padLeft(2,'0')}:${parent._scheduledDeliverySlot!.minute.toString().padLeft(2,'0')}'
                                : (parent._wantsScheduledDelivery ? 'checkout.plan_for_later'.tr() : 'checkout.now'.tr())),
                        badge: (!parent._deliveryTimeExplicitlyChosen || (parent._wantsScheduledDelivery && parent._scheduledDeliverySlot == null))
                            ? Container(
                                margin: const EdgeInsets.only(left: 6),
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.amber.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text('checkout.required'.tr(),
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.amber[800])),
                              )
                            : null,
                        trailing: Icon(Icons.chevron_right, color: chevronColor, size: 22),
                        dividerColor: null,
                        onTap: () {
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            shape: const RoundedRectangleBorder(
                              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                            ),
                            builder: (ctx) => StatefulBuilder(
                              builder: (ctx, setSheetState) {
                                return Padding(
                                  padding: EdgeInsets.only(
                                    left: 20, right: 20, top: 20,
                                    bottom: 20 + MediaQuery.of(ctx).viewInsets.bottom,
                                  ),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Drag handle
                                      Center(
                                        child: Container(
                                          width: 40, height: 4,
                                          margin: const EdgeInsets.only(bottom: 16),
                                          decoration: BoxDecoration(
                                            color: Colors.grey[400],
                                            borderRadius: BorderRadius.circular(2),
                                          ),
                                        ),
                                      ),
                                      Text('checkout.when'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500)),
                                      const SizedBox(height: 16),
                                      parent._buildDeliveryTimePicker(setSheetState),
                                      const SizedBox(height: 16),
                                      SizedBox(
                                        width: double.infinity,
                                        child: ElevatedButton(
                                          onPressed: (parent._wantsScheduledDelivery && parent._scheduledDeliverySlot == null)
                                              ? null  // Disabled until a time slot is selected
                                              : () {
                                                  // Persist to parent on dismiss
                                                  setState(() {});
                                                  Navigator.pop(ctx);
                                                },
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: parent._accentColor,
                                            foregroundColor: Colors.white,
                                            disabledBackgroundColor: Colors.grey[300],
                                            disabledForegroundColor: Colors.grey[500],
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                            padding: const EdgeInsets.symmetric(vertical: 14),
                                          ),
                                          child: Text(
                                            (parent._wantsScheduledDelivery && parent._scheduledDeliverySlot == null)
                                                ? 'checkout.select_time'.tr()
                                                : 'checkout.done'.tr(),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          );
                        },
                      ),

                    // ── Unavailability Preference Row (hidden in dine-in) ──
                    if (!parent._isDineIn)
                    Builder(builder: (ctx) {
                      String selectedLabel;
                      switch (parent._unavailabilityPreference) {
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
                          selectedLabel = 'marketplace.product_unavailable_refund'.tr();
                      }
                      return _buildCheckoutRow(
                        context,
                        icon: Icons.swap_horiz,
                        iconColor: brandRed,
                        title: 'marketplace.if_product_unavailable'.tr(),
                        subtitle: selectedLabel,
                        trailing: Icon(Icons.chevron_right, color: chevronColor, size: 22),
                        dividerColor: null,
                        onTap: () {
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            backgroundColor: isDark ? const Color(0xFF1C1C1E) : Colors.white,
                            shape: const RoundedRectangleBorder(
                              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                            ),
                            builder: (ctx) => StatefulBuilder(
                              builder: (ctx, setSheetState) => Padding(
                                padding: const EdgeInsets.all(20),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          'marketplace.if_product_unavailable'.tr(),
                                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500),
                                        ),
                                        const SizedBox(width: 6),
                                        Icon(Icons.info_outline, size: 16, color: Colors.grey[400]),
                                      ],
                                    ),
                                    const SizedBox(height: 16),
                                    parent._buildUnavailabilityOption(
                                      title: 'marketplace.product_unavailable_replace'.tr(),
                                      subtitle: 'marketplace.unavailable_replace_desc'.tr(),
                                      value: 'substitute',
                                      isDark: isDark,
                                      setSheetState: (fn) { setSheetState(fn); setState(() {}); },
                                    ),
                                    const SizedBox(height: 8),
                                    parent._buildUnavailabilityOption(
                                      title: 'marketplace.product_unavailable_refund'.tr(),
                                      subtitle: 'marketplace.unavailable_refund_desc'.tr(),
                                      value: 'refund',
                                      isDark: isDark,
                                      setSheetState: (fn) { setSheetState(fn); setState(() {}); },
                                    ),
                                    const SizedBox(height: 8),
                                    parent._buildUnavailabilityOption(
                                      title: 'marketplace.product_unavailable_choose'.tr(),
                                      subtitle: 'marketplace.unavailable_choose_desc'.tr(),
                                      value: 'perItem',
                                      isDark: isDark,
                                      setSheetState: (fn) { setSheetState(fn); setState(() {}); },
                                    ),
                                    const SizedBox(height: 16),
                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton(
                                        onPressed: () => Navigator.pop(ctx),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: parent._accentColor,
                                          foregroundColor: Colors.white,
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                          padding: const EdgeInsets.symmetric(vertical: 14),
                                        ),
                                        child: Text('cart.apply'.tr()),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      );
                    }),

                    // ── Pickup / Dine-In Row ──
                    if (parent._isPickUp || parent._isDineIn)
                      _buildCheckoutRow(
                        context,
                        icon: parent._isDineIn ? Icons.restaurant : Icons.store,
                        iconColor: brandRed,
                        title: parent._isDineIn ? 'checkout.dine_in'.tr() : 'checkout.pickup'.tr(),
                        subtitle: parent._butcherData?['companyName'] ?? widget.cart.butcherName ?? '',
                        trailing: Icon(Icons.chevron_right, color: chevronColor, size: 22),
                        dividerColor: null,
                        onTap: () {
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            builder: (ctx) => Padding(
                              padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(parent._isDineIn ? 'checkout.dine_in'.tr() : 'checkout.pickup'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500)),
                                  const SizedBox(height: 16),
                                  if (parent._isPickUp && !parent._isDineIn)
                                    parent._buildPickupTimePicker(setState),
                                  if (parent._isDineIn) ...[
                                    if (parent._scannedTableNumber != null)
                                      Padding(
                                        padding: const EdgeInsets.only(bottom: 8),
                                        child: Row(
                                          children: [
                                            Icon(Icons.lock, color: Colors.green, size: 16),
                                            const SizedBox(width: 6),
                                            Text(
                                              'cart.table_verified'.tr(namedArgs: {'tableNum': parent._scannedTableNumber ?? ''}),
                                              style: TextStyle(color: Colors.green[700], fontSize: 13),
                                            ),
                                          ],
                                        ),
                                      )
                                    else
                                      TextField(
                                        controller: parent._tableNumberController,
                                        keyboardType: TextInputType.number,
                                        textInputAction: TextInputAction.done,
                                        onSubmitted: (_) => Navigator.pop(ctx),
                                        onChanged: (val) => setState(() => parent._scannedTableNumber = val.trim().isNotEmpty ? val.trim() : null),
                                        decoration: InputDecoration(
                                          hintText: 'checkout.enter_table'.tr(),
                                          filled: true, fillColor: Theme.of(context).colorScheme.surface,
                                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                          prefixIcon: Icon(Icons.table_bar, color: neutralIcon, size: 20),
                                        ),
                                        style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14, fontWeight: FontWeight.w500),
                                      ),
                                  ],
                                  const SizedBox(height: 16),
                                  SizedBox(
                                    width: double.infinity,
                                    child: ElevatedButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      style: ElevatedButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.onSurface, foregroundColor: Theme.of(context).colorScheme.surface, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)), padding: const EdgeInsets.symmetric(vertical: 14)),
                                      child: Text('cart.apply'.tr()),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),

                    // ═══ SECTION DIVIDER ═══
                    Container(height: 10, color: sectionDividerColor),
                    // ═══════════════════════════════════════
                    // ORDER ITEMS SUMMARY — "Bestellübersicht"
                    // ═══════════════════════════════════════
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'checkout.order_summary'.tr(),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
                              fontSize: 17,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ...widget.cart.items.map<Widget>((item) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              children: [
                                Text('${item.quantity}x', style: TextStyle(color: Colors.grey[600], fontWeight: FontWeight.w500, fontSize: 14)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    I18nUtils.getLocalizedText(context, item.product.nameData),
                                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
                                  ),
                                ),
                                Text(
                                  '${item.totalPrice.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w500, fontSize: 14),
                                ),
                              ],
                            ),
                          )),
                          Divider(color: dividerColor),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('checkout.subtotal'.tr(), style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                              Text('${widget.total.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 13)),
                            ],
                          ),
                          if (!parent._isPickUp && !parent._isDineIn) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('checkout.delivery_fee'.tr(), style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
                                  Text('checkout.coupon_discount'.tr(), style: TextStyle(color: Colors.green[700], fontSize: 13)),
                                ]),
                                Text('-${widget.couponDiscount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Colors.green[700], fontSize: 13, fontWeight: FontWeight.w500)),
                              ],
                            ),
                          ],
                          if (widget.firstOrderDiscountAmount > 0) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('checkout.welcome_discount'.tr(), style: TextStyle(color: Colors.orange[700], fontSize: 13)),
                                Text('-${widget.firstOrderDiscountAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Colors.orange[700], fontSize: 13, fontWeight: FontWeight.w500)),
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
                                  Text('checkout.wallet'.tr(), style: TextStyle(color: Colors.green[700], fontSize: 13)),
                                ]),
                                Text('-${widget.walletApplied.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Colors.green[700], fontSize: 13, fontWeight: FontWeight.w500)),
                              ],
                            ),
                          ],
                          if (parent._tipAmount > 0) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('checkout.tip'.tr(), style: TextStyle(color: Colors.blue[700], fontSize: 13)),
                                Text('+${parent._tipAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Colors.blue[700], fontSize: 13, fontWeight: FontWeight.w500)),
                              ],
                            ),
                          ],
                          if (parent._donationAmount > 0) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('checkout.donation'.tr(), style: TextStyle(color: Colors.green[700], fontSize: 13)),
                                Text('+${parent._donationAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Colors.green[700], fontSize: 13, fontWeight: FontWeight.w500)),
                              ],
                            ),
                          ],
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('checkout.total'.tr(), style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w500, fontSize: 16)),
                              Text('${(widget.grandTotal + parent._donationAmount + parent._tipAmount).toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w500, fontSize: 16)),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // ═══ SECTION DIVIDER ═══
                    Container(height: 10, color: sectionDividerColor),

                    // ═══════════════════════════════════════
                    // SECTION 2: GUTSCHEINE UND RABATTE
                    // ═══════════════════════════════════════
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: Text('checkout.vouchers'.tr(), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                    ),
                    _buildCheckoutRow(
                      context,
                      icon: Icons.card_giftcard,
                      iconColor: brandRed,
                      title: parent._appliedCoupon?.isValid == true
                          ? '${parent._appliedCoupon!.code} (-${parent._appliedCoupon!.calculatedDiscount?.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()})'
                          : 'checkout.add_voucher'.tr(),
                      trailing: parent._appliedCoupon?.isValid == true
                          ? GestureDetector(
                              onTap: () => setState(() { parent._appliedCoupon = null; widget.couponController.clear(); }),
                              child: const Icon(Icons.close, color: Colors.red, size: 20),
                            )
                          : Icon(Icons.add_circle_outline, color: neutralIcon, size: 24),
                      dividerColor: null,
                      onTap: parent._appliedCoupon?.isValid == true ? null : () {
                         showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                          builder: (ctx) => Padding(
                            padding: EdgeInsets.fromLTRB(20, 24, 20, 24 + MediaQuery.of(ctx).viewInsets.bottom),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Handle bar
                                Center(
                                  child: Container(
                                    width: 40, height: 4,
                                    decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
                                  ),
                                ),
                                const SizedBox(height: 20),
                                Text('checkout.vouchers'.tr(), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                                const SizedBox(height: 16),
                                TextField(
                                  controller: widget.couponController,
                                  textCapitalization: TextCapitalization.characters,
                                  textInputAction: TextInputAction.done,
                                  autofocus: true,
                                  decoration: InputDecoration(
                                    hintText: 'marketplace.enter_coupon'.tr(),
                                    hintStyle: TextStyle(color: Colors.grey[400], fontSize: 15),
                                    filled: true, fillColor: isDark ? Colors.grey[850] : const Color(0xFFF7F7F7),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(14),
                                      borderSide: BorderSide(color: isDark ? Colors.grey[500]! : Colors.grey[400]!, width: 1.5),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                                    prefixIcon: Icon(Icons.local_offer_outlined, color: parent._accentColor, size: 22),
                                  ),
                                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15, fontWeight: FontWeight.w500, letterSpacing: 1.5),
                                ),
                                const SizedBox(height: 16),
                                SizedBox(
                                  width: double.infinity,
                                  height: 52,
                                  child: ElevatedButton(
                                    onPressed: parent._isValidatingCoupon ? null : () async {
                                      final code = widget.couponController.text.trim();
                                      if (code.isEmpty) return;
                                      setState(() => parent._isValidatingCoupon = true);
                                      final result = await parent._couponService.validateCoupon(
                                        code: code, orderAmount: widget.total,
                                        businessId: widget.cart.butcherId,
                                        userId: FirebaseAuth.instance.currentUser?.uid,
                                      );
                                      setState(() { parent._isValidatingCoupon = false; parent._appliedCoupon = result; });
                                      if (result.isValid && ctx.mounted) Navigator.pop(ctx);
                                      if (!result.isValid && ctx.mounted) {
                                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(result.errorMessage ?? 'marketplace.invalid_coupon'.tr()), backgroundColor: Theme.of(ctx).colorScheme.error));
                                      }
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: parent._accentColor,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                                      elevation: 0,
                                    ),
                                    child: parent._isValidatingCoupon
                                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                        : Text('cart.apply'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),

                    // ═══ SECTION DIVIDER ═══
                    Container(height: 10, color: sectionDividerColor),

                    // ═══════════════════════════════════════
                    // SECTION 3: DRIVER TIP (only for delivery)
                    // ═══════════════════════════════════════
                    if (!parent._isPickUp && !parent._isDineIn) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                        child: Row(
                          children: [
                            Text('checkout.tip_title'.tr(), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                            const SizedBox(width: 6),
                            GestureDetector(
                              onTap: () {
                                final sheetDark = Theme.of(context).brightness == Brightness.dark;
                                showModalBottomSheet(
                                  context: context,
                                  isScrollControlled: true,
                                  backgroundColor: sheetDark ? const Color(0xFF1C1C1E) : Colors.white,
                                  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                                  builder: (ctx) => SafeArea(
                                    child: Padding(
                                      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          // Handle bar
                                          Container(width: 40, height: 4, decoration: BoxDecoration(color: sheetDark ? Colors.grey[700] : Colors.grey[300], borderRadius: BorderRadius.circular(2))),
                                          const SizedBox(height: 28),
                                          // Simple delivery icon
                                          Icon(Icons.delivery_dining, size: 56, color: sheetDark ? Colors.grey[400] : Colors.grey[600]),
                                          const SizedBox(height: 20),
                                          Text('checkout.tip_info_title'.tr(), textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: sheetDark ? Colors.white : Colors.black87)),
                                          const SizedBox(height: 14),
                                          Text('checkout.tip_info_body'.tr(), style: TextStyle(fontSize: 14, color: sheetDark ? Colors.grey[400] : Colors.grey[600], height: 1.5)),
                                          const SizedBox(height: 28),
                                          SizedBox(
                                            width: double.infinity,
                                            child: ElevatedButton(
                                              onPressed: () => Navigator.pop(ctx),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: parent._accentColor,
                                                foregroundColor: Colors.white,
                                                elevation: 0,
                                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                                padding: const EdgeInsets.symmetric(vertical: 14),
                                              ),
                                              child: Text('checkout.tip_info_dismiss'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                              child: Icon(Icons.info_outline, size: 20, color: Colors.grey[400]),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text('checkout.tip_subtitle'.tr(), style: TextStyle(fontSize: 13, color: Colors.grey[500], height: 1.4)),
                      ),
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Row(
                          children: [
                            for (final tipVal in [1.50, 2.50, 3.50]) ...[
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => setState(() => parent._tipAmount = parent._tipAmount == tipVal ? 0.0 : tipVal),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 200),
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    decoration: BoxDecoration(
                                      color: parent._tipAmount == tipVal
                                          ? Colors.blue[700]
                                          : (isDark ? Colors.grey[800] : sectionDividerColor),
                                      borderRadius: BorderRadius.circular(24),
                                      border: Border.all(
                                        color: parent._tipAmount == tipVal ? Colors.blue[700]! : (isDark ? Colors.grey[700]! : const Color(0xFFE8E0D0)),
                                        width: 1,
                                      ),
                                    ),
                                    child: Center(
                                      child: Text(
                                        '${tipVal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                                        style: TextStyle(
                                          color: parent._tipAmount == tipVal ? Colors.white : Theme.of(context).colorScheme.onSurface,
                                          fontWeight: FontWeight.w500,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            // "Andere / Diğer / Other" button
                            Expanded(
                              child: GestureDetector(
                                onTap: () {
                                  final isCustom = parent._tipAmount > 0 && parent._tipAmount != 1.50 && parent._tipAmount != 2.50 && parent._tipAmount != 3.50;
                                  final controller = TextEditingController(text: isCustom ? parent._tipAmount.toStringAsFixed(2) : '');
                                  showModalBottomSheet(
                                    context: context,
                                    isScrollControlled: true,
                                    backgroundColor: Theme.of(context).colorScheme.surface,
                                    shape: const RoundedRectangleBorder(
                                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                                    ),
                                    builder: (ctx) => Padding(
                                      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text('checkout.tip_custom'.tr(), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500)),
                                          const SizedBox(height: 12),
                                          TextField(
                                            controller: controller,
                                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                            autofocus: true,
                                            decoration: InputDecoration(
                                              hintText: '0.00', filled: true, fillColor: Theme.of(context).colorScheme.surface,
                                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                              suffixText: CurrencyUtils.getCurrencySymbol(),
                                            ),
                                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 18, fontWeight: FontWeight.w500),
                                          ),
                                          const SizedBox(height: 12),
                                          SizedBox(
                                            width: double.infinity,
                                            child: ElevatedButton(
                                              onPressed: () {
                                                final val = double.tryParse(controller.text.replaceAll(',', '.')) ?? 0.0;
                                                setState(() => parent._tipAmount = val);
                                                Navigator.pop(ctx);
                                              },
                                              style: ElevatedButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.onSurface, foregroundColor: Theme.of(context).colorScheme.surface, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)), padding: const EdgeInsets.symmetric(vertical: 14)),
                                              child: Text('cart.apply'.tr()),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  decoration: BoxDecoration(
                                    color: parent._tipAmount > 0 && parent._tipAmount != 1.50 && parent._tipAmount != 2.50 && parent._tipAmount != 3.50
                                        ? Colors.blue[700]
                                        : (isDark ? Colors.grey[800] : sectionDividerColor),
                                    borderRadius: BorderRadius.circular(24),
                                    border: Border.all(
                                      color: parent._tipAmount > 0 && parent._tipAmount != 1.50 && parent._tipAmount != 2.50 && parent._tipAmount != 3.50
                                          ? Colors.blue[700]! : (isDark ? Colors.grey[700]! : const Color(0xFFE8E0D0)),
                                      width: 1,
                                    ),
                                  ),
                                  child: Center(
                                    child: Text(
                                      parent._tipAmount > 0 && parent._tipAmount != 1.50 && parent._tipAmount != 2.50 && parent._tipAmount != 3.50
                                          ? '${parent._tipAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}'
                                          : 'checkout.tip_other'.tr(),
                                      style: TextStyle(
                                        color: parent._tipAmount > 0 && parent._tipAmount != 1.50 && parent._tipAmount != 2.50 && parent._tipAmount != 3.50
                                            ? Colors.white : Theme.of(context).colorScheme.onSurface,
                                        fontWeight: FontWeight.w500,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(height: 10, color: sectionDividerColor),
                    ],

                    // ═══════════════════════════════════════
                    // SECTION 4: DONATION / AUFRUNDEN (if enabled)
                    // ═══════════════════════════════════════
                    if (parent._donationEnabled) ...[
                      Builder(builder: (context) {
                        final currency = CurrencyUtils.getCurrencySymbol();
                        final baseTotal = widget.grandTotal;
                        // Dynamic round-up helpers
                        double _roundUpTo(double val, double step) {
                          final rounded = (val / step).ceil() * step;
                          return rounded <= val ? val + step : rounded;
                        }
                        final roundHalf = _roundUpTo(baseTotal, 0.50);
                        final round1   = _roundUpTo(baseTotal, 1.00);
                        final round5   = _roundUpTo(baseTotal, 5.00);
                        final round10  = _roundUpTo(baseTotal, 10.00);
                        // Dynamic options: show round-up difference with + prefix (deduplicated)
                        final rawOptions = <Map<String, dynamic>>[
                          {'label': '+${(roundHalf - baseTotal).toStringAsFixed(2)} $currency', 'donation': double.parse((roundHalf - baseTotal).toStringAsFixed(2))},
                          {'label': '+${(round1 - baseTotal).toStringAsFixed(2)} $currency', 'donation': double.parse((round1 - baseTotal).toStringAsFixed(2))},
                          {'label': '+${(round5 - baseTotal).toStringAsFixed(2)} $currency', 'donation': double.parse((round5 - baseTotal).toStringAsFixed(2))},
                          {'label': '+${(round10 - baseTotal).toStringAsFixed(2)} $currency', 'donation': double.parse((round10 - baseTotal).toStringAsFixed(2))},
                        ];
                        // Remove duplicate donation amounts
                        final seen = <double>{};
                        final options = <Map<String, dynamic>>[];
                        for (final o in rawOptions) {
                          if (seen.add(o['donation'] as double)) options.add(o);
                        }
                        final selectedDonation = parent._donationAmount;
                        final newTotal = baseTotal + selectedDonation;
                        return Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Title row with ℹ button (inline, right after title)
                              Row(
                                children: [
                                  Text('checkout.donation_title'.tr(), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurface)),
                                  const SizedBox(width: 6),
                                  GestureDetector(
                                    onTap: () {
                                      final sheetDark = Theme.of(context).brightness == Brightness.dark;
                                      showModalBottomSheet(
                                        context: context,
                                        backgroundColor: Colors.transparent,
                                        builder: (ctx) => Container(
                                          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
                                          decoration: BoxDecoration(
                                            color: sheetDark ? const Color(0xFF1C1C1E) : Colors.white,
                                            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                                          ),
                                          child: Column(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Container(width: 36, height: 4, decoration: BoxDecoration(color: sheetDark ? Colors.white24 : Colors.black12, borderRadius: BorderRadius.circular(2))),
                                              const SizedBox(height: 20),
                                              Icon(Icons.volunteer_activism, size: 40, color: Colors.green[600]),
                                              const SizedBox(height: 12),
                                              Text('checkout.donation_sheet_title'.tr(), textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: sheetDark ? Colors.white : Colors.black87)),
                                              const SizedBox(height: 14),
                                              Text('checkout.donation_sheet_body'.tr(), style: TextStyle(fontSize: 14, color: sheetDark ? Colors.grey[400] : Colors.grey[600], height: 1.5)),
                                              const SizedBox(height: 20),
                                              SizedBox(
                                                width: double.infinity,
                                                child: OutlinedButton.icon(
                                                  onPressed: () {
                                                    Navigator.pop(ctx);
                                                    launchUrl(Uri.parse('https://dr-sahin.help/pages/uber-uns'), mode: LaunchMode.externalApplication);
                                                  },
                                                  icon: const Icon(Icons.open_in_new, size: 16),
                                                  label: Text('checkout.donation_learn_more'.tr()),
                                                  style: OutlinedButton.styleFrom(
                                                    foregroundColor: Colors.green[700],
                                                    side: BorderSide(color: Colors.green[300]!),
                                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(height: 10),
                                              SizedBox(
                                                width: double.infinity,
                                                child: ElevatedButton(
                                                  onPressed: () => Navigator.pop(ctx),
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: Colors.green,
                                                    foregroundColor: Colors.white,
                                                    elevation: 0,
                                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                                  ),
                                                  child: Text('checkout.tip_info_dismiss'.tr(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      );
                                    },
                                    child: Icon(Icons.info_outline, size: 20, color: Colors.grey[400]),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text('checkout.donation_subtitle'.tr(), style: TextStyle(color: Colors.grey[500], fontSize: 13, height: 1.4)),
                              const SizedBox(height: 14),
                              // Donation chips — pill-shaped, incremental
                              Row(
                                children: [
                                  for (int i = 0; i < options.length; i++) ...[
                                    if (i > 0) const SizedBox(width: 8),
                                    Expanded(
                                      child: GestureDetector(
                                        onTap: () => setState(() {
                                          final newDonation = options[i]['donation'] as double;
                                          parent._donationAmount = parent._donationAmount == newDonation ? 0.0 : newDonation;
                                        }),
                                        child: AnimatedContainer(
                                          duration: const Duration(milliseconds: 200),
                                          padding: const EdgeInsets.symmetric(vertical: 8),
                                          decoration: BoxDecoration(
                                            color: selectedDonation == (options[i]['donation'] as double)
                                                ? Colors.green
                                                : (isDark ? Colors.grey[800] : sectionDividerColor),
                                            borderRadius: BorderRadius.circular(24),
                                            border: Border.all(
                                              color: selectedDonation == (options[i]['donation'] as double)
                                                  ? Colors.green
                                                  : (isDark ? Colors.grey[700]! : const Color(0xFFE8E0D0)),
                                              width: 1,
                                            ),
                                          ),
                                          child: Center(
                                            child: Text(options[i]['label'] as String, style: TextStyle(
                                              color: selectedDonation == (options[i]['donation'] as double) ? Colors.white : Theme.of(context).colorScheme.onSurface,
                                              fontWeight: FontWeight.w500, fontSize: 12)),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              // Confirmation banner with from → to amounts
                              if (selectedDonation > 0) ...[
                                const SizedBox(height: 10),
                                Builder(builder: (_) {
                                  final isActualRoundUp = (baseTotal * 100) % 100 != 0;
                                  return Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Heart icon in brand red with gentle scale-in
                                      TweenAnimationBuilder<double>(
                                        tween: Tween(begin: 0.7, end: 1.0),
                                        duration: const Duration(milliseconds: 600),
                                        curve: Curves.elasticOut,
                                        builder: (context, scale, child) {
                                          return Transform.scale(scale: scale, child: child);
                                        },
                                        child: const Icon(Icons.favorite, size: 16, color: Color(0xFFF41C54)),
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              isActualRoundUp
                                                  ? 'checkout.donation_thanks'.tr()
                                                  : 'checkout.donation_thanks_direct'.tr(),
                                              style: TextStyle(
                                                color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[300] : const Color(0xFF3E3E3E),
                                                fontSize: 13,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              isActualRoundUp
                                                  ? '${CurrencyUtils.getCurrencySymbol()}${baseTotal.toStringAsFixed(2)} → ${CurrencyUtils.getCurrencySymbol()}${newTotal.toStringAsFixed(2)} – ${CurrencyUtils.getCurrencySymbol()}${selectedDonation.toStringAsFixed(2)} Spende'
                                                  : '${CurrencyUtils.getCurrencySymbol()}${selectedDonation.toStringAsFixed(2)} Spende',
                                              style: TextStyle(
                                                color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[500] : Colors.grey[600],
                                                fontSize: 11,
                                                fontWeight: FontWeight.w400,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  );
                                }),
                              ],
                              // ── Charity reference (always visible) ──
                              const SizedBox(height: 12),
                              GestureDetector(
                                onTap: () => launchUrl(Uri.parse('https://dr-sahin.help/pages/uber-uns'), mode: LaunchMode.externalApplication),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.center,
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: Image.network(
                                        'https://dr-sahin.help/cdn/shop/files/HELP_500x.png?v=1622386229',
                                        width: 22,
                                        height: 22,
                                        fit: BoxFit.contain,
                                        errorBuilder: (_, __, ___) => Icon(Icons.volunteer_activism, size: 18, color: Colors.green[400]),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'checkout.donation_charity_ref'.tr(),
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.grey[500],
                                          height: 1.3,
                                        ),
                                      ),
                                    ),
                                    Icon(Icons.open_in_new, size: 12, color: Colors.grey[400]),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                      Container(height: 10, color: sectionDividerColor),
                    ],

                    // ═══════════════════════════════════════
                    // SECTION 5: PAYMENT METHOD (inline chips)
                    // ═══════════════════════════════════════
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                      child: Text(
                        'checkout.payment_title'.tr(),
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w500,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ),
                    // Inline payment method chips
                    Builder(builder: (ctx) {
                      final payMethodsSettings = (parent._butcherData?['paymentMethods'] as Map<String, dynamic>?) ?? {};
                      final allowCard = payMethodsSettings['card'] != false;
                      final allowCash = payMethodsSettings['cash'] != false;
                      final allowCardOnDelivery = payMethodsSettings['cardOnDelivery'] != false;
                      final allowKlarna = payMethodsSettings['klarna'] == true;

                      final isDeliveryMode = !parent._isPickUp && !parent._isDineIn;
                      final options = <({String key, String label, IconData icon})>[
                        if (allowCard) (key: 'card', label: 'checkout.card'.tr(), icon: Icons.credit_card),
                        if (allowCash) (key: 'cash', label: 'checkout.cash'.tr(), icon: Icons.payments_outlined),
                        if (allowCardOnDelivery && isDeliveryMode) (key: 'cardOnDelivery', label: 'checkout.card_on_delivery'.tr(), icon: Icons.contactless),
                        if (allowKlarna) (key: 'klarna', label: 'Klarna', icon: Icons.schedule_outlined),
                      ];

                      if (options.isEmpty) return const SizedBox.shrink();

                      // Only reset if the currently selected method is no longer available
                      // Do NOT auto-select when null — user must explicitly choose
                      final availableKeys = options.map((o) => o.key).toSet();
                      if (parent._paymentMethod != null && !availableKeys.contains(parent._paymentMethod)) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) {
                            setState(() => parent._paymentMethod = null);
                          }
                        });
                      }

                      return Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                        child: Column(
                          children: options.map((opt) {
                            final isSelected = parent._paymentMethod == opt.key;
                            return GestureDetector(
                              onTap: () {
                                HapticFeedback.lightImpact();
                                setState(() => parent._paymentMethod = opt.key);
                              },
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 14),
                                child: Row(
                                  children: [
                                    // Radio circle
                                    AnimatedContainer(
                                      duration: const Duration(milliseconds: 200),
                                      width: 22,
                                      height: 22,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: isSelected
                                              ? (isDark ? Colors.white : const Color(0xFF444444))
                                              : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                                          width: 2,
                                        ),
                                        color: isSelected
                                            ? (isDark ? Colors.white : const Color(0xFF444444))
                                            : Colors.transparent,
                                      ),
                                      child: isSelected
                                          ? Center(child: Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: isDark ? const Color(0xFF444444) : Colors.white)))
                                          : null,
                                    ),
                                    const SizedBox(width: 12),
                                    Icon(
                                      opt.icon,
                                      size: 18,
                                      color: isSelected
                                          ? Theme.of(context).colorScheme.onSurface
                                          : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      opt.label,
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                                        color: isSelected
                                            ? Theme.of(context).colorScheme.onSurface
                                            : Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      );
                    }),
                    // Wallet toggle
                    if (parent._walletBalance > 0) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Row(
                          children: [
                            const Icon(Icons.account_balance_wallet_outlined, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text('checkout.use_wallet'.tr(namedArgs: {'amount': parent._walletBalance.toStringAsFixed(2)}),
                                style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14)),
                            ),
                            Switch.adaptive(
                              value: parent._useWallet,
                              onChanged: (v) => setState(() => parent._useWallet = v),
                              activeTrackColor: parent._accentColor,
                            ),
                          ],
                        ),
                      ),
                    ],
                    // Legal disclaimer moved here, below payment chips
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Builder(
                        builder: (context) {
                          final isDark = Theme.of(context).brightness == Brightness.dark;
                          final linkColor = isDark ? Colors.white70 : Colors.grey[700]!;
                          final textColor = isDark ? Colors.grey[500]! : Colors.grey[500]!;
                          return Wrap(
                            alignment: WrapAlignment.center,
                            runAlignment: WrapAlignment.center,
                            children: [
                              Text('checkout.legal_disclaimer_prefix'.tr(), style: TextStyle(color: textColor, fontSize: 12, height: 1.4, fontWeight: FontWeight.w400)),
                              GestureDetector(
                                onTap: () => _showLegalSheet(context, 'checkout.privacy_policy_title'.tr(), 'checkout.privacy_policy_content'.tr()),
                                child: Text('checkout.legal_disclaimer_privacy'.tr(), style: TextStyle(color: linkColor, fontSize: 12, height: 1.4, fontWeight: FontWeight.w400, decoration: TextDecoration.underline, decorationColor: linkColor)),
                              ),
                              Text('checkout.legal_disclaimer_and'.tr(), style: TextStyle(color: textColor, fontSize: 12, height: 1.4, fontWeight: FontWeight.w400)),
                              GestureDetector(
                                onTap: () => _showLegalSheet(context, 'checkout.terms_title'.tr(), 'checkout.terms_content'.tr()),
                                child: Text('checkout.legal_disclaimer_terms'.tr(), style: TextStyle(color: linkColor, fontSize: 12, height: 1.4, fontWeight: FontWeight.w400, decoration: TextDecoration.underline, decorationColor: linkColor)),
                              ),
                              Text('checkout.legal_disclaimer_suffix'.tr(), style: TextStyle(color: textColor, fontSize: 12, height: 1.4, fontWeight: FontWeight.w400)),
                            ],
                          );
                        },
                      ),
                    ),
                    // Extra spacing at bottom for safe scrolling
                    const SizedBox(height: 100),
                  ],
                ),
              ),
            ),
          // ─── Floating Submit button + Legal ─────────────────────────
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(20, 10, 20, MediaQuery.of(context).padding.bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onTap: parent._isSubmitting ? null : () {
                      // Payment method check
                      if (parent._paymentMethod == null) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Row(
                            children: [
                              const Icon(Icons.info_outline, color: Color(0xFFE65100), size: 18),
                              const SizedBox(width: 8),
                              Flexible(child: Text('checkout.select_payment_first'.tr(), style: const TextStyle(color: Color(0xFFE65100), fontWeight: FontWeight.w500, fontSize: 13))),
                            ],
                          ),
                          backgroundColor: const Color(0xFFFFF3E0),
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          duration: const Duration(seconds: 2),
                        ));
                        return;
                      }
                      // Delivery time check: for delivery mode, user must explicitly choose
                      if (!parent._isPickUp && !parent._isDineIn && !parent._deliveryTimeExplicitlyChosen) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Row(
                            children: [
                              const Icon(Icons.schedule, color: Color(0xFFE65100), size: 18),
                              const SizedBox(width: 8),
                              Flexible(child: Text('checkout.select_delivery_time_first'.tr(), style: const TextStyle(color: Color(0xFFE65100), fontWeight: FontWeight.w500, fontSize: 13))),
                            ],
                          ),
                          backgroundColor: const Color(0xFFFFF3E0),
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          duration: const Duration(seconds: 2),
                        ));
                        return;
                      }
                      if (parent._isPickUp && !parent._isDineIn && parent._selectedPickupSlot == null) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('cart.please_select_pickup_time'.tr()), backgroundColor: Colors.amber, behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
                        return;
                      }
                      if (parent._isDineIn && (parent._scannedTableNumber ?? parent._tableNumberController.text.trim()).isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('orders.please_enter_table_number')), backgroundColor: Colors.amber, behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
                        return;
                      }
                      parent._orderNote = widget.noteController.text;
                      Navigator.pop(context);
                      parent._submitOrder();
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: parent._isSubmitting
                            ? Colors.grey
                            : (parent._paymentMethod == null || (!parent._isPickUp && !parent._isDineIn && !parent._deliveryTimeExplicitlyChosen)
                                ? Colors.grey[400]
                                : accentColor),
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: parent._paymentMethod != null && (parent._isPickUp || parent._isDineIn || parent._deliveryTimeExplicitlyChosen)
                            ? [BoxShadow(color: accentColor.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))]
                            : null,
                      ),
                      child: Center(
                        child: parent._isSubmitting
                            ? SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Theme.of(context).colorScheme.surface, strokeWidth: 2.5))
                            : parent._paymentMethod == 'card'
                                ? Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.credit_card, color: Colors.white, size: 20),
                                      const SizedBox(width: 6),
                                      Text(
                                        '${'checkout.submit'.tr()} · ${(widget.grandTotal + parent._donationAmount + parent._tipAmount).toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500),
                                      ),
                                    ],
                                  )
                                : Text(
                                    parent._isDineIn && parent._scannedTableNumber != null
                                      ? '${'checkout.submit'.tr()} · Masa ${parent._scannedTableNumber}'
                                      : '${'checkout.submit'.tr()} · ${(widget.grandTotal + parent._donationAmount + parent._tipAmount).toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                                    style: TextStyle(color: Theme.of(context).colorScheme.surface, fontSize: 16, fontWeight: FontWeight.w500),
                                  ),
                      ),
                    ),
                  ),

                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

}

/// ────────────────────────────────────────────────────────────────
/// Full-page payment method selection — Lieferando "Bezahlmethode wählen" style
/// ────────────────────────────────────────────────────────────────
class _PaymentMethodSelectionPage extends StatefulWidget {
  final String? currentMethod;
  final Color accentColor;
  final bool allowCard;
  final bool allowCash;
  final bool allowPayLater;
  final bool allowCardOnDelivery;

  const _PaymentMethodSelectionPage({
    required this.currentMethod,
    required this.accentColor,
    required this.allowCard,
    required this.allowCash,
    required this.allowPayLater,
    required this.allowCardOnDelivery,
  });

  @override
  State<_PaymentMethodSelectionPage> createState() => _PaymentMethodSelectionPageState();
}

class _PaymentMethodSelectionPageState extends State<_PaymentMethodSelectionPage> {
  late String? _selected;

  @override
  void initState() {
    super.initState();
    _selected = widget.currentMethod;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? Theme.of(context).colorScheme.surface : Colors.white;
    final cardBg = isDark ? Colors.grey[900]! : Colors.white;
    final borderColor = isDark ? Colors.grey[700]! : const Color(0xFFE0E0E0);
    final selectedBorderColor = widget.accentColor;

    // Build payment options
    final options = <({String key, String label, Widget icon})>[
      if (widget.allowCard) (
        key: 'card',
        label: 'checkout.card'.tr(),
        icon: Container(
          width: 36, height: 24,
          decoration: BoxDecoration(
            border: Border.all(color: borderColor, width: 1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Center(
            child: Icon(Icons.credit_card, size: 16, color: isDark ? Colors.grey[300] : Colors.grey[700]),
          ),
        ),
      ),
      if (widget.allowCash) (
        key: 'cash',
        label: 'checkout.cash'.tr(),
        icon: Container(
          width: 36, height: 24,
          decoration: BoxDecoration(
            color: const Color(0xFF4CAF50),
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Center(child: Icon(Icons.payments_outlined, size: 16, color: Colors.white)),
        ),
      ),
      if (widget.allowCardOnDelivery) (
        key: 'cardOnDelivery',
        label: 'checkout.card_on_delivery'.tr(),
        icon: Container(
          width: 36, height: 24,
          decoration: BoxDecoration(
            color: const Color(0xFF2196F3),
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Center(child: Icon(Icons.contactless, size: 16, color: Colors.white)),
        ),
      ),
      if (widget.allowPayLater) (
        key: 'payLater',
        label: 'checkout.pay_later'.tr(),
        icon: Container(
          width: 36, height: 24,
          decoration: BoxDecoration(
            color: const Color(0xFF9C27B0),
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Center(child: Icon(Icons.schedule, size: 16, color: Colors.white)),
        ),
      ),
    ];

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: Theme.of(context).colorScheme.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        centerTitle: true,
        title: Text(
          'checkout.select_payment_method'.tr(),
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 17,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Subtle top divider
            Container(height: 1, color: borderColor),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    // Section header
                    Text(
                      'checkout.payment_methods'.tr(),
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w500,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Payment option cards
                    ...options.map((opt) {
                      final isSelected = _selected == opt.key;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => setState(() => _selected = opt.key),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                            decoration: BoxDecoration(
                              color: cardBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? selectedBorderColor : borderColor,
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                opt.icon,
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Text(
                                    opt.label,
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
                                      color: Theme.of(context).colorScheme.onSurface,
                                    ),
                                  ),
                                ),
                                if (isSelected)
                                  Icon(Icons.check_circle, color: widget.accentColor, size: 22),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            // Bottom confirm button
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: _selected != null ? () => Navigator.pop(context, _selected) : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: widget.accentColor,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.grey[300],
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(27)),
                    elevation: 0,
                  ),
                  child: Text(
                    'checkout.confirm'.tr(),
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500),
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
