export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { nt, resolveLocale } from '@/lib/notification-i18n';

// WhatsApp messaging is currently disabled (Twilio removed).
// This route returns a clear error message so the pipeline doesn't break.

interface WhatsAppRequest {
 to: string;
 message: string;
 locale?: string;
 templateType?: 'order_confirmation' | 'order_ready' | 'order_rejected' | 'custom';
 templateData?: Record<string, string>;
}

export async function POST(request: NextRequest) {
 try {
 const body: WhatsAppRequest = await request.json();
 const locale = resolveLocale(body.locale);

 console.log('WhatsApp send requested but provider not configured. To:', body.to);

 return NextResponse.json({
 success: false,
 error: 'WhatsApp provider not configured. SMS is the active notification channel.',
 }, { status: 501 });

 } catch (error) {
 console.error('WhatsApp route error:', error);
 const errorMessage = error instanceof Error ? error.message : 'WhatsApp send failed';
 return NextResponse.json(
 { success: false, error: errorMessage },
 { status: 500 }
 );
 }
}
