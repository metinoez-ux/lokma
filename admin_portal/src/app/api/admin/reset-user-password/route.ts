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
    try {
      await admin.auth.updateUser(uid, {
        password: tempPassword
      });
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        // Fallback: If the user is in Firestore but not in Firebase Auth, create the Auth user
        if (email) {
          await admin.auth.createUser({
            uid: uid,
            email: email,
            password: tempPassword,
            displayName: displayName || 'Kullanıcı'
          });
        } else {
          // If no email is provided, create with a dummy email just to allow password login
          await admin.auth.createUser({
            uid: uid,
            email: `${uid}@lokma.shop`,
            password: tempPassword,
            displayName: displayName || 'Kullanıcı'
          });
        }
      } else {
        throw authError; // Rethrow if it's some other error
      }
    }

    // Update requirePasswordChange flag in Firestore to force them to change it
    try {
      const userRef = admin.db.collection('users').doc(uid);
      const adminRef = admin.db.collection('admins').doc(uid);
      
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        await userRef.update({ requirePasswordChange: true });
      }
      
      const adminSnap = await adminRef.get();
      if (adminSnap.exists) {
        await adminRef.update({ requirePasswordChange: true });
      }
    } catch (dbError) {
      console.warn('Could not update requirePasswordChange flag:', dbError);
    }

    let emailSent = false;
    let emailError = null;

    if (sendEmail && email) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const logoUrl = `${baseUrl}/lokma_logo_new_red.png`;

      // Premium Dark Theme matching create-user
      const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;">
<div style="background-color:#f9fafb;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -1px rgba(0,0,0,0.03);border:1px solid #f3f4f6;">

<!-- Header with Logo -->
<div style="padding:40px 40px 24px 40px;text-align:center;">
 <img src="${logoUrl}" alt="LOKMA" style="height:32px;margin-bottom:8px;" />
 <p style="color:#6b7280;margin:0;font-size:14px;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">ŞİFRE YENİLEME</p>
</div>

<!-- Main Body -->
<div style="padding:0 40px 32px 40px;">
 <h2 style="color:#111827;margin:0 0 12px 0;font-size:24px;font-weight:700;">Merhaba ${displayName || 'Kullanıcı'},</h2>
 <p style="color:#4b5563;line-height:1.6;margin:0 0 24px 0;font-size:16px;">Yönetici tarafından hesabınız için yeni bir giriş şifresi (pasaport) oluşturulmuştur. Aşağıdaki bilgileri kullanarak sisteme giriş yapabilirsiniz:</p>

 <div style="background-color:#f9fafb;border-radius:8px;padding:24px;margin-bottom:24px;border:1px solid #f3f4f6;">
 <!-- Credentials -->
 <p style="margin:0 0 12px 0;color:#111827;font-weight:600;font-size:14px;">Giriş Bilgileriniz</p>
 <table style="width:100%;border-collapse:collapse;">
 <tr>
 <td style="padding:0 0 8px 0;color:#6b7280;font-size:13px;width:120px;">E-posta</td>
 <td style="padding:0 0 8px 0;color:#111827;font-size:15px;font-weight:600;">${email}</td>
 </tr>
 <tr>
 <td style="padding:0;color:#6b7280;font-size:13px;">Yeni Şifre</td>
 <td style="padding:0;">
 <span style="background-color:#f3f4f6;color:#111827;padding:4px 8px;border-radius:4px;font-size:15px;font-family:monospace;letter-spacing:1px;font-weight:600;">${tempPassword}</span>
 <div style="font-size:11px;color:#dc2626;margin-top:4px;font-weight:600;">(Geçici Şifre)</div>
 </td>
 </tr>
 </table>
 </div>

 <p style="margin:0 0 32px 0;color:#dc2626;font-size:13px;font-weight:500;">
 Lütfen ilk girişinizde şifrenizi hemen değiştirin!
 </p>

 <!-- CTA Button -->
 <div style="text-align:center;">
 <a href="${baseUrl}/login" style="display:inline-block;background-color:#dc2626;color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.3px;">Panele Giriş Yap</a>
 </div>
</div>

</div>

<!-- Footer -->
<div style="text-align:center;margin-top:24px;padding:0 20px;">
 <p style="color:#6b7280;font-size:12px;margin:0 0 8px 0;line-height:1.5;">
 Bu e-posta LOKMA platformu üzerinden otomatik olarak gönderilmiştir.<br/>
 </p>
 <p style="color:#9ca3af;font-size:11px;margin:0;">&copy; ${new Date().getFullYear()} LOKMA &middot; Tüm hakları saklıdır.</p>
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
