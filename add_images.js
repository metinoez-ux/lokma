const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'admin_portal/src/app/[locale]/admin/business/[id]/HardwareTabContent.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace image: "url", price: ... with image: "url", images: ["url", "url", "url"], price: ...
// Only for those that don't have images: already.

content = content.replace(/image: "([^"]+)", price/g, 'image: "$1", images: ["$1", "https://www.minewtag.com/upload/goodsgallery/2024-08/66d012acb24d4.png", "$1"], price');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated images.");
