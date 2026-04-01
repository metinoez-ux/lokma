import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/providers/auth_provider.dart';

class LoginBottomSheet extends ConsumerWidget {
  const LoginBottomSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;

    return Container(
      padding: EdgeInsets.only(
        top: 24,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).padding.bottom + 20,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: Icon(Icons.close, color: textColor),
                onPressed: () => Navigator.of(context).pop(),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 16),
              Text(
                'auth.login_or_create_account'.tr(),
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: textColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),

          // Google Button
          _buildSocialBtn(
            context: context,
            iconPath: 'assets/images/google_logo.png', // Or use an Icon if standard
            label: 'auth.continue_with_google'.tr(),
            bgColor: isDark ? Colors.white : Colors.white,
            textColor: Colors.black87,
            borderColor: Colors.grey[300],
            onTap: () async {
              // Same as in login_screen.dart
              await ref.read(authProvider.notifier).signInWithGoogle();
              if (context.mounted) {
                Navigator.of(context).pop(true);
              }
            },
          ),
          const SizedBox(height: 16),

          // Apple Button (if iOS/Mac)
          if (Theme.of(context).platform == TargetPlatform.iOS || Theme.of(context).platform == TargetPlatform.macOS) ...[
            _buildSocialBtn(
              context: context,
              iconData: Icons.apple,
              label: 'auth.continue_with_apple'.tr(),
              bgColor: isDark ? Colors.white : Colors.black,
              textColor: isDark ? Colors.black : Colors.white,
              onTap: () {
                // Later implement Apple Sign-In
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Apple Login is coming soon')),
                );
              },
            ),
            const SizedBox(height: 16),
          ],

          // Divider
          Row(
            children: [
              Expanded(child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[300])),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'auth.oder'.tr(),
                  style: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[600]),
                ),
              ),
              Expanded(child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[300])),
            ],
          ),
          const SizedBox(height: 16),

          // Continue with Email (Throws to standard LOKMA login screen)
          Text(
            'auth.continue_with_email_or_phone'.tr(),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
          const SizedBox(height: 16),
          
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.push('/login');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEA184A), // Lokma Red / Lieferando Orange
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                'auth.go_to_login'.tr(),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Terms and Policy
          Text(
            'auth.terms_agreement_notice'.tr(),
            style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey[600]),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'auth.privacy_cookie_notice'.tr(),
            style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey[600]),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildSocialBtn({
    required BuildContext context,
    String? iconPath,
    IconData? iconData,
    required String label,
    required Color bgColor,
    required Color textColor,
    Color? borderColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        height: 52,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: borderColor != null ? Border.all(color: borderColor) : null,
        ),
        child: Stack(
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.only(left: 16),
                child: iconPath != null
                  ? Image.asset(iconPath, width: 24, height: 24)
                  : Icon(iconData, color: textColor),
              ),
            ),
            Center(
              child: Text(
                label,
                style: TextStyle(
                  color: textColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
