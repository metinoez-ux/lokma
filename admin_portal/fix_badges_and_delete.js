const fs = require('fs');

const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

// 1. Fix the Delete Confirm
const targetDeleteStr = "if (!confirm('Bu personeli sistemden tamamen silmek istediğinize emin misiniz?')) return;";
const replaceDeleteStr = `const answer = prompt('Bu personeli sistemden TAMAMEN silmek istediğinize emin misiniz?\\n\\nİşlemi onaylamak için büyük harflerle EVET yazın:');
 if (answer !== 'EVET') {
   showToast('Silme işlemi iptal edildi', 'info');
   return;
 }`;

content = content.replace(targetDeleteStr, replaceDeleteStr);

// 2. Fix the Red X block (remove it)
const redXStart = ` <button \n type="button" \n onClick={async () => {\n const newStaff = assignedStaff.filter(id => id !== staff.id);`;
// This is exactly lines 3854 onwards. Let's find exactly the block to remove by index.
const startIdx = content.indexOf(`title="Düzenle"\n >\n ✎\n </button>`);
if (startIdx > -1) {
    const endOfEditBtn = content.indexOf(`</button>`, startIdx) + 9;
    const endOfRedXBtn = content.indexOf(`</button>`, endOfEditBtn + 10) + 9;
    // We want to keep Edit button (which ends at endOfEditBtn object), and remove what comes after until endOfRedXBtn
    const beforeStr = content.substring(0, endOfEditBtn);
    const afterStr = content.substring(endOfRedXBtn);
    content = beforeStr + '\n' + afterStr;
}

// 3. Fix the badges wrapping
const oldBadgeHTML = ` <div>\n <span className="text-sm font-medium text-foreground">{staff.displayName || (staff.firstName ? \`\${staff.firstName} \${staff.lastName || ''}\`.trim() : '') || staff.name || staff.email}</span>\n {assignedStaff.includes(staff.id) && (\n <span className="ml-2 text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30 px-2 py-0.5 rounded">Personel</span>\n )}`;

const newBadgeHTML = ` <div className="flex-1 min-w-0">\n <span className="block text-sm font-medium text-foreground truncate">{staff.displayName || (staff.firstName ? \`\${staff.firstName} \${staff.lastName || ''}\`.trim() : '') || staff.name || staff.email}</span>\n <div className="flex flex-wrap items-center gap-1.5 mt-1">\n {assignedStaff.includes(staff.id) && (\n <span className="text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30 px-2 py-0.5 rounded">Personel</span>\n )}`;
content = content.replace(oldBadgeHTML, newBadgeHTML);

// Close the wrapper
const oldAuthBadgeCode = `  Google\n  </span>\n )}\n {authProviderMap[staff.id].includes('password') && (\n  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20">\n  Email\n  </span>\n )}\n {authProviderMap[staff.id].includes('phone') && (\n  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20">\n  SMS\n  </span>\n )}\n </div>\n )}\n </div>\n </div>\n <div className="flex items-center gap-2">`;

const newAuthBadgeCode = `  Google\n  </span>\n )}\n {authProviderMap[staff.id].includes('password') && (\n  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20">\n  Email\n  </span>\n )}\n {authProviderMap[staff.id].includes('phone') && (\n  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20">\n  SMS\n  </span>\n )}\n </div>\n )}\n </div>\n </div>\n </div>\n <div className="flex flex-wrap items-center gap-2 shrink-0 md:pl-2">`;
content = content.replace(oldAuthBadgeCode, newAuthBadgeCode);

fs.writeFileSync(file, content);
console.log('Done!');
