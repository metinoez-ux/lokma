const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// The syntax error is at 3689: title={... ? '...' : '{`...`}'}
// The string interpolation is wrapped in extra quotes.
txt = txt.replace(/title=\{assignedWaiters\.includes\(staff\.id\) \? 'Garsonluktan Cikar' : '\{`\$\{\(globalSystemRoles\.length > 0 \? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES\)\.find\(r => r\.id === \\'role_waiter\\'\)\?\.name \|\| \\'Garson\\'\} Olarak Ata`\}'\}/g,
  `title={assignedWaiters.includes(staff.id) ? 'Garsonluktan Cikar' : \`\${(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find(r => r.id === 'role_waiter')?.name || 'Garson'} Olarak Ata\`}`);

txt = txt.replace(/title=\{assignedDrivers\.includes\(staff\.id\) \? 'Suruculukten Cikar' : '\{`\$\{\(globalSystemRoles\.length > 0 \? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES\)\.find\(r => r\.id === \\'role_driver\\'\)\?\.name \|\| \\'Sürücü\\'\} Olarak Ata`\}'\}/g,
  `title={assignedDrivers.includes(staff.id) ? 'Suruculukten Cikar' : \`\${(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find(r => r.id === 'role_driver')?.name || 'Sürücü'} Olarak Ata\`}`);

txt = txt.replace(/title=\{kermesAdmins\.includes\(staff\.id\) \? 'Admi̇nli̇kten Cikar' : '\{`\$\{\(globalSystemRoles\.length > 0 \? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES\)\.find\(r => r\.id === \\'role_admin\\'\)\?\.name \|\| \\'Kermes Admin\\'\}i Olarak Ata`\}'\}/g,
  `title={kermesAdmins.includes(staff.id) ? 'Admi̇nli̇kten Cikar' : \`\${(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).find(r => r.id === 'role_admin')?.name || 'Kermes Admin'}i Olarak Ata\`}`);

fs.writeFileSync(file, txt);
console.log('Syntax Patched!');
