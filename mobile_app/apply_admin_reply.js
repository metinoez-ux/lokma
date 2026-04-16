const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'lib/screens/staff/staff_notifications_screen.dart');
let content = fs.readFileSync(file, 'utf8');

// 1. Add supply_alarm to _iconForType, _colorForType and hasDetail
content = content.replace(/case 'chat_message': return Icons\.chat;/g, "case 'supply_alarm': return Icons.campaign;\n      case 'chat_message': return Icons.chat;");
content = content.replace(/case 'chat_message': return Colors\.teal;/g, "case 'supply_alarm': return Colors.red;\n      case 'chat_message': return Colors.teal;");
content = content.replace(/final bool hasDetail = type == 'kermes_parking' \|\| type == 'kermes_flash_sale' \|\| type == 'roster_shift' \|\| type == 'kermes_assignment' \|\| type == 'roster_deleted';/g, "final bool hasDetail = type == 'kermes_parking' || type == 'kermes_flash_sale' || type == 'roster_shift' || type == 'kermes_assignment' || type == 'roster_deleted' || type == 'supply_alarm' || type == 'supply_alarm_status';");

// 2. Insert supply_alarm custom state in _showNotificationDetailSheet
// Look for   bool isActionProcessing = false;
content = content.replace(
  /bool isActionProcessing = false;/g,
  "bool isActionProcessing = false;\n    String? supplyReplyText;\n    final isSupplyAlarm = type == 'supply_alarm' || type == 'supply_alarm_status';"
);

// Look for if (isRoster)
content = content.replace(
  /if \(isRoster\) \.\.\.\[/g,
  `if (isSupplyAlarm) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF2C2C2E) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? Colors.white12 : Colors.grey.shade200),
                      ),
                      child: Column(
                        children: [
                           Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), shape: BoxShape.circle),
                              child: const Icon(Icons.campaign, size: 36, color: Colors.red),
                           ),
                           const SizedBox(height: 16),
                           Text(data['itemName'] ?? 'Malzeme', textAlign: TextAlign.center, style: const TextStyle(fontSize: 20.0, fontWeight: FontWeight.w800)),
                           const SizedBox(height: 8),
                           Text(body, textAlign: TextAlign.center, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black87, height: 1.4)),
                           const SizedBox(height: 24),
                           
                           (() {
                             if (type == 'supply_alarm_status') {
                               return Container(
                                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                                  decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                                  child: const Text('Bu bir durum güncellemesidir.', style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold))
                               );
                             }
                             
                             if (isActionProcessing) {
                               return const Column(children: [CircularProgressIndicator(), SizedBox(height: 10), Text('İşleniyor...')]);
                             }
                             
                             if (data['status'] != 'pending') {
                               return Container(
                                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                                  decoration: BoxDecoration(color: Colors.grey.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
                                  child: Text('Bu talebe zaten cevap verildi: \${data['status']}', style: const TextStyle(fontWeight: FontWeight.bold))
                               );
                             }

                             return Column(
                               children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: ElevatedButton.icon(
                                          style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                                          icon: const Icon(Icons.check),
                                          label: const Text('TAMAM', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                          onPressed: () async {
                                            setSheetState(() => isActionProcessing = true);
                                            await _submitSupplyReply(data, 'on_the_way', 'Tamam, getiriyorum.');
                                            setSheetState(() { data['status'] = 'on_the_way'; isActionProcessing = false; });
                                          }
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: ElevatedButton.icon(
                                          style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                                          icon: const Icon(Icons.cancel),
                                          label: const Text('REDDET', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                          onPressed: () async {
                                            setSheetState(() => isActionProcessing = true);
                                            await _submitSupplyReply(data, 'rejected', 'Reddedildi.');
                                            setSheetState(() { data['status'] = 'rejected'; isActionProcessing = false; });
                                          }
                                        ),
                                      ),
                                    ]
                                  ),
                                  const SizedBox(height: 16),
                                  TextField(
                                    onChanged: (v) => supplyReplyText = v,
                                    decoration: InputDecoration(
                                      hintText: 'Özel cevap yaz...',
                                      isDense: true,
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  SizedBox(
                                    width: double.infinity,
                                    child: OutlinedButton(
                                      onPressed: () async {
                                         if (supplyReplyText == null || supplyReplyText!.trim().isEmpty) return;
                                         setSheetState(() => isActionProcessing = true);
                                         await _submitSupplyReply(data, 'on_the_way', supplyReplyText!.trim());
                                         setSheetState(() { data['status'] = 'on_the_way'; isActionProcessing = false; });
                                      },
                                      child: const Text('Mesajı Gönder (Yola Çıktı)')
                                    )
                                  )
                               ]
                             );
                           })()
                        ]
                      )
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (isRoster) ...[`
);

// Add the backend action function
content = content.replace(
  /Widget _rosterDetailRow/g,
  `Future<void> _submitSupplyReply(Map<String, dynamic> data, String status, String replyMessage) async {
    try {
      final kermesId = data['kermesId'] as String?;
      final requestId = data['requestId'] as String?;
      final notifId = data['id'] as String?;
      final uid = FirebaseAuth.instance.currentUser?.uid;
      
      if (kermesId != null && requestId != null) {
        await FirebaseFirestore.instance.collection('kermes_events').doc(kermesId).collection('supply_requests').doc(requestId).update({
           'status': status,
           'adminReply': replyMessage,
           'adminReplyBy': uid,
           'updatedAt': FieldValue.serverTimestamp()
        });
      }
      if (uid != null && notifId != null) {
         await FirebaseFirestore.instance.collection('users').doc(uid).collection('notifications').doc(notifId).update({
            'status': status
         });
      }
    } catch (e) {
      debugPrint('Supply reply error: $e');
    }
  }

  Widget _rosterDetailRow`
);

fs.writeFileSync(file, content);
console.log('Mobile app staff_notifications updated.');
