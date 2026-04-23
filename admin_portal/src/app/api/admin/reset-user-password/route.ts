import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { sendEmailWithResend } from '@/lib/resend-email';

export async function POST(req: Request) {
  try {
    const { uid, sendEmail, email, displayName } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    const admin = await getFirebaseAdmin();
    
    // Generate a new temporary password
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%*+';
    let tempPassword = '';
    for(let i=0; i<10; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    tempPassword = tempPassword.replace(/./, chars.charAt(Math.floor(Math.random() * 26) + 26)); // ensure letter
    tempPassword = tempPassword.replace(/.$/, chars.charAt(Math.floor(Math.random() * 10) + 52)); // ensure number/symbol
    
    // Update user password in Firebase Auth
    await admin.auth.updateUser(uid, {
      password: tempPassword
    });

    let emailSent = false;
    let emailError = null;

    if (sendEmail && email) {
      const emailHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LOKMA Yeni Pasaport</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;margin-top:40px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);">
    <div style="background-color:#dc2626;padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;font-weight:700;">LOKMA</h1>
      <p style="color:#fecaca;margin:8px 0 0 0;font-size:14px;">Platform Erişim Bilgileri</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#111827;margin:0 0 24px 0;font-size:20px;">Merhaba ${displayName || 'Kullanıcı'},</h2>
      <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 24px 0;">
        Yönetici tarafından hesabınız için yeni bir giriş şifresi (pasaport) oluşturulmuştur. Aşağıdaki bilgileri kullanarak sisteme giriş yapabilirsiniz:
      </p>
      <div style="background-color:#f3f4f6;border-radius:8px;padding:24px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 12px 0;color:#6b7280;font-size:13px;width:120px;border-bottom:1px solid #e5e7eb;">E-posta</td>
            <td style="padding:0 0 12px 0;color:#111827;font-size:15px;font-weight:600;border-bottom:1px solid #e5e7eb;">${email}</td>
          </tr>
          <tr>
            <td style="padding:12px 0 0 0;color:#6b7280;font-size:13px;width:120px;">Yeni Şifre</td>
            <td style="padding:12px 0 0 0;color:#dc2626;font-size:18px;font-weight:700;letter-spacing:1px;">${tempPassword}</td>
          </tr>
        </table>
      </div>
      <p style="color:#4b5563;font-size:14px;line-height:24px;margin:0;">
        <strong>Önemli Not:</strong> Güvenliğiniz için sisteme giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.
      </p>
    </div>
    <div style="background-color:#f9fafb;border-top:1px solid #f3f4f6;padding:24px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} LOKMA Marketplace - Tüm hakları saklıdır.</p>
    </div>
  </div>
</body>
</html>`;

      const emailResponse = await sendEmailWithResend({
        to: email,
        subject: 'LOKMA: Yeni Giriş Şifreniz (Pasaport)',
        html: emailHtml,
      });

      if (emailResponse.success) {
        emailSent = true;
      } else {
        emailError = emailResponse.error;
      }
    }

    return NextResponse.json({ success: true, tempPassword, emailSent, emailError });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: error.message || 'Error returning new password' }, { status: 500 });
  }
}
