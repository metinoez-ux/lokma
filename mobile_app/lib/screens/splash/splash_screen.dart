import 'dart:io';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  bool _showBitten = false;

  @override
  void initState() {
    super.initState();
    _initAndNavigate();
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

    // Phase 1: Show whole O for 1.5 seconds
    await Future.delayed(const Duration(milliseconds: 1500));

    // Phase 2: Switch to bitten O
    if (mounted) {
      setState(() => _showBitten = true);
    }

    // Hold bitten O for 1 second
    await Future.delayed(const Duration(milliseconds: 1000));

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
      backgroundColor: const Color(0xFFFF0033),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Bottom layer: whole O (always visible)
          Image.asset(
            'assets/images/lokma_splash_whole.png',
            fit: BoxFit.cover,
          ),
          // Top layer: bitten O (appears on top, instant switch)
          if (_showBitten)
            Image.asset(
              'assets/images/lokma_splash_bitten.png',
              fit: BoxFit.cover,
            ),
        ],
      ),
    );
  }
}

