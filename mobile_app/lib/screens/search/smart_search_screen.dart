import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import '../../providers/search_provider.dart';

// 🎨 LOKMA marka rengi (Rose-500)
const Color lokmaPink = Color(0xFFFB335B);

class SmartSearchScreen extends ConsumerStatefulWidget {
  final String segment;
  
  const SmartSearchScreen({super.key, this.segment = 'yemek'});

  @override
  ConsumerState<SmartSearchScreen> createState() => _SmartSearchScreenState();
}

class _SmartSearchScreenState extends ConsumerState<SmartSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  
  // 🔧 Track expanded state for each group
  final Set<String> _expandedGroups = {};
  
  // 🆕 Sort type local selection (synced to provider on apply)
  String _selectedSort = 'En Yakın';

  @override
  void initState() {
    super.initState();
    // Auto-focus search field
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
      _initLocation();
      
      // 🔧 Set active segment based on parameter
      final segment = widget.segment == 'market' 
          ? SearchSegment.market 
          : widget.segment == 'kermes' 
              ? SearchSegment.kermes 
              : SearchSegment.yemek;
      ref.read(searchProvider.notifier).setActiveSegment(segment);
    });
  }

  /// Initialize user location for distance-based filtering
  Future<void> _initLocation() async {
    try {
      // Check permissions
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever || 
          permission == LocationPermission.denied) {
        return;
      }
      
      // Get current position
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
      );
      
      // Update SearchProvider with user location
      ref.read(searchProvider.notifier).setUserLocation(
        position.latitude,
        position.longitude,
      );
    } catch (e) {
      debugPrint('SmartSearch: Location error: $e');
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(searchProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    // 🆕 Lieferando tarzı: Tema uyumlu arka plan
    final backgroundColor = isDark ? const Color(0xFF0D0D0D) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final hintColor = isDark ? Colors.grey[500] : Colors.grey[400];
    final cardColor = isDark ? const Color(0xFF1A1A1A) : Colors.grey[100];

    // Status bar rengi tema ile uyumlu
    SystemChrome.setSystemUIOverlayStyle(
      isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
    );

    return Scaffold(
      backgroundColor: backgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // 🆕 Lieferando tarzı minimal header
            _buildSearchHeader(isDark, textColor, hintColor!, cardColor!),
            
            // Results
            Expanded(
              child: searchState.isLoading
                  ? _buildLoadingState(isDark)
                  : searchState.groups.isEmpty && searchState.hasSearched
                      ? _buildEmptyState(isDark, textColor)
                      : searchState.groups.isEmpty
                          ? _buildSuggestionsState(isDark, textColor, cardColor)
                          : _buildResults(searchState.groups, isDark, textColor, cardColor),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchHeader(bool isDark, Color textColor, Color hintColor, Color cardColor) {
    final searchState = ref.watch(searchProvider);
    final hasResults = searchState.groups.isNotEmpty;
    
    return Column(
      children: [
        // 🆕 Top row: Back/Cancel + Pill Search + Filter
        Container(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          child: Row(
            children: [
              // Geri ok (sonuç varken) veya boşluk
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  if (hasResults) {
                    // Sonuç varken geri ok - aramayı temizle
                    ref.read(searchProvider.notifier).clearSearch();
                    _searchController.clear();
                  } else {
                    // Sonuç yokken - ekranı kapat
                    ref.read(searchProvider.notifier).clearSearch();
                    context.pop();
                  }
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  child: Icon(
                    Icons.arrow_back_ios_new_rounded,
                    color: lokmaPink,
                    size: 20,
                  ),
                ),
              ),
              
              const SizedBox(width: 4),
              
              // 🆕 Pill-shaped arama input
              Expanded(
                child: Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1A1A1A) : Colors.grey[100],
                    borderRadius: BorderRadius.circular(22), // Full pill shape
                    border: Border.all(
                      color: isDark ? Colors.white.withOpacity(0.08) : Colors.grey[300]!,
                    ),
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 14),
                      Icon(Icons.search_rounded, color: hintColor, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          focusNode: _focusNode,
                          style: TextStyle(color: textColor, fontSize: 15),
                          textInputAction: TextInputAction.search,
                          decoration: InputDecoration(
                            hintText: tr('search.restoran_mi_ariyorsunuz'),
                            hintStyle: TextStyle(color: hintColor, fontSize: 15),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                            isDense: true,
                          ),
                          onChanged: (value) {
                            ref.read(searchProvider.notifier).onQueryChanged(value);
                          },
                          onSubmitted: (value) {
                            if (value.isNotEmpty) {
                              ref.read(searchProvider.notifier).onQueryChanged(value);
                            }
                          },
                        ),
                      ),
                      if (_searchController.text.isNotEmpty)
                        GestureDetector(
                          onTap: () {
                            _searchController.clear();
                            ref.read(searchProvider.notifier).clearSearch();
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: Icon(Icons.close_rounded, color: hintColor, size: 18),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              
              const SizedBox(width: 8),
              
              // 🆕 Filtre/Abbrechen butonu
              if (hasResults)
                // Sonuç varken filtre ikonu
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _showFilterSheet(isDark);
                  },
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1A1A1A) : Colors.grey[100],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Icon(
                        Icons.tune_rounded,
                        color: lokmaPink,
                        size: 22,
                      ),
                    ),
                  ),
                )
              else
                // Sonuç yokken Abbrechen
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    ref.read(searchProvider.notifier).clearSearch();
                    context.pop();
                  },
                  child: Text(
                    'Abbrechen',
                    style: TextStyle(
                      color: lokmaPink,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
        ),
        
        // 🆕 Filter chips (sonuç varken görünür - Lieferando tarzı)
        if (hasResults) _buildFilterChips(isDark, cardColor),
      ],
    );
  }

  // 🆕 Filter chips - Lieferando tarzı (provider'dan okuyor)
  Widget _buildFilterChips(bool isDark, Color cardColor) {
    final activeFilters = ref.watch(searchProvider).activeFilters;
    
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildFilterChip('Kampanyalar', Icons.local_offer_outlined, isDark, SearchFilters.kampanyalar, activeFilters),
            const SizedBox(width: 8),
            _buildFilterChip(tr('search.nakit_odeme'), Icons.payments_outlined, isDark, SearchFilters.nakitOdeme, activeFilters),
            const SizedBox(width: 8),
            _buildFilterChip(tr('search.ucretsiz_teslimat'), Icons.delivery_dining_outlined, isDark, SearchFilters.ucretsizTeslimat, activeFilters),
            const SizedBox(width: 8),
            _buildFilterChip('4.5+ Puan', Icons.star_border_rounded, isDark, SearchFilters.highRating, activeFilters),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, IconData icon, bool isDark, String filterKey, Set<String> activeFilters) {
    final isActive = activeFilters.contains(filterKey);
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        ref.read(searchProvider.notifier).toggleFilter(filterKey);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? lokmaPink : (isDark ? const Color(0xFF1A1A1A) : Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? lokmaPink : (isDark ? Colors.white.withOpacity(0.15) : Colors.grey[300]!),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: isActive ? Colors.white : (isDark ? Colors.white70 : Colors.black87)),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isActive ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 🆕 Filter full-screen page (Lieferando tarzı - provider ile çalışıyor)
  void _showFilterSheet(bool isDark) {
    // Get current state from provider
    final searchState = ref.read(searchProvider);
    
    // Local sort state (synced on apply)
    String localSelectedSort = switch (searchState.sortType) {
      SearchSortType.nearest => 'En Yakın',
      SearchSortType.rating => tr('search.musteri_puani'),
      SearchSortType.deliveryFee => tr('search.teslimat_ucreti'),
    };
    
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(0)),
      ),
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          final activeFilters = ref.watch(searchProvider).activeFilters;
          
          return Container(
            height: MediaQuery.of(sheetContext).size.height * 0.92,
            padding: EdgeInsets.only(
              top: 0,
              bottom: MediaQuery.of(sheetContext).viewPadding.bottom,
            ),
            child: Column(
              children: [
                // Header
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: Colors.grey.withOpacity(0.2)),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.pop(sheetContext),
                        child: Text(
                          tr('search.i_ptal'),
                          style: TextStyle(
                            color: lokmaPink,
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      Text(
                        tr('search.sonuclari_filtrele'),
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          ref.read(searchProvider.notifier).clearAllFilters();
                          setSheetState(() => localSelectedSort = 'En Yakın');
                        },
                        child: Text(
                          'Sıfırla',
                          style: TextStyle(
                            color: lokmaPink,
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Filter section header
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Filtreler',
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
                
                // Filter options - connected to provider
                _buildSheetFilterOption('Kampanyalar', SearchFilters.kampanyalar, activeFilters, isDark, setSheetState),
                _buildSheetFilterOption(tr('search.nakit_odeme'), SearchFilters.nakitOdeme, activeFilters, isDark, setSheetState),
                _buildSheetFilterOption('Puan Kartı', SearchFilters.puanKarti, activeFilters, isDark, setSheetState),
                _buildSheetFilterOption('4.5+ Puan', SearchFilters.highRating, activeFilters, isDark, setSheetState),
                _buildSheetFilterOption('Helal', SearchFilters.helal, activeFilters, isDark, setSheetState),
                
                // Sort section
                Container(
                  width: double.infinity,
                  color: isDark ? const Color(0xFF1A1A1A) : Colors.grey[100],
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Text(
                    'Sıralama',
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                
                _buildSheetSortOption('En Yakın', localSelectedSort, isDark, (val) {
                  setSheetState(() => localSelectedSort = val);
                }),
                _buildSheetSortOption(tr('search.musteri_puani'), localSelectedSort, isDark, (val) {
                  setSheetState(() => localSelectedSort = val);
                }),
                _buildSheetSortOption(tr('search.teslimat_ucreti'), localSelectedSort, isDark, (val) {
                  setSheetState(() => localSelectedSort = val);
                }),
                
                const Spacer(),
                
                // Apply button
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: GestureDetector(
                    onTap: () {
                      // Apply sort type to provider
                      SearchSortType sortType = SearchSortType.nearest;
                      if (localSelectedSort == tr('search.musteri_puani')) {
                        sortType = SearchSortType.rating;
                      } else if (localSelectedSort == tr('search.teslimat_ucreti')) {
                        sortType = SearchSortType.deliveryFee;
                      }
                      
                      ref.read(searchProvider.notifier).setSortType(sortType);
                      Navigator.pop(sheetContext);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: lokmaPink,
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: Center(
                        child: Text(
                          tr('search.i_sletmeleri_goster'),
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSheetFilterOption(String label, String filterKey, Set<String> activeFilters, bool isDark, StateSetter setSheetState) {
    final isActive = activeFilters.contains(filterKey);
    final textColor = isDark ? Colors.white : Colors.black87;
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        ref.read(searchProvider.notifier).toggleFilter(filterKey);
        setSheetState(() {}); // Trigger rebuild
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Colors.grey.withOpacity(0.15)),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(color: textColor, fontSize: 15),
              ),
            ),
            // Checkbox
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: isActive ? lokmaPink : Colors.transparent,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: isActive ? lokmaPink : Colors.grey[400]!,
                  width: 1.5,
                ),
              ),
              child: isActive
                  ? const Icon(Icons.check, color: Colors.white, size: 16)
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSheetSortOption(String label, String selectedSort, bool isDark, Function(String) onSelect) {
    final selected = selectedSort == label;
    final textColor = isDark ? Colors.white : Colors.black87;
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onSelect(label);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        child: Row(
          children: [
            Expanded(
              child: Text(label, style: TextStyle(color: textColor, fontSize: 15)),
            ),
            // Radio button
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? lokmaPink : Colors.transparent,
                border: Border.all(
                  color: selected ? lokmaPink : Colors.grey[400]!,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? Center(
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                        ),
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }


  Widget _buildLoadingState(bool isDark) {
    final accent = isDark ? lokmaPink : lokmaPink;
    final textColor = isDark ? Colors.white.withOpacity(0.5) : Colors.black54;
    
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation<Color>(accent),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Aranıyor...',
            style: TextStyle(color: textColor, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark, Color textColor) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🔍', style: TextStyle(fontSize: 48)),
          const SizedBox(height: 16),
          Text(
            tr('search.sonuc_bulunamadi'),
            style: TextStyle(color: textColor.withOpacity(0.6), fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            'Farklı bir arama terimi deneyin',
            style: TextStyle(color: textColor.withOpacity(0.4), fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestionsState(bool isDark, Color textColor, Color cardColor) {
    // 🆕 Sade UI - Boş ekran (Popüler Aramalar kaldırıldı)
    return const SizedBox.shrink();
  }

  Widget _buildResults(List<SearchResultGroup> groups, bool isDark, Color textColor, Color cardColor) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 12),
      itemCount: groups.length,
      itemBuilder: (context, index) {
        return _buildResultSection(groups[index], isDark, textColor, cardColor);
      },
    );
  }

  Widget _buildResultSection(SearchResultGroup group, bool isDark, Color textColor, Color cardColor) {
    // 🔧 Use class-level expanded state tracking
    final isExpanded = _expandedGroups.contains(group.title);
    final visibleResults = isExpanded 
        ? group.results 
        : group.results.take(group.visibleCount).toList();
    final hasMore = group.results.length > group.visibleCount;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Header
          Row(
            children: [
              Text(
                group.title,
                style: TextStyle(
                  color: textColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '${group.results.length}',
                style: TextStyle(
                  color: isDark ? Colors.grey[500] : Colors.grey[600], 
                  fontSize: 14, 
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          
          // Results
          ...visibleResults.map((result) => _buildResultItem(result, isDark, textColor, cardColor)),
          
          // Expand button - only show if there are more results
          if (hasMore && !isExpanded)
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                setState(() => _expandedGroups.add(group.title));
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10),
                margin: const EdgeInsets.only(top: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      tr('search.daha_fazla_goster'),
                      style: TextStyle(color: lokmaPink, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.keyboard_arrow_down_rounded, color: lokmaPink, size: 18),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildResultItem(SearchResult result, bool isDark, Color textColor, Color cardColor) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        if (result.type == SearchResultType.category) {
          // Kategori tıklandığında, o sektördeki işletmeleri ara
          // result.title = "Pastane", we need to extract sector type from it
          final sectorType = result.title.toLowerCase();
          ref.read(searchProvider.notifier).searchBySector(sectorType, result.title);
        } else if (result.route != null) {
          context.push(result.route!);  // push instead of go, so back button works
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: textColor.withOpacity(0.05)),
        ),
        child: Row(
          children: [
            // Image/Icon
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: lokmaPink.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: result.imageUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        result.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _buildPlaceholderIcon(result.type),
                      ),
                    )
                  : _buildPlaceholderIcon(result.type),
            ),
            const SizedBox(width: 14),
            
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    result.title,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    result.subtitle,
                    style: TextStyle(
                      color: textColor.withOpacity(0.5),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            
            // 🆕 Sade buton - sadece ok ikonu
            Icon(
              Icons.chevron_right_rounded,
              color: lokmaPink,
              size: 24,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderIcon(SearchResultType type) {
    String icon;
    switch (type) {
      case SearchResultType.vendor:
        icon = '🏪';
        break;
      case SearchResultType.product:
        icon = '📦';
        break;
      case SearchResultType.category:
        icon = '📂';
        break;
    }
    return Center(child: Text(icon, style: const TextStyle(fontSize: 24)));
  }
}
