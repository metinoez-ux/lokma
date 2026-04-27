const fs = require('fs');
const path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';

let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* ══ INVITE MODAL ══ */}')) {
    lines.splice(i, 0, '  </div>', '  </>', '  )}', '');
    break;
  }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done');
