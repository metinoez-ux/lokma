import 'dart:ui';
import 'package:flutter/material.dart';

/// A reusable widget that implements an Apple-like modern glassmorphism
/// effect natively in Flutter, utilizing BackdropFilter and ImageFilter.blur.
class AppleGlassContainer extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry? margin;
  final EdgeInsetsGeometry? padding;
  final double blurSigmaX;
  final double blurSigmaY;
  final double? width;
  final double? height;

  const AppleGlassContainer({
    super.key,
    required this.child,
    this.borderRadius = 16.0,
    this.margin,
    this.padding,
    this.blurSigmaX = 35.0, // Extremely high blur for liquid glass
    this.blurSigmaY = 35.0,
    this.width,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Subtle edge highlight mimicking iOS reflections
    final borderColor = isDark
        ? Colors.white.withOpacity(0.10)
        : Colors.white.withOpacity(0.30);

    // Main translucent tint color
    // A slight white/dark tint that acts like iOS systemMaterial.
    // It appears opaque over white, and transparent over black.
    final tintColor = isDark
        ? const Color(0xFF1C1C1E).withOpacity(0.25)
        : Colors.white.withOpacity(0.20);

    return Container(
      margin: margin,
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          // A soft, diffused shadow behind the glass for a premium floating effect
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.5 : 0.08),
            blurRadius: 24,
            spreadRadius: -4,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blurSigmaX, sigmaY: blurSigmaY),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              color: tintColor,
              borderRadius: BorderRadius.circular(borderRadius),
              border: Border.all(
                color: borderColor,
                width: 0.5,
              ),
              // Subtle gradient for realistic reflection (brighter top-left)
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  isDark
                      ? Colors.white.withOpacity(0.1)
                      : Colors.white.withOpacity(0.4),
                  isDark
                      ? Colors.transparent
                      : Colors.white.withOpacity(0.1),
                ],
              ),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
