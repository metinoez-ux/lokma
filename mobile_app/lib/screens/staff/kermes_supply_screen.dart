import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class KermesSupplyScreen extends StatefulWidget {
  final String kermesId;
  final List<String> userPrepZones;

  const KermesSupplyScreen({
    Key? key,
    required this.kermesId,
    required this.userPrepZones,
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
              _categories = cats.map((c) => Map<String, dynamic>.from(c)).where((c) {
                 if (c['allowedZones'] != null && (c['allowedZones'] as List).isNotEmpty) {
                    final allowed = List<String>.from(c['allowedZones']);
                    return widget.userPrepZones.any((zone) => allowed.contains(zone));
                 }
                 return true;
              }).toList();
              _isLoadingCats = false;
           });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingCats = false);
    }
  }

  Future<void> _submitRequest(String itemName, String requestedZone, {String category = 'custom', String urgency = 'normal'}) async {
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
             'requestedZone': requestedZone,
             'category': category,
             'itemName': itemName,
             'status': 'pending',
             'urgency': urgency,
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

  
  Future<void> _askUrgencyAndSubmit(String itemName, {String category = 'custom'}) async {
    String selectedZone = 'Genel Alan';
    if (widget.userPrepZones.length == 1) {
       selectedZone = widget.userPrepZones.first;
    } else if (widget.userPrepZones.length > 1) {
       final zoneResult = await showDialog<String>(
          context: context,
          builder: (ctx) {
            final isDark = Theme.of(ctx).brightness == Brightness.dark;
            return AlertDialog(
               shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
               backgroundColor: isDark ? const Color(0xFF222222) : Colors.white,
               title: Text('Hangi İstasyon?', style: TextStyle(color: isDark ? Colors.white : Colors.black, fontWeight: FontWeight.bold)),
               content: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: widget.userPrepZones.map((z) => Padding(
                     padding: const EdgeInsets.only(bottom: 8),
                     child: ListTile(
                        title: Text(z, style: const TextStyle(fontWeight: FontWeight.bold)),
                        onTap: () => Navigator.pop(ctx, z),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        tileColor: isDark ? Colors.white10 : Colors.grey.shade100,
                     ),
                  )).toList(),
               )
            );
          }
       );
       if (zoneResult == null) return; // User cancelled
       selectedZone = zoneResult;
    }

    final result = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final dIsDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: dIsDark ? const Color(0xFF222222) : Colors.white,
          title: Text('Aciliyet Durumu', style: TextStyle(color: dIsDark ? Colors.white : Colors.black, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
               Text('$itemName siparişiniz için aciliyet belirleyin:', style: const TextStyle(fontSize: 15)),
               const SizedBox(height: 20),
               ElevatedButton.icon(
                 style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
                 icon: const Icon(Icons.local_fire_department),
                 label: const Text('Hemen Gelsin (Süper Acil)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                 onPressed: () => Navigator.pop(ctx, 'super_urgent'),
               ),
               const SizedBox(height: 12),
               OutlinedButton.icon(
                 style: OutlinedButton.styleFrom(foregroundColor: dIsDark ? Colors.white : Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
                 icon: const Icon(Icons.hourglass_bottom),
                 label: const Text('1-2 Saat İçinde Olur'),
                 onPressed: () => Navigator.pop(ctx, 'normal'),
               ),
            ]
          )
        );
      }
    );

    if (result != null) {
      await _submitRequest(itemName, selectedZone, category: category, urgency: result);
    }
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
                                 onTap: () => _askUrgencyAndSubmit(item as String, category: cat['title']),
                                 borderRadius: BorderRadius.circular(20),
                                 child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                       color: isDark ? const Color(0xFFE5E5E5) : Colors.white,
                                       border: Border.all(color: Colors.red.shade700, width: 1.5),
                                       borderRadius: BorderRadius.circular(20)
                                    ),
                                    child: Text(item, style: TextStyle(color: Colors.red.shade900, fontWeight: FontWeight.bold)),
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
                               _askUrgencyAndSubmit(_customCtrl.text.trim());
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
                   
                   final docs = snapshot.data!.docs;
                   final pendingDocs = docs.where((doc) {
                      final d = doc.data() as Map<String, dynamic>;
                      return d['status'] != 'completed';
                   }).toList();
                   
                   final completedDocs = docs.where((doc) {
                      final d = doc.data() as Map<String, dynamic>;
                      return d['status'] == 'completed';
                   }).toList();
                   
                   Widget buildCard(QueryDocumentSnapshot doc) {
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
                               subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                 Text("${d['requestedByName']} • ${d['requestedZone']}", style: const TextStyle(fontSize: 12)),
                                 if (d['urgency'] == 'super_urgent')
                                   Container(margin: const EdgeInsets.only(top: 4), padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.red)), child: const Text('🔥 SÜPER ACİL', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)))
                               ]),
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
                   }

                   return ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      children: [
                        ...pendingDocs.map((doc) => buildCard(doc)),
                        if (completedDocs.isNotEmpty)
                           Theme(
                             data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                             child: ExpansionTile(
                               tilePadding: EdgeInsets.zero,
                               title: Text('Tamamlananlar (${completedDocs.length})', style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                               children: completedDocs.map((doc) => Opacity(opacity: 0.6, child: buildCard(doc))).toList(),
                             ),
                           )
                      ],
                   );
                },
             ),
          )
        ],
      ),
    );
  }
}
