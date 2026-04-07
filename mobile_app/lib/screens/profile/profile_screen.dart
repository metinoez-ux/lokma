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
import '../../providers/auth_provider.dart';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../../core/constants/build_info.dart';
import '../../providers/kermes_cart_provider.dart';
import '../../providers/cart_provider.dart';

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
    final authState = ref.watch(authProvider);
    final user = authState.user ?? _auth.currentUser;

    return SafeArea(
      bottom: false,
      child: _buildProfile(user),
    );
  }

  Widget _buildProfile(User? user) {
    final isGuest = user == null || user.isAnonymous;

    if (isGuest) {
      return _buildGuestProfile();
    }

    return _buildLoggedInProfile(user!);
  }

  // ========== GUEST PROFILE ==========
  Widget _buildGuestProfile() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // === LOKMA LOGO HEADER ===
          ClipPath(
            clipper: ProfileHeaderClipper(),
            child: Container(
              width: double.infinity,
              color: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F0E8),
            padding: const EdgeInsets.fromLTRB(32, 48, 32, 60),
            child: Column(
              children: [
                // LOKMA Logo
                Image.asset(
                  isDark
                      ? 'assets/images/lokma_logo_white.png'
                      : 'assets/images/logo_lokma_red.png',
                  height: 80,
                ),
                const SizedBox(height: 24),
                // Description text
                Text(
                  'profile.guest_description'.tr(),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.5,
                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                  ),
                ),
                const SizedBox(height: 24),
                // Anmelden / Registrieren button
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () => context.push('/login'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA184A),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(26),
                      ),
                    ),
                    child: Text(
                      'profile.login_register'.tr(),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          ),

          const SizedBox(height: 24),

          // === MEHR SECTION ===
          _buildSectionTitle('profile.more'.tr()),
          _buildSectionItem(Icons.help_outline, 'profile.help_center'.tr(),
              () => context.push('/help')),
          _buildSectionItem(Icons.article_outlined,
              'profile.terms_and_data'.tr(), () {
            context.push('/help');
          }),
          _buildSectionItem(
              Icons.rate_review_outlined, 'profile.feedback'.tr(), () {
            context.push('/feedback');
          }),

          const SizedBox(height: 24),

          // === SPRACHE SECTION ===
          _buildSectionTitle('profile.language'.tr()),
          _buildLanguageSelector(context),

          const SizedBox(height: 24),

          // === ERSCHEINUNGSBILD SECTION ===
          _buildSectionTitle('profile.appearance'.tr()),
          _buildThemeSelector(),

          const SizedBox(height: 32),

          // === VERSION ===
          _buildFooter(),
        ],
      ),
    );
  }

  // ========== LOGGED IN PROFILE ==========
  Widget _buildLoggedInProfile(User user) {
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

        String? finalPhotoUrl;
        if (userData?['photoURL'] != null && userData!['photoURL'].toString().isNotEmpty) {
          finalPhotoUrl = userData['photoURL'];
        } else if (user.photoURL != null && user.photoURL!.isNotEmpty) {
          // Fallback to Google Sign-In photo
          finalPhotoUrl = user.photoURL;
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // === HEADER ===
              ClipPath(
                clipper: ProfileHeaderClipper(),
                child: Container(
                  color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F0E8),
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 60),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name and greeting row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            GestureDetector(
                              onTap: _showImagePickerBottomSheet,
                              child: Stack(
                                children: [
                                  Container(
                                    width: 60,
                                    height: 60,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Theme.of(context).brightness == Brightness.dark 
                                          ? Colors.grey[800] 
                                          : Colors.grey[200],
                                      border: Border.all(
                                        color: accent.withOpacity(0.3),
                                        width: 2,
                                      ),
                                    ),
                                    child: ClipOval(
                                      child: _isUploadingPhoto
                                          ? const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
                                          : finalPhotoUrl != null
                                              ? Image.network(
                                                  finalPhotoUrl,
                                                  fit: BoxFit.cover,
                                                  errorBuilder: (context, error, stackTrace) => Icon(
                                                    Icons.person,
                                                    size: 32,
                                                    color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[400] : Colors.grey[400],
                                                  ),
                                                )
                                              : Icon(
                                                  Icons.person,
                                                  size: 32,
                                                  color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[400] : Colors.grey[400],
                                                ),
                                    ),
                                  ),
                                  Positioned(
                                    bottom: 0,
                                    right: 0,
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      decoration: BoxDecoration(
                                        color: accent,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F0E8),
                                          width: 2,
                                        ),
                                      ),
                                      child: const Icon(
                                        Icons.camera_alt,
                                        size: 10,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${'profile.greeting'.tr()},',
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                                    fontSize: 14,
                                    fontWeight: FontWeight.w400,
                                  ),
                                ),
                                Text(
                                  firstName.isNotEmpty ? firstName : displayName,
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurface,
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  BuildInfo.buildTime,
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        // Notification bell icon
                        GestureDetector(
                          onTap: () =>
                              context.push('/notification-history'),
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
                                color: Theme.of(context).brightness ==
                                        Brightness.dark
                                    ? Colors.grey[400]
                                    : Colors.grey[700],
                                size: 22),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // === QUICK ACCESS CHIPS ===
                    FutureBuilder<bool>(
                      future: StaffRoleService().checkStaffStatus(),
                      builder: (context, staffSnapshot) {
                        return Column(
                          children: [
                            IntrinsicHeight(
                              child: Row(
                                crossAxisAlignment:
                                    CrossAxisAlignment.stretch,
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
                            IntrinsicHeight(
                              child: Row(
                                crossAxisAlignment:
                                    CrossAxisAlignment.stretch,
                                children: [
                                  _buildQuickAccessChip(
                                      Icons.table_restaurant,
                                      'profile.my_reservations'.tr(),
                                      () => context
                                          .push('/my-reservations'),
                                      svgAsset:
                                          'assets/images/icon_masa_rezervasyon.svg'),
                                  const SizedBox(width: 12),
                                  _buildQuickAccessChip(
                                      Icons
                                          .notifications_active_outlined,
                                      'profile.notification_settings'
                                          .tr(),
                                      () => context.push(
                                          '/notification-settings')),
                                  const SizedBox(width: 12),
                                  if (staffSnapshot.data == true ||
                                      ref
                                          .watch(driverProvider)
                                          .isDriver)
                                    _buildQuickAccessChip(
                                        Icons.badge,
                                        'profile.staff_login'.tr(),
                                        () =>
                                            _handleStaffLogin(context))
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
                        final balance =
                            (userData?['walletBalance'] as num?)
                                    ?.toDouble() ??
                                0.0;
                        if (balance <= 0) {
                          return const SizedBox.shrink();
                        }
                        return Column(
                          children: [
                            const SizedBox(height: 12),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                  vertical: 14, horizontal: 16),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [
                                    Color(0xFFFFD700),
                                    Color(0xFFFFA000)
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                      Icons.account_balance_wallet,
                                      color: Colors.white,
                                      size: 22),
                                  const SizedBox(width: 12),
                                  Text(
                                    'profile.wallet_balance'.tr(
                                        namedArgs: {
                                          'amount': balance
                                              .toStringAsFixed(2)
                                        }),
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
                        colors: [
                          Color(0xFFEA184A),
                          Color(0xFFE91E63)
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFEA184A)
                              .withOpacity(0.3),
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
                            child: Text('\ud83c\udf81',
                                style: TextStyle(fontSize: 24)),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
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
                                  color:
                                      Colors.white.withOpacity(0.85),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.share_rounded,
                            color: Colors.white.withOpacity(0.9),
                            size: 22),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // === KERMES ATAMALARI ===
              FutureBuilder<List<KermesAssignment>>(
                future: KermesAssignmentService.getActiveAssignedKermeses(),
                builder: (context, snapshot) {
                  if (!snapshot.hasData || snapshot.data!.isEmpty) {
                    return const SizedBox.shrink();
                  }
                  final assignments = snapshot.data!;
                  final isDark = Theme.of(context).brightness == Brightness.dark;
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Kermes Gorevlerim',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ...assignments.map((a) => GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            final roleService = StaffRoleService();
                            roleService.setOverrideWorkplace(a.id, a.title, 'kermes');
                            context.push('/staff-hub');
                          },
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF1E2A2A) : const Color(0xFFE8F5F5),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isDark ? const Color(0xFF2D4A4A) : const Color(0xFFB2DFDB),
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: isDark ? const Color(0xFF0E7C7C) : const Color(0xFF00897B),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Center(
                                    child: Icon(Icons.storefront, color: Colors.white, size: 20),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        a.title,
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Theme.of(context).colorScheme.onSurface,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Wrap(
                                        spacing: 6,
                                        children: a.roles.map((r) {
                                          Color bg;
                                          Color fg;
                                          String label;
                                          switch (r) {
                                            case 'personel':
                                              bg = isDark ? const Color(0xFF164E63) : const Color(0xFFE0F2FE);
                                              fg = isDark ? const Color(0xFF67E8F9) : const Color(0xFF0E7490);
                                              label = 'Personel';
                                              break;
                                            case 'surucu':
                                              bg = isDark ? const Color(0xFF451A03) : const Color(0xFFFEF3C7);
                                              fg = isDark ? const Color(0xFFFCD34D) : const Color(0xFFB45309);
                                              label = 'Surucu';
                                              break;
                                            case 'garson':
                                              bg = isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5);
                                              fg = isDark ? const Color(0xFF6EE7B7) : const Color(0xFF065F46);
                                              label = 'Garson';
                                              break;
                                            case 'kermes_admin':
                                              bg = isDark ? const Color(0xFF3B0764) : const Color(0xFFF3E8FF);
                                              fg = isDark ? const Color(0xFFC084FC) : const Color(0xFF7E22CE);
                                              label = 'K.Admin';
                                              break;
                                            default:
                                              bg = Colors.grey;
                                              fg = Colors.white;
                                              label = r;
                                          }
                                          return Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: bg,
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: fg)),
                                          );
                                        }).toList(),
                                      ),
                                    ],
                                  ),
                                ),
                                Icon(Icons.chevron_right, color: isDark ? Colors.grey[500] : Colors.grey[400], size: 20),
                              ],
                            ),
                          ),
                        )),
                      ],
                    ),
                  );
                },
              ),

              // === MEHR SECTION ===
              _buildSectionTitle('profile.more'.tr()),
              _buildSectionItem(
                  Icons.help_outline, 'profile.help_center'.tr(),
                  () => context.push('/help')),
              _buildSectionItem(Icons.article_outlined,
                  'profile.terms_and_data'.tr(), () {
                context.push('/help');
              }),
              _buildSectionItem(Icons.rate_review_outlined,
                  'profile.feedback'.tr(), () {
                context.push('/feedback');
              }),

              const SizedBox(height: 24),

              // === SPRACHE SECTION ===
              _buildSectionTitle('profile.language'.tr()),
              _buildLanguageSelector(context),

              const SizedBox(height: 24),

              // === ERSCHEINUNGSBILD SECTION ===
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
                        // Sepetleri temizle
                        ref.read(kermesCartProvider.notifier).clearCart();
                        ref.read(cartProvider.notifier).clearCart();
                        await _googleSignIn.signOut();
                        await _auth.signOut();
                        if (context.mounted) {
                          context.go('/login');
                        }
                      },
                      child: Container(
                        width: double.infinity,
                        padding:
                            const EdgeInsets.symmetric(vertical: 14),
                        child: Row(
                          children: [
                            Icon(Icons.logout,
                                color: Colors.grey[600], size: 22),
                            const SizedBox(width: 16),
                            Text('profile.logout'.tr(),
                                style: TextStyle(
                                    color: Colors.grey[800],
                                    fontSize: 15)),
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
                        padding:
                            const EdgeInsets.symmetric(vertical: 14),
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline,
                                color: Colors.red[400], size: 22),
                            const SizedBox(width: 16),
                            Text('profile.delete_account'.tr(),
                                style: TextStyle(
                                    color: Colors.grey[800],
                                    fontSize: 15)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // === FOOTER ===
              _buildFooter(),
            ],
          ),
        );
      },
    );
  }

  // ========== FOOTER (Version + OZSOFT) ==========
  Widget _buildFooter() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
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
        Center(
          child: GestureDetector(
            onTap: () {
              launchUrl(Uri.parse('https://ozsoft.net'),
                  mode: LaunchMode.externalApplication);
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
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  Future<void> _handleStaffLogin(BuildContext context) async {
    // Prevent multiple fast taps overlapping route pushes
    bool isDialogVisible = true;
    
    // Show a small loading overlay since we are performing network requests
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final roleService = StaffRoleService();

      // Refresh staff status — timeout after 10s so offline doesn't block
      try {
        await roleService.checkStaffStatus().timeout(
          const Duration(seconds: 10),
        );
      } catch (e) {
        // Network or timeout — continue with cached state from last session
        debugPrint('[StaffLogin] checkStaffStatus soft-failed: $e');
      }

      // Fetch any active kermes assignments — also soft-fail on error
      List<KermesAssignment> kermeses = [];
      try {
        kermeses = await KermesAssignmentService.getActiveAssignedKermeses()
            .timeout(const Duration(seconds: 10));
      } catch (e) {
        debugPrint('[StaffLogin] getActiveAssignedKermeses soft-failed: $e');
      }
      
      // Remove loading overlay properly
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        isDialogVisible = false;
        
        // Wait briefly for the pop transition to clear avoiding (!_debugLocked) exceptions
        await Future.delayed(const Duration(milliseconds: 100));
      }

      final hasBaseRestaurant = roleService.businessId != null && roleService.businessType != 'kermes';
      final totalOptions = (hasBaseRestaurant ? 1 : 0) + kermeses.length;

      if (!context.mounted) return;

      if (totalOptions > 1) {
        // User has multiple workplaces (e.g. restaurant + kermes, or multiple kermeses)
        showModalBottomSheet(
          context: context,
          backgroundColor: Colors.transparent,
          isScrollControlled: true,
          builder: (ctx) => WorkplaceSelectorSheet(
            baseBusinessName: hasBaseRestaurant ? (roleService.businessName ?? 'İşletme') : null,
            kermeses: kermeses,
            onSelected: (id, name, type) {
              if (id.isEmpty) {
                // Return to base business
                roleService.clearOverride();
              } else {
                roleService.setOverrideWorkplace(id, name, type);
              }
              // Add delay inside the bottom sheet callback
              Future.delayed(const Duration(milliseconds: 100), () {
                if (context.mounted) context.push('/staff-hub');
              });
            },
          ),
        );
      } else if (kermeses.isNotEmpty) {
        // User has exactly 1 kermes and no base restaurant
        roleService.setOverrideWorkplace(kermeses.first.id, kermeses.first.title, 'kermes');
        context.push('/staff-hub');
      } else if (hasBaseRestaurant || roleService.businessId != null) {
        // Default behavior: ONLY a restaurant (or base kermes without active assignments)
        roleService.clearOverride();
        context.push('/staff-hub');
      } else {
        // isStaff is false and no kermeses found — user is not staff
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bu hesap personel olarak tanımlı değil. Lütfen yöneticinizle iletişime geçin.'),
            duration: Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        if (isDialogVisible) {
          Navigator.of(context, rootNavigator: true).pop(); // Clean up overlay
        }
        ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('Bir hata oluştu: $e')),
        );
      }
    }
  }


  void _showImagePickerBottomSheet() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1C1C1E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'profile.update_photo'.tr(),
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.camera_alt, color: Colors.blue),
                ),
                title: Text('profile.camera'.tr(), style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
                onTap: () {
                  Navigator.pop(context);
                  _pickAndUploadImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.photo_library, color: Colors.purple),
                ),
                title: Text('profile.gallery'.tr(), style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
                onTap: () {
                  Navigator.pop(context);
                  _pickAndUploadImage(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickAndUploadImage(ImageSource source) async {
    final user = _auth.currentUser;
    if (user == null) return;

    final picker = ImagePicker();
    try {
      final pickedFile = await picker.pickImage(source: source, imageQuality: 70, maxWidth: 800, maxHeight: 800);
      if (pickedFile == null) return;

      setState(() {
        _isUploadingPhoto = true;
      });

      final ref = FirebaseStorage.instance
          .ref()
          .child('user_profiles')
          .child('${user.uid}_${DateTime.now().millisecondsSinceEpoch}.jpg');

      await ref.putFile(File(pickedFile.path));
      final url = await ref.getDownloadURL();

      await FirebaseFirestore.instance.collection('users').doc(user.uid).set(
        {'photoURL': url},
        SetOptions(merge: true),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('profile.photo_updated'.tr())),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('profile.photo_error'.tr())),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingPhoto = false;
        });
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
            color: isDark ? const Color(0xFF3A3A3D) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: isDark
                ? Border.all(color: Colors.white.withOpacity(0.08), width: 1)
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

  // === Guest Promo Banner (Lieferando-style) ===
  Widget _buildGuestPromoBox(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2C3232) : const Color(0xFFE4EFEF),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Melde dich an für mehr Vorteile',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF1E2424),
              height: 1.2,
            ),
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
              onPressed: () => context.push('/login?register=true'),
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
          
          // Anmelden (Brand Color Button)
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => context.push('/login'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Theme.of(context).primaryColor,
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
    );
  }

  // === Guest Help Banner ===
  Widget _buildGuestHelpBox(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: () => context.push('/help'),
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
                  _buildLangSegment('NL', 'nl', currentLocale,
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

class ProfileHeaderClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    Path path = Path();
    path.lineTo(0, size.height - 40);
    path.quadraticBezierTo(
      size.width / 2, size.height,
      size.width, size.height - 40,
    );
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
