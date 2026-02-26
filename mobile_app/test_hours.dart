import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/widgets.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  final snapshot = await FirebaseFirestore.instance.collection('businesses').where('isActive', isEqualTo: true).get();
  int issues = 0;
  
  for (var doc in snapshot.docs) {
    var data = doc.data();
    var oh = data['openingHours'];
    print('- ${data['companyName']} -> openingHours: $oh');
  }
}
