const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const newUI = `      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
       {(globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).map(role => (
         <div key={role.id} className="p-3 bg-muted/30 border border-border rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
           <span className="text-xl">{role.icon}</span>
           <div>
            <div className="font-medium text-sm">{role.name}</div>
            <div className="text-xs text-muted-foreground">{role.description}</div>
           </div>
          </div>
          {isSuperAdmin && (
            <button
               type="button"
               onClick={() => setEditingGlobalRole(role)}
               className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
               title="Sistem Görevini Düzenle"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>
            </button>
          )}
         </div>
       ))}
      </div>`;

const searchRegex = /<div className="grid grid-cols-1 xl:grid-cols-2 gap-3">[\s\S]*?(?=<\/div>\s*<div className="mt-8">)/;

txt = txt.replace(searchRegex, newUI + '\n      ');

fs.writeFileSync(file, txt);
console.log('UI Patched!');
