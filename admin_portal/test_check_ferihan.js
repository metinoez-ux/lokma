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
  const uid = 'yspOQz8nmTbjK0vRM6NoiQwCOMB3';
  const uDoc = await db.collection('users').doc(uid).get();
  const aDoc = await db.collection('admins').doc(uid).get();
  
  console.log("USERS DOC: roles =", uDoc.data().roles, ", assignments =", uDoc.data().assignments);
  console.log("ADMINS DOC: adminType =", aDoc.data().adminType, ", isActive =", aDoc.data().isActive, ", assignments =", aDoc.data().assignments);
}

check().catch(console.error).finally(() => process.exit(0));
