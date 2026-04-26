const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "updateData.cancelledByName = admin.displayName || admin.name || admin.email || 'Admin';",
  "updateData.cancelledByName = admin.displayName || admin.email || 'Admin';"
);

content = content.replace(
  `    return {
      id: p.id,
      code: p.code || p.id,
      ...p,
    };`,
  `    return {
      ...p,
      id: p.id,
      code: p.code || p.id,
    };`
);

fs.writeFileSync(file, content);
