const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
    admin.initializeApp();
} catch (error) {
    console.log("Firebase default init failed, please ensure you are authenticated:", error);
    process.exit(1);
}

const db = admin.firestore();

// Deep merge utility
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

function deepMerge(target, source) {
    let output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = deepMerge(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

async function syncTranslations() {
    const messagesDir = path.join(__dirname, '../messages');
    const files = fs.readdirSync(messagesDir).filter(file => file.endsWith('.json'));

    const batch = db.batch();

    for (const file of files) {
        const langCode = file.replace('.json', '');
        const filePath = path.join(messagesDir, file);

        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const localTranslations = JSON.parse(fileContent);

            const docRef = db.collection('translations').doc(langCode);

            // Get current translations from Firestore
            const docSnap = await docRef.get();
            let firestoreTranslations = {};
            if (docSnap.exists) {
                firestoreTranslations = docSnap.data() || {};
            }

            // Merge local OVER firestore? Actually, we want to keep what is in local, 
            // but if firestore has custom edits, we don't want to lose them!
            // But if the issue is that Firestore is MISSING keys because of a strict setDoc,
            // we should merge Firestore over Local to preserve edits, and then save the resulting 
            // complete tree back to Firestore.
            const mergedTranslations = deepMerge(localTranslations, firestoreTranslations);

            // Save complete tree back to Firestore
            batch.set(docRef, mergedTranslations);

            console.log(`Synced ${langCode} translations with ${Object.keys(mergedTranslations).length} root namespaces.`);
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }

    try {
        await batch.commit();
        console.log("Successfully synchronized all local JSON files to Firestore.");
        process.exit(0);
    } catch (error) {
        console.error("Error committing to Firestore:", error);
        process.exit(1);
    }
}

syncTranslations();
