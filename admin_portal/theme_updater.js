const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'src/app/[locale]/kurye/page.tsx',
    'src/app/[locale]/partner/page.tsx',
    'src/app/[locale]/impressum/page.tsx',
    'src/app/[locale]/datenschutz/page.tsx',
    'src/app/[locale]/agb/page.tsx',
    'src/app/[locale]/widerruf/page.tsx'
];

const replacements = [
    // Backgrounds
    { from: /bg-\[#120a0a\]/g, to: 'bg-white dark:bg-[#120a0a]' },
    { from: /bg-white\/\[0\.02\]/g, to: 'bg-gray-50 dark:bg-white/[0.02]' },
    { from: /bg-black\/40/g, to: 'bg-gray-100 dark:bg-black/40' },
    { from: /bg-white\/5(?!0)/g, to: 'bg-gray-100 dark:bg-white/5' },
    
    // Text colors
    { from: /text-white /g, to: 'text-gray-900 dark:text-white ' },
    { from: /text-white"/g, to: 'text-gray-900 dark:text-white"' },
    { from: /text-white\//g, to: 'text-gray-900 dark:text-white/' }, // Wait, text-white/70 needs careful handling
    
    { from: /text-white\/70/g, to: 'text-gray-600 dark:text-white/70' },
    { from: /text-white\/60/g, to: 'text-gray-500 dark:text-white/60' },
    { from: /text-white\/80/g, to: 'text-gray-700 dark:text-white/80' },
    { from: /text-white\/40/g, to: 'text-gray-400 dark:text-white/40' },
    
    // Borders
    { from: /border-white\/5(?!0)/g, to: 'border-gray-200 dark:border-white/5' },
    { from: /border-white\/10/g, to: 'border-gray-200 dark:border-white/10' },
    { from: /border-white\/20/g, to: 'border-gray-300 dark:border-white/20' }
];

filesToUpdate.forEach(file => {
    const fullPath = path.join('/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal', file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        // Add imports if not present
        if (!content.includes('PublicHeader')) {
            content = content.replace(/import Link from 'next\/link';/g, "import Link from 'next/link';\nimport PublicHeader from '@/components/ui/PublicHeader';\nimport PublicFooter from '@/components/ui/PublicFooter';");
        }
        
        // Ensure imports are injected even if Link is missing (legal pages might miss it)
        if (!content.includes('PublicHeader') && !content.includes("next/link")) {
            content = content.replace(/'use client';/g, "'use client';\n\nimport PublicHeader from '@/components/ui/PublicHeader';\nimport PublicFooter from '@/components/ui/PublicFooter';");
        }

        // Apply theme regex
        replacements.forEach(rep => {
            // Need to handle overlap. First revert generic text-white if it matched text-white/
            content = content.replace(rep.from, rep.to);
        });

        // Add Header/Footer
        // Find className="... min-h-screen ...">
        content = content.replace(/(<div className="[^"]*min-h-screen[^"]*">)/g, "$1\n            <PublicHeader themeAware={true} />");
        
        // Add Footer before last </div>
        content = content.replace(/(\n\s*)(<\/div>\n\s*\);)/g, "$1    <PublicFooter themeAware={true} />$2");

        // Clean up any double replacements (like text-gray-900 dark:text-gray-900 dark:text-white/70)
        content = content.replace(/text-gray-900 dark:text-white\/70/g, "text-gray-600 dark:text-white/70");
        content = content.replace(/text-gray-900 dark:text-white\/60/g, "text-gray-500 dark:text-white/60");
        content = content.replace(/text-gray-900 dark:text-white\/80/g, "text-gray-700 dark:text-white/80");

        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${file}`);
    } else {
        console.error(`File not found: ${file}`);
    }
});
