const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `    setAvailablePlans(plans.map(p => ({
      code: p.code || p.id,
      ...p,
      color: p.color || 'bg-muted border border-border text-foreground',
    })));`,
  `    setAvailablePlans(plans.map(p => ({
      ...p,
      code: p.code || p.id,
      color: p.color || 'bg-muted border border-border text-foreground',
    })));`
);

fs.writeFileSync(file, content);
