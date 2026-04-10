import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/widgets/kermes/payment_method_dialog.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import 'package:lokma_app/widgets/kermes/kermes_staff_status_fab.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'kermes_checkout_sheet.dart';
import 'kermes_customization_sheet.dart';
import 'kermes_product_detail_sheet.dart';
import '../../utils/currency_utils.dart';
import 'package:lokma_app/providers/kermes_category_provider.dart';
/// Kermes POS Ekrani - Garson/Kasiyer icin hizli siparis alma
/// Tablet-optimized grid layout ile urun secimi, sepet yonetimi, masa atama
class KermesPOSScreen extends ConsumerStatefulWidget {
  final KermesEvent event;
  final String? staffId;
  final String? staffName;
  final List<String> allowedSections; // Personelin izinli oldugu masa bolumleri

  const KermesPOSScreen({
    super.key,
    required this.event,
    this.staffId,
    this.staffName,
    this.allowedSections = const [],
  });

  @override
  ConsumerState<KermesPOSScreen> createState() => _KermesPOSScreenState();
}

class _KermesPOSScreenState extends ConsumerState<KermesPOSScreen> {

  // Kategori scroll-spy
  String _selectedCategory = 'Tumu';
  bool _isUserScrolling = true;
  final ScrollController _scrollController = ScrollController();
  final ScrollController _chipScrollController = ScrollController();
  final Map<String, GlobalKey> _sectionKeys = {};
  final Map<String, GlobalKey> _tabKeys = {};

  // Sliding pill
  double _pillLeft = 0;
  double _pillWidth = 60;
  bool _pillInitialized = false;
  final GlobalKey _chipRowKey = GlobalKey();

  // Masa ve teslimat
  final _tableController = TextEditingController();
  String? _selectedTableSection;
  DeliveryType _deliveryType = DeliveryType.gelAl;
  PaymentMethodType _paymentMethod = PaymentMethodType.cash;

  // POS opsiyonel musteri ismi (Starbucks stili)
  final _posCustomerController = TextEditingController();

  // States
  bool _isSubmitting = false;
  bool _showActiveOrders = false;
  bool _isStantMode = false;

