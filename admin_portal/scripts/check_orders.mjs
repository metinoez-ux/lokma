import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { resolve } from 'path';

import serviceAccount from '../service-account.json' with { type: 'json' };

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function testQuery() {
  try {
    const ordersRef = db.collection('kermes_orders');
    console.log(`Querying active orders...`);
    
    const snapshot = await ordersRef
      .where('status', 'in', ['pending', 'preparing', 'ready'])
      .get();
      
    console.log(`Total active orders cross-event: ${snapshot.size}`);

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const items = data.items || [];
      const prepZones = items.map(i => i.prepZone);
      
      console.log(`Order ${data.orderNumber} - Status: ${data.status} | tableSection: ${data.tableSection} | prepZones: ${JSON.stringify(prepZones)}`);
    });

  } catch (error) {
    console.error('Error querying:', error);
  }
}

testQuery(); 
