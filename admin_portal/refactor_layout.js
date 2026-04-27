const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');
let lines = content.split('\n');

// Verify line contents
if (!lines[2859].includes('activeTab === "overview"')) { console.log('Line 2860 is not overview!'); process.exit(1); }
if (!lines[3727].includes('activeTab === "orders"')) { console.log('Line 3728 is not orders!'); process.exit(1); }
if (!lines[3765].includes('activeTab === "settings"')) { console.log('Line 3766 is not settings!'); process.exit(1); }
if (!lines[3811].includes('Right Content Pane')) { console.log('Line 3812 is not right content pane!'); process.exit(1); }
// Find the end of settingsSubTab header
let headerEndLine = -1;
for (let i = 3816; i < 3900; i++) {
    if (lines[i].includes('</div>')) {
        // We found the end of the <div className="flex justify-between items-center mb-6">
        // Wait, line 3823 is </h3>
        if (i > 3823) {
            headerEndLine = i;
            break;
        }
    }
}
// Actually, let's just find the first </div> after </h3>
let h3Found = false;
let divsToClose = 1; // from flex justify-between
for (let i = 3814; i < 3900; i++) {
    if (lines[i].includes('<h3')) h3Found = true;
    if (h3Found && lines[i].includes('</h3>')) h3Found = false;
    
    if (lines[i].includes('<div') && !h3Found) divsToClose++;
    if (lines[i].includes('</div') && !h3Found) divsToClose--;
    
    if (divsToClose === 0) {
        headerEndLine = i;
        break;
    }
}

console.log('Header End Line: ', headerEndLine);

// Overview lines: 2859 to 3724
let overviewChunk = lines.slice(2859, 3725);
overviewChunk[0] = overviewChunk[0].replace('activeTab === "overview"', 'settingsSubTab === "dashboard"');

// Orders lines: 3726 to 3762
let ordersChunk = lines.slice(3726, 3763);
ordersChunk[1] = ordersChunk[1].replace('activeTab === "orders"', 'settingsSubTab === "siparisler"');

// The new file structure:
// lines 0 to 2858
// lines 3766 to headerEndLine (but remove `activeTab === "settings" && (`)
// overviewChunk
// ordersChunk
// lines headerEndLine+1 to end

let layoutStartChunk = lines.slice(3766, headerEndLine + 1);
// layoutStartChunk[0] is `{ activeTab === "settings" && (` - we replace this with nothing, or just remove it
layoutStartChunk[0] = ''; // Remove the `{ activeTab === "settings" && (`

let newLines = [
    ...lines.slice(0, 2859),
    ...layoutStartChunk,
    ...overviewChunk,
    ...ordersChunk,
    ...lines.slice(headerEndLine + 1)
];

// We need to remove the closing `)}` for `activeTab === "settings" && (` which is at the end of the file.
// Search backwards from end of newLines for `)}`
for (let i = newLines.length - 1; i >= 0; i--) {
    if (newLines[i].includes(')}')) {
        newLines[i] = newLines[i].replace(')}', '');
        break;
    }
}

fs.writeFileSync(file, newLines.join('\n'), 'utf8');
console.log('Layout refactored.');
