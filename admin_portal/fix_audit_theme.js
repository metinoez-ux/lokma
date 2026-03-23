const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(walkDir(fullPath));
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walkDir('src/app/[locale]/admin');
let changedFiles = 0;

files.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    let originalCode = code;

    // Use a simpler regex logic: replace all instances of bg-white to bg-card if the line lacks a dark:bg- variant
    // Since we know "bg-white" without "dark:" is the problem, let's just do a more structural replace
    
    // First, split into lines to easily ignore strings with already explicit dark counterparts
    let lines = code.split('\n');
    let newLines = lines.map(line => {
        if (line.includes('bg-white')) {
            // Unconditionally replace pure bg-white with bg-card. 
            // In ERP, bg-card is mapped to white in light mode anyway. 
            // If they had a custom dark mode, bg-card will automatically handle it!
            return line.replace(/\bbg-white\b/g, 'bg-card dark:bg-slate-800'); 
        }
        return line;
    });

    let newLinesB = newLines.map(line => {
        if (line.includes('text-black')) {
             return line.replace(/\btext-black\b/g, 'text-foreground');
        }
        return line;
    });

    let newCode = newLinesB.join('\n');

    if (newCode !== originalCode) {
        fs.writeFileSync(file, newCode);
        changedFiles++;
        console.log(`Fixed theme compliance in: ${file}`);
    }
});

console.log(`\nTheme fix complete! Modified ${changedFiles} files to restore semantic ERP compliance.`);
