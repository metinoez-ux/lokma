const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let keyStr = env.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.*)/)[1];
if (keyStr.startsWith("'") && keyStr.endsWith("'")) keyStr = keyStr.slice(1, -1);
if (keyStr.startsWith('"') && keyStr.endsWith('"')) keyStr = keyStr.slice(1, -1);
// Replace literal \n with actual newline
keyStr = keyStr.replace(/\\n/g, '\n');

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(keyStr))
});

const db = admin.firestore();

async function run() {
    console.log("Starting query...");
    const snapshot = await db.collection('businesses').get();
    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.isActive) continue;

        const oh = data.openingHours;
        console.log(`\n--- ${data.companyName} ---`);
        console.log(oh);
    }
}
run().catch(console.error);
