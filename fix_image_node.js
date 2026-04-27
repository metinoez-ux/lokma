const fs = require('fs');
const path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/hardware/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('src="/images/hardware/ecosystem-hero.png"', 'src="/images/hardware/hardware_ecosystem_hero.png"');
content = content.replace('className="object-cover opacity-40"', 'className="object-cover opacity-70"');

fs.writeFileSync(path, content, 'utf8');
console.log('Image updated.');
