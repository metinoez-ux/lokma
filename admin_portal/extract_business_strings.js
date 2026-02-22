const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const files = [
    'src/app/[locale]/admin/business/page.tsx',
    'src/app/[locale]/admin/business/[id]/page.tsx'
];

const TR_CHARS = /[ıİğĞüÜşŞöÖçÇ]/;

const extractedStrings = new Set();

function hasTurkishChars(str) {
    if (!str || typeof str !== 'string') return false;
    return TR_CHARS.test(str) && str.length > 2 && !str.includes('flex');
}

files.forEach(filePath => {
    const code = fs.readFileSync(filePath, 'utf8');
    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript']
        });

        traverse(ast, {
            StringLiteral(path) {
                if (hasTurkishChars(path.node.value)) {
                    extractedStrings.add(path.node.value.trim());
                }
            },
            JSXText(path) {
                if (hasTurkishChars(path.node.value)) {
                    extractedStrings.add(path.node.value.trim());
                }
            },
            TemplateElement(path) {
                if (hasTurkishChars(path.node.value.raw)) {
                    extractedStrings.add(path.node.value.raw.trim());
                }
            }
        });
    } catch (e) {
        console.error('Error parsing', filePath, e);
    }
});

fs.writeFileSync('business_strings.json', JSON.stringify(Array.from(extractedStrings), null, 2));
console.log('Extracted', extractedStrings.size, 'strings.');
