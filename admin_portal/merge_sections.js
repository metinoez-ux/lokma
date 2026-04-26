const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

// The block to extract
const limitsStartStr = "{/* 2. Limits & Rules */}";
const limitsEndStr = "            </div>\n          </div>\n\n        </div>\n      </div>";
const startIdx = content.indexOf(limitsStartStr);
const endIdx = content.indexOf(limitsEndStr, startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find limits block");
    process.exit(1);
}

// Full block including the wrapper
// Let's actually extract from `<h3` to the end of `</div>` that closes the grid.
const h3Start = content.indexOf('<h3', startIdx);
const gridStart = content.indexOf('<div className="grid grid-cols-2 gap-4">', h3Start);
const gridEnd = content.indexOf('</div>\n          </div>\n\n        </div>\n      </div>', gridStart) + '</div>\n          </div>'.length; // Wait, we just need to get up to `</div>\n          </div>` which closes the `grid` and `col-span-2` for order fee.

// Actually, replacing string manually is safer if we just match exactly.
const blockToMoveRegex = /\s*\{\/\* 2\. Limits & Rules \*\/\}\n\s*<div className="bg-card\/50 p-5 rounded-xl border border-border\/50">\n([\s\S]*?\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>)/;

const match = content.match(blockToMoveRegex);
if (!match) {
    console.error("Regex match failed");
    process.exit(1);
}

const fullBlock = match[0];
let innerContent = match[1];

// Remove the outermost </div>
innerContent = innerContent.replace(/\s*<\/div>$/, '');

// Remove the full block from the left column
content = content.replace(fullBlock, '');

// Now we need to insert it into the right column
// Find `{/* 3. Features Grid */}`
// And the closing of its grid: `))} \n            </div>`
const featuresGridEndStr = "  </label>\n              ))}\n            </div>";
const featuresEndIdx = content.indexOf(featuresGridEndStr);

if (featuresEndIdx === -1) {
    console.error("Could not find features grid end");
    process.exit(1);
}

const insertPos = featuresEndIdx + featuresGridEndStr.length;

// Modify the innerContent to add some spacing and margin
// The h3 inside innerContent needs `mt-8 pt-6 border-t border-border`
innerContent = innerContent.replace('<h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">', '<h3 className="text-foreground font-semibold mb-4 mt-8 pt-6 border-t border-border flex items-center gap-2">');

content = content.slice(0, insertPos) + "\n\n          " + innerContent + content.slice(insertPos);

// Also remove `h-full` from Features Grid
content = content.replace('<div className="bg-card/50 p-6 rounded-xl border border-border/50 h-full">', '<div className="bg-card/50 p-6 rounded-xl border border-border/50">');
// Change 3. Features Grid to 3. Features & Limits
content = content.replace('{/* 3. Features Grid */}', '{/* 3. Features & Limits */}');

fs.writeFileSync(file, content, 'utf-8');
console.log("Successfully merged limits into features.");
