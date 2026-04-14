import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, '../service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Duplicate normalization logic here to keep script self-contained
function normalizeCountry(input) {
  if (!input) return "";
  const normalized = input.trim().toLowerCase();
  
  if (['almanya', 'deutschland', 'germany', 'de', 'allemagne'].includes(normalized)) return 'Deutschland';
  if (['türkiye', 'turkey', 'tr', 'turkei', 'türkei'].includes(normalized)) return 'Türkiye';
  if (['hollanda', 'nederland', 'netherlands', 'nl', 'holland', 'pays-bas'].includes(normalized)) return 'Nederland';
  if (['belçika', 'belgië', 'belgique', 'belgien', 'belgium', 'be'].includes(normalized)) return 'België';
  if (['fransa', 'france', 'fr', 'frankreich'].includes(normalized)) return 'France';
  if (['avusturya', 'österreich', 'austria', 'at', 'autriche'].includes(normalized)) return 'Österreich';
  if (['isviçre', 'schweiz', 'suisse', 'switzerland', 'ch', 'svizzera'].includes(normalized)) return 'Schweiz';
  if (['bulgaristan', 'bulgaria', 'bg', 'българия', 'bulgarien'].includes(normalized)) return 'Bulgaria';
  if (['sırbistan', 'serbia', 'rs', 'srbija', 'србија', 'serbien', 'serbie'].includes(normalized)) return 'Serbia';
  if (['norveç', 'norway', 'norge', 'no', 'norwegen', 'norvège'].includes(normalized)) return 'Norge';
  if (['italya', 'italia', 'italy', 'it', 'italien', 'italie'].includes(normalized)) return 'Italia';
  if (['ispanya', 'españa', 'spain', 'es', 'spanien', 'espagne'].includes(normalized)) return 'España';

  return input.charAt(0).toUpperCase() + input.slice(1);
}

// Fallback extractor logic for records that totally lack `country` field
function extractCountryFromAddress(addressStr) {
  if (typeof addressStr !== 'string') return null;
  const lower = addressStr.toLowerCase();
  
  if (lower.includes('almanya') || lower.includes('deutschland') || addressStr.endsWith(' DE') || addressStr === 'DE') return 'Deutschland';
  if (lower.includes('türkiy') || lower.includes('turkey') || addressStr.endsWith(' TR') || addressStr === 'TR') return 'Türkiye';
  if (lower.includes('nederland') || lower.includes('hollanda') || addressStr.endsWith(' NL') || addressStr === 'NL') return 'Nederland';
  if (lower.includes('belgië') || lower.includes('belçika') || addressStr.endsWith(' BE') || addressStr === 'BE') return 'België';
  if (lower.includes('bulgaristan') || lower.includes('bulgaria') || addressStr.endsWith(' BG') || addressStr === 'BG') return 'Bulgaria';
  if (lower.includes('sırbistan') || lower.includes('serbia') || addressStr.endsWith(' RS') || addressStr === 'RS') return 'Serbia';
  if (lower.includes('avusturya') || lower.includes('österreich') || addressStr.endsWith(' AT') || addressStr === 'AT') return 'Österreich';

  return null;
}

async function migrate() {
  const batchLimit = 500;
  let batch = db.batch();
  let count = 0;
  let totalMigrated = 0;

  // 1. Migrate Kermes Events
  console.log("Fetching kermes_events...");
  const kermesSnapshot = await db.collection('kermes_events').get();
  kermesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    let currentCountry = data.country || data.address?.country;
    let newCountry = '';

    if (currentCountry) {
       newCountry = normalizeCountry(currentCountry);
    } else if (typeof data.address === 'string') {
       newCountry = extractCountryFromAddress(data.address);
    }

    if (newCountry && newCountry !== data.country) {
      batch.update(doc.ref, { country: newCountry });
      count++;
      console.log(`[kermes_events] ${doc.id} - updated country to: ${newCountry}`);
    }

    if (count === batchLimit) {
      batch.commit();
      totalMigrated += count;
      batch = db.batch();
      count = 0;
    }
  });

  // 2. Migrate Businesses
  console.log("Fetching businesses...");
  const businessesSnapshot = await db.collection('businesses').get();
  businessesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    let currentCountry = data.address?.country;
    let newCountry = '';

    if (currentCountry) {
       newCountry = normalizeCountry(currentCountry);
    }

    // business schema usually has an object for address: { country, city, street, postalCode }
    if (newCountry && newCountry !== data.address?.country) {
      batch.update(doc.ref, { 
        'address.country': newCountry 
      });
      count++;
      console.log(`[businesses] ${doc.id} - updated address.country to: ${newCountry}`);
    }

    if (count === batchLimit) {
      batch.commit();
      totalMigrated += count;
      batch = db.batch();
      count = 0;
    }
  });

  if (count > 0) {
    await batch.commit();
    totalMigrated += count;
  }

  console.log(`\nMigration completed successfully. ${totalMigrated} documents updated.`);
}

migrate().catch(console.error);
