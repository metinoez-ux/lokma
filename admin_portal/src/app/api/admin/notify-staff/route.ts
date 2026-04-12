import { NextResponse } from 'next/server';
import { getFirebaseAdmin, getFirebaseMessaging } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const { userId, title, body, type = 'kermes_assignment' } = await req.json();

    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { db } = getFirebaseAdmin();
    const now = Timestamp.now();
    
    // Personnel notifications (eski collection, geriye uyumluluk)
    const personnelRef = db.collection('users').doc(userId).collection('personnel_notifications');
    await personnelRef.add({
      title,
      body,
      type,
      createdAt: now,
      read: false
    });

    // Ana notifications collection (bildirim gecmisi ekraninda gorunsun)
    const notificationsRef = db.collection('users').doc(userId).collection('notifications');
    await notificationsRef.add({
      title,
      body,
      type,
      createdAt: now,
      read: false
    });

    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      const tokens: string[] = [];
      if (data?.customerFcmToken) tokens.push(data.customerFcmToken);
      if (data?.fcmToken) tokens.push(data.fcmToken);
      if (data?.fcmTokens && Array.isArray(data.fcmTokens)) {
        data.fcmTokens.forEach((t: string) => {
          if (typeof t === 'string' && t && !tokens.includes(t)) tokens.push(t);
        });
      }
      
      if (tokens.length > 0) {
        const messaging = getFirebaseMessaging();
        if (messaging) {
          try {
            const message = {
                notification: { title, body },
                data: { type },
                tokens: tokens,
                apns: {
                    payload: {
                        aps: {
                            sound: "default",
                            "content-available": 1,
                        },
                    },
                },
            };
            await messaging.sendEachForMulticast(message);
            console.log('Push notification sent to', userId, 'tokens:', tokens.length);
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
