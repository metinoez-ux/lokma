import 'dart:io';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  static const Color lokmaRed = Color(0xFFFB335B);

  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();

    // Fade-in animation: 1 second with a smooth ease-in curve
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeIn,
    );

    // Start fade-in and initialize app
    _fadeController.forward();
    _initAndNavigate();
  }

  Future<void> _initAndNavigate() async {
    // Auto-detect system language
    try {
      final systemLang = Platform.localeName.split('_')[0].toLowerCase();
      const supportedCodes = ['tr', 'en', 'de', 'it', 'fr', 'es'];
      if (supportedCodes.contains(systemLang) && mounted) {
        await context.setLocale(Locale(systemLang));
      }
    } catch (_) {}

    // Wait for the fade-in animation to complete (1 second)
    await Future.delayed(const Duration(milliseconds: 1000));

    // Brief pause at full opacity so the user sees the logo clearly
    await Future.delayed(const Duration(milliseconds: 500));

    // Navigate
    if (mounted) {
      final prefs = await SharedPreferences.getInstance();
      final hasSeenOnboarding = prefs.getBool('onboarding_seen') ?? false;
      if (hasSeenOnboarding) {
        context.go('/restoran');
      } else {
        context.go('/onboarding');
      }
    }
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Match the gradient's top color for status bar area
      backgroundColor: const Color(0xFFE8456B),
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: SizedBox.expand(
          child: Image.asset(
            'assets/images/lokma_splash.png',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xFFE8456B), Color(0xFFFF1A1A)],
                ),
              ),
              child: const Center(
                child: Text(
                  'LOKMA',
                  style: TextStyle(
                    fontSize: 48,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: 4,
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
