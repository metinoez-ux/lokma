import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/kermes_staff_status_service.dart';

/// Kermes operasyon ekranlarinda (KDS, Tezgah, POS) personelin
/// durumunu yonetebilecegi Floating Action Button.
///
/// - Active: Yesil, siparis sayaci badge
/// - Paused: Turuncu, pulsing animasyon
/// - Offline/Kayitsiz: Gri, "Baslat"
///
/// Tek tik: Active <-> Paused
/// Uzun bas: Offline (onay dialog ile)
class KermesStaffStatusFAB extends ConsumerStatefulWidget {
  final String kermesId;
  final String staffId;
  final String staffName;
  final String role; // 'waiter' | 'courier' | 'counter'
  final String? sectionId;

  const KermesStaffStatusFAB({
    super.key,
    required this.kermesId,
    required this.staffId,
    required this.staffName,
    this.role = 'waiter',
    this.sectionId,
  });

  @override
  ConsumerState<KermesStaffStatusFAB> createState() =>
      _KermesStaffStatusFABState();
}

class _KermesStaffStatusFABState extends ConsumerState<KermesStaffStatusFAB>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
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
    final service = ref.read(kermesStaffStatusServiceProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return StreamBuilder<KermesStaffStatus?>(
      stream: service.getMyStatusStream(widget.kermesId, widget.staffId),
      builder: (context, snapshot) {
        final status = snapshot.data;
        final currentStatus = status?.status ?? 'offline';
        final orderCount = status?.currentOrderCount ?? 0;

        // Pulse animasyonu paused durumda calissin
        if (currentStatus == 'paused') {
          if (!_pulseController.isAnimating) {
            _pulseController.repeat(reverse: true);
          }
        } else {
          if (_pulseController.isAnimating) {
            _pulseController.stop();
            _pulseController.reset();
          }
        }

        // Renk ve ikon belirleme
        Color fabColor;
        IconData fabIcon;
        String tooltip;

        switch (currentStatus) {
          case 'active':
            fabColor = const Color(0xFF2E7D32);
            fabIcon = Icons.play_circle_filled;
            tooltip = 'Aktif - Tikla: Mola';
          case 'paused':
            fabColor = const Color(0xFFE65100);
            fabIcon = Icons.pause_circle_filled;
            tooltip = 'Mola - Tikla: Devam';
          default:
            fabColor = isDark ? Colors.grey.shade700 : Colors.grey.shade500;
            fabIcon = Icons.power_settings_new;
            tooltip = 'Cevrimdisi - Tikla: Baslat';
        }

        Widget fab = GestureDetector(
          onLongPress: currentStatus != 'offline'
              ? () => _handleLongPress()
              : null,
          child: FloatingActionButton(
            heroTag: 'kermes_staff_fab_${widget.kermesId}',
            backgroundColor: fabColor,
            tooltip: tooltip,
            onPressed: _isProcessing ? null : () => _handleTap(currentStatus),
            child: _isProcessing
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.5,
                    ),
                  )
                : Stack(
                    alignment: Alignment.center,
                    children: [
                      Icon(fabIcon, color: Colors.white, size: 28),
                      // Siparis sayaci badge
                      if (currentStatus == 'active' && orderCount > 0)
                        Positioned(
                          top: -2,
                          right: -2,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Color(0xFFEA184A),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '$orderCount',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        );

        // Paused durumda pulsing efekti
        if (currentStatus == 'paused') {
          fab = AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _pulseAnimation.value,
                child: child,
              );
            },
            child: fab,
          );
        }

        // Durum etiketi (FAB altinda)
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            fab,
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: fabColor.withOpacity(isDark ? 0.3 : 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _getStatusLabel(currentStatus),
                style: TextStyle(
                  color: fabColor,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'active':
        return 'AKTIF';
      case 'paused':
        return 'MOLA';
      default:
        return 'BASLAT';
    }
  }

  Future<void> _handleTap(String currentStatus) async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);

    try {
      final service = ref.read(kermesStaffStatusServiceProvider);

      if (currentStatus == 'offline') {
        // Ilk kez: aktif olarak kaydet
        HapticFeedback.heavyImpact();
        await service.setStaffStatus(
          widget.kermesId,
          widget.staffId,
          widget.staffName,
          'active',
          sectionId: widget.sectionId,
          role: widget.role,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Gorev baslatildi'),
              backgroundColor: Color(0xFF2E7D32),
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } else {
        // Active <-> Paused toggle
        HapticFeedback.mediumImpact();
        await service.togglePause(
          widget.kermesId,
          widget.staffId,
          widget.staffName,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _handleLongPress() async {
    HapticFeedback.heavyImpact();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Gorevi Sonlandir',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w700,
          ),
        ),
        content: Text(
          'Cevrimdisi olacaksiniz ve size yeni siparis atanamayacak. Devam etmek istiyor musunuz?',
          style: TextStyle(
            color: isDark ? Colors.white70 : Colors.black54,
            fontSize: 14,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              'Iptal',
              style: TextStyle(color: isDark ? Colors.white54 : Colors.grey),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('Sonlandir',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;
    if (!mounted) return;

    setState(() => _isProcessing = true);
    try {
      final service = ref.read(kermesStaffStatusServiceProvider);
      await service.goOffline(
        widget.kermesId,
        widget.staffId,
        widget.staffName,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Gorev sonlandirildi'),
            backgroundColor: Colors.grey.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }
}
