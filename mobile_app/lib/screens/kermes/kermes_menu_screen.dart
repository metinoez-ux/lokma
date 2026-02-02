import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/models/kermes_group_order_model.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/models/guest_profile_model.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/providers/group_order_provider.dart';
import 'package:lokma_app/widgets/kermes/order_type_dialog.dart';
import 'package:lokma_app/widgets/kermes/group_order_share_sheet.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import 'package:lokma_app/widgets/kermes/payment_method_dialog.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/services/guest_profile_service.dart';
import 'package:lokma_app/screens/kermes/kermes_checkout_sheet.dart';
import 'package:lokma_app/screens/kermes/kermes_product_detail_sheet.dart';

const Color lokmaPink = Color(0xFFBF1E2E);
const Color darkBg = Color(0xFF121212);
const Color cardBg = Color(0xFF1E1E1E);

class KermesMenuScreen extends ConsumerStatefulWidget {
  final KermesEvent event;

  const KermesMenuScreen({super.key, required this.event});

  @override
  ConsumerState<KermesMenuScreen> createState() => _KermesMenuScreenState();
}

class _KermesMenuScreenState extends ConsumerState<KermesMenuScreen> {
  String _selectedCategory = 'Yemekler'; // Varsayılan: Yemekler (Tümü yerine)
  
  // Scroll spy için controller ve keys
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _sectionKeys = {};
  bool _isScrollingToSection = false;
  
  // Chip ScrollController - kategori seçilince chip'i görünür yap
  final ScrollController _chipScrollController = ScrollController();
  final Map<String, GlobalKey> _chipKeys = {};

  @override
  void initState() {
    super.initState();
    // Scroll listener ekle
    _scrollController.addListener(_onScroll);
    // Kategori key'lerini oluştur
    for (final category in _categoriesWithoutAll) {
      _sectionKeys[category] = GlobalKey();
      _chipKeys[category] = GlobalKey();
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _chipScrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_isScrollingToSection) return;
    
    // Referans noktası: ekranın üstünden ~120px aşağısı (app bar + chip bar)
    const double headerOffset = 120.0;
    
    // Tüm kategorilerin pozisyonlarını topla
    final List<MapEntry<String, double>> categoryPositions = [];
    
    for (final entry in _sectionKeys.entries) {
      final key = entry.value;
      final context = key.currentContext;
      if (context != null) {
        final box = context.findRenderObject() as RenderBox?;
        if (box != null && box.hasSize) {
          final position = box.localToGlobal(Offset.zero);
          categoryPositions.add(MapEntry(entry.key, position.dy));
        }
      }
    }
    
    if (categoryPositions.isEmpty) return;
    
    // Kategorileri listedeki sıraya göre sırala (Yemekler, Tatlılar, İçecekler)
    categoryPositions.sort((a, b) {
      final orderA = _categoriesWithoutAll.indexOf(a.key);
      final orderB = _categoriesWithoutAll.indexOf(b.key);
      return orderA.compareTo(orderB);
    });
    
    // Header offset'inin altında en yakın olan kategoriyi bul
    // Bir kategori header'ın üstündeyse (position < headerOffset), o kategori aktif
    String? activeCategory;
    
    for (int i = categoryPositions.length - 1; i >= 0; i--) {
      final entry = categoryPositions[i];
      // Bu kategori ekranın üst kısmında veya geçmişse
      if (entry.value <= headerOffset + 50) {
        activeCategory = entry.key;
        break;
      }
    }
    
    // Hiçbiri bulunamadıysa ilk kategoriyi al
    activeCategory ??= categoryPositions.first.key;
    
    if (activeCategory != _selectedCategory) {
      HapticFeedback.selectionClick(); // Kategori değişince hafif feedback
      setState(() => _selectedCategory = activeCategory!);
      _scrollChipToVisible(activeCategory);
    }
  }

  void _scrollChipToVisible(String category) {
    final chipKey = _chipKeys[category];
    if (chipKey?.currentContext != null) {
      Scrollable.ensureVisible(
        chipKey!.currentContext!,
        alignment: 0.3,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOutCubic,
      );
    }
  }

