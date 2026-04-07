import 'dart:io';

void main() {
  final file = File('mobile_app/lib/screens/kermes/kermes_detail_screen.dart');
  final lines = file.readAsLinesSync();

  // Find info cards section
  int infoStart = -1;
  int infoEnd = -1;
  
  for (int i = 0; i < lines.length; i++) {
    if (lines[i].contains('const EdgeInsets.symmetric(horizontal: 20, vertical: 24),')) {
      if (lines[i+2].contains('_buildLocationCard()')) {
        infoStart = i - 2; // the SliverToBoxAdapter( child: Padding(
        for (int j = i + 2; j < lines.length; j++) {
           if (lines[j].trim() == '],') {
              if (lines[j+1].trim() == '),') {
                 if (lines[j+2].trim() == '),') {
                    if (lines[j+3].trim() == '),') {
                       infoEnd = j + 3;
                       break;
                    }
                 }
              }
           }
        }
        break;
      }
    }
  }
  
  if (infoStart == -1 || infoEnd == -1) {
    print("Could not find info block: $infoStart to $infoEnd");
    return;
  }
  
  final infoBlock = lines.sublist(infoStart, infoEnd + 1);
  lines.removeRange(infoStart, infoEnd + 1);
  
  // Also fix padding horizontal: 20 -> 16 in info block
  for (int i=0; i<infoBlock.length; i++) {
     infoBlock[i] = infoBlock[i].replaceAll('horizontal: 20', 'horizontal: 16');
     // Also remove the SizedBox(height: 120) from infoBlock, as it shouldn't be here now.
     // It will be at the end of the menu items list instead.
     if (infoBlock[i].contains('const SizedBox(height: 120)')) {
        infoBlock[i] = '';
     }
  }
  
  int chipsStart = lines.indexWhere((l) => l.contains('// 3. Category Chip Tabs'));
  if (chipsStart != -1) {
    lines.insertAll(chipsStart, infoBlock);
    lines.insert(chipsStart + infoBlock.length, ''); // spacing
  } else {
    print("Could not find chips start");
    return;
  }
  
  file.writeAsStringSync(lines.join('\n'));
  print("Layout Fixed: $infoStart to $infoEnd moved to $chipsStart");
}
