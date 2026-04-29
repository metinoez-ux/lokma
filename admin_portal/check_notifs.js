const admin = require('firebase-admin');
admin.initializeApp();

async function run() {
  const db = admin.firestore();
  // find metin
  const snap = await db.collection('users').where('email', '==', 'metin.oez@gmail.com').get();
  if (snap.empty) {
    console.log("no user");
    return;
  }
  const uid = snap.docs[0].id;
  const notifs = await db.collection('users').doc(uid).collection('notifications')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  
  notifs.docs.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id}`);
    console.log(`Type: ${data.type}`);
    console.log(`Title: ${data.title}`);
    console.log(`ImageUrl: ${data.imageUrl || data.image || 'NONE'}`);
    console.log('---');
  });
}

run().catch(console.error);
