import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Yetki Kontrolü (Sadece Vercel Cron tetikleyebilir)
    // Vercel Cron Job'lari otomatik olarak bu header'i gonderir.
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = getFirebaseAdmin();
    const now = admin.firestore.Timestamp.now();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneDayAgoTimestamp = admin.firestore.Timestamp.fromDate(oneDayAgo);

    // 2. Bir günden eski olan ve hala aktif duran siparişleri bul
    // Firestore'da index gerektirmemesi icin once zamana gore filtreleyip, statuleri kodda ayikliyoruz
    // (Eger index varsa statuleri de sorguya ekleyebiliriz ama bu daha guvenli ve esnek)
    const ordersSnapshot = await db.collection('kermes_orders')
      .where('createdAt', '<=', oneDayAgoTimestamp)
      .get();

    let cancelledCount = 0;
    const batch = db.batch();

    for (const doc of ordersSnapshot.docs) {
      const order = doc.data();
      
      // Ileri tarihli siparisleri atla (isScheduled true ve scheduledTime gelecekteyse)
      if (order.isScheduled) {
        // Eger scheduledTime varsa ve hala gelecekteyse dokunma
        if (order.scheduledTime && order.scheduledTime.toDate() > new Date()) {
          continue;
        }
      }

      // Iptal edilmis veya teslim edilmis/reddedilmis siparisleri atla
      const activeStatuses = ['pending', 'accepted', 'preparing', 'ready', 'on_the_way'];
      if (!activeStatuses.includes(order.status)) {
        continue;
      }

      // 3.siparisi iptal et
      batch.update(doc.ref, {
        status: 'cancelled',
        cancellationReason: 'Diğer',
        cancellationNote: 'Sipariş bir günü geçtiği için sistem tarafından otomatik iptal oldu.',
        cancelledAt: now,
        updatedAt: now
      });

      // Kullanicinin myOrdersList (gecmis siparisleri) kismina logla
      if (order.userId) {
        const orderSummaryRef = db.collection('users')
          .doc(order.userId)
          .collection('myOrdersList')
          .doc(doc.id);

        batch.update(orderSummaryRef, {
          status: 'cancelled',
          cancellationReason: 'Diğer',
          updatedAt: now
        }).catch(() => {
          // Eger summary dokumani yoksa sessizce devam et
        });
      }

      cancelledCount++;

      // Firebase Batch limiti 500'dur. Eger iptal edilecek siparis 450'yi gecerse commit edip yeni batch acariz.
      if (cancelledCount % 450 === 0) {
        await batch.commit();
      }
    }

    // Kalan batch'i kaydet
    if (cancelledCount % 450 !== 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Taranan: ${ordersSnapshot.size}, Otomatik Iptal Edilen: ${cancelledCount}` 
    });

  } catch (error: any) {
    console.error('Error cancelling stale orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
