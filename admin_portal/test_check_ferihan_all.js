const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.ADMIN_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const email = 'ferihan.oez05@gmail.com';
  const aDocs = await db.collection('admins').where('email', '==', email).get();
  
  console.log(`Found ${aDocs.size} docs for ${email} in admins`);
  aDocs.forEach(doc => {
    console.log(`\nADMINS DOC ID: ${doc.id}`);
    console.log(`isActive:`, doc.data().isActive);
    console.log(`role:`, doc.data().role);
    console.log(`adminType:`, doc.data().adminType);
    console.log(`firebaseUid:`, doc.data().firebaseUid);
  });
}

check().catch(console.error).finally(() => process.exit(0));
