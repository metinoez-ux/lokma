import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/product_favorites_provider.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
import '../../utils/currency_utils.dart';
import '../marketplace/widgets/wallet_business_card.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/widgets/kermes_card.dart';
import 'package:lokma_app/services/kermes_favorite_service.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:geolocator/geolocator.dart';
import '../../widgets/order_bottom_sheet_helper.dart';
import '../../providers/cart_provider.dart';
import '../../models/butcher_product.dart';
import '../../models/product_option.dart';
class FavoritesScreen extends ConsumerStatefulWidget {
  const FavoritesScreen({super.key});

  @override
  ConsumerState<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends ConsumerState<FavoritesScreen> with SingleTickerProviderStateMixin {
  // LOKMA Design Tokens - Brand color stays constant
  static const Color lokmaRed = Color(0xFFEA184A);

  late TabController _tabController;
  int _selectedIndex = 0;
  String _businessFilter = 'all'; // 'all', 'tuna', 'kermes', tr('common.kasap')

  // Cache for Business Documents to prevent FutureBuilder jank in list scrolls
  final Map<String, DocumentSnapshot> _businessCache = {};

  Future<DocumentSnapshot> _getCachedBusiness(bool isKermesOrder, String businessId) async {
    if (businessId.isEmpty) throw Exception('Empty business ID');
    final cacheKey = '${isKermesOrder ? 'kermes' : 'kasap'}_$businessId';
    if (_businessCache.containsKey(cacheKey)) {
      return _businessCache[cacheKey]!;
    }
    final doc = await (isKermesOrder 
        ? FirebaseFirestore.instance.collection('kermes_events').doc(businessId).get()
        : FirebaseFirestore.instance.collection('businesses').doc(businessId).get());
    
    _businessCache[cacheKey] = doc;
    return doc;
  }

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
          tr('profile.favorilerim'),
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
    if (user == null || user.uid.isEmpty) {
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

    // Fetch only explicitly favorited orders
    final favoriteOrdersStream = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .collection('favoriteOrders')
        .orderBy('createdAt', descending: true)
        .snapshots();

    return StreamBuilder<QuerySnapshot>(
      stream: favoriteOrdersStream,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
        }

        if (snapshot.hasError) {
          debugPrint('favorite orders error: ${snapshot.error}');
          return _buildEmptyState(
            icon: Icons.error_outline,
            title: tr('common.hata_olustu'),
            subtitle: tr('common.siparislerinizi_yuklerken_hata'),
            isDark: isDark,
          );
        }

        final allDocs = snapshot.data?.docs ?? [];
        
        // Filter out and clean up orphan orders (e.g. deleted by admin)
        final validDocs = [];
        for (var doc in allDocs) {
          final data = doc.data() as Map<String, dynamic>;
          final items = data['items'] as List<dynamic>?;
          final itemCount = items?.length ?? (data['itemCount'] ?? 0);
          final totalAmount = (data['grandTotal'] ?? data['totalAmount'] ?? data['total'] ?? 0).toDouble();
          
          // An order with 0 items and 0.00 total is considered an orphan/deleted order
          if (itemCount == 0 && totalAmount <= 0.0) {
            // Clean up from database silently
            doc.reference.delete().catchError((e) => debugPrint('Error deleting orphan favorite order: $e'));
          } else {
            validDocs.add(doc);
          }
        }

        if (validDocs.isEmpty) {
          return _buildEmptyState(
            icon: Icons.receipt_long_outlined,
            title: tr('common.favori_siparis_yok'),
            subtitle: tr('common.siparislerinizi_bookmark_ile_f'),
            isDark: isDark,
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: validDocs.length,
          itemBuilder: (context, index) {
            final doc = validDocs[index];
            final data = doc.data() as Map<String, dynamic>;
            return _buildFavoriteOrderCard(doc.id, data, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
          },
        );
      },
    );
  }

  /// Combines multiple Firestore query streams into a single stream of lists
  Stream<List<QuerySnapshot>> _combineStreams(List<Stream<QuerySnapshot>> streams) async* {
    final latestSnapshots = List<QuerySnapshot?>.filled(streams.length, null);
    
    await for (final _ in Stream.periodic(const Duration(milliseconds: 100))) {
      break; // Just to start the async generator
    }
    
    // Use a simple approach: listen to all streams and yield combined results
    final controller = StreamController<List<QuerySnapshot>>();
    final subscriptions = <StreamSubscription>[];
    
    for (int i = 0; i < streams.length; i++) {
      subscriptions.add(streams[i].listen((snapshot) {
        latestSnapshots[i] = snapshot;
        final nonNull = latestSnapshots.whereType<QuerySnapshot>().toList();
        if (nonNull.isNotEmpty) {
          controller.add(nonNull);
        }
      }, onError: (e) {
        controller.addError(e);
      }));
    }
    
    yield* controller.stream;
    
    // Cleanup on done
    for (final sub in subscriptions) {
      sub.cancel();
    }
    controller.close();
  }

  Widget _buildFavoriteOrderCard(String orderId, Map<String, dynamic> data, Color surfaceCard, Color textPrimary, Color textSubtle, Color borderSubtle, bool isDark) {
    final bool isKermesOrder = data['kermesId'] != null && data['kermesId'].toString().isNotEmpty;
    final businessName = isKermesOrder ? data['kermesName']?.toString() ?? 'Kermes' : data['businessName']?.toString() ?? data['butcherName']?.toString() ?? tr('common.i_sletme');
    final businessId = isKermesOrder ? data['kermesId']?.toString() ?? '' : data['businessId']?.toString() ?? data['butcherId']?.toString() ?? '';
    final totalAmount = (data['grandTotal'] ?? data['totalAmount'] ?? data['total'] ?? 0).toDouble();
    final items = data['items'] as List<dynamic>?;
    final itemCount = items?.length ?? (data['itemCount'] ?? 0);
    final status = data['status']?.toString() ?? '';
    final createdAt = data['createdAt'] as Timestamp?;
    final dateStr = createdAt != null
        ? '${createdAt.toDate().day.toString().padLeft(2, '0')}.${createdAt.toDate().month.toString().padLeft(2, '0')}.${createdAt.toDate().year}'
        : '';

    final cacheKey = '${isKermesOrder ? 'kermes' : 'kasap'}_$businessId';
    final cachedDoc = _businessCache[cacheKey];

    return FutureBuilder<DocumentSnapshot>(
      initialData: cachedDoc,
      future: cachedDoc != null || businessId.isEmpty ? null : _getCachedBusiness(isKermesOrder, businessId),
      builder: (context, businessSnapshot) {
        String? imageUrl;
        bool isTuna = false;
        
        if (businessSnapshot.hasData && businessSnapshot.data != null && businessSnapshot.data!.exists) {
          final businessData = businessSnapshot.data!.data() as Map<String, dynamic>?;
          imageUrl = isKermesOrder 
              ? (businessData?['headerImage'] ?? businessData?['imageUrl'])
              : (businessData?['logoUrl'] ?? businessData?['imageUrl']);
          if (!isKermesOrder) {
            isTuna = businessData?['isTuna'] == true || 
                     businessData?['isTunaPartner'] == true ||
                     businessData?['isTunaApproved'] == true ||
                     businessData?['brand']?.toString().toLowerCase() == 'tuna' ||
                     (businessData?['name']?.toString().toLowerCase().contains('tuna') ?? false) ||
                     (businessData?['companyName']?.toString().toLowerCase().contains('tuna') ?? false);
          }
        }

        return GestureDetector(
          onTap: () {
            if (orderId.isNotEmpty) {
              OrderBottomSheetHelper.showOrderDetailGlobal(context, orderId);
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
                  color: Colors.black.withOpacity(0.04),
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
                              color: const Color(0xFFEA184A),
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
                        // Siparis tarihi
                        if (dateStr.isNotEmpty)
                          Text(
                            dateStr,
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        if (dateStr.isNotEmpty) const SizedBox(height: 2),
                        // Business name (subtitle)
                        Text(
                          businessName,
                          style: TextStyle(color: textSubtle, fontSize: 13),
                        ),
                        const SizedBox(height: 4),
                        // Siparis icerigindeki urunler
                        if (items != null && items.isNotEmpty)
                          Text(
                            items.take(3).map((item) {
                              if (item is Map) return item['name']?.toString() ?? item['productName']?.toString() ?? '';
                              return '';
                            }).where((n) => n.isNotEmpty).join(', ') + (items.length > 3 ? ' +${items.length - 3}' : ''),
                            style: TextStyle(color: textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        const SizedBox(height: 4),
                        // Urun sayisi + toplam + durum
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                '$itemCount ${tr('common.urun')} - ${CurrencyUtils.getCurrencySymbol()}${totalAmount.toStringAsFixed(2)}',
                                style: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[800], fontSize: 13, fontWeight: FontWeight.w600),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (status.isNotEmpty) ...
                            [
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: status == 'delivered' ? Colors.green.withOpacity(0.15) :
                                         status == 'cancelled' ? Colors.red.withOpacity(0.15) :
                                         Colors.orange.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  status == 'delivered' ? tr('common.teslim_edildi') :
                                  status == 'cancelled' ? tr('common.iptal_edildi') :
                                  status == 'accepted' ? tr('common.onaylandi') :
                                  status == 'preparing' ? tr('common.hazirlaniyor') :
                                  status,
                                  style: TextStyle(
                                    color: status == 'delivered' ? Colors.green :
                                           status == 'cancelled' ? Colors.red :
                                           Colors.orange,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 8),
                        // Butonlar: "Siparisi Goruntule" ve "Tekrar Sipariş Ver"
                        Row(
                          children: [
                            GestureDetector(
                              onTap: () {
                                if (orderId.isNotEmpty) {
                                  // Instant bottom sheet popup without navigation
                                  OrderBottomSheetHelper.showOrderDetailGlobal(context, orderId);
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
                            if (!isKermesOrder) ...[
                              const SizedBox(width: 16),
                              GestureDetector(
                                onTap: () {
                                  if (items == null || items.isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Bu sipariş çok eski olduğu için içeriği okunamadı ve tekrar sipariş edilemiyor.')),
                                    );
                                    return;
                                  }

                                  final cartNotifier = ref.read(cartProvider.notifier);
                                  cartNotifier.clearCart();

                                  for (final item in items) {
                                    if (item is! Map) continue;
                                    
                                    final qty = (item['quantity'] as num?)?.toDouble() ?? 1.0;
                                    final price = (item['price'] as num?)?.toDouble() ?? 0.0;
                                    final unit = item['unit']?.toString() ?? item['unitType']?.toString() ?? 'adet';
                                    final sku = item['sku']?.toString() ?? item['id']?.toString() ?? '';
                                    final nameData = item['name']?.toString() ?? item['productName']?.toString() ?? '';
                                    final img = item['imageUrl']?.toString() ?? item['image']?.toString() ?? '';
                                    
                                    final product = ButcherProduct(
                                      butcherId: businessId,
                                      id: sku,
                                      sku: sku,
                                      masterId: '',
                                      name: nameData,
                                      nameData: nameData,
                                      description: '',
                                      category: '',
                                      price: price,
                                      unitType: unit,
                                      imageUrl: img,
                                      minQuantity: unit == 'kg' ? 0.5 : 1.0,
                                      stepQuantity: unit == 'kg' ? 0.5 : 1.0,
                                    );

                                    final rawOpts = item['selectedOptions'] as List<dynamic>? ?? [];
                                    final selectedOpts = rawOpts.map((o) {
                                      if (o is Map<String, dynamic>) {
                                        return SelectedOption.fromMap(o);
                                      }
                                      return SelectedOption(name: '', priceAdjustment: 0);
                                    }).where((o) => o.name.isNotEmpty).toList();

                                    cartNotifier.addToCart(
                                      product,
                                      qty,
                                      businessId,
                                      businessName,
                                      selectedOptions: selectedOpts,
                                      note: item['itemNote']?.toString() ?? item['note']?.toString(),
                                    );
                                  }

                                  context.push('/cart');
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: isDark ? const Color(0xFF3A3A3C) : const Color(0xFF1A1A1A),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.refresh, color: Colors.white, size: 14),
                                      const SizedBox(width: 4),
                                      Text(
                                        'orders.reorder'.tr(),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Favorite icon and tag
                  Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Icon(
                          Icons.favorite,
                          color: const Color(0xFFEA184A),
                          size: 28,
                        ),
                      ),
                      if (data['favoriteName'] != null && data['favoriteName'].toString().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            data['favoriteName'].toString(),
                            style: TextStyle(
                              color: const Color(0xFFEA184A),
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
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
        // Dropdown filter (notification style)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF2F2F7),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                    width: 0.5,
                  ),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _businessFilter,
                    isDense: true,
                    icon: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 18,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                    dropdownColor: isDark ? const Color(0xFF2C2C2E) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                    items: [
                      DropdownMenuItem(value: 'all', child: Text(tr('common.all'))),
                      DropdownMenuItem(value: 'tuna', child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.verified, size: 14, color: const Color(0xFFEA184A)),
                          const SizedBox(width: 5),
                          const Text('TUNA'),
                        ],
                      )),
                      DropdownMenuItem(value: 'kermes', child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.festival, size: 14, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                          const SizedBox(width: 5),
                          Text(tr('home.kermes')),
                        ],
                      )),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        HapticFeedback.selectionClick();
                        setState(() => _businessFilter = val);
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
        // Business list
        Expanded(
          child: FutureBuilder<List<dynamic>>(
            future: _fetchAllFavorites(favoriteIds),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
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

              // Apply instantaneous filter for unfavorited items (so UI updates instantly without waiting for Future completion)
              final validData = snapshot.data!.where((item) {
                if (item is KermesEvent) return true; // Kermes uses its own provider
                final doc = item as DocumentSnapshot;
                return favoriteIds.contains(doc.id);
              }).toList();
              
              if (validData.isEmpty && snapshot.connectionState != ConnectionState.waiting) {
                return _buildEmptyState(
                  icon: Icons.store_outlined,
                  title: tr('common.i_sletme_bulunamadi'),
                  subtitle: tr('common.favori_isletmeleriniz_yuklenem'),
                  isDark: isDark,
                );
              }

              // Apply filter
              final filtered = validData.where((item) {
                if (_businessFilter == 'all') return true;
                
                if (item is KermesEvent) {
                  return _businessFilter == 'kermes';
                }
                
                final doc = item as DocumentSnapshot;
                final data = doc.data() as Map<String, dynamic>? ?? {};
                
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
                  title: tr('common.no_results_found'),
                  subtitle: tr('common.no_results'),
                  isDark: isDark,
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final item = filtered[index];
                  
                  if (item is KermesEvent) {
                    final userLoc = ref.watch(userLocationProvider).value;
                    Position? currentPos;
                    if (userLoc != null && userLoc.isValid) {
                      currentPos = Position(
                        latitude: userLoc.latitude,
                        longitude: userLoc.longitude,
                        timestamp: DateTime.now(),
                        accuracy: 0,
                        altitude: 0,
                        altitudeAccuracy: 0,
                        heading: 0,
                        headingAccuracy: 0,
                        speed: 0,
                        speedAccuracy: 0,
                      );
                    }
                    
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: KermesCard(
                        event: item,
                        currentPosition: currentPos,
                      ),
                    );
                  } else {
                    final doc = item as DocumentSnapshot;
                    final data = doc.data() as Map<String, dynamic>? ?? {};
                    return _buildBusinessCard(doc.id, data, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
                  }
                },
              );
            },
          ),
        ),
      ],
    );
  }




  Future<List<dynamic>> _fetchAllFavorites(List<String> businessIds) async {
    final List<dynamic> results = [];
    
    // 1. Fetch businesses
    if (businessIds.isNotEmpty) {
      for (String id in businessIds) {
        if (id.isEmpty) continue;
        try {
          final doc = await FirebaseFirestore.instance.collection('businesses').doc(id).get();
          if (doc.exists) results.add(doc);
        } catch (e) {
          debugPrint('Error fetching business $id: $e');
        }
      }
    }
    
    // 2. Fetch kermeses
    try {
      final kermesIds = await KermesFavoriteService.instance.getFavoriteIds();
      for (String id in kermesIds) {
        if (id.isEmpty) continue;
        final doc = await FirebaseFirestore.instance.collection('kermes_events').doc(id).get();
        if (doc.exists) {
          final data = doc.data() as Map<String, dynamic>;
          final fullAddress = data['address'] is Map ? data['address']['fullAddress'] ?? '' : data['address']?.toString() ?? '';
          final city = data['city'] ?? (data['address'] is Map ? data['address']['city'] : null) ?? 'Bilinmiyor';
          final features = (data['features'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
          
          results.add(KermesEvent(
            id: doc.id,
            city: city,
            title: data['name'] ?? data['title'] ?? 'Kermes',
            address: fullAddress,
            phoneNumber: data['contactPhone']?.toString() ?? data['phoneNumber']?.toString() ?? '',
            startDate: (data['startDate'] as Timestamp?)?.toDate() ?? DateTime.now(),
            endDate: (data['endDate'] as Timestamp?)?.toDate() ?? DateTime.now().add(const Duration(hours: 12)),
            latitude: (data['latitude'] as num?)?.toDouble() ?? (data['lat'] as num?)?.toDouble() ?? 0.0,
            longitude: (data['longitude'] as num?)?.toDouble() ?? (data['lng'] as num?)?.toDouble() ?? 0.0,
            menu: [],
            parking: [],
            weatherForecast: [],
            openingTime: data['openingTime'] ?? '10:00',
            closingTime: data['closingTime'] ?? '20:00',
            headerImage: data['headerImage']?.toString(),
            hasDelivery: data['hasDelivery'] == true,
            deliveryFee: (data['deliveryFee'] ?? 0).toDouble(),
            hasKidsActivities: features.contains('kids') || features.contains('kids_area'),
            hasFamilyArea: features.contains('family_area') || features.contains('family_tents'),
            hasOutdoor: features.contains('outdoor'),
            hasIndoorArea: features.contains('indoor'),
            hasCreditCardPayment: features.contains('card_payment'),
            activeBadgeIds: (data['activeBadgeIds'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
            customFeatures: (data['customFeatures'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
          ));
        }
      }
    } catch (e) {
      debugPrint('Error fetching kermes favorites: $e');
    }
    
    return results;
  }

  Widget _buildBusinessCard(String id, Map<String, dynamic> data, Color surfaceCard, Color textPrimary, Color textSubtle, Color borderSubtle, bool isDark) {
    final name = data['businessName'] ?? data['companyName'] ?? data['name'] ?? tr('common.i_sletme');
    final imageUrl = data['imageUrl'] as String?;
    final logoUrl = data['logoUrl'] as String? ?? data['logo'] as String?;
    final address = data['address'] as Map<String, dynamic>?;
    final city = address?['city'] ?? '';
    
    // Rating info
    final rating = (data['rating'] ?? data['averageRating'] ?? 0.0) as num;
    final reviewCount = (data['reviewCount'] ?? data['ratingCount'] ?? 0) as num;
    
    // TUNA status
    final isTuna = data['isTuna'] == true || 
                   data['isTunaPartner'] == true ||
                   data['isTunaApproved'] == true ||
                   data['brand']?.toString().toLowerCase() == 'tuna' ||
                   (data['companyName']?.toString().toLowerCase().contains('tuna') ?? false);
    
    // Business type
    final businessType = (data['businessType'] ?? data['type'] ?? data['businessCategory'] ?? '').toString();
    final cuisineType = data['cuisineType']?.toString();
    
    // Availability
    final isOpen = data['isOpen'] ?? true;
    
    
    return WalletBusinessCard(
      data: data,
      id: id,
      name: name,
      logoUrl: logoUrl,
      imageUrl: imageUrl,
      isAvailable: isOpen == true,
      unavailableReason: isOpen != true ? tr('marketplace.currently_closed') : '',
      isTunaPartner: isTuna,
      deliveryMode: 'delivery',
      rating: rating.toDouble(),
      reviewText: '(${reviewCount.toInt()})',
      typeLabel: businessType,
      cuisineType: cuisineType,
      distance: 0,
      onTap: () => context.push('/kasap/$id'),
      showClosedDialog: (ctx, closedName, reason, closedData) {
        // Navigate anyway in favorites
        context.push('/kasap/$id');
      },
    );
  }

  Widget _buildProductFavorites(List<String> favoriteSkus, bool isDark) {
    final surfaceCard = isDark ? const Color(0xFF181818) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSubtle = isDark ? const Color(0xFF888888) : Colors.grey[600]!;
    final borderSubtle = isDark ? const Color(0xFF262626) : Colors.grey[200]!;

    // Use detailed provider for rich data
    final detailedFavorites = ref.watch(productFavoritesDetailedProvider);

    if (detailedFavorites.isEmpty) {
      return _buildEmptyState(
        icon: Icons.shopping_bag_outlined,
        title: tr('common.favori_urun_yok'),
        subtitle: tr('common.begendiginiz_urunleri_kalp_ile'),
        isDark: isDark,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: detailedFavorites.length,
      itemBuilder: (context, index) {
        final fav = detailedFavorites[index];
        return _buildProductCardFromFavorite(fav, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
      },
    );
  }

  Widget _buildProductCardFromFavorite(FavoriteProduct fav, Color surfaceCard, Color textPrimary, Color textSubtle, Color borderSubtle, bool isDark) {
    final isLegacy = fav.productName.isEmpty;
    final hasBusinessId = fav.businessId.isNotEmpty;

    // Use cached UI for initial display while fetching if it's not legacy
    final cachedUI = isLegacy ? null : _buildProductCardUI(
      name: fav.productName,
      imageUrl: fav.imageUrl,
      price: fav.price,
      businessId: fav.businessId,
      sku: fav.sku,
      surfaceCard: surfaceCard,
      textPrimary: textPrimary,
      textSubtle: textSubtle,
      borderSubtle: borderSubtle,
      isDark: isDark,
    );

    Future<DocumentSnapshot?> future;
    if (hasBusinessId && fav.sku.isNotEmpty) {
      future = FirebaseFirestore.instance
          .collection('businesses').doc(fav.businessId)
          .collection('products').doc(fav.sku)
          .get();
    } else {
      future = _findLegacyProduct(fav.sku);
    }

    return FutureBuilder<DocumentSnapshot?>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          if (cachedUI != null) return cachedUI;

          return Container(
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
                  child: Container(
                    width: 60, height: 60,
                    color: isDark ? Colors.grey[800] : Colors.grey[200],
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Container(
                    height: 16,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.grey[700] : Colors.grey[300],
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        if (snapshot.hasError || !snapshot.hasData || snapshot.data == null || !snapshot.data!.exists) {
          // Urun artik yok - otomatik listeden cikar
          Future.microtask(() {
            try {
              if (mounted) {
                ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(fav.sku);
              }
            } catch (_) {}
          });
          return const SizedBox.shrink(); // Ekranda gosterme
        }

        final doc = snapshot.data!;
        final data = doc.data() as Map<String, dynamic>;
        
        // Eger urun silinmis veya gizlenmisse
        if (data['isActive'] == false || data['isArchived'] == true) {
          Future.microtask(() {
            try {
              if (mounted) {
                ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(fav.sku);
              }
            } catch (_) {}
          });
          return const SizedBox.shrink(); // Ekranda gosterme
        }

        final productName = _extractProductName(data) ?? fav.sku;
        final productImage = data['imageUrl']?.toString() ?? '';
        final productPrice = (data['appSellingPrice'] ?? data['sellingPrice'] ?? data['price'] ?? 0).toDouble();
        final foundBusinessId = hasBusinessId ? fav.businessId : (doc.reference.parent.parent?.id ?? '');

        // Sadece degisiklik varsa provider'i guncelle
        if (isLegacy || fav.businessId != foundBusinessId || fav.productName != productName || fav.price != productPrice) {
          Future.microtask(() {
            try {
              if (mounted) {
                ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(fav.sku); // cikar
                ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(
                  fav.sku,
                  businessId: foundBusinessId,
                  productName: productName,
                  imageUrl: productImage,
                  price: productPrice,
                ); // detayli olarak tekrar ekle
              }
            } catch (_) {}
          });
        }

        return _buildProductCardUI(
          name: productName,
          imageUrl: productImage,
          price: productPrice,
          businessId: foundBusinessId,
          sku: fav.sku,
          surfaceCard: surfaceCard,
          textPrimary: textPrimary,
          textSubtle: textSubtle,
          borderSubtle: borderSubtle,
          isDark: isDark,
        );
      },
    );
  }

  Future<DocumentSnapshot?> _findLegacyProduct(String sku) async {
    try {
      final snap1 = await FirebaseFirestore.instance.collectionGroup('products').where('sku', isEqualTo: sku).limit(1).get();
      if (snap1.docs.isNotEmpty) return snap1.docs.first;
      
      final snap2 = await FirebaseFirestore.instance.collectionGroup('products').where('masterProductSku', isEqualTo: sku).limit(1).get();
      if (snap2.docs.isNotEmpty) return snap2.docs.first;
    } catch (_) {}
    return null;
  }

  Widget _buildProductCardUI({
    required String name,
    required String imageUrl,
    required double price,
    required String businessId,
    required String sku,
    required Color surfaceCard,
    required Color textPrimary,
    required Color textSubtle,
    required Color borderSubtle,
    required bool isDark,
    bool isDeleted = false,
  }) {
    final hasImage = imageUrl.isNotEmpty;
    final hasBusinessId = businessId.isNotEmpty;

    return GestureDetector(
      onTap: () async {
        if (isDeleted) {
          if (mounted) {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: Text(tr('common.bilgi')),
                content: Text(tr('common.urun_artik_mevcut_degil')),
                actions: [
                  TextButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(sku);
                    },
                    child: Text(tr('common.favorilerden_kaldir')),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text(tr('common.ok')),
                  ),
                ],
              ),
            );
          }
          return;
        }
        if (hasBusinessId) {
          try {
            final businessDoc = await FirebaseFirestore.instance
                .collection('businesses').doc(businessId).get();
            if (!mounted) return;
            if (!businessDoc.exists) {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: Text(tr('common.isletme_bulunamadi')),
                  content: Text(tr('common.isletme_artik_aktif_degil')),
                  actions: [
                    TextButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(sku);
                      },
                      child: Text(tr('common.favorilerden_kaldir')),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: Text(tr('common.ok')),
                    ),
                  ],
                ),
              );
              return;
            }
            if (mounted) context.push('/kasap/$businessId');
          } catch (e) {
            if (mounted) context.push('/kasap/$businessId');
          }
        }
      },
      child: Opacity(
        opacity: isDeleted ? 0.5 : 1.0,
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
                  child: hasImage
                      ? LokmaNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => Container(
                            color: isDark ? Colors.grey[800] : Colors.grey[200],
                            child: Icon(Icons.shopping_bag, color: isDark ? Colors.white24 : Colors.grey[400]),
                          ),
                        )
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
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (isDeleted)
                          Text(
                            tr('common.silinmis'),
                            style: TextStyle(color: Colors.red[400], fontSize: 11, fontStyle: FontStyle.italic),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (price > 0)
                          Text(
                            '${CurrencyUtils.getCurrencySymbol()}${price.toStringAsFixed(2)}',
                            style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                        if (hasBusinessId) ...[
                          if (price > 0) const SizedBox(width: 8),
                          Expanded(
                            child: FutureBuilder<DocumentSnapshot>(
                              future: FirebaseFirestore.instance.collection('businesses').doc(businessId).get(),
                              builder: (context, snap) {
                                if (!snap.hasData || !snap.data!.exists) return const SizedBox.shrink();
                                final bData = snap.data!.data() as Map<String, dynamic>?;
                                final bName = bData?['companyName'] ?? bData?['name'] ?? '';
                                if (bName.toString().isEmpty) return const SizedBox.shrink();
                                return Text(
                                  '- $bName',
                                  style: TextStyle(color: textSubtle, fontSize: 12),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                );
                              },
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
                onPressed: () => ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(sku),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Firestore product name extractor (supports localized and plain string)
  String? _extractProductName(Map<String, dynamic> data) {
    final nameField = data['name'];
    if (nameField == null) return null;
    if (nameField is String) return nameField;
    if (nameField is Map) {
      if (nameField.containsKey('tr') && nameField['tr'] != null) return nameField['tr'].toString();
      if (nameField.values.isNotEmpty) return nameField.values.first.toString();
    }
    return null;
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
