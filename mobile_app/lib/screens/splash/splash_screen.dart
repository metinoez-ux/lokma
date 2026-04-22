import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:audioplayers/audioplayers.dart';

/// World-class splash screen: zero initialization, pure animation.
///
/// Architecture (3-phase, single logo source):
/// 1. Native splash shows ONLY solid red (#F61028) -- no logo.
///    This appears instantly on app tap (iOS Storyboard / Android theme).
/// 2. FlutterNativeSplash.preserve() keeps native red screen alive while
///    main.dart initializes Firebase, Stripe, FCM, locale, etc.
/// 3. This widget paints an identical red screen, calls remove() via
///    addPostFrameCallback (seamless handoff), then fades in the logo
///    and plays the bite animation.
///
/// Result: user sees red -> logo fades in -> bite -> navigate.
/// Zero visual jumps. Single logo source. ~2s total animation.
class SplashScreen extends StatefulWidget {
  final bool hasSeenOnboarding;

  const SplashScreen({super.key, required this.hasSeenOnboarding});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  bool _showBitten = false;
  final AudioPlayer _audioPlayer = AudioPlayer();

  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;

  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();

    // Fade-in for logo appearance (from solid red to logo)
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );

    // Scale pulse for bite effect
    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.93).animate(
      CurvedAnimation(parent: _scaleController, curve: Curves.easeInOut),
    );

    // Start animation after first frame is painted
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _runAnimation();
    });
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _scaleController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _runAnimation() async {
    // Brief pause on solid red (matches native splash feel)
    await Future.delayed(const Duration(milliseconds: 200));
    if (!mounted) return;

    // Phase 1: Logo fades in elegantly
    _fadeController.forward();
    await Future.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    // Phase 2: Bite animation
    _scaleController.forward();
    setState(() => _showBitten = true);

    // Play crunch sound (non-blocking)
    _audioPlayer.play(AssetSource('sounds/bite_crunch.mp3')).catchError((_) {});

    // Phase 3: Let user see the bitten logo
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;

    _scaleController.reverse();
    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;

    // Navigate to the app
    if (widget.hasSeenOnboarding) {
      context.go('/restoran');
    } else {
      context.go('/onboarding');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF61028),
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: ScaleTransition(
            scale: _scaleAnimation,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              child: _showBitten
                  ? FractionallySizedBox(
                      key: const ValueKey('bitten'),
                      widthFactor: 0.45,
                      child: Image.asset(
                        'assets/images/lokma_splash_bitten.png',
                        fit: BoxFit.contain,
                      ),
                    )
                  : FractionallySizedBox(
                      key: const ValueKey('whole'),
                      widthFactor: 0.45,
                      child: Image.asset(
                        'assets/images/lokma_splash_whole.png',
                        fit: BoxFit.contain,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
