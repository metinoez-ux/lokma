const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const tBabel = require('@babel/types');

const files = [
    'src/app/[locale]/admin/commissions/page.tsx',
    'src/app/[locale]/admin/delivery-settings/page.tsx',
    'src/app/[locale]/admin/invoices/page.tsx',
    'src/app/[locale]/admin/sectors/page.tsx',
    'src/app/[locale]/admin/settings/kermes-features/page.tsx',
    'src/app/[locale]/admin/settings/kermes-stock-images/page.tsx',
    'src/app/[locale]/admin/table-orders/page.tsx'
];

files.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
    });

    const nodesToMove = [];
    const nodeNames = []; // Keep track of moved variable names

    traverse(ast, {
        VariableDeclaration(path) {
            if (path.parent.type === 'Program') {
                // Check if this declaration contains a call to `t`
                let hasTCall = false;
                path.traverse({
                    CallExpression(innerPath) {
                        if (innerPath.node.callee.name === 't') {
                            hasTCall = true;
                        }
                    }
                });

                if (hasTCall) {
                    nodesToMove.push(path.node);
                    nodeNames.push(path.node.declarations[0].id.name);
                    path.remove();
                }
            }
        }
    });

    if (nodesToMove.length > 0) {
        let inserted = false;
        traverse(ast, {
            ExportDefaultDeclaration(path) {
                const declaration = path.node.declaration;
                if (declaration.type === 'FunctionDeclaration' ||
                    (declaration.type === 'CallExpression' && declaration.arguments[0].type === 'FunctionExpression')) {

                    const funcBody = declaration.type === 'FunctionDeclaration' ? declaration.body.body : declaration.arguments[0].body.body;

                    // Insert node right after the `const t = useTranslations(...)`
                    let insertIndex = 0;
                    for (let i = 0; i < funcBody.length; i++) {
                        if (funcBody[i].type === 'VariableDeclaration' && funcBody[i].declarations[0].id.name === 't') {
                            insertIndex = i + 1;
                            break;
                        }
                    }

                    // Insert backwards to preserve order
                    for (let i = nodesToMove.length - 1; i >= 0; i--) {
                        funcBody.splice(insertIndex, 0, nodesToMove[i]);
                    }
                    inserted = true;
                }
            }
        });

        // Backup plan for non-default exports like page components in next.js
        if (!inserted) {
            traverse(ast, {
                FunctionDeclaration(path) {
                    if (!inserted && path.node.id && /Page|Dashboard|Admin|Component|App/.test(path.node.id.name)) {
                        const funcBody = path.node.body.body;
                        let insertIndex = 0;
                        for (let i = 0; i < funcBody.length; i++) {
                            if (funcBody[i].type === 'VariableDeclaration' && funcBody[i].declarations[0].id.name === 't') {
                                insertIndex = i + 1;
                                break;
                            }
                        }
                        for (let i = nodesToMove.length - 1; i >= 0; i--) {
                            funcBody.splice(insertIndex, 0, nodesToMove[i]);
                        }
                        inserted = true;
                    }
                }
            });
        }

        const output = generate(ast, { retainLines: false, retainFunctionParens: true }, code);
        fs.writeFileSync(file, output.code, 'utf8');
        console.log(`Moved out-of-scope variables [${nodeNames.join(', ')}] in ${file}`);
    }
});
