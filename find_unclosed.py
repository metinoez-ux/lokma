import re

file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

div_stack = []
for i, line in enumerate(lines):
    # This is a very naive HTML parser just for block level divs
    matches = re.findall(r'<(div[^>]*)>|<\/(div)>|<(div[^>]*)\/>', line)
    for m in matches:
        if m[0]:  # <div ...>
            div_stack.append(i + 1)
        elif m[1]: # </div>
            if div_stack:
                div_stack.pop()
            else:
                print(f"EXTRA CLOSING DIV AT LINE {i+1}")
                exit(0)

if div_stack:
    print(f"UNCLOSED DIVS STARTED AT LINES: {div_stack}")
