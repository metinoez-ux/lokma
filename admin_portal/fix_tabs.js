const fs = require('fs');

// 1. Fix KermesMenuTab.tsx
const menuFile = 'src/app/[locale]/admin/kermes/[id]/KermesMenuTab.tsx';
let menuCode = fs.readFileSync(menuFile, 'utf8');

// The file has `{activeTab === 'menu' && (` at the beginning and `)}` near the end.
// Let's remove them.
menuCode = menuCode.replace("{activeTab === 'menu' && (", '');
const lastBracketIdx = menuCode.lastIndexOf(')}');
if (lastBracketIdx !== -1) {
    menuCode = menuCode.substring(0, lastBracketIdx) + menuCode.substring(lastBracketIdx + 2);
}

// Replace emojis with Material Symbols Outlined
menuCode = menuCode.replace(/🍽️/g, '<span className="material-symbols-outlined text-sm">restaurant</span>');
menuCode = menuCode.replace(/🎪/g, '<span className="material-symbols-outlined text-3xl">storefront</span>');
menuCode = menuCode.replace(/📦/g, '<span className="material-symbols-outlined text-3xl">inventory_2</span>');
menuCode = menuCode.replace(/✨/g, '<span className="material-symbols-outlined text-3xl">star</span>');
menuCode = menuCode.replace(/📸/g, '<span className="material-symbols-outlined text-sm">photo_camera</span>');
menuCode = menuCode.replace(/💰/g, '<span className="material-symbols-outlined text-sm">payments</span>');
menuCode = menuCode.replace(/⚠️/g, '<span className="material-symbols-outlined text-sm">warning</span>');
// Fix types
menuCode = menuCode.replace(/import React from 'react';/, `import React from 'react';\nimport { MasterProduct, KermesMenuItemData } from '@/types';\n`);

fs.writeFileSync(menuFile, menuCode);

// 2. Fix KermesRosterTab.tsx 
const rosterFile = 'src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx';
let rosterCode = fs.readFileSync(rosterFile, 'utf8');
rosterCode = rosterCode.replace(
    /}, \{\} as Record<string, typeof groupedRosters\[string\]>\)\)\.sort\(\)\.map\(\(\[role, list\]\) => \{/,
    '}, {} as Record<string, any[]>)).sort().map(([role, list]: [string, any[]]) => {'
);
fs.writeFileSync(rosterFile, rosterCode);

console.log("Fixes applied");
