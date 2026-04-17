const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const tDriver = `(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find(r => r.id === 'role_driver')?.name || 'Sürücü'`;
const tWaiter = `(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find(r => r.id === 'role_waiter')?.name || 'Garson'`;
const tAdmin = `(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find(r => r.id === 'role_admin')?.name || 'Kermes Admin'`;

txt = txt.replace(/Surucu Olarak Ata/g, `{\`\${${tDriver}} Olarak Ata\`}`);
txt = txt.replace(/Garson Olarak Ata/g, `{\`\${${tWaiter}} Olarak Ata\`}`);
txt = txt.replace(/Kermes Admini Olarak Ata/g, `{\`\${${tAdmin}}i Olarak Ata\`}`);

txt = txt.replace(/Surucu olarak ata\/cikar/g, `{\`\${${tDriver}} olarak ata/cikar\`}`);
txt = txt.replace(/Garson olarak ata\/cikar/g, `{\`\${${tWaiter}} olarak ata/cikar\`}`);
txt = txt.replace(/Kermes Admini olarak ata\/cikar/g, `{\`\${${tAdmin}} olarak ata/cikar\`}`);

fs.writeFileSync(file, txt);
console.log('Toggles Patched!');
