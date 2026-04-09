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

    // 1. Hedef kitleyi belirle (Tokens listesi)
    // - Favoriler (favoriteKermes includes kermesId)
    // - Lokma genel kermes bildirimleri açık olanlar (notificationPreferences.kermesNotifications == true)
    
    // Uygulamanızın net user lokasyon seması bilinmediğinden ve distance query 
    // Firestore'da spesifik GeoHash gerektirdiğinden, burada en aktif preference tabanli kitlenizi kullaniyoruz:
    let targetTokens = new Set<string>();

    const usersRef = db.collection('users');
    
    // Kampanya bildirimini acan kullanicilari aliyoruz. LOKMA preferences:
    const querySnapshot = await usersRef.where('fcmToken', '!=', null).get();
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const token = data.fcmToken || data.customerFcmToken;
      if (!token) return;

      let shouldSend = false;

      // 1. Durum: Kermesi favoriye almis mi? (Varsayilan data field'lari)
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
        // Eski/Flat model destek kontrolu (MIRA)
        if (data.notifyOrderPush !== false) {
           // Eger acikca kapali degilse eski modellere kampanyayi atabiliriz
           shouldSend = true;
        }
      }

      // 3. Durum: Konum verisi olan kullanıcıların aradaki distance(KM) hesabı
      if (!shouldSend && kermesLat && kermesLng && data.lastKnownLocation && data.lastKnownLocation.latitude && data.lastKnownLocation.longitude) {
         const dist = calculateDistance(
           data.lastKnownLocation.latitude, data.lastKnownLocation.longitude, 
           kermesLat, kermesLng
         );
         if (dist <= targetRadiusKm) shouldSend = true;
      }

      if (shouldSend) {
        targetTokens.add(token);
      }
    });

    const tokensArray = Array.from(targetTokens);

    if (tokensArray.length === 0) {
      return NextResponse.json({ success: false, error: 'Hedef kitlede FCM token bulunamadı.' }, { status: 404 });
    }

    // 2. Bildirim İcerigini Olustur
    // En yuksek indirim oranina sahip urunu buluyoruz
    const sortedItems = [...discountedItems].sort((a, b) => {
      const percA = (a.price - a.discountPrice) / a.price;
      const percB = (b.price - b.discountPrice) / b.price;
      return percB - percA;
    });

    const topItem = sortedItems[0];
    const itemImage = topItem.image;

    const title = `🌙 ${kermesTitle} - Akşam Pazarı Başladı!`;
    const messageBody = `🔥 Son fırsatlar! ${topItem.name} ${topItem.price.toFixed(2)}€ yerine sadece ${topItem.discountPrice.toFixed(2)}€! ⏳ Tüm indirimler stoklarla sınırlıdır, tükenmeden yetişin! 🏃‍♂️`;

    // FCM Payload Standardı (IOS ve Android için)
    const message = {
      notification: {
        title,
        body: messageBody,
        ...(itemImage ? { image: itemImage } : {})
      },
      data: {
        type: 'kermes_flash_sale',
        kermesId: kermesId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK' // Eski Android versiyon destegi
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1 // Eger resim varsa IOS zengin bildirim
          }
        },
        fcm_options: {
          ...(itemImage ? { image: itemImage } : {})
        }
      },
      tokens: tokensArray,
    };

    // Firebase 500'luk chunklar halinde multicast atabilir
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

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      failedCount: failureCount,
      targetSize: tokensArray.length
    });

  } catch (error) {
    console.error('Kermes Flash Sale Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
