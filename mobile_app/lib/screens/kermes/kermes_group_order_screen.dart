import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../models/kermes_group_order_model.dart';
import '../../models/kermes_model.dart';
import '../../providers/group_order_provider.dart';
import '../../widgets/kermes/group_order_share_sheet.dart';
import '../../widgets/kermes/kermes_category_chips.dart';
import '../../widgets/kermes/kermes_menu_item_tile.dart';
import '../../widgets/kermes/payment_method_dialog.dart';
import '../../widgets/kermes/delivery_type_dialog.dart';
import '../../widgets/kermes/order_qr_dialog.dart';
import '../../widgets/lokma_network_image.dart';
import '../../utils/cart_warning_utils.dart';
import '../../providers/kermes_cart_provider.dart';
import 'kermes_courier_tracking_screen.dart';
import '../../widgets/kermes/courier_order_success_dialog.dart';

/// Kermes Grup Siparis Ekrani
/// 3-tab layout: Menu | Benim Siparisim | Toplam
class KermesGroupOrderScreen extends ConsumerStatefulWidget {
  final KermesEvent? event;
  final String groupOrderId;
  final String? tableNumber;

  const KermesGroupOrderScreen({
    super.key,
    this.event,
    required this.groupOrderId,
    this.tableNumber,
  });

  @override
  ConsumerState<KermesGroupOrderScreen> createState() =>
      _KermesGroupOrderScreenState();
}

