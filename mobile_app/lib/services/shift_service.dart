import 'dart:async';
import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

/// Staff Shift Service — manages Play/Pause/Stop shift lifecycle
/// 
/// Firestore paths:
/// - businesses/{businessId}/shifts/{shiftId} — shift documents
/// - admins/{uid} — real-time shift status fields
class ShiftService {
  static final ShiftService _instance = ShiftService._internal();
  factory ShiftService() => _instance;
  ShiftService._internal();

  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // ── Current shift state ──
  String? _currentShiftId;
  String? _currentBusinessId;
  DateTime? _shiftStartedAt;
  String _shiftStatus = 'off'; // "active" | "paused" | "off"
  List<int> _currentTables = [];

  String? get currentShiftId => _currentShiftId;
  String? get currentBusinessId => _currentBusinessId;
  DateTime? get shiftStartedAt => _shiftStartedAt;
  String get shiftStatus => _shiftStatus;
  List<int> get currentTables => _currentTables;
  bool get isOnShift => _shiftStatus == 'active' || _shiftStatus == 'paused';

  // ── Stream for UI ──
  Stream<DocumentSnapshot>? _shiftStream;
  Stream<DocumentSnapshot>? get shiftStream => _shiftStream;

  // ── Mid-shift GPS check timers ──
  final List<Timer> _gpsCheckTimers = [];
  static const int _minGpsChecks = 2;
  static const int _maxGpsChecks = 3;

  /// Restore shift state from Firestore on app start
  Future<void> restoreShiftState() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      final adminDoc = await _db.collection('admins').doc(user.uid).get();
      if (!adminDoc.exists) return;

      final data = adminDoc.data()!;
      final isOnShift = data['isOnShift'] == true;
      final shiftId = data['currentShiftId'] as String?;
      final bizId = data['shiftBusinessId'] as String?;

