import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Kermes kategori chip'leri - sliding pill animasyonu ile
/// Aynen detail ekranindaki gibi yay (bounce) animasyonu yapar
class KermesCategoryChips extends StatefulWidget {
  final List<String> categories;
  final String selectedCategory;
  final ValueChanged<String> onCategorySelected;
  final Color backgroundColor;

  const KermesCategoryChips({
    super.key,
    required this.categories,
    required this.selectedCategory,
    required this.onCategorySelected,
    required this.backgroundColor,
  });

  @override
  State<KermesCategoryChips> createState() => _KermesCategoryChipsState();
}

class _KermesCategoryChipsState extends State<KermesCategoryChips> {
  final Map<String, GlobalKey> _tabKeys = {};
  final ScrollController _chipScrollController = ScrollController();
  final ValueNotifier<double> _pillLeft = ValueNotifier(0.0);
  final ValueNotifier<double> _pillWidth = ValueNotifier(60.0);
  final ValueNotifier<bool> _pillInitialized = ValueNotifier(false);
  final GlobalKey _chipRowKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _updatePillPosition(widget.selectedCategory);
    });
  }

  @override
  void didUpdateWidget(KermesCategoryChips oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedCategory != widget.selectedCategory) {
      _scrollChipBarToSelected(widget.selectedCategory);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _updatePillPosition(widget.selectedCategory);
      });
    }
  }

  @override
  void dispose() {
    _chipScrollController.dispose();
    _pillLeft.dispose();
    _pillWidth.dispose();
    _pillInitialized.dispose();
    super.dispose();
  }

  void _scrollChipBarToSelected(String category) {
    if (!_chipScrollController.hasClients) return;
    final tabKey = _tabKeys[category];
    if (tabKey == null || tabKey.currentContext == null) return;

    final RenderBox? chipBox =
        tabKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null) return;

    final chipPosition = chipBox.localToGlobal(Offset.zero);
    final chipWidth = chipBox.size.width;
    final viewportWidth = _chipScrollController.position.viewportDimension;

    final chipCenter = chipPosition.dx + chipWidth / 2;
    final viewportCenter = viewportWidth / 2;
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

  void _updatePillPosition(String category) {
    final tabKey = _tabKeys[category];
    if (tabKey?.currentContext == null || _chipRowKey.currentContext == null) {
      return;
    }

    final RenderBox? chipBox =
        tabKey?.currentContext?.findRenderObject() as RenderBox?;
    final RenderBox? rowBox =
        _chipRowKey.currentContext!.findRenderObject() as RenderBox?;
    if (chipBox == null || rowBox == null) return;

    final chipPos = chipBox.localToGlobal(Offset.zero, ancestor: rowBox);

    if (mounted) {
      _pillLeft.value = chipPos.dx;
      _pillWidth.value = chipBox.size.width;
      _pillInitialized.value = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      color: widget.backgroundColor,
      height: 52,
      child: Column(
        children: [
          AnimatedBuilder(
            animation: Listenable.merge([_pillLeft, _pillWidth, _pillInitialized]),
            builder: (context, _) {
              return Expanded(
                child: SingleChildScrollView(
                  controller: _chipScrollController,
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(
                      left: 16, right: 4, top: 4, bottom: 8),
                  child: Stack(
                    alignment: Alignment.centerLeft,
                    children: [
                      // Sliding pill indicator
                      if (_pillInitialized.value)
                        AnimatedPositioned(
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeOutBack,
                          left: _pillLeft.value,
                          top: 0,
                          bottom: 0,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 400),
                            curve: Curves.easeOutBack,
                            width: _pillWidth.value,
                            decoration: BoxDecoration(
                              color: isDark
                                  ? Colors.white
                                  : const Color(0xFF3E3E3F),
                              borderRadius: BorderRadius.circular(50),
                              boxShadow: [
                                BoxShadow(
                                  color: (isDark ? Colors.white : Colors.black)
                                      .withOpacity(0.12),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                          ),
                        ),
                      // Chip texts row
                      Row(
                        key: _chipRowKey,
                        children: widget.categories.map((category) {
                          _tabKeys.putIfAbsent(category, () => GlobalKey());
                          final isSelected =
                              category == widget.selectedCategory;

                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: GestureDetector(
                              onTap: () {
                                HapticFeedback.selectionClick();
                                widget.onCategorySelected(category);
                              },
                              child: Container(
                                key: _tabKeys[category],
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 7),
                                decoration: BoxDecoration(
                                  color: Colors.transparent,
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                child: AnimatedDefaultTextStyle(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeOutCubic,
                                  style: TextStyle(
                                    color: isSelected
                                        ? (isDark
                                            ? Colors.black
                                            : Colors.white)
                                        : (isDark
                                            ? Colors.white70
                                            : Colors.black54),
                                    fontWeight: isSelected
                                        ? FontWeight.w700
                                        : FontWeight.w500,
                                    fontSize: 14,
                                  ),
                                  child: Text(category),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          Divider(
            height: 1,
            thickness: 0.5,
            color: isDark
                ? Colors.white.withOpacity(0.1)
                : Colors.grey[300],
          ),
        ],
      ),
    );
  }
}

/// SliverPersistentHeaderDelegate for category chips
class KermesCategoryHeaderDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  KermesCategoryHeaderDelegate({required this.child});

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => child;

  @override
  double get maxExtent => 52;

  @override
  double get minExtent => 52;

  @override
  bool shouldRebuild(covariant KermesCategoryHeaderDelegate oldDelegate) => true;
}
