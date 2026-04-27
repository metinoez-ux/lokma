const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const mainStart = content.indexOf('<main className="max-w-6xl mx-auto px-4 py-6">');
let braceDepth = 0;
let divDepth = 0;
for (let i = mainStart; i < content.length; i++) {
    if (content[i] === '{') braceDepth++;
    if (content[i] === '}') braceDepth--;
    if (content.substr(i, 4) === '<div') divDepth++;
    if (content.substr(i, 5) === '</div') divDepth--;
    if (content.substr(i, 6) === '</main') {
        console.log("End of main. divDepth:", divDepth, "braceDepth:", braceDepth);
        break;
    }
}
