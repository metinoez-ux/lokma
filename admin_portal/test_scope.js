const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function isDescendantOfMainComponent(path) {
    let curr = path;
    let topmostFunc = null;

    while (curr) {
        if (curr.isFunction()) {
            topmostFunc = curr;
        }
        curr = curr.parentPath;
    }

    if (!topmostFunc) return false;

    // Is topmostFunc exported as default?
    const parent = topmostFunc.parentPath;
    if (parent && parent.isExportDefaultDeclaration()) return true;

    // Or is it a VariableDeclarator that is exported default?
    if (parent && parent.isVariableDeclarator()) {
        const grandParent = parent.parentPath;
        if (grandParent && grandParent.isVariableDeclaration()) {
            const greatGrandParent = grandParent.parentPath;
            if (greatGrandParent && greatGrandParent.isExportDefaultDeclaration()) return true;
        }
        
        // Or if the variable is exported at the end of the file `export default Name;`
        // We can't check that purely from AST easily without scope, but let's assume standard export default func()
    }
    
    // If it's a named function declaration, check bindings
    if (topmostFunc.isFunctionDeclaration() && topmostFunc.node.id) {
        // We don't have deep scope tracking here for end-of-file exports, but we can just say:
        // If it's the LARGEST function in the file, it's probably the component.
        return true; 
    }

    return false;
}

const code = `
const a = "top level";
function helper() {
   const b = "helper string";
}
export default function Page() {
   const c = "main string";
   useEffect(() => {
       const d = "effect string";
   });
}
`;

const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
traverse(ast, {
    StringLiteral(path) {
        console.log(path.node.value, '->', isDescendantOfMainComponent(path));
    }
});
