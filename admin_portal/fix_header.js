const fs = require('fs');
const file = 'src/components/admin/AdminHeader.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace the main wrappers
code = code.replace(/bg-\[#0c1527\]/g, 'bg-[var(--header-bg)]');
code = code.replace(/border-\[#1f3053\]/g, 'border-[var(--header-border)]');

// Replace the internal nav item highlight states to be universally transparent against dark header backgrounds
code = code.replace(/bg-\[#15223e\]/g, 'bg-white/10');

fs.writeFileSync(file, code);
