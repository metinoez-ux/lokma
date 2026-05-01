const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'admin_portal'
});

async function run() {
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  
  // Try meat_orders
  const meat = await db.collection('meat_orders').limit(1).get();
  console.log("meat_orders count:", meat.size);
  
  // Try kermes_orders
  const kermes = await db.collection('kermes_orders').where('status', '==', 'ready').get();
  console.log("kermes_orders ready count:", kermes.size);
  kermes.forEach(doc => console.log(doc.id, doc.data().butcherName, doc.data().kermesId, doc.data().businessId));
}

run().then(() => console.log('Done'));
