import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-hub-signature-256');
    const secret = (process.env.GITHUB_WEBHOOK_SECRET || '').trim();

    if (!secret) {
      return NextResponse.json({ error: 'GITHUB_WEBHOOK_SECRET not configured' }, { status: 500 });
    }

    const payloadText = await req.text();
    let isAuthorized = false;

    // Check HMAC signature (GitHub standard)
    if (signature) {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(payloadText).digest('hex');
      try {
        if (crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
          isAuthorized = true;
        }
      } catch {
        // length mismatch
      }
    }

    // Fallback: Bearer token auth
    const authHeader = req.headers.get('authorization');
    if (!isAuthorized && authHeader === `Bearer ${secret}`) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(payloadText);

    if (!body.commits || !body.commits.length) {
      return NextResponse.json({ message: 'No commits found' }, { status: 200 });
    }

    const { db: adminDb } = getFirebaseAdmin();
    const batch = adminDb.batch();
    let count = 0;

    for (const commit of body.commits) {
      const msg = commit.message || '';
      const firstLine = msg.split('\n')[0];
      const restLines = msg.split('\n').slice(1).filter((l: string) => l.trim()).join(' | ');

      // Format timestamp from commit
      const commitDate = commit.timestamp ? new Date(commit.timestamp) : new Date();
      const ts = new Intl.DateTimeFormat('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Berlin',
      }).format(commitDate);

      // Detect note from conventional commit prefix
      let note = '-';
      if (firstLine.startsWith('fix')) note = 'bugfix';
      else if (firstLine.startsWith('feat')) note = 'feature';
      else if (firstLine.startsWith('chore')) note = 'chore';
      else if (firstLine.startsWith('refactor')) note = 'refactor';
      else if (firstLine.startsWith('style')) note = 'style';
      else if (firstLine.startsWith('docs')) note = 'docs';
      else if (firstLine.startsWith('perf')) note = 'perf';

      const docRef = adminDb.collection('changelog').doc();
      batch.set(docRef, {
        hash: (commit.id || '').substring(0, 7),
        timestamp: ts,
        description: firstLine + (restLines ? ` -- ${restLines}` : ''),
        note,
        createdAt: commitDate.getTime(),
        author: commit.author?.name || body.pusher?.name || 'unknown',
      });
      count++;
    }

    await batch.commit();

    return NextResponse.json({ success: true, written: count });

  } catch (error: unknown) {
    console.error('Github Webhook error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
