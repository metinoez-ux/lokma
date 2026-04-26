import fs from 'fs';

async function checkSpecsHtml() {
  const res = await fetch('https://www.sunmi.com/en/t2s/specs/');
  const html = await res.text();
  fs.writeFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/temp_specs.html', html);
  console.log("Saved to temp_specs.html");
}

checkSpecsHtml();
