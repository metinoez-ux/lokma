// AWS SES Email Service for MIRA Portal
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Initialize SES client
const sesClient = new SESClient({
 region: process.env.AWS_SES_REGION || 'eu-west-1',
 credentials: {
 accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
 secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
 },
});

// Default sender
export const DEFAULT_SENDER = process.env.AWS_SES_SENDER_EMAIL || 'noreply@miraportal.com';

export interface SendEmailParams {
 to: string | string[];
 subject: string;
 html: string;
 text?: string;
 from?: string;
 replyTo?: string;
}

/**
 * Send an email using AWS SES
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
 const { to, subject, html, text, from = DEFAULT_SENDER, replyTo } = params;

 const recipients = Array.isArray(to) ? to : [to];

 try {
 const command = new SendEmailCommand({
 Source: from,
 Destination: {
 ToAddresses: recipients,
 },
 Message: {
 Subject: {
 Data: subject,
 Charset: 'UTF-8',
 },
 Body: {
 Html: {
 Data: html,
 Charset: 'UTF-8',
 },
 ...(text && {
 Text: {
 Data: text,
 Charset: 'UTF-8',
 },
 }),
 },
 },
 ...(replyTo && { ReplyToAddresses: [replyTo] }),
 });

 const response = await sesClient.send(command);

 return {
 success: true,
 messageId: response.MessageId,
 };
 } catch (error) {
 console.error('SES Email Error:', error);
 return {
 success: false,
 error: String(error),
 };
 }
}

// ===========================================
// Email Templates
// ===========================================

export const EmailTemplates = {
 /**
 * Kandil Gecesi Template
 */
 kandil: (kandilName: string, message: string) => ({
 subject: `🌙 ${kandilName} Geceniz Mübarek Olsun`,
 html: `
 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
 <div style="background: linear-gradient(135deg, #1e3a5f, #2d5a87); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
 <h1 style="margin: 0;">🌙 ${kandilName}</h1>
 <p style="margin: 10px 0 0 0; opacity: 0.9;">MIRA - Müslüman İhtiyaç ve Rehber Uygulaması</p>
 </div>
 <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
 <p style="color: #333; line-height: 1.6; font-size: 16px;">${message}</p>
 <p style="color: #666; margin-top: 20px;">Dualarınız kabul olsun. 🤲</p>
 </div>
 <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
 <p>© MIRA App - miraportal.com</p>
 </div>
 </div>
 `,
 }),

 /**
 * Cuma Mesajı Template
 */
 cuma: (message: string) => ({
 subject: '🕌 Hayırlı Cumalar',
 html: `
 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
 <div style="background: linear-gradient(135deg, #2d5a27, #4a8f42); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
 <h1 style="margin: 0;">🕌 Hayırlı Cumalar</h1>
 <p style="margin: 10px 0 0 0; opacity: 0.9;">MIRA - Müslüman İhtiyaç ve Rehber Uygulaması</p>
 </div>
 <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
 <p style="color: #333; line-height: 1.6; font-size: 16px;">${message}</p>
 <p style="color: #666; margin-top: 20px;">Cumamız mübarek olsun. 🤲</p>
 </div>
 <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
 <p>© MIRA App - miraportal.com</p>
 </div>
 </div>
 `,
 }),

 /**
 * Cenaze Duyurusu Template
 */
 cenaze: (deceasedName: string, location: string, details: string) => ({
 subject: `⚫ Cenaze Duyurusu: ${deceasedName}`,
 html: `
 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
 <div style="background: linear-gradient(135deg, #2c2c2c, #4a4a4a); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
 <h1 style="margin: 0;">⚫ Cenaze Duyurusu</h1>
 <p style="margin: 10px 0 0 0; opacity: 0.9;">MIRA - Cenaze Bilgi Servisi</p>
 </div>
 <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
 <h2 style="color: #333; margin-top: 0;">Merhum: ${deceasedName}</h2>
 <p style="color: #666;"><strong>📍 Konum:</strong> ${location}</p>
 <div style="color: #333; line-height: 1.6; font-size: 16px; margin-top: 15px;">
 ${details}
 </div>
 <p style="color: #666; margin-top: 20px; font-style: italic;">
 "İnnâ lillâhi ve innâ ileyhi râciûn"<br>
 Allah rahmet eylesin, mekanı cennet olsun.
 </p>
 </div>
 <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
 <p>Bu bildirim, konumunuza yakın bir cenaze duyurusu olduğu için size gönderilmiştir.</p>
 <p>© MIRA App - miraportal.com</p>
 </div>
 </div>
 `,
 }),

 /**
 * Genel Bildirim Template
 */
 general: (title: string, message: string) => ({
 subject: `📢 ${title}`,
 html: `
 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
 <div style="background: linear-gradient(135deg, #1e3a5f, #2d5a87); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
 <h1 style="margin: 0;">📢 ${title}</h1>
 <p style="margin: 10px 0 0 0; opacity: 0.9;">MIRA - Müslüman İhtiyaç ve Rehber Uygulaması</p>
 </div>
 <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
 <p style="color: #333; line-height: 1.6; font-size: 16px;">${message}</p>
 </div>
 <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
 <p>© MIRA App - miraportal.com</p>
 </div>
 </div>
 `,
 }),

 /**
 * Hoş Geldiniz Email Template
 */
 welcome: (userName: string) => ({
 subject: '🎉 MIRA Ailesine Hoş Geldiniz!',
 html: `
 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
 <div style="background: linear-gradient(135deg, #1e3a5f, #2d5a87); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
 <h1 style="margin: 0;">🎉 Hoş Geldiniz!</h1>
 <p style="margin: 10px 0 0 0; opacity: 0.9;">MIRA - Müslüman İhtiyaç ve Rehber Uygulaması</p>
 </div>
 <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
 <h2 style="color: #1e3a5f; margin-top: 0;">Merhaba ${userName}!</h2>
 <p style="color: #333; line-height: 1.6; font-size: 16px;">
 MIRA ailesine katıldığınız için teşekkür ederiz! 🤲
 </p>
 <p style="color: #333; line-height: 1.6; font-size: 16px;">
 Uygulamamızda şunları yapabilirsiniz:
 </p>
 <ul style="color: #555; line-height: 1.8;">
 <li>🕌 Namaz vakitlerini takip edin</li>
 <li>🍽️ Helal restoranlar ve kasapları keşfedin</li>
 <li>✈️ Seyahat planlarınızı oluşturun</li>
 <li>📖 Kuran-ı Kerim okuyun</li>
 <li>📿 İbadetlerinizi kaydedin</li>
 </ul>
 <div style="text-align: center; margin-top: 30px;">
 <a href="https://miraportal.com" style="background: #1e3a5f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
 Uygulamayı Keşfet
 </a>
 </div>
 </div>
 <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
 <p>© MIRA App - miraportal.com</p>
 </div>
 </div>
 `,
 }),

 /**
 * Rezervasyon Onay Template
 */
 reservationConfirmation: (details: {
 userName: string;
 restaurantName: string;
 date: string;
 time: string;
 guests: number;
 reservationId: string;
 }) => ({
 subject: `✅ Rezervasyon Onayı - ${details.restaurantName}`,
 html: `
 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
 <div style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
 <h1 style="margin: 0;">✅ Rezervasyon Onaylandı!</h1>
 <p style="margin: 10px 0 0 0; opacity: 0.9;">MIRA Restoran Rezervasyon</p>
 </div>
 <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
 <h2 style="color: #27ae60; margin-top: 0;">Merhaba ${details.userName}!</h2>
 <p style="color: #333; line-height: 1.6; font-size: 16px;">
 Rezervasyonunuz başarıyla oluşturuldu.
 </p>
 <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
 <table style="width: 100%; border-collapse: collapse;">
 <tr>
 <td style="padding: 10px 0; color: #666;">🍽️ Restoran:</td>
 <td style="padding: 10px 0; color: #333; font-weight: bold;">${details.restaurantName}</td>
 </tr>
 <tr>
 <td style="padding: 10px 0; color: #666;">📅 Tarih:</td>
 <td style="padding: 10px 0; color: #333; font-weight: bold;">${details.date}</td>
 </tr>
 <tr>
 <td style="padding: 10px 0; color: #666;">🕐 Saat:</td>
 <td style="padding: 10px 0; color: #333; font-weight: bold;">${details.time}</td>
 </tr>
 <tr>
 <td style="padding: 10px 0; color: #666;">👥 Kişi Sayısı:</td>
 <td style="padding: 10px 0; color: #333; font-weight: bold;">${details.guests} kişi</td>
 </tr>
 <tr>
 <td style="padding: 10px 0; color: #666;">🔢 Rezervasyon No:</td>
 <td style="padding: 10px 0; color: #333; font-weight: bold;">${details.reservationId}</td>
 </tr>
 </table>
 </div>
 <p style="color: #666; font-size: 14px;">
 ⚠️ Lütfen randevu saatinden 10 dakika önce mekanınızda olunuz.
 </p>
 </div>
 <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
 <p>© MIRA App - miraportal.com</p>
 </div>
 </div>
 `,
 }),

 /**
 * Şifre Sıfırlama Template
 */
 passwordReset: (userName: string, resetLink: string) => ({
 subject: '🔐 Şifre Sıfırlama Talebi',
 html: `
 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
 <div style="background: linear-gradient(135deg, #ea184a, #d4223f); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
 <h1 style="margin: 0;">🔐 Şifre Sıfırlama</h1>
 <p style="margin: 10px 0 0 0; opacity: 0.9;">MIRA Hesap Güvenliği</p>
 </div>
 <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
 <h2 style="color: #333; margin-top: 0;">Merhaba ${userName}!</h2>
 <p style="color: #333; line-height: 1.6; font-size: 16px;">
 Hesabınız için şifre sıfırlama talebinde bulundunuz. 
 Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz.
 </p>
 <div style="text-align: center; margin: 30px 0;">
 <a href="${resetLink}" style="background: #ea184a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
 Şifremi Sıfırla
 </a>
 </div>
 <p style="color: #888; font-size: 13px;">
 ⏰ Bu bağlantı 1 saat geçerlidir.<br>
 Eğer bu talebi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.
 </p>
 </div>
 <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
 <p>© MIRA App - miraportal.com</p>
 </div>
 </div>
 `,
 }),
};
