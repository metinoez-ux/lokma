const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function check() {
  const db = admin.firestore();
  
  // Use a known business ID or logic to get users. Metin has email or phone. 
  // We can just query admins for Metin.
  const admins = await db.collection('admins').where('name', '==', 'Metin2 Öz').get();
  if (admins.empty) {
     const allAdmins = await db.collection('admins').limit(10).get();
     allAdmins.forEach(d => console.log('Admin:', d.id, d.data().name));
  } else {
     admins.forEach(d => {
         console.log('Metin Admin Doc:', d.data());
     });
  }
}

check().then(() => process.exit(0)).catch(console.error);
