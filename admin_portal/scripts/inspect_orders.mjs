import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert("/Users/metinoz/Developer/LOKMA_MASTER/tuna_firebase_service_account.json")
    });
}
const db = admin.firestore();

async function run() {
  const kermesRes = await db.collection('kermes_events').orderBy('createdAt', 'desc').limit(1).get();
  if (kermesRes.empty) return;
  const kId = kermesRes.docs[0].id;
  const ev = kermesRes.docs[0].data();
  console.log("Kermes ID:", kId, ev.name);
  console.log("tableSectionsV2:", ev.tableSectionsV2);
  console.log("deliveryZones:", ev.deliveryZones);

  const ordRes = await db.collection('kermes_orders').where('kermesId', '==', kId).limit(5).get();
  ordRes.forEach(d => {
    const o = d.data();
    console.log("-------------------");
    console.log("Order ID:", d.id);
    console.log("tableSection:", o.tableSection);
    const items = o.items || [];
    console.log("items prepzones:", items.map(i => i.prepZones || i.prepZone));
  });
  
  process.exit(0);
}

run().catch(console.error);
