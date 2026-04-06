import re

with open("src/app/[locale]/login/page.tsx", "r") as f:
    text = f.read()

pattern = re.compile(
    r"\s*// STRATEGY 4: Check by phone number.*?\n\s*// No admin match found",
    re.DOTALL
)

replacement = """
  // STRATEGY 4: Check by phone number (if available from auth)
  if (userPhone) {
    const normalizedPhone = userPhone.replace(/[\\s\\-()]/g, '');
    const phoneVariations = [
      normalizedPhone,
      normalizedPhone.replace(/^\\+/, ''),
      userPhone,
      normalizedPhone.replace('+49', '0049'),
      normalizedPhone.replace('+49', '0'),
      '0' + normalizedPhone.slice(-10)
    ];
    const uniquePhones = Array.from(new Set(phoneVariations));

    let matchedAdminData: any = null;
    let matchedAdminId: string | null = null;
    let foundAnyMatch = false;

    for (const phoneVar of uniquePhones) {
      const phoneQuery = query(collection(db, 'admins'), where('phoneNumber', '==', phoneVar));
      const phoneSnapshot = await getDocs(phoneQuery);

      if (!phoneSnapshot.empty) {
        foundAnyMatch = true;
        console.log('Found admin match by phone:', phoneVar, '- Linking UID to all matches:', userId);
        
        for (const docSnap of phoneSnapshot.docs) {
          const adminData = docSnap.data();
          // Record the first active match info for routing
          if (!matchedAdminData && adminData.isActive) {
            matchedAdminData = adminData;
            matchedAdminId = docSnap.id;
          }

          // Update admin record with new Firebase UID
          await updateDoc(doc(db, 'admins', docSnap.id), {
            firebaseUid: userId,
            isActive: true,
            lastLoginAt: new Date(),
            linkedVia: 'phone_login',
            photoURL: auth.currentUser?.photoURL || adminData.photoURL || null,
            displayName: auth.currentUser?.displayName || adminData.displayName || null,
          });
        }
      }
    }

    if (foundAnyMatch && matchedAdminData && matchedAdminId) {
      // Also update/merge the users record to link with admin
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', userId), {
        adminId: matchedAdminId,
        isAdmin: true,
        adminType: matchedAdminData.adminType || matchedAdminData.type,
        email: matchedAdminData.email || null,
        phoneNumber: userPhone,
        displayName: matchedAdminData.displayName || matchedAdminData.name || auth.currentUser?.displayName || `${matchedAdminData.firstName || ''} ${matchedAdminData.lastName || ''}`.trim(),
        firstName: matchedAdminData.firstName || auth.currentUser?.displayName?.split(' ')[0] || null,
        lastName: matchedAdminData.lastName || auth.currentUser?.displayName?.split(' ').slice(1).join(' ') || null,
        photoURL: auth.currentUser?.photoURL || null,
        lastLoginAt: new Date(),
        linkedFromAdmin: true,
      }, { merge: true });

      if (typeof window !== 'undefined') localStorage.removeItem('mira_active_assignment_id');
      router.push(getAdminRedirectPath(matchedAdminData.role, matchedAdminData.adminType));
      return;
    }
  }

  // No admin match found"""

if pattern.search(text):
    text = pattern.sub(lambda m: replacement, text)
    with open("src/app/[locale]/login/page.tsx", "w") as f:
        f.write(text)
    print("Success")
else:
    print("Pattern not found")

