const fs = require('fs');
const file = 'src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /if\s*\(\s*data\.subscriptionPlan\s*===\s*"free"\s*\)\s*\{\s*data\.subscriptionPlan\s*=\s*"eat_free";\s*\}/g;

const replacementStr = `const rawPlan = (data.subscriptionPlan || "").toLowerCase().trim();
  if (rawPlan === "free" || rawPlan === "lokma free") {
    data.subscriptionPlan = "eat_free";
  }`;

if (regex.test(content)) {
  content = content.replace(regex, replacementStr);
  fs.writeFileSync(file, content);
  console.log("Patched successfully!");
} else {
  console.log("Could not find target string.");
}
