const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const camlicaId = 'KC9jWUCXgNJHtkmQLNO3'; // Camlica Döner ID
  await db.collection('businesses').doc(camlicaId).update({
      brand: '',
      brandLabelActive: false,
      isTunaPartner: false
  });
  console.log("Camlica Doner fixed.");
}
run();
