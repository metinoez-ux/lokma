import 'dart:io';

void main() {
  final file = File('lib/screens/kermes/staff/cash_drawer_screen.dart');
  var content = file.readAsStringSync();

  final target = '''
                      String sectionInfo = '';
                      if (tableSection != null && tableSection.isNotEmpty) {
                        sectionInfo = tableSection;
                        if (tableNumber != null && tableNumber.isNotEmpty) {
                          sectionInfo += ' - Masa \$tableNumber';
                        }
                      } else if (assignedTezgah != null && assignedTezgah.isNotEmpty) {
                        sectionInfo = 'Tezgah: \$assignedTezgah';
                      }
''';

  final replacement = '''
                      String sectionInfo = '';
                      if (tableSection != null && tableSection.isNotEmpty) {
                        sectionInfo = tableSection;
                        if (tableNumber != null && tableNumber.isNotEmpty) {
                          sectionInfo += ' - Masa \$tableNumber';
                        }
                      } else if (assignedTezgah != null && assignedTezgah.isNotEmpty) {
                        sectionInfo = 'Tezgah: \$assignedTezgah';
                      }
                      
                      // Fallback 1: Urunlerin icindeki prepZone (isimler: Erkekler Bölümü, Kadınlar vb.)
                      if (sectionInfo.isEmpty && items.isNotEmpty) {
                        try {
                          final firstItem = items.first as Map<String, dynamic>;
                          final itemPrepZones = firstItem['prepZone'] as List<dynamic>?;
                          if (itemPrepZones != null && itemPrepZones.isNotEmpty) {
                            sectionInfo = itemPrepZones.first.toString();
                            if (tableNumber != null && tableNumber.isNotEmpty) {
                              sectionInfo += ' - Masa \$tableNumber';
                            }
                          }
                        } catch(e) {}
                      }

                      // Fallback 2: Garson/Kasiyer ismi
                      if (sectionInfo.isEmpty) {
                         final waiter = data['assignedWaiterName'] ?? data['createdByStaffName'];
                         if (waiter != null && waiter.toString().isNotEmpty) {
                            sectionInfo = 'Sorumlu: \$waiter';
                            if (tableNumber != null && tableNumber.isNotEmpty) {
                              sectionInfo += ' - Masa \$tableNumber';
                            }
                         } else if (tableNumber != null && tableNumber.isNotEmpty) {
                            sectionInfo = 'Masa \$tableNumber';
                         }
                      }
''';

  if (content.contains(target)) {
    content = content.replaceFirst(target, replacement);
    file.writeAsStringSync(content);
    print("SUCCESS");
  } else {
    print("TARGET NOT FOUND");
  }
}
