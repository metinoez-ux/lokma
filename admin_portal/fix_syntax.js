const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// I will insert `</div></div></div></div>` right before `</main >`
const insertStr = '\n</div>\n</div>\n</div>\n</div>\n';
content = content.replace('</main >', insertStr + '</main >');

fs.writeFileSync(file, content, 'utf8');
