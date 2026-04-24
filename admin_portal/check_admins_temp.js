const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const serviceAccount = JSON.parse(process.env.ADMIN_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkAdmins() {
  console.log("Checking super admins...");
  const snap = await db.collection('admins').where('adminType', '==', 'super').get();
  
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`Email: ${data.email}`);
    console.log(`DisplayName: ${data.displayName}`);
    console.log(`Title: ${data.title}`);
    console.log(`AdminType: ${data.adminType}`);
    console.log(`Role: ${data.role}`);
    console.log('-------------------');
  });
}

checkAdmins().catch(console.error);
