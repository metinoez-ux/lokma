import os
import glob

def fix_files():
    dart_files = glob.glob('lib/**/*.dart', recursive=True)
    for filePath in dart_files:
        if 'kermes_model.dart' in filePath:
            continue
        
        with open(filePath, 'r') as f:
            content = f.read()
            
        if 'headerImage: ' in content and 'logoUrl: ' not in content:
            # We want to replace exactly the headerImage assignment in from Map mappings.
            # Example: headerImage: data['headerImage'] as String?,
            
            # Simple line by line replacements
            lines = content.split('\n')
            new_lines = []
            changed = False
            for line in lines:
                new_lines.append(line)
                if 'headerImage: ' in line and 'KermesEvent(' not in line:
                    indent = len(line) - len(line.lstrip())
                    new_lines.append(' ' * indent + "logoUrl: data['logoUrl']?.toString(),")
                    changed = True
                    
            if changed:
                with open(filePath, 'w') as f:
                    f.write('\n'.join(new_lines))
                print(f"Updated {filePath}")

if __name__ == '__main__':
    fix_files()
