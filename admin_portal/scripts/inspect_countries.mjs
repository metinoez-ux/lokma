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

async function inspectCountries() {
  const collections = ['kermes_events', 'businesses'];
  for (const collection of collections) {
    console.log(`\nInspecting ${collection}...`);
    const snapshot = await db.collection(collection).get();
    const countries = new Map();
    const addressCountries = new Map();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      let country = data.country;
      let addressCountry = data.address?.country;
      
      if (!country) country = 'MISSING';
      if (!addressCountry) addressCountry = 'MISSING';

      if (countries.has(country)) {
          countries.set(country, countries.get(country) + 1);
      } else {
          countries.set(country, 1);
      }

      if (addressCountries.has(addressCountry)) {
          addressCountries.set(addressCountry, addressCountries.get(addressCountry) + 1);
      } else {
          addressCountries.set(addressCountry, 1);
      }
    });

    console.log(`Unique 'country' fields in ${collection}:`);
    for (const [country, count] of countries.entries()) {
      console.log(`- "${country}": ${count} records`);
    }

    console.log(`Unique 'address.country' fields in ${collection}:`);
    for (const [country, count] of addressCountries.entries()) {
      console.log(`- "${country}": ${count} records`);
    }
  }
}

inspectCountries().catch(console.error);
