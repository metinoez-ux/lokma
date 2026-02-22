const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('src/app/[locale]/admin/settings/page.tsx', 'utf8');
try {
    const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
    });
    console.log("Parsed OK!");
    let count = 0;
    traverse(ast, {
        JSXText(path) {
            const val = path.node.value.trim();
            if (/[çğıöşüÇĞİÖŞÜ]/.test(val)) count++;
        }
    });
    console.log("JSXText with TR:", count);
} catch (e) {
    console.error("Parse Error:", e.message);
}
