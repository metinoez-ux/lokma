import sys

with open('lib/screens/marketplace/market/market_screen.dart', 'r') as f:
    lines = f.readlines()

count = 0
in_build = False
for i, line in enumerate(lines):
    if i + 1 == 1106:
        in_build = True
    
    if in_build:
        for char in line:
            if char == '{':
                count += 1
            elif char == '}':
                count -= 1
        
        if count == 0:
            print(f"Build ends at line {i + 1}")
            sys.exit(0)

print("Build does NOT end!")
