import re

with open('admin_portal/src/components/admin/CategoryManagementModal.tsx', 'r') as f:
    content = f.read()

# Replace the class string
content = content.replace(
    "className={`p-2 rounded ml-1 ${cat.isActive ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/40' : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'}`}",
    "className={`p-2 rounded ml-1 ${cat.isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/40' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/40'}`}"
)

# Replace the icon string
content = content.replace(
    "<span className=\"material-symbols-outlined text-sm\">{cat.isActive ? 'visibility_off' : 'visibility'}</span>",
    "<span className=\"material-symbols-outlined text-sm\">{cat.isActive ? 'visibility' : 'visibility_off'}</span>"
)

with open('admin_portal/src/components/admin/CategoryManagementModal.tsx', 'w') as f:
    f.write(content)

print("Done")
