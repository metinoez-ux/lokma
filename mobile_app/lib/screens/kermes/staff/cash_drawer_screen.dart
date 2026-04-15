import 'package:qr_flutter/qr_flutter.dart';

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:intl/intl.dart';

import "package:flutter_riverpod/flutter_riverpod.dart";
import "../../staff/providers/staff_hub_provider.dart";

class CashDrawerScreen extends ConsumerStatefulWidget {
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
  ConsumerState<CashDrawerScreen> createState() => _CashDrawerScreenState();
}

class _CashDrawerScreenState extends ConsumerState<CashDrawerScreen> {
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
      final user = FirebaseAuth.instance.currentUser;
      final capabilities = ref.read(staffCapabilitiesProvider);
      final orderIdsSnapshot = _cashOrders.map((doc) => doc.id).toList();
      docRef = await FirebaseFirestore.instance.collection('kermes_cash_handovers').add({
        'businessId': capabilities.businessId,
        'kermesId': widget.kermesId,
        'staffId': widget.staffId,
        'staffName': capabilities.staffName ?? user?.displayName ?? 'Personel',
        'adminId': null,
        'amount': _pendingCash,
        'actualAmount': _pendingCash,
        'declaredAmount': _pendingCash,
        'orderIds': orderIdsSnapshot,
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
      
    } catch (e) {
      debugPrint("Error submitting handover: $e");
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bir hata oluştu, lütfen tekrar deneyiniz.'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }

    // Use docRef directly — do NOT rely on _activeHandover being set yet
    if (docRef != null && mounted) {
      final docSnap = await docRef.get();
      _showQRDialog(docSnap);
      // Reload state in background
      _fetchDrawerStatus();
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

              final _handoverData = handoverDoc.data() as Map<String, dynamic>?;
              final amount = (_handoverData?['amount'] ?? _handoverData?['actualAmount'] ?? _handoverData?['declaredAmount'] ?? 0) as num;

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
                      '${amount.toStringAsFixed(2)} EUR',
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

  void _showHandoverHistory() {
    if (!mounted) return;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          builder: (_, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  // Handle
                  Center(
                    child: Container(
                      margin: const EdgeInsets.only(top: 12),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white24 : Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Row(
                      children: [
                        const Icon(Icons.history_edu, color: Colors.teal, size: 24),
                        const SizedBox(width: 10),
                        Text(
                          'Teslim Geçmişim',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        const Spacer(),
                        IconButton(
                          onPressed: () => Navigator.pop(ctx),
                          icon: Icon(Icons.close, color: isDark ? Colors.white54 : Colors.grey),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: StreamBuilder<QuerySnapshot>(
                      stream: FirebaseFirestore.instance
                          .collection('kermes_cash_handovers')
                          .where('kermesId', isEqualTo: widget.kermesId)
                          .where('staffId', isEqualTo: widget.staffId)
                          .snapshots(),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator(color: Colors.teal));
                        }
                        if (snapshot.hasError) {
                          return Center(child: Text('Hata: ${snapshot.error}', style: const TextStyle(color: Colors.red)));
                        }
                        final docs = snapshot.data?.docs ?? [];
                        if (docs.isEmpty) {
                          return Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.account_balance_wallet_outlined, size: 64, color: isDark ? Colors.white24 : Colors.grey.shade300),
                                const SizedBox(height: 16),
                                Text('Henüz teslim geçmişi yok', style: TextStyle(color: isDark ? Colors.white54 : Colors.grey, fontSize: 16)),
                              ],
                            ),
                          );
                        }

                        // Sort by createdAt desc
                        final sorted = List<QueryDocumentSnapshot>.from(docs)
                          ..sort((a, b) {
                            final at = (a.data() as Map<String, dynamic>)['createdAt'] as Timestamp?;
                            final bt = (b.data() as Map<String, dynamic>)['createdAt'] as Timestamp?;
                            if (at == null || bt == null) return 0;
                            return bt.compareTo(at);
                          });

                        // Summary
                        final completed = sorted.where((d) => (d.data() as Map<String, dynamic>)['status'] == 'completed').toList();
                        final totalCount = completed.length;
                        final totalAmount = completed.fold<double>(0.0, (sum, d) {
                          final data = d.data() as Map<String, dynamic>;
                          return sum + ((data['actualAmount'] ?? data['declaredAmount'] ?? data['amount'] ?? 0) as num).toDouble();
                        });

                        return Column(
                          children: [
                            // Ozet banner
                            Container(
                              margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: isDark
                                      ? [const Color(0xFF1E2E2A), const Color(0xFF1E3A2A)]
                                      : [Colors.teal.shade50, Colors.green.shade50],
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                ),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.teal.withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('Tamamlanan', style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.grey[600])),
                                        const SizedBox(height: 2),
                                        Row(
                                          children: [
                                            const Icon(Icons.check_circle, color: Colors.green, size: 16),
                                            const SizedBox(width: 4),
                                            Text('$totalCount teslim', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(width: 1, height: 36, color: Colors.teal.withOpacity(0.3)),
                                  const SizedBox(width: 16),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text('Toplam Teslim', style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.grey[600])),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${totalAmount.toStringAsFixed(2)} EUR',
                                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.teal),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            // Liste
                            Expanded(
                              child: ListView.separated(
                                controller: scrollController,
                                padding: const EdgeInsets.all(16),
                                itemCount: sorted.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 12),
                                itemBuilder: (ctx2, i) {
                                  final data = sorted[i].data() as Map<String, dynamic>;
                                  final status = data['status'] as String? ?? 'pending';
                                  final amount = ((data['actualAmount'] ?? data['declaredAmount'] ?? data['amount'] ?? 0) as num).toDouble();
                                  final adminName = data['adminName'] as String? ?? 'Bekliyor...';
                                  final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
                                  final dateStr = createdAt != null ? DateFormat('dd.MM.yyyy HH:mm', 'tr').format(createdAt) : '---';

                                  Color sc; String st; IconData si;
                                  switch (status) {
                                    case 'completed': sc = Colors.green; st = 'Teslim Edildi'; si = Icons.check_circle_outline; break;
                                    case 'cancelled': sc = Colors.red; st = 'İptal'; si = Icons.cancel_outlined; break;
                                    default: sc = Colors.orange; st = 'Bekliyor'; si = Icons.pending_actions;
                                  }

                                  return Container(
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF252525) : Colors.grey.shade50,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(color: sc.withOpacity(0.3)),
                                    ),
                                    child: Column(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                          decoration: BoxDecoration(
                                            color: sc.withOpacity(0.07),
                                            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                                          ),
                                          child: Row(
                                            children: [
                                              Icon(si, color: sc, size: 18),
                                              const SizedBox(width: 8),
                                              Text(st, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: sc)),
                                              const Spacer(),
                                              Text(dateStr, style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.grey)),
                                            ],
                                          ),
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  const Text('Teslim Alan', style: TextStyle(fontSize: 11, color: Colors.grey)),
                                                  const SizedBox(height: 2),
                                                  Text(status == 'completed' ? adminName : 'Onay Bekliyor...', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                                                ],
                                              ),
                                              Text('${amount.toStringAsFixed(2)} EUR', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.teal)),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
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
        actions: [
          TextButton.icon(
            onPressed: _showHandoverHistory,
            icon: const Icon(Icons.history_edu, color: Colors.teal, size: 20),
            label: const Text('Geçmiş', style: TextStyle(color: Colors.teal, fontWeight: FontWeight.bold)),
          ),
        ],
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
                                      () {
                                        final d = _activeHandover!.data() as Map<String, dynamic>?;
                                        final a = (d?['amount'] ?? d?['actualAmount'] ?? d?['declaredAmount'] ?? _pendingCash) as num;
                                        return 'QR Kodu Göster (€${a.toStringAsFixed(2)})';
                                      }(),
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Bekleyen Nakit Sat\u0131\u015flar',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      TextButton.icon(
                        onPressed: _showHandoverHistory,
                        icon: const Icon(Icons.history_edu, color: Colors.teal, size: 18),
                        label: const Text('Ge\u00e7mi\u015f', style: TextStyle(color: Colors.teal, fontWeight: FontWeight.bold, fontSize: 13)),
                        style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
                      ),
                    ],
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
                      final items = data['items'] as List<dynamic>? ?? [];
                      final String orderType = data['type'] ?? 'Bilinmiyor';
                      
                      final String? tableSection = data['tableSection'];
                      final String? tableNumber = data['tableNumber'];
                      final String? assignedTezgah = data['assignedTezgah'];

                      String sectionInfo = '';
                      if (tableSection != null && tableSection.isNotEmpty) {
                        sectionInfo = tableSection;
                        if (tableNumber != null && tableNumber.isNotEmpty) {
                          sectionInfo += ' - Masa $tableNumber';
                        }
                      } else if (assignedTezgah != null && assignedTezgah.isNotEmpty) {
                        sectionInfo = 'Tezgah: $assignedTezgah';
                      }
                      
                      // Fallback 1: Urunlerin icindeki prepZone (isimler: Erkekler Bölümü, Kadınlar vb.)
                      if (sectionInfo.isEmpty && items.isNotEmpty) {
                        try {
                          final firstItem = items.first as Map<String, dynamic>;
                          final itemPrepZones = firstItem['prepZone'] as List<dynamic>?;
                          if (itemPrepZones != null && itemPrepZones.isNotEmpty) {
                            sectionInfo = itemPrepZones.first.toString();
                            if (tableNumber != null && tableNumber.isNotEmpty) {
                              sectionInfo += ' - Masa $tableNumber';
                            }
                          }
                        } catch(e) {}
                      }

                      // Fallback 2: Garson/Kasiyer ismi veya sadece Masa No
                      if (sectionInfo.isEmpty) {
                         final waiter = data['assignedWaiterName'] ?? data['createdByStaffName'];
                         if (waiter != null && waiter.toString().isNotEmpty) {
                            sectionInfo = 'Sorumlu: $waiter';
                            if (tableNumber != null && tableNumber.isNotEmpty) {
                              sectionInfo += ' - Masa $tableNumber';
                            }
                         } else if (tableNumber != null && tableNumber.isNotEmpty) {
                            sectionInfo = 'Masa $tableNumber';
                         }
                      }
                      
                      String typeBadgeName = 'Tezgah';
                      Color typeColor = Colors.grey;
                      IconData typeIcon = Icons.storefront;
                      
                      if (orderType.toLowerCase() == 'gel-al' || orderType.toLowerCase() == 'pickup') {
                        typeBadgeName = 'Gel-Al'; typeColor = Colors.orange; typeIcon = Icons.directions_walk;
                      } else if (orderType.toLowerCase() == 'masa' || orderType.toLowerCase() == 'dine-in') {
                        typeBadgeName = 'Masa'; typeColor = Colors.purple; typeIcon = Icons.restaurant;
                      } else if (orderType.toLowerCase() == 'kurye' || orderType.toLowerCase() == 'delivery') {
                        typeBadgeName = 'Kurye'; typeColor = Colors.blue; typeIcon = Icons.two_wheeler;
                      }
                      
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Theme(
                          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                          child: ExpansionTile(
                            tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            title: Row(
                              children: [
                                Text(
                                  data['orderNumber'] != null ? 'Sipariş #${data['orderNumber']}' : 'Nakdi Sipariş', 
                                  style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: typeColor.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(typeIcon, size: 12, color: typeColor),
                                      const SizedBox(width: 4),
                                      Text(typeBadgeName, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: typeColor)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Row(
                                children: [
                                  Text(
                                    data['createdAt'] != null ? (data['createdAt'] as Timestamp).toDate().toString().substring(11, 16) : '',
                                    style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                                  ),
                                  if (sectionInfo.isNotEmpty) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        sectionInfo,
                                        style: TextStyle(color: Colors.grey.shade600, fontSize: 10, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            trailing: Text(
                              '€${(data['totalAmount'] as num?)?.toDouble().toStringAsFixed(2) ?? "0.00"}',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.teal.shade400),
                            ),
                            children: [
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: isDark ? Colors.black26 : Colors.grey.shade50,
                                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                                ),
                                child: items.isEmpty 
                                  ? const Text('Ürün detayı bulunmuyor.', style: TextStyle(color: Colors.grey))
                                  : Column(
                                      children: items.map((prod) {
                                        final p = prod as Map<String, dynamic>;
                                        return Padding(
                                          padding: const EdgeInsets.only(bottom: 8),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  '${p['quantity'] ?? 1}x ${p['name'] ?? p['title'] ?? 'Ürün'}',
                                                  style: TextStyle(color: isDark ? Colors.white70 : Colors.black87, fontSize: 14),
                                                ),
                                              ),
                                              Text(
                                                '€${((p['totalPrice'] ?? p['price'] ?? 0) as num).toDouble().toStringAsFixed(2)}',
                                                style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 14),
                                              ),
                                            ],
                                          ),
                                        );
                                      }).toList(),
                                    ),
                              )
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                ],
              ),
            ),
    );
  }
}
