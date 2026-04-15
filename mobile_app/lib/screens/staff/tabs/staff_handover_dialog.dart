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
      final validStaff = <Map<String, dynamic>>[];

      // 1. Fetch Kermes Admins UIDs from kermes_events
      final kermesDoc = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.businessId).get();
      if (!kermesDoc.exists) {
        setState(() { _staffList = validStaff; _isLoading = false; });
        return;
      }
      
      final kermesAdmins = List<String>.from(kermesDoc.data()?['kermesAdmins'] ?? []);
      if (kermesAdmins.isEmpty) {
        setState(() { _staffList = validStaff; _isLoading = false; });
        return;
      }

      // 2. Resolve Names via Admins / Users collections
      for (var uid in kermesAdmins) {
        if (uid == widget.currentUserId) continue; // Skip self

        // First try admins collection
        var adminDoc = await FirebaseFirestore.instance.collection('admins').doc(uid).get();
        if (adminDoc.exists) {
          final data = adminDoc.data()!;
          validStaff.add({
            'id': uid,
            'name': data['staffName'] ?? data['name'] ?? data['displayName'] ?? 'Kermes Yetkilisi',
          });
          continue;
        }

        // Fallback to users collection
        var userDoc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
        if (userDoc.exists) {
          final data = userDoc.data()!;
          validStaff.add({
            'id': uid,
            'name': data['firstName'] ?? data['displayName'] ?? 'Kermes Yetkilisi',
          });
        }
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
