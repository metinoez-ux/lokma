const admin = require('firebase-admin');

// check .env.local
const fs = require('fs');
let serviceAccount;
if (fs.existsSync('.env.local')) {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const keyLine = envFile.split('\n').find(line => line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
    if (keyLine) {
        const keyString = keyLine.replace('FIREBASE_SERVICE_ACCOUNT_KEY=', '').trim();
        serviceAccount = JSON.parse(keyString);
    }
}

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    admin.initializeApp();
}

const db = admin.firestore();

async function checkTrans() {
    const doc = await db.collection('translations').doc('en').get();
    if (doc.exists) {
        console.log("Found English translations!");
        const data = doc.data();
        console.log("Keys available:", Object.keys(data));
        console.log("Has PushNotifications:", !!data.PushNotifications);
        if (data.PushNotifications) console.log(data.PushNotifications);
    } else {
        console.log("No English translations document found.");
    }
}
checkTrans();
