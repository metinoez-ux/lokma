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
import 'package:lokma_app/data/kermes_menu_templates.dart';
import 'dart:math' as math;
import '../../utils/currency_utils.dart';

const Color lokmaPink = Color(0xFFEA184A);

Color _darkBg(bool isDark) => isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
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
    // i18n: categoryData varsa locale'e gore cozumle
    if (item.categoryData != null) {
      final locale = context.locale.languageCode;
      final resolved = resolveCategory(item.categoryData, locale: locale);
      if (resolved.isNotEmpty) return resolved;
    }
    if (item.category != null && item.category!.isNotEmpty) {
      return item.category!;
    }
    final name = item.name.toLowerCase();
    if (name.contains('cay') || name.contains('ayran') || name.contains('kahve') || 
        name.contains('su') || name.contains('kola') ||
        name.contains('fanta') || name.contains('sprite')) {
      return 'Icecekler';
    } else if (name.contains('baklava') || name.contains('kunefe') || name.contains('lokum') || 
               name.contains('dondurma') || name.contains('kadayif') ||
               name.contains('sutlac') || name.contains('lokma') ||
               name.contains('tulumba') || name.contains('revani')) {
      return 'Tatlilar';
    } else if (name.contains('corba') || name.contains('mercimek') || name.contains('ezogelin')) {
      return 'Corba';
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
            Text('marketplace.clear_cart_warning'.tr(args: [currentKermesName ?? '']), style: TextStyle(color: Theme.of(dialogContext).brightness == Brightness.dark ? Colors.white70 : Colors.black87, fontSize: 15)),
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

    // Force pill recalculation after every build to fix stale positioning
    // (e.g. after returning from checkout sheet or product detail modal)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition();
    });

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
                      TabItem(title: '(Masa)', icon: Icons.restaurant, subtitle: 'Kermeste ye'),
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
          
          // HERO IMAGE (kermes flyer/header)
          SliverToBoxAdapter(
            child: Builder(
              builder: (context) {
                final heroImage = widget.event.headerImage 
                    ?? (widget.event.flyers.isNotEmpty ? widget.event.flyers.first : null);
                if (heroImage == null) return const SizedBox.shrink();

                final isAsset = heroImage.startsWith('assets/');
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: SizedBox(
                      width: double.infinity,
                      height: 200,
                      child: isAsset
                          ? Image.asset(heroImage, fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const SizedBox.shrink())
                          : Image.network(heroImage, fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const SizedBox.shrink()),
                    ),
                  ),
                );
              },
            ),
          ),

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

          // 3. Category Tabs (Sticky Header) - Business Detail Screen pattern
          SliverPersistentHeader(
            pinned: true,
            delegate: _StickyTabDelegate(
              minHeight: 52,
              maxHeight: 52,
              child: Container(
                color: scaffoldBg,
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _chipScrollController,
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.only(left: 16, right: 4, top: 8, bottom: 8),
                        child: Stack(
                          alignment: Alignment.centerLeft,
                          children: [
                            // 1. Sliding pill indicator (behind text)
                            if (_pillInitialized)
                              AnimatedPositioned(
                                duration: const Duration(milliseconds: 400),
                                curve: Curves.easeOutBack,
                                left: _pillLeft,
                                top: 0,
                                bottom: 0,
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 400),
                                  curve: Curves.easeOutBack,
                                  width: _pillWidth,
                                  decoration: BoxDecoration(
                                    color: isDark ? Colors.white : const Color(0xFF3E3E3F),
                                    borderRadius: BorderRadius.circular(50),
                                    boxShadow: [
                                      BoxShadow(
                                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.12),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            // 2. Chip texts row (on top of pill)
                            Row(
                              key: _chipRowKey,
                              children: _categories.map((category) {
                                _tabKeys.putIfAbsent(category, () => GlobalKey());
                                final isSelected = category == _selectedCategory;

                                return Padding(
                                  padding: const EdgeInsets.only(right: 6),
                                  child: GestureDetector(
                                    onTap: () {
                                      HapticFeedback.selectionClick();
                                      _selectCategory(category);
                                    },
                                    child: Container(
                                      key: _tabKeys[category],
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
                                                : (isDark ? Colors.white70 : Colors.black54),
                                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                              fontSize: 14,
                                            ),
                                            child: Text(category),
                                          ),
                                          // Cart count badge per category (business_detail_screen pattern)
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
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final category = _categoriesWithoutAll[index];
                  if (!grouped.containsKey(category)) return const SizedBox.shrink();
                  final categoryItems = grouped[category]!;
                  if (categoryItems.isEmpty) return const SizedBox.shrink();
                  
                  return Container(
                    key: menuKeys[category],
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Category Header (business_detail_screen pattern)
                        Container(
                          width: double.infinity,
                          color: isDark ? const Color(0xFF2C2C2C).withValues(alpha: 0.6) : const Color(0xFFF2EEE9),
                          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  category,
                                  style: TextStyle(
                                    color: isDark ? lokmaPink : Colors.black87,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                              ),
                              Builder(builder: (context) {
                                final catCartCount = grouped[category]!.fold<int>(0, (sum, item) => sum + _getCartQuantity(item));
                                if (catCartCount <= 0) return const SizedBox.shrink();
                                return Container(
                                  width: 24,
                                  height: 24,
                                  decoration: BoxDecoration(
                                    color: isDark ? Colors.white : Colors.black87,
                                    shape: BoxShape.circle,
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    '$catCartCount',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: isDark ? Colors.black : Colors.white,
                                    ),
                                  ),
                                );
                              }),
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
                          const SizedBox(height: 120)
                        else
                          const SizedBox(height: 16),
                      ],
                    ),
                  );
                },
                childCount: _categoriesWithoutAll.length,
              ),
            ),
        ],
      ),
      bottomNavigationBar: _totalItems > 0 ? _buildCartBar() : null,
    );
  }

  Widget _buildCartBar() {
    final cartTotal = _totalPrice;
    final itemCount = _totalItems;
    
    if (itemCount == 0) {
      return const SizedBox.shrink();
    }
    
    final accent = lokmaPink;
    final currency = CurrencyUtils.getCurrencySymbol();
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    final cartButton = Material(
      color: accent,
      borderRadius: BorderRadius.circular(28),
      elevation: 4,
      shadowColor: accent.withValues(alpha: 0.4),
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: () {
          HapticFeedback.selectionClick();
          showKermesCheckoutSheet(context, widget.event);
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              // Cart icon with badge
              Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.shopping_basket, color: Colors.white, size: 24),
                  Positioned(
                    top: -6,
                    right: -8,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1A1A1A),
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$itemCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 14),
              // Center text
              Expanded(
                child: Text(
                  _deliveryModeIndex == 1 ? 'cart.send_order'.tr() : 'cart.view_cart'.tr(), // Masa vs Stand
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              // Price on right
              Text(
                '${cartTotal.toStringAsFixed(2).replaceAll('.', ',')} $currency',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    return Container(
      margin: EdgeInsets.fromLTRB(16, 0, 16, bottomPadding + 12),
      child: cartButton,
    );
  }

  Widget _buildMenuItem(KermesMenuItem item, int cartQuantity, {bool isDark = true}) {
    final hasImage = item.imageUrl != null && item.imageUrl!.isNotEmpty;
    final isAvailable = item.isAvailable;
    final isSoldOut = !isAvailable;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    final accent = lokmaPink;
    
    // The ADD button or count badge (business_detail_screen pattern)
    final bool inCart = cartQuantity > 0;
    
    // + button with image overlay (36px) or standalone (44px)
    Widget buildAddButton({required double size}) {
      return GestureDetector(
        onTap: isAvailable ? () {
          HapticFeedback.mediumImpact();
          _addToCart(item);
        } : null,
        child: inCart
          ? Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: isDark ? Colors.white : Colors.black87,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.15),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: Text(
                '$cartQuantity',
                style: TextStyle(
                  color: isDark ? Colors.black : Colors.white,
                  fontSize: size == 36 ? 14 : 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: size == 36 ? 0.1 : 0.05),
                    blurRadius: size == 36 ? 6 : 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Icon(
                Icons.add,
                color: accent,
                size: size == 36 ? 20 : 24,
              ),
            ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Opacity(
          opacity: isAvailable ? 1.0 : 0.55,
          child: InkWell(
            onTap: isAvailable
                ? () {
                    HapticFeedback.selectionClick();
                    showKermesProductDetailSheet(
                      context,
                      item: item,
                      cartQuantity: cartQuantity,
                      eventId: widget.event.id,
                      eventName: widget.event.city,
                      onAdd: () => _addToCart(item),
                      onRemove: () => _removeFromCart(item),
                    );
                  }
                : null,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 16),
              color: Colors.transparent,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Product Info (Left)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title
                        Text(
                          item.name,
                          style: TextStyle(
                            color: isAvailable ? textColor : subtleTextColor,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            height: 1.2,
                            letterSpacing: -0.2, // Small touch from kermes original
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (isSoldOut) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.orange.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'marketplace.sold_out'.tr(),
                              style: const TextStyle(
                                color: Colors.orange,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 6),
                        // Description
                        if (item.description != null && item.description!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8.0),
                            child: Text(
                              item.description!,
                              style: TextStyle(
                                color: subtleTextColor,
                                fontSize: 13,
                                fontWeight: FontWeight.w300,
                                height: 1.3,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        // Price
                        Text(
                          '${item.price.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(
                            color: isAvailable ? textColor : subtleTextColor,
                            fontSize: 16,
                            fontWeight: FontWeight.w300, 
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Image & Add Button (Right) - business_detail_screen pattern
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (hasImage)
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                width: 100,
                                height: 100,
                                color: isDark ? Colors.white10 : Colors.grey[100],
                                child: Image.network(
                                  item.imageUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Icon(
                                    _getIconForItem(item.name),
                                    size: 40,
                                    color: isDark ? Colors.white24 : Colors.grey[400],
                                  ),
                                ),
                              ),
                            ),
                            // + button overlay: bottom-right corner
                            if (isAvailable)
                              Positioned(
                                right: -4,
                                bottom: -4,
                                child: buildAddButton(size: 36),
                              ),
                          ],
                        )
                      else if (isAvailable)
                        buildAddButton(size: 44),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        // Separator Line (business_detail_screen pattern)
        Divider(
          height: 1,
          thickness: 0.5,
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.2),
        ),
      ],
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
