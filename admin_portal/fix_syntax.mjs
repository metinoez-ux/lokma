import fs from 'fs';

const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/HardwareTabContent.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix the image: "image: "..."", error
content = content.replace(/image:\s*"image:\s*"([^"]+)",",/g, 'image: "$1",');
content = content.replace(/image:\s*"image:\s*"([^"]+)"",/g, 'image: "$1",');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed syntax errors!');
