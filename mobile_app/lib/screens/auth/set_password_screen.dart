import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../providers/auth_provider.dart';

// Assuming you have easy_localization installed, otherwise replace 'tr('...')' with simple strings for now or import your localizations.
// If easy_localization is used in the app, it usually is:
import 'package:easy_localization/easy_localization.dart';

class SetPasswordScreen extends ConsumerStatefulWidget {
  const SetPasswordScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<SetPasswordScreen> createState() => _SetPasswordScreenState();
}

class _SetPasswordScreenState extends ConsumerState<SetPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  final Color lokmaRed = const Color(0xFFFF0033);

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
        SnackBar(content: Text('Şifre en az 6 karakter olmalıdır'), backgroundColor: Colors.red),
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

      // Check if user has phone number
      if (user.phoneNumber == null || user.phoneNumber!.isEmpty) {
        throw Exception('Kullanıcının telefon numarası bulunmuyor');
      }

      // Generate pseudo-email based on phone string
      final phoneString = user.phoneNumber!.replaceAll('+', '');
      final pseudoEmail = '$phoneString@lokma.shop';

      // Link email+password credential to existing phone-auth user
      // This allows future login via pseudo-email + password
      try {
        final credential = EmailAuthProvider.credential(
          email: pseudoEmail,
          password: password,
        );
        await user.linkWithCredential(credential);
      } catch (e) {
        debugPrint('linkWithCredential error: $e');
        // If already linked, try updating the password directly
        try {
          await user.updatePassword(password);
        } catch (e2) {
          debugPrint('updatePassword fallback error: $e2');
        }
      }

      // Now save to firestore
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: lokmaRed,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              const Icon(Icons.lock_person_rounded, size: 80, color: Colors.white),
              const SizedBox(height: 24),
              const Text(
                'Lütfen Bir Şifre Belirleyin',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                'Gelecekte SMS kodu beklemeden giriş yapabilmeniz için lütfen güvenli bir şifre belirleyin.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 16),
              ),
              const SizedBox(height: 40),
              
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Yeni Şifre',
                  labelStyle: const TextStyle(color: Colors.white70),
                  prefixIcon: const Icon(Icons.lock_outline, color: Colors.white70),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: Colors.white70,
                    ),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.1),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _confirmController,
                obscureText: _obscurePassword,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Şifrenizi Tekrar Girin',
                  labelStyle: const TextStyle(color: Colors.white70),
                  prefixIcon: const Icon(Icons.lock_reset, color: Colors.white70),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.1),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 40),
              
              _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Colors.white))
                  : GestureDetector(
                      onTap: _handleSavePassword,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, 4)),
                          ]
                        ),
                        child: Text(
                          'Şifremi Kaydet',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: lokmaRed, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    
              const SizedBox(height: 24),
              TextButton(
                onPressed: () => context.go('/'),
                child: const Text('Şimdilik Atla', style: TextStyle(color: Colors.white70, fontSize: 16)),
              )
            ],
          ),
        ),
      ),
    );
  }
}
