import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// App Rating Service — Prompts user for App Store / Play Store review
/// Triggers after the 3rd successful order delivery.
/// Uses SharedPreferences to track order count and whether prompt was shown.
class AppRatingService {
  static const String _orderCountKey = 'completed_order_count';
  static const String _hasPromptedKey = 'has_prompted_rating';
  static const String _lastPromptDateKey = 'last_rating_prompt_date';
  static const int _triggerOrderCount = 3;
  static const int _minDaysBetweenPrompts = 90; // Don't ask again for 90 days

  /// Call this after each successful order delivery
  static Future<bool> onOrderDelivered(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    
    // Increment order count
    final currentCount = (prefs.getInt(_orderCountKey) ?? 0) + 1;
    await prefs.setInt(_orderCountKey, currentCount);

    // Check if we should show the prompt
    if (currentCount >= _triggerOrderCount) {
      final hasPrompted = prefs.getBool(_hasPromptedKey) ?? false;
      
      if (!hasPrompted) {
        // First time prompt
        if (context.mounted) {
          _showRatingDialog(context, prefs);
          return true;
        }
      } else {
        // Check if enough time has passed for re-prompt
        final lastPrompt = prefs.getString(_lastPromptDateKey);
        if (lastPrompt != null) {
          final lastDate = DateTime.tryParse(lastPrompt);
          if (lastDate != null) {
            final daysSince = DateTime.now().difference(lastDate).inDays;
            if (daysSince >= _minDaysBetweenPrompts && currentCount % 10 == 0) {
              if (context.mounted) {
                _showRatingDialog(context, prefs);
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  static void _showRatingDialog(BuildContext context, SharedPreferences prefs) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const accent = Color(0xFFEA184A);
    
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: isDark ? const Color(0xFF2A2A2A) : Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Star animation
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 800),
                curve: Curves.elasticOut,
                builder: (_, value, child) => Transform.scale(scale: value, child: child),
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFD700), Color(0xFFFFA000)],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFFD700).withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.star_rounded, color: Colors.white, size: 44),
                ),
              ),
              
              const SizedBox(height: 20),
              
              Text(
                'LOKMA\'yı Beğendin mi?',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              
              const SizedBox(height: 12),
              
              Text(
                'Uygulamamızı değerlendirerek bize destek olabilirsin! ⭐',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                  height: 1.4,
                ),
              ),
              
              const SizedBox(height: 24),
              
              // Rate button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () async {
                    await prefs.setBool(_hasPromptedKey, true);
                    await prefs.setString(_lastPromptDateKey, DateTime.now().toIso8601String());
                    Navigator.of(ctx).pop();
                    // NOTE: In production, call in_app_review package here
                    // final inAppReview = InAppReview.instance;
                    // if (await inAppReview.isAvailable()) {
                    //   inAppReview.requestReview();
                    // }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Değerlendir ⭐',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              
              const SizedBox(height: 10),
              
              // Later button
              TextButton(
                onPressed: () {
                  prefs.setString(_lastPromptDateKey, DateTime.now().toIso8601String());
                  Navigator.of(ctx).pop();
                },
                child: Text(
                  'Daha sonra',
                  style: TextStyle(
                    color: isDark ? Colors.grey[500] : Colors.grey[600],
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Reset tracking (useful for testing)
  static Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_orderCountKey);
    await prefs.remove(_hasPromptedKey);
    await prefs.remove(_lastPromptDateKey);
  }
}
