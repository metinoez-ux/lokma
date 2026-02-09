import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';

/// Staff Reservations Screen - Business staff can view and manage reservations
class StaffReservationsScreen extends StatefulWidget {
  const StaffReservationsScreen({super.key});

  @override
  State<StaffReservationsScreen> createState() => _StaffReservationsScreenState();
}

class _StaffReservationsScreenState extends State<StaffReservationsScreen> {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  String? _businessId;
  String? _businessName;
  String? _staffName;
  bool _loading = true;
  int _maxTables = 0;
  String _dateFilter = 'today'; // today, tomorrow, week, all
  String _statusFilter = 'all'; // all, pending, confirmed, rejected, cancelled

  @override
  void initState() {
    super.initState();
    _loadStaffInfo();
  }

  Future<void> _loadStaffInfo() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      // Check admins collection for business assignment
      final adminDoc = await _db.collection('admins').doc(user.uid).get();
      if (adminDoc.exists) {
        final data = adminDoc.data()!;
        final staffName = data['name'] ?? data['displayName'] ?? 'Personel';

        // Priority 1: Check assignedBusinesses array for reservation-capable business
        final assigned = data['assignedBusinesses'] as List<dynamic>?;
        if (assigned != null && assigned.isNotEmpty) {
          for (final id in assigned) {
            final bizDoc = await _db.collection('businesses').doc(id.toString()).get();
            if (bizDoc.exists && bizDoc.data()?['hasReservation'] == true) {
              if (mounted) {
                setState(() {
                  _businessId = id.toString();
                  _businessName = bizDoc.data()?['companyName'] ?? bizDoc.data()?['name'] ?? 'İşletme';
                  _maxTables = bizDoc.data()?['maxReservationTables'] as int? ?? 0;
                  _staffName = staffName;
                  _loading = false;
                });
              }
              return;
            }
          }
        }

        // Priority 2: Check direct businessId / butcherId
        final bizId = data['businessId'] ?? data['butcherId'];
        if (bizId != null) {
          final bizDoc = await _db.collection('businesses').doc(bizId).get();
          if (bizDoc.exists && bizDoc.data()?['hasReservation'] == true) {
            if (mounted) {
              setState(() {
                _businessId = bizId;
                _businessName = bizDoc.data()?['companyName'] ?? bizDoc.data()?['name'] ?? 'İşletme';
                _maxTables = bizDoc.data()?['maxReservationTables'] as int? ?? 0;
                _staffName = staffName;
                _loading = false;
              });
            }
            return;
          }
        }
      }

      // Check butcher_admins collection as fallback
      final butcherAdmins = await _db.collection('butcher_admins')
          .where('userId', isEqualTo: user.uid)
          .limit(1)
          .get();
      
      if (butcherAdmins.docs.isNotEmpty) {
        final data = butcherAdmins.docs.first.data();
        final bizId = data['businessId'] ?? data['butcherId'];
        if (bizId != null) {
          final bizDoc = await _db.collection('businesses').doc(bizId).get();
          if (mounted) {
            setState(() {
              _businessId = bizId;
              _businessName = bizDoc.data()?['companyName'] ?? 'İşletme';
              _maxTables = bizDoc.data()?['maxReservationTables'] as int? ?? 0;
              _staffName = data['name'] ?? 'Personel';
              _loading = false;
            });
          }
          return;
        }
      }

