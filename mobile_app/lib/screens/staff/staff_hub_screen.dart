import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/driver_provider.dart';
import '../../services/table_session_service.dart';
import '../../services/order_service.dart';
import '../../services/shift_service.dart';

/// Unified Staff Hub — Personel Girişi
/// Shows available staff functions based on the user's role:
/// - Teslimatlar (Deliveries) — if user is driver
/// - Rezervasyonlar (Reservations) — if assigned business has reservations
/// - Future: Sipariş Al (Take Orders) — for waiters
class StaffHubScreen extends ConsumerStatefulWidget {
  const StaffHubScreen({super.key});

  @override
  ConsumerState<StaffHubScreen> createState() => _StaffHubScreenState();
}

class _StaffHubScreenState extends ConsumerState<StaffHubScreen> {
  bool _isLoading = true;
  bool _isDriver = false;
  bool _hasReservation = false;
  String _staffName = '';
  String _businessName = '';
  String? _businessId;
  int _assignedBusinessCount = 0;
  int _maxTables = 20; // default
  List<int> _assignedTables = []; // waiter's assigned tables

  // Live counters
  int _pendingReservations = 0;
  int _activeTableSessions = 0;

  // Services for table dashboard
  final _sessionService = TableSessionService();
  final _orderService = OrderService();

  // ── Shift Management ──
  final _shiftService = ShiftService();
  Timer? _shiftTimer;
  Duration _shiftElapsed = Duration.zero;
  bool _shiftLoading = false; // for async button states

  @override
  void initState() {
    super.initState();
    _loadCapabilities();
    _restoreShift();
  }

  @override
  void dispose() {
    _shiftTimer?.cancel();
    super.dispose();
  }

  // ── Shift lifecycle methods ──

  Future<void> _restoreShift() async {
    await _shiftService.restoreShiftState();
    if (_shiftService.isOnShift && _shiftService.shiftStartedAt != null) {
      _startTimerFromExisting();
    }
    if (mounted) setState(() {});
  }

