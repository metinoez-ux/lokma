const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\|\| admin\?\.adminType === 'lokma_admin'/g, 
  "|| admin?.adminType === 'admin'");

fs.writeFileSync(file, content);
