import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:geolocator/geolocator.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../services/shift_service.dart';
import '../providers/staff_hub_provider.dart';


class ShiftDashboardTab extends ConsumerStatefulWidget {
  const ShiftDashboardTab({super.key});

  @override
  ConsumerState<ShiftDashboardTab> createState() => _ShiftDashboardTabState();
}

class _ShiftDashboardTabState extends ConsumerState<ShiftDashboardTab> {
  final ShiftService _shiftService = ShiftService();
  bool _shiftLoading = false;

  int _pastTotalActiveMin = 0;
  int _pastTodayActiveMin = 0;
  int _pastTodayPauseMin = 0;
  Map<String, int> _pastTodayRoleActiveMin = {};

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
      Map<String, int> todayRoles = {};

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

          if (active > 0) {
            final pZones = List<String>.from(s['assignedPrepZones'] ?? []);
            final tables = List<int>.from(s['assignedTables'] ?? []);
            final isDriver = s['isDeliveryDriver'] == true;
            final isOther = s['isOtherRole'] == true;

            List<String> roleTokens = [];
            if (pZones.isNotEmpty) roleTokens.addAll(pZones);
            if (isDriver) roleTokens.add('Sürücü');
            if (tables.isNotEmpty) roleTokens.add('Garson');
            if (isOther && roleTokens.isEmpty) roleTokens.add('Diğer');
            if (roleTokens.isEmpty) roleTokens.add('Genel Alan');
            
            for (var t in roleTokens) {
               todayRoles[t] = (todayRoles[t] ?? 0) + active;
            }
          }
        }
      }

      if (mounted) {
        setState(() {
          _pastTotalActiveMin = tTotal;
          _pastTodayActiveMin = tTodayActive;
          _pastTodayPauseMin = tTodayPause;
          _pastTodayRoleActiveMin = todayRoles;
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
    if (mounted) setState(() => _shiftLoading = false);
  }

  @override
  void dispose() {
    super.dispose();
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
              const SizedBox(height: 24),
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

  void _showColleaguesPopup(BuildContext context, String roleOrZone, String kermesId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return _buildColleaguesSheet(roleOrZone, kermesId);
      },
    );
  }

  Widget _buildColleaguesSheet(String roleOrZone, String kermesId) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(20),
      height: MediaQuery.of(context).size.height * 0.6,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 5,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: Colors.grey.withOpacity(0.3),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          Text(
            '$roleOrZone - Mesai Arkadaşları',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Text(
            'Bu görevde / bölümde bulunan diğer personeller.',
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.white54 : Colors.black54,
            ),
            textAlign: TextAlign.center,
          ),
          const Divider(height: 30),
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _fetchColleagues(roleOrZone, kermesId),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text('Hata oluştu: ${snapshot.error}'));
                }
                final list = snapshot.data ?? [];
                if (list.isEmpty) {
                  return Center(
                    child: Text(
                      'Bu görevde başka personel bulunmuyor.',
                      style: TextStyle(color: isDark ? Colors.white54 : Colors.black54),
                    ),
                  );
                }
                return ListView.builder(
                  itemCount: list.length,
                  itemBuilder: (context, idx) {
                    final p = list[idx];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Colors.pink.withOpacity(0.1),
                        child: Text(
                          (p['name']?.isNotEmpty == true ? p['name']![0] : '?').toUpperCase(),
                          style: const TextStyle(color: Colors.pink, fontWeight: FontWeight.bold),
                        ),
                      ),
                      title: Row(
                        children: [
                          Flexible(
                            child: Text(p['name'] ?? 'İsimsiz Personel', style: TextStyle(color: isDark ? Colors.white : Colors.black), overflow: TextOverflow.ellipsis),
                          ),
                          const SizedBox(width: 8),
                          _buildStatusDot(p['status'] as String?),
                        ],
                      ),
                      subtitle: Text(p['phone'] ?? '', style: TextStyle(color: isDark ? Colors.white54 : Colors.black54)),
                    );
                  },
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.only(top: 15),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: isDark ? Colors.white10 : Colors.black12))),
            child: Wrap(
               spacing: 12,
               runSpacing: 8,
               alignment: WrapAlignment.center,
               children: [
                  _buildLegendItem(Colors.green, 'Aktif', isDark),
                  _buildLegendItem(Colors.orange, 'Mola', isDark),
                  _buildLegendItem(Colors.red, 'Mesai Bitti', isDark),
                  _buildLegendItem(Colors.grey, 'Başlamadı', isDark),
               ]
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusDot(String? status) {
    Color dotColor = Colors.grey;
    if (status == 'active') dotColor = Colors.green;
    else if (status == 'paused') dotColor = Colors.orange;
    else if (status == 'ended') dotColor = Colors.red;

    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
    );
  }

  Widget _buildLegendItem(Color color, String text, bool isDark) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(fontSize: 12, color: isDark ? Colors.white70 : Colors.black87)),
      ],
    );
  }

  Future<List<Map<String, dynamic>>> _fetchColleagues(String roleOrZone, String kermesId) async {
    final currentUserUid = FirebaseAuth.instance.currentUser?.uid;
    String? currentUserGender;
    if (currentUserUid != null) {
      try {
        final currentUserDoc = await FirebaseFirestore.instance.collection('users').doc(currentUserUid).get();
        if (currentUserDoc.exists) {
           currentUserGender = currentUserDoc.data()?['gender'] as String?;
        }
      } catch (e) {}
    }

    List<String> uids = [];
    
    final docSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(kermesId).get();
    if (docSnap.exists) {
      final data = docSnap.data()!;
      if (roleOrZone == 'Sürücü') {
        uids = List<String>.from(data['assignedDrivers'] ?? []);
      } else if (roleOrZone == 'Garson') {
        uids = List<String>.from(data['assignedWaiters'] ?? []);
      } else {
        // PrepZone or fallback
        final prepZoneAssignments = data['prepZoneAssignments'] as Map<String, dynamic>? ?? {};
        String? targetKey;
        for (final k in prepZoneAssignments.keys) {
          final mappedKey = k.replaceAll('Kadın', 'Hanımlar').replaceAll('Kadin', 'Hanimlar');
          if (mappedKey == roleOrZone || k == roleOrZone) {
            targetKey = k;
            break;
          }
        }
        
        if (targetKey != null) {
          uids = List<String>.from(prepZoneAssignments[targetKey] ?? []);
        } else {
          uids = List<String>.from(data['assignedStaff'] ?? []);
        }
      }
    }
    
    // We keep ourself in the list based on user request ('(Ben)')
    // uids.removeWhere((uid) => uid == currentUserUid);
    
    if (uids.isEmpty) return [];

    final now = DateTime.now();
    final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    
    Map<String, String> statusMap = {};
    for (var uid in uids) {
       statusMap[uid] = 'none';
    }

    for (int i = 0; i < uids.length; i += 10) {
      final chunk = uids.sublist(i, i + 10 > uids.length ? uids.length : i + 10);
      try {
        final aSnap = await FirebaseFirestore.instance.collection('admins').where(FieldPath.documentId, whereIn: chunk).get();
        for (var doc in aSnap.docs) {
          final d = doc.data();
          if (d['shiftBusinessId'] == kermesId && d['isOnShift'] == true) {
             statusMap[doc.id] = (d['shiftStatus'] == 'paused') ? 'paused' : 'active';
          }
        }
      } catch (e) {}

      try {
        final sSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(kermesId).collection('shifts')
            .where('date', isEqualTo: todayStr)
            .where('staffId', whereIn: chunk)
            .get();
        for (var doc in sSnap.docs) {
           final staffId = doc.data()['staffId'] as String;
           if (statusMap[staffId] == 'none') {
             statusMap[staffId] = 'ended';
           }
        }
      } catch(e) {}
    }
    
    List<Map<String, dynamic>> result = [];
    for (int i = 0; i < uids.length; i += 10) {
      final chunk = uids.sublist(i, i + 10 > uids.length ? uids.length : i + 10);
      try {
        final qSnap = await FirebaseFirestore.instance.collection('users').where(FieldPath.documentId, whereIn: chunk).get();
        for (var doc in qSnap.docs) {
           final d = doc.data();
           
           final userGender = (d['gender'] as String?)?.toLowerCase() ?? '';
           
           // Determine the required gender based on the section/zone tapped
           String? requiredGender;
           if (roleOrZone.contains('Kadın') || roleOrZone.contains('Kadin') || roleOrZone.contains('Hanımlar') || roleOrZone.contains('Hanimlar')) {
             requiredGender = 'female';
           } else if (roleOrZone.contains('Erkek')) {
             requiredGender = 'male';
           }
           
           // Normalize target colleague's gender
           String normalizedUserGender = userGender;
           if (normalizedUserGender == 'kadin' || normalizedUserGender == 'kadın') normalizedUserGender = 'female';
           if (normalizedUserGender == 'erkek') normalizedUserGender = 'male';

           if (requiredGender != null && normalizedUserGender.isNotEmpty && normalizedUserGender != requiredGender) {
             continue; // Skip opposite gender safely and robustly
           }

           result.add({
             'uid': doc.id,
             'name': (doc.id == currentUserUid) ? ((d['displayName'] ?? d['firstName'] ?? d['name'] ?? 'Adsız') + ' (Ben)') : (d['displayName'] ?? d['firstName'] ?? d['name'] ?? 'Adsız'),
             'phone': d['phone'] ?? d['phoneNumber'] ?? '',
             'status': statusMap[doc.id] ?? 'none',
           });
        }
      } catch(e) {
        // ignore
      }
    }
    
    result.sort((a, b) {
      if (a['uid'] == currentUserUid) return -1;
      if (b['uid'] == currentUserUid) return 1;
      return (a['name'] as String).compareTo(b['name'] as String);
    });

    return result;
  }

  Widget _buildAssignmentCard(StaffCapabilities capabilities, bool isDark) {
    if (capabilities.businessId == null) {
      return const SizedBox.shrink();
    }
    
    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance.collection('kermes_events').doc(capabilities.businessId).snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData || !snapshot.data!.exists) {
           return _renderAssignmentCardInner(capabilities, isDark);
        }
        
        final data = snapshot.data!.data() as Map<String, dynamic>;
        
        // Compute live roles and prep zones
        List<String> livePrepZones = [];
        final pz = data['prepZoneAssignments'] as Map<String, dynamic>? ?? {};
        final uid = FirebaseAuth.instance.currentUser?.uid;
        for (final entry in pz.entries) {
           final arr = List<String>.from(entry.value ?? []);
           if (arr.contains(uid)) livePrepZones.add(entry.key);
        }
        
        // Live Roles
        bool isDriver = List<String>.from(data['assignedDrivers'] ?? []).contains(uid);
        bool isWaiter = List<String>.from(data['assignedWaiters'] ?? []).contains(uid);
        
        // Custom Roles
        final customRolesData = data['customRoles'] as List<dynamic>? ?? [];
        final customAssignments = data['customRoleAssignments'] as Map<String, dynamic>? ?? {};
        List<Map<String, dynamic>> dynamicRoles = [];
        for (var cr in customRolesData) {
            final crId = cr['id'];
            final crName = cr['name'];
            final crIcon = cr['icon'];
            final assignedList = List<String>.from(customAssignments[crId] ?? []);
            if (assignedList.contains(uid)) {
                dynamicRoles.add({
                  'name': crName.toString(),
                  'icon': crIcon.toString(),
                });
            }
        }
        
        return _renderAssignmentCardInner(
          capabilities.copyWith(
            kermesPrepZones: livePrepZones,
            isDriver: isDriver,
            hasTablesRole: isWaiter,
          ), 
          isDark,
          dynamicRoles: dynamicRoles
        );
      }
    );
  }

  Widget _renderAssignmentCardInner(StaffCapabilities capabilities, bool isDark, {List<Map<String, dynamic>> dynamicRoles = const []}) {
    List<String> gorevler = [];
    if (capabilities.isDriver) gorevler.add("Sürücü");
    if (capabilities.hasTablesRole) gorevler.add("Garson");
    if (gorevler.isEmpty && capabilities.kermesAllowedSections.isEmpty) {
      gorevler.add("Kermes Görevlisi");
    }

    String bolumText = "Genel Alan";
    Map<String, String> ocakbasiMap = {}; 

    for (var s in capabilities.kermesAllowedSections) {
      if (s.contains('Kadın') || s.contains('Kadin') || s.contains('Hanım')) {
        bolumText = "Hanımlar Bölümü";
      } else if (s.contains('Erkek')) {
        bolumText = "Erkekler Bölümü";
      } else {
        if (bolumText == "Genel Alan") bolumText = s;
      }
    }

    for (var p in capabilities.kermesPrepZones) {
       String cleanName = p.replaceAll('Kadın Bölümü', '')
                           .replaceAll('Hanımlar Bölümü', '')
                           .replaceAll('Kadin Bölümü', '')
                           .replaceAll('Erkekler Bölümü', '')
                           .replaceAll('Erkek Bölümü', '')
                           .trim();
                           
       if (cleanName.startsWith('-')) cleanName = cleanName.substring(1).trim();
       if (cleanName.isEmpty) cleanName = p;
       
       ocakbasiMap[cleanName] = p; // Chip text -> real DB key for matching
    }

    final roleTitleLabel = gorevler.length > 1 ? "Görevleriniz:" : "Göreviniz:";

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
          const SizedBox(height: 15),
          if (bolumText.isNotEmpty) ...[
            _buildInfoRow('Bölüm:', bolumText, isDark),
            const SizedBox(height: 15),
          ],
          if (ocakbasiMap.isNotEmpty) ...[
            _buildCustomRow('Ocakbaşı:', ocakbasiMap.entries.map((e) => _buildClickableChip(e.key, e.value, capabilities.businessId, isDark)).toList(), isDark),
            const SizedBox(height: 15),
          ],
          if (gorevler.isNotEmpty || dynamicRoles.isNotEmpty) ...[
            _buildCustomRow(roleTitleLabel, [
                ...gorevler.map((g) => _buildClickableChip(g, g, capabilities.businessId, isDark)),
                ...dynamicRoles.map((g) => _buildClickableChip(g['name'] as String, g['name'] as String, capabilities.businessId, isDark)),
            ], isDark),
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

  Widget _buildCustomRow(String label, List<Widget> children, bool isDark) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 110, child: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(label, style: TextStyle(color: isDark ? Colors.white54 : Colors.black54, fontWeight: FontWeight.w500)),
        )),
        Expanded(
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: children,
          ),
        ),
      ],
    );
  }

  Widget _buildClickableChip(String label, String targetKey, String? businessId, bool isDark) {
    return InkWell(
      onTap: () {
         if (businessId != null) {
           _showColleaguesPopup(context, targetKey, businessId);
         }
      },
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isDark ? Colors.pink.withOpacity(0.15) : Colors.pink.shade50,
          border: Border.all(color: Colors.pink.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
               child: Text(
                 label,
                 style: TextStyle(
                   fontSize: 13,
                   fontWeight: FontWeight.bold,
                   color: isDark ? Colors.pink.shade200 : Colors.pink.shade700,
                 ),
                 overflow: TextOverflow.ellipsis,
               ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.touch_app, size: 14, color: isDark ? Colors.pink.shade200 : Colors.pink.shade700),
          ],
        ),
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
    // Removed realtime calculation to avoid UI jank since appbar pill does it anyway
    
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
          if (_pastTodayRoleActiveMin.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 15),
              child: Divider(height: 1),
            ),
            Text('Görev Dağılımı (Bugün)', 
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : Colors.black54)
            ),
            const SizedBox(height: 15),
            ..._pastTodayRoleActiveMin.entries.map((e) {
               String roleName = e.key;
               roleName = roleName.replaceAll('Kadın Bölümü', '')
                                  .replaceAll('Hanımlar Bölümü', '')
                                  .replaceAll('Kadin Bölümü', '')
                                  .replaceAll('Erkekler Bölümü', '')
                                  .replaceAll('Erkek Bölümü', '')
                                  .trim();
               if (roleName.startsWith('-')) roleName = roleName.substring(1).trim();
               if (roleName.isEmpty) roleName = e.key;

               final mins = e.value;
               final rStr = '${mins ~/ 60}s ${mins % 60}dk';
               
               final fraction = todayMin > 0 ? (mins / todayMin).clamp(0.0, 1.0) : 0.0;
               return Padding(
                 padding: const EdgeInsets.only(bottom: 12.0),
                 child: Column(
                   crossAxisAlignment: CrossAxisAlignment.start,
                   children: [
                     Row(
                       mainAxisAlignment: MainAxisAlignment.spaceBetween,
                       children: [
                         Text(roleName, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
                         Text(rStr, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : Colors.black54)),
                       ],
                     ),
                     const SizedBox(height: 6),
                     ClipRRect(
                       borderRadius: BorderRadius.circular(4),
                       child: Container(
                         height: 6,
                         color: isDark ? Colors.white10 : Colors.black12,
                         alignment: Alignment.centerLeft,
                         child: FractionallySizedBox(
                           widthFactor: fraction,
                           child: Container(
                             decoration: BoxDecoration(
                               color: _getRoleColor(roleName),
                               borderRadius: BorderRadius.circular(4),
                             ),
                           ),
                         ),
                       ),
                     ),
                   ],
                 ),
               );
            }),
          ]
        ],
      ),
    );
  }

  Color _getRoleColor(String roleName) {
    if (roleName.toLowerCase().contains('park')) return Colors.blueAccent;
    if (roleName.toLowerCase().contains('temizlik')) return Colors.purpleAccent;
    if (roleName.toLowerCase().contains('sürücü')) return Colors.orange;
    if (roleName.toLowerCase().contains('garson')) return Colors.green;
    return Colors.pinkAccent;
  }


}
