const admin = require("firebase-admin");
const serviceAccount = require("./admin_portal/service-account.json"); 
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
  const doc = await db.collection("settings").doc("kermes_system").get();
  console.log(doc.data());
}
run();
