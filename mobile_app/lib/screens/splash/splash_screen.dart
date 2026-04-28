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

class _SplashScreenState extends State<SplashScreen> {
  bool _showBitten = false;
  final AudioPlayer _audioPlayer = AudioPlayer();

  @override
  void initState() {
    super.initState();

    // Start animation after first frame is painted
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _runAnimation();
    });
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _runAnimation() async {
    // Phase 1: Wait a brief moment to let Flutter settle (Native splash -> Flutter handoff)
    await Future.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    // Phase 2: Bite animation
    setState(() => _showBitten = true);

    // Play crunch sound (non-blocking)
    _audioPlayer.play(AssetSource('sounds/bite_crunch.mp3')).catchError((_) {});

    // Phase 3: Let user see the bitten logo briefly
    await Future.delayed(const Duration(milliseconds: 1200));
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
      backgroundColor: const Color(0xFFE9021F),
      body: Center(
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Bitten image (always in tree, only visible when _showBitten is true)
            Opacity(
              opacity: _showBitten ? 1.0 : 0.0,
              child: FractionallySizedBox(
                widthFactor: 0.80,
                child: Image.asset(
                  'assets/images/lokma_splash_bitten.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
            // Whole image (visible when _showBitten is false)
            Opacity(
              opacity: _showBitten ? 0.0 : 1.0,
              child: FractionallySizedBox(
                widthFactor: 0.80,
                child: Image.asset(
                  'assets/images/lokma_splash_whole.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
