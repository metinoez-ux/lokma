import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/product_favorites_provider.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import 'package:lokma_app/screens/orders/rating_screen.dart';
import 'package:lokma_app/models/butcher_product.dart';
import 'package:lokma_app/models/product_option.dart';
import 'package:lokma_app/providers/cart_provider.dart';
import 'package:lokma_app/screens/marketplace/kasap/cart_screen.dart';
import '../../utils/currency_utils.dart';


class FavoritesScreen extends ConsumerStatefulWidget {
  const FavoritesScreen({super.key});

  @override
  ConsumerState<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends ConsumerState<FavoritesScreen> with SingleTickerProviderStateMixin {
  // LOKMA Design Tokens - Brand color stays constant
  static const Color lokmaRed = Color(0xFFFB335B);

  late TabController _tabController;
  int _selectedIndex = 0;
  String _businessFilter = 'all'; // 'all', 'tuna', 'kermes', 'kasap'

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
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Column(
        children: [
          // 3D Pill Slider Custom TabBar
          ThreeDimensionalPillTabBar(
            selectedIndex: _selectedIndex,
            tabs: [
              TabItem(title: tr('common.i_sletmeler'), icon: Icons.store),
              TabItem(title: tr('common.urunler'), icon: Icons.shopping_bag),
              TabItem(title: tr('common.siparislerim'), icon: Icons.receipt_long),
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

  // --- TAB 3: FAVORITE ORDERS ---
  Widget _buildOrderHistory(bool isDark) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return _buildEmptyState(
        icon: Icons.login_rounded,
        title: tr('common.giris_yapin'),
        subtitle: tr('common.siparislerinizi_gormek_icin_gi'),
        isDark: isDark,
      );
    }

    final surfaceCard = isDark ? const Color(0xFF181818) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSubtle = isDark ? const Color(0xFF888888) : Colors.grey[600]!;
    final borderSubtle = isDark ? const Color(0xFF262626) : Colors.grey[200]!;

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('users').doc(user.uid)
          .collection('favoriteOrders')
          .orderBy('createdAt', descending: true)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
        }

        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return _buildEmptyState(
            icon: Icons.bookmark_border_rounded,
            title: tr('common.favori_siparis_yok'),
            subtitle: tr('common.siparislerinizi_bookmark_ile_f'),
            isDark: isDark,
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: snapshot.data!.docs.length,
          itemBuilder: (context, index) {
            final doc = snapshot.data!.docs[index];
            final data = doc.data() as Map<String, dynamic>;
            return _buildFavoriteOrderCard(doc.id, data, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
          },
        );
      },
    );
  }

  Widget _buildFavoriteOrderCard(String orderId, Map<String, dynamic> data, Color surfaceCard, Color textPrimary, Color textSubtle, Color borderSubtle, bool isDark) {
    final favoriteName = data['favoriteName'] ?? '';
    final businessName = data['businessName'] ?? tr('common.i_sletme');
    final businessId = data['businessId'] ?? '';
    final totalAmount = (data['totalAmount'] ?? 0).toDouble();
    final itemCount = data['itemCount'] ?? 0;

    return FutureBuilder<DocumentSnapshot>(
      future: FirebaseFirestore.instance.collection('businesses').doc(businessId).get(),
      builder: (context, businessSnapshot) {
        String? imageUrl;
        bool isTuna = false;
        
        if (businessSnapshot.hasData && businessSnapshot.data != null && businessSnapshot.data!.exists) {
          final businessData = businessSnapshot.data!.data() as Map<String, dynamic>?;
          imageUrl = businessData?['imageUrl'] ?? businessData?['logoUrl'];
          isTuna = businessData?['isTuna'] == true || 
                   businessData?['isTunaPartner'] == true ||
                   businessData?['isTunaApproved'] == true ||
                   businessData?['brand']?.toString().toLowerCase() == 'tuna' ||
                   (businessData?['name']?.toString().toLowerCase().contains('tuna') ?? false) ||
                   (businessData?['companyName']?.toString().toLowerCase().contains('tuna') ?? false);
        }

        return GestureDetector(
          onTap: () {
            if (businessId.isNotEmpty) {
              context.push('/kasap/$businessId');
            }
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: surfaceCard,
              borderRadius: BorderRadius.circular(12),
              border: isDark ? null : Border.all(color: borderSubtle),
              boxShadow: isDark ? null : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Business image with TUNA badge
                  Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: imageUrl != null && imageUrl.isNotEmpty
                            ? Image.network(
                                imageUrl,
                                width: 64,
                                height: 64,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  width: 64,
                                  height: 64,
                                  color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                  child: Icon(Icons.restaurant, color: textSubtle, size: 24),
                                ),
                              )
                            : Container(
                                width: 64,
                                height: 64,
                                color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                child: Icon(Icons.restaurant, color: textSubtle, size: 24),
                              ),
                      ),
                      if (isTuna)
                        Positioned(
                          bottom: 2,
                          left: 2,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFB335B),
                              borderRadius: BorderRadius.circular(3),
                            ),
                            child: const Text(
                              'TUNA',
                              style: TextStyle(color: Colors.white, fontSize: 7, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 12),
                  // Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Favorite name (bold, primary)
                        if (favoriteName.isNotEmpty)
                          Text(
                            favoriteName,
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        if (favoriteName.isNotEmpty) const SizedBox(height: 2),
                        // Business name (subtitle)
                        Text(
                          businessName,
                          style: TextStyle(color: textSubtle, fontSize: 13),
                        ),
                        const SizedBox(height: 4),
                        // Item count + total
                        Text(
                          '$itemCount ${tr('common.urun_kucuk')} - ${CurrencyUtils.getCurrencySymbol()}${totalAmount.toStringAsFixed(2)}',
                          style: TextStyle(color: textSubtle, fontSize: 12),
                        ),
                        const SizedBox(height: 8),
                        // "Siparisi Goruntule" button
                        GestureDetector(
                          onTap: () {
                            if (businessId.isNotEmpty) {
                              context.push('/kasap/$businessId');
                            }
                          },
                          child: Text(
                            tr('common.siparisi_goruntule'),
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Bookmark icon (filled = remove)
                  GestureDetector(
                    onTap: () async {
                      final user = FirebaseAuth.instance.currentUser;
                      if (user == null) return;
                      await FirebaseFirestore.instance
                          .collection('users').doc(user.uid)
                          .collection('favoriteOrders').doc(orderId)
                          .delete();
                    },
                    child: const Icon(
                      Icons.bookmark,
                      color: Color(0xFFFB335B),
                      size: 24,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
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
        title: tr('common.favori_i_sletme_yok'),
        subtitle: tr('common.begendiginiz_isletmeleri_kalp'),
        isDark: isDark,
      );
    }

    return Column(
      children: [
        // Filter chips row
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('all', 'Hepsi', Icons.apps, isDark),
                const SizedBox(width: 8),
                _buildFilterChip('tuna', 'Tuna Isletmeleri', Icons.verified, isDark),
                const SizedBox(width: 8),
                _buildFilterChip('kermes', 'Kermesler', Icons.festival, isDark),
              ],
            ),
          ),
        ),
        // Business list
        Expanded(
          child: FutureBuilder<List<DocumentSnapshot>>(
            future: _fetchBusinessDocs(favoriteIds),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
              }

              if (!snapshot.hasData || snapshot.data!.isEmpty) {
                return _buildEmptyState(
                  icon: Icons.store_outlined,
                  title: tr('common.i_sletme_bulunamadi'),
                  subtitle: tr('common.favori_isletmeleriniz_yuklenem'),
                  isDark: isDark,
                );
              }

              // Apply filter
              final filtered = snapshot.data!.where((doc) {
                if (_businessFilter == 'all') return true;
                final data = doc.data() as Map<String, dynamic>;
                if (_businessFilter == 'tuna') {
                  return data['isTuna'] == true ||
                         data['isTunaPartner'] == true ||
                         data['isTunaApproved'] == true ||
                         data['brand']?.toString().toLowerCase() == 'tuna' ||
                         (data['name']?.toString().toLowerCase().contains('tuna') ?? false) ||
                         (data['companyName']?.toString().toLowerCase().contains('tuna') ?? false);
                }
                if (_businessFilter == 'kermes') {
                  return data['businessType'] == 'kermes' ||
                         data['isKermes'] == true;
                }
                return true;
              }).toList();

              if (filtered.isEmpty) {
                return _buildEmptyState(
                  icon: Icons.filter_list_off,
                  title: 'Sonuc bulunamadi',
                  subtitle: 'Bu filtreye uygun favori isletmeniz yok.',
                  isDark: isDark,
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final doc = filtered[index];
                  final data = doc.data() as Map<String, dynamic>;
                  return _buildBusinessCard(doc.id, data, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String filterKey, String label, IconData icon, bool isDark) {
    final isSelected = _businessFilter == filterKey;
    return GestureDetector(
      onTap: () => setState(() => _businessFilter = filterKey),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? lokmaRed
              : (isDark ? const Color(0xFF262626) : Colors.grey[100]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? lokmaRed
                : (isDark ? const Color(0xFF3A3A3A) : Colors.grey[300]!),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected
                  ? Colors.white
                  : (isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? Colors.white
                    : (isDark ? Colors.grey[300] : Colors.grey[700]),
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
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
    final name = data['companyName'] ?? data['name'] ?? tr('common.i_sletme');
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
                    style: TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (city.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: Colors.grey, size: 14),
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
        title: tr('common.favori_urun_yok'),
        subtitle: tr('common.begendiginiz_urunleri_kalp_ile'),
        isDark: isDark,
      );
    }

    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _fetchProductsBySku(favoriteSkus),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return _buildEmptyState(
            icon: Icons.shopping_bag_outlined,
            title: tr('common.urun_bulunamadi'),
            subtitle: tr('common.favori_urunleriniz_yuklenemedi'),
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
    final name = product['name'] ?? tr('common.urun');
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
                    style: TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '${CurrencyUtils.getCurrencySymbol()}${price.toStringAsFixed(2)}',
                        style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontWeight: FontWeight.w600, fontSize: 14),
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
            child: Icon(icon, color: isDark ? Colors.grey[500] : Colors.grey[600], size: 40),
          ),
          const SizedBox(height: 24),
          Text(
            title,
            style: TextStyle(
              color: textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w600,
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
