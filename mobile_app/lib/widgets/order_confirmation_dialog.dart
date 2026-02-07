import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class OrderConfirmationDialog extends StatelessWidget {
  final DateTime pickupDate;
  final String? businessHours;
  final String? businessName;
  final bool isPickUp;
  final VoidCallback? onDismiss;

  const OrderConfirmationDialog({
    super.key, 
    required this.pickupDate, 
    this.businessHours,
    this.businessName,
    this.isPickUp = true,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final cardColor = isDark ? Colors.white.withOpacity(0.06) : Colors.grey.shade50;
    final textColor = isDark ? Colors.white : const Color(0xFF1A1A1A);
    final subtextColor = isDark ? Colors.white70 : Colors.grey.shade600;
    final borderColor = isDark ? Colors.white10 : Colors.grey.shade200;
    final accentColor = const Color(0xFFE53935);

    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20),
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: borderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isDark ? 0.5 : 0.15),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ✅ Success header
              Container(
                height: 100,
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.green.withOpacity(0.15),
                      Colors.green.withOpacity(0.05),
                    ],
                  ),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check, color: Colors.white, size: 32),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Title
              Text(
                'Sipariş Alındı!',
                style: TextStyle(
                  color: textColor,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Text(
                  businessName != null
                    ? 'Siparişiniz $businessName tarafından hazırlanacak.'
                    : 'Siparişiniz iletildi.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: subtextColor, fontSize: 14),
                ),
              ),

              const SizedBox(height: 20),

              // 📦 Mode-specific info card
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: cardColor,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: borderColor),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isPickUp ? 'Gel Al' : 'Kurye ile Teslimat',
                      style: TextStyle(
                        color: subtextColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isPickUp 
                          ? _formatPickupTime()
                          : 'Tahmini süre: 30-45 dk',
                      style: TextStyle(
                        color: textColor,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // Mode-specific warning card
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(isDark ? 0.12 : 0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: Text(
                  isPickUp
                      ? 'Siparişiniz hazır olduğunda bildirim alacaksınız. Hazır bildirimi gelmeden lütfen mağazaya gitmeyiniz.'
                      : 'Kuryenizi canlı takip edebilirsiniz.',
                  style: TextStyle(color: subtextColor, fontSize: 13, height: 1.4),
                ),
              ),

              const SizedBox(height: 20),

              // Action Button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      final navigator = Navigator.of(context, rootNavigator: true);
                      context.go('/restoran');
                      navigator.pop();
                      if (onDismiss != null) onDismiss!();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accentColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                    child: const Text('Tamam', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),
              ),

              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  String _formatPickupTime() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final checkDate = DateTime(pickupDate.year, pickupDate.month, pickupDate.day);

    String dayStr;
    if (checkDate == today) {
      dayStr = "Bugün";
    } else if (checkDate == tomorrow) {
      dayStr = "Yarın";
    } else {
      dayStr = "${pickupDate.day}.${pickupDate.month}.${pickupDate.year}";
    }

    String minuteStr = pickupDate.minute.toString().padLeft(2, '0');
    String hourStr = pickupDate.hour.toString().padLeft(2, '0');

    if (businessHours != null && businessHours!.isNotEmpty) {
      final cleanHours = businessHours!.replaceAll('Açılış: ', '').trim();
      return "$dayStr ($cleanHours) · $hourStr:$minuteStr";
    }

    return "$dayStr · $hourStr:$minuteStr";
  }
}
