import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../screens/staff/providers/staff_hub_provider.dart';

class HandoverConfirmationDialog extends ConsumerStatefulWidget {
  final String handoverDocId;
  final Map<String, dynamic> handoverData;

  const HandoverConfirmationDialog({
    super.key,
    required this.handoverDocId,
    required this.handoverData,
  });

  @override
  ConsumerState<HandoverConfirmationDialog> createState() => _HandoverConfirmationDialogState();
}

class _HandoverConfirmationDialogState extends ConsumerState<HandoverConfirmationDialog> {
  late TextEditingController _amountController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final declared = (widget.handoverData['declaredAmount'] as num?)?.toDouble() ?? 0.0;
    _amountController = TextEditingController(text: declared.toStringAsFixed(2));
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _confirmHandover() async {
    final actualAmount = double.tryParse(_amountController.text.replaceAll(',', '.')) ?? 0.0;
    if (actualAmount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lütfen geçerli bir tutar girin.')));
      return;
    }

    final capabilities = ref.read(staffCapabilitiesProvider);
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);

    try {
      final db = FirebaseFirestore.instance;
      final batch = db.batch();

      final handoverRef = db.collection('kermes_cash_handovers').doc(widget.handoverDocId);
      
      final isAdminToVault = widget.handoverData['isAdminToVault'] == true;

      batch.update(handoverRef, {
        'status': 'completed',
        'actualAmount': actualAmount,
        'adminId': user.uid,
        'adminName': capabilities.staffName ?? (isAdminToVault ? 'Ana Kasa' : 'Kermes Admin'),
        'completedAt': FieldValue.serverTimestamp(),
      });

      if (isAdminToVault) {
        // This is a Vault Handover. The source isn't orders, it's previous handovers.
        final sourceIds = List<String>.from(widget.handoverData['sourceHandoverIds'] ?? []);
        for (final sourceId in sourceIds) {
          final sourceRef = db.collection('kermes_cash_handovers').doc(sourceId);
          batch.update(sourceRef, {
            'vaultHandoverId': widget.handoverDocId, // Mark as safely transferred to vault
          });
        }
      } else {
        // Normal Staff -> Admin Handover. The source is individual orders.
        final orderIds = List<String>.from(widget.handoverData['orderIds'] ?? []);
        for (final orderId in orderIds) {
          final orderRef = db.collection('kermes_orders').doc(orderId);
          batch.update(orderRef, {
            'settledToRegister': true,
            'handoverId': widget.handoverDocId,
          });
        }
      }

      await batch.commit();

      if (mounted) {
        setState(() => _isLoading = false);
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isAdminToVault ? 'Ana Kasaya devir başarıyla onaylandı!' : 'Tahsilat başarıyla teslim alındı ve onaylandı!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final staffName = widget.handoverData['staffName'] ?? 'Personel';
    final declaredAmount = (widget.handoverData['declaredAmount'] as num?)?.toDouble() ?? 0.0;

    return Dialog(
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), shape: BoxShape.circle),
              child: const Icon(Icons.account_balance_wallet, color: Colors.blueAccent, size: 36),
            ),
            const SizedBox(height: 16),
            Text(
              'Teslimat Onayı',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
            ),
            const SizedBox(height: 16),
            RichText(
              textAlign: TextAlign.center,
              text: TextSpan(
                style: TextStyle(fontSize: 15, color: isDark ? Colors.white70 : Colors.black54, height: 1.4),
                children: [
                  TextSpan(text: staffName, style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: ' adlı personel tahsilat teslim etmek istiyor.'),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? Colors.black26 : Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? Colors.white12 : Colors.grey.shade300),
              ),
              child: Column(
                children: [
                  const Text('Beyan Edilen Tutar', style: TextStyle(fontSize: 13, color: Colors.grey)),
                  const SizedBox(height: 4),
                  Text(
                    '${declaredAmount.toStringAsFixed(2)} EUR',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.orange),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                labelText: 'Gerçek Sayılan Tutar (EUR)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.blueAccent, width: 2)),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _confirmHandover,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _isLoading
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Teslim Aldım', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: _isLoading ? null : () => Navigator.pop(context),
                child: const Text('İptal', style: TextStyle(color: Colors.red)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
