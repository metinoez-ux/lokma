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

class _SplashScreenState extends State<SplashScreen> {
  bool _showBitten = false;
  final AudioPlayer _audioPlayer = AudioPlayer();

  @override
  void initState() {
    super.initState();
    _initAndNavigate();
  }

  @override
  void dispose() {
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

    // Play custom animation and sound!
    // Wait for 1 second to ensure native splash is removed and user can see the whole logo
    await Future.delayed(const Duration(milliseconds: 1000));
    if (mounted) {
      setState(() {
        _showBitten = true;
      });
      try {
        await _audioPlayer.play(AssetSource('sounds/bite_crunch.mp3'));
      } catch (e) {
        // audio might fail on some simulators, ignore
      }
      
      // Let the user see the bitten logo briefly
      await Future.delayed(const Duration(milliseconds: 1500));
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
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Pre-cache by keeping both images alive in the layer tree.
          // Bottom layer: whole O (invisible when bitten is requested)
          Opacity(
            opacity: _showBitten ? 0.0 : 1.0,
            child: Center(
              child: FractionallySizedBox(
                widthFactor: 0.6,
                child: Image.asset(
                  'assets/images/lokma_splash_whole.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
          // Top layer: bitten O (invisible at first, instant cache hit later)
          Opacity(
            opacity: _showBitten ? 1.0 : 0.0,
            child: Center(
              child: FractionallySizedBox(
                widthFactor: 0.6,
                child: Image.asset(
                  'assets/images/lokma_splash_bitten.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

