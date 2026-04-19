import re
file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

new_text = re.sub(r'hover:border-pink-500/50', 'hover:border-slate-500/50', text)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("regex SUCCESS")
