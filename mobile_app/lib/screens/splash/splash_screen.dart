import 'dart:io';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:audioplayers/audioplayers.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  bool _showBitten = false;
  final AudioPlayer _audioPlayer = AudioPlayer();
  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();

    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.92).animate(
      CurvedAnimation(parent: _scaleController, curve: Curves.easeInOut),
    );

    _initAndNavigate();
  }

  @override
  void dispose() {
    _scaleController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _initAndNavigate() async {
    // Only auto-detect system language on FIRST launch
    try {
      final prefs = await SharedPreferences.getInstance();
      final hasLanguageBeenSet = prefs.getBool('language_set') ?? false;

      if (!hasLanguageBeenSet) {
        final systemLang = Platform.localeName.split('_')[0].toLowerCase();
        const supportedCodes = ['tr', 'en', 'de', 'it', 'fr', 'es'];
        final langToSet = supportedCodes.contains(systemLang) ? systemLang : 'en';
        if (mounted) {
          await context.setLocale(Locale(langToSet));
          await prefs.setBool('language_set', true);
          final user = FirebaseAuth.instance.currentUser;
          if (user != null) {
            try {
              await FirebaseFirestore.instance
                  .collection('users')
                  .doc(user.uid)
                  .set({'language': langToSet}, SetOptions(merge: true));
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    // Quick brand animation: whole logo visible -> bite transition
    // Native splash already showed same logo on same red background,
    // so user sees a seamless continuation.
    await Future.delayed(const Duration(milliseconds: 600));
    if (mounted) {
      // Trigger the bite animation
      _scaleController.forward();
      setState(() {
        _showBitten = true;
      });
      try {
        await _audioPlayer.play(AssetSource('sounds/bite_crunch.mp3'));
      } catch (e) {
        // audio might fail on some simulators, ignore
      }

      // Let the user see the bitten logo briefly
      await Future.delayed(const Duration(milliseconds: 800));
      _scaleController.reverse();
      await Future.delayed(const Duration(milliseconds: 200));
    }

    // Navigate to app
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
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF61028),
      body: Center(
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            child: _showBitten
                ? FractionallySizedBox(
                    key: const ValueKey('bitten'),
                    widthFactor: 0.55,
                    child: Image.asset(
                      'assets/images/lokma_splash_bitten.png',
                      fit: BoxFit.contain,
                    ),
                  )
                : FractionallySizedBox(
                    key: const ValueKey('whole'),
                    widthFactor: 0.55,
                    child: Image.asset(
                      'assets/images/lokma_splash_whole.png',
                      fit: BoxFit.contain,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
