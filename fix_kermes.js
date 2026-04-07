const fs = require('fs');
const filepath = 'mobile_app/lib/screens/kermes/kermes_detail_screen.dart';
let code = fs.readFileSync(filepath, 'utf8');

// 1. Fix cacheExtent
code = code.replace(
  'CustomScrollView(\n            controller: _scrollController,\n            physics: const BouncingScrollPhysics(),\n            slivers: [',
  'CustomScrollView(\n            cacheExtent: 10000,\n            controller: _scrollController,\n            physics: const BouncingScrollPhysics(),\n            slivers: ['
);

// 2. Remove the custom floating overlay completely!
code = code.replace(
  /_buildStickyOverlay\(context, isDark\),\s*\]\,\s*\)\,\s*bottomNavigationBar\:/,
  '],\n      ),\n      bottomNavigationBar:'
);

// 3. Remove the _buildStickyOverlay method entirely (we'll replace with a real SliverPersistentHeader inside)
const stickyStarts = code.indexOf('Widget _buildStickyOverlay');
if (stickyStarts !== -1) {
    const stickyEnds = code.indexOf('Widget _buildHeroSection(BuildContext context)');
    if (stickyEnds !== -1) {
        code = code.substring(0, stickyStarts) + code.substring(stickyEnds);
    }
}

// 4. Modify SliverAppBar to fade the search pill
const sliverAppBarRegex = /SliverAppBar\([\s\S]*?flexibleSpace: Column\([\s\S]*?SizedBox\([\s\S]*?Padding\([\s\S]*?Row\([\s\S]*?\/\/\s*Back\s*Button[\s\S]*?const SizedBox\(width: 12\),[\s\S]*?\/\/\s*Search\s*Bar[\s\S]*?Expanded\([\s\S]*?child: Container\([\s\S]*?height: 44,[\s\S]*?padding: const EdgeInsets.symmetric\(horizontal: 16\),[\s\S]*?decoration: BoxDecoration\([\s\S]*?color: isDark \? const Color\(0xFF1C1C1E\) : Colors.grey\[200\],[\s\S]*?borderRadius: BorderRadius.circular\(24\),[\s\S]*?\),[\s\S]*?child: Row\([\s\S]*?children: \[[\s\S]*?Icon\(Icons.search, size: 20, color: textSecondary\),[\s\S]*?const SizedBox\(width: 8\),[\s\S]*?Expanded\([\s\S]*?child: TextField\([\s\S]*?style: TextStyle\(color: textPrimary, fontSize: 14\),[\s\S]*?decoration: InputDecoration\([\s\S]*?hintText: \'Im Menü suchen...\',[\s\S]*?hintStyle: TextStyle\(color: textSecondary, fontSize: 14\),[\s\S]*?border: InputBorder.none,[\s\S]*?isDense: true,[\s\S]*?contentPadding: const EdgeInsets.symmetric\(vertical: 12\),[\s\S]*?\),[\s\S]*?\),[\s\S]*?\),[\s\S]*?\],[\s\S]*?\),[\s\S]*?\),[\s\S]*?\),[\s\S]*?\],[\s\S]*?\),[\s\S]*?\),[\s\S]*?\),[\s\S]*?\],[\s\S]*?\),[\s\S]*?\),/;

code = code.replace(/SliverAppBar\([\s\S]+?FlexibleSpace: Column[^]+?\]\,\n\s*\)\,\n\s*\)\,\n\s*\)\,\n\s*\]\,\n\s*\)\,\n\s*\)\,\n\s*\),/m, (match) => {
    return '/* SliverAppBar replaced manually below */'; // Just a marker
});

fs.writeFileSync(filepath, code, 'utf8');
