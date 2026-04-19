import re
file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace "group-hover:text-pink-800 dark:text-pink-400" with ""
new_text = re.sub(r'group-hover:text-pink-800 dark:text-pink-400 ', '', text)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("regex SUCCESS")
