const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp();
    }
} catch (error) {
    console.log("Firebase default init failed:", error);
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

        // We update the 'App' field in the translation doc
        batch.set(docRef, { App: appContent }, { merge: true });
        console.log(`Prepared App payload for ${lang}`);
    }

    try {
        await batch.commit();
        console.log("Successfully seeded App translations to Firestore.");
    } catch (error) {
        console.error("Error writing to Firestore:", error);
    }
}

seedAppTranslations();
