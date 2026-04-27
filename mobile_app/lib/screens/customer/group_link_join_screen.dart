import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import '../../models/table_group_session_model.dart';
import '../../providers/table_group_provider.dart';
import '../../providers/group_order_provider.dart';

/// Deep link'ten gelen /group/:sessionId URL'ini karsilayan ekran.
/// Lieferando tarzi: Guest hesap acmadan katilabilir.
/// 1. Session bilgisini Firestore'dan yukler
/// 2. Guest ise onboarding gosterir (nickname + aciklama)
/// 3. Otomatik katilim yapar ve ilgili siparis ekranina yonlendirir
class GroupLinkJoinScreen extends ConsumerStatefulWidget {
  final String sessionId;

  const GroupLinkJoinScreen({super.key, required this.sessionId});

  @override
  ConsumerState<GroupLinkJoinScreen> createState() =>
      _GroupLinkJoinScreenState();
}

class _GroupLinkJoinScreenState extends ConsumerState<GroupLinkJoinScreen>
    with SingleTickerProviderStateMixin {
  bool _loading = true;
  bool _showOnboarding = false;
  String? _errorKey;
  TableGroupSession? _session;
  final _nicknameController = TextEditingController();
  bool _isJoining = false;
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

  static const Color _accent = Color(0xFFEA184A);


  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
    _loadSession();
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  /// Session bilgisini yukle, duruma gore onboarding veya direk katilim
  /// Once table_group_sessions'ta arar, bulamazsa kermes_group_orders'a bakar
  Future<void> _loadSession() async {
    try {
      // Once restoran grup oturumlarinda ara
      final doc = await FirebaseFirestore.instance
          .collection('table_group_sessions')
          .doc(widget.sessionId)
          .get();

      if (doc.exists) {
        // Restoran grup oturumu bulundu
        final session = TableGroupSession.fromFirestore(doc);

        if (session.status != GroupSessionStatus.active) {
          _setError('group_order.session_closed');
          return;
        }

        if (session.isDeadlineExpired) {
          _setError('group_order.session_expired');
          return;
        }

        if (!mounted) return;

        setState(() {
          _session = session;
          _loading = false;
          _showOnboarding = true;
        });
        _fadeController.forward();
        return;
      }

      // Restoranda bulunamadi, kermes grup siparislerinde ara
      final kermesDoc = await FirebaseFirestore.instance
          .collection('kermes_group_orders')
          .doc(widget.sessionId)
          .get();

      if (kermesDoc.exists) {
        // Kermes grup siparisi bulundu - PIN gerekmez (link ile katilim)
        if (!mounted) return;
        _handleKermesGroupJoin(kermesDoc);
        return;
      }

      // Hicbir yerde bulunamadi
      _setError('group_order.session_not_found');
    } catch (e) {
      _setError('group_order.session_not_found');
    }
  }

  /// Kermes grup siparisine link ile katilim (PIN gerekmez)
  Future<void> _handleKermesGroupJoin(DocumentSnapshot kermesDoc) async {
    try {
      final data = kermesDoc.data() as Map<String, dynamic>;
      final status = data['status'] ?? '';
      final expiresAt = (data['expiresAt'] as Timestamp?)?.toDate();

      if (status == 'ordered' || status == 'cancelled' || status == 'completed') {
        _setError('group_order.session_closed');
        return;
      }

      if (expiresAt != null && DateTime.now().isAfter(expiresAt)) {
        _setError('group_order.session_expired');
        return;
      }

      // Kullanici bilgilerini al
      final userId = FirebaseAuth.instance.currentUser?.uid ??
          'anon_${DateTime.now().millisecondsSinceEpoch}';
      final userName = FirebaseAuth.instance.currentUser?.displayName ?? 'Misafir';

      // Kermes grubuna katil (PIN gerekmez - link ile katilim)
      final groupNotifier = ref.read(groupOrderProvider.notifier);
      final success = await groupNotifier.joinGroupOrder(
        orderId: widget.sessionId,
        userId: userId,
        userName: userName,
        requirePin: false, // Link ile katilim - PIN gerekmez
      );

      if (!mounted) return;

      if (success) {
        // Kermes event bilgisini bul ve yonlendir
        final kermesId = data['kermesId'] ?? '';
        context.go('/kermesler/$kermesId');
      } else {
        _setError('group_order.session_not_found');
      }
    } catch (e) {
      _setError('group_order.session_not_found');
    }
  }

  void _setError(String errorKey) {
    if (!mounted) return;
    setState(() {
      _loading = false;
      _showOnboarding = false;
      _errorKey = errorKey;
    });
  }

  /// Guest katilim islemi
  Future<void> _joinSession() async {
    if (_isJoining) return;
    setState(() => _isJoining = true);
    HapticFeedback.mediumImpact();

    try {
      final nickname = _nicknameController.text.trim();
      final notifier = ref.read(tableGroupProvider.notifier);
      final success = await notifier.joinViaLink(
        widget.sessionId,
        displayName: nickname.isNotEmpty ? nickname : null,
      );

      if (!mounted) return;

      if (success) {
        final session = ref.read(tableGroupProvider).session;
        if (session != null) {
          final mode = session.isDelivery ? 'teslimat' : (session.sessionType == GroupSessionType.pickup ? 'gelal' : 'masa');
          final encodedName = Uri.encodeComponent(session.businessName);
          final tableNum = session.tableNumber.isNotEmpty
              ? session.tableNumber
              : '1';
          context.go(
            '/kasap/${session.businessId}?mode=$mode&groupSessionId=${session.id}&businessName=$encodedName&table=$tableNum',
          );
        } else {
          context.go('/restoran');
        }
      } else {
        _setError('group_order.session_not_found');
      }
    } catch (e) {
      if (!mounted) return;
      final errMsg = e.toString().toLowerCase();
      if (errMsg.contains('expired') || errMsg.contains('deadline')) {
        _setError('group_order.session_expired');
      } else if (errMsg.contains('closed') || errMsg.contains('completed')) {
        _setError('group_order.session_closed');
      } else {
        _setError('group_order.session_not_found');
      }
    } finally {
      if (mounted) setState(() => _isJoining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF121212) : Colors.white;

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _loading
                ? _buildLoading(isDark)
                : _errorKey != null
                    ? _buildError(isDark)
                    : _showOnboarding
                        ? _buildOnboarding(isDark)
                        : _buildLoading(isDark),
          ),
        ),
      ),
    );
  }

  // ========== LOADING ==========
  Widget _buildLoading(bool isDark) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: _accent.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: SizedBox(
              width: 36,
              height: 36,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: _accent,
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        Text(
          tr('group_order.joining'),
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
        ),
      ],
    );
  }

  // ========== ONBOARDING (Lieferando-style) ==========
  Widget _buildOnboarding(bool isDark) {
    final session = _session!;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final subtitleColor = isDark ? Colors.grey[400] : Colors.grey[600];

    return FadeTransition(
      opacity: _fadeAnimation,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Parti illustrasyon
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: _accent.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.celebration_rounded,
                size: 56,
                color: _accent,
              ),
            ),
            const SizedBox(height: 24),

            // Baslik
            Text(
              tr('group_order.guest_welcome_title'),
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              tr('group_order.guest_welcome_subtitle'),
              style: TextStyle(fontSize: 14, color: subtitleColor),
              textAlign: TextAlign.center,
            ),

            const SizedBox(height: 24),

            // Restoran bilgisi
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark
                      ? Colors.grey.shade700
                      : Colors.grey.shade200,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: _accent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.restaurant, color: _accent, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tr('group_order.guest_order_for'),
                          style: TextStyle(
                            fontSize: 12,
                            color: subtitleColor,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          session.businessName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 3 adim aciklama
            _buildStep(
              isDark: isDark,
              cardBg: cardBg,
              icon: Icons.restaurant_menu,
              text: tr('group_order.guest_step_1'),
            ),
            const SizedBox(height: 10),
            _buildStep(
              isDark: isDark,
              cardBg: cardBg,
              icon: Icons.shopping_bag_rounded,
              text: tr('group_order.guest_step_2'),
            ),
            const SizedBox(height: 10),
            _buildStep(
              isDark: isDark,
              cardBg: cardBg,
              icon: Icons.payment,
              text: tr('group_order.guest_step_3', namedArgs: {
                'hostName': session.hostName,
              }),
            ),

            const SizedBox(height: 24),

            // Nickname input
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark
                      ? Colors.grey.shade700
                      : Colors.grey.shade200,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('group_order.guest_nickname_label'),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nicknameController,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      hintText: tr('group_order.guest_nickname_hint'),
                      hintStyle: TextStyle(
                        color: isDark ? Colors.grey[600] : Colors.grey[400],
                      ),
                      filled: true,
                      fillColor: isDark
                          ? Colors.grey.shade800
                          : Colors.grey.shade50,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      prefixIcon: Icon(
                        Icons.person_outline,
                        color: isDark ? Colors.grey[500] : Colors.grey[400],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Katil butonu
            SizedBox(
              width: double.infinity,
              height: 56,
              child: FilledButton.icon(
                onPressed: _isJoining ? null : _joinSession,
                icon: _isJoining
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Icon(Icons.shopping_bag_rounded, size: 22),
                label: Text(
                  _isJoining
                      ? tr('group_order.joining')
                      : tr('group_order.guest_add_items'),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: _accent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep({
    required bool isDark,
    required Color cardBg,
    required IconData icon,
    required String text,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? Colors.grey.shade700 : Colors.grey.shade200,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: _accent.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: _accent, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.grey[300] : Colors.grey[700],
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ========== ERROR ==========
  Widget _buildError(bool isDark) {
    final textColor = isDark ? Colors.white : Colors.black87;


    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: isDark
                ? Colors.red.shade900.withOpacity(0.4)
                : Colors.red.shade50,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.error_outline,
            size: 40,
            color: isDark ? Colors.red.shade300 : Colors.red.shade400,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          tr(_errorKey ?? 'group_order.session_not_found'),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: textColor,
          ),
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: FilledButton(
            onPressed: () => context.go('/restoran'),
            style: FilledButton.styleFrom(
              backgroundColor: _accent,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: Text(
              tr('common.return_to_homepage'),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
