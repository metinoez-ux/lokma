---
description: Deploy sırasında hata veya bağlantı kopması durumunda kullanıcıya hemen haber verme kuralı
---

# Deploy & Uzun Komut İzleme Kuralları

## 🚨 MUTLAKA UYULMASI GEREKEN KURALLAR

### 1. Deploy Hatası → Anında Bildir

- Eğer `firebase deploy`, `npx next build`, veya herhangi bir deploy/build komutu **hata verirse** → kullanıcıya **HEMEN** `notify_user` ile haber ver.
- Hata mesajını aynen paylaş, ne olduğunu açıkla.
- Sessizce arka planda bekleme, zaman kaybettirme.

### 2. Komut Takılırsa → Bildir

- Eğer bir komut **3 dakikadan fazla** sürüyorsa ve çıktı yoksa → kullanıcıya durum güncellemesi ver.
- "Deploy devam ediyor, X dakikadır çalışıyor" gibi kısa bir bilgilendirme yap.

### 3. Bağlantı Kopması / Timeout

- Eğer bir komut `timeout`, `ECONNRESET`, `socket hang up`, veya benzeri bir bağlantı hatası verirse → **hemen** kullanıcıya bildir.
- Otomatik yeniden deneme yapma, önce kullanıcıya sor.

### 4. Build Başarısız → Deploy Yapma

- Build (`next build`) başarısız olursa deploy denemesi **yapma**.
- Hatayı kullanıcıya bildir, düzeltmeyi öner.

### 5. Deploy Sonrası Onay

- Deploy başarılı olduğunda kullanıcıya **hemen** "✅ Deploy tamamlandı, URL: ..." şeklinde bilgi ver.
- Deploy başarısız olduğunda kullanıcıya **hemen** "❌ Deploy başarısız, hata: ..." şeklinde bilgi ver.

## Özet
>
> **Asla sessizce arka planda bekleme. Kullanıcı her zaman durumdan haberdar olmalı.**
