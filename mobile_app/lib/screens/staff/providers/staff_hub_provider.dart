import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../services/staff_role_service.dart';

class StaffCapabilities {
  final bool isLoading;
  final bool isDriver;
  final bool hasReservation;
  final bool hasTables;
  final bool hasShiftTracking;
  final String staffName;
  final String phoneNumber;
  final String businessName;
  final String? businessId;
  final int maxTables;
  final List<int> assignedTables;
  final String userId;
  final bool hasCourierRole;
  final bool hasTablesRole;
  final bool hasFinanceRole;
  final bool isBusinessAdmin;
  final List<String> kermesAllowedSections;
  final List<String> kermesPrepZones;
  final bool hasTezgahRole;
  final bool hasPosRole;
  final String tezgahName;
  final bool hasParkRole; // Park Gorevlisi
  bool get hasKermesAdminRole => isBusinessAdmin;
  final List<Map<String, String>> kermesCustomRoles; // Atanmis ozel gorevler [{id, name}]

  StaffCapabilities({
    this.isLoading = true,
    this.isDriver = false,
    this.hasReservation = false,
    this.hasTables = false,
    this.hasShiftTracking = false,
    this.staffName = '',
    this.phoneNumber = '',
    this.businessName = '',
    this.businessId,
    this.maxTables = 0,
    this.assignedTables = const [],
    this.isBusinessAdmin = false,
    this.userId = '',
    this.hasCourierRole = false,
    this.hasTablesRole = false,
    this.hasFinanceRole = false,
    this.kermesAllowedSections = const [],
    this.kermesPrepZones = const [],
    this.hasTezgahRole = false,
    this.hasPosRole = false,
    this.tezgahName = '',
    this.hasParkRole = false,
    this.kermesCustomRoles = const [],
  });

  StaffCapabilities copyWith({
    bool? isLoading,
    bool? isDriver,
    bool? hasReservation,
    bool? hasTables,
    bool? hasShiftTracking,
    String? staffName,
    String? phoneNumber,
    String? businessName,
    String? businessId,
    int? maxTables,
    List<int>? assignedTables,
    bool? isBusinessAdmin,
    String? userId,
    bool? hasCourierRole,
    bool? hasTablesRole,
    bool? hasFinanceRole,
    List<String>? kermesAllowedSections,
    List<String>? kermesPrepZones,
    bool? hasTezgahRole,
    bool? hasPosRole,
    String? tezgahName,
    bool? hasParkRole,
    List<Map<String, String>>? kermesCustomRoles,
  }) {
    return StaffCapabilities(
      isLoading: isLoading ?? this.isLoading,
      isDriver: isDriver ?? this.isDriver,
      hasReservation: hasReservation ?? this.hasReservation,
      hasTables: hasTables ?? this.hasTables,
      hasShiftTracking: hasShiftTracking ?? this.hasShiftTracking,
      staffName: staffName ?? this.staffName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      businessName: businessName ?? this.businessName,
      businessId: businessId ?? this.businessId,
      maxTables: maxTables ?? this.maxTables,
      assignedTables: assignedTables ?? this.assignedTables,
      isBusinessAdmin: isBusinessAdmin ?? this.isBusinessAdmin,
      userId: userId ?? this.userId,
      hasCourierRole: hasCourierRole ?? this.hasCourierRole,
      hasTablesRole: hasTablesRole ?? this.hasTablesRole,
      hasFinanceRole: hasFinanceRole ?? this.hasFinanceRole,
      kermesAllowedSections: kermesAllowedSections ?? this.kermesAllowedSections,
      kermesPrepZones: kermesPrepZones ?? this.kermesPrepZones,
      hasTezgahRole: hasTezgahRole ?? this.hasTezgahRole,
      hasPosRole: hasPosRole ?? this.hasPosRole,
      tezgahName: tezgahName ?? this.tezgahName,
      hasParkRole: hasParkRole ?? this.hasParkRole,
      kermesCustomRoles: kermesCustomRoles ?? this.kermesCustomRoles,
    );
  }
}

class StaffCapabilitiesNotifier extends Notifier<StaffCapabilities> {
  StreamSubscription? _adminSub;
  StreamSubscription? _kermesSub;
  String? _lastListeningBusinessId;

  @override
  StaffCapabilities build() {
    ref.onDispose(() {
      _adminSub?.cancel();
      _kermesSub?.cancel();
    });
    // Return initial state synchronously first
    final initialState = StaffCapabilities();
    // Then kick off async load via listeners
    Future.microtask(_setupListeners);
    return initialState;
  }

