const fs = require('fs');
const file = 'src/app/[locale]/admin/orders/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix Workflow Box Colors to have darker text for extreme readability
content = content.replace(/text-yellow-800 dark:text-yellow-400/g, 'text-yellow-900 dark:text-yellow-400');
content = content.replace(/text-yellow-700 dark:text-yellow-300/g, 'text-yellow-900/80 dark:text-yellow-300');

content = content.replace(/text-amber-800 dark:text-amber-400/g, 'text-amber-900 dark:text-amber-400');
content = content.replace(/text-amber-700 dark:text-amber-300/g, 'text-amber-900/80 dark:text-amber-300');

content = content.replace(/text-green-800 dark:text-green-400/g, 'text-green-900 dark:text-green-400');
content = content.replace(/text-green-700 dark:text-green-300/g, 'text-green-900/80 dark:text-green-300');

content = content.replace(/text-indigo-800 dark:text-indigo-400/g, 'text-indigo-900 dark:text-indigo-400');
content = content.replace(/text-indigo-700 dark:text-indigo-300/g, 'text-indigo-900/80 dark:text-indigo-300');

content = content.replace(/text-emerald-800 dark:text-emerald-400/g, 'text-emerald-900 dark:text-emerald-400');
content = content.replace(/text-emerald-700 dark:text-emerald-300/g, 'text-emerald-900/80 dark:text-emerald-300');

content = content.replace(/text-blue-800 dark:text-blue-300/g, 'text-blue-900 dark:text-blue-300');
content = content.replace(/text-blue-700 dark:text-blue-400/g, 'text-blue-900/80 dark:text-blue-400');

// 2. Fix Kanban Column Backgrounds to not blend into the white OrderCards
// We need to find all instances of `<div className="bg-card rounded-xl p-4">` used for Kanban columns
// The columns are preceded by formatting like: {/* Pending Column */}
content = content.replace(/{v\* (Pending|Preparing|Ready|In Transit|Completed) Column \*\/\s*<div className="bg-card rounded-xl p-4">/g, (match, colName) => {
    return `{\/* ${colName} Column *\/}\n                        <div className="bg-slate-100/80 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-inner">`;
});

// Since Regex might miss it if spacing is weird, let's just do a specific replace for the columns:
content = content.replace(/<div className="bg-card rounded-xl p-4">\s*<h3 className="text-yellow-800/g, '<div className="bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 shadow-sm">\n                            <h3 className="text-yellow-900');
content = content.replace(/<div className="bg-card rounded-xl p-4">\s*<h3 className="text-amber-800/g, '<div className="bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 shadow-sm">\n                            <h3 className="text-amber-900');
content = content.replace(/<div className="bg-card rounded-xl p-4">\s*<h3 className="text-green-800/g, '<div className="bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 shadow-sm">\n                            <h3 className="text-green-900');
content = content.replace(/<div className="bg-card rounded-xl p-4">\s*<h3 className="text-indigo-800/g, '<div className="bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 shadow-sm">\n                            <h3 className="text-indigo-900');
content = content.replace(/<div className="bg-card rounded-xl p-4">\s*<h3 className="text-emerald-800/g, '<div className="bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 shadow-sm">\n                            <h3 className="text-emerald-900');


fs.writeFileSync(file, content);
console.log('Fixed contrast for Orders page.');
