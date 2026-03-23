const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'src', 'app', '[locale]', 'admin');
const componentsDir = path.join(__dirname, 'src', 'components', 'admin');

const replaceRules = [
    // Backgrounds
    { regex: /\bbg-slate-900\b/g, replacement: 'bg-background' },
    { regex: /\bbg-gray-900\b/g, replacement: 'bg-background' },
    { regex: /\bbg-slate-800\b/g, replacement: 'bg-card' },
    { regex: /\bbg-gray-800\b/g, replacement: 'bg-card' },
    
    // Borders
    { regex: /\bborder-slate-800\b/g, replacement: 'border-border' },
    { regex: /\bborder-gray-800\b/g, replacement: 'border-border' },
    { regex: /\bborder-slate-700\b/g, replacement: 'border-border' },
    { regex: /\bborder-gray-700\b/g, replacement: 'border-border' },
    { regex: /\bdivide-slate-800\b/g, replacement: 'divide-border' },
    { regex: /\bdivide-gray-800\b/g, replacement: 'divide-border' },
    { regex: /\bdivide-slate-700\b/g, replacement: 'divide-border' },
    { regex: /\bdivide-gray-700\b/g, replacement: 'divide-border' },

    // Text overrides (be very careful with text-white, mostly we can leave it to the body default or replace certain gray text)
    { regex: /\btext-gray-300\b/g, replacement: 'text-foreground' },
    { regex: /\btext-slate-300\b/g, replacement: 'text-foreground' },
    { regex: /\btext-gray-400\b/g, replacement: 'text-muted-foreground' },
    { regex: /\btext-slate-400\b/g, replacement: 'text-muted-foreground' }
];

let filesModified = 0;
let replacementsMade = 0;

function walkDir(currentDirPath) {
    if (!fs.existsSync(currentDirPath)) return;
    const items = fs.readdirSync(currentDirPath);
    
    for (const item of items) {
        const fullPath = path.join(currentDirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (stat.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;
            
            for (const rule of replaceRules) {
                const matches = content.match(rule.regex);
                if (matches) {
                    replacementsMade += matches.length;
                    content = content.replace(rule.regex, rule.replacement);
                }
            }
            
            // For text-white, we only replace it if it's NOT near a colored background
            // E.g. we want to keep "bg-red-600 text-white". We can do a simpler replace ONLY if it's typical layout text:
            // This is risky, so we will skip text-white and rely on body default text-foreground where bg is changed.
            
            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                filesModified++;
            }
        }
    }
}

console.log("Starting theme refactor sweep...");
walkDir(targetDir);
walkDir(componentsDir);

console.log(`Sweep completed. Modified ${filesModified} files with ${replacementsMade} total replacements.`);
