const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const resTabStr = '{/* Reservations Tab */}';
const resIdx = content.indexOf(resTabStr);

// Find the closure of the settings tab right before reservations
const closingStr = '              </div>\n            </div>\n          )\n        }';
const closingIdx = content.lastIndexOf(closingStr, resIdx);

if (closingIdx === -1) {
    console.log("Could not find closing str!");
    // Try to find just the exact closing braces
    const altClosingIdx = content.lastIndexOf(')\n        }', resIdx);
    console.log("Found alt closing at", altClosingIdx);
} else {
    // We found it!
    console.log("Found closing at", closingIdx);
}