  void _scrollToCategory(String category) async {
    final key = _sectionKeys[category];
    if (key?.currentContext != null) {
      _isScrollingToSection = true;
      await Scrollable.ensureVisible(
        key!.currentContext!,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOutCubic,
        alignment: 0.0, // Başlığı en üste getir
      );
      // Biraz bekle, sonra listener'ı tekrar aç
      await Future.delayed(const Duration(milliseconds: 150));
      _isScrollingToSection = false;
    }
  }

  // Kategoriler (Firebase'den gelen gerçek kategoriler)
  List<String> get _categoriesWithoutAll {
    // Menüdeki tüm benzersiz kategorileri topla
    final uniqueCategories = <String>{};
    for (final item in widget.event.menu) {
      final category = _getCategoryForItem(item);
      if (category.isNotEmpty) {
        uniqueCategories.add(category);
      }
    }
    // Sıralama: Ana Yemek > Çorba > Tatlı > İçecek > diğerleri
    final sortOrder = ['Ana Yemek', 'Çorba', 'Tatlı', 'İçecek', 'Aperatif', 'Grill', 'Diğer'];
    final sorted = uniqueCategories.toList();
    sorted.sort((a, b) {
      final indexA = sortOrder.indexOf(a);
      final indexB = sortOrder.indexOf(b);
      // Listede olmayanlar sona
      final orderA = indexA == -1 ? 999 : indexA;
      final orderB = indexB == -1 ? 999 : indexB;
      return orderA.compareTo(orderB);
    });
    return sorted;
  }

  List<String> get _categories {
    return _categoriesWithoutAll;
  }

