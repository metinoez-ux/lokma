import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Okunmamis bildirim sayisi - her iki collection'dan
final staffUnreadNotificationsCountProvider = StreamProvider<int>((ref) {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return Stream.value(0);

  // Ana notifications collection'dan okunmamislari say
  return FirebaseFirestore.instance
      .collection('users')
      .doc(user.uid)
      .collection('notifications')
      .where('read', isEqualTo: false)
      .snapshots()
      .map((snapshot) => snapshot.docs.where((d) {
          final data = d.data();
          return data['trashedAt'] == null;
      }).length);
});

// Tum bildirimler - notifications collection (gorev + siparis + her sey)
final staffNotificationsProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return Stream.value([]);

  return FirebaseFirestore.instance
      .collection('users')
      .doc(user.uid)
      .collection('notifications')
      .orderBy('createdAt', descending: true)
      .limit(100)
      .snapshots()
      .map((snapshot) {
        return snapshot.docs.where((doc) {
          final data = doc.data();
          return data['trashedAt'] == null;
        }).map((doc) {
          final data = Map<String, dynamic>.from(doc.data());
          data['id'] = doc.id;
          return data;
        }).toList();
      });
});

Future<void> markStaffNotificationAsRead(String notificationId) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return;

  // Her iki collection'da da okundu olarak isaretle
  await FirebaseFirestore.instance
      .collection('users')
      .doc(user.uid)
      .collection('notifications')
      .doc(notificationId)
      .update({'read': true}).catchError((e) => null);

  await FirebaseFirestore.instance
      .collection('users')
      .doc(user.uid)
      .collection('personnel_notifications')
      .doc(notificationId)
      .update({'read': true}).catchError((e) => null);
}

Future<void> markAllStaffNotificationsAsRead() async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return;

  final batch = FirebaseFirestore.instance.batch();
  final unread = await FirebaseFirestore.instance
      .collection('users')
      .doc(user.uid)
      .collection('notifications')
      .where('read', isEqualTo: false)
      .get();

  for (final doc in unread.docs) {
    batch.update(doc.reference, {'read': true});
  }
  await batch.commit().catchError((e) => null);
}
