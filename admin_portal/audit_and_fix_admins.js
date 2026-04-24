const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin SDK
try {
  let serviceAccountConfig;
  if (process.env.ADMIN_SERVICE_ACCOUNT) {
    try {
      serviceAccountConfig = JSON.parse(process.env.ADMIN_SERVICE_ACCOUNT);
    } catch (parseError) {
      console.log("Could not parse ADMIN_SERVICE_ACCOUNT JSON. Trying single line...");
      // Fix multiline if needed
      let fixedStr = process.env.ADMIN_SERVICE_ACCOUNT.replace(/\n/g, "\\n");
      try {
        serviceAccountConfig = JSON.parse(fixedStr);
      } catch (e2) {
        console.error("Failed to parse ADMIN_SERVICE_ACCOUNT", e2);
      }
    }
  }

  if (serviceAccountConfig) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountConfig)
    });
    console.log("Firebase Admin Initialized Successfully");
  } else {
    throw new Error("No ADMIN_SERVICE_ACCOUNT found");
  }
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
  process.exit(1);
}

const db = admin.firestore();

async function run() {
  console.log("Starting Audit...");
  const adminsRef = db.collection('admins');
  const platformAdminsRef = db.collection('platform_admins');
  const usersRef = db.collection('users');

  const adminsSnapshot = await adminsRef.get();
  
  let updates = 0;
  for (const doc of adminsSnapshot.docs) {
    const data = doc.data();
    let needsUpdate = false;
    let updateData = {};

    // 1. Resolve Undefined titles for Super Admins
    if (data.adminType === 'super') {
      if (!data.title || data.title === 'Undefined' || data.title === 'undefined') {
        updateData.title = 'Super Admin';
        needsUpdate = true;
      }
      
      // Ensure roles array has 'super'
      if (!data.roles || !data.roles.includes('super')) {
        updateData.roles = [...(data.roles || []), 'super'];
        needsUpdate = true;
      }
    }

    // 2. Normalize adminType
    // lokma_admin -> adminType: lokma_admin, roles: [lokma_admin]
    // staff -> adminType: staff, roles: [staff]
    if (data.adminType === 'lokma_admin' || data.adminType === 'admin') {
      if (!data.title || data.title === 'Undefined') {
        updateData.title = 'Admin';
        needsUpdate = true;
      }
      if (data.adminType === 'admin') {
        updateData.adminType = 'lokma_admin';
        needsUpdate = true;
      }
      if (!data.roles || !data.roles.includes('lokma_admin')) {
        let newRoles = [...(data.roles || [])];
        if (newRoles.includes('admin')) {
            newRoles = newRoles.filter(r => r !== 'admin');
        }
        if (!newRoles.includes('lokma_admin')) {
            newRoles.push('lokma_admin');
        }
        updateData.roles = newRoles;
        needsUpdate = true;
      }
    }
    
    // Check if staff
    if (data.adminType === 'staff' || data.roles?.includes('staff')) {
        if (!data.adminType) {
            updateData.adminType = 'staff';
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
      console.log(`Updating ${doc.id} (${data.email || 'no-email'}):`, updateData);
      await adminsRef.doc(doc.id).update(updateData);
      updates++;
    }
  }
  
  console.log(`Admins updated: ${updates}`);
  
  // 3. Platform Admins sync check
  const platformAdminsSnapshot = await platformAdminsRef.get();
  const platformAdminsEmails = new Set(platformAdminsSnapshot.docs.map(d => d.data().email).filter(Boolean));
  const adminsEmails = new Set(adminsSnapshot.docs.map(d => d.data().email).filter(Boolean));
  
  console.log(`Platform Admins count: ${platformAdminsEmails.size}`);
  console.log(`Admins collection count: ${adminsEmails.size}`);
  
  // 4. Orphaned Kermes User Assignments
  console.log("Checking for orphaned Kermes user assignments...");
  const kermesEventsRef = db.collection('kermes_events');
  const kermesSnapshot = await kermesEventsRef.get();
  
  const kermesStaffMap = new Set();
  kermesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      (data.assignedStaff || []).forEach(uid => kermesStaffMap.add(uid));
      (data.assignedDrivers || []).forEach(uid => kermesStaffMap.add(uid));
      (data.assignedWaiters || []).forEach(uid => kermesStaffMap.add(uid));
      (data.kermesAdmins || []).forEach(uid => kermesStaffMap.add(uid));
  });
  
  let orphanedUpdates = 0;
  for (const doc of adminsSnapshot.docs) {
      const data = doc.data();
      if (data.kermesId && data.kermesId !== 'NONE') {
          if (!kermesStaffMap.has(doc.id)) {
              console.log(`Found orphaned kermesId ${data.kermesId} on user ${doc.id}`);
              await adminsRef.doc(doc.id).update({ kermesId: 'NONE' });
              orphanedUpdates++;
          }
      }
  }
  console.log(`Orphaned assignments fixed: ${orphanedUpdates}`);
}

run().then(() => {
  console.log("Audit Complete.");
  process.exit(0);
}).catch(console.error);
