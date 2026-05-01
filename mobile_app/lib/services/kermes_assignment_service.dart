import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class KermesAssignment {
  final String id;
  final String title;
  final List<String> roles; // personel, surucu, garson, kermes_admin

  KermesAssignment({required this.id, required this.title, this.roles = const []});
}

class KermesAssignmentService {
  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Fetches active Kermes events where the current user is assigned as staff, driver, waiter, or admin
  static Future<List<KermesAssignment>> getActiveAssignedKermeses() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return [];

    final uid = user.uid;
    final Map<String, KermesAssignment> assignmentMap = {};

    try {
      // Run ALL 4 queries in PARALLEL instead of serial (was causing 40s+ timeout)
      final results = await Future.wait([
        _db.collection('kermes_events')
            .where('isActive', isEqualTo: true)
            .where('assignedStaff', arrayContains: uid)
            .get(),
        _db.collection('kermes_events')
            .where('isActive', isEqualTo: true)
            .where('assignedDrivers', arrayContains: uid)
            .get(),
        _db.collection('kermes_events')
            .where('isActive', isEqualTo: true)
            .where('assignedWaiters', arrayContains: uid)
            .get(),
        _db.collection('kermes_events')
            .where('isActive', isEqualTo: true)
            .where('kermesAdmins', arrayContains: uid)
            .get(),
      ]);

      final roleNames = ['personel', 'surucu', 'garson', 'kermes_admin'];
      for (int i = 0; i < results.length; i++) {
        for (var doc in results[i].docs) {
          final existing = assignmentMap[doc.id];
          assignmentMap[doc.id] = KermesAssignment(
            id: doc.id,
            title: doc.data()['title'] ?? 'Kermes',
            roles: [...(existing?.roles ?? []), roleNames[i]],
          );
        }
      }

      // Fallback: admins doc'undaki assignedKermesEvents (veri tutarsizligi icin)
      if (assignmentMap.isEmpty) {
        try {
          final adminDoc = await _db.collection('admins').doc(uid).get()
              .timeout(const Duration(seconds: 3));
          if (adminDoc.exists) {
            final kermesEvents = adminDoc.data()?['assignedKermesEvents'] as List<dynamic>?;
            if (kermesEvents != null && kermesEvents.isNotEmpty) {
              for (final kId in kermesEvents) {
                if (kId is String && kId.isNotEmpty && !assignmentMap.containsKey(kId)) {
                  final kDoc = await _db.collection('kermes_events').doc(kId).get()
                      .timeout(const Duration(seconds: 2));
                  if (kDoc.exists && kDoc.data()?['isActive'] == true) {
                    assignmentMap[kId] = KermesAssignment(
                      id: kId,
                      title: kDoc.data()?['title'] ?? 'Kermes',
                      roles: ['personel'],
                    );
                  }
                }
              }
            }
          }
        } catch (_) {}
      }

      return assignmentMap.values.toList();
    } catch (e) {
      print('[KermesAssignmentService] Error fetching assignments: $e');
      return [];
    }
  }

  /// Check if user has kermes admin role for any active kermes
  static Future<bool> isKermesAdmin() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return false;

    try {
      final q = await _db
          .collection('kermes_events')
          .where('isActive', isEqualTo: true)
          .where('kermesAdmins', arrayContains: user.uid)
          .limit(1)
          .get();
      return q.docs.isNotEmpty;
    } catch (e) {
      return false;
    }
  }
}
