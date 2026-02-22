const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const extractMapPath = path.join(__dirname, '../phase3_extract.json');
const fileMapPath = path.join(__dirname, '../phase3_file_map.json');

if (!fs.existsSync(extractMapPath) || !fs.existsSync(fileMapPath)) {
    console.error("Missing phase 3 extract or file map!");
    process.exit(1);
}

const extractedData = JSON.parse(fs.readFileSync(extractMapPath, 'utf8'));
const fileMap = JSON.parse(fs.readFileSync(fileMapPath, 'utf8'));

const nsStringToKey = {};
for (const ns in extractedData) {
    nsStringToKey[ns] = {};
    for (const key in extractedData[ns]) {
        nsStringToKey[ns][extractedData[ns][key]] = key;
    }
}

function processFile(filePath, ns) {
    if (!fs.existsSync(filePath)) {
        console.error("File not found: " + filePath);
        return;
    }
    const code = fs.readFileSync(filePath, 'utf8');

    let ast;
    try {
        ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript']
        });
    } catch (e) {
        console.error(`Error parsing ${filePath}:`, e.message);
        return;
    }

    let hasImport = false;
    let existingTHookName = null;
    let hookScopeStart = -1;
    let hookScopeEnd = -1;

    // 1. Locate the default export component scope (this is where `t` will live)
    traverse(ast, {
        ImportDeclaration(p) {
            if (p.node.source.value === 'next-intl') {
                const specifier = p.node.specifiers.find(s => s.imported && s.imported.name === 'useTranslations');
                if (specifier) hasImport = true;
            }
        },
        CallExpression(p) {
            if (p.node.callee.name === 'useTranslations') {
                if (p.parentPath.isVariableDeclarator()) {
                    existingTHookName = p.parentPath.node.id.name;
                    // Find enclosing function
                    let curr = p.parentPath;
                    while (curr) {
                        if (curr.isFunction()) {
                            hookScopeStart = curr.node.start;
                            hookScopeEnd = curr.node.end;
                            break;
                        }
                        curr = curr.parentPath;
                    }
                }
            }
        },
        ExportDefaultDeclaration(p) {
            // Find default export if existingTHookName is not found
            // This logic mirrors the injection logic later
            const decl = p.node.declaration;
            if (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression') {
                hookScopeStart = decl.start;
                hookScopeEnd = decl.end;
            } else if (decl.type === 'Identifier') {
                const binding = p.scope.getBinding(decl.name);
                if (binding && binding.path.node.type === 'FunctionDeclaration') {
                    hookScopeStart = binding.path.node.start;
                    hookScopeEnd = binding.path.node.end;
                } else if (binding && binding.path.node.type === 'VariableDeclarator' && binding.path.node.init && (binding.path.node.init.type === 'ArrowFunctionExpression' || binding.path.node.init.type === 'FunctionExpression')) {
                    hookScopeStart = binding.path.node.init.start;
                    hookScopeEnd = binding.path.node.init.end;
                }
            }
        }
    });

    const isInsideHookScope = (node) => {
        // If we couldn't find a default export component, we assume safe top-level replacement is allowed
        // (but this will break TS if it's a ts library, so strictly enforce scope if it's a tsx component)
        if (hookScopeStart === -1 || hookScopeEnd === -1) {
            return false; // Skip replacing in non-components entirely!
        }
        return node.start >= hookScopeStart && node.end <= hookScopeEnd;
    }

    let needsUseTranslations = false;
    let useTranslationsInjected = false;
    let tHookNodeName = existingTHookName || 't';
    const replacements = [];
    const stringToKey = nsStringToKey[ns] || {};

    traverse(ast, {
        JSXText(path) {
            if (!isInsideHookScope(path.node)) return;
            if (path.parent.type === 'TSLiteralType') return;

            const rawStr = path.node.value;
            const trimmed = rawStr.trim();
            if (!trimmed) return;

            const key = stringToKey[trimmed];
            if (key) {
                const before = rawStr.substring(0, rawStr.indexOf(trimmed));
                const after = rawStr.substring(rawStr.indexOf(trimmed) + trimmed.length);
                const rep = `${before}{${tHookNodeName}('${key}')}${after}`;
                replacements.push({ start: path.node.start, end: path.node.end, rep });
                needsUseTranslations = true;
            }
        },
        StringLiteral(path) {
            if (!isInsideHookScope(path.node)) return;
            if (path.parent.type === 'ImportDeclaration') return;
            if (path.parent.type === 'ObjectProperty' && path.parent.key === path.node) return;
            if (path.parent.type === 'ClassProperty' || path.parent.type === 'ClassMethod') return;
            if (path.parent.type === 'TSLiteralType') return;
            if (path.parent.type === 'TSPropertySignature') return;

            const rawStr = path.node.value.trim();
            if (!rawStr) return;

            const key = stringToKey[rawStr];
            if (key) {
                let rep = `${tHookNodeName}('${key}')`;
                if (path.parent.type === 'JSXAttribute') {
                    rep = `{${rep}}`;
                }
                replacements.push({ start: path.node.start, end: path.node.end, rep });
                needsUseTranslations = true;
            }
        }
    });

    if (!needsUseTranslations) {
        return;
    }

    replacements.sort((a, b) => b.start - a.start);
    const dedupReplacements = [];
    let lastStart = null;
    for (const r of replacements) {
        if (r.start !== lastStart) {
            dedupReplacements.push(r);
            lastStart = r.start;
        }
    }

    let newCode = code;
    for (const r of dedupReplacements) {
        newCode = newCode.slice(0, r.start) + r.rep + newCode.slice(r.end);
    }

    if (!hasImport) {
        let lastImportEnd = 0;
        traverse(ast, {
            ImportDeclaration(p) {
                if (p.node.end > lastImportEnd) lastImportEnd = p.node.end;
            }
        });

        const importStatement = `\nimport { useTranslations } from 'next-intl';`;
        if (lastImportEnd > 0) {
            newCode = newCode.slice(0, lastImportEnd) + importStatement + newCode.slice(lastImportEnd);
        } else {
            newCode = importStatement + '\n' + newCode;
        }
    }

    if (!existingTHookName) {
        let hookInjectionPosition = -1;

        let ast2;
        try {
            ast2 = parser.parse(newCode, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
            traverse(ast2, {
                ExportDefaultDeclaration(p) {
                    const decl = p.node.declaration;
                    if (decl.type === 'FunctionDeclaration' && decl.body.type === 'BlockStatement') {
                        hookInjectionPosition = decl.body.body[0] ? decl.body.body[0].start : decl.body.start + 1;
                    } else if (decl.type === 'Identifier') {
                        const binding = p.scope.getBinding(decl.name);
                        if (binding && binding.path.node.type === 'FunctionDeclaration' && binding.path.node.body && binding.path.node.body.type === 'BlockStatement') {
                            const bbody = binding.path.node.body;
                            hookInjectionPosition = bbody.body[0] ? bbody.body[0].start : bbody.start + 1;
                        } else if (binding && binding.path.node.type === 'VariableDeclarator' && binding.path.node.init && binding.path.node.init.type === 'ArrowFunctionExpression' && binding.path.node.init.body.type === 'BlockStatement') {
                            const bbody = binding.path.node.init.body;
                            hookInjectionPosition = bbody.body[0] ? bbody.body[0].start : bbody.start + 1;
                        }
                    }
                }
            });
        } catch (e) {
        }

        if (hookInjectionPosition !== -1) {
            const hookStmt = `\n  const t = useTranslations('${ns}');\n`;
            newCode = newCode.slice(0, hookInjectionPosition) + hookStmt + newCode.slice(hookInjectionPosition);
        } else {
            console.warn(`Could not automatically inject hook in ${filePath}`);
        }
    }

    fs.writeFileSync(filePath, newCode);
    console.log(`Refactored ${filePath}`);
}

for (const filePath of Object.keys(fileMap)) {
    processFile(filePath, fileMap[filePath]);
}

console.log("Phase 3 AST Refactoring Completed (using string injection)!");
