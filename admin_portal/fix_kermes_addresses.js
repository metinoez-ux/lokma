// Kermes Address Standardization - Firestore Patch Script
// Uses Google Geocoding API to reverse-geocode all kermes events
// and fill missing country, countryCode, state, postalCode fields

const admin = require('firebase-admin');
const path = require('path');
const https = require('https');

const serviceAccount = require(path.join(__dirname, 'service-account.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const GOOGLE_API_KEY = 'AIzaSyB8Pvs-P4580Wsk4mT46cvGT7TGlZiLkWo';

// Country code -> German display name
const COUNTRY_DE_NAMES = {
  'DE': 'Deutschland',
  'NO': 'Norwegen',
  'TR': 'Turkei',
  'AT': 'Osterreich',
  'RS': 'Serbien',
  'BG': 'Bulgarien',
  'HU': 'Ungarn',
  'FR': 'Frankreich',
  'NL': 'Niederlande',
  'BE': 'Belgien',
  'CH': 'Schweiz',
  'MX': 'Mexiko',
  'DK': 'Danemark',
  'SE': 'Schweden',
  'ES': 'Spanien',
  'IT': 'Italien',
  'RO': 'Rumanien',
  'GR': 'Griechenland',
  'PL': 'Polen',
  'CZ': 'Tschechien',
  'HR': 'Kroatien',
  'SK': 'Slowakei',
  'SI': 'Slowenien',
  'GB': 'Vereinigtes Konigreich',
  'US': 'Vereinigte Staaten',
};

function reverseGeocode(lat, lng) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}&language=de&result_type=street_address|locality|administrative_area_level_1`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function extractComponentFromResults(results, type) {
  for (const result of results) {
    for (const comp of result.address_components || []) {
      if (comp.types.includes(type)) {
        return comp;
      }
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fixAllAddresses() {
  console.log('=== KERMES ADDRESS FIX SCRIPT ===\n');
  
  const snapshot = await db.collection('kermes_events').get();
  console.log(`Total kermes documents: ${snapshot.docs.length}\n`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    const name = data.name || data.title || 'NO_NAME';
    
    // Extract current data
    let latitude = 0, longitude = 0;
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
    
    if (latitude === 0 && longitude === 0) {
      console.log(`[SKIP] ${name} (${id}) - No coordinates`);
      errorCount++;
      continue;
    }
    
    try {
      console.log(`[PROCESSING] ${name} (${id}) @ (${latitude}, ${longitude})`);
      
      // Rate limit - Google allows 50 requests per second
      await sleep(250);
      
      const geoResult = await reverseGeocode(latitude, longitude);
      
      if (geoResult.status !== 'OK' || !geoResult.results || geoResult.results.length === 0) {
        console.log(`  [WARN] Geocode failed: ${geoResult.status}`);
        errorCount++;
        continue;
      }
      
      const results = geoResult.results;
      
      // Extract components
      const countryComp = extractComponentFromResults(results, 'country');
      const stateComp = extractComponentFromResults(results, 'administrative_area_level_1');
      const cityComp = extractComponentFromResults(results, 'locality') || 
                       extractComponentFromResults(results, 'administrative_area_level_2');
      const postalComp = extractComponentFromResults(results, 'postal_code');
      
      const countryCode = countryComp?.short_name || '';
      const countryName = COUNTRY_DE_NAMES[countryCode] || countryComp?.long_name || '';
      const stateName = stateComp?.long_name || '';
      const postalCode = postalComp?.long_name || '';
      const cityName = cityComp?.long_name || '';
      
      // Build the update payload
      const update = {};
      
      // Always set countryCode (new field)
      if (countryCode) {
        update['countryCode'] = countryCode;
      }
      
      // Always standardize country name
      if (countryName) {
        update['country'] = countryName;
      }
      
      // Fix state - only if it's missing or wrong
      const currentState = data.state || '';
      const currentCountry = data.country || '';
      const currentCountryCode = data.countryCode || '';
      
      // Detect wrong state (German state names applied to foreign countries)
      const germanStates = ['Baden-Wurttemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 
        'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen',
        'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thuringen'];
      
      const isNonGerman = countryCode && countryCode !== 'DE';
      const hasGermanState = germanStates.some(gs => 
        currentState.toLowerCase().replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a') === 
        gs.toLowerCase().replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a')
      );
      
      if (!currentState || (isNonGerman && hasGermanState)) {
        if (stateName) {
          update['state'] = stateName;
        }
      }
      
      // Fix postal code if missing
      if (!data.postalCode && postalCode) {
        update['postalCode'] = postalCode;
      }
      
      // Fix city if it's "Belirtilmemis" or empty
      const currentCity = data.city || (data.address?.city) || '';
      if (!currentCity || currentCity === 'Belirtilmemis' || currentCity === 'Belirtilmemiş') {
        if (cityName) {
          update['city'] = cityName;
        }
      }
      
      // Also update inside address object if it exists
      if (data.address && typeof data.address === 'object') {
        if (countryCode) update['address.countryCode'] = countryCode;
        if (countryName) update['address.country'] = countryName;
        if (!data.address.postalCode && postalCode) update['address.postalCode'] = postalCode;
        if ((!data.address.city || data.address.city === 'Belirtilmemiş') && cityName) {
          update['address.city'] = cityName;
        }
      }
      
      if (Object.keys(update).length > 0) {
        await db.collection('kermes_events').doc(id).update(update);
        console.log(`  [FIXED] ${JSON.stringify(update)}`);
        fixedCount++;
      } else {
        console.log(`  [OK] No changes needed`);
      }
      
    } catch (err) {
      console.log(`  [ERROR] ${err.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n=== DONE ===`);
  console.log(`Fixed: ${fixedCount} | Errors: ${errorCount} | Total: ${snapshot.docs.length}`);
  
  process.exit(0);
}

fixAllAddresses().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
