import { NextResponse } from 'next/server';
import { getFirebaseAdmin, getFirebaseMessaging } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId, title, body, type = 'kermes_assignment' } = await req.json();

    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { db } = getFirebaseAdmin();
    const nowIso = new Date().toISOString();
    const notificationsRef = db.collection('users').doc(userId).collection('personnel_notifications');
    
    await notificationsRef.add({
      title,
      body,
      type,
      createdAt: nowIso,
      read: false
    });

    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      const fcmToken = data?.customerFcmToken || data?.fcmToken;
      
      if (fcmToken) {
        const messaging = getFirebaseMessaging();
        if (messaging) {
          try {
            await messaging.send({
              token: fcmToken,
              notification: { title, body },
              data: { type }
            });
            console.log('Push notification sent to', userId);
          } catch (e) {
            console.error('Error sending push notification:', e);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
