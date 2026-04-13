const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const q = await db.collectionGroup('rosters').orderBy('createdAt', 'desc').limit(5).get();
  q.docs.forEach(d => {
    console.log(d.id, "batchId:", d.data().batchId, "status:", d.data().status);
  });
}

check();
