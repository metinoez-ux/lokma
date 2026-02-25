const admin = require('firebase-admin');

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
      const hoursToday = oh.find(str => str.toLowerCase().startsWith(todayTr.toLowerCase()) || str.toLowerCase().startsWith(todayEn.toLowerCase()) || str.toLowerCase().startsWith('carsamba'));
      if (!hoursToday) {
         console.log(`- ${data.companyName}: Missing today's (${todayTr}) hours in array: `, oh);
         issues++;
      } else {
         if (hoursToday.toLowerCase().includes('kapalı') || hoursToday.toLowerCase().includes('closed') || hoursToday.toLowerCase().includes('kapali')) {
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
