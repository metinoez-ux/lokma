import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/table_group_session_model.dart';
import '../../models/butcher_product.dart';
import '../../providers/table_group_provider.dart';
import '../../providers/auth_provider.dart';
import '../../data/product_catalog_data.dart';

/// Grup Masa Sipariş Ekranı
/// 3-tab layout: Menü · Benim Siparişim · Masa Toplam
class GroupTableOrderScreen extends ConsumerStatefulWidget {
  final String businessId;
  final String businessName;
  final String tableNumber;
  final String? sessionId; // Optional — used for auto-resume

  const GroupTableOrderScreen({
    super.key,
    required this.businessId,
    required this.businessName,
    required this.tableNumber,
    this.sessionId,
  });

  @override
  ConsumerState<GroupTableOrderScreen> createState() => _GroupTableOrderScreenState();
}

class _GroupTableOrderScreenState extends ConsumerState<GroupTableOrderScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  String _selectedCategory = 'Tümü';
  String _menuSearchQuery = '';
  bool _isSubmitting = false;
  bool _hasShownClosedPrompt = false;

  // LOKMA brand accent
  static const Color _accent = Color(0xFFFF8000);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _autoResumeIfNeeded();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// Auto-resume session when screen opens with a sessionId but provider has no participant set
  Future<void> _autoResumeIfNeeded() async {
    final sessionId = widget.sessionId;
    if (sessionId == null) return;

    final groupState = ref.read(tableGroupProvider);
    if (groupState.myParticipantId != null) return; // already set

    debugPrint('🔄 Auto-resuming session $sessionId...');
    final notifier = ref.read(tableGroupProvider.notifier);
    final success = await notifier.resumeSession(sessionId);
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Oturum yenilenemedi. Lütfen tekrar katılın.'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  /// Show account creation prompt for anonymous/guest users after successful payment
  void _showAccountCreationPrompt() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 40),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: Colors.grey.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Success icon
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Colors.green.withOpacity(0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.check_circle_rounded, color: Colors.green, size: 40),
            ),
            const SizedBox(height: 16),
            Text(
              'Ödeme Tamamlandı! 🎉',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Hesap oluşturarak sipariş geçmişinizi kaydedin ve bir sonraki siparişinizde kolayca erişin!',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 14,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  // Navigate to profile/auth screen
                  Navigator.of(context).popUntil((route) => route.isFirst);
                },
                icon: const Icon(Icons.person_add_rounded),
                label: const Text(
                  'Hesap Oluştur',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFF8000), // LOKMA brand orange
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                child: Text(
                  'Geç',
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontWeight: FontWeight.w600,
                  ),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
    final groupState = ref.watch(tableGroupProvider);
    final session = groupState.session;

    // Handle cancelled/null session — pop screen with message
    if (session != null && session.status == GroupSessionStatus.cancelled) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(tableGroupProvider.notifier).clearSession();
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.cancel, color: Colors.white, size: 20),
                SizedBox(width: 8),
                Text('Grup siparişi iptal edildi'),
              ],
            ),
            backgroundColor: Colors.red.shade600,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // Handle closed session — show success + account creation prompt for guests
    if (session != null && session.status == GroupSessionStatus.closed && !_hasShownClosedPrompt) {
      _hasShownClosedPrompt = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final authState = ref.read(authProvider);
        final isAnonymous = authState.user?.isAnonymous ?? true;
        
        if (isAnonymous) {
          _showAccountCreationPrompt();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Expanded(child: Text('Ödeme tamamlandı! Sipariş geçmişinize kaydedildi.')),
                ],
              ),
              backgroundColor: Colors.green.shade600,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              duration: const Duration(seconds: 4),
            ),
          );
        }
      });
    }

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                widget.businessName,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
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
                  Icon(Icons.table_restaurant, size: 14, color: _accent),
                  const SizedBox(width: 4),
                  Text(
                    'Masa ${widget.tableNumber}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: _accent,
                    ),
                  ),
                  if (session != null) ...[
                    const SizedBox(width: 6),
                    Icon(Icons.people, size: 12, color: _accent),
                    const SizedBox(width: 2),
                    Text(
                      '${session.participantCount}',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _accent),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        backgroundColor: scaffoldBg,
        surfaceTintColor: scaffoldBg,
        centerTitle: true,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              if (value == 'cancel') _showCancelGroupDialog();
              if (value == 'leave') _showLeaveGroupDialog();
            },
            itemBuilder: (context) => [
              if (groupState.isHost)
                const PopupMenuItem(
                  value: 'cancel',
                  child: Row(
                    children: [
                      Icon(Icons.cancel, color: Colors.red, size: 20),
                      SizedBox(width: 8),
                      Text('Grubu İptal Et', style: TextStyle(color: Colors.red)),
                    ],
                  ),
                )
              else
                const PopupMenuItem(
                  value: 'leave',
                  child: Row(
                    children: [
                      Icon(Icons.exit_to_app, color: Colors.orange, size: 20),
                      SizedBox(width: 8),
                      Text('Gruptan Ayrıl', style: TextStyle(color: Colors.orange)),
                    ],
                  ),
                ),
            ],
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: _accent,
          unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
          indicatorColor: _accent,
          indicatorSize: TabBarIndicatorSize.label,
          tabs: [
            const Tab(icon: Icon(Icons.restaurant_menu, size: 20), text: 'Menü'),
            Tab(
              icon: Badge(
                isLabelVisible: (groupState.myParticipant?.totalItemCount ?? 0) > 0,
                label: Text('${groupState.myParticipant?.totalItemCount ?? 0}'),
                child: const Icon(Icons.person, size: 20),
              ),
              text: 'Ben',
            ),
            Tab(
              icon: Badge(
                isLabelVisible: (session?.totalItemCount ?? 0) > 0,
                label: Text('${session?.totalItemCount ?? 0}'),
                child: const Icon(Icons.groups, size: 20),
              ),
              text: 'Masa',
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Remaining balance banner
          if (session != null && session.grandTotal > 0)
            _buildBalanceBanner(session, isDark),

          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildMenuTab(isDark),
                _buildMyOrderTab(isDark, groupState),
                _buildTableTotalTab(isDark, groupState),
              ],
            ),
          ),

          // Bottom action bar (inline, no system navbar)
          if (_buildBottomBar(groupState, isDark) case final bottomBar?)
            bottomBar,
        ],
      ),
    );
  }

  // ─── Balance Banner ────────────────────────────────────────────
  Widget _buildBalanceBanner(TableGroupSession session, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_accent.withOpacity(0.15), _accent.withOpacity(0.05)],
        ),
        border: Border(bottom: BorderSide(color: _accent.withOpacity(0.2))),
      ),
      child: Row(
        children: [
          Icon(Icons.receipt_long, size: 18, color: _accent),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? Colors.white : Colors.black87,
                ),
                children: [
                  TextSpan(
                    text: 'Toplam: €${session.grandTotal.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (session.paidTotal > 0) ...[
                    const TextSpan(text: '  ·  '),
                    TextSpan(
                      text: 'Ödenen: €${session.paidTotal.toStringAsFixed(2)}',
                      style: TextStyle(color: Colors.green.shade700),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: session.remainingBalance > 0 ? _accent : Colors.green,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Kalan: €${session.remainingBalance.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── TAB 1: MENÜ ──────────────────────────────────────────────
  Widget _buildMenuTab(bool isDark) {
    return Column(
      children: [
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
          .doc(widget.businessId)
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
                selectedColor: _accent.withOpacity(0.2),
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
          .doc(widget.businessId)
          .collection('products')
          .where('isActive', isEqualTo: true)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: _accent));
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
                butcherId: widget.businessId, masterData: masterMap);
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
    final groupNotifier = ref.read(tableGroupProvider.notifier);
    final groupState = ref.watch(tableGroupProvider);
    final myItems = groupState.myParticipant?.items ?? [];
    final existingItem = myItems.cast<TableGroupItem?>().firstWhere(
      (i) => i?.productId == product.id,
      orElse: () => null,
    );
    final inCart = existingItem != null;
    final cartQty = existingItem?.quantity ?? 0;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: inCart
            ? Border.all(color: _accent.withOpacity(0.5), width: 1.5)
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
                    color: _accent,
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
                _circleButton(Icons.remove, () {
                  HapticFeedback.lightImpact();
                  final newQty = cartQty - (product.unitType == 'kg' ? product.stepQuantity.toInt() : 1);
                  if (newQty <= 0) {
                    groupNotifier.removeItem(product.id);
                  } else {
                    groupNotifier.updateItemQuantity(product.id, newQty);
                  }
                }),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    product.unitType == 'kg'
                        ? cartQty.toDouble().toStringAsFixed(1)
                        : '$cartQty',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
                _circleButton(Icons.add, () {
                  HapticFeedback.lightImpact();
                  final increment = product.unitType == 'kg' ? product.stepQuantity.toInt() : 1;
                  groupNotifier.updateItemQuantity(product.id, cartQty + increment);
                }),
              ],
            )
          else
            FilledButton.icon(
              onPressed: () {
                HapticFeedback.lightImpact();
                groupNotifier.addItem(TableGroupItem(
                  productId: product.id,
                  productName: product.name,
                  quantity: product.unitType == 'kg' ? product.minQuantity.toInt() : 1,
                  unitPrice: product.price,
                  totalPrice: product.price * (product.unitType == 'kg' ? product.minQuantity : 1),
                  imageUrl: product.imageUrl,
                ));
              },
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Ekle'),
              style: FilledButton.styleFrom(
                backgroundColor: _accent,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                minimumSize: Size.zero,
                textStyle: const TextStyle(fontSize: 13),
              ),
            ),
        ],
      ),
    );
  }

  // ─── TAB 2: BENİM SİPARİŞİM ──────────────────────────────────
  Widget _buildMyOrderTab(bool isDark, TableGroupState groupState) {
    final myParticipant = groupState.myParticipant;
    final items = myParticipant?.items ?? [];

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shopping_cart_outlined, size: 64, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              'Henüz ürün eklemediniz',
              style: TextStyle(fontSize: 16, color: Colors.grey[500]),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => _tabController.animateTo(0),
              child: Text('Menüye git →', style: TextStyle(color: _accent)),
            ),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // My items
        ...items.map((item) => _buildMyItemCard(item, isDark)),

        const SizedBox(height: 16),
        const Divider(),
        const SizedBox(height: 8),

        // My subtotal
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Benim Toplamım',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            Text(
              '€${myParticipant!.subtotal.toStringAsFixed(2)}',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: _accent,
              ),
            ),
          ],
        ),

        // Payment status
        if (myParticipant.isPaid) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.green.shade300),
            ),
            child: Row(
              children: [
                Icon(Icons.check_circle, color: Colors.green.shade700),
                const SizedBox(width: 8),
                Text(
                  'Ödeme tamamlandı ✓',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: Colors.green.shade700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildMyItemCard(TableGroupItem item, bool isDark) {
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final groupNotifier = ref.read(tableGroupProvider.notifier);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          // Image
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 48,
              height: 48,
              child: item.imageUrl != null && item.imageUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: item.imageUrl!,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _productPlaceholder(),
                    )
                  : _productPlaceholder(),
            ),
          ),
          const SizedBox(width: 12),

          // Name + price
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '€${item.unitPrice.toStringAsFixed(2)} × ${item.quantity}',
                  style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                ),
              ],
            ),
          ),

          // Total + controls
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '€${item.totalPrice.toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _miniCircleButton(Icons.remove, () {
                    HapticFeedback.lightImpact();
                    if (item.quantity <= 1) {
                      groupNotifier.removeItem(item.productId);
                    } else {
                      groupNotifier.updateItemQuantity(item.productId, item.quantity - 1);
                    }
                  }),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Text('${item.quantity}',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  _miniCircleButton(Icons.add, () {
                    HapticFeedback.lightImpact();
                    groupNotifier.updateItemQuantity(item.productId, item.quantity + 1);
                  }),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── TAB 3: MASA TOPLAM ───────────────────────────────────────
  Widget _buildTableTotalTab(bool isDark, TableGroupState groupState) {
    final session = groupState.session;
    if (session == null) {
      return const Center(child: CircularProgressIndicator(color: _accent));
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Readiness progress bar
        if (session.isActive) _buildReadinessBar(session, isDark),
        if (session.isActive) const SizedBox(height: 16),

        // Aggregated items summary
        _buildAggregatedItems(session, isDark),

        const SizedBox(height: 20),

        // Per-person breakdown
        Text(
          'Kişi Bazlı',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 8),

        ...session.participants.map((p) => _buildParticipantCard(p, isDark, groupState)),

        const SizedBox(height: 20),

        // Grand total
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_accent.withOpacity(0.15), _accent.withOpacity(0.05)],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _accent.withOpacity(0.3)),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Masa Toplam',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  Text(
                    '€${session.grandTotal.toStringAsFixed(2)}',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: _accent,
                    ),
                  ),
                ],
              ),
              if (session.paidTotal > 0) ...[
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Ödenen', style: TextStyle(color: Colors.green.shade700)),
                    Text(
                      '-€${session.paidTotal.toStringAsFixed(2)}',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Colors.green.shade700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Kalan Hesap',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                    Text(
                      '€${session.remainingBalance.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        color: _accent,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// Readiness progress bar for Masa tab
  Widget _buildReadinessBar(TableGroupSession session, bool isDark) {
    final total = session.participantCount;
    final ready = session.readyCount;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: session.allReady
              ? [Colors.green.withOpacity(0.15), Colors.green.withOpacity(0.05)]
              : [Colors.amber.withOpacity(0.12), Colors.amber.withOpacity(0.04)],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: session.allReady
              ? Colors.green.withOpacity(0.4)
              : Colors.amber.withOpacity(0.3),
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                session.allReady ? 'Herkes hazır! 🎉' : 'Masa Sipariş Durumu',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: session.allReady ? Colors.green.shade700 : (isDark ? Colors.white : Colors.black87),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: session.allReady
                      ? Colors.green.withOpacity(0.2)
                      : Colors.amber.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$ready/$total hazır',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: session.allReady ? Colors.green.shade700 : Colors.amber.shade700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Segmented bar
          Row(
            children: List.generate(total, (i) {
              final isReady = i < ready;
              return Expanded(
                child: Container(
                  height: 6,
                  margin: EdgeInsets.only(right: i < total - 1 ? 3 : 0),
                  decoration: BoxDecoration(
                    color: isReady ? Colors.green : (isDark ? Colors.grey.shade700 : Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildAggregatedItems(TableGroupSession session, bool isDark) {
    final aggregated = session.aggregatedItems;
    if (aggregated.isEmpty) {
      return Center(
        child: Text('Henüz sipariş yok', style: TextStyle(color: Colors.grey[500])),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Toplam Ürünler',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          ...aggregated.entries.map((entry) {
            final data = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: _accent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '${data['quantity']}×',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: _accent,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      data['productName'],
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ),
                  Text(
                    '€${(data['totalPrice'] as double).toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildParticipantCard(
    TableGroupParticipant participant,
    bool isDark,
    TableGroupState groupState,
  ) {
    final isMe = participant.participantId == groupState.myParticipantId;
    final canKick = groupState.isHost && !participant.isHost && !isMe;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: isMe ? Border.all(color: _accent.withOpacity(0.4), width: 1.5) : null,
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        leading: CircleAvatar(
          radius: 18,
          backgroundColor: participant.isHost ? _accent : Colors.grey.shade300,
          child: Text(
            participant.name.isNotEmpty ? participant.name[0].toUpperCase() : '?',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: participant.isHost ? Colors.white : Colors.black87,
            ),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                isMe ? '${participant.name} (Ben)' : participant.name,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: isMe ? _accent : null,
                ),
              ),
            ),
            // Ready + Payment badges
            if (participant.isReady)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                margin: const EdgeInsets.only(right: 4),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '✅ Hazır',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.green.shade700,
                  ),
                ),
              ),
            if (!participant.isReady && !participant.isPaid)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                margin: const EdgeInsets.only(right: 4),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '⏳ Seçiyor',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.amber.shade700,
                  ),
                ),
              ),
            if (participant.isPaid)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '💳 Ödendi',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.green.shade700,
                  ),
                ),
              ),
            // Host kick button
            if (canKick) ...[
              const SizedBox(width: 4),
              InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => _showKickParticipantDialog(participant),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.person_remove, size: 16, color: Colors.red),
                ),
              ),
            ],
          ],
        ),
        subtitle: Text(
          '${participant.totalItemCount} ürün · €${participant.subtotal.toStringAsFixed(2)}',
          style: TextStyle(fontSize: 12, color: Colors.grey[500]),
        ),
        children: participant.items.map((item) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Text('${item.quantity}×',
                    style: TextStyle(fontSize: 12, color: _accent, fontWeight: FontWeight.w700)),
                const SizedBox(width: 8),
                Expanded(child: Text(item.productName, style: const TextStyle(fontSize: 13))),
                Text('€${item.totalPrice.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // ─── BOTTOM BAR ────────────────────────────────────────────────
  Widget? _buildBottomBar(TableGroupState groupState, bool isDark) {
    final session = groupState.session;
    if (session == null) return null;

    final isHost = groupState.isHost;
    final myItems = groupState.myParticipant?.items ?? [];
    final hasItems = session.totalItemCount > 0;

    // Different actions per session state
    if (session.status == GroupSessionStatus.active) {
      if (!hasItems) return null;

      final myParticipant = groupState.myParticipant;
      final amIReady = myParticipant?.isReady ?? false;

      return Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, -2))],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Readiness summary row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      session.allReady ? Icons.check_circle : Icons.hourglass_top,
                      size: 16,
                      color: session.allReady ? Colors.green : Colors.amber.shade700,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${session.readyCount}/${session.participantCount} hazır',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: session.allReady ? Colors.green.shade700 : Colors.amber.shade700,
                      ),
                    ),
                  ],
                ),
                Text(
                  '€${session.grandTotal.toStringAsFixed(2)}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Ready toggle button (everyone)
            if (!amIReady)
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _isSubmitting ? null : () => _showReadyToggle(),
              icon: const Icon(Icons.check_circle_outline),
              label: Text(
                'Siparişim Hazır (${myItems.length} ürün)',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: _accent,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),

            // Undo ready button + info for non-host
            if (amIReady && !isHost) ...[
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isSubmitting ? null : () => _showReadyToggle(),
                  icon: const Icon(Icons.undo),
                  label: const Text(
                    'Siparişimi Değiştir',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                    side: BorderSide(color: isDark ? Colors.grey.shade600 : Colors.grey.shade400),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey.shade800.withValues(alpha: 0.7) : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, size: 16, color: isDark ? Colors.grey.shade400 : Colors.grey.shade600),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        session.allReady
                            ? '${session.hostName} siparişi mutfağa yolluyor...'
                            : 'Siparişi mutfağa sadece grup admini (${session.hostName}) yollayabilir.',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Host: submit to kitchen (only when all ready)
            if (isHost && session.allReady) ...[
              if (amIReady) const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _isSubmitting ? null : () async {
                    setState(() => _isSubmitting = true);
                    final groupNotifier = ref.read(tableGroupProvider.notifier);
                    final ok = await groupNotifier.submitToKitchen();
                    if (!ok) {
                      if (mounted) {
                        setState(() => _isSubmitting = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: const Text('Tüm katılımcılar henüz hazır değil'),
                            backgroundColor: Colors.red.shade700,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        );
                      }
                      return;
                    }
                    if (mounted) setState(() => _isSubmitting = false);
                    await _submitGroupOrder();
                  },
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.restaurant),
                  label: const Text(
                    '🍳 Siparişi Mutfağa Yolla',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],

            // Host: undo ready
            if (isHost && amIReady && !session.allReady)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isSubmitting ? null : () => _showReadyToggle(),
                  icon: const Icon(Icons.undo),
                  label: const Text(
                    'Siparişimi Değiştir',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                    side: BorderSide(color: isDark ? Colors.grey.shade600 : Colors.grey.shade400),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
          ],
        ),
      );
    }

    // Ordering/paying state — show payment options
    if (session.status == GroupSessionStatus.ordering || session.status == GroupSessionStatus.paying) {
      if (session.allPaid) return null;

      return Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, -2))],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [


            // Pay my share
            if (!(groupState.myParticipant?.isPaid ?? true))
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => _showPaymentOptions(context, groupState),
                  icon: const Icon(Icons.payment),
                  label: Text(
                    'Hesabımı Öde (€${groupState.myParticipant!.subtotal.toStringAsFixed(2)})',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: _accent,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),

            // Pay for all remaining
            if (session.remainingBalance > 0 && session.unpaidCount > 1) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _showPayAllConfirmation(context, session),
                  icon: const Icon(Icons.groups),
                  label: Text(
                    'Kalan Hepsini Öde (€${session.remainingBalance.toStringAsFixed(2)})',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _accent,
                    side: BorderSide(color: _accent),
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

    return null;
  }

  // ─── ACTIONS ───────────────────────────────────────────────────
  Future<void> _submitGroupOrder() async {
    setState(() => _isSubmitting = true);

    try {
      final groupNotifier = ref.read(tableGroupProvider.notifier);
      final orderIds = await groupNotifier.submitOrder();

      if (mounted) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 8),
                Text('${orderIds.length} sipariş mutfağa gönderildi! 🎉'),
              ],
            ),
            backgroundColor: Colors.green.shade700,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        _tabController.animateTo(2); // Go to table total
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _showReadyToggle() async {
    HapticFeedback.mediumImpact();
    final groupNotifier = ref.read(tableGroupProvider.notifier);
    final wasReady = ref.read(tableGroupProvider).myParticipant?.isReady ?? false;

    await groupNotifier.toggleReady();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            wasReady
                ? 'Siparişiniz tekrar düzenleniyor ⏳'
                : 'Siparişiniz hazır olarak işaretlendi ✅',
          ),
          backgroundColor: wasReady ? Colors.amber.shade700 : Colors.green.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  void _showPaymentOptions(BuildContext context, TableGroupState groupState) {
    final groupNotifier = ref.read(tableGroupProvider.notifier);
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Ödeme Yöntemi',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.money),
                title: const Text('Nakit'),
                subtitle: Text('€${groupState.myParticipant!.subtotal.toStringAsFixed(2)}'),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                tileColor: Colors.grey.withOpacity(0.05),
                onTap: () {
                  Navigator.pop(ctx);
                  groupNotifier.markMyPayment('cash');
                  HapticFeedback.heavyImpact();
                },
              ),
              const SizedBox(height: 8),
              ListTile(
                leading: const Icon(Icons.credit_card),
                title: const Text('Kart'),
                subtitle: Text('€${groupState.myParticipant!.subtotal.toStringAsFixed(2)}'),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                tileColor: Colors.grey.withOpacity(0.05),
                onTap: () {
                  Navigator.pop(ctx);
                  groupNotifier.markMyPayment('card');
                  HapticFeedback.heavyImpact();
                },
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }

  void _showPayAllConfirmation(BuildContext context, TableGroupSession session) {
    final groupNotifier = ref.read(tableGroupProvider.notifier);
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Tüm Hesabı Öde'),
          content: Text(
            'Kalan €${session.remainingBalance.toStringAsFixed(2)} tutarı '
            '(${session.unpaidCount} kişi) ödemek istediğinize emin misiniz?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('İptal'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(ctx);
                groupNotifier.payForAll('cash');
                HapticFeedback.heavyImpact();
              },
              style: FilledButton.styleFrom(backgroundColor: _accent),
              child: const Text('Nakit Öde'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(ctx);
                groupNotifier.payForAll('card');
                HapticFeedback.heavyImpact();
              },
              style: FilledButton.styleFrom(backgroundColor: _accent),
              child: const Text('Kart Öde'),
            ),
          ],
        );
      },
    );
  }
  // ─── CANCEL / LEAVE ────────────────────────────────────────────
  void _showCancelGroupDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Grubu İptal Et'),
        content: const Text(
          'Grup siparişini iptal etmek istediğinize emin misiniz?\n\nTüm katılımcılar gruptan çıkarılacak.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(tableGroupProvider.notifier).cancelSession();
              if (mounted) {
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Row(
                      children: [
                        Icon(Icons.check_circle, color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text('Grup siparişi iptal edildi'),
                      ],
                    ),
                    backgroundColor: Colors.red.shade600,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                );
              }
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('İptal Et'),
          ),
        ],
      ),
    );
  }

  void _showLeaveGroupDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Gruptan Ayrıl'),
        content: const Text(
          'Grup siparişinden ayrılmak istediğinize emin misiniz?\n\nEklediğiniz ürünler kaldırılacak.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(tableGroupProvider.notifier).leaveSession();
              if (mounted) {
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Row(
                      children: [
                        Icon(Icons.exit_to_app, color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text('Gruptan ayrıldınız'),
                      ],
                    ),
                    backgroundColor: Colors.orange.shade600,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                );
              }
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.orange),
            child: const Text('Ayrıl'),
          ),
        ],
      ),
    );
  }

  void _showKickParticipantDialog(TableGroupParticipant participant) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Katılımcıyı Çıkar'),
        content: Text(
          '"${participant.name}" adlı katılımcıyı gruptan çıkarmak istiyor musunuz?\n\nEklediği ürünler kaldırılacak.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(tableGroupProvider.notifier).kickParticipant(
                participant.participantId,
              );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Row(
                      children: [
                        const Icon(Icons.person_remove, color: Colors.white, size: 20),
                        const SizedBox(width: 8),
                        Text('${participant.name} gruptan çıkarıldı'),
                      ],
                    ),
                    backgroundColor: Colors.red.shade600,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                );
              }
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Çıkar'),
          ),
        ],
      ),
    );
  }

  // ─── HELPERS ───────────────────────────────────────────────────
  Widget _circleButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _accent.withOpacity(0.1),
        ),
        child: Icon(icon, size: 18, color: _accent),
      ),
    );
  }

  Widget _miniCircleButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _accent.withOpacity(0.1),
        ),
        child: Icon(icon, size: 14, color: _accent),
      ),
    );
  }

  Widget _productPlaceholder() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      color: isDark ? Colors.grey[800] : Colors.grey[200],
      child: Icon(Icons.restaurant, color: isDark ? Colors.grey[600] : Colors.grey[400], size: 24),
    );
  }
}
