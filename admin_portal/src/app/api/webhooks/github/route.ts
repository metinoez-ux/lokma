import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const signature = req.headers.get('x-hub-signature-256');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret) {
      return NextResponse.json({ error: 'GITHUB_WEBHOOK_SECRET not configured' }, { status: 500 });
    }

    const payloadText = await req.text();
    let isAuthorized = false;

    if (authHeader === `Bearer ${secret}`) {
      isAuthorized = true;
    } else if (signature) {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(payloadText).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(payloadText);

    if (!body.commits || !body.commits.length) {
      return NextResponse.json({ message: 'No commits found' }, { status: 200 });
    }

    const changes = body.commits.map((c: any) => c.message);
    const author = body.pusher?.name || 'GitHub Actions';
    const mainTitle = changes[0].split('\n')[0] || 'Sistem Guncellemesi'; // Ilk commitin ilk satiri
    const totalAdded = body.commits.reduce((sum: number, c: any) => sum + (c.added ? c.added.length : 0), 0);
    const totalModified = body.commits.reduce((sum: number, c: any) => sum + (c.modified ? c.modified.length : 0), 0);
    const totalRemoved = body.commits.reduce((sum: number, c: any) => sum + (c.removed ? c.removed.length : 0), 0);

    const description = `Bu guncelleme icerisinde toplam ${changes.length} adet degisiklik tespiti, ${totalAdded} yeni dosya, ${totalModified} degisen dosya kayit altina alindi.`;

    const { db: adminDb } = getFirebaseAdmin();
    const docRef = adminDb.collection('changelog').doc();
    await docRef.set({
      version: `v0.9.${Math.floor(Date.now() / 100000)}`, // Otomatik mini versiyon
      title: mainTitle,
      description,
      changes,
      type: 'feature',
      isDraft: false,
      author: author,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      tags: ['automation', 'github', 'push']
    });

    return NextResponse.json({ success: true, id: docRef.id });

  } catch (error: any) {
    console.error('Github Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
