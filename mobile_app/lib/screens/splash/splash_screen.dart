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

    // Navigate to app instantly
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
      backgroundColor: const Color(0xFFFF0033),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Bottom layer: whole O (always visible)
          Center(
            child: FractionallySizedBox(
              widthFactor: 0.6,
              child: Image.asset(
                'assets/images/lokma_splash_whole.png',
                fit: BoxFit.contain,
              ),
            ),
          ),
          // Top layer: bitten O (appears on top, instant switch)
          if (_showBitten)
            Center(
              child: FractionallySizedBox(
                widthFactor: 0.6,
                child: Image.asset(
                  'assets/images/lokma_splash_bitten.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

