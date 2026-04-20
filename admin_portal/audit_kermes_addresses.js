// Kermes Address Deep Audit Script
// Reads all kermes documents and reports address inconsistencies

const admin = require('firebase-admin');
const path = require('path');

// Init Firebase Admin
const serviceAccountPath = path.join(__dirname, 'service-account.json');
let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (e) {
  // Try alternative paths
  try {
    serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  } catch (e2) {
    console.error('No service account key found. Trying default credentials.');
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

async function auditKermesAddresses() {
  console.log('=== KERMES ADDRESS DEEP AUDIT ===\n');
  
  const snapshot = await db.collection('kermes_events').get();
  console.log(`Total kermes documents: ${snapshot.docs.length}\n`);
  
  const issues = [];
  const allEvents = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    const name = data.name || data.title || 'NO_NAME';
    
    // Extract address fields
    let address = '';
    let city = '';
    let postalCode = '';
    let country = '';
    let state = '';
    let latitude = 0;
    let longitude = 0;
    
    if (data.address && typeof data.address === 'object') {
      address = data.address.fullAddress || data.address.street || '';
      city = data.address.city || '';
      postalCode = data.address.postalCode || '';
      country = data.address.country || '';
      state = data.address.state || '';
    } else if (typeof data.address === 'string') {
      address = data.address;
    }
    
    // Top-level overrides
    if (data.city) city = data.city;
    if (data.country) country = data.country;
    if (data.state) state = data.state;
    if (data.postalCode) postalCode = data.postalCode;
    
    // Coordinates
    if (data.latitude != null) latitude = data.latitude;
    else if (data.lat != null) latitude = data.lat;
    else if (data.address?.lat != null) latitude = data.address.lat;
    else if (data.address?.latitude != null) latitude = data.address.latitude;
    
    if (data.longitude != null) longitude = data.longitude;
    else if (data.lng != null) longitude = data.lng;
    else if (data.address?.lng != null) longitude = data.address.lng;
    else if (data.address?.longitude != null) longitude = data.address.longitude;
    
    if (data.location && typeof data.location === 'object') {
      if (data.location.lat != null) latitude = data.location.lat;
      if (data.location.lng != null) longitude = data.location.lng;
    }
    
    if (data.geoPoint && data.geoPoint._latitude != null) {
      latitude = data.geoPoint._latitude;
      longitude = data.geoPoint._longitude;
    }
    
    const event = { id, name, address, city, postalCode, country, state, latitude, longitude };
    allEvents.push(event);
    
    const eventIssues = [];
    
    // Check: Missing country
    if (!country || country.trim() === '') {
      eventIssues.push('MISSING_COUNTRY');
    }
    
    // Check: Country is ISO code instead of full name
    if (country && country.length <= 3 && /^[A-Z]{2,3}$/.test(country.toUpperCase())) {
      eventIssues.push(`COUNTRY_IS_ISO_CODE: "${country}"`);
    }
    
    // Check: Non-standard country name (mixed languages)
    const knownCountries = {
      'de': ['Deutschland', 'Almanya', 'Germany', 'DE'],
      'no': ['Norwegen', 'Norvec', 'Norway', 'NO', 'Norge'],
      'tr': ['Turkiye', 'Turkey', 'TR'],
      'at': ['Osterreich', 'Avusturya', 'Austria', 'AT'],
      'fr': ['Frankreich', 'Fransa', 'France', 'FR'],
      'nl': ['Niederlande', 'Hollanda', 'Netherlands', 'NL'],
      'be': ['Belgien', 'Belcika', 'Belgium', 'BE'],
      'ch': ['Schweiz', 'Isvicre', 'Switzerland', 'CH'],
      'bg': ['Bulgarien', 'Bulgaristan', 'Bulgaria', 'BG'],
      'rs': ['Serbien', 'Sirbistan', 'Serbia', 'RS'],
      'hu': ['Ungarn', 'Macaristan', 'Hungary', 'HU'],
      'dk': ['Danemark', 'Danimarka', 'Denmark', 'DK'],
      'se': ['Schweden', 'Isvec', 'Sweden', 'SE'],
      'ro': ['Rumanien', 'Romanya', 'Romania', 'RO'],
    };
    
    // Check: Missing state/Bundesland
    if (!state || state.trim() === '') {
      eventIssues.push('MISSING_STATE');
    }
    
    // Check: Missing city
    if (!city || city.trim() === '' || city === 'Bilinmiyor') {
      eventIssues.push('MISSING_CITY');
    }
    
    // Check: Missing postal code
    if (!postalCode || postalCode.trim() === '') {
      eventIssues.push('MISSING_POSTAL_CODE');
    }
    
    // Check: Invalid/Missing coordinates
    if (latitude === 0 && longitude === 0) {
      eventIssues.push('MISSING_COORDINATES');
    } else if (latitude === 51.0 && longitude === 6.0) {
      eventIssues.push('PLACEHOLDER_COORDINATES (51.0, 6.0)');
    }
    
    // Check: Address format consistency
    if (address && address.includes('undefined')) {
      eventIssues.push('ADDRESS_CONTAINS_UNDEFINED');
    }
    
    if (eventIssues.length > 0) {
      issues.push({ ...event, issues: eventIssues });
    }
  }
  
  // Print all events summary
  console.log('--- ALL KERMES EVENTS ---');
  console.log('');
  for (const e of allEvents) {
    console.log(`ID: ${e.id}`);
    console.log(`  Name: ${e.name}`);
    console.log(`  City: "${e.city}" | PostalCode: "${e.postalCode}"`);
    console.log(`  Country: "${e.country}" | State: "${e.state}"`);
    console.log(`  Address: "${e.address}"`);
    console.log(`  Coords: (${e.latitude}, ${e.longitude})`);
    console.log('');
  }
  
  // Print issues
  console.log('\n--- ISSUES FOUND ---');
  console.log(`${issues.length} events with issues out of ${allEvents.length} total\n`);
  
  for (const issue of issues) {
    console.log(`[${issue.name}] (ID: ${issue.id})`);
    for (const iss of issue.issues) {
      console.log(`  - ${iss}`);
    }
    console.log('');
  }
  
  // Summary statistics
  const stats = {
    total: allEvents.length,
    missingCountry: issues.filter(i => i.issues.includes('MISSING_COUNTRY')).length,
    missingState: issues.filter(i => i.issues.some(x => x === 'MISSING_STATE')).length,
    missingCity: issues.filter(i => i.issues.some(x => x === 'MISSING_CITY')).length,
    missingPostal: issues.filter(i => i.issues.some(x => x === 'MISSING_POSTAL_CODE')).length,
    missingCoords: issues.filter(i => i.issues.some(x => x.includes('COORDINATES'))).length,
    isoCountry: issues.filter(i => i.issues.some(x => x.includes('COUNTRY_IS_ISO_CODE'))).length,
  };
  
  console.log('\n--- SUMMARY ---');
  console.log(JSON.stringify(stats, null, 2));
  
  process.exit(0);
}

auditKermesAddresses().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
