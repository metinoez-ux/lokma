import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// LOKMA Onboarding Screen — 3-slide intro + permission requests
/// Shows only on first launch; flag persisted via SharedPreferences.
class OnboardingScreen extends StatefulWidget {
  final VoidCallback onComplete;

  const OnboardingScreen({super.key, required this.onComplete});

  static const String _seenKey = 'onboarding_seen';

  static Future<bool> shouldShow() async {
    final prefs = await SharedPreferences.getInstance();
    return !(prefs.getBool(_seenKey) ?? false);
  }

  static Future<void> markSeen() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_seenKey, true);
  }

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<_OnboardingSlide> _slides = [
    _OnboardingSlide(
      icon: Icons.storefront_rounded,
      gradient: [Color(0xFFFB335B), Color(0xFFFF6B6B)],
      titleKey: 'Yerel İşletmeleri Keşfet',
      subtitleKey: 'Restoranlar, marketler ve kasaplar — hepsi tek uygulamada. En sevdiğin lezzetler kapında.',
      emoji: '🛍️',
    ),
    _OnboardingSlide(
      icon: Icons.delivery_dining_rounded,
      gradient: [Color(0xFF4CAF50), Color(0xFF81C784)],
      titleKey: 'Hızlı & Güvenli Teslimat',
      subtitleKey: 'Siparişini canlı haritada takip et, kuryeyle mesajlaş. Her adımda bilgilendirilirsin.',
      emoji: '🚀',
    ),
    _OnboardingSlide(
      icon: Icons.local_offer_rounded,
      gradient: [Color(0xFFFF9800), Color(0xFFFFB74D)],
      titleKey: 'Kuponlar & Fırsatlar',
      subtitleKey: 'Özel indirim kuponlarıyla daha uygun alışveriş yap. İlk siparişine özel fırsatları kaçırma!',
      emoji: '🎁',
    ),
  ];

  void _nextPage() {
    if (_currentPage < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _finish();
    }
  }

  void _finish() async {
    await OnboardingScreen.markSeen();
    widget.onComplete();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // Skip button
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 12, right: 16),
                child: TextButton(
                  onPressed: _finish,
                  child: Text(
                    'Atla',
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),

            // Page content
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _slides.length,
                onPageChanged: (index) => setState(() => _currentPage = index),
                itemBuilder: (context, index) {
                  final slide = _slides[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Animated icon with gradient circle
                        TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: 1),
                          duration: const Duration(milliseconds: 600),
                          curve: Curves.elasticOut,
                          builder: (context, value, child) {
                            return Transform.scale(
                              scale: value,
                              child: child,
                            );
                          },
                          child: Container(
                            width: 140,
                            height: 140,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: slide.gradient,
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: slide.gradient[0].withValues(alpha: 0.3),
                                  blurRadius: 30,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: Icon(
                              slide.icon,
                              size: 64,
                              color: Colors.white,
                            ),
                          ),
                        ),

                        const SizedBox(height: 40),

                        // Emoji accent
                        Text(slide.emoji, style: const TextStyle(fontSize: 36)),

                        const SizedBox(height: 16),

                        // Title
                        Text(
                          slide.titleKey,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : Colors.black87,
                            height: 1.2,
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Subtitle
                        Text(
                          slide.subtitleKey,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 16,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Dots + Continue button
            Padding(
              padding: const EdgeInsets.fromLTRB(32, 0, 32, 32),
              child: Column(
                children: [
                  // Page dots
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_slides.length, (index) {
                      final isActive = index == _currentPage;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: isActive ? 28 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: isActive
                              ? _slides[_currentPage].gradient[0]
                              : (isDark ? Colors.grey[700] : Colors.grey[300]),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      );
                    }),
                  ),

                  const SizedBox(height: 32),

                  // Continue button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _nextPage,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _slides[_currentPage].gradient[0],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 4,
                        shadowColor: _slides[_currentPage].gradient[0].withValues(alpha: 0.4),
                      ),
                      child: Text(
                        _currentPage == _slides.length - 1 ? 'Başlayalım! 🎉' : 'Devam',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingSlide {
  final IconData icon;
  final List<Color> gradient;
  final String titleKey;
  final String subtitleKey;
  final String emoji;

  const _OnboardingSlide({
    required this.icon,
    required this.gradient,
    required this.titleKey,
    required this.subtitleKey,
    required this.emoji,
  });
}
