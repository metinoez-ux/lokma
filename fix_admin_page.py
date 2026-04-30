import re

# 1. Fix page.tsx
with open('admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx', 'r') as f:
    content = f.read()

# Fix typescript error
content = re.sub(
    r"let finalCats = \[\];\s+let rawDocs = \[\];",
    r"let finalCats: string[] = [];\n      let rawDocs: any[] = [];",
    content
)

# Fix Category UI (remove dashed border and add title)
old_btn = r" className=\{`px-3 py-1\.5 rounded-lg text-sm font-medium transition \$\{selectedCategory === category\s+\? 'bg-pink-600 text-white'\s+: count > 0\s+\? 'bg-muted/50 text-foreground/90 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'\s+: 'bg-card text-muted-foreground/80 hover:bg-gray-700 border border-gray-600 border-dashed'\s+\}`\}>"
new_btn = """ title={count === 0 ? "Bu kategoride henüz ürün yok" : ""}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${selectedCategory === category
 ? 'bg-pink-600 text-white'
 : 'bg-muted/50 text-foreground/90 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
 }`}>"""

content = re.sub(old_btn, new_btn, content)

with open('admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx', 'w') as f:
    f.write(content)


# 2. Fix CategoryManagementModal.tsx icons
with open('admin_portal/src/components/admin/CategoryManagementModal.tsx', 'r') as f:
    modal_content = f.read()

# I want to swap `visibility_off` and `visibility` in this file.
# The original says:
# className={`p-2 rounded ml-1 ${cat.isActive ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/40' : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'}`}
# <span className="material-symbols-outlined text-sm">{cat.isActive ? 'visibility_off' : 'visibility'}</span>

old_modal = r"className=\{`p-2 rounded ml-1 \$\{cat\.isActive \? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/40' : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'\}`\}\s*>\s*<span className=\"material-symbols-outlined text-sm\">\{cat\.isActive \? 'visibility_off' : 'visibility'\}</span>"

new_modal = """className={`p-2 rounded ml-1 ${cat.isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/40' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/40'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{cat.isActive ? 'visibility' : 'visibility_off'}</span>"""

modal_content = re.sub(old_modal, new_modal, modal_content)

with open('admin_portal/src/components/admin/CategoryManagementModal.tsx', 'w') as f:
    f.write(modal_content)

print("Done fixing files!")
