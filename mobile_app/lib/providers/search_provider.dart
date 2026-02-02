import 'dart:async';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

// Search result types
enum SearchResultType {
  vendor,    // Kasap, Restoran, Market etc.
  product,   // Ürün
  category,  // Kategori
}

class SearchResult {
  final String id;
  final String title;
  final String subtitle;
  final String? imageUrl;
  final SearchResultType type;
  final String? route;
  final double? distance;
  final Map<String, dynamic>? metadata;

  SearchResult({
    required this.id,
    required this.title,
    required this.subtitle,
    this.imageUrl,
    required this.type,
    this.route,
    this.distance,
    this.metadata,
  });
}

class SearchResultGroup {
  final String title;
  final String icon;
  final List<SearchResult> results;
  final int visibleCount;

  SearchResultGroup({
    required this.title,
    required this.icon,
    required this.results,
    this.visibleCount = 3,
  });
}

// 🔧 Segment tipi - arama hangi segmentte yapılıyor
enum SearchSegment {
  yemek,   // Restoranlar, imbiss, pastane, catering, fırın, çiğköfte
  market,  // Marketler, kasaplar
  kermes,  // Kermesler
}

// 🆕 Sıralama tipi
enum SearchSortType {
  nearest,      // En Yakın (mesafeye göre)
  rating,       // Müşteri Puanı
  deliveryFee,  // Teslimat Ücreti
}

// 🆕 Filter key sabitleri
class SearchFilters {
  static const String kampanyalar = 'kampanyalar';
  static const String nakitOdeme = 'nakitOdeme';
  static const String ucretsizTeslimat = 'ucretsizTeslimat';
  static const String highRating = 'highRating';   // 4.5+
  static const String puanKarti = 'puanKarti';
  static const String helal = 'helal';
}

class SearchState {
  final String query;
  final List<SearchResultGroup> groups;
  final bool isLoading;
  final bool hasSearched;
  // Distance filtering
  final double maxDistanceKm;
  final double? userLat;
  final double? userLng;
  final bool isRegionSearch; // NRW
  final bool isCountrySearch; // Almanya
  final SearchSegment activeSegment; // 🔧 Aktif segment
  // 🆕 Filter ve Sort
  final Set<String> activeFilters;
  final SearchSortType sortType;

  SearchState({
    this.query = '',
    this.groups = const [],
    this.isLoading = false,
    this.hasSearched = false,
    this.maxDistanceKm = 50.0,
    this.userLat,
    this.userLng,
    this.isRegionSearch = false,
    this.isCountrySearch = false,
    this.activeSegment = SearchSegment.yemek,
    this.activeFilters = const {},
    this.sortType = SearchSortType.nearest,
  });

  SearchState copyWith({
    String? query,
    List<SearchResultGroup>? groups,
    bool? isLoading,
    bool? hasSearched,
    double? maxDistanceKm,
    double? userLat,
    double? userLng,
    bool? isRegionSearch,
    bool? isCountrySearch,
    SearchSegment? activeSegment,
    Set<String>? activeFilters,
    SearchSortType? sortType,
  }) {
    return SearchState(
      query: query ?? this.query,
      groups: groups ?? this.groups,
      isLoading: isLoading ?? this.isLoading,
      hasSearched: hasSearched ?? this.hasSearched,
      maxDistanceKm: maxDistanceKm ?? this.maxDistanceKm,
      userLat: userLat ?? this.userLat,
      userLng: userLng ?? this.userLng,
      isRegionSearch: isRegionSearch ?? this.isRegionSearch,
      isCountrySearch: isCountrySearch ?? this.isCountrySearch,
      activeSegment: activeSegment ?? this.activeSegment,
      activeFilters: activeFilters ?? this.activeFilters,
      sortType: sortType ?? this.sortType,
    );
  }
}

class SearchNotifier extends Notifier<SearchState> {
  Timer? _debounce;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  @override
  SearchState build() => SearchState();