      if (mounted) {
        setState(() => _loading = false);
      }
    } catch (e) {
      debugPrint('[StaffReservations] Error loading staff info: $e');
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  /// Get date range for query
  (DateTime, DateTime) _getDateRange() {
    final now = DateTime.now();
    DateTime start = DateTime(now.year, now.month, now.day);
    DateTime end = DateTime(now.year, now.month, now.day, 23, 59, 59);

    switch (_dateFilter) {
      case 'tomorrow':
        start = start.add(const Duration(days: 1));
        end = end.add(const Duration(days: 1));
        break;
      case 'week':
        end = end.add(const Duration(days: 7));
        break;
      case 'all':
        start = DateTime(2020);
        end = DateTime(2030);
        break;
    }
    return (start, end);
  }

  /// Get reservation stream
  Stream<QuerySnapshot> _getReservationsStream() {
    if (_businessId == null) return const Stream.empty();

    final (start, end) = _getDateRange();
    
    return _db
        .collection('businesses')
        .doc(_businessId)
        .collection('reservations')
        .where('reservationDate', isGreaterThanOrEqualTo: Timestamp.fromDate(start))
        .where('reservationDate', isLessThanOrEqualTo: Timestamp.fromDate(end))
        .orderBy('reservationDate', descending: false)
        .snapshots();
  }

  /// Get card numbers already assigned to active (confirmed) reservations
  Future<Set<int>> _getOccupiedCardNumbers() async {
    if (_businessId == null) return {};
    try {
      final snap = await _db
          .collection('businesses')
          .doc(_businessId)
          .collection('reservations')
          .where('status', isEqualTo: 'confirmed')
          .get();
      final occupied = <int>{};
      for (final doc in snap.docs) {
        final data = doc.data();
        final cards = data['tableCardNumbers'];
        if (cards is List) {
          for (final c in cards) {
            if (c is int) occupied.add(c);
            if (c is num) occupied.add(c.toInt());
          }
        }
      }
      return occupied;
    } catch (e) {
      debugPrint('[StaffReservations] Error fetching occupied cards: $e');
      return {};
    }
  }

  /// Show card number selection bottom sheet
  Future<List<int>?> _showCardSelectionModal() async {
    if (_maxTables <= 0) {
      // No tables configured, skip card selection
      return [];
    }

    final occupied = await _getOccupiedCardNumbers();
    final selected = <int>{};

    return showModalBottomSheet<List<int>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle bar
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 16),
                // Title
                const Text(
                  '🃏 Masa Kart Numarası Seçin',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'Müşteriye verilecek masa kartını seçin',
                  style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                ),
                const SizedBox(height: 6),
                // Legend
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _legendDot(Colors.green, 'Seçili'),
                    const SizedBox(width: 16),
                    _legendDot(Colors.grey[300]!, 'Boş'),
                    const SizedBox(width: 16),
                    _legendDot(Colors.red[200]!, 'Dolu'),
                  ],
                ),
                const SizedBox(height: 16),
                // Grid of card numbers
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 5,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                  ),
                  itemCount: _maxTables,
                  itemBuilder: (ctx, idx) {
                    final num = idx + 1;
                    final isOccupied = occupied.contains(num);
                    final isSelected = selected.contains(num);

                    return GestureDetector(
                      onTap: isOccupied
                          ? null
                          : () {
                              setModalState(() {
                                if (isSelected) {
                                  selected.remove(num);
                                } else {
                                  selected.add(num);
                                }
                              });
                              HapticFeedback.selectionClick();
                            },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        decoration: BoxDecoration(
                          color: isOccupied
                              ? Colors.red[50]
                              : isSelected
                                  ? Colors.green
                                  : Colors.grey[100],
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isOccupied
                                ? Colors.red[200]!
                                : isSelected
                                    ? Colors.green[700]!
                                    : Colors.grey[300]!,
                            width: isSelected ? 2.5 : 1.5,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: Colors.green.withOpacity(0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  )
                                ]
                              : null,
                        ),
                        child: Center(
                          child: Text(
                            '$num',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: isOccupied
                                  ? Colors.red[300]
                                  : isSelected
                                      ? Colors.white
                                      : Colors.grey[800],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 20),
                // Action buttons
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, null),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: const Text('İptal'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        onPressed: selected.isEmpty
                            ? null
                            : () {
                                final sorted = selected.toList()..sort();
                                Navigator.pop(ctx, sorted);
                              },
                        icon: const Icon(Icons.check_circle, size: 18),
                        label: Text(
                          selected.isEmpty
                              ? 'Numara Seçin'
                              : 'Onayla (${selected.length} masa)',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: MediaQuery.of(ctx).padding.bottom + 8),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: Colors.grey[400]!, width: 0.5),
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
      ],
    );
  }

  /// Update reservation status
  Future<void> _updateStatus(String reservationId, String newStatus) async {
    if (_businessId == null) return;

    // For confirmation → show card number selection first
    if (newStatus == 'confirmed') {
      final cardNumbers = await _showCardSelectionModal();
      if (cardNumbers == null) return; // User cancelled

      try {
        await _db
            .collection('businesses')
            .doc(_businessId)
            .collection('reservations')
            .doc(reservationId)
            .update({
          'status': 'confirmed',
          'confirmedBy': _staffName ?? 'Personel',
          'tableCardNumbers': cardNumbers,
          'tableCardAssignedBy': _staffName ?? 'Personel',
          'tableCardAssignedAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });

        if (mounted) {
          HapticFeedback.mediumImpact();
          final cardStr = cardNumbers.isNotEmpty
              ? ' (Masa ${cardNumbers.join(", ")})'
              : '';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✅ Rezervasyon onaylandı!$cardStr'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        debugPrint('[StaffReservations] Error confirming: $e');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Hata oluştu. Tekrar deneyin.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
      return;
    }

    // For reject/cancel — simple confirmation dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(newStatus == 'rejected' ? '❌ Reddet' : '🚫 İptal Et'),
        content: Text(
          newStatus == 'rejected'
              ? 'Bu rezervasyonu reddetmek istediğinize emin misiniz?'
              : 'Bu rezervasyonu iptal etmek istediğinize emin misiniz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            child: Text(
              newStatus == 'rejected' ? 'Reddet' : 'İptal Et',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final updateData = <String, dynamic>{
        'status': newStatus,
        'confirmedBy': _staffName ?? 'Personel',
        'updatedAt': FieldValue.serverTimestamp(),
      };
      // Clear card numbers if cancelling
      if (newStatus == 'cancelled') {
        updateData['tableCardNumbers'] = FieldValue.delete();
        updateData['tableCardAssignedBy'] = FieldValue.delete();
        updateData['tableCardAssignedAt'] = FieldValue.delete();
      }

      await _db
          .collection('businesses')
          .doc(_businessId)
          .collection('reservations')
          .doc(reservationId)
          .update(updateData);

      if (mounted) {
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              newStatus == 'rejected'
                  ? '❌ Rezervasyon reddedildi.'
                  : '🚫 Rezervasyon iptal edildi.',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      debugPrint('[StaffReservations] Error updating status: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Hata oluştu. Tekrar deneyin.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Call customer
  void _callCustomer(String? phone) {
    if (phone == null || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Telefon numarası bulunamadı')),
      );
      return;
    }
    launchUrl(Uri.parse('tel:$phone'));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : const Color(0xFFF7F7F7);

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Rezervasyonlar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
            if (_businessName != null)
              Text(
                _businessName!,
                style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.7), fontWeight: FontWeight.w400),
              ),
          ],
        ),
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : const Color(0xFF2D2D2D),
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: isDark ? Colors.white54 : const Color(0xFF2D2D2D)))
          : _businessId == null
              ? _buildNoBusinessView()
              : Column(
                  children: [
                    _buildFilters(isDark),
                    Expanded(child: _buildReservationsList(isDark)),
                  ],
                ),
    );
  }

  Widget _buildNoBusinessView() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.store_outlined, size: 64, color: isDark ? Colors.white24 : Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            'İşletme bulunamadı',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : Colors.black87),
          ),
          const SizedBox(height: 6),
          Text(
            'Bir işletmeye atanmış olmanız gerekiyor',
            style: TextStyle(fontSize: 14, color: isDark ? Colors.white38 : Colors.grey.shade500),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters(bool isDark) {
    final surfaceBg = isDark ? const Color(0xFF1A1A1A) : Colors.white;
    final divider = isDark ? Colors.white.withOpacity(0.06) : Colors.black.withOpacity(0.06);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: surfaceBg,
        border: Border(bottom: BorderSide(color: divider)),
      ),
      child: Column(
        children: [
          // Date filters
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('Bugün', 'today', _dateFilter, (v) => setState(() => _dateFilter = v)),
                _buildFilterChip('Yarın', 'tomorrow', _dateFilter, (v) => setState(() => _dateFilter = v)),
                _buildFilterChip('Bu Hafta', 'week', _dateFilter, (v) => setState(() => _dateFilter = v)),
                _buildFilterChip('Tümü', 'all', _dateFilter, (v) => setState(() => _dateFilter = v)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Status filters
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('Tümü', 'all', _statusFilter, (v) => setState(() => _statusFilter = v), isStatus: true),
                _buildFilterChip('Bekleyen', 'pending', _statusFilter, (v) => setState(() => _statusFilter = v), isStatus: true),
                _buildFilterChip('Onaylı', 'confirmed', _statusFilter, (v) => setState(() => _statusFilter = v), isStatus: true),
                _buildFilterChip('Red', 'rejected', _statusFilter, (v) => setState(() => _statusFilter = v), isStatus: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, String currentValue, Function(String) onTap, {bool isStatus = false}) {
    final isSelected = currentValue == value;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Modern monochrome design — selected pill vs ghost pill
    final selectedBg = isDark ? Colors.white : const Color(0xFF2D2D2D);
    final selectedText = isDark ? Colors.black : Colors.white;
    final unselectedBg = Colors.transparent;
    final unselectedText = isDark ? Colors.white54 : Colors.grey.shade600;
    final borderColor = isDark ? Colors.white12 : Colors.grey.shade300;

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap(value);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: isSelected ? selectedBg : unselectedBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isSelected ? selectedBg : borderColor, width: 1),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? selectedText : unselectedText,
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildReservationsList(bool isDark) {
    return StreamBuilder<QuerySnapshot>(
      stream: _getReservationsStream(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator(color: isDark ? Colors.white38 : Colors.grey.shade400));
        }

        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.calendar_today_outlined, size: 56, color: isDark ? Colors.white24 : Colors.grey.shade300),
                const SizedBox(height: 16),
                Text(
                  'Rezervasyon bulunamadı',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? Colors.white60 : Colors.black54),
                ),
                const SizedBox(height: 6),
                Text(
                  _dateFilter == 'today' ? 'Bugün için rezervasyon yok' : 'Seçili tarih aralığında rezervasyon yok',
                  style: TextStyle(fontSize: 13, color: isDark ? Colors.white30 : Colors.grey.shade500),
                ),
              ],
            ),
          );
        }

        // Filter by status client-side
        final allDocs = snapshot.data!.docs;
        final filteredDocs = _statusFilter == 'all'
            ? allDocs
            : allDocs.where((doc) {
                final data = doc.data() as Map<String, dynamic>;
                return data['status'] == _statusFilter;
              }).toList();

        if (filteredDocs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.filter_list_off_outlined, size: 48, color: isDark ? Colors.white24 : Colors.grey.shade300),
                const SizedBox(height: 12),
                Text('Bu filtrelerle rezervasyon yok', style: TextStyle(fontSize: 14, color: isDark ? Colors.white38 : Colors.grey.shade500)),
              ],
            ),
          );
        }

        // Group by status - show pending first
        final pending = filteredDocs.where((d) => (d.data() as Map)['status'] == 'pending').toList();
        final confirmed = filteredDocs.where((d) => (d.data() as Map)['status'] == 'confirmed').toList();
        final others = filteredDocs.where((d) {
          final s = (d.data() as Map)['status'];
          return s != 'pending' && s != 'confirmed';
        }).toList();

        final sortedDocs = [...pending, ...confirmed, ...others];

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          itemCount: sortedDocs.length,
          itemBuilder: (context, index) {
            final doc = sortedDocs[index];
            final data = doc.data() as Map<String, dynamic>;
            return _buildReservationCard(doc.id, data, isDark);
          },
        );
      },
    );
  }

  Widget _buildReservationCard(String id, Map<String, dynamic> data, bool isDark) {
    final status = data['status'] ?? 'pending';
    final customerName = data['customerName'] ?? 'Misafir';
    final customerPhone = data['customerPhone'] as String?;
    final partySize = data['partySize'] ?? 1;
    final timeSlot = data['timeSlot'] ?? '';
    final notes = data['notes'] as String?;
    final confirmedBy = data['confirmedBy'] as String?;
    final tableCardNumbers = (data['tableCardNumbers'] as List?)?.map((e) => e is int ? e : (e as num?)?.toInt()).whereType<int>().toList() ?? [];

    // Parse reservation date
    String dateStr = '';
    DateTime? resDate;
    if (data['reservationDate'] is Timestamp) {
      resDate = (data['reservationDate'] as Timestamp).toDate();
      dateStr = '${resDate.day.toString().padLeft(2, '0')}.${resDate.month.toString().padLeft(2, '0')}.${resDate.year}';
    }

    // Time display
    final timeDisplay = timeSlot.isNotEmpty 
        ? timeSlot 
        : (resDate != null ? '${resDate.hour.toString().padLeft(2, '0')}:${resDate.minute.toString().padLeft(2, '0')}' : '-');

    // Status styling — minimal colored dot + text
    Color statusDotColor;
    String statusText;
    switch (status) {
      case 'confirmed':
        statusDotColor = const Color(0xFF34C759);
        statusText = 'Onaylı';
        break;
      case 'rejected':
        statusDotColor = const Color(0xFFFF3B30);
        statusText = 'Reddedildi';
        break;
      case 'cancelled':
        statusDotColor = Colors.grey;
        statusText = 'İptal';
        break;
      default:
        statusDotColor = const Color(0xFFFF9500);
        statusText = 'Beklemede';
    }

    // Card colors
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.white54 : Colors.grey.shade600;
    final borderColor = status == 'pending'
        ? (isDark ? const Color(0xFFFF9500).withOpacity(0.4) : const Color(0xFFFF9500).withOpacity(0.3))
        : (isDark ? Colors.white.withOpacity(0.08) : Colors.grey.shade200);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: status == 'pending' ? 1.5 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: Status + Date
            Row(
              children: [
                // Status dot + text
                Container(
                  width: 8, height: 8,
                  decoration: BoxDecoration(color: statusDotColor, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Text(statusText, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: statusDotColor)),
                if (confirmedBy != null && status != 'pending') ...[
                  Text(' · ', style: TextStyle(color: textSecondary, fontSize: 12)),
                  Text(confirmedBy, style: TextStyle(fontSize: 11, color: textSecondary)),
                ],
                const Spacer(),
                Text(dateStr, style: TextStyle(fontSize: 12, color: textSecondary, fontWeight: FontWeight.w500)),
              ],
            ),
            const SizedBox(height: 12),

            // Row 2: Customer name + phone action
            Row(
              children: [
                Expanded(
                  child: Text(
                    customerName,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17, color: textPrimary, letterSpacing: -0.2),
                  ),
                ),
                if (customerPhone != null && customerPhone.isNotEmpty)
                  GestureDetector(
                    onTap: () => _callCustomer(customerPhone),
                    child: Icon(Icons.phone_outlined, size: 20, color: textSecondary),
                  ),
              ],
            ),
            const SizedBox(height: 10),

            // Row 3: Time · Party size · Table (compact inline)
            Row(
              children: [
                Icon(Icons.schedule, size: 15, color: textSecondary),
                const SizedBox(width: 4),
                Text(timeDisplay, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: textPrimary)),
                Text('  ·  ', style: TextStyle(color: textSecondary, fontSize: 14)),
                Icon(Icons.people_outline, size: 15, color: textSecondary),
                const SizedBox(width: 4),
                Text('$partySize kişi', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: textPrimary)),
                // Table numbers inline
                if (status == 'confirmed' && tableCardNumbers.isNotEmpty) ...[
                  Text('  ·  ', style: TextStyle(color: textSecondary, fontSize: 14)),
                  Icon(Icons.table_restaurant_outlined, size: 15, color: textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    'Masa ${tableCardNumbers.join(', ')}',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: textPrimary),
                  ),
                ],
              ],
            ),

            // Notes (if any) — subtle italic
            if (notes != null && notes.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                notes,
                style: TextStyle(fontSize: 13, color: textSecondary, fontStyle: FontStyle.italic),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],

            // Action buttons — only for actionable states
            if (status == 'pending') ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 40,
                      child: ElevatedButton(
                        onPressed: () => _updateStatus(id, 'confirmed'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF34C759),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Onayla', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: SizedBox(
                      height: 40,
                      child: OutlinedButton(
                        onPressed: () => _updateStatus(id, 'rejected'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFFF3B30),
                          side: BorderSide(color: const Color(0xFFFF3B30).withOpacity(0.4)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Reddet', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      ),
                    ),
                  ),
                ],
              ),
            ],

            // Cancel — subtle text button for confirmed
            if (status == 'confirmed') ...[
              const SizedBox(height: 10),
              Center(
                child: TextButton(
                  onPressed: () => _updateStatus(id, 'cancelled'),
                  child: Text(
                    'İptal Et',
                    style: TextStyle(color: textSecondary, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
