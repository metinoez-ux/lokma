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
    const snapshot = await admin.firestore().collection('users').limit(500).get();
    
    let problemFound = false;
    snapshot.forEach(d => {
        const data = d.data();
        ["displayName", "email", "phoneNumber", "lastName", "firstName", "language", "city", "country"].forEach(field => {
            if (data[field] && typeof data[field] === 'object' && !(data[field] instanceof admin.firestore.Timestamp)) {
                console.log(`[!] User ${d.id} has object in string field ${field}:`, data[field]);
                problemFound = true;
            }
        });
        
        // Let's specifically check if there's any weird dates
        if (data.createdAt && typeof data.createdAt === 'object') {
             if (!(data.createdAt instanceof admin.firestore.Timestamp)) {
                  console.log(`[?] User ${d.id} has weird createdAt:`, data.createdAt);
             }
        }
    });

    if (!problemFound) {
        console.log("No obvious malformed object fields found in primitive string fields of users.");
    }
}
run().catch(console.error);
