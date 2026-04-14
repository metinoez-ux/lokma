import sys

target = "/Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/screens/marketplace/market/market_screen.dart"
with open(target, "r") as f:
    data = f.read()

# 1. State variables
data = data.replace(
    "bool _filterTunaProducts = false;   // 🔴 TUNA ürünleri satan işletmeler\n  bool _filterTorosProducts = false;  // 🟢 Toros ürünleri satan işletmeler",
    "bool _filterBrandButchers = false;  // 🔴 TUNA/Toros Kasapları\n  bool _filterBrandProducts = false;  // 🔴 TUNA/Toros Hazır Ürünleri"
)

# 2. Inside _filteredBusinesses
old_filter_logic = """      // 🔴 TUNA Ürünleri filtresi
      if (_filterTunaProducts) {
        final sellsTunaProducts = data['sellsTunaProducts'] as bool? ?? false;
        if (!sellsTunaProducts) return false;
      }
      
      // 🟢 Toros Ürünleri filtresi
      if (_filterTorosProducts) {
        final sellsTorosProducts = data['sellsTorosProducts'] as bool? ?? false;
        if (!sellsTorosProducts) return false;
      }"""

new_filter_logic = """      final userLocation = ref.read(userLocationProvider).value;
      final isTurkeyRegion = userLocation?.isTurkeyRegion == true;

      // 🔴 Marka Rozetli İşletmeler (TUNA veya Toros Kasapları)
      if (_filterBrandButchers) {
        bool hasBrand = false;
        final targetKeyword = isTurkeyRegion ? 'toros' : 'tuna';
        final brandLabel = data['brand'] as String?;
        if (brandLabel != null && brandLabel.contains(targetKeyword)) {
            hasBrand = true;
        } else {
            final activeBrandIds = List<String>.from(data['activeBrandIds'] ?? []);
            if (activeBrandIds.isNotEmpty) {
                final platformBrandsAsync = ref.read(platformBrandsProvider);
                if (platformBrandsAsync.value != null) {
                    for (final brandId in activeBrandIds) {
                        try {
                            final brand = platformBrandsAsync.value!.firstWhere((b) => b.id == brandId);
                            if (brand.name.toString().toLowerCase().contains(targetKeyword)) {
                                hasBrand = true;
                                break;
                            }
                        } catch (_) {}
                    }
                }
            }
        }
        if (!hasBrand) return false;
      }

      // 🔴 Hazır Ürün Satanlar filtresi
      if (_filterBrandProducts) {
        if (isTurkeyRegion) {
          final sellsTorosProducts = data['sellsTorosProducts'] as bool? ?? false;
          if (!sellsTorosProducts) return false;
        } else {
          final sellsTunaProducts = data['sellsTunaProducts'] as bool? ?? false;
          if (!sellsTunaProducts) return false;
        }
      }"""
data = data.replace(old_filter_logic, new_filter_logic)

# 3. sorting 'tuna' block remove
sort_block_start = "case 'tuna': // Tuna Sıralaması"
sort_block = """        case 'tuna': // Tuna Sıralaması (Premium Tuna marks first)
          bool hasDynamicBrandA = false;
          final activeBrandIdsA = List<String>.from(dataA['activeBrandIds'] ?? []);
          if (activeBrandIdsA.isNotEmpty) {
            final platformBrandsAsync = ref.read(platformBrandsProvider);
            if (platformBrandsAsync.value != null) {
              for (final brandId in activeBrandIdsA) {
                try {
                  final brand = platformBrandsAsync.value!.firstWhere((b) => b.id == brandId);
                  final name = brand.name.toString().toLowerCase();
                  if (name.contains('tuna') || name.contains('toros')) {
                    hasDynamicBrandA = true;
                    break;
                  }
                } catch (e) { }
              }
            }
          }
          final bool isBrandA = hasDynamicBrandA || dataA['brand'] == 'tuna' || dataA['brand'] == 'akdeniz_toros';
          
          bool hasDynamicBrandB = false;
          final activeBrandIdsB = List<String>.from(dataB['activeBrandIds'] ?? []);
          if (activeBrandIdsB.isNotEmpty) {
            final platformBrandsAsync = ref.read(platformBrandsProvider);
            if (platformBrandsAsync.value != null) {
              for (final brandId in activeBrandIdsB) {
                try {
                  final brand = platformBrandsAsync.value!.firstWhere((b) => b.id == brandId);
                  final name = brand.name.toString().toLowerCase();
                  if (name.contains('tuna') || name.contains('toros')) {
                    hasDynamicBrandB = true;
                    break;
                  }
                } catch (e) { }
              }
            }
          }
          final bool isBrandB = hasDynamicBrandB || dataB['brand'] == 'tuna' || dataB['brand'] == 'akdeniz_toros';
          
          if (isBrandA && !isBrandB) return -1;
          if (!isBrandA && isBrandB) return 1;
          
          // Eğer ikisi de TUNA/Toros ise mesafeye göre sırala
          final distanceA = (dataA['distance'] as num?)?.toDouble() ?? 99999.0;
          final distanceB = (dataB['distance'] as num?)?.toDouble() ?? 99999.0;
          return distanceA.compareTo(distanceB);"""
