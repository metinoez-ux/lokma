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

  // 🎨 LOKMA Marka Rengi (#F85E7D)
  static const Color lokmaPink      = Color(0xFFF85E7D);
  static const Color lokmaPinkLight = Color(0xFFFA8097); // üst ışık
  static const Color lokmaPinkDark  = Color(0xFFD44060); // alt gölge

  @override
  State<ThreeDimensionalPillTabBar> createState() =>
      _ThreeDimensionalPillTabBarState();
}

class _ThreeDimensionalPillTabBarState extends State<ThreeDimensionalPillTabBar>
    with SingleTickerProviderStateMixin {

  late AnimationController _controller;
  late Animation<double> _animation; // 0..1 arasında, tab genişliği birimi

  double _dragStartX  = 0;
  int    _dragStartIdx = 0;
  double _containerWidth = 0;

  double get _tabWidth =>
      _containerWidth > 0 && widget.tabs.isNotEmpty
          ? _containerWidth / widget.tabs.length
          : 0;

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
    final trackColor = isDark ? const Color(0xFF2D2D2D) : const Color(0xFFEEEEEE);
    final unselTextColor = isDark ? Colors.grey[300]! : Colors.grey[600]!;

    return LayoutBuilder(builder: (ctx, constraints) {
      _containerWidth = constraints.maxWidth - 24; // minus horizontal margin

      return Container(
        height: 42,
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: trackColor,
          borderRadius: BorderRadius.circular(21),
          boxShadow: [
            BoxShadow(
              color: isDark
                  ? Colors.black.withValues(alpha: 0.4)
                  : Colors.black.withValues(alpha: 0.10),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
          border: isDark
              ? Border.all(color: Colors.white.withValues(alpha: 0.06), width: 0.5)
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
                  _dragStartX   = d.localPosition.dx;
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
                  final nearest = _animation.value.round()
                      .clamp(0, widget.tabs.length - 1);
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
                              gradient: const LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  ThreeDimensionalPillTabBar.lokmaPinkLight,
                                  ThreeDimensionalPillTabBar.lokmaPink,
                                  ThreeDimensionalPillTabBar.lokmaPinkDark,
                                ],
                              ),
                              borderRadius: BorderRadius.circular(18),
                              boxShadow: [
                                BoxShadow(
                                  color: isDark
                                      ? Colors.black.withValues(alpha: 0.55)
                                      : Colors.black.withValues(alpha: 0.22),
                                  blurRadius: 8,
                                  offset: const Offset(0, 3),
                                ),
                                BoxShadow(
                                  color: ThreeDimensionalPillTabBar.lokmaPink
                                      .withValues(alpha: isDark ? 0.35 : 0.20),
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
                        final isActive  = closeness < 0.5;
                        final textColor = isActive ? Colors.white : unselTextColor;

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
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (tab.icon != null) ...[
          Icon(tab.icon, color: textColor, size: 15),
          const SizedBox(width: 5),
        ],
        Flexible(
          child: Text(
            tab.title,
            style: TextStyle(
              color: textColor,
              fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
              fontSize: 13,
              overflow: TextOverflow.ellipsis,
              shadows: isActive
                  ? const [Shadow(color: Colors.black26, offset: Offset(0, 1), blurRadius: 2)]
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
