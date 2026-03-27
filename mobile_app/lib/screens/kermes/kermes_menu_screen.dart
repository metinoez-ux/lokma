import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/screens/kermes/kermes_checkout_sheet.dart';
import 'package:lokma_app/screens/kermes/kermes_product_detail_sheet.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'dart:math' as math;
import '../../utils/currency_utils.dart';

const Color lokmaPink = Color(0xFFEA184A);

Color _darkBg(bool isDark) => isDark ? const Color(0xFF121212) : const Color(0xFFE8E8EC);
Color _cardBg(bool isDark) => isDark ? const Color(0xFF1E1E1E) : Colors.white;

class KermesMenuScreen extends ConsumerStatefulWidget {
  final KermesEvent event;
  final int initialDeliveryMode;

  const KermesMenuScreen({super.key, required this.event, this.initialDeliveryMode = 0});

  @override
  ConsumerState<KermesMenuScreen> createState() => _KermesMenuScreenState();
}

class _KermesMenuScreenState extends ConsumerState<KermesMenuScreen> {
  String _selectedCategory = 'marketplace.category_all'.tr();
  
  // Scroll spy controller and keys
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _sectionKeys = {};
  final Map<String, GlobalKey> _tabKeys = {};
  bool _isUserScrolling = true;
  
  // Chip ScrollController
  final ScrollController _chipScrollController = ScrollController();
  
  // Sliding pill indicator state
  double _pillLeft = 0;
  double _pillWidth = 60;
  bool _pillInitialized = false;
  final GlobalKey _chipRowKey = GlobalKey();

  // Delivery mode toggle
  late int _deliveryModeIndex;

  // Search
  bool _showSearchBar = false;
  String _menuSearchQuery = '';

  @override
  void initState() {
    super.initState();
    _deliveryModeIndex = widget.initialDeliveryMode;
    
    _scrollController.addListener(() {
      final shouldShow = _scrollController.offset > 150;
      if (shouldShow != _showSearchBar) {
        setState(() => _showSearchBar = shouldShow);
      }
      _onMenuScroll();
    });

    for (final category in _categoriesWithoutAll) {
      _sectionKeys[category] = GlobalKey();
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _chipScrollController.dispose();
    super.dispose();
  }

  void _onMenuScroll() {
    if (!_isUserScrolling || _menuSearchQuery.isNotEmpty) return;

    if (_scrollController.hasClients && _scrollController.offset < 10) {
      if (_selectedCategory != 'marketplace.category_all'.tr()) {
        HapticFeedback.selectionClick();
        setState(() => _selectedCategory = 'marketplace.category_all'.tr());
        Future.delayed(const Duration(milliseconds: 50), () {
          if (mounted) {
            _scrollChipBarToSelected('marketplace.category_all'.tr());
            _updatePillPosition('marketplace.category_all'.tr());
          }
        });
      }
      return;
    }

    String? visibleCategory;
    for (var entry in _sectionKeys.entries) {
      final key = entry.value;
      if (key.currentContext != null) {
        final RenderBox? box = key.currentContext!.findRenderObject() as RenderBox?;
        if (box != null) {
          final position = box.localToGlobal(Offset.zero, ancestor: context.findRenderObject());
          if (position.dy > 150 && position.dy < 400) {
             visibleCategory = entry.key;
             break;
          }
        }
      }
    }

    if (visibleCategory != null && visibleCategory != _selectedCategory) {
      HapticFeedback.selectionClick();
      setState(() {
        _selectedCategory = visibleCategory!;
      });
      Future.delayed(const Duration(milliseconds: 50), () {
        if (mounted) {
          _scrollChipBarToSelected(visibleCategory!);
          _updatePillPosition(visibleCategory!);
        }
      });
    }
  }

  void _scrollChipBarToSelected(String category) {
    if (!_chipScrollController.hasClients) return;
    final tabKey = _tabKeys[category];
    if (tabKey == null || tabKey.currentContext == null) return;
    
    final RenderBox? chipBox = tabKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null) return;
    
    final chipPosition = chipBox.localToGlobal(Offset.zero);
    final chipWidth = chipBox.size.width;
    final viewportWidth = _chipScrollController.position.viewportDimension;
    
    final chipCenter = chipPosition.dx + chipWidth / 2;
    final viewportCenter = viewportWidth / 2;
    final scrollDelta = chipCenter - viewportCenter;
    
    final targetOffset = (_chipScrollController.offset + scrollDelta).clamp(
      0.0,
      _chipScrollController.position.maxScrollExtent,
    );
    
    _chipScrollController.animateTo(
      targetOffset,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
    );
  }

