const fs = require('fs');

const targetFile = 'src/app/[locale]/admin/business/[id]/HardwareTabContent.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

// Remove the Unsplash placeholders and the second copy
content = content.replace(/,\s*"https:\/\/images.unsplash.com[^"]+"/g, '');

fs.writeFileSync(targetFile, content, 'utf8');
console.log("Unsplash generic images removed.");
