import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/providers/auth_provider.dart';

/// Driver information model for couriers assigned to multiple businesses
class DriverInfo {
  final String id;
  final String email;
  final String name;
  final String? phone;
  final String role;
  final String driverType; // 'lokma_fleet' or 'business'
  final List<String> assignedBusinesses;
  final List<String> assignedBusinessNames;
  final List<String> assignedKermesIds;
  final bool isActive;

  const DriverInfo({
    required this.id,
    required this.email,
    required this.name,
    this.phone,
    required this.role,
    required this.driverType,
    required this.assignedBusinesses,
    required this.assignedBusinessNames,
    this.assignedKermesIds = const [],
    required this.isActive,
  });

  factory DriverInfo.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    
    // Ensure primary businessId is included in assignedBusinesses
    final assignedBiz = List<String>.from(data['assignedBusinesses'] ?? []);
    final primaryBizId = data['businessId'] as String? ?? data['butcherId'] as String?;
    if (primaryBizId != null && primaryBizId.isNotEmpty && !assignedBiz.contains(primaryBizId)) {
      assignedBiz.insert(0, primaryBizId);
    }
    
    // Ensure primary businessName is included in assignedBusinessNames
    final assignedBizNames = List<String>.from(data['assignedBusinessNames'] ?? []);
    final primaryBizName = data['businessName'] as String? ?? data['butcherName'] as String?;
    if (primaryBizName != null && primaryBizName.isNotEmpty && !assignedBizNames.contains(primaryBizName)) {
      assignedBizNames.insert(0, primaryBizName);
    }

    return DriverInfo(
      id: doc.id,
      email: data['email'] ?? '',
      name: data['name'] ?? data['displayName'] ?? '',
      phone: data['phone'],
      role: data['role'] ?? 'driver',
      driverType: data['driverType'] ?? 'business',
      assignedBusinesses: assignedBiz,
      assignedBusinessNames: assignedBizNames,
      assignedKermesIds: List<String>.from(data['assignedKermesIds'] ?? []), // Note: In case we save directly to user, though we fetch separately most times
      isActive: data['isActive'] ?? true,
    );
  }

  /// Create a copy with updated fields
  DriverInfo copyWith({
    List<String>? assignedKermesIds,
  }) {
    return DriverInfo(
      id: id,
      email: email,
      name: name,
      phone: phone,
      role: role,
      driverType: driverType,
      assignedBusinesses: assignedBusinesses,
      assignedBusinessNames: assignedBusinessNames,
      assignedKermesIds: assignedKermesIds ?? this.assignedKermesIds,
      isActive: isActive,
    );
  }

  /// Check if this driver is assigned to a specific business
  bool isAssignedTo(String businessId) {
    return assignedBusinesses.contains(businessId);
  }

  /// Check if this is a LOKMA fleet driver
  bool get isLokmaFleet => driverType == 'lokma_fleet';
}

/// Driver state for the app
class DriverState {
  final DriverInfo? driverInfo;
  final bool isLoading;
  final String? error;
  final bool isDriver;

  const DriverState({
    this.driverInfo,
    this.isLoading = false,
    this.error,
    this.isDriver = false,
  });

  DriverState copyWith({
    DriverInfo? driverInfo,
    bool? isLoading,
    String? error,
    bool? isDriver,
  }) {
    return DriverState(
      driverInfo: driverInfo ?? this.driverInfo,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      isDriver: isDriver ?? this.isDriver,
    );
  }
}

/// Provider that manages driver information for the current user
class DriverNotifier extends Notifier<DriverState> {
  @override
  DriverState build() {
    // Listen to auth state changes
    ref.listen<AuthState>(authProvider, (previous, next) {
      if (next.user != null) {
        _loadDriverInfo(next.user!.uid);
      } else {
        state = const DriverState();
      }
    });

    // Initial load if user is already logged in
    final authState = ref.read(authProvider);
    if (authState.user != null) {
      _loadDriverInfo(authState.user!.uid);
    }

    return const DriverState(isLoading: true);
  }

