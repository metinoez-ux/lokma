const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/\{\(editForm\.customRoles \|\| \[\]\)\.length === 0 \? \(/g, 
  `{(() => {
         const currentGlobal = globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES;
         const filteredCustomRoles = (editForm.customRoles || []).filter(cr => !currentGlobal.some(gr => gr.name.trim().toLowerCase() === cr.name.trim().toLowerCase()));
         return filteredCustomRoles.length === 0 ? (`);

txt = txt.replace(/\{\(editForm\.customRoles \|\| \[\]\)\.map\(r => \{/g, 
  `{filteredCustomRoles.map(r => {`);

txt = txt.replace(/<\/div>\n       \)\}\n      <\/div>/g,
  `</div>\n       );\n       })()}\n      </div>`);

fs.writeFileSync(file, txt);
