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
    );
  }
}

class StaffCapabilitiesNotifier extends Notifier<StaffCapabilities> {
  @override
  StaffCapabilities build() {
    // Return initial state synchronously first
    final initialState = StaffCapabilities();
    // Then kick off async load
    Future.microtask(_loadCapabilities);
    return initialState;
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
             try {
                final kDoc = await FirebaseFirestore.instance.collection('kermes_events').doc(roleService.businessId).get();
                if (kDoc.exists) {
                   final pz = kDoc.data()?['prepZoneAssignments'] as Map<String, dynamic>? ?? {};
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
          
          // Park gorevlisi kontrolu - customRoleAssignments.role_park_system
          bool earlyHasParkRole = false;
          try {
            final kDoc2 = await FirebaseFirestore.instance.collection('kermes_events').doc(roleService.businessId).get();
            if (kDoc2.exists) {
              final rAssign = kDoc2.data()?['customRoleAssignments'] as Map<String, dynamic>? ?? {};
              final parkList = List<String>.from(rAssign['role_park_system'] ?? []);
              earlyHasParkRole = parkList.contains(user.uid);
            }
          } catch(_) {}

          state = state.copyWith(
            isLoading: false,
            staffName: roleService.staffName ?? user.displayName ?? '',
            phoneNumber: user.phoneNumber ?? '',
            businessName: roleService.businessName ?? '',
            businessId: roleService.businessId,
            isDriver: roleService.role == 'kermes_driver',
            hasTablesRole: roleService.role == 'kermes_waiter',
            hasCourierRole: roleService.role == 'kermes_driver',
            hasFinanceRole: true,
            hasShiftTracking: true,
            kermesAllowedSections: roleService.kermesAllowedSections,
            userId: user.uid,
            kermesPrepZones: earlyPrepZones,
            hasTezgahRole: hasTezgah,
            hasPosRole: isKermes,
            tezgahName: tName,
            hasParkRole: earlyHasParkRole || isKermes, // deneme: tum kermes personeli gorebilir
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
            final prepZoneAssignments = kData['prepZoneAssignments'] as Map<String, dynamic>? ?? {};
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
      bool isKermesDoc = businessId != null && businessId == bizId && await FirebaseFirestore.instance.collection('kermes_events').doc(businessId).get().then((d) => d.exists);

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

      // Park gorevlisi kontrolu - kermes doc icindeki customRoleAssignments
      bool hasParkRole = false;
      if (isKermesDoc && businessId != null) {
        try {
          final kDocCheck = await FirebaseFirestore.instance.collection('kermes_events').doc(businessId).get();
          if (kDocCheck.exists) {
            final rAssign = kDocCheck.data()?['customRoleAssignments'] as Map<String, dynamic>? ?? {};
            final parkList = List<String>.from(rAssign['role_park_system'] ?? []);
            hasParkRole = parkList.contains(user.uid) || isKermesDoc; // deneme: tum personel
          }
        } catch(_) {}
      }

      state = state.copyWith(
        isLoading: false,
        isDriver: isDriver,
        hasReservation: hasReservation,
        hasTables: hasTables,
        hasShiftTracking: hasShiftTracking,
        staffName: staffName,
        phoneNumber: phoneNumber,
        businessName: businessName,
        businessId: businessId,
        maxTables: maxTables,
        isBusinessAdmin: isBusinessAdmin,
        userId: user.uid,
        hasCourierRole: isDriver,
        hasTablesRole: hasTables,
        hasFinanceRole: true,
        kermesAllowedSections: List<String>.from(data['kermesAllowedSections'] ?? []),
        kermesPrepZones: assignedPrepZones,
        hasTezgahRole: kermesHasTezgah,
        hasPosRole: isKermesDoc,
        tezgahName: kermesTezgahLabel,
        hasParkRole: hasParkRole,
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
