/**
 * Batch Geocoding Script for LOKMA Businesses (Admin SDK)
 * 
 * Finds all businesses in Firestore missing lat/lng coordinates,
 * geocodes their addresses via Google Geocoding API, updates Firestore.
 * 
 * Usage: 
 *   node scripts/batch-geocode-admin.mjs --dry-run   (preview)
 *   node scripts/batch-geocode-admin.mjs              (live update)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// --- Config ---
const GOOGLE_API_KEY = 'AIzaSyB8Pvs-P4580Wsk4mT46cvGT7TGlZiLkWo';
const DRY_RUN = process.argv.includes('--dry-run');

// --- Init Firebase Admin ---
const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf-8'));
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'aylar-a45af',
});
const db = getFirestore(app);

// --- Geocoding ---
async function geocodeAddress(address) {
  const encoded = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng, formattedAddress: data.results[0].formatted_address };
  }
  return null;
}

function buildAddressString(data) {
  const addr = data.address;
  if (addr && typeof addr === 'object') {
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.houseNumber) parts.push(addr.houseNumber);
    if (addr.zipCode || addr.zip) parts.push(addr.zipCode || addr.zip);
    if (addr.city) parts.push(addr.city);
    if (addr.country) parts.push(addr.country);
    if (parts.length >= 2) return parts.join(' ');
  }
  const flatParts = [];
  if (data.street) flatParts.push(data.street);
  if (data.houseNumber) flatParts.push(data.houseNumber);
  if (data.zipCode || data.zip || data.plz) flatParts.push(data.zipCode || data.zip || data.plz);
  if (data.city) flatParts.push(data.city);
  if (data.country) flatParts.push(data.country);
  if (flatParts.length >= 2) return flatParts.join(' ');
  if (data.companyAddress && typeof data.companyAddress === 'string') return data.companyAddress;
  return null;
}

function hasCoordinates(data) {
  if (typeof data.lat === 'number' && typeof data.lng === 'number' && data.lat !== 0 && data.lng !== 0) return true;
  if (data.address && typeof data.address === 'object') {
    if (typeof data.address.lat === 'number' && typeof data.address.lng === 'number' && data.address.lat !== 0 && data.address.lng !== 0) return true;
  }
  return false;
}

// --- Main ---
async function main() {
  console.log(`\n=== LOKMA Batch Geocoding (Admin SDK) ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);
  
  const snapshot = await db.collection('businesses').get();
  console.log(`Total businesses: ${snapshot.size}`);
  
  const missing = [];
  const hasCoords = [];
  const noAddress = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.companyName || data.businessName || doc.id;
    if (hasCoordinates(data)) { hasCoords.push(name); continue; }
    const address = buildAddressString(data);
    if (!address) { noAddress.push({ id: doc.id, name }); continue; }
    missing.push({ id: doc.id, name, address });
  }
  
  console.log(`  With coordinates: ${hasCoords.length}`);
  console.log(`  Missing coordinates: ${missing.length}`);
  console.log(`  No address: ${noAddress.length}`);
  
  if (noAddress.length > 0) {
    console.log(`\n--- NO ADDRESS ---`);
    noAddress.forEach(b => console.log(`  [SKIP] ${b.name} (${b.id})`));
  }
  
  if (missing.length === 0) { console.log('\nAll done!'); return; }
  
  console.log(`\n--- Geocoding ${missing.length} businesses ---`);
  let updated = 0, failed = 0;
  
  for (const biz of missing) {
    console.log(`  [GEOCODE] ${biz.name}: "${biz.address}"`);
    try {
      const result = await geocodeAddress(biz.address);
      if (result) {
        console.log(`    -> ${result.lat}, ${result.lng} (${result.formattedAddress})`);
        if (!DRY_RUN) {
          await db.collection('businesses').doc(biz.id).update({ lat: result.lat, lng: result.lng });
          console.log(`    -> UPDATED`);
        }
        updated++;
      } else {
        console.log(`    -> FAILED`);
        failed++;
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log(`    -> ERROR: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`  Updated: ${updated}  |  Failed: ${failed}`);
  console.log(`  Total with coords: ${hasCoords.length + updated} / ${snapshot.size}`);
}

main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
