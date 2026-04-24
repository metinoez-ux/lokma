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
import '../../providers/theme_provider.dart';
import '../../services/referral_service.dart';

/// Phone number check result before sending SMS
enum _PhoneStatus { idle, notRegistered, alreadyRegistered }

class LoginScreen extends ConsumerStatefulWidget {
  final bool embedded;
  final bool initRegister;
  final bool initPhone;
  const LoginScreen({
    super.key,
    this.embedded = false,
    this.initRegister = false,
    this.initPhone = false,
  });

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _textColor => _isDark ? Colors.white : Colors.black87;
  Color get _borderColor =>
      _isDark ? Colors.grey.shade800 : Colors.grey.shade300;
  Color get _cardColor =>
      _isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100;
  Color get _hintColor => _isDark ? Colors.white54 : Colors.black54;

  // LOKMA Brand Colors
  static const Color lokmaRed = Color(0xFFFF0033); // Splash screen red
  static const Color lokmaDark = Color(0xFF1A1A1A);

  bool _isLoading = false;
  bool _isHandlingOAuthConsent = false;

  // Auth mode: 0 = Giriş, 1 = Kayıt
  late int _authMode;

  // Login mode: 'main', 'email', 'phone'
  late String _loginMode;

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
  String _sentFormattedPhone = '';
  bool _codeSent = false;
  _PhoneStatus _phoneStatus = _PhoneStatus.idle; // pre-send check result
  bool _forceSmsLogin = false; // Forces SMS login, bypassing password check

  // GPS-based country code
  String _countryCode = '+49'; // Default to Germany
  String _countryFlag = '🇩🇪';
  String _exampleNumber = '178 123 4567';
  String _countryIso = 'DE';

