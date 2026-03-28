const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

const businessName = "LOKMA Istanbul";
const customerName = "Metin Öz";
const customerEmail = "metin.oez@gmail.com";
const dateStr = "28 Mart 2026";
const timeStr = "19:30";
const partySize = 4;
const tableCardNumbers = [12, 14];
const icsBase64 = Buffer.from("BEGIN:VCALENDAR\\nVERSION:2.0\\nEND:VCALENDAR").toString("base64");
const googleCalendarUrl = "https://calendar.google.com";

const newStatus = "confirmed";
const emailSubject = `✅ Rezervasyon Onaylandı – ${businessName}`;
const emailHeader = "Rezervasyon Onaylandı";
const emailMessage = "Masa rezervasyonunuz başarıyla onaylanmıştır. Sizi ağırlamak için sabırsızlanıyoruz!";
const brandColor = "#E91E63"; // LOKMA Brand Pink/Red

const tableCardHtml = tableCardNumbers.length > 0
    ? `<div class="table-card">
        <p class="table-card-title">MASA NUMARANIZ</p>
        <div class="table-card-numbers-wrapper">
            ${tableCardNumbers.map((n) => `<span class="table-card-numbers">${n}</span>`).join(" ")}
        </div>
    </div>`
    : "";

const preOrderHtml = `
    <div class="preorder-box">
        <h3 class="preorder-title">Sipariş Detaylarınız</h3>
        <div class="preorder-item">
            <div class="preorder-item-content">
                <div class="preorder-item-name">2x LOKMA Special Menü</div>
                <div class="preorder-item-options">+ Acısız, İçecek: İce Tea</div>
            </div>
        </div>
        <div class="preorder-item">
            <div class="preorder-item-content">
                <div class="preorder-item-name">2x Porsiyon Köfte</div>
                <div class="preorder-item-options">+ Az Pişmiş</div>
            </div>
        </div>
    </div>
`;

const calendarHtml = newStatus === "confirmed" ? `
    <div class="calendar-section">
        <a href="${googleCalendarUrl}" target="_blank" class="calendar-btn">📅 Takvime Ekle</a>
        <p class="calendar-note">iCal dosyası ektedir — Apple Takvim veya Outlook'a kolayca ekleyebilirsiniz.</p>
    </div>
` : "";

const emailAttachments = newStatus === "confirmed" ? [{
    filename: "rezervasyon.ics",
    content: icsBase64,
}] : [];

