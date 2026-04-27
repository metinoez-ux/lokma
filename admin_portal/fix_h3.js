const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// I will extract the blocks starting from `settingsSubTab === "dashboard"` and `settingsSubTab === "siparisler"` 
// and move them OUT of the <h3 ...> and <div className="flex justify-between items-center mb-6">

const dashboardMatch = content.match(/\{\s*settingsSubTab === "dashboard" && \(/);
const siparislerMatch = content.match(/\{\s*settingsSubTab === "siparisler" && \(/);

// Since I broke the AST, it's safer to just revert the file to HEAD and do it properly with multi_replace_file_content !
