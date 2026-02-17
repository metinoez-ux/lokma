import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';

/// Premium in-app notification overlay that slides from top
/// Replaces the old green SnackBar with a glassmorphism banner
class InAppNotification {
  static OverlayEntry? _currentEntry;
  static Timer? _dismissTimer;
  static String? _lastNotificationKey;
  static DateTime? _lastNotificationTime;

  /// Show a notification banner sliding from the top
  static void show({
    required BuildContext context,
    required String title,
    String? body,
    String? emoji,
    VoidCallback? onTap,
    Duration duration = const Duration(seconds: 4),
    Color? accentColor,
  }) {
    // Duplicate suppression — same title within 3 seconds = skip
    final key = '$title|$body';
    final now = DateTime.now();
    if (_lastNotificationKey == key &&
        _lastNotificationTime != null &&
        now.difference(_lastNotificationTime!).inSeconds < 3) {
      return;
    }
    _lastNotificationKey = key;
    _lastNotificationTime = now;

    // Dismiss existing notification if any
    dismiss();

    final overlay = Overlay.of(context);
    
    _currentEntry = OverlayEntry(
      builder: (context) => _NotificationBanner(
        title: title,
        body: body,
        emoji: emoji,
        onTap: onTap,
        duration: duration,
        accentColor: accentColor,
        onDismiss: dismiss,
      ),
    );

    overlay.insert(_currentEntry!);
  }

  static void dismiss() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    _currentEntry?.remove();
    _currentEntry = null;
  }
}

class _NotificationBanner extends StatefulWidget {
  final String title;
  final String? body;
  final String? emoji;
  final VoidCallback? onTap;
  final Duration duration;
  final Color? accentColor;
  final VoidCallback onDismiss;

  const _NotificationBanner({
    required this.title,
    this.body,
    this.emoji,
    this.onTap,
    required this.duration,
    this.accentColor,
    required this.onDismiss,
  });

  @override
  State<_NotificationBanner> createState() => _NotificationBannerState();
}

class _NotificationBannerState extends State<_NotificationBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _fadeAnimation;
  
  double _dragOffset = 0;
  bool _isDragging = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 400),
      reverseDuration: const Duration(milliseconds: 250),
      vsync: this,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    ));

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.6),
    ));

    _controller.forward();

    // Auto-dismiss
    Future.delayed(widget.duration, () {
      if (mounted) _animateOut();
    });
  }

  void _animateOut() async {
    if (!mounted) return;
    await _controller.reverse();
    if (mounted) widget.onDismiss();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = widget.accentColor ?? const Color(0xFF6C63FF);

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SlideTransition(
        position: _slideAnimation,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: GestureDetector(
            onVerticalDragUpdate: (details) {
              setState(() {
                _isDragging = true;
                _dragOffset += details.delta.dy;
                if (_dragOffset > 0) _dragOffset = 0; // Only allow upward
              });
            },
            onVerticalDragEnd: (details) {
              if (_dragOffset < -40) {
                _animateOut();
              } else {
                setState(() {
                  _dragOffset = 0;
                  _isDragging = false;
                });
              }
            },
            onTap: () {
              widget.onTap?.call();
              _animateOut();
            },
            child: Transform.translate(
              offset: Offset(0, _isDragging ? _dragOffset : 0),
              child: Container(
                margin: EdgeInsets.only(
                  top: topPadding + 8,
                  left: 12,
                  right: 12,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      decoration: BoxDecoration(
                        color: isDark
                            ? Colors.white.withValues(alpha: 0.12)
                            : Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.15)
                              : Colors.white.withValues(alpha: 0.10),
                          width: 0.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 20,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          // Accent bar
                          Container(
                            width: 4,
                            height: 40,
                            decoration: BoxDecoration(
                              color: accent,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // Emoji
                          if (widget.emoji != null) ...[
                            Text(
                              widget.emoji!,
                              style: const TextStyle(fontSize: 22),
                            ),
                            const SizedBox(width: 10),
                          ],
                          // Text content
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.title,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    letterSpacing: -0.2,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (widget.body != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    widget.body!,
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.72),
                                      fontSize: 12.5,
                                      height: 1.3,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ],
                            ),
                          ),
                          // Chevron
                          if (widget.onTap != null) ...[
                            const SizedBox(width: 8),
                            Icon(
                              Icons.chevron_right_rounded,
                              color: Colors.white.withValues(alpha: 0.5),
                              size: 20,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
