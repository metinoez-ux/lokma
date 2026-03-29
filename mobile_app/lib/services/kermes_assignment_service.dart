import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class KermesAssignment {
  final String id;
  final String title;
  
  KermesAssignment({required this.id, required this.title});
}

class KermesAssignmentService {
  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Fetches active Kermes events where the current user is assigned as staff or driver
  static Future<List<KermesAssignment>> getActiveAssignedKermeses() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return [];

    final uid = user.uid;
    List<KermesAssignment> assignments = [];

    try {
      // Find kermeses where user is staff
      final staffQuery = await _db
          .collection('kermes_events')
          .where('isActive', isEqualTo: true)
          .where('assignedStaff', arrayContains: uid)
          .get();

      // Find kermeses where user is driver
      final driverQuery = await _db
          .collection('kermes_events')
          .where('isActive', isEqualTo: true)
          .where('assignedDrivers', arrayContains: uid)
          .get();

      // Combine results, avoiding duplicates
      final Set<String> seenIds = {};

      for (var doc in staffQuery.docs) {
        if (!seenIds.contains(doc.id)) {
          seenIds.add(doc.id);
          assignments.add(KermesAssignment(
            id: doc.id,
            title: doc.data()['title'] ?? 'Kermes',
          ));
        }
      }

      for (var doc in driverQuery.docs) {
        if (!seenIds.contains(doc.id)) {
          seenIds.add(doc.id);
          assignments.add(KermesAssignment(
            id: doc.id,
            title: doc.data()['title'] ?? 'Kermes',
          ));
        }
      }

      return assignments;
    } catch (e) {
      print('[KermesAssignmentService] Error fetching assignments: $e');
      return [];
    }
  }
}
