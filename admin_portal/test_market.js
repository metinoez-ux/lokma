const admin = require('firebase-admin');
const fs = require('fs');

let saPath = '';
if (fs.existsSync('./service-account.json')) saPath = './service-account.json';
else if (fs.existsSync('../service-account.json')) saPath = '../service-account.json';
else if (fs.existsSync('../../service-account.json')) saPath = '../../service-account.json';
else if (fs.existsSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json')) saPath = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json';
else if (fs.existsSync('/Users/metinoz/Developer/LOKMA_MASTER/firebase/service-account.json')) saPath = '/Users/metinoz/Developer/LOKMA_MASTER/firebase/service-account.json';

console.log("Using SA:", saPath);
const serviceAccount = require(saPath); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function test() {
  const query = await admin.firestore().collection('businesses').where('companyName', '>=', 'Güne').where('companyName', '<=', 'Güne\uf8ff').get();
  const query2 = await admin.firestore().collection('businesses').where('companyName', '>=', 'Hilal').where('companyName', '<=', 'Hilal\uf8ff').get();
  
  const allDocs = [...query.docs, ...query2.docs];
  allDocs.forEach(doc => {
    const d = doc.data();
    console.log("----", d.companyName, "----");
    console.log("type:", d.type);
    console.log("types:", d.types);
    console.log("businessType:", d.businessType);
    console.log("cuisineType:", d.cuisineType);
    console.log("category:", d.category);
    console.log("tags:", d.tags);
    console.log("isTunaPartner:", d.isTunaPartner);
    console.log("brand:", d.brand);
    console.log("sellsTunaProducts:", d.sellsTunaProducts);
    console.log("activeBrandIds:", d.activeBrandIds);
  });
}
test().catch(console.error).then(() => process.exit(0));
