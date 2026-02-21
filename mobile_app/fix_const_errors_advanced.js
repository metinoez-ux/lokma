const fs = require('fs');
const path = require('path');

const log = fs.readFileSync('analyze_final.log', 'utf8');
const lines = log.split('\n');
const constErrors = {};

lines.forEach(line => {
    if (line.includes('error •')) {
        const parts = line.split(' • ');
        if (parts.length >= 3) {
            const message = parts[1];
            const fileLocation = parts[2].trim();
            const splitLoc = fileLocation.split(':');
            const filePath = splitLoc[0];
            const lineNum = parseInt(splitLoc[1], 10);

            if (message.includes("Methods can't be invoked in constant expressions")) {
                if (!constErrors[filePath]) constErrors[filePath] = [];
                constErrors[filePath].push(lineNum);
            }
        }
    }
});

for (const file of Object.keys(constErrors)) {
    if (!fs.existsSync(file)) continue;
    let linesArr = fs.readFileSync(file, 'utf8').split('\n');
    const errLines = [...new Set(constErrors[file])]; // deduplicate

    for (const errorLine of errLines) {
        let start = errorLine - 1;
        let found = false;

        // Search backwards up to 30 lines
        for (let i = start; i >= Math.max(0, start - 30); i--) {
            // we want to find the first "const" before this.
            // A safer regex: if it says `const SnackBar`, `const Text`, `const []`, `const Icon`...? No, the error is specifically that a method (Theme.of) is evaluated in a const context.
            // Search for word `const ` or `const\n`
            const lineStr = linesArr[i];
            const constMatch = lineStr.match(/\bconst\b/);
            if (constMatch) {
                // Remove the FIRST occurrence of "const " going backward from the err line
                const idx = lineStr.indexOf('const ');
                if (idx !== -1) {
                    linesArr[i] = lineStr.substring(0, idx) + lineStr.substring(idx + 6);
                    found = true;
                    console.log(`Removed const in ${file}:${i + 1} for error at line ${errorLine}`);
                    break;
                }
            }
            if (lineStr.includes(';') && i !== start) {
                break;
            }
        }
    }
    fs.writeFileSync(file, linesArr.join('\n'));
}

console.log('Advanced Fixes applied.');
