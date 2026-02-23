import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/table_group_session_model.dart';
import '../../utils/currency_utils.dart';

/// Card widget to display a closed group order session in the order history.
class GroupOrderHistoryCard extends StatelessWidget {
  final TableGroupSession session;
  final String userId;
  final bool isDark;

  const GroupOrderHistoryCard({
    super.key,
    required this.session,
    required this.userId,
    required this.isDark,
  });

  static const Color _accent = Color(0xFFFF8000);

  @override
  Widget build(BuildContext context) {
    final myParticipant = session.participants
        .where((p) => p.userId == userId)
        .firstOrNull;

    final dateStr = session.closedAt != null
        ? DateFormat('dd MMM yyyy, HH:mm', 'tr_TR').format(session.closedAt!)
        : DateFormat('dd MMM yyyy, HH:mm', 'tr_TR').format(session.createdAt);

    final cardColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.08) : Colors.grey.withOpacity(0.15),
        ),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          shape: const RoundedRectangleBorder(),
          leading: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _accent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.groups_rounded, color: _accent, size: 24),
          ),
          title: Text(
            session.businessName,
            style: TextStyle(
              color: textColor,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.table_restaurant, size: 14, color: subtitleColor),
                  const SizedBox(width: 4),
                  Text(
                    'Masa ${session.tableNumber}',
                    style: TextStyle(color: subtitleColor, fontSize: 12),
                  ),
                  const SizedBox(width: 12),
                  Icon(Icons.people, size: 14, color: subtitleColor),
                  const SizedBox(width: 4),
                  Text(
                    '${session.participants.length} kişi',
                    style: TextStyle(color: subtitleColor, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                dateStr,
                style: TextStyle(color: subtitleColor, fontSize: 11),
              ),
            ],
          ),
          children: [
            // My items
            if (myParticipant != null && myParticipant.items.isNotEmpty) ...[
              _sectionHeader('Benim Siparişlerim', textColor),
              const SizedBox(height: 6),
              ...myParticipant.items.map((item) => _itemRow(item, textColor, subtitleColor)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Hesabım',
                    style: TextStyle(
                      color: textColor,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    '${CurrencyUtils.getCurrencySymbol()}${myParticipant.subtotal.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: _accent,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ],
            if (myParticipant == null || myParticipant.items.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'Sipariş bulunamadı',
                  style: TextStyle(color: subtitleColor, fontSize: 13),
                ),
              ),

            // Other participants summary
            if (session.participants.length > 1) ...[
              const SizedBox(height: 12),
              Divider(color: subtitleColor.withOpacity(0.3)),
              const SizedBox(height: 8),
              _sectionHeader('Diğer Katılımcılar', textColor),
              const SizedBox(height: 6),
              ...session.participants
                  .where((p) => p.userId != userId)
                  .map((p) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  p.isHost ? Icons.star_rounded : Icons.person,
                                  size: 16,
                                  color: p.isHost ? Colors.amber : subtitleColor,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  p.name,
                                  style: TextStyle(color: textColor, fontSize: 13),
                                ),
                              ],
                            ),
                            Text(
                              '${CurrencyUtils.getCurrencySymbol()}${p.subtotal.toStringAsFixed(2)}',
                              style: TextStyle(
                                color: subtitleColor,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      )),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: _accent.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Toplam Hesap',
                      style: TextStyle(
                        color: textColor,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '${CurrencyUtils.getCurrencySymbol()}${session.grandTotal.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: _accent,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, Color textColor) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        title,
        style: TextStyle(
          color: textColor,
          fontSize: 13,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _itemRow(TableGroupItem item, Color textColor, Color subtitleColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Text(
            '${item.quantity}x',
            style: TextStyle(
              color: _accent,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              item.productName,
              style: TextStyle(color: textColor, fontSize: 13),
            ),
          ),
          Text(
            '${CurrencyUtils.getCurrencySymbol()}${item.totalPrice.toStringAsFixed(2)}',
            style: TextStyle(
              color: subtitleColor,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
