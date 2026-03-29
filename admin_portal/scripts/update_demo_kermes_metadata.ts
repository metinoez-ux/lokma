import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '../service-account.json');
let db: any;
try {
  if (fs.existsSync(serviceAccountPath)) {
    initializeApp({
      credential: cert(serviceAccountPath)
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
      projectId: 'aylar-a45af'
    });
  }
  db = getFirestore();
} catch (e) {
  console.log("Already initialized");
  db = getFirestore();
}

const firstNames = ["Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "Ömer", "Osman", "Murat", "İbrahim", "Emre", "Burak", "Fatih", "Yusuf", "Kemal", "Bekir", "Enes", "Salih"];
const lastNames = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Koç", "Öztürk", "Güneş"];

function generateName() {
  const f = firstNames[Math.floor(Math.random() * firstNames.length)];
  const l = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${f} ${l}`;
}

function generatePhone(address: string, city: string) {
  const loc = (address + " " + city).toLowerCase();
  
  let prefix = "+49 157"; // Germany default
  if (loc.includes("norveç") || loc.includes("drammen")) {
    prefix = "+47 4";
  } else if (loc.includes("sırbistan") || loc.includes("belgrad") || loc.includes("novi sad") || loc.includes("subotica")) {
    prefix = "+381 60";
  } else if (loc.includes("meksika") || loc.includes("mexico")) {
    prefix = "+52 55";
  }

  const number = Math.floor(1000000 + Math.random() * 9000000);
  return `${prefix} ${number}`;
}

async function updateDemoMetadata() {
  console.log("Fetching all demo Kermes events...");
  const snapshot = await db.collection('kermes_events').get();
  const kermeses = snapshot.docs;

  console.log(`Found ${kermeses.length} Kermes events. Starting update...`);
  
  const batch = db.batch();
  let updatedCount = 0;

  for (const doc of kermeses) {
    const data = doc.data();
    
    // Sadece adresi vs. dolu olan gercek eventler
    // "Demo Kermes ve Ürün" customFeature ekle
    let customFeatures = data.customFeatures || [];
    if (!customFeatures.includes("🏷️ Demo Kermes & Ürün")) {
      customFeatures.unshift("🏷️ Demo Kermes & Ürün");
      if (customFeatures.length > 3) {
        customFeatures = customFeatures.slice(0, 3);
      }
    }

    const contactName = generateName();
    const phone = generatePhone(data.address || '', data.city || '');
    
    batch.update(doc.ref, {
      contactName: contactName,
      phoneNumber: phone,
      customFeatures: customFeatures,
      systemTags: ["DEMO_KERMES", "DEMO_URUN"]
    });
    
    updatedCount++;
    console.log(`Updated ${data.title} -> ${contactName} | ${phone}`);
  }

  await batch.commit();

  console.log(`\nSuccessfully updated ${updatedCount} demo Kermes events with contact names, phones, and tags.`);
}

updateDemoMetadata().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
