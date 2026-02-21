const fs = require('fs');

const file = 'src/app/[locale]/admin/dashboard/page.tsx';
const content = fs.readFileSync(file, 'utf8');

const regex = /['">]([ \wıİğĞüÜşŞöÖçÇ\(\)\,\.\:\-^<'"]*[ıİğĞüÜşŞöÖçÇ]+[ \wıİğĞüÜşŞöÖçÇ\(\)\,\.\:\-^<'"\/]*)[<'"]/g;
const matches = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
    let str = match[1].trim();
    if (str.length > 2 && !str.includes('console.')) {
        matches.add(str);
    }
}

console.log(Array.from(matches));
