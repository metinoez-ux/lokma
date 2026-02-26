import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class TabItem {
  final String title;
  final IconData? icon;

  const TabItem({required this.title, this.icon});
}

class ThreeDimensionalPillTabBar extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Dark mode: koyu gri track, Light mode: açık gri track
    final trackColor = isDark ? const Color(0xFF2A2A2A) : Colors.grey[200]!;
    final shadowColor = isDark ? Colors.black.withValues(alpha: 0.4) : Colors.black.withValues(alpha: 0.08);
    final unselectedTextColor = isDark ? Colors.grey[400] : Colors.grey[700];
    
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
      child: Stack(
        children: [
          // Background labels (visible when not selected)
          Row(
            children: List.generate(tabs.length, (index) {
              return Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    onTabSelected(index);
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
          AnimatedAlign(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutBack, // Bouncy effect
            alignment: Alignment(
              // Map index 0..length-1 to -1..1
              -1 + (indexToAlignmentStep * selectedIndex),
              0,
            ),
            child: FractionallySizedBox(
              widthFactor: 1 / tabs.length,
              heightFactor: 0.85,
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      lokmaPinkLight,   // Light top (reflection)
                      lokmaPink,        // Main body
                      lokmaPinkDark,    // Shadow bottom
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
                        color: lokmaPink.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 0),
                      ),
                  ],
                ),
                alignment: Alignment.center,
                child: _buildTabContent(selectedIndex, true, Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabContent(int index, bool isSelected, Color? textColor) {
    final tab = tabs[index];
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

  // Calculate alignment step based on tab count
  double get indexToAlignmentStep {
    if (tabs.length <= 1) return 0;
    return 2.0 / (tabs.length - 1);
  }
}
