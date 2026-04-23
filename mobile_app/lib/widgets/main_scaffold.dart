import 'dart:ui';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../providers/cart_provider.dart';
import '../providers/kermes_cart_provider.dart';
import '../providers/bottom_nav_provider.dart';
import '../services/order_service.dart';
import '../models/kermes_order_model.dart';
import '../screens/orders/courier_tracking_screen.dart';
import '../providers/unpaid_kermes_orders_provider.dart';
import '../widgets/kermes/order_qr_dialog.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../widgets/apple_glass_container.dart';

class MainScaffold extends ConsumerStatefulWidget {
  final Widget child;

  const MainScaffold({super.key, required this.child});

  static List<NavItemData> get items => [
        NavItemData(
            icon: Icons.restaurant_menu,
            label: 'navigation.food'.tr(),
            path: '/restoran'),
        NavItemData(
            icon: Icons.storefront_rounded,
            label: 'navigation.market'.tr(),
            path: '/market'),
        NavItemData(
            icon: null,
            label: 'navigation.kermes'.tr(),
            path: '/kermesler',
            isKermes: true),
        NavItemData(
            icon: Icons.shopping_bag_rounded,
            label: 'navigation.cart'.tr(),
            path: '/cart',
            isCart: true),
        NavItemData(
            icon: Icons.person_rounded,
            label: 'navigation.profile'.tr(),
            path: '/profile'),
      ];

  @override
  ConsumerState<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends ConsumerState<MainScaffold>
    with SingleTickerProviderStateMixin {
  // Animation for hopping motorcycle
  late AnimationController _hopController;
  late Animation<double> _hopAnimation;

  // Active delivery stream
  Stream<List<LokmaOrder>>? _activeOrdersStream;

  // Scroll state for dynamic glassmorphism
  bool _isScrolled = false;

  @override
  void initState() {
    super.initState();
    _hopController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    )..repeat(reverse: true);

    _hopAnimation = Tween<double>(begin: 0, end: -6).animate(
      CurvedAnimation(parent: _hopController, curve: Curves.easeInOut),
    );

    _initActiveOrdersStream();
  }