  void _setupListeners() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      state = state.copyWith(isLoading: false);
      return;
    }
    
    _adminSub = FirebaseFirestore.instance.collection('admins').doc(user.uid).snapshots().listen((_) {
      _loadCapabilities();
    });
  }

  Future<void> _loadCapabilities() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      state = state.copyWith(isLoading: false);
      return;
    }

    try {
      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();

      // Check if admins doc has a real businessId (not a sparse doc from set(merge:true))
      final hasRealAdminsDoc = adminDoc.exists && 
          (adminDoc.data()?['businessId'] != null || 
           (adminDoc.data()?['role'] != null && adminDoc.data()?['role'] != 'admin'));

      if (!hasRealAdminsDoc) {
        // Fallback: user may be a Kermes volunteer (Google auth) whose role
        // was resolved by StaffRoleService.checkStaffStatus() during login.
        final roleService = StaffRoleService();
        if (roleService.isStaff && roleService.businessId != null) {
          final isKermes = roleService.businessType == 'kermes';
          
          List<String> earlyPrepZones = [];
          if (isKermes && roleService.businessId != null) {
             if (_lastListeningBusinessId != roleService.businessId) {
               _kermesSub?.cancel();
               _kermesSub = FirebaseFirestore.instance.collection('kermes_events').doc(roleService.businessId).snapshots().listen((_) {
                 if (!state.isLoading) _loadCapabilities();
               });
               _lastListeningBusinessId = roleService.businessId;
             }

             try {
                final kDoc = await FirebaseFirestore.instance.collection('kermes_events').doc(roleService.businessId).get();
                if (kDoc.exists) {
                   final pzRaw = kDoc.data()?['prepZoneAssignments'];
                   final pz = pzRaw is Map ? Map<String, dynamic>.from(pzRaw) : <String, dynamic>{};
                   for (final entry in pz.entries) {
                      final arr = List<String>.from(entry.value ?? []);
                      if (arr.contains(user.uid)) {
                         earlyPrepZones.add(entry.key);
                      }
                   }
                }
             } catch(e){}
          }
          
          final hasTezgah = isKermes && earlyPrepZones.isNotEmpty;
          final tName = earlyPrepZones.isNotEmpty ? _deriveTezgahName(earlyPrepZones) : '';
          
          // Park gorevlisi + diger custom roller
          bool earlyHasParkRole = false;
          bool earlyHasPosRole = false;
          bool earlyIsDriver = roleService.role == 'kermes_driver';
          bool earlyHasTables = roleService.role == 'kermes_waiter';
          List<Map<String, String>> earlyCustomRoles = [];
          
          try {
            final kDoc2 = await FirebaseFirestore.instance.collection('kermes_events').doc(roleService.businessId).get();
            if (kDoc2.exists) {
              final dataMap = kDoc2.data()!;
              
              final drivers = List<String>.from(dataMap['assignedDrivers'] ?? []);
              if (drivers.contains(user.uid)) earlyIsDriver = true;
              
              final waiters = List<String>.from(dataMap['assignedWaiters'] ?? []);
              if (waiters.contains(user.uid)) earlyHasTables = true;

              final rAssignRaw = dataMap['customRoleAssignments'];
              final rAssign = rAssignRaw is Map ? Map<String, dynamic>.from(rAssignRaw) : <String, dynamic>{};
              
              final parkList = List<String>.from(rAssign['role_park_system'] ?? []);
              final parkList2 = List<String>.from(rAssign['role_park'] ?? []);
              earlyHasParkRole = parkList.contains(user.uid) || parkList2.contains(user.uid);
              
              final posList = List<String>.from(rAssign['role_pos_system'] ?? []);
              final posList2 = List<String>.from(rAssign['role_pos'] ?? []);
              earlyHasPosRole = posList.contains(user.uid) || posList2.contains(user.uid);

              final allRoles = List<Map<String, dynamic>>.from(
                (dataMap['customRoles'] as List<dynamic>?)?.map((e) => Map<String, dynamic>.from(e as Map)) ?? [],
              );
              for (final role in allRoles) {
                final roleId = role['id'] as String? ?? '';
                final roleName = role['name'] as String? ?? '';
                final uids = List<String>.from(rAssign[roleId] ?? []);
                if (uids.contains(user.uid)) {
                  earlyCustomRoles.add({'id': roleId, 'name': roleName});
                }
              }
            }
          } catch(_) {}

          state = state.copyWith(
            isLoading: false,
            staffName: roleService.staffName ?? user.displayName ?? '',
            phoneNumber: user.phoneNumber ?? '',
            businessName: roleService.businessName ?? '',
            businessId: roleService.businessId,
            isDriver: earlyIsDriver,
            hasTablesRole: earlyHasTables,
            hasCourierRole: earlyIsDriver,
            hasFinanceRole: true,
            hasShiftTracking: true,
            kermesAllowedSections: roleService.kermesAllowedSections,
            userId: user.uid,
            kermesPrepZones: earlyPrepZones,
            hasTezgahRole: hasTezgah,
            hasPosRole: earlyHasPosRole,
            tezgahName: tName,
            hasParkRole: earlyHasParkRole,
            kermesCustomRoles: earlyCustomRoles,
          );
        } else {
          state = state.copyWith(isLoading: false);
        }
        return;
      }

      final data = adminDoc.data()!;
      final isDriver = data['isDriver'] == true;
      final staffName = StaffRoleService().staffName ?? data['staffName'] ?? data['name'] ?? user.displayName ?? '';
      final phoneNumber = data['phone'] ?? data['phoneNumber'] ?? user.phoneNumber ?? '';

      final userRole = (data['role'] as String?) ?? 'staff';
      final adminType = (data['adminType'] as String?) ?? '';
      final isBusinessAdmin = userRole == 'admin' && !adminType.endsWith('_staff');

      bool hasReservation = false;
      String? businessId;
      String businessName = '';
      int maxTables = 0;
      bool hasTables = false;
      List<String> assignedPrepZones = [];

      final assigned = data['assignedBusinesses'] as List<dynamic>?;
      if (assigned != null && assigned.isNotEmpty) {
        for (final id in assigned) {
          final bizDoc = await FirebaseFirestore.instance
              .collection('businesses')
              .doc(id.toString())
              .get();
          if (bizDoc.exists) {
            final bData = bizDoc.data()!;
            if (bData['hasReservation'] == true) hasReservation = true;
            businessId ??= id.toString();
            if (businessName.isEmpty) {
              businessName = bData['companyName'] ?? bData['name'] ?? '';
            }
          }
        }
      }

      final bizId = StaffRoleService().overrideBusinessId ?? data['businessId'] ?? data['butcherId'] ?? data['kermesId'];
      if (bizId != null) {
        final bizDoc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(bizId)
            .get();
        if (bizDoc.exists) {
          final bizData = bizDoc.data()!;
          businessId = bizId;
          businessName = bizData['companyName'] ?? bizData['name'] ?? '';
          if (bizData['hasReservation'] == true) {
            hasReservation = true;
          }

          final tableCount = bizData['tableCount'] as int? ?? 0;
          final maxResT = bizData['maxReservationTables'] as int? ?? 0;
          final effectiveTables = tableCount > 0 ? tableCount : maxResT;
          if (effectiveTables > 0) {
            maxTables = effectiveTables;
            hasTables = true;
          }
        } else {
          // Check if it's a kermes event
          final kermesDoc = await FirebaseFirestore.instance
              .collection('kermes_events')
              .doc(bizId)
              .get();
          if (kermesDoc.exists) {
            final kData = kermesDoc.data()!;
            businessId = bizId;
            businessName = kData['title'] ?? kData['name'] ?? 'Kermes';
            // Give basic tabs to kermes staff
            hasTables = false;
            
            // Look for assigned prep zones
            final prepRaw = kData['prepZoneAssignments'];
            final prepZoneAssignments = prepRaw is Map ? Map<String, dynamic>.from(prepRaw) : <String, dynamic>{};
            for (final entry in prepZoneAssignments.entries) {
              final assignedTo = List<String>.from(entry.value ?? []);
              if (assignedTo.contains(user.uid)) {
                assignedPrepZones.add(entry.key);
              }
            }
          }
        }
      }

      // Fallback for Kermes prep zones if we found them through StaffRoleService early exit
      if (businessId == null) {
        // ... (This shouldn't happen here normally since we'd hit the early return, but we'll re-check kermesId just in case)
      }

      // Check plan for features
      bool hasShiftTracking = false;
      bool isKermesDoc = businessId != null && businessId.isNotEmpty && businessId == bizId && await FirebaseFirestore.instance.collection('kermes_events').doc(businessId).get().then((d) => d.exists);

      if (businessId != null && !isKermesDoc) {
        final planDoc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(businessId)
            .collection('subscription')
            .doc('plan')
            .get();
            
        if (planDoc.exists) {
          final planData = planDoc.data()!;
          final isPremium = planData['isPremium'] == true;
          final features = List<String>.from(planData['features'] ?? []);
          hasShiftTracking = isPremium || features.contains('personel');
          if (!hasReservation) hasReservation = isPremium || features.contains('rezervasyon');
          if (!hasTables) hasTables = isPremium || features.contains('table_service');
        }
      } else if (isKermesDoc) {
        hasShiftTracking = true;
      }

      // Determine tezgah/pos roles for kermes staff
      final bool kermesHasTezgah = isKermesDoc && assignedPrepZones.isNotEmpty;
      final String kermesTezgahLabel = assignedPrepZones.isNotEmpty ? _deriveTezgahName(assignedPrepZones) : '';

      bool kermesIsAdmin = isBusinessAdmin;
      bool hasParkRole = false;
      bool kermesIsDriver = isDriver;
      bool kermesHasTables = hasTables;
      bool hasPosRole = false;

      List<Map<String, String>> normalCustomRoles = [];
      
      if (isKermesDoc && businessId != null) {
        try {
          final kDocCheck = await FirebaseFirestore.instance.collection('kermes_events').doc(businessId).get();
          if (kDocCheck.exists) {
            final dataMap = kDocCheck.data()!;
            
            // Check driver assignment
            final drivers = List<String>.from(dataMap['assignedDrivers'] ?? []);
            if (drivers.contains(user.uid)) kermesIsDriver = true;
            
            // Check waiters
            final waiters = List<String>.from(dataMap['assignedWaiters'] ?? []);
            if (waiters.contains(user.uid)) kermesHasTables = true;

            final rAssignRaw = dataMap['customRoleAssignments'];
            final rAssign = rAssignRaw is Map ? Map<String, dynamic>.from(rAssignRaw) : <String, dynamic>{};
            
            // Check kermes true admin status overrides
            final kAdmins = List<String>.from(dataMap['kermesAdmins'] ?? []);
            kermesIsAdmin = kAdmins.contains(user.uid) || (userRole == 'admin' && adminType == 'super');
            
            // Check park
            final parkList = List<String>.from(rAssign['role_park_system'] ?? []);
            final parkList2 = List<String>.from(rAssign['role_park'] ?? []);
            hasParkRole = parkList.contains(user.uid) || parkList2.contains(user.uid); 
            
            // POS Role: Granted to Business Admins and explicitly assigned POS users
            final posList = List<String>.from(rAssign['role_pos_system'] ?? []);
            final posList2 = List<String>.from(rAssign['role_pos'] ?? []);
            hasPosRole = posList.contains(user.uid) || posList2.contains(user.uid) || kermesIsAdmin;

            final allRoles = List<Map<String, dynamic>>.from(
              (dataMap['customRoles'] as List<dynamic>?)?.map((e) => Map<String, dynamic>.from(e as Map)) ?? [],
            );
            for (final role in allRoles) {
              final roleId = role['id'] as String? ?? '';
              final roleName = role['name'] as String? ?? '';
              final uids = List<String>.from(rAssign[roleId] ?? []);
              if (uids.contains(user.uid)) {
                normalCustomRoles.add({'id': roleId, 'name': roleName});
              }
            }
          }
        } catch(_) {}
      }

      if (businessId != null && isKermesDoc) {
        if (_lastListeningBusinessId != businessId) {
          _kermesSub?.cancel();
          _kermesSub = FirebaseFirestore.instance.collection('kermes_events').doc(businessId).snapshots().listen((_) {
            if (!state.isLoading) _loadCapabilities();
          });
          _lastListeningBusinessId = businessId;
        }
      }

      state = state.copyWith(
        isLoading: false,
        isDriver: kermesIsDriver,
        hasReservation: hasReservation,
        hasTables: kermesHasTables,
        hasShiftTracking: hasShiftTracking,
        staffName: staffName,
        phoneNumber: phoneNumber,
        businessName: businessName,
        businessId: businessId,
        maxTables: maxTables,
        isBusinessAdmin: isKermesDoc ? kermesIsAdmin : isBusinessAdmin,
        userId: user.uid,
        hasCourierRole: kermesIsDriver,
        hasTablesRole: kermesHasTables,
        hasFinanceRole: true,
        kermesAllowedSections: List<String>.from(data['kermesAllowedSections'] ?? []),
        kermesPrepZones: assignedPrepZones,
        hasTezgahRole: kermesHasTezgah,
        hasPosRole: hasPosRole,
        tezgahName: kermesTezgahLabel,
        hasParkRole: hasParkRole,
        kermesCustomRoles: normalCustomRoles,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }

  // Public method to force reload
  void reload() {
    state = state.copyWith(isLoading: true);
    Future.microtask(_loadCapabilities);
  }

  /// Derive tezgah name from prepZone assignments.
  /// e.g. ["Kadın Bölümü - Izgara"] -> "KT1"
  /// e.g. ["Erkekler Bölümü - Corba"] -> "ET1"
  String _deriveTezgahName(List<String> prepZones) {
    if (prepZones.isEmpty) return 'T1';
    final first = prepZones.first.toLowerCase();
    if (first.contains('kadin') || first.contains('kadın') || first.contains('hanim') || first.contains('hanım')) {
      return 'KT1';
    } else if (first.contains('erkek')) {
      return 'ET1';
    }
    return 'T1';
  }
}

final staffCapabilitiesProvider = NotifierProvider<StaffCapabilitiesNotifier, StaffCapabilities>(() {
  return StaffCapabilitiesNotifier();
});
