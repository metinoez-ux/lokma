import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

class TabItem {
  final String title;
  final String? subtitle;
  final IconData? icon;
  final String? svgAssetPath;

  const TabItem(
      {required this.title, this.subtitle, this.icon, this.svgAssetPath});
}

class ThreeDimensionalPillTabBar extends StatefulWidget {
  final int selectedIndex;
  final Function(int) onTabSelected;
  final List<TabItem> tabs;
  final bool compact;
  final Color? activeColor;
  final EdgeInsets? margin;

  const ThreeDimensionalPillTabBar({
    super.key,
    required this.selectedIndex,
    required this.onTabSelected,
    required this.tabs,
    this.compact = false,
    this.activeColor,
    this.margin,
  });

  // 🎨 Koyu gri toggle renkleri (#3E3E40)
  static const Color pillDark = Color(0xFF3E3E40);
  static const Color pillLight = Color(0xFF5A5A5C); // üst ışık
  static const Color pillDarker = Color(0xFF2C2C2E); // alt gölge

  @override
  State<ThreeDimensionalPillTabBar> createState() =>
      _ThreeDimensionalPillTabBarState();
}

class _ThreeDimensionalPillTabBarState extends State<ThreeDimensionalPillTabBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation; // 0..1 arasında, tab genişliği birimi

  double _dragStartX = 0;
  int _dragStartIdx = 0;
  double _containerWidth = 0;

  double get _tabWidth => _containerWidth > 0 && widget.tabs.isNotEmpty
      ? _containerWidth / widget.tabs.length
      : 0;

  // Compact vs normal dimensions
  double get _height => widget.compact ? 36 : 48;
  double get _borderRadius => _height / 2;
  double get _pillRadius => (_height - 6) / 2;
  double get _iconSize => widget.compact ? 20 : 26;
  double get _fontSize => widget.compact ? 13 : 15;
  EdgeInsets get _margin =>
      widget.margin ??
      (widget.compact
          ? const EdgeInsets.symmetric(horizontal: 4, vertical: 4)
          : const EdgeInsets.symmetric(horizontal: 16, vertical: 6));

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
    );
    _animation = Tween<double>(
      begin: widget.selectedIndex.toDouble(),
      end: widget.selectedIndex.toDouble(),
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));
  }

  @override
  void didUpdateWidget(ThreeDimensionalPillTabBar old) {
    super.didUpdateWidget(old);
    if (old.selectedIndex != widget.selectedIndex) {
      _animateTo(widget.selectedIndex.toDouble());
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _animateTo(double target) {
    _animation = Tween<double>(
      begin: _animation.value,
      end: target,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));
    _controller.forward(from: 0);
  }

  void _snapTo(int index) {
    _animateTo(index.toDouble());
    if (index != widget.selectedIndex) {
      HapticFeedback.lightImpact();
      widget.onTabSelected(index);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final trackColor =
        isDark ? const Color(0xFF2D2D2D) : const Color(0xFFF2EEE9);
    final unselTextColor = isDark ? Colors.grey[300]! : const Color(0xFF3E3E40);

    return LayoutBuilder(builder: (ctx, constraints) {
      final hMargin = _margin.horizontal;
      _containerWidth = constraints.maxWidth - hMargin;

      return Container(
        height: _height,
        margin: _margin,
        decoration: BoxDecoration(
          color: trackColor,
          borderRadius: BorderRadius.circular(_borderRadius),
          boxShadow: [
            BoxShadow(
              color: isDark
                  ? Colors.black.withOpacity(0.4)
                  : Colors.black.withOpacity(0.10),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
          border: isDark
              ? Border.all(
                  color: Colors.white.withOpacity(0.06), width: 0.5)
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.all(3),
          child: AnimatedBuilder(
            animation: _animation,
            builder: (_, __) {
              final pos = _animation.value; // float tab index

              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onHorizontalDragStart: (d) {
                  _dragStartX = d.localPosition.dx;
                  _dragStartIdx = widget.selectedIndex;
                },
                onHorizontalDragUpdate: (d) {
                  if (_tabWidth <= 0) return;
                  final delta = (d.localPosition.dx - _dragStartX) / _tabWidth;
                  final rawIdx = (_dragStartIdx + delta)
                      .clamp(0.0, (widget.tabs.length - 1).toDouble());
                  _animation = AlwaysStoppedAnimation(rawIdx);
                  setState(() {});
                },
                onHorizontalDragEnd: (d) {
                  final nearest =
                      _animation.value.round().clamp(0, widget.tabs.length - 1);
                  _snapTo(nearest);
                },
                child: Stack(
                  children: [
                    // ─── Kayan seçili hap ───────────────────────────────────
                    Positioned.fill(
                      child: Align(
                        alignment: Alignment(
                          // -1 = sol uç, +1 = sağ uç
                          widget.tabs.length > 1
                              ? -1 + pos * (2 / (widget.tabs.length - 1))
                              : 0,
                          0,
                        ),
                        child: FractionallySizedBox(
                          widthFactor: 1 / widget.tabs.length,
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: widget.activeColor != null
                                  ? LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        HSLColor.fromColor(widget.activeColor!)
                                            .withLightness((HSLColor.fromColor(
                                                            widget.activeColor!)
                                                        .lightness +
                                                    0.12)
                                                .clamp(0.0, 1.0))
                                            .toColor(),
                                        widget.activeColor!,
                                        HSLColor.fromColor(widget.activeColor!)
                                            .withLightness((HSLColor.fromColor(
                                                            widget.activeColor!)
                                                        .lightness -
                                                    0.10)
                                                .clamp(0.0, 1.0))
                                            .toColor(),
                                      ],
                                    )
                                  : const LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        ThreeDimensionalPillTabBar.pillLight,
                                        ThreeDimensionalPillTabBar.pillDark,
                                        ThreeDimensionalPillTabBar.pillDarker,
                                      ],
                                    ),
                              borderRadius: BorderRadius.circular(_pillRadius),
                              boxShadow: [
                                BoxShadow(
                                  color: isDark
                                      ? Colors.black.withOpacity(0.55)
                                      : Colors.black.withOpacity(0.22),
                                  blurRadius: 8,
                                  offset: const Offset(0, 3),
                                ),
                                BoxShadow(
                                  color: ThreeDimensionalPillTabBar.pillDark
                                      .withOpacity(isDark ? 0.35 : 0.20),
                                  blurRadius: 10,
                                  spreadRadius: -2,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),

                    // ─── Tab label'ları ─────────────────────────────────────
                    Row(
                      children: List.generate(widget.tabs.length, (i) {
                        final closeness = (pos - i).abs();
                        final isActive = closeness < 0.5;
                        final textColor =
                            isActive ? Colors.white : unselTextColor;

                        return Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.translucent,
                            onTap: () => _snapTo(i),
                            child: _buildLabel(i, textColor, isActive),
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      );
    });
  }

  Widget _buildLabel(int index, Color textColor, bool isActive) {
    final tab = widget.tabs[index];
    final hasSubtitle = tab.subtitle != null && tab.subtitle!.isNotEmpty;

    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (tab.svgAssetPath != null) ...[
            SvgPicture.asset(
              tab.svgAssetPath!,
              width: _iconSize,
              height: _iconSize,
              colorFilter: ColorFilter.mode(textColor, BlendMode.srcIn),
            ),
            SizedBox(width: widget.compact ? 8 : 10),
          ] else if (tab.icon != null) ...[
            Icon(tab.icon, color: textColor, size: _iconSize.toDouble()),
            SizedBox(width: widget.compact ? 8 : 10),
          ],
          Flexible(
            child: hasSubtitle
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        tab.title,
                        style: TextStyle(
                          color: textColor,
                          fontWeight:
                              isActive ? FontWeight.w500 : FontWeight.w400,
                          fontSize: widget.compact ? 12 : 14.5,
                          overflow: TextOverflow.ellipsis,
                          height: 1.0,
                          shadows: isActive
                              ? const [
                                  Shadow(
                                      color: Colors.black26,
                                      offset: Offset(0, 1),
                                      blurRadius: 2)
                                ]
                              : null,
                        ),
                        maxLines: 1,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 1),
                      Text(
                        tab.subtitle!,
                        style: TextStyle(
                          color: textColor.withOpacity(
                              isActive ? 0.85 : 0.7),
                          fontWeight: FontWeight.w500,
                          fontSize: widget.compact ? 10 : 11,
                          overflow: TextOverflow.ellipsis,
                          height: 1.0,
                        ),
                        maxLines: 1,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  )
                : Text(
                    tab.title,
                    style: TextStyle(
                      color: textColor,
                      fontWeight: isActive ? FontWeight.w500 : FontWeight.w400,
                      fontSize: _fontSize,
                      overflow: TextOverflow.ellipsis,
                      height: 1.0,
                      shadows: isActive
                          ? const [
                              Shadow(
                                  color: Colors.black26,
                                  offset: Offset(0, 1),
                                  blurRadius: 2)
                            ]
                          : null,
                    ),
                    maxLines: 1,
                    textAlign: TextAlign.center,
                  ),
          ),
        ],
      ),
    );
  }
}
