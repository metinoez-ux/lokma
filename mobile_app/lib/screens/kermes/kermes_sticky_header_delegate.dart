import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/services.dart';
import '../../providers/kermes_cart_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

class KermesStickyHeaderDelegate extends SliverPersistentHeaderDelegate {
  final double expandedHeight;
  final double collapsedHeight;
  final bool isDark;
  final Color scaffoldBg;
  final ScrollController chipScrollController;
  final List<String> categories;
  final String selectedCategory;
  final Function(String) onSelectCategory;
  final bool pillInitialized;
  final double pillLeft;
  final double pillWidth;
  final WidgetRef ref;

  KermesStickyHeaderDelegate({
    required this.expandedHeight,
    required this.collapsedHeight,
    required this.isDark,
    required this.scaffoldBg,
    required this.chipScrollController,
    required this.categories,
    required this.selectedCategory,
    required this.onSelectCategory,
    required this.pillInitialized,
    required this.pillLeft,
    required this.pillWidth,
    required this.ref,
  });

  @override
  double get minExtent => collapsedHeight;

  @override
  double get maxExtent => expandedHeight;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    
    // Calculate how much we have shrunk
    final double shrinkPercentage = shrinkOffset / (maxExtent - minExtent);
    
    // Search bar fades in only at the very end of the scroll (last 5% / 15px when pinning)
    final double searchBarOpacity = (shrinkPercentage - 0.95).clamp(0.0, 0.05) * 20.0;
    
    // Image fades out earlier
    final double imageOpacity = (1.0 - (shrinkPercentage * 1.5)).clamp(0.0, 1.0);

