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
  bool _hasTables = false;
  bool _hasShiftTracking = false;
  String _staffName = '';
  String _businessName = '';
  String? _businessId;
  int _assignedBusinessCount = 0;
  int _maxTables = 0;
  List<int> _assignedTables = []; // waiter's assigned tables
  List<Map<String, dynamic>> _tables = []; // custom table definitions {label, section, sortOrder}
  List<String> _tableSections = []; // section names
  final Set<String> _expandedShiftDays = {}; // tracks expanded days in shift history

  // Live counters
  int _pendingReservations = 0;
  int _activeTableSessions = 0;
  int _pastShiftMinutes = 0;

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
      if (_businessId != null) {
        _pastShiftMinutes = await _shiftService.getPastTodayActiveMinutes(businessId: _businessId!);
      }
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

    final hasTables = _hasTables;
    final hasCourier = _isDriver;

    // Scenario 1: No tables, no courier → direct start (time tracking only)
    if (!hasTables && !hasCourier) {
      setState(() => _shiftLoading = true);
      HapticFeedback.heavyImpact();
      final shiftId = await _shiftService.startShift(
        businessId: _businessId!,
        staffName: _staffName,
        tables: [],
        isOtherRole: true,
      );
      if (_businessId != null) {
        _pastShiftMinutes = await _shiftService.getPastTodayActiveMinutes(businessId: _businessId!);
      }
      if (shiftId != null) _startTimerFresh();
      if (mounted) setState(() => _shiftLoading = false);
      return;
    }

    // Scenario 2: Has tables but no courier → table selection only
    if (hasTables && !hasCourier) {
      final selectedTables = await _showTableSelectionSheet();
      if (selectedTables == null) return;
      setState(() => _shiftLoading = true);
      HapticFeedback.heavyImpact();
      final shiftId = await _shiftService.startShift(
        businessId: _businessId!,
        staffName: _staffName,
        tables: selectedTables,
        isOtherRole: false,
      );
      if (_businessId != null) {
        _pastShiftMinutes = await _shiftService.getPastTodayActiveMinutes(businessId: _businessId!);
      }
      if (shiftId != null) _startTimerFresh();
      if (mounted) setState(() => _shiftLoading = false);
      return;
    }

    // Scenario 3: Courier available → role selection sheet
    final result = await _showRoleSelectionSheet();
    if (result == null) return;

    setState(() => _shiftLoading = true);
    HapticFeedback.heavyImpact();
    final shiftId = await _shiftService.startShift(
      businessId: _businessId!,
      staffName: _staffName,
      tables: result['tables'] as List<int>,
      isDeliveryDriver: result['isDeliveryDriver'] as bool,
      isOtherRole: result['isDiger'] as bool,
    );
    if (_businessId != null) {
      _pastShiftMinutes = await _shiftService.getPastTodayActiveMinutes(businessId: _businessId!);
    }
    if (shiftId != null) _startTimerFresh();
    if (mounted) setState(() => _shiftLoading = false);
  }

  /// Role selection sheet with masa servisi + kurye toggles
  Future<Map<String, dynamic>?> _showRoleSelectionSheet() async {
    bool masaEnabled = _hasTables; // default ON if business has tables
    bool kuryeEnabled = _isDriver; // default ON only if user is a driver
    bool digerEnabled = true; // default ON always
    final Set<int> selectedTables = Set<int>.from(_assignedTables);
    final max = _maxTables;

    // Determine which roles are available
    final bool showKurye = _isDriver; // plan has delivery AND user is assigned as driver
    final bool showMasa = _hasTables; // plan has table service

    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final isDark = Theme.of(ctx).brightness == Brightness.dark;
            // At least one role must be selected
            final hasAnyRole = digerEnabled || kuryeEnabled || (masaEnabled && (selectedTables.isNotEmpty || !_hasTables));
            final canStart = hasAnyRole;

            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(ctx).size.height * 0.85,
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
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                    child: Column(
                      children: [
                        const Text(
                          'Görev Seçimi',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Bu vardiyada hangi görevleri üstleneceksiniz?',
                          style: TextStyle(fontSize: 13, color: Colors.grey[500]),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),

                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // ── Masa Servisi Toggle ── (only if plan has tables)
                          if (showMasa) ...[
                            _buildRoleToggle(
                              icon: Icons.table_restaurant,
                              title: 'Masa Servisi',
                              subtitle: masaEnabled
                                  ? 'Masalardan gelen siparişleri alın'
                                  : 'Masalara bakmıyorum',
                              color: Colors.teal,
                              isEnabled: masaEnabled,
                              onChanged: (val) => setSheetState(() {
                                masaEnabled = val;
                                if (!val) selectedTables.clear();
                              }),
                            ),
                            // Table grid (only visible when masaEnabled)
                            AnimatedCrossFade(
                              firstChild: Padding(
                                padding: const EdgeInsets.only(top: 12, bottom: 8),
                                child: Column(
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        TextButton.icon(
                                          onPressed: () => setSheetState(() {
                                            selectedTables.clear();
                                            for (int i = 1; i <= max; i++) selectedTables.add(i);
                                          }),
                                          icon: const Icon(Icons.select_all, size: 16),
                                          label: const Text('Tümü', style: TextStyle(fontSize: 12)),
                                        ),
                                        const SizedBox(width: 8),
                                        TextButton.icon(
                                          onPressed: () => setSheetState(() => selectedTables.clear()),
                                          icon: const Icon(Icons.deselect, size: 16),
                                          label: const Text('Temizle', style: TextStyle(fontSize: 12)),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    GridView.builder(
                                      shrinkWrap: true,
                                      physics: const NeverScrollableScrollPhysics(),
                                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: 5,
                                        mainAxisSpacing: 8,
                                        crossAxisSpacing: 8,
                                      ),
                                      itemCount: max,
                                      itemBuilder: (_, i) {
                                        final tableNum = i + 1;
                                        final isSelected = selectedTables.contains(tableNum);
                                        return GestureDetector(
                                          onTap: () {
                                            HapticFeedback.selectionClick();
                                            setSheetState(() {
                                              if (isSelected) {
                                                selectedTables.remove(tableNum);
                                              } else {
                                                selectedTables.add(tableNum);
                                              }
                                            });
                                          },
                                          child: AnimatedContainer(
                                            duration: const Duration(milliseconds: 200),
                                            decoration: BoxDecoration(
                                              color: isSelected
                                                  ? Colors.teal
                                                  : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[100]),
                                              borderRadius: BorderRadius.circular(12),
                                              border: Border.all(
                                                color: isSelected ? Colors.teal : Colors.grey.withOpacity(0.3),
                                                width: isSelected ? 2 : 1,
                                              ),
                                            ),
                                            child: Center(
                                              child: Text(
                                                '$tableNum',
                                                style: TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.bold,
                                                  color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                                                ),
                                              ),
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),
                              secondChild: const SizedBox.shrink(),
                              crossFadeState: masaEnabled ? CrossFadeState.showFirst : CrossFadeState.showSecond,
                              duration: const Duration(milliseconds: 300),
                            ),
                            const SizedBox(height: 12),
                          ],

                          // ── Kurye Görevi Toggle ── (only if plan has delivery AND user is driver)
                          if (showKurye) ...[
                            _buildRoleToggle(
                              icon: Icons.delivery_dining,
                              title: 'Sürücü Görevi',
                              subtitle: kuryeEnabled
                                  ? 'Teslimat siparişlerini alın'
                                  : 'Kurye olarak çalışmıyorum',
                              color: Colors.amber,
                              isEnabled: kuryeEnabled,
                              onChanged: (val) => setSheetState(() => kuryeEnabled = val),
                            ),
                            const SizedBox(height: 12),
                          ],

                          // ── Diğer Görevler Toggle ── (always visible)
                          _buildRoleToggle(
                            icon: Icons.work_outline,
                            title: 'Diğer Görevler',
                            subtitle: digerEnabled
                                ? 'Genel işletme görevleri'
                                : 'Diğer görevlere bakmıyorum',
                            color: Colors.indigo,
                            isEnabled: digerEnabled,
                            onChanged: (val) => setSheetState(() => digerEnabled = val),
                          ),

                          const SizedBox(height: 20),
                        ],
                      ),
                    ),
                  ),

                  // ── Confirm Button ──
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton.icon(
                        onPressed: canStart
                            ? () => Navigator.pop(ctx, {
                                'tables': masaEnabled ? (selectedTables.toList()..sort()) : <int>[],
                                'isDeliveryDriver': kuryeEnabled,
                                'isDiger': digerEnabled,
                              })
                            : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.green,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.play_arrow),
                        label: Text(
                          _buildStartButtonLabel(masaEnabled, kuryeEnabled, digerEnabled, selectedTables.length),
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

  String _buildStartButtonLabel(bool masa, bool kurye, bool diger, int tableCount) {
    final parts = <String>[];
    if (masa && tableCount > 0) parts.add('$tableCount masa');
    if (kurye) parts.add('sürücü');
    if (diger) parts.add('diğer');
    if (parts.isEmpty) return 'En az bir görev seçin';
    return 'Vardiyayı Başlat (${parts.join(' + ')})';
  }

  Widget _buildRoleToggle({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required bool isEnabled,
    required ValueChanged<bool> onChanged,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isEnabled
            ? color.withOpacity(0.08)
            : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[100]),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isEnabled ? color.withOpacity(0.4) : Colors.grey.withOpacity(0.2),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isEnabled ? color.withOpacity(0.15) : Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: isEnabled ? color : Colors.grey, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w600,
                  color: isEnabled ? null : Colors.grey,
                )),
                Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
              ],
            ),
          ),
          Switch.adaptive(
            value: isEnabled,
            onChanged: onChanged,
            activeColor: color,
          ),
        ],
      ),
    );
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
                      child: FilledButton.icon(
                        onPressed: selected.isEmpty
                            ? null
                            : () => Navigator.pop(ctx, selected.toList()..sort()),
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.green,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        icon: const Icon(Icons.play_arrow),
                        label: Text(
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
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('🪑', style: TextStyle(fontSize: 16)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Masa Numaraları', style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: tables.map((t) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.teal.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.teal.withOpacity(0.3)),
                            ),
                            child: Text(
                              '$t',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.teal),
                            ),
                          )).toList(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
            if (orphans.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber, color: Colors.amber, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Sahipsiz masalar: ${orphans.join(", ")}',
                        style: const TextStyle(fontSize: 13, color: Colors.amber),
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

  /// Show shift history bottom sheet
  void _showShiftHistorySheet() async {
    if (_businessId == null) return;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    List<Map<String, dynamic>> shifts = [];
    try {
      shifts = await _shiftService.getShiftHistory(
        businessId: _businessId!,
        staffId: FirebaseAuth.instance.currentUser?.uid,
        limit: 30,
      );
    } catch (e) {
      debugPrint('[StaffHub] getShiftHistory error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Vardiya geçmişi yüklenemedi: $e'), duration: const Duration(seconds: 3)),
        );
      }
      return;
    }

    // Filter out shifts shorter than 1 minute (accidental taps)
    shifts.removeWhere((s) => (s['totalMinutes'] as int? ?? 0) < 1);

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          maxChildSize: 0.9,
          minChildSize: 0.4,
          builder: (_, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  // Handle
                  Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Row(
                      children: [
                        Icon(Icons.schedule, color: Colors.indigo.shade400, size: 22),
                        const SizedBox(width: 10),
                        const Text(
                          'Çalışma Saatlerim',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: shifts.isEmpty
                        ? Center(
                            child: Text(
                              'Henüz vardiya kaydı yok',
                              style: TextStyle(color: Colors.grey[500], fontSize: 15),
                            ),
                          )
                        : _buildDailyGroupedShiftList(shifts, isDark, scrollController),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildDailyGroupedShiftList(List<Map<String, dynamic>> shifts, bool isDark, ScrollController scrollController) {
    // Group shifts by date key (dd.MM.yyyy)
    final Map<String, List<Map<String, dynamic>>> grouped = {};
    for (final shift in shifts) {
      final startedAt = (shift['startedAt'] as Timestamp?)?.toDate();
      if (startedAt == null) continue;
      final key = '${startedAt.day.toString().padLeft(2, '0')}.${startedAt.month.toString().padLeft(2, '0')}.${startedAt.year}';
      grouped.putIfAbsent(key, () => []);
      grouped[key]!.add(shift);
    }

    // Sort each day's shifts by startedAt ascending
    for (final dayShifts in grouped.values) {
      dayShifts.sort((a, b) {
        final aStart = (a['startedAt'] as Timestamp?)?.toDate() ?? DateTime(2000);
        final bStart = (b['startedAt'] as Timestamp?)?.toDate() ?? DateTime(2000);
        return aStart.compareTo(bStart);
      });
    }

    // Sort day keys descending (newest first)
    final dayKeys = grouped.keys.toList()
      ..sort((a, b) {
        final aParts = a.split('.').reversed.join();
        final bParts = b.split('.').reversed.join();
        return bParts.compareTo(aParts);
      });

    // Turkish day names
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    return StatefulBuilder(
      builder: (context, setLocalState) {
        return ListView.separated(
          controller: scrollController,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          itemCount: dayKeys.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, dayIndex) {
            final dateStr = dayKeys[dayIndex];
            final dayShifts = grouped[dateStr]!;

            // Calculate daily summary
            int totalWorkMinutes = 0;
            int totalBreakMinutes = 0;
            DateTime? firstStart;
            DateTime? lastEnd;
            bool hasActiveShift = false;

            for (final s in dayShifts) {
              final sTotalMins = s['totalMinutes'] as int? ?? 0;
              totalWorkMinutes += sTotalMins;

              final sStart = (s['startedAt'] as Timestamp?)?.toDate();
              final sEnd = (s['endedAt'] as Timestamp?)?.toDate();
              if (s['status'] == 'active' || s['status'] == 'paused') hasActiveShift = true;
              if (sStart != null && (firstStart == null || sStart.isBefore(firstStart))) firstStart = sStart;
              if (sEnd != null && (lastEnd == null || sEnd.isAfter(lastEnd))) lastEnd = sEnd;

              // Internal break = elapsed time - totalMinutes (pause within a shift)
              if (sStart != null && sEnd != null) {
                final elapsed = sEnd.difference(sStart).inMinutes;
                final internalBreak = elapsed - sTotalMins;
                if (internalBreak > 0) totalBreakMinutes += internalBreak;
              }
            }

            // Gap breaks between consecutive shifts (only count gaps < 2 hours as "mola")
            for (int i = 0; i < dayShifts.length - 1; i++) {
              final currentEnd = (dayShifts[i]['endedAt'] as Timestamp?)?.toDate();
              final nextStart = (dayShifts[i + 1]['startedAt'] as Timestamp?)?.toDate();
              if (currentEnd != null && nextStart != null && nextStart.isAfter(currentEnd)) {
                final gapMins = nextStart.difference(currentEnd).inMinutes;
                if (gapMins <= 120) { // Only count gaps ≤ 2 hours as breaks
                  totalBreakMinutes += gapMins;
                }
              }
            }

            // Format times
            String firstStartStr = firstStart != null
                ? '${firstStart.hour.toString().padLeft(2, '0')}:${firstStart.minute.toString().padLeft(2, '0')}'
                : '--:--';
            String lastEndStr = lastEnd != null
                ? '${lastEnd.hour.toString().padLeft(2, '0')}:${lastEnd.minute.toString().padLeft(2, '0')}'
                : hasActiveShift ? 'Devam' : '--:--';

            // Format durations
            final wHours = totalWorkMinutes ~/ 60;
            final wMins = totalWorkMinutes % 60;
            final workStr = wHours > 0 ? '${wHours}s ${wMins}dk' : '${wMins}dk';

            final bHours = totalBreakMinutes ~/ 60;
            final bMins = totalBreakMinutes % 60;
            final breakStr = totalBreakMinutes > 0
                ? (bHours > 0 ? '${bHours}s ${bMins}dk' : '${bMins}dk')
                : '';

            // Day name
            String dayName = '';
            if (firstStart != null) {
              dayName = dayNames[firstStart.weekday - 1];
            }

            // Expanded state tracking
            final isExpanded = _expandedShiftDays.contains(dateStr);

            // Build interleaved entries (work + gap breaks)
            final List<Map<String, dynamic>> timelineEntries = [];
            for (int i = 0; i < dayShifts.length; i++) {
              // Add work entry
              timelineEntries.add({...dayShifts[i], '_type': 'work'});
              // Add gap as break entry (only if gap <= 2 hours)
              if (i < dayShifts.length - 1) {
                final currentEnd = (dayShifts[i]['endedAt'] as Timestamp?)?.toDate();
                final nextStart = (dayShifts[i + 1]['startedAt'] as Timestamp?)?.toDate();
                if (currentEnd != null && nextStart != null && nextStart.isAfter(currentEnd)) {
                  final gapMins = nextStart.difference(currentEnd).inMinutes;
                  if (gapMins <= 120 && gapMins >= 1) {
                    timelineEntries.add({
                      '_type': 'break',
                      '_start': currentEnd,
                      '_end': nextStart,
                      '_minutes': gapMins,
                    });
                  }
                }
              }
            }

            return GestureDetector(
              onTap: () {
                setLocalState(() {
                  if (isExpanded) {
                    _expandedShiftDays.remove(dateStr);
                  } else {
                    _expandedShiftDays.add(dateStr);
                  }
                });
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF252525) : Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: hasActiveShift
                        ? const Color(0xFF4CAF50).withOpacity(0.4)
                        : (isDark ? Colors.grey.shade800 : Colors.grey.shade200),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Day header row
                    Row(
                      children: [
                        // Date + day name
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              dateStr,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            Text(
                              dayName,
                              style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                            ),
                          ],
                        ),
                        const SizedBox(width: 16),
                        // Time range
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$firstStartStr – $lastEndStr',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  Icon(Icons.work_outline, size: 13, color: Colors.indigo.shade300),
                                  const SizedBox(width: 4),
                                  Text(
                                    workStr,
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.indigo.shade300),
                                  ),
                                  if (totalBreakMinutes > 0) ...[
                                    const SizedBox(width: 12),
                                    Icon(Icons.free_breakfast, size: 13, color: Colors.amber[700]),
                                    const SizedBox(width: 4),
                                    Text(
                                      breakStr,
                                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.amber[700]),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                        // Expand icon
                        AnimatedRotation(
                          turns: isExpanded ? 0.5 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: Icon(
                            Icons.keyboard_arrow_down,
                            color: Colors.grey[500],
                            size: 22,
                          ),
                        ),
                      ],
                    ),
                    // Expanded detail entries (work + breaks interleaved)
                    if (isExpanded) ...[
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Divider(height: 1, color: isDark ? Colors.grey.shade700 : Colors.grey.shade300),
                      ),
                      const SizedBox(height: 10),
                      ...timelineEntries.map((entry) {
                        final isBreak = entry['_type'] == 'break';

                        if (isBreak) {
                          // ── Break entry (amber/yellow) ──
                          final bStart = entry['_start'] as DateTime;
                          final bEnd = entry['_end'] as DateTime;
                          final bMins = entry['_minutes'] as int;
                          final bH = bMins ~/ 60;
                          final bM = bMins % 60;
                          final bDurStr = bH > 0 ? '${bH}s ${bM}dk' : '${bM}dk';
                          final bTimeStr = '${bStart.hour.toString().padLeft(2, '0')}:${bStart.minute.toString().padLeft(2, '0')}'
                              ' – ${bEnd.hour.toString().padLeft(2, '0')}:${bEnd.minute.toString().padLeft(2, '0')}';

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              children: [
                                Container(
                                  width: 6, height: 6,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.amber[700],
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  bTimeStr,
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.amber[700]),
                                ),
                                const SizedBox(width: 10),
                                Icon(Icons.free_breakfast, size: 12, color: Colors.amber[700]),
                                const SizedBox(width: 3),
                                Text(
                                  bDurStr,
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.amber[700]),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Mola',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.amber[700]),
                                ),
                              ],
                            ),
                          );
                        }

                        // ── Work entry (green/normal) ──
                        final sStart = (entry['startedAt'] as Timestamp?)?.toDate();
                        final sEnd = (entry['endedAt'] as Timestamp?)?.toDate();
                        final sMins = entry['totalMinutes'] as int? ?? 0;
                        final sStatus = entry['status']?.toString() ?? 'unknown';
                        final sTables = (entry['tables'] as List<dynamic>?)?.cast<int>() ?? [];

                        String sTimeStr = '';
                        if (sStart != null) {
                          sTimeStr = '${sStart.hour.toString().padLeft(2, '0')}:${sStart.minute.toString().padLeft(2, '0')}';
                          if (sEnd != null) {
                            sTimeStr += ' – ${sEnd.hour.toString().padLeft(2, '0')}:${sEnd.minute.toString().padLeft(2, '0')}';
                          } else {
                            sTimeStr += ' – Devam';
                          }
                        }

                        final sH = sMins ~/ 60;
                        final sM = sMins % 60;
                        final sDurStr = sH > 0 ? '${sH}s ${sM}dk' : '${sM}dk';

                        final sIsActive = sStatus == 'active' || sStatus == 'paused';

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Container(
                                width: 6, height: 6,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: sIsActive ? const Color(0xFF4CAF50) : Colors.indigo.shade300,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                sTimeStr,
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: isDark ? Colors.grey[300] : Colors.grey[700]),
                              ),
                              const SizedBox(width: 10),
                              Icon(Icons.timer_outlined, size: 12, color: Colors.indigo.shade300),
                              const SizedBox(width: 3),
                              Text(
                                sDurStr,
                                style: TextStyle(fontSize: 12, color: Colors.indigo.shade300),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Çalışma',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.indigo.shade300),
                              ),
                              if (sTables.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Icon(Icons.table_restaurant, size: 12, color: Colors.grey[500]),
                                const SizedBox(width: 3),
                                Text(
                                  sTables.join(', '),
                                  style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                                ),
                              ],
                            ],
                          ),
                        );
                      }),
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
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
          final bizData = bizDoc.data()!;
          final bizName = bizData['companyName'] ?? bizData['name'] ?? '';
          // Set businessId and name if not yet set (from assignedBusinesses)
          if (_businessId == null) {
            _businessId = bizId;
            if (_businessName.isEmpty) {
              _businessName = bizName;
            }
          }
          if (bizData['hasReservation'] == true) {
            _hasReservation = true;
            // Override businessId AND name together to keep them in sync
            _businessId = bizId;
            _businessName = bizName;
          }
          // Load table count for dashboard — check both fields
          debugPrint('[StaffHub] Loading tables from bizId=$bizId, bizData keys: ${bizData.keys.toList()}');
          final tableCount = bizData['tableCount'] as int? ?? 0;
          final maxResT = bizData['maxReservationTables'] as int? ?? 0;
          final effectiveTables = tableCount > 0 ? tableCount : maxResT;
          debugPrint('[StaffHub] tableCount=$tableCount, maxReservationTables=$maxResT, effectiveTables=$effectiveTables');
          if (effectiveTables > 0) {
            _maxTables = effectiveTables;
            _hasTables = true;
          }
          debugPrint('[StaffHub] _hasTables=$_hasTables, _maxTables=$_maxTables');
        }
      }

      // ── Plan feature gating (runs after businessId is resolved from any source) ──
      if (_businessId != null) {
        final bizDoc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(_businessId)
            .get();
        if (bizDoc.exists) {
          final bizData = bizDoc.data()!;
          // Load plan features to gate courier/table/shift capabilities
          // Admin portal saves plan code in multiple places — check all:
          // 1) Top-level subscriptionPlan (newer saves)
          // 2) Top-level plan (legacy)
          // 3) subscription.planName (business page save format)
          final planCode = (bizData['subscriptionPlan'] as String?)
              ?? (bizData['plan'] as String?)
              ?? ((bizData['subscription'] as Map<String, dynamic>?)?['planName'] as String?)
              ?? 'free';
          debugPrint('[StaffHub] businessId=$_businessId, planCode=$planCode');
          if (planCode.isNotEmpty && planCode != 'none') {
            try {
              final planDoc = await FirebaseFirestore.instance
                  .collection('subscription_plans')
                  .doc(planCode)
                  .get();
              debugPrint('[StaffHub] Plan doc exists: ${planDoc.exists}');
              if (planDoc.exists) {
                final features = (planDoc.data()?['features'] as Map<String, dynamic>?) ?? {};
                debugPrint('[StaffHub] Features: $features');
                // Gate courier: plan must have delivery feature
                final planHasDelivery = features['delivery'] == true || features['liveCourierTracking'] == true;
                if (!planHasDelivery) {
                  _isDriver = false;
                }
                // Gate tables: plan must have dineInQR or waiterOrder or tableReservation
                final planHasTables = features['dineInQR'] == true ||
                    features['waiterOrder'] == true ||
                    features['tableReservation'] == true;
                if (!planHasTables) {
                  _hasTables = false;
                  debugPrint('[StaffHub] Plan DISABLED tables: planHasTables=$planHasTables');
                } else {
                  // Plan allows tables — ensure _hasTables is ON even if tableCount was not set
                  _hasTables = true;
                  // If _maxTables is still 0 (no tableCount in Firestore), read from business doc or use fallback
                  if (_maxTables <= 0) {
                    final bt = bizData['tableCount'] as int? ?? 0;
                    final mrt = bizData['maxReservationTables'] as int? ?? 0;
                    _maxTables = bt > 0 ? bt : (mrt > 0 ? mrt : 10); // 10 as last resort fallback
                  }
                  debugPrint('[StaffHub] Plan ALLOWS tables: dineInQR=${features['dineInQR']}, waiterOrder=${features['waiterOrder']}, maxTables=$_maxTables');

                  // Load custom tables array (if defined in admin portal)
                  final rawTables = bizData['tables'] as List<dynamic>?;
                  final rawSections = bizData['tableSections'] as List<dynamic>?;
                  if (rawTables != null && rawTables.isNotEmpty) {
                    _tables = rawTables.map((t) => Map<String, dynamic>.from(t as Map)).toList();
                    _tableSections = rawSections?.map((s) => s.toString()).toList() ?? [];
                    _maxTables = _tables.length;
                    debugPrint('[StaffHub] Loaded ${_tables.length} custom tables, ${_tableSections.length} sections');
                  } else {
                    // Fallback: generate default 1..N tables
                    _tables = List.generate(_maxTables, (i) => {
                      'label': '${i + 1}',
                      'section': '',
                      'sortOrder': i,
                    });
                    _tableSections = [];
                    debugPrint('[StaffHub] Generated $_maxTables default tables (1..N)');
                  }
                }
                // Gate shift tracking
                _hasShiftTracking = features['staffShiftTracking'] == true;
                debugPrint('[StaffHub] hasShiftTracking: $_hasShiftTracking');
              }
            } catch (e) {
              debugPrint('[StaffHub] Plan feature lookup failed: $e');
            }
          }
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
            Text(
              _staffName.isNotEmpty ? _staffName : 'Personel Girişi',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
            ),
            if (_businessName.isNotEmpty)
              Text(
                _businessName,
                style: TextStyle(
                  fontSize: 11,
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
                    ? Colors.amber.withOpacity(0.15)
                    : const Color(0xFF4CAF50).withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _shiftService.shiftStatus == 'paused'
                      ? Colors.amber.withOpacity(0.4)
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
                        ? Colors.amber
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
                          ? Colors.amber
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
                icon: const Icon(Icons.pause, color: Colors.amber),
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
                      // Business name moved to AppBar subtitle

                      // ─── Compact Date + Shift Info Row ───
                      if (_shiftService.isOnShift) ...[
                        Builder(builder: (_) {
                          final now = DateTime.now();
                          const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
                          const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
                          final dateStr = '${now.day} ${months[now.month - 1]} ${now.year}, ${days[now.weekday - 1]}';
                          final isPaused = _shiftService.shiftStatus == 'paused';
                          final accentColor = isPaused ? Colors.amber : const Color(0xFF4CAF50);

                          return Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: accentColor.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: accentColor.withOpacity(0.25)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Date row
                                Row(
                                  children: [
                                    Icon(
                                      isPaused ? Icons.pause_circle : Icons.calendar_today,
                                      size: 16,
                                      color: accentColor,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        dateStr,
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: accentColor,
                                        ),
                                      ),
                                    ),
                                    if (isPaused)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.amber.withOpacity(0.15),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: const Text(
                                          'Mola',
                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.amber),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                // Roles + Total Time row
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    // Roles
                                    Expanded(
                                      child: Wrap(
                                        spacing: 6,
                                        runSpacing: 4,
                                        children: [
                                          if (_shiftService.isDeliveryDriver)
                                            _buildRoleBadge('Kurye', Icons.local_shipping, accentColor),
                                          if (_shiftService.currentTables.isNotEmpty)
                                            _buildRoleBadge('Masa', Icons.table_restaurant, accentColor),
                                          if (_shiftService.isOtherRole)
                                            _buildRoleBadge('Diğer Görevler', Icons.work_outline, accentColor),
                                          if (!_shiftService.isDeliveryDriver && _shiftService.currentTables.isEmpty && !_shiftService.isOtherRole)
                                            _buildRoleBadge('Personel', Icons.person, accentColor),
                                        ],
                                      ),
                                    ),
                                    // Total Time
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          'Bugün Toplam',
                                          style: TextStyle(fontSize: 10, color: Colors.grey[500], fontWeight: FontWeight.w600),
                                        ),
                                        Text(
                                          _formatElapsed(Duration(minutes: _pastShiftMinutes) + _shiftElapsed),
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: accentColor,
                                            fontFeatures: const [FontFeature.tabularFigures()],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                // Tables + Reservations row
                                if (_shiftService.currentTables.isNotEmpty || (_hasReservation && _businessId != null)) ...[
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      if (_shiftService.currentTables.isNotEmpty) ...[
                                        Icon(Icons.table_restaurant, size: 13, color: Colors.grey[500]),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${_shiftService.currentTables.length} masa',
                                          style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                                        ),
                                      ],
                                      if (_shiftService.currentTables.isNotEmpty && _hasReservation)
                                        const SizedBox(width: 12),
                                      if (_hasReservation && _businessId != null)
                                        StreamBuilder<QuerySnapshot>(
                                          stream: FirebaseFirestore.instance
                                              .collection('businesses')
                                              .doc(_businessId)
                                              .collection('reservations')
                                              .where('date', isEqualTo: '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}')
                                              .where('status', whereIn: ['confirmed', 'pending'])
                                              .snapshots(),
                                          builder: (_, snap) {
                                            final count = snap.data?.docs.length ?? 0;
                                            if (count == 0) return const SizedBox.shrink();
                                            return Row(
                                              children: [
                                                Icon(Icons.event_seat, size: 13, color: Colors.amber[700]),
                                                const SizedBox(width: 4),
                                                Text(
                                                  '$count rezervasyon',
                                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.amber[700]),
                                                ),
                                              ],
                                            );
                                          },
                                        ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          );
                        }),
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

                      // ─── Deliveries Card (enriched with live counts) ───
                      if (_isDriver)
                        _buildEnrichedDeliveryCard(
                          businessIds: driverState.driverInfo?.assignedBusinesses ?? [],
                        ),

                      if (_isDriver) const SizedBox(height: 12),



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

                      if (_hasReservation) const SizedBox(height: 12),

                      // "Sipariş Al" removed — empty table taps handle order creation directly

                      // ─── Çalışma Saatlerim ───
                      if (_businessId != null)
                        _buildFeatureCard(
                          icon: Icons.schedule,
                          title: 'Çalışma Saatlerim',
                          subtitle: _hasShiftTracking ? 'Vardiya geçmişi' : 'Paketinizde aktif değil',
                          color: _hasShiftTracking ? Colors.indigo.shade700 : Colors.grey,
                          gradient: _hasShiftTracking
                              ? [Colors.indigo.shade400, Colors.indigo.shade700]
                              : [Colors.grey.shade400, Colors.grey.shade600],
                          disabled: !_hasShiftTracking,
                          onTap: () {
                            HapticFeedback.lightImpact();
                            if (_hasShiftTracking) {
                              _showShiftHistorySheet();
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Paketinizde bu özellik aktif değil. Lütfen yöneticinizle iletişime geçin.'),
                                  duration: Duration(seconds: 3),
                                ),
                              );
                            }
                          },
                        ),

                      if (_businessId != null) const SizedBox(height: 12),

                      // ─── Masa Durumu Dashboard ───
                      if (_businessId != null) ...[
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.only(left: 4, bottom: 4),
                          child: Row(
                            children: [
                              Text(
                                'Masa Durumu',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Live order status chips
                        if (_hasTables && _businessId != null)
                          Padding(
                            padding: const EdgeInsets.only(left: 4, bottom: 6),
                            child: StreamBuilder<QuerySnapshot>(
                              stream: FirebaseFirestore.instance
                                  .collection('meat_orders')
                                  .where('butcherId', isEqualTo: _businessId)
                                  .where('status', whereIn: ['pending', 'preparing', 'ready', 'served'])
                                  .snapshots(),
                              builder: (context, snapshot) {
                                final docs = snapshot.data?.docs ?? [];
                                final tableOrders = docs.where((doc) {
                                  final data = doc.data() as Map<String, dynamic>;
                                  final method = data['deliveryMethod']?.toString() ?? data['orderType']?.toString() ?? '';
                                  return method != 'delivery';
                                }).toList();

                                int pending = 0, preparing = 0, ready = 0, served = 0;
                                for (final doc in tableOrders) {
                                  final data = doc.data() as Map<String, dynamic>;
                                  final status = data['status']?.toString() ?? '';
                                  switch (status) {
                                    case 'pending': pending++; break;
                                    case 'preparing': preparing++; break;
                                    case 'ready': ready++; break;
                                    case 'served': served++; break;
                                  }
                                }

                                final total = pending + preparing + ready + served;
                                if (total == 0) return const SizedBox.shrink();

                                return Wrap(
                                  spacing: 6,
                                  runSpacing: 4,
                                  children: [
                                    _statusChip('⏳ $pending', Colors.amber, pending > 0),
                                    _statusChip('🔥 $preparing', Colors.amber, preparing > 0),
                                    _statusChip('✅ $ready', Colors.green, ready > 0),
                                    _statusChip('🍽️ $served', Colors.teal, served > 0),
                                  ],
                                );
                              },
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
                              _tableLegend(Colors.blue, 'Servis Edildi'),
                              _tableLegend(Colors.green, 'Ödendi'),
                              _tableLegend(Colors.amber, 'Rezerveli'),
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

  Widget _buildRoleBadge(String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
          ),
        ],
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

  /// Enriched delivery card with live order status counts
  Widget _buildEnrichedDeliveryCard({required List<String> businessIds}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const brandColor = Color(0xFFFE0032);
    final userId = FirebaseAuth.instance.currentUser?.uid;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/driver-deliveries');
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: brandColor.withValues(alpha: 0.3),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: brandColor.withValues(alpha: 0.1),
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
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFFA4C71), Color(0xFFFE0032)],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.local_shipping, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 16),
            // Title + live status chips
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Kurye Siparişleri',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  // Live order status counts via StreamBuilder
                  StreamBuilder<List<LokmaOrder>>(
                    stream: businessIds.isNotEmpty
                        ? OrderService().getDriverDeliveriesStream(businessIds, courierId: userId)
                        : Stream.value([]),
                    builder: (context, snapshot) {
                      final orders = snapshot.data ?? [];

                      // Count by status
                      int pending = 0, preparing = 0, ready = 0, onTheWay = 0;
                      for (final o in orders) {
                        switch (o.status) {
                          case OrderStatus.pending:
                            pending++;
                            break;
                          case OrderStatus.preparing:
                            preparing++;
                            break;
                          case OrderStatus.ready:
                            ready++;
                            break;
                          case OrderStatus.accepted:
                          case OrderStatus.onTheWay:
                            onTheWay++;
                            break;
                          default:
                            break;
                        }
                      }

                      return Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          _statusChip('⏳ $pending', Colors.amber, pending > 0),
                          _statusChip('🔥 $preparing', Colors.amber, preparing > 0),
                          _statusChip('✅ $ready', Colors.green, ready > 0),
                          _statusChip('🚗 $onTheWay', Colors.blue, onTheWay > 0),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              size: 18,
              color: Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }

  /// Table service card with live order status counts
  Widget _buildTableServiceCard({required String businessId}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const brandColor = Color(0xFF4CAF50);

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/waiter-order?businessId=$businessId&businessName=${Uri.encodeComponent(_businessName)}');
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: brandColor.withValues(alpha: 0.3),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: brandColor.withValues(alpha: 0.1),
              blurRadius: 15,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF66BB6A), Color(0xFF388E3C)],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.restaurant, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Masa Servisleri',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  StreamBuilder<QuerySnapshot>(
                    stream: FirebaseFirestore.instance
                        .collection('meat_orders')
                        .where('butcherId', isEqualTo: businessId)
                        .where('status', whereIn: ['pending', 'preparing', 'ready', 'accepted'])
                        .snapshots(),
                    builder: (context, snapshot) {
                      final docs = snapshot.data?.docs ?? [];
                      // Filter to dine-in / table orders only (exclude delivery)
                      final tableOrders = docs.where((doc) {
                        final data = doc.data() as Map<String, dynamic>;
                        final method = data['deliveryMethod']?.toString() ?? data['orderType']?.toString() ?? '';
                        return method != 'delivery';
                      }).toList();

                      int pending = 0, preparing = 0, ready = 0, serving = 0;
                      for (final doc in tableOrders) {
                        final data = doc.data() as Map<String, dynamic>;
                        final status = data['status']?.toString() ?? '';
                        switch (status) {
                          case 'pending':
                            pending++;
                            break;
                          case 'preparing':
                            preparing++;
                            break;
                          case 'ready':
                            ready++;
                            break;
                          case 'accepted':
                            serving++;
                            break;
                          default:
                            break;
                        }
                      }

                      return Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          _statusChip('⏳ $pending', Colors.amber, pending > 0),
                          _statusChip('🔥 $preparing', Colors.amber, preparing > 0),
                          _statusChip('✅ $ready', Colors.green, ready > 0),
                          _statusChip('🍽️ $serving', Colors.cyan, serving > 0),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              size: 18,
              color: Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }

  /// Mini status chip for delivery card
  Widget _statusChip(String label, Color color, bool active) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: active
            ? color.withValues(alpha: 0.15)
            : Colors.grey.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: active ? null : Border.all(color: Colors.grey.withValues(alpha: 0.15)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: active ? FontWeight.bold : FontWeight.w500,
          color: active ? color : Colors.grey[600],
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
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: disabled ? Colors.grey.withOpacity(0.2) : color.withOpacity(0.3),
              width: 1.5,
            ),
            boxShadow: [
              if (!disabled)
                BoxShadow(
                  color: color.withOpacity(0.1),
                  blurRadius: 12,
                  offset: const Offset(0, 3),
                ),
            ],
          ),
          child: Row(
            children: [
              // Icon circle with gradient
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: gradient,
                  ),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(icon, color: Colors.white, size: 22),
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
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
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

        // Also query orders collection for active dine-in orders with table numbers
        return StreamBuilder<QuerySnapshot>(
          stream: _businessId != null
              ? FirebaseFirestore.instance
                  .collection('meat_orders')
                  .where('butcherId', isEqualTo: _businessId)
                  .where('status', whereIn: ['pending', 'preparing', 'ready', 'accepted', 'served', 'delivered'])
                  .snapshots()
              : const Stream<QuerySnapshot>.empty(),
          builder: (context, ordersSnapshot) {
            // Merge table numbers from orders (covers admin-panel-created orders)
            final orderTableNums = <int>{};
            final orderCountPerTable = <int, int>{};
            if (ordersSnapshot.hasData) {
              for (final doc in ordersSnapshot.data!.docs) {
                final data = doc.data() as Map<String, dynamic>;
                final rawTable = data['tableNumber'];
                final tableNum = rawTable is int ? rawTable : int.tryParse(rawTable?.toString() ?? '');
                final method = data['deliveryMethod']?.toString() ?? data['orderType']?.toString() ?? '';
                final status = data['status']?.toString() ?? '';
                final payStatus = data['paymentStatus']?.toString() ?? '';
                // Only count dine-in / table orders (exclude delivery)
                if (tableNum != null && method != 'delivery') {
                  // Skip served/delivered orders that are already paid
                  if ((status == 'served' || status == 'delivered') && payStatus == 'paid') continue;
                  orderTableNums.add(tableNum);
                  orderCountPerTable[tableNum] = (orderCountPerTable[tableNum] ?? 0) + 1;
                }
              }
            }
            // Combine: tables active via sessions OR via direct orders
            final allActiveTableNums = {...activeTableNums, ...orderTableNums};

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
              final hasOrders = allActiveTableNums.contains(tableNum);
              final hasReservation = reservedTableNums.contains(tableNum);
              final session = activeTableNums.contains(tableNum)
                  ? activeSessions.firstWhere((s) => s.tableNumber == tableNum)
                  : null;
              final orderCount = orderCountPerTable[tableNum] ?? 0;
              return _buildDashboardTile(
                tableNum: tableNum,
                cardBg: cardBg,
                isDark: isDark,
                hasOrders: hasOrders,
                hasReservation: hasReservation,
                brandColor: brandColor,
                session: session,
                orderCount: orderCount,
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
            // If sections exist, group by section
            if (_tableSections.isNotEmpty) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ..._tableSections.map((section) {
                    final sectionTables = _tables
                        .where((t) => t['section'] == section)
                        .toList();
                    if (sectionTables.isEmpty) return const SizedBox.shrink();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8, top: 8),
                          child: Row(
                            children: [
                              const Text('📍', style: TextStyle(fontSize: 14)),
                              const SizedBox(width: 4),
                              Text(
                                section,
                                style: TextStyle(
                                  color: isDark ? Colors.amber.shade200 : Colors.amber.shade800,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                '(${sectionTables.length})',
                                style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
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
                          itemCount: sectionTables.length,
                          itemBuilder: (context, index) {
                            final tableNum = int.tryParse(sectionTables[index]['label']?.toString() ?? '') ?? (index + 1);
                            return buildTileForTable(tableNum);
                          },
                        ),
                      ],
                    );
                  }),
                  // Unassigned tables (no section)
                  ..._buildUnassignedSectionTables(buildTileForTable, isDark),
                ],
              );
            }

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
      },
    );
  }

  /// Build grid for tables that have no section assigned (only when sections exist)
  List<Widget> _buildUnassignedSectionTables(Widget Function(int) buildTile, bool isDark) {
    final unassigned = _tables.where((t) => (t['section']?.toString() ?? '').isEmpty).toList();
    if (unassigned.isEmpty) return [];
    return [
      Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 12),
        child: Text(
          'Diğer Masalar (${unassigned.length})',
          style: TextStyle(
            color: Colors.grey.shade500,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
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
        itemCount: unassigned.length,
        itemBuilder: (context, index) {
          final tableNum = int.tryParse(unassigned[index]['label']?.toString() ?? '') ?? (index + 1);
          return buildTile(tableNum);
        },
      ),
    ];
  }

  /// Mark a ready order as served by this waiter
  Future<void> _markOrderAsServed(String docId, String displayOrderId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('🍽️ Siparişi Servis Et'),
        content: Text(
          'Sipariş #$displayOrderId masaya servis edildi olarak işaretlenecek.\n\n'
          'Devam etmek istiyor musunuz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('İptal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('✅ Servis Ettim', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final orderService = OrderService();
    final success = await orderService.markAsServed(
      orderId: docId,
      waiterId: user.uid,
      waiterName: _staffName.isNotEmpty ? _staffName : 'Garson',
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success
            ? '✅ Sipariş #$displayOrderId servis edildi!'
            : '❌ Sipariş zaten servis edilmiş veya hazır değil.'),
          backgroundColor: success ? Colors.green : Colors.red,
        ),
      );
    }
  }

  /// Shows a bottom sheet with existing orders for a table (admin-created / session-less orders)
  void _showTableOrdersSheet(int tableNum) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const brandColor = Color(0xFFFB335B);
    final sheetBg = isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5);
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.55,
          maxChildSize: 0.85,
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
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: brandColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.table_restaurant, color: brandColor, size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Masa $tableNum — Siparişler',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                          ),
                        ),
                        // Add new order button
                        FilledButton.icon(
                          onPressed: () {
                            Navigator.pop(ctx);
                            context.push('/waiter-order?businessId=$_businessId&businessName=${Uri.encodeComponent(_businessName)}&tableNumber=$tableNum');
                          },
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Yeni Sipariş'),
                          style: FilledButton.styleFrom(
                            backgroundColor: brandColor,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  // Orders list — Note: tableNumber may be stored as int OR string
                  // depending on how order was created, so we filter client-side
                  Expanded(
                    child: StreamBuilder<QuerySnapshot>(
                      stream: _businessId != null
                          ? FirebaseFirestore.instance
                              .collection('meat_orders')
                              .where('butcherId', isEqualTo: _businessId)
                              .where('status', whereIn: ['pending', 'preparing', 'ready', 'accepted', 'served', 'delivered'])
                              .snapshots()
                          : const Stream<QuerySnapshot>.empty(),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator());
                        }
                        // Filter orders for this specific table (handle int/string mismatch)
                        final allDocs = snapshot.data?.docs ?? [];
                        final orders = allDocs.where((doc) {
                          final data = doc.data() as Map<String, dynamic>;
                          final raw = data['tableNumber'];
                          final orderTable = raw is int ? raw : int.tryParse(raw?.toString() ?? '');
                          return orderTable == tableNum;
                        }).toList();
                        if (orders.isEmpty) {
                          return Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.receipt_long, size: 48, color: Colors.grey[400]),
                                const SizedBox(height: 12),
                                Text('Bu masa için aktif sipariş yok', style: TextStyle(color: Colors.grey[500])),
                              ],
                            ),
                          );
                        }
                        return ListView.builder(
                          controller: scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: orders.length,
                          itemBuilder: (context, index) {
                            final data = orders[index].data() as Map<String, dynamic>;
                            final orderId = data['shortId'] ?? orders[index].id.substring(0, 6).toUpperCase();
                            final status = data['status']?.toString() ?? 'pending';
                            final total = (data['totalAmount'] as num?)?.toDouble() ?? (data['totalPrice'] as num?)?.toDouble() ?? (data['total'] as num?)?.toDouble() ?? 0.0;
                            final items = data['items'] as List<dynamic>? ?? [];
                            final createdAt = data['createdAt'];
                            String timeStr = '';
                            if (createdAt != null) {
                              final ts = createdAt is Timestamp ? createdAt.toDate() : DateTime.now();
                              timeStr = '${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}';
                            }

                            // Status styling
                            Color statusColor;
                            String statusText;
                            switch (status) {
                              case 'pending':
                                statusColor = Colors.amber;
                                statusText = 'Bekleyen';
                                break;
                              case 'accepted':
                                statusColor = Colors.blue;
                                statusText = 'Onaylandı';
                                break;
                              case 'preparing':
                                statusColor = Colors.purple;
                                statusText = 'Hazırlanıyor';
                                break;
                              case 'ready':
                                statusColor = Colors.green;
                                statusText = 'Hazır';
                                break;
                              case 'served':
                                statusColor = Colors.amber;
                                statusText = 'Servis Edildi';
                                break;
                              case 'delivered':
                                statusColor = Colors.amber;
                                statusText = 'Teslim Edildi';
                                break;
                              default:
                                statusColor = Colors.grey;
                                statusText = status;
                            }

                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        '#$orderId',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: brandColor,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: statusColor.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          statusText,
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: statusColor,
                                          ),
                                        ),
                                      ),
                                      const Spacer(),
                                      if (timeStr.isNotEmpty)
                                        Text(timeStr, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  // Items summary
                                  ...items.take(3).map((item) {
                                    final name = item['name']?.toString() ?? item['productName']?.toString() ?? '?';
                                    final qty = item['quantity'] ?? 1;
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: 2),
                                      child: Text(
                                        '${qty}x $name',
                                        style: TextStyle(fontSize: 13, color: isDark ? Colors.grey[300] : Colors.grey[700]),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    );
                                  }),
                                  if (items.length > 3)
                                    Text(
                                      '+${items.length - 3} ürün daha',
                                      style: TextStyle(fontSize: 12, color: Colors.grey[500], fontStyle: FontStyle.italic),
                                    ),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      Text(
                                        '€${total.toStringAsFixed(2)}',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800,
                                          color: isDark ? Colors.white : Colors.black87,
                                        ),
                                      ),
                                    ],
                                  ),
                                  // Waiter service actions
                                  if (status == 'ready') ...[
                                    const SizedBox(height: 10),
                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton.icon(
                                        onPressed: () => _markOrderAsServed(
                                          orders[index].id,
                                          orderId,
                                        ),
                                        icon: const Icon(Icons.restaurant, color: Colors.white, size: 18),
                                        label: const Text(
                                          '🍽️ Servis Ettim',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.green,
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                  // Show waiter who served
                                  if (status == 'served' && data['servedByName'] != null) ...[
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Icon(Icons.person, size: 14, color: Colors.amber[700]),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${data['servedByName']} tarafından servis edildi',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: Colors.amber[700],
                                            fontStyle: FontStyle.italic,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                  // Payment buttons for served/delivered unpaid orders
                                  if ((status == 'served' || status == 'delivered') && data['paymentStatus'] != 'paid') ...[
                                    const SizedBox(height: 10),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: FilledButton.icon(
                                            icon: const Icon(Icons.money, size: 16),
                                            label: const Text('💵 Nakit', style: TextStyle(fontWeight: FontWeight.w700)),
                                            style: FilledButton.styleFrom(
                                              backgroundColor: Colors.green.shade700,
                                              padding: const EdgeInsets.symmetric(vertical: 10),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            ),
                                            onPressed: () async {
                                              try {
                                                await _orderService.updatePaymentStatus(
                                                  orderId: orders[index].id,
                                                  paymentStatus: 'paid',
                                                  paymentMethod: 'cash',
                                                );
                                                if (mounted) {
                                                  HapticFeedback.mediumImpact();
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(
                                                      content: const Text('✅ Nakit ödeme alındı!'),
                                                      backgroundColor: Colors.green.shade700,
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
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: FilledButton.icon(
                                            icon: const Icon(Icons.credit_card, size: 16),
                                            label: const Text('💳 Kart', style: TextStyle(fontWeight: FontWeight.w700)),
                                            style: FilledButton.styleFrom(
                                              backgroundColor: Colors.blue.shade700,
                                              padding: const EdgeInsets.symmetric(vertical: 10),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            ),
                                            onPressed: () async {
                                              try {
                                                await _orderService.updatePaymentStatus(
                                                  orderId: orders[index].id,
                                                  paymentStatus: 'paid',
                                                  paymentMethod: 'card',
                                                );
                                                if (mounted) {
                                                  HapticFeedback.mediumImpact();
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    SnackBar(
                                                      content: const Text('✅ Kart ödeme alındı!'),
                                                      backgroundColor: Colors.blue.shade700,
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
                                      ],
                                    ),
                                  ],
                                  // Green paid chip with timestamp for paid orders
                                  if (data['paymentStatus'] == 'paid') ...[
                                    const SizedBox(height: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: Colors.green.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: Colors.green.withValues(alpha: 0.4)),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            data['paymentMethod'] == 'card' ? Icons.credit_card : Icons.payments,
                                            size: 15,
                                            color: Colors.green,
                                          ),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(
                                              '✅ Ödendi${data['paymentMethod'] == 'card' ? ' (Kart)' : data['paymentMethod'] == 'cash' ? ' (Nakit)' : ''}',
                                              style: const TextStyle(
                                                color: Colors.green,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12,
                                              ),
                                            ),
                                          ),
                                          if (data['updatedAt'] != null)
                                            Text(
                                              (() {
                                                final ts = data['updatedAt'];
                                                DateTime? dt;
                                                if (ts is Timestamp) {
                                                  dt = ts.toDate().toLocal();
                                                }
                                                if (dt != null) {
                                                  return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                                                }
                                                return '';
                                              })(),
                                              style: TextStyle(
                                                color: Colors.green.withValues(alpha: 0.7),
                                                fontSize: 11,
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
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

  /// Shows confirmation dialog on staff hub for empty table tap.
  /// If confirmed, creates a session and navigates directly to menu.
  Future<void> _handleEmptyTableTap(int tableNum) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const brandColor = Color(0xFFFB335B);

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle
                Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey[400],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Title
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.grey.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(Icons.table_restaurant, color: Colors.grey[600], size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Masa $tableNum',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Boş masa',
                            style: TextStyle(fontSize: 13, color: Colors.grey[500]),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                // Start Order button
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      context.push('/waiter-order?businessId=$_businessId&businessName=${Uri.encodeComponent(_businessName)}&tableNumber=$tableNum');
                    },
                    icon: const Icon(Icons.receipt_long, size: 20),
                    label: const Text('Sipariş Başlat', style: TextStyle(fontWeight: FontWeight.bold)),
                    style: FilledButton.styleFrom(
                      backgroundColor: brandColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
              ],
            ),
          ),
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
    int orderCount = 0,
  }) {
    // If there's a session, wrap in StreamBuilder for live order data
    if (session != null) {
      return StreamBuilder<List<LokmaOrder>>(
        stream: _orderService.getTableOrdersStream(
          businessId: session.businessId,
          tableNumber: session.tableNumber,
          sessionId: session.id,
        ),
        builder: (context, orderSnap) {
          final allOrders = orderSnap.data ?? [];
          // Keep orders "active" unless cancelled or fully paid+completed
          // Unpaid served/delivered/completed orders stay active so the table doesn't go empty
          final activeOrders = allOrders.where((o) {
            if (o.status == OrderStatus.cancelled) return false;
            if (o.status == OrderStatus.delivered || o.status == OrderStatus.served) {
              return o.paymentStatus != 'paid'; // Keep unpaid served/completed orders active
            }
            return true;
          }).toList();
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
          final allPaid = activeOrders.isNotEmpty && activeOrders.every((o) => o.paymentStatus == 'paid');

          // Detect unpaid served/delivered/completed orders (table served but bill open)
          final hasUnpaidServed = activeOrders.any((o) =>
            (o.status == OrderStatus.served || o.status == OrderStatus.delivered) &&
            o.paymentStatus != 'paid'
          );

          // Determine colors based on LIVE order data
          Color bgColor;
          Color borderColor;
          Color textColor;

          if (effectiveHasOrders) {
            if (allPaid) {
              bgColor = isDark ? Colors.green.shade900.withOpacity(0.3) : Colors.green.shade50;
              borderColor = Colors.green.shade400;
              textColor = isDark ? Colors.green.shade300 : Colors.green.shade800;
            } else if (hasUnpaidServed) {
              // Blue for served-but-unpaid tables
              bgColor = isDark ? Colors.blue.shade900.withOpacity(0.35) : Colors.blue.shade50;
              borderColor = brandColor;
              textColor = isDark ? Colors.blue.shade300 : Colors.blue.shade800;
            } else {
              bgColor = brandColor.withValues(alpha: 0.1);
              borderColor = brandColor;
              textColor = isDark ? brandColor.withValues(alpha: 0.8) : brandColor;
            }
          } else if (hasReservation) {
            bgColor = isDark ? Colors.amber.shade900.withOpacity(0.3) : Colors.amber.shade50;
            borderColor = Colors.amber.shade400;
            textColor = isDark ? Colors.amber.shade300 : Colors.amber.shade800;
          } else {
            bgColor = cardBg;
            borderColor = isDark ? Colors.grey.shade800 : Colors.grey.shade200;
            textColor = Colors.grey.shade500;
          }

          // Kitchen badge data
          final hasReady = activeOrders.any((o) => o.status == OrderStatus.ready);
          final hasPreparing = activeOrders.any((o) => o.status == OrderStatus.preparing);
          final hasServed = activeOrders.any((o) => o.status == OrderStatus.served || o.status == OrderStatus.delivered);

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
                  _handleEmptyTableTap(tableNum);
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
                            badgeColor = Colors.amber;
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

                    // Payment status dot (top-left) — blinks for unpaid served tables
                    if (effectiveHasOrders)
                      Positioned(
                        top: 3,
                        left: 3,
                        child: hasUnpaidServed
                            ? _BlinkingDot(
                                color: Colors.blue.shade600,
                                size: 8,
                              )
                            : Container(
                                width: 8, height: 8,
                                decoration: BoxDecoration(
                                  color: allActivePaid
                                      ? Colors.green
                                      : somePaid
                                          ? Colors.amber
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
                            color: Colors.amber,
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

    // No session — use StreamBuilder to get live order data for blue dot + payment status
    if (_businessId == null) {
      // Fallback: no business context
      return _buildEmptyTableTile(tableNum, cardBg, isDark, hasReservation, brandColor);
    }

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('meat_orders')
          .where('butcherId', isEqualTo: _businessId)
          .where('status', whereIn: ['pending', 'preparing', 'ready', 'accepted', 'served', 'delivered'])
          .snapshots(),
      builder: (context, snapshot) {
        // Filter orders for this specific table
        final allDocs = snapshot.data?.docs ?? [];
        final tableOrders = allDocs.where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          final raw = data['tableNumber'];
          final orderTable = raw is int ? raw : int.tryParse(raw?.toString() ?? '');
          return orderTable == tableNum;
        }).toList();

        final hasDirectOrders = tableOrders.isNotEmpty;

        // Parse statuses for blue dot logic
        final hasUnpaidServed = tableOrders.any((doc) {
          final data = doc.data() as Map<String, dynamic>;
          final status = data['status']?.toString() ?? '';
          final paymentStatus = data['paymentStatus']?.toString() ?? '';
          return (status == 'served' || status == 'delivered') && paymentStatus != 'paid';
        });

        final allPaid = tableOrders.isNotEmpty && tableOrders.every((doc) {
          final data = doc.data() as Map<String, dynamic>;
          return data['paymentStatus']?.toString() == 'paid';
        });

        Color bgColor;
        Color borderColor;
        Color textColor;

        if (hasDirectOrders) {
          if (allPaid) {
            bgColor = isDark ? Colors.green.shade900.withOpacity(0.3) : Colors.green.shade50;
            borderColor = Colors.green.shade400;
            textColor = isDark ? Colors.green.shade300 : Colors.green.shade800;
          } else if (hasUnpaidServed) {
            bgColor = isDark ? Colors.blue.shade900.withOpacity(0.35) : Colors.blue.shade50;
            borderColor = Colors.blue.shade400;
            textColor = isDark ? Colors.blue.shade300 : Colors.blue.shade800;
          } else {
            bgColor = brandColor.withValues(alpha: 0.1);
            borderColor = brandColor;
            textColor = brandColor;
          }
        } else if (hasReservation) {
          bgColor = isDark ? Colors.amber.shade900.withOpacity(0.3) : Colors.amber.shade50;
          borderColor = Colors.amber.shade400;
          textColor = isDark ? Colors.amber.shade300 : Colors.amber.shade800;
        } else {
          bgColor = cardBg;
          borderColor = isDark ? Colors.grey.shade800 : Colors.grey.shade200;
          textColor = Colors.grey.shade500;
        }

        return Material(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          elevation: hasDirectOrders ? 2 : 0,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () {
              HapticFeedback.lightImpact();
              if (hasDirectOrders) {
                _showTableOrdersSheet(tableNum);
              } else {
                _handleEmptyTableTap(tableNum);
              }
            },
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: borderColor,
                  width: hasDirectOrders ? 1.5 : 1,
                ),
              ),
              child: Stack(
                children: [
                  if (hasReservation && !hasDirectOrders)
                    Positioned(
                      top: 2,
                      right: 2,
                      child: Container(
                        width: 14, height: 14,
                        decoration: BoxDecoration(
                          color: Colors.amber,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Center(
                          child: Text('R', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900)),
                        ),
                      ),
                    ),
                  // Blue dot for served/unpaid, green for all paid, red for active
                  if (hasDirectOrders)
                    Positioned(
                      top: 3,
                      left: 3,
                      child: Container(
                        width: 8, height: 8,
                        decoration: BoxDecoration(
                          color: allPaid
                              ? Colors.green
                              : hasUnpaidServed
                                  ? Colors.blue.shade600
                                  : Colors.red.shade400,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
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
                        if (hasDirectOrders)
                          Text(
                            '${tableOrders.length} sip.',
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w600,
                              color: textColor,
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

  Widget _buildEmptyTableTile(int tableNum, Color cardBg, bool isDark, bool hasReservation, Color brandColor) {
    Color bgColor;
    Color borderColor;
    Color textColor;
    if (hasReservation) {
      bgColor = isDark ? Colors.amber.shade900.withOpacity(0.3) : Colors.amber.shade50;
      borderColor = Colors.amber.shade400;
      textColor = isDark ? Colors.amber.shade300 : Colors.amber.shade800;
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
          _handleEmptyTableTap(tableNum);
        },
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Center(
            child: Text(
              '$tableNum',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: textColor),
            ),
          ),
        ),
      ),
    );
  }

  /// Consolidated payment receipt sheet - shows all unpaid orders with items
  void _showConsolidatedPaymentSheet(
    BuildContext parentContext,
    List<LokmaOrder> unpaidOrders,
    double grandTotal,
    int tableNumber,
  ) {
    showModalBottomSheet(
      context: parentContext,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final bgColor = isDark ? const Color(0xFF1A1A1A) : Colors.white;
        final cardBg = isDark ? const Color(0xFF252525) : const Color(0xFFF7F7F7);
        final textColor = isDark ? Colors.white : Colors.black87;
        final subtleText = isDark ? Colors.grey[400]! : Colors.grey[600]!;
        bool isProcessing = false;

        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return DraggableScrollableSheet(
              initialChildSize: 0.85,
              maxChildSize: 0.95,
              minChildSize: 0.5,
              builder: (_, scrollController) {
                return Container(
                  decoration: BoxDecoration(
                    color: bgColor,
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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Colors.amber.shade700, Colors.amber.shade700],
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.receipt_long, size: 28, color: Colors.white),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Masa $tableNumber — Toptan Hesap',
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white,
                                    ),
                                  ),
                                  Text(
                                    '${unpaidOrders.length} açık sipariş',
                                    style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.85)),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '€${grandTotal.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Orders list
                      Expanded(
                        child: ListView.builder(
                          controller: scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: unpaidOrders.length,
                          itemBuilder: (ctx, index) {
                            final order = unpaidOrders[index];
                            final displayId = order.orderNumber ?? order.id.substring(0, 6).toUpperCase();
                            final time = '${order.createdAt.hour.toString().padLeft(2, '0')}:${order.createdAt.minute.toString().padLeft(2, '0')}';

                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: isDark ? Colors.grey[700]! : Colors.grey[200]!,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Order header
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: Colors.amber.shade700,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          '#$displayId',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w800,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      // Status badge
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: order.status == OrderStatus.served
                                              ? Colors.teal.withOpacity(0.2)
                                              : order.status == OrderStatus.delivered
                                                  ? Colors.blue.withOpacity(0.2)
                                                  : Colors.green.withOpacity(0.2),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          order.status == OrderStatus.served ? 'Servis Edildi'
                                            : order.status == OrderStatus.delivered ? 'Teslim Edildi'
                                            : 'Hazır',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: order.status == OrderStatus.served
                                                ? Colors.teal
                                                : order.status == OrderStatus.delivered
                                                    ? Colors.blue
                                                    : Colors.green,
                                          ),
                                        ),
                                      ),
                                      const Spacer(),
                                      Text(time, style: TextStyle(fontSize: 12, color: subtleText)),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  // Items
                                  ...order.items.map((item) => Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 2),
                                    child: Row(
                                      children: [
                                        Text(
                                          '${item.quantity is double && item.quantity == item.quantity.roundToDouble() ? item.quantity.toInt() : item.quantity}x',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.amber.shade700,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            item.name,
                                            style: TextStyle(fontSize: 13, color: textColor),
                                          ),
                                        ),
                                        Text(
                                          '€${(item.price * item.quantity).toStringAsFixed(2)}',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                            color: textColor,
                                          ),
                                        ),
                                      ],
                                    ),
                                  )),
                                  const Divider(height: 16),
                                  // Subtotal
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      Text('Ara Toplam: ', style: TextStyle(fontSize: 12, color: subtleText)),
                                      Text(
                                        '€${order.totalAmount.toStringAsFixed(2)}',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: textColor,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),

                      // Bottom total + payment buttons
                      Container(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF1E1E1E) : Colors.grey[50],
                          border: Border(
                            top: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
                          ),
                        ),
                        child: Column(
                          children: [
                            // Grand total row
                            Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: Row(
                                children: [
                                  Text(
                                    'GENEL TOPLAM',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                      color: subtleText,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '€${grandTotal.toStringAsFixed(2)}',
                                    style: TextStyle(
                                      fontSize: 26,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.amber.shade700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Payment buttons
                            Row(
                              children: [
                                Expanded(
                                  child: FilledButton.icon(
                                    icon: const Icon(Icons.payments, size: 20),
                                    label: Text(
                                      isProcessing ? 'İşleniyor...' : '💵 Nakit Öde',
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                                    ),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: Colors.green.shade700,
                                      padding: const EdgeInsets.symmetric(vertical: 16),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    ),
                                    onPressed: isProcessing ? null : () async {
                                      setModalState(() => isProcessing = true);
                                      try {
                                        for (final o in unpaidOrders) {
                                          await _orderService.updatePaymentStatus(
                                            orderId: o.id,
                                            paymentStatus: 'paid',
                                            paymentMethod: 'cash',
                                          );
                                        }
                                        if (mounted) {
                                          HapticFeedback.heavyImpact();
                                          Navigator.of(ctx).pop();
                                          ScaffoldMessenger.of(parentContext).showSnackBar(
                                            SnackBar(
                                              content: Text('✅ ${unpaidOrders.length} sipariş nakit olarak toptan ödendi! (€${grandTotal.toStringAsFixed(2)})'),
                                              backgroundColor: Colors.green.shade700,
                                              behavior: SnackBarBehavior.floating,
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                            ),
                                          );
                                        }
                                      } catch (e) {
                                        setModalState(() => isProcessing = false);
                                        if (mounted) {
                                          ScaffoldMessenger.of(parentContext).showSnackBar(
                                            SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
                                          );
                                        }
                                      }
                                    },
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: FilledButton.icon(
                                    icon: const Icon(Icons.credit_card, size: 20),
                                    label: Text(
                                      isProcessing ? 'İşleniyor...' : '💳 Kart Öde',
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                                    ),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: Colors.blue.shade700,
                                      padding: const EdgeInsets.symmetric(vertical: 16),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    ),
                                    onPressed: isProcessing ? null : () async {
                                      setModalState(() => isProcessing = true);
                                      try {
                                        for (final o in unpaidOrders) {
                                          await _orderService.updatePaymentStatus(
                                            orderId: o.id,
                                            paymentStatus: 'paid',
                                            paymentMethod: 'card',
                                          );
                                        }
                                        if (mounted) {
                                          HapticFeedback.heavyImpact();
                                          Navigator.of(ctx).pop();
                                          ScaffoldMessenger.of(parentContext).showSnackBar(
                                            SnackBar(
                                              content: Text('✅ ${unpaidOrders.length} sipariş kart ile toptan ödendi! (€${grandTotal.toStringAsFixed(2)})'),
                                              backgroundColor: Colors.blue.shade700,
                                              behavior: SnackBarBehavior.floating,
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                            ),
                                          );
                                        }
                                      } catch (e) {
                                        setModalState(() => isProcessing = false);
                                        if (mounted) {
                                          ScaffoldMessenger.of(parentContext).showSnackBar(
                                            SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
                                          );
                                        }
                                      }
                                    },
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
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
                      stream: _orderService.getTableOrdersStream(
                        businessId: session.businessId,
                        tableNumber: session.tableNumber,
                        sessionId: session.id,
                      ),
                      builder: (context, snapshot) {
                        final allOrders = snapshot.data ?? [];
                        // Keep unpaid served/delivered/completed orders visible, filter out paid+completed and cancelled
                        final orders = allOrders.where((o) {
                          if (o.status == OrderStatus.cancelled) return false;
                          // Only hide delivered+paid orders (fully done)
                          if (o.status == OrderStatus.delivered && o.paymentStatus == 'paid') return false;
                          return true;
                        }).toList();
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

                            // Bulk payment section - consolidated receipt
                            if (!allPaid) ...[
                              Builder(builder: (context) {
                                final unpaidOrders = orders.where((o) => 
                                  o.paymentStatus != 'paid' && 
                                  (o.status == OrderStatus.served || o.status == OrderStatus.delivered || o.status == OrderStatus.ready)
                                ).toList();
                                final unpaidTotal = unpaidOrders.fold<double>(0, (sum, o) => sum + o.totalAmount);
                                
                                if (unpaidOrders.isEmpty) return const SizedBox.shrink();
                                
                                return Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [Colors.amber.shade700, Colors.amber.shade700],
                                    ),
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(color: Colors.amber.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4)),
                                    ],
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(16),
                                      onTap: () => _showConsolidatedPaymentSheet(
                                        context,
                                        unpaidOrders,
                                        unpaidTotal,
                                        session.tableNumber,
                                      ),
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                        child: Row(
                                          children: [
                                            const Icon(Icons.receipt_long, size: 24, color: Colors.white),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  const Text(
                                                    '🧾 Toptan Hesap Öde',
                                                    style: TextStyle(
                                                      fontSize: 16,
                                                      fontWeight: FontWeight.w900,
                                                      color: Colors.white,
                                                    ),
                                                  ),
                                                  Text(
                                                    '${unpaidOrders.length} açık sipariş',
                                                    style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.8)),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                              decoration: BoxDecoration(
                                                color: Colors.white.withOpacity(0.2),
                                                borderRadius: BorderRadius.circular(12),
                                              ),
                                              child: Text(
                                                '€${unpaidTotal.toStringAsFixed(2)}',
                                                style: const TextStyle(
                                                  fontSize: 20,
                                                  fontWeight: FontWeight.w900,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 4),
                                            const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.white70),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }),
                              const SizedBox(height: 12),
                            ],

                            // Individual orders
                            ...orders.map((order) {
                              final isPaid = order.paymentStatus == 'paid';
                              final statusConfig = <OrderStatus, Map<String, dynamic>>{
                                OrderStatus.pending: {'label': '⏳ Beklemede', 'color': Colors.yellow.shade700, 'bg': Colors.yellow.shade50},
                                OrderStatus.preparing: {'label': '👨‍🍳 Hazırlanıyor', 'color': Colors.amber.shade700, 'bg': Colors.amber.shade50},
                                OrderStatus.ready: {'label': '📦 Hazır', 'color': Colors.green.shade700, 'bg': Colors.green.shade50},
                                OrderStatus.served: {'label': '🍽️ Servis Edildi', 'color': Colors.teal.shade700, 'bg': Colors.teal.shade50},
                                OrderStatus.delivered: {'label': '🍽️ Servis Edildi', 'color': Colors.teal.shade700, 'bg': Colors.teal.shade50},
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
                                            label: const Text('🍽️ Servis Et', style: TextStyle(fontWeight: FontWeight.w700)),
                                            style: FilledButton.styleFrom(
                                              backgroundColor: Colors.teal.shade600,
                                              padding: const EdgeInsets.symmetric(vertical: 10),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            ),
                                            onPressed: () async {
                                              try {
                                                final user = FirebaseAuth.instance.currentUser;
                                                if (user == null) return;
                                                await _orderService.markAsServed(
                                                  orderId: order.id,
                                                  waiterId: user.uid,
                                                  waiterName: _staffName.isNotEmpty ? _staffName : 'Garson',
                                                );
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
                                    // Payment collection buttons for served/delivered/completed unpaid orders
                                    if ((order.status == OrderStatus.served || order.status == OrderStatus.delivered) && !isPaid)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 10),
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: FilledButton.icon(
                                                icon: const Icon(Icons.money, size: 16),
                                                label: const Text('💵 Nakit', style: TextStyle(fontWeight: FontWeight.w700)),
                                                style: FilledButton.styleFrom(
                                                  backgroundColor: Colors.green.shade700,
                                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                                ),
                                                onPressed: () async {
                                                  try {
                                                    await _orderService.updatePaymentStatus(
                                                      orderId: order.id,
                                                      paymentStatus: 'paid',
                                                      paymentMethod: 'cash',
                                                    );
                                                    if (mounted) {
                                                      HapticFeedback.mediumImpact();
                                                      ScaffoldMessenger.of(context).showSnackBar(
                                                        SnackBar(
                                                          content: const Text('✅ Nakit ödeme alındı!'),
                                                          backgroundColor: Colors.green.shade700,
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
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: FilledButton.icon(
                                                icon: const Icon(Icons.credit_card, size: 16),
                                                label: const Text('💳 Kart', style: TextStyle(fontWeight: FontWeight.w700)),
                                                style: FilledButton.styleFrom(
                                                  backgroundColor: Colors.blue.shade700,
                                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                                ),
                                                onPressed: () async {
                                                  try {
                                                    await _orderService.updatePaymentStatus(
                                                      orderId: order.id,
                                                      paymentStatus: 'paid',
                                                      paymentMethod: 'card',
                                                    );
                                                    if (mounted) {
                                                      HapticFeedback.mediumImpact();
                                                      ScaffoldMessenger.of(context).showSnackBar(
                                                        SnackBar(
                                                          content: const Text('✅ Kart ödeme alındı!'),
                                                          backgroundColor: Colors.blue.shade700,
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
                                          ],
                                        ),
                                      ),
                                    // Served by info
                                    if ((order.status == OrderStatus.served || order.status == OrderStatus.delivered) && order.servedByName != null && order.servedByName!.isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 8),
                                        child: Row(
                                          children: [
                                            Icon(Icons.person, size: 14, color: Colors.amber[700]),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${order.servedByName} tarafından servis edildi',
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.amber[700],
                                                fontStyle: FontStyle.italic,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    // Green paid chip with timestamp
                                    if (isPaid)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 6),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(
                                            color: Colors.green.withValues(alpha: 0.15),
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: Colors.green.withValues(alpha: 0.4)),
                                          ),
                                          child: Row(
                                            children: [
                                              Icon(
                                                order.paymentMethod == 'card' ? Icons.credit_card : Icons.payments,
                                                size: 15,
                                                color: Colors.green,
                                              ),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  '✅ Ödendi${order.paymentMethod == 'card' ? ' (Kart)' : order.paymentMethod == 'cash' ? ' (Nakit)' : ''}',
                                                  style: const TextStyle(
                                                    color: Colors.green,
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 12,
                                                  ),
                                                ),
                                              ),
                                              Text(
                                                '${order.updatedAt.toLocal().hour.toString().padLeft(2, '0')}:${order.updatedAt.toLocal().minute.toString().padLeft(2, '0')}',
                                                style: TextStyle(
                                                  color: Colors.green.withValues(alpha: 0.7),
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
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

/// Blinking dot widget for unpaid served tables
class _BlinkingDot extends StatefulWidget {
  final Color color;
  final double size;
  const _BlinkingDot({required this.color, this.size = 8});

  @override
  State<_BlinkingDot> createState() => _BlinkingDotState();
}

class _BlinkingDotState extends State<_BlinkingDot> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Opacity(
        opacity: 0.3 + (_ctrl.value * 0.7),
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            color: widget.color,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
