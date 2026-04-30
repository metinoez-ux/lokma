const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
async function run() {
  const db = admin.firestore();
  
  // 1. Get Hilal Market
  const all = await db.collection('businesses').get();
  let hilalId = null;
  all.forEach(doc => {
      const title = doc.data().title || '';
      if (title.toLowerCase().includes('hilal')) {
          console.log('Found Hilal Market:', doc.id, title);
          hilalId = doc.id;
      }
  });

  // 2. Check a master catalog product
  const catalog = await db.collection('master_catalog_products').limit(1).get();
  catalog.forEach(doc => {
      console.log('Sample catalog product:', doc.id, doc.data());
  });
}
run().catch(console.error).then(() => process.exit(0));
