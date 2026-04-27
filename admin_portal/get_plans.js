const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const app = initializeApp({
  projectId: "lokma-686be",
});
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "subscription_plans"));
  snap.docs.forEach(d => console.log(d.id, d.data().code, d.data().name));
}
run().catch(console.error);
