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
import '../../utils/currency_utils.dart';

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
  // Sepet (POS icin ayri, kalici sepetten bagimsiz)
  final List<_POSCartItem> _cart = [];

  // Kategori filtreleme
  String _selectedCategory = 'Tumu';

  // Masa ve teslimat
  final _tableController = TextEditingController();
  String? _selectedTableSection; // Secili masa bolumu
  DeliveryType _deliveryType = DeliveryType.gelAl;
  PaymentMethodType _paymentMethod = PaymentMethodType.cash;

  // Musteri bilgileri (opsiyonel - POS'ta hizli akis icin)
  final _customerNameController = TextEditingController();

  // States
  bool _isSubmitting = false;
  bool _showActiveOrders = false;
  bool _isStantMode = false; // Stant modu: aninda teslim (POS kasa)

  // Renkler
  static const Color lokmaPink = Color(0xFFEA184A);
  static const Color successGreen = Color(0xFF2E7D32);

  @override
  void dispose() {
    _tableController.dispose();
    _customerNameController.dispose();
    super.dispose();
  }

import 'package:lokma_app/providers/kermes_category_provider.dart';

  /// Menu verilerinden tum kategorileri cikart
  List<String> get _categories {
    final cats = <String>{};
    for (final item in widget.event.menu) {
      if (item.category != null && item.category!.isNotEmpty) {
        cats.add(item.category!);
      }
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

    return ['Tumu', ...sorted];
  }

  /// Filtrelenmis menu itemlari
  List<KermesMenuItem> get _filteredItems {
    if (_selectedCategory == 'Tumu') {
      return widget.event.menu.where((i) => i.isAvailable).toList();
    }
    return widget.event.menu
        .where((i) => i.isAvailable && i.category == _selectedCategory)
        .toList();
  }

  /// Sepetteki urun sayisi
  int get _totalCartItems => _cart.fold(0, (s, item) => s + item.quantity);

  /// Sepet toplam tutari
  double get _totalCartAmount =>
      _cart.fold(0.0, (s, item) => s + item.totalPrice);

  /// Sepete urun ekle
  void _addToCart(KermesMenuItem menuItem) {
    HapticFeedback.lightImpact();
    setState(() {
      final existingIndex =
          _cart.indexWhere((item) => item.menuItem.name == menuItem.name);
      if (existingIndex >= 0) {
        _cart[existingIndex] = _cart[existingIndex]
            .copyWith(quantity: _cart[existingIndex].quantity + 1);
      } else {
        _cart.add(_POSCartItem(menuItem: menuItem, quantity: 1));
      }
    });
  }

  /// Sepetten urun cikar
  void _removeFromCart(KermesMenuItem menuItem) {
    HapticFeedback.lightImpact();
    setState(() {
      final existingIndex =
          _cart.indexWhere((item) => item.menuItem.name == menuItem.name);
      if (existingIndex >= 0) {
        if (_cart[existingIndex].quantity <= 1) {
          _cart.removeAt(existingIndex);
        } else {
          _cart[existingIndex] = _cart[existingIndex]
              .copyWith(quantity: _cart[existingIndex].quantity - 1);
        }
      }
    });
  }

  /// Sepetteki urun miktarini al
  int _getCartQuantity(String name) {
    final item = _cart.where((i) => i.menuItem.name == name).firstOrNull;
    return item?.quantity ?? 0;
  }

  /// Sepeti temizle
  void _clearCart() {
    setState(() {
      _cart.clear();
      _tableController.clear();
      _customerNameController.clear();
      if (!_isStantMode) {
        _deliveryType = DeliveryType.gelAl;
      }
      _paymentMethod = PaymentMethodType.cash;
    });
  }

  /// Siparis olustur
  Future<void> _submitOrder() async {
    if (_cart.isEmpty) return;

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

      // Cart itemlari KermesOrderItem'a donustur (prepZone'u otomatik ata)
      final orderItems = _cart.map((ci) {
        return KermesOrderItem(
          name: ci.menuItem.name,
          quantity: ci.quantity,
          price: ci.menuItem.price,
          prepZone: ci.menuItem.prepZone,
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
        customerName: _customerNameController.text.trim().isNotEmpty
            ? _customerNameController.text.trim()
            : (_isStantMode ? 'Stant Musteri' : 'POS Siparis'),
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
                  prepZone: i.prepZone,
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

      // Basari mesaji
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text('Siparis #$orderNumber olusturuldu'),
            ],
          ),
          backgroundColor: successGreen,
          duration: const Duration(seconds: 2),
        ),
      );

      // Sepeti temizle
      _clearCart();
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

  @override
  Widget build(BuildContext context) {
    ref.watch(kermesCategoryProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isTablet = MediaQuery.of(context).size.width > 768;
    final screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: lokmaPink,
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Kermes POS - ${widget.event.title}',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            Text(widget.staffName ?? 'Kasiyer',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          // Stant Modu toggle
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: _isStantMode
                  ? Colors.white.withOpacity(0.2)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: _isStantMode
                  ? Border.all(color: Colors.white54)
                  : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.storefront,
                  color: _isStantMode ? Colors.white : Colors.white54,
                  size: 16,
                ),
                const SizedBox(width: 4),
                Text(
                  'Stant',
                  style: TextStyle(
                    color: _isStantMode ? Colors.white : Colors.white54,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(
                  height: 28,
                  width: 36,
                  child: Switch(
                    value: _isStantMode,
                    onChanged: (val) {
                      HapticFeedback.mediumImpact();
                      setState(() {
                        _isStantMode = val;
                        if (val) {
                          _deliveryType = DeliveryType.gelAl;
                        }
                      });
                    },
                    activeColor: Colors.white,
                    activeTrackColor: successGreen,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          ),
          // Aktif siparisler toggle
          IconButton(
            icon: Icon(
              _showActiveOrders ? Icons.grid_view : Icons.list_alt,
              color: Colors.white,
            ),
            onPressed: () =>
                setState(() => _showActiveOrders = !_showActiveOrders),
            tooltip:
                _showActiveOrders ? 'Menu Gorunumu' : 'Aktif Siparisler',
          ),
          // Sepet temizle
          if (_cart.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep, color: Colors.white),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Sepeti Temizle'),
                    content:
                        const Text('Sepetteki tum urunler silinecek.'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Iptal')),
                      TextButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            _clearCart();
                          },
                          child: const Text('Temizle',
                              style: TextStyle(color: Colors.red))),
                    ],
                  ),
                );
              },
              tooltip: 'Sepeti Temizle',
            ),
        ],
      ),
      floatingActionButton: _buildStaffFAB(),
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
              Expanded(child: _buildProductGrid(isDark, crossAxisCount: 4)),
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

  /// Telefon layout: Urunler + altta sepet bar
  Widget _buildPhoneLayout(bool isDark) {
    return Column(
      children: [
        _buildCategoryBar(isDark),
        Expanded(child: _buildProductGrid(isDark, crossAxisCount: 2)),
        if (_cart.isNotEmpty) _buildBottomCartBar(isDark),
      ],
    );
  }

  /// Kategori filtreleme bari
  Widget _buildCategoryBar(bool isDark) {
    return Container(
      height: 52,
      color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final cat = _categories[index];
          final isSelected = cat == _selectedCategory;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(cat),
              selected: isSelected,
              onSelected: (_) {
                HapticFeedback.selectionClick();
                setState(() => _selectedCategory = cat);
              },
              selectedColor: lokmaPink.withOpacity(0.15),
              checkmarkColor: lokmaPink,
              labelStyle: TextStyle(
                color: isSelected
                    ? lokmaPink
                    : isDark
                        ? Colors.white70
                        : Colors.black87,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                fontSize: 13,
              ),
              side: BorderSide(
                color: isSelected ? lokmaPink : Colors.transparent,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          );
        },
      ),
    );
  }

  /// Urun grid'i - kocaman, renkli butonlar
  Widget _buildProductGrid(bool isDark, {required int crossAxisCount}) {
    final items = _filteredItems;

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.restaurant_menu,
                size: 64,
                color: isDark ? Colors.white24 : Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              'Bu kategoride urun bulunamadi',
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.grey.shade600,
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.1,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) =>
          _buildProductButton(items[index], isDark),
    );
  }

  /// Tek urun butonu (POS stili - kocaman, renkli)
  Widget _buildProductButton(KermesMenuItem item, bool isDark) {
    final qty = _getCartQuantity(item.name);
    final hasQty = qty > 0;

    // Kategori bazli renk
    final categoryColor = _getCategoryColor(item.category);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _addToCart(item),
        onLongPress: () {
          if (hasQty) _removeFromCart(item);
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            color: hasQty
                ? categoryColor.withOpacity(isDark ? 0.25 : 0.12)
                : isDark
                    ? const Color(0xFF1E1E1E)
                    : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: hasQty ? categoryColor : Colors.transparent,
              width: hasQty ? 2.5 : 0,
            ),
            boxShadow: [
              if (!isDark)
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
            ],
          ),
          child: Stack(
            children: [
              // Urun bilgisi
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Urun adi
                    Text(
                      item.name,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    // PrepZone (kucuk tag)
                    if (item.prepZone != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: categoryColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          item.prepZone!,
                          style: TextStyle(
                            color: categoryColor,
                            fontSize: 9,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    const Spacer(),
                    // Fiyat
                    Text(
                      '${item.price.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                      style: TextStyle(
                        color: categoryColor,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              // Miktar badge
              if (hasQty)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: categoryColor,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '$qty',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              // Ekle butonu (sag alt)
              Positioned(
                bottom: 8,
                right: 8,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: categoryColor.withOpacity(isDark ? 0.3 : 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.add,
                    color: categoryColor,
                    size: 22,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Sepet paneli (tablet sag panel)
  Widget _buildCartPanel(bool isDark) {
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
          child: _cart.isEmpty
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
                  itemCount: _cart.length,
                  itemBuilder: (context, index) {
                    final item = _cart[index];
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
  Widget _buildCartItem(_POSCartItem item, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
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
                  onTap: () => _removeFromCart(item.menuItem),
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
                  onTap: () => _addToCart(item.menuItem),
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
          // Urun adi
          Expanded(
            child: Text(
              item.menuItem.name,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          // Fiyat
          Text(
            '${item.totalPrice.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
            style: TextStyle(
              color: isDark ? Colors.white70 : Colors.black54,
              fontSize: 14,
              fontWeight: FontWeight.w600,
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
          // Teslimat turu toggle
          Row(
            children: [
              _buildOptionChip(
                label: 'Gel Al',
                icon: Icons.shopping_bag_outlined,
                isSelected: _deliveryType == DeliveryType.gelAl,
                onTap: () => setState(() {
                  _deliveryType = DeliveryType.gelAl;
                  _tableController.clear();
                }),
                isDark: isDark,
              ),
              const SizedBox(width: 8),
              _buildOptionChip(
                label: 'Masa',
                icon: Icons.table_restaurant_outlined,
                isSelected: _deliveryType == DeliveryType.masada,
                onTap: () => setState(() {
                  _deliveryType = DeliveryType.masada;
                  // Eger sadece 1 izinli bolum varsa otomatik sec
                  if (widget.allowedSections.length == 1) {
                    _selectedTableSection = widget.allowedSections.first;
                  }
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
          // Musteri adi (opsiyonel)
          const SizedBox(height: 8),
          SizedBox(
            height: 40,
            child: TextField(
              controller: _customerNameController,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 14,
              ),
              decoration: InputDecoration(
                hintText: 'Musteri Adi (opsiyonel)',
                hintStyle: TextStyle(
                  color: isDark ? Colors.white38 : Colors.grey,
                  fontSize: 14,
                ),
                prefixIcon:
                    const Icon(Icons.person_outline, size: 18, color: lokmaPink),
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
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _cart.isEmpty || _isSubmitting ? null : _submitOrder,
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
      ),
    );
  }

  /// Telefon icin alt sepet bari
  Widget _buildBottomCartBar(bool isDark) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          border: Border(
            top: BorderSide(
                color: isDark ? Colors.white12 : Colors.grey.shade200),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: Row(
          children: [
            // Sepet ozeti
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: lokmaPink.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.shopping_cart, color: lokmaPink, size: 18),
                  const SizedBox(width: 6),
                  Text(
                    '$_totalCartItems urun',
                    style: const TextStyle(
                      color: lokmaPink,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            // Siparis ver butonu
            SizedBox(
              height: 44,
              child: ElevatedButton(
                onPressed: _isSubmitting
                    ? null
                    : () {
                        // Telefonda full-screen checkout acar
                        _showPhoneCheckout(isDark);
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: successGreen,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  '${_totalCartAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()} - Onayla',
                  style: const TextStyle(
                    fontSize: 14,
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

  /// Telefon icin checkout bottom sheet
  void _showPhoneCheckout(bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(ctx).size.height * 0.7,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: _buildCartPanel(isDark),
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
                      if (item.prepZone != null)
                        Text(
                          item.prepZone!,
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

/// POS sepet ogesi (gecici, kalici degil)
class _POSCartItem {
  final KermesMenuItem menuItem;
  final int quantity;

  _POSCartItem({required this.menuItem, required this.quantity});

  double get totalPrice => menuItem.price * quantity;

  _POSCartItem copyWith({int? quantity}) {
    return _POSCartItem(
      menuItem: menuItem,
      quantity: quantity ?? this.quantity,
    );
  }
}
