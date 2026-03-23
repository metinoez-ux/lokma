const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
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

const targetDir = 'src/app/[locale]/admin';
if (!fs.existsSync(targetDir)) return;
const files = walkDir(targetDir);

files.forEach(file => {
    let original = fs.readFileSync(file, 'utf8');
    let code = original;
    
    // Exact strict matches that broke due to 'text-foreground' replacement
    code = code.replace(/bg-gray-700 text-foreground hover:bg-gray-600/g, 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600');
    code = code.replace(/bg-gray-700 hover:bg-gray-600 text-foreground/g, 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100');
    code = code.replace(/bg-gray-700 border border-gray-600 text-foreground/g, 'bg-gray-200 border border-gray-300 text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100');
    
    // Broader fallback matches
    code = code.replace(/bg-gray-700 text-foreground/g, 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100');
    code = code.replace(/bg-slate-700 text-foreground/g, 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100');
    code = code.replace(/bg-gray-800 text-foreground/g, 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-100');
    code = code.replace(/bg-slate-800 text-foreground/g, 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100');
    code = code.replace(/bg-gray-900 text-foreground/g, 'bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-100');
    
    // For pagination (which might just have text-xs bg-gray-700)
    code = code.replace(/bg-gray-700 hover:bg-gray-600 transition/g, 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition');

    // And also for Table Headers: 'text-gray-400' became unreadable, or 'bg-gray-800' became weird
    // Standard table head in light mode is usually bg-gray-100 text-gray-600
    code = code.replace(/bg-gray-800 text-gray-400/g, 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400');
    code = code.replace(/bg-gray-900 text-left text-xs/g, 'bg-gray-200 dark:bg-gray-900 text-left text-xs text-gray-700 dark:text-gray-300');
    code = code.replace(/bg-gray-800 sticky text-gray-400/g, 'bg-gray-200 dark:bg-gray-800 sticky text-gray-700 dark:text-gray-400');

    if (code !== original) {
        fs.writeFileSync(file, code);
    }
});

console.log('Fixed component contrast patches script executed');
