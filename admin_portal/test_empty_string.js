// simple test to ensure no syntax errors introduced
const fs = require('fs');
const code = fs.readFileSync('src/app/[locale]/admin/plans/page.tsx', 'utf8');
try {
  require('child_process').execSync('npx eslint src/app/[locale]/admin/plans/page.tsx');
  console.log('No lint errors');
} catch(e) {
  console.log('Lint failed', e.stdout ? e.stdout.toString() : '');
}
