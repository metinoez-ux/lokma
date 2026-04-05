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
  const aDoc = await db.collection('admins').doc(uid).get();
  
  if(aDoc.exists) {
    console.log("ADMINS DOC:", aDoc.data());
  }
}

check().catch(console.error).finally(() => process.exit(0));
