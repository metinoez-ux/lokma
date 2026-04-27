const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

function extractBlock(startIndex) {
    let braceDepth = 0;
    let startFound = false;
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
            startFound = true;
            braceDepth++;
        } else if (content[i] === '}') {
            braceDepth--;
            if (startFound && braceDepth === 0) {
                return {
                    start: startIndex,
                    end: i + 1,
                    text: content.substring(startIndex, i + 1)
                };
            }
        }
    }
    return null;
}

const settingsMatch = content.match(/\{\s*activeTab === "settings" && \(/);
if (!settingsMatch) { console.log('not found'); process.exit(0); }
const settingsBlock = extractBlock(settingsMatch.index);
console.log("LAST 50 CHARS OF SETTINGS BLOCK:");
console.log(settingsBlock.text.substring(settingsBlock.text.length - 50));
