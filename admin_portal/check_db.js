const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json'); // assuming it's here

if (!getFirestore) {
  console.log("Firebase not init");
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const usersRef = db.collection('users');
  const q = await usersRef.where('displayName', '>=', 'Sevket').limit(5).get();
  q.forEach(doc => {
    console.log('User:', doc.id, doc.data().displayName);
  });
  
  const adminsRef = db.collection('admins');
  const a = await adminsRef.get();
  a.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.includes('Sevket') || data.displayName && data.displayName.includes('Sevket')) {
      console.log('Admin:', doc.id, data);
    }
  });
}
run().then(() => process.exit(0));
