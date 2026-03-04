const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function run() {
    const db = admin.firestore();
    console.log("Querying for Tuna Kebaphaus...");
    const snapshot = await db.collection("businesses").get();

    let found = false;
    snapshot.forEach(doc => {
        const data = doc.data();
        const name = data.companyName || data.businessName || data.name || "";

        if (name.includes("Tuna Kebaphaus") || name.includes("tuna kebaphaus")) {
            console.log("------------------------");
            console.log("ID:", doc.id);
            console.log("Name:", name);
            console.log("isActive:", data.isActive);
            console.log("isOpen:", data.isOpen);
            console.log("isClosedTemporarily:", data.isClosedTemporarily);
            console.log("openingHours:", data.openingHours);
            console.log("temporaryDeliveryPaused:", data.temporaryDeliveryPaused);
            console.log("deliveryStartTime:", data.deliveryStartTime);
            console.log("pickupStartTime:", data.pickupStartTime);
            found = true;
        }
    });

    if (!found) {
        console.log("Not found.");
    }
}

run().catch(console.error);
