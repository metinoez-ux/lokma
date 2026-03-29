require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

const payload = {
  "antigravity_payload": {
    "metadata": {
      "description": "Demo Uygulamalar İçin 2026 Yılına Uyarlanmış Kermes Veri Seti",
      "version": "2.0",
      "year": "2026"
    },
    "kermes_listesi": [
      {
        "etkinlik_ismi": "Hamidiye Lezzet Günleri",
        "tarih": "26-27-28 Temmuz 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Hamidiye (Bartın Kozcağız)",
        "one_cikan_ozellikler": "El Emeği Çeyizleri satışı",
        "one_cikan_lezzetler": "Döner çeşitleri, Izgara, Mantı, Gözleme, Lahmacun"
      },
      {
        "etkinlik_ismi": "Lüdenscheid Kermes Frühlingsfest",
        "tarih": "27-28-29 Nisan 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Worthstr. 4-10, 58511 Lüdenscheid",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "Belirtilmemiş"
      },
      {
        "etkinlik_ismi": "Mintıka Köln Kermesi",
        "tarih": "1-5 Kasım 2026",
        "kac_gun_surdu": "5 Gün",
        "adres": "Eythstr. 72, 51103 Köln-Kalk (Ferah Talebe Yurdu)",
        "one_cikan_ozellikler": "'Her zaman bulunmaz' konseptiyle özel lezzet günleri",
        "one_cikan_lezzetler": "Balık Ekmek (Back Fisch), Odun Ateşinde Flammlachs, Posof Mantısı (Hınkal), Ehren Burger, Sucuk Döner, Dondurmalı Künefe"
      },
      {
        "etkinlik_ismi": "Köln Kır Kermesi (Hückelhoven)",
        "tarih": "1-5 Ekim 2026",
        "kac_gun_surdu": "5 Gün",
        "adres": "Jacobastraße 89, 41836 Hückelhoven",
        "one_cikan_ozellikler": "Açık alanda kır kermesi, Ücretsiz Giriş (Eintritt frei), Çocuk atraksiyonları/balonları, Cenaze fonu standı imkanı",
        "one_cikan_lezzetler": "Özel Spesiyaller (Spezialitäten), Çay"
      },
      {
        "etkinlik_ismi": "Düsseldorf Kermes Familienfest",
        "tarih": "27-29 Eylül 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Dieselstraße 99, 40235 Düsseldorf (Schützenplatz Flingern)",
        "one_cikan_ozellikler": "Aile festivali, Çocuklar için şişme oyun alanı (Hüpfburg)",
        "one_cikan_lezzetler": "Adana Kebab, Hähnchen Grill, Döner Kebab, Taze Baklava ve Tatlılar"
      },
      {
        "etkinlik_ismi": "Düsseldorf Barbecue Time Kermes",
        "tarih": "9-10 Eylül 2026",
        "kac_gun_surdu": "2 Gün",
        "adres": "Ackerstr. 22, 40233 Düsseldorf",
        "one_cikan_ozellikler": "İnşaat yararına hayır çarşısı",
        "one_cikan_lezzetler": "Adana ve Tavuk Izgara, Döner, Argelato Dondurma"
      },
      {
        "etkinlik_ismi": "Kalk Ferah Nachbarschaftsfest & Sofrası",
        "tarih": "6-8 Aralık 2026 / 25-26 Aralık 2026",
        "kac_gun_surdu": "2-3 Gün",
        "adres": "Eythstr. 72, 51103 Köln-Kalk",
        "one_cikan_ozellikler": "'Soğuk Havada Sıcak Ortam', PayPal ile ödeme imkanı",
        "one_cikan_lezzetler": "Arabaşı Çorbası, Tavuk Pirzola, Adana Dürüm, Döner"
      },
      {
        "etkinlik_ismi": "Bergkamen Kermes",
        "tarih": "Belirtilmemiş (2026 Demo)",
        "kac_gun_surdu": "Belirtilmemiş",
        "adres": "Bergkamen",
        "one_cikan_ozellikler": "Evlere Servis Yapılır (Lieferservice)",
        "one_cikan_lezzetler": "Döner"
      },
      {
        "etkinlik_ismi": "Selimiye Hafızlık Kursu Frühlingsfest",
        "tarih": "9-12 Mayıs 2026",
        "kac_gun_surdu": "4 Gün",
        "adres": "Wolfsgasse 43, 52499 Baesweiler",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "Izgara Çeşitleri, Döner, Adana Kebap, Pasta ve Tatlı Çeşitleri"
      },
      {
        "etkinlik_ismi": "Eschweiler Bahar Kermesi",
        "tarih": "8-11 Haziran 2026",
        "kac_gun_surdu": "4 Gün",
        "adres": "Talstr. 152, 52249 Eschweiler",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "Tantuni, Lahmacun, Baklava, Izgara"
      },
      {
        "etkinlik_ismi": "Recklinghausen Kermes TO GO",
        "tarih": "10-12 Aralık 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Dortmunder Str. 170, 45665 Recklinghausen",
        "one_cikan_ozellikler": "Talebe hizmetine katkı, Gel-Al (To Go), 40€ üzeri 10 km çevreye paket ve teslimat servisi",
        "one_cikan_lezzetler": "Belirtilmemiş"
      },
      {
        "etkinlik_ismi": "Saarbrücken Balık Festivali",
        "tarih": "24-25 Ocak 2026",
        "kac_gun_surdu": "2 Gün",
        "adres": "Bergstr. 62, 66115 Saarbrücken",
        "one_cikan_ozellikler": "Sıcak oturma yeri mevcuttur",
        "one_cikan_lezzetler": "Uskumru, Çupra, Hamsi"
      },
      {
        "etkinlik_ismi": "La Gran Kermes (Meksika)",
        "tarih": "31 Mayıs-1 Haziran 2026 / 23-25 Ağustos 2026 / 10-12 Ocak 2026 / 7-9 Şubat 2026",
        "kac_gun_surdu": "2-3 Gün",
        "adres": "C. Paris 36, Del Carmen, Coyoacan (Ciudad de México)",
        "one_cikan_ozellikler": "%100 Helal Sertifikalı, Talebeye ikram bağış imkanı",
        "one_cikan_lezzetler": "Hamburguesa Turca, Kebap Turco, Çiğ Köfte (Burrito), Dorilocos, Kumpir, Tarator, Meksika Yemekleri"
      },
      {
        "etkinlik_ismi": "Maltepe Çamlık Gıda Etkinliği",
        "tarih": "28 Aralık 2026 - 3 Ocak 2027",
        "kac_gun_surdu": "7 Gün",
        "adres": "Çamlık Maltepe",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "Özel 'Çamlık Lezzetleri', Kebab, Lahmacun"
      },
      {
        "etkinlik_ismi": "Wuppertal Barmen Kermesi",
        "tarih": "1-3 Kasım 2026 / 10 Aralık 2026",
        "kac_gun_surdu": "1-3 Gün",
        "adres": "Höhne 102, 42275 Wuppertal",
        "one_cikan_ozellikler": "Aynı gün tatbikatlı Umre Semineri düzenlenme özelliği",
        "one_cikan_lezzetler": "Döner, Hamburger"
      },
      {
        "etkinlik_ismi": "Balık Kermesi",
        "tarih": "16 Şubat 2026",
        "kac_gun_surdu": "1 Gün",
        "adres": "Belirtilmemiş",
        "one_cikan_ozellikler": "Ücretsiz Giriş (Eintritt frei)",
        "one_cikan_lezzetler": "Balık çeşitleri"
      },
      {
        "etkinlik_ismi": "Stolberg Kermesi",
        "tarih": "26-28 Ocak 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Schneidmühle 30, 52222 Stolberg",
        "one_cikan_ozellikler": "Soğuk kış günlerinde sıcak bir ortam",
        "one_cikan_lezzetler": "Kuzu Şiş, Adana, Döner, Lahmacun"
      },
      {
        "etkinlik_ismi": "Sıla Yolu Mola Noktaları Kermesleri",
        "tarih": "Sürekli (2026 Demo)",
        "kac_gun_surdu": "Sürekli",
        "adres": "Sırbistan: Subotica, Novi Sad Otoban, Belgrad",
        "one_cikan_ozellikler": "Sıla yolcuları için istirahat alanları, Özel Güvenli Park imkanı",
        "one_cikan_lezzetler": "Belirtilmemiş"
      },
      {
        "etkinlik_ismi": "Sılayolu Kermesi 4 Belgrad",
        "tarih": "1 Temmuz - 8 Ağustos 2026",
        "kac_gun_surdu": "39 Gün",
        "adres": "Belgrat Apartman Tarik (Belgrad Şehir Merkezi yakını)",
        "one_cikan_ozellikler": "24 Saat Açık, Güvenli Bahçe Parkı, Duş, WC, Mescit, Wi-Fi, Rehberlik Hizmeti",
        "one_cikan_lezzetler": "Döner, Çorba, Izgara, Tatlılar"
      },
      {
        "etkinlik_ismi": "Dortmund Huckarde Herbstfest Kermesi",
        "tarih": "3-5 Ekim 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Parsevalstraße 156-157, 44369 Dortmund",
        "one_cikan_ozellikler": "Sonbahar Festivali / Kermesi konsepti",
        "one_cikan_lezzetler": "Döner, Hamburger, Şiş Izgara, Lahmacun"
      },
      {
        "etkinlik_ismi": "Marl Süleymaniye Kermesi",
        "tarih": "Belirtilmemiş (2026 Demo)",
        "kac_gun_surdu": "Belirtilmemiş",
        "adres": "Victoriastr. 22, 45772 Marl",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "İlk defa sunulan Maraş Dondurmalı Künefe"
      },
      {
        "etkinlik_ismi": "Tepebaşı Lezzet Günleri",
        "tarih": "14-16 Şubat 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Belirtilmemiş",
        "one_cikan_ozellikler": "Paket Servisi Mevcuttur, Aile Salonu vardır",
        "one_cikan_lezzetler": "İskender, Beyti Adana, Arabaşı Çorbası, Keşkek, Manav Çeşitleri"
      },
      {
        "etkinlik_ismi": "Aachener Freundschaftsfest Kermes",
        "tarih": "7-9 Haziran 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Robert-Koch-Str. 28, 52066 Aachen",
        "one_cikan_ozellikler": "Ücretsiz Giriş (Eintritt frei!)",
        "one_cikan_lezzetler": "Fried Chicken, Grillspiess, Adana Kebap, Türk tatlıları"
      },
      {
        "etkinlik_ismi": "Setterich Freundschaftsfest Kermes",
        "tarih": "9-12 Mayıs 2026",
        "kac_gun_surdu": "4 Gün",
        "adres": "Wolfsgasse 43, Setterich Moschee",
        "one_cikan_ozellikler": "Çocuk oyun etkinlikleri (Spass für Klein und Groß), palyaço",
        "one_cikan_lezzetler": "Belirtilmemiş"
      },
      {
        "etkinlik_ismi": "Frankfurt Sonbahar Kermesi",
        "tarih": "17-19 Ekim 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Kriegkstr. 45, 60326 Frankfurt",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "Izgara, Döner, Burger, Tatlılar"
      },
      {
        "etkinlik_ismi": "Alsdorf TO GO Kermes",
        "tarih": "27 Haziran 2026",
        "kac_gun_surdu": "1 Gün",
        "adres": "Übacherweg. 54-56, 52477 Alsdorf",
        "one_cikan_ozellikler": "Pazar gününe özel Gel-Al (To Go) servisi",
        "one_cikan_lezzetler": "Döner-Pommdöner, Backfisch, Halka Tatlısı, Aşure & Çiğköfte"
      },
      {
        "etkinlik_ismi": "Hückelhoven Moscheefest Kermes",
        "tarih": "20-21 Mayıs 2026",
        "kac_gun_surdu": "2 Gün",
        "adres": "Hilfartherstr. 49a, 41836 Hückelhoven",
        "one_cikan_ozellikler": "Uluslararası Cami Festivali",
        "one_cikan_lezzetler": "Belirtilmemiş"
      },
      {
        "etkinlik_ismi": "Ferhan Sultan Gıda Etkinliği",
        "tarih": "25-27 Mayıs 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Pir Sultan Abdal Cad. No:32, Bigadiç/Balıkesir",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "Çöp Şiş, Köfte Burger, Bigadiç Tantuni, Bigadiç Keşkek, İçli Köfte"
      },
      {
        "etkinlik_ismi": "Völklingen Kermes",
        "tarih": "1-4 Mayıs & 9-11 Mayıs 2026",
        "kac_gun_surdu": "7 Gün",
        "adres": "Moltkestr. 12 A, 66333 Völklingen",
        "one_cikan_ozellikler": "Toplam 7 güne yayılan geniş etkinlik",
        "one_cikan_lezzetler": "Şiş Kebab, Et Izgara, Künefe"
      },
      {
        "etkinlik_ismi": "Frankfurt Straßen Fest Kermes",
        "tarih": "1-4 Mayıs 2026",
        "kac_gun_surdu": "4 Gün",
        "adres": "Kriegkstr. 45-49, 60326 Frankfurt",
        "one_cikan_ozellikler": "Çocuklar için zıpzıp / oyun alanı (Hüpfburg für Kinder)",
        "one_cikan_lezzetler": "İçli Köfte, Döner, Izgara, Taze tatlılar"
      },
      {
        "etkinlik_ismi": "Fulda Frühlingsfest Kermes",
        "tarih": "1-4 Mayıs 2026",
        "kac_gun_surdu": "4 Gün",
        "adres": "Dr.-Dietz-Str. 1, 36043 Fulda",
        "one_cikan_ozellikler": "Çocuklar için oyun alanı (Spiel und Spaß für die Kleinen)",
        "one_cikan_lezzetler": "Kebab, Balık (Uskumru), Hamburger"
      },
      {
        "etkinlik_ismi": "Four-Days Kulturevent (Hückelhoven)",
        "tarih": "15-20 Mayıs 2026",
        "kac_gun_surdu": "6 Gün",
        "adres": "Ludovicistr. 3, 41836 Hückelhoven",
        "one_cikan_ozellikler": "Özel Cami Turları / Rehberliği (Moscheeführungen)",
        "one_cikan_lezzetler": "Döner, Lahmacun, Simit, Kızarmış Piliç, Pasta Çeşitleri"
      },
      {
        "etkinlik_ismi": "Burhaniye Gülbahçe Lezzet Günü",
        "tarih": "2 Ekim 2026",
        "kac_gun_surdu": "1 Gün",
        "adres": "Kız Yurdu Bahçesi, Burhaniye",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "Tavuk Izgara, Izgara Köfte, Lahmacun, Gözleme, Sarma, Waffle"
      },
      {
        "etkinlik_ismi": "Drammen Mini Kermes Take Away!",
        "tarih": "25-26 Eylül 2026",
        "kac_gun_surdu": "2 Gün",
        "adres": "Neumannsgate 17, Drammen (Norveç)",
        "one_cikan_ozellikler": "Eve Teslimat (Hjemkjøring), Take Away servisi",
        "one_cikan_lezzetler": "Döner Kebab, Ekmeğe arası Tantuni Kebab"
      },
      {
        "etkinlik_ismi": "Camli Mescid Mini Kermes To Go",
        "tarih": "Pazar Günleri (2026)",
        "kac_gun_surdu": "1 Gün",
        "adres": "Hauffstraße 56, 47166 Duisburg",
        "one_cikan_ozellikler": "Sipariş hattı ile Gel-Al (To Go) hizmeti",
        "one_cikan_lezzetler": "Adana, Tavuk Şiş, Pommes, Döner"
      },
      {
        "etkinlik_ismi": "Kermes Fest In Regensburg",
        "tarih": "2-4 Temmuz 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Adolf-Schmetzer Str. 37, 93055 Regensburg",
        "one_cikan_ozellikler": "Sıla yolunda kısa bir mola yeri, Alo Paket Servisi",
        "one_cikan_lezzetler": "Çay, Kahve"
      },
      {
        "etkinlik_ismi": "Waltrop Valide Sultan Kermes",
        "tarih": "23-25 Aralık 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Am Schwarzbach, 45731 Waltrop",
        "one_cikan_ozellikler": "Kısıtlı sayıda özel lezzet günü",
        "one_cikan_lezzetler": "Sadece Pazar gününe özel Keşkek Üstü Kuzu Tandır"
      },
      {
        "etkinlik_ismi": "Servipınar Gıda Etkinliği",
        "tarih": "17-19 Ağustos 2026",
        "kac_gun_surdu": "3 Gün",
        "adres": "Belirtilmemiş",
        "one_cikan_ozellikler": "Belirtilmemiş",
        "one_cikan_lezzetler": "Köfteburger, Tavuk Tantuni, Sac Kavurma, Keşkek, Köy Ekmeği"
      }
    ]
  }
};