  void onQueryChanged(String query) {
    // Debounce for real-time search
    _debounce?.cancel();
    
    if (query.isEmpty) {
      state = SearchState(
        maxDistanceKm: state.maxDistanceKm,
        userLat: state.userLat,
        userLng: state.userLng,
        isRegionSearch: state.isRegionSearch,
        isCountrySearch: state.isCountrySearch,
        activeSegment: state.activeSegment,
      );
      return;
    }

    state = state.copyWith(query: query, isLoading: true);

    _debounce = Timer(const Duration(milliseconds: 300), () {
      _performSearch(query);
    });
  }

  /// Set user location for distance calculations
  void setUserLocation(double lat, double lng) {
    state = state.copyWith(userLat: lat, userLng: lng);
  }

  /// 🔧 Set active segment for filtering search results
  void setActiveSegment(SearchSegment segment) {
    state = state.copyWith(activeSegment: segment);
  }

  /// 🆕 Toggle a filter on/off
  void toggleFilter(String filterKey) {
    final newFilters = Set<String>.from(state.activeFilters);
    if (newFilters.contains(filterKey)) {
      newFilters.remove(filterKey);
    } else {
      newFilters.add(filterKey);
    }
    state = state.copyWith(activeFilters: newFilters);
    
    // Re-apply filters if we have results
    if (state.hasSearched && state.query.isNotEmpty) {
      _performSearch(state.query);
    }
  }

  /// 🆕 Set sort type
  void setSortType(SearchSortType sortType) {
    state = state.copyWith(sortType: sortType);
    
    // Re-sort results if we have them
    if (state.hasSearched && state.query.isNotEmpty) {
      _performSearch(state.query);
    }
  }

  /// 🆕 Clear all filters
  void clearAllFilters() {
    state = state.copyWith(
      activeFilters: {},
      sortType: SearchSortType.nearest,
    );
    
    if (state.hasSearched && state.query.isNotEmpty) {
      _performSearch(state.query);
    }
  }

  /// Set distance filter
  /// -1 = NRW (region), -2 = Almanya (country), positive = km distance
  void setDistanceFilter(double distanceKm) {
    if (distanceKm == -1) {
      state = state.copyWith(
        maxDistanceKm: 0,
        isRegionSearch: true,
        isCountrySearch: false,
      );
    } else if (distanceKm == -2) {
      state = state.copyWith(
        maxDistanceKm: 0,
        isRegionSearch: false,
        isCountrySearch: true,
      );
    } else {
      state = state.copyWith(
        maxDistanceKm: distanceKm,
        isRegionSearch: false,
        isCountrySearch: false,
      );
    }
    
    // Re-trigger search if there's an active query
    if (state.query.isNotEmpty) {
      _performSearch(state.query);
    }
  }