  void _initActiveOrdersStream() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    // Query ALL active deliveries — sort client-side by urgency
    _activeOrdersStream = FirebaseFirestore.instance
        .collection('meat_orders')
        .where('userId', isEqualTo: user.uid)
        .where('status', isEqualTo: 'onTheWay')
        .snapshots()
        .map((snapshot) {
      final orders =
          snapshot.docs.map((doc) => LokmaOrder.fromFirestore(doc)).toList();

      // Sort by urgency: onTheWay > ready > preparing > pending
      const priority = {
        'onTheWay': 0,
        'ready': 1,
        'preparing': 2,
        'pending': 3,
      };
      orders.sort((a, b) {
        final ap = priority[a.status.name] ?? 4;
        final bp = priority[b.status.name] ?? 4;
        if (ap != bp) return ap.compareTo(bp);
        // Same priority → newer first
        return b.createdAt.compareTo(a.createdAt);
      });

      return orders;
    }).handleError((e) {
      debugPrint('[MainScaffold] Active orders stream error: $e');
      return <LokmaOrder>[];
    });
  }

  @override
  void dispose() {
    _hopController.dispose();
    super.dispose();
  }

  int _getSelectedIndex(BuildContext context) {
    final currentPath = GoRouterState.of(context).uri.path;
    for (int i = 0; i < MainScaffold.items.length; i++) {
      if (currentPath == MainScaffold.items[i].path) return i;
    }
    return 0;
  }

  void _navigateToOrder(LokmaOrder order) {
    // Always go to courier tracking screen for the specific order
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CourierTrackingScreen(orderId: order.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cartState = ref.watch(cartProvider);
    final kermesCartState = ref.watch(kermesCartProvider);
    final cartItemCount = cartState.items.length + kermesCartState.items.length;
    final selectedIndex = _getSelectedIndex(context);

    final currentPath = GoRouterState.of(context).uri.path;
    final isCartPage = currentPath == '/cart';
    final isBottomNavVisible = ref.watch(bottomNavVisibilityProvider);

    // Self-healing: if we left /cart but navbar is still hidden (dispose race
    // condition), force it back to visible on the next frame.
    if (!isCartPage && !isBottomNavVisible) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref.read(bottomNavVisibilityProvider.notifier).setVisible(true);
        }
      });
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Status Bar: dark mode → white icons, light mode → dark icons
    SystemChrome.setSystemUIOverlayStyle(
        isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark);

    return Scaffold(
      extendBody: true,
      body: NotificationListener<ScrollNotification>(
        onNotification: (ScrollNotification notification) {
          // Check if scrolling is happening on the primary scroll view (usually axis == vertical)
          if (notification.depth == 0 || notification.metrics.axis == Axis.vertical) {
            final isScrolled = notification.metrics.pixels > 20;
            if (isScrolled != _isScrolled) {
              // Use addPostFrameCallback or setState if safe
              setState(() {
                _isScrolled = isScrolled;
              });
            }
          }
          return false;
        },
        child: Stack(
          children: [
            widget.child,
          // Floating active delivery button (only when logged in)
          if (_activeOrdersStream != null &&
              !isCartPage &&
              FirebaseAuth.instance.currentUser != null)
            StreamBuilder<List<LokmaOrder>>(
              stream: _activeOrdersStream,
              builder: (context, snapshot) {
                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return const SizedBox.shrink();
                }

                final activeOrder = snapshot.data!.first;
                return _buildFloatingDeliveryButton(activeOrder);
              },
            ),
          // Floating Unpaid QR Button for Kermes Cash Orders
          if (FirebaseAuth.instance.currentUser != null)
            Consumer(
              builder: (context, ref, child) {
                final unpaidOrdersState = ref.watch(unpaidKermesOrdersProvider);
                return unpaidOrdersState.when(
                  data: (orders) {
                    if (orders.isEmpty) return const SizedBox.shrink();
                    return _buildFloatingQRButton(orders.first);
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                );
              },
            ),
        ],
        ),
      ),
      bottomNavigationBar: (!isBottomNavVisible)
          ? null
          : GlassBottomBar(
              currentIndex: selectedIndex,
              cartItemCount: cartItemCount,
              isScrolled: _isScrolled,
              onTap: (index) {
                HapticFeedback.lightImpact();
                context.go(MainScaffold.items[index].path);
              },
              items: MainScaffold.items,
            ),
    );
  }

  Widget _buildFloatingDeliveryButton(LokmaOrder order) {
    // Only onTheWay orders show the floating button
    final statusText = 'home.courier_on_the_way'.tr();
    final statusColor = const Color(0xFF4CAF50); // LOKMA material green
    final statusIcon = Icons.delivery_dining;

    final isOnTheWay = order.status == OrderStatus.onTheWay;

    return Positioned(
      right: 16,
      bottom: 110, // Above bottom nav bar
      child: GestureDetector(
        onTap: () {
          HapticFeedback.mediumImpact();
          _navigateToOrder(order);
        },
        child: AnimatedBuilder(
          animation: _hopAnimation,
          builder: (context, child) {
            return Transform.translate(
              offset: Offset(0, isOnTheWay ? _hopAnimation.value : 0),
              child: child,
            );
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: statusColor,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: statusColor.withOpacity(0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
                BoxShadow(
                  color: Colors.black.withOpacity(0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusIcon, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(
                  statusText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, color: Colors.white, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFloatingQRButton(KermesOrder order) {
    return Positioned(
      left: 16, // Placed on the left to avoid overlapping with delivery tracking on the right
      bottom: 110, // Above bottom nav bar
      child: GestureDetector(
        onTap: () {
          HapticFeedback.mediumImpact();
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
        child: AnimatedBuilder(
          animation: _hopAnimation,
          builder: (context, child) {
            return Transform.translate(
              // Pulsing/hopping effect to draw attention to unpaid condition
              offset: Offset(0, _hopAnimation.value),
              child: child,
            );
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFEA184A), // Lokma Crimson Red
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFEA184A).withOpacity(0.5),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
                BoxShadow(
                  color: Colors.black.withOpacity(0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.qr_code_2_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(
                  'tr' == 'tr' ? 'Nakit Ödeme Kodu (QR)' : 'Payment Code (QR)',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, color: Colors.white, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class GlassBottomBar extends StatelessWidget {
  final int currentIndex;
  final int cartItemCount;
  final bool isScrolled;
  final ValueChanged<int> onTap;
  final List<NavItemData> items;

  const GlassBottomBar({
    super.key,
    required this.currentIndex,
    required this.cartItemCount,
    this.isScrolled = false,
    required this.onTap,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Dynamic glassmorphism properties based on scroll
    // Increased blur and opacity to ensure icon visibility against complex/dark backgrounds
    final double blurSigma = isScrolled ? 30.0 : 20.0;
    final Color tintColor = isDark 
        ? Colors.black.withOpacity(isScrolled ? 0.20 : 0.15) 
        : Colors.white.withOpacity(isScrolled ? 0.30 : 0.20);

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 24),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          child: AppleGlassContainer(
            height: 70,
            borderRadius: 40,
            blurSigmaX: blurSigma,
            blurSigmaY: blurSigma,
            tintColor: tintColor,
            child: Stack(
            alignment: Alignment.center,
            children: [
              // Nav items — centered in Stack
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: List.generate(items.length, (index) {
                      final item = items[index];
                      final isActive = index == currentIndex;

                      return Expanded(
                        child: InkResponse(
                          onTap: () => onTap(index),
                          radius: 32,
                          child: SizedBox(
                            height: 60,
                            child: Center(
                              child: _buildItemContent(
                                  item, isActive, context, isDark),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            ),
          ),
      ),
    );
  }

  Widget _buildItemContent(
      NavItemData item, bool isActive, BuildContext context, bool isDark) {
    // Explicitly use the LOKMA brand color for active icons
    const Color activeColor = Color(0xFFEA184A); // Lokma Pink
    // Changed light mode inactive color to a balanced dark grey for better aesthetics while keeping high contrast
    final Color inactiveColor = isDark ? Colors.white : const Color(0xFF48484A);
    
    final color = isActive ? activeColor : inactiveColor;
    const iconSize = 24.0;

    Widget iconWidget;

    if (item.isCart) {
      iconWidget = Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          SvgPicture.asset(
            'assets/images/basket_1.svg',
            width: iconSize,
            height: iconSize,
            colorFilter: ColorFilter.mode(
              color,
              BlendMode.srcIn,
            ),
          ),
          if (cartItemCount > 0)
            Positioned(
              right: -8,
              top: -8,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: const Color(0xffFF2D55),
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: isDark ? Colors.black : Colors.white, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 4,
                    )
                  ],
                ),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                child: Center(
                  child: Text(
                    cartItemCount > 9 ? '9+' : cartItemCount.toString(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
    } else if (item.path == '/restoran') {
      iconWidget = Image.asset('assets/icons/yemek_icon.png',
          width: iconSize, height: iconSize, color: color);
    } else if (item.isKermes) {
      iconWidget = SvgPicture.asset(
        'assets/images/tent_1.svg',
        width: iconSize + 2,
        height: iconSize + 2,
        colorFilter: ColorFilter.mode(
          color,
          BlendMode.srcIn,
        ),
      );
    } else if (item.path == '/market') {
      iconWidget = Image.asset('assets/icons/market_icon.png',
          width: iconSize, height: iconSize, color: color);
    } else {
      iconWidget = Icon(item.icon, size: iconSize + 2, color: color);
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Ensure all icons occupy exactly the same vertical space for text alignment
        SizedBox(
          height: 28,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: iconWidget,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          item.label,
          maxLines: 1,
          softWrap: false,
          overflow: TextOverflow.visible,
          style: GoogleFonts.inter(
            color: color,
            fontSize: 10.5,
            fontWeight: isActive ? FontWeight.w800 : FontWeight.w700,
            letterSpacing: -0.3,
          ),
        ),
      ],
    );
  }
}

class NavItemData {
  final IconData? icon;
  final String label;
  final String path;
  final bool isKermes;
  final bool isCart;

  const NavItemData({
    required this.label,
    required this.path,
    this.icon,
    this.isKermes = false,
    this.isCart = false,
  });
}
