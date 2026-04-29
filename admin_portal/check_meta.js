const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
require('dotenv').config({ path: '.env.local' });

const serviceAccountRaw = process.env.ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let parsedServiceAccount;
try {
  parsedServiceAccount = JSON.parse(serviceAccountRaw);
} catch(e) {
  const sanitized = serviceAccountRaw.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  parsedServiceAccount = JSON.parse(sanitized);
}

initializeApp({
  credential: cert(parsedServiceAccount),
  storageBucket: 'aylar-a45af.firebasestorage.app'
});

async function check() {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'kermes_parking/FqEryG6UAXn4mLna2j8S/1777456594315.jpg' });
  
  if (files.length === 0) {
      console.log("File not found!");
      return;
  }
  
  const file = files[0];
  const [metadata] = await file.getMetadata();
  console.log("File Metadata:");
  console.log(JSON.stringify(metadata, null, 2));
}

check().catch(console.error);
