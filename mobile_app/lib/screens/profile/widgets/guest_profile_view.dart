import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../providers/theme_provider.dart';

class GuestProfileView extends ConsumerStatefulWidget {
  final VoidCallback onLoginTap;
  final VoidCallback onRegisterTap;

  const GuestProfileView({
    super.key,
    required this.onLoginTap,
    required this.onRegisterTap,
  });

  @override
  ConsumerState<GuestProfileView> createState() => _GuestProfileViewState();
}

class _GuestProfileViewState extends ConsumerState<GuestProfileView> {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = Theme.of(context).colorScheme.onSurface;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              
              // Melde dich an Box
              Container(
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2C3232) : const Color(0xFFE4EFEF),
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            'Melde dich an für mehr Vorteile',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: isDark ? Colors.white : const Color(0xFF1E2424),
                              height: 1.2,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Text('🔓', style: TextStyle(fontSize: 32)),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildBullet('Erhalte Angebote und Rabatte', isDark),
                    const SizedBox(height: 6),
                    _buildBullet('Bestelle schneller mit gespeicherten Infos', isDark),
                    const SizedBox(height: 6),
                    _buildBullet('Bestelle bequem erneut und verfolge deine Bestellung', isDark),
                    
                    const SizedBox(height: 24),
                    
                    // Konto erstellen (White Button)
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: widget.onRegisterTap,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: Colors.black87,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24),
                          ),
                        ),
                        child: const Text('Konto erstellen', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.black87)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    
                    // Anmelden (Orange Button)
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: widget.onLoginTap,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEA5A0A), // Lieferando orange equivalent
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24),
                          ),
                        ),
                        child: const Text('Anmelden', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Du hast Fragen Box
              GestureDetector(
                onTap: () => context.push('/help'), // Help center route
                child: Container(
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF3B332E) : const Color(0xFFF7F1E9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Du hast Fragen?',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: isDark ? Colors.white : const Color(0xFF1E2424),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Wir sind für dich da',
                              style: TextStyle(
                                fontSize: 14,
                                color: isDark ? Colors.grey[300] : const Color(0xFF4A4A4A),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Text('❓', style: TextStyle(fontSize: 32)),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 32),

              Text(
                'Einstellungen',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: textColor,
                ),
              ),
              const SizedBox(height: 16),

              // Settings list
              _buildSettingItem(
                Icons.flag,
                'Land',
                isDark,
                onTap: () {},
              ),
              _buildSettingItem(
                Icons.navigation_outlined,
                'Ortungsdienste',
                isDark,
                onTap: () {},
              ),
              _buildSettingItem(
                Icons.language_outlined,
                'Sprache',
                isDark,
                onTap: () {
                   // Or open regular language selector
                   showDialog(context: context, builder: (ctx) => const AlertDialog(content: Text('Sprache')));
                },
              ),
              _buildSettingItem(
                Icons.format_paint_outlined,
                'App-Modus',
                isDark,
                onTap: () {
                   final current = ref.read(themePreferenceProvider);
                   final next = current == ThemePreference.dark 
                       ? ThemePreference.light 
                       : ThemePreference.dark;
                   ref.read(themePreferenceProvider.notifier).setPreference(next);
                },
              ),
              _buildSettingItem(
                Icons.delete_outline,
                'App-Daten löschen',
                isDark,
                onTap: () async {
                   final prefs = await SharedPreferences.getInstance();
                   await prefs.clear();
                   if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('App-Daten gelöscht.')));
                      context.go('/splash'); // restart app flow logically
                   }
                },
              ),

              const SizedBox(height: 60),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBullet(String text, bool isDark) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('•  ', style: TextStyle(fontSize: 16, color: isDark ? Colors.grey[300] : const Color(0xFF1E2424), fontWeight: FontWeight.bold)),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[300] : const Color(0xFF1E2424),
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSettingItem(IconData icon, String title, bool isDark, {required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16.0),
        child: Row(
          children: [
            Icon(icon, size: 24, color: isDark ? Colors.grey[400] : const Color(0xFF4A4A4A)),
            const SizedBox(width: 16),
            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                color: isDark ? Colors.white : const Color(0xFF1E2424),
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