  void _updatePillPosition([String? cat]) {
    final category = cat ?? _selectedCategory;
    final tabKey = _tabKeys[category];
    if (tabKey?.currentContext == null || _chipRowKey.currentContext == null) return;
    
    final RenderBox? chipBox = tabKey?.currentContext?.findRenderObject() as RenderBox?;
    final RenderBox? rowBox = _chipRowKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null || rowBox == null) return;
    
    final chipPos = chipBox.localToGlobal(Offset.zero, ancestor: rowBox);
    
    if (mounted) {
      setState(() {
        _pillLeft = chipPos.dx;
        _pillWidth = chipBox.size.width;
        _pillInitialized = true;
      });
    }
  }

  void _selectCategory(String category) {
    if (_selectedCategory == category) return;
    setState(() => _selectedCategory = category);
    _isUserScrolling = false;
    
    _scrollChipBarToSelected(category);
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition(category);
    });
    
    if (category == 'marketplace.category_all'.tr()) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      }
    } else {
      final key = _sectionKeys[category];
      if (key != null && key.currentContext != null && _scrollController.hasClients) {
        final RenderBox? targetBox = key.currentContext!.findRenderObject() as RenderBox?;
        final RenderBox? scrollableBox = context.findRenderObject() as RenderBox?;
        
        if (targetBox != null && scrollableBox != null) {
          final targetPosition = targetBox.localToGlobal(Offset.zero, ancestor: scrollableBox);
          final scrollTarget = _scrollController.offset + targetPosition.dy - 190;
          _scrollController.animateTo(
            scrollTarget.clamp(0.0, _scrollController.position.maxScrollExtent),
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      }
    }
    
    Future.delayed(const Duration(milliseconds: 350), () {
      if (mounted) _isUserScrolling = true;
    });
  }

  List<String> get _categoriesWithoutAll {
    final uniqueCategories = <String>{};
    for (final item in widget.event.menu) {
      final category = _getCategoryForItem(item);
      if (category.isNotEmpty) {
        uniqueCategories.add(category);
      }
    }
    final sortOrder = ['Ana Yemek', 'Çorba', 'Tatlı', 'İçecek', 'Aperatif', 'Grill', 'Diğer'];
    final sorted = uniqueCategories.toList();
    sorted.sort((a, b) {
      final indexA = sortOrder.indexOf(a);
      final indexB = sortOrder.indexOf(b);
      final orderA = indexA == -1 ? 999 : indexA;
      final orderB = indexB == -1 ? 999 : indexB;
      return orderA.compareTo(orderB);
    });
    return sorted;
  }

  List<String> get _categories {
    return ['marketplace.category_all'.tr(), ..._categoriesWithoutAll];
  }

  String _getCategoryForItem(KermesMenuItem item) {
    if (item.category != null && item.category!.isNotEmpty) {
      return item.category!;
    }
    final name = item.name.toLowerCase();
    if (name.contains('çay') || name.contains('ayran') || name.contains('kahve') || 
        name.contains('şıra') || name.contains('limon') || name.contains('salep') ||
        name.contains('şalgam') || name.contains('su') || name.contains('kola') ||
        name.contains('fanta') || name.contains('sprite')) {
      return 'İçecek';
    } else if (name.contains('baklava') || name.contains('künefe') || name.contains('lokum') || 
               name.contains('dondurma') || name.contains('kadayıf') || name.contains('höşmerim') ||
               name.contains('sütlaç') || name.contains('kazandibi') || name.contains('lokma') ||
               name.contains('tulumba') || name.contains('revani')) {
      return 'Tatlı';
    } else if (name.contains('çorba') || name.contains('mercimek') || name.contains('ezogelin')) {
      return 'Çorba';
    } else {
      return 'Ana Yemek';
    }
  }

  Map<String, List<KermesMenuItem>> get _groupedMenu {
    final grouped = <String, List<KermesMenuItem>>{};
    for (final category in _categoriesWithoutAll) {
      grouped[category] = [];
    }
    for (final item in widget.event.menu) {
      final category = _getCategoryForItem(item);
      grouped[category]?.add(item);
    }
    grouped.removeWhere((key, value) => value.isEmpty);
    return grouped;
  }

  int get _totalItems => ref.read(kermesCartProvider).totalItems;
  double get _totalPrice => ref.read(kermesCartProvider).totalAmount;

  void _addToCart(KermesMenuItem item) {
    HapticFeedback.lightImpact();
    final cartNotifier = ref.read(kermesCartProvider.notifier);
    final added = cartNotifier.addToCart(item, widget.event.id, widget.event.city);
    if (!added) _showDifferentKermesWarning(item);
  }

  void _showDifferentKermesWarning(KermesMenuItem item) {
    final currentKermesName = ref.read(kermesCartProvider.notifier).currentKermesName;
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Theme.of(dialogContext).brightness == Brightness.dark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 28),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Farklı Kermes Siparişi',
                style: TextStyle(
                  color: Theme.of(dialogContext).brightness == Brightness.dark ? Colors.white : Colors.black87,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('marketplace.clear_cart_warning'.tr(args: [currentKermesName]), style: TextStyle(color: Theme.of(dialogContext).brightness == Brightness.dark ? Colors.white70 : Colors.black87, fontSize: 15)),
            const SizedBox(height: 12),
            Text('${widget.event.city} kermesinden ürün eklemek için mevcut sepetiniz temizlenecek.', style: TextStyle(color: Theme.of(dialogContext).brightness == Brightness.dark ? Colors.white54 : Colors.black54, fontSize: 14)),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text('common.cancel'.tr(), style: const TextStyle(color: Colors.grey, fontSize: 15))),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              ref.read(kermesCartProvider.notifier).clearAndAddFromNewKermes(item, widget.event.id, widget.event.city);
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('marketplace.cart_updated_for_city'.tr(args: [widget.event.city])), backgroundColor: Theme.of(context).colorScheme.primary, behavior: SnackBarBehavior.floating));
            },
            style: ElevatedButton.styleFrom(backgroundColor: lokmaPink, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            child: Text(tr('cart.change_cart')),
          ),
        ],
      ),
    );
  }

  void _removeFromCart(KermesMenuItem item) {
    HapticFeedback.lightImpact();
    ref.read(kermesCartProvider.notifier).removeFromCart(item.name);
  }

  int _getCartQuantity(KermesMenuItem item) {
    return ref.read(kermesCartProvider.notifier).getQuantity(item.name);
  }

  void _showMenuSearchOverlay() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = _darkBg(isDark);
    final cardColor = _cardBg(isDark);
    final textColor = isDark ? Colors.white : Colors.black87;
    final hintColor = isDark ? Colors.grey[500] : Colors.grey[400];
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final query = _menuSearchQuery.toLowerCase();
            final searchResults = widget.event.menu.where((p) => 
              p.name.toLowerCase().contains(query) || (p.description?.toLowerCase().contains(query) ?? false)
            ).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.9,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 40, height: 4,
                    decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: cardColor,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.transparent, width: 2),
                            ),
                            child: TextField(
                              autofocus: true,
                              cursorColor: lokmaPink,
                              style: TextStyle(color: textColor, fontSize: 16),
                              decoration: InputDecoration(
                                hintText: 'marketplace.search_in_menu'.tr(),
                                hintStyle: TextStyle(color: hintColor, fontSize: 15),
                                prefixIcon: Icon(Icons.search, color: hintColor, size: 22),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(vertical: 14),
                                suffixIcon: _menuSearchQuery.isNotEmpty ? IconButton(
                                  icon: Icon(Icons.close, color: textColor, size: 20),
                                  onPressed: () {
                                    setModalState(() => _menuSearchQuery = '');
                                    setState(() => _menuSearchQuery = '');
                                  },
                                ) : null,
                              ),
                              onChanged: (val) {
                                setModalState(() => _menuSearchQuery = val);
                                setState(() => _menuSearchQuery = val);
                              },
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        TextButton(
                          onPressed: () {
                            if (_menuSearchQuery.isEmpty) {
                              setState(() => _menuSearchQuery = '');
                            }
                            Navigator.pop(context);
                          },
                          child: Text('common.cancel'.tr(), style: TextStyle(color: lokmaPink, fontSize: 15, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, thickness: 1),
                  Expanded(
                    child: _menuSearchQuery.isEmpty
                        ? Center(child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.search, size: 60, color: hintColor?.withValues(alpha: 0.5)),
                              const SizedBox(height: 16),
                              Text('marketplace.search_for_products'.tr(), style: TextStyle(color: hintColor, fontSize: 16)),
                            ],
                          ))
                        : searchResults.isEmpty
                            ? Center(child: Text('marketplace.no_results'.tr(), style: TextStyle(color: hintColor, fontSize: 16)))
                            : ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: searchResults.length,
                                itemBuilder: (context, index) {
                                  final item = searchResults[index];
                                  final cartQuantity = _getCartQuantity(item);
                                  return _buildMenuItem(item, cartQuantity, isDark: isDark);
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

  @override
  Widget build(BuildContext context) {
    // Watch cart state for updates
    ref.watch(kermesCartProvider);

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = _darkBg(isDark);
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    
    // Grouped items
    final grouped = _groupedMenu;
    final menuKeys = _sectionKeys;

    return Scaffold(
      backgroundColor: scaffoldBg,
      body: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // 1. SliverAppBar
          SliverAppBar(
            floating: false,
            pinned: true,
            backgroundColor: scaffoldBg,
            surfaceTintColor: scaffoldBg,
            elevation: 0,
            toolbarHeight: 56,
            leading: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Material(
                color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                shape: const CircleBorder(),
                elevation: 2,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () {
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/kermes');
                    }
                  },
                  child: SizedBox(
                    width: 40, height: 40,
                    child: Icon(Icons.arrow_back_ios_new, color: textPrimary, size: 18),
                  ),
                ),
              ),
            ),
            title: (_showSearchBar)
                ? GestureDetector(
                    onTap: () => _showMenuSearchOverlay(),
                    child: Container(
                      height: 44,
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF5F0E8),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Row(
                        children: [
                          const SizedBox(width: 12),
                          Icon(Icons.search, color: isDark ? Colors.grey[400] : Colors.grey[600], size: 22),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _menuSearchQuery.isNotEmpty ? _menuSearchQuery : 'marketplace.search_in_menu'.tr(),
                              style: TextStyle(
                                fontSize: 13, 
                                color: _menuSearchQuery.isNotEmpty ? textPrimary : Colors.grey[500],
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                      ),
                    ),
                  )
                : ThreeDimensionalPillTabBar(
                    margin: EdgeInsets.zero,
                    activeColor: lokmaPink,
                    selectedIndex: _deliveryModeIndex,
                    tabs: [
                      TabItem(title: 'Kurye', icon: Icons.delivery_dining, subtitle: 'Standart'),
                      TabItem(title: 'Gel Al', icon: Icons.shopping_bag_outlined, subtitle: 'Sıra bekleme'),
                      TabItem(title: 'Yerinde', icon: Icons.restaurant, subtitle: 'Kermeste ye'),
                    ],
                    onTabSelected: (index) {
                      setState(() => _deliveryModeIndex = index);
                    },
                  ),
            titleSpacing: 0,
            centerTitle: true,
            actions: [
              if (!_showSearchBar)
                Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: GestureDetector(
                    onTap: () => _showMenuSearchOverlay(),
                    child: SizedBox(
                      width: 40, height: 40,
                      child: Icon(Icons.search, color: isDark ? Colors.grey[400] : Colors.grey[600], size: 22),
                    ),
                  ),
                )
              else
                const SizedBox(width: 48),
            ],
          ),
          
          const SliverToBoxAdapter(child: SizedBox(height: 8)),

          // 2. Info Section (Extremely clean & simple)
          SliverToBoxAdapter(
             child: Container(
               padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
               child: Column(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 children: [
                   Text(
                     widget.event.title,
                     style: TextStyle(
                       color: Theme.of(context).colorScheme.onSurface,
                       fontSize: 24,
                       fontWeight: FontWeight.w600,
                       letterSpacing: -0.5,
                     ),
                     maxLines: 2,
                     overflow: TextOverflow.ellipsis,
                   ),
                   const SizedBox(height: 8),
                   Wrap(
                     spacing: 12,
                     runSpacing: 8,
                     crossAxisAlignment: WrapCrossAlignment.center,
                     children: [
                       Row(
                         mainAxisSize: MainAxisSize.min,
                         children: [
                           const Icon(Icons.location_on, color: lokmaPink, size: 16),
                           const SizedBox(width: 4),
                           Text(
                             widget.event.city,
                             style: TextStyle(
                               color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                               fontSize: 13,
                               fontWeight: FontWeight.w500,
                             ),
                           ),
                         ],
                       ),
                       Text('·', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                       Text(
                         'Kermes Menüsü',
                         style: TextStyle(
                           color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                           fontSize: 13,
                         ),
                       ),
                     ],
                   ),
                 ],
               ),
             ),
          ),
          
          const SliverToBoxAdapter(child: SizedBox(height: 16)),

          // 3. Category Tabs (Sticky Header)
          SliverPersistentHeader(
            pinned: true,
            delegate: _StickyTabDelegate(
              minHeight: 60,
              maxHeight: 60,
              child: Container(
                color: scaffoldBg,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      height: 59,
                      padding: const EdgeInsets.only(top: 8, bottom: 8),
                      child: Stack(
                        children: [
                          if (_pillInitialized)
                            AnimatedPositioned(
                              duration: const Duration(milliseconds: 250),
                              curve: Curves.easeOutCubic,
                              left: _pillLeft,
                              top: 6,
                              bottom: 6,
                              width: _pillWidth,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Theme.of(context).brightness == Brightness.dark 
                                      ? lokmaPink.withValues(alpha: 0.25)
                                      : lokmaPink.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                              ),
                            ),
                          SingleChildScrollView(
                            physics: const ClampingScrollPhysics(),
                            key: _chipRowKey,
                            controller: _chipScrollController,
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Row(
                              children: _categories.map((category) {
                                // Provide keys per tab iteratively, or fetch if missing
                                _tabKeys.putIfAbsent(category, () => GlobalKey());
                                final isSelected = category == _selectedCategory;
                                
                                return GestureDetector(
                                  key: _tabKeys[category],
                                  onTap: () {
                                    HapticFeedback.selectionClick();
                                    _selectCategory(category);
                                  },
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: Colors.transparent,
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                    child: Center(
                                      child: Text(
                                        category,
                                        style: TextStyle(
                                          color: isSelected ? lokmaPink : textSecondary,
                                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, thickness: 1),
                  ],
                ),
              ),
            ),
          ),

          // 4. Products List
          if (_groupedMenu.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.restaurant_menu, size: 64, color: isDark ? Colors.grey[700] : Colors.grey[400]),
                    const SizedBox(height: 16),
                    Text(
                      'Menüde ürün bulunmuyor',
                      style: TextStyle(color: textSecondary, fontSize: 16),
                    ),
                  ],
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final category = _categoriesWithoutAll[index];
                    if (!grouped.containsKey(category)) return const SizedBox.shrink();
                    final categoryItems = grouped[category]!;
                    if (categoryItems.isEmpty) return const SizedBox.shrink();
                    
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      key: menuKeys[category],
                      children: [
                        // Category Header
                        Padding(
                          padding: const EdgeInsets.only(top: 24, bottom: 16),
                          child: Row(
                            children: [
                              Container(
                                width: 4,
                                height: 24,
                                decoration: BoxDecoration(
                                  color: lokmaPink,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                category.toUpperCase(),
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: lokmaPink.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '${categoryItems.length}',
                                  style: const TextStyle(
                                    color: lokmaPink,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Items
                        ...categoryItems.map((item) {
                          final cartQuantity = _getCartQuantity(item);
                          return _buildMenuItem(item, cartQuantity, isDark: isDark);
                        }),
                        // Extra bottom padding for last item
                        if (index == _categoriesWithoutAll.length - 1)
                          const SizedBox(height: 120),
                      ],
                    );
                  },
                  childCount: _categoriesWithoutAll.length,
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: _totalItems > 0 ? _buildCartBar() : null,
    );
  }

  Widget _buildCartBar() {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E1E1E) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$_totalItems Ürün',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      '${_totalPrice.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  HapticFeedback.mediumImpact();
                  showKermesCheckoutSheet(context, widget.event);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: lokmaPink,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('marketplace.go_to_cart'.tr(), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward_ios, size: 14),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMenuItem(KermesMenuItem item, int cartQuantity, {bool isDark = true}) {
    final hasImage = item.imageUrl != null && item.imageUrl!.isNotEmpty;
    final isSoldOut = !item.isAvailable;  
    final cardColor = _cardBg(isDark);
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    
    return GestureDetector(
      onTap: isSoldOut
          ? null 
          : () {
              HapticFeedback.selectionClick();
              showKermesProductDetailSheet(
                context,
                item: item,
                cartQuantity: cartQuantity,
                onAdd: () => _addToCart(item),
                onRemove: () => _removeFromCart(item),
              );
            },
      child: Opacity(
        opacity: isSoldOut ? 0.5 : 1.0,
        child: Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: isSoldOut ? cardColor.withValues(alpha: 0.6) : cardColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? Colors.white12 : Colors.black.withValues(alpha: 0.05),
              width: 1,
            ),
            boxShadow: cartQuantity > 0 && !isSoldOut
                ? [
                    BoxShadow(
                      color: lokmaPink.withValues(alpha: 0.15),
                      blurRadius: 12,
                      spreadRadius: 2,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              children: [
                if (cartQuantity > 0 && !isSoldOut)
                  Positioned(
                    left: 0, top: 0, bottom: 0,
                    width: 4,
                    child: Container(color: lokmaPink),
                  ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Hero(
                        tag: 'product_image_${item.name}',
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            gradient: !hasImage
                                ? LinearGradient(
                                    colors: [lokmaPink.withValues(alpha: 0.1), lokmaPink.withValues(alpha: 0.05)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  )
                                : null,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05),
                            ),
                          ),
                          child: hasImage
                              ? ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(
                                    item.imageUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Center(
                                      child: Icon(
                                        _getIconForItem(item.name),
                                        color: lokmaPink.withValues(alpha: 0.5),
                                        size: 32,
                                      ),
                                    ),
                                  ),
                                )
                              : Center(
                                  child: Icon(
                                    _getIconForItem(item.name),
                                    color: lokmaPink.withValues(alpha: 0.5),
                                    size: 32,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    item.name,
                                    style: TextStyle(
                                      color: textColor,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                      letterSpacing: -0.2,
                                    ),
                                  ),
                                ),
                                if (item.hasDetailInfo || hasImage)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 4, top: 2),
                                    child: Icon(
                                      Icons.info_outline,
                                      color: isDark ? Colors.grey[600] : Colors.grey[400],
                                      size: 16,
                                    ),
                                  ),
                              ],
                            ),
                            if (item.description != null && item.description!.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                item.description!,
                                style: TextStyle(
                                  color: subtleTextColor,
                                  fontSize: 13,
                                  height: 1.3,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      '${item.price.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                                      style: TextStyle(
                                        color: isDark ? Colors.green[400] : Colors.green[700],
                                        fontSize: 16,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    if (item.allergens.isNotEmpty) ...[
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.amber.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(Icons.warning_amber, size: 12, color: Colors.amber[700]),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${item.allergens.length}',
                                              style: TextStyle(color: Colors.amber[800], fontSize: 11, fontWeight: FontWeight.bold),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                
                                // Quantity Controls
                                if (isSoldOut)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.red.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text('marketplace.sold_out'.tr(), style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12, fontWeight: FontWeight.w700)),
                                  )
                                else if (cartQuantity == 0)
                                  GestureDetector(
                                    onTap: () => _addToCart(item),
                                    child: Container(
                                      width: 36,
                                      height: 36,
                                      decoration: BoxDecoration(
                                        color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[100],
                                        borderRadius: BorderRadius.circular(18),
                                      ),
                                      child: Icon(Icons.add, color: lokmaPink, size: 20),
                                    ),
                                  )
                                else
                                  Container(
                                    decoration: BoxDecoration(
                                      color: lokmaPink,
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: [
                                        BoxShadow(
                                          color: lokmaPink.withValues(alpha: 0.3),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        GestureDetector(
                                          onTap: () => _removeFromCart(item),
                                          child: Container(
                                            width: 36,
                                            height: 36,
                                            color: Colors.transparent,
                                            child: Icon(Icons.remove, color: Colors.white, size: 18),
                                          ),
                                        ),
                                        Container(
                                          constraints: const BoxConstraints(minWidth: 24),
                                          alignment: Alignment.center,
                                          child: Text(
                                            cartQuantity.toString(),
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 15,
                                            ),
                                          ),
                                        ),
                                        GestureDetector(
                                          onTap: () => _addToCart(item),
                                          child: Container(
                                            width: 36,
                                            height: 36,
                                            color: Colors.transparent,
                                            child: Icon(Icons.add, color: Colors.white, size: 18),
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
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getIconForItem(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('kebap') || lower.contains('adana') || lower.contains('döner')) {
      return Icons.kebab_dining;
    } else if (lower.contains('çorba')) {
      return Icons.soup_kitchen;
    } else if (lower.contains('pide') || lower.contains('lahmacun') || lower.contains('gözleme')) {
      return Icons.local_pizza;
    } else if (lower.contains('baklava') || lower.contains('künefe') || lower.contains('lokum') || lower.contains('kadayıf')) {
      return Icons.cake;
    } else if (lower.contains('çay') || lower.contains('kahve') || lower.contains('salep')) {
      return Icons.coffee;
    } else if (lower.contains('ayran') || lower.contains('limon') || lower.contains('şıra')) {
      return Icons.local_drink;
    } else if (lower.contains('dondurma')) {
      return Icons.icecream;
    } else {
      return Icons.restaurant;
    }
  }
}

// Sticky Header Delegate
class _StickyTabDelegate extends SliverPersistentHeaderDelegate {
  final double minHeight;
  final double maxHeight;
  final Widget child;

  _StickyTabDelegate({
    required this.minHeight,
    required this.maxHeight,
    required this.child,
  });

  @override
  double get minExtent => minHeight;

  @override
  double get maxExtent => math.max(maxHeight, minHeight);

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return SizedBox.expand(child: child);
  }

  @override
  bool shouldRebuild(_StickyTabDelegate oldDelegate) {
    return maxHeight != oldDelegate.maxHeight ||
        minHeight != oldDelegate.minHeight ||
        child != oldDelegate.child;
  }
}
