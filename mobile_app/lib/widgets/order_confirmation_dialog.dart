import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class OrderConfirmationDialog extends StatelessWidget {
  final DateTime pickupDate;
  final String? businessHours;
  final String? businessName;
  final bool isPickUp;
  final bool isDineIn;
  final VoidCallback? onDismiss;
  final VoidCallback? onClearCart;

  const OrderConfirmationDialog({
    super.key, 
    required this.pickupDate, 
    this.businessHours,
    this.businessName,
    this.isPickUp = true,
    this.isDineIn = false,
    this.onDismiss,
    this.onClearCart,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1A1A1A);
    final subtextColor = isDark ? Colors.grey[400]! : Colors.grey.shade600;
    const accentColor = Color(0xFFFB335B);

    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 28),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 24),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ✅ Checkmark
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded, color: Colors.green, size: 36),
              ),

              const SizedBox(height: 20),

              // Title
              Text(
                'Sipariş Alındı!',
                style: TextStyle(
                  color: textColor,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                businessName != null
                  ? 'Siparişiniz $businessName tarafından hazırlanacak.'
                  : 'Siparişiniz iletildi.',
                textAlign: TextAlign.center,
                style: TextStyle(color: subtextColor, fontSize: 14, height: 1.4),
              ),

              const SizedBox(height: 24),

              // Divider
              Divider(color: isDark ? Colors.white10 : Colors.grey.shade200, height: 1),

              const SizedBox(height: 16),

              // Mode info
              _buildModeInfo(textColor, subtextColor, accentColor, isDark),

              const SizedBox(height: 16),

              // Mode-specific hint
              Text(
                isDineIn
                    ? 'Siparişiniz mutfağa iletildi. Masanızda bekleyiniz.'
                    : (isPickUp
                        ? 'Hazır olduğunda bildirim alacaksınız.'
                        : 'Kuryenizi canlı takip edebilirsiniz.'),
                textAlign: TextAlign.center,
                style: TextStyle(color: subtextColor, fontSize: 13, height: 1.4),
              ),

              const SizedBox(height: 16),

              // Notification reminder
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_active_outlined, color: subtextColor, size: 16),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      'Bildirimleri açmayı unutmayın!',
                      style: TextStyle(color: subtextColor, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Action Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    // CRITICAL FIX: The checkout page was pushed via
                    // Navigator.push() (imperative), NOT via go_router.
                    // context.go('/restoran') only changes the declarative
                    // go_router stack — it CANNOT pop imperatively-pushed
                    // routes, leaving them orphaned as a black screen.
                    //
                    // Solution: Pop ALL imperative routes (this dialog +
                    // checkout page) back to the go_router-managed root,
                    // then clear cart safely.
                    final rootNav = Navigator.of(context, rootNavigator: true);
                    rootNav.popUntil((route) => route.isFirst);
                    
                    // Clear cart after navigation is complete
                    if (onClearCart != null) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        onClearCart!();
                      });
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: const Text('Tamam', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModeInfo(Color textColor, Color subtextColor, Color accentColor, bool isDark) {
    if (isDineIn) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.restaurant, color: accentColor, size: 20),
          const SizedBox(width: 8),
          Text(
            'Masanızda servis edilecek',
            style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ],
      );
    } else if (isPickUp) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.store_outlined, color: subtextColor, size: 20),
          const SizedBox(width: 8),
          Text(
            '${_formatPickupDay()}, ${_formatPickupClock()}',
            style: TextStyle(color: textColor, fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ],
      );
    } else {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.delivery_dining, color: subtextColor, size: 22),
          const SizedBox(width: 8),
          Text(
            'Tahmini süre: 30-45 dk',
            style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ],
      );
    }
  }

  String _formatPickupDay() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final checkDate = DateTime(pickupDate.year, pickupDate.month, pickupDate.day);

    final dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    final monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    if (checkDate == today) {
      return 'Bugün';
    } else if (checkDate == tomorrow) {
      return 'Yarın';
    } else {
      return '${dayNames[pickupDate.weekday - 1]}, ${pickupDate.day} ${monthNames[pickupDate.month - 1]}';
    }
  }

  String _formatPickupClock() {
    return '${pickupDate.hour.toString().padLeft(2, '0')}:${pickupDate.minute.toString().padLeft(2, '0')}';
  }
}