    return Container(
      color: scaffoldBg,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Background Image Layer
          if (imageOpacity > 0)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: maxExtent - 52 - shrinkOffset, // Full height minus chips and shrink amount
              child: Opacity(
                opacity: imageOpacity,
                child: Container(
                  decoration: const BoxDecoration(
                    image: DecorationImage(
                      image: CachedNetworkImageProvider(
                          'https://lh3.googleusercontent.com/aida-public/AB6AXuBJbRi7Loz4DMKqPn8OxdwybssRuCj0euEnxEc2C3sIHp6PFPWFIxOz6Cl1hciT95IosE2iL3AOdQZla7X1RwTK4ZloveV5PhHcDz2MIcFPkRk1fYTc6j15pKLPVi4nGg1p2FgfsHwmyUCs8CHb-DA_fXZbgYlwwXOLlYtl3y2Zsk3SbNm8_lHiurj651KmrmAse3uiJELB_Abh3LbqDqyDFQdnjAdhne_sjvjeNEnJDhq6P7tR33_Z97ZDVPbNUCIT78xhXY9zlnQM'),
                      fit: BoxFit.cover,
                    ),
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withOpacity(0.9),
                          Colors.black.withOpacity(0.4),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    padding: const EdgeInsets.only(left: 24, right: 24, bottom: 16),
                    child: Stack(
                      children: [
                        Positioned(
                          top: 24,
                          right: 0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD32F2F).withOpacity(0.9),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              children: const [
                                Icon(Icons.star, color: Colors.white, size: 12),
                                SizedBox(width: 4),
                                Text('Popüler',
                                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
                              ],
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          left: 0,
                          right: 0,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Row(
                                children: [
                                  Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(color: Color(0xFFD32F2F), shape: BoxShape.circle)),
                                  const SizedBox(width: 8),
                                  const Text('LEZZET ŞÖLENİ',
                                      style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 2)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              const Text('Menü ve\nSipariş',
                                  style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold, height: 1.1)),
                              const SizedBox(height: 8),
                              const Text('Kebaplar, tatlılar ve sokak\nlezzetlerini keşfet.',
                                  style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

          // 2. Search Bar Layer (Fades in)
          if (searchBarOpacity > 0)
            Positioned(
              bottom: 52, // Just above the chips
              left: 0,
              right: 0,
              height: 60,
              child: Opacity(
                opacity: searchBarOpacity,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                  child: Row(
                    children: [
                      // Back Button
                      GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          if (context.canPop()) {
                            context.pop();
                          } else {
                            context.go('/kermes');
                          }
                        },
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1C1C1E) : Colors.grey[200],
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Icon(Icons.arrow_back_ios_new, size: 18, color: textPrimary),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Search Bar
                      Expanded(
                        child: Container(
                          height: 44,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1C1C1E) : Colors.grey[200],
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.search, size: 20, color: textSecondary),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  style: TextStyle(color: textPrimary, fontSize: 14),
                                  decoration: InputDecoration(
                                    hintText: 'Im Menü suchen...',
                                    hintStyle: TextStyle(color: textSecondary, fontSize: 14),
                                    border: InputBorder.none,
                                    isDense: true,
                                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                                  ),
                                ),
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

          // 3. Category Chips Layer (Always visible, pinned at bottom)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 52,
            child: Container(
              color: searchBarOpacity > 0 ? scaffoldBg : Colors.transparent, // Solid background when pinned, transparent over image
              child: Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      controller: chipScrollController,
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.only(left: 16, right: 4, top: 4, bottom: 8),
                      child: Stack(
                        alignment: Alignment.centerLeft,
                        children: [
                          if (pillInitialized)
                            AnimatedPositioned(
                              duration: const Duration(milliseconds: 400),
                              curve: Curves.easeOutBack,
                              left: pillLeft,
                              top: 0,
                              bottom: 0,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 400),
                                curve: Curves.easeOutBack,
                                width: pillWidth,
                                decoration: BoxDecoration(
                                  color: isDark ? Colors.white : const Color(0xFF3E3E3F),
                                  borderRadius: BorderRadius.circular(50),
                                  boxShadow: [
                                    BoxShadow(
                                      color: (isDark ? Colors.white : Colors.black).withOpacity(0.12),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          Row(
                            children: categories.map((category) {
                              final isSelected = category == selectedCategory;
                              return Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: GestureDetector(
                                  onTap: () {
                                    HapticFeedback.selectionClick();
                                    onSelectCategory(category);
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                                    decoration: BoxDecoration(
                                      color: Colors.transparent,
                                      borderRadius: BorderRadius.circular(50),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        AnimatedDefaultTextStyle(
                                          duration: const Duration(milliseconds: 300),
                                          curve: Curves.easeOutCubic,
                                          style: TextStyle(
                                            color: isSelected
                                                ? (isDark ? Colors.black : Colors.white)
                                                : (searchBarOpacity > 0 ? (isDark ? Colors.white70 : Colors.black54) : Colors.white), // White when over image
                                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                            fontSize: 14,
                                          ),
                                          child: Text(category),
                                        ),
                                        Builder(builder: (context) {
                                          final kermesCart = ref.watch(kermesCartProvider);
                                          final catCartCount = category == 'Alle'
                                              ? kermesCart.totalItems
                                              : kermesCart.items
                                                  .where((ci) => ci.menuItem.category == category)
                                                  .fold<int>(0, (sum, ci) => sum + ci.quantity);
                                          if (catCartCount <= 0) return const SizedBox.shrink();
                                          return Padding(
                                            padding: const EdgeInsets.only(left: 6),
                                            child: AnimatedContainer(
                                              duration: const Duration(milliseconds: 300),
                                              curve: Curves.easeOutBack,
                                              width: 20,
                                              height: 20,
                                              decoration: BoxDecoration(
                                                color: isSelected
                                                    ? (isDark ? Colors.black87 : Colors.white)
                                                    : Colors.red,
                                                shape: BoxShape.circle,
                                              ),
                                              alignment: Alignment.center,
                                              child: Text(
                                                '$catCartCount',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: isSelected
                                                      ? (isDark ? Colors.white : Colors.black87)
                                                      : Colors.white,
                                                ),
                                              ),
                                            ),
                                          );
                                        }),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Divider(
                    height: 1, 
                    thickness: 0.5, 
                    color: isDark ? Colors.grey[800] : Colors.grey[300],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(covariant KermesStickyHeaderDelegate oldDelegate) {
    return oldDelegate.isDark != isDark ||
        oldDelegate.selectedCategory != selectedCategory ||
        oldDelegate.pillLeft != pillLeft ||
        oldDelegate.pillWidth != pillWidth ||
        oldDelegate.categories.length != categories.length;
  }
}
