import os

file_path = "admin_portal/src/app/[locale]/admin/benutzerverwaltung/page.tsx"
with open(file_path, "r") as f:
    content = f.read()
    
target = "(user.kermesAssignments && user.kermesAssignments.length > 0) ? ("
replacement = "(user.kermesAssignments && user.kermesAssignments.length > 0) || (user.assignments && user.assignments.some((a: any) => a.entityType === 'kermes')) ? ("

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w") as f:
        f.write(content)
    print("Success")
else:
    print("Target not found")
