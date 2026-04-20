const admin = require("firebase-admin");
const axios = require("axios");

// Initialize Firebase
const serviceAccount = require("./admin_portal/serviceAccountKey.json"); // Or whichever path exists
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const GOOGLE_API_KEY = "AIzaSyB8Pvs-P4580Wsk4mT46cvGT7TGlZiLkWo";

async function run() {
  console.log("Fetching kermes_events...");
  const snapshot = await db.collection("kermes_events").get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    let lat = data.latitude;
    let lng = data.longitude;
    
    // Check if missing or 0.0 or 51.0
    if (!lat || lat === 0.0 || lat === 51.0) {
      let fullAddress = "";
      if (data.address && data.address.fullAddress) {
        fullAddress = data.address.fullAddress;
      } else if (typeof data.address === 'string') {
        fullAddress = data.address;
      } else if (data.street) {
        fullAddress = `${data.street}, ${data.postalCode || ''} ${data.city || ''}, ${data.country || ''}`.trim();
      }
      
      if (!fullAddress && data.city) fullAddress = data.city;
      
      if (fullAddress) {
        console.log(`Geocoding: ${fullAddress}`);
        try {
          const res = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_API_KEY}`);
          if (res.data.status === "OK" && res.data.results.length > 0) {
            const loc = res.data.results[0].geometry.location;
            console.log(`Resolved ${doc.id} -> ${loc.lat}, ${loc.lng}`);
            await db.collection("kermes_events").doc(doc.id).update({
              latitude: loc.lat,
              longitude: loc.lng
            });
            console.log(`Updated ${doc.id}`);
          } else {
            console.log(`Failed Geocoding for ${fullAddress}: ${res.data.status}`);
          }
        } catch (e) {
          console.error(`Error geocoding ${fullAddress}: ${e.message}`);
        }
      }
    }
  }
}
run().then(() => console.log("Done")).catch(console.error);