  /// Calculate distance between two points using Haversine formula
  double _calculateDistance(double lat1, double lng1, double lat2, double lng2) {
    const double earthRadius = 6371; // km
    final dLat = _toRadians(lat2 - lat1);
    final dLng = _toRadians(lng2 - lng1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) * cos(_toRadians(lat2)) *
        sin(dLng / 2) * sin(dLng / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  double _toRadians(double degree) => degree * 3.141592653589793 / 180;

  /// Normalize Turkish characters for flexible search
  /// ü→u, ö→o, ş→s, ç→c, ğ→g, ı→i and vice versa
  String _normalizeTurkish(String text) {
    return text
        .replaceAll('ü', 'u')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('Ü', 'U')
        .replaceAll('Ö', 'O')
        .replaceAll('Ş', 'S')
        .replaceAll('Ç', 'C')
        .replaceAll('Ğ', 'G')
        .replaceAll('İ', 'I');
  }

  Future<void> _performSearch(String query) async {
    final queryLower = query.toLowerCase().trim();
    final queryNormalized = _normalizeTurkish(queryLower);
    if (queryLower.length < 2) {
      state = state.copyWith(isLoading: false, groups: [], hasSearched: true);
      return;
    }

    final List<SearchResultGroup> groups = [];

    try {
      // 1. Search Vendors grouped by category (Kasaplar, Restoranlar, Marketler, etc.)
      final vendorsByCategory = await _searchVendorsByCategory(queryLower);
      for (final entry in vendorsByCategory.entries) {
        // entry.key is like "🥩 Kasaplar"
        final parts = entry.key.split(' ');
        final icon = parts.isNotEmpty ? parts.first : '🏪';
        final title = parts.length > 1 ? parts.sublist(1).join(' ') : 'İşletmeler';
        groups.add(SearchResultGroup(
          title: title,
          icon: icon,
          results: entry.value,
        ));
      }

      // 2. Search Products (segment-specific)
      final productResults = await _searchProducts(queryLower);
      if (productResults.isNotEmpty) {
        // Segment-specific title and icon
        String productTitle;
        String productIcon;
        switch (state.activeSegment) {
          case SearchSegment.yemek:
            productTitle = 'Yemekler';
            productIcon = '🍕';
            break;
          case SearchSegment.market:
            productTitle = 'Market Ürünleri';
            productIcon = '📦';
            break;
          case SearchSegment.kermes:
            productTitle = 'Kermes Menüsü';
            productIcon = '🥘';
            break;
        }
        
        groups.add(SearchResultGroup(
          title: productTitle,
          icon: productIcon,
          results: productResults,
        ));
      }

      // 3. Category matches (static)
      final categoryResults = _searchCategories(queryLower);
      if (categoryResults.isNotEmpty) {
        groups.add(SearchResultGroup(
          title: 'Kategoriler',
          icon: '📂',
          results: categoryResults,
        ));
      }

      state = state.copyWith(
        groups: groups,
        isLoading: false,
        hasSearched: true,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, groups: [], hasSearched: true);
    }
  }

  /// Returns vendors grouped by their business category
  Future<Map<String, List<SearchResult>>> _searchVendorsByCategory(String query) async {
    final resultsByCategory = <String, List<SearchResult>>{};
    final queryNormalized = _normalizeTurkish(query);

    // Category mapping: businessCategory field value -> display info
    final categoryInfo = {
      'kasap': {'title': 'Kasaplar', 'icon': '🥩'},
      'butcher': {'title': 'Kasaplar', 'icon': '🥩'},
      'restoran': {'title': 'Restoranlar', 'icon': '🍽️'},
      'restaurant': {'title': 'Restoranlar', 'icon': '🍽️'},
      'imbiss': {'title': 'Imbiss', 'icon': '🍖'},
      'market': {'title': 'Marketler', 'icon': '🛒'},
      'pastane': {'title': 'Pastaneler', 'icon': '🥐'},
      'bakery': {'title': 'Pastaneler', 'icon': '🥐'},
      'kermes': {'title': 'Kermesler', 'icon': '🎪'},
      'cicekci': {'title': 'Çiçekçiler', 'icon': '💐'},
      'florist': {'title': 'Çiçekçiler', 'icon': '💐'},
    };

    try {
      final butchersSnapshot = await _firestore
          .collection('businesses')
          .limit(200)
          .get();

      for (final doc in butchersSnapshot.docs) {
        final data = doc.data();
        // Use correct Firestore field names: companyName and brand
        // Apply Turkish character normalization for flexible search
        final companyName = _normalizeTurkish((data['companyName'] ?? '').toString().toLowerCase());
        final brand = _normalizeTurkish((data['brand'] ?? '').toString().toLowerCase());
        final city = _normalizeTurkish((data['address']?['city'] ?? '').toString().toLowerCase());
        
        // 🆕 MULTI-WORD SEARCH: Split query into words, ALL must match somewhere
        // e.g., "tuna hückelhoven" → ["tuna", "huckelhoven"] → both words must match
        final queryWords = queryNormalized.split(RegExp(r'\s+')).where((w) => w.length >= 2).toList();
        final searchableText = '$companyName $brand $city';
        
        bool allWordsMatch = queryWords.isNotEmpty && queryWords.every((word) => searchableText.contains(word));
        
        if (allWordsMatch) {
          
          // === DISTANCE FILTERING ===
          double? distanceKm;
          bool passesDistanceFilter = true;
          
          // Get vendor coordinates from address or Google Places
          final vendorLat = data['address']?['lat'] as double?;
          final vendorLng = data['address']?['lng'] as double?;
          final vendorState = (data['address']?['state'] ?? '').toString().toUpperCase();
          final vendorCountry = (data['address']?['country'] ?? 'DE').toString().toUpperCase();
          
          // Apply distance filter based on current filter type
          if (state.isCountrySearch) {
            // Almanya - only show German businesses
            passesDistanceFilter = vendorCountry == 'DE' || vendorCountry == 'GERMANY' || vendorCountry == 'DEUTSCHLAND';
          } else if (state.isRegionSearch) {
            // NRW - only show NRW businesses
            passesDistanceFilter = vendorState.contains('NRW') || 
                vendorState.contains('NORDRHEIN') || 
                vendorState.contains('NORTH RHINE');
          } else if (state.userLat != null && state.userLng != null && vendorLat != null && vendorLng != null) {
            // Distance-based filter
            distanceKm = _calculateDistance(state.userLat!, state.userLng!, vendorLat, vendorLng);
            passesDistanceFilter = distanceKm <= state.maxDistanceKm;
          }
          
          if (!passesDistanceFilter) continue;
          
          // Determine the category - check all possible type fields
          final businessType = (data['businessType'] ?? data['businessCategory'] ?? data['type'] ?? '').toString().toLowerCase();
          final categories = data['businessCategories'] as List<dynamic>? ?? [];
          String categoryKey = businessType.isNotEmpty ? businessType : 
              (categories.isNotEmpty ? categories.first.toString().toLowerCase() : 'isletme');
          
          // 🔧 SEGMENT FILTERING - only show businesses matching current segment
          final yemekCategories = {'restoran', 'restaurant', 'imbiss', 'pastane', 'bakery', 'cigkofte', 'catering', 'firin'};
          final marketCategories = {'market', 'kasap', 'butcher'};
          final kermesCategories = {'kermes'};
          
          bool passesSegmentFilter = true;
          switch (state.activeSegment) {
            case SearchSegment.yemek:
              passesSegmentFilter = yemekCategories.contains(categoryKey);
              break;
            case SearchSegment.market:
              passesSegmentFilter = marketCategories.contains(categoryKey);
              break;
            case SearchSegment.kermes:
              passesSegmentFilter = kermesCategories.contains(categoryKey);
              break;
          }
          
          if (!passesSegmentFilter) continue;
          
          // 🆕 ACTIVE FILTERS - check against business metadata
          bool passesActiveFilters = true;
          
          if (state.activeFilters.isNotEmpty) {
            // Rating filter (4.5+)
            if (state.activeFilters.contains(SearchFilters.highRating)) {
              final rating = (data['rating'] ?? data['averageRating'] ?? 0.0) as num;
              if (rating < 4.5) passesActiveFilters = false;
            }
            
            // Promotions/Kampanyalar
            if (state.activeFilters.contains(SearchFilters.kampanyalar) && passesActiveFilters) {
              final hasPromo = data['hasPromotion'] ?? data['hasDiscount'] ?? data['aktifKampanya'] ?? false;
              if (hasPromo != true) passesActiveFilters = false;
            }
            
            // Cash payment / Nakit Ödeme
            if (state.activeFilters.contains(SearchFilters.nakitOdeme) && passesActiveFilters) {
              final acceptsCash = data['acceptsCash'] ?? data['nakitOdeme'] ?? true; // Default true
              if (acceptsCash != true) passesActiveFilters = false;
            }
            
            // Free delivery / Ücretsiz Teslimat
            if (state.activeFilters.contains(SearchFilters.ucretsizTeslimat) && passesActiveFilters) {
              final freeDelivery = data['freeDelivery'] ?? data['ucretsizTeslimat'] ?? false;
              final deliveryFee = (data['deliveryFee'] ?? data['teslimatUcreti'] ?? 99.0) as num;
              if (freeDelivery != true && deliveryFee > 0) passesActiveFilters = false;
            }
            
            // Loyalty card / Puan Kartı
            if (state.activeFilters.contains(SearchFilters.puanKarti) && passesActiveFilters) {
              final hasLoyalty = data['hasLoyaltyCard'] ?? data['puanKarti'] ?? false;
              if (hasLoyalty != true) passesActiveFilters = false;
            }
            
            // Helal
            if (state.activeFilters.contains(SearchFilters.helal) && passesActiveFilters) {
              final isHelal = data['isHelal'] ?? data['helal'] ?? data['halalCertified'] ?? true; // Default true for Turkish businesses
              if (isHelal != true) passesActiveFilters = false;
            }
          }
          
          if (!passesActiveFilters) continue;
          
          // Get display info for category
          final info = categoryInfo[categoryKey] ?? {'title': 'İşletmeler', 'icon': '🏪'};
          final groupKey = '${info['icon']} ${info['title']}';
          
          resultsByCategory.putIfAbsent(groupKey, () => []);
          resultsByCategory[groupKey]!.add(SearchResult(
            id: doc.id,
            title: data['companyName'] ?? data['brand'] ?? 'İşletme',
            subtitle: distanceKm != null 
                ? '${data['address']?['city'] ?? ''} • ${distanceKm.toStringAsFixed(1)} km'
                : data['address']?['city'] ?? '',
            imageUrl: data['imageUrl'] ?? data['coverImage'] ?? data['logo'],
            type: SearchResultType.vendor,
            route: '/business/${doc.id}',
            distance: distanceKm,
            metadata: data,
          ));
        }
      }
    } catch (e) {
      print('SearchProvider: Error searching vendors: $e');
    }

    // 🆕 Sort each category based on active sort type
    for (final key in resultsByCategory.keys) {
      resultsByCategory[key]!.sort((a, b) {
        switch (state.sortType) {
          case SearchSortType.nearest:
            // Sort by distance (closest first)
            if (a.distance == null && b.distance == null) return 0;
            if (a.distance == null) return 1;
            if (b.distance == null) return -1;
            return a.distance!.compareTo(b.distance!);
            
          case SearchSortType.rating:
            // Sort by rating (highest first)
            final ratingA = (a.metadata?['rating'] ?? a.metadata?['averageRating'] ?? 0.0) as num;
            final ratingB = (b.metadata?['rating'] ?? b.metadata?['averageRating'] ?? 0.0) as num;
            return ratingB.compareTo(ratingA); // Descending
            
          case SearchSortType.deliveryFee:
            // Sort by delivery fee (lowest first)
            final feeA = (a.metadata?['deliveryFee'] ?? a.metadata?['teslimatUcreti'] ?? 99.0) as num;
            final feeB = (b.metadata?['deliveryFee'] ?? b.metadata?['teslimatUcreti'] ?? 99.0) as num;
            return feeA.compareTo(feeB); // Ascending
        }
      });
    }

    return resultsByCategory;
  }

  /// Search products from business menus and kermes menus based on active segment
  Future<List<SearchResult>> _searchProducts(String query) async {
    final results = <SearchResult>[];
    final queryNormalized = _normalizeTurkish(query);

    try {
      // Segment-based menu search
      switch (state.activeSegment) {
        case SearchSegment.yemek:
          // Search restaurant/food business menus
          final yemekResults = await _searchBusinessMenuItems(
            query: queryNormalized,
            businessTypes: {'restoran', 'restaurant', 'imbiss', 'pastane', 'bakery', 'cigkofte', 'catering', 'firin'},
          );
          results.addAll(yemekResults);
          break;
          
        case SearchSegment.market:
          // Search market/kasap product menus
          final marketResults = await _searchBusinessMenuItems(
            query: queryNormalized,
            businessTypes: {'market', 'kasap', 'butcher'},
          );
          results.addAll(marketResults);
          break;
          
        case SearchSegment.kermes:
          // Search kermes event menus
          final kermesResults = await _searchKermesMenuItems(queryNormalized);
          results.addAll(kermesResults);
          break;
      }
    } catch (e) {
      print('SearchProvider: Error searching products: $e');
    }

    return results;
  }

  /// Search products within business menus (businesses/{id}/products subcollection)
  Future<List<SearchResult>> _searchBusinessMenuItems({
    required String query,
    required Set<String> businessTypes,
  }) async {
    final results = <SearchResult>[];

    try {
      // First get businesses matching the types
      final businessesSnapshot = await _firestore
          .collection('businesses')
          .limit(50)
          .get();

      // Filter businesses by type
      final matchingBusinesses = <String, Map<String, dynamic>>{};
      for (final doc in businessesSnapshot.docs) {
        final data = doc.data();
        
        // Check multiple possible field names for business type
        final businessType = (data['businessType'] ?? data['businessCategory'] ?? data['type'] ?? '').toString().toLowerCase();
        final businessCategoriesRaw = data['businessCategories'] as List<dynamic>? ?? [];
        final businessCategoriesSet = businessCategoriesRaw.map((c) => c.toString().toLowerCase()).toSet();
        
        // Match if type field matches OR any businessCategories entry matches
        final matchesType = businessTypes.contains(businessType) || 
            businessTypes.intersection(businessCategoriesSet).isNotEmpty;
        
        if (matchesType) {
          // Apply distance filter if location is available
          bool passesDistanceFilter = true;
          final vendorLat = data['address']?['lat'] as double? ?? data['lat'] as double?;
          final vendorLng = data['address']?['lng'] as double? ?? data['lng'] as double?;
          
          if (state.userLat != null && state.userLng != null && vendorLat != null && vendorLng != null) {
            final distance = _calculateDistance(state.userLat!, state.userLng!, vendorLat, vendorLng);
            passesDistanceFilter = distance <= state.maxDistanceKm;
          }
          
          if (passesDistanceFilter) {
            matchingBusinesses[doc.id] = data;
          }
        }
      }

      // Now search products in each matching business's subcollection
      for (final entry in matchingBusinesses.entries) {
        final businessId = entry.key;
        final businessData = entry.value;
        final businessName = businessData['companyName'] ?? businessData['brand'] ?? 'İşletme';

        try {
          final productsSnapshot = await _firestore
              .collection('businesses')
              .doc(businessId)
              .collection('products')
              .limit(20)
              .get();

          for (final productDoc in productsSnapshot.docs) {
            final productData = productDoc.data();
            final productName = _normalizeTurkish((productData['name'] ?? productData['ad'] ?? '').toString().toLowerCase());
            final productCategory = _normalizeTurkish((productData['category'] ?? productData['kategori'] ?? '').toString().toLowerCase());
            final productDescription = _normalizeTurkish((productData['description'] ?? '').toString().toLowerCase());

            if (productName.contains(query) || 
                productCategory.contains(query) || 
                productDescription.contains(query)) {
              
              // Format price
              final price = productData['price'] ?? productData['fiyat'];
              final priceStr = price != null ? '${price.toStringAsFixed(2)} €' : '';
              
              results.add(SearchResult(
                id: productDoc.id,
                title: productData['name'] ?? productData['ad'] ?? 'Ürün',
                subtitle: '$businessName${priceStr.isNotEmpty ? ' • $priceStr' : ''}',
                imageUrl: productData['imageUrl'] ?? productData['image'],
                type: SearchResultType.product,
                route: '/business/$businessId', // Navigate to business detail
                metadata: {
                  ...productData,
                  'businessId': businessId,
                  'businessName': businessName,
                },
              ));
            }
          }
        } catch (e) {
          // Continue if a specific business's products can't be fetched
          print('SearchProvider: Error fetching products for business $businessId: $e');
        }
      }
    } catch (e) {
      print('SearchProvider: Error searching business menu items: $e');
    }

    return results;
  }

  /// Search products within kermes event menus
  Future<List<SearchResult>> _searchKermesMenuItems(String query) async {
    final results = <SearchResult>[];

    try {
      // Get active kermes events
      final kermesSnapshot = await _firestore
          .collection('kermes_events')
          .where('isActive', isEqualTo: true)
          .limit(30)
          .get();

      for (final kermesDoc in kermesSnapshot.docs) {
        final kermesData = kermesDoc.data();
        final kermesName = kermesData['title'] ?? kermesData['name'] ?? 'Kermes';
        
        // Kermes menu is embedded in the document as 'menu' array
        final menuItems = kermesData['menu'] as List<dynamic>? ?? [];
        
        for (final item in menuItems) {
          if (item is Map<String, dynamic>) {
            final itemName = _normalizeTurkish((item['name'] ?? item['ad'] ?? '').toString().toLowerCase());
            final itemCategory = _normalizeTurkish((item['category'] ?? item['kategori'] ?? '').toString().toLowerCase());
            final itemDescription = _normalizeTurkish((item['description'] ?? '').toString().toLowerCase());

            if (itemName.contains(query) || 
                itemCategory.contains(query) || 
                itemDescription.contains(query)) {
              
              // Format price  
              final price = item['price'] ?? item['fiyat'];
              final priceStr = price != null ? '${price.toStringAsFixed(2)} €' : '';
              
              results.add(SearchResult(
                id: item['id'] ?? '${kermesDoc.id}_${itemName}',
                title: item['name'] ?? item['ad'] ?? 'Ürün',
                subtitle: '$kermesName${priceStr.isNotEmpty ? ' • $priceStr' : ''}',
                imageUrl: item['imageUrl'] ?? item['image'],
                type: SearchResultType.product,
                route: '/kermes/${kermesDoc.id}/menu', // Navigate to kermes menu
                metadata: {
                  ...item,
                  'kermesId': kermesDoc.id,
                  'kermesName': kermesName,
                },
              ));
            }
          }
        }
        
        // Also check products subcollection if it exists
        try {
          final productsSnapshot = await _firestore
              .collection('kermes_events')
              .doc(kermesDoc.id)
              .collection('products')
              .limit(20)
              .get();

          for (final productDoc in productsSnapshot.docs) {
            final productData = productDoc.data();
            final productName = _normalizeTurkish((productData['name'] ?? productData['ad'] ?? '').toString().toLowerCase());
            final productCategory = _normalizeTurkish((productData['category'] ?? productData['kategori'] ?? '').toString().toLowerCase());

            if (productName.contains(query) || productCategory.contains(query)) {
              final price = productData['price'] ?? productData['fiyat'];
              final priceStr = price != null ? '${price.toStringAsFixed(2)} €' : '';
              
              results.add(SearchResult(
                id: productDoc.id,
                title: productData['name'] ?? productData['ad'] ?? 'Ürün',
                subtitle: '$kermesName${priceStr.isNotEmpty ? ' • $priceStr' : ''}',
                imageUrl: productData['imageUrl'] ?? productData['image'],
                type: SearchResultType.product,
                route: '/kermes/${kermesDoc.id}/menu',
                metadata: {
                  ...productData,
                  'kermesId': kermesDoc.id,
                  'kermesName': kermesName,
                },
              ));
            }
          }
        } catch (e) {
          // Products subcollection might not exist for all kermes events
        }
      }
    } catch (e) {
      print('SearchProvider: Error searching kermes menu items: $e');
    }

    return results;
  }

  List<SearchResult> _searchCategories(String query) {
    final queryNormalized = _normalizeTurkish(query);
    final categories = [
      {'name': 'Kasap', 'icon': '🥩', 'route': '/kasap', 'keywords': ['et', 'kiyma', 'kusbasi', 'kasap', 'sucuk']},
      {'name': 'Restoran', 'icon': '🍽️', 'route': '/restoran', 'keywords': ['yemek', 'restoran', 'doner', 'kebap', 'pizza']},
      {'name': 'Imbiss', 'icon': '🍖', 'route': '/restoran', 'keywords': ['imbiss', 'doner', 'durum', 'lahmacun']},
      {'name': 'Market', 'icon': '🛒', 'route': '/market', 'keywords': ['market', 'bakkal', 'sut', 'ekmek']},
      {'name': 'Pastane', 'icon': '🥐', 'route': '/restoran', 'keywords': ['pastane', 'baklava', 'borek', 'kahve', 'tatli']},
      {'name': 'Kermes', 'icon': '🎪', 'route': '/kermes', 'keywords': ['kermes', 'gozleme', 'manti']},
      {'name': 'Cicekci', 'icon': '💐', 'route': '/market', 'keywords': ['cicek', 'buket', 'gul', 'florist']},
      {'name': 'Catering', 'icon': '🎉', 'route': '/catering', 'keywords': ['catering', 'dugun', 'etkinlik', 'parsi', 'organizasyon', 'toplanti', 'nisan', 'sunnet']},
    ];

    final results = <SearchResult>[];
    for (final cat in categories) {
      final name = _normalizeTurkish((cat['name'] as String).toLowerCase());
      final keywords = cat['keywords'] as List<String>;
      
      if (name.contains(queryNormalized) || keywords.any((k) => k.contains(queryNormalized))) {
        results.add(SearchResult(
          id: cat['route'] as String,
          title: cat['name'] as String,
          subtitle: '${cat['icon']} Kategori',
          type: SearchResultType.category,
          route: cat['route'] as String,
        ));
      }
    }
    return results;
  }

  void clearSearch() {
    _debounce?.cancel();
    state = SearchState();
  }

  /// Sektöre göre işletmeleri ara (kategori tıklandığında)
  Future<void> searchBySector(String sectorType, String sectorTitle) async {
    state = state.copyWith(
      query: sectorTitle,
      isLoading: true,
      hasSearched: false,
    );

    final List<SearchResultGroup> groups = [];

    // Sector type mapping for Firestore query
    final sectorTypes = <String>{sectorType.toLowerCase()};
    
    // Add alternative sector names
    switch (sectorType.toLowerCase()) {
      case 'pastane':
        sectorTypes.addAll(['bakery', 'borek', 'tatli', 'baklava']);
        break;
      case 'imbiss':
        sectorTypes.addAll(['fastfood', 'doner', 'kebap']);
        break;
      case 'kasap':
        sectorTypes.addAll(['butcher', 'metzgerei']);
        break;
      case 'restoran':
        sectorTypes.addAll(['restaurant', 'lokanta']);
        break;
      case 'market':
        sectorTypes.addAll(['supermarket', 'bakkal', 'grocery']);
        break;
      case 'cicekci':
        sectorTypes.addAll(['florist', 'flower', 'blumen']);
        break;
    }

    try {
      final snapshot = await _firestore
          .collection('businesses')
          .limit(50)
          .get();

      final results = <SearchResult>[];

      for (final doc in snapshot.docs) {
        final data = doc.data();
        
        // Check if business matches the sector type
        final businessType = (data['businessCategory'] ?? data['businessType'] ?? '').toString().toLowerCase();
        final sectors = data['sectorTypes'] as List<dynamic>? ?? [businessType];
        final sectorSet = sectors.map((s) => s.toString().toLowerCase()).toSet();
        
        // Match if any sector intersects
        if (sectorTypes.intersection(sectorSet).isNotEmpty || sectorTypes.contains(businessType)) {
          final displayName = data['companyName'] ?? data['brand'] ?? 'İşletme';
          final city = data['address']?['city'] ?? '';
          
          results.add(SearchResult(
            id: doc.id,
            title: displayName,
            subtitle: city,
            imageUrl: data['coverImage'] ?? data['logo'],
            type: SearchResultType.vendor,
            route: '/business/${doc.id}',
          ));
        }
      }

      if (results.isNotEmpty) {
        // Get icon for the sector
        final iconMap = {
          'pastane': '🥐',
          'kasap': '🥩',
          'restoran': '🍽️',
          'imbiss': '🍖',
          'market': '🛒',
          'kermes': '🎪',
          'cicekci': '💐',
          'catering': '🎉',
        };
        
        groups.add(SearchResultGroup(
          title: sectorTitle,
          icon: iconMap[sectorType.toLowerCase()] ?? '🏪',
          results: results,
          visibleCount: results.length, // Show all results
        ));
      }

      state = state.copyWith(
        groups: groups,
        isLoading: false,
        hasSearched: true,
      );
    } catch (e) {
      print('SearchProvider: Error searching by sector: $e');
      state = state.copyWith(isLoading: false, groups: [], hasSearched: true);
    }
  }
}

final searchProvider = NotifierProvider<SearchNotifier, SearchState>(() {
  return SearchNotifier();
});
