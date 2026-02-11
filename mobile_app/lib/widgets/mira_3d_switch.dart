import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A reusable 3D-style toggle switch with haptic feedback
/// Matches the premium MIRA design language with recessed depth effect
class Mira3DSwitch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final Color activeColor;
  final double width;
  final double height;

  const Mira3DSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.activeColor = const Color(0xFFFB335B),
    this.width = 50,
    this.height = 30,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        onChanged(!value);
      },
      child: SizedBox(
        width: width,
        height: height,
        child: Stack(
          children: [
            // Track with 3D recessed depth effect
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(height / 2),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: value
                      ? [
                          // Active state: user requested RED background like before
                          Color.lerp(activeColor, Colors.black, 0.6)!,
                          Color.lerp(activeColor, Colors.black, 0.4)!,
                          Color.lerp(activeColor, Colors.black, 0.3)!,
                          activeColor.withOpacity(0.9),
                        ]
                      : [
                          // Inactive state: pure black/gray matte recessed
                          const Color(0xFF080808),
                          const Color(0xFF121212),
                          const Color(0xFF1A1A1A),
                          const Color(0xFF1A1A1A),
                        ],
                  stops: const [0.0, 0.3, 0.6, 1.0],
                ),
                boxShadow: value
                    ? [
                        BoxShadow(
                          color: activeColor.withOpacity(0.2),
                          blurRadius: 6,
                          spreadRadius: 0,
                        ),
                      ]
                    : null,
              ),
              // Inner shadow overlay for depth
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(height / 2),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withOpacity(0.4),
                      Colors.black.withOpacity(0.15),
                      Colors.transparent,
                      Colors.white.withOpacity(0.08),
                    ],
                    stops: const [0.0, 0.25, 0.6, 1.0],
                  ),
                ),
              ),
            ),
            // Animated knob
            AnimatedAlign(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeInOut,
              alignment: value ? Alignment.centerRight : Alignment.centerLeft,
              child: Container(
                width: height - 4,
                height: height - 4,
                margin: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: value
                        ? [
                            Color.lerp(activeColor, Colors.white, 0.2)!,
                            activeColor,
                          ]
                        : [
                            const Color(0xFF5A5A5A),
                            const Color(0xFF3A3A3A),
                          ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: value
                          ? activeColor.withOpacity(0.4)
                          : Colors.black.withOpacity(0.5),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
