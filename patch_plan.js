const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `  if (data.subscriptionPlan === "free") {
    data.subscriptionPlan = "eat_free";
  }`;

const replacementStr = `  const rawPlan = (data.subscriptionPlan || "").toLowerCase().trim();
  if (rawPlan === "free" || rawPlan === "lokma free") {
    data.subscriptionPlan = "eat_free";
  }`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(file, content);
  console.log("Patched successfully!");
} else {
  console.log("Could not find target string.");
}
