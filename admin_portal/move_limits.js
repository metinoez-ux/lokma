const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

const limitsStart = content.indexOf('{/* 2. Limits & Rules */}');
const limitWrapperEnd = content.indexOf('</div>\n          </div>\n\n        </div>\n      </div>'); 
// Wait, I can just use a regex to extract from `{/* 2. Limits & Rules */}` until `{/* 3. Personel & Vardiya Yönetimi */}`
const limitsRegex = /\s*\{\/\* 2\. Limits & Rules \*\/\}\n\s*<div className="bg-card\/50 p-5 rounded-xl border border-border\/50">\n([\s\S]*?)(\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>)?\s*\{\/\* 3\. Personel & Vardiya Yönetimi \*\/\}/;

const match = content.match(limitsRegex);
if (!match) {
    console.log("Could not find limits block");
    process.exit(1);
}

// Find the last </div> before {/* 3. Personel & Vardiya Yönetimi */}
const blockStr = match[0];
let innerContent = blockStr;

// Remove wrapper start
innerContent = innerContent.replace(/\s*\{\/\* 2\. Limits & Rules \*\/\}\n\s*<div className="bg-card\/50 p-5 rounded-xl border border-border\/50">\n/, '');

// Remove wrapper end and Personel comment
innerContent = innerContent.replace(/\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*\{\/\* 3\. Personel & Vardiya Yönetimi \*\/\}/, '');
// Wait, the end of the wrapper is just two </div> tags:
// </div> // ends perOrderFeeType div
// </div> // ends col-span-2
// </div> // ends grid
// </div> // ends wrapper

// A safer way is to just use string matching:
let p1 = content.indexOf('{/* 2. Limits & Rules */}');
// find the line before p1
p1 = content.lastIndexOf('\n', p1);
let p2 = content.indexOf('{/* 3. Personel & Vardiya Yönetimi */}');
p2 = content.lastIndexOf('\n', p2);

let block = content.substring(p1, p2);

content = content.substring(0, p1) + '\n\n' + content.substring(p2);

// Now process block to get inner
// Remove `        {/* 2. Limits & Rules */}`
// Remove `        <div className="bg-card/50 p-5 rounded-xl border border-border/50">`
let inner = block.replace(/\s*\{\/\* 2\. Limits & Rules \*\/\}\n\s*<div className="bg-card\/50 p-5 rounded-xl border border-border\/50">\n/, '');

// Remove the last `</div>`
inner = inner.replace(/\s*<\/div>\n\s*$/, '');

// Change the h3
inner = inner.replace('<h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">', '<h3 className="text-foreground font-semibold mb-6 mt-8 pt-6 border-t border-border flex items-center gap-2">');

// Now find where to insert it. We insert it right after the Features grid mapping ends.
const featuresGridEnd = '  </label>\n              ))}\n            </div>';
let insertIdx = content.indexOf(featuresGridEnd);
if (insertIdx === -1) {
    console.log("Could not find features grid end");
    process.exit(1);
}
insertIdx += featuresGridEnd.length;

content = content.substring(0, insertIdx) + '\n\n          {/* Limits & Rules moved here */}\n' + inner + content.substring(insertIdx);

// Change the right column wrapper to not have h-full if it has it
content = content.replace('<div className="bg-card/50 p-6 rounded-xl border border-border/50 h-full">', '<div className="bg-card/50 p-6 rounded-xl border border-border/50">');
content = content.replace('{/* 3. Features Grid */}', '{/* 3. Features & Limits */}');

fs.writeFileSync(file, content, 'utf-8');
console.log("Success");
