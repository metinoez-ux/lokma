---
description: Audit sonrası rapor emaili gönderme
---

# Audit Raporu ve Email Gönderimi

Herhangi bir büyük audit veya bug fix raporundan sonra bu işlemi TAMAMLA.

1. Audit raporunu MD formatında hazırla (örnek `audit_report_13042026.md`)
2. Rapor dosyasını NAS klasörüne kopyala (`/Users/metinoz/Library/CloudStorage/SynologyDrive-Mtn/LOKMA/md_/audit/`)
3. E-mail göndermek için admin portal API'sini çağır (aşağıdaki cURL'ü kullan)

```bash
curl -X POST "https://lokma.shop/api/email/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "metin.oez@gmail.com",
    "subject": "LOKMA AI - Audit Raporu",
    "html": "Audit raporu NAS klasörüne kopyalandı. Lütfen kontrol ediniz."
  }'
```
