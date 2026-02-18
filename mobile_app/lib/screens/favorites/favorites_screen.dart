import 'package:flutter/material.dart';
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
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return _buildEmptyState(
        icon: Icons.login_rounded,
        title: 'Giriş Yapın',
        subtitle: 'Siparişlerinizi görmek için giriş yapın.',
        isDark: isDark,
      );
    }

    final surfaceCard = isDark ? const Color(0xFF181818) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSubtle = isDark ? const Color(0xFF888888) : Colors.grey[600]!;
    final borderSubtle = isDark ? const Color(0xFF262626) : Colors.grey[200]!;

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('meat_orders')
          .where('userId', isEqualTo: user.uid)
          .orderBy('createdAt', descending: true)
          .limit(20)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: lokmaRed));
        }

        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return _buildEmptyState(
            icon: Icons.receipt_long_rounded,
            title: 'Henüz Sipariş Yok',
            subtitle: 'Verdiğiniz siparişler burada listelenecek.',
            isDark: isDark,
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: snapshot.data!.docs.length,
          itemBuilder: (context, index) {
            final doc = snapshot.data!.docs[index];
            final data = doc.data() as Map<String, dynamic>;
            return _buildOrderCard(doc.id, data, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
          },
        );
      },
    );
  }

  Widget _buildOrderCard(String orderId, Map<String, dynamic> data, Color surfaceCard, Color textPrimary, Color textSubtle, Color borderSubtle, bool isDark) {
    final businessName = data['butcherName'] ?? 'İşletme';
    final businessId = data['butcherId'] ?? '';
    final status = data['status'] ?? 'pending';
    final createdAt = data['createdAt'] as Timestamp?;
    final totalAmount = (data['totalAmount'] ?? 0).toDouble();
    final items = data['items'] as List<dynamic>? ?? [];
    final userId = data['userId'] ?? '';
    
    String formattedDate = '';
    if (createdAt != null) {
      final date = createdAt.toDate();
      final now = DateTime.now();
      final diff = now.difference(date);
      
      if (diff.inDays == 0) {
        formattedDate = '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year.toString().substring(2)} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
      } else if (diff.inDays == 1) {
        formattedDate = 'Dün';
      } else {
        formattedDate = '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year.toString().substring(2)}';
      }
    }

    String statusText = '';
    Color statusColor = lokmaRed;
    
    switch (status) {
      case 'pending':
        statusText = 'Beklemede';
        statusColor = Colors.amber;
        break;
      case 'accepted':
      case 'confirmed':
        statusText = 'Onaylandı';
        statusColor = Colors.blue;
        break;
      case 'preparing':
        statusText = 'Hazırlanıyor';
        statusColor = Colors.purple;
        break;
      case 'ready':
        statusText = 'Hazır';
        statusColor = Colors.green;
        break;
      case 'onTheWay':
        statusText = 'Yolda';
        statusColor = Colors.teal;
        break;
      case 'delivered':
        statusText = 'Teslim Edildi';
        statusColor = Colors.green;
        break;
      case 'cancelled':
        statusText = 'İptal Edildi';
        statusColor = Colors.red;
        break;
      default:
        statusText = status;
    }

    return FutureBuilder<DocumentSnapshot>(
      future: FirebaseFirestore.instance.collection('businesses').doc(businessId).get(),
      builder: (context, businessSnapshot) {
        String? imageUrl;
        bool isTuna = false;
        
        if (businessSnapshot.hasData && businessSnapshot.data != null && businessSnapshot.data!.exists) {
          final businessData = businessSnapshot.data!.data() as Map<String, dynamic>?;
          imageUrl = businessData?['imageUrl'] ?? businessData?['logoUrl'];
          // Check all possible TUNA indicators
          isTuna = businessData?['isTuna'] == true || 
                   businessData?['isTunaPartner'] == true ||
                   businessData?['isTunaApproved'] == true ||
                   businessData?['brand']?.toString().toLowerCase() == 'tuna' ||
                   (businessData?['name']?.toString().toLowerCase().contains('tuna') ?? false) ||
                   (businessData?['companyName']?.toString().toLowerCase().contains('tuna') ?? false);
        }


        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: surfaceCard,
            borderRadius: BorderRadius.circular(12),
            border: isDark ? null : Border.all(color: borderSubtle),
            boxShadow: isDark ? null : [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with business info
              Padding(
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
                                  width: 90,
                                  height: 64,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                    width: 90,
                                    height: 64,
                                    color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                    child: Icon(Icons.restaurant, color: textSubtle, size: 28),
                                  ),
                                )
                              : Container(
                                  width: 90,
                                  height: 64,
                                  color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                  child: Icon(Icons.restaurant, color: textSubtle, size: 28),
                                ),
                        ),
                        // TUNA badge
                        if (isTuna)
                          Positioned(
                            bottom: 4,
                            left: 4,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFB335B),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'TUNA',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    // Business info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Order number
                          Text(
                            'Sipariş No: ${orderId.substring(0, 6).toUpperCase()}',
                            style: TextStyle(
                              color: textSubtle,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          // Business name
                          Text(
                            businessName,
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          // Status and date
                          Text(
                            '$statusText • $formattedDate',
                            style: TextStyle(color: textSubtle, fontSize: 13),
                          ),
                          const SizedBox(height: 4),
                          // "Siparişi Görüntüle" link
                          Text(
                            'Siparişi Görüntüle',
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                          const SizedBox(height: 4),
                          // Items and price
                          Text(
                            '${items.length} ürün • €${totalAmount.toStringAsFixed(2)}',
                            style: TextStyle(color: textSubtle, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    // Status badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              
              // Buttons row - Lieferando style thin pills
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  children: [
                    // Puan Ver button
                    SizedBox(
                      width: double.infinity,
                      height: 40,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => RatingScreen(
                                orderId: orderId,
                                businessId: businessId,
                                businessName: businessName,
                                userId: userId,
                                orderStatus: status,
                              ),

                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade200,
                          foregroundColor: isDark ? Colors.white : Colors.black,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                          padding: EdgeInsets.zero,
                        ),
                        child: Text(
                          'Puan Ver',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: isDark ? Colors.white : Colors.black,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Tekrar Sipariş Ver button
                    SizedBox(
                      width: double.infinity,
                      height: 40,
                      child: ElevatedButton(
                        onPressed: () {
                          // Reorder: reconstruct cart from raw Firestore order data
                          final cartNotifier = ref.read(cartProvider.notifier);
                          cartNotifier.clearCart();

                          for (final rawItem in items) {
                            final itemMap = rawItem as Map<String, dynamic>;
                            final product = ButcherProduct(
                              butcherId: businessId,
                              id: itemMap['productId'] ?? '',
                              sku: itemMap['productId'] ?? '',
                              masterId: '',
                              name: itemMap['productName'] ?? itemMap['name'] ?? '',
                              description: '',
                              category: '',
                              price: (itemMap['unitPrice'] ?? itemMap['price'] ?? 0).toDouble(),
                              unitType: itemMap['unit'] ?? 'adet',
                              imageUrl: itemMap['imageUrl'] as String?,
                              minQuantity: (itemMap['unit'] ?? 'adet') == 'kg' ? 0.5 : 1.0,
                              stepQuantity: (itemMap['unit'] ?? 'adet') == 'kg' ? 0.5 : 1.0,
                            );

                            final selectedOpts = (itemMap['selectedOptions'] as List<dynamic>?)
                                ?.map((o) => SelectedOption.fromMap(o as Map<String, dynamic>))
                                .toList() ?? [];

                            cartNotifier.addToCart(
                              product,
                              (itemMap['quantity'] ?? 1).toDouble(),
                              businessId,
                              businessName,
                              selectedOptions: selectedOpts,
                              note: itemMap['itemNote'] as String?,
                            );
                          }

                          context.push('/cart');
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isDark ? const Color(0xFF3A3A3C) : const Color(0xFF1A1A1A),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                          padding: EdgeInsets.zero,
                        ),
                        child: const Text(
                          'Tekrar Sipariş Ver',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
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
