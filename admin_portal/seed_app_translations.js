const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

try {
    let serviceAccount;
    // Attempt to load from .env.local if FIREBASE_SERVICE_ACCOUNT_KEY is missing
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
const TRANSLATIONS_DIR = path.join(__dirname, '../mobile_app/assets/translations');

async function seedAppTranslations() {
    const batch = db.batch();

    for (const lang of LANGUAGES) {
        const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
        let appContent = {};

        if (fs.existsSync(filePath)) {
            try {
                appContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (e) {
                console.error(`Error parsing ${lang}.json:`, e);
            }
        } else {
            console.warn(`Warning: ${lang}.json not found in mobile_app/assets/translations`);
        }

        const docRef = db.collection('translations').doc(lang);

        // We merge all top-level domains into the translation doc
        // This makes `driver`, `kermes`, `auth` show up as standalone categories
        batch.set(docRef, appContent, { merge: true });
        console.log(`Prepared payload for ${lang} with ${Object.keys(appContent).length} root categories`);
    }

    try {
        await batch.commit();
        console.log("Successfully seeded App translations to Firestore.");
    } catch (error) {
        console.error("Error writing to Firestore:", error);
    }
}

seedAppTranslations();
