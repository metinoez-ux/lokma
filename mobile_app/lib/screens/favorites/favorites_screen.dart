import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/providers/butcher_favorites_provider.dart';
import 'package:lokma_app/providers/product_favorites_provider.dart';
import 'package:lokma_app/widgets/three_dimensional_pill_tab_bar.dart';
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

    // Two streams: own orders + group participant orders
    final ownOrdersStream = FirebaseFirestore.instance
        .collection('meat_orders')
        .where('userId', isEqualTo: user.uid)
        .orderBy('createdAt', descending: true)
        .limit(20)
        .snapshots();

    final groupOrdersStream = FirebaseFirestore.instance
        .collection('meat_orders')
        .where('participantUserIds', arrayContains: user.uid)
        .orderBy('createdAt', descending: true)
        .limit(10)
        .snapshots();

    return StreamBuilder<List<QuerySnapshot>>(
      stream: _combineStreams([ownOrdersStream, groupOrdersStream]),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
        }

        if (snapshot.hasError) {
          debugPrint('orders error: ${snapshot.error}');
          // Fallback: only own orders without orderBy
          return StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('meat_orders')
                .where('userId', isEqualTo: user.uid)
                .limit(20)
                .snapshots(),
            builder: (context, fallbackSnapshot) {
              if (fallbackSnapshot.connectionState == ConnectionState.waiting) {
                return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
              }
              if (!fallbackSnapshot.hasData || fallbackSnapshot.data!.docs.isEmpty || fallbackSnapshot.hasError) {
                return _buildEmptyState(
                  icon: Icons.receipt_long_outlined,
                  title: tr('common.favori_siparis_yok'),
                  subtitle: tr('common.siparislerinizi_bookmark_ile_f'),
                  isDark: isDark,
                );
              }
              final docs = fallbackSnapshot.data!.docs.toList();
              docs.sort((a, b) {
                final aData = a.data() as Map<String, dynamic>;
                final bData = b.data() as Map<String, dynamic>;
                final aTime = aData['createdAt'] as Timestamp?;
                final bTime = bData['createdAt'] as Timestamp?;
                if (aTime == null && bTime == null) return 0;
                if (aTime == null) return 1;
                if (bTime == null) return -1;
                return bTime.compareTo(aTime);
              });
              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: docs.length,
                itemBuilder: (context, index) {
                  final doc = docs[index];
                  final data = doc.data() as Map<String, dynamic>;
                  return _buildFavoriteOrderCard(doc.id, data, surfaceCard, textPrimary, textSubtle, borderSubtle, isDark);
                },
              );
            },
          );
        }

        // Merge and deduplicate docs from both streams
        final allSnapshots = snapshot.data ?? [];
        final Map<String, QueryDocumentSnapshot> uniqueDocs = {};
        for (final qs in allSnapshots) {
          for (final doc in qs.docs) {
            uniqueDocs[doc.id] = doc;
          }
        }

        if (uniqueDocs.isEmpty) {
          return _buildEmptyState(
            icon: Icons.receipt_long_outlined,
            title: tr('common.favori_siparis_yok'),
            subtitle: tr('common.siparislerinizi_bookmark_ile_f'),
            isDark: isDark,
          );
        }

        // Sort by createdAt descending
        final sortedDocs = uniqueDocs.values.toList();
        sortedDocs.sort((a, b) {
          final aData = a.data() as Map<String, dynamic>;
          final bData = b.data() as Map<String, dynamic>;
          final aTime = aData['createdAt'] as Timestamp?;
          final bTime = bData['createdAt'] as Timestamp?;
          if (aTime == null && bTime == null) return 0;
          if (aTime == null) return 1;
          if (bTime == null) return -1;
          return bTime.compareTo(aTime);
        });

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: sortedDocs.length,
          itemBuilder: (context, index) {
            final doc = sortedDocs[index];
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
    final businessName = data['businessName']?.toString() ?? data['butcherName']?.toString() ?? tr('common.i_sletme');
    final businessId = data['businessId']?.toString() ?? data['butcherId']?.toString() ?? '';
    final totalAmount = (data['grandTotal'] ?? data['totalAmount'] ?? data['total'] ?? 0).toDouble();
    final items = data['items'] as List<dynamic>?;
    final itemCount = items?.length ?? (data['itemCount'] ?? 0);
    final status = data['status']?.toString() ?? '';
    final createdAt = data['createdAt'] as Timestamp?;
    final dateStr = createdAt != null
        ? '${createdAt.toDate().day.toString().padLeft(2, '0')}.${createdAt.toDate().month.toString().padLeft(2, '0')}.${createdAt.toDate().year}'
        : '';

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
                                '$itemCount ${tr('common.urun_kucuk')} - ${CurrencyUtils.getCurrencySymbol()}${totalAmount.toStringAsFixed(2)}',
                                style: TextStyle(color: textSubtle, fontSize: 12),
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
                                  color: status == 'delivered' ? Colors.green.withValues(alpha: 0.15) :
                                         status == 'cancelled' ? Colors.red.withValues(alpha: 0.15) :
                                         Colors.orange.withValues(alpha: 0.15),
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
                  // Bookmark icon
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Icon(
                      Icons.bookmark,
                      color: const Color(0xFFFB335B),
                      size: 28,
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
                          Icon(Icons.verified, size: 14, color: const Color(0xFFFB335B)),
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
                  title: tr('common.no_results_found'),
                  subtitle: tr('common.no_results'),
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

  /// For legacy favorites (no productName), fetch product info from Firestore
  Widget _buildProductCardFromFavorite(FavoriteProduct fav, Color surfaceCard, Color textPrimary, Color textSubtle, Color borderSubtle, bool isDark) {
    // If legacy (no product name), look up the product from Firestore
    final isLegacy = fav.productName.isEmpty;

    if (isLegacy && fav.businessId.isNotEmpty) {
      // businessId var -- direkt document okuma (collectionGroup'a gerek yok)
      return FutureBuilder<DocumentSnapshot>(
        future: FirebaseFirestore.instance
            .collection('businesses').doc(fav.businessId)
            .collection('products').doc(fav.sku)
            .get(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
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

          if (!snapshot.hasData || !snapshot.data!.exists) {
            // Urun artik yok
            return _buildProductCardUI(
              name: fav.sku.length > 12 ? '${fav.sku.substring(0, 12)}...' : fav.sku,
              imageUrl: '',
              price: 0,
              businessId: fav.businessId,
              sku: fav.sku,
              surfaceCard: surfaceCard,
              textPrimary: textSubtle,
              textSubtle: textSubtle,
              borderSubtle: borderSubtle,
              isDark: isDark,
              isDeleted: true,
            );
          }

          final data = snapshot.data!.data() as Map<String, dynamic>;
          final productName = _extractProductName(data) ?? fav.sku;
          final productImage = data['imageUrl']?.toString() ?? '';
          final productPrice = (data['appSellingPrice'] ?? data['sellingPrice'] ?? data['price'] ?? 0).toDouble();

          // Provider'i zenginlestir (bir kerelik)
          Future.microtask(() {
            ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(fav.sku); // cikar
            ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(
              fav.sku,
              businessId: fav.businessId,
              productName: productName,
              imageUrl: productImage,
              price: productPrice,
            ); // detayli olarak tekrar ekle
          });

          return _buildProductCardUI(
            name: productName,
            imageUrl: productImage,
            price: productPrice,
            businessId: fav.businessId,
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

    if (isLegacy) {
      // businessId de yok -- gercek legacy veri, detay cekilemez. collectionGroup ile ariyoruz.
      return FutureBuilder<DocumentSnapshot?>(
        future: _findLegacyProduct(fav.sku),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          }

          if (snapshot.hasError || !snapshot.hasData || snapshot.data == null) {
            return _buildProductCardUI(
              name: fav.sku.length > 12 ? '${fav.sku.substring(0, 12)}...' : fav.sku,
              imageUrl: '',
              price: 0,
              businessId: '',
              sku: fav.sku,
              surfaceCard: surfaceCard,
              textPrimary: textSubtle,
              textSubtle: textSubtle,
              borderSubtle: borderSubtle,
              isDark: isDark,
              isDeleted: true,
            );
          }

          final doc = snapshot.data!;
          final data = doc.data() as Map<String, dynamic>;
          final productName = _extractProductName(data) ?? fav.sku;
          final productImage = data['imageUrl']?.toString() ?? '';
          final productPrice = (data['appSellingPrice'] ?? data['sellingPrice'] ?? data['price'] ?? 0).toDouble();
          final foundBusinessId = doc.reference.parent.parent?.id ?? '';

          // Provider'i zenginlestir (bir kerelik)
          Future.microtask(() {
            ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(fav.sku); // cikar
            ref.read(productFavoritesDetailedProvider.notifier).toggleFavorite(
              fav.sku,
              businessId: foundBusinessId,
              productName: productName,
              imageUrl: productImage,
              price: productPrice,
            ); // detayli olarak tekrar ekle
          });

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

    // Non-legacy: use stored data directly
    return _buildProductCardUI(
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
                      ? CachedNetworkImage(
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
