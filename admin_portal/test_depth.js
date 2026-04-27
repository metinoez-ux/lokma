const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// find the open <main tag and trace JSX depth
const mainStart = content.indexOf('<main className="max-w-6xl mx-auto px-4 py-6">');
let depth = 0;
let divDepth = 0;
for (let i = mainStart; i < content.length; i++) {
    if (content.substr(i, 5) === '<main') depth++;
    if (content.substr(i, 6) === '</main') {
        depth--;
        if (depth === 0) {
            console.log("Found closing main at", i);
            console.log("Div depth at this point is", divDepth);
            break;
        }
    }
    if (content.substr(i, 4) === '<div') divDepth++;
    if (content.substr(i, 5) === '</div') divDepth--;
}
