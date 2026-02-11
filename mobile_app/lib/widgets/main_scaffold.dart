import 'dart:ui';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/cart_provider.dart';
import '../providers/kermes_cart_provider.dart';
import '../services/order_service.dart';
import '../screens/orders/courier_tracking_screen.dart';

class MainScaffold extends ConsumerStatefulWidget {
  final Widget child;
  
  const MainScaffold({super.key, required this.child});

  static const List<_NavItemData> _items = [
    _NavItemData(icon: Icons.restaurant_menu, label: 'Yemek', path: '/restoran'),
    _NavItemData(icon: Icons.storefront_rounded, label: 'Market', path: '/market'),
    _NavItemData(icon: null, label: 'Kermes', path: '/kermesler', isKermes: true),
    _NavItemData(icon: Icons.shopping_bag_rounded, label: 'Sepetim', path: '/cart', isCart: true),
    _NavItemData(icon: Icons.person_rounded, label: 'Profilim', path: '/profile'),
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
          final orders = snapshot.docs
              .map((doc) => LokmaOrder.fromFirestore(doc))
              .toList();
          
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
            return (b.createdAt ?? DateTime(2000)).compareTo(a.createdAt ?? DateTime(2000));
          });
          
          return orders;
        })
        .handleError((e) {
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
    for (int i = 0; i < MainScaffold._items.length; i++) {
      if (currentPath == MainScaffold._items[i].path) return i;
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
    
    // Route'a göre koyu/açık sayfa tespiti (Status bar için)
    final currentPath = GoRouterState.of(context).uri.path;
    final isDarkPage = currentPath == '/restoran' || currentPath == '/market';

    // Status Bar ayarı
    SystemChrome.setSystemUIOverlayStyle(isDarkPage 
      ? SystemUiOverlayStyle.light 
      : SystemUiOverlayStyle.dark
    );

    return Scaffold(
      extendBody: true,
      body: Stack(
        children: [
          widget.child,
          // Floating active delivery button
          if (_activeOrdersStream != null)
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
        ],
      ),
      bottomNavigationBar: GlassBottomBar(
        currentIndex: selectedIndex,
        cartItemCount: cartItemCount,
        onTap: (index) {
          HapticFeedback.lightImpact();
          context.go(MainScaffold._items[index].path);
        },
        items: MainScaffold._items,
      ),
    );
  }

  Widget _buildFloatingDeliveryButton(LokmaOrder order) {
    // Only onTheWay orders show the floating button
    final statusText = 'Kurye Yolda';
    final statusColor = Colors.green;
    final statusIcon = Icons.motorcycle;

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
                  color: statusColor.withValues(alpha: 0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
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
  final ValueChanged<int> onTap;
  final List<_NavItemData> items;

  const GlassBottomBar({
    super.key,
    required this.currentIndex,
    required this.cartItemCount,
    required this.onTap,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // "Dynamic Frost" Premium Glass - Research Based Implementation
    // Light Mode: High opacity (0.8) "Ice" to prevent dirty/grey look on colorful backgrounds.
    // Dark Mode: Medium opacity (0.6) "Smoke" for depth.
    const blurSigma = 15.0; 
    
    // Gradient Colors
    final gradientColors = isDark 
        ? [Colors.black.withOpacity(0.60), Colors.black.withOpacity(0.40)] // Dark Smoke
        : [Colors.white.withOpacity(0.80), Colors.white.withOpacity(0.60)]; // Bright Ice

    // Border Colors
    final borderColor = isDark 
        ? Colors.white.withOpacity(0.15) 
        : Colors.white.withOpacity(0.60);

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 24), 
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(40), 
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
            child: Container(
              height: 72, 
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(40),
                border: Border.all(
                  color: borderColor,
                  width: 1.0, 
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(isDark ? 0.30 : 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                    spreadRadius: -2,
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(items.length, (index) {
                  final item = items[index];
                  final isActive = index == currentIndex;
                  
                  return _Item(
                    isActive: isActive,
                    onTap: () => onTap(index),
                    child: _buildItemContent(item, isActive, context, isDark),
                  );
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildItemContent(_NavItemData item, bool isActive, BuildContext context, bool isDark) {
    // Brand Rose (Kermes Kırmızısı) - 0xFFFB335B
    const activeColor = Color(0xFFFB335B); 
    final inactiveColor = (isDark ? Colors.white : Colors.black).withOpacity(0.6);
    final color = isActive ? activeColor : inactiveColor;
    const iconSize = 24.0; // İkon biraz küçüldü metin için yer açıldı

    Widget iconWidget;

    if (item.isCart) {
      iconWidget = Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Image.asset(
            'assets/icons/sepet_icon.png',
            width: iconSize,
            height: iconSize,
            color: color,
          ),
           if (cartItemCount > 0)
            Positioned(
              right: -8,
              top: -8,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: const Color(0xffFF2D55), // Apple Red Badge
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 4,
                    )
                  ],
                ),
                constraints: const BoxConstraints(
                  minWidth: 16,
                  minHeight: 16,
                ),
                child: Center(
                  child: Text(
                    cartItemCount > 9 ? '9+' : cartItemCount.toString(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9, // Badge font küçüldü
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
    } else if (item.path == '/restoran') {
      iconWidget = Image.asset(
        'assets/icons/yemek_icon.png',
        width: iconSize,
        height: iconSize,
        color: color,
      );
    } else if (item.isKermes) {
      iconWidget = Image.asset(
        'assets/icons/kermes_icon.png',
        width: iconSize,
        height: iconSize,
        color: color,
      );
    } else if (item.path == '/market') {
      iconWidget = Image.asset(
        'assets/icons/market_icon.png',
        width: iconSize,
        height: iconSize,
        color: color,
      );
    } else {
      iconWidget = Icon(
        item.icon,
        size: iconSize + 2, // Material ikonlar assetlere göre küçük kalabiliyor
        color: color,
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        iconWidget,
        const SizedBox(height: 4),
        Text(
          item.label,
          style: TextStyle(
            color: color,
            fontSize: 10, // Apple standart tab bar text size
            fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
            letterSpacing: -0.2, // Tight tracking
          ),
        ),
      ],
    );
  }
}

class _Item extends StatelessWidget {
  final Widget child;
  final bool isActive;
  final VoidCallback onTap;

  const _Item({
    required this.child,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      radius: 32,
      child: SizedBox(
        width: 60, // Genişlik biraz daraltıldı
        height: 60,
        child: Center(
          child: child,
        ),
      ),
    );
  }
}

class _NavItemData {
  final IconData? icon;
  final String label;
  final String path;
  final bool isKermes;
  final bool isCart;

  const _NavItemData({
    required this.label, 
    required this.path, 
    this.icon,
    this.isKermes = false,
    this.isCart = false,
  });
}
