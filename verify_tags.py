import re

file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Strip out matching <div> and </div> tags via regex
open_count = text.count('<div')
close_count = text.count('</div')

print(f"Open divs: {open_count}")
print(f"Close divs: {close_count}")

import jsbeautifier
res = jsbeautifier.beautify(text)
open_braces = res.count('{')
close_braces = res.count('}')

print(f"Open braces: {open_braces}")
print(f"Close braces: {close_braces}")
