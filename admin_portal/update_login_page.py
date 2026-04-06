import re

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/login/page.tsx', 'r') as f:
    content = f.read()

# We need to replace STRATEGY 4
# Find from "// STRATEGY 4:" to "    // No admin match found — show access denied, sign out"

pattern = re.compile(
    r"\t\t// STRATEGY 4: Check by phone number.*?\n\t\t\}\n\n\t\t// No admin match found",
    re.DOTALL
)

replacement = """\t\t// STRATEGY 4: Check by phone number (if available from auth)
\t\tif (userPhone) {
\t\t\tconst normalizedPhone = userPhone.replace(/[\s-()]/g, '');
\t\t\tconst phoneVariations = [
\t\t\t\tnormalizedPhone,
\t\t\t\tnormalizedPhone.replace(/^\+/, ''),
\t\t\t\tuserPhone,
\t\t\t\tnormalizedPhone.replace('+49', '0049'),
\t\t\t\tnormalizedPhone.replace('+49', '0'),
\t\t\t\t'0' + normalizedPhone.slice(-10)
\t\t\t];
\t\t\tconst uniquePhones = Array.from(new Set(phoneVariations));

\t\t\tlet matchedAdminData: any = null;
\t\t\tlet matchedAdminId: string | null = null;
\t\t\tlet foundAnyMatch = false;

\t\t\tfor (const phoneVar of uniquePhones) {
\t\t\t\tconst phoneQuery = query(collection(db, 'admins'), where('phoneNumber', '==', phoneVar));
\t\t\t\tconst phoneSnapshot = await getDocs(phoneQuery);

\t\t\t\tif (!phoneSnapshot.empty) {
\t\t\t\t\tfoundAnyMatch = true;
\t\t\t\t\tconsole.log('Found admin match by phone:', phoneVar, '- Linking UID to all matches:', userId);
\t\t\t\t\t
\t\t\t\t\tfor (const docSnap of phoneSnapshot.docs) {
\t\t\t\t\t\tconst adminData = docSnap.data();
\t\t\t\t\t\t// Record the first active match info for routing
\t\t\t\t\t\tif (!matchedAdminData && adminData.isActive) {
\t\t\t\t\t\t\tmatchedAdminData = adminData;
\t\t\t\t\t\t\tmatchedAdminId = docSnap.id;
\t\t\t\t\t\t}

\t\t\t\t\t\t// Update admin record with new Firebase UID
\t\t\t\t\t\tawait updateDoc(doc(db, 'admins', docSnap.id), {
\t\t\t\t\t\t\tfirebaseUid: userId,
\t\t\t\t\t\t\tisActive: true,
\t\t\t\t\t\t\tlastLoginAt: new Date(),
\t\t\t\t\t\t\tlinkedVia: 'phone_login',
\t\t\t\t\t\t\tphotoURL: auth.currentUser?.photoURL || adminData.photoURL || null,
\t\t\t\t\t\t\tdisplayName: auth.currentUser?.displayName || adminData.displayName || null,
\t\t\t\t\t\t});
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}

\t\t\tif (foundAnyMatch && matchedAdminData && matchedAdminId) {
\t\t\t\t// Also update/merge the users record to link with admin
\t\t\t\tconst { setDoc } = await import('firebase/firestore');
\t\t\t\tawait setDoc(doc(db, 'users', userId), {
\t\t\t\t\tadminId: matchedAdminId,
\t\t\t\t\tisAdmin: true,
\t\t\t\t\tadminType: matchedAdminData.adminType || matchedAdminData.type,
\t\t\t\t\temail: matchedAdminData.email || null,
\t\t\t\t\tphoneNumber: userPhone,
\t\t\t\t\tdisplayName: matchedAdminData.displayName || matchedAdminData.name || auth.currentUser?.displayName || `${matchedAdminData.firstName || ''} ${matchedAdminData.lastName || ''}`.trim(),
\t\t\t\t\tfirstName: matchedAdminData.firstName || auth.currentUser?.displayName?.split(' ')[0] || null,
\t\t\t\t\tlastName: matchedAdminData.lastName || auth.currentUser?.displayName?.split(' ').slice(1).join(' ') || null,
\t\t\t\t\tphotoURL: auth.currentUser?.photoURL || null,
\t\t\t\t\tlastLoginAt: new Date(),
\t\t\t\t\tlinkedFromAdmin: true,
\t\t\t\t}, { merge: true });

\t\t\t\tif (typeof window !== 'undefined') localStorage.removeItem('mira_active_assignment_id');
\t\t\t\trouter.push(getAdminRedirectPath(matchedAdminData.role, matchedAdminData.adminType));
\t\t\t\treturn;
\t\t\t}
\t\t}

\t\t// No admin match found"""

if pattern.search(content):
    content = pattern.sub(replacement, content)
    with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/login/page.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found")

