import 'dart:io';

void main() {
  final file = File('mobile_app/lib/screens/staff/kermes_supply_screen.dart');
  String content = file.readAsStringSync();
  
  // Extract the card builder to a helper function.
  // Actually, we can just replace the ListView.builder with a CustomScrollView or ListView.
  
  final originalListViewString = r'''                   return ListView.builder(
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
                      },
                   );''';

  final newListViewString = r'''                   
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
                   );''';

  content = content.replaceAll(originalListViewString, newListViewString);
  file.writeAsStringSync(content);
}
