const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const extractMap = JSON.parse(fs.readFileSync('phase1_extract.json', 'utf8'));

const targetFiles = [
    { file: 'src/app/[locale]/admin/ai-menu/page.tsx', ns: 'AdminAIMenu', comp: 'AIMenuPage' },
    { file: 'src/app/[locale]/admin/staff/page.tsx', ns: 'AdminStaff', comp: 'StaffRedirectPage' },
    { file: 'src/app/[locale]/admin/staff-dashboard/page.tsx', ns: 'AdminStaff', comp: 'StaffDashboardPage' },
    { file: 'src/app/[locale]/admin/staff-shifts/page.tsx', ns: 'AdminStaff', comp: 'StaffShiftsPage' },
    { file: 'src/app/[locale]/admin/products/page.tsx', ns: 'AdminProducts', comp: 'MasterCatalogPage' },
    { file: 'src/app/[locale]/admin/invoices/page.tsx', ns: 'AdminInvoices', comp: 'InvoicesPage' },
    { file: 'src/app/[locale]/admin/business/page.tsx', ns: 'AdminBusiness', comp: 'BusinessesPage' },
    { file: 'src/app/[locale]/admin/business/[id]/page.tsx', ns: 'AdminBusiness', comp: 'BusinessDetailsPage' }
];

targetFiles.forEach(({ file: filePath, ns, comp: componentName }) => {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    const map = extractMap[ns];
    if (!map) return;

    let code = fs.readFileSync(filePath, 'utf8');

    // Inject import if needed
    if (!code.includes("from 'next-intl'") && !code.includes("from \"next-intl\"")) {
        const lines = code.split('\n');
        let lastImportIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
                lastImportIdx = i;
            }
        }
        if (lastImportIdx >= 0) {
            lines.splice(lastImportIdx + 1, 0, "import { useTranslations } from 'next-intl';");
            code = lines.join('\n');
        } else {
            code = "import { useTranslations } from 'next-intl';\n" + code;
        }
    }

    let ast;
    try {
        ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript']
        });
    } catch (e) {
        console.error(`Parse failed for ${filePath}: ${e.message}`);
        return;
    }

    const replacements = [];

    // Use a unique name for the t function, e.g., tAdminStaff
    const tFn = `t${ns}`;

    traverse(ast, {
        StringLiteral(path) {
            const val = path.node.value.trim();
            if (map[val]) {
                const key = map[val];
                if (path.parent.type === 'JSXAttribute') {
                    replacements.push({ start: path.node.start, end: path.node.end, newText: `{${tFn}('${key}')}` });
                } else if (path.parent.type === 'ImportDeclaration' || path.parent.type === 'TypeScript') {
                    // Do nothing for imports
                } else {
                    replacements.push({ start: path.node.start, end: path.node.end, newText: `${tFn}('${key}')` });
                }
            }
        },
        JSXText(path) {
            const val = path.node.value.trim();
            if (map[val]) {
                const key = map[val];
                const newText = path.node.value.replace(val, `{${tFn}('${key}')}`);
                replacements.push({ start: path.node.start, end: path.node.end, newText: newText });
            }
        },
        TemplateElement(path) {
            const val = path.node.value.raw.trim();
            if (map[val]) {
                const key = map[val];
                const newText = path.node.value.raw.replace(val, `\${${tFn}('${key}')}`);
                replacements.push({ start: path.node.start, end: path.node.end, newText: newText });
            }
        }
    });

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

    // Inject the hook inside the component
    const hookCode = `\n    const ${tFn} = useTranslations('${ns}');`;
    let hookInjected = false;

    if (code.includes(`const ${tFn} = useTranslations('${ns}')`)) {
        hookInjected = true;
    } else {
        const rx = new RegExp(`export default (?:async )?function ${componentName}\\s*\\([^)]*\\)\\s*{`);
        const match = code.match(rx);
        if (match) {
            code = code.replace(match[0], match[0] + hookCode);
            hookInjected = true;
        } else {
            // fallback
            const rx2 = /export default function [a-zA-Z0-9_]+\s*\([^)]*\)\s*\{/;
            const match2 = code.match(rx2);
            if (match2) {
                code = code.replace(match2[0], match2[0] + hookCode);
                hookInjected = true;
            }
        }
    }

    if (!hookInjected) {
        console.warn(`Could not inject useTranslations hook automatically for ${filePath} (${componentName}).`);
    }

    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`Refactored ${uniqueReplacements.length} strings in ${filePath}`);
});
