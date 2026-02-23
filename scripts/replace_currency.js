const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, '../mobile_app/lib');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    if (content.includes('€')) {
        content = content.replace(/€/g, '$${CurrencyUtils.getCurrencySymbol()}');

        // Add import if not exists
        if (!content.includes('currency_utils.dart')) {
            const depth = filePath.replace(libDir, '').split('/').length - 2;
            let relativePrefix = depth <= 0 ? './' : '../'.repeat(depth);
            if (depth < 0) relativePrefix = './'; // in lib directly
            const importStmt = `import '${relativePrefix}utils/currency_utils.dart';\n`;

            const lastImportIndex = content.lastIndexOf('import ');
            if (lastImportIndex !== -1) {
                const endOfLine = content.indexOf('\n', lastImportIndex);
                content = content.slice(0, endOfLine + 1) + importStmt + content.slice(endOfLine + 1);
            } else {
                content = importStmt + content;
            }
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverse(fullPath);
        } else if (file.endsWith('.dart')) {
            processFile(fullPath);
        }
    }
}

traverse(libDir);
console.log('Done.');
