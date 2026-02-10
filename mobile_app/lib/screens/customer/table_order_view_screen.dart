import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/table_session_service.dart';
import '../../services/order_service.dart';
import '../../models/butcher_product.dart';
import '../../data/product_catalog_data.dart';

/// Müşteri Masa Sipariş Ekranı
/// Customer can:
/// 1. Enter table number → browse menu → place own orders (no PIN needed)
/// 2. Optionally enter PIN to also see waiter-placed orders (hybrid view)
class TableOrderViewScreen extends StatefulWidget {
  final String? businessId;
  final String? businessName;

  const TableOrderViewScreen({super.key, this.businessId, this.businessName});

  @override
  State<TableOrderViewScreen> createState() => _TableOrderViewScreenState();
}

class _TableOrderViewScreenState extends State<TableOrderViewScreen>
    with SingleTickerProviderStateMixin {
  final TableSessionService _sessionService = TableSessionService();
  final OrderService _orderService = OrderService();
  final _tableController = TextEditingController();
  final _pinController = TextEditingController();

  // State
  String? _businessId;
  String? _businessName;
  int? _tableNumber;
  TableSession? _linkedSession; // Only if PIN entered
  bool _isJoining = false;
  bool _showPinEntry = false;
  String _selectedCategory = 'Tümü';
  String _menuSearchQuery = '';
  final Map<String, _CartItem> _cart = {};
  bool _isSubmitting = false;
  String? _notes;

  late TabController _tabController;

  // Track current view
  _CustomerViewState _viewState = _CustomerViewState.enterTable;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _businessId = widget.businessId;
    _businessName = widget.businessName;

    if (_businessId == null) {
      _promptBusinessSelection();
    }
  }

  @override
  void dispose() {
    _tableController.dispose();
    _pinController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _promptBusinessSelection() async {
    // For now, attempt to load from the user's recent order history
    // or show a selection dialog. This will be enhanced later.
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    // Check if user has any dine_in orders to determine business
    final recentOrders = await FirebaseFirestore.instance
        .collection('meat_orders')
        .where('userId', isEqualTo: user.uid)
        .where('orderType', isEqualTo: 'dineIn')
        .orderBy('createdAt', descending: true)
        .limit(1)
        .get();

    if (recentOrders.docs.isNotEmpty && mounted) {
      final data = recentOrders.docs.first.data();
      setState(() {
        _businessId = data['butcherId'];
        _businessName = data['butcherName'];
      });
    }
  }

  void _joinTable() {
    final tableNum = int.tryParse(_tableController.text.trim());
    if (tableNum == null || tableNum <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Geçerli bir masa numarası girin')),
      );
      return;
    }

    setState(() {
      _tableNumber = tableNum;
      _viewState = _CustomerViewState.tableActive;
    });
  }

  Future<void> _linkWithPin() async {
    final pin = _pinController.text.trim();
    if (pin.length != 4 || _businessId == null || _tableNumber == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('4 haneli PIN girin')),
      );
      return;
    }

    setState(() => _isJoining = true);

    try {
      final session = await _sessionService.validatePin(
        businessId: _businessId!,
        tableNumber: _tableNumber!,
        pin: pin,
      );

      if (session == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('PIN hatalı veya oturum bulunamadı'),
              backgroundColor: Colors.red.shade700,
            ),
          );
        }
      } else {
        // Link customer to session
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          await _sessionService.linkCustomer(
            sessionId: session.id,
            businessId: _businessId!,
            customerId: user.uid,
          );
        }

        if (mounted) {
          setState(() {
            _linkedSession = session;
            _showPinEntry = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Garson siparişlerine bağlandınız! ✓'),
              backgroundColor: Colors.green.shade700,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isJoining = false);
    }
  }

  void _addToCart(ButcherProduct product) {
    HapticFeedback.lightImpact();
    setState(() {
      if (_cart.containsKey(product.id)) {
        _cart[product.id]!.quantity += product.stepQuantity;
      } else {
        _cart[product.id] = _CartItem(
          product: product,
          quantity: product.minQuantity,
        );
      }
    });
  }

  void _removeFromCart(String productId) {
    HapticFeedback.lightImpact();
    setState(() {
      if (_cart.containsKey(productId)) {
        final item = _cart[productId]!;
        item.quantity -= item.product.stepQuantity;
        if (item.quantity <= 0) {
          _cart.remove(productId);
        }
      }
    });
  }

  double get _cartTotal =>
      _cart.values.fold(0, (sum, item) => sum + (item.product.price * item.quantity));
  int get _cartItemCount =>
      _cart.values.fold(0, (sum, item) => sum + (item.quantity ~/ item.product.stepQuantity));

  Future<void> _submitOrder() async {
    if (_cart.isEmpty || _businessId == null || _tableNumber == null) return;

    setState(() => _isSubmitting = true);

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sipariş vermek için giriş yapmalısınız')),
        );
        return;
      }

      // Get user name
      final userDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();
      final userName = userDoc.data()?['name'] ?? user.displayName ?? 'Müşteri';

      final items = _cart.values
          .map((ci) => OrderItem(
                sku: ci.product.sku,
                name: ci.product.name,
                price: ci.product.price,
                quantity: ci.quantity,
                unit: ci.product.unitType,
              ))
          .toList();

      // If linked to a waiter session, use that sessionId
      // Otherwise, create a customer-initiated session
      String sessionId;
      if (_linkedSession != null) {
        sessionId = _linkedSession!.id;
      } else {
        // Create or get a customer session for this table
        var existingSession =
            await _sessionService.getActiveSession(_businessId!, _tableNumber!);
        if (existingSession != null) {
          sessionId = existingSession.id;
        } else {
          // Customer creates their own session
          final newSession = await _sessionService.createSession(
            businessId: _businessId!,
            tableNumber: _tableNumber!,
            waiterId: user.uid,
            waiterName: 'Müşteri ($userName)',
          );
          sessionId = newSession.id;
          setState(() => _linkedSession = newSession);
        }
      }

      await _orderService.createDineInOrder(
        butcherId: _businessId!,
        butcherName: _businessName ?? '',
        waiterId: user.uid,
        waiterName: userName,
        tableNumber: _tableNumber!,
        tableSessionId: sessionId,
        items: items,
        totalAmount: _cartTotal,
        notes: _notes,
      );

      if (mounted) {
        setState(() {
          _cart.clear();
          _notes = null;
          _isSubmitting = false;
        });

        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 8),
                Text('Siparişiniz mutfağa gönderildi! 🎉'),
              ],
            ),
            backgroundColor: Colors.green.shade700,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );

        // Switch to orders tab after ordering
        _tabController.animateTo(1);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sipariş gönderilemedi: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        title: Text(
          _tableNumber != null ? 'Masa $_tableNumber' : 'Masa Siparişi',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: scaffoldBg,
        surfaceTintColor: scaffoldBg,
        centerTitle: true,
        actions: [
          if (_viewState == _CustomerViewState.tableActive && _linkedSession == null)
            TextButton.icon(
              icon: Icon(Icons.lock_outline, size: 18, color: Colors.orange.shade700),
              label: Text('PIN', style: TextStyle(color: Colors.orange.shade700)),
              onPressed: () => setState(() => _showPinEntry = !_showPinEntry),
            ),
        ],
        bottom: _viewState == _CustomerViewState.tableActive
            ? TabBar(
                controller: _tabController,
                labelColor: Colors.orange.shade700,
                indicatorColor: Colors.orange.shade700,
                tabs: const [
                  Tab(icon: Icon(Icons.restaurant_menu), text: 'Menü'),
                  Tab(icon: Icon(Icons.receipt_long), text: 'Siparişlerim'),
                ],
              )
            : null,
      ),
      body: _viewState == _CustomerViewState.enterTable
          ? _buildTableEntry(isDark)
          : TabBarView(
              controller: _tabController,
              children: [
                _buildMenuTab(isDark),
                _buildOrdersTab(isDark),
              ],
            ),
      bottomNavigationBar:
          _cart.isNotEmpty && _tabController.index == 0 ? _buildCartBar() : null,
    );
  }

  Widget _buildTableEntry(bool isDark) {
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Hero icon
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.orange.shade300, Colors.orange.shade700],
                ),
                borderRadius: BorderRadius.circular(28),
              ),
              child: const Icon(Icons.table_restaurant, size: 52, color: Colors.white),
            ),
            const SizedBox(height: 24),
            const Text(
              'Masanızdan Sipariş Verin',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Masa numaranızı girerek doğrudan mutfağa sipariş verebilirsiniz.',
              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),

            // Business selector (if needed)
            if (_businessId == null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber, color: Colors.red.shade700),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'İşletme bilgisi bulunamadı. Garsondan yardım isteyin.',
                        style: TextStyle(fontSize: 13, color: Colors.red.shade700),
                      ),
                    ),
                  ],
                ),
              ),

            // Table number input
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  TextField(
                    controller: _tableController,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900),
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      hintText: '0',
                      hintStyle: TextStyle(
                          fontSize: 32, fontWeight: FontWeight.w900, color: Colors.grey[300]),
                      labelText: 'Masa Numarası',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide(color: Colors.orange.shade700, width: 2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _businessId != null ? _joinTable : null,
                      icon: const Icon(Icons.restaurant_menu),
                      label: const Text('Menüyü Aç', style: TextStyle(fontSize: 16)),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.orange.shade700,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
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

  Widget _buildMenuTab(bool isDark) {
    if (_businessId == null) return const SizedBox.shrink();

    return Column(
      children: [
        // Optional PIN banner
        if (_showPinEntry)
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.orange.shade200),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _pinController,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: 6),
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      hintText: '• • • •',
                      labelText: 'Garson PIN',
                      counterText: '',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _isJoining ? null : _linkWithPin,
                  style: FilledButton.styleFrom(backgroundColor: Colors.orange.shade700),
                  child: _isJoining
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Bağlan'),
                ),
              ],
            ),
          ),

        if (_linkedSession != null)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.green.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.link, size: 16, color: Colors.green.shade700),
                const SizedBox(width: 8),
                Text(
                  'Garson siparişlerine bağlı (${_linkedSession!.waiterName})',
                  style: TextStyle(fontSize: 12, color: Colors.green.shade700, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),

        // Search bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            onChanged: (v) => setState(() => _menuSearchQuery = v),
            decoration: InputDecoration(
              hintText: 'Menüde ara...',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
        ),

        // Category chips
        _buildCategoryChips(),

        const SizedBox(height: 4),

        // Products
        Expanded(child: _buildProductList(isDark)),
      ],
    );
  }

  Widget _buildCategoryChips() {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('businesses')
          .doc(_businessId)
          .collection('products')
          .where('isActive', isEqualTo: true)
          .snapshots(),
      builder: (context, snapshot) {
        final categories = <String>{'Tümü'};
        if (snapshot.hasData) {
          for (final doc in snapshot.data!.docs) {
            final data = doc.data() as Map<String, dynamic>;
            final sku = data['masterProductId'] ?? data['masterProductSku'];
            final masterData = MASTER_PRODUCT_CATALOG[sku];
            final cat = data['category'] ?? masterData?.category ?? 'Diğer';
            categories.add(cat);
          }
        }

        return SizedBox(
          height: 40,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: categories.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final cat = categories.elementAt(index);
              final isSelected = cat == _selectedCategory;
              return ChoiceChip(
                label: Text(cat),
                selected: isSelected,
                selectedColor: Colors.orange.shade100,
                onSelected: (_) => setState(() => _selectedCategory = cat),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildProductList(bool isDark) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('businesses')
          .doc(_businessId)
          .collection('products')
          .where('isActive', isEqualTo: true)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Colors.orange));
        }

        List<ButcherProduct> products = [];
        if (snapshot.hasData) {
          products = snapshot.data!.docs.map((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final sku = data['masterProductId'] ?? data['masterProductSku'];
            final masterData = MASTER_PRODUCT_CATALOG[sku];

            final masterMap = masterData != null
                ? {
                    'name': masterData.name,
                    'description': masterData.description,
                    'category': masterData.category,
                    'unit': masterData.unitType,
                    'imageAsset': masterData.imagePath,
                    'tags': masterData.tags,
                  }
                : null;

            return ButcherProduct.fromFirestore(data, doc.id,
                butcherId: _businessId!, masterData: masterMap);
          }).toList();
        }

        // Filter
        var filtered = _selectedCategory == 'Tümü'
            ? products
            : products.where((p) => p.category == _selectedCategory).toList();

        if (_menuSearchQuery.isNotEmpty) {
          final query = _menuSearchQuery.toLowerCase();
          filtered = filtered
              .where((p) =>
                  p.name.toLowerCase().contains(query) ||
                  p.description.toLowerCase().contains(query))
              .toList();
        }

        if (filtered.isEmpty) {
          return Center(
            child: Text('Ürün bulunamadı', style: TextStyle(color: Colors.grey[500])),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
          itemCount: filtered.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) => _buildProductCard(filtered[index], isDark),
        );
      },
    );
  }

  Widget _buildProductCard(ButcherProduct product, bool isDark) {
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final inCart = _cart.containsKey(product.id);
    final cartQty = _cart[product.id]?.quantity ?? 0;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: inCart
            ? Border.all(color: Colors.orange.shade300, width: 1.5)
            : Border.all(color: Colors.grey.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          // Product image
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 56,
              height: 56,
              child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                  ? (product.imageUrl!.startsWith('assets/')
                      ? Image.asset(product.imageUrl!, fit: BoxFit.cover)
                      : CachedNetworkImage(
                          imageUrl: product.imageUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(color: Colors.grey[200]),
                          errorWidget: (_, __, ___) => _productPlaceholder(),
                        ))
                  : _productPlaceholder(),
            ),
          ),
          const SizedBox(width: 12),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '€${product.price.toStringAsFixed(2)} / ${product.unitType}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.orange.shade700,
                  ),
                ),
              ],
            ),
          ),

          // Qty controls
          if (inCart)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _circleButton(Icons.remove, () => _removeFromCart(product.id)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    product.unitType == 'kg'
                        ? cartQty.toStringAsFixed(1)
                        : '${cartQty.toInt()}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
                _circleButton(Icons.add, () => _addToCart(product)),
              ],
            )
          else
            FilledButton.icon(
              onPressed: () => _addToCart(product),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Ekle'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.orange.shade700,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                minimumSize: Size.zero,
                textStyle: const TextStyle(fontSize: 13),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOrdersTab(bool isDark) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return const Center(child: Text('Giriş yapmalısınız'));
    }

    // Show both: customer's own orders and linked session orders
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('meat_orders')
          .where('tableNumber', isEqualTo: _tableNumber)
          .where('butcherId', isEqualTo: _businessId)
          .orderBy('createdAt', descending: false)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Colors.orange));
        }

        final allOrders = snapshot.data?.docs ?? [];

        // Filter: show own orders + linked session orders
        final filtered = allOrders.where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          // Always show user's own orders
          if (data['userId'] == user.uid) return true;
          // Show session orders if linked via PIN
          if (_linkedSession != null && data['tableSessionId'] == _linkedSession!.id) return true;
          return false;
        }).toList();

        if (filtered.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.receipt_long, size: 56, color: Colors.grey[300]),
                const SizedBox(height: 12),
                Text(
                  'Henüz sipariş yok',
                  style: TextStyle(fontSize: 16, color: Colors.grey[500]),
                ),
                const SizedBox(height: 4),
                Text(
                  'Menüden sipariş verin veya\ngarson PIN ile bağlanın',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Colors.grey[400]),
                ),
              ],
            ),
          );
        }

        // Calculate total
        double total = 0;
        for (final doc in filtered) {
          final data = doc.data() as Map<String, dynamic>;
          total += (data['totalAmount'] ?? 0).toDouble();
        }

        return Column(
          children: [
            // Total header
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.orange.shade400, Colors.orange.shade700],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(Icons.table_restaurant, color: Colors.white, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Masa $_tableNumber',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${filtered.length} sipariş',
                          style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '€${total.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),

            // Order list
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final data = filtered[index].data() as Map<String, dynamic>;
                  final isOwnOrder = data['userId'] == user.uid;
                  final items = List<Map<String, dynamic>>.from(data['items'] ?? []);
                  final status = data['status'] ?? 'pending';
                  final waiterName = data['waiterName'] ?? '';

                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: !isOwnOrder
                          ? Border.all(color: Colors.blue.shade100)
                          : null,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (!isOwnOrder)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                margin: const EdgeInsets.only(right: 8),
                                decoration: BoxDecoration(
                                  color: Colors.blue.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '🧑‍🍳 $waiterName',
                                  style: TextStyle(fontSize: 11, color: Colors.blue.shade700),
                                ),
                              ),
                            Text(
                              '#${(data['orderNumber'] ?? filtered[index].id.substring(0, 6)).toString().toUpperCase()}',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                            ),
                            const Spacer(),
                            _statusChip(status),
                          ],
                        ),
                        const Divider(height: 14),
                        ...items.map((item) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      '${_formatQty(item)}x ${item['name']}',
                                      style: const TextStyle(fontSize: 14),
                                    ),
                                  ),
                                  Text(
                                    '€${((item['price'] ?? 0) * (item['quantity'] ?? 1)).toStringAsFixed(2)}',
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            )),
                        const SizedBox(height: 6),
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            '€${(data['totalAmount'] ?? 0).toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: Colors.orange.shade700,
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
      },
    );
  }

  String _formatQty(Map<String, dynamic> item) {
    final qty = (item['quantity'] ?? 1).toDouble();
    final unit = item['unit'] ?? 'adet';
    return unit == 'kg' ? qty.toStringAsFixed(1) : '${qty.toInt()}';
  }

  Widget _statusChip(String status) {
    Color color;
    String label;
    switch (status) {
      case 'pending':
        color = Colors.amber;
        label = 'Beklemede';
      case 'accepted':
        color = Colors.blue;
        label = 'Onaylandı';
      case 'preparing':
        color = Colors.orange;
        label = 'Hazırlanıyor';
      case 'ready':
        color = Colors.green;
        label = 'Hazır';
      case 'delivered':
        color = Colors.teal;
        label = 'Teslim';
      case 'cancelled':
        color = Colors.red;
        label = 'İptal';
      default:
        color = Colors.grey;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }

  Widget _circleButton(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.orange.shade50,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 18, color: Colors.orange.shade700),
        ),
      ),
    );
  }

  Widget _productPlaceholder() {
    return Container(
      color: Colors.grey[200],
      child: Icon(Icons.restaurant, color: Colors.grey[400], size: 24),
    );
  }

  Widget _buildCartBar() {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: _isSubmitting ? null : _submitOrder,
          style: FilledButton.styleFrom(
            backgroundColor: Colors.orange.shade700,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.send, size: 20),
              const SizedBox(width: 8),
              Text(
                'Sipariş Ver • $_cartItemCount ürün • €${_cartTotal.toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartItem {
  final ButcherProduct product;
  double quantity;

  _CartItem({required this.product, required this.quantity});
}

enum _CustomerViewState { enterTable, tableActive }
