import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma/theme/lokma_colors.dart';
import '../providers/staff_hub_provider.dart';

class WaiterDeliveriesTab extends ConsumerWidget {
  final String kermesId;
  final String staffId;
  final String staffName;
  final List<String> allowedSections;
  final bool isDark;

  const WaiterDeliveriesTab({
    super.key,
    required this.kermesId,
    required this.staffId,
    required this.staffName,
    required this.allowedSections,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Only fetch orders for masada delivery type and relevant statuses
    // Because 'in' query supports up to 10 elements, we can do whereIn for status
    Query query = FirebaseFirestore.instance
        .collection('kermes_orders')
        .where('kermesId', isEqualTo: kermesId)
        .where('deliveryType', isEqualTo: 'masada')
        .where('status', whereIn: ['ready', 'delivering'])
        .orderBy('createdAt', descending: false);

    return StreamBuilder<QuerySnapshot>(
      stream: query.snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(child: Text('Hata: ${snapshot.error}'));
        }
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        var docs = snapshot.data?.docs ?? [];
        
        // Client-side filtering for sections to avoid complex composite indexes
        if (allowedSections.isNotEmpty) {
          docs = docs.where((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final section = data['tableSection'] as String?;
            return section != null && allowedSections.contains(section);
          }).toList();
        }

        if (docs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_outline, size: 64, color: isDark ? Colors.white38 : Colors.grey.shade400),
                const SizedBox(height: 16),
                Text(
                  'Teslimat bekleyen sipariş yok',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white54 : Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: docs.length,
          itemBuilder: (context, index) {
            return _buildOrderCard(context, docs[index]);
          },
        );
      },
    );
  }

  Widget _buildOrderCard(BuildContext context, DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final orderId = doc.id;
    final orderNumber = data['orderNumber'] ?? '';
    final tableNo = data['tableNo'] ?? '?';
    final tableSection = data['tableSection'] ?? '';
    final status = data['status'] ?? 'ready';
    final assignedWaiterId = data['assignedWaiterId'] as String?;
    final assignedWaiterName = data['assignedWaiterName'] as String?;
    final isMine = assignedWaiterId == staffId;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
        border: Border.all(
          color: isMine ? Colors.green.withOpacity(0.5) : (isDark ? Colors.white10 : Colors.grey.shade200),
          width: isMine ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
              border: Border(bottom: BorderSide(color: isDark ? Colors.white10 : Colors.grey.shade200)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.blueAccent.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '#$orderNumber',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueAccent),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      tableSection.isNotEmpty ? '$tableSection - Masa $tableNo' : 'Masa $tableNo',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ],
                ),
                _buildStatusBadge(status, assignedWaiterName),
              ],
            ),
          ),
          
          // Action Buttons
          Padding(
            padding: const EdgeInsets.all(16),
            child: _buildActionRow(doc, status, assignedWaiterId, assignedWaiterName),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status, String? assignedName) {
    if (status == 'ready') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.orange.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.orange.withOpacity(0.3)),
        ),
        child: const Text(
          'Hazır, Bekliyor',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.orange),
        ),
      );
    } else if (status == 'delivering') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.purple.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.purple.withOpacity(0.3)),
        ),
        child: Text(
          assignedName != null ? '$assignedName Götürüyor' : 'Yolda',
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.purple),
        ),
      );
    }
    return const SizedBox();
  }

  Widget _buildActionRow(DocumentSnapshot doc, String status, String? assignedWaiterId, String? assignedWaiterName) {
    final isMine = assignedWaiterId == staffId;

    if (status == 'ready' && assignedWaiterId == null) {
      return ElevatedButton.icon(
        onPressed: () => _claimOrder(doc.id),
        icon: const Icon(Icons.back_hand, size: 20),
        label: const Text('BEN ÜSTLENDİM', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.green,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } else if (status == 'delivering') {
      if (isMine) {
        return ElevatedButton.icon(
          onPressed: () => _markDelivered(doc.id),
          icon: const Icon(Icons.check_circle, size: 20),
          label: const Text('TESLİM EDİLDİ', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.blueAccent,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      } else {
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.lock_outline, size: 18, color: isDark ? Colors.white54 : Colors.grey),
              const SizedBox(width: 8),
              Text(
                'Bu siparişi $assignedWaiterName üstlendi',
                style: TextStyle(
                  color: isDark ? Colors.white54 : Colors.grey.shade600,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        );
      }
    }
    return const SizedBox();
  }

  Future<void> _claimOrder(String orderId) async {
    try {
      await FirebaseFirestore.instance.collection('kermes_orders').doc(orderId).update({
        'status': 'delivering',
        'assignedWaiterId': staffId,
        'assignedWaiterName': staffName,
        'waiterAssignedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      // Personel order count'u arttır
      final staffDocId = '${kermesId}__$staffId';
      await FirebaseFirestore.instance.collection('kermes_staff_status').doc(staffDocId).set({
        'currentOrderCount': FieldValue.increment(1),
        'lastAssignedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Claim order error: $e');
    }
  }

  Future<void> _markDelivered(String orderId) async {
    try {
      await FirebaseFirestore.instance.collection('kermes_orders').doc(orderId).update({
        'status': 'delivered',
        'deliveredAt': FieldValue.serverTimestamp(),
        'completedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      // Personel order count'u azalt
      final staffDocId = '${kermesId}__$staffId';
      await FirebaseFirestore.instance.collection('kermes_staff_status').doc(staffDocId).set({
        'currentOrderCount': FieldValue.increment(-1),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Mark delivered error: $e');
    }
  }
}
