import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../providers/theme_provider.dart';
import '../../providers/driver_provider.dart';
import '../../services/staff_role_service.dart';
import '../../services/kermes_assignment_service.dart';
import 'widgets/workplace_selector_sheet.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../services/referral_service.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  // Constants replaced by Theme colors
  Color get accent => Theme.of(context).primaryColor;
  Color get cardBg => Theme.of(context).cardTheme.color ?? Colors.white;

  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  bool _isLoading = false; // ignore: unused_field
  bool _isUploadingPhoto = false; // ignore: unused_field

  @override
  Widget build(BuildContext context) {
    // Force rebuild on language change
    context.locale;
    final user = _auth.currentUser;

    // Kullanici giris yapmamissa tam ekran LoginScreen goster (embedded degil)
    // Bu sayede ic ice Scaffold sorunu ve layout bozulmasi engellenir
    if (user == null) {
      return const LoginScreen();
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? Theme.of(context).scaffoldBackgroundColor
            : Colors.white,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        elevation: 0,
        title: Text('profile.my_account'.tr(),
            style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600)),
        centerTitle: true,
      ),
      body: _buildProfile(user),
    );
  }



  Widget _buildProfile(User user) {
    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .snapshots(),
      builder: (context, snapshot) {
        final userData = snapshot.data?.data() as Map<String, dynamic>?;

        // Construct display name
        String displayName = 'profile.default_user'.tr();
        String firstName = '';
        if (userData != null) {
          firstName = userData['firstName'] as String? ?? '';
          final lastName = userData['lastName'] as String? ?? '';
          if (firstName.isNotEmpty || lastName.isNotEmpty) {
            displayName = '$firstName $lastName'.trim();
          }
        }
        if (displayName == 'profile.default_user'.tr() &&
            user.displayName != null &&
            user.displayName!.isNotEmpty) {
          displayName = user.displayName!;
          firstName = displayName.split(' ').first;
        }


        return SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // === YEMEKSEPETI-STYLE HEADER ===
              Container(
                color: Theme.of(context)
                    .scaffoldBackgroundColor, // Pure background color
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name and greeting row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${'profile.greeting'.tr()}, ${firstName.isNotEmpty ? firstName : displayName}',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 24,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        // Notification bell icon
                        GestureDetector(
                          onTap: () => context.push('/notification-history'),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Theme.of(context).brightness ==
                                      Brightness.dark
                                  ? const Color(0xFF2C2C2E)
                                  : Colors.white.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(Icons.notifications_outlined,
                                color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[400] : Colors.grey[700], size: 22),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // === QUICK ACCESS CHIPS ===
                    // Check if user is staff
                    FutureBuilder<bool>(
                      future: StaffRoleService().checkStaffStatus(),
                      builder: (context, staffSnapshot) {

                        return Column(
                          children: [
                            // First row: Standard chips
                            IntrinsicHeight(
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _buildQuickAccessChip(
                                      Icons.receipt_long_outlined,
                                      'profile.my_orders'.tr(),
                                      () => context.push('/orders')),
                                  const SizedBox(width: 12),
                                  _buildQuickAccessChip(
                                      Icons.favorite_outline,
                                      'profile.favorites'.tr(),
                                      () => context.push('/favorites')),
                                  const SizedBox(width: 12),
                                  _buildQuickAccessChip(
                                      Icons.location_on_outlined,
                                      'profile.my_addresses'.tr(),
                                      () => context.push('/my-info')),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            // Second row: Reservations, Notifications, Personel Girisi
                            IntrinsicHeight(
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _buildQuickAccessChip(
                                      Icons.table_restaurant,
                                      'profile.my_reservations'.tr(),
                                      () => context.push('/my-reservations'),
                                      svgAsset: 'assets/images/icon_masa_rezervasyon.svg'),
                                  const SizedBox(width: 12),
                                  _buildQuickAccessChip(
                                      Icons.notifications_active_outlined,
                                      'profile.notification_settings'.tr(),
                                      () =>
                                          context.push('/notification-settings')),
                                  const SizedBox(width: 12),
                                  if (staffSnapshot.data == true ||
                                      ref.watch(driverProvider).isDriver)
                                    _buildQuickAccessChip(
                                        Icons.badge,
                                        'profile.staff_login'.tr(),
                                        () => _handleStaffLogin(context))
                                  else
                                    const Expanded(child: SizedBox()),
                                ],
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    // === WALLET BALANCE ===
                    Builder(
                      builder: (context) {
                        final balance = (userData?['walletBalance'] as num?)?.toDouble() ?? 0.0;
                        if (balance <= 0) return const SizedBox.shrink();
                        return Column(
                          children: [
                            const SizedBox(height: 12),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFFFD700), Color(0xFFFFA000)],
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.account_balance_wallet, color: Colors.white, size: 22),
                                  const SizedBox(width: 12),
                                  Text(
                                    'profile.wallet_balance'.tr(namedArgs: {'amount': balance.toStringAsFixed(2)}),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),

              // === REFERRAL INVITE CARD ===
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    ReferralService.shareReferralCode(context);
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFEA184A), Color(0xFFE91E63)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFEA184A).withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Center(
                            child: Text('\ud83c\udf81', style: TextStyle(fontSize: 24)),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'profile.invite_friend'.tr(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'profile.invite_reward'.tr(),
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.85),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.share_rounded,
                            color: Colors.white.withOpacity(0.9), size: 22),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // === DAHA FAZLA SECTION ===
              _buildSectionTitle('profile.more'.tr()),
              _buildSectionItem(Icons.help_outline, 'profile.help_center'.tr(),
                  () => context.push('/help')),
              _buildSectionItem(Icons.article_outlined,
                  'profile.terms_and_data'.tr(), () {
                context.push('/help');
              }),
              _buildSectionItem(Icons.rate_review_outlined, 'profile.feedback'.tr(),
                  () {
                context.push('/help');
              }),

              const SizedBox(height: 24),

              // === DİL / LANGUAGE SECTION ===
              _buildSectionTitle('profile.language'.tr()),
              _buildLanguageSelector(context),

              const SizedBox(height: 24),

              // === GÖRÜNÜM SECTION ===
              _buildSectionTitle('profile.appearance'.tr()),
              _buildThemeSelector(),

              const SizedBox(height: 24),

              // === ACCOUNT ACTIONS ===
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    // Logout
                    GestureDetector(
                      onTap: () async {
                        HapticFeedback.mediumImpact();
                        await _googleSignIn.signOut();
                        await _auth.signOut();
                        if (context.mounted) {
                          context.go('/login');
                        }
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: Row(
                          children: [
                            Icon(Icons.logout,
                                color: Colors.grey[600], size: 22),
                            const SizedBox(width: 16),
                            Text('profile.logout'.tr(),
                                style: TextStyle(
                                    color: Colors.grey[800], fontSize: 15)),
                          ],
                        ),
                      ),
                    ),

                    // Delete Account
                    GestureDetector(
                      onTap: () {
                        _showDeleteAccountDialog();
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline,
                                color: Colors.red[400], size: 22),
                            const SizedBox(width: 16),
                            Text('profile.delete_account'.tr(),
                                style: TextStyle(
                                    color: Colors.grey[800], fontSize: 15)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // === VERSION ===
              Center(
                child: FutureBuilder<String>(
                  future: _getVersionString(),
                  builder: (context, snap) => Text(
                    snap.data ?? '${'profile.version'.tr()} ...',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w200,
                      letterSpacing: 0.5,
                      color: Colors.grey[500],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // === DESIGNED & DEVELOPED BY OZSOFT ===
              Center(
                child: Builder(
                  builder: (context) {
                    final isDark = Theme.of(context).brightness == Brightness.dark;
                    return GestureDetector(
                      onTap: () {
                        launchUrl(Uri.parse('https://ozsoft.net'), mode: LaunchMode.externalApplication);
                      },
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Designed & Developed by',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w200,
                              letterSpacing: 0.5,
                              color: isDark
                                  ? Colors.white.withOpacity(0.35)
                                  : Colors.grey[500],
                            ),
                          ),
                          const SizedBox(height: 4),
                          SvgPicture.asset(
                            'assets/images/ozsoft_logo.svg',
                            height: 20,
                            colorFilter: ColorFilter.mode(
                              isDark
                                  ? Colors.white.withOpacity(0.45)
                                  : Colors.grey.shade500,
                              BlendMode.srcIn,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 40),

            ],
          ),
        );
      },
    );
  }

  Future<void> _handleStaffLogin(BuildContext context) async {
    // Show a small loading overlay since we are performing network requests
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );

    try {
      // Refresh staff status to ensure we have the latest base business data
      final roleService = StaffRoleService();
      await roleService.checkStaffStatus();
      
      // Fetch any active kermes assignments
      final kermeses = await KermesAssignmentService.getActiveAssignedKermeses();
      
      // Remove loading overlay
      if (context.mounted) Navigator.pop(context);

      final hasBaseBusiness = roleService.businessId != null;

      if (!context.mounted) return;

      if (kermeses.isNotEmpty && hasBaseBusiness) {
        // User has BOTH a restaurant AND active kermeses
        showModalBottomSheet(
          context: context,
          backgroundColor: Colors.transparent,
          isScrollControlled: true,
          builder: (ctx) => WorkplaceSelectorSheet(
            baseBusinessName: roleService.businessName ?? 'İşletme',
            kermeses: kermeses,
            onSelected: (id, name, type) {
              if (id.isEmpty) {
                // Return to base business
                roleService.clearOverride();
              } else {
                roleService.setOverrideWorkplace(id, name, type);
              }
              context.push('/staff-hub');
            },
          ),
        );
      } else if (kermeses.isNotEmpty) {
        // User is ONLY assigned to a kermes
        roleService.setOverrideWorkplace(kermeses.first.id, kermeses.first.title, 'kermes');
        context.push('/staff-hub');
      } else {
        // Default behavior: ONLY a restaurant
        roleService.clearOverride();
        context.push('/staff-hub');
      }
    } catch (e) {
      if (context.mounted) {
        Navigator.pop(context); // Remove loading if error
        ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('Bir hata oluştu: $e')),
        );
      }
    }
  }

  // === Quick Access Chip (Yemeksepeti-style) ===
  Widget _buildQuickAccessChip(
      IconData icon, String label, VoidCallback onTap, {String? svgAsset}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final iconColor = isDark ? Colors.grey[400]! : Colors.grey[700]!;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: isDark
                ? null
                : Border.all(
                    color: Colors.grey.shade300,
                    width: 1,
                  ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.max,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (svgAsset != null)
                SvgPicture.asset(
                  svgAsset,
                  width: 22,
                  height: 22,
                  colorFilter: ColorFilter.mode(iconColor, BlendMode.srcIn),
                )
              else
                Icon(icon, color: iconColor, size: 22),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  height: 1.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<String> _getVersionString() async {
    final info = await PackageInfo.fromPlatform();
    return '${'profile.version'.tr()} ${info.version} (${info.buildNumber})';
  }

  /// Check if current user is staff for a business with reservation support
  Future<bool> _checkStaffReservationAccess() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return false;
    try {
      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      if (!adminDoc.exists) return false;
      final data = adminDoc.data()!;

      // Check direct businessId / butcherId
      final bizId = data['businessId'] ?? data['butcherId'];
      if (bizId != null) {
        final bizDoc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(bizId)
            .get();
        if (bizDoc.data()?['hasReservation'] == true) return true;
      }

      // Also check all assignedBusinesses
      final assigned = data['assignedBusinesses'] as List<dynamic>?;
      if (assigned != null) {
        for (final id in assigned) {
          final bizDoc = await FirebaseFirestore.instance
              .collection('businesses')
              .doc(id.toString())
              .get();
          if (bizDoc.data()?['hasReservation'] == true) return true;
        }
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Text(
        title,
        style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 18,
            fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _buildSectionItem(IconData icon, String title, VoidCallback onTap,
      {Widget? trailing, bool showDivider = true}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 20),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          border: showDivider
              ? Border(
                  bottom: BorderSide(
                    color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                    width: 1,
                  ),
                )
              : null,
        ),
        child: Row(
          children: [
            Icon(icon,
                color: isDark ? Colors.grey.shade500 : Colors.grey.shade600,
                size: 22),
            const SizedBox(width: 16),
            Expanded(
                child: Text(title,
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                        fontSize: 15))),
            if (trailing != null) ...[trailing, const SizedBox(width: 8)],
            Icon(Icons.arrow_forward_ios_rounded,
                color: Colors.grey[400], size: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildThemeSelector() {
    return Consumer(
      builder: (context, ref, _) {
        final currentTheme = ref.watch(themePreferenceProvider);
        final primaryColor = Theme.of(context).primaryColor;
        final isDark = Theme.of(context).brightness == Brightness.dark;

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                width: 1,
              ),
            ),
          ),
          child: Row(
            children: [
              Icon(Icons.brightness_6_outlined,
                  color: Colors.grey[400], size: 20),
              const SizedBox(width: 12),
              // Pill-shaped 3-way toggle
              Expanded(
                child: Container(
                  height: 28,
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[300],
                    borderRadius: BorderRadius.circular(14), // Pill shape
                  ),
                  child: Row(
                    children: [
                      _buildPillSegment('profile.theme_auto'.tr(), ThemePreference.system,
                          currentTheme, primaryColor, isDark, ref),
                      _buildPillSegment('profile.theme_light'.tr(), ThemePreference.light,
                          currentTheme, primaryColor, isDark, ref),
                      _buildPillSegment('profile.theme_dark'.tr(), ThemePreference.dark,
                          currentTheme, primaryColor, isDark, ref),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPillSegment(
      String label,
      ThemePreference preference,
      ThemePreference currentTheme,
      Color primaryColor,
      bool isDark,
      WidgetRef ref) {
    final isSelected = preference == currentTheme;

    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.mediumImpact();
          ref.read(themePreferenceProvider.notifier).setPreference(preference);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: isSelected
                ? (isDark ? const Color(0xFFEA184A) : primaryColor)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12), // Pill inner
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? Colors.white
                    : (isDark ? Colors.grey[500] : Colors.grey[600]),
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLanguageSelector(BuildContext context) {
    final currentLocale = context.locale.languageCode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.language_outlined, color: Colors.grey[400], size: 20),
          const SizedBox(width: 12),
          // Pill-shaped 3-way toggle
          Expanded(
            child: Container(
              height: 28,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[300],
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  _buildLangSegment('TR', 'tr', currentLocale,
                      Theme.of(context).primaryColor, isDark, context),
                  _buildLangSegment('EN', 'en', currentLocale,
                      Theme.of(context).primaryColor, isDark, context),
                  _buildLangSegment('DE', 'de', currentLocale,
                      Theme.of(context).primaryColor, isDark, context),
                  _buildLangSegment('IT', 'it', currentLocale,
                      Theme.of(context).primaryColor, isDark, context),
                  _buildLangSegment('FR', 'fr', currentLocale,
                      Theme.of(context).primaryColor, isDark, context),
                  _buildLangSegment('ES', 'es', currentLocale,
                      Theme.of(context).primaryColor, isDark, context),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLangSegment(String label, String langCode, String currentCode,
      Color primaryColor, bool isDark, BuildContext context) {
    final isSelected = langCode == currentCode;

    return Expanded(
      child: GestureDetector(
        onTap: () async {
          HapticFeedback.mediumImpact();
          await context.setLocale(Locale(langCode));
          // Sync language preference to Firestore for push notification localization
          final user = FirebaseAuth.instance.currentUser;
          if (user != null) {
            try {
              await FirebaseFirestore.instance
                  .collection('users')
                  .doc(user.uid)
                  .set({'language': langCode}, SetOptions(merge: true));
            } catch (_) {}
          }
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: isSelected
                ? (isDark ? const Color(0xFFEA184A) : primaryColor)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? Colors.white
                    : (isDark ? Colors.grey[500] : Colors.grey[600]),
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('profile.delete_account'.tr(),
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        content: Text(
          'Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm verileriniz silinecektir.',
          style: TextStyle(color: Colors.grey[700]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('profile.cancel'.tr(), style: const TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await _auth.currentUser?.delete();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('profile.account_deleted'.tr()),
                          backgroundColor: Colors.green,
                  ));
                  context.go('/login');
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('${'profile.error'.tr()}: $e'), backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: Text('profile.delete'.tr(), style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

}
