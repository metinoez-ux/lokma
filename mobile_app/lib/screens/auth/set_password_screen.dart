import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';

class SetPasswordScreen extends ConsumerStatefulWidget {
  const SetPasswordScreen({super.key});

  @override
  ConsumerState<SetPasswordScreen> createState() => _SetPasswordScreenState();
}

class _SetPasswordScreenState extends ConsumerState<SetPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  final Color lokmaRed = const Color(0xFFFF0033);

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _textColor => _isDark ? Colors.white : Colors.black87;
  Color get _borderColor => _isDark ? Colors.grey.shade800 : Colors.grey.shade300;
  Color get _cardColor => _isDark ? const Color(0xFF2A2A2A) : Colors.white;
  Color get _bgColor => _isDark ? const Color(0xFF1E1E1E) : const Color(0xFFFAFAFA);

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _handleSavePassword() async {
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    if (password.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Şifre en az 6 karakter olmalıdır'), backgroundColor: Colors.red),
      );
      return;
    }

    if (password != confirm) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Şifreler eşleşmiyor'), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('Kullanıcı oturumu bulunamadı');

      if (user.phoneNumber == null || user.phoneNumber!.isEmpty) {
        throw Exception('Kullanıcının telefon numarası bulunmuyor');
      }

      final phoneString = user.phoneNumber!.replaceAll('+', '');
      final pseudoEmail = '$phoneString@lokma.shop';

      try {
        final credential = EmailAuthProvider.credential(
          email: pseudoEmail,
          password: password,
        );
        await user.linkWithCredential(credential);
      } catch (e) {
        debugPrint('linkWithCredential error: $e');
        try {
          await user.updatePassword(password);
        } catch (e2) {
          debugPrint('updatePassword fallback error: $e2');
        }
      }

      await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
        'email': pseudoEmail,
      }, SetOptions(merge: true));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Şifreniz başarıyla oluşturuldu!'), backgroundColor: Colors.green),
        );
        context.go('/');
      }
    } catch (e) {
      debugPrint('Set Password Error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: ${e.toString()}'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String labelText,
    required IconData prefixIcon,
    bool isPassword = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: _bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _borderColor, width: 1.5),
      ),
      child: TextField(
        controller: controller,
        obscureText: isPassword && _obscurePassword,
        style: TextStyle(
          color: _textColor,
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
        decoration: InputDecoration(
          labelText: labelText,
          labelStyle: TextStyle(
            color: _textColor.withOpacity(0.5),
            fontSize: 15,
            fontWeight: FontWeight.w400,
          ),
          prefixIcon: Icon(prefixIcon, color: _textColor.withOpacity(0.5), size: 22),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    color: _textColor.withOpacity(0.5),
                    size: 22,
                  ),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: _isDark
                  ? [const Color(0xFF1E1E1E), const Color(0xFF121212)]
                  : [const Color(0xFFFAFAFA), const Color(0xFFEEEEEE)],
            ),
          ),
          child: SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: screenHeight),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Theme Toggle (Quick Access)
                      Align(
                        alignment: Alignment.topRight,
                        child: IconButton(
                          icon: Icon(
                            _isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                            color: _textColor.withOpacity(0.5),
                          ),
                          onPressed: () {
                            final current = ref.read(themePreferenceProvider);
                            final next = current == ThemePreference.dark
                                ? ThemePreference.light
                                : ThemePreference.dark;
                            ref.read(themePreferenceProvider.notifier).setPreference(next);
                          },
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Animated Lock Icon + Title
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: lokmaRed.withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.lock_person_rounded, size: 64, color: lokmaRed),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Lütfen Bir Şifre Belirleyin',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _textColor,
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Gelecekte SMS kodu beklemeden giriş yapabilmeniz için lütfen güvenli bir şifre belirleyin.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: _textColor.withOpacity(0.6), fontSize: 16),
                      ),
                      const SizedBox(height: 40),

                      // Form Card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
                        decoration: BoxDecoration(
                          color: _cardColor,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: _isDark
                                  ? Colors.black.withOpacity(0.3)
                                  : Colors.black.withOpacity(0.04),
                              blurRadius: 24,
                              offset: const Offset(0, 8),
                            ),
                          ],
                          border: Border.all(
                            color: _borderColor,
                            width: 1,
                          ),
                        ),
                        child: Column(
                          children: [
                            _buildTextField(
                              controller: _passwordController,
                              labelText: 'Yeni Şifre',
                              prefixIcon: Icons.lock_outline,
                              isPassword: true,
                            ),
                            const SizedBox(height: 16),
                            _buildTextField(
                              controller: _confirmController,
                              labelText: 'Şifrenizi Tekrar Girin',
                              prefixIcon: Icons.lock_reset,
                              isPassword: true,
                            ),
                            const SizedBox(height: 32),

                            if (_isLoading)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: CircularProgressIndicator(color: lokmaRed),
                              )
                            else
                              GestureDetector(
                                onTap: _handleSavePassword,
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(vertical: 18),
                                  decoration: BoxDecoration(
                                    color: lokmaRed,
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(
                                        color: lokmaRed.withOpacity(0.3),
                                        blurRadius: 12,
                                        offset: const Offset(0, 6),
                                      ),
                                    ],
                                  ),
                                  child: const Text(
                                    'Şifremi Kaydet',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Skip Button
                      TextButton(
                        onPressed: () => context.go('/'),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: Text(
                          'Şimdilik Atla',
                          style: TextStyle(
                            color: _textColor.withOpacity(0.5),
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 40),
                    ],
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
