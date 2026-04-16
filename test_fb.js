const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
    const snap = await db.collection('kermes_events').limit(1).get();
    console.log(JSON.stringify(snap.docs[0].data(), null, 2));
    process.exit(0);
}
run();
