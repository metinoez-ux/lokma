// Sadece process.env kullanacagiz. Next.js server actions / api uzerinden deneme yapacagiz.
const fs = require('fs');
// Let's just create an API route to fetch it and hit it with curl
const code = `
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const { db } = getFirebaseAdmin();
  const hist = await db.collection('kermes_events').doc('bGAR8WTvnzlmmgHs76nD').collection('notificationHistory').orderBy('sentAt', 'desc').limit(1).get();
  
  if (!hist.empty) {
    return NextResponse.json(hist.docs[0].data());
  }
  return NextResponse.json({ error: 'not found' });
}
`;
fs.writeFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/api/check/route.ts', code);
