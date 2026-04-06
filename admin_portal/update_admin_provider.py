import re

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/providers/AdminProvider.tsx', 'r') as f:
    content = f.read()

replacement1 = """\t\t\t\t\t// Strategy 1.5: Check by firebaseUid field (Linked accounts)
\t\t\t\t\tconst { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
\t\t\t\t\tconst uidQuery = query(collection(db, 'admins'), where('firebaseUid', '==', userId));
\t\t\t\t\tconst uidSnapshot = await getDocs(uidQuery);

\t\t\t\t\tif (!uidSnapshot.empty) {
\t\t\t\t\t\tadminProfile = mergeMatchedDocs(uidSnapshot.docs) as Admin;
\t\t\t\t\t}

\t\t\t\t\t// Strategy 2: Search by phone number (for phone auth login)
\t\t\t\t\tconst userPhoneNumber = phoneNumber || auth.currentUser?.phoneNumber;
\t\t\t\t\tif (!adminProfile && userPhoneNumber) {"""

# Replace Strategy 2 header
content = re.sub(
    r"\t     // Strategy 2: Search by phone number \(for phone auth login\)\n\t     const userPhoneNumber = phoneNumber \|\| auth\.currentUser\?\.phoneNumber;\n\t     if \(userPhoneNumber\) \{\n\t     const \{ collection, query, where, getDocs, updateDoc \} = await import\('firebase/firestore'\);",
    replacement1,
    content
)

# Remove the import from Strategy 3
content = re.sub(
    r"\t     // Strategy 3: Search by email if phone not found\n\t     if \(\!adminProfile && email\) \{\n\t     const \{ collection, query, where, getDocs, updateDoc \} = await import\('firebase/firestore'\);\n\t     const emailQuery = query\(",
    "\t\t\t\t\t// Strategy 3: Search by email if phone not found\n\t\t\t\t\tif (!adminProfile && email) {\n\t\t\t\t\t\tconst emailQuery = query(",
    content
)

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/providers/AdminProvider.tsx', 'w') as f:
    f.write(content)
