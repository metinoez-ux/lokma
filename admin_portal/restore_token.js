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
  
  if (files.length === 0) return;
  const file = files[0];
  
  // Set the token that was in the URL!
  await file.setMetadata({
      metadata: {
          firebaseStorageDownloadTokens: 'da48d058-3c6f-4906-ab9e-3964882d2cdb'
      }
  });
  console.log("Restored token in metadata!");
}

check().catch(console.error);
