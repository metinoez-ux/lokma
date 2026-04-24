import sys

with open('lib/screens/marketplace/market/market_screen.dart', 'r') as f:
    lines = f.readlines()

count = 0
last_1 = -1
for i, line in enumerate(lines):
    # ignore comments for brace counting
    code_line = line.split('//')[0]
    for char in code_line:
        if char == '{':
            count += 1
        elif char == '}':
            count -= 1
    
    if count == 1:
        last_1 = i + 1

print(f"Last time count was 1 (class level) was at line: {last_1}")
