import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:lokma_app/models/app_user.dart';

class UserService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final String _collection = 'users';

  // Generate a unique 5-character ID
  // Uses 29 safe characters: 1-9 (no 0) + A-Z (no I, O, J, V, W, X)
  // Capacity: 29^5 = ~20.5 million unique IDs
  String _generateRandomId() {
    // Characters that won't be confused with each other
    // Excludes: 0 (confused with O), O, I (confused with 1), J, V, W, X
    const chars = '123456789ABCDEFGHKLMNPQRSTUYZ';
    
    final random = Random();
    final buffer = StringBuffer();
    
    for (int i = 0; i < 5; i++) {
      buffer.write(chars[random.nextInt(chars.length)]);
    }
    
    return buffer.toString();
  }

  Future<AppUser> createOrUpdateUser(User firebaseUser) async {
    final docRef = _firestore.collection(_collection).doc(firebaseUser.uid);
    final snapshot = await docRef.get();

    if (snapshot.exists) {
      // User exists, return data
      return AppUser.fromMap(snapshot.data()!);
    } else {
      // Create new user with unique ID
      String customId = '';
      bool isUnique = false;
      int attempts = 0;

      while (!isUnique && attempts < 10) {
        customId = _generateRandomId();
        // Check uniqueness
        final query = await _firestore
            .collection(_collection)
            .where('customId', isEqualTo: customId)
            .get();
        
        if (query.docs.isEmpty) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw Exception('Failed to generate unique ID');
      }

      final newUser = AppUser(
        uid: firebaseUser.uid,
        customId: customId,
        email: firebaseUser.email ?? '',
        displayName: firebaseUser.displayName,
        createdAt: DateTime.now(),
      );

      await docRef.set(newUser.toMap());
      return newUser;
    }
  }

  Future<AppUser?> getUser(String uid) async {
    try {
      final doc = await _firestore.collection(_collection).doc(uid).get();
      if (doc.exists && doc.data() != null) {
        return AppUser.fromMap(doc.data()!);
      }
      return null;
    } catch (e) {
      print('Error fetching user: $e');
      return null;
    }
  }

  Future<void> updateHomeLocation(String uid, double lat, double lon) async {
    try {
      await _firestore.collection(_collection).doc(uid).update({
        'homeLatitude': lat,
        'homeLongitude': lon,
        'hasHomeLocation': true,
      });
    } catch (e) {
      print('Error updating home location: $e');
      rethrow;
    }
  }
}
