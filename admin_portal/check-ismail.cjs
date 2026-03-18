const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(process.cwd(), ".env.local");
let serviceAccountKey = '';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
            serviceAccountKey = line.substring('FIREBASE_SERVICE_ACCOUNT_KEY='.length).trim();
            if (serviceAccountKey.startsWith("'") || serviceAccountKey.startsWith('"')) {
                serviceAccountKey = serviceAccountKey.slice(1, -1);
            }
            break;
        }
    }
}

const parsedKey = JSON.parse(serviceAccountKey);
admin.initializeApp({
    credential: admin.credential.cert(parsedKey),
    projectId: parsedKey.project_id
});

async function run() {
    const snapshot = await admin.firestore().collection('users')
        .where('email', '==', 'ismail.erkan@lokma.shop')
        .get();
    
    if (snapshot.empty) {
         console.log("No user found with email ismail.erkan@lokma.shop");
         // try displayName
         const snap2 = await admin.firestore().collection('users')
            .where('displayName', '==', 'Ismail Erkan').get();
         snap2.forEach(d => console.log(JSON.stringify(d.data(), null, 2)));
    } else {
         snapshot.forEach(d => console.log(JSON.stringify(d.data(), null, 2)));
    }
}
run().catch(console.error);
