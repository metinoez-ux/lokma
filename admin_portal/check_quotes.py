import re

with open('src/app/[locale]/hardware/translations.ts', 'r', encoding='utf-8') as f:
    text = f.read()

nl_block = text[text.find('  nl: {'):text.find('};')]
for i, line in enumerate(nl_block.split('\n')):
    # Find words with apostrophes like "LOKMA's" or anything like that inside single quotes
    if "Eén" in line:
        pass # Fine
    if re.search(r"\w'\w", line):
        print(f"Potential unescaped quote in nl on line {i}: {line}")
