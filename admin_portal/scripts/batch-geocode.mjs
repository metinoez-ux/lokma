/**
 * Batch Geocoding Script for LOKMA Businesses
 * 
 * Finds all businesses in Firestore that are missing lat/lng coordinates,
 * geocodes their addresses using Google Geocoding API, and updates Firestore.
 * 
 * Uses Firebase client SDK (reads .env.local for config).
 * Must be run from admin_portal directory.
 * 
 * Usage: 
 *   node scripts/batch-geocode.mjs --dry-run   (preview only)
 *   node scripts/batch-geocode.mjs              (update Firestore)
 */

import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// --- Load .env.local ---
try {
  const envContent = readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx);
      const val = trimmed.substring(eqIdx + 1);
      process.env[key] = val;
    }
  }
} catch {
  console.error('Cannot read .env.local -- run this from admin_portal directory');
  process.exit(1);
}

// --- Config ---
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

// --- Init Firebase ---
const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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
  console.log(`    Geocoding status: ${data.status} ${data.error_message || ''}`);
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
  
  if (data.companyAddress && typeof data.companyAddress === 'string') {
    return data.companyAddress;
  }
  
  return null;
}

function hasCoordinates(data) {
  if (typeof data.lat === 'number' && typeof data.lng === 'number' && data.lat !== 0 && data.lng !== 0) return true;
  if (data.address && typeof data.address === 'object') {
    if (typeof data.address.lat === 'number' && typeof data.address.lng === 'number' && data.address.lat !== 0 && data.address.lng !== 0) return true;
  }
  if (data.placeDetails && typeof data.placeDetails === 'object') {
    if (typeof data.placeDetails.lat === 'number' && typeof data.placeDetails.lng === 'number') return true;
  }
  return false;
}

// --- Main ---
async function main() {
  console.log(`\n=== LOKMA Batch Geocoding ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update Firestore)'}\n`);
  
  const snapshot = await getDocs(collection(db, 'businesses'));
  console.log(`Total businesses: ${snapshot.size}`);
  
  const missing = [];
  const hasCoords = [];
  const noAddress = [];
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const name = data.companyName || data.businessName || docSnap.id;
    
    if (hasCoordinates(data)) {
      hasCoords.push(name);
      continue;
    }
    
    const address = buildAddressString(data);
    if (!address) {
      noAddress.push({ id: docSnap.id, name });
      continue;
    }
    
    missing.push({ id: docSnap.id, name, address, data });
  }
  
  console.log(`  With coordinates: ${hasCoords.length}`);
  console.log(`  Missing coordinates: ${missing.length}`);
  console.log(`  No address to geocode: ${noAddress.length}`);
  
  if (noAddress.length > 0) {
    console.log(`\n--- NO ADDRESS (cannot geocode) ---`);
    for (const b of noAddress) {
      console.log(`  [SKIP] ${b.name} (${b.id})`);
    }
  }
  
  if (missing.length === 0) {
    console.log('\nAll businesses already have coordinates!');
    return;
  }
  
  console.log(`\n--- Geocoding ${missing.length} businesses ---`);
  
  let updated = 0;
  let failed = 0;
  
  for (const biz of missing) {
    console.log(`  [GEOCODE] ${biz.name}: "${biz.address}"`);
    
    try {
      const result = await geocodeAddress(biz.address);
      
      if (result) {
        console.log(`    -> lat=${result.lat}, lng=${result.lng} (${result.formattedAddress})`);
        
        if (!DRY_RUN) {
          const docRef = doc(db, 'businesses', biz.id);
          await updateDoc(docRef, { lat: result.lat, lng: result.lng });
          console.log(`    -> UPDATED`);
        } else {
          console.log(`    -> (dry run)`);
        }
        updated++;
      } else {
        console.log(`    -> FAILED: No result`);
        failed++;
      }
      
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log(`    -> ERROR: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total with coords now: ${hasCoords.length + updated}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
