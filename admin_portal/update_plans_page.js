const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

// 1. Extract Limits & Rules content
const limitsStartStr = "        {/* 2. Limits & Rules */}\n        <div className=\"bg-card/50 p-5 rounded-xl border border-border/50\">\n";
const limitsEndStr = "            </div>\n          </div>\n\n        </div>\n      </div>"; // actually wait, the end of the wrapper is just "</div>\n      </div>" or something similar. Let me be more precise.

// Let's use regex to find the block
const limitsMatch = content.match(/\{\/\* 2\. Limits & Rules \*\/\}\n\s*<div className="bg-card\/50 p-5 rounded-xl border border-border\/50">([\s\S]*?)\n\s*<\/div>\n\s*<\/div>\n\s*\{\/\* 3\. Personel & Vardiya Yönetimi \*\/\}/);
if (!limitsMatch) {
  console.log("Could not find Limits & Rules block");
  process.exit(1);
}

// The inner content of limits & rules. It ends with a </div> which closes the wrapper.
// Let's refine the regex:
const fullLimitsBlock = content.match(/(\s*\{\/\* 2\. Limits & Rules \*\/\}\n\s*<div className="bg-card\/50 p-5 rounded-xl border border-border\/50">\n)([\s\S]*?)(\n\s*<\/div>\n\s*<\/div>\n\s*\{\/\* 3\. Personel & Vardiya Yönetimi \*\/\})/);

if (!fullLimitsBlock) {
  console.log("Could not find exact boundaries for Limits & Rules");
  process.exit(1);
}

// Extracted inner content, minus the last closing </div> that belongs to the wrapper
// Wait, the inner structure:
// <div className="grid grid-cols-2 gap-4"> ... </div> (This closes the grid)
// Then there is a closing </div> for the wrapper.
// So let's extract everything from the `<h3` to the end of the `grid`.

const innerContentMatch = fullLimitsBlock[2]; // Everything inside the wrapper

// Now we remove the whole Limits & Rules block from the left column
// But wait! `</div>\n      </div>` - one of those `</div>` is for the `grid`, the other for the `bg-card` wrapper.
// Actually, let's look at the structure:
/*
        {/* 2. Limits & Rules *\/}
        <div className="bg-card/50 p-5 rounded-xl border border-border/50">
          <h3 ...>
          <div className="grid grid-cols-2 gap-4">
            ...
          </div>
        </div>
*/
// Let's do a simple replace of the entire block with an empty string.
const blockToRemove = content.substring(fullLimitsBlock.index, fullLimitsBlock.index + fullLimitsBlock[0].length);
// Replace it, but keep the `Personel & Vardiya Yönetimi` comment
content = content.replace(blockToRemove, "\n      {/* 3. Personel & Vardiya Yönetimi */}");

// Wait, the inner content has `<h3` ... and `<div className="grid...` ... and ends with `</div>\n          </div>` which closes the grid, but the second `</div>` might be the wrapper. Let's look closely at the code in the file.
