const fs = require('fs');
const file = 'admin_portal/src/lib/firebase-admin.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const realNewlinesSanitized = serviceAccount\.replace\(\/\\\\n\/g, '\\\\\\\\n'\);/g;
content = content.replace(regex, "const realNewlinesSanitized = serviceAccount.replace(/\\n/g, '\\\\n');");

fs.writeFileSync(file, content);
console.log('Fixed fix_newlines.js');
