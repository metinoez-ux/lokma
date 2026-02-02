import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  // LOKMA Brand Colors
  static const Color lokmaRed = Color(0xFFF43F5E); // Rose-500 brand color
  static const Color lokmaOrange = Color(0xFFFF6B35);
  static const Color lokmaDark = Color(0xFF1A1A1A);
  
  bool _isLoading = false;
  
  // Auth mode: 0 = Giriş, 1 = Kayıt
  int _authMode = 0;
  
  // Login mode: 'main', 'email', 'phone'
  String _loginMode = 'main';
  
  // Email controllers
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  
  // Password strength (0-4)
  int _passwordStrength = 0;
  String _passwordStrengthText = '';
  Color _passwordStrengthColor = Colors.grey;
  
  // Phone controllers
  final _phoneController = TextEditingController();
  final _smsCodeController = TextEditingController();
  String? _verificationId;
  bool _codeSent = false;
  
  // GPS-based country code
  String _countryCode = '+49';  // Default to Germany
  String _countryFlag = '🇩🇪';
  String _exampleNumber = '178 123 4567';
  
  @override
  void initState() {
    super.initState();
    _restoreSmsVerificationState();  // Restore state after reCAPTCHA redirect
    _detectCountryFromGPS();
    
    // Listen to password changes for strength validation
    _passwordController.addListener(_updatePasswordStrength);
  }
  
  /// Calculate and update password strength in real-time
  void _updatePasswordStrength() {
    final password = _passwordController.text;
    int strength = 0;
    String text = '';
    Color color = Colors.grey;
    
    if (password.isEmpty) {
      strength = 0;
      text = '';
      color = Colors.grey;
    } else if (password.length < 6) {
      strength = 1;
      text = 'Çok Kısa (min 6 karakter)';
      color = Colors.red;
    } else {
      // Base score for meeting minimum length
      strength = 2;
      
      // +1 for having uppercase letter
      if (password.contains(RegExp(r'[A-Z]'))) strength++;
      
      // +1 for having number
      if (password.contains(RegExp(r'[0-9]'))) strength++;
      
      // +1 for having special character
      if (password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) strength++;
      
      // +1 for length >= 10
      if (password.length >= 10) strength++;
      
      // Cap at 5 (Very Strong)
      strength = strength.clamp(1, 5);
      
      switch (strength) {
        case 1:
          text = 'Çok Zayıf';
          color = Colors.red;
          break;
        case 2:
          text = 'Zayıf';
          color = Colors.orange;
          break;
        case 3:
          text = 'Orta';
          color = Colors.amber;
          break;
        case 4:
          text = 'Güçlü';
          color = Colors.lightGreen;
          break;
        case 5:
          text = 'Çok Güçlü ✓';
          color = Colors.green;
          break;
      }
    }
    
    if (mounted) {
      setState(() {
        _passwordStrength = strength;
        _passwordStrengthText = text;
        _passwordStrengthColor = color;
      });
    }
  }

  /// Restore SMS verification state after reCAPTCHA redirect
  Future<void> _restoreSmsVerificationState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final verificationId = prefs.getString('sms_verification_id');
      final phoneNumber = prefs.getString('sms_phone_number');
      final verificationTime = prefs.getInt('sms_verification_time') ?? 0;
      
      // Only restore if verification was started within the last 5 minutes
      final now = DateTime.now().millisecondsSinceEpoch;
      final fiveMinutesAgo = now - (5 * 60 * 1000);
      
      if (verificationId != null && verificationTime > fiveMinutesAgo) {
        debugPrint('🔄 Restoring SMS verification state from SharedPreferences');
        debugPrint('   VerificationId: $verificationId');
        debugPrint('   PhoneNumber: $phoneNumber');
        
        if (mounted) {
          setState(() {
            _verificationId = verificationId;
            _codeSent = true;
            _loginMode = 'phone';
            if (phoneNumber != null) {
              // Extract local number from formatted phone
              _phoneController.text = phoneNumber.replaceFirst(RegExp(r'^\+\d+'), '');
            }
          });
        }
      }
    } catch (e) {
      debugPrint('❌ Error restoring SMS verification state: $e');
    }
  }

  Future<void> _detectCountryFromGPS() async {
    try {
      // Check permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      
      if (permission == LocationPermission.denied || 
          permission == LocationPermission.deniedForever) {
        return; // Use default
      }
      
      // Get current position
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
      ).timeout(const Duration(seconds: 5));
      
      // Reverse geocode to get country
      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );
      
      if (placemarks.isNotEmpty) {
        final country = placemarks.first.isoCountryCode ?? 'DE';
        _setCountryCode(country);
      }
    } catch (e) {
      debugPrint('GPS country detection failed: $e');
      // Keep default
    }
  }
  
  void _setCountryCode(String isoCode) {
    final Map<String, Map<String, String>> countryData = {
      'DE': {'code': '+49', 'flag': '🇩🇪', 'example': '178 123 4567'},
      'TR': {'code': '+90', 'flag': '🇹🇷', 'example': '532 123 4567'},
      'AT': {'code': '+43', 'flag': '🇦🇹', 'example': '664 123 4567'},
      'CH': {'code': '+41', 'flag': '🇨🇭', 'example': '78 123 4567'},
      'NL': {'code': '+31', 'flag': '🇳🇱', 'example': '6 12345678'},
      'BE': {'code': '+32', 'flag': '🇧🇪', 'example': '470 123456'},
      'FR': {'code': '+33', 'flag': '🇫🇷', 'example': '6 12 34 56 78'},
      'GB': {'code': '+44', 'flag': '🇬🇧', 'example': '7911 123456'},
      'US': {'code': '+1', 'flag': '🇺🇸', 'example': '555 123 4567'},
    };
    
    final data = countryData[isoCode] ?? countryData['DE']!;
    if (mounted) {
      setState(() {
        _countryCode = data['code']!;
        _countryFlag = data['flag']!;
        _exampleNumber = data['example']!;
      });
    }
  }
  
  void _showCountryPicker() {
    final countries = [
      {'iso': 'DE', 'name': 'Almanya', 'code': '+49', 'flag': '🇩🇪'},
      {'iso': 'TR', 'name': 'Türkiye', 'code': '+90', 'flag': '🇹🇷'},
      {'iso': 'AT', 'name': 'Avusturya', 'code': '+43', 'flag': '🇦🇹'},
      {'iso': 'CH', 'name': 'İsviçre', 'code': '+41', 'flag': '🇨🇭'},
      {'iso': 'NL', 'name': 'Hollanda', 'code': '+31', 'flag': '🇳🇱'},
      {'iso': 'BE', 'name': 'Belçika', 'code': '+32', 'flag': '🇧🇪'},
      {'iso': 'FR', 'name': 'Fransa', 'code': '+33', 'flag': '🇫🇷'},
      {'iso': 'GB', 'name': 'İngiltere', 'code': '+44', 'flag': '🇬🇧'},
      {'iso': 'US', 'name': 'ABD', 'code': '+1', 'flag': '🇺🇸'},
    ];
    
    showModalBottomSheet(
      context: context,
      backgroundColor: lokmaDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Ülke Seçin',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ...countries.map((c) => ListTile(
              leading: Text(c['flag']!, style: const TextStyle(fontSize: 24)),
              title: Text(c['name']!, style: const TextStyle(color: Colors.white)),
              trailing: Text(c['code']!, style: const TextStyle(color: Colors.white70)),
              onTap: () {
                _setCountryCode(c['iso']!);
                Navigator.pop(context);
              },
            )),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _phoneController.dispose();
    _smsCodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    
    // If authenticated, go home
    if (authState.isAuthenticated && !authState.isGuest) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/');
      });
    }

    // Show error
    if (authState.error != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(authState.error!), backgroundColor: Colors.red),
        );
        ref.read(authProvider.notifier).clearError();
      });
    }

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              lokmaDark,        // Üst - SİYAH (logo görünür)
              lokmaDark,        // Siyah devam
              lokmaRed,         // Orta - KIRMIZI
              lokmaDark,        // Alt - SİYAH
            ],
            stops: [0.0, 0.25, 0.6, 1.0],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  const SizedBox(height: 60),
                  
                  // LOKMA Logo - Prominent
                  _buildLogoSection(),
                  
                  const SizedBox(height: 48),
                  
                  // Auth Content
                  if (authState.isLoading || _isLoading)
                    const Padding(
                      padding: EdgeInsets.all(40),
                      child: CircularProgressIndicator(color: Colors.white),
                    )
                  else
                    _buildCurrentView(),
                    
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOGO SECTION - Clean & Prominent
  // ═══════════════════════════════════════════════════════════════════
  Widget _buildLogoSection() {
    return Column(
      children: [
        // LOKMA Logo - Large and Prominent
        Container(
          width: 160,
          height: 160,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
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
        
        const SizedBox(height: 24),
        
        // Tagline - Official slogan
        const Text(
          'Fresh. Fast. Local.',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w300,
            letterSpacing: 3,
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // CURRENT VIEW ROUTER
  // ═══════════════════════════════════════════════════════════════════
  Widget _buildCurrentView() {
    switch (_loginMode) {
      case 'email':
        return _buildEmailView();
      case 'phone':
        return _buildPhoneView();
      default:
        return _buildMainView();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN VIEW - Clean Auth Options
  // ═══════════════════════════════════════════════════════════════════
  Widget _buildMainView() {
    return Column(
      children: [
        // Pill Slider - Giriş / Kayıt
        Container(
          height: 56,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(28),
          ),
          child: Row(
            children: [
              _buildPillTab('Giriş Yap', 0),
              _buildPillTab('Yeni Müşteri', 1),
            ],
          ),
        ),
        
        const SizedBox(height: 32),
        
        // SMS Auth Button - Dynamic based on auth mode
        _buildAuthButton(
          icon: Icons.sms_outlined,
          label: _authMode == 0 ? 'SMS ile Giriş Yap' : 'SMS ile Kayıt Ol',
          color: Colors.white,
          textColor: lokmaDark,
          onTap: () => setState(() => _loginMode = 'phone'),
        ),
        
        const SizedBox(height: 12),
        
        // Email Auth Button - Dynamic based on auth mode
        _buildAuthButton(
          icon: Icons.email_outlined,
          label: _authMode == 0 ? 'E-posta ile Giriş Yap' : 'E-posta ile Kayıt Ol',
          color: Colors.white.withOpacity(0.15),
          textColor: Colors.white,
          borderColor: Colors.white.withOpacity(0.3),
          onTap: () => setState(() => _loginMode = 'email'),
        ),
        
        const SizedBox(height: 28),
        
        // Divider
        Row(
          children: [
            Expanded(child: Divider(color: Colors.white.withOpacity(0.3))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'veya',
                style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 14),
              ),
            ),
            Expanded(child: Divider(color: Colors.white.withOpacity(0.3))),
          ],
        ),
        
        const SizedBox(height: 28),
        
        // Social Row
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildSocialCircle(
              icon: Icons.apple,
              onTap: () => _showComingSoon('Apple Sign-In'),
            ),
            const SizedBox(width: 24),
            _buildGoogleButton(
              onTap: _signInWithGoogle,
            ),
          ],
        ),
        
        const SizedBox(height: 32),
        
        // Guest option
        TextButton(
          onPressed: _signInAsGuest,
          child: Text(
            'Misafir olarak devam et',
            style: TextStyle(
              color: Colors.white.withOpacity(0.7),
              fontSize: 14,
              decoration: TextDecoration.underline,
              decorationColor: Colors.white.withOpacity(0.5),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPillTab(String label, int mode) {
    final isSelected = _authMode == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          setState(() => _authMode = mode);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(24),
            boxShadow: isSelected ? [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ] : null,
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? lokmaRed : Colors.white,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 15,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAuthButton({
    required IconData icon,
    required String label,
    required Color color,
    required Color textColor,
    Color? borderColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(16),
          border: borderColor != null ? Border.all(color: borderColor) : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: textColor, size: 22),
            const SizedBox(width: 12),
            Text(
              label,
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

  Widget _buildSocialCircle({
    required IconData icon,
    required VoidCallback onTap,
    bool isGoogle = false,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(
          icon,
          color: isGoogle ? Colors.red : Colors.black,
          size: isGoogle ? 32 : 28,
        ),
      ),
    );
  }

  // Google button with official Google logo
  Widget _buildGoogleButton({required VoidCallback onTap}) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipOval(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Image.asset(
              'assets/images/google_logo.png',
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Text(
                'G',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.red,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // EMAIL VIEW
  // ═══════════════════════════════════════════════════════════════════
  Widget _buildEmailView() {
    return Column(
      children: [
        // Back button
        Align(
          alignment: Alignment.centerLeft,
          child: IconButton(
            onPressed: () => setState(() {
              _loginMode = 'main';
              _emailController.clear();
              _passwordController.clear();
              _confirmPasswordController.clear();
            }),
            icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          ),
        ),
        
        Text(
          _authMode == 1 ? '📧 E-posta ile Kayıt' : '📧 E-posta ile Giriş',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        
        const SizedBox(height: 32),
        
        _buildTextField(
          controller: _emailController,
          label: 'E-posta',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
        ),
        
        const SizedBox(height: 16),
        
        _buildTextField(
          controller: _passwordController,
          label: 'Şifre',
          icon: Icons.lock_outline,
          obscureText: _obscurePassword,
          suffixIcon: IconButton(
            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            icon: Icon(
              _obscurePassword ? Icons.visibility : Icons.visibility_off,
              color: Colors.white54,
            ),
          ),
        ),
        
        if (_authMode == 1) ...[
          const SizedBox(height: 8),
          // Password Strength Indicator
          _buildPasswordStrengthIndicator(),
          const SizedBox(height: 12),
          _buildTextField(
            controller: _confirmPasswordController,
            label: 'Şifre Tekrar',
            icon: Icons.lock_outline,
            obscureText: _obscurePassword,
          ),
        ],
        
        const SizedBox(height: 24),
        
        _buildPrimaryButton(
          label: _authMode == 1 ? 'Kayıt Ol' : 'Giriş Yap',
          onTap: _handleEmailSubmit,
        ),
        
        if (_authMode == 0)
          TextButton(
            onPressed: _handleForgotPassword,
            child: const Text(
              'Şifremi Unuttum',
              style: TextStyle(color: Colors.white70),
            ),
          ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHONE VIEW
  // ═══════════════════════════════════════════════════════════════════
  Widget _buildPhoneView() {
    return Column(
      children: [
        // Back button
        Align(
          alignment: Alignment.centerLeft,
          child: IconButton(
            onPressed: () => setState(() {
              _loginMode = 'main';
              _codeSent = false;
              _verificationId = null;
              _phoneController.clear();
              _smsCodeController.clear();
            }),
            icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          ),
        ),
        
        Text(
          _codeSent ? '🔐 SMS Kodunu Gir' : '📱 Telefon ile Giriş',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        
        const SizedBox(height: 32),
        
        if (!_codeSent) ...[
          // Phone input with country code prefix
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white24),
            ),
            child: Row(
              children: [
                // Country code prefix (tappable to change)
                GestureDetector(
                  onTap: _showCountryPicker,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(16),
                        bottomLeft: Radius.circular(16),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$_countryFlag $_countryCode',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_drop_down, color: Colors.white54, size: 20),
                      ],
                    ),
                  ),
                ),
                // Phone number input
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                    decoration: InputDecoration(
                      hintText: _exampleNumber,
                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.4)),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 12),
          
          Text(
            'SMS ile doğrulama kodu gönderilecek',
            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
          ),
          
          const SizedBox(height: 24),
          
          _buildPrimaryButton(
            label: 'SMS Kodu Gönder',
            onTap: _handleSendSmsCode,
          ),
        ] else ...[
          Text(
            '6 haneli doğrulama kodunu girin',
            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 14),
          ),
          
          const SizedBox(height: 24),
          
          _buildTextField(
            controller: _smsCodeController,
            label: '',
            hint: '------',
            icon: Icons.lock_outline,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 28,
              letterSpacing: 12,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          
          const SizedBox(height: 24),
          
          _buildPrimaryButton(
            label: 'Doğrula ve Giriş Yap',
            onTap: _handleVerifySmsCode,
          ),
          
          TextButton(
            onPressed: _handleSendSmsCode,
            child: const Text(
              'Kodu Tekrar Gönder',
              style: TextStyle(color: Colors.white70),
            ),
          ),
        ],
      ],
    );
  }

  /// Password Strength Indicator Widget
  Widget _buildPasswordStrengthIndicator() {
    if (_passwordController.text.isEmpty) {
      return const SizedBox.shrink();
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Strength bar
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: _passwordStrength / 5.0,
                  backgroundColor: Colors.white.withOpacity(0.2),
                  valueColor: AlwaysStoppedAnimation<Color>(_passwordStrengthColor),
                  minHeight: 6,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              _passwordStrengthText,
              style: TextStyle(
                color: _passwordStrengthColor,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        // Requirements
        if (_passwordStrength < 3) ...[
          Text(
            '💡 Güçlü şifre için:',
            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
          ),
          const SizedBox(height: 4),
          _buildRequirementRow('En az 6 karakter', _passwordController.text.length >= 6),
          _buildRequirementRow('Büyük harf (A-Z)', _passwordController.text.contains(RegExp(r'[A-Z]'))),
          _buildRequirementRow('Rakam (0-9)', _passwordController.text.contains(RegExp(r'[0-9]'))),
          _buildRequirementRow('Özel karakter (!@#\$...)', _passwordController.text.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))),
        ],
      ],
    );
  }
  
  Widget _buildRequirementRow(String text, bool isMet) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        children: [
          Icon(
            isMet ? Icons.check_circle : Icons.circle_outlined,
            size: 12,
            color: isMet ? Colors.green : Colors.white38,
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(
              color: isMet ? Colors.green : Colors.white54,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    String? hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    bool obscureText = false,
    Widget? suffixIcon,
    int? maxLength,
    TextAlign textAlign = TextAlign.start,
    TextStyle? style,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      maxLength: maxLength,
      textAlign: textAlign,
      style: style ?? const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label.isNotEmpty ? label : null,
        hintText: hint,
        labelStyle: const TextStyle(color: Colors.white70),
        hintStyle: TextStyle(color: Colors.white.withOpacity(0.4)),
        prefixIcon: Icon(icon, color: Colors.white70),
        suffixIcon: suffixIcon,
        counterText: '',
        filled: true,
        fillColor: Colors.white.withOpacity(0.1),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.white, width: 2),
        ),
      ),
    );
  }

  Widget _buildPrimaryButton({
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        onTap();
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Center(
          child: Text(
            label,
            style: const TextStyle(
              color: lokmaRed,
              fontSize: 17,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  
  void _showComingSoon(String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$feature yakında!'), backgroundColor: lokmaOrange),
    );
  }

  Future<void> _signInWithGoogle() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(authProvider.notifier).signInWithGoogle();
    } catch (e) {
      debugPrint('Google sign-in error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Google giriş hatası: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _signInAsGuest() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(authProvider.notifier).signInAnonymously();
      if (mounted) context.go('/');
    } catch (e) {
      debugPrint('Guest sign-in error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Misafir giriş hatası: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleEmailSubmit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    
    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('E-posta ve şifre gerekli'), backgroundColor: Colors.red),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      if (_authMode == 1) {
        // Register
        if (password != _confirmPasswordController.text) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Şifreler eşleşmiyor'), backgroundColor: Colors.red),
          );
          setState(() => _isLoading = false);
          return;
        }
        
        await ref.read(authProvider.notifier).registerWithEmail(email, password);
        
        final user = FirebaseAuth.instance.currentUser;
        if (user != null && !user.emailVerified) {
          await user.sendEmailVerification();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('✅ Kayıt başarılı! Doğrulama e-postası gönderildi.'), backgroundColor: Colors.green),
            );
          }
        }
      } else {
        await ref.read(authProvider.notifier).loginWithEmail(email, password);
      }
    } catch (e) {
      debugPrint('Email auth error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Giriş hatası: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleForgotPassword() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen e-posta adresinizi girin'), backgroundColor: Colors.orange),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('📧 Şifre sıfırlama e-postası gönderildi'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    }
    setState(() => _isLoading = false);
  }

  Future<void> _handleSendSmsCode() async {
    final phone = _phoneController.text.trim().replaceAll(' ', '').replaceAll('-', '');
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Telefon numarası gerekli'), backgroundColor: Colors.red),
      );
      return;
    }
    
    // Combine country code with local number (remove leading 0 if present)
    final localNumber = phone.startsWith('0') ? phone.substring(1) : phone;
    final formattedPhone = '$_countryCode$localNumber';
    debugPrint('📱 Sending SMS to: $formattedPhone');
    
    setState(() => _isLoading = true);
    
    try {
      // NOTE: Test mode disabled - using production APNs verification
      // To enable test mode for Firebase test numbers, uncomment the line below:
      // await FirebaseAuth.instance.setSettings(appVerificationDisabledForTesting: true);
      debugPrint('📱 Using production APNs verification');

      await FirebaseAuth.instance.verifyPhoneNumber(

        phoneNumber: formattedPhone,
        timeout: const Duration(seconds: 60),
        forceResendingToken: null,
        codeSent: (verificationId, resendToken) async {
          debugPrint('✅ SMS Code Sent! VerificationId: $verificationId');
          // Persist verification state for reCAPTCHA redirect
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('sms_verification_id', verificationId);
          await prefs.setString('sms_phone_number', formattedPhone);
          await prefs.setInt('sms_verification_time', DateTime.now().millisecondsSinceEpoch);
          debugPrint('💾 Saved verification state to SharedPreferences');
          
          if (!mounted) return;
          setState(() {
            _verificationId = verificationId;
            _codeSent = true;
            _isLoading = false;
            _loginMode = 'phone';  // Ensure we're in phone mode
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('📱 SMS kodu gönderildi'), backgroundColor: Colors.green),
          );
        },
        verificationFailed: (error) {
          debugPrint('❌ SMS Verification Failed: ${error.code} - ${error.message}');
          if (!mounted) return;
          setState(() => _isLoading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Hata: ${error.message ?? error.code}'), backgroundColor: Colors.red),
          );
        },
        verificationCompleted: (credential) async {
          debugPrint('✅ Auto verification completed');
          try {
            await FirebaseAuth.instance.signInWithCredential(credential);
            if (mounted) setState(() => _isLoading = false);
          } catch (e) {
            debugPrint('❌ Auto sign-in error: $e');
            if (mounted) {
              setState(() => _isLoading = false);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Giriş hatası: $e'), backgroundColor: Colors.red),
              );
            }
          }
        },
        codeAutoRetrievalTimeout: (verificationId) {
          debugPrint('⏱️ Auto retrieval timeout: $verificationId');
          _verificationId = verificationId;
        },
      );

    } catch (e) {
      debugPrint('❌ SMS Exception: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('SMS Hatası: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _handleVerifySmsCode() async {
    final code = _smsCodeController.text.trim();
    if (code.isEmpty || code.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('6 haneli kodu girin'), backgroundColor: Colors.red),
      );
      return;
    }
    
    if (_verificationId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Doğrulama ID bulunamadı'), backgroundColor: Colors.red),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    await ref.read(authProvider.notifier).signInWithSmsCode(_verificationId!, code);
    setState(() => _isLoading = false);
  }
}
