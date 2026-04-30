const fs = require('fs');

const pageFile = 'src/app/[locale]/admin/kermes/[id]/page.tsx';
let lines = fs.readFileSync(pageFile, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes("{/* Tab Content - Menu */}"));
const endIdx = lines.findIndex(l => l.includes("{/* ── Tab Content: Bildirimler ── */}"));

if (startIdx !== -1 && endIdx !== -1) {
    for (let i = startIdx; i < endIdx; i++) {
        lines[i] = lines[i].replace(/🍽️/g, '<span className="material-symbols-outlined text-sm">restaurant</span>');
        lines[i] = lines[i].replace(/🎪/g, '<span className="material-symbols-outlined text-3xl">storefront</span>');
        lines[i] = lines[i].replace(/📦/g, '<span className="material-symbols-outlined text-3xl">inventory_2</span>');
        lines[i] = lines[i].replace(/✨/g, '<span className="material-symbols-outlined text-3xl">star</span>');
        lines[i] = lines[i].replace(/📸/g, '<span className="material-symbols-outlined text-sm">photo_camera</span>');
        lines[i] = lines[i].replace(/💰/g, '<span className="material-symbols-outlined text-sm">payments</span>');
        lines[i] = lines[i].replace(/⚠️/g, '<span className="material-symbols-outlined text-sm">warning</span>');
    }
    fs.writeFileSync(pageFile, lines.join('\n'));
    console.log("Icons updated");
} else {
    console.log("Could not find bounds", startIdx, endIdx);
}
