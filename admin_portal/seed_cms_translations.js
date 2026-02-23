const admin = require('firebase-admin');
const fs = require('fs');

try {
    let serviceAccount;
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && fs.existsSync('.env.local')) {
        const envFile = fs.readFileSync('.env.local', 'utf8');
        const keyLine = envFile.split('\n').find(line => line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
        if (keyLine) {
            const keyString = keyLine.replace('FIREBASE_SERVICE_ACCOUNT_KEY=', '').trim();
            serviceAccount = JSON.parse(keyString);
        }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    }

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin initialized with service account.");
    } else {
        admin.initializeApp();
        console.log("Firebase Admin initialized with default credentials.");
    }
} catch (error) {
    console.log("Firebase init failed:", error);
    process.exit(1);
}

const db = admin.firestore();
const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

async function run() {
    for (const lang of LANGUAGES) {
        const path = `messages/${lang}.json`;
        if (fs.existsSync(path)) {
            const data = JSON.parse(fs.readFileSync(path, 'utf8'));
            if (data.PushNotifications) {
                 await db.collection('translations').doc(lang).set({
                     PushNotifications: data.PushNotifications
                 }, { merge: true });
                 console.log(`Saved PushNotifications to ${lang}`);
            }
        }
    }
}
run();