  @override
  void initState() {
    super.initState();
    _authMode = widget.initRegister ? 1 : 0;
    _loginMode = widget.initPhone ? 'phone' : 'main';
    _restoreSmsVerificationState(); // Restore state after reCAPTCHA redirect
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
        debugPrint(
            '🔄 Restoring SMS verification state from SharedPreferences');
        debugPrint('   VerificationId: $verificationId');
        debugPrint('   PhoneNumber: $phoneNumber');

        if (mounted) {
          setState(() {
            _verificationId = verificationId;
            _codeSent = true;
            _loginMode = 'phone';
            if (phoneNumber != null) {
              _sentFormattedPhone = phoneNumber;
              // Extract local number from formatted phone
              _phoneController.text =
                  phoneNumber.replaceFirst(RegExp(r'^\+\d+'), '');
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
      'MX': {'code': '+52', 'flag': '🇲🇽', 'example': '55 1234 5678'},
      'NO': {'code': '+47', 'flag': '🇳🇴', 'example': '412 34 567'},
      'DK': {'code': '+45', 'flag': '🇩🇰', 'example': '20 12 34 56'},
      'PL': {'code': '+48', 'flag': '🇵🇱', 'example': '512 345 678'},
      'HU': {'code': '+36', 'flag': '🇭🇺', 'example': '30 123 4567'},
      'SI': {'code': '+386', 'flag': '🇸🇮', 'example': '40 123 456'},
      'AL': {'code': '+355', 'flag': '🇦🇱', 'example': '69 123 4567'},
      'BG': {'code': '+359', 'flag': '🇧🇬', 'example': '88 123 4567'},
      'IT': {'code': '+39', 'flag': '🇮🇹', 'example': '312 345 6789'},
      'ES': {'code': '+34', 'flag': '🇪🇸', 'example': '612 345 678'},
      'PT': {'code': '+351', 'flag': '🇵🇹', 'example': '912 345 678'},
    };

    final data = countryData[isoCode] ?? countryData['DE']!;
    if (mounted) {
      setState(() {
        _countryCode = data['code']!;
        _countryFlag = data['flag']!;
        _exampleNumber = data['example']!;
        _countryIso = isoCode;
      });
    }
  }

  void _showCountryPicker() {
    final countries = [
      {'iso': 'DE', 'name': tr('auth.almanya'), 'code': '+49', 'flag': '🇩🇪'},
      {'iso': 'TR', 'name': tr('auth.turkiye'), 'code': '+90', 'flag': '🇹🇷'},
      {'iso': 'MX', 'name': tr('auth.meksika'), 'code': '+52', 'flag': '🇲🇽'},
      {'iso': 'US', 'name': tr('auth.abd'), 'code': '+1', 'flag': '🇺🇸'},
      {
        'iso': 'AL',
        'name': tr('auth.arnavutluk'),
        'code': '+355',
        'flag': '🇦🇱'
      },
      {
        'iso': 'AT',
        'name': tr('auth.avusturya'),
        'code': '+43',
        'flag': '🇦🇹'
      },
      {'iso': 'BE', 'name': tr('auth.belcika'), 'code': '+32', 'flag': '🇧🇪'},
      {
        'iso': 'BG',
        'name': tr('auth.bulgaristan'),
        'code': '+359',
        'flag': '🇧🇬'
      },
      {
        'iso': 'DK',
        'name': tr('auth.danimarka'),
        'code': '+45',
        'flag': '🇩🇰'
      },
      {'iso': 'FR', 'name': tr('auth.fransa'), 'code': '+33', 'flag': '🇫🇷'},
      {'iso': 'NL', 'name': tr('auth.hollanda'), 'code': '+31', 'flag': '🇳🇱'},
      {
        'iso': 'GB',
        'name': tr('auth.i_ngiltere'),
        'code': '+44',
        'flag': '🇬🇧'
      },
      {'iso': 'ES', 'name': tr('auth.ispanya'), 'code': '+34', 'flag': '🇪🇸'},
      {'iso': 'CH', 'name': tr('auth.i_svicre'), 'code': '+41', 'flag': '🇨🇭'},
      {'iso': 'IT', 'name': tr('auth.italya'), 'code': '+39', 'flag': '🇮🇹'},
      {
        'iso': 'HU',
        'name': tr('auth.macaristan'),
        'code': '+36',
        'flag': '🇭🇺'
      },
      {'iso': 'NO', 'name': tr('auth.norvec'), 'code': '+47', 'flag': '🇳🇴'},
      {'iso': 'PL', 'name': tr('auth.polonya'), 'code': '+48', 'flag': '🇵🇱'},
      {
        'iso': 'PT',
        'name': tr('auth.portekiz'),
        'code': '+351',
        'flag': '🇵🇹'
      },
      {
        'iso': 'SI',
        'name': tr('auth.slovenya'),
        'code': '+386',
        'flag': '🇸🇮'
      },
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final textColor = isDark ? Colors.white : Colors.black87;

        return Container(
          padding: EdgeInsets.all(16),
          constraints:
              BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.8),
          decoration: BoxDecoration(
            color: isDark ? lokmaDark : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              SizedBox(height: 16),
              Text(
                tr('auth.ulke_secin'),
                style: TextStyle(
                    color: textColor,
                    fontSize: 18,
                    fontWeight: FontWeight.w600),
              ),
              SizedBox(height: 16),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: countries
                      .map((c) => ListTile(
                            leading: Text(c['flag']!,
                                style: TextStyle(fontSize: 24)),
                            title: Text(c['name']!,
                                style: TextStyle(color: textColor)),
                            trailing: Text(c['code']!,
                                style: TextStyle(
                                    color: textColor.withOpacity(0.7))),
                            onTap: () {
                              _setCountryCode(c['iso']!);
                              Navigator.pop(ctx);
                            },
                          ))
                      .toList(),
                ),
              ),
              SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  Future<bool> _promptAccountCreation(String accountDescription) async {
    return await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) {
            final isDark = Theme.of(ctx).brightness == Brightness.dark;
            final textColor = isDark ? Colors.white : Colors.black87;
            return AlertDialog(
              backgroundColor: isDark ? lokmaDark : Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              title: Text(tr('auth.hesap_bulunamadi'),
                  style:
                      TextStyle(color: textColor, fontWeight: FontWeight.bold)),
              content: Text(
                tr('auth.hesap_bulunamadi_desc', args: [accountDescription, accountDescription]),
                style: TextStyle(
                    color: textColor.withOpacity(0.7),
                    fontSize: 15,
                    height: 1.4),
              ),
              actions: [
                TextButton(
                  child: Text(tr('auth.baska_hesap_deneyecegim'),
                      style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.black54,
                          fontWeight: FontWeight.w500)),
                  onPressed: () => Navigator.of(ctx).pop(false),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? Colors.white : lokmaDark,
                    foregroundColor: isDark ? Colors.black : Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  child: Text(tr('auth.evet_profil_olustur'),
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  onPressed: () => Navigator.of(ctx).pop(true),
                ),
              ],
            );
          },
        ) ??
        false;
  }

  Future<bool> _promptLoginInstead(String accountDescription) async {
    return await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) {
            final isDark = Theme.of(ctx).brightness == Brightness.dark;
            final textColor = isDark ? Colors.white : Colors.black87;
            return AlertDialog(
              backgroundColor: isDark ? lokmaDark : Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              title: Text(tr('auth.hesap_zaten_var'),
                  style:
                      TextStyle(color: textColor, fontWeight: FontWeight.bold)),
              content: Text(
                tr('auth.hesap_zaten_var_desc', args: [accountDescription]),
                style: TextStyle(
                    color: textColor.withOpacity(0.7),
                    fontSize: 15,
                    height: 1.4),
              ),
              actions: [
                TextButton(
                  child: Text(tr('auth.vazgec'),
                      style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.black54,
                          fontWeight: FontWeight.w500)),
                  onPressed: () => Navigator.of(ctx).pop(false),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? Colors.white : lokmaDark,
                    foregroundColor: isDark ? Colors.black : Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  child: Text(tr('auth.evet_giris_yap'),
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  onPressed: () => Navigator.of(ctx).pop(true),
                ),
              ],
            );
          },
        ) ??
        false;
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

  String _translateAuthError(String error) {
    final lower = error.toLowerCase();
    if (lower.contains('session-expired')) {
      return tr('auth.sms_session_expired');
    }
    if (lower.contains('invalid-verification-code') || lower.contains('invalid-credential')) {
      return tr('auth.invalid_verification_code');
    }
    if (lower.contains('too-many-requests')) {
      return tr('auth.too_many_requests');
    }
    return error;
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    // If authenticated, go home or set password
    if (authState.isAuthenticated &&
        !authState.isGuest &&
        !_isHandlingOAuthConsent) {
      if (!widget.embedded) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final user = FirebaseAuth.instance.currentUser;
          bool needsPassword = false;
          if (user != null) {
            final hasPassword =
                user.providerData.any((p) => p.providerId == 'password');
            final isPhoneUser =
                user.providerData.any((p) => p.providerId == 'phone');
            needsPassword = (isPhoneUser && !hasPassword) || _forceSmsLogin;
          }

          if (needsPassword) {
            context.go('/set-password');
          } else {
            context.go('/');
          }
        });
      }
    }

    // Show error
    if (authState.error != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(_translateAuthError(authState.error!)), backgroundColor: Colors.red),
        );
        ref.read(authProvider.notifier).clearError();
      });
    }

    final screenHeight = MediaQuery.of(context).size.height;

    final content = Container(
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
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
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: SizedBox(
                width: double.infinity,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Theme Toggle (Quick Access for Testing/User Preference)
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
                    
                    SizedBox(height: widget.embedded ? 10 : 20),

                    // LOKMA Logo - Prominent
                    _buildLogoSection(),

                    SizedBox(height: 48),

                    // Auth Content
                    if (authState.isLoading || _isLoading)
                      Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Column(
                          children: [
                            CircularProgressIndicator(color: lokmaRed),
                            SizedBox(height: 20),
                            Text(
                              _buildLoadingMessage(),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: _textColor,
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 28),
                        decoration: BoxDecoration(
                          color:
                              _isDark ? const Color(0xFF2A2A2A) : Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: _isDark
                                  ? Colors.black.withOpacity(0.3)
                                  : Colors.black.withOpacity(0.06),
                              blurRadius: 24,
                              offset: const Offset(0, 10),
                            )
                          ],
                          border: Border.all(
                            color: _isDark
                                ? Colors.white10
                                : Colors.grey.withOpacity(0.1),
                            width: 1,
                          ),
                        ),
                        child: _buildCurrentView(),
                      ),

                    SizedBox(height: 40),
                  ],
                ),
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
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: content,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOGO SECTION - Clean & Prominent
  // ═══════════════════════════════════════════════════════════════════
  Widget _buildLogoSection() {
    return Image.asset(
      _isDark
          ? 'assets/images/lokma_logo_white.png'
          : 'assets/images/logo_lokma_red.png',
      width: 200,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => Text(
        'LOKMA',
        style: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: _textColor,
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
        // Toggle Tabs
        Container(
          height: 50,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: _isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(25),
          ),
          child: LayoutBuilder(builder: (context, constraints) {
            final width = constraints.maxWidth;
            final pillWidth = width / 2;
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (details) {
                if (details.localPosition.dx < width / 2) {
                  if (_authMode == 1) setState(() => _authMode = 0);
                } else {
                  if (_authMode == 0) setState(() => _authMode = 1);
                }
              },
              onHorizontalDragUpdate: (details) {
                if (details.localPosition.dx < width / 2) {
                  if (_authMode == 1) setState(() => _authMode = 0);
                } else {
                  if (_authMode == 0) setState(() => _authMode = 1);
                }
              },
              child: Stack(
                children: [
                  // Sliding Pill Background
                  AnimatedAlign(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeOutBack,
                    alignment: _authMode == 1
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Container(
                      width: pillWidth,
                      height: double.infinity,
                      decoration: BoxDecoration(
                        color: lokmaRed,
                        borderRadius: BorderRadius.circular(21),
                        boxShadow: [
                          BoxShadow(
                              color: lokmaRed.withOpacity(0.3),
                              blurRadius: 8,
                              offset: const Offset(0, 2))
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
                              color: _authMode == 0
                                  ? Colors.white
                                  : (_isDark
                                      ? Colors.grey.shade400
                                      : Colors.grey.shade600),
                              fontWeight: _authMode == 0
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              fontSize: 15,
                              fontFamily: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.fontFamily,
                            ),
                            child: Text(tr('auth.giris_yap')),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Center(
                          child: AnimatedDefaultTextStyle(
                            duration: const Duration(milliseconds: 200),
                            style: TextStyle(
                              color: _authMode == 1
                                  ? Colors.white
                                  : (_isDark
                                      ? Colors.grey.shade400
                                      : Colors.grey.shade600),
                              fontWeight: _authMode == 1
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              fontSize: 15,
                              fontFamily: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.fontFamily,
                            ),
                            child: Text(tr('auth.yeni_musteri')),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        ),

        SizedBox(height: 32),

        // Social Login Buttons
        _buildModernAuthButton(
          iconWidget: Image.asset('assets/images/google_logo.png',
              height: 24,
              errorBuilder: (_, __, ___) =>
                  const Icon(Icons.g_mobiledata, color: Colors.blue, size: 32)),
          label: tr('auth.continue_with_google'),
          bgColor: _isDark ? lokmaDark : Colors.white,
          textColor: _textColor,
          borderColor: _isDark ? Colors.white24 : Colors.grey.shade300,
          onTap: _signInWithGoogle,
        ),

        if (Theme.of(context).platform == TargetPlatform.iOS ||
            Theme.of(context).platform == TargetPlatform.macOS) ...[
          SizedBox(height: 16),
          _buildModernAuthButton(
            icon: Icons.apple,
            label: tr('auth.continue_with_apple'),
            bgColor: _isDark ? Colors.white : Colors.black,
            textColor: _isDark ? Colors.black : Colors.white,
            onTap: () => _showComingSoon('Apple Sign-In'),
          ),
        ],

        SizedBox(height: 16),

        // Phone / SMS Login Option
        _buildModernAuthButton(
          icon: Icons.phone_android_outlined,
          label: _authMode == 0
              ? tr('auth.sms_ile_giris_yap')
              : tr('auth.sms_ile_kayit_ol'),
          bgColor: _isDark ? lokmaDark : Colors.white,
          textColor: _textColor,
          borderColor: _isDark ? Colors.white24 : Colors.grey.shade300,
          onTap: () => setState(() {
            _loginMode = 'phone';
            _phoneStatus = _PhoneStatus.idle;
            _codeSent = false;
          }),
        ),

        SizedBox(height: 32),

        // Divider
        Row(
          children: [
            Expanded(
                child: Divider(
                    color:
                        _isDark ? Colors.grey.shade800 : Colors.grey.shade300)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                tr('auth.veya'),
                style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
              ),
            ),
            Expanded(
                child: Divider(
                    color:
                        _isDark ? Colors.grey.shade800 : Colors.grey.shade300)),
          ],
        ),

        SizedBox(height: 32),

        Text(
          _authMode == 1
              ? tr('auth.e_posta_ile_kayit_ol')
              : tr('auth.e_posta_ile_giris_yap'),
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: _textColor,
          ),
        ),

        SizedBox(height: 16),

        _buildModernAuthButton(
          icon: Icons.email_outlined,
          label: _authMode == 1
              ? tr('auth.e_posta_ile_kayit_ol')
              : tr('auth.e_posta_ile_giris_yap'),
          bgColor: lokmaRed,
          textColor: Colors.white,
          onTap: () => setState(() => _loginMode = 'email'),
        ),

        SizedBox(height: 32),

        // Guest option
        Center(
          child: TextButton(
            onPressed: _signInAsGuest,
            child: Text(
              tr('auth.misafir_olarak_devam'),
              style: TextStyle(
                color: _isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                fontSize: 14,
                decoration: TextDecoration.underline,
                decorationColor:
                    _isDark ? Colors.grey.shade500 : Colors.grey.shade400,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildModernAuthButton({
    Widget? iconWidget,
    IconData? icon,
    required String label,
    required Color bgColor,
    required Color textColor,
    Color? borderColor,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton(
        onPressed: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        style: OutlinedButton.styleFrom(
          side: borderColor != null
              ? BorderSide(color: borderColor, width: 1.5)
              : BorderSide.none,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
          backgroundColor: bgColor,
          foregroundColor: textColor,
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            iconWidget ?? Icon(icon, color: textColor, size: 24),
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
            icon: Icon(Icons.arrow_back_ios, color: _textColor),
          ),
        ),

        Text(
          _authMode == 1
              ? tr('auth.e_posta_ile_kayit')
              : tr('auth.e_posta_ile_giris'),
          style: TextStyle(
            color: _textColor,
            fontSize: 24,
            fontWeight: FontWeight.w600,
          ),
        ),

        SizedBox(height: 32),

        _buildTextField(
          controller: _emailController,
          label: tr('auth.email_veya_telefon'),
          icon: Icons.person_outline,
          keyboardType: TextInputType.emailAddress,
        ),

        SizedBox(height: 16),

        _buildTextField(
          controller: _passwordController,
          label: tr('auth.sifre'),
          icon: Icons.lock_outline,
          obscureText: _obscurePassword,
          suffixIcon: IconButton(
            onPressed: () =>
                setState(() => _obscurePassword = !_obscurePassword),
            icon: Icon(
              _obscurePassword ? Icons.visibility : Icons.visibility_off,
              color: _textColor.withOpacity(0.5),
            ),
          ),
        ),

        if (_authMode == 1) ...[
          SizedBox(height: 8),
          // Password Strength Indicator
          _buildPasswordStrengthIndicator(),
          SizedBox(height: 12),
          _buildTextField(
            controller: _confirmPasswordController,
            label: tr('auth.sifre_tekrar'),
            icon: Icons.lock_outline,
            obscureText: _obscurePassword,
          ),
          SizedBox(height: 12),
          // Referral code field (optional)
          _buildTextField(
            controller: _referralCodeController,
            label: tr('auth.davet_kodu'),
            hint: tr('auth.orn_abc123'),
            icon: Icons.card_giftcard_outlined,
          ),
        ],

        SizedBox(height: 24),

        _buildPrimaryButton(
          label: _authMode == 1 ? tr('auth.kayit_ol') : tr('auth.giris_yap'),
          onTap: _handleEmailSubmit,
        ),

        if (_authMode == 0) ...[
          SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => setState(() {
              _loginMode = 'phone';
              _authMode = 0;
              _forceSmsLogin = true;
            }),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: _textColor.withOpacity(0.5)),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              minimumSize: Size(double.infinity, 56),
            ),
            child: Text(tr('auth.sms_ile_sifresiz_giris'),
                style: TextStyle(
                    color: _textColor,
                    fontSize: 16,
                    fontWeight: FontWeight.w600)),
          ),
          SizedBox(height: 12),
          TextButton(
            onPressed: _handleForgotPassword,
            child: Text(
              tr('auth.sifremi_unuttum'),
              style: TextStyle(color: _textColor.withOpacity(0.7)),
            ),
          ),
        ],
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
            icon: Icon(Icons.arrow_back_ios, color: _textColor),
          ),
        ),

        Text(
          _codeSent
              ? tr('auth.sms_kodunu_gir')
              : _authMode == 1
                  ? tr('auth.sms_ile_kayit_ol')
                  : tr('auth.sms_ile_giris_yap'),
          style: TextStyle(
            color: _textColor,
            fontSize: 24,
            fontWeight: FontWeight.w600,
          ),
        ),

        SizedBox(height: 32),

        if (!_codeSent) ...[
          // Phone input with country code prefix
          Container(
            decoration: BoxDecoration(
              color: _isDark ? const Color(0xFF2A2A2A) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _borderColor),
            ),
            child: Row(
              children: [
                // Country code picker
                GestureDetector(
                  onTap: _showCountryPicker,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    decoration: BoxDecoration(
                      color: _isDark
                          ? const Color(0xFF2E2E2E)
                          : Colors.grey.shade100,
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
                          style: TextStyle(
                            color: _textColor,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        SizedBox(width: 4),
                        Icon(Icons.arrow_drop_down,
                            color: _hintColor, size: 20),
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
                    style: TextStyle(color: _textColor, fontSize: 16),
                    decoration: InputDecoration(
                      hintText: _exampleNumber,
                      hintStyle: TextStyle(color: _hintColor),
                      border: InputBorder.none,
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    ),
                  ),
                ),
              ],
            ),
          ),

          SizedBox(height: 12),

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
            SizedBox(height: 16),
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
            SizedBox(height: 16),
          ] else ...[
            Text(
              _authMode == 0
                  ? tr('auth.sms_ile_dogrulama_kodu_gonderi')
                  : tr('auth.yeni_hesap_icin_sms_kodu_gonderilecek'),
              style:
                  TextStyle(color: _textColor.withOpacity(0.7), fontSize: 13),
            ),
            SizedBox(height: 24),
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
              style:
                  TextStyle(color: _textColor.withOpacity(0.75), fontSize: 14),
              children: [
                TextSpan(text: tr('auth.6_haneli_dogrulama_kodunu_giri')),
                TextSpan(text: '\n'),
                TextSpan(
                  text: '$_sentFormattedPhone',
                  style: TextStyle(
                    color: _textColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),

          SizedBox(height: 24),

          AutofillGroup(
            child: _buildTextField(
              controller: _smsCodeController,
              autofillHints: const [AutofillHints.oneTimeCode],
              label: '',
              hint: '------',
              icon: Icons.lock_outline,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              fillColor: _isDark ? const Color(0xFF2A2A2A) : Colors.white,
              iconColor: _hintColor,
              style: TextStyle(
                fontSize: 28,
                letterSpacing: 12,
                fontWeight: FontWeight.w600,
                color: _textColor,
              ),
            ),
          ),

          SizedBox(height: 24),

          _buildPrimaryButton(
            label: tr('auth.dogrula_ve_giris_yap'),
            onTap: _handleVerifySmsCode,
          ),

          SizedBox(height: 8),

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
              style: TextStyle(color: _hintColor, fontSize: 13),
            ),
          ),

          TextButton(
            onPressed: _handleSendSmsCode,
            child: Text(
              tr('auth.kodu_tekrar_gonder'),
              style: TextStyle(color: _textColor.withOpacity(0.7)),
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
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _textColor.withOpacity(0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _textColor.withOpacity(0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            message,
            style: TextStyle(
                color: _textColor, fontWeight: FontWeight.w600, fontSize: 14),
          ),
          SizedBox(height: 6),
          Text(
            suggestion,
            style: TextStyle(color: _textColor.withOpacity(0.75), fontSize: 13),
          ),
          SizedBox(height: 14),
          GestureDetector(
            onTap: onAction,
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: _textColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                actionLabel,
                textAlign: TextAlign.center,
                style: TextStyle(
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
      return SizedBox.shrink();
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
                  backgroundColor: _textColor.withOpacity(0.6),
                  valueColor:
                      AlwaysStoppedAnimation<Color>(_passwordStrengthColor),
                  minHeight: 6,
                ),
              ),
            ),
            SizedBox(width: 12),
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
        SizedBox(height: 8),
        // Requirements
        if (_passwordStrength < 3) ...[
          Text(
            tr('auth.guclu_sifre_icin'),
            style: TextStyle(color: _textColor.withOpacity(0.7), fontSize: 11),
          ),
          SizedBox(height: 4),
          _buildRequirementRow(
              'En az 6 karakter', _passwordController.text.length >= 6),
          _buildRequirementRow(tr('auth.buyuk_harf_a_z'),
              _passwordController.text.contains(RegExp(r'[A-Z]'))),
          _buildRequirementRow('Rakam (0-9)',
              _passwordController.text.contains(RegExp(r'[0-9]'))),
          _buildRequirementRow(
              'Özel karakter (!@#\$...)',
              _passwordController.text
                  .contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))),
        ],
      ],
    );
  }

  Widget _buildRequirementRow(String text, bool isMet) {
    return Padding(
      padding: EdgeInsets.only(top: 2),
      child: Row(
        children: [
          Icon(
            isMet ? Icons.check_circle : Icons.circle_outlined,
            size: 12,
            color: isMet ? Colors.green : Colors.white38,
          ),
          SizedBox(width: 6),
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
    Iterable<String>? autofillHints,
  }) {
    return TextField(
      controller: controller,
      autofillHints: autofillHints,
      keyboardType: keyboardType,
      obscureText: obscureText,
      maxLength: maxLength,
      textAlign: textAlign,
      style: style ?? TextStyle(color: _textColor),
      decoration: InputDecoration(
        labelText: label.isNotEmpty ? label : null,
        hintText: hint,
        labelStyle: TextStyle(color: _hintColor),
        hintStyle: TextStyle(color: _hintColor),
        prefixIcon: Icon(icon, color: iconColor ?? _hintColor),
        suffixIcon: suffixIcon,
        counterText: '',
        filled: true,
        fillColor:
            fillColor ?? (_isDark ? const Color(0xFF2A2A2A) : Colors.white),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: _borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: _borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: _textColor, width: 2),
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
        padding: EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: _textColor,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2),
              blurRadius: 12,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: Theme.of(context).scaffoldBackgroundColor,
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
      SnackBar(
          content: Text('$feature coming soon!'), backgroundColor: lokmaRed),
    );
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _isLoading = true;
      _isHandlingOAuthConsent = true;
    });
    try {
      await ref.read(authProvider.notifier).signInWithGoogle();

      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        if (_authMode == 0) {
          // Giriş Yap (Anmelden) Modu: Eğer kullanıcı şu an ilk defa yaratıldıysa reddet!
          final creationTime = user.metadata.creationTime;
          final lastSignInTime = user.metadata.lastSignInTime;
          if (creationTime != null && lastSignInTime != null) {
            final diff =
                lastSignInTime.difference(creationTime).inSeconds.abs();
            if (diff < 5) {
              if (!mounted) return;
              final createAccount =
                  await _promptAccountCreation('Google hesabı');

              if (createAccount == true) {
                if (mounted) setState(() => _isHandlingOAuthConsent = false);
                return;
              } else {
                final uid = user.uid;
                try {
                  await FirebaseFirestore.instance
                      .collection('users')
                      .doc(uid)
                      .delete();
                } catch (_) {}
                await user.delete();
                await FirebaseAuth.instance.signOut();
                if (mounted) setState(() => _isHandlingOAuthConsent = false);
                return;
              }
            }
          }
        } else if (_authMode == 1) {
          // Kayıt Ol (Registrieren) Modu
          final creationTime = user.metadata.creationTime;
          final lastSignInTime = user.metadata.lastSignInTime;
          if (creationTime != null && lastSignInTime != null) {
            final diff =
                lastSignInTime.difference(creationTime).inSeconds.abs();
            if (diff >= 5) {
              // Account existed before this interaction
              if (!mounted) return;
              final continueToLogin =
                  await _promptLoginInstead('Google hesabı');

              if (continueToLogin) {
                if (mounted) setState(() => _authMode = 0);
                // Allow process to finish smoothly (user will navigate to home)
              } else {
                await FirebaseAuth.instance.signOut();
                if (mounted) setState(() => _isHandlingOAuthConsent = false);
                return;
              }
            }
          }

          final referralCode = _referralCodeController.text.trim();
          if (referralCode.isNotEmpty) {
            await ReferralService.applyReferralCode(user.uid, referralCode);
          }
        }
      }
      if (mounted) setState(() => _isHandlingOAuthConsent = false);
    } catch (e) {
      debugPrint('Google sign-in error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(tr('auth.google_login_error_e')),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isHandlingOAuthConsent = false;
        });
      }
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
          SnackBar(
              content: Text(tr('auth.guest_login_error_e')),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleEmailSubmit() async {
    final inputStr = _emailController.text.trim();
    final password = _passwordController.text;

    if (inputStr.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(tr('auth.email_pass_required')),
            backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      String emailToLogin = inputStr;

      // If the input is primarily digits (with optional + sign), treat it as a phone number
      final isPhone = RegExp(r'^[\+]?[0-9\s\-\(\)]+$').hasMatch(inputStr) &&
          inputStr.replaceAll(RegExp(r'\D'), '').length >= 7;

      if (isPhone) {
        // Clean phone number for lookup
        String lookupPhone = inputStr.replaceAll(RegExp(r'[\s\-\(\)]'), '');
        if (!lookupPhone.startsWith('+')) {
          // If no country code provided, prepend the current dropdown selection
          lookupPhone =
              '$_countryCode${lookupPhone.startsWith('0') ? lookupPhone.substring(1) : lookupPhone}';
        }

        // Find user by phone number in Firestore
        final snapshot = await FirebaseFirestore.instance
            .collection('users')
            .where('phoneNumber', isEqualTo: lookupPhone)
            .limit(1)
            .get();

        if (snapshot.docs.isNotEmpty) {
          final data = snapshot.docs.first.data();
          if (data['email'] != null &&
              data['email'].toString().isNotEmpty &&
              data['email'].toString().contains('@')) {
            emailToLogin = data['email'].toString();
          } else {
            // User exists but has no real email -> they Must use SMS login!
            if (mounted) {
              setState(() => _isLoading = false);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                    content: Text(
                        tr('auth.sms_ile_giris_yap')), // Or just a direct text
                    backgroundColor: Colors.amber),
              );
              setState(() {
                _loginMode = 'phone';
                _authMode = 0;
                _forceSmsLogin = true;
                _phoneController.text = inputStr;
              });
            }
            return;
          }
        } else {
          // User does not exist, can't login or register properly with a phone number in Email/Password form
          if (mounted) {
            setState(() => _isLoading = false);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                  content: Text(tr('auth.sms_ile_giris_yap')),
                  backgroundColor: Colors.amber),
            );
            setState(() {
              _loginMode = 'phone';
              _authMode = _authMode; // keep same mode
              _forceSmsLogin = true;
              _phoneController.text = inputStr;
            });
          }
          return;
        }
      }

      if (_authMode == 1) {
        // Register
        bool userExists = false;

        if (isPhone) {
          String lookupPhone = inputStr.replaceAll(RegExp(r'[\s\-\(\)]'), '');
          if (!lookupPhone.startsWith('+')) {
            lookupPhone =
                '$_countryCode${lookupPhone.startsWith('0') ? lookupPhone.substring(1) : lookupPhone}';
          }
          final snap = await FirebaseFirestore.instance
              .collection('users')
              .where('phoneNumber', isEqualTo: lookupPhone)
              .limit(1)
              .get();
          userExists = snap.docs.isNotEmpty;
        } else {
          final snap = await FirebaseFirestore.instance
              .collection('users')
              .where('email', isEqualTo: emailToLogin)
              .limit(1)
              .get();
          userExists = snap.docs.isNotEmpty;
        }

        if (userExists) {
          if (mounted) {
            setState(() => _isLoading = false);
            final continueToLogin = await _promptLoginInstead(
                isPhone ? 'telefon numarası' : 'E-posta adresi');
            if (continueToLogin && mounted) {
              setState(() => _authMode = 0);
              _handleEmailSubmit(); // Re-trigger the submit in login mode
            }
          }
          return;
        }

        if (password != _confirmPasswordController.text) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(tr('auth.passwords_do_not_match')),
                backgroundColor: Colors.red),
          );
          setState(() => _isLoading = false);
          return;
        }

        await ref
            .read(authProvider.notifier)
            .registerWithEmail(emailToLogin, password);

        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          // Apply referral code if provided
          final referralCode = _referralCodeController.text.trim();
          if (referralCode.isNotEmpty) {
            final applied =
                await ReferralService.applyReferralCode(user.uid, referralCode);
            if (mounted && applied) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text('🎉 Davet kodu uygulandı!'),
                    backgroundColor: Colors.green),
              );
            }
          }

          if (!user.emailVerified) {
            await user.sendEmailVerification();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                    content: Text(tr('auth.registration_success_email_sent')),
                    backgroundColor: Colors.green),
              );
            }
          }
        }
      } else {
        // Login
        bool userExists = false;

        if (isPhone) {
          String lookupPhone = inputStr.replaceAll(RegExp(r'[\s\-\(\)]'), '');
          if (!lookupPhone.startsWith('+')) {
            lookupPhone =
                '$_countryCode${lookupPhone.startsWith('0') ? lookupPhone.substring(1) : lookupPhone}';
          }
          final snap = await FirebaseFirestore.instance
              .collection('users')
              .where('phoneNumber', isEqualTo: lookupPhone)
              .limit(1)
              .get();
          userExists = snap.docs.isNotEmpty;
        } else {
          final snap = await FirebaseFirestore.instance
              .collection('users')
              .where('email', isEqualTo: emailToLogin)
              .limit(1)
              .get();
          userExists = snap.docs.isNotEmpty;
        }

        if (!userExists) {
          if (mounted) {
            setState(() => _isLoading = false);
            final create = await _promptAccountCreation(
                isPhone ? 'telefon numarası' : 'E-posta adresi');
            if (create && mounted) {
              setState(() => _authMode = 1);
            }
          }
          return;
        }

        await ref
            .read(authProvider.notifier)
            .loginWithEmail(emailToLogin, password);
      }
    } catch (e) {
      debugPrint('Email auth error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(tr('auth.login_error_e')),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleForgotPassword() async {
    final input = _emailController.text.trim();
    if (input.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(tr('auth.please_enter_email')),
            backgroundColor: Colors.amber),
      );
      return;
    }

    if (!input.contains('@')) {
      // Input is a phone number. Redirect to SMS login forcibly.
      setState(() {
        _loginMode = 'phone';
        _authMode = 0;
        _forceSmsLogin = true;
        _phoneController.text = input;
      });
      return;
    }

    setState(() => _isLoading = true);
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: input);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(tr('auth.pass_reset_email_sent')),
              backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(tr('common.error_e')), backgroundColor: Colors.red),
        );
      }
    }
    setState(() => _isLoading = false);
  }

  Future<void> _handleSendSmsCode() async {
    final raw =
        _phoneController.text.trim().replaceAll(' ', '').replaceAll('-', '');
    if (raw.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(tr('auth.phone_number_required')),
            backgroundColor: Colors.red),
      );
      return;
    }

    final localNumber = raw.startsWith('0') ? raw.substring(1) : raw;
    final formattedPhone = '$_countryCode$localNumber';
    _sentFormattedPhone = formattedPhone;

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

      if (_authMode == 0 && exists && !_forceSmsLogin) {
        final userData = snapshot.docs.first.data();
        final hasEmail = userData['email'] != null &&
            (userData['email'] as String).isNotEmpty;

        if (hasEmail) {
          debugPrint(
              'Phone lookup: User has password auth setup. Redirecting to email mode.');
          if (mounted) {
            setState(() {
              _isLoading = false;
              _loginMode = 'email';
              _emailController.text = formattedPhone;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                    'Bu numarayla kayıtlı bir şifreniz var. Lütfen şifrenizle giriş yapın.'),
                backgroundColor: Colors.blue,
              ),
            );
          }
          return;
        }
      }

      if (_authMode == 0 && !exists) {
        // LOGIN mode — number not in our system
        debugPrint('Phone lookup: $formattedPhone NOT found (login mode)');
        if (mounted) {
          setState(() => _isLoading = false);
          final create = await _promptAccountCreation('telefon numarası');
          if (create && mounted) {
            setState(() {
              _authMode = 1;
              _phoneStatus = _PhoneStatus.idle;
            });
            _handleSendSmsCode();
          }
        }
        return;
      }

      if (_authMode == 1 && exists) {
        // REGISTER mode — number already taken
        debugPrint(
            'Phone lookup: $formattedPhone ALREADY registered (register mode)');
        if (mounted) {
          setState(() {
            _isLoading = false;
            _phoneStatus = _PhoneStatus.alreadyRegistered;
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
          await prefs.setInt(
              'sms_verification_time', DateTime.now().millisecondsSinceEpoch);
          if (!mounted) return;
          setState(() {
            _verificationId = verificationId;
            _codeSent = true;
            _isLoading = false;
            _loginMode = 'phone';
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(tr('auth.sms_code_sent')),
                backgroundColor: Colors.green),
          );
        },
        verificationFailed: (error) {
          debugPrint(
              'SMS verification failed: ${error.code} - ${error.message}');
          if (!mounted) return;
          setState(() => _isLoading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(tr('common.error_message_or_code')),
                backgroundColor: Colors.red),
          );
        },
        verificationCompleted: (credential) async {
          debugPrint('Auto verification completed');
          if (credential.smsCode != null && mounted) {
            _smsCodeController.text = credential.smsCode!;
          }
          try {
            await FirebaseAuth.instance.signInWithCredential(credential);
            if (mounted) setState(() => _isLoading = false);
          } catch (e) {
            debugPrint('Auto sign-in error: $e');
            if (mounted) {
              setState(() => _isLoading = false);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                    content: Text(tr('auth.login_error_e')),
                    backgroundColor: Colors.red),
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
          SnackBar(
              content: Text(tr('auth.sms_error_e')),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _handleVerifySmsCode() async {
    final code = _smsCodeController.text.trim();
    if (code.isEmpty || code.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(tr('auth.enter_6_digit_short')),
            backgroundColor: Colors.red),
      );
      return;
    }

    if (_verificationId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(tr('auth.verification_id_not_found')),
            backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isLoading = true);
    await ref
        .read(authProvider.notifier)
        .signInWithSmsCode(_verificationId!, code);
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
