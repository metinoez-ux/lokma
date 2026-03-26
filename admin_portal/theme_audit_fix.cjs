const fs = require('fs');

const uiFiles = [
  '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx',
  '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/admin/OrderCard.tsx'
];

const replacements = [
  // Backgrounds: Ensure bg-white is replaced with semantic bg-card globally
  { search: /(?<!dark:)\bbg-white\b/g, replace: 'bg-card dark:bg-card' },
  { search: /(?<!dark:)\bbg-gray-50\b/g, replace: 'bg-muted/50 dark:bg-muted' },
  { search: /(?<!dark:)\bbg-gray-100\b/g, replace: 'bg-muted dark:bg-muted/80' },
  
  // Texts: Shift specific grays to UI standard foregrounds
  { search: /(?<!dark:)\btext-gray-900\b/g, replace: 'text-foreground' },
  { search: /(?<!dark:)\btext-gray-800\b/g, replace: 'text-foreground' },
  { search: /(?<!dark:)\btext-gray-700\b/g, replace: 'text-muted-foreground' },
  { search: /(?<!dark:)\btext-gray-600\b/g, replace: 'text-muted-foreground' },
  { search: /(?<!dark:)\btext-gray-500\b/g, replace: 'text-muted-foreground' },
  
  // Borders: Enforce layout element border visibility in dark mode
  { search: /(?<!dark:)\bborder-gray-200\b/g, replace: 'border-border' },
  { search: /(?<!dark:)\bborder-gray-300\b/g, replace: 'border-border' },
  { search: /(?<!dark:)\bborder-gray-100\b/g, replace: 'border-border' },
  { search: /(?<!dark:)\bdivide-gray-200\b/g, replace: 'divide-border' },

  // Hovers
  { search: /(?<!dark:)\bhover:bg-gray-50\b/g, replace: 'hover:bg-accent hover:text-accent-foreground' },
  { search: /(?<!dark:)\bhover:text-gray-900\b/g, replace: 'hover:text-foreground' },
  { search: /(?<!dark:)\bhover:text-gray-700\b/g, replace: 'hover:text-foreground' },
  
  // Focus Rings
  { search: /(?<!dark:)\bfocus:ring-blue-500\b/g, replace: 'focus:ring-ring focus:ring-offset-2 dark:focus:ring-offset-background' },
];

for (const filePath of uiFiles) {
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let totalReplaced = 0;

  replacements.forEach(({ search, replace }) => {
    const matches = content.match(search);
    if (matches) {
      totalReplaced += matches.length;
      content = content.replace(search, replace);
    }
  });

  if (totalReplaced > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[${filePath.split('/').pop()}] Replaced ${totalReplaced} non-semantic color classes with theme-aware tokens.`);
  } else {
    console.log(`[${filePath.split('/').pop()}] Already theme-aware. Zero changes.`);
  }
}
