import 'dart:io';
void main() {
  final file = File('lib/screens/kermes/staff/cash_drawer_screen.dart');
  var content = file.readAsStringSync();
  content = content.replaceFirst(
    "docRef = await FirebaseFirestore.instance.collection('kermes_cash_handovers').add({",
    "final user = FirebaseAuth.instance.currentUser;\n      final capabilities = ref.read(staffCapabilitiesProvider);\n      if (user == null) return;\n\n      docRef = await FirebaseFirestore.instance.collection('kermes_cash_handovers').add({\n        'businessId': capabilities.businessId,\n        'staffName': capabilities.staffName ?? user.displayName ?? 'Personel',"
  );
  content = content.replaceFirst("'staffName': 'Personel',", "");
  file.writeAsStringSync(content);
}
