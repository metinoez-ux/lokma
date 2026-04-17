const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/const newRoles = \(globalSystemRoles\.length > 0 \? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES\)\.map\(r => r\.id === editingGlobalRole\.id \? editingGlobalRole : r\);/g, 
  `let currentRoles = globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES;
                const exists = currentRoles.find(r => r.id === editingGlobalRole.id);
                let newRoles;
                if (exists) {
                   newRoles = currentRoles.map(r => r.id === editingGlobalRole.id ? editingGlobalRole : r);
                } else {
                   newRoles = [...currentRoles, editingGlobalRole];
                }`);

fs.writeFileSync(file, txt);
