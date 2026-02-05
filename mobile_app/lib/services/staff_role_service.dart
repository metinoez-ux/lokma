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
  String? _staffName;
  String? _role;
  
  bool get isStaff => _isStaff;
  String? get businessId => _businessId;
  String? get staffName => _staffName;
  String? get role => _role;

  /// Check if current user is a staff member
  Future<bool> checkStaffStatus() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      _resetStatus();
      return false;
    }

    try {
      // Check admins collection
      final adminDoc = await _db.collection('admins').doc(user.uid).get();
      
      if (adminDoc.exists) {
        final data = adminDoc.data()!;
        _isStaff = true;
        _businessId = data['businessId'];
        _staffName = data['name'] ?? data['displayName'] ?? 'Personel';
        _role = data['role'] ?? 'staff';
        
        // Register FCM token for delivery notifications
        await _registerFcmToken(user.uid);
        
        debugPrint('[StaffRole] User is staff: $_staffName, businessId: $_businessId');
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
    _staffName = null;
    _role = null;
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
}
