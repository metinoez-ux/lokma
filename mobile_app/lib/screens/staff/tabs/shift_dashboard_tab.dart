import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:geolocator/geolocator.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:rxdart/rxdart.dart';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../services/shift_service.dart';
import '../../../services/staff_role_service.dart';
import '../providers/staff_hub_provider.dart';
import '../../kermes/staff/kermes_schedule_screen.dart';
import '../../kermes/staff/kermes_admin_roster_screen.dart';
import '../../kermes/staff/kermes_admin_staff_assignment_screen.dart';
import '../../kermes/staff/kermes_admin_vault_screen.dart';
import 'staff_handover_dialog.dart';

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

  DateTime? _lastPausedAt;
  Timer? _pauseTimer;

  Map<String, dynamic>? _weatherInfo;
  bool _weatherLoading = true;

  @override
  void initState() {
    super.initState();
    _reloadShiftState();
    _fetchWeather();
    _initPauseTracking();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final capabilities = ref.read(staffCapabilitiesProvider);
      if (capabilities.businessId != null) {
        _loadStats(capabilities.businessId!);
      }
    });
  }

  @override
  void dispose() {
    _pauseTimer?.cancel();
    super.dispose();
  }

  void _initPauseTracking() {
    // Eger shift paused ise, Firestore'dan pausedAt'i al
    if (_shiftService.shiftStatus == 'paused' &&
        _shiftService.currentShiftId != null &&
        _shiftService.currentBusinessId != null) {
      _fetchPausedAt();
    }
    // Her 30 saniyede mola sayacini guncelle
    _pauseTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_shiftService.shiftStatus == 'paused' && _lastPausedAt != null && mounted) {
        setState(() {}); // Rebuild to update pause counter
      }
    });
  }

  Future<void> _fetchPausedAt() async {
    try {
      final roleService = StaffRoleService();
      final isKermes = roleService.businessType == 'kermes';
      final parentCol = isKermes ? 'kermes_events' : 'businesses';
      final doc = await FirebaseFirestore.instance
          .collection(parentCol)
          .doc(_shiftService.currentBusinessId)
          .collection('shifts')
          .doc(_shiftService.currentShiftId)
          .get();
      if (doc.exists) {
        final pauseLog = List<Map<String, dynamic>>.from(
          (doc.data()?['pauseLog'] as List<dynamic>?) ?? [],
        );
        if (pauseLog.isNotEmpty && pauseLog.last['resumedAt'] == null) {
          final pausedAt = (pauseLog.last['pausedAt'] as Timestamp).toDate();
          if (mounted) setState(() => _lastPausedAt = pausedAt);
        }
      }
    } catch (e) {
      debugPrint('[Shift] Error fetching pausedAt: $e');
    }
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
        final status = s['status'] as String? ?? '';
        final date = s['date'] as String?;
        
        int active;
        int pause;
        
        if (status == 'ended') {
          // Ended shift: Firestore'daki hesaplanmis degerleri kullan
          active = (s['totalMinutes'] as num?)?.toInt() ?? 0;
          pause = (s['pauseMinutes'] as num?)?.toInt() ?? 0;
        } else {
          // Aktif/paused shift: pauseLog'dan canli hesapla
          final started = (s['startedAt'] as Timestamp?)?.toDate();
          final pauseLog = List<Map<String, dynamic>>.from(
            (s['pauseLog'] as List<dynamic>?) ?? [],
          );
          
          // Toplam mola suresi hesapla
          int totalPauseSec = 0;
          for (final p in pauseLog) {
            final pStart = (p['pausedAt'] as Timestamp?)?.toDate();
            final pEnd = (p['resumedAt'] as Timestamp?)?.toDate();
            if (pStart != null) {
              final end = pEnd ?? DateTime.now();
              totalPauseSec += end.difference(pStart).inSeconds;
            }
          }
          pause = totalPauseSec ~/ 60;
          
          // Aktif sure = toplam sure - mola suresi
          if (started != null) {
            final totalSec = DateTime.now().difference(started).inSeconds;
            active = (totalSec - totalPauseSec) ~/ 60;
            if (active < 0) active = 0;
          } else {
            active = 0;
          }
        }

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
            if (isDriver) roleTokens.add('Surucu');
            if (tables.isNotEmpty) roleTokens.add('Garson');
            if (isOther && roleTokens.isEmpty) roleTokens.add('Diger');
            if (roleTokens.isEmpty) roleTokens.add('Genel Alan');
            
            // Concurrent: distribute active time evenly across roles
            final perRole = roleTokens.isNotEmpty ? (active / roleTokens.length).round() : active;
            for (var t in roleTokens) {
               todayRoles[t] = (todayRoles[t] ?? 0) + perRole;
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
              _buildKermesAdminManagementCard(capabilities, isDark),
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
           String? g = currentUserDoc.data()?['gender'] as String?;
           if (g != null && g.isNotEmpty) {
             g = g.toLowerCase();
             if (g == 'kadin' || g == 'kadın' || g == 'female') currentUserGender = 'female';
             else if (g == 'erkek' || g == 'male') currentUserGender = 'male';
           }
        }
      } catch (e) {}
    }

    // Direct and definitive gender inference for current user via Admin document
    if (currentUserGender == null && currentUserUid != null) {
      try {
        final adminDoc = await FirebaseFirestore.instance.collection('admins').doc(currentUserUid).get();
        if (adminDoc.exists) {
           final d = adminDoc.data()!;
           final sections = List<String>.from(d['kermesAllowedSections'] ?? []);
           final prepZones = List<String>.from(d['kermesPrepZones'] ?? []);
           for (var s in [...sections, ...prepZones]) {
              if (s.contains('Kadın') || s.contains('Kadin') || s.contains('Hanımlar') || s.contains('Hanimlar')) {
                 currentUserGender = 'female'; break;
              } else if (s.contains('Erkek')) {
                 currentUserGender = 'male'; break;
              }
           }
        }
      } catch(e) {}
    }

    List<String> uids = [];
    final docSnap = await FirebaseFirestore.instance.collection('kermes_events').doc(kermesId).get();
    if (docSnap.exists) {
      final data = docSnap.data()!;
      if (roleOrZone == 'Sürücü') {
        uids = List<String>.from(data['assignedDrivers'] ?? []);
      } else if (roleOrZone == 'Garson') {
        uids = List<String>.from(data['assignedWaiters'] ?? []);
      } else if (roleOrZone == 'Kermes Admini') {
        uids = List<String>.from(data['kermesAdmins'] ?? []);
      } else if (roleOrZone == 'Kermes Görevlisi') {
        uids = List<String>.from(data['assignedStaff'] ?? []);
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
    
    if (uids.isEmpty) return [];

    final now = DateTime.now();
    final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    
    Map<String, String> statusMap = {};
    Map<String, String> adminInferredGenders = {};
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
          final sections = List<String>.from(d['kermesAllowedSections'] ?? []);
          final prepZones = List<String>.from(d['kermesPrepZones'] ?? []);
          for (var s in [...sections, ...prepZones]) {
             if (s.contains('Kadın') || s.contains('Kadin') || s.contains('Hanımlar') || s.contains('Hanimlar')) {
                 adminInferredGenders[doc.id] = 'female'; break; 
             } else if (s.contains('Erkek')) {
                 adminInferredGenders[doc.id] = 'male'; break;
             }
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
           } else {
             requiredGender = currentUserGender;
           }
           
           // Normalize target colleague's gender
           String normalizedUserGender = userGender;
           if (normalizedUserGender == 'kadin' || normalizedUserGender == 'kadın') normalizedUserGender = 'female';
           if (normalizedUserGender == 'erkek') normalizedUserGender = 'male';

           // Fallback to inferred gender explicitly based on Admin doc permissions
           if (normalizedUserGender.isEmpty && adminInferredGenders.containsKey(doc.id)) {
               normalizedUserGender = adminInferredGenders[doc.id]!;
           }

           if (requiredGender != null) {
              // STRICT GENDER POLICY
              if (normalizedUserGender != requiredGender) {
                  continue; 
              }
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

  Future<List<Map<String, dynamic>>> _fetchKermesAdminsData(List<String> adminUids, String? currentUserGender) async {
    if (adminUids.isEmpty) return [];

    List<Map<String, dynamic>> adminsList = [];
    final Map<String, Map<String, dynamic>> adminsMap = {};

    for (int i = 0; i < adminUids.length; i += 10) {
      final chunk = adminUids.sublist(i, (i + 10 > adminUids.length) ? adminUids.length : i + 10);
      try {
        final snapAdmins = await FirebaseFirestore.instance.collection('admins').where(FieldPath.documentId, whereIn: chunk).get();
        for (var doc in snapAdmins.docs) adminsMap[doc.id] = doc.data();
      } catch(_) {}
      try {
        final snapUsers = await FirebaseFirestore.instance.collection('users').where(FieldPath.documentId, whereIn: chunk).get();
        for (var doc in snapUsers.docs) {
           if (adminsMap.containsKey(doc.id)) {
              final d = adminsMap[doc.id]!;
              final u = doc.data();
              for (var entry in u.entries) {
                 if (entry.value != null && entry.value.toString().isNotEmpty) {
                    d[entry.key] = entry.value;
                 }
              }
           } else {
              adminsMap[doc.id] = doc.data();
           }
        }
      } catch(_) {}
    }

    for (var uid in adminUids) {
       final d = adminsMap[uid];
       if (d == null) continue;
       if (d['isActive'] == false) continue;

       String adminGender = '';
       final sections = List<String>.from(d['kermesAllowedSections'] ?? []);
       final prepZones = List<String>.from(d['kermesPrepZones'] ?? []);
       for (var s in [...sections, ...prepZones]) {
          if (s.contains('Kadın') || s.contains('Kadin') || s.contains('Hanımlar') || s.contains('Hanimlar')) {
              adminGender = 'female'; break; 
          } else if (s.contains('Erkek')) {
              adminGender = 'male'; break;
          }
       }

       if (adminGender.isEmpty) {
          final g = (d['gender'] as String?)?.toLowerCase() ?? '';
          if (g == 'kadin' || g == 'kadın' || g == 'female') adminGender = 'female';
          if (g == 'erkek' || g == 'male') adminGender = 'male';
       }

       if (currentUserGender != null && currentUserGender.isNotEmpty && adminGender.isNotEmpty && adminGender != currentUserGender) {
          continue; 
       }

       final adminName = d['staffName'] ?? d['name'] ?? d['displayName'] ?? 'Adsız Yetkili';
       final adminPhone = d['phone'] ?? d['phoneNumber'] ?? '';

       adminsList.add({
           'uid': uid,
           'name': adminName,
           'phone': adminPhone,
           'gender': adminGender,
       });
    }

    adminsList.sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
    return adminsList;
  }

  Widget _buildKermesAdminsSection(String businessId, String? userAreaGender, bool isDark, List<String> kermesAdminsUids) {
    if (kermesAdminsUids.isEmpty) return const SizedBox.shrink();
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _fetchKermesAdminsData(kermesAdminsUids, userAreaGender),
      builder: (context, snapshot) {
         if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
            return const SizedBox(); 
         }
         if (!snapshot.hasData || snapshot.data!.isEmpty) return const SizedBox();
         
         final adminsList = snapshot.data!;
         
         return Column(
           crossAxisAlignment: CrossAxisAlignment.start,
           children: [
             _buildCustomRow(
               'Kermes Yetkilileri:',
               adminsList.map((a) => _buildKermesAdminChip(a['name'] as String, a['phone'] as String, a['gender'] as String, userAreaGender, isDark)).toList(),
               isDark
             ),
             const SizedBox(height: 15),
           ],
         );
      }
    );
  }

  Widget _buildKermesAdminChip(String name, String phone, String adminGender, String? currentUserGender, bool isDark) {
    bool canCall = false;
    if (phone.isNotEmpty) {
      if (currentUserGender != null && currentUserGender.isNotEmpty && adminGender.isNotEmpty) {
        if (currentUserGender == adminGender) canCall = true;
      } else {
        canCall = true;
      }
    }

    return InkWell(
      onTap: canCall ? () async {
        final Uri launchUri = Uri(scheme: 'tel', path: phone);
        if (await canLaunchUrl(launchUri)) {
          await launchUrl(launchUri);
        }
      } : null,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF2D2D2D) : const Color(0xFF222222),
          borderRadius: BorderRadius.circular(20),
          boxShadow: const [
            BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))
          ]
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
             const Icon(Icons.admin_panel_settings, size: 14, color: Colors.white),
             const SizedBox(width: 6),
             Flexible(
                child: Text(
                  name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
             ),
             if (canCall) ...[
                const SizedBox(width: 6),
                const Icon(Icons.phone, size: 12, color: Colors.greenAccent),
             ]
          ],
        ),
      ),
    );
  }

  Widget _buildAssignmentCard(StaffCapabilities capabilities, bool isDark) {
    if (capabilities.businessId == null || capabilities.businessId!.isEmpty) {
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
        
        // Custom Roles - customRoles dizisi + direkt customRoleAssignments kontrolu
        // (customRoles dizisi kayit edilmemis olsa bile system roller goruntulensin)
        final customRolesData = data['customRoles'] as List<dynamic>? ?? [];
        final customAssignments = data['customRoleAssignments'] as Map<String, dynamic>? ?? {};

        // Sistem rollerinin sabit isimleri (kayit edilmemis olsa bile taninan roller)
        const systemRoleNames = <String, String>{
          'role_park_system': 'Park Gorevlisi',
          'role_temizlik_system': 'Temizlik Gorevlisi',
          'role_park': 'Park Görevlisi',
          'role_temizlik': 'Temizlik Görevlisi',
          'role_cocuk': 'Çocuk Görevlisi',
          'role_vip': 'Özel Misafir (VIP)',
        };
        const systemRoleIcons = <String, String>{
          'role_park_system': '🅿️',
          'role_temizlik_system': '🧹',
          'role_park': '🅿️',
          'role_temizlik': '🧹',
          'role_cocuk': '👶',
          'role_vip': '⭐',
        };

        // customRoles dizisindeki rolleri isle
        final Set<String> addedRoleIds = {};
        List<Map<String, dynamic>> dynamicRoles = [];
        for (var cr in customRolesData) {
            final crId = cr['id']?.toString() ?? '';
            final crName = cr['name']?.toString() ?? crId;
            final crIcon = cr['icon']?.toString() ?? '📋';
            final assignedList = List<String>.from(customAssignments[crId] ?? []);
            if (assignedList.contains(uid)) {
                dynamicRoles.add({'name': crName, 'icon': crIcon});
                addedRoleIds.add(crId);
            }
        }
        // customRoleAssignments'daki her entry'yi kontrol et (customRoles'ta tanimlı olmasa da)
        customAssignments.forEach((roleId, assignedUids) {
            if (addedRoleIds.contains(roleId)) return; // zaten eklendi
            final list = List<String>.from(assignedUids ?? []);
            if (list.contains(uid)) {
                final roleName = systemRoleNames[roleId] ?? roleId;
                final roleIcon = systemRoleIcons[roleId] ?? '📋';
                dynamicRoles.add({'name': roleName, 'icon': roleIcon});
                addedRoleIds.add(roleId);
            }
        });
        
        final kermesAdmins = List<String>.from(data['kermesAdmins'] ?? []);

        final startDateTs = data['startDate'] as Timestamp?;
        final endDateTs = data['endDate'] as Timestamp?;

        return _renderAssignmentCardInner(
          capabilities.copyWith(
            kermesPrepZones: livePrepZones,
            isDriver: isDriver,
            hasTablesRole: isWaiter,
          ), 
          isDark,
          dynamicRoles: dynamicRoles,
          kermesAdmins: kermesAdmins,
          startDate: startDateTs?.toDate(),
          endDate: endDateTs?.toDate(),
        );
      }
    );
  }

  Widget _renderAssignmentCardInner(StaffCapabilities capabilities, bool isDark, {List<Map<String, dynamic>> dynamicRoles = const [], List<String> kermesAdmins = const [], DateTime? startDate, DateTime? endDate}) {
    List<String> gorevler = [];
    if (capabilities.isBusinessAdmin) gorevler.add("Kermes Admini");
    if (capabilities.isDriver) gorevler.add("Sürücü");
    if (capabilities.hasTablesRole) gorevler.add("Garson");
    if (gorevler.isEmpty && capabilities.kermesAllowedSections.isEmpty && dynamicRoles.isEmpty) {
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
          _buildInfoRow('Personel:', capabilities.staffName.isNotEmpty ? capabilities.staffName : 'Personel', isDark),
          const SizedBox(height: 15),
          _buildInfoRow('Aktif Etkinlik:', capabilities.businessName.isNotEmpty ? capabilities.businessName : 'Bekleniyor...', isDark),
          const SizedBox(height: 15),
          if (startDate != null && endDate != null) ...[
            _buildInfoRow('Tarih:', '${DateFormat('dd.MM.yyyy').format(startDate)} - ${DateFormat('dd.MM.yyyy').format(endDate)}', isDark),
            const SizedBox(height: 15),
          ],
          if (bolumText.isNotEmpty) ...[
            _buildInfoRow('Bölüm:', bolumText, isDark),
            const SizedBox(height: 15),
          ],
          if (ocakbasiMap.isNotEmpty) ...[
            Padding(
               padding: const EdgeInsets.symmetric(vertical: 8),
               child: Divider(height: 1, color: isDark ? Colors.white10 : Colors.black12),
            ),
            Text('Ocakbaşı Görevleriniz', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : Colors.black54)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8, runSpacing: 8,
              children: ocakbasiMap.entries.map((e) => _buildClickableChip(e.key, e.value, capabilities.businessId, isDark)).toList()
            ),
            const SizedBox(height: 15),
          ],
          if (gorevler.isNotEmpty || dynamicRoles.isNotEmpty) ...[
            Padding(
               padding: const EdgeInsets.symmetric(vertical: 8),
               child: Divider(height: 1, color: isDark ? Colors.white10 : Colors.black12),
            ),
            Text('Diğer Görevleriniz', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : Colors.black54)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8, runSpacing: 8,
              children: [
                ...gorevler.map((g) => _buildClickableChip(g, g, capabilities.businessId, isDark)),
                ...dynamicRoles.map((g) => _buildClickableChip(g['name'] as String, g['name'] as String, capabilities.businessId, isDark)),
              ],
            ),
            const SizedBox(height: 15),
          ],
          
          if (capabilities.businessId != null) ...[
             Builder(builder: (context) {
                String? currentUserGender;
                final List<String> allUserSections = [...capabilities.kermesAllowedSections, ...capabilities.kermesPrepZones];
                for (var s in allUserSections) {
                  if (s.contains('Kadın') || s.contains('Kadin') || s.contains('Hanımlar') || s.contains('Hanimlar')) {
                      currentUserGender = 'female'; break; 
                  } else if (s.contains('Erkek')) {
                      currentUserGender = 'male'; break;
                  }
                }
                return _buildKermesAdminsSection(capabilities.businessId!, currentUserGender, isDark, kermesAdmins);
             }),
          ],

          const SizedBox(height: 15),

          // Vardiya Navigation Buttons
          if (capabilities.businessId != null) ...[
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDark ? Colors.cyan.shade900 : Colors.cyan.shade100,
                  foregroundColor: isDark ? Colors.cyan.shade100 : Colors.cyan.shade900,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.calendar_month, size: 18),
                label: const Text('Vardiya Planım', style: TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => KermesScheduleScreen(
                        kermesId: capabilities.businessId!,
                        kermesTitle: capabilities.businessName,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
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
    MaterialColor colorBase = Colors.pink;
    final l = label.toLowerCase();
    
    bool isAdmin = false;
    
    if (l.contains('admin')) {
      colorBase = Colors.red;
      isAdmin = true;
    } else if (l.contains('sürücü') || l.contains('surucu')) {
      colorBase = Colors.blue;
    } else if (l.contains('garson')) {
      colorBase = Colors.teal;
    } else if (l.contains('temiz') || l.contains('çöp')) {
      colorBase = Colors.cyan;
    } else if (l.contains('park') || l.contains('trafik')) {
      colorBase = Colors.indigo;
    } else if (l.contains('kermes görevlisi')) {
      colorBase = Colors.purple;
    } else if (l.contains('grill') || l.contains('kumpir') || l.contains('lahmacun') || l.contains('künefe') || l.contains('ocak')) {
      colorBase = Colors.deepOrange;
    } else {
      colorBase = Colors.orange; // Default fallback for other prep zones
    }

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
          color: isDark ? colorBase.withOpacity(0.15) : colorBase.shade50,
          border: Border.all(color: colorBase.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isAdmin) ...[
               Icon(Icons.admin_panel_settings, size: 14, color: isDark ? colorBase.shade200 : colorBase.shade700),
               const SizedBox(width: 4),
            ],
            Flexible(
               child: Text(
                 label,
                 style: TextStyle(
                   fontSize: 13,
                   fontWeight: FontWeight.bold,
                   color: isDark ? colorBase.shade200 : colorBase.shade700,
                 ),
                 overflow: TextOverflow.ellipsis,
               ),
            ),
            if (!isAdmin) ...[
               const SizedBox(width: 4),
               Icon(Icons.touch_app, size: 14, color: isDark ? colorBase.shade200 : colorBase.shade700),
            ]
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
    
    // Canli mola suresi: shift paused ise, pauseLog'un son acik entry'sinden hesapla
    int currentPauseMin = 0;
    if (_shiftService.shiftStatus == 'paused' && _shiftService.currentShiftId != null) {
      // Mola baslangic zamani _lastPausedAt'tan hesaplanir
      if (_lastPausedAt != null) {
        currentPauseMin = DateTime.now().difference(_lastPausedAt!).inMinutes;
      }
    }

    final totalMin = _pastTotalActiveMin + currentActiveMs;
    final todayMin = _pastTodayActiveMin + currentActiveMs;
    final todayPause = _pastTodayPauseMin + currentPauseMin;

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
          ],
          // Detaylari Goruntule butonu
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () {
              final capabilities = ref.read(staffCapabilitiesProvider);
              _showShiftHistorySheet(isDark, capabilities.businessId);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.04) : Colors.blueAccent.withOpacity(0.04),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isDark ? Colors.white10 : Colors.blueAccent.withOpacity(0.15)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.history, size: 16, color: Colors.blueAccent.withOpacity(0.7)),
                  const SizedBox(width: 6),
                  Text('Detaylari Goruntule', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.blueAccent.withOpacity(0.8))),
                  const SizedBox(width: 4),
                  Icon(Icons.chevron_right, size: 16, color: Colors.blueAccent.withOpacity(0.5)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showShiftHistorySheet(bool isDark, String? businessId) {
    if (businessId == null) return;

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
                  Center(
                    child: Container(
                      margin: const EdgeInsets.only(top: 12),
                      width: 40, height: 4,
                      decoration: BoxDecoration(color: Colors.grey[500], borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                    child: Row(
                      children: [
                        const Icon(Icons.history, color: Colors.blueAccent, size: 22),
                        const SizedBox(width: 10),
                        Expanded(child: Text('Mesai Gecmisi', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87))),
                        IconButton(
                          onPressed: () => Navigator.pop(ctx),
                          icon: Icon(Icons.close, color: isDark ? Colors.white54 : Colors.grey),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: FutureBuilder<List<Map<String, dynamic>>>(
                      future: _shiftService.getShiftHistory(
                        businessId: businessId,
                        staffId: FirebaseAuth.instance.currentUser?.uid,
                        limit: 200,
                      ),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator(color: Colors.blueAccent));
                        }
                        final shifts = snapshot.data ?? [];
                        if (shifts.isEmpty) {
                          return Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.work_off, size: 64, color: isDark ? Colors.white24 : Colors.grey.shade300),
                                const SizedBox(height: 16),
                                Text('Henuz mesai kaydi yok', style: TextStyle(color: isDark ? Colors.white54 : Colors.grey, fontSize: 16)),
                              ],
                            ),
                          );
                        }

                        // Gun bazli grupla
                        final grouped = <String, List<Map<String, dynamic>>>{};
                        for (final s in shifts) {
                          final started = (s['startedAt'] as Timestamp?)?.toDate();
                          final dayKey = started != null
                              ? '${started.day.toString().padLeft(2, '0')}.${started.month.toString().padLeft(2, '0')}.${started.year}'
                              : 'Bilinmiyor';
                          grouped.putIfAbsent(dayKey, () => []);
                          grouped[dayKey]!.add(s);
                        }

                        final dayKeys = grouped.keys.toList();

                        return ListView.builder(
                          controller: scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: dayKeys.length,
                          itemBuilder: (ctx, dayIndex) {
                            final dayKey = dayKeys[dayIndex];
                            final dayShifts = grouped[dayKey]!;

                            int dayActiveMin = 0;
                            int dayPauseMin = 0;
                            for (final s in dayShifts) {
                              dayActiveMin += ((s['totalMinutes'] as num?)?.toInt() ?? 0);
                              dayPauseMin += ((s['pauseMinutes'] as num?)?.toInt() ?? 0);
                            }

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  margin: EdgeInsets.only(top: dayIndex > 0 ? 20 : 0, bottom: 10),
                                  decoration: BoxDecoration(
                                    color: isDark ? Colors.white.withOpacity(0.06) : Colors.blueAccent.withOpacity(0.06),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(dayKey, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black87)),
                                      Row(
                                        children: [
                                          Icon(Icons.work, size: 14, color: Colors.green.shade400),
                                          const SizedBox(width: 4),
                                          Text('${dayActiveMin ~/ 60}s ${dayActiveMin % 60}dk', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.green)),
                                          const SizedBox(width: 10),
                                          Icon(Icons.pause_circle, size: 14, color: Colors.orange.shade400),
                                          const SizedBox(width: 4),
                                          Text('${dayPauseMin ~/ 60}s ${dayPauseMin % 60}dk', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.orange)),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                ...dayShifts.map((shift) {
                                  final started = (shift['startedAt'] as Timestamp?)?.toDate();
                                  final ended = (shift['endedAt'] as Timestamp?)?.toDate();
                                  final active = (shift['totalMinutes'] as num?)?.toInt() ?? 0;
                                  final status = shift['status'] as String? ?? '';
                                  final pauseLog = List<Map<String, dynamic>>.from(
                                    (shift['pauseLog'] as List<dynamic>?) ?? [],
                                  );
                                  final prepZones = List<String>.from(shift['assignedPrepZones'] ?? []);

                                  String fmtTime(DateTime? dt) {
                                    if (dt == null) return '--:--';
                                    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                                  }

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 10),
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF252525) : Colors.grey.shade50,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade200),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              width: 8, height: 8,
                                              decoration: BoxDecoration(
                                                color: status == 'ended' ? Colors.green : (status == 'paused' ? Colors.orange : Colors.green),
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                              '${fmtTime(started)} - ${status == 'ended' ? fmtTime(ended) : 'Devam Ediyor'}',
                                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: isDark ? Colors.white : Colors.black87),
                                            ),
                                            const Spacer(),
                                            if (status == 'ended')
                                              Text('${active}dk', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.green)),
                                          ],
                                        ),
                                        if (prepZones.isNotEmpty) ...[
                                          const SizedBox(height: 6),
                                          Wrap(
                                            spacing: 6,
                                            children: prepZones.map((z) => Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: Colors.pink.withOpacity(0.1),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(z, style: const TextStyle(fontSize: 11, color: Colors.pink, fontWeight: FontWeight.w600)),
                                            )).toList(),
                                          ),
                                        ],
                                        if (pauseLog.isNotEmpty) ...[
                                          const SizedBox(height: 8),
                                          ...pauseLog.map((p) {
                                            final pStart = (p['pausedAt'] as Timestamp?)?.toDate();
                                            final pEnd = (p['resumedAt'] as Timestamp?)?.toDate();
                                            final pDuration = pStart != null && pEnd != null
                                                ? pEnd.difference(pStart).inMinutes
                                                : (pStart != null ? DateTime.now().difference(pStart).inMinutes : 0);
                                            return Padding(
                                              padding: const EdgeInsets.only(left: 16, top: 4),
                                              child: Row(
                                                children: [
                                                  Icon(Icons.pause_circle_outline, size: 14, color: Colors.orange.shade400),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    '${fmtTime(pStart)} - ${pEnd != null ? fmtTime(pEnd) : 'Devam'}',
                                                    style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.grey.shade600),
                                                  ),
                                                  const Spacer(),
                                                  Text(
                                                    '${pDuration}dk',
                                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.orange.shade400),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }),
                                        ],
                                      ],
                                    ),
                                  );
                                }),
                              ],
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

  Color _getRoleColor(String roleName) {
    if (roleName.toLowerCase().contains('park')) return Colors.blueAccent;
    if (roleName.toLowerCase().contains('temizlik')) return Colors.purpleAccent;
    if (roleName.toLowerCase().contains('surucu')) return Colors.orange;
    if (roleName.toLowerCase().contains('garson')) return Colors.green;
    return Colors.pinkAccent;
  }

  Widget _buildKermesAdminManagementCard(StaffCapabilities capabilities, bool isDark) {
    // Only visible if user is an Admin of this Kermes
    if (!capabilities.isBusinessAdmin || capabilities.businessId == null) {
      return const SizedBox.shrink();
    }
    return Container(
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.purple.withOpacity(0.3), width: 1.5),
        boxShadow: [
          if (!isDark) BoxShadow(color: Colors.purple.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.purple.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.admin_panel_settings, color: Colors.purple, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Kermes Yönetimi',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Personel yetkilendirmelerini ve vardiya planlamalarını yönetin.',
            style: TextStyle(fontSize: 13, color: isDark ? Colors.grey.shade400 : Colors.grey.shade600),
          ),
          const Divider(height: 24),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => KermesAdminStaffAssignmentScreen(
                        kermesId: capabilities.businessId!,
                        kermesTitle: capabilities.businessName,
                      )));
                    },
                    icon: const Icon(Icons.people, size: 18),
                    label: const Text('Personeller', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? Colors.purple.withOpacity(0.2) : Colors.purple.withOpacity(0.12),
                      foregroundColor: isDark ? Colors.purple.shade200 : Colors.purple.shade700,
                      elevation: 0,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => KermesAdminRosterScreen(
                        kermesId: capabilities.businessId!,
                        kermesTitle: capabilities.businessName,
                        assignedStaffIds: const [], 
                      )));
                    },
                    icon: const Icon(Icons.calendar_month, size: 18),
                    label: const Text('Vardiyalar', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? Colors.purple.withOpacity(0.2) : Colors.purple.withOpacity(0.12),
                      foregroundColor: isDark ? Colors.purple.shade200 : Colors.purple.shade700,
                      elevation: 0,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFinanceCard(bool isDark) {
    final user = FirebaseAuth.instance.currentUser;
    final capabilities = ref.watch(staffCapabilitiesProvider);
    final businessId = capabilities.businessId;

    if (user == null || businessId == null) {
      return _buildFinanceCardContent(isDark, 0.0, []);
    }

    final createdStream = FirebaseFirestore.instance
        .collection('kermes_orders')
        .where('kermesId', isEqualTo: businessId)
        .where('createdByStaffId', isEqualTo: user.uid)
        .where('paymentMethod', isEqualTo: 'cash')
        .snapshots();

    final collectedStream = FirebaseFirestore.instance
        .collection('kermes_orders')
        .where('kermesId', isEqualTo: businessId)
        .where('collectedByStaffId', isEqualTo: user.uid)
        .where('paymentMethod', isEqualTo: 'cash')
        .snapshots();

    return StreamBuilder<List<QuerySnapshot>>(
      stream: Rx.combineLatest2(
        createdStream,
        collectedStream,
        (QuerySnapshot a, QuerySnapshot b) => [a, b],
      ),
      builder: (context, snapshot) {
        double unsettledCash = 0.0;
        List<String> orderIds = [];
        Set<String> processedOrderIds = {};

        if (snapshot.hasData) {
          for (final querySnapshot in snapshot.data!) {
            for (final doc in querySnapshot.docs) {
              if (processedOrderIds.contains(doc.id)) continue;
              processedOrderIds.add(doc.id);

              final data = doc.data() as Map<String, dynamic>;
              final status = data['status'] as String? ?? '';
              if (status == 'cancelled') continue;
              
              final settledToRegister = data['settledToRegister'] as bool? ?? false;
              if (!settledToRegister) {
                final amount = (data['totalAmount'] as num?)?.toDouble() ?? 0.0;
                unsettledCash += amount;
                orderIds.add(doc.id);
              }
            }
          }
        }
        return _buildFinanceCardContent(isDark, unsettledCash, orderIds);
      },
    );
  }

  Widget _buildFinanceCardContent(bool isDark, double unsettledCash, List<String> orderIds) {
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
              const Icon(Icons.account_balance_wallet, color: Colors.orange),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Kasa & Tahsilat',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                ),
              ),
            ],
          ),
          const Divider(height: 30),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: unsettledCash > 0
                  ? Colors.orange.withOpacity(isDark ? 0.12 : 0.08)
                  : Colors.orange.withOpacity(isDark ? 0.08 : 0.05),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.orange.withOpacity(unsettledCash > 0 ? 0.4 : 0.2)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.orange.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.money, color: Colors.orange, size: 24),
                ),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Teslim Edilecek Nakit', style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black54)),
                    const SizedBox(height: 2),
                    Text(
                      '${unsettledCash.toStringAsFixed(2)} EUR',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: unsettledCash > 0 ? Colors.orange : (isDark ? Colors.white : Colors.black),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: ElevatedButton.icon(
                    onPressed: unsettledCash > 0 ? () {
                      showModalBottomSheet(
                        context: context,
                        backgroundColor: Colors.transparent,
                        builder: (ctx) => Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Nasıl devretmek istersiniz?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                              const SizedBox(height: 24),
                              ListTile(
                                leading: const CircleAvatar(backgroundColor: Colors.blueAccent, child: Icon(Icons.qr_code_scanner, color: Colors.white)),
                                title: const Text('QR Kodu Okutarak', style: TextStyle(fontWeight: FontWeight.w600)),
                                subtitle: const Text('Kasa görevlisinin cihazından taraması için'),
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _showHandoverQRDialog(context, unsettledCash, orderIds);
                                },
                              ),
                              const Divider(),
                              ListTile(
                                leading: const CircleAvatar(backgroundColor: Colors.orangeAccent, child: Icon(Icons.person_search, color: Colors.white)),
                                title: const Text('Listeden Seçerek', style: TextStyle(fontWeight: FontWeight.w600)),
                                subtitle: const Text('Doğrudan başka bir yetkiliye gönder'),
                                onTap: () {
                                  Navigator.pop(ctx);
                                  final capabilities = ref.read(staffCapabilitiesProvider);
                                  showDialog(
                                    context: context,
                                    builder: (_) => StaffTransferSelectionDialog(
                                      currentUserId: FirebaseAuth.instance.currentUser?.uid ?? '',
                                      businessId: capabilities.businessId ?? '',
                                      declaredAmount: unsettledCash,
                                      orderIds: orderIds,
                                    ),
                                  );
                                },
                              ),
                              const SizedBox(height: 24),
                            ],
                          ),
                        ),
                      );
                    } : null,
                    icon: const Icon(Icons.account_balance_wallet, size: 16),
                    label: const Text('Teslim Et', style: TextStyle(fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blueAccent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: OutlinedButton.icon(
                    onPressed: () => _showCashHistory(),
                    icon: const Icon(Icons.history, size: 16),
                    label: const Text('Gecmis', style: TextStyle(fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: isDark ? Colors.white70 : Colors.black87,
                      side: BorderSide(color: isDark ? Colors.white24 : Colors.black26),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showCashHistory() {
    final user = FirebaseAuth.instance.currentUser;
    final capabilities = ref.read(staffCapabilitiesProvider);
    final businessId = capabilities.businessId;
    if (user == null || businessId == null) return;

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
                        const Icon(Icons.history_edu, color: Colors.orange, size: 24),
                        const SizedBox(width: 10),
                        Text(
                          'Tahsilat Geçmişi',
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
                  // Order list
                  Expanded(
                    child: StreamBuilder<QuerySnapshot>(
                      stream: FirebaseFirestore.instance
                          .collection('kermes_cash_handovers')
                          .where('businessId', isEqualTo: businessId)
                          .where('staffId', isEqualTo: user.uid)
                          .snapshots(),
                      builder: (context, snapshot) {
                        if (snapshot.hasError) {
                          return Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Text(
                                'Veri yuklenirken hata: ${snapshot.error}',
                                style: TextStyle(color: isDark ? Colors.white54 : Colors.grey, fontSize: 13),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          );
                        }
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator(color: Colors.orange));
                        }
                        final docs = snapshot.data?.docs ?? [];
                        if (docs.isEmpty) {
                          return Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.account_balance_wallet, size: 64, color: isDark ? Colors.white24 : Colors.grey.shade300),
                                const SizedBox(height: 16),
                                Text(
                                  'Henüz tahsilat teslimatı yok',
                                  style: TextStyle(color: isDark ? Colors.white54 : Colors.grey, fontSize: 16),
                                ),
                              ],
                            ),
                          );
                        }

                        // Client-side siralama (composite index gerektirmemek icin)
                        final sortedDocs = List<QueryDocumentSnapshot>.from(docs);
                        sortedDocs.sort((a, b) {
                          final aTime = (a.data() as Map<String, dynamic>)['createdAt'] as Timestamp?;
                          final bTime = (b.data() as Map<String, dynamic>)['createdAt'] as Timestamp?;
                          if (aTime == null || bTime == null) return 0;
                          return bTime.compareTo(aTime); // descending
                        });

                        return ListView.separated(
                          controller: scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: sortedDocs.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (ctx, index) {
                            final data = sortedDocs[index].data() as Map<String, dynamic>;
                            return _buildCashHandoverCard(data, isDark);
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

  Widget _buildCashHandoverCard(Map<String, dynamic> data, bool isDark) {
    final status = data['status'] as String? ?? 'pending';
    final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
    final completedAt = (data['completedAt'] as Timestamp?)?.toDate();
    final amount = (data['actualAmount'] as num?)?.toDouble() ?? (data['declaredAmount'] as num?)?.toDouble() ?? 0.0;
    final adminName = data['adminName'] as String? ?? 'Bilinmiyor';

    final dateStr = createdAt != null
        ? DateFormat('dd.MM.yyyy HH:mm', 'tr').format(createdAt)
        : '---';

    Color statusColor;
    String statusText;
    IconData statusIcon;
    switch (status) {
      case 'completed':
        statusColor = Colors.green;
        statusText = 'Teslim Edildi';
        statusIcon = Icons.check_circle_outline;
        break;
      case 'cancelled':
        statusColor = Colors.red;
        statusText = 'İptal';
        statusIcon = Icons.cancel_outlined;
        break;
      default: // pending
        statusColor = Colors.orange;
        statusText = 'Bekliyor';
        statusIcon = Icons.pending_actions;
    }

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF252525) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(isDark ? 0.1 : 0.05),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Icon(statusIcon, color: statusColor, size: 20),
                const SizedBox(width: 8),
                Text(
                  statusText,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: statusColor,
                  ),
                ),
                const Spacer(),
                Text(
                  dateStr,
                  style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.grey),
                ),
              ],
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Teslim Alan:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 4),
                    Text(
                      status == 'completed' ? adminName : 'Onay Bekliyor...',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                    ),
                    if (status == 'completed' && completedAt != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        DateFormat('HH:mm:ss').format(completedAt),
                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                      )
                    ]
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Tutar', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 4),
                    Text(
                      '${amount.toStringAsFixed(2)} EUR',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.orange),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _financeRow(String label, String value, bool isDark, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: isDark ? Colors.white54 : Colors.black54)),
          Text(
            value,
            style: TextStyle(
              fontSize: bold ? 15 : 13,
              fontWeight: bold ? FontWeight.bold : FontWeight.w500,
              color: color ?? (isDark ? Colors.white : Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showHandoverQRDialog(BuildContext context, double declaredAmount, List<String> orderIds) async {
    final user = FirebaseAuth.instance.currentUser;
    final capabilities = ref.read(staffCapabilitiesProvider);
    if (user == null || capabilities.businessId == null) return;

    setState(() => _shiftLoading = true);
    DocumentReference? handoverDocRef;
    try {
      final data = {
        'staffId': user.uid,
        'staffName': capabilities.staffName ?? 'Personel',
        'businessId': capabilities.businessId,
        'declaredAmount': declaredAmount,
        'actualAmount': declaredAmount,
        'status': 'pending', // pending, completed, cancelled
        'orderIds': orderIds,
        'createdAt': FieldValue.serverTimestamp(),
      };
      
      handoverDocRef = await FirebaseFirestore.instance.collection('kermes_cash_handovers').add(data);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
      }
      setState(() => _shiftLoading = false);
      return;
    }
    setState(() => _shiftLoading = false);

    if (!mounted || handoverDocRef == null) return;
    
    // We listen to the doc inside the dialog via StreamBuilder
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return Dialog(
          backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: StreamBuilder<DocumentSnapshot>(
            stream: handoverDocRef!.snapshots(),
            builder: (ctx2, snapshot) {
              if (snapshot.hasData && snapshot.data!.exists) {
                final data = snapshot.data!.data() as Map<String, dynamic>;
                if (data['status'] == 'completed') {
                  // Admin approved it! Close dialog and show success.
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (Navigator.canPop(ctx2)) {
                      Navigator.pop(ctx2);
                    }
                    _showHandoverSuccess(data['adminName'] ?? 'Admin', data['completedAt'] as Timestamp?, data['actualAmount']);
                  });
                  return const SizedBox();
                } else if (data['status'] == 'cancelled') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (Navigator.canPop(ctx2)) Navigator.pop(ctx2);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tahsilat işlemi iptal edildi.')));
                  });
                  return const SizedBox();
                }
              }

              return Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Tahsilat QR Kodu', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 10),
                    Text(
                      'Lütfen bu kodu Kermes Yöneticisine okutun.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: isDark ? Colors.white70 : Colors.black54),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: QrImageView(
                        data: 'kermes://handover/${handoverDocRef!.id}',
                        version: QrVersions.auto,
                        size: 200.0,
                        backgroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      '${declaredAmount.toStringAsFixed(2)} EUR',
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.orange),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: () {
                          handoverDocRef!.update({'status': 'cancelled'});
                        },
                        child: const Text('İptal Et', style: TextStyle(color: Colors.red)),
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

  void _showHandoverSuccess(String adminName, Timestamp? completedAt, dynamic actualAmount) {
    if (!mounted) return;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    String timeStr = '';
    if (completedAt != null) {
      timeStr = DateFormat('dd.MM.yyyy HH:mm:ss').format(completedAt.toDate());
    }

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), shape: BoxShape.circle),
                child: const Icon(Icons.check_circle_rounded, color: Colors.green, size: 50),
              ),
              const SizedBox(height: 20),
              Text('Teslim Edildi!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: isDark ? Colors.white : Colors.black87)),
              const SizedBox(height: 12),
              Text(
                'Tahsilatınız başarıyla gerçekleştirildi.\n\nTeslim Alan: $adminName\nZaman: $timeStr\nTutar: ${actualAmount != null ? (actualAmount as num).toStringAsFixed(2) : '-'} EUR',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, color: isDark ? Colors.white70 : Colors.black54, height: 1.5),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Harika', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

}
