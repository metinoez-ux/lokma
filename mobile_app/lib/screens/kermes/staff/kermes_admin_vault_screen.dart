import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../staff/providers/staff_hub_provider.dart';

class KermesAdminVaultScreen extends ConsumerStatefulWidget {
  final bool isEmbedded;
  const KermesAdminVaultScreen({super.key, this.isEmbedded = false});

  @override
  ConsumerState<KermesAdminVaultScreen> createState() => _KermesAdminVaultScreenState();
}

class _KermesAdminVaultScreenState extends ConsumerState<KermesAdminVaultScreen> {
  bool _isLoading = false;

  void _showVaultHandoverQR(double totalAmount, List<String> handoverIds) async {
    final user = FirebaseAuth.instance.currentUser;
    final capabilities = ref.read(staffCapabilitiesProvider);
    if (user == null || capabilities.businessId == null) return;

    if (totalAmount <= 0 || handoverIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Devredilecek bakiye bulunmuyor.')));
      return;
    }

    setState(() => _isLoading = true);
    DocumentReference? aggregateDocRef;
    try {
      final data = {
        'staffId': user.uid,
        'staffName': capabilities.staffName ?? 'Kasa Yöneticisi',
        'businessId': capabilities.businessId,
        'declaredAmount': totalAmount,
        'actualAmount': totalAmount,
        'status': 'pending', 
        'sourceHandoverIds': handoverIds,
        'isAdminToVault': true,
        'createdAt': FieldValue.serverTimestamp(),
      };
      
      aggregateDocRef = await FirebaseFirestore.instance.collection('kermes_cash_handovers').add(data);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
      setState(() => _isLoading = false);
      return;
    }
    setState(() => _isLoading = false);

    if (!mounted || aggregateDocRef == null) return;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return Dialog(
          backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: StreamBuilder<DocumentSnapshot>(
            stream: aggregateDocRef!.snapshots(),
            builder: (ctx2, snapshot) {
              if (snapshot.hasData && snapshot.data!.exists) {
                final data = snapshot.data!.data() as Map<String, dynamic>;
                if (data['status'] == 'completed') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (Navigator.canPop(ctx2)) Navigator.pop(ctx2);
                    _showSuccessDialog(data['adminName'] ?? 'Ana Kasa', data['completedAt'] as Timestamp?, data['actualAmount']);
                  });
                  return const SizedBox();
                } else if (data['status'] == 'cancelled') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (Navigator.canPop(ctx2)) Navigator.pop(ctx2);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Devir işlemi iptal edildi.')));
                  });
                  return const SizedBox();
                }
              }

              return Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Ana Kasaya Devir', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 10),
                    Text(
                      'Lütfen bu kodu Ana Kasa sorumlusuna okutun.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: isDark ? Colors.white70 : Colors.black54),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: QrImageView(
                        data: 'kermes://handover/${aggregateDocRef!.id}',
                        version: QrVersions.auto,
                        size: 200.0,
                        backgroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      '${totalAmount.toStringAsFixed(2)} EUR',
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.blueAccent),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: () => aggregateDocRef!.update({'status': 'cancelled'}),
                        child: const Text('İptal Et', style: TextStyle(color: Colors.red)),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  void _showSuccessDialog(String receiverName, Timestamp? completedAt, dynamic actualAmount) {
    if (!mounted) return;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    String timeStr = completedAt != null ? DateFormat('dd.MM.yyyy HH:mm:ss').format(completedAt.toDate()) : '';

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), shape: BoxShape.circle),
                child: const Icon(Icons.check_circle_rounded, color: Colors.green, size: 50),
              ),
              const SizedBox(height: 20),
              Text('Devredildi!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: isDark ? Colors.white : Colors.black87)),
              const SizedBox(height: 12),
              Text(
                'Kasa devri başarıyla gerçekleştirildi.\n\nTeslim Alan: $receiverName\nZaman: $timeStr\nTutar: ${actualAmount != null ? (actualAmount as num).toStringAsFixed(2) : '-'} EUR',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, color: isDark ? Colors.white70 : Colors.black54, height: 1.5),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Harika', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final capabilities = ref.watch(staffCapabilitiesProvider);
    final businessId = capabilities.businessId;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (user == null || businessId == null) {
      return Scaffold(
        appBar: widget.isEmbedded ? null : AppBar(title: const Text('Kasa & Tahsilat Yönetimi')),
        body: const Center(child: Text('Kullanıcı veya işletme bilgisi eksik.')),
      );
    }

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF8F9FA),
      appBar: widget.isEmbedded ? null : AppBar(
        title: const Text('Kasa Yönetimi'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('kermes_cash_handovers')
            // 1. Get handovers that were received by this admin:
            .where('adminId', isEqualTo: user.uid)
            .where('status', isEqualTo: 'completed')
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Center(child: Text('Hata: ${snapshot.error}'));
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());

          final docs = snapshot.data?.docs ?? [];
          
          // Separate into "held by admin" and "already transferred to vault"
          final List<QueryDocumentSnapshot> unvaulted = [];
          final List<QueryDocumentSnapshot> vaulted = [];
          
          double totalUnvaultedAmount = 0.0;
          List<String> unvaultedIds = [];

          for (final doc in docs) {
            final data = doc.data() as Map<String, dynamic>;
            final isVaulted = data['vaultHandoverId'] != null;
            if (isVaulted) {
              vaulted.add(doc);
            } else {
              unvaulted.add(doc);
              totalUnvaultedAmount += (data['actualAmount'] as num?)?.toDouble() ?? 0.0;
              unvaultedIds.add(doc.id);
            }
          }

          unvaulted.sort((a, b) {
            final tA = (a.data() as Map<String, dynamic>)['completedAt'] as Timestamp?;
            final tB = (b.data() as Map<String, dynamic>)['completedAt'] as Timestamp?;
            if (tA == null || tB == null) return 0;
            return tB.compareTo(tA);
          });

          vaulted.sort((a, b) {
            final tA = (a.data() as Map<String, dynamic>)['completedAt'] as Timestamp?;
            final tB = (b.data() as Map<String, dynamic>)['completedAt'] as Timestamp?;
            if (tA == null || tB == null) return 0;
            return tB.compareTo(tA);
          });

          return CustomScrollView(
            slivers: [
              // Bakiye Özeti
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF2196F3), Color(0xFF1976D2)],
                        begin: Alignment.topLeft, end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(color: Colors.blue.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 5))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Cüzdanınızdaki Nakit Tutar',
                          style: TextStyle(color: Colors.white70, fontSize: 14),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${totalUnvaultedAmount.toStringAsFixed(2)} EUR',
                          style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: totalUnvaultedAmount > 0 
                                ? () => _showVaultHandoverQR(totalUnvaultedAmount, unvaultedIds)
                                : null,
                            icon: const Icon(Icons.qr_code_scanner),
                            label: const Text('Ana Kasaya Teslim Et', style: TextStyle(fontWeight: FontWeight.bold)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: Colors.blueAccent,
                              disabledBackgroundColor: Colors.white.withOpacity(0.3),
                              disabledForegroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // Devredilmeyi Bekleyenler
              if (unvaulted.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: Text('Kasadaki Tahsilatlar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white54 : Colors.black54)),
                  ),
                ),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, index) => _buildHandoverRow(unvaulted[index].data() as Map<String, dynamic>, isDark),
                    childCount: unvaulted.length,
                  ),
                ),
              ],

              // Geçmiş (Devredilenler)
              if (vaulted.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
                    child: Text('Ana Kasaya Devredilenler', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white54 : Colors.black54)),
                  ),
                ),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, index) => _buildHandoverRow(vaulted[index].data() as Map<String, dynamic>, isDark, isVaulted: true),
                    childCount: vaulted.length,
                  ),
                ),
              ],

              const SliverToBoxAdapter(child: SizedBox(height: 60)),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHandoverRow(Map<String, dynamic> data, bool isDark, {bool isVaulted = false}) {
    final staffName = data['staffName'] ?? 'Personel';
    final amount = (data['actualAmount'] as num?)?.toDouble() ?? 0.0;
    final time = (data['completedAt'] as Timestamp?)?.toDate();
    final timeStr = time != null ? DateFormat('dd.MM.yyyy HH:mm', 'tr').format(time) : '';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF252525) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: isVaulted ? Colors.grey.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isVaulted ? Icons.check_circle : Icons.person,
              color: isVaulted ? Colors.grey : Colors.orange,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  staffName,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: isVaulted ? Colors.grey : (isDark ? Colors.white : Colors.black87)),
                ),
                const SizedBox(height: 4),
                Text(
                  timeStr,
                  style: TextStyle(fontSize: 12, color: isDark ? Colors.white38 : Colors.grey),
                ),
              ],
            ),
          ),
          Text(
            '+ ${amount.toStringAsFixed(2)} EUR',
            style: TextStyle(
              fontSize: 16, 
              fontWeight: FontWeight.w900, 
              color: isVaulted ? Colors.grey : Colors.green
            ),
          ),
        ],
      ),
    );
  }
}
