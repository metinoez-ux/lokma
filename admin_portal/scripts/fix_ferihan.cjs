const admin = require('firebase-admin');
const serviceAccount = require('../../assets/lokma-kermes-firebase-adminsdk-bntp6-2cc406b74e.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function fixBrokenUsers() {
  const snapshot = await db.collection('admins').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.assignments && Array.isArray(data.assignments) && data.assignments.length > 0) {
      if (data.isActive === false || !data.adminType || (data.roles && data.roles.length === 1 && data.roles[0] === 'customer')) {
        console.log(`Fixing user: ${data.displayName || data.email} (${doc.id})`);
        
        // Find business logic
        let finalBusinessId = data.businessId;
        const firstBusiness = data.assignments.find(a => a.entityType === 'business' || a.type === 'business');
        if (firstBusiness) finalBusinessId = firstBusiness.id;
        else {
          const firstKermes = data.assignments.find(a => a.entityType === 'kermes' || a.type === 'kermes');
          if (firstKermes) finalBusinessId = firstKermes.id;
        }

        const newRoles = [...(data.roles || [])];
        data.assignments.forEach(a => {
          if (a.role && !newRoles.includes(a.role)) newRoles.push(a.role);
        });
        if (!newRoles.includes('staff')) newRoles.push('staff'); // At least staff if they have assignments

        await db.collection('admins').doc(doc.id).update({
          isActive: true,
          adminType: data.adminType || 'staff',
          businessId: finalBusinessId || null,
          roles: newRoles
        });
        console.log(` -> Re-enabled, set adminType to staff, roles to`, newRoles);
      }
    }
  }
}
fixBrokenUsers().then(() => {
  console.log('Done!');
  process.exit(0);
});