class _KermesGroupOrderScreenState extends ConsumerState<KermesGroupOrderScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  String _searchQuery = '';
  final ValueNotifier<String> _selectedCategory = ValueNotifier('Tumu');
  StreamSubscription? _orderSub;
  bool _isSubmitting = false;

  static const Color _accent = Color(0xFFEA184A);

  // Pill animasyon altyapisi (aynen detail screen)
  final Map<String, GlobalKey> _chipTabKeys = {};
  final ScrollController _chipScrollController = ScrollController();
  final ValueNotifier<double> _pillLeft = ValueNotifier(0.0);
  final ValueNotifier<double> _pillWidth = ValueNotifier(60.0);
  final ValueNotifier<bool> _pillInitialized = ValueNotifier(false);
  final GlobalKey _chipRowKey = GlobalKey();

  // Realtime products & Event
  List<KermesMenuItem> _products = [];
  StreamSubscription? _productsSub;
  KermesEvent? _currentEvent;
  StreamSubscription? _eventSub;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _currentEvent = widget.event;
    _startListening();
    if (_currentEvent != null) {
      _fetchProducts();
    } else {
      _fetchEventAndProducts();
    }
    // Pill init and listener
    _selectedCategory.addListener(() {
      if (mounted) _updatePillPosition();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition(_selectedCategory.value);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _selectedCategory.dispose();
    _orderSub?.cancel();
    _productsSub?.cancel();
    _eventSub?.cancel();
    _chipScrollController.dispose();
    _pillLeft.dispose();
    _pillWidth.dispose();
    _pillInitialized.dispose();
    super.dispose();
  }

  void _startListening() {
    ref.read(groupOrderProvider.notifier).startListening(widget.groupOrderId);
  }

  void _fetchProducts() {
    if (_currentEvent == null) return;
    _productsSub?.cancel();
    _productsSub = FirebaseFirestore.instance
        .collection('kermes_events')
        .doc(_currentEvent!.id)
        .collection('products')
        .where('isActive', isEqualTo: true)
        .snapshots()
        .listen((snap) {
      if (!mounted) return;
      setState(() {
        _products = snap.docs.map((doc) {
          final d = doc.data();
          return KermesMenuItem.fromJson(d);
        }).toList();
      });
    }, onError: (e) {
      // Listener hatasi - 2 sn sonra yeniden dene
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) _fetchProducts();
      });
    });
  }

  void _fetchEventAndProducts() async {
    // First get the group order to find kermesId
    final groupOrder = await FirebaseFirestore.instance
        .collection('kermes_group_orders')
        .doc(widget.groupOrderId)
        .get();

    if (!groupOrder.exists || !mounted) return;
    final kermesId = groupOrder.data()?['kermesId'];
    if (kermesId == null) return;

    _eventSub = FirebaseFirestore.instance
        .collection('kermes_events')
        .doc(kermesId)
        .snapshots()
        .listen((snap) {
      if (!snap.exists || !mounted) return;
      setState(() {
        final d = snap.data() ?? {};
        _currentEvent = KermesEvent(
          id: snap.id,
          title: d['title'] ?? 'Kermes',
          city: d['city'] ?? '',
          address: d['address'] ?? '',
          phoneNumber: d['phoneNumber'] ?? '',
          startDate: DateTime.now(),
          endDate: DateTime.now(),
          latitude: 0,
          longitude: 0,
          menu: [],
          parking: [],
          weatherForecast: [],
          openingTime: '',
          closingTime: '',
        );
      });
      if (_productsSub == null) _fetchProducts();
    });
  }

  List<String> get _categories {
    final cats = _products.map((p) => p.category ?? 'Diger').toSet().toList()
      ..sort();
    return ['Tumu', ...cats];
  }

  List<KermesMenuItem> get _filteredProducts {
    var items = _products;
    if (_selectedCategory.value != 'Tumu') {
      items = items
          .where((p) => (p.category ?? 'Diger') == _selectedCategory.value)
          .toList();
    }
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      items = items.where((p) => p.name.toLowerCase().contains(q)).toList();
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
    final groupState = ref.watch(groupOrderProvider);
    final order = groupState.currentOrder;

    // Build metodu icinde surekli post frame cagirarak animasyonu bozmamak icin kaldirdik.
    //_updatePillPosition();

    return PopScope(
      canPop: true,
      onPopInvoked: (didPop) {
        if (didPop) {
          final myPid = ref.read(groupOrderProvider).currentParticipantId;
          if (myPid != null) {
            ref.read(groupOrderProvider.notifier).setParticipantReadyStatus(
                participantId: myPid, isReady: false);
          }
        }
      },
      child: Scaffold(
        backgroundColor: bg,
        body: Column(
          children: [
            Expanded(
              child: NestedScrollView(
                headerSliverBuilder: (context, innerBoxIsScrolled) => [
                  // Pinned: geri butonu + arama hapi (aynen detail screen)
                  SliverAppBar(
                    pinned: true,
                    floating: true,
                    snap: true,
                    expandedHeight: 0,
                    toolbarHeight: 56,
                    backgroundColor: bg,
                    surfaceTintColor: Colors.transparent,
                    automaticallyImplyLeading: false,
                    leading: Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: GestureDetector(
                        onTap: () {
                          // Reset ready state when leaving the group order screen
                          final myPid = groupState.currentParticipantId;
                          if (myPid != null) {
                            ref
                                .read(groupOrderProvider.notifier)
                                .setParticipantReadyStatus(
                                    participantId: myPid, isReady: false);
                          }
                          Navigator.of(context).pop();
                        },
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: isDark
                                ? Colors.white.withOpacity(0.1)
                                : Colors.black.withOpacity(0.05),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.arrow_back_ios_new,
                              color: isDark ? Colors.white : Colors.black87,
                              size: 18),
                        ),
                      ),
                    ),
                    title: GestureDetector(
                      onTap: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => _buildSearchSheet(isDark),
                        );
                      },
                      child: Container(
                        height: 40,
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF2A2A2A)
                              : const Color(0xFFF5F0E8),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          children: [
                            const SizedBox(width: 12),
                            Icon(Icons.search,
                                color: isDark
                                    ? Colors.grey[400]
                                    : Colors.grey[600],
                                size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _searchQuery.isNotEmpty
                                    ? _searchQuery
                                    : 'Menude ara...',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: _searchQuery.isNotEmpty
                                      ? (isDark ? Colors.white : Colors.black87)
                                      : (isDark
                                          ? Colors.grey[400]
                                          : Colors.grey[600]),
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 12),
                          ],
                        ),
                      ),
                    ),
                    actions: [
                      if (order != null &&
                          groupState.currentParticipantId != null)
                        IconButton(
                          icon: const Icon(Icons.share, size: 20),
                          tooltip: 'Davet Et',
                          onPressed: () => _showShareSheet(order),
                        ),
                      PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert),
                        onSelected: (v) {
                          if (v == 'cancel') _cancelGroup();
                        },
                        itemBuilder: (_) => [
                          const PopupMenuItem(
                            value: 'cancel',
                            child: Row(
                              children: [
                                Icon(Icons.cancel, color: Colors.red, size: 20),
                                SizedBox(width: 8),
                                Text('Grubu Iptal Et',
                                    style: TextStyle(color: Colors.red)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Scrollable: event baslik + grup badge
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              widget.event?.title ??
                                  widget.event?.city ??
                                  'Kermes',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 20,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () {
                              if (order != null) {
                                _showParticipantsSheet(context, order, isDark);
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: _accent.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.groups, size: 14, color: _accent),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Grup${order != null ? " (${order.participantCount})" : ""}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: _accent),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Scrollable: countdown timer
                  if (order?.expiresAt != null)
                    SliverToBoxAdapter(
                      child: GroupOrderCountdownTimer(
                        expiresAt: order!.expiresAt!,
                        isDark: isDark,
                        accentColor: _accent,
                      ),
                    ),

                  // Scrollable: tab bar
                  SliverToBoxAdapter(
                    child: Container(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      height: 44,
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: isDark
                            ? const Color(0xFF2A2A2A)
                            : Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: TabBar(
                        controller: _tabController,
                        onTap: (_) => setState(() {}),
                        indicator: BoxDecoration(
                          color: _accent,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                                color: _accent.withOpacity(0.3),
                                blurRadius: 6,
                                offset: const Offset(0, 2))
                          ],
                        ),
                        indicatorSize: TabBarIndicatorSize.tab,
                        dividerHeight: 0,
                        labelColor: Colors.white,
                        unselectedLabelColor:
                            isDark ? Colors.grey[400] : Colors.grey[600],
                        labelStyle: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600),
                        tabs: [
                          Tab(text: 'Menu'),
                          Tab(text: 'Ben (${_myItemCount(order)})'),
                          Tab(text: 'Toplam (${order?.totalItems ?? 0})'),
                        ],
                      ),
                    ),
                  ),

                  // Sticky: kategori chip'leri (sadece Menu tab)
                  if (_tabController.index == 0)
                    SliverPersistentHeader(
                      pinned: true,
                      delegate: KermesCategoryHeaderDelegate(
                        child: Container(
                          color: bg,
                          height: 52,
                          child: Column(
                            children: [
                              AnimatedBuilder(
                                animation: Listenable.merge([
                                  _selectedCategory,
                                  _pillLeft,
                                  _pillWidth,
                                  _pillInitialized,
                                ]),
                                builder: (context, _) {
                                  return Expanded(
                                    child: SingleChildScrollView(
                                      controller: _chipScrollController,
                                      scrollDirection: Axis.horizontal,
                                      padding: const EdgeInsets.only(
                                          left: 16,
                                          right: 4,
                                          top: 4,
                                          bottom: 8),
                                      child: Stack(
                                        alignment: Alignment.centerLeft,
                                        children: [
                                          // Sliding pill indicator
                                          if (_pillInitialized.value)
                                            AnimatedPositioned(
                                              duration: const Duration(
                                                  milliseconds: 400),
                                              curve: Curves.easeOutBack,
                                              left: _pillLeft.value,
                                              top: 0,
                                              bottom: 0,
                                              child: AnimatedContainer(
                                                duration: const Duration(
                                                    milliseconds: 400),
                                                curve: Curves.easeOutBack,
                                                width: _pillWidth.value,
                                                decoration: BoxDecoration(
                                                  color: isDark
                                                      ? Colors.white
                                                      : const Color(0xFF3E3E3F),
                                                  borderRadius:
                                                      BorderRadius.circular(50),
                                                  boxShadow: [
                                                    BoxShadow(
                                                      color: (isDark
                                                              ? Colors.white
                                                              : Colors.black)
                                                          .withOpacity(0.12),
                                                      blurRadius: 8,
                                                      offset:
                                                          const Offset(0, 2),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          // Chip texts row
                                          Row(
                                            key: _chipRowKey,
                                            children:
                                                _categories.map((category) {
                                              _chipTabKeys.putIfAbsent(
                                                  category, () => GlobalKey());
                                              final isSelected = category ==
                                                  _selectedCategory.value;

                                              // Kategori bazli sepet sayisi
                                              final groupState =
                                                  ref.watch(groupOrderProvider);
                                              final myOrder =
                                                  groupState.currentOrder;
                                              final myPid = groupState
                                                  .currentParticipantId;
                                              int catCartCount = 0;
                                              if (myOrder != null &&
                                                  myPid != null) {
                                                final me = myOrder.participants
                                                    .cast<
                                                        GroupOrderParticipant?>()
                                                    .firstWhere(
                                                        (p) =>
                                                            p?.oderId == myPid,
                                                        orElse: () => null);
                                                if (me != null) {
                                                  if (category == 'Tumu') {
                                                    catCartCount =
                                                        me.totalItems;
                                                  } else {
                                                    for (final ci in me.items) {
                                                      // Urun adi uzerinden kategori bul
                                                      final matchProduct = _products
                                                          .cast<
                                                              KermesMenuItem?>()
                                                          .firstWhere(
                                                            (p) =>
                                                                p?.name ==
                                                                ci.menuItemName,
                                                            orElse: () => null,
                                                          );
                                                      if (matchProduct
                                                              ?.category ==
                                                          category) {
                                                        catCartCount +=
                                                            ci.quantity;
                                                      }
                                                    }
                                                  }
                                                }
                                              }

                                              return Padding(
                                                padding: const EdgeInsets.only(
                                                    right: 6),
                                                child: GestureDetector(
                                                  onTap: () {
                                                    HapticFeedback
                                                        .selectionClick();
                                                    _selectGroupCategory(
                                                        category);
                                                  },
                                                  child: Container(
                                                    key: _chipTabKeys[category],
                                                    padding: const EdgeInsets
                                                        .symmetric(
                                                        horizontal: 16,
                                                        vertical: 7),
                                                    decoration: BoxDecoration(
                                                      color: Colors.transparent,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              50),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize:
                                                          MainAxisSize.min,
                                                      children: [
                                                        AnimatedDefaultTextStyle(
                                                          duration:
                                                              const Duration(
                                                                  milliseconds:
                                                                      300),
                                                          curve: Curves
                                                              .easeOutCubic,
                                                          style: TextStyle(
                                                            color: isSelected
                                                                ? (isDark
                                                                    ? Colors
                                                                        .black
                                                                    : Colors
                                                                        .white)
                                                                : (isDark
                                                                    ? Colors
                                                                        .white70
                                                                    : Colors
                                                                        .black54),
                                                            fontWeight:
                                                                isSelected
                                                                    ? FontWeight
                                                                        .w700
                                                                    : FontWeight
                                                                        .w500,
                                                            fontSize: 14,
                                                          ),
                                                          child: Text(category),
                                                        ),
                                                        // Cart count badge
                                                        if (catCartCount > 0)
                                                          Padding(
                                                            padding:
                                                                const EdgeInsets
                                                                    .only(
                                                                    left: 6),
                                                            child:
                                                                AnimatedContainer(
                                                              duration:
                                                                  const Duration(
                                                                      milliseconds:
                                                                          300),
                                                              curve: Curves
                                                                  .easeOutBack,
                                                              width: 20,
                                                              height: 20,
                                                              decoration:
                                                                  BoxDecoration(
                                                                color: isSelected
                                                                    ? (isDark
                                                                        ? Colors
                                                                            .black87
                                                                        : Colors
                                                                            .white)
                                                                    : Colors
                                                                        .red,
                                                                shape: BoxShape
                                                                    .circle,
                                                              ),
                                                              alignment:
                                                                  Alignment
                                                                      .center,
                                                              child: Text(
                                                                '$catCartCount',
                                                                style:
                                                                    TextStyle(
                                                                  fontSize: 11,
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .w600,
                                                                  color: isSelected
                                                                      ? (isDark
                                                                          ? Colors
                                                                              .white
                                                                          : Colors
                                                                              .black87)
                                                                      : Colors
                                                                          .white,
                                                                ),
                                                              ),
                                                            ),
                                                          ),
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
                                  );
                                },
                              ),
                              Divider(
                                height: 1,
                                thickness: 0.5,
                                color: isDark
                                    ? Colors.white.withOpacity(0.1)
                                    : Colors.grey[300],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
                body: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildMenuProductList(isDark),
                    _buildMyOrderTab(isDark, groupState),
                    _buildTotalTab(isDark, groupState),
                  ],
                ),
              ),
            ),

            // Bottom bar
            _buildBottomBar(isDark, groupState),
          ],
        ),
      ),
    );
  }

  // Menu tab - kategorilere ayrilmis urun listesi
  Widget _buildMenuProductList(bool isDark) {
    if (_filteredProducts.isEmpty) {
      return CustomScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        slivers: [
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.restaurant_menu,
                      size: 48, color: Colors.grey[400]),
                  const SizedBox(height: 12),
                  Text('Urun bulunamadi',
                      style: TextStyle(color: Colors.grey[500], fontSize: 15)),
                ],
              ),
            ),
          ),
        ],
      );
    }

    // Kategorileri grupla (Arama varsa sadece filtrelenenleri goster)
    final grouped = <String, List<KermesMenuItem>>{};
    for (final item in _filteredProducts) {
      final cat = item.category ?? 'Diger';
      grouped.putIfAbsent(cat, () => []).add(item);
    }

    final categoriesToDisplay = grouped.keys.toList()..sort();

    return CustomScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.only(bottom: 80),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final category = categoriesToDisplay[index];
                final categoryItems = grouped[category]!;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Kirmizi yazili kategori basligi (aynen bireysel siparisteki gibi)
                    Container(
                      width: double.infinity,
                      color: isDark
                          ? const Color(0xFF2C2C2C).withOpacity(0.6)
                          : const Color(0xFFF2EEE9),
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                      child: Text(
                        category,
                        style: const TextStyle(
                          color: Color(0xFFF41C54), // Her zaman kirmizi (Lokma Pink)
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ),
                    // Urunler
                    ...categoryItems.map((item) {
                      final cartQty = _getCartQuantityInGroup(item);
                      return KermesMenuItemTile(
                        item: item,
                        cartQuantity: cartQty,
                        onAdd: () => _addItemToGroup(item),
                        onTap: () => _addItemToGroup(item),
                      );
                    }),
                    if (index < categoriesToDisplay.length - 1)
                      const SizedBox(height: 16),
                  ],
                );
              },
              childCount: categoriesToDisplay.length,
            ),
          ),
        ),
      ],
    );
  }

  int _getCartQuantityInGroup(KermesMenuItem item) {
    final groupState = ref.read(groupOrderProvider);
    final myOrder = groupState.currentOrder;
    final myPid = groupState.currentParticipantId;
    if (myOrder == null || myPid == null) return 0;

    final me = myOrder.participants
        .cast<GroupOrderParticipant?>()
        .firstWhere((p) => p?.oderId == myPid, orElse: () => null);
    if (me == null) return 0;

    return me.items
        .where((ci) => ci.menuItemName == item.name)
        .fold<int>(0, (sum, ci) => sum + ci.quantity);
  }

  int _myItemCount(KermesGroupOrder? order) {
    if (order == null) return 0;
    final pid = ref.read(groupOrderProvider).currentParticipantId;
    if (pid == null) return 0;
    final me = order.participants
        .cast<GroupOrderParticipant?>()
        .firstWhere((p) => p?.oderId == pid, orElse: () => null);
    return me?.totalItems ?? 0;
  }

  // Pill animasyon metodlari (aynen detail screen)
  void _scrollChipBarToSelected(String category) {
    if (!_chipScrollController.hasClients) return;
    final tabKey = _chipTabKeys[category];
    if (tabKey == null || tabKey.currentContext == null) return;

    final RenderBox? chipBox =
        tabKey.currentContext!.findRenderObject() as RenderBox?;
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
    final category = cat ?? _selectedCategory.value;
    final tabKey = _chipTabKeys[category];
    if (tabKey?.currentContext == null || _chipRowKey.currentContext == null) {
      return;
    }

    final RenderBox? chipBox =
        tabKey?.currentContext?.findRenderObject() as RenderBox?;
    final RenderBox? rowBox =
        _chipRowKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null || rowBox == null) return;

    final chipPos = chipBox.localToGlobal(Offset.zero, ancestor: rowBox);

    if (mounted) {
      _pillLeft.value = chipPos.dx;
      _pillWidth.value = chipBox.size.width;
      _pillInitialized.value = true;
    }
  }

  void _selectGroupCategory(String category) {
    if (_selectedCategory.value == category) return;
    _selectedCategory.value = category;

    _scrollChipBarToSelected(category);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition(category);
    });
  }

  Widget _buildSearchSheet(bool isDark) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                autofocus: true,
                onChanged: (v) => setState(() => _searchQuery = v),
                style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                decoration: InputDecoration(
                  hintText: 'Menude ara...',
                  prefixIcon: Icon(Icons.search, color: Colors.grey[500]),
                  filled: true,
                  fillColor: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFF0F0F0),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(22),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                itemCount: _filteredProducts.length,
                itemBuilder: (_, i) {
                  final item = _filteredProducts[i];
                  return KermesMenuItemTile(
                    item: item,
                    onAdd: () => _addItemToGroup(item),
                    onTap: () => _addItemToGroup(item),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showParticipantsSheet(
      BuildContext context, KermesGroupOrder initialOrder, bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Consumer(
          builder: (context, ref, child) {
            final groupState = ref.watch(groupOrderProvider);
            final order = groupState.currentOrder ?? initialOrder;

            return Container(
              height: MediaQuery.of(context).size.height * 0.6,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 12),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Text(
                    'Katılımcılar (${order.participantCount})',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView.builder(
                      itemCount: order.participants.length,
                      itemBuilder: (context, index) {
                        final participant = order.participants[index];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: _accent.withOpacity(0.1),
                            child: Text(
                              participant.name.isNotEmpty
                                  ? participant.name[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                  color: _accent, fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(
                            participant.name,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          subtitle: Text(
                            '${participant.totalItems} ürün - ${participant.totalAmount.toStringAsFixed(2)} €',
                            style: TextStyle(
                              color:
                                  isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                          ),
                          trailing: participant.isHost
                              ? Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.blue.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text('Kurucu',
                                      style: TextStyle(
                                          color: Colors.blue,
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold)),
                                )
                              : null,
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

  Future<void> _addItemToGroup(KermesMenuItem item) async {
    final groupState = ref.read(groupOrderProvider);
    final myPid = groupState.currentParticipantId;

    if (myPid == null) {
      if (CartWarningUtils.handleCartConflict(
        context: context,
        ref: ref,
        targetBusinessName:
            widget.event?.title ?? widget.event?.city ?? 'Kermes',
        targetId: widget.event?.id ?? '',
        isKermes: true,
        onConfirmClearAndAdd: () => _startGroupAndAdd(item),
      )) {
        return;
      }
      _startGroupAndAdd(item);
      return;
    }

    HapticFeedback.lightImpact();
    ref.read(groupOrderProvider.notifier).addItemToCart(
          participantId: myPid,
          menuItem: item,
        );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${item.name} eklendi'),
        backgroundColor: _accent,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<void> _startGroupAndAdd(KermesMenuItem item) async {
    final name = await _showNameDialog();
    if (name == null || name.isEmpty) return;

    final orderId =
        await ref.read(groupOrderProvider.notifier).createGroupOrder(
      kermesId: widget.event?.id ?? '',
      kermesName: widget.event?.title ?? widget.event?.city ?? 'Kermes',
      hostName: name,
      hostUserId: FirebaseAuth.instance.currentUser?.uid,
      initialItems: [],
    );

    if (orderId != null) {
      final myPid = ref.read(groupOrderProvider).currentParticipantId;
      if (myPid != null) {
        ref.read(groupOrderProvider.notifier).addItemToCart(
              participantId: myPid,
              menuItem: item,
            );
      }
    }
  }

  // ---- TAB 2: BENIM SIPARISIM ----
  Widget _buildMyOrderTab(bool isDark, GroupOrderState state) {
    final pid = state.currentParticipantId;
    final order = state.currentOrder;
    if (order == null || pid == null) {
      return CustomScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        slivers: [
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(child: Text('Henuz siparis yok')),
          ),
        ],
      );
    }

    final me = order.participants
        .cast<GroupOrderParticipant?>()
        .firstWhere((p) => p?.oderId == pid, orElse: () => null);
    if (me == null || me.items.isEmpty) {
      return CustomScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        slivers: [
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_bag_outlined,
                      size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 12),
                  Text('Henuz urun eklemediniz',
                      style: TextStyle(color: Colors.grey[500], fontSize: 15)),
                  const SizedBox(height: 8),
                  Text('Menu sekmesinden urun ekleyin',
                      style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                ],
              ),
            ),
          ),
        ],
      );
    }

    return CustomScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              ...me.items.map((item) => _buildMyItemCard(item, isDark)),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Toplam',
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        )),
                    Text('${me.totalAmount.toStringAsFixed(2)} EUR',
                        style: TextStyle(
                          color: _accent,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        )),
                  ],
                ),
              ),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _buildMyItemCard(GroupOrderItem item, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.menuItemName,
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    )),
                const SizedBox(height: 4),
                Text('${item.price.toStringAsFixed(2)} EUR x ${item.quantity}',
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 12,
                    )),
              ],
            ),
          ),
          Row(
            children: [
              _buildQtyButton(Icons.remove, () {
                final pid = ref.read(groupOrderProvider).currentParticipantId;
                if (pid == null) return;
                ref.read(groupOrderProvider.notifier).removeItemFromCart(
                      participantId: pid,
                      menuItemName: item.menuItemName,
                    );
              }, isDark),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Text('${item.quantity}',
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    )),
              ),
              _buildQtyButton(Icons.add, () {
                final pid = ref.read(groupOrderProvider).currentParticipantId;
                if (pid == null) return;
                // Create a temporary KermesMenuItem to reuse addItemToCart
                final tempItem =
                    KermesMenuItem(name: item.menuItemName, price: item.price);
                ref.read(groupOrderProvider.notifier).addItemToCart(
                      participantId: pid,
                      menuItem: tempItem,
                    );
              }, isDark),
            ],
          ),
          const SizedBox(width: 8),
          Text('${item.totalPrice.toStringAsFixed(2)}',
              style: TextStyle(
                color: _accent,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              )),
        ],
      ),
    );
  }

  Widget _buildQtyButton(IconData icon, VoidCallback onTap, bool isDark) {
    return Material(
      color: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade200,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Padding(
            padding: const EdgeInsets.all(6),
            child: Icon(icon, size: 16, color: _accent)),
      ),
    );
  }

  // ---- TAB 3: TOPLAM ----
  Widget _buildTotalTab(bool isDark, GroupOrderState state) {
    final order = state.currentOrder;
    if (order == null) {
      return CustomScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        slivers: [
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(child: Text('Grup bilgisi yok')),
          ),
        ],
      );
    }

    return CustomScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // Katilimci listesi
              ...order.participants
                  .map((p) => _buildParticipantCard(p, isDark, state)),
              const SizedBox(height: 16),

              // Genel toplam
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [
                    _accent.withOpacity(0.12),
                    _accent.withOpacity(0.04)
                  ]),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _accent.withOpacity(0.2)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(children: [
                      Icon(Icons.receipt_long, color: _accent, size: 20),
                      const SizedBox(width: 8),
                      Text('Genel Toplam',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          )),
                    ]),
                    Text('${order.totalAmount.toStringAsFixed(2)} EUR',
                        style: TextStyle(
                          color: _accent,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        )),
                  ],
                ),
              ),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _buildParticipantCard(
      GroupOrderParticipant p, bool isDark, GroupOrderState state) {
    final isMe = p.oderId == state.currentParticipantId;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: isMe
            ? Border.all(color: _accent.withOpacity(0.4), width: 1.5)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: isMe ? _accent : Colors.grey[400],
                child: Text(p.name.isNotEmpty ? p.name[0].toUpperCase() : '?',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text(p.name,
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          )),
                      if (p.isHost) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _accent.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text('Host',
                              style: TextStyle(
                                  color: _accent,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ],
                      if (isMe) ...[
                        const SizedBox(width: 6),
                        Text('(Sen)',
                            style: TextStyle(
                                color: Colors.grey[500], fontSize: 12)),
                      ],
                    ]),
                    Text(
                        '${p.totalItems} urun - ${p.totalAmount.toStringAsFixed(2)} EUR',
                        style:
                            TextStyle(color: Colors.grey[500], fontSize: 12)),
                  ],
                ),
              ),
              // Hazir durumu badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: p.isReady
                      ? Colors.green.withOpacity(0.12)
                      : Colors.orange.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: p.isReady
                        ? Colors.green.withOpacity(0.3)
                        : Colors.orange.withOpacity(0.3),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      p.isReady ? Icons.check_circle : Icons.hourglass_empty,
                      color: p.isReady ? Colors.green : Colors.orange,
                      size: 14,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      p.isReady ? 'Hazir' : 'Bekliyor',
                      style: TextStyle(
                        color: p.isReady ? Colors.green : Colors.orange,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (p.items.isNotEmpty) ...[
            const SizedBox(height: 8),
            Divider(
                height: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),
            const SizedBox(height: 8),
            ...p.items.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      Text('${item.quantity}x ',
                          style: TextStyle(
                              color: _accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w600)),
                      Expanded(
                          child: Text(item.menuItemName,
                              style: TextStyle(
                                  color: isDark
                                      ? Colors.grey[300]
                                      : Colors.grey[700],
                                  fontSize: 12))),
                      Text('${item.totalPrice.toStringAsFixed(2)}',
                          style:
                              TextStyle(color: Colors.grey[500], fontSize: 12)),
                    ],
                  ),
                )),
          ],
        ],
      ),
    );
  }

  // ---- BOTTOM BAR ----
  Widget _buildBottomBar(bool isDark, GroupOrderState state) {
    final order = state.currentOrder;
    final pid = state.currentParticipantId;
    if (order == null || pid == null) return const SizedBox.shrink();

    final me = order.participants
        .cast<GroupOrderParticipant?>()
        .firstWhere((p) => p?.oderId == pid, orElse: () => null);
    final isHost = me?.isHost ?? false;


    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 10,
              offset: const Offset(0, -2))
        ],
      ),
      child: Row(
        children: [
          // Hazir toggle
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                HapticFeedback.mediumImpact();
                ref
                    .read(groupOrderProvider.notifier)
                    .toggleParticipantReady(participantId: pid);
              },
              icon: Icon(
                  me?.isReady == true
                      ? Icons.check_circle
                      : Icons.radio_button_unchecked,
                  size: 20),
              label: Text(me?.isReady == true ? 'Hazirim' : 'Hazirim De'),
              style: ElevatedButton.styleFrom(
                backgroundColor: me?.isReady == true
                    ? Colors.green
                    : (isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade200),
                foregroundColor: me?.isReady == true
                    ? Colors.white
                    : (isDark ? Colors.grey[300] : Colors.grey[700]),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
          if (isHost) ...[
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: (order.allParticipantsReady && !_isSubmitting) ? _submitOrder : null,
                icon: _isSubmitting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send, size: 18),
                label: Text(_isSubmitting ? 'Gonderiliyor...' : 'Siparisi Gonder'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _accent,
                  disabledBackgroundColor:
                      isDark ? Colors.grey[700] : Colors.grey[300],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showShareSheet(KermesGroupOrder order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => GroupOrderShareSheet(
        orderId: order.id,
        kermesName: order.kermesName,
        hostName: order.hostName,
        expirationMinutes: 30,
        expiresAt:
            order.expiresAt ?? DateTime.now().add(const Duration(minutes: 30)),
        groupPin: order.groupPin,
      ),
    );
  }

  Future<void> _submitOrder() async {
    if (_isSubmitting) return;
    HapticFeedback.mediumImpact();

    final order = ref.read(groupOrderProvider).currentOrder;
    if (order == null) return;

    // 1. Odeme secimi dialog'u goster
    PaymentMethodType? paymentMethod;
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => PaymentMethodDialog(
        totalAmount: order.totalAmount,
        kermesName: order.kermesName,
        onSelected: (method) {
          paymentMethod = method;
        },
      ),
    );

    // Kullanici iptal etti
    if (paymentMethod == null || !mounted) return;
    final selectedPayment = paymentMethod!;

    setState(() => _isSubmitting = true);

    try {
      final orderNum = await ref.read(groupOrderProvider.notifier).completeOrder(
        paymentMethod: selectedPayment,
      );
      debugPrint('[GROUP] completeOrder result: $orderNum');
      if (orderNum != null && mounted) {
        // Provider state'i temizle
        ref.read(groupOrderProvider.notifier).clearOrder();
        // Sepeti temizle
        ref.read(kermesCartProvider.notifier).clearCart();
        
        final fullOrderId = '${order.kermesId}_$orderNum';
        final deliveryType = order.delivery?.type ?? DeliveryType.gelAl;
        
        // Bireysel siparisteki gibi: once bu ekrani kapat, sonra dogru ekrani goster
        final rootNavContext = Navigator.of(context, rootNavigator: true).context;
        Navigator.pop(context);
        
        if (deliveryType == DeliveryType.kurye) {
          // Kurye: once basarili dialog goster, sonra takip ekranina yonlendir
          final goToTracking = await showCourierOrderSuccessDialog(
            rootNavContext,
            orderNumber: orderNum,
            kermesName: order.kermesName,
            totalAmount: order.totalAmount,
            isPaid: selectedPayment == PaymentMethodType.card,
          );
          if (goToTracking && rootNavContext.mounted) {
            Navigator.push(
              rootNavContext,
              MaterialPageRoute(
                builder: (ctx) => KermesCourierTrackingScreen(orderId: fullOrderId),
              ),
            );
          }
        } else {
          // GelAl / Masa: QR dialog goster
          showOrderQRDialog(
            rootNavContext,
            orderId: fullOrderId,
            orderNumber: orderNum,
            kermesId: order.kermesId,
            kermesName: order.kermesName,
            totalAmount: order.totalAmount,
            isPaid: selectedPayment == PaymentMethodType.card,
          );
        }
        return;
      } else if (mounted) {
        final error = ref.read(groupOrderProvider).error;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: ${error ?? "Bilinmeyen hata"}'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// Siparis onay ekrani - numara buyuk fontla gosterilir
  Future<void> _showOrderConfirmation({
    required String orderNum,
    required PaymentMethodType paymentMethod,
    required double totalAmount,
    required String kermesName,
    required int participantCount,
  }) async {
    HapticFeedback.heavyImpact();
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 380),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Basarili header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 28),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.green.shade500, Colors.green.shade700],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check_rounded,
                        color: Colors.white,
                        size: 44,
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Siparis Alindi!',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              // Siparis numarasi
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 8),
                child: Column(
                  children: [
                    Text(
                      'Siparis Numaraniz',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.green.shade200),
                      ),
                      child: Text(
                        orderNum,
                        style: TextStyle(
                          color: Colors.green.shade800,
                          fontSize: 48,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Detaylar
                    _confirmRow(Icons.people_outline, '$participantCount kisi'),
                    const SizedBox(height: 6),
                    _confirmRow(
                      paymentMethod == PaymentMethodType.cash 
                          ? Icons.money 
                          : Icons.credit_card,
                      paymentMethod == PaymentMethodType.cash 
                          ? 'Nakit Odeme' 
                          : 'Kart ile Odeme',
                    ),
                    const SizedBox(height: 6),
                    _confirmRow(Icons.euro, '${totalAmount.toStringAsFixed(2)}'),
                    const SizedBox(height: 6),
                    _confirmRow(Icons.store, kermesName),
                  ],
                ),
              ),
              // Kapat butonu
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green.shade600,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Tamam',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _confirmRow(IconData icon, String text) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: Colors.grey.shade500),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(fontSize: 14, color: Colors.grey.shade700)),
      ],
    );
  }

  void _cancelGroup() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Grubu Iptal Et'),
        content: const Text(
            'Grup siparisini iptal etmek istediginize emin misiniz?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Vazgec')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(groupOrderProvider.notifier).clearOrder();
              Navigator.pop(context);
            },
            child: const Text('Iptal Et', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Future<String?> _showNameDialog() async {
    String name = '';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        title: const Text('Grup Siparişi Başlat'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Lütfen grup siparişi için adınızı girin:'),
            const SizedBox(height: 16),
            TextField(
              autofocus: true,
              onChanged: (v) => name = v,
              decoration: InputDecoration(
                hintText: 'Adınız',
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Vazgeç')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, name),
            child: const Text('Başlat',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

class GroupOrderCountdownTimer extends StatefulWidget {
  final DateTime expiresAt;
  final bool isDark;
  final Color accentColor;

  const GroupOrderCountdownTimer({
    Key? key,
    required this.expiresAt,
    required this.isDark,
    required this.accentColor,
  }) : super(key: key);

  @override
  State<GroupOrderCountdownTimer> createState() =>
      _GroupOrderCountdownTimerState();
}

class _GroupOrderCountdownTimerState extends State<GroupOrderCountdownTimer> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final diff = widget.expiresAt.difference(now);
    if (diff.isNegative) {
      return Container(
        color: Colors.red.withOpacity(0.1),
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: const Center(
          child: Text('Süre doldu!',
              style: TextStyle(
                  color: Colors.red,
                  fontWeight: FontWeight.bold,
                  fontSize: 12)),
        ),
      );
    }

    final minutes = diff.inMinutes;
    final seconds = diff.inSeconds % 60;
    final isUrgent = minutes < 5;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        color: isUrgent
            ? Colors.red.withOpacity(0.1)
            : (widget.isDark
                ? Colors.blueGrey.withOpacity(0.2)
                : Colors.blue.withOpacity(0.05)),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isUrgent ? Colors.red.withOpacity(0.3) : Colors.transparent),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.timer_outlined,
              size: 16, color: isUrgent ? Colors.red : widget.accentColor),
          const SizedBox(width: 8),
          Text(
            'Siparişin verilmesine kalan süre: ',
            style: TextStyle(
                fontSize: 13,
                color: widget.isDark ? Colors.grey[300] : Colors.grey[700]),
          ),
          Text(
            '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isUrgent
                  ? Colors.red
                  : (widget.isDark ? Colors.white : Colors.black87),
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
