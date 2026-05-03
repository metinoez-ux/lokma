const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "aylar-a45af",
});

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection("businesses").where("name", ">=", "Hilal Market").limit(5).get();
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`Name: ${data.name}`);
    console.log(`Categories:`, data.categories);
  });
}

run().catch(console.error);