const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
    <style>
        /* Base / Light Mode Defaults */
        body, .email-container { background-color: #f7f7f9; color: #111111; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; line-height: 1.6; }
        .email-body { background-color: #ffffff; max-width: 600px; margin: 40px auto; border-radius: 16px; overflow: hidden; border: 1px solid #eaeaea; }
        
        .header { text-align: center; padding: 40px 20px 10px; }
        .header img { max-height: 70px; margin-bottom: 25px; }
        .header h1 { color: #111111; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { color: #666666; margin: 8px 0 0; font-size: 15px; }
        
        .content { padding: 0 40px 40px; }
        
        .greeting { font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 15px; }
        .message { font-size: 15px; color: #555555; margin-bottom: 30px; }
        
        .details-box { background-color: #fafafa; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #f0f0f0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 12px 0; font-size: 15px; border-bottom: 1px solid #f0f0f0; }
        tr:last-child td { border-bottom: none; padding-bottom: 0; }
        tr:first-child td { padding-top: 0; }
        
        .label { color: #777777; font-size: 14px; }
        .value { text-align: right; color: #111111; font-weight: 600; }
        .value.highlight { color: ${brandColor}; font-size: 16px; }
        
        .table-card { background-color: #fff0f4; border: 1px solid #ffd8e4; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
        .table-card-title { color: ${brandColor}; font-size: 12px; font-weight: 700; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px; }
        .table-card-numbers-wrapper { display: flex; gap: 12px; justify-content: center; }
        .table-card-numbers { background-color: ${brandColor}; color: #ffffff; padding: 10px 20px; border-radius: 10px; font-size: 22px; font-weight: 800; }
        
        .preorder-box { margin: 40px 0 30px; }
        .preorder-title { margin: 0 0 15px; color: #111111; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }
        .preorder-item { padding: 14px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: flex-start; }
        .preorder-item:last-child { border-bottom: none; }
        .preorder-item-content { flex: 1; }
        .preorder-item-name { color: #111111; font-weight: 600; font-size: 15px; }
        .preorder-item-options { color: #777777; font-size: 13px; margin-top: 4px; }
        
        .calendar-section { text-align: center; margin: 40px 0 20px; padding-top: 30px; border-top: 1px solid #eaeaea; }
        .calendar-btn { display: inline-block; background: #111111; color: #ffffff !important; padding: 14px 32px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 15px; letter-spacing: 0.5px; }
        .calendar-note { color: #999999; font-size: 12px; margin-top: 16px; }
        
        .sign-off { text-align: center; margin-top: 40px; padding-top: 30px; }
        .handwritten { font-family: 'Dancing Script', cursive, Arial; font-size: 36px; color: ${brandColor}; margin: 10px 0 20px; font-weight: 700; }
        
        .footer { text-align: center; padding: 30px; color: #999999; font-size: 12px; }

        /* Dark Mode */
        @media (prefers-color-scheme: dark) {
            body, .email-container { background-color: #0a0a0a !important; color: #ffffff !important; }
            .email-body { background-color: #141414 !important; border-color: #222222 !important; }
            
            .header h1 { color: #ffffff !important; }
            .header p { color: #999999 !important; }
            
            .greeting { color: #ffffff !important; }
            .message { color: #aaaaaa !important; }
            
            .details-box { background-color: #1a1a1a !important; border-color: #222222 !important; }
            td { border-bottom-color: #222222 !important; }
            .label { color: #888888 !important; }
            .value { color: #ffffff !important; }
            .value.highlight { color: #ff4081 !important; }
            
            .table-card { background-color: #2a0b14 !important; border-color: #4a1525 !important; }
            .table-card-title { color: #ff4081 !important; }
            .table-card-numbers { background-color: #ff4081 !important; color: #ffffff !important; }
            
            .preorder-title { color: #ffffff !important; border-bottom-color: #333333 !important; }
            .preorder-item { border-bottom-color: #222222 !important; }
            .preorder-item-name { color: #ffffff !important; }
            .preorder-item-options { color: #888888 !important; }
            
            .calendar-section { border-top-color: #222222 !important; }
            .calendar-btn { background: #ffffff !important; color: #111111 !important; }
            
            .handwritten { color: #ff4081 !important; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!--[if mso]><table align="center" border="0" cellspacing="0" cellpadding="0" width="600" style="width:600px; background-color: #ffffff;"><tr><td><![endif]-->
        <div class="email-body">
            <div class="header">
                <img src="https://lokma.shop/lokma_red_pink.png" alt="LOKMA Logo" />
            </div>
            <div class="content">
                <p class="greeting">Merhaba <strong>${customerName}</strong>,</p>
                <p class="message">${emailMessage}</p>
                
                <div class="details-box">
                    <table>
                        <tr><td class="label">İşletme</td><td class="value">${businessName}</td></tr>
                        <tr><td class="label">Tarih</td><td class="value">${dateStr}</td></tr>
                        <tr><td class="label">Saat</td><td class="value">${timeStr}</td></tr>
                        <tr><td class="label">Kişi Sayısı</td><td class="value highlight">${partySize} Kişi</td></tr>
                    </table>
                </div>
                
                ${tableCardHtml}
                ${preOrderHtml}
                
                <h2 style="text-align: center; color: #111111; font-size: 20px; margin: 30px 0 10px;">${emailHeader}</h2>
                <div style="text-align: center; border-bottom: 2px solid ${brandColor}; width: 40px; margin: 0 auto 10px;"></div>
                
                ${calendarHtml}
                
                <div class="sign-off">
                    <p style="color: #666; font-size: 14px; margin: 0 0 5px;">Bizi tercih ettiğiniz için teşekkür ederiz.</p>
                    <p class="handwritten">Afiyet olsun!</p>
                    <p style="color: #888; font-size: 13px; margin: 0;">Saygılarımızla,<br/><strong style="color: #111;">${businessName} Ekibi</strong></p>
                </div>
            </div>
            <div class="footer">
                Bu e-posta <strong>LOKMA Marketplace</strong> üzerinden gönderilmiştir.<br/>&copy; 2026 LOKMA. Tüm hakları saklıdır.
            </div>
        </div>
        <!--[if mso]></td></tr></table><![endif]-->
    </div>
</body>
</html>
`;

async function main() {
    try {
        const response = await resend.emails.send({
            from: 'LOKMA Rezervasyon Test <noreply@lokma.shop>',
            to: customerEmail,
            subject: emailSubject,
            html: htmlContent,
            attachments: emailAttachments
        });
        console.log("TEST EMAIL SENT SUCCESSFULLY:", response);
    } catch (err) {
        console.error("ERROR SENDING TEST EMAIL:", err);
    }
}
main();
