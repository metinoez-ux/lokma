import re
file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove Avatar
# Match from <div className="flex items-center gap-4"> up to <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
avatar_pattern = re.compile(
    r'(<div className="flex items-center gap-4">\s*<div className={`w-1 h-12 rounded-full \$\{statusConfig\.color\}`} />)\s*<div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center font-bold text-muted-foreground shadow-sm flex-shrink-0">\s*\{event\.title \? event\.title\.charAt\(0\)\.toUpperCase\(\) : \'K\'\}\s*</div>\s*(<div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-6 gap-3 items-center">)',
    re.DOTALL
)

# 2. Remove Status Badge and Archive Box
boxes_pattern = re.compile(
    r'(</div>\s*)<span className={`px-3 py-1\.5 rounded-full text-xs font-bold \$\{statusConfig\.color\} text-white hidden sm:block`}>\s*\{statusConfig\.label\}\s*</span>\s*<div className="flex gap-2 flex-shrink-0">\s*(<Link\s*href={`/admin/kermes/\$\{event\.id\}`}\s*className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-500 transition text-sm font-medium"\s*onClick=\{\(ev\) => ev\.stopPropagation\(\)\}\s*>\s*✏️\s*</Link>)\s*<button\s*onClick=\{\(ev\) => handleArchive\(event\.id, ev\)\}\s*className="px-3 py-2 bg-muted/50 text-foreground/90 dark:bg-gray-700 dark:text-gray-100 rounded-lg hover:bg-amber-600 hover:text-white transition text-sm"\s*>\s*📦\s*</button>\s*(</div>\s*</div>)',
    re.DOTALL
)


new_text, count1 = avatar_pattern.subn(r'\1\n  \2', text)
print(f"Avatar removal sub count: {count1}")

new_text, count2 = boxes_pattern.subn(r'\1<div className="flex gap-2 flex-shrink-0">\n  \2\n  \3', new_text)
print(f"Boxes removal sub count: {count2}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

