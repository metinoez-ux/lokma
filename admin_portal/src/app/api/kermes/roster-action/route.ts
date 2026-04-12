import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const action = searchParams.get('action'); // 'accept' or 'reject'
    const kermesId = searchParams.get('k');
    const userId = searchParams.get('u');

    if (!batchId || !action || !kermesId) {
      return new NextResponse('Eksik parametreler. Lütfen tekrar deneyin.', { status: 400 });
    }

    if (action !== 'accept' && action !== 'reject') {
      return new NextResponse('Geçersiz işlem.', { status: 400 });
    }

    const { db } = getFirebaseAdmin();
    
    // Find all rosters with this batchId
    const rostersRef = db.collection('kermes_events').doc(kermesId).collection('rosters');
    const q = rostersRef.where('batchId', '==', batchId);
    if (userId) {
       // extra safety if u is provided
       q.where('userId', '==', userId);
    }
    
    const snapshot = await q.get();

    if (snapshot.empty) {
      // Return a nice HTML letting them know it might be deleted or not found
      return processHtmlResponse('Vardiya kaydı bulunamadı. Silinmiş veya süresi geçmiş olabilir.', false);
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    
    // Update all matching
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: newStatus });
    });
    
    await batch.commit();

    const msg = newStatus === 'accepted' 
       ? 'Vardiya atamasını başarıyla KABUL ettiniz. Kermes yönetimi bilgilendirilecektir. Katkılarınız için teşekkür ederiz!'
       : 'Vardiya atamasını reddettiniz. Görevi üstlenemeyeceğiniz kermes yönetimine bildirilmiştir.';
       
    return processHtmlResponse(msg, true, newStatus);

  } catch (err: any) {
    console.error('Roster action error:', err);
    return processHtmlResponse('Sunucu hatası. Daha sonra tekrar deneyin.', false);
  }
}

function processHtmlResponse(message: string, success: boolean, statusAction?: 'accepted' | 'rejected') {
  const icon = success 
    ? (statusAction === 'accepted' ? '✅' : '🛑') 
    : '❌';
  const color = statusAction === 'accepted' ? '#10B981' : (statusAction === 'rejected' ? '#EF4444' : '#6B7280');
  
  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vardiya Yanıtı</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); text-align: center; max-width: 400px; width: 90%; }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #111827; font-size: 24px; margin-bottom: 16px; }
        p { color: #4B5563; font-size: 16px; line-height: 1.5; margin-bottom: 24px; }
        .success-text { color: ${color}; font-weight: bold; margin-top: 20px; font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${icon}</div>
        <h1>LOKMA Sistem Yanıtı</h1>
        <p>${message}</p>
        <div class="success-text">${success ? 'İşleminiz Tamamlandı' : 'Bir Hata Oluştu'}</div>
      </div>
    </body>
    </html>
  `;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
