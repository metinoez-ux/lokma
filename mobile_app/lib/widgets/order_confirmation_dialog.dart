import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class OrderConfirmationDialog extends StatelessWidget {
  final DateTime pickupDate;
  final String? businessHours;
  final String? businessName;
  final VoidCallback? onDismiss;

  const OrderConfirmationDialog({
    super.key, 
    required this.pickupDate, 
    this.businessHours,
    this.businessName,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    // Format date with business hours
    String formattedDate = _formatDate(pickupDate, businessHours);

    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20),
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E1E), // Fallback
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF252525),
                Color(0xFF1A1A1A),
              ],
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white10),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.5),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 1. Success Animation / Icon Area
            Container(
              height: 120,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.green.withOpacity(0.1),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      color: Colors.green,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check, color: Colors.white, size: 40),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 2. Title & Message
            const Text(
              'Ön Sipariş Alındı!',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                businessName != null
                  ? 'Siparişiniz $businessName tarafından hazırlanacak.'
                  : 'Siparişiniz kasaba iletildi. Hazırlanmaya başladığında bildirim alacaksınız.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey, fontSize: 14),
              ),
            ),

            const SizedBox(height: 24),

            // 3. Pickup Time Card
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white10),
              ),
              child: Row(
                children: [
                   Container(
                     padding: const EdgeInsets.all(10),
                     decoration: BoxDecoration(
                       color: Colors.orange.withOpacity(0.2),
                       borderRadius: BorderRadius.circular(12),
                     ),
                     child: const Icon(Icons.store, color: Colors.orange, size: 24),
                   ),
                   const SizedBox(width: 16),
                   Expanded(
                     child: Column(
                       crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'En Erken Teslim Alma Saati',
                            style: TextStyle(color: Colors.grey, fontSize: 12),
                          ),
                         const SizedBox(height: 2),
                         Text(
                           formattedDate,
                           style: const TextStyle(
                             color: Colors.white,
                             fontSize: 16,
                             fontWeight: FontWeight.bold,
                           ),
                         ),
                       ],
                     ),
                   ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 4. Critical Warning Area
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFE53935).withOpacity(0.15), // Red tint background
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE53935).withOpacity(0.5)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_rounded, color: Color(0xFFE53935), size: 24),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'LÜTFEN DİKKAT!',
                          style: TextStyle(
                            color: Color(0xFFE53935), 
                            fontSize: 13, 
                            fontWeight: FontWeight.bold
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Siparişiniz Hazır bildirimi gelmeden lütfen mağazaya gitmeyiniz.',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 5. Action Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    // Use rootNavigator to ensure we're closing the dialog properly
                    final navigator = Navigator.of(context, rootNavigator: true);
                    
                    // First navigate to restoran (Yemek segment) - this will replace the entire stack
                    context.go('/restoran');
                    
                    // Then close the dialog
                    navigator.pop();
                    
                    // Call callback if provided
                    if (onDismiss != null) {
                      onDismiss!();
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text('Tamam', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date, String? businessHours) {
    // Basic Tr formatting helper
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final checkDate = DateTime(date.year, date.month, date.day);

    String dayStr;
    if (checkDate == today) {
      dayStr = "Bugün";
    } else if (checkDate == tomorrow) {
      dayStr = "Yarın";
    } else {
      dayStr = "${date.day}.${date.month}.${date.year}";
    }

    String minuteStr = date.minute.toString().padLeft(2, '0');
    String hourStr = date.hour.toString().padLeft(2, '0');
    String timeStr = "$hourStr:$minuteStr";

    // Add business hours if available
    if (businessHours != null && businessHours.isNotEmpty) {
      // Clean hours (remove extra text if needed)
      final cleanHours = businessHours.replaceAll('Açılış: ', '').trim();
      return "$dayStr ($cleanHours) • $timeStr";
    }

    return "$dayStr • $timeStr";
  }
}
