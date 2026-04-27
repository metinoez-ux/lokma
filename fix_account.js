const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/account/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `{business?.staffCount || 1}`;
const replaceStr = `{personnelUsed}`;

if (content.includes(targetStr)) {
  content = content.replace(new RegExp(targetStr.replace(/[.*+?^$\{()|[\]\\]/g, '\\$&'), 'g'), replaceStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log("account/page.tsx fixed.");
} else {
  console.log("target not found");
}
