export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';

// seven.io (German SMS Provider - GDPR compliant)
const SEVEN_API_KEY = process.env.SEVEN_API_KEY;
const SMS_FROM = process.env.SMS_FROM || 'LOKMA';

interface SmsRequest {
 to: string;
 message: string;
}

export async function POST(request: NextRequest) {
 try {
 const body: SmsRequest = await request.json();
 const { to, message } = body;

 if (!to) {
 return NextResponse.json(
 { success: false, error: 'Telefon numarasi gerekli' },
 { status: 400 }
 );
 }

 if (!message) {
 return NextResponse.json(
 { success: false, error: 'Mesaj gerekli' },
 { status: 400 }
 );
 }

 // Check if SMS provider is configured
 if (!SEVEN_API_KEY) {
 console.error('SMS not configured. Required: SEVEN_API_KEY');
 return NextResponse.json(
 { success: false, error: 'SMS servisi yapilandirilmamis (SEVEN_API_KEY eksik)' },
 { status: 500 }
 );
 }

 // Format phone number for SMS (E.164)
 let formattedPhone = to.replace(/\s+/g, '').replace(/[()-]/g, '');
 if (!formattedPhone.startsWith('+')) {
 if (formattedPhone.startsWith('0')) {
 formattedPhone = '+49' + formattedPhone.slice(1);
 } else {
 formattedPhone = '+49' + formattedPhone;
 }
 }

 console.log('SMS gonderiliyor:', formattedPhone);

 // Send SMS via seven.io REST API
 const response = await fetch('https://gateway.seven.io/api/sms', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'X-Api-Key': SEVEN_API_KEY,
 },
 body: JSON.stringify({
 to: formattedPhone,
 text: message,
 from: SMS_FROM,
 }),
 });

 const responseText = await response.text();

 // seven.io returns "100" for success
 if (response.ok) {
 let responseData;
 try {
 responseData = JSON.parse(responseText);
 } catch {
 responseData = { raw: responseText };
 }

 // seven.io success codes: 100 = sent, 101 = sent to multiple
 const isSuccess = responseText.includes('100') || responseText.includes('101') || response.status === 200;

 if (isSuccess) {
 console.log('SMS basariyla gonderildi:', formattedPhone);
 return NextResponse.json({
 success: true,
 provider: 'seven.io',
 to: formattedPhone,
 response: responseData,
 });
 } else {
 console.error('SMS gonderilemedi:', responseData);
 return NextResponse.json(
 { success: false, error: `SMS gonderilemedi: ${responseText}`, provider: 'seven.io' },
 { status: 500 }
 );
 }
 } else {
 console.error('seven.io API hatasi:', response.status, responseText);
 return NextResponse.json(
 { success: false, error: `SMS API hatasi (${response.status}): ${responseText}` },
 { status: response.status }
 );
 }

 } catch (error) {
 console.error('SMS gonderim hatasi:', error);
 const errorMessage = error instanceof Error ? error.message : 'SMS gonderilemedi';
 return NextResponse.json(
 { success: false, error: errorMessage },
 { status: 500 }
 );
 }
}
