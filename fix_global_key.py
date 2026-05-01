import re

file_path = "mobile_app/lib/screens/marketplace/kasap/business_detail_screen.dart"

with open(file_path, "r") as f:
    content = f.read()

# 1. Remove state variables
content = re.sub(
    r"  final Map<String, GlobalKey> _tabKeys = \{\};\n  bool _isUserScrolling = true;\n  final ScrollController _chipScrollController = ScrollController\(\);\n\n  // Sliding pill indicator state\n  double _pillLeft = 0;\n  double _pillWidth = 60;\n  bool _pillInitialized = false;\n  final GlobalKey _chipRowKey = GlobalKey\(\);\n",
    r"  bool _isUserScrolling = true;\n",
    content
)

# 2. Remove _scrollChipBarToSelected method
content = re.sub(
    r"  /// Auto-scroll the horizontal chip bar so the selected chip is fully visible and centered\n  void _scrollChipBarToSelected.*?Curve: Curves\.easeOutCubic,\n    \);\n  }\n",
    "",
    content,
    flags=re.DOTALL
)

# 3. Remove _updatePillPosition method
content = re.sub(
    r"  /// Measure selected chip position and update pill indicator\n  void _updatePillPosition.*?\n        \}\);\n      \}\n    \}\n  }\n",
    "",
    content,
    flags=re.DOTALL
)

# 4. Remove calls in _selectCategory
content = content.replace("    _updatePillPosition();\n    _scrollChipBarToSelected(category);\n", "")

# 5. Remove _chipScrollController.dispose()
content = content.replace("    _chipScrollController.dispose();\n", "")

# 6. Replace Sticky Tab content
# This starts at 'SliverPersistentHeader(' and ends right after the closing of the Slivers List.
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

