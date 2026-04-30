const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function fixCollection(collectionName) {
    const snap = await db.collection(collectionName).get();
    let batch = db.batch();
    let count = 0;
    snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.energie_kcal || data.energie_kj || data.fett || data.kohlenhydrate || data.zucker || data.protein || data.salz) {
            const nutritionPer100g = data.nutritionPer100g || {};
            if (data.energie_kj) nutritionPer100g.energie_kj = data.energie_kj;
            if (data.energie_kcal) nutritionPer100g.energie_kcal = data.energie_kcal;
            if (data.fett) nutritionPer100g.fett = data.fett;
            if (data.gesaettigte_fettsaeuren) nutritionPer100g.gesaettigte_fettsaeuren = data.gesaettigte_fettsaeuren;
            if (data.kohlenhydrate) nutritionPer100g.kohlenhydrate = data.kohlenhydrate;
            if (data.zucker) nutritionPer100g.zucker = data.zucker;
            if (data.protein) nutritionPer100g.protein = data.protein;
            if (data.salz) nutritionPer100g.salz = data.salz;
            
            batch.update(doc.ref, {
                nutritionPer100g: nutritionPer100g,
                energie_kj: admin.firestore.FieldValue.delete(),
                energie_kcal: admin.firestore.FieldValue.delete(),
                fett: admin.firestore.FieldValue.delete(),
                gesaettigte_fettsaeuren: admin.firestore.FieldValue.delete(),
                kohlenhydrate: admin.firestore.FieldValue.delete(),
                zucker: admin.firestore.FieldValue.delete(),
                protein: admin.firestore.FieldValue.delete(),
                salz: admin.firestore.FieldValue.delete(),
            });
            count++;
            if (count % 400 === 0) {
                batch.commit();
                batch = db.batch();
            }
        }
    });
    if (count % 400 !== 0) await batch.commit();
    console.log(`Fixed ${count} in ${collectionName}`);
}

async function run() {
    await fixCollection('master_products');
    await fixCollection('businesses/aOTmMmSArHjBbym459j5/products');
    console.log("Done");
    process.exit(0);
}
run();
