import fs from 'fs';
import { parse } from '@babel/parser';

const file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx';
const code = fs.readFileSync(file_path, 'utf8');

try {
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log("SUCCESS!");
} catch (error) {
  console.error("Parse Error:");
  console.error(error.message);
}
