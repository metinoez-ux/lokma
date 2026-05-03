const admin = require("firebase-admin");
const serviceAccount = require("./firebase.json"); // This might not be credentials, it's just config.

// Better to just run it as a normal cloud function local script or use the default ADC.
admin.initializeApp({
  projectId: "aylar-a45af",
  credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

async function run() {
  const snapshot = await db.collection("businesses").where("name", ">=", "Hilal").where("name", "<=", "Hilal\uf8ff").get();
  snapshot.forEach(doc => console.log(doc.id, doc.data().name));
}
run().catch(console.error);
