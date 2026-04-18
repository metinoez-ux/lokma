const admin = require('firebase-admin');
const serviceAccount = require('./admin_portal/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
async function test() {
  const brands = await admin.firestore().collection('platform_brands').get();
  brands.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
  process.exit(0);
}
test();
