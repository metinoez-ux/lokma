import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A clean, minimal segmented button for checkout screens.
/// Lieferando-inspired: black pill style, neutral aesthetic.
class SimpleSegmentedToggle extends StatelessWidget {
  final int selectedIndex;
  final List<SimpleSegmentItem> items;
  final ValueChanged<int> onChanged;

  const SimpleSegmentedToggle({
    super.key,
    required this.selectedIndex,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final activeColor = isDark ? Colors.white : const Color(0xFF1A1A1A);
    final activeTextColor = isDark ? Colors.black : Colors.white;
    final trackColor =
        isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF0EDE8);
    final unselectedText = isDark ? Colors.grey[400]! : Colors.grey[600]!;

    return Container(
      height: 44,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: trackColor,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: List.generate(items.length, (i) {
          final isSelected = i == selectedIndex;
          final item = items[i];
          return Expanded(
            child: GestureDetector(
              onTap: () {
                if (i != selectedIndex) {
                  HapticFeedback.selectionClick();
                  onChanged(i);
                }
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeInOut,
                decoration: BoxDecoration(
                  color: isSelected ? activeColor : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: Colors.black
                                .withOpacity(isDark ? 0.3 : 0.12),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ]
                      : null,
                ),
                alignment: Alignment.center,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (item.icon != null) ...[
                      Icon(
                        item.icon,
                        size: 15,
                        color: isSelected ? activeTextColor : unselectedText,
                      ),
                      const SizedBox(width: 5),
                    ],
                    Flexible(
                      child: Text(
                        item.label,
                        style: TextStyle(
                          color: isSelected ? activeTextColor : unselectedText,
                          fontWeight:
                              isSelected ? FontWeight.w600 : FontWeight.w400,
                          fontSize: 13,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class SimpleSegmentItem {
  final String label;
  final IconData? icon;

  const SimpleSegmentItem({required this.label, this.icon});
}
