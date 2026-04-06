import re

with open("src/app/[locale]/login/page.tsx", "r") as f:
    text = f.read()

# We want to replace the entire handleUserRedirect function
# Let's find its start and end
# It starts with: const handleUserRedirect = async (userId: string, userEmail: string | null, userPhone?: string | null) => {
# and ends when we find the next declaration or just count braces.

start_idx = text.find("const handleUserRedirect = async (userId: string, userEmail: string | null, userPhone?: string | null) => {")

if start_idx != -1:
    # Find matching closing brace
    brace_count = 0
    end_idx = -1
    for i in range(start_idx, len(text)):
        if text[i] == '{':
            brace_count += 1
        elif text[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end_idx = i
                break
    
    if end_idx != -1:
        new_func = """const handleUserRedirect = async (userId: string, userEmail: string | null, userPhone?: string | null) => {
    tryFullscreen();

    if (isSuperAdmin(userEmail)) {
      router.push('/admin/analytics');
      return;
    }

    const { getDocs, getDoc, doc, collection, query, where, updateDoc, setDoc } = await import('firebase/firestore');

    const matchedAdminDocs: any[] = [];

    // 1. Check by Firebase UID (document ID)
    try {
      const adminDocById = await getDoc(doc(db, 'admins', userId));
      if (adminDocById.exists()) {
        matchedAdminDocs.push(adminDocById);
      }
    } catch(e) {}

    // 2. Check by firebaseUid field (linked accounts)
    try {
      const uidQuery = query(collection(db, 'admins'), where('firebaseUid', '==', userId));
      const uidSnapshot = await getDocs(uidQuery);
      uidSnapshot.forEach((d: any) => matchedAdminDocs.push(d));
    } catch(e) {}

    // 3. Check by email
    if (userEmail) {
      try {
        const emailQuery = query(collection(db, 'admins'), where('email', '==', userEmail.toLowerCase().trim()));
        const emailSnapshot = await getDocs(emailQuery);
        emailSnapshot.forEach((d: any) => matchedAdminDocs.push(d));
      } catch(e) {}
    }

    // 4. Check by phone number
    if (userPhone) {
      const normalizedPhone = userPhone.replace(/[\s\-()]/g, '');
      const phoneVariations = [
        normalizedPhone,
        normalizedPhone.replace(/^\+/, ''),
        userPhone,
        normalizedPhone.replace('+49', '0049'),
        normalizedPhone.replace('+49', '0'),
        '0' + normalizedPhone.slice(-10)
      ];
      const uniquePhones = Array.from(new Set(phoneVariations));
      for (const phoneVar of uniquePhones) {
        try {
          const phoneQuery = query(collection(db, 'admins'), where('phoneNumber', '==', phoneVar));
          const phoneSnapshot = await getDocs(phoneQuery);
          phoneSnapshot.forEach((d: any) => matchedAdminDocs.push(d));
        } catch(e) {}
      }
    }

    // Deduplicate matches by document ID
    const uniqueMatches = Array.from(new Map(matchedAdminDocs.map(doc => [doc.id, doc])).values());
    const activeMatches = uniqueMatches.filter((doc: any) => doc.data().isActive !== false);

    if (activeMatches.length > 0) {
      console.log(`Found ${activeMatches.length} active admin records. Linking to UID: ${userId}`);
      
      // Update ALL records to have the firebaseUid
      for (const docSnap of activeMatches) {
        try {
          const docData = (docSnap as any).data();
          await updateDoc(doc(db, 'admins', (docSnap as any).id), {
            firebaseUid: userId,
            lastLoginAt: new Date(),
            photoURL: auth.currentUser?.photoURL || docData.photoURL || null,
            displayName: auth.currentUser?.displayName || docData.displayName || null,
          });
        } catch(e) {}
      }

      const primaryAdminDoc = activeMatches[0] as any;
      const primaryAdminData = primaryAdminDoc.data();

      try {
        await setDoc(doc(db, 'users', userId), {
          adminId: primaryAdminDoc.id,
          isAdmin: true,
          adminType: primaryAdminData.adminType || primaryAdminData.type,
          email: userEmail || primaryAdminData.email || null,
          phoneNumber: userPhone || primaryAdminData.phoneNumber || null,
          displayName: primaryAdminData.displayName || primaryAdminData.name || auth.currentUser?.displayName || `${primaryAdminData.firstName || ''} ${primaryAdminData.lastName || ''}`.trim(),
          photoURL: auth.currentUser?.photoURL || null,
          lastLoginAt: new Date(),
          linkedFromAdmin: true,
        }, { merge: true });
      } catch(e) {}

      if (typeof window !== 'undefined') localStorage.removeItem('mira_active_assignment_id');
      
      router.push(getAdminRedirectPath(primaryAdminData.role, primaryAdminData.adminType));
      return;
    }

    setCheckingAuth(false);
  }"""
        
        new_text = text[:start_idx] + new_func + text[end_idx+1:]
        
        with open("src/app/[locale]/login/page.tsx", "w") as f:
            f.write(new_text)
        print("Successfully replaced handleUserRedirect")
else:
    print("Could not find handleUserRedirect")
