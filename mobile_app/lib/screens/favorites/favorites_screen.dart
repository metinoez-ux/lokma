import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/product_favorites_provider.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';

class FavoritesScreen extends ConsumerStatefulWidget {
  const FavoritesScreen({super.key});

  @override
  ConsumerState<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends ConsumerState<FavoritesScreen> with SingleTickerProviderStateMixin {
  // LOKMA Design Tokens - Brand color stays constant
  static const Color lokmaRed = Color(0xFFEC131E);

  late TabController _tabController;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) {
        // Tab controller animasyonu sırasında index güncelle
      } else {
         // Swipe ile geçiş tamamlandığında
         if (_selectedIndex != _tabController.index) {
           setState(() {
             _selectedIndex = _tabController.index;
           });
         }
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final businessFavorites = ref.watch(butcherFavoritesProvider);
    final productFavorites = ref.watch(productFavoritesProvider);
    
    // Theme-aware colors
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final backgroundColor = Theme.of(context).scaffoldBackgroundColor;
    final textPrimary = isDark ? Colors.white : Colors.black87;

    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        backgroundColor: backgroundColor,
        elevation: 0,
        centerTitle: true,
        title: Text(
          'Favorilerim',
          style: TextStyle(
            color: textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: Column(
        children: [
          // 3D Pill Slider Custom TabBar
          ThreeDimensionalPillTabBar(
            selectedIndex: _selectedIndex,
            tabs: const [
              TabItem(title: 'İşletmeler', icon: Icons.store),
              TabItem(title: 'Ürünler', icon: Icons.shopping_bag),
              TabItem(title: 'Siparişlerim', icon: Icons.receipt_long),
            ],
            onTabSelected: (index) {
              setState(() => _selectedIndex = index);
              _tabController.animateTo(index);
            },
          ),
          
          // Tab Content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              physics: const BouncingScrollPhysics(), 
              children: [
                // Tab 1: Business Favorites
                _buildBusinessFavorites(businessFavorites, isDark),
                // Tab 2: Product Favorites
                _buildProductFavorites(productFavorites, isDark),
                // Tab 3: Orders (New)
                _buildOrderHistory(isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- TAB 3: ORDERS ---
  Widget _buildOrderHistory(bool isDark) {
    return _buildEmptyState(
      icon: Icons.receipt_long_rounded,
      title: 'Henüz Sipariş Yok',
      subtitle: 'Verdiğiniz siparişler burada listelenecek.',
      isDark: isDark,
    );
  }

  Widget _buildBusinessFavorites(List<String> favoriteIds, bool isDark) {
    final surfaceCard = isDark ? const Color(0xFF181818) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSubtle = isDark ? const Color(0xFF888888) : Colors.grey[600]!;
    final borderSubtle = isDark ? const Color(0xFF262626) : Colors.grey[200]!;

    if (favoriteIds.isEmpty) {
      return _buildEmptyState(
        icon: Icons.store_outlined,
        title: 'Favori İşletme Yok',
        subtitle: 'Beğendiğiniz işletmeleri kalp ile favorilere ekleyin!',
        isDark: isDark,
      );
    }

    return FutureBuilder<List<DocumentSnapshot>>(
      future: _fetchBusinessDocs(favoriteIds),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: lokmaRed));
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return _buildEmptyState(
            icon: Icons.store_outlined,
            title: 'İşletme Bulunamadı',
            subtitle: 'Favori işletmeleriniz yüklenemedi.',
            isDark: isDark,
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: snapshot.data!.length,
          itemBuilder: (context, index) {
            final doc = snapshot.data![index];
            final data = doc.data() as Map<String, dynamic>;
            return _buildBusinessCard(doc.id, data, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
          },
        );
      },
    );
  }

  Future<List<DocumentSnapshot>> _fetchBusinessDocs(List<String> ids) async {
    if (ids.isEmpty) return [];
    
    final List<DocumentSnapshot> results = [];
    for (String id in ids) {
      final doc = await FirebaseFirestore.instance.collection('businesses').doc(id).get();
      if (doc.exists) results.add(doc);
    }
    return results;
  }

  Widget _buildBusinessCard(String id, Map<String, dynamic> data, Color surfaceCard, Color textPrimary, Color textSubtle, Color borderSubtle, bool isDark) {
    final name = data['companyName'] ?? data['name'] ?? 'İşletme';
    final imageUrl = data['imageUrl'] as String?;
    final address = data['address'] as Map<String, dynamic>?;
    final city = address?['city'] ?? '';

    return GestureDetector(
      onTap: () => context.push('/kasap/$id'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: surfaceCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderSubtle),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 60,
                height: 60,
                child: imageUrl != null && imageUrl.isNotEmpty
                    ? CachedNetworkImage(imageUrl: imageUrl, fit: BoxFit.cover)
                    : Container(
                        color: isDark ? Colors.grey[800] : Colors.grey[200],
                        child: Icon(Icons.store, color: isDark ? Colors.white24 : Colors.grey[400]),
                      ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: TextStyle(color: textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (city.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: lokmaRed, size: 14),
                        const SizedBox(width: 4),
                        Text(city, style: TextStyle(color: textSubtle, fontSize: 12)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.favorite, color: lokmaRed),
              onPressed: () => ref.read(butcherFavoritesProvider.notifier).toggleFavorite(id),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductFavorites(List<String> favoriteSkus, bool isDark) {
    final surfaceCard = isDark ? const Color(0xFF181818) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSubtle = isDark ? const Color(0xFF888888) : Colors.grey[600]!;
    final borderSubtle = isDark ? const Color(0xFF262626) : Colors.grey[200]!;

    if (favoriteSkus.isEmpty) {
      return _buildEmptyState(
        icon: Icons.shopping_bag_outlined,
        title: 'Favori Ürün Yok',
        subtitle: 'Beğendiğiniz ürünleri kalp ile favorilere ekleyin!',
        isDark: isDark,
      );
    }

    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _fetchProductsBySku(favoriteSkus),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: lokmaRed));
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return _buildEmptyState(
            icon: Icons.shopping_bag_outlined,
            title: 'Ürün Bulunamadı',
            subtitle: 'Favori ürünleriniz yüklenemedi.',
            isDark: isDark,
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: snapshot.data!.length,
          itemBuilder: (context, index) {
            final product = snapshot.data![index];
            return _buildProductCard(product, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
          },
        );
      },
    );
  }

  Future<List<Map<String, dynamic>>> _fetchProductsBySku(List<String> skus) async {
    if (skus.isEmpty) return [];
    
    final List<Map<String, dynamic>> results = [];
    
    try {
      for (String sku in skus) {
        final querySnapshot = await FirebaseFirestore.instance
            .collectionGroup('products')
            .where('sku', isEqualTo: sku)
            .limit(1)
            .get();
        
        for (var doc in querySnapshot.docs) {
          final data = doc.data();
          final butcherId = doc.reference.parent.parent?.id ?? '';
          
          String butcherName = '';
          if (butcherId.isNotEmpty) {
            final butcherDoc = await FirebaseFirestore.instance
                .collection('businesses')
                .doc(butcherId)
                .get();
            if (butcherDoc.exists) {
              butcherName = butcherDoc.data()?['companyName'] ?? butcherDoc.data()?['name'] ?? '';
            }
          }
          
          results.add({
            ...data,
            'butcherId': butcherId,
            'butcherName': butcherName,
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching products by SKU: $e');
    }
    
    return results;
  }

  Widget _buildProductCard(Map<String, dynamic> product, Color surfaceCard, Color textPrimary, Color textSubtle, Color borderSubtle, bool isDark) {
    final name = product['name'] ?? 'Ürün';
    final sku = product['sku'] ?? '';
    final price = (product['price'] ?? 0).toDouble();
    final imageUrl = product['imageUrl'] as String?;
    final butcherName = product['butcherName'] ?? '';
    final butcherId = product['butcherId'] ?? '';

    return GestureDetector(
      onTap: () {
        if (butcherId.isNotEmpty) {
          context.push('/kasap/$butcherId');
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: surfaceCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderSubtle),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 60,
                height: 60,
                child: imageUrl != null && imageUrl.isNotEmpty
                    ? CachedNetworkImage(imageUrl: imageUrl, fit: BoxFit.cover)
                    : Container(
                        color: isDark ? Colors.grey[800] : Colors.grey[200],
                        child: Icon(Icons.shopping_bag, color: isDark ? Colors.white24 : Colors.grey[400]),
                      ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: TextStyle(color: textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '€${price.toStringAsFixed(2)}',
                        style: const TextStyle(color: lokmaRed, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      if (butcherName.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '- $butcherName',
                            style: TextStyle(color: textSubtle, fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.favorite, color: lokmaRed),
              onPressed: () => ref.read(productFavoritesProvider.notifier).toggleFavorite(sku),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState({required IconData icon, required String title, required String subtitle, required bool isDark}) {
    final surfaceCard = isDark ? const Color(0xFF181818) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSubtle = isDark ? const Color(0xFF888888) : Colors.grey[600]!;
    final borderSubtle = isDark ? const Color(0xFF262626) : Colors.grey[200]!;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: surfaceCard,
              borderRadius: BorderRadius.circular(40),
              border: Border.all(color: borderSubtle),
            ),
            child: Icon(icon, color: lokmaRed, size: 40),
          ),
          const SizedBox(height: 24),
          Text(
            title,
            style: TextStyle(
              color: textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: TextStyle(color: textSubtle, fontSize: 14),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
