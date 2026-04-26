const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'admin_portal/src/app/[locale]/admin/business/[id]/HardwareTabContent.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The string I inserted was:
// images: ["$1", "https://www.minewtag.com/upload/goodsgallery/2024-08/66d012acb24d4.png", "$1"]
// We need to match this exactly and remove it.

const regex = /, images: \["([^"]+)", "https:\/\/www\.minewtag\.com\/upload\/goodsgallery\/2024-08\/66d012acb24d4\.png", "\1"\]/g;

content = content.replace(regex, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Removed hallucinated images.");