const months = { 'ocak':0, 'şubat':1, 'mart':2, 'nisan':3, 'mayıs':4, 'haziran':5, 'temmuz':6, 'ağustos':7, 'eylül':8, 'ekim':9, 'kasım':10, 'aralık':11 };

function parseDates(dateStr) {
   if (!dateStr || dateStr.toLowerCase().includes('belirtilmemiş') || dateStr.toLowerCase().includes('sürekli') || dateStr.toLowerCase().includes('pazar günleri')) {
       return {
           start: new Date(2026, 0, 1),
           end: new Date(2026, 11, 31)
       };
   }
   
   let str = dateStr.toLowerCase().split('/')[0].split('&')[0].trim(); 
   str = str.replace(' - ', '-');
   const parts = str.split(' ');
   let month = 0;
   let year = 2026;
   
   for (const p of parts) {
      if (months[p] !== undefined) month = months[p];
      if (p.startsWith('202')) year = parseInt(p.trim());
   }
   
   let startDay = 1;
   let endDay = 1;

   const daysOnly = str.replace(/202\d/, '').match(/(\d+)/g);
   if (daysOnly && daysOnly.length > 0) {
       startDay = parseInt(daysOnly[0]);
       endDay = parseInt(daysOnly[daysOnly.length-1]);
   }

   return {
       start: new Date(year, month, startDay),
       end: new Date(year, month, endDay)
   };
}

