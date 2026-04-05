import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:geolocator/geolocator.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../services/shift_service.dart';
import '../providers/staff_hub_provider.dart';
import '../helpers/shift_dialogs.dart';

class ShiftDashboardTab extends ConsumerStatefulWidget {
  const ShiftDashboardTab({super.key});

  @override
  ConsumerState<ShiftDashboardTab> createState() => _ShiftDashboardTabState();
}

class _ShiftDashboardTabState extends ConsumerState<ShiftDashboardTab> {
  final ShiftService _shiftService = ShiftService();
  bool _shiftLoading = false;
  Timer? _shiftTimer;
  Duration _shiftElapsed = Duration.zero;

  int _pastTotalActiveMin = 0;
  int _pastTodayActiveMin = 0;
  int _pastTodayPauseMin = 0;

  Map<String, dynamic>? _weatherInfo;
  bool _weatherLoading = true;

  @override
  void initState() {
    super.initState();
    // Re-verify shift state just in case
    _reloadShiftState();
    _fetchWeather();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final capabilities = ref.read(staffCapabilitiesProvider);
      if (capabilities.businessId != null) {
        _loadStats(capabilities.businessId!);
      }
    });
  }

  Future<void> _loadStats(String businessId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      final shifts = await _shiftService.getShiftHistory(
        businessId: businessId,
        staffId: user.uid,
        limit: 100,
      );

      int tTotal = 0;
      int tTodayActive = 0;
      int tTodayPause = 0;

      final now = DateTime.now();
      final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

      for (final s in shifts) {
        final active = (s['totalMinutes'] as num?)?.toInt() ?? 0;
        final pause = (s['pauseMinutes'] as num?)?.toInt() ?? 0;
        final date = s['date'] as String?;

        tTotal += active;

        if (date == todayStr) {
          tTodayActive += active;
          tTodayPause += pause;
        }
      }

      if (mounted) {
        setState(() {
          _pastTotalActiveMin = tTotal;
          _pastTodayActiveMin = tTodayActive;
          _pastTodayPauseMin = tTodayPause;
        });
      }
    } catch (e) {
      debugPrint('Error loading stats: $e');
    }
  }

  Future<void> _fetchWeather() async {
    try {
      final locPermission = await Geolocator.checkPermission();
      if (locPermission == LocationPermission.denied || locPermission == LocationPermission.deniedForever) {
        if (mounted) setState(() => _weatherLoading = false);
        return;
      }

      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium);

      final url = 'https://api.open-meteo.com/v1/forecast?latitude=${pos.latitude}&longitude=${pos.longitude}&current_weather=true';
      final response = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() {
            _weatherInfo = data['current_weather'];
            _weatherLoading = false;
          });
        }
      } else {
        if (mounted) setState(() => _weatherLoading = false);
      }
    } catch (e) {
      debugPrint('Weather fetch error: $e');
      if (mounted) setState(() => _weatherLoading = false);
    }
  }

  Future<void> _reloadShiftState() async {
    setState(() => _shiftLoading = true);
    await _shiftService.restoreShiftState();
    _startTimerFresh();
    if (mounted) setState(() => _shiftLoading = false);
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
      }
    });
  }

  Future<void> _handleStartShift() async {
    try {
      final capabilities = ref.read(staffCapabilitiesProvider);
      if (capabilities.businessId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('İşletme bilgisi bulunamadı. Lütfen girişinizi kontrol edin.'), backgroundColor: Colors.red),
          );
        }
        return;
      }

      final hasTables = capabilities.hasTablesRole;
      final hasCourier = capabilities.hasCourierRole;

      // Scenario 1: No tables, no courier -> direct start
      if (!hasTables && !hasCourier) {
        if (mounted) setState(() => _shiftLoading = true);
        HapticFeedback.heavyImpact();
        final shiftId = await _shiftService.startShift(
          businessId: capabilities.businessId!,
          staffName: capabilities.staffName,
          tables: [],
          isOtherRole: true,
        );
        if (shiftId != null) _startTimerFresh();
        if (mounted) setState(() => _shiftLoading = false);
        return;
      }

      // Scenario 2: Has tables but no courier -> table selection only
      if (hasTables && !hasCourier) {
        final selectedTables = await ShiftDialogs.showTableSelectionSheet(
          context: context,
          maxTables: capabilities.maxTables,
          assignedTables: capabilities.assignedTables,
        );
        if (selectedTables == null) return;
        
        if (mounted) setState(() => _shiftLoading = true);
        HapticFeedback.heavyImpact();
        final shiftId = await _shiftService.startShift(
          businessId: capabilities.businessId!,
          staffName: capabilities.staffName,
          tables: selectedTables,
          isOtherRole: false,
        );
        if (shiftId != null) _startTimerFresh();
        if (mounted) setState(() => _shiftLoading = false);
        return;
      }

      // Scenario 3: Courier available -> role selection sheet
      final result = await ShiftDialogs.showRoleSelectionSheet(
        context: context,
        hasTables: capabilities.hasTablesRole,
        isDriver: capabilities.hasCourierRole,
        maxTables: capabilities.maxTables,
        assignedTables: capabilities.assignedTables,
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

  Future<void> _handlePauseShift() async {
    if (mounted) setState(() => _shiftLoading = true);
    HapticFeedback.mediumImpact();
    await _shiftService.pauseShift();
    if (mounted) setState(() => _shiftLoading = false);
  }

  Future<void> _handleResumeShift() async {
    if (mounted) setState(() => _shiftLoading = true);
    HapticFeedback.mediumImpact();
    await _shiftService.resumeShift();
    if (mounted) setState(() => _shiftLoading = false);
  }

  Future<void> _handleEndShift() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('staff.end_shift')),
        content: Text(tr('staff.confirm_end_shift')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(tr('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: Text(tr('common.finish')),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    if (mounted) setState(() => _shiftLoading = true);
    HapticFeedback.heavyImpact();

    final summary = await _shiftService.endShift();
    _shiftTimer?.cancel();
    _shiftElapsed = Duration.zero;

    if (mounted) {
      setState(() => _shiftLoading = false);
      final capabilities = ref.read(staffCapabilitiesProvider);
      if (capabilities.businessId != null) {
        _loadStats(capabilities.businessId!);
      }
      if (summary != null) {
        ShiftDialogs.showShiftSummaryDialog(context, summary);
      }
    }
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final capabilities = ref.watch(staffCapabilitiesProvider);
    
    ref.listen<StaffCapabilities>(staffCapabilitiesProvider, (prev, next) {
      if (prev?.businessId != next.businessId && next.businessId != null) {
        _loadStats(next.businessId!);
      }
    });
    
    bool onShift = _shiftService.isOnShift;
    bool onBreak = _shiftService.shiftStatus == 'paused';

    return Stack(
      children: [
        SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildAssignmentCard(capabilities, isDark),
              
              _buildStatsCard(isDark),

              const SizedBox(height: 10),
              Text(
                'Mesai Takibi',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 20),
              
              _buildShiftInfoCard(context, onShift, onBreak, isDark),
              const SizedBox(height: 24),

              if (!onShift)
                _buildActionBtn('Mesaiye Başla', Icons.play_arrow, Colors.green, _handleStartShift)
              else if (onBreak)
                _buildActionBtn('Molayı Bitir', Icons.play_arrow, Colors.orange, _handleResumeShift)
              else ...[
                _buildActionBtn('Mola Ver', Icons.pause, Colors.orange, _handlePauseShift),
                const SizedBox(height: 12),
                _buildActionBtn('Mesaiyi Bitir', Icons.stop, Colors.red, _handleEndShift),
              ],
            ],
          ),
        ),
        if (_shiftLoading)
          Positioned.fill(
            child: Container(
              color: Colors.black45,
              child: const Center(child: CircularProgressIndicator()),
            ),
          ),
      ],
    );
  }

  Widget _buildAssignmentCard(StaffCapabilities capabilities, bool isDark) {
    String roleText = "Kermes Görevlisi";
    if (capabilities.isDriver) roleText = "Sürücü";
    else if (capabilities.hasTablesRole) roleText = "Garson";
    else if (capabilities.kermesAllowedSections.isNotEmpty) {
      roleText = "Mutfak / Tezgah (${capabilities.kermesAllowedSections.join(', ')})";
    }

    return Container(
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          if (!isDark) BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.assignment_ind, color: Colors.blueAccent),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Görev Bilgileri',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                ),
              ),
            ],
          ),
          const Divider(height: 30),
          _buildInfoRow('Aktif Etkinlik:', capabilities.businessName.isNotEmpty ? capabilities.businessName : 'Bekleniyor...', isDark),
          const SizedBox(height: 10),
          _buildInfoRow('Göreviniz:', roleText, isDark),
          
          if (capabilities.kermesAllowedSections.isNotEmpty) ...[
            const SizedBox(height: 10),
            _buildInfoRow('Bölüm:', capabilities.kermesAllowedSections.join(', '), isDark),
          ],
          
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
               const Icon(Icons.cloud, size: 20, color: Colors.blueGrey),
               const SizedBox(width: 8),
               Expanded(
                 child: _weatherLoading 
                   ? Text("Hava durumu yükleniyor...", style: TextStyle(color: isDark ? Colors.white70 : Colors.black54))
                   : Text(
                       _weatherInfo != null 
                         ? '${_weatherInfo!['temperature']}°C (Rüzgar: ${_weatherInfo!['windspeed']} km/s)' 
                         : 'Hava durumu alınamadı',
                       style: TextStyle(fontSize: 15, color: isDark ? Colors.white : Colors.black87),
                     ),
               ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String val, bool isDark) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 110, child: Text(label, style: TextStyle(color: isDark ? Colors.white54 : Colors.black54, fontWeight: FontWeight.w500))),
        Expanded(child: Text(val, style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontWeight: FontWeight.bold))),
      ],
    );
  }

  Widget _buildStatsCard(bool isDark) {
    int currentActiveMs = 0;
    if (_shiftService.isOnShift && _shiftService.shiftStartedAt != null) {
        currentActiveMs = _shiftElapsed.inMinutes; // Approximate for ongoing shift without dynamically deducting real-time pause
    }
    
    final totalMin = _pastTotalActiveMin + currentActiveMs;
    final todayMin = _pastTodayActiveMin + currentActiveMs;
    final todayPause = _pastTodayPauseMin;

    final totalStr = '${totalMin ~/ 60}s ${totalMin % 60}dk';
    final todayStr = '${todayMin ~/ 60}s ${todayMin % 60}dk';
    final pauseStr = '${todayPause ~/ 60}s ${todayPause % 60}dk';

    return Container(
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          if (!isDark) BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.bar_chart, color: Colors.purpleAccent),
              const SizedBox(width: 12),
              Text('Çalışma İstatistikleri', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
            ],
          ),
          const Divider(height: 30),
          _buildInfoRow('Bugün Çalışma:', todayStr, isDark),
          const SizedBox(height: 10),
          _buildInfoRow('Bugün Mola:', pauseStr, isDark),
          const SizedBox(height: 10),
          _buildInfoRow('Top. Kermes Mesai:', totalStr, isDark),
        ],
      ),
    );
  }

  Widget _buildShiftInfoCard(BuildContext context, bool onShift, bool onBreak, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: onShift 
            ? (onBreak ? Colors.orange.withOpacity(0.1) : Colors.green.withOpacity(0.1)) 
            : (isDark ? const Color(0xFF1E1E1E) : Colors.white),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: onShift 
              ? (onBreak ? Colors.orange.withOpacity(0.3) : Colors.green.withOpacity(0.3)) 
              : Colors.transparent,
          width: 2,
        ),
        boxShadow: onShift ? [] : [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                onShift ? (onBreak ? Icons.pause_circle_filled : Icons.check_circle) : Icons.access_time_filled,
                color: onShift ? (onBreak ? Colors.orange : Colors.green) : Colors.grey,
                size: 28,
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    onShift ? (onBreak ? 'Mola Verildi' : 'Mesai Devam Ediyor') : 'Mesai Dışı',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: onShift ? (onBreak ? Colors.orange : Colors.green) : (isDark ? Colors.white : Colors.black87),
                    ),
                  ),
                  if (onShift && _shiftService.shiftStartedAt != null)
                    Text(
                      'Başlangıç: ${DateFormat('HH:mm').format(_shiftService.shiftStartedAt!)}',
                      style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : Colors.black54),
                    ),
                ],
              ),
            ],
          ),
          if (onShift) ...[
            const SizedBox(height: 24),
            Center(
              child: Text(
                _formatDuration(_shiftElapsed),
                style: TextStyle(
                  fontSize: 40,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ),
          ]
        ],
      ),
    );
  }

  Widget _buildActionBtn(String text, IconData icon, Color color, VoidCallback onTap) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 28),
        label: Text(text, style: const TextStyle(fontSize: 18)),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}
