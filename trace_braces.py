file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    for char in line:
        if char == '{':
            stack.append(i + 1)
        elif char == '}':
            if stack:
                stack.pop()
            else:
                print(f"EXTRA }} AT LINE {i+1}")

print(f"UNCLOSED {{ AT LINES: {stack}")
