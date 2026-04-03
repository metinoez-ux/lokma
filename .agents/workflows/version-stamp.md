---
description: Her git push, admin portal deploy veya mobil build sonrasi versiyon damgasini guncelle
---

# Versiyon Damgasi Guncelleme

Her deploy veya build sonrasi bu adimlari uygula. Proje bitmeden bu damgalar kaldirilmaz.

## Damga Nerede Gorunur

- **Admin Panel** (web): `AdminHeader.tsx` ve `PublicHeader.tsx` — topbar'da `v.GG.AA.YYYY SS:DD` formatinda
- **Mobil App** (Flutter): `profile_screen.dart` profil sayfasi header'i — kullanici adinin altinda kucuk yazi

## Damga Nasil Calisir

### Admin Portal (Next.js)
`admin_portal/next.config.ts` dosyasinda build sirasinda env degiskeni otomatik set edilir:
```ts
NEXT_PUBLIC_BUILD_TIME: new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
}).format(new Date())
```
Her `npm run build` veya `firebase deploy --only hosting` calistiginda otomatik guncellenir.
**Ekstra bir adim gerekmez.**

### Mobil App (Flutter)
`mobile_app/lib/core/constants/build_info.dart` dosyasindaki `buildTime` sabiti elle guncellenmesi gerekir.
Format: `GG.AA.YYYY SS:DD`

## Zorunlu Adimlar (Her Seferinde)

### Admin Portal build/deploy yaparken:
Hic bir ek adim gerekmez. `next.config.ts` otomatik damgayi set eder.

### Mobil App build yaparken (flutter run / install):

// turbo
1. `build_info.dart` dosyasini guncelle — mevcut tarih ve saati yaz:
```bash
STAMP=$(date '+%d.%m.%Y %H:%M')
sed -i '' "s/defaultValue: '[^']*'/defaultValue: '$STAMP'/" /Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/core/constants/build_info.dart
```

2. Dosyanin guncellendigi dogrula:
```bash
cat /Users/metinoz/Developer/LOKMA_MASTER/mobile_app/lib/core/constants/build_info.dart
```

3. Degisikligi commit et:
```bash
cd /Users/metinoz/Developer/LOKMA_MASTER
git add mobile_app/lib/core/constants/build_info.dart
git commit -m "chore: update mobile build stamp $(date '+%d.%m.%Y %H:%M')"
git push
```

## Damgayi Kaldirma (Proje Bittikten Sonra)

Proje tamamlandiginda:

1. `mobile_app/lib/core/constants/build_info.dart` dosyasindaki `buildTime` kullanild??i yerden kaldır
2. `profile_screen.dart` icindeki `BuildInfo.buildTime` Text widget'ini sil
3. `admin_portal/src/components/admin/AdminHeader.tsx` icindeki `{process.env.NEXT_PUBLIC_BUILD_TIME && ...}` bloklarini sil (2 adet)
4. `admin_portal/src/components/ui/PublicHeader.tsx` icindeki ayni bloku sil
5. `admin_portal/next.config.ts` icindeki `NEXT_PUBLIC_BUILD_TIME` satiri sil
