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
    required this.isActive,
  });

  factory DriverInfo.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return DriverInfo(
      id: doc.id,
      email: data['email'] ?? '',
      name: data['name'] ?? data['displayName'] ?? '',
      phone: data['phone'],
      role: data['role'] ?? 'driver',
      driverType: data['driverType'] ?? 'business',
      assignedBusinesses: List<String>.from(data['assignedBusinesses'] ?? []),
      assignedBusinessNames: List<String>.from(data['assignedBusinessNames'] ?? []),
      isActive: data['isActive'] ?? true,
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
      // Check if user is a driver in the admins collection
      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(uid)
          .get();

      if (adminDoc.exists) {
        final data = adminDoc.data();
        if (data != null) {
          // HYBRID ROLE CHECK: User is a driver if:
          // 1. They have isDriver: true (staff/admin who is also a driver)
          // 2. OR they have role == 'driver' (dedicated driver)
          final isDriver = data['isDriver'] == true || data['role'] == 'driver';
          
          if (isDriver && (data['assignedBusinesses'] as List?)?.isNotEmpty == true) {
            final driverInfo = DriverInfo.fromFirestore(adminDoc);
            state = DriverState(
              driverInfo: driverInfo,
              isLoading: false,
              isDriver: true,
            );
            return;
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
