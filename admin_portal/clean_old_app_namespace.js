const fs = require('fs');
const admin = require('firebase-admin');

const envFile = fs.readFileSync('.env.local', 'utf8');
const keyLine = envFile.split('\n').find(line => line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
const keyString = keyLine.replace('FIREBASE_SERVICE_ACCOUNT_KEY=', '').trim();
const serviceAccount = JSON.parse(keyString);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

async function clean() {
    console.log("Starting cleanup...");
    const batch = db.batch();
    for (const lang of LANGUAGES) {
        batch.update(db.collection('translations').doc(lang), {
            App: admin.firestore.FieldValue.delete()
        });
    }
    await batch.commit();
    console.log("Successfully deleted 'App' field from all translation docs!");
}

clean().catch(console.error);
