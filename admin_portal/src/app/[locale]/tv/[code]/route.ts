import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; locale: string }> | { code: string; locale: string } }
) {
  // Deal with synchronous or asynchronous params gracefully
  const resolvedParams = await params;
  const code = resolvedParams.code?.toUpperCase();

  if (!code) {
    return new NextResponse('Kısa link kodu eksik (Missing code)', { status: 400 });
  }

  try {
    const { db } = getFirebaseAdmin();
    const doc = await db.collection('short_links').doc(code).get();

    if (doc.exists) {
      const data = doc.data();
      if (data?.url) {
        // Hedef URL'ye kalici olmayan (307) yonlendirme yapalim ki ilerde degisirse onbelleklenmesin.
        return NextResponse.redirect(new URL(data.url, request.url));
      }
    }

    return new NextResponse(
      `<html>
        <head>
          <title>Link Bulunamadı | LOKMA</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #111827; color: white; text-align: center; padding: 20px; }
            .container { max-width: 500px; padding: 40px; background-color: #1f2937; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            h1 { color: #f87171; font-size: 24px; margin-bottom: 16px; }
            p { color: #9ca3af; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Geçersiz veya Süresi Dolmuş TV Linki</h1>
            <p>Girdiğiniz "<strong>${code}</strong>" kodu LOKMA sisteminde bulunamadı.</p>
            <p>Lütfen kodu doğru yazdığınızdan emin olun veya Admin portalinden yeni bir kısa link oluşturun.</p>
          </div>
        </body>
      </html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Error in shortlink redirect:', error);
    return new NextResponse('Sunucu Hatası (Internal Server Error)', { status: 500 });
  }
}
