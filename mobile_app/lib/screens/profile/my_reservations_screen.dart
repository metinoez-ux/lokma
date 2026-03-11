import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:lokma_app/services/calendar_service.dart';

/// Shows all reservations for the current user, ordered by date.
/// Displays status (pending/confirmed/rejected/cancelled) with clear icons.
class MyReservationsScreen extends StatelessWidget {
  const MyReservationsScreen({super.key});


  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white70 : Colors.black54;

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, color: textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Masa Rezervasyonlarım',
          style: TextStyle(color: textPrimary, fontSize: 18, fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
      ),
      body: user == null
          ? Center(
              child: Text(
                'Lütfen giriş yapın',
                style: TextStyle(color: textSecondary, fontSize: 16),
              ),
            )
          : StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance
                  .collectionGroup('reservations')
                  .where('userId', isEqualTo: user.uid)
                  .orderBy('reservationDate', descending: true)
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return Center(child: CircularProgressIndicator(color: isDark ? Colors.grey[400]! : Colors.grey[600]!));
                }

                if (snapshot.hasError) {
                  debugPrint('❌ My Reservations error: ${snapshot.error}');
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.error_outline, color: Colors.red[400], size: 48),
                          const SizedBox(height: 16),
                          Text(
                            'Rezervasyonlar yüklenirken hata oluştu',
                            style: TextStyle(color: textPrimary, fontSize: 15, fontWeight: FontWeight.w600),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${snapshot.error}',
                            style: TextStyle(color: textSecondary, fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  );
                }

                final docs = snapshot.data?.docs ?? [];

                if (docs.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.restaurant_outlined, color: Colors.grey[400], size: 64),
                        const SizedBox(height: 16),
                        Text(
                          'Henüz rezervasyonunuz yok',
                          style: TextStyle(color: textSecondary, fontSize: 16),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'İşletme detay sayfasından masa rezervasyonu yapabilirsiniz',
                          style: TextStyle(color: textSecondary, fontSize: 13),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                }

                // Separate into active (pending/confirmed) and past (rejected/cancelled/completed)
                final active = <QueryDocumentSnapshot>[];
                final past = <QueryDocumentSnapshot>[];
                final now = DateTime.now();

                for (final doc in docs) {
                  final data = doc.data() as Map<String, dynamic>;
                  final status = data['status'] as String? ?? 'pending';
                  final resDate = (data['reservationDate'] as Timestamp?)?.toDate();
                  final isPast = resDate != null && resDate.isBefore(now);

                  if (status == 'cancelled' || status == 'rejected' || isPast) {
                    past.add(doc);
                  } else {
                    active.add(doc);
                  }
                }

                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (active.isNotEmpty) ...[
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          'Aktif Rezervasyonlar',
                          style: TextStyle(
                            color: textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      ...active.map((doc) => _buildReservationCard(
                        context, doc, isDark, textPrimary, textSecondary,
                      )),
                    ],
                    if (past.isNotEmpty) ...[
                      Padding(
                        padding: const EdgeInsets.only(top: 24, bottom: 12),
                        child: Text(
                          'Geçmiş Rezervasyonlar',
                          style: TextStyle(
                            color: textSecondary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      ...past.map((doc) => _buildReservationCard(
                        context, doc, isDark, textPrimary, textSecondary,
                      )),
                    ],
                  ],
                );
              },
            ),
    );
  }

  Widget _buildReservationCard(
    BuildContext context,
    QueryDocumentSnapshot doc,
    bool isDark,
    Color textPrimary,
    Color textSecondary,
  ) {
    final data = doc.data() as Map<String, dynamic>;
    final status = data['status'] as String? ?? 'pending';
    final businessName = data['businessName'] as String? ?? 'İşletme';
    final partySize = data['partySize'] as int? ?? 0;
    final resDate = (data['reservationDate'] as Timestamp?)?.toDate();
    final confirmedBy = data['confirmedBy'] as String? ?? '';
    final notes = data['notes'] as String? ?? '';
    final tableCardNumbers = (data['tableCardNumbers'] as List<dynamic>?)
        ?.map((e) => e as int)
        .toList() ?? [];

    final statusInfo = _getStatusInfo(status);
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: statusInfo.borderColor.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header with status badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: statusInfo.bgColor.withValues(alpha: isDark ? 0.15 : 0.06),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            ),
            child: Row(
              children: [
                Icon(statusInfo.icon, color: statusInfo.color, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    businessName,
                    style: TextStyle(
                      color: textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusInfo.bgColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusInfo.label,
                    style: TextStyle(
                      color: statusInfo.color,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Details
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                if (resDate != null)
                  _buildInfoRow(
                    Icons.calendar_today,
                    DateFormat('d MMMM yyyy, EEEE', 'tr').format(resDate),
                    textPrimary,
                  ),
                const SizedBox(height: 6),
                if (resDate != null)
                  _buildInfoRow(
                    Icons.access_time,
                    'Saat ${DateFormat('HH:mm').format(resDate)}',
                    textPrimary,
                  ),
                const SizedBox(height: 6),
                _buildInfoRow(
                  Icons.people,
                  '$partySize Kişi',
                  textPrimary,
                ),
                // Table Card Numbers — prominent display for confirmed reservations
                if (status == 'confirmed' && tableCardNumbers.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: isDark ? 0.15 : 0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Text('🃏', style: TextStyle(fontSize: 20)),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Masa Kart Numaranız',
                              style: TextStyle(
                                color: Colors.green[isDark ? 300 : 700],
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 6,
                              children: tableCardNumbers.map((n) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.green,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '$n',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              )).toList(),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                if (confirmedBy.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  _buildInfoRow(
                    Icons.person_outline,
                    'Onaylayan: $confirmedBy',
                    textSecondary,
                  ),
                ],
                if (notes.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  _buildInfoRow(
                    Icons.note_alt_outlined,
                    notes,
                    textSecondary,
                  ),
                ],
              ],
            ),
          ),

          // Add to Calendar button for confirmed reservations
          if (status == 'confirmed' && resDate != null && resDate.isAfter(DateTime.now()))
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              child: OutlinedButton.icon(
                onPressed: () => CalendarService.addReservationEvent(
                  context: context,
                  reservationTime: resDate,
                  businessName: businessName,
                  partySize: partySize,
                  tableCardNumbers: tableCardNumbers,
                ),
                icon: const Icon(Icons.calendar_month, size: 16),
                label: Text(tr('profile.add_to_calendar')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.blue[700],
                  side: BorderSide(color: Colors.blue[300]!),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),

          // Cancel button for pending reservations (and confirmed ones > 24h away)
          if (status == 'pending' || (status == 'confirmed' && resDate != null && resDate.difference(DateTime.now()).inHours > 24))
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: OutlinedButton.icon(
                onPressed: () => _showCancelDialog(context, doc.reference),
                icon: const Icon(Icons.cancel_outlined, size: 16),
                label: Text(tr('profile.cancel_reservation')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red[700],
                  side: BorderSide(color: Colors.red[300]!),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text, Color color) {
    return Row(
      children: [
        Icon(icon, size: 15, color: Colors.grey),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: color, fontSize: 13),
          ),
        ),
      ],
    );
  }

  void _showCancelDialog(BuildContext context, DocumentReference ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: Text(tr('profile.cancel_reservation')),
        content: Text(tr('profile.confirm_cancel_reservation')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(tr('common.no')),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.update({'status': 'cancelled'});
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(tr('profile.reservation_cancelled')),
                    backgroundColor: Colors.amber,
                  ),
                );
              }
            },
            child: const Text('Evet, İptal Et', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  _StatusInfo _getStatusInfo(String status) {
    switch (status) {
      case 'confirmed':
        return _StatusInfo(
          label: 'Onaylandı ✓',
          color: Colors.green[700]!,
          bgColor: Colors.green[50]!,
          borderColor: Colors.green,
          icon: Icons.check_circle,
        );
      case 'rejected':
        return _StatusInfo(
          label: 'Reddedildi ✗',
          color: Colors.red[700]!,
          bgColor: Colors.red[50]!,
          borderColor: Colors.red,
          icon: Icons.cancel,
        );
      case 'cancelled':
        return _StatusInfo(
          label: 'İptal',
          color: Colors.grey[700]!,
          bgColor: Colors.grey[100]!,
          borderColor: Colors.grey,
          icon: Icons.block,
        );
      case 'pending':
      default:
        return _StatusInfo(
          label: 'Onay Bekleniyor',
          color: Colors.amber[800]!,
          bgColor: Colors.amber[50]!,
          borderColor: Colors.amber,
          icon: Icons.schedule,
        );
    }
  }

  // ─── Calendar Integration (Native via CalendarService) ───
  // All calendar logic delegated to CalendarService.addReservationEvent()
}

class _StatusInfo {
  final String label;
  final Color color;
  final Color bgColor;
  final Color borderColor;
  final IconData icon;

  _StatusInfo({
    required this.label,
    required this.color,
    required this.bgColor,
    required this.borderColor,
    required this.icon,
  });
}