  // Item için kategori belirle - Firebase'den gelen category alanını kullan
  String _getCategoryForItem(KermesMenuItem item) {
    // Firebase'den gelen category varsa onu kullan
    if (item.category != null && item.category!.isNotEmpty) {
      return item.category!;
    }
    // Fallback: ürün ismine göre tahmin (legacy data için)
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

  // Kategoriye göre gruplandırılmış menü
  Map<String, List<KermesMenuItem>> get _groupedMenu {
    final grouped = <String, List<KermesMenuItem>>{};
    for (final category in _categoriesWithoutAll) {
      grouped[category] = [];
    }
    for (final item in widget.event.menu) {
      final category = _getCategoryForItem(item);
      grouped[category]?.add(item);
    }
    // Boş kategorileri kaldır
    grouped.removeWhere((key, value) => value.isEmpty);
    return grouped;
  }

  // Provider'dan toplam item sayısı
  int get _totalItems {
    final cartState = ref.read(kermesCartProvider);
    return cartState.totalItems;
  }

  // Provider'dan toplam fiyat
  double get _totalPrice {
    final cartState = ref.read(kermesCartProvider);
    return cartState.totalAmount;
  }

  // Provider'a ürün ekle
  void _addToCart(KermesMenuItem item) {
    HapticFeedback.lightImpact();
    
    // Farklı bir kermes'ten ekleme yapılıyor mu kontrol et
    final cartNotifier = ref.read(kermesCartProvider.notifier);
    final added = cartNotifier.addToCart(
      item,
      widget.event.id,
      widget.event.city,
    );
    
    // Eğer ekleme başarısız olduysa (farklı kermes), uyarı göster
    if (!added) {
      _showDifferentKermesWarning(item);
    }
  }

  // Farklı kermes uyarı dialog'u
  void _showDifferentKermesWarning(KermesMenuItem item) {
    final currentKermesName = ref.read(kermesCartProvider.notifier).currentKermesName;
    
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Farklı Kermes Siparişi',
                style: TextStyle(
                  color: Colors.black87,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sepetinizde "$currentKermesName" kermesinden ürünler var.',
              style: const TextStyle(color: Colors.black87, fontSize: 15),
            ),
            const SizedBox(height: 12),
            Text(
              '${widget.event.city} kermesinden ürün eklemek için mevcut sepetiniz temizlenecek.',
              style: const TextStyle(color: Colors.black54, fontSize: 14),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text(
              'İptal',
              style: TextStyle(color: Colors.grey, fontSize: 15),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              // Sepeti temizle ve yeni ürünü ekle
              ref.read(kermesCartProvider.notifier).clearAndAddFromNewKermes(
                item,
                widget.event.id,
                widget.event.city,
              );
              // Bilgilendirme
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Sepet ${widget.event.city} için güncellendi'),
                  backgroundColor: Colors.green,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: lokmaPink,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('Sepeti Değiştir'),
          ),
        ],
      ),
    );
  }

  // Provider'dan ürün çıkar
  void _removeFromCart(KermesMenuItem item) {
    HapticFeedback.lightImpact();
    ref.read(kermesCartProvider.notifier).removeFromCart(item.name);
  }

  // Ürünün sepetteki miktarını al
  int _getCartQuantity(KermesMenuItem item) {
    return ref.read(kermesCartProvider.notifier).getQuantity(item.name);
  }

  // Kategori başlıkları + item'lar birleşik liste
  List<Widget> _buildMenuListItems() {
    final items = <Widget>[];
    final grouped = _groupedMenu;
    
    for (final category in _categoriesWithoutAll) {
      if (!grouped.containsKey(category)) continue;
      final categoryItems = grouped[category]!;
      if (categoryItems.isEmpty) continue;
      
      // Kategori başlığı
      items.add(
        Container(
          key: _sectionKeys[category],
          padding: const EdgeInsets.only(top: 16, bottom: 12),
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
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: lokmaPink.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${categoryItems.length}',
                  style: const TextStyle(
                    color: lokmaPink,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
      
      // Bu kategorideki item'lar
      for (final item in categoryItems) {
        final cartQuantity = _getCartQuantity(item);
        items.add(_buildMenuItem(item, cartQuantity));
      }
    }
    
    // Alt boşluk
    items.add(const SizedBox(height: 80));
    
    return items;
  }

  @override
  Widget build(BuildContext context) {
    // Cart state'i watch et - değiştiğinde widget rebuild olur
    final cartState = ref.watch(kermesCartProvider);
    
    return Scaffold(
      backgroundColor: darkBg,
      appBar: AppBar(
        backgroundColor: darkBg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'MENÜ',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.2,
              ),
            ),
            Text(
              widget.event.city,
              style: TextStyle(
                color: Colors.grey[500],
                fontSize: 12,
                fontWeight: FontWeight.normal,
              ),
            ),
          ],
        ),
        actions: [
          // Sepet icon with badge
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_bag_outlined, color: Colors.white),
                onPressed: _totalItems > 0 ? () => context.go('/cart') : null,
              ),
              if (_totalItems > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: lokmaPink,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 18,
                      minHeight: 18,
                    ),
                    child: Text(
                      _totalItems.toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Category Pills - scroll spy ile senkronize
          Container(
            height: 60,
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: ListView.builder(
              controller: _chipScrollController,
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categories.length,
              itemBuilder: (context, index) {
                final category = _categories[index];
                final isSelected = category == _selectedCategory;
                return GestureDetector(
                  key: _chipKeys[category],
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _selectedCategory = category);
                    _scrollToCategory(category);
                  },
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? const LinearGradient(
                              colors: [lokmaPink, Color(0xFFD32F2F)],
                            )
                          : null,
                      color: isSelected ? null : cardBg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? lokmaPink : Colors.grey[800]!,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        category,
                        style: TextStyle(
                          color: isSelected ? Colors.white : Colors.grey[400],
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          
          // Menu Items - Gruplandırılmış liste (kategorilere göre bölüm başlıkları)
          Expanded(
            child: _groupedMenu.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.restaurant_menu, size: 64, color: Colors.grey[700]),
                        const SizedBox(height: 16),
                        Text(
                          'Menüde ürün bulunmuyor',
                          style: TextStyle(color: Colors.grey[500], fontSize: 16),
                        ),
                      ],
                    ),
                  )
                : Builder(
                    builder: (context) {
                      final menuListItems = _buildMenuListItems();
                      return ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: menuListItems.length,
                        itemBuilder: (context, index) {
                          return menuListItems[index];
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
      // Sticky Cart Footer
      bottomNavigationBar: _totalItems > 0
          ? Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [lokmaPink.withOpacity(0.9), const Color(0xFFD32F2F)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: lokmaPink.withOpacity(0.3),
                    blurRadius: 12,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      // Total info
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '$_totalItems ürün',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Text(
                              '${_totalPrice.toStringAsFixed(2)} €',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Checkout button
                      ElevatedButton(
                        onPressed: _showCartSummary,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: lokmaPink,
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 4,
                        ),
                        child: const Row(
                          children: [
                            Text(
                              'Sepeti Görüntüle',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            SizedBox(width: 8),
                            Icon(Icons.arrow_forward, size: 18),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildMenuItem(KermesMenuItem item, int cartQuantity) {
    final hasImage = item.imageUrl != null && item.imageUrl!.isNotEmpty;
    final isSoldOut = !item.isAvailable;  // Tükendi durumu
    
    return GestureDetector(
      onTap: isSoldOut
          ? null  // Tükendi ürünler tıklanamaz
          : () {
              // Ürün detay sheet'ini aç
              showKermesProductDetailSheet(
                context,
                item: item,
                cartQuantity: cartQuantity,
                onAdd: () => _addToCart(item),
                onRemove: () => _removeFromCart(item),
              );
            },
      child: Opacity(
        opacity: isSoldOut ? 0.5 : 1.0,  // Tükendi ürünler soluk
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: isSoldOut ? cardBg.withOpacity(0.6) : cardBg,
            borderRadius: BorderRadius.circular(16),
            border: isSoldOut
                ? Border.all(color: Colors.red.withOpacity(0.3), width: 1)
                : (cartQuantity > 0
                    ? Border.all(color: lokmaPink.withOpacity(0.5), width: 2)
                    : null),
            boxShadow: cartQuantity > 0 && !isSoldOut
                ? [
                    BoxShadow(
                      color: lokmaPink.withOpacity(0.2),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Ürün Resmi veya Icon
              Hero(
                tag: 'product_image_${item.name}',
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: !hasImage
                        ? LinearGradient(
                            colors: [lokmaPink.withOpacity(0.3), lokmaPink.withOpacity(0.1)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: hasImage
                        ? [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.2),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: hasImage
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.network(
                            item.imageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Icon(
                              _getIconForItem(item.name),
                              color: lokmaPink,
                              size: 28,
                            ),
                          ),
                        )
                      : Icon(
                          _getIconForItem(item.name),
                          color: lokmaPink,
                          size: 28,
                        ),
                ),
              ),
              const SizedBox(width: 14),
              // Item Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.name,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ),
                        // Detay var göstergesi
                        if (item.hasDetailInfo || hasImage)
                          Icon(
                            Icons.info_outline,
                            color: Colors.grey[600],
                            size: 16,
                          ),
                      ],
                    ),
                    if (item.description != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        item.description!,
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 13,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text(
                          '${item.price.toStringAsFixed(2)} €',
                          style: const TextStyle(
                            color: Colors.greenAccent,
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        // Alerjen uyarısı (varsa)
                        if (item.allergens.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.orange.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.warning_amber, size: 12, color: Colors.orange[300]),
                                const SizedBox(width: 2),
                                Text(
                                  '${item.allergens.length}',
                                  style: TextStyle(color: Colors.orange[300], fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Add/Remove Controls veya Tükendi Etiketi
              if (isSoldOut)
                // Tükendi Etiketi
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.withOpacity(0.4)),
                  ),
                  child: const Text(
                    'Tükendi',
                    style: TextStyle(
                      color: Colors.red,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                )
              else if (cartQuantity == 0)
                // Add Button
                GestureDetector(
                  onTap: () {
                    // Tıklamayı burada dur, üst GestureDetector'a gitmesin
                  },
                  child: GestureDetector(
                    onTap: () => _addToCart(item),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [lokmaPink, Color(0xFFD32F2F)],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: lokmaPink.withOpacity(0.4),
                            blurRadius: 6,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.add,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ),
                )
              else
                // Quantity Controls
                Container(
                  decoration: BoxDecoration(
                    color: lokmaPink.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: lokmaPink.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      // Minus
                      GestureDetector(
                        onTap: () => _removeFromCart(item),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: const BoxDecoration(
                            color: lokmaPink,
                            borderRadius: BorderRadius.only(
                              topLeft: Radius.circular(10),
                              bottomLeft: Radius.circular(10),
                            ),
                          ),
                          child: const Icon(Icons.remove, color: Colors.white, size: 18),
                        ),
                      ),
                      // Quantity
                      Container(
                        width: 36,
                        alignment: Alignment.center,
                        child: Text(
                          cartQuantity.toString(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      // Plus
                      GestureDetector(
                        onTap: () => _addToCart(item),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: const BoxDecoration(
                            color: lokmaPink,
                            borderRadius: BorderRadius.only(
                              topRight: Radius.circular(10),
                              bottomRight: Radius.circular(10),
                            ),
                          ),
                          child: const Icon(Icons.add, color: Colors.white, size: 18),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
      ),  // Opacity kapatma
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

  /// Yeni unified checkout sheet'i aç - tüm sipariş akışı tek bir ekranda
  void _showCartSummary() {
    showKermesCheckoutSheet(context, widget.event);
  }

  /// Sipariş türü seçim dialog'unu göster (Bireysel / Ailecek)
  void _showOrderTypeSelection() {
    showDialog(
      context: context,
      builder: (context) => OrderTypeSelectionDialog(
        kermesId: widget.event.id,
        kermesName: widget.event.title,
        onIndividualOrder: _completeIndividualOrder,
        onGroupOrder: _showCreateGroupOrderDialog,
      ),
    );
  }

  /// Bireysel sipariş - teslimat türü seçimi göster
  void _completeIndividualOrder() {
    showDialog(
      context: context,
      builder: (context) => DeliveryTypeSelectionDialog(
        kermesName: widget.event.city,
        isGroupOrder: false,
        onSelected: (deliveryType) {
          _processIndividualOrder(deliveryType);
        },
      ),
    );
  }

  /// Bireysel siparişi teslimat türüne göre işle
  void _processIndividualOrder(DeliveryType deliveryType) {
    switch (deliveryType) {
      case DeliveryType.gelAl:
        _showContactInfoDialog(deliveryType, requiresTable: false);
        break;
      case DeliveryType.masada:
        _showContactInfoDialog(deliveryType, requiresTable: true);
        break;
      case DeliveryType.kurye:
        // TODO: Kurye için giriş kontrolü yapılacak
        _showContactInfoDialog(deliveryType, requiresAddress: true);
        break;
    }
  }

  /// İletişim bilgileri dialog'u (geçici - basit versiyon)
  void _showContactInfoDialog(
    DeliveryType deliveryType, {
    bool requiresTable = false,
    bool requiresAddress = false,
  }) {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final tableController = TextEditingController();
    
    String dialogTitle;
    String submitButtonText;
    
    switch (deliveryType) {
      case DeliveryType.gelAl:
        dialogTitle = 'Gel Al - Bilgileriniz';
        submitButtonText = 'Siparişi Onayla';
        break;
      case DeliveryType.masada:
        dialogTitle = 'Masada Ye - Bilgileriniz';
        submitButtonText = 'Masaya Gönder';
        break;
      case DeliveryType.kurye:
        dialogTitle = 'Kurye Teslimatı - Bilgileriniz';
        submitButtonText = 'Teslimat Onayla';
        break;
    }
    
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          dialogTitle,
          style: const TextStyle(
            color: Colors.black87,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // İsim
              TextField(
                controller: nameController,
                decoration: InputDecoration(
                  labelText: 'Adınız',
                  labelStyle: const TextStyle(color: Colors.black54),
                  prefixIcon: const Icon(Icons.person_outline, color: Colors.grey),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                ),
                style: const TextStyle(color: Colors.black87),
              ),
              const SizedBox(height: 16),
              
              // Telefon
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Telefon',
                  labelStyle: const TextStyle(color: Colors.black54),
                  prefixIcon: const Icon(Icons.phone_outlined, color: Colors.grey),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                ),
                style: const TextStyle(color: Colors.black87),
              ),
              
              // Masa Numarası (Masada için)
              if (requiresTable) ...[
                const SizedBox(height: 16),
                TextField(
                  controller: tableController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Masa Numarası',
                    labelStyle: const TextStyle(color: Colors.black54),
                    prefixIcon: const Icon(Icons.table_restaurant_outlined, color: Colors.grey),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                    fillColor: Colors.grey.shade50,
                  ),
                  style: const TextStyle(color: Colors.black87),
                ),
              ],
              
              // Adres (Kurye için) - TODO: Gelişmiş adres seçici
              if (requiresAddress) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.orange.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.orange.shade700, size: 20),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Kurye teslimatı için adres seçimi yakında eklenecek.',
                          style: TextStyle(color: Colors.black54, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('İptal', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              // Ödeme yöntemi seçimi göster
              _showPaymentMethodDialog(
                deliveryType: deliveryType,
                name: nameController.text,
                phone: phoneController.text,
                tableNumber: tableController.text.isNotEmpty ? tableController.text : null,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: lokmaPink,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: Text(submitButtonText),
          ),
        ],
      ),
    );
  }

  /// Ödeme yöntemi seçim dialog'u
  void _showPaymentMethodDialog({
    required DeliveryType deliveryType,
    required String name,
    required String phone,
    String? tableNumber,
  }) {
    final totalAmount = ref.read(kermesCartProvider).totalAmount;
    
    showDialog(
      context: context,
      builder: (context) => PaymentMethodDialog(
        totalAmount: totalAmount,
        kermesName: widget.event.city,
        onSelected: (paymentMethod) {
          _finalizeOrder(
            deliveryType: deliveryType,
            name: name,
            phone: phone,
            tableNumber: tableNumber,
            paymentMethod: paymentMethod,
          );
        },
      ),
    );
  }

  /// Siparişi tamamla ve onay göster
  Future<void> _finalizeOrder({
    required DeliveryType deliveryType,
    required String name,
    required String phone,
    String? tableNumber,
    required PaymentMethodType paymentMethod,
  }) async {
    final cartState = ref.read(kermesCartProvider);
    final totalAmount = cartState.totalAmount;
    
    // Sipariş öğelerini oluştur
    final orderItems = cartState.items.map((item) => KermesOrderItem(
      name: item.menuItem.name,
      quantity: item.quantity,
      price: item.menuItem.price,
    )).toList();
    
    // Guest profil servisi - profil bul veya oluştur
    final guestProfileService = ref.read(guestProfileServiceProvider);
    GuestProfile? guestProfile;
    
    try {
      guestProfile = await guestProfileService.findOrCreateProfile(
        name: name,
        phone: phone,
      );
    } catch (e) {
      // Profil oluşturma hatası - siparişe devam et ama profil bağlama
      debugPrint('Guest profil oluşturulamadı: $e');
    }
    
    // Sipariş servisi
    final orderService = ref.read(kermesOrderServiceProvider);
    
    // Sıralı sipariş numarası oluştur (kermes bazlı)
    String orderNumber;
    try {
      orderNumber = await orderService.generateSequentialOrderId(widget.event.id);
    } catch (e) {
      debugPrint('Sıralı ID oluşturulamadı, fallback kullanılıyor: $e');
      orderNumber = orderService.generateFallbackOrderId();
    }
    
    // Benzersiz Firestore doc ID oluştur
    final docId = '${widget.event.id}_$orderNumber';
    
    // Sipariş oluştur
    final order = KermesOrder(
      id: docId,
      orderNumber: orderNumber,
      kermesId: widget.event.id,
      kermesName: widget.event.city,
      userId: guestProfile?.id, // Guest profil ID'si
      customerName: name,
      customerPhone: phone,
      deliveryType: deliveryType,
      tableNumber: tableNumber,
      address: null, // TODO: Kurye için adres eklenecek
      items: orderItems,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      isPaid: paymentMethod == PaymentMethodType.card, // Kart ödemesi yapıldıysa ödendi
      status: KermesOrderStatus.pending,
      createdAt: DateTime.now(),
    );
    
    try {
      // Firestore'a kaydet
      await orderService.createOrder(order);
      
      // Guest profil sipariş sayısını artır
      if (guestProfile != null) {
        await guestProfileService.incrementOrderCount(guestProfile.id);
      }
      
      // Sepeti temizle
      ref.read(kermesCartProvider.notifier).clearCart();
      
      // Onay göster
      if (mounted) {
        _showOrderConfirmationDialog(order);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sipariş oluşturulamadı: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Sipariş onay dialog'u
  void _showOrderConfirmationDialog(KermesOrder order) {
    String deliveryLabel;
    switch (order.deliveryType) {
      case DeliveryType.gelAl:
        deliveryLabel = 'Gel Al';
        break;
      case DeliveryType.masada:
        deliveryLabel = 'Masa ${order.tableNumber ?? "-"}';
        break;
      case DeliveryType.kurye:
        deliveryLabel = 'Kurye Teslimatı';
        break;
    }
    
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 28),
            SizedBox(width: 12),
            Text(
              'Sipariş Alındı!',
              style: TextStyle(color: Colors.white, fontSize: 20),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Siparişiniz ${order.kermesName} Kermesi\'ne iletildi.',
              style: const TextStyle(color: Colors.white70, fontSize: 15),
            ),
            const SizedBox(height: 8),
            // Teslimat ve Ödeme bilgisi
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: lokmaPink.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    deliveryLabel,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    order.paymentMethodLabel,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Sipariş ID
            Text(
              'Sipariş No: ${order.id}',
              style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: lokmaPink.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: lokmaPink.withOpacity(0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Toplam:',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '${order.totalAmount.toStringAsFixed(2)} €',
                    style: const TextStyle(
                      color: Colors.greenAccent,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text(
              'Tamam',
              style: TextStyle(color: lokmaPink, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  /// Grup siparişi oluşturma dialog'unu göster
  void _showCreateGroupOrderDialog() {
    showDialog(
      context: context,
      builder: (context) => CreateGroupOrderDialog(
        kermesId: widget.event.id,
        kermesName: widget.event.title,
        onCreate: (hostName, expirationMinutes) async {
          // Sepetteki ürünleri GroupOrderItem listesine dönüştür
          final cartState = ref.read(kermesCartProvider);
          final cartItems = cartState.items.map((item) => GroupOrderItem(
            menuItemName: item.menuItem.name,
            quantity: item.quantity,
            price: item.menuItem.price,
          )).toList();

          // Grup siparişi oluştur
          final groupOrderNotifier = ref.read(groupOrderProvider.notifier);
          final orderId = await groupOrderNotifier.createGroupOrder(
            kermesId: widget.event.id,
            kermesName: widget.event.title,
            hostName: hostName,
            expirationMinutes: expirationMinutes,
            initialItems: cartItems,
          );

          if (orderId != null && mounted) {
            // Paylaşım sheet'ini göster
            showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (context) => GroupOrderShareSheet(
                orderId: orderId,
                kermesName: widget.event.title,
                hostName: hostName,
                expirationMinutes: expirationMinutes,
                expiresAt: DateTime.now().add(Duration(minutes: expirationMinutes)),
              ),
            );
          }
        },
      ),
    );
  }
}
