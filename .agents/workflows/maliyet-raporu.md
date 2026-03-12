---
description: LOKMA platformunun güncel maliyet ve değerleme raporunu oluşturur
---

# Maliyet Raporu Oluşturma Workflow'u

Bu workflow, LOKMA platformunun o anki kod tabanını analiz ederek güncel bir yazılım maliyet ve değerleme raporu üretir.

## Adım 1: Mobil Uygulama Kod Analizi
// turbo
```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/mobile_app && find lib -name "*.dart" | wc -l && echo "---" && find lib -name "*.dart" | xargs cat | wc -l && echo "---" && echo "Screens:" && find lib/screens -maxdepth 1 -type d | wc -l && echo "Services:" && find lib/services -name "*.dart" | wc -l && echo "Providers:" && find lib/providers -name "*.dart" | wc -l && echo "Widgets:" && find lib/widgets -name "*.dart" | wc -l && echo "Models:" && find lib/models -name "*.dart" | wc -l
```

## Adım 2: Mobil Uygulama Modül Bazlı LOC Dağılımı
// turbo
```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/mobile_app/lib/screens && for dir in $(find . -maxdepth 1 -type d | sort); do count=$(find "$dir" -name "*.dart" | wc -l); loc=$(find "$dir" -name "*.dart" | xargs cat 2>/dev/null | wc -l); echo "$dir: $count files / $loc LOC"; done
```

## Adım 3: Mobil Bağımlılık Sayısı
// turbo
```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/mobile_app && grep -c ":" pubspec.yaml | head -1 && echo "Dependencies:" && grep "^\s\s[a-z]" pubspec.yaml | grep -v "#" | wc -l
```

## Adım 4: Admin Portal Kod Analizi
// turbo
```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/src && find . -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" -o -name "*.css" | grep -v node_modules | wc -l && echo "---" && find . -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" -o -name "*.css" | grep -v node_modules | xargs cat 2>/dev/null | wc -l && echo "---" && echo "Admin pages:" && find app/\[locale\]/admin -maxdepth 1 -type d 2>/dev/null | wc -l && echo "API routes:" && find app/api -maxdepth 2 -type d 2>/dev/null | wc -l
```

## Adım 5: Admin Portal i18n Analizi
// turbo
```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/messages && for f in *.json; do [ -f "$f" ] && echo "$f: $(wc -l < "$f")"; done
```

## Adım 6: Firebase Functions Analizi
// turbo
```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/functions && find . -name "*.js" | grep -v node_modules | xargs wc -l 2>/dev/null
```

## Adım 7: IoT Gateway Analizi
// turbo
```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026 && find iot-gateway -type f 2>/dev/null | wc -l && find iot-gateway -type f 2>/dev/null | xargs cat 2>/dev/null | wc -l
```

## Adım 8: Mobil i18n Analizi
// turbo
```bash
cd /Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/mobile_app/assets/translations && for f in *.json; do echo "$f: $(wc -l < "$f")"; done
```

## Adım 9: Rapor Oluşturma

Yukarıdaki tüm verileri topladıktan sonra, aşağıdaki yapıda kapsamlı bir rapor oluştur ve `/Users/metinoz/.gemini/antigravity/brain/<conversation-id>/lokma_valuation_report.md` dosyasına yaz:

### Rapor İçeriği:
1. **Genel Bakış — Kod Metrikleri**: Tüm projelerin dosya sayısı, LOC, teknoloji tablosu
2. **Modül / Entegrasyon Haritası**: Mobil modüller, admin sayfaları, API route'ları, 3. parti entegrasyonlar
3. **Dünya Çapında Büyük Firmalar**: 5 global firma profili (EPAM, Globant, ThoughtWorks, Appinventiv, Endava) — çalışan sayısı, saatlik ücret, LOKMA tahmini teklif
4. **Maliyet Tahmini**: İyimser (offshore) ve Kötümser (onshore Almanya) senaryolar — Android dahil
5. **Aylık Bakım Maliyeti**: iOS + Android bakım kalemleri
6. **Platform Değerleme**: İyimser / Gerçekçi / Kötümser değerleme aralıkları

### Piyasa Verileri (2025-2026 referans):
- Almanya senior dev: €90-150/saat
- Doğu Avrupa nearshore: €45-70/saat
- Hindistan offshore: €28-65/saat
- ABD premium danışmanlık: €100-180/saat
- Bakım maliyeti: yıllık geliştirme maliyetinin %15-25'i
- Flutter cross-platform avantajı: native'e göre %50-60 tasarruf
- Android ek maliyet (Flutter ile): toplam projenin %5-8'i
