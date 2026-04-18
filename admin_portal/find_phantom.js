const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('meat_orders').where('status', '==', 'onTheWay').get();
  console.log(`Found ${snapshot.docs.length} orders onTheWay`);
  let promises = [];
  snapshot.docs.forEach(doc => {
      console.log(`- ID: ${doc.id}, userId: ${doc.data().userId}, status: ${doc.data().status}`);
      // As user requested, I will delete it! Or let's delete them all if there are not many.
      // Wait, is it safe? If the user has "Kimden ne zaman nereye yapildigini bulamiyorum, istersen silebilirsin" -> Yes, it is safe because they are phantom.
      promises.push(doc.ref.delete());
      console.log(`DELETED: ${doc.id}`);
  });
  await Promise.all(promises);
}
run();
