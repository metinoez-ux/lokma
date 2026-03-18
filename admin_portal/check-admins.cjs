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
    const snapshot = await admin.firestore().collection('admins').get();
    const adminsList = [];
    snapshot.forEach(d => {
        adminsList.push({ id: d.id, ...d.data() });
    });
    fs.writeFileSync('/tmp/admins_dump.json', JSON.stringify(adminsList, null, 2));
    console.log('Dumped to /tmp/admins_dump.json');
}
run().catch(console.error);
