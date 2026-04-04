import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'dart:io' show Platform;
import '../../providers/auth_provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
class SimpleAuthScreen extends ConsumerStatefulWidget {
  final bool initRegister;
  const SimpleAuthScreen({super.key, this.initRegister = false});

  @override
  ConsumerState<SimpleAuthScreen> createState() => _SimpleAuthScreenState();
}

class _SimpleAuthScreenState extends ConsumerState<SimpleAuthScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  
  bool _obscurePassword = true;
  bool _isRegister = false;
  bool _isEmailMode = true; // false = SMS mode
  String? _selectedGender;

  @override
  void initState() {
    super.initState();
    _isRegister = widget.initRegister;
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final auth = ref.read(authProvider.notifier);
    
    if (_isEmailMode) {
      final email = _emailController.text.trim();
      final password = _passwordController.text;

      if (email.isEmpty || password.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lütfen tüm alanları doldurun'), backgroundColor: Colors.red),
        );
        return;
      }
      if (_isRegister) {
        if (_selectedGender == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Lütfen cinsiyetinizi seçin.'), backgroundColor: Colors.red),
          );
          return;
        }
        auth.registerWithEmail(email, password, gender: _selectedGender);
      } else {
        auth.loginWithEmail(email, password);
      }
    } else {
      // SMS mode handling - route to main login screen with phone mode
      context.push('/phone-login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;

    // If authenticated, go back or home
    if (authState.isAuthenticated && !authState.isGuest) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/');
        }
      });
    }

    if (authState.error != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // Clear error from state immediately to avoid re-triggering
        final error = authState.error;
        ref.read(authProvider.notifier).clearError();
        
        if (error == 'EMAIL_ALREADY_IN_USE' || error == 'GOOGLE_ALREADY_EXISTS') {
          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              backgroundColor: Theme.of(context).cardColor,
              title: const Text('Hesap Zaten Var'),
              content: const Text(
                'Kullandığınız hesap sistemde zaten kayıtlı. '
                'Lütfen "Giriş Yap" sekmesini kullanarak devam edin.',
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    setState(() {
                      _isRegister = false;
                    });
                  },
                  child: Text(
                    'Giriş Ekranına Dön',
                    style: TextStyle(color: Theme.of(context).primaryColor, fontWeight: FontWeight.bold),
                  ),
                )
              ],
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(error!), backgroundColor: Colors.red),
          );
        }
      });
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: Theme.of(context).primaryColor),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Einloggen oder Konto erstellen', // Giriş yap veya hesap oluştur
          style: TextStyle(
            color: textColor,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        centerTitle: false,
      ),
      body: SafeArea(
        child: authState.isLoading
            ? Center(child: CircularProgressIndicator(color: Theme.of(context).primaryColor))
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Toggle Tabs
                    Container(
                      height: 50,
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(25),
                      ),
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final width = constraints.maxWidth;
                          final pillWidth = width / 2;
                          return GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTapDown: (details) {
                              if (details.localPosition.dx < width / 2) {
                                if (_isRegister) setState(() => _isRegister = false);
                              } else {
                                if (!_isRegister) setState(() => _isRegister = true);
                              }
                            },
                            onHorizontalDragUpdate: (details) {
                              if (details.localPosition.dx < width / 2) {
                                if (_isRegister) setState(() => _isRegister = false);
                              } else {
                                if (!_isRegister) setState(() => _isRegister = true);
                              }
                            },
                            child: Stack(
                              children: [
                                // Sliding Pill Background
                                AnimatedAlign(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeOutBack, // Gives that slight spring-like bounce
                                  alignment: _isRegister ? Alignment.centerRight : Alignment.centerLeft,
                                  child: Container(
                                    width: pillWidth,
                                    height: double.infinity,
                                    decoration: BoxDecoration(
                                      color: Theme.of(context).primaryColor,
                                      borderRadius: BorderRadius.circular(21),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Theme.of(context).primaryColor.withOpacity(0.3), 
                                          blurRadius: 8, 
                                          offset: const Offset(0, 2)
                                        )
                                      ],
                                    ),
                                  ),
                                ),
                                // Transparent Text layer
                                Row(
                                  children: [
                                    Expanded(
                                      child: Center(
                                        child: AnimatedDefaultTextStyle(
                                          duration: const Duration(milliseconds: 200),
                                          style: TextStyle(
                                            color: !_isRegister ? Colors.white : (isDark ? Colors.grey.shade400 : Colors.grey.shade600),
                                            fontWeight: !_isRegister ? FontWeight.w700 : FontWeight.w600,
                                            fontSize: 15,
                                            fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
                                          ),
                                          child: const Text('Giriş Yap'),
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      child: Center(
                                        child: AnimatedDefaultTextStyle(
                                          duration: const Duration(milliseconds: 200),
                                          style: TextStyle(
                                            color: _isRegister ? Colors.white : (isDark ? Colors.grey.shade400 : Colors.grey.shade600),
                                            fontWeight: _isRegister ? FontWeight.w700 : FontWeight.w600,
                                            fontSize: 15,
                                            fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
                                          ),
                                          child: const Text('Kayıt Ol'),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        }
                      ),
                    ),
                    
                    const SizedBox(height: 32),

                    // Social Login Buttons
                    _buildOutlinedButton(
                      icon: Image.asset('assets/images/google_logo.png', height: 24, errorBuilder: (_,__,___) => const Icon(Icons.g_mobiledata, color: Colors.blue, size: 32)),
                      text: 'Mit Google fortfahren', // Google ile devam et
                      isDark: isDark,
                      textColor: textColor,
                      onPressed: () => ref.read(authProvider.notifier).signInWithGoogle(),
                    ),
                    if (Platform.isIOS) ...[
                      const SizedBox(height: 16),
                      _buildSolidButton(
                        icon: const Icon(Icons.apple, color: Colors.white, size: 28),
                        text: 'Mit Apple fortfahren', // Apple ile devam et
                        color: isDark ? Colors.grey.shade800 : Colors.black,
                        textColor: Colors.white,
                        onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('YAKINDA!'))),
                      ),
                    ],
                    
                    const SizedBox(height: 16),
                    
                    // Phone / SMS Login Option
                    _buildOutlinedButton(
                      icon: Icon(Icons.phone_android_outlined, color: textColor, size: 24),
                      text: 'Mit Handynummer fortfahren', // Telefon numarası ile devam et
                      isDark: isDark,
                      textColor: textColor,
                      onPressed: () => context.push('/phone-login'),
                    ),
                    
                    const SizedBox(height: 32),
                    
                    // Divider
                    Row(
                      children: [
                        Expanded(child: Divider(color: isDark ? Colors.grey.shade800 : Colors.grey.shade300)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            'oder', // veya
                            style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
                          ),
                        ),
                        Expanded(child: Divider(color: isDark ? Colors.grey.shade800 : Colors.grey.shade300)),
                      ],
                    ),
                    
                    const SizedBox(height: 32),
                    
                    Text(
                      _isRegister ? 'Mit E-Mail-Adresse registrieren' : 'Mit E-Mail-Adresse einloggen', // E-Posta ile devam et
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: textColor,
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    if (_isRegister) ...[
                      Text(
                        'Geschlecht / Cinsiyet',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textColor),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _selectedGender = 'female'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  color: _selectedGender == 'female' 
                                      ? Theme.of(context).primaryColor.withOpacity(0.1) 
                                      : (isDark ? const Color(0xFF2A2A2A) : Colors.white),
                                  border: Border.all(
                                    color: _selectedGender == 'female' 
                                        ? Theme.of(context).primaryColor 
                                        : (isDark ? Colors.white12 : Colors.grey.shade300)
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Center(
                                  child: Text(
                                    'Kadın',
                                    style: TextStyle(
                                      color: _selectedGender == 'female' 
                                          ? Theme.of(context).primaryColor 
                                          : textColor,
                                      fontWeight: _selectedGender == 'female' ? FontWeight.w700 : FontWeight.normal,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _selectedGender = 'male'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  color: _selectedGender == 'male' 
                                      ? Theme.of(context).primaryColor.withOpacity(0.1) 
                                      : (isDark ? const Color(0xFF2A2A2A) : Colors.white),
                                  border: Border.all(
                                    color: _selectedGender == 'male' 
                                        ? Theme.of(context).primaryColor 
                                        : (isDark ? Colors.white12 : Colors.grey.shade300)
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Center(
                                  child: Text(
                                    'Erkek',
                                    style: TextStyle(
                                      color: _selectedGender == 'male' 
                                          ? Theme.of(context).primaryColor 
                                          : textColor,
                                      fontWeight: _selectedGender == 'male' ? FontWeight.w700 : FontWeight.normal,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Inputs
                    Container(
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                        border: Border.all(color: isDark ? Colors.white12 : Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          TextField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            style: TextStyle(color: textColor),
                            decoration: InputDecoration(
                              hintText: 'E-Mail-Adresse',
                              hintStyle: TextStyle(color: isDark ? Colors.grey.shade400 : Colors.grey.shade500),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                            ),
                          ),
                          Divider(height: 1, color: isDark ? Colors.white12 : Colors.grey.shade300),
                          TextField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            style: TextStyle(color: textColor),
                            decoration: InputDecoration(
                              hintText: 'Passwort', // Şifre
                              hintStyle: TextStyle(color: isDark ? Colors.grey.shade400 : Colors.grey.shade500),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                  color: isDark ? Colors.grey.shade400 : Colors.grey.shade500,
                                ),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Main Action Button
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Theme.of(context).primaryColor,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(26),
                          ),
                        ),
                        child: Text(
                          _isRegister ? 'Konto erstellen' : 'Einloggen', // 'Bestätigungscode abrufen' corresponds to magic link
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Terms
                    Center(
                      child: Text(
                        'Wenn Sie fortfahren, erklären Sie sich mit unseren\nAllgemeinen Geschäftsbedingungen einverstanden.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.grey.shade600,
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Guest Login Option
                    Center(
                      child: TextButton(
                        onPressed: () => ref.read(authProvider.notifier).signInAnonymously(),
                        child: Text(
                          'Als Gast fortfahren', // Misafir olarak devam et
                          style: TextStyle(
                            color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                            fontSize: 14,
                            decoration: TextDecoration.underline,
                            decorationColor: isDark ? Colors.grey.shade500 : Colors.grey.shade400,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildOutlinedButton({required Widget icon, required String text, required bool isDark, required Color textColor, required VoidCallback onPressed}) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: isDark ? Colors.white24 : Colors.grey.shade300, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
          backgroundColor: isDark ? Colors.transparent : Colors.white,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            icon,
            const SizedBox(width: 12),
            Text(
              text,
              style: TextStyle(
                color: textColor,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSolidButton({required Widget icon, required String text, required Color color, required Color textColor, required VoidCallback onPressed}) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: textColor,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            icon,
            const SizedBox(width: 12),
            Text(
              text,
              style: TextStyle(
                color: textColor,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