async function seed() {
    const list = payload.antigravity_payload.kermes_listesi;
    const batch = db.batch();
    const kermesRef = db.collection('kermes_events');
    
    // Onceki demo kermesleri temizleyebiliriz (opsiyonel ama kalsin, yenilerini isleriz)
    
    for (const item of list) {
        const docRef = kermesRef.doc();
        const dates = parseDates(item.tarih);
        
        let city = "Bilinmiyor";
        if (item.adres.includes(',')) {
            city = item.adres.split(',')[1].replace(/[0-9]/g, '').trim(); 
        } else if (item.adres.includes('(')) {
            city = item.adres.split('(')[1].replace(')', '').trim();
        } else {
            city = item.adres; 
        }
        
        const data = {
            id: docRef.id,
            title: item.etkinlik_ismi,
            city: city,
            address: item.adres === 'Belirtilmemiş' ? city : item.adres,
            startDate: Timestamp.fromDate(dates.start),
            endDate: Timestamp.fromDate(dates.end),
            phoneNumber: '+49 123 456 7890',
            latitude: 51.165691 + (Math.random() - 0.5),
            longitude: 10.451526 + (Math.random() - 0.5),
            customFeatures: item.one_cikan_ozellikler !== 'Belirtilmemiş' ? [item.one_cikan_ozellikler.substring(0, 50)] : [],
            menu: [],
            parking: [],
            weatherForecast: [],
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            description: item.one_cikan_lezzetler !== 'Belirtilmemiş' ? `Öne Çıkan Lezzetler: ${item.one_cikan_lezzetler}` : '',
            hasOutdoor: true,
            hasParking: true,
            hasFamilyArea: true,
            deliveryFee: 0.0,
            hasDelivery: item.one_cikan_ozellikler.toLowerCase().includes('teslimat') || item.one_cikan_ozellikler.toLowerCase().includes('paket') || item.one_cikan_ozellikler.toLowerCase().includes('lieferservice'),
        };
        
        batch.set(docRef, data);
    }
    
    await batch.commit();
    console.log(`Successfully seeded ${list.length} demo Kermes events to Firestore for 2026!`);
}

seed().catch(console.error);
