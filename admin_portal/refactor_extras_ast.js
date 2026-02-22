const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const tBabel = require('@babel/types');

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
            if (file.endsWith('.tsx')) {
                arrayOfFiles.push(path.join(__dirname, dirPath, "/", file));
            }
        }
    });
    return arrayOfFiles;
}

const map = JSON.parse(fs.readFileSync('extras_map.json', 'utf8'));

let files = [];
targetDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        files = files.concat(getAllFiles(dir));
    }
});

files.forEach(filePath => {
    let code = fs.readFileSync(filePath, 'utf8');

    // Simple replacement strategy using Regex for the hook injection
    // It's safer to use Babel for string replacement and simple string manipulation for the hook
    let madeChanges = false;

    const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
    });

    const replacements = [];

    traverse(ast, {
        StringLiteral(path) {
            const val = path.node.value.trim();
            if (map[val] && !path.parentPath.isImportDeclaration()) {
                const key = map[val];
                if (path.parent.type === 'JSXAttribute') {
                    replacements.push({ start: path.node.start, end: path.node.end, newText: `{t('${key}')}` });
                } else if (path.parent.type === 'ObjectProperty' || path.parent.type === 'CallExpression' || path.parent.type === 'ArrayExpression' || path.parent.type === 'BinaryExpression' || path.parent.type === 'LogicalExpression' || path.parent.type === 'ConditionalExpression' || path.parent.type === 'VariableDeclarator') {
                    replacements.push({ start: path.node.start, end: path.node.end, newText: `t('${key}')` });
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
                if (path.parent.type === 'TemplateLiteral') {
                    const newText = path.node.value.raw.replace(val, `\${t('${key}')}`);
                    replacements.push({ start: path.node.start, end: path.node.end, newText: newText });
                }
            }
        }
    });

    if (replacements.length > 0) {
        // Remove duplicates/overlaps
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

        // Add imports
        if (!code.includes("import { useTranslations }")) {
            // Find the last import
            const lastImportMatch = [...code.matchAll(/^import .* from .*;$/gm)].pop();
            if (lastImportMatch) {
                const insertPos = lastImportMatch.index + lastImportMatch[0].length;
                code = code.slice(0, insertPos) + "\nimport { useTranslations } from 'next-intl';" + code.slice(insertPos);
            } else {
                code = "import { useTranslations } from 'next-intl';\n" + code;
            }
        }

        // Inject hook
        if (!code.includes("const t = useTranslations('AdminExtras');")) {
            // We find the main exported component
            const match = code.match(/(?:export default )?function\s+([A-Z]\w*)\s*\([^)]*\)\s*{/);
            if (match) {
                code = code.replace(match[0], `${match[0]}\n    const t = useTranslations('AdminExtras');`);
            } else {
                const arrowMatch = code.match(/(?:export )\s*(?:const|let)\s+([A-Z]\w*)\s*=\s*\([^)]*\)\s*=>\s*{/);
                if (arrowMatch) {
                    code = code.replace(arrowMatch[0], `${arrowMatch[0]}\n    const t = useTranslations('AdminExtras');`);
                } else {
                    const defaultArrowMatch = code.match(/export default\s*\([^)]*\)\s*=>\s*{/);
                    if (defaultArrowMatch) {
                        code = code.replace(defaultArrowMatch[0], `${defaultArrowMatch[0]}\n    const t = useTranslations('AdminExtras');`);
                    }
                }
            }
        }

        fs.writeFileSync(filePath, code, 'utf8');
        console.log(`Refactored ${uniqueReplacements.length} strings in ${filePath}`);
    }
});
