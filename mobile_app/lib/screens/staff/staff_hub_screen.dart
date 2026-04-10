import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/driver_provider.dart';
import '../../services/staff_role_service.dart';
import '../../services/kermes_assignment_service.dart';
import '../../services/shift_service.dart';
import 'providers/staff_hub_provider.dart';
import 'tabs/shift_dashboard_tab.dart';
import 'tabs/courier_tab.dart';
import 'tabs/waiter_tables_tab.dart';
import 'tabs/finance_wallet_tab.dart';
import 'staff_reservations_screen.dart';
import '../../widgets/qr_scanner_screen.dart';
import 'providers/staff_notifications_provider.dart';
import 'staff_notifications_screen.dart';
import 'helpers/shift_dialogs.dart';
import '../kermes/kermes_unified_kds_screen.dart';
import '../kermes/kermes_tezgah_screen.dart';
import 'tabs/staff_pos_wrapper_tab.dart';
import 'tabs/parking_management_tab.dart';
import '../profile/widgets/workplace_selector_sheet.dart';

class StaffHubScreen extends ConsumerStatefulWidget {
  const StaffHubScreen({super.key});

  @override
  ConsumerState<StaffHubScreen> createState() => _StaffHubScreenState();
}

class _StaffHubScreenState extends ConsumerState<StaffHubScreen> {
  int _selectedNavIndex = 0;
  final ShiftService _shiftService = ShiftService();
  Timer? _shiftTimer;
  final ValueNotifier<Duration> _shiftElapsedNotifier = ValueNotifier(Duration.zero);
  bool _shiftLoading = false;

