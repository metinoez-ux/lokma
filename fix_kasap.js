const fs = require('fs');
const file = "mobile_app/lib/screens/marketplace/kasap/business_detail_screen.dart";
let content = fs.readFileSync(file, 'utf8');

// 1. Remove variables
content = content.replace(/final Map<String, GlobalKey> _tabKeys = {};[\s\S]*?final GlobalKey _chipRowKey = GlobalKey\(\);\n/, '');

// 2. Remove _scrollChipBarToSelected method implementation
const scrollMethodStart = content.indexOf('void _scrollChipBarToSelected(String category) {');
if (scrollMethodStart !== -1) {
    const scrollMethodEnd = content.indexOf('}\n\n  void _onMenuScroll() {', scrollMethodStart);
    if (scrollMethodEnd !== -1) {
        content = content.substring(0, scrollMethodStart) + content.substring(scrollMethodEnd + 2); // +2 to remove }\n
    }
}

// 3. Remove _updatePillPosition method implementation
const updatePillStart = content.indexOf('void _updatePillPosition([String? cat]) {');
if (updatePillStart !== -1) {
    let updatePillEnd = content.indexOf('}\n\n  @override\n  Widget build(BuildContext context)', updatePillStart);
    if (updatePillEnd === -1) {
        updatePillEnd = content.indexOf('}\n\n  Widget _buildSearchAndCategory()', updatePillStart);
    }
    if (updatePillEnd !== -1) {
        content = content.substring(0, updatePillStart) + content.substring(updatePillEnd + 2);
    }
}

// 4. Remove the Builder from SliverPersistentHeader
const builderStart = content.indexOf('child: Builder(');
if (builderStart !== -1) {
    // Find the end of Expanded( child: Builder(...) )
    const expandedStart = content.lastIndexOf('Expanded(', builderStart);
    const sliverHeaderStart = content.lastIndexOf('SliverPersistentHeader(', expandedStart);
    
    // We can just replace the entire Expanded child.
    const rowEnd = content.indexOf('// 4. Products List', expandedStart);
    if (rowEnd !== -1) {
        // find the end of the Expanded widget.
        const builderStr = `Expanded(
                                child: Builder(
                                  builder: (context) {`;
        const expandedPattern = /Expanded\([\s\S]*?child: Builder\([\s\S]*?Row\([\s\S]*?\}\),\n\s*\),\n\s*\),\n\s*\],\n\s*\),\n\s*\);\n\s*\},\n\s*\),\n\s*\),/m;
        
        content = content.replace(expandedPattern, `Expanded(
                                child: _StickyCategoryTabs(
                                  effectiveCategories: _effectiveCategories,
                                  allProducts: _allProducts,
                                  selectedCategory: _selectedCategory,
                                  onSelectCategory: _selectCategory,
                                  cartItems: ref.watch(cartProvider).items,
                                  isDark: isDark,
                                ),
                              ),`);
    }
}

// 5. Fix the fold error in _StickyCategoryTabs if present
content = content.replace(/fold<int>\(0, \(sum, ci\) => sum \+ ci\.quantity\.toInt\(\)\)/g, "fold<int>(0, (int sum, ci) => sum + ci.quantity.toInt())");

fs.writeFileSync(file, content);
console.log("Done");
