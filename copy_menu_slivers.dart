import 'dart:io';

void main() {
  final menuFile = File('mobile_app/lib/screens/kermes/kermes_menu_screen.dart');
  final detailFile = File('mobile_app/lib/screens/kermes/kermes_detail_screen.dart');

  final menuLines = menuFile.readAsLinesSync();
  
  // Find start of "3. Category Chip Tabs"
  int startIdx = menuLines.indexWhere((l) => l.contains('// 3. Category Chip Tabs'));
  // Find end of the sliver list, just before bottomNavigationBar
  int endIdx = menuLines.indexWhere((l) => l.contains('bottomNavigationBar:'));
  
  if (startIdx == -1 || endIdx == -1) {
    print("Could not find blocks in menu screen");
    return;
  }
  
  final sliverCodeToInsert = menuLines.sublist(startIdx, endIdx);
  // remove closing ] and )
  while (sliverCodeToInsert.isNotEmpty && sliverCodeToInsert.last.trim() != '),') {
     sliverCodeToInsert.removeLast();
  }

  final detailLines = detailFile.readAsLinesSync();
  
  // Find where CustomScrollView slivers end in KermesDetailScreen by searching from bottom
  int sliversEnd = -1;
  for (int i = detailLines.length - 1; i >= 0; i--) {
     if (detailLines[i].contains('bottomNavigationBar:')) {
         // Now scroll up to find the closing brackets of slivers: []
         for (int j = i - 1; j >= 0; j--) {
             if (detailLines[j].contains('],')) {
                 sliversEnd = j;
                 break;
             }
         }
         break;
     }
  }
  
  if (sliversEnd == -1) {
    print("Could not find insertion point in detail screen");
    return;
  }
  
  // Also remove the bottom spacing from inside the SliverToBoxAdapter info column before this
  for (int j = sliversEnd - 1; j >= 0; j--) {
     if (detailLines[j].contains('const SizedBox(height: 120)')) {
         detailLines.removeAt(j);
         sliversEnd--;
         break;
     }
  }

  detailLines.insertAll(sliversEnd, sliverCodeToInsert);

  // Also fix horizontal padding from 20 -> 16
  for (int i = 0; i < detailLines.length; i++) {
     if (detailLines[i].contains('EdgeInsets.symmetric(horizontal: 20')) {
         detailLines[i] = detailLines[i].replaceAll('horizontal: 20', 'horizontal: 16');
     }
     if (detailLines[i].contains('EdgeInsets.fromLTRB(20,')) {
         detailLines[i] = detailLines[i].replaceAll('EdgeInsets.fromLTRB(20,', 'EdgeInsets.fromLTRB(16,');
     }
  }

  detailFile.writeAsStringSync(detailLines.join('\n'));
  print("Merged successfully!");
}
