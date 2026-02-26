import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  static const Color lokmaRed = Color(0xFFFB335B);
  static const Color lokmaDark = Color(0xFF1A1A1A);

  bool _isInitializing = true;
  String _selectedLangCode = 'tr'; // Default fallback

  final List<Map<String, String>> _languages = [
    {'code': 'tr', 'label': 'Türkçe'},
    {'code': 'en', 'label': 'English'},
    {'code': 'de', 'label': 'Deutsch'},
    {'code': 'it', 'label': 'Italiano'},
    {'code': 'fr', 'label': 'Français'},
    {'code': 'es', 'label': 'Español'},
  ];

  @override
  void initState() {
    super.initState();
    _detectLanguage();
  }

  Future<void> _detectLanguage() async {
    try {
      // 1. Check system language (Highest priority as requested by user)
      final systemLocale = Platform.localeName;
      if (systemLocale.isNotEmpty) {
        final langCode = systemLocale.split('_')[0].toLowerCase();
        if (_languages.any((l) => l['code'] == langCode)) {
          setState(() {
            _selectedLangCode = langCode;
            _isInitializing = false;
          });
          // Update easy_localization context early
          if (mounted) {
            await context.setLocale(Locale(langCode));
          }
        }
      }

      // Removing GPS fallback for language detection as it can cause 2-3 minute load times if permissions
      // are denied, not yet granted, or if the device struggles to get a GPS fix indoors.
      // The system locale is already checked above and is the most reliable method.
    } catch (e) {
      debugPrint('Auto-detect language failed: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isInitializing = false;
        });
      }
    }
  }

  Future<void> _continue() async {
    HapticFeedback.mediumImpact();
    // Save to SharedPreferences so this doesn't show again
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_splash', true);
    
    // Apply selected locale
    if (mounted) {
      await context.setLocale(Locale(_selectedLangCode));
      // Navigate to main app
      context.go('/restoran');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: lokmaRed,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 60),

            // Logo Section (prominent on red background)
            Center(
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(32),
                  child: Image.asset(
                    'assets/images/lokma_logo.png',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Text(
                        'LOKMA',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: lokmaRed,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 48),

            // Language Selection UI
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Uygulama Dili / Language',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: lokmaDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Dilinizi seçin. Daha sonra profilden değiştirebilirsiniz.',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 24),
                    
                    Expanded(
                      child: _isInitializing
                          ? const Center(child: CircularProgressIndicator(color: lokmaRed))
                          : ListView.builder(
                              physics: const BouncingScrollPhysics(),
                              itemCount: _languages.length,
                              itemBuilder: (context, index) {
                                final lang = _languages[index];
                                final isSelected = _selectedLangCode == lang['code'];
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: InkWell(
                                    onTap: () {
                                      HapticFeedback.lightImpact();
                                      setState(() {
                                        _selectedLangCode = lang['code']!;
                                      });
                                      context.setLocale(Locale(lang['code']!));
                                    },
                                    borderRadius: BorderRadius.circular(16),
                                    child: AnimatedContainer(
                                      duration: const Duration(milliseconds: 200),
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                                      decoration: BoxDecoration(
                                        color: isSelected ? lokmaRed.withValues(alpha: 0.1) : Colors.grey[100],
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                          color: isSelected ? lokmaRed : Colors.transparent,
                                          width: 2,
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            lang['label']!,
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                              color: isSelected ? lokmaRed : lokmaDark,
                                            ),
                                          ),
                                          if (isSelected)
                                            const Icon(Icons.check_circle, color: lokmaRed),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                    
                    // Continue Button
                    const SizedBox(height: 16),
                    SafeArea(
                      child: SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed: _isInitializing ? null : _continue,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: lokmaRed,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            'Devam Et', // Do not translate since they haven't confirmed language
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
