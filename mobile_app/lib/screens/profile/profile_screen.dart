import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../providers/theme_provider.dart';
import '../../providers/driver_provider.dart';
import '../../services/staff_role_service.dart';
import 'package:easy_localization/easy_localization.dart';

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
  final ImagePicker _imagePicker = ImagePicker();
  bool _isLoading = false;
  bool _isUploadingPhoto = false;

  @override
  Widget build(BuildContext context) {
    // Force rebuild on language change
    context.locale;
    final user = _auth.currentUser;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        title: Text('profile.my_account'.tr(),
            style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: user == null ? _buildLoginPrompt() : _buildProfile(user),
    );
  }

  Widget _buildLoginPrompt() {
    // Directly navigate to the new LOKMA branded login screen
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // LOKMA Logo
            ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Image.asset(
                'assets/images/lokma_logo.png',
                height: 120,
                width: 120,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  height: 120,
                  width: 120,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFB335B),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Center(
                    child: Text('🍕', style: TextStyle(fontSize: 48)),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'LOKMA',
              style: TextStyle(
                color: Color(0xFFFB335B),
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Fresh. Fast. Local.',
              style: TextStyle(
                color: Colors.grey[700],
                fontSize: 16,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'profile.login_subtitle'.tr(),
              style: TextStyle(color: Colors.grey[600], fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),

            // Single prominent login button
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                context.push('/login');
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: BoxDecoration(
                  color: const Color(0xFFFB335B),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFB335B).withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    'profile.login_register_button'.tr(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Guest option
            TextButton(
              onPressed: () async {
                setState(() => _isLoading = true);
                try {
                  await _auth.signInAnonymously();
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text('${'profile.login_error'.tr()}: $e'),
                          backgroundColor: Colors.red),
                    );
                  }
                }
                setState(() => _isLoading = false);
              },
              child: Text(
                'profile.continue_as_guest'.tr(),
                style: TextStyle(
                  color: Colors.grey[700],
                  fontSize: 14,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ],
        ),
      ),
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
        String displayName = 'Kullanıcı';
        String firstName = '';
        if (userData != null) {
          firstName = userData['firstName'] as String? ?? '';
          final lastName = userData['lastName'] as String? ?? '';
          if (firstName.isNotEmpty || lastName.isNotEmpty) {
            displayName = '$firstName $lastName'.trim();
          }
        }
        if (displayName == 'Kullanıcı' &&
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
                                fontWeight: FontWeight.bold,
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
                                  : Colors.white.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(Icons.notifications_outlined,
                                color: const Color(0xFFFB335B), size: 22),
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
                            Row(
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
                            const SizedBox(height: 12),
                            // Second row: Reservations and Notifications
                            Row(
                              children: [
                                _buildQuickAccessChip(
                                    Icons.table_restaurant,
                                    'profile.my_reservations'.tr().replaceAll(' ', '\n'),
                                    () => context.push('/my-reservations')),
                                const SizedBox(width: 12),
                                _buildQuickAccessChip(
                                    Icons.notifications_active_outlined,
                                    'profile.notification_settings'.tr().replaceAll(' ', '\n'),
                                    () =>
                                        context.push('/notification-settings')),
                                const SizedBox(width: 12),
                                const Expanded(
                                    child:
                                        SizedBox()), // Placeholder for grid alignment
                              ],
                            ),
                            // Teslimat Paneli removed - consolidated into Teslimatlarım
                          ],
                        );
                      },
                    ),
                    // Driver Panel - for couriers assigned to multiple businesses
                    Consumer(
                      builder: (context, ref, _) {
                        final driverState = ref.watch(driverProvider);
                        final isDriver = driverState.isDriver;

                        // Show unified Staff Hub button if driver OR reservation staff
                        return FutureBuilder<bool>(
                          future: _checkStaffReservationAccess(),
                          builder: (context, snapshot) {
                            final hasReservation = snapshot.data == true;

                            // If neither driver nor reservation staff, hide
                            if (!isDriver && !hasReservation) {
                              return const SizedBox.shrink();
                            }

                            return Column(
                              children: [
                                const SizedBox(height: 12),
                                GestureDetector(
                                  onTap: () {
                                    HapticFeedback.lightImpact();
                                    context.push('/staff-hub');
                                  },
                                  child: Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 14, horizontal: 16),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [
                                          const Color(0xFFFB335B)
                                              .withValues(alpha: 0.08),
                                          const Color(0xFFFB335B)
                                              .withValues(alpha: 0.03),
                                        ],
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                          color: const Color(0xFFFB335B),
                                          width: 1.5),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFB335B)
                                                .withValues(alpha: 0.1),
                                            borderRadius:
                                                BorderRadius.circular(10),
                                          ),
                                          child: const Icon(Icons.badge,
                                              color: Color(0xFFFB335B),
                                              size: 22),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                'profile.staff_login'.tr(),
                                                style: const TextStyle(
                                                  color: Color(0xFFFB335B),
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                              Text(
                                                [
                                                  if (isDriver) 'profile.delivery'.tr(),
                                                  if (hasReservation)
                                                    'profile.reservation'.tr(),
                                                ].join(' • '),
                                                style: TextStyle(
                                                  color: Colors.grey[500],
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Icon(Icons.arrow_forward_ios,
                                            size: 16,
                                            color: const Color(0xFFFB335B)
                                                .withValues(alpha: 0.5)),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        );
                      },
                    ),
                    // TODO: Cüzdan özelliği hazır olunca geri eklenecek (TODO.md)
                  ],
                ),
              ),

              // TODO: Fırsatlar bölümü hazır olunca geri eklenecek (TODO.md)
              // - Kuponlarım
              // - LOKMA Club

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
                        setState(() {});
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
                    style: TextStyle(color: Colors.grey[700], fontSize: 12),
                  ),
                ),
              ),

              const SizedBox(height: 40),
            ],
          ),
        );
      },
    );
  }

  // === Quick Access Chip (Yemeksepeti-style) ===
  Widget _buildQuickAccessChip(
      IconData icon, String label, VoidCallback onTap) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: const Color(0xFFFB335B), size: 22),
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
            fontWeight: FontWeight.bold),
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
                      _buildPillSegment('Oto', ThemePreference.system,
                          currentTheme, primaryColor, isDark, ref),
                      _buildPillSegment('Gün', ThemePreference.light,
                          currentTheme, primaryColor, isDark, ref),
                      _buildPillSegment('Gece', ThemePreference.dark,
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
            color: isSelected ? primaryColor : Colors.transparent,
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
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: isSelected ? primaryColor : Colors.transparent,
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
                setState(() {});
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('profile.account_deleted'.tr()),
                          backgroundColor: Colors.green,
                  ));
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
