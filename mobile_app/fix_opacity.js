const fs = require('fs');
const path = require('path');

function replaceOpacity(dirPath) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceOpacity(fullPath);
        } else if (fullPath.endsWith('.dart')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // Regex to match .withOpacity(value)
            // It captures the value inside the parentheses
            const regex = /\.withOpacity\(([^)]+)\)/g;
            
            if (regex.test(content)) {
                console.log(`Updating ${fullPath}`);
                content = content.replace(regex, '.withValues(alpha: $1)');
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}

replaceOpacity('./lib');
console.log('Opacity replacement complete.');
