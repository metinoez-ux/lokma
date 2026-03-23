import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/table_group_session_model.dart';

/// Marketplace Grup Sipariş Link Paylaşım Sheet
/// Host grup siparişini oluşturduktan sonra açılır.
class MarketplaceGroupShareSheet extends StatefulWidget {
  final TableGroupSession session;

  const MarketplaceGroupShareSheet({
    super.key,
    required this.session,
  });

  @override
  State<MarketplaceGroupShareSheet> createState() =>
      _MarketplaceGroupShareSheetState();
}

class _MarketplaceGroupShareSheetState
    extends State<MarketplaceGroupShareSheet>
    with SingleTickerProviderStateMixin {
  bool _linkCopied = false;
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  static const Color _accent = Color(0xFFEA184A);

  String get shareLink => widget.session.generatedShareLink;

  String get shareMessage {
    final hasDeadline = widget.session.deadline != null;
    if (hasDeadline) {
      final remaining = widget.session.deadline!.difference(DateTime.now());
      final deadlineText = remaining.inMinutes >= 60
          ? '${remaining.inHours} ${tr('group_order.hours')}'
          : '${remaining.inMinutes} ${tr('group_order.minutes')}';
      return tr('group_order.share_message', namedArgs: {
        'businessName': widget.session.businessName,
        'hostName': widget.session.hostName,
        'deadline': deadlineText,
        'link': shareLink,
      });
    }
    return tr('group_order.share_message_no_deadline', namedArgs: {
      'businessName': widget.session.businessName,
      'hostName': widget.session.hostName,
      'link': shareLink,
    });
  }

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.06).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _pulseController.repeat(reverse: true);

    // Otomatik link kopyala
    _autoCopyLink();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _autoCopyLink() async {
    await Clipboard.setData(ClipboardData(text: shareLink));
    if (mounted) setState(() => _linkCopied = true);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final surfaceBg =
        isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);

    return Container(
      decoration: BoxDecoration(
        color: surfaceBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ─── Handle + Header ─────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
              child: Column(
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.grey.shade600 : Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Success icon
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.green.shade900.withValues(alpha: 0.4) : Colors.green.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.check_circle,
                      color: isDark ? Colors.green.shade400 : Colors.green.shade600,
                      size: 36,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    tr('group_order.share_title'),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    tr('group_order.share_subtitle'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ─── Link Box ────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isDark ? Colors.grey.shade700 : Colors.grey.shade200,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.link, size: 20, color: _accent),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        shareLink,
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? Colors.grey[300] : Colors.grey[700],
                          fontFamily: 'monospace',
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: _linkCopied
                          ? Icon(Icons.check, key: const ValueKey('check'),
                              size: 20, color: Colors.green.shade600)
                          : const Icon(Icons.copy, key: ValueKey('copy'),
                              size: 20, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // ─── Share Buttons ───────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: [
                  // Copy Link
                  Expanded(
                    child: _ShareButton(
                      icon: Icons.copy,
                      label: _linkCopied
                          ? tr('group_order.link_copied')
                          : tr('group_order.copy_link'),
                      color: _linkCopied
                          ? Colors.green.shade600
                          : (isDark ? Colors.grey.shade700 : Colors.grey.shade200),
                      textColor: _linkCopied ? Colors.white : null,
                      onTap: () async {
                        HapticFeedback.mediumImpact();
                        await Clipboard.setData(ClipboardData(text: shareLink));
                        setState(() => _linkCopied = true);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  // WhatsApp
                  Expanded(
                    child: _ShareButton(
                      icon: Icons.message,
                      label: tr('group_order.share_whatsapp'),
                      color: const Color(0xFF25D366),
                      textColor: Colors.white,
                      onTap: _shareViaWhatsApp,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── Deadline Info ────────────────────────────────
            if (widget.session.deadline != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.orange.shade900.withValues(alpha: 0.3) : Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark ? Colors.orange.shade700.withValues(alpha: 0.4) : Colors.orange.shade200,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.timer, size: 18,
                        color: isDark ? Colors.orange.shade300 : Colors.orange.shade700),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _deadlineText(),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: isDark ? Colors.orange.shade200 : Colors.orange.shade800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: 20),

            // ─── Continue Button ──────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: SizedBox(
                width: double.infinity,
                height: 54,
                child: ScaleTransition(
                  scale: _pulseAnimation,
                  child: FilledButton.icon(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.restaurant_menu, size: 20),
                    label: Text(
                      tr('group_order.your_selection'),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
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
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _deadlineText() {
    final remaining = widget.session.deadline!.difference(DateTime.now());
    if (remaining.isNegative) {
      return tr('group_order.deadline_expired');
    }
    final timeStr = remaining.inMinutes >= 60
        ? '${remaining.inHours}:${(remaining.inMinutes % 60).toString().padLeft(2, '0')} ${tr('group_order.hours')}'
        : '${remaining.inMinutes} ${tr('group_order.minutes')}';
    return tr('group_order.deadline_remaining', namedArgs: {'time': timeStr});
  }

  Future<void> _shareViaWhatsApp() async {
    HapticFeedback.mediumImpact();
    await Clipboard.setData(ClipboardData(text: shareLink));

    final whatsappUrl = Uri.parse(
      'https://wa.me/?text=${Uri.encodeComponent(shareMessage)}',
    );

    if (await canLaunchUrl(whatsappUrl)) {
      await launchUrl(whatsappUrl, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('group_order.link_copied')),
            backgroundColor: Colors.amber,
          ),
        );
      }
    }
  }
}

/// Reusable share button
class _ShareButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color? textColor;
  final VoidCallback onTap;

  const _ShareButton({
    required this.icon,
    required this.label,
    required this.color,
    this.textColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fgColor =
        textColor ?? (isDark ? Colors.grey[300] : Colors.grey[700]);

    return Material(
      color: color,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: fgColor),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: fgColor,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
