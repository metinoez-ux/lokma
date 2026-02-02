import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/cart_provider.dart';
import '../providers/kermes_cart_provider.dart';

class MainScaffold extends ConsumerWidget {
  final Widget child;
  
  const MainScaffold({super.key, required this.child});

  static const List<_NavItemData> _items = [
    _NavItemData(icon: Icons.restaurant_menu, label: 'Yemek', path: '/restoran'),
    _NavItemData(icon: Icons.storefront_rounded, label: 'Market', path: '/market'),
    _NavItemData(icon: null, label: 'Kermes', path: '/kermesler', isKermes: true),
    _NavItemData(icon: Icons.shopping_bag_rounded, label: 'Sepetim', path: '/cart', isCart: true),
    _NavItemData(icon: Icons.person_rounded, label: 'Profilim', path: '/profile'),
  ];
  
  int _getSelectedIndex(BuildContext context) {
    final currentPath = GoRouterState.of(context).uri.path;
    for (int i = 0; i < _items.length; i++) {
      if (currentPath == _items[i].path) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
      extendBody: true, // Blur efektinin arkasında içerik görünmesi için kritik
      body: child,
      bottomNavigationBar: GlassBottomBar(
        currentIndex: selectedIndex,
        cartItemCount: cartItemCount,
        onTap: (index) {
          HapticFeedback.lightImpact();
          context.go(_items[index].path);
        },
        items: _items,
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
    // Brand Rose (Kermes Kırmızısı) - 0xFFF43F5E
    const activeColor = Color(0xFFF43F5E); 
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
