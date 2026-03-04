const fs = require('fs');
const path = require('path');

// 1. Remove imports from globals.css
const globalsCssPath = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/src/app/globals.css';
let css = fs.readFileSync(globalsCssPath, 'utf8');
css = css.replace(/@import url\('https:\/\/fonts.googleapis.com\/css2\?family=Material\+Symbols\+Outlined:[\s\S]*?\n/g, '');
css = css.replace(/@import url\('https:\/\/fonts.googleapis.com\/css2\?family=Plus\+Jakarta\+Sans:[\s\S]*?\n/g, '');
fs.writeFileSync(globalsCssPath, css);

// 2. Add proper links to layout.tsx
const layoutPath = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/src/app/[locale]/layout.tsx';
let layoutStr = fs.readFileSync(layoutPath, 'utf8');

const headLinks = `        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />`;

layoutStr = layoutStr.replace(/<body[^>]*>/, (match) => {
    return `      <head>\n${headLinks}\n      </head>\n${match}`;
});

fs.writeFileSync(layoutPath, layoutStr);
console.log('Fonts fixed!');
