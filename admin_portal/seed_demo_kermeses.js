const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const serviceAccount = require('../admin_portal/service-account.json');

// Initialize Firebase
if (!require('firebase-admin/app').getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

function generateID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let autoId = '';
  for (let i = 0; i < 20; i++) {
    autoId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return autoId;
}

const demoKermeses = [
  {
    organizationName: "Stadtallendorf Yeni Camii / İslam Kültür Merkezleri Birliği",
    title: "Stadtallendorf Yeni Camii Kermesi",
    city: "Stadtallendorf",
    country: "Almanya",
    postalCode: "35260",
    address: "Albert-Schweitzer-Straße 20, 35260 Stadtallendorf",
    startDate: Timestamp.fromDate(new Date("2026-04-05T00:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2026-04-05T23:59:59Z")),
    openingTime: "14:00",
    closingTime: "22:00",
    latitude: 50.8286,
    longitude: 9.0116,
    isArchived: false,
    isActive: true,
    hasTakeaway: true,
    hasDineIn: true,
    contactName: "BIV Stadtallendorf",
    contactPhone: "+49 0123 456789",
    createdAt: Timestamp.now()
  },
  {
    organizationName: "Integrations- und Bildungsverein in Eschweiler e.V.",
    title: "Eschweiler Kermes Freundschaftsfest",
    city: "Eschweiler",
    country: "Almanya",
    postalCode: "52249",
    address: "Talstr. 152, 52249 Eschweiler",
    startDate: Timestamp.fromDate(new Date("2026-04-04T00:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2026-04-06T23:59:59Z")),
    openingTime: "11:00",
    closingTime: "21:00",
    latitude: 50.8033,
    longitude: 6.2736,
    isArchived: false,
    isActive: true,
    hasTakeaway: true,
    hasDineIn: true,
    contactName: "Eschweiler Verein",
    contactPhone: "+49 0123 456789",
    createdAt: Timestamp.now()
  },
  {
    organizationName: "Kultureller Bildungsverein Walsum e.V.",
    title: "Kermes Walsum 2026 - Frühlingsfest",
    city: "Duisburg",
    country: "Almanya",
    postalCode: "47178",
    address: "Römerstr. 295, 47178 Duisburg",
    startDate: Timestamp.fromDate(new Date("2026-04-04T00:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2026-04-12T23:59:59Z")),
    openingTime: "13:00",
    closingTime: "20:00",
    latitude: 51.5242,
    longitude: 6.7214,
    isArchived: false,
    isActive: true,
    hasTakeaway: true,
    hasDineIn: true,
    contactName: "Walsum e.V.",
    contactPhone: "+49 0123 456789",
    createdAt: Timestamp.now()
  },
  {
    organizationName: "Rize-Artvin Lezzet Günleri",
    title: "Rize-Artvin Lezzet Günleri Istanbul",
    city: "İstanbul",
    country: "Türkiye",
    postalCode: "34660",
    address: "Üsküdar Merkez, 34660 İstanbul",
    startDate: Timestamp.fromDate(new Date("2026-04-01T00:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2026-04-12T23:59:59Z")),
    openingTime: "09:00",
    closingTime: "23:00",
    latitude: 41.0264,
    longitude: 29.0152,
    isArchived: false,
    isActive: true,
    hasTakeaway: true,
    hasDineIn: true,
    contactName: "Lezzet Günleri",
    contactPhone: "+90 555 123 4567",
    createdAt: Timestamp.now()
  },
  {
    organizationName: "Gütersloh Ayasofya Camii",
    title: "Wohltätigkeitsbasar / Schülerwohnheim açılış kermesi",
    city: "Gütersloh",
    country: "Almanya",
    postalCode: "33330",
    address: "Rhedaer Str. 21, 33330 Gütersloh",
    startDate: Timestamp.fromDate(new Date("2026-04-04T00:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2026-04-06T23:59:59Z")),
    openingTime: "11:00",
    closingTime: "20:00",
    latitude: 51.9064,
    longitude: 8.3758,
    isArchived: false,
    isActive: true,
    hasTakeaway: true,
    hasDineIn: true,
    contactName: "Ayasofya Camii",
    contactPhone: "+49 0123 456789",
    createdAt: Timestamp.now()
  }
];

async function seed() {
  console.log("Seeding Demo Kermeses into Firestore...");
  const batch = db.batch();
  
  for (const kermes of demoKermeses) {
    const docRef = db.collection('kermes_events').doc();
    batch.set(docRef, kermes);
    console.log(`Added: ${kermes.title}`);
  }

  await batch.commit();
  console.log("Successfully seeded 5 kermeses!");
  process.exit(0);
}

seed().catch(console.error);
