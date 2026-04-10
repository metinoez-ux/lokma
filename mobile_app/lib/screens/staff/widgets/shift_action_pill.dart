import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../../services/shift_service.dart';
import '../providers/staff_hub_provider.dart';
import '../helpers/shift_dialogs.dart';

class ShiftActionPill extends ConsumerStatefulWidget {
  const ShiftActionPill({super.key});

  @override
  ConsumerState<ShiftActionPill> createState() => _ShiftActionPillState();
}

class _ShiftActionPillState extends ConsumerState<ShiftActionPill> {
  final ShiftService _shiftService = ShiftService();
  Timer? _shiftTimer;
  Duration _shiftElapsed = Duration.zero;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _startTimerFresh();
  }

  @override
  void dispose() {
    _shiftTimer?.cancel();
    super.dispose();
  }

  void _startTimerFresh() {
    _shiftTimer?.cancel();
    _shiftTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_shiftService.isOnShift && _shiftService.shiftStartedAt != null && _shiftService.shiftStatus != 'paused') {
        setState(() {
          _shiftElapsed = DateTime.now().difference(_shiftService.shiftStartedAt!);
        });
      } else {
        // We still need to update UI if it switches off or pauses
        setState(() {});
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

  Future<void> _handleStartShift() async {
    try {
      final capabilities = ref.read(staffCapabilitiesProvider);
      if (capabilities.businessId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('İşletme bilgisi bulunamadı.'), backgroundColor: Colors.red),
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
        kermesCustomRoles: capabilities.kermesCustomRoles,
      );
      if (result == null) return;

      if (mounted) setState(() => _isLoading = true);
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
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleUpdateRoles() async {
    final capabilities = ref.read(staffCapabilitiesProvider);
    final result = await ShiftDialogs.showRoleSelectionSheet(
      context: context,
      hasTables: capabilities.hasTablesRole,
      isDriver: capabilities.hasCourierRole,
      maxTables: capabilities.maxTables,
      assignedTables: capabilities.assignedTables,
      kermesPrepZones: capabilities.kermesPrepZones,
      kermesCustomRoles: capabilities.kermesCustomRoles,
      isUpdating: true,
      currentMasa: _shiftService.currentTables.isNotEmpty,
      currentKurye: _shiftService.isDeliveryDriver,
      currentDiger: _shiftService.isOtherRole,
      currentTables: _shiftService.currentTables,
      currentPrepZones: _shiftService.currentPrepZones,
    );
    if (result == null) return;

    if (result['endShift'] == true) {
      await _executeEndWholeShift();
      return;
    }

    if (mounted) setState(() => _isLoading = true);
    HapticFeedback.heavyImpact();
    await _shiftService.updateShiftRoles(
      tables: result['tables'] as List<int>,
      isDeliveryDriver: result['isDeliveryDriver'] as bool,
      isOtherRole: result['isDiger'] as bool,
      prepZones: (result['prepZones'] as List<dynamic>).map((e) => e.toString()).toList(),
    );
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _handlePauseResumeShift() async {
    if (mounted) setState(() => _isLoading = true);
    HapticFeedback.mediumImpact();
    if (_shiftService.shiftStatus == 'paused') {
      await _shiftService.resumeShift();
    } else {
      await _shiftService.pauseShift();
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _executeEndWholeShift() async {
    if (mounted) setState(() => _isLoading = true);
    HapticFeedback.heavyImpact();
    final summary = await _shiftService.endShift();
    _shiftTimer?.cancel();
    _shiftElapsed = Duration.zero;

    if (mounted) {
      setState(() => _isLoading = false);
      if (summary != null) {
        ShiftDialogs.showShiftSummaryDialog(context, summary);
      }
    }
  }

  Future<void> _executeEndSpecificTask(String taskId, List<int> tables, bool isDriver, bool isDiger, List<String> prepZones) async {
    if (mounted) setState(() => _isLoading = true);
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

    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _handleEndShift() async {
    final tables = _shiftService.currentTables;
    final isDriver = _shiftService.isDeliveryDriver;
    final isDiger = _shiftService.isOtherRole;
    final prepZones = _shiftService.currentPrepZones;

    final elapsedStr = _formatDuration(_shiftElapsed);

    final tasks = <Map<String, dynamic>>[];
    if (tables.isNotEmpty) tasks.add({'id': 'masa', 'name': 'Masa Servisi', 'elapsedText': elapsedStr});
    if (isDriver) tasks.add({'id': 'kurye', 'name': 'Kurye Görevi', 'elapsedText': elapsedStr});
    if (isDiger) tasks.add({'id': 'diger', 'name': 'Diğer Görevler', 'elapsedText': elapsedStr});
    for (var zone in prepZones) {
      tasks.add({'id': 'prep_$zone', 'name': 'Ocakbaşı: $zone', 'zone': zone, 'elapsedText': elapsedStr});
    }

    if (tasks.length <= 1) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(tr('staff.end_shift')),
          content: Text(tr('staff.confirm_end_shift')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(tr('common.cancel'))),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              child: Text(tr('common.finish')),
            ),
          ],
        ),
      );
      if (confirm != true) return;
      await _executeEndWholeShift();
    } else {
      final result = await ShiftDialogs.showEndShiftActionSheet(
        context: context,
        tasks: tasks,
      );
      if (result == null) return;
      if (result == 'all') {
        await _executeEndWholeShift();
      } else {
        await _executeEndSpecificTask(result, tables, isDriver, isDiger, prepZones);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        width: 20,
        height: 20,
        child: const CircularProgressIndicator(strokeWidth: 2, color: Colors.grey),
      );
    }

    final onShift = _shiftService.isOnShift;
    final isPaused = _shiftService.shiftStatus == 'paused';

    if (!onShift) {
      return Padding(
        padding: const EdgeInsets.only(right: 12.0),
        child: InkWell(
          onTap: _handleStartShift,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.12),
              border: Border.all(color: Colors.green.withOpacity(0.3)),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.play_arrow, color: Colors.green, size: 18),
                const SizedBox(width: 4),
                const Text(
                  'Mesaiye Başla',
                  style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(right: 12.0),
      child: Container(
        height: 32,
        decoration: BoxDecoration(
          color: isPaused ? Colors.orange.withOpacity(0.1) : Colors.green.withOpacity(0.1),
          border: Border.all(color: isPaused ? Colors.orange.withOpacity(0.3) : Colors.green.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            InkWell(
              onTap: _handleUpdateRoles,
              borderRadius: const BorderRadius.only(topLeft: Radius.circular(20), bottomLeft: Radius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Icon(Icons.settings_suggest, color: isPaused ? Colors.orange : Colors.blueAccent, size: 16),
              ),
            ),
            Container(width: 1, height: 20, color: (isPaused ? Colors.orange : Colors.green).withOpacity(0.3)),
            InkWell(
              onTap: _handlePauseResumeShift,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isPaused ? Icons.play_arrow : Icons.pause,
                      color: isPaused ? Colors.orange : Colors.green,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _formatDuration(_shiftElapsed),
                      style: TextStyle(
                        color: isPaused ? Colors.orange : Colors.green,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Container(width: 1, height: 20, color: (isPaused ? Colors.orange : Colors.green).withOpacity(0.3)),
            InkWell(
              onTap: _handleEndShift,
              borderRadius: const BorderRadius.only(topRight: Radius.circular(20), bottomRight: Radius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                child: const Icon(Icons.stop, color: Colors.redAccent, size: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