data = data.replace(sort_block + "\n          ", "")

# 4. _filterActive checking lines
data = data.replace("_filterVegetarian || _filterTunaProducts || _filterTorosProducts)", "_filterVegetarian || _filterBrandButchers || _filterBrandProducts)")
data = data.replace("bool get _hasActiveFilters =>", "bool get _hasActiveFilters => _filterBrandButchers || _filterBrandProducts ||")

# 5. Clear filters
data = data.replace("_filterTunaProducts = false;\n                              _filterTorosProducts = false;", "_filterBrandButchers = false;\n                              _filterBrandProducts = false;")

# 6. Remove Tuna sorting UI block
ui_sort_block = """                          _buildFilterListItem(
                            title: 'TUNA',
                            subtitle: tr('marketplace.filter_recommended'),
                            isSelected: _sortOption == 'tuna',
                            useRadio: true,
                            isPremium: true,
                            onTap: () {
                              setState(() => _sortOption = 'tuna');
                              setStateSheet(() {});
                            },
                          ),"""
data = data.replace(ui_sort_block, "")

# 7. Replace Quick Filter UI block
old_ui_filter_block = """                          // 🔴 TUNA Ürünleri Filtresi
                          _buildFilterListItem(
                            title: 'TUNA Ürünleri',
                            subtitle: '🔴 TUNA markalı ürünler satan işletmeler',
                            isSelected: _filterTunaProducts,
                            onTap: () {
                              setState(() => _filterTunaProducts = !_filterTunaProducts);
                              setStateSheet(() {});
                            },
                            isPremium: true,
                          ),
                          
                          // 🟢 Akdeniz Toros Ürünleri Filtresi
                          _buildFilterListItem(
                            title: 'Akdeniz Toros Ürünleri',
                            subtitle: '🟢 Akdeniz Toros markalı ürünler satan işletmeler',
                            isSelected: _filterTorosProducts,
                            onTap: () {
                              setState(() => _filterTorosProducts = !_filterTorosProducts);
                              setStateSheet(() {});
                            },
                            isPremium: true,
                          ),"""

new_ui_filter_block = """                          // 🔴 TUNA/Toros Ürünleri Filtresi (EN ÜSTTE)
                          Builder(
                            builder: (context) {
                              final userLocation = ref.read(userLocationProvider).value;
                              final isTurkeyRegion = userLocation?.isTurkeyRegion == true;
                              
                              return Column(
                                children: [
                                  _buildFilterListItem(
                                    title: isTurkeyRegion ? 'Akdeniz Toros Kasapları' : 'TUNA Kasapları',
                                    subtitle: isTurkeyRegion 
                                        ? '🟢 Sadece Akdeniz Toros sertifikalı işletmeler'
                                        : '🔴 Sadece TUNA sertifikalı işletmeler',
                                    isSelected: _filterBrandButchers,
                                    onTap: () {
                                      setState(() => _filterBrandButchers = !_filterBrandButchers);
                                      setStateSheet(() {});
                                    },
                                    isPremium: true,
                                  ),
                                  _buildFilterListItem(
                                    title: isTurkeyRegion ? 'Akdeniz Toros Ürünleri' : 'TUNA Ürünleri',
                                    subtitle: isTurkeyRegion 
                                        ? '🟢 Akdeniz Toros markalı hazır ürünler satan işletmeler'
                                        : '🔴 TUNA markalı hazır ürünler satan işletmeler',
                                    isSelected: _filterBrandProducts,
                                    onTap: () {
                                      setState(() => _filterBrandProducts = !_filterBrandProducts);
                                      setStateSheet(() {});
                                    },
                                  ),
                                ],
                              );
                            },
                          ),"""
data = data.replace(old_ui_filter_block, new_ui_filter_block)

with open(target, "w") as f:
    f.write(data)

print("Script execution completed")
