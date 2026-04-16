import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class KermesSupplyScreen extends StatefulWidget {
  final String kermesId;
  final String currentUserZone;

  const KermesSupplyScreen({
    Key? key,
    required this.kermesId,
    required this.currentUserZone,
  }) : super(key: key);

  @override
  State<KermesSupplyScreen> createState() => _KermesSupplyScreenState();
}

class _KermesSupplyScreenState extends State<KermesSupplyScreen> {
  final TextEditingController _customCtrl = TextEditingController();
  List<Map<String, dynamic>> _categories = [];
  bool _isLoadingCats = true;
  String _currentUserName = '';

  @override
  void initState() {
    super.initState();
    _fetchCategories();
    _fetchCurrentUserName();
  }

  Future<void> _fetchCurrentUserName() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      try {
        final doc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
        if (doc.exists && doc.data()!['fullName'] != null) {
          setState(() {
            _currentUserName = doc.data()!['fullName'];
          });
        } else {
           final adminDoc = await FirebaseFirestore.instance.collection('admins').doc(uid).get();
           if (adminDoc.exists && adminDoc.data()!['name'] != null) {
              setState(() {
                _currentUserName = adminDoc.data()!['name'];
              });
           }
        }
      } catch (e) {}
    }
  }

  Future<void> _fetchCategories() async {
    try {
      final doc = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
      if (doc.exists) {
        final data = doc.data()!;
        final cats = data['supplyCategories'] as List<dynamic>? ?? [];
        if (mounted) {
           setState(() {
              _categories = cats.map((c) => Map<String, dynamic>.from(c)).toList();
              _isLoadingCats = false;
           });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingCats = false);
    }
  }

  Future<void> _submitRequest(String itemName, {String category = 'custom'}) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    
    // Check if same item is already requested and pending/on_the_way
    final recent = await FirebaseFirestore.instance.collection('kermes_events')
         .doc(widget.kermesId)
         .collection('supply_requests')
         .where('itemName', isEqualTo: itemName)
         .where('status', whereIn: ['pending', 'on_the_way'])
         .get();
         
    if (recent.docs.isNotEmpty) {
       ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('''$itemName ${'supply_already_requested'.tr()}''')));
       return;
    }

    try {
      await FirebaseFirestore.instance.collection('kermes_events')
          .doc(widget.kermesId)
          .collection('supply_requests')
          .add({
             'requestedByUid': uid,
             'requestedByName': _currentUserName.isEmpty ? 'Personel' : _currentUserName,
             'requestedZone': widget.currentUserZone,
             'category': category,
             'itemName': itemName,
             'status': 'pending',
             'createdAt': FieldValue.serverTimestamp(),
          });
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('''${'supply_request_sent'.tr()} $itemName'''),
            backgroundColor: Colors.green,
         ));
      }
    } catch(e) {}
  }

  Widget _buildStatusBadge(String status) {
    if (status == 'completed') {
       return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(8)),
          child: Text('supply_status_completed'.tr(), style: TextStyle(color: Colors.black54, fontSize: 12, fontWeight: FontWeight.bold)),
       );
    } else if (status == 'on_the_way') {
       return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: Colors.amber.shade200, borderRadius: BorderRadius.circular(8)),
          child: Text('supply_status_on_the_way'.tr(), style: TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold)),
       );
    }
    return Container(
       padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
       decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(8)),
       child: Text('supply_status_pending'.tr(), style: TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.grey.shade50,
      appBar: AppBar(
        title: Text('supply_alarm_title'.tr()),
        backgroundColor: Colors.red.shade700,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // QUICK REQUEST SECTION
          Container(
             color: isDark ? Colors.black26 : Colors.white,
             padding: const EdgeInsets.all(16),
             child: Column(
               crossAxisAlignment: CrossAxisAlignment.stretch,
               children: [
                  Text('supply_quick_request'.tr(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  if (_isLoadingCats)
                     const Center(child: CircularProgressIndicator())
                  else if (_categories.isNotEmpty)
                     ..._categories.map((cat) => Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                           Text(cat['title'] ?? '', style: TextStyle(fontSize: 13, color: isDark ? Colors.white54 : Colors.black54)),
                           const SizedBox(height: 5),
                           Wrap(
                              spacing: 8, runSpacing: 8,
                              children: (cat['items'] as List<dynamic>? ?? []).map((item) => InkWell(
                                 onTap: () => _submitRequest(item as String, category: cat['title']),
                                 borderRadius: BorderRadius.circular(20),
                                 child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                       color: isDark ? Colors.red.withOpacity(0.2) : Colors.red.shade50,
                                       border: Border.all(color: Colors.red.withOpacity(0.3)),
                                       borderRadius: BorderRadius.circular(20)
                                    ),
                                    child: Text(item, style: TextStyle(color: isDark ? Colors.red.shade200 : Colors.red.shade700, fontWeight: FontWeight.bold)),
                                 ),
                              )).toList(),
                           ),
                           const SizedBox(height: 15),
                        ],
                     ))
                  else
                     Text('supply_no_items'.tr()),
                     
                  const Divider(),
                  Row(
                    children: [
                       Expanded(
                         child: TextField(
                           controller: _customCtrl,
                           decoration: InputDecoration(
                              hintText: 'Listede yoksa buraya yazın...',
                              hintStyle: TextStyle(color: isDark ? Colors.white30 : Colors.black38),
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                           ),
                         ),
                       ),
                       const SizedBox(width: 10),
                       ElevatedButton(
                         style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white),
                         onPressed: () {
                            if (_customCtrl.text.trim().isNotEmpty) {
                               _submitRequest(_customCtrl.text.trim());
                               _customCtrl.clear();
                            }
                         },
                         child: const Text('Gönder'),
                       )
                    ],
                  )
               ],
             ),
          ),
          
          Container(
             height: 5,
             color: isDark ? Colors.black : Colors.grey.shade200,
          ),
          
          // LIVE REQUESTS LIST
          Container(
             padding: const EdgeInsets.all(16),
             alignment: Alignment.centerLeft,
             child: const Text('Canlı İhtiyaç Listesi (Herkes Görür)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          
          Expanded(
             child: StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance.collection('kermes_events')
                   .doc(widget.kermesId)
                   .collection('supply_requests')
                   .orderBy('createdAt', descending: true)
                   .limit(30)
                   .snapshots(),
                builder: (context, snapshot) {
                   if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                   }
                   if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                      return Center(
                         child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                               Icon(Icons.check_circle_outline, size: 64, color: isDark ? Colors.white24 : Colors.grey.shade300),
                               const SizedBox(height: 16),
                               const Text('Şu an hiç malzeme ihtiyacı yok.', style: TextStyle(color: Colors.grey)),
                            ],
                         ),
                      );
                   }
                   
                   return ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: snapshot.data!.docs.length,
                      itemBuilder: (ctx, idx) {
                         final doc = snapshot.data!.docs[idx];
                         final d = doc.data() as Map<String, dynamic>;
                         final isMine = d['requestedByUid'] == FirebaseAuth.instance.currentUser?.uid;
                         final status = d['status'] as String? ?? 'pending';
                         
                         return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                               color: status == 'completed' ? (isDark ? Colors.white10 : Colors.grey.shade100) : (isDark ? const Color(0xFF2A2A2A) : Colors.white),
                               border: Border.all(color: status == 'on_the_way' ? Colors.amber : (status == 'completed' ? Colors.transparent : Colors.red.withOpacity(0.3))),
                               borderRadius: BorderRadius.circular(12),
                            ),
                            child: ListTile(
                               leading: CircleAvatar(
                                  backgroundColor: status == 'completed' ? Colors.grey : (status == 'on_the_way' ? Colors.amber : Colors.red.shade100),
                                  child: Icon(status == 'completed' ? Icons.check : (status == 'on_the_way' ? Icons.local_shipping : Icons.campaign), 
                                     color: status == 'completed' ? Colors.white : (status == 'on_the_way' ? Colors.white : Colors.red)),
                               ),
                               title: Text(d['itemName'] ?? '', style: TextStyle(fontWeight: FontWeight.bold, decoration: status == 'completed' ? TextDecoration.lineThrough : null)),
                               subtitle: Text('${d['requestedByName']} • ${d['requestedZone']}', style: const TextStyle(fontSize: 12)),
                               trailing: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                     _buildStatusBadge(status),
                                     if (isMine && status == 'pending')
                                        InkWell(
                                           onTap: () => doc.reference.delete(),
                                           child: const Padding(
                                             padding: EdgeInsets.only(top: 4),
                                             child: Text('İptal Et', style: TextStyle(color: Colors.blue, fontSize: 11)),
                                           )
                                        )
                                  ],
                               ),
                            ),
                         );
                      },
                   );
                },
             ),
          )
        ],
      ),
    );
  }
}
