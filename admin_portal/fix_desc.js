const fs = require('fs');

const targetFile = 'src/app/[locale]/admin/business/[id]/HardwareTabContent.tsx';
let content = fs.readFileSync(targetFile, 'utf8');
const lines = content.split('\n');

const descriptions = {
  'V-Serisi (Mobil POS)': 'Restoran, kafe ve paket servis süreçleri için tasarlanmış, entegre fiş yazıcılı, yüksek performanslı ve taşınabilir akıllı POS terminalidir. Hızlı sipariş alma ve anında fiş kesme imkanı sunar.',
  'L-Serisi (Endüstriyel)': 'Zorlu depo ve mağaza ortamları için suya ve düşmeye dayanıklı (IP67/IP68), yüksek hızlı barkod okuyuculu endüstriyel el terminalidir. Yoğun stok sayımı ve depo yönetimi için idealdir.',
  'P-Serisi (Ödeme POS)': 'NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.',
  'M-Serisi (Mobil Terminal)': 'Kompakt, hafif ve ince tasarımıyla garsonların masa başında veya reyon görevlilerinin mağaza içinde sipariş almasını kolaylaştıran taşınabilir el terminalidir.',
  'T-Serisi (Gelişmiş Kasa)': 'Yoğun restoran ve perakende işletmeleri için tasarlanmış, güçlü işlemcisi ve entegre yazıcısıyla kesintisiz çalışan, müşteri ekranı opsiyonlu profesyonel masaüstü kasa sistemidir.',
  'D-Serisi (Kompakt Kasa)': 'Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.',
  'K-Serisi (Kiosk)': 'Müşterilerin kendi siparişlerini ve ödemelerini kolayca yapabilmesi için tasarlanmış, temassız ödeme destekli ve fiş yazıcılı self-servis sipariş (kiosk) sistemidir.',
  'FT-Serisi': 'Büyük mağaza ve süpermarket kasaları için yüksek tartım kapasitesine ve hızlı barkod okuma teknolojisine sahip entegre kasa çözümüdür.',
  'CPad Serisi': 'Müşteriye sepet tutarını göstermek, dijital fiş sunmak veya sadakat programı entegrasyonu sağlamak için kullanılan interaktif müşteri ekranıdır.',
  'S-Serisi (Terazi)': 'Manav, kasap, şarküteri ve kuruyemiş gibi tartımlı ürün satan işletmeler için fiş/etiket yazıcı entegreli, hassas sensörlü akıllı terazi sistemidir.',
  'FLEX Serisi': 'Ödeme ve fiş yazdırma yeteneklerini esnek ve hafif bir form faktöründe birleştiren, kuryeler ve saha satış personeli için tasarlanmış pratik cihazdır.',
  'Yazıcılar': 'Mutfak, bar veya paket servis alanlarında sipariş fişlerini ve yapışkanlı etiketleri hızlı, sessiz ve yüksek kalitede basabilen endüstriyel yazıcılardır.',
  'Ağ & İletişim': 'İşletmenin tüm sipariş ve POS trafiğini kesintisiz ve yüksek hızda yönlendirmek için tasarlanmış kurumsal ağ (Wi-Fi/4G) istasyonlarıdır.',
  'Tarayıcılar': 'Kasa noktalarında QR kodları, 1D/2D barkodları ve mobil cihaz ekranlarındaki kodları saniyenin altında bir sürede okuyabilen yüksek hassasiyetli tarayıcılardır.',
  'Aksesuarlar': 'Kasa çekmecesi, barkod okuyucu standı, batarya ve POS klavyesi gibi LOKMA donanım ekosistemini tamamlayan profesyonel aksesuarlardır.',
  'Tümü': 'Dijital raf etiketleri (ESL) ile fiyatlarınızı bulut üzerinden tek tuşla, sıfır kağıt israfıyla güncelleyin.'
};

let insideHardwareList = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const hardwareList: any[] = [')) {
    insideHardwareList = true;
  }
  
  if (insideHardwareList) {
    if (lines[i].includes('  const handleUpdateCart =')) {
      insideHardwareList = false;
      break;
    }
    
    if (lines[i].includes('id: "sunmi_')) {
      let series = '';
      for (let j = i; j < i + 10; j++) {
        if (lines[j].includes('series: "')) {
          const match = lines[j].match(/series:\s*"([^"]+)"/);
          if (match) series = match[1];
          break;
        }
      }

      if (series && descriptions[series]) {
        for (let j = i; j < i + 10; j++) {
          if (lines[j].includes('description: "')) {
            lines[j] = lines[j].replace(/description:\s*"[^"]+"/, 'description: "' + descriptions[series] + '"');
            break;
          }
        }
      }

      for (let j = i; j < i + 10; j++) {
        if (lines[j].includes('images: [')) {
          const originalImgMatch = lines[j].match(/images:\s*\["([^"]+)"\]/);
          if (originalImgMatch) {
            const origImg = originalImgMatch[1];
            lines[j] = '      images: ["' + origImg + '", "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80", "https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=800&q=80"],';
          }
          break;
        }
      }
    }
  }
}

content = lines.join('\n');

fs.writeFileSync(targetFile, content, 'utf8');
console.log("Sunmi descriptions and gallery images updated.");
