const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. In loadKermes padding
content = content.replace(
/if \(!roles\.some\(\(r: any\) => r\.name === 'Park Görevlisi'\)\) \{\n\s*roles\.unshift\(\{ id: 'role_park_system', name: 'Park Görevlisi', icon: '🅿️', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' \}\);\n\s*\}\n\s*if \(!roles\.some\(\(r: any\) => r\.name === 'Temizlik Görevlisi'\)\) \{\n\s*roles\.unshift\(\{ id: 'role_temizlik_system', name: 'Temizlik Görevlisi', icon: '🧹', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' \}\);\n\s*\}/g,
`if (!roles.some((r: any) => r.icon === '🧹')) {
            roles.push({ id: 'role_temizlik_system', name: 'Temizlik Görevlisi', icon: '🧹', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' });
        }
        if (!roles.some((r: any) => r.icon === '🅿️')) {
            roles.push({ id: 'role_park_system', name: 'Park Görevlisi', icon: '🅿️', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' });
        }
        if (!roles.some((r: any) => r.icon === '👶')) {
            roles.push({ id: 'role_cocuk_system', name: 'Çocuk Görevlisi', icon: '👶', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' });
        }
        if (!roles.some((r: any) => r.icon === '⭐')) {
            roles.push({ id: 'role_vip_system', name: 'Özel Misafir (VIP)', icon: '⭐', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' });
        }
        if (!roles.some((r: any) => r.icon === '📦')) {
            roles.push({ id: 'role_tedarik_system', name: 'Malzeme Tedarikçisi', icon: '📦', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' });
        }`
);

// 2. In Custom Roles Assignment
content = content.replace(
/\[\.\.\.EXTENDED_SYSTEM_ROLES, \.\.\.\(editForm\.customRoles \|\| \[\]\)\]/g,
`(editForm.customRoles || [])`
);

// 3. Remove EXTENDED_SYSTEM_ROLES mapping block
content = content.replace(
/\{\/\* Extended System Roles from constant \*\/\}\n\s*\{EXTENDED_SYSTEM_ROLES\.map\(role => \(\n\s*<div key=\{role\.id\}[\s\S]*?<\/div>\n\s*\)\)\}/,
`{/* System Roles converted to Dynamic */}`
);

// 4. In Dynamic Roles mapping: Remove the filter that hid Temizlik and Park!
content = content.replace(
/\(editForm\.customRoles \|\| \[\]\)\.filter\(r => !\['role_temizlik_system', 'role_park_system'\]\.includes\(r\.id\)\)\.map/g,
`(editForm.customRoles || []).map`
);

fs.writeFileSync(file, content);
console.log("Done updating page.tsx!");
