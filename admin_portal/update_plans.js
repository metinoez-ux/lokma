const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

const limitsStartStr = "{/* 2. Limits & Rules */}";
const limitsEndStr = "{/* 3. Personel & Vardiya Yönetimi */}";

const p1 = content.indexOf(limitsStartStr);
const p2 = content.indexOf(limitsEndStr);

if (p1 === -1 || p2 === -1) {
  console.log("Could not find blocks");
  process.exit(1);
}

// Get the whole string including the wrapper
// Wait, the whitespace before {/* 2. Limits & Rules */}
let beforeP1 = content.lastIndexOf('\n', p1);
let block = content.substring(beforeP1, p2);

// Remove the block from original content
content = content.substring(0, beforeP1) + '\n\n' + ' '.repeat(8) + content.substring(p2);

// Now process the block to extract the inner content
// We want everything after `<h3...>`
const h3Start = block.indexOf('<h3');
// We want to stop before the LAST `</div>`
const lastDiv = block.lastIndexOf('</div>');
let inner = block.substring(h3Start, lastDiv);

// Add top margin to h3
inner = inner.replace('mb-4 flex', 'mb-4 mt-8 pt-6 border-t border-border flex');

// Find the insert point
const featuresStartStr = "{/* 3. Features Grid */}";
const featuresEndStr = "</div>\n\n          {/* PROMOSYON & PAZARLAMA";
const fP1 = content.indexOf(featuresStartStr);
const fP2 = content.indexOf(featuresEndStr, fP1);

if (fP1 === -1 || fP2 === -1) {
  console.log("Could not find features grid");
  process.exit(1);
}

content = content.substring(0, fP2) + "\n" + inner + "\n          " + content.substring(fP2);

// Clean up Features wrapper
content = content.replace('<div className="bg-card/50 p-6 rounded-xl border border-border/50 h-full">', '<div className="bg-card/50 p-6 rounded-xl border border-border/50">');
content = content.replace('{/* 3. Features Grid */}', '{/* 3. Features & Limits */}');

fs.writeFileSync(file, content, 'utf-8');
console.log("Done");
