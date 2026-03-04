const fs = require('fs');
const path = require('path');

const files = [
    'src/app/[locale]/kurye/page.tsx',
    'src/app/[locale]/partner/page.tsx',
    'src/app/[locale]/impressum/page.tsx',
    'src/app/[locale]/datenschutz/page.tsx',
    'src/app/[locale]/agb/page.tsx',
    'src/app/[locale]/widerruf/page.tsx'
];

files.forEach(f => {
    const fullPath = path.join('/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal', f);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        // Fix double headers
        content = content.replace(/<PublicHeader themeAware=\{true\} \/>\s*<PublicHeader themeAware=\{true\} \/>/g, '<PublicHeader themeAware={true} />');
        
        // Fix string duplicates
        content = content.replace(/bg-white dark:bg-white dark:bg-\[#120a0a\]/g, 'bg-white dark:bg-[#120a0a]');
        content = content.replace(/bg-gray-50 dark:bg-gray-50 dark:bg-white\/\[0\.02\]/g, 'bg-gray-50 dark:bg-white/[0.02]');
        content = content.replace(/bg-white dark:bg-white dark:bg-\[#120a0a\]/g, 'bg-white dark:bg-[#120a0a]');
        content = content.replace(/text-gray-900 dark:text-gray-900 dark:text-white/g, 'text-gray-900 dark:text-white');
        content = content.replace(/text-gray-900 dark:text-gray-600 dark:text-gray-900 dark:text-gray-600 dark:text-white\/70/g, 'text-gray-600 dark:text-white/70');
        content = content.replace(/text-gray-900 dark:text-gray-500 dark:text-gray-900 dark:text-gray-500 dark:text-white\/60/g, 'text-gray-500 dark:text-white/60');
        content = content.replace(/border-gray-200 dark:border-gray-200 dark:border-white\/5/g, 'border-gray-200 dark:border-white/5');
        content = content.replace(/bg-gray-100 dark:bg-gray-100 dark:bg-black\/40/g, 'bg-gray-100 dark:bg-black/40');
        content = content.replace(/text-gray-900 dark:text-gray-700 dark:text-gray-900 dark:text-gray-700 dark:text-white\/80/g, 'text-gray-700 dark:text-white/80');
        content = content.replace(/border-gray-200 dark:border-gray-200 dark:border-white\/10/g, 'border-gray-200 dark:border-white/10');
        content = content.replace(/text-gray-900 dark:text-gray-400 dark:text-gray-900 dark:text-gray-400 dark:text-white\/40/g, 'text-gray-400 dark:text-white/40');
        content = content.replace(/bg-gray-100 dark:bg-gray-100 dark:bg-white\/5/g, 'bg-gray-100 dark:bg-white/5');
        content = content.replace(/border-gray-300 dark:border-gray-300 dark:border-white\/20/g, 'border-gray-300 dark:border-white/20');

        fs.writeFileSync(fullPath, content);
    }
});
