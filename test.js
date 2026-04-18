const fs = require('fs');
const content = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('Hazır Paket Ürün Satışı'));
if (startIndex !== -1) {
    console.log(lines.slice(startIndex - 5, startIndex + 15).join('\n'));
}

const typeIndex = lines.findIndex(l => l.includes('getBusinessTypeLabel'));
if (typeIndex !== -1) {
    console.log('\n--- getBusinessTypeLabel ---');
    console.log(lines.slice(typeIndex - 5, typeIndex + 15).join('\n'));
}

