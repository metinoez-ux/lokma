const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/title=\{assignedWaiters\.includes\(staff\.id\) \? 'Garsonluktan Cikar' : [\s\S]*?\}/g, 
  `title={assignedWaiters.includes(staff.id) ? 'Garsonluktan Cikar' : \`\${(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find((r: any) => r.id === 'role_waiter')?.name || 'Garson'} Olarak Ata\`}`);

txt = txt.replace(/title=\{assignedDrivers\.includes\(staff\.id\) \? 'Suruculukten Cikar' : [\s\S]*?\}/g,
  `title={assignedDrivers.includes(staff.id) ? 'Suruculukten Cikar' : \`\${(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find((r: any) => r.id === 'role_driver')?.name || 'Sürücü'} Olarak Ata\`}`);

txt = txt.replace(/title=\{kermesAdmins\.includes\(staff\.id\) \? 'Admi̇nli̇kten Cikar' : [\s\S]*?\}/g,
  `title={kermesAdmins.includes(staff.id) ? 'Adminlikten Cikar' : \`\${(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find((r: any) => r.id === 'role_admin')?.name || 'Kermes Admin'} Olarak Ata\`}`);

fs.writeFileSync(file, txt);
