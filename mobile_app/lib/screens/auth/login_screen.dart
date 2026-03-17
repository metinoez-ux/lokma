import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../providers/auth_provider.dart';
import '../../services/referral_service.dart';

/// Phone number check result before sending SMS
enum _PhoneStatus { idle, notRegistered, alreadyRegistered }

class LoginScreen extends ConsumerStatefulWidget {
  final bool embedded;
  const LoginScreen({super.key, this.embedded = false});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  // LOKMA Brand Colors
  static const Color lokmaRed = Color(0xFFFF0033); // Splash screen red
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
  final _referralCodeController = TextEditingController();
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
  _PhoneStatus _phoneStatus = _PhoneStatus.idle;  // pre-send check result
  String _checkedFormattedPhone = '';              // the phone we last checked
  
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
      text = tr('auth.cok_kisa_min_6_karakter');
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
          text = tr('auth.cok_zayif');
          color = Colors.red;
          break;
        case 2:
          text = tr('auth.zayif');
          color = Colors.amber;
          break;
        case 3:
          text = tr('auth.orta');
          color = Colors.amber;
          break;
        case 4:
          text = tr('auth.guclu');
          color = Colors.lightGreen;
          break;
        case 5:
          text = tr('auth.cok_guclu');
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
      {'iso': 'TR', 'name': tr('auth.turkiye'), 'code': '+90', 'flag': '🇹🇷'},
      {'iso': 'AT', 'name': 'Avusturya', 'code': '+43', 'flag': '🇦🇹'},
      {'iso': 'CH', 'name': tr('auth.i_svicre'), 'code': '+41', 'flag': '🇨🇭'},
      {'iso': 'NL', 'name': 'Hollanda', 'code': '+31', 'flag': '🇳🇱'},
      {'iso': 'BE', 'name': tr('auth.belcika'), 'code': '+32', 'flag': '🇧🇪'},
      {'iso': 'FR', 'name': 'Fransa', 'code': '+33', 'flag': '🇫🇷'},
      {'iso': 'GB', 'name': tr('auth.i_ngiltere'), 'code': '+44', 'flag': '🇬🇧'},
      {'iso': 'US', 'name': 'ABD', 'code': '+1', 'flag': '🇺🇸'},
    ];
    
    showModalBottomSheet(
      context: context,
      backgroundColor: lokmaDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: EdgeInsets.all(16),
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
            SizedBox(height: 16),
            Text(
              tr('auth.ulke_secin'),
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 16),
            ...countries.map((c) => ListTile(
              leading: Text(c['flag']!, style: TextStyle(fontSize: 24)),
              title: Text(c['name']!, style: TextStyle(color: Colors.white)),
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
    _referralCodeController.dispose();
    _phoneController.dispose();
    _smsCodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    
    // If authenticated, go home
    if (authState.isAuthenticated && !authState.isGuest) {
      if (!widget.embedded) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          context.go('/');
        });
      }
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

    final screenHeight = MediaQuery.of(context).size.height;
    
    final content = Container(
      color: lokmaRed,
      child: SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: screenHeight),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  SizedBox(height: widget.embedded ? 40 : 60),
                  
                  // LOKMA Logo - Prominent
                  _buildLogoSection(),
                  
                  SizedBox(height: 48),
                  
                  // Auth Content
                  if (authState.isLoading || _isLoading)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          const CircularProgressIndicator(color: Colors.white),
                          const SizedBox(height: 20),
                          Text(
                            _buildLoadingMessage(),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
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

    if (widget.embedded) {
      return content;
    }
    return Scaffold(
      backgroundColor: lokmaRed,
      body: content,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOGO SECTION - Clean & Prominent
  // ═══════════════════════════════════════════════════════════════════
  Widget _buildLogoSection() {
    return Image.asset(
      'assets/images/lokma_logo_white.png',
      width: 200,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => Text(
        'LOKMA',
        style: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: Colors.white,
          letterSpacing: 2,
        ),
      ),
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
        GestureDetector(
          onHorizontalDragEnd: (details) {
            if (details.primaryVelocity == null) return;
            if (details.primaryVelocity! < -50 && _authMode == 0) {
              HapticFeedback.lightImpact();
              setState(() => _authMode = 1);
            } else if (details.primaryVelocity! > 50 && _authMode == 1) {
              HapticFeedback.lightImpact();
              setState(() => _authMode = 0);
            }
          },
          child: Container(
            height: 42,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(21),
            ),
            child: Row(
              children: [
                _buildPillTab(tr('auth.giris_yap'), 0),
                _buildPillTab(tr('auth.yeni_musteri'), 1),
              ],
            ),
          ),
        ),
        
        const SizedBox(height: 32),
        
        // SMS Auth Button - Dynamic based on auth mode
        _buildAuthButton(
          icon: Icons.sms_outlined,
          label: _authMode == 0 ? tr('auth.sms_ile_giris_yap') : tr('auth.sms_ile_kayit_ol'),
          color: Colors.white,
          textColor: lokmaDark,
          onTap: () => setState(() {
            _loginMode = 'phone';
            _phoneStatus = _PhoneStatus.idle;
            _codeSent = false;
          }),
        ),
        
        const SizedBox(height: 12),
        
        // Email Auth Button - Dynamic based on auth mode
        _buildAuthButton(
          icon: Icons.email_outlined,
          label: _authMode == 0 ? tr('auth.e_posta_ile_giris_yap') : tr('auth.e_posta_ile_kayit_ol'),
          color: Colors.white.withValues(alpha: 0.15),
          textColor: Colors.white,
          borderColor: Colors.white.withValues(alpha: 0.3),
          onTap: () => setState(() => _loginMode = 'email'),
        ),
        
        const SizedBox(height: 28),
        
        // Divider
        Row(
          children: [
            Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.3))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                tr('auth.veya'),
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14),
              ),
            ),
            Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.3))),
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
            tr('auth.misafir_olarak_devam'),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 14,
              decoration: TextDecoration.underline,
              decorationColor: Colors.white.withValues(alpha: 0.5),
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
            borderRadius: BorderRadius.circular(18),
            boxShadow: isSelected ? [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ] : null,
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? lokmaRed : Colors.white,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                fontSize: 13,
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
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(14),
          border: borderColor != null ? Border.all(color: borderColor) : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: textColor, size: 18),
            const SizedBox(width: 10),
            Text(
              label,
              style: TextStyle(
                color: textColor,
                fontSize: 14,
                fontWeight: FontWeight.w500,
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
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(
          icon,
          color: Colors.black,
          size: 26,
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
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.1),
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
                  fontWeight: FontWeight.w600,
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
            icon: Icon(Icons.arrow_back_ios, color: Colors.white),
          ),
        ),
        
        Text(
          _authMode == 1 ? tr('auth.e_posta_ile_kayit') : tr('auth.e_posta_ile_giris'),
          style: TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.w600,
          ),
        ),
        
        const SizedBox(height: 32),
        
        _buildTextField(
          controller: _emailController,
          label: tr('auth.e_posta'),
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
        ),
        
        const SizedBox(height: 16),
        
        _buildTextField(
          controller: _passwordController,
          label: tr('auth.sifre'),
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
            label: tr('auth.sifre_tekrar'),
            icon: Icons.lock_outline,
            obscureText: _obscurePassword,
          ),
          const SizedBox(height: 12),
          // Referral code field (optional)
          _buildTextField(
            controller: _referralCodeController,
            label: tr('auth.davet_kodu'),
            hint: 'Örn: ABC123',
            icon: Icons.card_giftcard_outlined,
          ),
        ],
        
        const SizedBox(height: 24),
        
        _buildPrimaryButton(
          label: _authMode == 1 ? tr('auth.kayit_ol') : tr('auth.giris_yap'),
          onTap: _handleEmailSubmit,
        ),
        
        if (_authMode == 0)
          TextButton(
            onPressed: _handleForgotPassword,
            child: Text(
              tr('auth.sifremi_unuttum'),
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
              _phoneStatus = _PhoneStatus.idle;
              _phoneController.clear();
              _smsCodeController.clear();
            }),
            icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          ),
        ),

        Text(
          _codeSent
              ? tr('auth.sms_kodunu_gir')
              : _authMode == 1
                  ? tr('auth.sms_ile_kayit_ol')
                  : tr('auth.sms_ile_giris_yap'),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.w600,
          ),
        ),

        const SizedBox(height: 32),

        if (!_codeSent) ...[
          // Phone input with country code prefix
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                // Country code picker
                GestureDetector(
                  onTap: _showCountryPicker,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
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
                    autofocus: true,
                    onChanged: (_) {
                      // Reset status when user edits the number
                      if (_phoneStatus != _PhoneStatus.idle) {
                        setState(() => _phoneStatus = _PhoneStatus.idle);
                      }
                    },
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                    decoration: InputDecoration(
                      hintText: _exampleNumber,
                      hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4)),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // ── Status banners (shown BEFORE sending code) ──────────────────
          if (_phoneStatus == _PhoneStatus.notRegistered) ...[
            _buildPhoneStatusBanner(
              message: tr('auth.phone_not_registered'),
              suggestion: tr('auth.want_to_register_with_this_number'),
              actionLabel: tr('auth.yeni_musteri'),
              onAction: () => setState(() {
                _authMode = 1;
                _phoneStatus = _PhoneStatus.idle;
              }),
            ),
            const SizedBox(height: 16),
          ] else if (_phoneStatus == _PhoneStatus.alreadyRegistered) ...[
            _buildPhoneStatusBanner(
              message: tr('auth.phone_already_registered'),
              suggestion: tr('auth.want_to_login_with_this_number'),
              actionLabel: tr('auth.giris_yap'),
              onAction: () => setState(() {
                _authMode = 0;
                _phoneStatus = _PhoneStatus.idle;
              }),
            ),
            const SizedBox(height: 16),
          ] else ...[
            Text(
              _authMode == 0
                  ? tr('auth.sms_ile_dogrulama_kodu_gonderi')
                  : tr('auth.yeni_hesap_icin_sms_kodu_gonderilecek'),
              style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13),
            ),
            const SizedBox(height: 24),
          ],

          // Send SMS button — hidden when a status banner is shown so the user
          // must explicitly choose (register / login) before retrying.
          if (_phoneStatus == _PhoneStatus.idle)
            _buildPrimaryButton(
              label: tr('auth.sms_kodu_gonder'),
              onTap: _handleSendSmsCode,
            ),

        ] else ...[
          // Hangi numaraya gonderildi
          RichText(
            textAlign: TextAlign.center,
            text: TextSpan(
              style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 14),
              children: [
                TextSpan(text: tr('auth.6_haneli_dogrulama_kodunu_giri')),
                const TextSpan(text: '\n'),
                TextSpan(
                  text: '$_countryCode${_phoneController.text.trim().replaceAll(' ', '').replaceAll('-', '').replaceFirst(RegExp(r'^0'), '')}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
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
            fillColor: Colors.white,
            iconColor: Colors.black54,
            style: const TextStyle(
              fontSize: 28,
              letterSpacing: 12,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),

          const SizedBox(height: 24),

          _buildPrimaryButton(
            label: tr('auth.dogrula_ve_giris_yap'),
            onTap: _handleVerifySmsCode,
          ),

          const SizedBox(height: 8),

          // Yanlis numara → geri don
          TextButton(
            onPressed: () => setState(() {
              _codeSent = false;
              _verificationId = null;
              _smsCodeController.clear();
              _loginMode = 'phone';
            }),
            child: Text(
              tr('auth.wrong_number_change'),
              style: const TextStyle(color: Colors.white54, fontSize: 13),
            ),
          ),

          TextButton(
            onPressed: _handleSendSmsCode,
            child: Text(
              tr('auth.kodu_tekrar_gonder'),
              style: const TextStyle(color: Colors.white70),
            ),
          ),
        ],
      ],
    );
  }

  /// Status banner shown when phone lookup result prevents SMS from being sent.
  Widget _buildPhoneStatusBanner({
    required String message,
    required String suggestion,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            message,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
          ),
          const SizedBox(height: 6),
          Text(
            suggestion,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 13),
          ),
          const SizedBox(height: 14),
          GestureDetector(
            onTap: onAction,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                actionLabel,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFFFF0033),
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
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
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
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
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        // Requirements
        if (_passwordStrength < 3) ...[
          Text(
            tr('auth.guclu_sifre_icin'),
            style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 11),
          ),
          const SizedBox(height: 4),
          _buildRequirementRow('En az 6 karakter', _passwordController.text.length >= 6),
          _buildRequirementRow(tr('auth.buyuk_harf_a_z'), _passwordController.text.contains(RegExp(r'[A-Z]'))),
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
    Color? fillColor,
    Color? iconColor,
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
        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4)),
        prefixIcon: Icon(icon, color: iconColor ?? Colors.white70),
        suffixIcon: suffixIcon,
        counterText: '',
        filled: true,
        fillColor: fillColor ?? Colors.white.withValues(alpha: 0.1),
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
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.2),
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
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  
  String _buildLoadingMessage() {
    final phone = _phoneController.text.trim();
    if (_loginMode == 'phone' && phone.isNotEmpty) {
      if (_authMode == 1) {
        return tr('auth.registering_with_number', namedArgs: {'phone': phone});
      } else {
        return tr('auth.logging_in_with_number', namedArgs: {'phone': phone});
      }
    }
    if (_loginMode == 'phone' && _codeSent) {
      return tr('auth.verifying_code');
    }
    return tr('auth.please_wait');
  }

  void _showComingSoon(String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$feature coming soon!'), backgroundColor: lokmaRed),
    );
  }

  Future<void> _signInWithGoogle() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(authProvider.notifier).signInWithGoogle();
      // Apply referral code for new Google sign-in users
      final user = FirebaseAuth.instance.currentUser;
      if (user != null && _authMode == 1) {
        final referralCode = _referralCodeController.text.trim();
        if (referralCode.isNotEmpty) {
          await ReferralService.applyReferralCode(user.uid, referralCode);
        }
      }
    } catch (e) {
      debugPrint('Google sign-in error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('auth.google_login_error_e')), backgroundColor: Colors.red),
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
          SnackBar(content: Text(tr('auth.guest_login_error_e')), backgroundColor: Colors.red),
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
        SnackBar(content: Text(tr('auth.email_pass_required')), backgroundColor: Colors.red),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      if (_authMode == 1) {
        // Register
        if (password != _confirmPasswordController.text) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(tr('auth.passwords_do_not_match')), backgroundColor: Colors.red),
          );
          setState(() => _isLoading = false);
          return;
        }
        
        await ref.read(authProvider.notifier).registerWithEmail(email, password);
        
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          // Apply referral code if provided
          final referralCode = _referralCodeController.text.trim();
          if (referralCode.isNotEmpty) {
            final applied = await ReferralService.applyReferralCode(user.uid, referralCode);
            if (mounted && applied) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('🎉 Davet kodu uygulandı!'), backgroundColor: Colors.green),
              );
            }
          }
          
          if (!user.emailVerified) {
            await user.sendEmailVerification();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(tr('auth.registration_success_email_sent')), backgroundColor: Colors.green),
              );
            }
          }
        }
      } else {
        await ref.read(authProvider.notifier).loginWithEmail(email, password);
      }
    } catch (e) {
      debugPrint('Email auth error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('auth.login_error_e')), backgroundColor: Colors.red),
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
        SnackBar(content: Text(tr('auth.please_enter_email')), backgroundColor: Colors.amber),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('auth.pass_reset_email_sent')), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('common.error_e')), backgroundColor: Colors.red),
        );
      }
    }
    setState(() => _isLoading = false);
  }

  Future<void> _handleSendSmsCode() async {
    final raw = _phoneController.text.trim().replaceAll(' ', '').replaceAll('-', '');
    if (raw.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('auth.phone_number_required')), backgroundColor: Colors.red),
      );
      return;
    }

    final localNumber = raw.startsWith('0') ? raw.substring(1) : raw;
    final formattedPhone = '$_countryCode$localNumber';

    setState(() {
      _isLoading = true;
      _phoneStatus = _PhoneStatus.idle;
    });

    // ── Step 1: Check Firestore for existing account ─────────────────────
    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('users')
          .where('phoneNumber', isEqualTo: formattedPhone)
          .limit(1)
          .get();
      final exists = snapshot.docs.isNotEmpty;

      if (_authMode == 0 && !exists) {
        // LOGIN mode — number not in our system
        debugPrint('Phone lookup: $formattedPhone NOT found (login mode)');
        if (mounted) {
          setState(() {
            _isLoading = false;
            _phoneStatus = _PhoneStatus.notRegistered;
            _checkedFormattedPhone = formattedPhone;
          });
        }
        return;
      }

      if (_authMode == 1 && exists) {
        // REGISTER mode — number already taken
        debugPrint('Phone lookup: $formattedPhone ALREADY registered (register mode)');
        if (mounted) {
          setState(() {
            _isLoading = false;
            _phoneStatus = _PhoneStatus.alreadyRegistered;
            _checkedFormattedPhone = formattedPhone;
          });
        }
        return;
      }
    } catch (e) {
      debugPrint('Firestore phone lookup error: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        // LOGIN modunda lookup basarisiz olursa kullaniciya haber ver
        // Kayit modunda engelleme — devam et
        if (_authMode == 0) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(tr('auth.phone_check_failed')),
              backgroundColor: Colors.orange,
            ),
          );
          return;
        }
      }
    }

    // ── Step 2: Send SMS code via Firebase Auth ───────────────────────────
    debugPrint('Sending SMS to: $formattedPhone (authMode=$_authMode)');

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: formattedPhone,
        timeout: const Duration(seconds: 60),
        forceResendingToken: null,
        codeSent: (verificationId, resendToken) async {
          debugPrint('SMS sent. verificationId: $verificationId');
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('sms_verification_id', verificationId);
          await prefs.setString('sms_phone_number', formattedPhone);
          await prefs.setInt('sms_verification_time', DateTime.now().millisecondsSinceEpoch);
          if (!mounted) return;
          setState(() {
            _verificationId = verificationId;
            _codeSent = true;
            _isLoading = false;
            _loginMode = 'phone';
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(tr('auth.sms_code_sent')), backgroundColor: Colors.green),
          );
        },
        verificationFailed: (error) {
          debugPrint('SMS verification failed: ${error.code} - ${error.message}');
          if (!mounted) return;
          setState(() => _isLoading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(tr('common.error_message_or_code')), backgroundColor: Colors.red),
          );
        },
        verificationCompleted: (credential) async {
          debugPrint('Auto verification completed');
          try {
            await FirebaseAuth.instance.signInWithCredential(credential);
            if (mounted) setState(() => _isLoading = false);
          } catch (e) {
            debugPrint('Auto sign-in error: $e');
            if (mounted) {
              setState(() => _isLoading = false);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(tr('auth.login_error_e')), backgroundColor: Colors.red),
              );
            }
          }
        },
        codeAutoRetrievalTimeout: (verificationId) {
          _verificationId = verificationId;
        },
      );
    } catch (e) {
      debugPrint('SMS exception: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('auth.sms_error_e')), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _handleVerifySmsCode() async {
    final code = _smsCodeController.text.trim();
    if (code.isEmpty || code.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('auth.enter_6_digit_short')), backgroundColor: Colors.red),
      );
      return;
    }
    
    if (_verificationId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('auth.verification_id_not_found')), backgroundColor: Colors.red),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    await ref.read(authProvider.notifier).signInWithSmsCode(_verificationId!, code);
    // Apply referral code for new SMS sign-up users
    final user = FirebaseAuth.instance.currentUser;
    if (user != null && _authMode == 1) {
      final referralCode = _referralCodeController.text.trim();
      if (referralCode.isNotEmpty) {
        await ReferralService.applyReferralCode(user.uid, referralCode);
      }
    }
    setState(() => _isLoading = false);
  }
}