  // Renkler
  static const Color lokmaPink = Color(0xFFEA184A);
  static const Color successGreen = Color(0xFF2E7D32);

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition('Tumu');
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _chipScrollController.dispose();
    _tableController.dispose();
    _posCustomerController.dispose();
    super.dispose();
  }

  /// GDPR uyumlu isim kisaltmasi: "Metin Oz" -> "M. O."
  String _abbreviateName(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return fullName;
    if (parts.length == 1) return parts.first;
    return parts.map((p) => p.isNotEmpty ? '${p[0].toUpperCase()}.' : '').join(' ');
  }

  void _onScroll() {
    if (!_isUserScrolling) return;

    if (_scrollController.hasClients && _scrollController.offset < 10) {
      if (_selectedCategory != 'Tumu') {
        setState(() => _selectedCategory = 'Tumu');
        _scrollChipTo('Tumu');
        Future.delayed(const Duration(milliseconds: 50), () {
          if (mounted) _updatePillPosition('Tumu');
        });
      }
      return;
    }

    String? visible;
    for (final entry in _sectionKeys.entries) {
      final ctx = entry.value.currentContext;
      if (ctx == null) continue;
      final box = ctx.findRenderObject() as RenderBox?;
      if (box == null) continue;
      final pos = box.localToGlobal(Offset.zero, ancestor: context.findRenderObject());
      if (pos.dy > 100 && pos.dy < 350) {
        visible = entry.key;
        break;
      }
    }

    if (visible != null && visible != _selectedCategory) {
      setState(() => _selectedCategory = visible!);
      _scrollChipTo(visible!);
      Future.delayed(const Duration(milliseconds: 50), () {
        if (mounted) _updatePillPosition(visible!);
      });
    }
  }

  void _scrollChipTo(String category) {
    final key = _tabKeys[category];
    if (key?.currentContext == null || !_chipScrollController.hasClients) return;
    final box = key!.currentContext!.findRenderObject() as RenderBox?;
    if (box == null) return;
    final chipPos = box.localToGlobal(Offset.zero);
    final chipW = box.size.width;
    final vpW = _chipScrollController.position.viewportDimension;
    final delta = chipPos.dx + chipW / 2 - vpW / 2;
    final target = (_chipScrollController.offset + delta)
        .clamp(0.0, _chipScrollController.position.maxScrollExtent);
    _chipScrollController.animateTo(target,
        duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic);
  }

  void _updatePillPosition([String? cat]) {
    final category = cat ?? _selectedCategory;
    final tabKey = _tabKeys[category];
    if (tabKey?.currentContext == null || _chipRowKey.currentContext == null) return;
    final chipBox = tabKey!.currentContext!.findRenderObject() as RenderBox?;
    final rowBox = _chipRowKey.currentContext!.findRenderObject() as RenderBox?;
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
    _scrollChipTo(category);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition(category);
    });

    if (category == 'Tumu') {
      _scrollController.animateTo(0,
          duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    } else {
      final key = _sectionKeys[category];
      if (key?.currentContext != null && _scrollController.hasClients) {
        final box = key!.currentContext!.findRenderObject() as RenderBox?;
        final scrollBox = context.findRenderObject() as RenderBox?;
        if (box != null && scrollBox != null) {
          final pos = box.localToGlobal(Offset.zero, ancestor: scrollBox);
          final target = _scrollController.offset + pos.dy - 110;
          _scrollController.animateTo(
            target.clamp(0.0, _scrollController.position.maxScrollExtent),
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      }
    }

    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) _isUserScrolling = true;
    });
  }

  /// Kategorisiz urunler dahil tum kategoriler
  List<String> get _categoriesWithoutAll {
    final cats = <String>{};
    for (final item in widget.event.menu) {
      if (item.isAvailable) cats.add(item.category ?? 'Diger');
    }
    final categoriesAsync = ref.read(kermesCategoryProvider);
    final sortOrder = categoriesAsync.maybeWhen(
      data: (c) => c.map((e) => e.name).toList(),
      orElse: () => const <String>[],
    );
    final sorted = cats.toList();
    if (sortOrder.isNotEmpty) {
      sorted.sort((a, b) {
        final iA = sortOrder.indexOf(a);
        final iB = sortOrder.indexOf(b);
        return (iA == -1 ? 999 : iA).compareTo(iB == -1 ? 999 : iB);
      });
    }
    return sorted;
  }

  List<String> get _categories => ['Tumu', ..._categoriesWithoutAll];

  Map<String, List<KermesMenuItem>> get _groupedMenu {
    final grouped = <String, List<KermesMenuItem>>{};
    for (final cat in _categoriesWithoutAll) grouped[cat] = [];
    for (final item in widget.event.menu) {
      if (!item.isAvailable) continue;
      final cat = item.category ?? 'Diger';
      grouped[cat] ??= [];
      grouped[cat]!.add(item);
    }
    grouped.removeWhere((_, v) => v.isEmpty);
    return grouped;
  }

  /// Sepetteki urun sayisi
  int get _totalCartItems => ref.read(kermesCartProvider).totalItems;

  /// Sepet toplam tutari
  double get _totalCartAmount => ref.read(kermesCartProvider).totalAmount;

  /// Sepete urun ekle - combo ise customization sheet ac
  void _addToCart(KermesMenuItem menuItem) {
    HapticFeedback.lightImpact();
    if (menuItem.isComboMenu) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        useSafeArea: true,
        builder: (ctx) => KermesCustomizationSheet(
          item: menuItem,
          eventId: widget.event.id,
          eventName: widget.event.city,
        ),
      );
      return;
    }
    ref.read(kermesCartProvider.notifier).addToCart(
      menuItem,
      widget.event.id,
      widget.event.city,
    );
  }

  /// Sepetten urun cikar
  void _removeFromCart(KermesMenuItem menuItem) {
    HapticFeedback.lightImpact();
    ref.read(kermesCartProvider.notifier).removeFromCart(menuItem.name);
  }

  /// Sepetteki urun miktarini al
  int _getCartQuantity(String name) {
    final cart = ref.read(kermesCartProvider);
    return cart.items
        .where((i) => i.menuItem.name == name)
        .fold(0, (sum, i) => sum + i.quantity);
  }

  /// Sepeti temizle
  void _clearCart() {
    ref.read(kermesCartProvider.notifier).clearCart();
  }

  /// Siparis olustur
  Future<void> _submitOrder() async {
    final cartState = ref.read(kermesCartProvider);
    if (cartState.isEmpty) return;

    // Masa numarasi kontrolu
    if (_deliveryType == DeliveryType.masada &&
        _tableController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Masa numarasi giriniz'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final orderService = ref.read(kermesOrderServiceProvider);

      // Sequential siparis numarasi al
      String orderNumber;
      try {
        orderNumber =
            await orderService.generateSequentialOrderId(widget.event.id, tableSection: _selectedTableSection);
      } catch (e) {
        orderNumber = orderService.generateFallbackOrderId();
      }

      final orderId = '${widget.event.id}_$orderNumber';

      // Cart itemlari KermesOrderItem'a donustur
      final orderItems = cartState.items.map((ci) {
        String itemName = ci.menuItem.name;
        if (ci.selectedOptions.isNotEmpty) {
          final optionsStr = ci.selectedOptions.map((o) => o.optionName).join(', ');
          itemName = '$itemName ($optionsStr)';
        }
        return KermesOrderItem(
          name: itemName,
          quantity: ci.quantity,
          price: ci.totalPrice, // Use totalPrice inside order
          prepZones: ci.menuItem.prepZones,
          category: ci.menuItem.category,
          imageUrl: ci.menuItem.imageUrl,
          itemStatus: KermesItemStatus.pending,
        );
      }).toList();

      // Stant modunda aninda teslim: siparis ready+delivered olarak kaydedilir
      final isInstant = _isStantMode;
      final orderSource = _isStantMode ? 'pos_stant' : 'pos_garson';

      final order = KermesOrder(
        id: orderId,
        orderNumber: orderNumber,
        kermesId: widget.event.id,
        kermesName: widget.event.title,
        customerName: _isStantMode
            ? 'Stant Musteri'
            : (_posCustomerController.text.trim().isNotEmpty
                ? _posCustomerController.text.trim()
                : 'POS Siparis'),
        customerPhone: '',
        deliveryType: _isStantMode ? DeliveryType.gelAl : _deliveryType,
        tableNumber: _deliveryType == DeliveryType.masada && !_isStantMode
            ? _tableController.text.trim()
            : null,
        items: isInstant
            ? orderItems.map((i) => KermesOrderItem(
                  name: i.name,
                  quantity: i.quantity,
                  price: i.price,
                  prepZones: i.prepZones,
                  category: i.category,
                  imageUrl: i.imageUrl,
                  itemStatus: KermesItemStatus.ready, // Aninda hazir
                )).toList()
            : orderItems,
        totalAmount: _totalCartAmount,
        paymentMethod: _paymentMethod,
        isPaid: _paymentMethod == PaymentMethodType.cash,
        status: isInstant ? KermesOrderStatus.delivered : KermesOrderStatus.pending,
        createdAt: DateTime.now(),
        completedAt: isInstant ? DateTime.now() : null,
        createdByStaffId: widget.staffId,
        createdByStaffName: widget.staffName,
        tableSection: _selectedTableSection,
        orderSource: orderSource,
        isInstantDelivery: isInstant,
      );

      await orderService.createOrder(order);

      HapticFeedback.heavyImpact();

      if (!mounted) return;

      // Sepeti temizle
      _clearCart();

      // Tezgahtan teslim ise McDonald's usulu numara dialog goster
      // Masada ise sadece snackbar yeterli
      if (_deliveryType == DeliveryType.masada || _isStantMode) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(_deliveryType == DeliveryType.masada
                    ? 'Masa ${_tableController.text} - Siparis #$orderNumber'
                    : 'Stant Siparis #$orderNumber'),
              ],
            ),
            backgroundColor: successGreen,
            duration: const Duration(seconds: 3),
          ),
        );
      } else {
        // Tezgahtan teslim - buyuk numara dialog
        final posName = _posCustomerController.text.trim();
        _showOrderNumberDialog(orderNumber,
            abbreviatedName: posName.isNotEmpty ? _abbreviateName(posName) : null);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Hata: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// McDonald's usulu siparis numarasi dialog (Tezgahtan Teslim)
  void _showOrderNumberDialog(String orderNumber, {String? abbreviatedName}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: successGreen.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded, color: successGreen, size: 44),
              ),
              const SizedBox(height: 20),
              Text(
                'Siparis Alindi!',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Musteriye verilecek numara:',
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24),
                decoration: BoxDecoration(
                  color: lokmaPink.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: lokmaPink.withOpacity(0.3), width: 1.5),
                ),
                child: Column(
                  children: [
                    Text(
                      '#',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w400,
                        color: lokmaPink.withOpacity(0.7),
                      ),
                    ),
                    Text(
                      orderNumber,
                      style: const TextStyle(
                        fontSize: 64,
                        fontWeight: FontWeight.w900,
                        color: lokmaPink,
                        letterSpacing: -2,
                      ),
                    ),
                    // Isim varsa kisaltilmis goster (GDPR uyumlu)
                    if (abbreviatedName != null && abbreviatedName.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        decoration: BoxDecoration(
                          color: lokmaPink.withOpacity(0.06),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          abbreviatedName,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white70 : Colors.black54,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ] else ...[
                      Text(
                        'Tezgahtan Teslim',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: lokmaPink,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Yeni Siparis Al',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(kermesCategoryProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cartState = ref.watch(kermesCartProvider);
    final isTablet = MediaQuery.of(context).size.width >= 600;
    final screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : Colors.white,
      appBar: AppBar(
        backgroundColor: lokmaPink,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Kermes POS - ${widget.event.title}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            Text(widget.staffName ?? 'Kasiyer',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          // Aktif siparisler toggle
          IconButton(
            icon: Icon(
              _showActiveOrders ? Icons.menu : Icons.list_alt,
              color: Colors.white,
            ),
            onPressed: () =>
                setState(() => _showActiveOrders = !_showActiveOrders),
            tooltip:
                _showActiveOrders ? 'Menü' : 'Aktif Siparişler',
          ),
        ],
      ),
      body: _showActiveOrders
          ? _buildActiveOrdersView(isDark)
          : isTablet
              ? _buildTabletLayout(isDark, screenWidth)
              : _buildPhoneLayout(isDark),
    );
  }

  Widget? _buildStaffFAB() {
    final uid = widget.staffId ?? FirebaseAuth.instance.currentUser?.uid;
    if (uid == null || uid.isEmpty) return null;
    return KermesStaffStatusFAB(
      kermesId: widget.event.id,
      staffId: uid,
      staffName: widget.staffName ?? 'Kasiyer',
      role: 'counter',
      sectionId: widget.allowedSections.isNotEmpty
          ? widget.allowedSections.first
          : null,
    );
  }

  /// Tablet layout: Sol taraf menu, sag taraf sepet
  Widget _buildTabletLayout(bool isDark, double screenWidth) {
    return Row(
      children: [
        // Sol: Menu Grid
        Expanded(
          flex: 3,
          child: Column(
            children: [
              _buildCategoryBar(isDark),
              Expanded(child: _buildProductList(isDark)),
            ],
          ),
        ),
        // Sag: Sepet
        Container(
          width: 340,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            border: Border(
              left: BorderSide(
                color: isDark ? Colors.white12 : Colors.grey.shade300,
              ),
            ),
          ),
          child: _buildCartPanel(isDark),
        ),
      ],
    );
  }

  /// Telefon layout: Urunler + altta sepet bar (Floating Pill stili)
  Widget _buildPhoneLayout(bool isDark) {
    final cartState = ref.watch(kermesCartProvider);
    return Stack(
      children: [
        Column(
          children: [
            _buildCategoryBar(isDark),
            Expanded(child: _buildProductList(isDark)),
          ],
        ),
        if (cartState.isNotEmpty)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _buildBottomCartBar(isDark),
          ),
      ],
    );
  }

  /// Kategori chip bari - kullanici tarafiyla ayni sliding pill animasyonu
  Widget _buildCategoryBar(bool isDark) {
    final cats = _categories;
    final scaffoldBg = isDark ? const Color(0xFF121212) : Colors.white;
    final cartState = ref.watch(kermesCartProvider);

    return Container(
      color: scaffoldBg,
      height: 52,
      child: SingleChildScrollView(
        controller: _chipScrollController,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(left: 16, right: 4, top: 4, bottom: 8),
        child: Stack(
          alignment: Alignment.centerLeft,
          children: [
            // 1. Sliding pill
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
                        color: (isDark ? Colors.white : Colors.black).withOpacity(0.12),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
            // 2. Chip texts
            Row(
              key: _chipRowKey,
              children: cats.map((cat) {
                _tabKeys.putIfAbsent(cat, () => GlobalKey());
                final isSelected = cat == _selectedCategory;
                
                // Seçili kategorideki ürün sayısını bul
                final categoryQty = cartState.items.where((e) {
                  if (cat == 'Tumu') return true;
                  return e.menuItem.category == cat;
                }).fold<int>(0, (sum, e) => sum + e.quantity);

                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      _selectCategory(cat);
                    },
                    child: Container(
                      key: _tabKeys[cat],
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
                            child: Text(cat),
                          ),
                          if (categoryQty > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: isSelected && !isDark ? Colors.white : lokmaPink,
                                shape: BoxShape.circle,
                              ),
                              child: Text(
                                '$categoryQty',
                                style: TextStyle(
                                  color: isSelected && !isDark ? Colors.black : Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
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
  }

  /// Gruplu liste - kategori basliklariyla, kullanici menu gibi alt alta
  Widget _buildProductList(bool isDark) {
    final grouped = _groupedMenu;

    if (grouped.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.restaurant_menu, size: 64,
                color: isDark ? Colors.white24 : Colors.grey.shade300),
            const SizedBox(height: 16),
            Text('Menu yuklenemedi',
                style: TextStyle(color: isDark ? Colors.white54 : Colors.grey.shade600, fontSize: 16)),
          ],
        ),
      );
    }

    // Section keys olustur
    for (final cat in grouped.keys) {
      _sectionKeys[cat] ??= GlobalKey();
    }

    final sections = grouped.entries.toList();

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.only(bottom: 120),
      itemCount: sections.length,
      itemBuilder: (context, sectionIndex) {
        final cat = sections[sectionIndex].key;
        final items = sections[sectionIndex].value;
        return Column(
          key: _sectionKeys[cat],
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Kategori basligi - tam genislik, belirgin renk
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 16, bottom: 4),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isDark
                    ? lokmaPink
                    : const Color(0xFFF5F0E8),
              ),
              child: Text(
                cat,
                style: TextStyle(
                  color: isDark ? Colors.white : lokmaPink,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
            ),
            ...items.map((item) => _buildMenuStyleItem(item, isDark)),
          ],
        );
      },
    );
  }

  /// Kullanici tarafindaki _buildMenuItem ile birebir ayni stil
  Widget _buildMenuStyleItem(KermesMenuItem item, bool isDark) {
    final qty = _getCartQuantity(item.name);
    final hasQty = qty > 0;
    final hasImage = item.imageUrl != null && item.imageUrl!.isNotEmpty;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;

    Widget addButton({required double size}) {
      return GestureDetector(
        onTap: () => _addToCart(item),
        child: hasQty
            ? Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white : Colors.black87,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 4, offset: const Offset(0, 2)),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '$qty',
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
                    BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 4, offset: const Offset(0, 2)),
                  ],
                ),
                child: Icon(Icons.add, color: lokmaPink, size: size == 36 ? 20 : 24),
              ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => _addToCart(item),
          onLongPress: () { if (hasQty) _removeFromCart(item); },
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 16, 8, 16),
            color: Colors.transparent,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Sol: isim + fiyat
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.name,
                        style: TextStyle(
                          color: textColor,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                          letterSpacing: -0.2,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (item.description != null && item.description!.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          item.description!,
                          style: TextStyle(color: subtleColor, fontSize: 13, height: 1.3),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 8),
                      Text(
                        '${item.price.toStringAsFixed(2).replaceAll('.', ',')} ${CurrencyUtils.getCurrencySymbol()}',
                        style: TextStyle(
                          color: textColor,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                // Sag: resim + + butonu
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (hasImage)
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: SizedBox(
                              width: 96,
                              height: 96,
                              child: Image.network(
                                item.imageUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  color: isDark ? Colors.white10 : Colors.grey[100],
                                  child: Icon(Icons.restaurant, size: 36,
                                      color: isDark ? Colors.white24 : Colors.grey[400]),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            right: -4,
                            bottom: -4,
                            child: addButton(size: 36),
                          ),
                        ],
                      )
                    else
                      addButton(size: 44),
                  ],
                ),
              ],
            ),
          ),
        ),
        Divider(
          height: 1,
          thickness: 0.5,
          color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.withOpacity(0.2),
        ),
      ],
    );
  }

  /// Sepet paneli (tablet sag panel)
  Widget _buildCartPanel(bool isDark) {
    final cartState = ref.watch(kermesCartProvider);
    return Column(
      children: [
        // Sepet baslik
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                  color: isDark ? Colors.white12 : Colors.grey.shade200),
            ),
          ),
          child: Row(
            children: [
              Icon(Icons.shopping_cart,
                  color: lokmaPink, size: 22),
              const SizedBox(width: 8),
              Text(
                'Sepet ($_totalCartItems)',
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Text(
                '${_totalCartAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                style: TextStyle(
                  color: lokmaPink,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),

        // Sepet itemlari
        Expanded(
          child: cartState.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.shopping_cart_outlined,
                          size: 48,
                          color: isDark ? Colors.white24 : Colors.grey.shade300),
                      const SizedBox(height: 12),
                      Text(
                        'Sepet bos',
                        style: TextStyle(
                          color: isDark ? Colors.white38 : Colors.grey.shade500,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: cartState.items.length,
                  itemBuilder: (context, index) {
                    final item = cartState.items[index];
                    return _buildCartItem(item, isDark);
                  },
                ),
        ),

        // Teslimat ve odeme secenekleri
        _buildOrderOptions(isDark),

        // Siparis ver butonu
        _buildSubmitButton(isDark),
      ],
    );
  }

  /// Tek Cart item satiri
  Widget _buildCartItem(KermesCartItem item, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Miktar kontrolleri
          Container(
            decoration: BoxDecoration(
              color: isDark ? Colors.white10 : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                InkWell(
                  onTap: () => ref.read(kermesCartProvider.notifier).decreaseQuantity(item.uniqueKey),
                  borderRadius: BorderRadius.circular(8),
                  child: const Padding(
                    padding: EdgeInsets.all(6),
                    child: Icon(Icons.remove, size: 18, color: lokmaPink),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    '${item.quantity}',
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                ),
                InkWell(
                  onTap: () => ref.read(kermesCartProvider.notifier).increaseQuantity(item.uniqueKey),
                  borderRadius: BorderRadius.circular(8),
                  child: const Padding(
                    padding: EdgeInsets.all(6),
                    child: Icon(Icons.add, size: 18, color: lokmaPink),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Urun adi ve opsiyonlar
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.menuItem.name,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (item.selectedOptions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      item.selectedOptions.map((o) => o.optionName).join(', '),
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.white54 : Colors.black54,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          ),
          // Fiyat
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Text(
              '${item.totalPrice.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
              style: TextStyle(
                color: isDark ? Colors.white70 : Colors.black54,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Teslimat ve odeme secenekleri
  Widget _buildOrderOptions(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
              color: isDark ? Colors.white12 : Colors.grey.shade200),
        ),
      ),
      child: Column(
        children: [
          // Teslimat / siparis turu
          Row(
            children: [
              _buildOptionChip(
                label: 'Tezgahtan',
                icon: Icons.storefront_outlined,
                isSelected: _deliveryType == DeliveryType.gelAl && !_isStantMode,
                onTap: () => setState(() {
                  _isStantMode = false;
                  _deliveryType = DeliveryType.gelAl;
                  _tableController.clear();
                }),
                isDark: isDark,
              ),
              const SizedBox(width: 8),
              _buildOptionChip(
                label: 'Masada',
                icon: Icons.table_restaurant_outlined,
                isSelected: _deliveryType == DeliveryType.masada && !_isStantMode,
                onTap: () => setState(() {
                  _isStantMode = false;
                  _deliveryType = DeliveryType.masada;
                  if (widget.allowedSections.length == 1) {
                    _selectedTableSection = widget.allowedSections.first;
                  }
                }),
                isDark: isDark,
              ),
              const SizedBox(width: 8),
              _buildOptionChip(
                label: 'Stant Kasa',
                icon: Icons.storefront_outlined,
                isSelected: _isStantMode,
                color: successGreen,
                onTap: () => setState(() {
                  _isStantMode = true;
                  _deliveryType = DeliveryType.gelAl;
                  _tableController.clear();
                }),
                isDark: isDark,
              ),
            ],
          ),
          // Masa numarasi input (saece masada secildiyse)
          if (_deliveryType == DeliveryType.masada) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 40,
              child: TextField(
                controller: _tableController,
                keyboardType: TextInputType.number,
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 14,
                ),
                decoration: InputDecoration(
                  hintText: 'Masa No',
                  hintStyle: TextStyle(
                    color: isDark ? Colors.white38 : Colors.grey,
                    fontSize: 14,
                  ),
                  prefixIcon:
                      const Icon(Icons.tag, size: 18, color: lokmaPink),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                        color: isDark ? Colors.white24 : Colors.grey.shade300),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                        color: isDark ? Colors.white24 : Colors.grey.shade300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: lokmaPink),
                  ),
                ),
              ),
            ),
          ],
          // Masa bolum secimi (allowedSections varsa goster)
          if (_deliveryType == DeliveryType.masada && widget.allowedSections.isNotEmpty) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: widget.allowedSections.map((section) {
                  final isSelected = _selectedTableSection == section;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedTableSection = section),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? lokmaPink : (isDark ? Colors.white10 : Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(18),
                          border: isSelected ? null : Border.all(
                            color: isDark ? Colors.white24 : Colors.grey.shade300,
                          ),
                        ),
                        child: Text(
                          section,
                          style: TextStyle(
                            color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
          const SizedBox(height: 8),
          // Odeme yontemi toggle
          Row(
            children: [
              _buildOptionChip(
                label: 'Nakit',
                icon: Icons.money,
                isSelected: _paymentMethod == PaymentMethodType.cash,
                onTap: () =>
                    setState(() => _paymentMethod = PaymentMethodType.cash),
                isDark: isDark,
                color: successGreen,
              ),
              const SizedBox(width: 8),
              _buildOptionChip(
                label: 'Kart',
                icon: Icons.credit_card,
                isSelected: _paymentMethod == PaymentMethodType.card,
                onTap: () =>
                    setState(() => _paymentMethod = PaymentMethodType.card),
                isDark: isDark,
                color: Colors.blue,
              ),
            ],
          ),
          // Tezgahtan teslim ise opsiyonel musteri ismi (Starbucks stili)
          if (_deliveryType == DeliveryType.gelAl && !_isStantMode) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 44,
              child: TextField(
                controller: _posCustomerController,
                textCapitalization: TextCapitalization.words,
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 14,
                ),
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Musteri adi (opsiyonel)',
                  hintStyle: TextStyle(
                    color: isDark ? Colors.white38 : Colors.grey,
                    fontSize: 13,
                  ),
                  prefixIcon: const Icon(Icons.person_outline, size: 18, color: lokmaPink),
                  suffixIcon: _posCustomerController.text.trim().isNotEmpty
                      ? Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Chip(
                            label: Text(
                              _abbreviateName(_posCustomerController.text.trim()),
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                            ),
                            backgroundColor: lokmaPink.withOpacity(0.1),
                            side: BorderSide(color: lokmaPink.withOpacity(0.3)),
                            padding: EdgeInsets.zero,
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                        )
                      : null,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: isDark ? Colors.white24 : Colors.grey.shade300),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: isDark ? Colors.white24 : Colors.grey.shade300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: lokmaPink),
                  ),
                ),
              ),
            ),
          ],

        ],
      ),
    );
  }

  /// Option chip (teslimat/odeme secimi)
  Widget _buildOptionChip({
    required String label,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
    required bool isDark,
    Color color = lokmaPink,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected
                ? color.withOpacity(isDark ? 0.2 : 0.1)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected
                  ? color
                  : isDark
                      ? Colors.white24
                      : Colors.grey.shade300,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 16,
                  color: isSelected
                      ? color
                      : isDark
                          ? Colors.white54
                          : Colors.grey),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: isSelected
                      ? color
                      : isDark
                          ? Colors.white54
                          : Colors.grey.shade700,
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Siparis ver butonu
  Widget _buildSubmitButton(bool isDark) {
    final cartState = ref.watch(kermesCartProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: SizedBox(
        width: double.infinity,
        height: 54,
        child: ElevatedButton(
          onPressed: cartState.isEmpty || _isSubmitting ? null : _submitOrder,
          style: ElevatedButton.styleFrom(
            backgroundColor: successGreen,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            elevation: 0,
            disabledBackgroundColor:
                isDark ? Colors.white12 : Colors.grey.shade300,
          ),
          child: _isSubmitting
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2.5,
                  ),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_circle, size: 22),
                    const SizedBox(width: 8),
                    Text(
                      'SIPARIS VER - ${_totalCartAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  /// Telefon icin alt sepet bari (Marketplace stili)
  Widget _buildBottomCartBar(bool isDark) {
    final cartState = ref.watch(kermesCartProvider);
    return Container(
      margin: const EdgeInsets.only(left: 16, right: 16, bottom: 20),
      decoration: BoxDecoration(
        color: lokmaPink,
        borderRadius: BorderRadius.circular(100),
        boxShadow: [
          BoxShadow(
            color: lokmaPink.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(100),
          onTap: () => _showPhoneCheckout(isDark),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '${cartState.totalItems}',
                        style: const TextStyle(
                          color: lokmaPink,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
                const Text(
                  'Sepeti Görüntüle',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '${cartState.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Telefon icin checkout bottom sheet
  void _showPhoneCheckout(bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => KermesCheckoutSheet(
        event: widget.event,
        isPosMode: true,
      ),
    );
  }

  /// Aktif siparisler gorunumu
  Widget _buildActiveOrdersView(bool isDark) {
    final orderService = ref.read(kermesOrderServiceProvider);

    return StreamBuilder<List<KermesOrder>>(
      stream: orderService.getPOSActiveOrdersStream(widget.event.id),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final orders = snapshot.data ?? [];

        if (orders.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.receipt_long,
                    size: 64,
                    color: isDark ? Colors.white24 : Colors.grey.shade300),
                const SizedBox(height: 16),
                Text(
                  'Aktif siparis yok',
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.grey.shade600,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: orders.length,
          itemBuilder: (context, index) {
            final order = orders[index];
            return _buildActiveOrderCard(order, isDark);
          },
        );
      },
    );
  }

  /// Aktif siparis karti
  Widget _buildActiveOrderCard(KermesOrder order, bool isDark) {
    // Statu rengi
    Color statusColor;
    String statusText;
    IconData statusIcon;

    if (order.isFullyReady) {
      statusColor = successGreen;
      statusText = 'TUM SIPARIS HAZIR';
      statusIcon = Icons.check_circle;
    } else if (order.status == KermesOrderStatus.preparing) {
      statusColor = Colors.orange;
      statusText = 'Hazirlaniyor (${order.readyItemCount}/${order.totalItemCount})';
      statusIcon = Icons.restaurant;
    } else {
      statusColor = Colors.grey;
      statusText = 'Beklemede';
      statusIcon = Icons.hourglass_empty;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: order.isFullyReady
            ? Border.all(color: successGreen, width: 2)
            : null,
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(isDark ? 0.15 : 0.05),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Icon(statusIcon, color: statusColor, size: 20),
                const SizedBox(width: 8),
                Text(
                  '#${order.orderNumber}',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  order.deliveryTypeLabel,
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.grey.shade600,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          // Items
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: order.items.map((item) {
                final isItemReady = item.isReady;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Icon(
                        isItemReady
                            ? Icons.check_circle
                            : Icons.radio_button_unchecked,
                        size: 18,
                        color: isItemReady ? successGreen : Colors.grey,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${item.quantity}x ${item.name}',
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          decoration: isItemReady
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                      const Spacer(),
                      if (item.prepZones.isNotEmpty)
                        Text(
                          item.prepZones.join(', '),
                          style: TextStyle(
                            color: isDark ? Colors.white38 : Colors.grey,
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
          // Teslim Et butonu (sadece tamami hazir olan siparisler icin)
          if (order.isFullyReady)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    HapticFeedback.heavyImpact();
                    final orderService =
                        ref.read(kermesOrderServiceProvider);
                    await orderService.markAsDelivered(order.id);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                              'Siparis #${order.orderNumber} teslim edildi'),
                          backgroundColor: successGreen,
                        ),
                      );
                    }
                  },
                  icon: const Icon(Icons.check, size: 20),
                  label: const Text('TESLIM ET',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: successGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Kategori bazli renk
  Color _getCategoryColor(String? category) {
    switch (category?.toLowerCase()) {
      case 'ana yemek':
        return const Color(0xFFE65100);
      case 'corba':
      case 'suppe':
        return const Color(0xFF2E7D32);
      case 'tatli':
      case 'dessert':
        return const Color(0xFF8E24AA);
      case 'icecek':
      case 'getranke':
        return const Color(0xFF1565C0);
      case 'aperatif':
      case 'vorspeise':
        return const Color(0xFFF9A825);
      case 'grill':
        return const Color(0xFFD84315);
      default:
        return lokmaPink;
    }
  }
}
