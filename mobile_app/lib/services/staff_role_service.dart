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
  
  bool _isChecking = false;
  String? _lastCheckedUid;
  bool _isStaff = false;
  String? _businessId;
  String? _businessName;
  String? _businessType;
  String? _staffName;
  String? _role;
  bool _isDriver = false;
  DateTime? _lastCashSettlement;
  List<String> _kermesAllowedSections = [];

  // Overrides for dual-role capability (e.g. Kasap + Kermes volunteer)
  String? _overrideBusinessId;
  String? _overrideBusinessName;
  String? _overrideBusinessType;
  String? get overrideBusinessId => _overrideBusinessId;
  String? get overrideBusinessName => _overrideBusinessName;
  String? get overrideBusinessType => _overrideBusinessType;
  
  bool get isStaff => _isStaff;
  String? get businessId => _overrideBusinessId ?? _businessId;
  String? get businessName => _overrideBusinessName ?? _businessName;
  String? get businessType => _overrideBusinessType ?? _businessType;
  String? get staffName => _staffName;
  String? get role => _role;
  bool get isDriver => _isDriver;
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
  /// Preserves existing valid session if fresh check fails (network timeout etc.)
  Future<bool> checkStaffStatus() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      _resetStatus();
      return false;
    }

    // Prevent concurrent checks
    if (_isChecking) {
      debugPrint('[StaffRole] Check already in progress, returning current: $_isStaff');
      return _isStaff;
    }
    _isChecking = true;

    try {
      // Try server first, then fall back to cache if offline
      final result = await _tryCheckStaff(user, null) ||
                     await _tryCheckStaff(user, Source.cache);
      
      if (!result) {
        // Only reset if we had a clean check and user genuinely isn't staff
        _resetStatus();
      }
      _lastCheckedUid = user.uid;
      return result;
    } catch (e) {
      // On unexpected error, preserve existing state to avoid logout-on-timeout
      debugPrint('[StaffRole] checkStaffStatus error, preserving existing state ($_isStaff): $e');
      return _isStaff;
    } finally {
      _isChecking = false;
    }
  }

  /// Attempt staff detection from given source (null = default/server, Source.cache = offline)
  Future<bool> _tryCheckStaff(User user, Source? source) async {
    try {
      final getOpts = source != null ? GetOptions(source: source) : null;

      // Check admins collection first (traditional staff/business admin)
      final adminDoc = getOpts != null
          ? await _db.collection('admins').doc(user.uid).get(getOpts)
          : await _db.collection('admins').doc(user.uid).get();
      
      if (adminDoc.exists) {
        final data = adminDoc.data()!;
        final docBusinessId = data['businessId'] as String?;
        final assignedBusinesses = data['assignedBusinesses'] as List<dynamic>?;
        final resolvedBusinessId = docBusinessId ?? (assignedBusinesses != null && assignedBusinesses.isNotEmpty ? assignedBusinesses.first as String : null);
        final docRole = data['role'] as String?;
        
        // Only treat as valid staff if doc has a real businessId or role
        // (set(merge:true) from ShiftService creates sparse docs with only shift fields)
        if (resolvedBusinessId != null || (docRole != null && docRole != 'admin')) {
          _isStaff = true;
          _businessId = resolvedBusinessId;
          _businessName = data['businessName'];
          _businessType = data['businessType'];
          _staffName = data['name'] ?? data['displayName'] ?? 'Personel';
          _role = docRole ?? 'admin';
          _isDriver = data['isDriver'] == true || _role == 'surucu' || _role == 'kurye';
          _lastCashSettlement = (data['lastCashSettlement'] as Timestamp?)?.toDate();
          _kermesAllowedSections = List<String>.from(data['kermesAllowedSections'] ?? []);
          
          // Register FCM token for delivery notifications (fire-and-forget, skip if offline)
          if (source == null) {
            _registerFcmToken(user.uid); // Non-blocking: don't await to speed up login
          }
          
          debugPrint('[StaffRole] User is staff: $_staffName, businessId: $_businessId (source: ${source ?? "server"})');
          return true;
        }
        // else: sparse doc from set(merge:true), fall through to kermes check
        debugPrint('[StaffRole] Sparse admins doc found (no businessId), checking kermes...');
      }
      
      // Fallback: Check if user is assigned as Kermes staff/driver/waiter
      final kermesQuery = getOpts != null
          ? await _db.collection('kermes_events')
              .where('assignedStaff', arrayContains: user.uid)
              .limit(1).get(getOpts)
          : await _db.collection('kermes_events')
              .where('assignedStaff', arrayContains: user.uid)
              .limit(1).get();

      if (kermesQuery.docs.isNotEmpty) {
        final kermesData = kermesQuery.docs.first.data();
        _isStaff = true;
        _businessId = kermesQuery.docs.first.id;
        _businessName = kermesData['title'] ?? kermesData['name'] ?? 'Kermes';
        _businessType = 'kermes';
        _staffName = user.displayName ?? 'Gonullu';
        _role = 'kermes_staff';
        _kermesAllowedSections = List<String>.from(kermesData['kermesAllowedSections'] ?? []);
        
        if (source == null) _registerFcmToken(user.uid);
        debugPrint('[StaffRole] User is Kermes staff: $_staffName, kermesId: $_businessId (source: ${source ?? "server"})');
        return true;
      }

      // Also check assignedDrivers
      final driverQuery = getOpts != null
          ? await _db.collection('kermes_events')
              .where('assignedDrivers', arrayContains: user.uid)
              .limit(1).get(getOpts)
          : await _db.collection('kermes_events')
              .where('assignedDrivers', arrayContains: user.uid)
              .limit(1).get();

      if (driverQuery.docs.isNotEmpty) {
        final kermesData = driverQuery.docs.first.data();
        _isStaff = true;
        _businessId = driverQuery.docs.first.id;
        _businessName = kermesData['title'] ?? kermesData['name'] ?? 'Kermes';
        _businessType = 'kermes';
        _staffName = user.displayName ?? 'Surucu';
        _role = 'kermes_driver';
        _kermesAllowedSections = List<String>.from(kermesData['kermesAllowedSections'] ?? []);
        
        if (source == null) _registerFcmToken(user.uid);
        debugPrint('[StaffRole] User is Kermes driver: $_staffName, kermesId: $_businessId (source: ${source ?? "server"})');
        return true;
      }

      // Also check assignedWaiters
      final waiterQuery = getOpts != null
          ? await _db.collection('kermes_events')
              .where('assignedWaiters', arrayContains: user.uid)
              .limit(1).get(getOpts)
          : await _db.collection('kermes_events')
              .where('assignedWaiters', arrayContains: user.uid)
              .limit(1).get();

      if (waiterQuery.docs.isNotEmpty) {
        final kermesData = waiterQuery.docs.first.data();
        _isStaff = true;
        _businessId = waiterQuery.docs.first.id;
        _businessName = kermesData['title'] ?? kermesData['name'] ?? 'Kermes';
        _businessType = 'kermes';
        _staffName = user.displayName ?? 'Garson';
        _role = 'kermes_waiter';
        _kermesAllowedSections = List<String>.from(kermesData['kermesAllowedSections'] ?? []);

        if (source == null) _registerFcmToken(user.uid);
        debugPrint('[StaffRole] User is Kermes waiter: $_staffName, kermesId: $_businessId (source: ${source ?? "server"})');
        return true;
      }

      return false;
    } catch (e) {
      debugPrint('[StaffRole] Error checking staff (source: ${source ?? "server"}): $e');
      return false;
    }
  }

  /// Register FCM token for this staff member
  /// Writes both singular fcmToken and fcmTokens array for Cloud Function compatibility
  Future<void> _registerFcmToken(String uid) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _db.collection('admins').doc(uid).set({
          'fcmToken': token,
          'fcmTokens': FieldValue.arrayUnion([token]),
          'fcmTokenUpdatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
        debugPrint('[StaffRole] FCM token registered (singular + array)');
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
    _isDriver = false;
    _lastCashSettlement = null;
    _kermesAllowedSections = [];
    clearOverride();
  }

  /// Listen to auth changes and update status
  /// Debounced: skips re-check if the same user is already authenticated
  void listenToAuthChanges() {
    FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) {
        // Skip re-check if same user is already verified as staff
        if (_lastCheckedUid == user.uid && _isStaff) {
          debugPrint('[StaffRole] Auth event for same user ${user.uid}, skipping re-check (already staff)');
          return;
        }
        checkStaffStatus();
      } else {
        _lastCheckedUid = null;
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
