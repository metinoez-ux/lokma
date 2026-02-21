const fs = require('fs');
const path = require('path');

const log = fs.readFileSync('analyze.log', 'utf8');
const lines = log.split('\n');

const undefinedMethodLines = [];
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
            } else if (message.includes("isn't defined") && message.includes("'tr'")) {
                undefinedMethodLines.push(filePath);
            }
        }
    }
});

// 1. Fix missing imports
[...new Set(undefinedMethodLines)].forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes("package:easy_localization/easy_localization.dart")) {
        content = content.replace(
            /import 'package:flutter\/material\.dart';/,
            `import 'package:flutter/material.dart';\nimport 'package:easy_localization/easy_localization.dart';`
        );
        fs.writeFileSync(file, content);
        console.log(`Added easy_localization to ${file}`);
    }
});

// 2. Fix const errors
for (const file of Object.keys(constErrors)) {
    if (!fs.existsSync(file)) continue;
    let linesArr = fs.readFileSync(file, 'utf8').split('\n');
    const errLines = [...new Set(constErrors[file])]; // deduplicate

    for (const errorLine of errLines) {
        let start = errorLine - 1;
        let found = false;

        // Search backwards up to 30 lines
        for (let i = start; i >= Math.max(0, start - 30); i--) {
            // we want to find the first "const" before this. But wait, we might remove the wrong const.
            // A safer regex: if it says `const SnackBar`, `const Text`, `const []`, `const Icon`...? No, the error is specifically that a method (tr) is evaluated in a const context.
            // If we remove the closest 'const' word going up, that usually fixes it.
            // We search for whole word `const `
            const lineStr = linesArr[i];
            const constMatch = lineStr.match(/\bconst\s+/);
            if (constMatch) {
                // If there are multiple consts on the line, let's just replace the last one.
                const lastIndex = lineStr.lastIndexOf('const ');
                linesArr[i] = lineStr.substring(0, lastIndex) + lineStr.substring(lastIndex + 6);
                found = true;
                console.log(`Removed const in ${file}:${i + 1} for error at line ${errorLine}`);
                break;
            }
            if (lineStr.includes(';') && i !== start) {
                // we probably went too far backwards past the statement
                break;
            }
            if (lineStr.includes('{') && !lineStr.includes('}')) {
                // opening block, might be the parent widget
            }
        }
        if (!found) {
            console.log(`Warning: Could not find 'const' to remove for ${file}:${errorLine}`);
        }
    }
    fs.writeFileSync(file, linesArr.join('\n'));
}

console.log('Fixes applied.');
