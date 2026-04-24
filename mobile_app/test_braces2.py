import sys

with open('lib/screens/marketplace/market/market_screen.dart', 'r') as f:
    lines = f.readlines()

count = 0
for i, line in enumerate(lines):
    for char in line:
        if char == '{':
            count += 1
        elif char == '}':
            count -= 1
    
    if count < 0:
        print(f"Extra closing brace at line {i + 1}")
        break

print(f"Final brace count: {count}")
