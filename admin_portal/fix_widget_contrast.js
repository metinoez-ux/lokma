const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(dirPath);
    });
}

const colors = ['blue', 'green', 'purple', 'amber', 'emerald', 'cyan', 'pink', 'red', 'yellow', 'orange', 'gray', 'slate', 'indigo'];

function convertClasses(content) {
    let newContent = content;

    // Fix headings and heavy text elements: text-white -> text-foreground 
    // We target common structures like text-xl, font-bold, mb-3 etc to avoid hitting buttons
    newContent = newContent.replace(/text-white( font-\w+| mb-\d+| mt-\d+| text-[smlp234]+x?l?)/g, 'text-foreground$1');
    newContent = newContent.replace(/(font-\w+|mb-\d+|mt-\d+|text-[smlp234]+x?l?) text-white/g, '$1 text-foreground');
    newContent = newContent.replace(/text-gray-300|text-gray-400/g, 'text-muted-foreground');
    // For pure class="text-white" usually in table headers or paragraphs
    newContent = newContent.replace(/className="text-white"/g, 'className="text-foreground"');

    // Fix the chips:
    colors.forEach(color => {
        // bg-gradient-to-br from-color-900/X to-color-800/Y border-color-700/Z
        const regexFrom = new RegExp(`from-${color}-900\\/(\\d+)`, 'g');
        const regexTo = new RegExp(`to-${color}-800\\/(\\d+)`, 'g');
        const regexBorder = new RegExp(`border-${color}-700\\/(\\d+)`, 'g');
        const regexText = new RegExp(`text-${color}-400`, 'g');
        
        newContent = newContent.replace(regexFrom, `from-${color}-100 dark:from-${color}-900/$1`);
        newContent = newContent.replace(regexTo, `to-${color}-50 dark:to-${color}-800/$1`);
        newContent = newContent.replace(regexBorder, `border-${color}-200 dark:border-${color}-700/$1`);
        
        // Convert text-color-400 to text-color-800 dark:text-color-400 EXCEPT if it's already dark:
        // We only do this if it matches 'text-color-400' directly (not preceded by dark:)
        const textRegex = new RegExp(`(?<!dark:)text-${color}-400`, 'g');
        newContent = newContent.replace(textRegex, `text-${color}-800 dark:text-${color}-400`);
    });

    return newContent;
}

['src/app/[locale]/admin', 'src/components/admin'].forEach(targetDir => {
    if(fs.existsSync(targetDir)) {
        walk(targetDir, (filePath) => {
            if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
                let content = fs.readFileSync(filePath, 'utf8');
                let updated = convertClasses(content);
                if (content !== updated) {
                    fs.writeFileSync(filePath, updated, 'utf8');
                    console.log('Fixed contrast in:', filePath);
                }
            }
        });
    }
});