      if (isOnShift && shiftId != null && bizId != null) {
        // Verify the shift doc still exists and is active
        final shiftDoc = await _db
            .collection('businesses')
            .doc(bizId)
            .collection('shifts')
            .doc(shiftId)
            .get();

        if (shiftDoc.exists) {
          final shiftData = shiftDoc.data()!;
          final status = shiftData['status'] as String? ?? 'ended';
          if (status == 'active' || status == 'paused') {
            _currentShiftId = shiftId;
            _currentBusinessId = bizId;
            _shiftStatus = status;
            _shiftStartedAt = (shiftData['startedAt'] as Timestamp?)?.toDate();
            _currentTables = List<int>.from(
              (shiftData['assignedTables'] as List<dynamic>?) ?? [],
            );
            _setupShiftStream();
            if (_shiftStatus == 'active') {
              _scheduleRandomGpsChecks();
            }
            debugPrint('[Shift] Restored shift: $_currentShiftId status=$_shiftStatus');
            return;
          }
        }

        // Shift doc is gone or ended — clean up admin doc
        await _clearAdminShiftFields(user.uid);
      }
    } catch (e) {
      debugPrint('[Shift] Error restoring shift: $e');
    }
  }

  /// Start a new shift
  Future<String?> startShift({
    required String businessId,
    required String staffName,
    required List<int> tables,
    bool isDeliveryDriver = false,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return null;

    try {
      // Get GPS location
      Map<String, dynamic>? locationData;
      try {
        locationData = await _getLocationData();
      } catch (e) {
        debugPrint('[Shift] GPS error (non-blocking): $e');
        // GPS failure shouldn't block shift start
      }

      final now = FieldValue.serverTimestamp();
      final dateStr = _todayString();

      // Create shift document
      final shiftRef = _db
          .collection('businesses')
          .doc(businessId)
          .collection('shifts')
          .doc();

      final shiftData = {
        'staffId': user.uid,
        'staffName': staffName,
        'businessId': businessId,
        'date': dateStr,
        'status': 'active',
        'startedAt': now,
        'endedAt': null,
        'startLocation': locationData,
        'assignedTables': tables,
        'isDeliveryDriver': isDeliveryDriver,
        'pauseLog': [],
        'totalMinutes': 0,
        'pauseMinutes': 0,
        'createdAt': now,
      };

      await shiftRef.set(shiftData);

      // Update admin doc with real-time shift status
      await _db.collection('admins').doc(user.uid).update({
        'isOnShift': true,
        'currentShiftId': shiftRef.id,
        'shiftBusinessId': businessId,
        'shiftStatus': 'active',
        'shiftStartedAt': now,
        'shiftAssignedTables': tables,
        'shiftIsDeliveryDriver': isDeliveryDriver,
      });

      // Update local state
      _currentShiftId = shiftRef.id;
      _currentBusinessId = businessId;
      _shiftStatus = 'active';
      _shiftStartedAt = DateTime.now();
      _currentTables = tables;
      _setupShiftStream();
      _scheduleRandomGpsChecks();

      debugPrint('[Shift] Started shift: ${shiftRef.id}');
      return shiftRef.id;
    } catch (e) {
      debugPrint('[Shift] Error starting shift: $e');
      return null;
    }
  }

  /// Pause the current shift
  Future<bool> pauseShift() async {
    if (_currentShiftId == null || _currentBusinessId == null) return false;
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return false;

    try {
      final shiftRef = _db
          .collection('businesses')
          .doc(_currentBusinessId)
          .collection('shifts')
          .doc(_currentShiftId);

      // Add pause entry
      await shiftRef.update({
        'status': 'paused',
        'pauseLog': FieldValue.arrayUnion([
          {
            'pausedAt': Timestamp.now(),
            'resumedAt': null,
          }
        ]),
      });

      // Update admin doc
      await _db.collection('admins').doc(user.uid).update({
        'shiftStatus': 'paused',
      });

      _shiftStatus = 'paused';
      _cancelGpsCheckTimers();
      debugPrint('[Shift] Paused shift: $_currentShiftId');
      return true;
    } catch (e) {
      debugPrint('[Shift] Error pausing shift: $e');
      return false;
    }
  }

  /// Resume from pause
  Future<bool> resumeShift() async {
    if (_currentShiftId == null || _currentBusinessId == null) return false;
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return false;

    try {
      final shiftRef = _db
          .collection('businesses')
          .doc(_currentBusinessId)
          .collection('shifts')
          .doc(_currentShiftId);

      // Get current pause log to close the last entry
      final shiftDoc = await shiftRef.get();
      if (!shiftDoc.exists) return false;

      final pauseLog = List<Map<String, dynamic>>.from(
        (shiftDoc.data()?['pauseLog'] as List<dynamic>?) ?? [],
      );

      // Close the last open pause entry
      if (pauseLog.isNotEmpty) {
        final lastPause = pauseLog.last;
        if (lastPause['resumedAt'] == null) {
          pauseLog[pauseLog.length - 1] = {
            'pausedAt': lastPause['pausedAt'],
            'resumedAt': Timestamp.now(),
          };
        }
      }

      await shiftRef.update({
        'status': 'active',
        'pauseLog': pauseLog,
      });

      // Update admin doc
      await _db.collection('admins').doc(user.uid).update({
        'shiftStatus': 'active',
      });

      _shiftStatus = 'active';
      _scheduleRandomGpsChecks();
      debugPrint('[Shift] Resumed shift: $_currentShiftId');
      return true;
    } catch (e) {
      debugPrint('[Shift] Error resuming shift: $e');
      return false;
    }
  }

  /// End the current shift
  Future<Map<String, dynamic>?> endShift() async {
    if (_currentShiftId == null || _currentBusinessId == null) return null;
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return null;

    try {
      final shiftRef = _db
          .collection('businesses')
          .doc(_currentBusinessId)
          .collection('shifts')
          .doc(_currentShiftId);

      final shiftDoc = await shiftRef.get();
      if (!shiftDoc.exists) return null;

      final shiftData = shiftDoc.data()!;
      final startedAt = (shiftData['startedAt'] as Timestamp).toDate();
      final now = DateTime.now();

      // Close any open pause
      final pauseLog = List<Map<String, dynamic>>.from(
        (shiftData['pauseLog'] as List<dynamic>?) ?? [],
      );
      if (pauseLog.isNotEmpty && pauseLog.last['resumedAt'] == null) {
        pauseLog[pauseLog.length - 1] = {
          'pausedAt': pauseLog.last['pausedAt'],
          'resumedAt': Timestamp.now(),
        };
      }

      // Calculate total and pause minutes
      double totalPauseMinutes = 0;
      for (final entry in pauseLog) {
        final pausedAt = (entry['pausedAt'] as Timestamp).toDate();
        final resumedAt = entry['resumedAt'] != null
            ? (entry['resumedAt'] as Timestamp).toDate()
            : now;
        totalPauseMinutes += resumedAt.difference(pausedAt).inSeconds / 60.0;
      }

      final totalShiftMinutes = now.difference(startedAt).inSeconds / 60.0;
      final activeMinutes = totalShiftMinutes - totalPauseMinutes;

      // Get end location
      Map<String, dynamic>? endLocation;
      try {
        endLocation = await _getLocationData();
      } catch (_) {}

      // Update shift doc
      await shiftRef.update({
        'status': 'ended',
        'endedAt': FieldValue.serverTimestamp(),
        'endLocation': endLocation,
        'pauseLog': pauseLog,
        'totalMinutes': activeMinutes.round(),
        'pauseMinutes': totalPauseMinutes.round(),
      });

      // Clear admin doc shift fields
      await _clearAdminShiftFields(user.uid);

      // Check for orphan tables
      final orphanTables = await _checkOrphanTables(
        _currentBusinessId!,
        _currentTables,
        user.uid,
      );

      final summary = {
        'shiftId': _currentShiftId,
        'startedAt': startedAt,
        'endedAt': now,
        'totalMinutes': activeMinutes.round(),
        'pauseMinutes': totalPauseMinutes.round(),
        'activeMinutes': activeMinutes.round(),
        'assignedTables': List<int>.from(_currentTables),
        'orphanTables': orphanTables,
      };

      // Reset local state
      _currentShiftId = null;
      _currentBusinessId = null;
      _shiftStartedAt = null;
      _shiftStatus = 'off';
      _currentTables = [];
      _shiftStream = null;
      _cancelGpsCheckTimers();

      debugPrint('[Shift] Ended shift. Active: ${activeMinutes.round()}min, Paused: ${totalPauseMinutes.round()}min');
      return summary;
    } catch (e) {
      debugPrint('[Shift] Error ending shift: $e');
      return null;
    }
  }

  /// Check for tables left without a server after shift ends
  Future<List<int>> _checkOrphanTables(
    String businessId,
    List<int> myTables,
    String myUid,
  ) async {
    if (myTables.isEmpty) return [];

    try {
      // Find all other active shifts for this business
      final otherShifts = await _db
          .collection('businesses')
          .doc(businessId)
          .collection('shifts')
          .where('status', whereIn: ['active', 'paused'])
          .where('staffId', isNotEqualTo: myUid)
          .get();

      // Collect all tables covered by other staff
      final coveredTables = <int>{};
      for (final doc in otherShifts.docs) {
        final tables = List<int>.from(
          (doc.data()['assignedTables'] as List<dynamic>?) ?? [],
        );
        coveredTables.addAll(tables);
      }

      // Find my tables that no one else covers
      final orphans = myTables.where((t) => !coveredTables.contains(t)).toList();

      if (orphans.isNotEmpty) {
        debugPrint('[Shift] Orphan tables detected: $orphans');
        // Could send notification to admin here in Phase 2
      }

      return orphans;
    } catch (e) {
      debugPrint('[Shift] Error checking orphan tables: $e');
      return [];
    }
  }

  /// Get GPS location with reverse geocoding
  Future<Map<String, dynamic>> _getLocationData() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      await Geolocator.requestPermission();
    }

    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );

    // Reverse geocode
    String address = '';
    try {
      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        address = [
          p.street,
          p.subLocality,
          p.locality,
          p.postalCode,
        ].where((s) => s != null && s.isNotEmpty).join(', ');
      }
    } catch (_) {}

    return {
      'lat': position.latitude,
      'lng': position.longitude,
      'address': address,
      'accuracy': position.accuracy,
    };
  }

  /// Clear shift fields from admin doc
  Future<void> _clearAdminShiftFields(String uid) async {
    await _db.collection('admins').doc(uid).update({
      'isOnShift': false,
      'currentShiftId': null,
      'shiftBusinessId': null,
      'shiftStatus': 'off',
      'shiftStartedAt': null,
      'shiftAssignedTables': [],
    });
  }

  /// Set up real-time stream for the current shift doc
  void _setupShiftStream() {
    if (_currentShiftId != null && _currentBusinessId != null) {
      _shiftStream = _db
          .collection('businesses')
          .doc(_currentBusinessId)
          .collection('shifts')
          .doc(_currentShiftId)
          .snapshots();
    }
  }

  /// Get shift history for a staff member at a business
  Future<List<Map<String, dynamic>>> getShiftHistory({
    required String businessId,
    String? staffId,
    int limit = 30,
  }) async {
    final shiftsRef = _db
        .collection('businesses')
        .doc(businessId)
        .collection('shifts');

    QuerySnapshot snap;
    if (staffId != null) {
      // Use staffId filter only — sort client-side to avoid composite index requirement
      snap = await shiftsRef
          .where('staffId', isEqualTo: staffId)
          .limit(limit)
          .get();
    } else {
      snap = await shiftsRef
          .orderBy('startedAt', descending: true)
          .limit(limit)
          .get();
    }

    final results = snap.docs.map((d) {
      final data = d.data() as Map<String, dynamic>;
      data['id'] = d.id;
      return data;
    }).toList();

    // Sort client-side by startedAt descending
    results.sort((a, b) {
      final aTime = (a['startedAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
      final bTime = (b['startedAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
      return bTime.compareTo(aTime);
    });

    return results;
  }

  String _todayString() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  // ── Mid-shift GPS checks ──

  /// Schedule 2-3 random GPS captures over the next 2 hours
  void _scheduleRandomGpsChecks() {
    _cancelGpsCheckTimers();
    final rng = Random();
    final checkCount = _minGpsChecks + rng.nextInt(_maxGpsChecks - _minGpsChecks + 1);

    // Spread checks within the next 2 hours (120 minutes)
    // Min gap: 20 minutes, max spacing evenly distributed
    const windowMinutes = 120;
    final interval = windowMinutes ~/ (checkCount + 1);

    for (int i = 1; i <= checkCount; i++) {
      // Randomise around the ideal slot ± 10 minutes
      final idealMinute = interval * i;
      final jitter = rng.nextInt(21) - 10; // -10..+10
      final delayMinutes = (idealMinute + jitter).clamp(15, windowMinutes);

      debugPrint('[Shift GPS] Scheduling check #$i in ${delayMinutes}min');

      final timer = Timer(Duration(minutes: delayMinutes), () {
        _captureRandomGps();
      });
      _gpsCheckTimers.add(timer);
    }

    debugPrint('[Shift GPS] Scheduled $checkCount random GPS checks');
  }

  /// Cancel all pending GPS check timers
  void _cancelGpsCheckTimers() {
    for (final t in _gpsCheckTimers) {
      t.cancel();
    }
    _gpsCheckTimers.clear();
  }

  /// Capture GPS and append to shift doc gpsChecks array
  Future<void> _captureRandomGps() async {
    if (_currentShiftId == null || _currentBusinessId == null) return;
    if (_shiftStatus != 'active') return;

    debugPrint('[Shift GPS] Running mid-shift GPS check...');

    try {
      final locationData = await _getLocationData();
      locationData['timestamp'] = Timestamp.now();

      final shiftRef = _db
          .collection('businesses')
          .doc(_currentBusinessId)
          .collection('shifts')
          .doc(_currentShiftId);

      await shiftRef.update({
        'gpsChecks': FieldValue.arrayUnion([locationData]),
      });

      debugPrint('[Shift GPS] ✅ GPS check saved: ${locationData['address']}');
    } catch (e) {
      debugPrint('[Shift GPS] ❌ Mid-shift GPS check failed: $e');
    }
  }
}