# 7. Append Widget
sticky_widget = """
// ----------------------------------------------------------------------
// Sticky Category Tabs Component
// ----------------------------------------------------------------------
class _StickyCategoryTabs extends StatefulWidget {
  final List<Map<String, dynamic>> effectiveCategories;
  final List<dynamic> allProducts;
  final String selectedCategory;
  final Function(String) onSelectCategory;
  final List<dynamic> cartItems;
  final bool isDark;

  const _StickyCategoryTabs({
    required this.effectiveCategories,
    required this.allProducts,
    required this.selectedCategory,
    required this.onSelectCategory,
    required this.cartItems,
    required this.isDark,
  });

  @override
  State<_StickyCategoryTabs> createState() => _StickyCategoryTabsState();
}

class _StickyCategoryTabsState extends State<_StickyCategoryTabs> {
  final Map<String, GlobalKey> _tabKeys = {};
  final GlobalKey _chipRowKey = GlobalKey();
  final ScrollController _chipScrollController = ScrollController();

  double _pillLeft = 0;
  double _pillWidth = 60;
  bool _pillInitialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updatePillPosition();
    });
  }

  @override
  void didUpdateWidget(_StickyCategoryTabs oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedCategory != widget.selectedCategory) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _updatePillPosition();
      });
      _scrollChipBarToSelected(widget.selectedCategory);
    }
  }

  @override
  void dispose() {
    _chipScrollController.dispose();
    super.dispose();
  }

  void _scrollChipBarToSelected(String category) {
    if (!_chipScrollController.hasClients) return;
    final tabKey = _tabKeys[category];
    if (tabKey == null || tabKey.currentContext == null) return;

    final RenderBox? chipBox = tabKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null) return;

    final chipPosition = chipBox.localToGlobal(Offset.zero);
    final chipWidth = chipBox.size.width;
    final screenWidth = MediaQuery.of(context).size.width;

    final chipCenter = chipPosition.dx + chipWidth / 2;
    final viewportCenter = screenWidth / 2;
    final scrollDelta = chipCenter - viewportCenter;

    final targetOffset = (_chipScrollController.offset + scrollDelta).clamp(
      0.0,
      _chipScrollController.position.maxScrollExtent,
    );

    _chipScrollController.animateTo(
      targetOffset,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
    );
  }

  void _updatePillPosition([String? cat]) {
    final category = cat ?? widget.selectedCategory;
    final tabKey = _tabKeys[category];
    if (tabKey?.currentContext == null || _chipRowKey.currentContext == null) return;

    final RenderBox? chipBox = tabKey!.currentContext!.findRenderObject() as RenderBox?;
    final RenderBox? rowBox = _chipRowKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null || rowBox == null) return;
    if (!chipBox.hasSize || !rowBox.hasSize) return;

    final globalChipOffset = chipBox.localToGlobal(Offset.zero);
    final localPositionInRow = rowBox.globalToLocal(globalChipOffset);

    setState(() {
      _pillLeft = localPositionInRow.dx;
      _pillWidth = chipBox.size.width;
      _pillInitialized = true;
    });
  }

  String _formatCategoryKey(String catName) {
    final parts = catName.split('_');
    if (parts.length > 2) {
      parts.removeAt(0);
      parts.removeAt(0);
      return parts.join('_').replaceAll('_', ' ');
    }
    return catName;
  }

  @override
  Widget build(BuildContext context) {
    final visibleCategories = widget.effectiveCategories
        .where((c) =>
            c['name'] == 'marketplace.category_all'.tr() ||
            c['name'] == 'marketplace.all_products'.tr() ||
            widget.allProducts.any((p) =>
                p.category == c['name'] ||
                (c['id'] != null && p.category == c['id'])))
        .toList();

    return SingleChildScrollView(
      controller: _chipScrollController,
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.only(left: 16, right: 4, top: 8, bottom: 8),
      child: Stack(
        alignment: Alignment.centerLeft,
        children: [
          AnimatedPositioned(
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOutBack,
            left: _pillLeft,
            top: 0,
            bottom: 0,
            child: AnimatedOpacity(
              opacity: _pillInitialized ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 200),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 400),
                curve: Curves.easeOutBack,
                width: _pillWidth > 0 ? _pillWidth : 80,
                decoration: BoxDecoration(
                  color: widget.isDark ? Colors.white : const Color(0xFF3E3E3F),
                  borderRadius: BorderRadius.circular(50),
                  boxShadow: [
                    BoxShadow(
                      color: (widget.isDark ? Colors.white : Colors.black).withOpacity(0.12),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Row(
            key: _chipRowKey,
            children: visibleCategories.map((cat) {
              final catName = cat['name'] as String;
              final isSelected = widget.selectedCategory == catName;
              final catCartCount = catName == 'marketplace.category_all'.tr()
                  ? widget.cartItems.fold<int>(0, (sum, ci) => sum + ci.quantity.toInt())
                  : widget.cartItems
                      .where((ci) => ci.product.category == catName)
                      .fold<int>(0, (sum, ci) => sum + ci.quantity.toInt());

              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: GestureDetector(
                  onTap: () => widget.onSelectCategory(catName),
                  child: Container(
                    key: _tabKeys.putIfAbsent(catName, () => GlobalKey()),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                    decoration: BoxDecoration(
                      color: Colors.transparent,
                      borderRadius: BorderRadius.circular(50),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedDefaultTextStyle(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeOutCubic,
                          style: TextStyle(
                            color: isSelected
                                ? (_pillInitialized
                                    ? (widget.isDark ? Colors.black : Colors.white)
                                    : (widget.isDark ? Colors.white : Colors.black87))
                                : (widget.isDark ? Colors.white70 : Colors.black54),
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                            fontSize: 14,
                          ),
                          child: Text(
                            catName == 'marketplace.category_all'.tr()
                                ? tr('business_details.all')
                                : _formatCategoryKey(catName),
                          ),
                        ),
                        if (catCartCount > 0) ...[
                          const SizedBox(width: 6),
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeOutBack,
                            width: 20,
                            height: 20,
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? (widget.isDark ? Colors.black : Colors.white)
                                  : const Color(0xFFF04E36),
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: AnimatedDefaultTextStyle(
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeOutCubic,
                              style: TextStyle(
                                color: isSelected
                                    ? (widget.isDark ? Colors.white : Colors.black)
                                    : Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                              child: Text('$catCartCount'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
"""

content += sticky_widget

with open(file_path, "w") as f:
    f.write(content)

print("Done")
