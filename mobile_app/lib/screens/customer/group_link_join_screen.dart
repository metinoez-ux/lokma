import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import '../../providers/table_group_provider.dart';

/// Deep link'ten gelen /group/:sessionId URL'ini karşılayan ara ekran.
/// Session'ı Firestore'dan yükler, kullanıcıyı otomatik katılım yapar,
/// ve ilgili sipariş ekranına yönlendirir.
class GroupLinkJoinScreen extends ConsumerStatefulWidget {
  final String sessionId;

  const GroupLinkJoinScreen({super.key, required this.sessionId});

  @override
  ConsumerState<GroupLinkJoinScreen> createState() =>
      _GroupLinkJoinScreenState();
}

class _GroupLinkJoinScreenState extends ConsumerState<GroupLinkJoinScreen> {
  bool _loading = true;
  String? _errorKey; // i18n key for error message

  @override
  void initState() {
    super.initState();
    _joinSession();
  }

  Future<void> _joinSession() async {
    try {
      final notifier = ref.read(tableGroupProvider.notifier);
      final success = await notifier.joinViaLink(widget.sessionId);

      if (!mounted) return;

      if (success) {
        // Navigate to the business detail screen for the group order
        final session = ref.read(tableGroupProvider).currentSession;
        if (session != null) {
          context.go('/kasap/${session.businessId}?mode=teslimat');
        } else {
          context.go('/restoran');
        }
      } else {
        setState(() {
          _loading = false;
          _errorKey = 'group_order.session_not_found';
        });
      }
    } catch (e) {
      if (!mounted) return;
      final errMsg = e.toString().toLowerCase();
      String errorKey;
      if (errMsg.contains('expired') || errMsg.contains('deadline')) {
        errorKey = 'group_order.session_expired';
      } else if (errMsg.contains('closed') || errMsg.contains('completed')) {
        errorKey = 'group_order.session_closed';
      } else {
        errorKey = 'group_order.session_not_found';
      }
      setState(() {
        _loading = false;
        _errorKey = errorKey;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF121212) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.grey[400] : Colors.grey[600];

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: _loading ? _buildLoading(subtitleColor) : _buildError(textColor, subtitleColor, isDark),
          ),
        ),
      ),
    );
  }

  Widget _buildLoading(Color? subtitleColor) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // LOKMA branded loading
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: const Color(0xFFFB335B).withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: SizedBox(
              width: 36,
              height: 36,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: Color(0xFFFB335B),
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
            color: subtitleColor,
          ),
        ),
      ],
    );
  }

  Widget _buildError(Color textColor, Color? subtitleColor, bool isDark) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: isDark ? Colors.red.shade900.withValues(alpha: 0.4) : Colors.red.shade50,
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
              backgroundColor: const Color(0xFFFB335B),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: Text(
              tr('checkout.continue_shopping'),
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
