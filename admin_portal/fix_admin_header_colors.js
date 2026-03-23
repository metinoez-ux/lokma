const fs = require('fs');
const file = 'src/components/admin/AdminHeader.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Replace the deep red gradient with a deep blue one
txt = txt.replace(/from-red-800 via-rose-700 to-red-800 border-red-900/g, 'from-blue-900 via-indigo-800 to-blue-900 border-blue-950');

// Replace text-red-100 and text-red-200 with blue variants
txt = txt.replace(/text-red-100/g, 'text-blue-100');
txt = txt.replace(/text-red-200/g, 'text-blue-200');

// Replace hover:bg-red-900/40 with hover:bg-red-900/40 (logout button should stay red? The user only complained about the header theme) Yes, keep logout red, but header text was red.
// Actually there are bg-red-800, text-red-100 loops.
fs.writeFileSync(file, txt);
console.log('Fixed AdminHeader colors');
