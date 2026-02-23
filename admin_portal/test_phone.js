var admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function run() {
    const snap = await db.collection('users').limit(10).get();
    snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.phoneNumber) {
            console.log("Phone string format:", data.phoneNumber);
        }
    });

    // Check meat_orders too
    const ordersSnap = await db.collection('meat_orders').orderBy('createdAt', 'desc').limit(10).get();
    ordersSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.customerPhone) {
            console.log("Order customerPhone:", data.customerPhone);
        }
    });
}
run();
