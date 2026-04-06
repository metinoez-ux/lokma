with open("src/components/providers/AdminProvider.tsx", "r") as f:
    lines = f.readlines()

new_lines = []
for idx, line in enumerate(lines):
    if "// Strategy 1: Check Firestore admins collection by UID" in line:
        # We know it looks like:
        #   } else {
        #     // Strategy 1: Check Firestore admins collection by UID
        spacing = line.split("//")[0]
        new_lines.append(spacing + "// Strategy 1.5 (NEW PRIMARY): Search by firebaseUid field to get ALL linked accounts\n")
        new_lines.append(spacing + "const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');\n")
        new_lines.append(spacing + "const uidQuery = query(collection(db, 'admins'), where('firebaseUid', '==', userId));\n")
        new_lines.append(spacing + "const uidSnapshot = await getDocs(uidQuery);\n")
        new_lines.append(spacing + "if (!uidSnapshot.empty) {\n")
        new_lines.append(spacing + "  adminProfile = mergeMatchedDocs(uidSnapshot.docs) as Admin;\n")
        new_lines.append(spacing + "} else {\n")
        new_lines.append(line)
        continue
        
    if "  if (adminProfile) {" in line:
        # We need to insert a closing bracket for `} else {` we added!
        # Let's count how many we need.
        # It's right before `if (adminProfile) {`
        pass
        
    new_lines.append(line)
    
# Now find where to insert the closing brace
# Find `if (adminProfile) {`
for i, line in enumerate(new_lines):
    if "if (adminProfile) {" in line:
        # insert before this line
        spacing = line.split("if")[0]
        new_lines.insert(i, spacing + "}\n")
        break

with open("src/components/providers/AdminProvider.tsx", "w") as f:
    f.writelines(new_lines)
