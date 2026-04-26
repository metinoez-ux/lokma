const fs = require('fs');
const path = 'src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const kurierStartMarker = '          {/* KURIERLIEFERUNGEN (Kurye Siparişleri) */}';
const kurierEndMarker = '          {/* Limits & Rules moved here */}';

const kurierStartIndex = content.indexOf(kurierStartMarker);
const kurierEndIndex = content.indexOf(kurierEndMarker);

if (kurierStartIndex === -1 || kurierEndIndex === -1) {
  console.log('Markers not found');
  process.exit(1);
}

// Extract Kurier block
let kurierBlock = content.substring(kurierStartIndex, kurierEndIndex);
content = content.substring(0, kurierStartIndex) + content.substring(kurierEndIndex);

// Re-style the Kurier block to look like a main card
kurierBlock = kurierBlock.replace(
  '<div className="mt-6 border border-purple-200 dark:border-purple-700/30 rounded-xl overflow-hidden p-4 bg-card/50">',
  '<div className="mt-6 bg-card/50 p-6 rounded-xl border border-border/50">'
);
kurierBlock = kurierBlock.replace(
  '<h4 className="text-xs font-bold text-purple-800 dark:text-purple-400 uppercase tracking-widest mb-4 ml-1">Kurierlieferungen</h4>',
  `<h3 className="text-foreground font-semibold mb-6 flex items-center gap-2 border-b border-border pb-4">\n              <span className="w-1 h-6 bg-purple-500 rounded-full"></span>\n              Kurierlieferungen\n            </h3>`
);

// Find end of main card
const mainCardEndMarker = '          {/* BUCHHALTUNG (Muhasebe) */}';
const mainCardEndIndex = content.indexOf(mainCardEndMarker);

if (mainCardEndIndex === -1) {
  console.log('Main card end marker not found');
  process.exit(1);
}

// Insert Kurier block before Buchhaltung
content = content.substring(0, mainCardEndIndex) + kurierBlock + '\n' + content.substring(mainCardEndIndex);

fs.writeFileSync(path, content, 'utf8');
console.log('Moved Kurierlieferungen successfully');
