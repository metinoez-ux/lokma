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
      // Staff query
      final staffQuery = await _db
          .collection('kermes_events')
          .where('isActive', isEqualTo: true)
          .where('assignedStaff', arrayContains: uid)
          .get();

      for (var doc in staffQuery.docs) {
        final existing = assignmentMap[doc.id];
        assignmentMap[doc.id] = KermesAssignment(
          id: doc.id,
          title: doc.data()['title'] ?? 'Kermes',
          roles: [...(existing?.roles ?? []), 'personel'],
        );
      }

      // Driver query
      final driverQuery = await _db
          .collection('kermes_events')
          .where('isActive', isEqualTo: true)
          .where('assignedDrivers', arrayContains: uid)
          .get();

      for (var doc in driverQuery.docs) {
        final existing = assignmentMap[doc.id];
        assignmentMap[doc.id] = KermesAssignment(
          id: doc.id,
          title: doc.data()['title'] ?? 'Kermes',
          roles: [...(existing?.roles ?? []), 'surucu'],
        );
      }

      // Waiter query
      final waiterQuery = await _db
          .collection('kermes_events')
          .where('isActive', isEqualTo: true)
          .where('assignedWaiters', arrayContains: uid)
          .get();

      for (var doc in waiterQuery.docs) {
        final existing = assignmentMap[doc.id];
        assignmentMap[doc.id] = KermesAssignment(
          id: doc.id,
          title: doc.data()['title'] ?? 'Kermes',
          roles: [...(existing?.roles ?? []), 'garson'],
        );
      }

      // Kermes Admin query
      final adminQuery = await _db
          .collection('kermes_events')
          .where('isActive', isEqualTo: true)
          .where('kermesAdmins', arrayContains: uid)
          .get();

      for (var doc in adminQuery.docs) {
        final existing = assignmentMap[doc.id];
        assignmentMap[doc.id] = KermesAssignment(
          id: doc.id,
          title: doc.data()['title'] ?? 'Kermes',
          roles: [...(existing?.roles ?? []), 'kermes_admin'],
        );
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
