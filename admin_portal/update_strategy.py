with open("src/components/providers/AdminProvider.tsx", "r") as f:
    text = f.read()

find_str = """  // Strategy 1: Check Firestore admins collection by UID
  const adminDoc = await getDoc(doc(db, 'admins', userId));
  if (adminDoc.exists()) {
  adminProfile = { id: adminDoc.id, ...adminDoc.data() } as Admin;
  } else {"""

replace_str = """  // Strategy 1.5 (NEW PRIMARY): Search by firebaseUid field to get ALL linked accounts
  const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
  const uidQuery = query(collection(db, 'admins'), where('firebaseUid', '==', userId));
  const uidSnapshot = await getDocs(uidQuery);

  if (!uidSnapshot.empty) {
    adminProfile = mergeMatchedDocs(uidSnapshot.docs) as Admin;
  } else {
    // Strategy 1: Check Firestore admins collection by UID (fallback)
    const adminDoc = await getDoc(doc(db, 'admins', userId));
    if (adminDoc.exists()) {
      adminProfile = { id: adminDoc.id, ...adminDoc.data() } as Admin;
    } else {"""

if find_str in text:
    new_text = text.replace(find_str, replace_str)
    with open("src/components/providers/AdminProvider.tsx", "w") as f:
        f.write(new_text)
    print("Success")
else:
    # try replacing with different spacing
    find_str2 = "\t\t\t\t// Strategy 1: Check Firestore admins collection by UID"
    print("Trying alternative..")
    import re
    # use a basic re search
    pattern = re.compile(r"(\s*)// Strategy 1: Check Firestore admins collection by UID\s*const adminDoc = await getDoc\(doc\(db, 'admins', userId\)\);\s*if \(adminDoc\.exists\(\)\) \{\s*adminProfile = \{ id: adminDoc\.id, \.\.\.adminDoc\.data\(\) \} as Admin;\s*\} else \{", re.MULTILINE)
    
    if pattern.search(text):
        new_text = pattern.sub(lambda m: m.group(1) + replace_str.replace("  ", m.group(1)), text)
        with open("src/components/providers/AdminProvider.tsx", "w") as f:
            f.write(new_text)
        print("Success regex")
    else:
        print("Failed both")
