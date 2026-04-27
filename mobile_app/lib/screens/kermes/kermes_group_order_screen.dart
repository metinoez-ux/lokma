import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../models/kermes_group_order_model.dart';
import '../../models/kermes_model.dart';
import '../../providers/group_order_provider.dart';
import '../../widgets/kermes/group_order_share_sheet.dart';
import '../../widgets/lokma_network_image.dart';

/// Kermes Grup Siparis Ekrani
/// 3-tab layout: Menu | Benim Siparisim | Toplam
class KermesGroupOrderScreen extends ConsumerStatefulWidget {
  final KermesEvent event;
  final String groupOrderId;
  final String? tableNumber;

  const KermesGroupOrderScreen({
    super.key,
    required this.event,
    required this.groupOrderId,
    this.tableNumber,
  });

  @override
  ConsumerState<KermesGroupOrderScreen> createState() =>
      _KermesGroupOrderScreenState();
}

class _KermesGroupOrderScreenState
    extends ConsumerState<KermesGroupOrderScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  String _searchQuery = '';
  String _selectedCategory = 'Tumu';
  StreamSubscription? _orderSub;
  Timer? _countdownTimer;

  static const Color _accent = Color(0xFFEA184A);

  // Realtime products
  List<KermesMenuItem> _products = [];
  StreamSubscription? _productsSub;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _startListening();
    _fetchProducts();
    // Countdown timer - her saniye guncelle
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _orderSub?.cancel();
    _productsSub?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startListening() {
    ref.read(groupOrderProvider.notifier).startListening(widget.groupOrderId);
  }

  void _fetchProducts() {
    _productsSub = FirebaseFirestore.instance
        .collection('kermes_events')
        .doc(widget.event.id)
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
    });
  }

  List<String> get _categories {
    final cats = _products
        .map((p) => p.category ?? 'Diger')
        .toSet()
        .toList()
      ..sort();
    return ['Tumu', ...cats];
  }

  List<KermesMenuItem> get _filteredProducts {
    var items = _products;
    if (_selectedCategory != 'Tumu') {
      items = items.where((p) => (p.category ?? 'Diger') == _selectedCategory).toList();
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

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: bg,
        surfaceTintColor: bg,
        centerTitle: true,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                widget.event.title ?? widget.event.city,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 17),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _accent),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (order != null && groupState.currentParticipantId != null)
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
                    Text('Grubu Iptal Et', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Countdown Timer
          if (order?.expiresAt != null)
            _buildCountdownTimer(order!.expiresAt!, isDark),

          // Tab Bar
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            height: 44,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade200,
              borderRadius: BorderRadius.circular(22),
            ),
            child: TabBar(
              controller: _tabController,
              onTap: (_) => setState(() {}),
              indicator: BoxDecoration(
                color: _accent,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: _accent.withOpacity(0.3), blurRadius: 6, offset: const Offset(0, 2))],
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerHeight: 0,
              labelColor: Colors.white,
              unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
              labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              tabs: [
                Tab(text: 'Menu'),
                Tab(text: 'Ben (${_myItemCount(order)})'),
                Tab(text: 'Toplam (${order?.totalItems ?? 0})'),
              ],
            ),
          ),

          // Content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildMenuTab(isDark),
                _buildMyOrderTab(isDark, groupState),
                _buildTotalTab(isDark, groupState),
              ],
            ),
          ),

          // Bottom bar
          _buildBottomBar(isDark, groupState),
        ],
      ),
    );
  }

  Widget _buildCountdownTimer(DateTime expiresAt, bool isDark) {
    final now = DateTime.now();
    final diff = expiresAt.difference(now);
    if (diff.isNegative) {
      return Container(
        color: Colors.red.withOpacity(0.1),
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: const Center(
          child: Text('Süre doldu!', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
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
        color: isUrgent ? Colors.red.withOpacity(0.1) : (isDark ? Colors.blueGrey.withOpacity(0.2) : Colors.blue.withOpacity(0.05)),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isUrgent ? Colors.red.withOpacity(0.3) : Colors.transparent),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.timer_outlined, size: 16, color: isUrgent ? Colors.red : _accent),
          const SizedBox(width: 8),
          Text(
            'Siparişin verilmesine kalan süre: ',
            style: TextStyle(fontSize: 13, color: isDark ? Colors.grey[300] : Colors.grey[700]),
          ),
          Text(
            '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isUrgent ? Colors.red : (isDark ? Colors.white : Colors.black87),
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }

  int _myItemCount(KermesGroupOrder? order) {
    if (order == null) return 0;
    final pid = ref.read(groupOrderProvider).currentParticipantId;
    if (pid == null) return 0;
    final me = order.participants.cast<GroupOrderParticipant?>().firstWhere(
      (p) => p?.oderId == pid, orElse: () => null);
    return me?.totalItems ?? 0;
  }

  // ---- TAB 1: MENU ----
  Widget _buildMenuTab(bool isDark) {
    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            onChanged: (v) => setState(() => _searchQuery = v),
            style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Menude ara...',
              hintStyle: TextStyle(color: Colors.grey[500]),
              prefixIcon: Icon(Icons.search, color: Colors.grey[500], size: 22),
              filled: true,
              fillColor: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF0F0F0),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
          ),
        ),

        // Category chips
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _categories.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final cat = _categories[i];
              final sel = _selectedCategory == cat;
              return GestureDetector(
                onTap: () => setState(() => _selectedCategory = cat),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: sel ? _accent : (isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade200),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Text(cat, style: TextStyle(
                    color: sel ? Colors.white : (isDark ? Colors.grey[300] : Colors.grey[700]),
                    fontSize: 13, fontWeight: FontWeight.w600,
                  )),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),

        // Product list
        Expanded(
          child: _filteredProducts.isEmpty
              ? Center(child: Text('Urun bulunamadi', style: TextStyle(color: Colors.grey[500])))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  itemCount: _filteredProducts.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _buildProductCard(_filteredProducts[i], isDark),
                ),
        ),
      ],
    );
  }

  Widget _buildProductCard(KermesMenuItem item, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          if (item.imageUrl != null && item.imageUrl!.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LokmaNetworkImage(imageUrl: item.imageUrl!, width: 56, height: 56, fit: BoxFit.cover),
            ),
          if (item.imageUrl != null && item.imageUrl!.isNotEmpty) const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 14, fontWeight: FontWeight.w600,
                )),
                if (item.description != null && item.description!.isNotEmpty)
                  Text(item.description!, style: TextStyle(color: Colors.grey[500], fontSize: 12),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text('${item.price.toStringAsFixed(2)} EUR', style: TextStyle(
                  color: _accent, fontSize: 14, fontWeight: FontWeight.w700,
                )),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: _accent,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => _addItemToGroup(item),
              child: const Padding(
                padding: EdgeInsets.all(8),
                child: Icon(Icons.add, color: Colors.white, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _addItemToGroup(KermesMenuItem item) {
    HapticFeedback.lightImpact();
    final pid = ref.read(groupOrderProvider).currentParticipantId;
    if (pid == null) return;

    ref.read(groupOrderProvider.notifier).addItemToCart(
      participantId: pid,
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

  // ---- TAB 2: BENIM SIPARISIM ----
  Widget _buildMyOrderTab(bool isDark, GroupOrderState state) {
    final pid = state.currentParticipantId;
    final order = state.currentOrder;
    if (order == null || pid == null) {
      return const Center(child: Text('Henuz siparis yok'));
    }

    final me = order.participants.cast<GroupOrderParticipant?>().firstWhere(
      (p) => p?.oderId == pid, orElse: () => null);
    if (me == null || me.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shopping_bag_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 12),
            Text('Henuz urun eklemediniz', style: TextStyle(color: Colors.grey[500], fontSize: 15)),
            const SizedBox(height: 8),
            Text('Menu sekmesinden urun ekleyin', style: TextStyle(color: Colors.grey[400], fontSize: 13)),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
              Text('Toplam', style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 16, fontWeight: FontWeight.w700,
              )),
              Text('${me.totalAmount.toStringAsFixed(2)} EUR', style: TextStyle(
                color: _accent, fontSize: 16, fontWeight: FontWeight.w700,
              )),
            ],
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
                Text(item.menuItemName, style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 14, fontWeight: FontWeight.w600,
                )),
                const SizedBox(height: 4),
                Text('${item.price.toStringAsFixed(2)} EUR x ${item.quantity}', style: TextStyle(
                  color: Colors.grey[500], fontSize: 12,
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
                child: Text('${item.quantity}', style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 15, fontWeight: FontWeight.w600,
                )),
              ),
              _buildQtyButton(Icons.add, () {
                final pid = ref.read(groupOrderProvider).currentParticipantId;
                if (pid == null) return;
                // Create a temporary KermesMenuItem to reuse addItemToCart
                final tempItem = KermesMenuItem(name: item.menuItemName, price: item.price);
                ref.read(groupOrderProvider.notifier).addItemToCart(
                  participantId: pid,
                  menuItem: tempItem,
                );
              }, isDark),
            ],
          ),
          const SizedBox(width: 8),
          Text('${item.totalPrice.toStringAsFixed(2)}', style: TextStyle(
            color: _accent, fontSize: 14, fontWeight: FontWeight.w700,
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
        onTap: () { HapticFeedback.selectionClick(); onTap(); },
        child: Padding(padding: const EdgeInsets.all(6), child: Icon(icon, size: 16, color: _accent)),
      ),
    );
  }

  // ---- TAB 3: TOPLAM ----
  Widget _buildTotalTab(bool isDark, GroupOrderState state) {
    final order = state.currentOrder;
    if (order == null) return const Center(child: Text('Grup bilgisi yok'));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Katilimci listesi
        ...order.participants.map((p) => _buildParticipantCard(p, isDark, state)),
        const SizedBox(height: 16),

        // Genel toplam
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [_accent.withOpacity(0.12), _accent.withOpacity(0.04)]),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _accent.withOpacity(0.2)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(children: [
                Icon(Icons.receipt_long, color: _accent, size: 20),
                const SizedBox(width: 8),
                Text('Genel Toplam', style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 16, fontWeight: FontWeight.w700,
                )),
              ]),
              Text('${order.totalAmount.toStringAsFixed(2)} EUR', style: TextStyle(
                color: _accent, fontSize: 18, fontWeight: FontWeight.w800,
              )),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildParticipantCard(GroupOrderParticipant p, bool isDark, GroupOrderState state) {
    final isMe = p.oderId == state.currentParticipantId;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: isMe ? Border.all(color: _accent.withOpacity(0.4), width: 1.5) : null,
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
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text(p.name, style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 14, fontWeight: FontWeight.w600,
                      )),
                      if (p.isHost) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _accent.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text('Host', style: TextStyle(color: _accent, fontSize: 10, fontWeight: FontWeight.w600)),
                        ),
                      ],
                      if (isMe) ...[
                        const SizedBox(width: 6),
                        Text('(Sen)', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                      ],
                    ]),
                    Text('${p.totalItems} urun - ${p.totalAmount.toStringAsFixed(2)} EUR',
                      style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                  ],
                ),
              ),
              if (p.isReady)
                Icon(Icons.check_circle, color: Colors.green, size: 22)
              else
                Icon(Icons.hourglass_empty, color: Colors.orange, size: 20),
            ],
          ),
          if (p.items.isNotEmpty) ...[
            const SizedBox(height: 8),
            Divider(height: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),
            const SizedBox(height: 8),
            ...p.items.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Text('${item.quantity}x ', style: TextStyle(color: _accent, fontSize: 12, fontWeight: FontWeight.w600)),
                  Expanded(child: Text(item.menuItemName, style: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[700], fontSize: 12))),
                  Text('${item.totalPrice.toStringAsFixed(2)}', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
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

    final me = order.participants.cast<GroupOrderParticipant?>().firstWhere(
      (p) => p?.oderId == pid, orElse: () => null);
    final isHost = me?.isHost ?? false;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, -2))],
      ),
      child: Row(
        children: [
          // Hazir toggle
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                HapticFeedback.mediumImpact();
                ref.read(groupOrderProvider.notifier).toggleParticipantReady(participantId: pid);
              },
              icon: Icon(me?.isReady == true ? Icons.check_circle : Icons.radio_button_unchecked, size: 20),
              label: Text(me?.isReady == true ? 'Hazirim' : 'Hazirim De'),
              style: ElevatedButton.styleFrom(
                backgroundColor: me?.isReady == true ? Colors.green : (isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade200),
                foregroundColor: me?.isReady == true ? Colors.white : (isDark ? Colors.grey[300] : Colors.grey[700]),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
          if (isHost) ...[
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: order.allParticipantsReady ? _submitOrder : null,
                icon: const Icon(Icons.send, size: 18),
                label: const Text('Siparisi Gonder'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _accent,
                  disabledBackgroundColor: isDark ? Colors.grey[700] : Colors.grey[300],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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
        expiresAt: order.expiresAt ?? DateTime.now().add(const Duration(minutes: 30)),
      ),
    );
  }

  Future<void> _submitOrder() async {
    HapticFeedback.mediumImpact();
    final success = await ref.read(groupOrderProvider.notifier).completeOrder();
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Siparis gonderildi!'),
          backgroundColor: Colors.green,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
      Navigator.pop(context);
    }
  }

  void _cancelGroup() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Grubu Iptal Et'),
        content: const Text('Grup siparisini iptal etmek istediginize emin misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Vazgec')),
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
}
