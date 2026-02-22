const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const targetDirs = [
    'src/app/[locale]/admin/settings',
    'src/app/[locale]/admin/drivers',
    'src/app/[locale]/admin/invoices',
    'src/app/[locale]/admin/statistics',
    'src/app/[locale]/admin/analytics',
    'src/app/[locale]/admin/commissions',
    'src/app/[locale]/admin/sectors',
    'src/app/[locale]/admin/table-orders',
    'src/app/[locale]/admin/delivery-settings',
    'src/app/[locale]/admin/plans'
];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                arrayOfFiles.push(path.join(__dirname, dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

let allStrings = new Set();
const trRegex = /[çğıöşüÇĞİÖŞÜ]/;

targetDirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = getAllFiles(dir);

    files.forEach(file => {
        const code = fs.readFileSync(file, 'utf8');
        try {
            const ast = parser.parse(code, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx']
            });

            traverse(ast, {
                StringLiteral(path) {
                    const val = path.node.value;
                    if (trRegex.test(val) && !val.startsWith('bg-') && !val.startsWith('text-')) {
                        allStrings.add(val.trim());
                    }
                },
                JSXText(path) {
                    const val = path.node.value.trim();
                    if (val && trRegex.test(val)) {
                        allStrings.add(val);
                    }
                },
                TemplateElement(path) {
                    const val = path.node.value.raw.trim();
                    if (val && trRegex.test(val)) {
                        allStrings.add(val);
                    }
                }
            });
        } catch (e) {
            console.error(`Error parsing ${file}:`, e.message);
        }
    });
});

const sortedStrings = Array.from(allStrings).filter(s => s).sort();
const outputObj = {};
let count = 0;
sortedStrings.forEach(s => {
    outputObj[s] = s;
    count++;
});

fs.writeFileSync('extras_strings.json', JSON.stringify(outputObj, null, 2));
console.log(`Extracted ${count} strings from extras files.`);
