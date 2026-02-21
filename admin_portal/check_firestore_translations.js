const fs = require('fs');
const admin = require('firebase-admin');

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
    } else {
        admin.initializeApp();
    }
} catch (error) {
    console.log("Firebase init failed:", error);
    process.exit(1);
}

const db = admin.firestore();

async function checkTranslations() {
    try {
        const docSnap = await db.collection('translations').doc('tr').get();
        if (docSnap.exists) {
            const data = docSnap.data();
            console.log("Top level keys in translations/tr:");
            console.log(Object.keys(data));
            if (data.App) {
                console.log("\nApp object contents:");
                console.log(JSON.stringify(data.App, null, 2));
            } else {
                console.log("\nNo 'App' key found at the root! Success!");
            }
        } else {
            console.log("Document translations/tr does not exist");
        }
    } catch (error) {
        console.error("Error reading Firestore:", error);
    }
}

checkTranslations();
