import 'package:flutter/material.dart';

class LokmaBadgeIcon extends StatelessWidget {
  final IconData icon;
  final Color? iconColor;
  final int badgeCount;
  final VoidCallback onTap;
  final EdgeInsetsGeometry padding;

  const LokmaBadgeIcon({
    super.key,
    required this.icon,
    required this.badgeCount,
    required this.onTap,
    this.iconColor,
    this.padding = const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: padding,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Background Circle + Icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withOpacity(0.08)
                    : Colors.black.withOpacity(0.05),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Icon(
                  icon,
                  color: iconColor ?? (isDark ? Colors.white70 : Colors.grey[800]),
                  size: 22,
                ),
              ),
            ),
            // Red Circle Badge
            if (badgeCount > 0)
              Positioned(
                top: -2,
                right: -2,
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF3B30), // Standard iOS Red
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      width: 1.5,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      badgeCount > 9 ? '9+' : badgeCount.toString(),
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: badgeCount > 9 ? 9 : 11,
                        fontWeight: FontWeight.bold,
                        height: 1, // Standard centering
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
