import re

with open('src/app/[locale]/hardware/translations.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(len(lines)):
    line = lines[i]
    if line.strip().startswith('//') or line.strip().startswith('export ') or line.strip() == '' or line.strip() in ['},', '};', '{']:
        continue
    
    # We want to fix the keys that look like: key: 'value',
    # by replacing the outer single quotes with double quotes, and escaping inner double quotes
    
    # regex to find key: 'value' or key: ['value1', 'value2']
    # Actually, a simpler way is to find all '...' strings that are not escaped.
    
    # Since only fr and it have unescaped ' inside strings, let's just use Python's ast or simple string replacement.
    pass
