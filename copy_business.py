import re

with open('admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'r') as f:
    lines = f.readlines()

ui = lines[3846:4700] # roughly
ui2 = lines[4700:6716] # rest

with open('extracted_settings.txt', 'w') as f:
    f.writelines(ui)
    f.writelines(ui2)

print("done")
