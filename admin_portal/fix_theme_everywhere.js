const fs = require('fs');
const path = require('path');

const targetFiles = [
    'src/app/[locale]/page.tsx',
    'src/app/[locale]/kurye/page.tsx',
    'src/app/[locale]/partner/page.tsx',
    'src/app/[locale]/impressum/page.tsx',
    'src/app/[locale]/datenschutz/page.tsx',
    'src/app/[locale]/agb/page.tsx',
    'src/app/[locale]/widerruf/page.tsx'
];

targetFiles.forEach(f => {
    const fullPath = path.join('/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal', f);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');

    // 1. First, make sure PublicHeader and PublicFooter are themeAware=true
    content = content.replace(/<PublicHeader \/>/g, '<PublicHeader themeAware={true} />');
    content = content.replace(/<PublicHeader themeAware=\{false\} \/>/g, '<PublicHeader themeAware={true} />');
    content = content.replace(/<PublicFooter \/>/g, '<PublicFooter themeAware={true} />');
    content = content.replace(/<PublicFooter themeAware=\{false\} \/>/g, '<PublicFooter themeAware={true} />');

    // 2. Fix the global container on page.tsx (it was bg-[#120a0a] text-white)
    if (f.includes('page.tsx') && !f.includes('/')) {
        // Landing page specific fixes
        content = content.replace(/bg-\[#120a0a\] text-white font-\['Plus_Jakarta_Sans',sans-serif\]/g, 'bg-white dark:bg-[#120a0a] text-gray-900 dark:text-white font-[\'Plus_Jakarta_Sans\',sans-serif]');
        content = content.replace(/bg-\[#120a0a\] px-4/g, 'bg-white dark:bg-[#120a0a] px-4');
        content = content.replace(/text-white\/60/g, 'text-gray-500 dark:text-white/60');
        content = content.replace(/text-white\/70/g, 'text-gray-600 dark:text-white/70');
        content = content.replace(/text-white\/80/g, 'text-gray-700 dark:text-white/80');
        content = content.replace(/border-white\/10/g, 'border-gray-200 dark:border-white/10');
        content = content.replace(/border-white\/20/g, 'border-gray-300 dark:border-white/20');
        content = content.replace(/bg-white\/5/g, 'bg-gray-50 dark:bg-white/5');
        // Fix Hero text inside page.tsx
        content = content.replace(/text-white placeholder-white\/50/g, 'text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-white/50');
        // Fix gradients to not be strictly dark
        content = content.replace(/from-\[#120a0a\]\/80 via-\[#120a0a\]\/60 to-\[#120a0a\]/g, 'from-white/80 via-white/60 to-white dark:from-[#120a0a]/80 dark:via-[#120a0a]/60 dark:to-[#120a0a]');
        content = content.replace(/bg-white\/10 backdrop-blur-md/g, 'bg-white/80 dark:bg-white/10 backdrop-blur-md');
    }

    // 3. Fix hardcoded gradients on ALL pages (kurye, partner, legal)
    content = content.replace(/from-\[#120a0a\] via-transparent to-\[#120a0a\]/g, 'from-white via-transparent to-white dark:from-[#120a0a] dark:via-transparent dark:to-[#120a0a]');
    content = content.replace(/bg-gradient-to-b from-\[#120a0a\] to-\[#0a0505\]/g, 'bg-gradient-to-b from-gray-100 to-white dark:from-[#120a0a] dark:to-[#0a0505]');

    fs.writeFileSync(fullPath, content);
    console.log(`Updated theme for ${f}`);
});
