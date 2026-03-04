const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let key = null;
for (const line of env.split('\n')) {
  if (line.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
    key = line.substring('FIREBASE_SERVICE_ACCOUNT_KEY='.length);
    if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);
    if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
    break;
  }
}
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = key;

const admin = require('firebase-admin');
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.log("Firebase init failed:", error);
  process.exit(1);
}

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('businesses').where('isActive', '==', true).get();
  let issues = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const oh = data.openingHours;
    if (!oh) {
      console.log(`- ${data.companyName} (ID: ${doc.id}) has NO openingHours. Admin=Closed, App=Open`);
      issues++;
      continue;
    }
    
    const todayTr = 'Çarşamba';
    const todayEn = 'Wednesday';
    
    if (Array.isArray(oh)) {
      const hoursToday = oh.find(str => 
         str.toLowerCase().startsWith(todayTr.toLowerCase()) || 
         str.toLowerCase().startsWith(todayEn.toLowerCase()) || 
         str.toLowerCase().startsWith('carsamba') ||
         str.toLowerCase().startsWith('çarşamba')
      );
      if (!hoursToday) {
         console.log(`- ${data.companyName}: Missing today's (${todayTr}) hours in array: `, oh);
         issues++;
      } else {
         const lowerHours = hoursToday.toLowerCase();
         if (lowerHours.includes('kapalı') || lowerHours.includes('closed') || lowerHours.includes('kapali')) {
             console.log(`- ${data.companyName}: Closed today. -> ${hoursToday}`);
         }
      }
    } else {
      console.log(`- ${data.companyName}: openingHours is string: ${oh}`);
    }
  }
  console.log(`Found ${issues} businesses with potential openingHours issues.`);
}
run();
