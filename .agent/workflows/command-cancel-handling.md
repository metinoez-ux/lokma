---
description: Komut cancel olursa hemen fark et ve devam et
---

# Komut Cancel Algilama Kurali

## Kural
Bir `run_command` veya `flutter analyze`, `tsc`, `flutter build`, `flutter run` gibi komut calistirildiginda:

1. **Komut sonucu "The user cancelled the command." donerse:**
   - HEMEN fark et, bekleme yapma
   - Kullaniciya sormadan komutu tekrar calistir (ayni SafeToAutoRun degeriyle)
   - Eger 2. kez de cancel olursa, kullaniciya "Komut 2 kez cancel oldu, devam edeyim mi?" diye sor

2. **Uzun suren komutlar icin:**
   - `flutter analyze` -> max 15 saniye bekle (WaitMsBeforeAsync: 10000 yeterli, degilse async ile devam et)
   - `tsc --noEmit` -> max 15 saniye bekle
   - `flutter build` -> async olarak calistir, command_status ile takip et
   - `npm run build` / `npx next build` -> async olarak calistir

3. **Cancel sonrasi davranis:**
   - Cancel olan komutu ASLA "basarili" gibi raporlama
   - Cancel olan komutun sonucunu bekleyerek "calisiyor" gibi gosterme
   - Hemen bir sonraki isleme gec veya tekrar dene
