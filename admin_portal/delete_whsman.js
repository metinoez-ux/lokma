const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const raw = process.env.ADMIN_SERVICE_ACCOUNT.replace(/\n/g, '\\n');
const serviceAccount = JSON.parse(raw);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteOrder() {
  try {
    const collections = ['meat_orders', 'kermes_orders'];
    for (const col of collections) {
      console.log(`Checking ${col}...`);
      
      let snapshot = await db.collection(col).where('orderNumber', '==', 'WHSMAN').get();
      
      if (snapshot.empty) {
        snapshot = await db.collection(col)
          .where(admin.firestore.FieldPath.documentId(), '>=', 'WHSMAN')
          .where(admin.firestore.FieldPath.documentId(), '<=', 'WHSMAN' + '\uf8ff')
          .get();
      }

      if (snapshot.empty) {
        console.log(`No order found in ${col}.`);
        continue;
      }

      for (const doc of snapshot.docs) {
        console.log(`Deleting document ${doc.id} from ${col}...`);
        await doc.ref.delete();
        console.log(`Successfully deleted ${doc.id}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

deleteOrder();
