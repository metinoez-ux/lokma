const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/functions/lokma-419114-firebase-adminsdk-h4sri-d67b2d5edb.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').get();
  for (let u of users.docs) {
     const notifs = await db.collection('users').doc(u.id).collection('notifications').get();
     for (let n of notifs.docs) {
        let type = n.data().type;
        if (type === 'supply_alarm' || type === 'supply_alarm_status') {
           let val = n.data().createdAt;
           if (typeof val === 'string') {
              console.log('Deleting bad notification:', n.id);
              await n.ref.delete();
           }
        }
     }
  }
  console.log('Done!');
  process.exit(0);
}
run();
