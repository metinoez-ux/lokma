import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class StaffTransferSelectionDialog extends StatefulWidget {
  final String currentUserId;
  final String businessId;
  final double declaredAmount;
  final List<String> orderIds;

  const StaffTransferSelectionDialog({
    Key? key,
    required this.currentUserId,
    required this.businessId,
    required this.declaredAmount,
    required this.orderIds,
  }) : super(key: key);

  @override
  _StaffTransferSelectionDialogState createState() => _StaffTransferSelectionDialogState();
}

class _StaffTransferSelectionDialogState extends State<StaffTransferSelectionDialog> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _staffList = [];

  @override
  void initState() {
    super.initState();
    _fetchActiveStaff();
  }

  Future<void> _fetchActiveStaff() async {
    try {
      final querySnapshot = await FirebaseFirestore.instance.collection('users')
          .where('roles', arrayContainsAny: ['kermes_admin', 'super_admin', 'admin', 'staff']).limit(50).get();
      final List<Map<String, dynamic>> validStaff = [];

      for (var doc in querySnapshot.docs) {
        if (doc.id == widget.currentUserId) continue; // Skip self

        final data = doc.data();
        validStaff.add({
          'id': doc.id,
          'name': data['firstName'] ?? data['displayName'] ?? 'Personel',
        });
      }

      setState(() {
        _staffList = validStaff;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _transferTo(String targetUserId, String targetUserName) async {
    setState(() => _isLoading = true);
    try {
       final batch = FirebaseFirestore.instance.batch();
       for (final oid in widget.orderIds) {
         final ref = FirebaseFirestore.instance.collection('kermes_orders').doc(oid);
         batch.update(ref, {'collectedByStaffId': targetUserId});
       }
       
       final transferRef = FirebaseFirestore.instance.collection('kermes_cash_transfers').doc();
       batch.set(transferRef, {
         'fromStaffId': widget.currentUserId,
         'toStaffId': targetUserId,
         'toStaffName': targetUserName,
         'amount': widget.declaredAmount,
         'orderCount': widget.orderIds.length,
         'timestamp': FieldValue.serverTimestamp(),
       });

       await batch.commit();
       Navigator.of(context).pop(true);
    } catch (e) {
       ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Aktarım Hatası: $e')));
       setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
     return AlertDialog(
        title: const Text('Nakdi Devredebileceğiniz Kişiler'),
        content: _isLoading 
          ? const SizedBox(height: 100, child: Center(child: CircularProgressIndicator()))
          : SizedBox(
               width: double.maxFinite,
               child: ListView.builder(
                 shrinkWrap: true,
                 itemCount: _staffList.length,
                 itemBuilder: (context, index) {
                   final staff = _staffList[index];
                   return ListTile(
                     leading: CircleAvatar(backgroundColor: Colors.blueAccent.withOpacity(0.1), child: const Icon(Icons.person, color: Colors.blueAccent)),
                     title: Text(staff['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                     subtitle: const Text('Seç ve teslim et'),
                     trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                     onTap: () => _transferTo(staff['id'], staff['name']),
                   );
                 },
               ),
            ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('İptal')),
        ],
     );
  }
}
