const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const files = [
    'src/app/[locale]/admin/products/page.tsx'
];

const map = JSON.parse(fs.readFileSync('products_map.json', 'utf8'));

files.forEach(filePath => {
    let code = fs.readFileSync(filePath, 'utf8');

    if (!code.includes('useTranslations(')) {
        code = code.replace("import { useAdmin } from '@/components/providers/AdminProvider';", "import { useAdmin } from '@/components/providers/AdminProvider';\nimport { useTranslations } from 'next-intl';");
    }

    const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
    });

    const replacements = [];

    traverse(ast, {
        StringLiteral(path) {
            const val = path.node.value.trim();
            if (map[val]) {
                const key = map[val];
                if (path.parent.type === 'JSXAttribute') {
                    replacements.push({ start: path.node.start, end: path.node.end, newText: `{t('${key}')}` });
                } else {
                    replacements.push({ start: path.node.start, end: path.node.end, newText: `t('${key}')` });
                }
            }
        },
        JSXText(path) {
            const val = path.node.value.trim();
            if (map[val]) {
                const key = map[val];
                const newText = path.node.value.replace(val, `{t('${key}')}`);
                replacements.push({ start: path.node.start, end: path.node.end, newText: newText });
            }
        },
        TemplateElement(path) {
            const val = path.node.value.raw.trim();
            if (map[val]) {
                const key = map[val];
                const newText = path.node.value.raw.replace(val, `\${t('${key}')}`);
                replacements.push({ start: path.node.start, end: path.node.end, newText: newText });
            }
        }
    });

    // Remove duplicates or overlapping ranges just in case
    const uniqueReplacements = [];
    const seenStarts = new Set();
    replacements.forEach(r => {
        if (!seenStarts.has(r.start)) {
            seenStarts.add(r.start);
            uniqueReplacements.push(r);
        }
    });

    uniqueReplacements.sort((a, b) => b.start - a.start);

    for (const rep of uniqueReplacements) {
        code = code.slice(0, rep.start) + rep.newText + code.slice(rep.end);
    }

    // Note: Actually, finding `function GlobalProductsPageContent() {` is better for this specific file.
    if (!code.includes("const t = useTranslations('AdminProducts');")) {
        const componentNames = ['GlobalProductsPageContent', 'GlobalProductsPage', 'BusinessDetailsPage'];
        for (let name of componentNames) {
            const decl = `function ${name}() {`;
            const decl2 = `export default function ${name}() {`;
            if (code.includes(decl)) {
                code = code.replace(decl, `${decl}\n    const t = useTranslations('AdminProducts');`);
                break;
            } else if (code.includes(decl2)) {
                code = code.replace(decl2, `${decl2}\n    const t = useTranslations('AdminProducts');`);
                break;
            }
        }
    }

    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`Refactored ${uniqueReplacements.length} strings in ${filePath}`);
});
