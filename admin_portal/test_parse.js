const parser = require('@babel/parser');
const fs = require('fs');

try {
  const code = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx', 'utf8');
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log('Parse successful!');
} catch (e) {
  console.log('Parse failed:', e.message);
}
