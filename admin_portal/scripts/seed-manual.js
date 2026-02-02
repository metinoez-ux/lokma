
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, serverTimestamp, query, where } = require('firebase/firestore');

// 1. Load Environment Variables manually
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[match[1].trim()] = value;
    }
});

const firebaseConfig = {
    apiKey: env['NEXT_PUBLIC_FIREBASE_API_KEY'],
    authDomain: env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
    projectId: env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
    storageBucket: env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
    messagingSenderId: env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
    appId: env['NEXT_PUBLIC_FIREBASE_APP_ID']
};

const GOOGLE_MAPS_KEY = env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'];

if (!firebaseConfig.apiKey || !GOOGLE_MAPS_KEY) {
    console.error('Missing keys in .env.local');
    process.exit(1);
}

// 2. Initialize Firebase Client
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Define Data
const BUTCHERS = [
    { name: 'TUNA Metzgerei', city: 'Hückelhoven' },
    { name: 'TUNA Metzgerei', city: 'Duisburg Hochfeld' },
    { name: 'TUNA Metzgerei', city: 'Duisburg Bruckhausen' },
    { name: 'TUNA Metzgerei', city: 'München' },
    { name: 'TUNA Metzgerei', city: 'Herne' },
    { name: 'TUNA Metzgerei', city: 'Dortmund' },
    { name: 'TUNA Metzgerei', city: 'Hamm' },
    { name: 'Tuna Metzgerei', city: 'Neu-Ulm' },
    { name: 'Tuna Hamburg', city: 'Hamburg' },
];

// 4. Seeding Logic
async function seed() {
    console.log('Starting Seeder (Client SDK)...');

    for (const b of BUTCHERS) {
        try {
            console.log(`Processing: ${b.name} - ${b.city}`);

            // Find Place
            const queryText = `${b.name} ${b.city}`;
            const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(queryText)}&inputtype=textquery&fields=place_id,geometry,name&key=${GOOGLE_MAPS_KEY}`;

            const searchRes = await fetch(searchUrl).then(r => r.json());

            if (!searchRes.candidates || searchRes.candidates.length === 0) {
                console.log(`  -> Not Found on Maps`);
                continue;
            }

            const placeId = searchRes.candidates[0].place_id;

            // Details
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,opening_hours,formatted_phone_number,rating,user_ratings_total,photos,place_id,address_components&language=tr&key=${GOOGLE_MAPS_KEY}`;
            const detailsRes = await fetch(detailsUrl).then(r => r.json());
            const details = detailsRes.result;

            if (!details) {
                console.log(`  -> No details returned`);
                continue;
            }

            // Transform
            const lat = details.geometry?.location?.lat || 0;
            const lng = details.geometry?.location?.lng || 0;

            let street = '';
            let route = '';
            let streetNumber = '';
            let postalCode = '';
            let city = '';
            let country = 'DE';

            if (details.address_components) {
                details.address_components.forEach(c => {
                    if (c.types.includes('route')) route = c.long_name;
                    if (c.types.includes('street_number')) streetNumber = c.long_name;
                    if (c.types.includes('postal_code')) postalCode = c.long_name;
                    if (c.types.includes('locality')) city = c.long_name;
                    if (c.types.includes('country')) country = c.short_name;
                });
                street = `${route} ${streetNumber}`.trim();
            }

            const fullAddress = details.formatted_address || '';
            if (!street) street = fullAddress.split(',')[0] || '';
            if (!city) city = b.city;

            let imageUrl = '';
            if (details.photos && details.photos.length > 0) {
                const ref = details.photos[0].photo_reference;
                imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${GOOGLE_MAPS_KEY}`;
            }

            const hours = {};
            if (details.opening_hours?.weekday_text) {
                details.opening_hours.weekday_text.forEach(text => {
                    const parts = text.split(': ');
                    if (parts.length > 1) {
                        const day = parts[0].toLowerCase();
                        hours[day] = parts.slice(1).join(': ');
                    }
                });
            }

            // ID Generation
            const cityPrefix = city.substring(0, 3).toUpperCase();
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            const customerId = `MK-G-${cityPrefix}${randomSuffix}`;

            const data = {
                name: details.name || b.name,
                companyName: details.name || b.name,
                uniqueName: `tuna-metzgerei-${city.toLowerCase().replace(/\s+/g, '-')}`, // URL friendly
                brand: 'tuna', // Lowercase
                brandLabelActive: true,
                isActive: true, // Auto-enable
                isApproved: true,
                location: city,
                businessCategories: ['kasap'],
                salesType: 'retail',
                subscriptionPlan: 'premium',
                subscriptionStatus: 'active',
                monthlyFee: 99.00,
                accountBalance: 0,
                miraAppConnected: true,
                contactPerson: {
                    name: 'Mağaza',
                    surname: 'Yöneticisi',
                    phone: details.formatted_phone_number || '',
                    email: `info@${city.toLowerCase().replace(/\s+/g, '')}.tuna.de`,
                    role: 'manager'
                },
                address: {
                    street,
                    postalCode,
                    city,
                    country,
                    full: fullAddress
                },
                coordinates: {
                    latitude: lat,
                    longitude: lng
                },
                rating: details.rating || 0,
                reviewCount: details.user_ratings_total || 0,
                phone: details.formatted_phone_number || '',
                googlePlaceId: placeId,
                shopPhone: details.formatted_phone_number || '',
                hours: hours,
                googleMapsUrl: details.url || `https://maps.google.com/?q=place_id:${placeId}`,
                updatedAt: serverTimestamp(),
            };

            if (imageUrl) data.imageUrl = imageUrl;

            // Upsert
            const butchersRef = collection(db, 'butcher_partners');
            const q = query(butchersRef, where('googlePlaceId', '==', placeId));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                const existing = docSnap.data();
                if (existing.customerId) {
                    delete data.customerId;
                }
                await updateDoc(docSnap.ref, data);
                console.log(`  -> Updated: ${docSnap.id}`);
            } else {
                data.createdAt = serverTimestamp();
                data.customerId = customerId;
                await addDoc(butchersRef, data);
                console.log(`  -> Created New`);
            }

        } catch (e) {
            console.error(`  -> Error: ${e.message}`);
            // Check for explicit insufficient permissions
            if (e.code === 'permission-denied') {
                console.error('  !!! PERMISSION DENIED: Database rules prevent writing without auth. !!!');
                // Could verify if we can sign in anonymously here if needed
            }
        }

        await new Promise(r => setTimeout(r, 200));
    }

    console.log('Seeding Complete.');
}

seed();
