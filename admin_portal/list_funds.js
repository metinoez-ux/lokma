const admin = require('firebase-admin');
const { readFileSync } = require('fs');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'mira-1b3c9' // I will assume this or check firebaserc
    });
}
const db = admin.firestore();

async function run() {
    const snap = await db.collection('donation_funds').get();
    snap.forEach(doc => {
        console.log(doc.id, doc.data().name);
    });
}
run();
