import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/table_group_session_model.dart';
import '../providers/table_group_provider.dart';

/// Grup Sipariş Başlatma Bottom Sheet
/// Host restoran sayfasından "Grup Siparişi Başlat" butonuna tıkladığında açılır.
class GroupOrderSetupSheet extends ConsumerStatefulWidget {
  final String businessId;
  final String businessName;

  const GroupOrderSetupSheet({
    super.key,
    required this.businessId,
    required this.businessName,
  });

  @override
  ConsumerState<GroupOrderSetupSheet> createState() =>
      _GroupOrderSetupSheetState();
}

class _GroupOrderSetupSheetState extends ConsumerState<GroupOrderSetupSheet> {
  GroupSessionType _sessionType = GroupSessionType.delivery;
  int _deadlineMinutes = 30; // varsayılan 30 dk
  bool _hasDeadline = true;
  bool _isCreating = false;

  // LOKMA brand accent (Rose-500)
  static const Color _accent = Color(0xFFFB335B);

  final List<int> _deadlineOptions = [10, 15, 20, 30, 45, 60];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final surfaceBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);

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
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: _accent.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.groups, color: _accent, size: 26),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              tr('group_order.start_group_order'),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.businessName,
                              style: TextStyle(
                                fontSize: 14,
                                color: isDark ? Colors.grey[400] : Colors.grey[600],
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ─── Sipariş Türü ─────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('group_order.order_type'),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildTypeChip(
                          icon: Icons.delivery_dining,
                          label: tr('group_order.delivery'),
                          type: GroupSessionType.delivery,
                        ),
                        const SizedBox(width: 10),
                        _buildTypeChip(
                          icon: Icons.store,
                          label: tr('group_order.pickup'),
                          type: GroupSessionType.pickup,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 12),

            // ─── Deadline / Zaman Kısıtlaması ────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.timer, size: 18, color: _accent),
                            const SizedBox(width: 8),
                            Text(
                              tr('group_order.deadline'),
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        Switch.adaptive(
                          value: _hasDeadline,
                          onChanged: (v) => setState(() => _hasDeadline = v),
                          activeColor: _accent,
                        ),
                      ],
                    ),
                    if (_hasDeadline) ...[
                      const SizedBox(height: 4),
                      Text(
                        tr('group_order.deadline_hint'),
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.grey[500] : Colors.grey[600],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _deadlineOptions.map((mins) {
                          final isSelected = _deadlineMinutes == mins;
                          return GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setState(() => _deadlineMinutes = mins);
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? _accent
                                    : (isDark
                                        ? Colors.grey.shade800
                                        : Colors.grey.shade100),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected
                                      ? _accent
                                      : (isDark ? Colors.grey.shade600 : Colors.grey.shade300),
                                  width: isSelected ? 1.5 : 1,
                                ),
                              ),
                              child: Text(
                                mins >= 60
                                    ? '${mins ~/ 60} ${tr('group_order.hours')}'
                                    : '$mins ${tr('group_order.minutes')}',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight:
                                      isSelected ? FontWeight.w600 : FontWeight.w500,
                                  color: isSelected
                                      ? Colors.white
                                      : (isDark
                                          ? Colors.grey[300]
                                          : Colors.grey[700]),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            const SizedBox(height: 12),

            // ─── Info Banner ──────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? Colors.blue.shade900.withValues(alpha: 0.3) : Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isDark ? Colors.blue.shade700.withValues(alpha: 0.4) : Colors.blue.shade100,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, size: 18,
                      color: isDark ? Colors.blue.shade300 : Colors.blue.shade700),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        tr('group_order.info_banner'),
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? Colors.blue.shade200 : Colors.blue.shade800,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // ─── Create Button ────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: SizedBox(
                width: double.infinity,
                height: 54,
                child: FilledButton.icon(
                  onPressed: _isCreating ? null : _createGroupOrder,
                  icon: _isCreating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Icon(Icons.send_rounded, size: 20),
                  label: Text(
                    _isCreating
                        ? tr('group_order.creating')
                        : tr('group_order.create_and_share'),
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
          ],
        ),
      ),
    );
  }

  Widget _buildTypeChip({
    required IconData icon,
    required String label,
    required GroupSessionType type,
  }) {
    final isSelected = _sessionType == type;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          setState(() => _sessionType = type);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected
                ? _accent.withValues(alpha: 0.12)
                : (isDark ? Colors.grey.shade800 : Colors.grey.shade50),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? _accent : (isDark ? Colors.grey.shade600 : Colors.grey.shade300),
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, size: 26, color: isSelected ? _accent : Colors.grey),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected
                      ? _accent
                      : (isDark ? Colors.grey[300] : Colors.grey[700]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _createGroupOrder() async {
    setState(() => _isCreating = true);

    try {
      final notifier = ref.read(tableGroupProvider.notifier);
      final session = await notifier.createLinkSession(
        businessId: widget.businessId,
        businessName: widget.businessName,
        sessionType: _sessionType,
        deadline: _hasDeadline
            ? DateTime.now().add(Duration(minutes: _deadlineMinutes))
            : null,
      );

      if (session != null && mounted) {
        Navigator.pop(context, session);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }
}
