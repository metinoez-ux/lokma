import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class TabItem {
  final String title;
  final IconData? icon;

  const TabItem({required this.title, this.icon});
}

class ThreeDimensionalPillTabBar extends StatefulWidget {
  final int selectedIndex;
  final Function(int) onTabSelected;
  final List<TabItem> tabs;

  const ThreeDimensionalPillTabBar({
    super.key,
    required this.selectedIndex,
    required this.onTabSelected,
    required this.tabs,
  });

  // 🎨 BRAND COLOUR - LOKMA Rose (#FB335B) with gradient shades
  static const Color lokmaPink = Color(0xFFFB335B);      // Main brand color
  static const Color lokmaPinkLight = Color(0xFFF54D4D); // Light top (reflection)
  static const Color lokmaPinkDark = Color(0xFFC41017);  // Dark shadow bottom

  @override
  State<ThreeDimensionalPillTabBar> createState() => _ThreeDimensionalPillTabBarState();
}

class _ThreeDimensionalPillTabBarState extends State<ThreeDimensionalPillTabBar> {

  /// Drag offset from the pill's "home" position, in alignment units (-1..1).
  /// null means no drag is in progress; the pill sits at `selectedIndex`.
  double? _dragAlignment;

  /// Width of a single tab segment (set in build via LayoutBuilder).
  double _segmentWidth = 0;

  // Helper: convert a tab index to its alignment value (-1..1).
  double _indexToAlignment(int index) {
    if (widget.tabs.length <= 1) return 0;
    final step = 2.0 / (widget.tabs.length - 1);
    return -1 + (step * index);
  }

  // Clamp alignment to valid range.
  double _clampAlignment(double a) => a.clamp(-1.0, 1.0);

  // Convert an alignment value (-1..1) to the nearest tab index.
  int _alignmentToIndex(double a) {
    if (widget.tabs.length <= 1) return 0;
    final step = 2.0 / (widget.tabs.length - 1);
    final raw = (a + 1) / step;
    return raw.round().clamp(0, widget.tabs.length - 1);
  }

  void _onHorizontalDragUpdate(DragUpdateDetails d) {
    if (_segmentWidth <= 0) return;
    // Convert pixel delta to alignment delta.
    // Full container spans alignment -1..1 (range 2), width = tabs.length * segmentWidth.
    final totalWidth = widget.tabs.length * _segmentWidth;
    final deltaAlignment = (d.delta.dx / totalWidth) * 2.0;

    setState(() {
      _dragAlignment = _clampAlignment(
        (_dragAlignment ?? _indexToAlignment(widget.selectedIndex)) + deltaAlignment,
      );
    });
  }

  void _onHorizontalDragEnd(DragEndDetails d) {
    if (_dragAlignment == null) return;
    final newIndex = _alignmentToIndex(_dragAlignment!);
    setState(() {
      _dragAlignment = null; // snap to index
    });
    if (newIndex != widget.selectedIndex) {
      HapticFeedback.lightImpact();
      widget.onTabSelected(newIndex);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Dark mode: koyu gri track, Light mode: açık gri track
    final trackColor = isDark ? const Color(0xFF2A2A2A) : Colors.grey[200]!;
    final shadowColor = isDark ? Colors.black.withValues(alpha: 0.4) : Colors.black.withValues(alpha: 0.08);
    final unselectedTextColor = isDark ? Colors.grey[400] : Colors.grey[700];

    // Current alignment: drag in progress → use drag value, otherwise snap to selected index.
    final currentAlignment = _dragAlignment ?? _indexToAlignment(widget.selectedIndex);
    // During drag, resolve which index the pill is near (for label highlighting).
    final visualIndex = _dragAlignment != null ? _alignmentToIndex(_dragAlignment!) : widget.selectedIndex;
    
    return LayoutBuilder(
      builder: (context, constraints) {
        _segmentWidth = constraints.maxWidth / widget.tabs.length;

        return Container(
          height: 48,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          decoration: BoxDecoration(
            color: trackColor,
            borderRadius: BorderRadius.circular(24),
            // 3D inset/track shadow
            boxShadow: [
              // Outer shadow for depth
              BoxShadow(
                color: shadowColor,
                blurRadius: isDark ? 4 : 2,
                offset: const Offset(0, 1),
                spreadRadius: 0,
              ),
            ],
            // Inner shadow effect for inset look
            border: isDark 
                ? Border.all(color: Colors.white.withValues(alpha: 0.05), width: 0.5)
                : null,
          ),
          child: GestureDetector(
            onHorizontalDragUpdate: _onHorizontalDragUpdate,
            onHorizontalDragEnd: _onHorizontalDragEnd,
            behavior: HitTestBehavior.opaque,
            child: Stack(
              children: [
                // Background labels (visible when not selected)
                Row(
                  children: List.generate(widget.tabs.length, (index) {
                    return Expanded(
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          widget.onTabSelected(index);
                        },
                        child: Container(
                          color: Colors.transparent, // Hit area
                          alignment: Alignment.center,
                          child: _buildTabContent(index, false, unselectedTextColor),
                        ),
                      ),
                    );
                  }),
                ),
                
                // The Pill (Sliding Indicator) - 3D Rose-500 pill with depth
                // When dragging, disable animation for instant feedback.
                AnimatedAlign(
                  duration: _dragAlignment != null
                      ? Duration.zero
                      : const Duration(milliseconds: 250),
                  curve: Curves.easeOutBack, // Bouncy effect when snapping
                  alignment: Alignment(currentAlignment, 0),
                  child: FractionallySizedBox(
                    widthFactor: 1 / widget.tabs.length,
                    heightFactor: 0.85,
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            ThreeDimensionalPillTabBar.lokmaPinkLight,   // Light top (reflection)
                            ThreeDimensionalPillTabBar.lokmaPink,        // Main body
                            ThreeDimensionalPillTabBar.lokmaPinkDark,    // Shadow bottom
                          ],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          // Drop shadow for 3D lift - stronger in dark mode
                          BoxShadow(
                            color: isDark 
                                ? Colors.black.withValues(alpha: 0.5) 
                                : Colors.black.withValues(alpha: 0.2),
                            blurRadius: isDark ? 6 : 4,
                            offset: const Offset(0, 2),
                          ),
                          // Glow effect in dark mode
                          if (isDark)
                            BoxShadow(
                              color: ThreeDimensionalPillTabBar.lokmaPink.withValues(alpha: 0.3),
                              blurRadius: 8,
                              offset: const Offset(0, 0),
                            ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: _buildTabContent(visualIndex, true, Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTabContent(int index, bool isSelected, Color? textColor) {
    final tab = widget.tabs[index];
    final color = textColor;
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (tab.icon != null) ...[
          Icon(
            tab.icon,
            color: color,
            size: 20,
          ),
          const SizedBox(width: 6),
        ],
        Flexible(
          child: Text(
            tab.title,
            style: TextStyle(
              color: color,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
              fontSize: 13,
              overflow: TextOverflow.ellipsis,
              shadows: isSelected
                  ? [
                      const Shadow(
                        color: Colors.black26,
                        offset: Offset(0, 1),
                        blurRadius: 1,
                      ),
                    ]
                  : null,
            ),
            maxLines: 1,
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }
}
