const fs = require('fs');
const file = 'src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');

// Find boundaries for Block 1 (Lines 6515-6667 approximately)
const block1Start = lines.findIndex(l => l.includes('settingsSubTab === "masa" && ('));
let block1End = -1;
if (block1Start !== -1) {
    for (let i = block1Start; i < lines.length; i++) {
        if (lines[i].includes('              }')) {
             if (lines[i-1].includes('                )')) {
                 block1End = i;
                 break;
             }
        }
    }
}

// Find boundaries for Block 2 (Lines 7480-8034 approximately)
const block2Start = lines.findIndex((l, idx) => idx > block1End && l.includes('activeTab === "settings" && settingsSubTab === "masa" && ('));
let block2End = -1;
if (block2Start !== -1) {
    for (let i = block2Start; i < lines.length; i++) {
        if (lines[i].includes('        }')) {
             if (lines[i-1].includes('          )')) {
                 block2End = i;
                 break;
             }
        }
    }
}

// Find reservations tab boundary
const resStart = lines.findIndex(l => l.includes('activeTab === "reservations" && ('));
let resEnd = -1;
if (resStart !== -1) {
    for (let i = resStart; i < lines.length; i++) {
        if (lines[i].includes('        }')) {
             if (lines[i-1].includes('          )')) {
                 resEnd = i;
                 break;
             }
        }
    }
}

// Remove the `masa` settings menu item (Line 2597 and 3656)
const menuIdx1 = lines.findIndex(l => l.includes('activeTab === "settings" && settingsSubTab === item.key'));
const menuIdx2 = lines.findIndex(l => l.includes('settingsSubTab === "masa" && t(\'masaAyarlari\')'));

console.log({block1Start, block1End, block2Start, block2End, resStart, resEnd, menuIdx1, menuIdx2});
