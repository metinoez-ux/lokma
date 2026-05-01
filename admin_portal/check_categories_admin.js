const admin = require('firebase-admin');

// Initialize Firebase Admin (assuming default credentials or emulators are set up)
// In this project, service-account.json is usually in admin_portal/ or functions/
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCategories() {
  try {
    // Assuming we don't know the exact business ID, let's find the one with 84 categories
    const businesses = await db.collection('businesses').get();
    
    for (const doc of businesses.docs) {
      const cats = await db.collection('businesses').doc(doc.id).collection('categories').get();
      if (cats.size > 2) {
        console.log(`Business ${doc.id} (${doc.data().name}) has ${cats.size} categories.`);
        const catNames = cats.docs.map(c => c.data().name);
        console.log(`Categories: ${catNames.slice(0, 5).join(', ')}...`);
      }
    }
    console.log('Done.');
  } catch (e) {
    console.error(e);
  }
}

checkCategories();
