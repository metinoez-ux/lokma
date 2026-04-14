import 'package:qr_flutter/qr_flutter.dart';

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:easy_localization/easy_localization.dart';

class CashDrawerScreen extends StatefulWidget {
  final String kermesId;
  final String staffId;
  final bool isEmbedded;

  const CashDrawerScreen({
    super.key,
    required this.kermesId,
    required this.staffId,
    this.isEmbedded = false,
  });

  @override
  State<CashDrawerScreen> createState() => _CashDrawerScreenState();
}

class _CashDrawerScreenState extends State<CashDrawerScreen> {
  bool _isLoading = true;
  double _pendingCash = 0.0;
  List<DocumentSnapshot> _cashOrders = [];
  DocumentSnapshot? _activeHandover;

  @override
  void initState() {
    super.initState();
    _fetchDrawerStatus();
  }

  Future<void> _fetchDrawerStatus() async {
    setState(() => _isLoading = true);
    try {
      // Fetch latest pending handover for this staff to see if we are blocked
      final pendingSnap = await FirebaseFirestore.instance
          .collection('kermes_cash_handovers')
          .where('kermesId', isEqualTo: widget.kermesId)
          .where('staffId', isEqualTo: widget.staffId)
          .where('status', isEqualTo: 'pending')
          .orderBy('createdAt', descending: true)
          .limit(1)
          .get();

      if (pendingSnap.docs.isNotEmpty) {
        _activeHandover = pendingSnap.docs.first;
      } else {
        _activeHandover = null;
      }

      // Fetch all handed over requests to find the last resolved time
      final acceptedSnap = await FirebaseFirestore.instance
          .collection('kermes_cash_handovers')
          .where('kermesId', isEqualTo: widget.kermesId)
          .where('staffId', isEqualTo: widget.staffId)
          .where('status', isEqualTo: 'completed')
          .orderBy('completedAt', descending: true)
          .limit(1)
          .get();

      Timestamp? lastAcceptedTime;
      if (acceptedSnap.docs.isNotEmpty) {
        lastAcceptedTime = acceptedSnap.docs.first.get('completedAt') as Timestamp;
      }

      // Fetch pending cash from kermes_orders (where createdByStaffId OR collectedByStaffId MATCHES)
      final createdOrdersSnap = await FirebaseFirestore.instance
          .collection('kermes_orders')
          .where('kermesId', isEqualTo: widget.kermesId)
          .where('createdByStaffId', isEqualTo: widget.staffId)
          .where('paymentMethod', isEqualTo: 'cash')
          .get();

      final collectedOrdersSnap = await FirebaseFirestore.instance
          .collection('kermes_orders')
          .where('kermesId', isEqualTo: widget.kermesId)
          .where('collectedByStaffId', isEqualTo: widget.staffId)
          .where('paymentMethod', isEqualTo: 'cash')
          .get();

      final List<DocumentSnapshot> allOrders = [];
      final Set<String> processedIds = {};

      for (var snap in [createdOrdersSnap, collectedOrdersSnap]) {
        for (var doc in snap.docs) {
           if (processedIds.contains(doc.id)) continue;
           processedIds.add(doc.id);
           allOrders.add(doc);
        }
      }

      double total = 0.0;
      List<DocumentSnapshot> activeUnsettledOrders = [];

      for (var doc in allOrders) {
        final data = doc.data() as Map<String, dynamic>;
        final status = data['status'] as String? ?? '';
        if (status == 'cancelled') continue;

        final settledToRegister = data['settledToRegister'] as bool? ?? false;
        
        // If it's already settled to the business, ignore
        if (settledToRegister) continue;

        // If it was created before last handover, and somehow still here, usually shouldn't happen, but just to be safe
        final createdAt = data['createdAt'] as Timestamp?;
        if (lastAcceptedTime != null && createdAt != null) {
           if (createdAt.millisecondsSinceEpoch <= lastAcceptedTime.millisecondsSinceEpoch) {
              continue;
           }
        }

        activeUnsettledOrders.add(doc);
        total += (data['totalAmount'] as num?)?.toDouble() ?? 0.0;
      }

      // Sort by descending time
      activeUnsettledOrders.sort((a, b) {
         final timeA = ((a.data() as Map<String, dynamic>)['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
         final timeB = ((b.data() as Map<String, dynamic>)['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
         return timeB.compareTo(timeA);
      });

      setState(() {
        _cashOrders = activeUnsettledOrders;
        _pendingCash = total;
      });
      
    } catch (e) {
      debugPrint("Error fetching cash drawer: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _submitHandover() async {
    if (_pendingCash <= 0) return;
    
    setState(() => _isLoading = true);
    DocumentReference? docRef;
    try {
      docRef = await FirebaseFirestore.instance.collection('kermes_cash_handovers').add({
        'kermesId': widget.kermesId,
        'staffId': widget.staffId,
        'staffName': 'Personel',
        'adminId': null,
        'actualAmount': _pendingCash,
        'amount': _pendingCash,
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
      
      if (!mounted) return;
      await _fetchDrawerStatus();
      
    } catch (e) {
      debugPrint("Error submitting handover: $e");
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bir hata oluştu, lütfen tekrar deneyiniz.'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }

    if (docRef != null && mounted && _activeHandover != null) {
      _showQRDialog(_activeHandover!);
    }
  }



  void _showQRDialog(DocumentSnapshot handoverDoc) {
    if (!mounted) return;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return Dialog(
          backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: StreamBuilder<DocumentSnapshot>(
            stream: handoverDoc.reference.snapshots(),
            builder: (ctx2, snapshot) {
              if (snapshot.hasData && snapshot.data!.exists) {
                final data = snapshot.data!.data() as Map<String, dynamic>;
                if (data['status'] == 'completed') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (Navigator.canPop(ctx2)) Navigator.pop(ctx2);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Devir işlemi onaylandı!'), backgroundColor: Colors.green),
                    );
                    _fetchDrawerStatus();
                  });
                  return const SizedBox();
                } else if (data['status'] == 'cancelled') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (Navigator.canPop(ctx2)) Navigator.pop(ctx2);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Devir iptal edildi.'), backgroundColor: Colors.red),
                    );
                    _fetchDrawerStatus();
                  });
                  return const SizedBox();
                }
              }

              final amount = handoverDoc['amount'] ?? 0;

              return Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Admine Devir', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 10),
                    Text(
                      'Lütfen bu QR Kodu Kasadan Sorumlu Admine okutun.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: isDark ? Colors.white70 : Colors.black54),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: QrImageView(
                        data: 'kermes://handover/${handoverDoc.id}',
                        version: QrVersions.auto,
                        size: 200.0,
                        backgroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      '${amount} EUR',
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.teal),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: () {
                           handoverDoc.reference.update({'status': 'cancelled'});
                        },
                        child: const Text('Devri İptal Et', style: TextStyle(color: Colors.red)),
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: widget.isEmbedded ? null : AppBar(
        title: const Text('Kasam / Tahsilat'),
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchDrawerStatus,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.teal.withOpacity(0.3), width: 2),
                    ),
                    child: Column(
                      children: [
                        Text(
                          'Teslim Edilmeyen Nakit',
                          style: TextStyle(
                            color: isDark ? Colors.white70 : Colors.black54,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '€${_pendingCash.toStringAsFixed(2)}',
                          style: TextStyle(
                            color: isDark ? Colors.teal.shade400 : Colors.teal.shade600,
                            fontSize: 48,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 24),
                        
                        if (_activeHandover != null)
                          GestureDetector(
                            onTap: () => _showQRDialog(_activeHandover!),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                              decoration: BoxDecoration(
                                color: Colors.yellow.shade900.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.yellow.shade700, width: 1),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.qr_code_scanner, color: Colors.yellow),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      'QR Kodu Göster (€${_activeHandover!['amount']})',
                                      style: const TextStyle(color: Colors.yellow, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else if (_pendingCash > 0)
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _submitHandover,
                              icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
                              label: const Text('QR ile Teslim Et', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.teal.shade600,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          )
                        else
                          const Text('Teslim edilecek bakiye bulunmuyor.', style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 32),
                  Text(
                    'Bekleyen Nakit Satışlar',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  if (_cashOrders.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(20),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text('Nakit satış bulunamadı.', style: TextStyle(color: Colors.grey.shade600)),
                    )
                  else
                    ..._cashOrders.map((doc) {
                      final data = doc.data() as Map<String, dynamic>;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  data['orderNumber'] != null ? 'Sipariş #${data['orderNumber']}' : 'Nakdi Sipariş', 
                                  style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  data['createdAt'] != null ? (data['createdAt'] as Timestamp).toDate().toString().substring(11, 16) : '',
                                  style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                                ),
                              ],
                            ),
                            Text(
                              '€${(data['totalAmount'] as num?)?.toDouble().toStringAsFixed(2) ?? "0.00"}',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.teal.shade400),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                ],
              ),
            ),
    );
  }
}
