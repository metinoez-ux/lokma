const fs = require('fs');

const uiFiles = [
  '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx',
  '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/admin/OrderCard.tsx'
];

// Look for patterns like >Some Text< or > Some Text < 
// Excluding cases where it's entirely JSX expressions like >{t('key')}<
const regex = />([^<>{}\n]+)</g;

for (const file of uiFiles) {
  const content = fs.readFileSync(file, 'utf8');
  console.log(`\n\n--- Scanning ${file.split('/').slice(-1)[0]} ---`);
  
  let match;
  let count = 0;
  while ((match = regex.exec(content)) !== null) {
    const textContext = match[1].trim();
    
    // Filter out common false positives: pure numbers, pure symbols, single generic words (maybe), 
    // empty strings, or strings that are just "&nbsp;"
    if (textContext.length > 1 && /[a-zA-Z]/.test(textContext) && !/^(&nbsp;|&amp;|[0-9%:\.\-\/ ]+)$/.test(textContext)) {
     // Check if it's already translated or just variable text 
     if (!textContext.includes('t(') && !textContext.includes('=>') && textContext !== '€' && textContext !== '...') {
         console.log(`[Line approx] Found raw text: "${textContext}"`);
         count++;
     }
    }
  }
  console.log(`Potential hardcoded strings: ${count}`);
}
