import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/providers/group_order_provider.dart';
import 'package:lokma_app/models/kermes_group_order_model.dart';

/// Floating grup siparisi butonu
/// Aktif bir grup siparisi varken ekranda gorunur
/// Yemek segmentindeki ucan sepet gibi pulse animasyonu yapar
class FloatingGroupOrderButton extends ConsumerStatefulWidget {
  /// Opsiyonel: butona basildiginda calisacak callback
  /// Verilmezse varsayilan navigasyon kullanilir
  final VoidCallback? onTap;

  const FloatingGroupOrderButton({super.key, this.onTap});

  @override
  ConsumerState<FloatingGroupOrderButton> createState() =>
      _FloatingGroupOrderButtonState();
}

class _FloatingGroupOrderButtonState
    extends ConsumerState<FloatingGroupOrderButton>
    with SingleTickerProviderStateMixin {
  static const Color lokmaPink = Color(0xFFF41C54);

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.0, end: 8.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groupState = ref.watch(groupOrderProvider);

    // Aktif grup siparisi yoksa gosterme
    if (groupState.currentOrder == null ||
        groupState.currentOrder!.status == GroupOrderStatus.ordered ||
        groupState.currentOrder!.status == GroupOrderStatus.cancelled ||
        groupState.currentOrder!.status == GroupOrderStatus.completed) {
      return const SizedBox.shrink();
    }

    final order = groupState.currentOrder!;
    final memberCount = order.participants.length;

    return Positioned(
      right: 16,
      bottom: 90,
      child: AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(0, -_pulseAnimation.value),
            child: child,
          );
        },
        child: GestureDetector(
          onTap: () {
            HapticFeedback.mediumImpact();
            if (widget.onTap != null) {
              widget.onTap!();
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  lokmaPink,
                  lokmaPink.withOpacity(0.85),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: lokmaPink.withOpacity(0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                  spreadRadius: 1,
                ),
                BoxShadow(
                  color: Colors.black.withOpacity(0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.groups_rounded, color: Colors.white, size: 22),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Grup Siparisi',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '$memberCount kisi',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.85),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.arrow_forward_ios_rounded,
                      color: Colors.white, size: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
