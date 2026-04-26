import fs from 'fs';

const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/HardwareTabContent.tsx';
let content = fs.readFileSync(file, 'utf8');

const specsDB = {
  'T-Serisi': {
    'İşletim Sistemi': 'Sunmi OS (Android tabanlı)',
    'İşlemci': 'Kryo-260 Octa-core 2.2GHz / Cortex-A55',
    'Ekran': '15.6" FHD (1920x1080) Kapasitif Çoklu Dokunmatik',
    'Müşteri Ekranı': 'Opsiyonel 15.6" FHD veya 10.1" HD',
    'Hafıza': '4GB RAM + 64GB ROM / 2GB RAM + 16GB ROM',
    'Yazıcı': 'Dahili 80mm Seiko Termal (250mm/s, Otomatik Kesici)',
    'Arayüzler': '5x USB, 1x RJ11 (Kasa), 1x RJ12, 1x RJ45 (LAN), 1x Ses',
    'Bağlantı': 'Wi-Fi (2.4G/5G), Bluetooth 5.0, Gigabit LAN',
    'Ağırlık': '5.1 kg - 7.5 kg',
    'Güç Adaptörü': 'Giriş: AC100-240V / Çıkış: DC 24V/2.5A'
  },
  'P-Serisi': {
    'İşletim Sistemi': 'Sunmi OS (Android 11)',
    'İşlemci': 'Quad-core 2.0GHz Cortex-A53',
    'Ekran': '5.5" HD+ (1440x720) / 8.0" IPS',
    'Kart Okuyucu': 'NFC, Çipli (EMV), Manyetik (MSR)',
    'Sertifikalar': 'PCI PTS 6.x, EMV L1/L2, Visa, Mastercard',
    'Hafıza': '2GB RAM + 16GB ROM',
    'Kamera': '5.0MP Otomatik Odaklamalı / Barkod Okuyucu',
    'Pil': '7.2V / 2600mAh (Genişletilmiş Batarya)',
    'Bağlantı': '4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli',
    'Ağırlık': 'Yaklaşık 345g - 430g'
  },
  'V-Serisi': {
    'İşletim Sistemi': 'Sunmi OS',
    'İşlemci': 'Quad-core 2.0GHz',
    'Ekran': '5.45" HD+ (1440x720) IPS Kapasitif',
    'Yazıcı': 'Dahili 58mm Termal (70mm/s baskı hızı)',
    'Hafıza': '2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)',
    'Kamera': '5.0MP AF (1D/2D barkod okuma destekli)',
    'Pil': '7.6V / 2580mAh Lityum Polimer',
    'Bağlantı': '4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE',
    'Arayüz': '1x Type-C OTG, 1x Nano SIM',
    'Ağırlık': 'Yaklaşık 364g'
  },
  'D-Serisi': {
    'İşletim Sistemi': 'Sunmi OS (Android)',
    'İşlemci': 'Cortex-A55 Quad-core 1.8GHz',
    'Ekran': '15.6" FHD veya 10.1" HD Kapasitif',
    'Hafıza': '2GB RAM + 16GB ROM',
    'Yazıcı': 'Dahili 58mm Termal Yazıcı (160mm/s)',
    'Bağlantı': 'Wi-Fi, Bluetooth, Ethernet (LAN)',
    'Arayüzler': '4x USB Type-A, 1x RJ11, 1x RJ45',
    'Hoparlör': '3W Dahili Hoparlör',
    'Ağırlık': 'Yaklaşık 1.95 kg',
    'Montaj': 'VESA Destekli (Masaüstü veya Duvar)'
  },
  'L-Serisi': {
    'İşletim Sistemi': 'Sunmi OS (Android)',
    'İşlemci': 'Octa-core 2.0GHz',
    'Ekran': '5.5" HD (1440x720) Corning Gorilla Glass',
    'Hafıza': '3GB RAM + 32GB ROM',
    'Kamera': '13MP Arka + 2MP Ön, Flaşlı',
    'Barkod Okuyucu': 'Profesyonel 1D/2D Zebra Tarayıcı Motoru',
    'Dayanıklılık': 'IP68 Su/Toz Geçirmez, 1.5m düşmeye dayanıklı',
    'Pil': '5000mAh Değiştirilebilir Li-ion',
    'Bağlantı': '4G, Wi-Fi 6, Bluetooth 5.0, NFC, Çift SIM',
    'Ağırlık': 'Yaklaşık 250g'
  },
  'Kiosk': {
    'İşletim Sistemi': 'Sunmi OS',
    'İşlemci': 'Hexa-core 1.8GHz',
    'Ekran': '24" FHD (1920x1080) Çoklu Dokunmatik',
    'Hafıza': '4GB RAM + 16GB ROM',
    'Yazıcı': '80mm Termal (Otomatik Kesici)',
    'Barkod Okuyucu': 'Geniş açılı 1D/2D tarayıcı',
    'Kamera': '3D Structured Light veya 1080P',
    'Bağlantı': 'Wi-Fi, Ethernet, Bluetooth',
    'Montaj': 'Duvara Monte veya Bağımsız Ayaklı',
    'Ağırlık': 'Yaklaşık 16.5 kg'
  },
  'Terazi': {
    'İşletim Sistemi': 'Sunmi OS',
    'İşlemci': 'Quad-core 1.8GHz',
    'Ekran': '15.6" FHD (Müşteri ekranı opsiyonel 10.1")',
    'Hafıza': '2GB RAM + 16GB ROM',
    'Yazıcı': 'Dahili 58mm Fiş / Etiket Yazıcı',
    'Tartım Kapasitesi': 'Maks 15kg / Min 40g (e=2g/5g)',
    'Özellikler': 'Paslanmaz çelik tartı kefesi, böcek önleyici tasarım',
    'Arayüz': 'USB, RJ11, RJ45 LAN',
    'Bağlantı': 'Wi-Fi, Ethernet'
  }
};

const productRegex = /id:\s*"([^"]+)"([\s\S]*?)price:/g;
const matches = [...content.matchAll(productRegex)];

for (const match of matches) {
  const fullBlock = match[0];
  let newBlock = fullBlock;
  
  // Find which series it belongs to
  let assignedSpecs = null;
  if (fullBlock.includes('T-Serisi')) assignedSpecs = specsDB['T-Serisi'];
  else if (fullBlock.includes('P-Serisi')) assignedSpecs = specsDB['P-Serisi'];
  else if (fullBlock.includes('V-Serisi') || fullBlock.includes('M-Serisi')) assignedSpecs = specsDB['V-Serisi'];
  else if (fullBlock.includes('D-Serisi')) assignedSpecs = specsDB['D-Serisi'];
  else if (fullBlock.includes('L-Serisi')) assignedSpecs = specsDB['L-Serisi'];
  else if (fullBlock.includes('Kiosk') || fullBlock.includes('FT-Serisi')) assignedSpecs = specsDB['Kiosk'];
  else if (fullBlock.includes('Terazi') || fullBlock.includes('S-Serisi')) assignedSpecs = specsDB['Terazi'];

  if (assignedSpecs && !fullBlock.includes('detailedSpecs:')) {
     const specString = `detailedSpecs: ${JSON.stringify(assignedSpecs, null, 8).replace(/}/, '      }')},\n      price:`;
     newBlock = newBlock.replace(/price:/, specString);
     content = content.replace(fullBlock, newBlock);
  }
}

fs.writeFileSync(file, content, 'utf8');
console.log('Rich technical details injected into HardwareTabContent.tsx!');
