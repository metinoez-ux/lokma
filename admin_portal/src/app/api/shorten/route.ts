import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const { db } = getFirebaseAdmin();
    const shortLinksRef = db.collection('short_links');

    // Generate a unique 5-character code
    let code = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      // 5 character alphanumeric string, excluding ambiguous characters like 0, O, I, l
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
      code = Array.from({ length: 5 })
        .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
        .join('');

      const existingCode = await shortLinksRef.doc(code).get();
      if (!existingCode.exists) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json({ error: 'Could not generate a unique code' }, { status: 500 });
    }

    await shortLinksRef.doc(code).set({
      url,
      createdAt: new Date().toISOString(),
      type: 'tv_link',
    });

    return NextResponse.json({ code, success: true });
  } catch (error: any) {
    console.error('Error generating short link:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
