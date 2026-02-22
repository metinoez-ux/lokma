const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const extractMapPath = path.join(__dirname, '../phase3_extract.json');
const fileMapPath = path.join(__dirname, '../phase3_file_map.json');

if (!fs.existsSync(extractMapPath) || !fs.existsSync(fileMapPath)) {
    console.error("Missing phase 3 json files.");
    process.exit(1);
}

const extractedData = JSON.parse(fs.readFileSync(extractMapPath, 'utf8'));
const fileMap = JSON.parse(fs.readFileSync(fileMapPath, 'utf8'));

// Only process files that have extracted strings
const TARGET_FILES = Object.keys(fileMap);

function normalizeKey(str) {
    if (typeof str !== 'string') return 'error_key';
    let key = str.toLowerCase();
    key = key.replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
    key = key.replace(/[^a-z0-9]/g, '_');
    key = key.replace(/_+/g, '_').replace(/^_|_$/g, '');
    return key.substring(0, 40) || 'unknown';
}

console.log(`Starting Phase 3 Refactoring for ${TARGET_FILES.length} files...`);

for (const filePath of TARGET_FILES) {
    const ns = fileMap[filePath];
    if (!ns || !extractedData[ns]) continue;

    const nsDict = extractedData[ns];
    if (Object.keys(nsDict).length === 0) continue;

    let code = fs.readFileSync(filePath, 'utf8');
    
    // Quick string replace for literal replacements using Babel AST limits
    // Due to the complexity of Babel AST injecting hooks into diverse components, 
    // it's safer to use regex to inject the hook at the start of the default export component,
    // and AST to replace strings. Let's do a reliable AST replacement.

    let ast;
    try {
        ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });
    } catch (e) {
        console.error(`Error parsing ${filePath}:`, e.message);
        continue;
    }

    const tFnName = `t${ns}`;
    let modified = false;

    traverse(ast, {
        StringLiteral(astPath) {
            // Exclude already translated
            if (astPath.parent.type === 'CallExpression' && astPath.parent.callee.name && astPath.parent.callee.name.startsWith('t')) return;
            // Exclude object keys
            if (astPath.parent.type === 'ObjectProperty' && astPath.parent.key === astPath.node) return;
            if (astPath.parent.type === 'ImportDeclaration') return;
            if (astPath.parent.type === 'JSXAttribute') {
                // Keep classes, etc. string literals
                if (astPath.parent.name.name && ['className', 'type', 'id', 'name', 'htmlFor', 'href', 'src', 'alt', 'width', 'height', 'viewBox', 'd', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin'].includes(astPath.parent.name.name)) return;
            }

            const val = astPath.node.value;
            const key = normalizeKey(val);

            if (nsDict[key] && nsDict[key] === val) {
                // We have a match!
                // If it's inside JSX attribute, we might need {} wrapper
                if (astPath.parent.type === 'JSXAttribute') {
                    astPath.replaceWith(
                        t.jsxExpressionContainer(
                            t.callExpression(t.identifier(tFnName), [t.stringLiteral(key)])
                        )
                    );
                } else if (astPath.parent.type === 'TSLiteralType') {
                    // Do not replace TS type strings like "text" | "password"
                    return;
                } else {
                    astPath.replaceWith(
                        t.callExpression(t.identifier(tFnName), [t.stringLiteral(key)])
                    );
                }
                modified = true;
            }
        },
        JSXText(astPath) {
            const val = astPath.node.value.trim();
            if (!val) return;

            const key = normalizeKey(val);
            if (nsDict[key] && nsDict[key] === val) {
                // Replace with JSX Expression
                astPath.replaceWith(
                    t.jsxExpressionContainer(
                        t.callExpression(t.identifier(tFnName), [t.stringLiteral(key)])
                    )
                );
                // We might need to handle surrounding whitespace manually since we trimmed
                // If it was " Text ", we might want ` {" Text "} `. 
                // A simpler fix is to keep the nodes but change the content.
                // Or just rely on Next.js fixing spacing.
                modified = true;
            }
        }
    });

    if (modified) {
        let outputCode = generate(ast, {
            retainLines: true,
            comments: true
        }, code).code;

        // Ensure import exists
        if (!outputCode.includes("import { useTranslations }")) {
            outputCode = "import { useTranslations } from 'next-intl';\n" + outputCode;
        }

        // Try injecting hook into default export component
        let hookInjected = false;
        const hookCode = `\n    const ${tFnName} = useTranslations('${ns}');`;

        if (outputCode.includes(`const ${tFnName} = useTranslations('${ns}')`)) {
            hookInjected = true;
        } else {
            // Common Next.js Page patterns
            const componentMatches = outputCode.match(/export default (?:async )?function [A-Za-z0-9_]+\s*\([^)]*\)\s*{/);
            if (componentMatches) {
                 outputCode = outputCode.replace(componentMatches[0], componentMatches[0] + hookCode);
                 hookInjected = true;
            } else {
                 // Try looking for 'export default (' or 'export default function(' 
                 const basicMatch = outputCode.match(/export default function\s*\([^)]*\)\s*{/);
                 if (basicMatch) {
                     outputCode = outputCode.replace(basicMatch[0], basicMatch[0] + hookCode);
                     hookInjected = true;
                 }
            }
        }

        fs.writeFileSync(filePath, outputCode, 'utf8');
        console.log(`Refactored ${filePath}`);
        if (!hookInjected) {
             console.warn(`[WARNING] Could not inject hook for ${filePath}. You might need to add it manually.`);
        }
    }
}
console.log("Phase 3 AST Refactoring Completed!");