  void _startTimerFromExisting() {
    _shiftTimer?.cancel();
    _shiftElapsed = DateTime.now().difference(_shiftService.shiftStartedAt!);
    _shiftTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_shiftService.shiftStatus == 'active') {
        if (mounted) setState(() => _shiftElapsed += const Duration(seconds: 1));
      }
    });
  }

  void _startTimerFresh() {
    _shiftTimer?.cancel();
    _shiftElapsed = Duration.zero;
    _shiftTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_shiftService.shiftStatus == 'active') {
        if (mounted) setState(() => _shiftElapsed += const Duration(seconds: 1));
      }
    });
  }

  Future<void> _handleStartShift() async {
    if (_businessId == null) return;
    // Show table selection
    final selectedTables = await _showTableSelectionSheet();
    if (selectedTables == null) return; // user cancelled

    setState(() => _shiftLoading = true);
    HapticFeedback.heavyImpact();

    final shiftId = await _shiftService.startShift(
      businessId: _businessId!,
      staffName: _staffName,
      tables: selectedTables,
    );

    if (shiftId != null) {
      _startTimerFresh();
    }

    if (mounted) setState(() => _shiftLoading = false);
  }

  Future<void> _handlePauseShift() async {
    setState(() => _shiftLoading = true);
    HapticFeedback.mediumImpact();
    await _shiftService.pauseShift();
    if (mounted) setState(() => _shiftLoading = false);
  }

  Future<void> _handleResumeShift() async {
    setState(() => _shiftLoading = true);
    HapticFeedback.mediumImpact();
    await _shiftService.resumeShift();
    if (mounted) setState(() => _shiftLoading = false);
  }

  Future<void> _handleEndShift() async {
    // Confirm dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Vardiyayı Bitir'),
        content: const Text('Vardiyayı sonlandırmak istediğinize emin misiniz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('İptal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Bitir'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _shiftLoading = true);
    HapticFeedback.heavyImpact();

    final summary = await _shiftService.endShift();
    _shiftTimer?.cancel();
    _shiftElapsed = Duration.zero;

    if (mounted) {
      setState(() => _shiftLoading = false);
      if (summary != null) {
        _showShiftSummaryDialog(summary);
      }
    }
  }

  Future<List<int>?> _showTableSelectionSheet() async {
    final Set<int> selected = Set<int>.from(_assignedTables);
    final max = _maxTables;

    return showModalBottomSheet<List<int>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final isDark = Theme.of(ctx).brightness == Brightness.dark;
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(ctx).size.height * 0.7,
              ),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle bar
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        const Text(
                          'Masa Seçimi',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Bu vardiyada servis yapacağınız masaları seçin',
                          style: TextStyle(fontSize: 13, color: Colors.grey[500]),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        // Quick actions
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            TextButton.icon(
                              onPressed: () => setSheetState(() {
                                selected.clear();
                                for (int i = 1; i <= max; i++) selected.add(i);
                              }),
                              icon: const Icon(Icons.select_all, size: 16),
                              label: const Text('Tümü', style: TextStyle(fontSize: 12)),
                            ),
                            const SizedBox(width: 8),
                            TextButton.icon(
                              onPressed: () => setSheetState(() => selected.clear()),
                              icon: const Icon(Icons.deselect, size: 16),
                              label: const Text('Temizle', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Table grid
                  Flexible(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: GridView.builder(
                        shrinkWrap: true,
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 5,
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                        ),
                        itemCount: max,
                        itemBuilder: (_, i) {
                          final tableNum = i + 1;
                          final isSelected = selected.contains(tableNum);
                          return GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setSheetState(() {
                                if (isSelected) {
                                  selected.remove(tableNum);
                                } else {
                                  selected.add(tableNum);
                                }
                              });
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? const Color(0xFFFB335B)
                                    : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[100]),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected
                                      ? const Color(0xFFFB335B)
                                      : Colors.grey.withOpacity(0.3),
                                  width: isSelected ? 2 : 1,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  '$tableNum',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: isSelected
                                        ? Colors.white
                                        : (isDark ? Colors.white70 : Colors.black87),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  // Confirm button
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton(
                        onPressed: selected.isEmpty
                            ? null
                            : () => Navigator.pop(ctx, selected.toList()..sort()),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFFB335B),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Text(
                          selected.isEmpty
                              ? 'Masa seçin'
                              : 'Vardiyayı Başlat (${selected.length} masa)',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: MediaQuery.of(ctx).padding.bottom),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showShiftSummaryDialog(Map<String, dynamic> summary) {
    final totalMin = summary['totalMinutes'] as int? ?? 0;
    final pauseMin = summary['pauseMinutes'] as int? ?? 0;
    final activeMin = summary['activeMinutes'] as int? ?? 0;
    final tables = summary['assignedTables'] as List<int>? ?? [];
    final orphans = summary['orphanTables'] as List<int>? ?? [];
    final startedAt = summary['startedAt'] as DateTime?;
    final endedAt = summary['endedAt'] as DateTime?;

    String formatDuration(int mins) {
      final h = mins ~/ 60;
      final m = mins % 60;
      if (h > 0) return '${h}s ${m}dk';
      return '${m}dk';
    }

    String formatTime(DateTime? dt) {
      if (dt == null) return '-';
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.green.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle, color: Colors.green, size: 24),
            ),
            const SizedBox(width: 12),
            const Text('Vardiya Tamamlandı'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _summaryRow('⏰', 'Başlangıç', formatTime(startedAt)),
            _summaryRow('🏁', 'Bitiş', formatTime(endedAt)),
            const Divider(height: 20),
            _summaryRow('💪', 'Çalışma Süresi', formatDuration(activeMin)),
            _summaryRow('☕', 'Mola Süresi', formatDuration(pauseMin)),
            _summaryRow('📋', 'Toplam', formatDuration(totalMin)),
            if (tables.isNotEmpty) ...[
              const Divider(height: 20),
              _summaryRow('🪑', 'Masalar', tables.join(', ')),
            ],
            if (orphans.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.orange.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.orange.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber, color: Colors.orange, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Sahipsiz masalar: ${orphans.join(", ")}',
                        style: const TextStyle(fontSize: 13, color: Colors.orange),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String emoji, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, style: TextStyle(fontSize: 13, color: Colors.grey[600])),
          ),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Future<void> _loadCapabilities() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();

      if (!adminDoc.exists) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      final data = adminDoc.data()!;
      _staffName = data['staffName'] ?? data['name'] ?? user.displayName ?? '';
      _isDriver = data['isDriver'] == true;

      // Check assignedBusinesses array
      final assigned = data['assignedBusinesses'] as List<dynamic>?;
      if (assigned != null && assigned.isNotEmpty) {
        _isDriver = true;
        _assignedBusinessCount = assigned.length;

        // Check each assigned business for reservation support
        for (final id in assigned) {
          final bizDoc = await FirebaseFirestore.instance
              .collection('businesses')
              .doc(id.toString())
              .get();
          if (bizDoc.exists && bizDoc.data()?['hasReservation'] == true) {
            _hasReservation = true;
            _businessId ??= id.toString();
            if (_businessName.isEmpty) {
              _businessName = bizDoc.data()?['companyName'] ?? bizDoc.data()?['name'] ?? '';
            }
          }
        }
      }

      // Check direct business for reservation support
      final bizId = data['businessId'] ?? data['butcherId'];
      if (bizId != null) {
        final bizDoc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(bizId)
            .get();
        if (bizDoc.exists) {
          final bizName = bizDoc.data()?['companyName'] ?? bizDoc.data()?['name'] ?? '';
          // Set businessId and name if not yet set (from assignedBusinesses)
          if (_businessId == null) {
            _businessId = bizId;
            if (_businessName.isEmpty) {
              _businessName = bizName;
            }
          }
          if (bizDoc.data()?['hasReservation'] == true) {
            _hasReservation = true;
            // Override businessId AND name together to keep them in sync
            _businessId = bizId;
            _businessName = bizName;
          }
          // Load max tables for dashboard
          final maxT = bizDoc.data()?['maxReservationTables'] as int?;
          if (maxT != null && maxT > 0) _maxTables = maxT;
        }
      }

      // Load assigned tables from admin doc (independent of business lookup)
      final assignedRaw = data['assignedTables'] as List<dynamic>?;
      if (assignedRaw != null && assignedRaw.isNotEmpty) {
        _assignedTables = assignedRaw.map((e) => (e as num).toInt()).toList();
        _assignedTables.sort();
      }

      // Load pending reservation count
      if (_hasReservation && _businessId != null) {
        _loadPendingReservationCount();
      }

      // Load active table session count for waiter view
      if (_businessId != null) {
        _loadActiveTableSessionCount();
      }
    } catch (e) {
      debugPrint('[StaffHub] Error: $e');
    }

    if (mounted) setState(() => _isLoading = false);
  }

  void _loadPendingReservationCount() {
    FirebaseFirestore.instance
        .collection('businesses')
        .doc(_businessId)
        .collection('reservations')
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .listen((snap) {
      if (mounted) {
        setState(() => _pendingReservations = snap.docs.length);
      }
    });
  }

  void _loadActiveTableSessionCount() {
    FirebaseFirestore.instance
        .collection('businesses')
        .doc(_businessId)
        .collection('table_sessions')
        .where('status', isEqualTo: 'active')
        .snapshots()
        .listen((snap) {
      if (mounted) {
        setState(() => _activeTableSessions = snap.docs.length);
      }
    });
  }

  String _formatElapsed(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  String _todayString() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final driverState = ref.watch(driverProvider);

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Personel Girişi',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            if (_staffName.isNotEmpty)
              Text(
                _staffName,
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
          ],
        ),
        centerTitle: false,
        elevation: 0,
        actions: [
          if (_shiftLoading)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: 20, height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else if (!_shiftService.isOnShift)
            // ▶ START button
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilledButton.icon(
                onPressed: _businessId != null ? _handleStartShift : null,
                icon: const Icon(Icons.play_arrow, size: 20),
                label: const Text('BAŞLA', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF4CAF50),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: Size.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            )
          else ...[
            // Timer display
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              margin: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: _shiftService.shiftStatus == 'paused'
                    ? Colors.orange.withOpacity(0.15)
                    : const Color(0xFF4CAF50).withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _shiftService.shiftStatus == 'paused'
                      ? Colors.orange.withOpacity(0.4)
                      : const Color(0xFF4CAF50).withOpacity(0.4),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _shiftService.shiftStatus == 'paused'
                        ? Icons.pause_circle_filled
                        : Icons.timer,
                    size: 16,
                    color: _shiftService.shiftStatus == 'paused'
                        ? Colors.orange
                        : const Color(0xFF4CAF50),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _formatElapsed(_shiftElapsed),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      fontFeatures: const [FontFeature.tabularFigures()],
                      color: _shiftService.shiftStatus == 'paused'
                          ? Colors.orange
                          : const Color(0xFF4CAF50),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            // Pause/Resume button
            if (_shiftService.shiftStatus == 'paused')
              IconButton(
                onPressed: _handleResumeShift,
                icon: const Icon(Icons.play_arrow, color: Color(0xFF4CAF50)),
                tooltip: 'Devam Et',
                visualDensity: VisualDensity.compact,
              )
            else
              IconButton(
                onPressed: _handlePauseShift,
                icon: const Icon(Icons.pause, color: Colors.orange),
                tooltip: 'Mola',
                visualDensity: VisualDensity.compact,
              ),
            // Stop button
            IconButton(
              onPressed: _handleEndShift,
              icon: const Icon(Icons.stop_circle, color: Colors.red),
              tooltip: 'Vardiyayı Bitir',
              visualDensity: VisualDensity.compact,
            ),
            const SizedBox(width: 4),
          ],
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : (!_isDriver && !_hasReservation)
              ? _buildNoAccess()
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Business name header
                      if (_businessName.isNotEmpty) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFB335B).withOpacity(0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.store, color: Color(0xFFFB335B), size: 24),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _businessName,
                                      style: const TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    if (_assignedBusinessCount > 1)
                                      Text(
                                        '$_assignedBusinessCount işletme atandı',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey[500],
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // ─── Shift Status Banner ───
                      if (_shiftService.isOnShift) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: _shiftService.shiftStatus == 'paused'
                                  ? [Colors.orange.withOpacity(0.15), Colors.orange.withOpacity(0.05)]
                                  : [const Color(0xFF4CAF50).withOpacity(0.15), const Color(0xFF4CAF50).withOpacity(0.05)],
                            ),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: _shiftService.shiftStatus == 'paused'
                                  ? Colors.orange.withOpacity(0.3)
                                  : const Color(0xFF4CAF50).withOpacity(0.3),
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: (_shiftService.shiftStatus == 'paused'
                                          ? Colors.orange
                                          : const Color(0xFF4CAF50))
                                      .withOpacity(0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  _shiftService.shiftStatus == 'paused'
                                      ? Icons.pause_circle
                                      : Icons.work,
                                  color: _shiftService.shiftStatus == 'paused'
                                      ? Colors.orange
                                      : const Color(0xFF4CAF50),
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _shiftService.shiftStatus == 'paused'
                                          ? 'Mola'
                                          : 'Aktif Vardiya',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: _shiftService.shiftStatus == 'paused'
                                            ? Colors.orange
                                            : const Color(0xFF4CAF50),
                                      ),
                                    ),
                                    if (_shiftService.currentTables.isNotEmpty)
                                      Text(
                                        'Masalar: ${_shiftService.currentTables.join(", ")}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey[600],
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // Section title
                      Padding(
                        padding: const EdgeInsets.only(left: 4, bottom: 12),
                        child: Text(
                          'Görevler',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey[600],
                          ),
                        ),
                      ),

                      // ─── Deliveries Card ───
                      if (_isDriver)
                        _buildFeatureCard(
                          icon: Icons.local_shipping,
                          title: 'Teslimatlar',
                          subtitle: driverState.isDriver
                              ? '${driverState.driverInfo?.assignedBusinesses.length ?? 0} işletme'
                              : 'Teslimat yönetimi',
                          color: const Color(0xFFFE0032),
                          gradient: const [Color(0xFFFA4C71), Color(0xFFFE0032)],
                          onTap: () {
                            HapticFeedback.lightImpact();
                            context.push('/driver-deliveries');
                          },
                        ),

                      if (_isDriver) const SizedBox(height: 16),

                      // ─── Reservations Card ───
                      if (_hasReservation)
                        _buildFeatureCard(
                          icon: Icons.restaurant,
                          title: 'Rezervasyonlar',
                          subtitle: _pendingReservations > 0
                              ? '$_pendingReservations bekleyen'
                              : 'Tüm rezervasyonlar',
                          color: Colors.green.shade700,
                          gradient: [Colors.green.shade400, Colors.green.shade700],
                          badgeCount: _pendingReservations,
                          onTap: () {
                            HapticFeedback.lightImpact();
                            context.push('/staff-reservations');
                          },
                        ),

                      if (_hasReservation) const SizedBox(height: 16),

                      // ─── Take Orders (Garson Sipariş) ───
                      if (_businessId != null)
                        _buildFeatureCard(
                          icon: Icons.receipt_long,
                          title: 'Sipariş Al',
                          subtitle: _activeTableSessions > 0
                              ? '$_activeTableSessions aktif masa'
                              : 'Masa siparişi al',
                          color: Colors.orange.shade700,
                          gradient: [Colors.orange.shade400, Colors.orange.shade700],
                          badgeCount: _activeTableSessions,
                          onTap: () {
                            HapticFeedback.lightImpact();
                            context.push('/waiter-order?businessId=$_businessId&businessName=${Uri.encodeComponent(_businessName)}');
                          },
                        ),

                      if (_businessId != null) const SizedBox(height: 16),

                      // ─── Masa Durumu Dashboard ───
                      if (_businessId != null) ...[
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.only(left: 4, bottom: 8),
                          child: Text(
                            'Masa Durumu',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[600],
                            ),
                          ),
                        ),
                        // Legend row
                        Padding(
                          padding: const EdgeInsets.only(left: 4, bottom: 12),
                          child: Wrap(
                            spacing: 10,
                            runSpacing: 4,
                            children: [
                              _tableLegend(const Color(0xFFFB335B), 'Siparişli'),
                              _tableLegend(Colors.green, 'Ödendi'),
                              _tableLegend(Colors.orange, 'Rezerveli'),
                              _tableLegend(Colors.grey.shade400, 'Boş'),
                            ],
                          ),
                        ),
                        // Table grid
                        _buildTableDashboard(isDark),
                      ],

                      const SizedBox(height: 32),
                    ],
                  ),
                ),
    );
  }

  Widget _buildNoAccess() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Personel yetkisi bulunamadı',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Bu sayfaya erişmek için işletme yöneticinize başvurun',
              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required List<Color> gradient,
    required VoidCallback onTap,
    int badgeCount = 0,
    bool disabled = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: Opacity(
        opacity: disabled ? 0.45 : 1.0,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: disabled ? Colors.grey.withOpacity(0.2) : color.withOpacity(0.3),
              width: 1.5,
            ),
            boxShadow: [
              if (!disabled)
                BoxShadow(
                  color: color.withOpacity(0.1),
                  blurRadius: 15,
                  offset: const Offset(0, 4),
                ),
            ],
          ),
          child: Row(
            children: [
              // Icon circle with gradient
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: gradient,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 16),
              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey[500],
                      ),
                    ),
                  ],
                ),
              ),
              // Badge or arrow
              if (badgeCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$badgeCount',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                )
              else if (!disabled)
                Icon(
                  Icons.arrow_forward_ios,
                  size: 18,
                  color: Colors.grey[400],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tableLegend(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10, height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
      ],
    );
  }

  Widget _buildTableDashboard(bool isDark) {
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    const brandColor = Color(0xFFFB335B);

    return StreamBuilder<QuerySnapshot>(
      stream: _businessId != null
          ? FirebaseFirestore.instance
              .collection('businesses')
              .doc(_businessId)
              .collection('table_sessions')
              .where('status', isEqualTo: 'active')
              .snapshots()
          : const Stream<QuerySnapshot>.empty(),
      builder: (context, sessionSnapshot) {
        final activeSessions = <TableSession>[];
        final activeTableNums = <int>{};
        if (sessionSnapshot.hasData) {
          for (final doc in sessionSnapshot.data!.docs) {
            final session = TableSession.fromFirestore(doc);
            activeSessions.add(session);
            activeTableNums.add(session.tableNumber);
          }
        }

        return StreamBuilder<QuerySnapshot>(
          stream: _businessId != null
              ? FirebaseFirestore.instance
                  .collection('businesses')
                  .doc(_businessId)
                  .collection('reservations')
                  .where('date', isEqualTo: _todayString())
                  .where('status', whereIn: ['confirmed', 'pending'])
                  .snapshots()
              : const Stream<QuerySnapshot>.empty(),
          builder: (context, reservationSnapshot) {
            final reservedTableNums = <int>{};
            if (reservationSnapshot.hasData) {
              for (final doc in reservationSnapshot.data!.docs) {
                final data = doc.data() as Map<String, dynamic>;
                final tableNum = data['tableNumber'] as int?;
                if (tableNum != null) reservedTableNums.add(tableNum);
              }
            }

            // Build tile helper
            Widget buildTileForTable(int tableNum) {
              final hasOrders = activeTableNums.contains(tableNum);
              final hasReservation = reservedTableNums.contains(tableNum);
              final session = hasOrders
                  ? activeSessions.firstWhere((s) => s.tableNumber == tableNum)
                  : null;
              return _buildDashboardTile(
                tableNum: tableNum,
                cardBg: cardBg,
                isDark: isDark,
                hasOrders: hasOrders,
                hasReservation: hasReservation,
                brandColor: brandColor,
                session: session,
              );
            }

            // If waiter has assigned tables, split into two sections
            if (_assignedTables.isNotEmpty) {
              final otherTables = List.generate(_maxTables, (i) => i + 1)
                  .where((t) => !_assignedTables.contains(t))
                  .toList();

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // === BENIM MASALARIM ===
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        const Text('🪑', style: TextStyle(fontSize: 18)),
                        const SizedBox(width: 6),
                        Text(
                          'Benim Masalarım',
                          style: TextStyle(
                            color: isDark ? Colors.amber.shade200 : Colors.amber.shade800,
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.amber.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${_assignedTables.length}',
                            style: TextStyle(
                              color: Colors.amber.shade400,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 5,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 1,
                    ),
                    itemCount: _assignedTables.length,
                    itemBuilder: (context, index) => buildTileForTable(_assignedTables[index]),
                  ),

                  if (otherTables.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: [
                          const Text('📋', style: TextStyle(fontSize: 18)),
                          const SizedBox(width: 6),
                          Text(
                            'Diğer Masalar',
                            style: TextStyle(
                              color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.grey.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${otherTables.length}',
                              style: TextStyle(
                                color: Colors.grey.shade500,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 5,
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        childAspectRatio: 1,
                      ),
                      itemCount: otherTables.length,
                      itemBuilder: (context, index) => buildTileForTable(otherTables[index]),
                    ),
                  ],
                ],
              );
            }

            // Fallback: single grid when no tables assigned
            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 5,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 1,
              ),
              itemCount: _maxTables,
              itemBuilder: (context, index) => buildTileForTable(index + 1),
            );
          },
        );
      },
    );
  }

  Widget _buildDashboardTile({
    required int tableNum,
    required Color cardBg,
    required bool isDark,
    required bool hasOrders,
    required bool hasReservation,
    required Color brandColor,
    TableSession? session,
  }) {
    // If there's a session, wrap in StreamBuilder for live order data
    if (session != null) {
      return StreamBuilder<List<LokmaOrder>>(
        stream: _orderService.getTableSessionOrdersStream(session.id),
        builder: (context, orderSnap) {
          final allOrders = orderSnap.data ?? [];
          // Only count non-terminal orders as "active"
          // served = dine-in completed, delivered = delivery completed
          final activeOrders = allOrders.where((o) =>
            o.status != OrderStatus.delivered &&
            o.status != OrderStatus.served &&
            o.status != OrderStatus.cancelled
          ).toList();
          final effectiveHasOrders = activeOrders.isNotEmpty;

          // Auto-close stale sessions: no active orders left (or never had matching orders)
          if (!effectiveHasOrders) {
            // Grace period: don't close sessions created less than 5 min ago (they might just be new)
            final sessionAge = DateTime.now().difference(session.createdAt);
            if (allOrders.isNotEmpty || sessionAge.inMinutes >= 5) {
              Future.microtask(() {
                FirebaseFirestore.instance
                    .collection('businesses')
                    .doc(session.businessId)
                    .collection('table_sessions')
                    .doc(session.id)
                    .update({
                  'status': 'closed',
                  'closedAt': FieldValue.serverTimestamp(),
                });
              });
            }
          }
          final allPaid = allOrders.isNotEmpty && allOrders.every((o) => o.paymentStatus == 'paid');

          // Determine colors based on LIVE order data
          Color bgColor;
          Color borderColor;
          Color textColor;

          if (effectiveHasOrders) {
            if (allPaid) {
              bgColor = Colors.green.shade50;
              borderColor = Colors.green.shade400;
              textColor = Colors.green.shade800;
            } else {
              bgColor = brandColor.withValues(alpha: 0.1);
              borderColor = brandColor;
              textColor = brandColor;
            }
          } else if (hasReservation) {
            bgColor = Colors.orange.shade50;
            borderColor = Colors.orange.shade400;
            textColor = Colors.orange.shade800;
          } else {
            bgColor = cardBg;
            borderColor = isDark ? Colors.grey.shade800 : Colors.grey.shade200;
            textColor = Colors.grey.shade500;
          }

          // Kitchen badge data
          final hasReady = activeOrders.any((o) => o.status == OrderStatus.ready);
          final hasPreparing = activeOrders.any((o) => o.status == OrderStatus.preparing);
          final hasServed = activeOrders.any((o) => o.status == OrderStatus.served);

          // Payment dot data
          final paidCount = activeOrders.where((o) => o.paymentStatus == 'paid').length;
          final allActivePaid = activeOrders.isNotEmpty && paidCount == activeOrders.length;
          final somePaid = paidCount > 0 && !allActivePaid;

          return Material(
            color: bgColor,
            borderRadius: BorderRadius.circular(12),
            elevation: effectiveHasOrders ? 2 : 0,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                HapticFeedback.lightImpact();
                if (effectiveHasOrders) {
                  _showTableOverview(session, tableNum);
                } else {
                  context.push('/waiter-order?businessId=$_businessId&businessName=${Uri.encodeComponent(_businessName)}');
                }
              },
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: borderColor,
                    width: effectiveHasOrders ? 1.5 : 1,
                  ),
                ),
                child: Stack(
                  children: [
                    // Kitchen status badge (top-right)
                    if (effectiveHasOrders && (hasReady || hasPreparing || hasServed))
                      Positioned(
                        top: 2,
                        right: 2,
                        child: Builder(builder: (_) {
                          final String emoji;
                          final Color badgeColor;
                          if (hasReady) {
                            emoji = '✅';
                            badgeColor = Colors.green;
                          } else if (hasPreparing) {
                            emoji = '🔥';
                            badgeColor = Colors.orange;
                          } else {
                            emoji = '🍽️';
                            badgeColor = Colors.teal;
                          }
                          return Container(
                            width: 18, height: 18,
                            decoration: BoxDecoration(
                              color: badgeColor,
                              borderRadius: BorderRadius.circular(5),
                            ),
                            child: Center(
                              child: Text(emoji, style: const TextStyle(fontSize: 10)),
                            ),
                          );
                        }),
                      ),

                    // Payment status dot (top-left)
                    if (effectiveHasOrders)
                      Positioned(
                        top: 3,
                        left: 3,
                        child: Container(
                          width: 8, height: 8,
                          decoration: BoxDecoration(
                            color: allActivePaid
                                ? Colors.green
                                : somePaid
                                    ? Colors.orange
                                    : Colors.red.shade400,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),

                    // Reservation indicator
                    if (hasReservation && !effectiveHasOrders)
                      Positioned(
                        top: 2,
                        right: 2,
                        child: Container(
                          width: 14, height: 14,
                          decoration: BoxDecoration(
                            color: Colors.orange,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Center(
                            child: Text('R', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900)),
                          ),
                        ),
                      ),

                    // Table number + order count
                    Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$tableNum',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: textColor,
                            ),
                          ),
                          if (effectiveHasOrders)
                            Text(
                              '${activeOrders.length} sip.',
                              style: TextStyle(
                                fontSize: 8,
                                fontWeight: FontWeight.w600,
                                color: brandColor,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    }

    // No session — simple static tile
    Color bgColor;
    Color borderColor;
    Color textColor;

    if (hasReservation) {
      bgColor = Colors.orange.shade50;
      borderColor = Colors.orange.shade400;
      textColor = Colors.orange.shade800;
    } else {
      bgColor = cardBg;
      borderColor = isDark ? Colors.grey.shade800 : Colors.grey.shade200;
      textColor = Colors.grey.shade500;
    }

    return Material(
      color: bgColor,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          HapticFeedback.lightImpact();
          context.push('/waiter-order?businessId=$_businessId&businessName=${Uri.encodeComponent(_businessName)}');
        },
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Stack(
            children: [
              if (hasReservation)
                Positioned(
                  top: 2,
                  right: 2,
                  child: Container(
                    width: 14, height: 14,
                    decoration: BoxDecoration(
                      color: Colors.orange,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Center(
                      child: Text('R', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900)),
                    ),
                  ),
                ),
              Center(
                child: Text(
                  '$tableNum',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showTableOverview(TableSession session, int tableNumber) {
    const brandColor = Color(0xFFFB335B);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
        final sheetBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);

        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.3,
          builder: (_, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: sheetBg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  // Handle bar
                  Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Row(
                      children: [
                        Icon(Icons.table_restaurant, color: brandColor, size: 28),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Masa $tableNumber',
                                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                              ),
                              Text(
                                'Garson: ${session.waiterName} • PIN: ${session.pin}',
                                style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(),
                  // Orders stream
                  Expanded(
                    child: StreamBuilder<List<LokmaOrder>>(
                      stream: _orderService.getTableSessionOrdersStream(session.id),
                      builder: (context, snapshot) {
                        final allOrders = snapshot.data ?? [];
                        // Filter out completed/cancelled orders
                        final orders = allOrders.where((o) =>
                          o.status != OrderStatus.delivered &&
                          o.status != OrderStatus.cancelled
                        ).toList();
                        // Sort newest first
                        orders.sort((a, b) => b.createdAt.compareTo(a.createdAt));
                        if (orders.isEmpty) {
                          return Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.receipt_long, size: 48, color: Colors.grey[300]),
                                const SizedBox(height: 12),
                                Text('Henüz sipariş yok', style: TextStyle(color: Colors.grey[500])),
                              ],
                            ),
                          );
                        }

                        final grandTotal = orders.fold<double>(0, (sum, o) => sum + o.totalAmount);
                        final paidOrders = orders.where((o) => o.paymentStatus == 'paid').length;
                        final allPaid = paidOrders == orders.length;

                        return ListView(
                          controller: scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          children: [
                            // Summary card
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: allPaid ? Colors.green.shade50 : brandColor.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: allPaid ? Colors.green.shade200 : brandColor.withValues(alpha: 0.2)),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    allPaid ? Icons.check_circle : Icons.receipt_long,
                                    color: allPaid ? Colors.green.shade700 : brandColor,
                                    size: 32,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          allPaid ? 'Hesap Ödendi ✓' : 'Hesap Açık',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: allPaid ? Colors.green.shade800 : brandColor,
                                          ),
                                        ),
                                        Text(
                                          '${orders.length} sipariş • $paidOrders/${orders.length} ödendi',
                                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '€${grandTotal.toStringAsFixed(2)}',
                                    style: TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.w900,
                                      color: allPaid ? Colors.green.shade800 : brandColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),

                            // Individual orders
                            ...orders.map((order) {
                              final isPaid = order.paymentStatus == 'paid';
                              final statusConfig = <OrderStatus, Map<String, dynamic>>{
                                OrderStatus.pending: {'label': '⏳ Beklemede', 'color': Colors.yellow.shade700, 'bg': Colors.yellow.shade50},
                                OrderStatus.preparing: {'label': '👨‍🍳 Hazırlanıyor', 'color': Colors.orange.shade700, 'bg': Colors.orange.shade50},
                                OrderStatus.ready: {'label': '📦 Hazır', 'color': Colors.green.shade700, 'bg': Colors.green.shade50},
                                OrderStatus.served: {'label': '🍽️ Servis Edildi', 'color': Colors.teal.shade700, 'bg': Colors.teal.shade50},
                              };
                              final sc = statusConfig[order.status];

                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: cardBg,
                                  borderRadius: BorderRadius.circular(14),
                                  border: isPaid
                                      ? Border.all(color: Colors.green.shade200)
                                      : order.status == OrderStatus.ready
                                          ? Border.all(color: Colors.green.shade400, width: 2)
                                          : null,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                                        ),
                                        const SizedBox(width: 8),
                                        if (sc != null)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: (sc['bg'] as Color),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              sc['label'] as String,
                                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: sc['color'] as Color),
                                            ),
                                          ),
                                        const Spacer(),
                                        if (isPaid)
                                          Icon(Icons.check_circle, size: 14, color: Colors.green.shade700)
                                        else
                                          Icon(Icons.circle_outlined, size: 14, color: Colors.red.shade400),
                                        const SizedBox(width: 6),
                                        Text(
                                          '€${order.totalAmount.toStringAsFixed(2)}',
                                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: brandColor),
                                        ),
                                      ],
                                    ),
                                    const Divider(height: 12),
                                    ...order.items.map((item) => Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 1),
                                      child: Text(
                                        '${item.quantity.toStringAsFixed(item.unit == 'kg' ? 1 : 0)}x ${item.name}',
                                        style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                                      ),
                                    )),
                                    // "Servis Edildi" action button for ready orders
                                    if (order.status == OrderStatus.ready)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 10),
                                        child: SizedBox(
                                          width: double.infinity,
                                          child: FilledButton.icon(
                                            icon: const Icon(Icons.restaurant, size: 16),
                                            label: const Text('Servis Edildi', style: TextStyle(fontWeight: FontWeight.w700)),
                                            style: FilledButton.styleFrom(
                                              backgroundColor: Colors.teal.shade600,
                                              padding: const EdgeInsets.symmetric(vertical: 10),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            ),
                                            onPressed: () async {
                                              try {
                                                await _orderService.markAsServed(order.id);
                                                if (mounted) {
                                                  HapticFeedback.mediumImpact();
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(
                                                      content: const Text('✅ Sipariş servis edildi!'),
                                                      backgroundColor: Colors.teal.shade700,
                                                      behavior: SnackBarBehavior.floating,
                                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                                    ),
                                                  );
                                                }
                                              } catch (e) {
                                                if (mounted) {
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
                                                  );
                                                }
                                              }
                                            },
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        );
                      },
                    ),
                  ),
                  // Action button - navigate to waiter order screen
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      child: SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Sipariş Ekle', style: TextStyle(fontWeight: FontWeight.w700)),
                          style: FilledButton.styleFrom(
                            backgroundColor: brandColor,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          onPressed: () {
                            Navigator.pop(ctx);
                            context.push('/waiter-order?businessId=$_businessId&businessName=${Uri.encodeComponent(_businessName)}&tableNumber=$tableNumber');
                          },
                        ),
                      ),
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
}
