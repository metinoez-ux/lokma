const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else if (filePath.endsWith('.dart')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const targetDirs = [
    path.join(__dirname, 'lib/screens'),
    path.join(__dirname, 'lib/widgets')
];

let dartFiles = [];
targetDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        dartFiles = dartFiles.concat(walk(dir));
    }
});

const fileStats = [];

dartFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const blackCount = (content.match(/Colors\.black/g) || []).length;
    const whiteCount = (content.match(/Colors\.white/g) || []).length;

    if (blackCount > 0 || whiteCount > 0) {
        fileStats.push({
            file: file.replace(__dirname + '/', ''),
            black: blackCount,
            white: whiteCount,
            total: blackCount + whiteCount
        });
    }
});

fileStats.sort((a, b) => b.total - a.total);

console.log('Top 20 files with hardcoded Colors (potential Dark Mode issues):');
fileStats.slice(0, 20).forEach(stats => {
    console.log(`${stats.file} - Total: ${stats.total} (Black: ${stats.black}, White: ${stats.white})`);
});
