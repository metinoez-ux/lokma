import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class StaffCapabilities {
  final bool isLoading;
  final bool isDriver;
  final bool hasReservation;
  final bool hasTables;
  final bool hasShiftTracking;
  final String staffName;
  final String businessName;
  final String? businessId;
  final int maxTables;
  final List<int> assignedTables;
  final String userId;
  final bool hasCourierRole;
  final bool hasTablesRole;
  final bool hasFinanceRole;
  final bool isBusinessAdmin;

  StaffCapabilities({
    this.isLoading = true,
    this.isDriver = false,
    this.hasReservation = false,
    this.hasTables = false,
    this.hasShiftTracking = false,
    this.staffName = '',
    this.businessName = '',
    this.businessId,
    this.maxTables = 0,
    this.assignedTables = const [],
    this.isBusinessAdmin = false,
    this.userId = '',
    this.hasCourierRole = false,
    this.hasTablesRole = false,
    this.hasFinanceRole = false,
  });

  StaffCapabilities copyWith({
    bool? isLoading,
    bool? isDriver,
    bool? hasReservation,
    bool? hasTables,
    bool? hasShiftTracking,
    String? staffName,
    String? businessName,
    String? businessId,
    int? maxTables,
    List<int>? assignedTables,
    bool? isBusinessAdmin,
    String? userId,
    bool? hasCourierRole,
    bool? hasTablesRole,
    bool? hasFinanceRole,
  }) {
    return StaffCapabilities(
      isLoading: isLoading ?? this.isLoading,
      isDriver: isDriver ?? this.isDriver,
      hasReservation: hasReservation ?? this.hasReservation,
      hasTables: hasTables ?? this.hasTables,
      hasShiftTracking: hasShiftTracking ?? this.hasShiftTracking,
      staffName: staffName ?? this.staffName,
      businessName: businessName ?? this.businessName,
      businessId: businessId ?? this.businessId,
      maxTables: maxTables ?? this.maxTables,
      assignedTables: assignedTables ?? this.assignedTables,
      isBusinessAdmin: isBusinessAdmin ?? this.isBusinessAdmin,
      userId: userId ?? this.userId,
      hasCourierRole: hasCourierRole ?? this.hasCourierRole,
      hasTablesRole: hasTablesRole ?? this.hasTablesRole,
      hasFinanceRole: hasFinanceRole ?? this.hasFinanceRole,
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

      if (!adminDoc.exists) {
        state = state.copyWith(isLoading: false);
        return;
      }

      final data = adminDoc.data()!;
      final isDriver = data['isDriver'] == true;
      final staffName = data['staffName'] ?? data['name'] ?? user.displayName ?? '';

      final userRole = (data['role'] as String?) ?? 'staff';
      final adminType = (data['adminType'] as String?) ?? '';
      final isBusinessAdmin = userRole == 'admin' && !adminType.endsWith('_staff');

      bool hasReservation = false;
      String? businessId;
      String businessName = '';
      int maxTables = 0;
      bool hasTables = false;

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

      final bizId = data['businessId'] ?? data['butcherId'];
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
        }
      }

      // Check plan for features
      bool hasShiftTracking = false;
      if (businessId != null) {
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
      }

      state = state.copyWith(
        isLoading: false,
        isDriver: isDriver,
        hasReservation: hasReservation,
        hasTables: hasTables,
        hasShiftTracking: hasShiftTracking,
        staffName: staffName,
        businessName: businessName,
        businessId: businessId,
        maxTables: maxTables,
        isBusinessAdmin: isBusinessAdmin,
        userId: user.uid,
        hasCourierRole: isDriver, // simplified mapped role
        hasTablesRole: hasTables, // simplified mapped role
        hasFinanceRole: true, // everyone on staff hub gets wallet access currently
      );
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }
}

final staffCapabilitiesProvider = NotifierProvider<StaffCapabilitiesNotifier, StaffCapabilities>(() {
  return StaffCapabilitiesNotifier();
});
