import { getFirebaseAdmin } from '../src/lib/firebase-admin';

async function run() {
  const admin = await getFirebaseAdmin();
  const db = admin.db;
  const users = await db.collection('users').where('email', '==', 'sevket.ay@lokma.shop').get();
  if (users.empty) console.log("No user found");
  for (const doc of users.docs) {
    console.log("=== USER ===");
    console.log("UID:", doc.id);
    console.log("displayName:", doc.data().displayName);
    const adminDoc = await db.collection('admins').doc(doc.id).get();
    if (adminDoc.exists) {
      console.log("=== ADMIN ===");
      console.log("displayName:", adminDoc.data()?.displayName);
      console.log("name:", adminDoc.data()?.name);
    }
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
