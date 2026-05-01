import re

file_path = "mobile_app/lib/screens/marketplace/kasap/business_detail_screen.dart"

with open(file_path, "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    # Skip _scrollChipBarToSelected in _selectCategory
    if "_scrollChipBarToSelected(category);" in line:
        continue
    # Skip _updatePillPosition in _selectCategory
    if "WidgetsBinding.instance.addPostFrameCallback((_) {" in line and i + 1 < len(lines) and "_updatePillPosition(category);" in lines[i+1]:
        skip = True
        continue
    if skip and "});" in line:
        skip = False
        continue
    if skip:
        continue

    # Skip _updatePillPosition in _onMenuScroll
    if "WidgetsBinding.instance.addPostFrameCallback((_) {" in line and i + 1 < len(lines) and "_updatePillPosition('marketplace.category_all'.tr());" in lines[i+1]:
        skip = True
        continue
    
    # Skip _scrollChipBarToSelected in _onMenuScroll
    if "Future.delayed(const Duration(milliseconds: 50), () {" in line and i + 2 < len(lines) and "_scrollChipBarToSelected('marketplace.category_all'.tr());" in lines[i+2]:
        skip = True
        continue
        
    # Skip _updatePillPosition in _onMenuScroll later loop
    if "if (mounted) _updatePillPosition(visibleCategory!); // Slide pill" in line or "if (mounted) _updatePillPosition(visibleCategory!);" in line:
        continue
        
    # Skip _scrollChipBarToSelected in _onMenuScroll later loop
    if "if (mounted) _scrollChipBarToSelected(visibleCategory!); // Scroll chips" in line or "if (mounted) _scrollChipBarToSelected(visibleCategory!);" in line:
        continue

    # Skip _updatePillPosition in dispose or other places just in case
    
    new_lines.append(line)

content = "".join(new_lines)

# Now remove any remaining _scrollChipBarToSelected calls that might have been wrapped
content = re.sub(r"\s*// Auto-scroll the chip bar to show the selected chip fully\n", "", content)
content = re.sub(r"\s*// Slide the pill to the new chip position\n", "", content)

# Now replace the Builder block
builder_pattern = r"                              Expanded\(\n                                child: Builder\(\n                                  builder: \(context\) \{.*?return SingleChildScrollView\(.*?key: _chipRowKey,.*?Row\(.*?\}\),\n                                            \),\n                                          \),\n                                        \],\n                                      \),\n                                    \);\n                                  \},\n                                \),\n                              \),"

replacement = """                              Expanded(
                                child: _StickyCategoryTabs(
                                  effectiveCategories: _effectiveCategories,
                                  allProducts: _allProducts,
                                  selectedCategory: _selectedCategory,
                                  onSelectCategory: _selectCategory,
                                  cartItems: ref.watch(cartProvider).items,
                                  isDark: isDark,
                                ),
                              ),"""

content = re.sub(builder_pattern, replacement, content, flags=re.DOTALL)


with open(file_path, "w") as f:
    f.write(content)

print("Done")
