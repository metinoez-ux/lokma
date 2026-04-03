---
description: Always run hot reload (r) or full restart (R) after every code change on Pixel 10
---

# Auto Hot Reload Rule

Kullanıcı Kuralı: Yapılan her kod değişikliğinden sonra (Flutter uygulaması için) ana geliştirici cihazı olan Pixel 10 cihazına bir hot reload (`r`) veya gerekiyorsa uygulama baştan başlatılarak (restart `R` / yeni build) gönderilmelidir. 
Ve bu işlem yapıldıktan sonra kullanıcıya MUTLAKA haber verilmelidir.

## Adımlar:
1. Bir .dart dosyasında veya UI üzerinde kod değişikliği yaptıktan sonra işin bitiminde projede koşmakta olan flutter processine terminalden (run_command via send_command_input vb. ile) `r` tuşunu basarak hot reload yolla.
2. Eğer terminal üzerinden run_command ile `flutter run` vb session'ı aktif değilse veya `r` gönderme imkanı yoksa kullanıcıya haber ver: "Hot reload yollayamadım çünkü aktif bir terminal session'ım bulunmuyor."
3. Hot reload başarıyla gönderildiğinde (veya hata verirse) kullanıcıyı bilgilendir: "Değişiklikleri yaptım ve Pixel 10 cihazınıza hot reload (r) gönderdim."
4. Gereken durumlarda `R` ile hot restart da atılabilir, bunu da kullanıcıya bildir.
