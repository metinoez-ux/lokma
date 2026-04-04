export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend } from '@/lib/resend-email';

const APP_STORE_URL = 'https://apps.apple.com/app/lokma/id123456789'; // TODO: replace with real ID
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.lokma.app'; // TODO: replace with real ID

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Gecersiz istek govdesi' }, { status: 400 });
  }

  const {
    recipientEmail: _recipientEmail,
    recipientName: _recipientName,
    recipientPhone: _recipientPhone,
    kermesName: _kermesName,
    kermesId,
    roles = [],
    isKermesAdmin = false,
    assignerName,
    locale = 'tr',
    isNewUser = false,
    loginEmail,
    tempPassword,
    // Legacy field names from handleAssignExistingUser
    userEmail,
    userName,
    userPhone,
    kermesTitle,
  } = body;

  // Resolve field name aliases
  const recipientEmail = _recipientEmail || userEmail;
  const recipientName = _recipientName || userName;
  const recipientPhone = _recipientPhone || userPhone;
  const kermesName = _kermesName || kermesTitle;

  if (!recipientEmail) {
    return NextResponse.json({ error: 'Alici email adresi zorunludur' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const logoUrl = `${baseUrl}/lokma_logo_new_red.png`;

  // Role display names (TR)
  const roleLabels: Record<string, string> = {
    staff: 'Kermes Personeli',
    driver: 'Surucu',
    waiter: 'Garson',
    kermes_admin: 'Kermes Admini',
  };

  const assignedRoleNames = roles
    .filter((r: string) => r !== 'kermes_admin')
    .map((r: string) => roleLabels[r] || r);

  if (isKermesAdmin || roles.includes('kermes_admin')) {
    assignedRoleNames.unshift(roleLabels['kermes_admin']);
  }

  const rolesText = assignedRoleNames.join(', ') || 'Personel';
  const firstName = recipientName?.split(' ')[0] || recipientName || 'Degerli Kullanici';

  // ── Localized strings (currently TR only, extend as needed) ──────────────
  const subject = isKermesAdmin
    ? `${kermesName} - Kermes Admini Olarak Atandiniz`
    : `${kermesName} - Kermes Personeli Olarak Atandiniz`;

  const kermesUrl = `${baseUrl}/tr/admin/kermes/${kermesId}`;

  const credentialsSection = isNewUser && loginEmail && tempPassword ? `
    <div style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 12px 0;color:#9a3412;font-weight:700;font-size:15px;">
        Uygulama Giris Bilgileriniz
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;width:100px;">Kullanici Adi</td>
          <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${loginEmail}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">Gecici Sifre</td>
          <td style="padding:6px 0;">
            <code style="background:#f3f4f6;color:#111827;padding:4px 10px;border-radius:4px;font-size:15px;font-family:monospace;letter-spacing:1.5px;font-weight:700;">${tempPassword}</code>
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0 0;color:#dc2626;font-size:12px;font-weight:600;">
        Ilk giriste sifrenizi degistirmeniz gerekmektedir.
      </p>
    </div>` : '';

  const appDownloadSection = `
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:16px 0;">
      <p style="margin:0 0 12px 0;color:#166534;font-weight:700;font-size:14px;">
        LOKMA Uygulamasini Indirin
      </p>
      <p style="margin:0 0 12px 0;color:#4b5563;font-size:13px;line-height:1.6;">
        Mobil uygulamadan <strong>Profilim &gt; Personel Menusu</strong> uzerinden kermes paneline erisebilirsiniz.
      </p>
      <table style="border-collapse:collapse;">
        <tr>
          <td style="padding-right:12px;">
            <a href="${APP_STORE_URL}" style="display:inline-block;background-color:#111827;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
              App Store (iOS)
            </a>
          </td>
          <td>
            <a href="${PLAY_STORE_URL}" style="display:inline-block;background-color:#166534;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
              Google Play (Android)
            </a>
          </td>
        </tr>
      </table>
    </div>`;

  const kermesAdminSection = isKermesAdmin ? `
    <div style="background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:20px;margin:16px 0;">
      <p style="margin:0 0 8px 0;color:#6b21a8;font-weight:700;font-size:14px;">
        Kermes Admin Yetkiniz Hakkinda
      </p>
      <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.7;">
        Bundan sonra <strong>${kermesName}</strong> icin Kermes Admin olarak gorev yapacaksiniz.
        Bu yetki ile kermes kapsamindaki personeli siz de olusturabilir ve atayabilirsiniz.
        Ayni zamanda web admin paneline de erisim saglayabilirsiniz.
      </p>
    </div>` : '';

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;">
<div style="background-color:#f9fafb;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:540px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.07);border:1px solid #f3f4f6;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:32px 40px;text-align:center;">
    <img src="${logoUrl}" alt="LOKMA" style="height:34px;margin-bottom:6px;" />
    <p style="color:rgba(255,255,255,0.85);margin:0;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">
      ${kermesName}
    </p>
  </div>

  <!-- Body -->
  <div style="padding:32px 40px;">
    <h2 style="color:#111827;margin:0 0 10px 0;font-size:22px;font-weight:700;">
      Merhaba ${firstName}!
    </h2>
    <p style="color:#4b5563;line-height:1.7;margin:0 0 20px 0;font-size:15px;">
      <strong>${kermesName}</strong> kermesine <strong>${rolesText}</strong> olarak atandiniz.
      ${assignerName ? `<br><span style="color:#6b7280;font-size:13px;">Sizi atayan: ${assignerName}</span>` : ''}
    </p>

    <!-- Roles -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
      ${assignedRoleNames.map((r: string) => `
        <span style="display:inline-block;background-color:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid #fecaca;">
          ${r}
        </span>
      `).join('')}
    </div>

    ${credentialsSection}
    ${kermesAdminSection}
    ${appDownloadSection}

    <!-- CTA -->
    <div style="text-align:center;margin-top:28px;">
      <a href="${kermesUrl}" style="display:inline-block;background-color:#dc2626;color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
        Kermes Paneline Git
      </a>
    </div>

    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;line-height:1.5;">
      Bu e-posta LOKMA platformu uzerinden otomatik olarak gonderilmistir.<br>
      <strong>© ${new Date().getFullYear()} LOKMA</strong> · Tum haklari saklidir.
    </p>
  </div>

</div>
</div>
</body>
</html>`;

  try {
    const result = await sendEmailWithResend({
      to: recipientEmail,
      subject,
      html: emailHtml,
    });

    if (!result.success) {
      console.error('notify-assignment email failed:', result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    console.log(`notify-assignment email sent to ${recipientEmail} for kermes ${kermesId}`);
    return NextResponse.json({ success: true, email: recipientEmail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('notify-assignment exception:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
