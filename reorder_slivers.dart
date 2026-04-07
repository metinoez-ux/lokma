import 'dart:io';

void main() {
  final file = File('mobile_app/lib/screens/kermes/kermes_detail_screen.dart');
  final lines = file.readAsLinesSync();

  int idxCategoryTabs = lines.indexWhere((l) => l.contains('// 3. Category Chip Tabs'));
  
  // Find where Products List ends. It's right before the SliverToBoxAdapter that has _buildLocationCard.
  int idxProductsListEnd = -1;
  for (int i = idxCategoryTabs; i < lines.length; i++) {
    if (lines[i].contains('_buildLocationCard()')) {
      // Find the SliverToBoxAdapter before it
      for (int j = i; j >= idxCategoryTabs; j--) {
        if (lines[j].contains('SliverToBoxAdapter(')) {
          idxProductsListEnd = j;
          break;
        }
      }
      break;
    }
  }

  // Find where the detail cards end (the closing ], of children in the Column, and then slivers: [])
  // Looking after _buildContactCard()
  int idxContactCard = lines.indexWhere((l) => l.contains('_buildContactCard()'));
  int idxDetailCardsEnd = -1;
  for (int i = idxContactCard; i < lines.length; i++) {
    if (lines[i].contains('],')) {
      // column children ]
    }
    if (lines[i].contains('),')) {
      // column closing
    }
    // We just safely look for the closing of the SliverToBoxAdapter block.
    // It is exactly at line 1184 according to grep.
    if (i > idxContactCard + 4 && lines[i].trim() == '],') { 
        // This is the end of the CustomScrollView's slivers array! So SliverToBoxAdapter closes a few lines before.
    }
  }

  print("Tabs: $idxCategoryTabs, End of Products: $idxProductsListEnd, ContactCard: $idxContactCard");
}
