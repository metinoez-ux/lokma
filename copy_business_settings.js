const fs = require('fs');
const lines = fs.readFileSync('admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'utf8').split('\n');

const imports = lines.slice(0, 100).join('\n'); // roughly
const formDataStart = lines.findIndex(l => l.includes('const [formData, setFormData] = useState({'));
const formDataEnd = lines.findIndex((l, i) => i > formDataStart && l.includes('});'));

console.log("Found formData", formDataStart, formDataEnd);
