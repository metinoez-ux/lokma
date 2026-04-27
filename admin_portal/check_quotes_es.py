import re

with open('src/app/[locale]/hardware/translations.ts', 'r', encoding='utf-8') as f:
    text = f.read()

es_block = text[text.find('  es: {'):text.find('  it: {')]
for i, line in enumerate(es_block.split('\n')):
    # find words with apostrophes
    if re.search(r"\w'\w", line):
        print(f"Potential unescaped quote in es on line {i}: {line}")
