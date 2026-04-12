import { db } from './src/lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

async function main() {
  const q = query(collection(db, 'users'), limit(2));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
    console.log(d.id, d.data());
  });
}
// just to quickly check schema
