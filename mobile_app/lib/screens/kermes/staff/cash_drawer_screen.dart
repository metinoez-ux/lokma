import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:easy_localization/easy_localization.dart';

class CashDrawerScreen extends StatefulWidget {
  final String kermesId;
  final String staffId;

  const CashDrawerScreen({
    super.key,
    required this.kermesId,
    required this.staffId,
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
          .where('status', isEqualTo: 'PENDING')
          .orderBy('createdAt', descending: true)
          .limit(1)
          .get();

      if (pendingSnap.docs.isNotEmpty) {
        _activeHandover = pendingSnap.docs.first;
      } else {
        _activeHandover = null;
      }

      // Fetch all handed over requests to find the last resolved (ACCEPTED) time.
      final acceptedSnap = await FirebaseFirestore.instance
          .collection('kermes_cash_handovers')
          .where('kermesId', isEqualTo: widget.kermesId)
          .where('staffId', isEqualTo: widget.staffId)
          .where('status', isEqualTo: 'ACCEPTED')
          .orderBy('resolvedAt', descending: true)
          .limit(1)
          .get();

      Timestamp? lastAcceptedTime;
      if (acceptedSnap.docs.isNotEmpty) {
        lastAcceptedTime = acceptedSnap.docs.first.get('resolvedAt') as Timestamp;
      }

      // Now fetch Cash Orders created by this staff after lastAcceptedTime
      Query ordersQuery = FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .collection('product_sales')
          .where('staffId', isEqualTo: widget.staffId)
          .where('paymentMethod', isEqualTo: 'CASH');

      if (lastAcceptedTime != null) {
        ordersQuery = ordersQuery.where('soldAt', isGreaterThan: lastAcceptedTime);
      }

      final ordersSnap = await ordersQuery.get();
      
      double total = 0;
      for (var doc in ordersSnap.docs) {
        final data = doc.data() as Map<String, dynamic>;
        total += (data['totalPrice'] ?? data['price'] ?? 0);
      }

      setState(() {
        _cashOrders = ordersSnap.docs;
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
    try {
      final docRef = await FirebaseFirestore.instance.collection('kermes_cash_handovers').add({
        'kermesId': widget.kermesId,
        'staffId': widget.staffId,
        'adminId': null,
        'amount': _pendingCash,
        'status': 'PENDING',
        'createdAt': FieldValue.serverTimestamp(),
      });
      
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Teslimat talebi admine gönderildi.'), backgroundColor: Colors.green),
      );
      
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
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
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
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                            decoration: BoxDecoration(
                              color: Colors.yellow.shade900.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.access_time_filled, color: Colors.yellow),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Admin Onayı Bekleniyor (€${_activeHandover!['amount']})',
                                    style: const TextStyle(color: Colors.yellow, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ],
                            ),
                          )
                        else if (_pendingCash > 0)
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _submitHandover,
                              icon: const Icon(Icons.send, color: Colors.white),
                              label: const Text('Admine Teslim Et', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
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
                                Text(data['productName'] ?? 'Sipariş', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                                const SizedBox(height: 4),
                                Text(
                                  data['soldAt'] != null ? (data['soldAt'] as Timestamp).toDate().toString().substring(11, 16) : '',
                                  style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                                ),
                              ],
                            ),
                            Text(
                              '€${(data['totalPrice'] ?? data['price'] ?? 0).toStringAsFixed(2)}',
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
