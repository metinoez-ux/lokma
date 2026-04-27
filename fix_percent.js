const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\* 100\)}\{t\('kurye'\)\}/g,
  '* 100)}% {t(\'kurye\')}'
);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed percentage sign");
