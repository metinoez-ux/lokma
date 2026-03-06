---
description: Audit sonrası rapor emaili gönderme
---

# Audit Rapor E-posta Workflow'u

Her kapsamlı audit ve düzeltme oturumundan sonra, detaylı bir rapor e-postası gönderilmelidir.

## Adımlar

1. Audit bulgularını `audit_email_report.md` olarak artifact dizinine yaz
2. Raporda şunlar bulunmalı:
   - Yönetici özeti
   - Düzeltilen kritik hatalar
   - Tema uyumluluğu sorunları (düzeltilen + kalan)
   - i18n bulguları (düzeltilen + kalan)
   - Firebase ve performans bulguları
   - Derleme doğrulaması
   - Önerilen sonraki adımlar
3. Raporu Resend API ile e-posta olarak gönder:
   - **Alıcı:** <metin.oez@gmail.com>
   - **Gönderen:** LOKMA Marketplace <noreply@lokma.shop>
   - **Konu formatı:** 🔍 LOKMA [Audit Türü] Raporu — [Tarih]

// turbo
4. E-posta gönderme komutu:

```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal && node -e "
const { Resend } = require('resend');
const fs = require('fs');
const resend = new Resend('re_5652Y16U_4vAQyzKHKbgEV2Y5dSsUXzyC');
const markdown = fs.readFileSync('[RAPOR_DOSYASI_YOLU]', 'utf-8');
let html = markdown
  .replace(/^# (.+)$/gm, '<h1 style=\"color:#FB335B;font-family:sans-serif\">\$1</h1>')
  .replace(/^## (.+)$/gm, '<h2 style=\"color:#333;font-family:sans-serif;border-bottom:2px solid #FB335B;padding-bottom:6px\">\$2</h2>')
  .replace(/^### (.+)$/gm, '<h3 style=\"font-family:sans-serif;color:#555\">\$1</h3>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>\$1</strong>')
  .replace(/\\\`(.+?)\\\`/g, '<code style=\"background:#f0f0f0;padding:2px 6px;border-radius:3px\">\$1</code>')
  .replace(/^- (.+)$/gm, '<li>\$1</li>')
  .replace(/^---$/gm, '<hr style=\"border:1px solid #eee;margin:24px 0\">')
  .replace(/\n\n/g, '<br><br>')
  .replace(/\n/g, '<br>');
html = '<div style=\"max-width:800px;margin:auto;padding:24px;font-family:sans-serif;line-height:1.6\">' + html + '</div>';
(async () => {
  const { data, error } = await resend.emails.send({
    from: 'LOKMA Marketplace <noreply@lokma.shop>',
    to: 'metin.oez@gmail.com',
    subject: '[KONU]',
    html, text: markdown,
  });
  console.log(error ? 'Error: ' + JSON.stringify(error) : 'Email sent! ID: ' + data.id);
})();
"
```

## Notlar

- Tüm diller kontrol edilmeli: TR, DE, EN, ES, FR, IT
- Admin portal, mobil uygulama ve web sayfası kapsanmalı
- Resend API anahtarı: admin_portal/.env.production dosyasında