  @override
  void initState() {
    super.initState();
    _startTimerFresh();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(staffCapabilitiesProvider.notifier).reload();
    });
  }

  @override
  void dispose() {
    _shiftTimer?.cancel();
    _shiftElapsedNotifier.dispose();
    super.dispose();
  }

  void _startTimerFresh() {
    _shiftTimer?.cancel();
    _shiftTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_shiftService.isOnShift && _shiftService.shiftStartedAt != null && _shiftService.shiftStatus != 'paused') {
        _shiftElapsedNotifier.value = DateTime.now().difference(_shiftService.shiftStartedAt!);
      }
    });
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  void _handleWorkplaceSwitch() async {
    final roleService = StaffRoleService();

    List<KermesAssignment> kermeses = [];
    try {
      kermeses = await KermesAssignmentService.getActiveAssignedKermeses()
          .timeout(const Duration(seconds: 10));
    } catch (_) {}

    final baseId = roleService.businessId;
    if (baseId != null) {
      kermeses.removeWhere((k) => k.id == baseId);
    }

    final hasBaseRestaurant = roleService.businessId != null && roleService.businessType != 'kermes';
    final totalOptions = (hasBaseRestaurant ? 1 : 0) + kermeses.length;

    if (!mounted) return;

    if (totalOptions > 1) {
      showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
        builder: (ctx) => WorkplaceSelectorSheet(
          baseBusinessName: hasBaseRestaurant ? (roleService.businessName ?? 'Isletme') : null,
          kermeses: kermeses,
          onSelected: (id, name, type) {
            if (id.isEmpty) {
              roleService.clearOverride();
            } else {
              roleService.setOverrideWorkplace(id, name, type);
            }
            ref.read(staffCapabilitiesProvider.notifier).reload();
          },
        ),
      );
    } else if (kermeses.isNotEmpty) {
      roleService.setOverrideWorkplace(kermeses.first.id, kermeses.first.title, 'kermes');
      ref.read(staffCapabilitiesProvider.notifier).reload();
    }
  }

  void _handleRoleSettings() async {
    final capabilities = ref.read(staffCapabilitiesProvider);
    if (!_shiftService.isOnShift) return;

    final result = await ShiftDialogs.showRoleSelectionSheet(
      context: context,
      hasTables: capabilities.hasTablesRole,
      isDriver: capabilities.hasCourierRole,
      maxTables: capabilities.maxTables,
      assignedTables: capabilities.assignedTables,
      kermesPrepZones: capabilities.kermesPrepZones,
      isUpdating: true,
      currentMasa: _shiftService.currentTables.isNotEmpty,
      currentKurye: _shiftService.isDeliveryDriver,
      currentDiger: _shiftService.isOtherRole,
      currentTables: _shiftService.currentTables,
      currentPrepZones: _shiftService.currentPrepZones,
    );
    if (result == null) return;

    if (result['endShift'] == true) {
      HapticFeedback.heavyImpact();
      final summary = await _shiftService.endShift();
      _shiftTimer?.cancel();
      _shiftElapsedNotifier.value = Duration.zero;
      if (mounted && summary != null) {
        ShiftDialogs.showShiftSummaryDialog(context, summary);
      }
      if (mounted) setState(() {});
      return;
    }

    HapticFeedback.heavyImpact();
    await _shiftService.updateShiftRoles(
      tables: result['tables'] as List<int>,
      isDeliveryDriver: result['isDeliveryDriver'] as bool,
      isOtherRole: result['isDiger'] as bool,
      prepZones: (result['prepZones'] as List<dynamic>).map((e) => e.toString()).toList(),
    );
    if (mounted) setState(() {});
  }

  // ----- SHIFT CONTROLS (center of bottom nav) -----

  Future<void> _handleStartShift() async {
    try {
      final capabilities = ref.read(staffCapabilitiesProvider);
      if (capabilities.businessId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Isletme bilgisi bulunamadi.'), backgroundColor: Colors.red),
          );
        }
        return;
      }
      final result = await ShiftDialogs.showRoleSelectionSheet(
        context: context,
        hasTables: capabilities.hasTablesRole,
        isDriver: capabilities.hasCourierRole,
        maxTables: capabilities.maxTables,
        assignedTables: capabilities.assignedTables,
        kermesPrepZones: capabilities.kermesPrepZones,
      );
      if (result == null) return;

      if (mounted) setState(() => _shiftLoading = true);
      HapticFeedback.heavyImpact();
      final shiftId = await _shiftService.startShift(
        businessId: capabilities.businessId!,
        staffName: capabilities.staffName,
        tables: result['tables'] as List<int>,
        isDeliveryDriver: result['isDeliveryDriver'] as bool,
        isOtherRole: result['isDiger'] as bool,
        prepZones: (result['prepZones'] as List<dynamic>).map((e) => e.toString()).toList(),
      );
      if (shiftId != null) _startTimerFresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _shiftLoading = false);
    }
  }

  Future<void> _handlePauseResumeShift() async {
    if (mounted) setState(() => _shiftLoading = true);
    HapticFeedback.mediumImpact();
    if (_shiftService.shiftStatus == 'paused') {
      await _shiftService.resumeShift();
    } else {
      await _shiftService.pauseShift();
    }
    if (mounted) setState(() => _shiftLoading = false);
  }

  Future<void> _handleEndShift() async {
    final tables = _shiftService.currentTables;
    final isDriver = _shiftService.isDeliveryDriver;
    final isDiger = _shiftService.isOtherRole;
    final prepZones = _shiftService.currentPrepZones;
    final elapsedStr = _formatDuration(_shiftElapsedNotifier.value);

    final tasks = <Map<String, dynamic>>[];
    if (tables.isNotEmpty) tasks.add({'id': 'masa', 'name': 'Masa Servisi', 'elapsedText': elapsedStr});
    if (isDriver) tasks.add({'id': 'kurye', 'name': 'Kurye Gorevi', 'elapsedText': elapsedStr});
    if (isDiger) tasks.add({'id': 'diger', 'name': 'Diger Gorevler', 'elapsedText': elapsedStr});
    for (var zone in prepZones) {
      tasks.add({'id': 'prep_$zone', 'name': 'Ocakbasi: $zone', 'zone': zone, 'elapsedText': elapsedStr});
    }

    if (tasks.length <= 1) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Mesai Bitir'),
          content: const Text('Mesainizi bitirmek istediginize emin misiniz?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Iptal')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              child: const Text('Bitir'),
            ),
          ],
        ),
      );
      if (confirm != true) return;
      await _executeEndShift();
    } else {
      final result = await ShiftDialogs.showEndShiftActionSheet(
        context: context,
        tasks: tasks,
      );
      if (result == null) return;
      if (result == 'all') {
        await _executeEndShift();
      } else {
        await _executeEndSpecificTask(result, tables, isDriver, isDiger, prepZones);
      }
    }
  }

  Future<void> _executeEndShift() async {
    if (mounted) setState(() => _shiftLoading = true);
    HapticFeedback.heavyImpact();
    final summary = await _shiftService.endShift();
    _shiftTimer?.cancel();
    _shiftElapsedNotifier.value = Duration.zero;
    if (mounted) {
      setState(() => _shiftLoading = false);
      if (summary != null) {
        ShiftDialogs.showShiftSummaryDialog(context, summary);
      }
    }
  }

  Future<void> _executeEndSpecificTask(String taskId, List<int> tables, bool isDriver, bool isDiger, List<String> prepZones) async {
    if (mounted) setState(() => _shiftLoading = true);
    HapticFeedback.heavyImpact();

    List<int> newTables = List.from(tables);
    bool newIsDriver = isDriver;
    bool newIsDiger = isDiger;
    List<String> newPrepZones = List.from(prepZones);

    if (taskId == 'masa') {
      newTables.clear();
    } else if (taskId == 'kurye') {
      newIsDriver = false;
    } else if (taskId == 'diger') {
      newIsDiger = false;
    } else if (taskId.startsWith('prep_')) {
      final zone = taskId.substring(5);
      newPrepZones.remove(zone);
    }

    await _shiftService.updateShiftRoles(
      tables: newTables,
      isDeliveryDriver: newIsDriver,
      isOtherRole: newIsDiger,
      prepZones: newPrepZones,
    );

    if (mounted) setState(() => _shiftLoading = false);
  }

  void _openQrScanner(String? businessId) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (context) => const QRScannerScreen(
        prompt: 'Siparis / Fatura QR Oku',
      ),
    )).then((scannedText) {
      if (scannedText != null && scannedText is String && scannedText.isNotEmpty) {
        final query = Uri(path: '/kermesler', queryParameters: {
          'scannedOrder': scannedText,
          'businessId': businessId,
        }).toString();
        context.push(query);
      }
    });
  }

  Widget _buildShiftLockedPlaceholder(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_clock, size: 64, color: isDark ? Colors.white24 : Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              'Mesaiye baslayin',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? Colors.white54 : Colors.grey[600]),
            ),
            const SizedBox(height: 8),
            Text(
              'Bu alana erisebilmek icin mesainizi baslatmaniz gerekiyor.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: isDark ? Colors.white38 : Colors.grey[500]),
            ),
          ],
        ),
      ),
    );
  }

  // ----- BOTTOM NAV CENTER SHIFT WIDGET -----
  Widget _buildCenterShiftControl(bool isDark) {
    final onShift = _shiftService.isOnShift;
    final isPaused = _shiftService.shiftStatus == 'paused';

    if (_shiftLoading) {
      return Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[200],
          shape: BoxShape.circle,
        ),
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    // Mesai baslamadi -> yesil play butonu
    if (!onShift) {
      return GestureDetector(
        onTap: _handleStartShift,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF43A047), Color(0xFF66BB6A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: Colors.green.withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4)),
            ],
          ),
          child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 32),
        ),
      );
    }

    // Mesai aktif -> tek clean buton (timer) tiklaninca sheet acar
    final accentColor = isPaused ? Colors.orange : Colors.green;

    return GestureDetector(
      onTap: () => _showShiftActionsSheet(isDark),
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: accentColor.withOpacity(0.15),
          border: Border.all(color: accentColor.withOpacity(0.5), width: 2),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: accentColor.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 3)),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isPaused ? Icons.pause_circle_filled : Icons.timer,
              color: accentColor,
              size: 20,
            ),
            Text(
              _formatDuration(_shiftElapsedNotifier.value),
              style: TextStyle(
                color: accentColor,
                fontSize: 9,
                fontWeight: FontWeight.w900,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showShiftActionsSheet(bool isDark) {
    final isPaused = _shiftService.shiftStatus == 'paused';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle
                Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(color: Colors.grey[500], borderRadius: BorderRadius.circular(2)),
                ),
                // Timer display
                Text(
                  _formatDuration(_shiftElapsedNotifier.value),
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: isPaused ? Colors.orange : Colors.green,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                if (isPaused)
                  Text('Mola', style: TextStyle(fontSize: 13, color: Colors.orange[300], fontWeight: FontWeight.w600)),
                const SizedBox(height: 20),
                // 1. Gorevleri Guncelle
                _buildSheetAction(
                  icon: Icons.settings_suggest,
                  label: 'Gorevleri Guncelle',
                  color: Colors.blueAccent,
                  isDark: isDark,
                  onTap: () {
                    Navigator.pop(ctx);
                    _handleRoleSettings();
                  },
                ),
                const SizedBox(height: 10),
                // 2. Mola Ver / Devam Et
                _buildSheetAction(
                  icon: isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded,
                  label: isPaused ? 'Devam Et' : 'Mola Ver',
                  color: isPaused ? Colors.green : Colors.orange,
                  isDark: isDark,
                  onTap: () {
                    Navigator.pop(ctx);
                    _handlePauseResumeShift();
                  },
                ),
                const SizedBox(height: 10),
                // 3. Mesai Bitir
                _buildSheetAction(
                  icon: Icons.stop_rounded,
                  label: 'Mesai Bitir',
                  color: Colors.redAccent,
                  isDark: isDark,
                  onTap: () {
                    Navigator.pop(ctx);
                    _handleEndShift();
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSheetAction({
    required IconData icon,
    required String label,
    required Color color,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: color.withOpacity(isDark ? 0.12 : 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Text(
              label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const Spacer(),
            Icon(Icons.chevron_right, color: color.withOpacity(0.5), size: 20),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final capabilities = ref.watch(staffCapabilitiesProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final driverState = ref.watch(driverProvider);
    final unreadCountAsync = ref.watch(staffUnreadNotificationsCountProvider);
    final unreadCount = unreadCountAsync.value ?? 0;

    final bool isOnShift = _shiftService.isOnShift;
    final bool showQr = capabilities.kermesAllowedSections.isNotEmpty || capabilities.hasFinanceRole;

    List<Widget> tabs = [];
    List<BottomNavigationBarItem> navItems = [];

    // ========================================
    // OPERATIF TAB'LAR - mesai aktif degilse kilitli
    // ========================================

    // 1. KDS / Mutfak Tab
    if (capabilities.kermesPrepZones.isNotEmpty && capabilities.businessId != null) {
      tabs.add(isOnShift
          ? KermesUnifiedKdsScreen(
              kermesId: capabilities.businessId!,
              kermesName: capabilities.businessName,
              allowedSections: capabilities.kermesAllowedSections,
            )
          : _buildShiftLockedPlaceholder(isDark));
      navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.kitchen), label: 'Mutfak'));
    }

    // 2. Tezgah Tab
    if (capabilities.hasTezgahRole && capabilities.businessId != null) {
      tabs.add(isOnShift
          ? KermesTezgahScreen(
              kermesId: capabilities.businessId!,
              kermesName: capabilities.businessName,
              tezgahName: capabilities.tezgahName.isNotEmpty ? capabilities.tezgahName : 'T1',
              allowedSections: capabilities.kermesAllowedSections,
            )
          : _buildShiftLockedPlaceholder(isDark));
      navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.storefront), label: 'Tezgah'));
    }

    // 3. POS Tab
    if (capabilities.hasPosRole && capabilities.businessId != null) {
      tabs.add(isOnShift
          ? StaffPosWrapperTab(
              kermesId: capabilities.businessId!,
              staffId: capabilities.userId,
              staffName: capabilities.staffName,
              allowedSections: capabilities.kermesAllowedSections,
            )
          : _buildShiftLockedPlaceholder(isDark));
      navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.point_of_sale), label: 'POS'));
    }

    // --- SOL TARAF BITTI, ORTAYA SPACER EKLE ---
    final int leftCount = tabs.length;

    // Spacer for center shift control
    tabs.add(const SizedBox.shrink());
    navItems.add(const BottomNavigationBarItem(icon: SizedBox(width: 24, height: 24), label: ''));

    // --- SAG TARAF BASLIYOR ---

    // 4. Courier Tab
    if (capabilities.isDriver && capabilities.businessId != null) {
      tabs.add(isOnShift
          ? CourierTab(businessIds: [capabilities.businessId!], userId: capabilities.userId, isDark: isDark)
          : _buildShiftLockedPlaceholder(isDark));
      navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.delivery_dining), label: 'Kurye'));
    }

    // 5. Waiter Tab
    if (capabilities.hasTablesRole && capabilities.businessId != null) {
      tabs.add(isOnShift
          ? WaiterTablesTab(
              businessId: capabilities.businessId!,
              isDark: isDark,
              onTableSelected: (session, num) {
                final query = Uri(path: '/waiter-order', queryParameters: {
                  'businessId': capabilities.businessId,
                  'businessName': capabilities.businessName,
                  'tableNumber': num.toString(),
                }).toString();
                context.push(query);
              },
              onEmptyTableSelected: (num) {
                final query = Uri(path: '/waiter-order', queryParameters: {
                  'businessId': capabilities.businessId,
                  'businessName': capabilities.businessName,
                  'tableNumber': num.toString(),
                }).toString();
                context.push(query);
              },
              onWalkinOrderSelected: () {
                final query = Uri(path: '/waiter-order', queryParameters: {
                  'businessId': capabilities.businessId,
                  'businessName': capabilities.businessName,
                }).toString();
                context.push(query);
              },
            )
          : _buildShiftLockedPlaceholder(isDark));
      navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.table_restaurant), label: 'Masalar'));
    }

    // 6. Reservations Tab
    if (capabilities.hasReservation && capabilities.businessId != null) {
      tabs.add(const StaffReservationsScreen(hideAppBar: true));
      navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.book_online), label: 'Rezervasyon'));
    }

    // 7. Park Yonetimi Tab
    if (capabilities.hasParkRole && capabilities.businessId != null) {
      tabs.add(ParkingManagementTab(kermesId: capabilities.businessId!, kermesName: capabilities.businessName));
      navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.local_parking), label: 'Park'));
    }

    // 8. Finance Tab
    if (capabilities.hasFinanceRole && capabilities.businessId != null) {
      tabs.add(FinanceWalletTab(userId: capabilities.userId, isDark: isDark, driverState: driverState));
      navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet), label: 'Kasa'));
    }

    // 9. Shift Dashboard (Mesai - en sonda)
    tabs.add(const ShiftDashboardTab());
    navItems.add(const BottomNavigationBarItem(icon: Icon(Icons.timer), label: 'Mesai'));

    if (_selectedNavIndex >= tabs.length) {
      _selectedNavIndex = 0;
    }

    // Center spacer index
    final int centerIndex = leftCount;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5),
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    capabilities.staffName.isNotEmpty ? capabilities.staffName : 'Personel Paneli',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                  if (capabilities.businessName.isNotEmpty)
                    Text(
                      capabilities.businessName,
                      style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black54),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // QR buton
          if (showQr)
            IconButton(
              icon: const Icon(Icons.qr_code_scanner, size: 22),
              onPressed: () => _openQrScanner(capabilities.businessId),
              tooltip: 'QR Tara',
            ),
          // Bildirim zili - en sagda
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications),
                onPressed: () {
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const StaffNotificationsScreen(),
                  ));
                },
                tooltip: 'Bildirimler',
              ),
              if (unreadCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Colors.redAccent,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                    child: Text(
                      unreadCount > 99 ? '99+' : unreadCount.toString(),
                      style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: tabs.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : tabs.length == 1
              ? tabs.first
              : IndexedStack(
                  index: _selectedNavIndex,
                  children: tabs,
                ),
      bottomNavigationBar: navItems.length >= 2
          ? Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.topCenter,
              children: [
                BottomNavigationBar(
                  currentIndex: _selectedNavIndex,
                  onTap: (index) {
                    // Skip center spacer
                    if (index == centerIndex) return;
                    setState(() => _selectedNavIndex = index);
                  },
                  type: BottomNavigationBarType.fixed,
                  items: navItems,
                  backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                  selectedItemColor: Colors.blueAccent,
                  unselectedItemColor: Colors.grey,
                  selectedFontSize: 11,
                  unselectedFontSize: 11,
                ),
                // Center shift control button - overlayed
                Positioned(
                  top: -16,
                  child: ValueListenableBuilder<Duration>(
                    valueListenable: _shiftElapsedNotifier,
                    builder: (context, elapsed, _) => _buildCenterShiftControl(isDark),
                  ),
                ),
              ],
            )
          : null,
    );
  }
}
