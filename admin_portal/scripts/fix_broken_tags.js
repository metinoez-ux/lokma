const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let data = fs.readFileSync(file, 'utf8');

const bad1 = `<span className="text-sm">🟢 {t('akdenizTorosUrunleri')}</span>
  </label>
  </div>
  </div>`;

data = data.replace(bad1, '');
fs.writeFileSync(file, data);

console.log("Done");
