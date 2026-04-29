import { config } from 'dotenv';
config({ path: '.env.local' });
import { getFirebaseAdmin } from './src/lib/firebase-admin.ts';

async function main() {
  const { db } = getFirebaseAdmin();
  const hist = await db.collection('kermes_events').doc('bGAR8WTvnzlmmgHs76nD').collection('notificationHistory').orderBy('sentAt', 'desc').limit(1).get();
  if (!hist.empty) {
    console.log("History", hist.docs[0].data());
  }
}
main().catch(console.error);
