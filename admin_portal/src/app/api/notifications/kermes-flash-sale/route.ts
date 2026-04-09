import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseMessaging, getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = "force-dynamic";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Dunyanin yaricapi (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kermesId, kermesTitle, discountedItems, targetRadiusKm = 2, kermesLat, kermesLng } = body;

    // Validate request
    if (!kermesId || !discountedItems || discountedItems.length === 0) {
      return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 });
    }

    const { db } = getFirebaseAdmin();
    const messaging = getFirebaseMessaging();

    // 1. Hedef kitleyi belirle (Tokens listesi + userId mapping)
    let targetTokens = new Set<string>();
    const tokenToUserId = new Map<string, string>(); // token -> userId mapping for inbox

    const usersRef = db.collection('users');
    
    const querySnapshot = await usersRef.where('fcmToken', '!=', null).get();
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const token = data.fcmToken || data.customerFcmToken;
      if (!token) return;

      let shouldSend = false;

      // 1. Durum: Kermesi favoriye almis mi?
      if (data.favoriteKermes && Array.isArray(data.favoriteKermes) && data.favoriteKermes.includes(kermesId)) {
        shouldSend = true;
      }
      if (data.favorites && data.favorites.includes(kermesId)) {
        shouldSend = true;
      }

      // 2. Durum: Genel kermes veya lokma pazarlama bildirimi aciksa
      if (data.notificationPreferences) {
        if (data.notificationPreferences.kermesNotifications === true || 
            data.notificationPreferences.promotions === true ||
            data.notificationPreferences.marketing === true) {
          shouldSend = true;
        }
      } else {
        if (data.notifyOrderPush !== false) {
           shouldSend = true;
        }
      }

      // 3. Durum: Konum verisi olan kullanicilarin distance hesabi
      if (!shouldSend && kermesLat && kermesLng && data.lastKnownLocation && data.lastKnownLocation.latitude && data.lastKnownLocation.longitude) {
         const dist = calculateDistance(
           data.lastKnownLocation.latitude, data.lastKnownLocation.longitude, 
           kermesLat, kermesLng
         );
         if (dist <= targetRadiusKm) shouldSend = true;
      }

      if (shouldSend) {
        targetTokens.add(token);
        tokenToUserId.set(token, doc.id);
      }
    });

    const tokensArray = Array.from(targetTokens);

    if (tokensArray.length === 0) {
      return NextResponse.json({ success: false, error: 'Hedef kitlede FCM token bulunamadi.' }, { status: 404 });
    }

    // 2. Bildirim icerigini olustur
    const sortedItems = [...discountedItems].sort((a: any, b: any) => {
      const percA = (a.price - a.discountPrice) / a.price;
      const percB = (b.price - b.discountPrice) / b.price;
      return percB - percA;
    });

    const topItem = sortedItems[0];
    const itemImage = topItem.image;

    const title = `${kermesTitle} - Aksam Pazari Basladi!`;
    const messageBody = `Son firsatlar! ${topItem.name} ${topItem.price.toFixed(2)} EUR yerine sadece ${topItem.discountPrice.toFixed(2)} EUR! Tum indirimler stoklarla sinirlidir, tukenmeden yetisin!`;

    // FCM Payload
    const message = {
      notification: {
        title,
        body: messageBody,
        ...(itemImage ? { image: itemImage } : {})
      },
      data: {
        type: 'kermes_flash_sale',
        kermesId: kermesId,
        kermesTitle: kermesTitle || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1
          }
        },
        fcm_options: {
          ...(itemImage ? { image: itemImage } : {})
        }
      },
      tokens: tokensArray,
    };

    // 3. FCM Push gonder (500'luk chunk)
    const chunkSize = 500;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < tokensArray.length; i += chunkSize) {
      const chunk = tokensArray.slice(i, i + chunkSize);
      const chunkMessage = { ...message, tokens: chunk };
      
      const response = await messaging.sendEachForMulticast(chunkMessage);
      successCount += response.successCount;
      failureCount += response.failureCount;
    }

    // 4. Firestore Inbox'a kaydet - her kullanicinin notifications sub-collection'ina
    const now = new Date();
    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH = 500;
    const userIds = Array.from(tokenToUserId.values());

    // Indirimli urunlerin ozet listesi
    const discountSummary = discountedItems.map((item: any) => ({
      name: item.name,
      price: item.price,
      discountPrice: item.discountPrice,
    }));

    for (const userId of userIds) {
      const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
      batch.set(notifRef, {
        type: 'kermes_flash_sale',
        tag: 'kampanya',
        title: title,
        body: messageBody,
        kermesId: kermesId,
        kermesTitle: kermesTitle || '',
        discountedItems: discountSummary,
        imageUrl: itemImage || null,
        read: false,
        createdAt: now,
      });
      batchCount++;

      // Firestore batch limiti 500 - asarsa commit et, yeni batch ac
      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Kalan kayitlari commit et
    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      failedCount: failureCount,
      targetSize: tokensArray.length,
      inboxSaved: userIds.length,
    });

  } catch (error) {
    console.error('Kermes Flash Sale Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
