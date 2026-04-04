import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Staff Role Service - Detects if current user is staff/admin
class StaffRoleService {
  static final StaffRoleService _instance = StaffRoleService._internal();
  factory StaffRoleService() => _instance;
  StaffRoleService._internal();

  final FirebaseFirestore _db = FirebaseFirestore.instance;
  
  bool _isStaff = false;
  String? _businessId;
  String? _businessName;
  String? _businessType;
  String? _staffName;
  String? _role;
  DateTime? _lastCashSettlement;
  List<String> _kermesAllowedSections = [];

  // Overrides for dual-role capability (e.g. Kasap + Kermes volunteer)
  String? _overrideBusinessId;
  String? _overrideBusinessName;
  String? _overrideBusinessType;
  
  bool get isStaff => _isStaff;
  String? get businessId => _overrideBusinessId ?? _businessId;
  String? get businessName => _overrideBusinessName ?? _businessName;
  String? get businessType => _overrideBusinessType ?? _businessType;
  String? get staffName => _staffName;
  String? get role => _role;
  DateTime? get lastCashSettlement => _lastCashSettlement;
  List<String> get kermesAllowedSections => _kermesAllowedSections;

  void setOverrideWorkplace(String id, String name, String type) {
    _overrideBusinessId = id;
    _overrideBusinessName = name;
    _overrideBusinessType = type;
  }

  void clearOverride() {
    _overrideBusinessId = null;
    _overrideBusinessName = null;
    _overrideBusinessType = null;
  }

  /// Check if current user is a staff member
  Future<bool> checkStaffStatus() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      _resetStatus();
      return false;
    }

    try {
      // Check admins collection first (traditional staff/business admin)
      final adminDoc = await _db.collection('admins').doc(user.uid).get();
      
      if (adminDoc.exists) {
        final data = adminDoc.data()!;
        _isStaff = true;
        _businessId = data['businessId'];
        _businessName = data['businessName'];
        _businessType = data['businessType'];
        _staffName = data['name'] ?? data['displayName'] ?? 'Personel';
        _role = data['role'] ?? 'admin';
        _lastCashSettlement = (data['lastCashSettlement'] as Timestamp?)?.toDate();
        _kermesAllowedSections = List<String>.from(data['kermesAllowedSections'] ?? []);
        
        // Register FCM token for delivery notifications
        await _registerFcmToken(user.uid);
        
        debugPrint('[StaffRole] User is staff: $_staffName, businessId: $_businessId');
        return true;
      }
      
      // Fallback: Check if user is assigned as Kermes staff/driver/waiter
      // Kermes staff are stored in assignedStaff/assignedDrivers/assignedWaiters arrays
      final kermesQuery = await _db.collection('kermes_events')
          .where('assignedStaff', arrayContains: user.uid)
          .limit(1)
          .get();

      if (kermesQuery.docs.isNotEmpty) {
        final kermesData = kermesQuery.docs.first.data();
        _isStaff = true;
        _businessId = kermesQuery.docs.first.id;
        _businessName = kermesData['name'] ?? 'Kermes';
        _businessType = 'kermes';
        _staffName = user.displayName ?? 'Gonullu';
        _role = 'kermes_staff';
        _kermesAllowedSections = List<String>.from(kermesData['kermesAllowedSections'] ?? []);
        
        await _registerFcmToken(user.uid);
        debugPrint('[StaffRole] User is Kermes staff: $_staffName, kermesId: $_businessId');
        return true;
      }

      // Also check assignedDrivers
      final driverQuery = await _db.collection('kermes_events')
          .where('assignedDrivers', arrayContains: user.uid)
          .limit(1)
          .get();

      if (driverQuery.docs.isNotEmpty) {
        final kermesData = driverQuery.docs.first.data();
        _isStaff = true;
        _businessId = driverQuery.docs.first.id;
        _businessName = kermesData['name'] ?? 'Kermes';
        _businessType = 'kermes';
        _staffName = user.displayName ?? 'Surucu';
        _role = 'kermes_driver';
        _kermesAllowedSections = List<String>.from(kermesData['kermesAllowedSections'] ?? []);
        
        await _registerFcmToken(user.uid);
        debugPrint('[StaffRole] User is Kermes driver: $_staffName, kermesId: $_businessId');
        return true;
      }

      // Also check assignedWaiters
      final waiterQuery = await _db.collection('kermes_events')
          .where('assignedWaiters', arrayContains: user.uid)
          .limit(1)
          .get();

      if (waiterQuery.docs.isNotEmpty) {
        final kermesData = waiterQuery.docs.first.data();
        _isStaff = true;
        _businessId = waiterQuery.docs.first.id;
        _businessName = kermesData['name'] ?? 'Kermes';
        _businessType = 'kermes';
        _staffName = user.displayName ?? 'Garson';
        _role = 'kermes_waiter';
        _kermesAllowedSections = List<String>.from(kermesData['kermesAllowedSections'] ?? []);

        await _registerFcmToken(user.uid);
        debugPrint('[StaffRole] User is Kermes waiter: $_staffName, kermesId: $_businessId');
        return true;
      }

      // Not a staff member
      _resetStatus();
      return false;
    } catch (e) {
      debugPrint('[StaffRole] Error checking staff status: $e');
      _resetStatus();
      return false;
    }
  }

  /// Register FCM token for this staff member
  Future<void> _registerFcmToken(String uid) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _db.collection('admins').doc(uid).update({
          'fcmToken': token,
          'fcmTokenUpdatedAt': FieldValue.serverTimestamp(),
        });
        debugPrint('[StaffRole] FCM token registered');
      }
    } catch (e) {
      debugPrint('[StaffRole] Error registering FCM token: $e');
    }
  }

  void _resetStatus() {
    _isStaff = false;
    _businessId = null;
    _businessName = null;
    _businessType = null;
    _staffName = null;
    _role = null;
    _lastCashSettlement = null;
    _kermesAllowedSections = [];
    clearOverride();
  }

  /// Listen to auth changes and update status
  void listenToAuthChanges() {
    FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) {
        checkStaffStatus();
      } else {
        _resetStatus();
      }
    });
  }

  /// Settle unremitted cash with the business
  Future<void> settleCash(double amount) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || _businessId == null) return;
    
    final now = FieldValue.serverTimestamp();
    
    // Log the settlement request
    await _db.collection('cash_settlements').add({
      'staffId': user.uid,
      'staffName': _staffName ?? 'Personel',
      'businessId': _businessId,
      'amount': amount,
      'settledAt': now,
    });
    
    // Update the staff document's lastCashSettlement timestamp to reset their counter
    await _db.collection('admins').doc(user.uid).update({
      'lastCashSettlement': now,
    });
    
    // Update local state optimistically
    _lastCashSettlement = DateTime.now();
    debugPrint('[StaffRole] Cash settled for amount: $amount');
  }
}