  /// Load driver information from Firestore
  Future<void> _loadDriverInfo(String uid) async {
    state = state.copyWith(isLoading: true);

    try {
      // Use cache first since StaffRoleService already fetched from server
      DocumentSnapshot? adminDoc;
      try {
        adminDoc = await FirebaseFirestore.instance
            .collection('admins')
            .doc(uid)
            .get(const GetOptions(source: Source.cache))
            .timeout(const Duration(seconds: 2));
      } catch (_) {
        // Cache miss - fall back to server
        adminDoc = await FirebaseFirestore.instance
            .collection('admins')
            .doc(uid)
            .get()
            .timeout(const Duration(seconds: 6));
      }

      if (adminDoc.exists) {
        final data = adminDoc.data() as Map<String, dynamic>?;
        if (data != null) {
          // HYBRID ROLE CHECK: User is a driver if:
          // 1. They have isDriver: true (staff/admin who is also a driver)
          // 2. OR they have role == 'driver' (dedicated driver)
          final isDriver = data['isDriver'] == true || 
                           data['role'] == 'driver' || 
                           data['role'] == 'surucu' || 
                           data['role'] == 'kurye';
          
          if (isDriver) {
            DriverInfo driverInfo = DriverInfo.fromFirestore(adminDoc);
            
            // Set driver state IMMEDIATELY - don't wait for kermes query
            if (driverInfo.assignedBusinesses.isNotEmpty) {
              state = DriverState(
                driverInfo: driverInfo,
                isLoading: false,
                isDriver: true,
              );
              
              // Fetch kermes assignments in background and merge if found
              _loadKermesAssignments(uid, driverInfo);
              return;
            }

            // No regular businesses - must check kermes (blocking)
            try {
              final kermesQuery = await FirebaseFirestore.instance
                  .collection('kermes_events')
                  .where('assignedDrivers', arrayContains: uid)
                  .get()
                  .timeout(const Duration(seconds: 4));
                  
              final kermesIds = kermesQuery.docs.map((doc) => doc.id).toList();
              if (kermesIds.isNotEmpty) {
                driverInfo = driverInfo.copyWith(assignedKermesIds: kermesIds);
              }
            } catch (kermesError) {
              print('Error fetching Kermes assignments: \$kermesError');
            }

            // A driver must have either regular businesses OR kermes events assigned
            if (driverInfo.assignedBusinesses.isNotEmpty || driverInfo.assignedKermesIds.isNotEmpty) {
              state = DriverState(
                driverInfo: driverInfo,
                isLoading: false,
                isDriver: true,
              );
              return;
            }
          }
        }
      }

      // Not a driver
      state = const DriverState(isLoading: false, isDriver: false);
    } catch (e) {
      state = DriverState(
        isLoading: false,
        error: e.toString(),
        isDriver: false,
      );
    }
  }

  /// Background loader for kermes assignments - merges into existing state
  Future<void> _loadKermesAssignments(String uid, DriverInfo currentInfo) async {
    try {
      final kermesQuery = await FirebaseFirestore.instance
          .collection('kermes_events')
          .where('assignedDrivers', arrayContains: uid)
          .get()
          .timeout(const Duration(seconds: 4));
          
      final kermesIds = kermesQuery.docs.map((doc) => doc.id).toList();
      if (kermesIds.isNotEmpty && state.isDriver) {
        state = DriverState(
          driverInfo: currentInfo.copyWith(assignedKermesIds: kermesIds),
          isLoading: false,
          isDriver: true,
        );
      }
    } catch (_) {
      // Non-critical - kermes assignments can be loaded later
    }
  }

  /// Refresh driver information
  Future<void> refresh() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      await _loadDriverInfo(user.uid);
    }
  }

  /// Get list of business IDs this driver can access
  List<String> get assignedBusinessIds {
    return state.driverInfo?.assignedBusinesses ?? [];
  }
}

// Provider instance
final driverProvider = NotifierProvider<DriverNotifier, DriverState>(
  DriverNotifier.new,
);

// Convenience provider to check if current user is a driver
final isDriverProvider = Provider<bool>((ref) {
  return ref.watch(driverProvider).isDriver;
});

// Provider to get assigned business IDs for the driver
final driverBusinessIdsProvider = Provider<List<String>>((ref) {
  return ref.watch(driverProvider).driverInfo?.assignedBusinesses ?? [];
});
