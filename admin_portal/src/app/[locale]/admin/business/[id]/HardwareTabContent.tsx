"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ShoppingCart,
  CheckCircle,
  Monitor,
  Smartphone,
  Scale,
  Tag,
  SlidersHorizontal,
  Snowflake,
  Droplets,
  Nfc,
  Bluetooth,
  Info,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";

const CATEGORY_SERIES = {
  "ESL Etiketleri": [
    "Tümü",
    "DS Slim Series",
    "Rainbow Series",
    "Multi-Zone Series",
    "Supergalaxy Series",
    "Mercurius Series",
    "Conference Table Series",
    "Cold-Chain Series",
  ],
  "Mobil POS & El Terminalleri": [
    "Tümü",
    "V-Serisi (Mobil POS)",
    "P-Serisi (Ödeme POS)",
    "L-Serisi (Endüstriyel)",
    "M-Serisi (Mobil Terminal)",
  ],
  "Masaüstü Kasa & Kiosk": [
    "Tümü",
    "T-Serisi (Gelişmiş Kasa)",
    "D-Serisi (Kompakt Kasa)",
    "K-Serisi (Kiosk)",
    "FT-Serisi",
    "FLEX Serisi",
  ],
  "Ağ, Yazıcı & Aksesuarlar": [
    "Tümü",
    "Yazıcılar",
    "Ağ & İletişim",
    "Tarayıcılar",
    "Aksesuarlar",
  ],
  "KDS & Müşteri Ekranları": ["Tümü", "CPad Serisi"],
  "Akıllı Tartım": ["Tümü", "S-Serisi (Terazi)"],
  "Sarf Malzemeleri": ["Tümü"],
};

export default function HardwareTabContent({
  business,
  admin,
  showToast,
}: any) {
  const t = useTranslations("HardwareTab");
  const [hardwareCart, setHardwareCart] = useState<
    Record<
      string,
      {
        quantity: number;
        mode: "rent" | "buy" | "installment";
        duration: 6 | 12 | 24 | 36;
      }
    >
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const categories = [
    "Tüm Ekosistem",
    "Masaüstü Kasa & Kiosk",
    "Mobil POS & El Terminalleri",
    "KDS & Müşteri Ekranları",
    "Ağ, Yazıcı & Aksesuarlar",
    "Akıllı Tartım",
    "ESL Etiketleri",
    "Sarf Malzemeleri",
  ];
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [activeSeries, setActiveSeries] = useState("Tümü");
  const [lightboxData, setLightboxData] = useState<{
    index: number;
    images: string[];
  } | null>(null);
  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<
    any | null
  >(null);

  // Filters State
  const [showFilters, setShowFilters] = useState(true);
  const [filterSeries, setFilterSeries] = useState<string[]>([]);
  const [filterSize, setFilterSize] = useState<number[]>([]);
  const [filterTech, setFilterTech] = useState<string[]>([]);
  const [filterColor, setFilterColor] = useState<number[]>([]);
  const [filterCold, setFilterCold] = useState(false);
  const [filterWater, setFilterWater] = useState(false);
  const [maxRentPrice, setMaxRentPrice] = useState<number>(10);

  // Fiyat hesaplama mantığı
  const getRentPrice = (basePrice: number, duration: 6 | 12 | 24) => {
    if (duration === 6) return basePrice * 1.2;
    if (duration === 24) return basePrice * 0.8;
    return basePrice;
  };

  const getInstallmentPrice = (basePrice: number, duration: 24 | 36) => {
    // 24 ay için %10 vade farkı, 36 ay için %15 vade farkı ile aylık hesaplama
    const markup = duration === 24 ? 1.1 : 1.15;
    return (basePrice * markup) / duration;
  };

  const getDetailedSpecs = (product: any) => {
    if (product.detailedSpecs) return product.detailedSpecs;
    
    if (product.category === "ESL Etiketleri" && product.filters?.size) {
      const size = product.filters.size;
      return {
        "Fiziksel Boyut": size > 10 ? "272 * 196 * 14mm" : size > 5 ? "139 * 110 * 13mm" : "105 * 88 * 13mm",
        "Ekran Boyutu": `${size} inç (E-Ink Parlama Yapmaz)`,
        "Ağırlık": size > 10 ? "416g" : size > 5 ? "145g" : "65g",
        "LOKMA Batarya Ömrü": "5 Yıl (Günde 5 otomatik fiyat güncellemesi ile)",
        "Renk Desteği": product.filters.colors === 2 ? "Siyah / Beyaz" : product.filters.colors === 3 ? "Siyah / Beyaz / Kırmızı" : "Siyah / Beyaz / Kırmızı / Sarı",
        "Çözünürlük": size > 10 ? "960 * 640" : size > 5 ? "648 * 480" : "400 * 300",
      };
    }

    const name = product.name;
    if (name.includes("T3 PRO MAX")) {
      return {
        "İşlemci Mimarisi": "Qualcomm Snapdragon Sekiz Çekirdekli (Octa-core)",
        "Ana İşletim Sistemi": "Sunmi OS (LOKMA Core Entegre)",
        "Bellek & Depolama": "6GB RAM + 128GB ROM",
        "Baskı Teknolojisi": "Seiko 80mm Yüksek Hızlı Termal Yazıcı (Otomatik Kesici)",
        "Çift Ekran": "15.6'' FHD Ana Ekran + 15.6'' FHD Müşteri Ekranı",
        "Dayanıklılık": "Alüminyum Alaşım Kasa, Su Sıçramalarına Karşı Korumalı",
        "LOKMA Uyumluluğu": "%100 Restoran POS Entegrasyonu (Sıfır Gecikme)"
      };
    }
    if (name.includes("T3 PRO")) {
      return {
        "İşlemci Mimarisi": "Qualcomm Snapdragon Sekiz Çekirdekli (Octa-core)",
        "Ana İşletim Sistemi": "Sunmi OS (LOKMA Core Entegre)",
        "Bellek & Depolama": "6GB RAM + 128GB ROM (Genişletilebilir)",
        "Ana Ekran": "15.6'' FHD (1920x1080) Ultra Hassas Dokunmatik",
        "Gövde Malzemesi": "Havacılık Sınıfı Alüminyum Alaşım",
        "Ağ & Bağlantı": "Wi-Fi 6, Bluetooth 5.0, Gigabit Ethernet",
        "LOKMA Uyumluluğu": "Merkezi Kasa ve KDS ile Çift Yönlü Anlık Senkronizasyon"
      };
    }
    if (name.includes("D3 PRO")) {
      return {
        "İşlemci Mimarisi": "Yüksek Performanslı Sekiz Çekirdekli İşlemci",
        "Ana İşletim Sistemi": "Sunmi OS (Android Tabanlı, LOKMA Optimize)",
        "Bellek & Depolama": "4GB RAM + 64GB ROM",
        "Ekran Tasarımı": "15.6'' FHD (Sadece 12mm Ultra İnce Profil)",
        "Gövde Malzemesi": "Şık Alüminyum Şasi, Red Dot Tasarım Ödüllü",
        "Çoklu Bağlantı": "Ölçeklenebilir Portlar (Çekmece, Tarayıcı, Yazıcı)",
        "LOKMA Uyumluluğu": "Kompakt Tezgahlar İçin %100 Uyumlu Masaüstü POS"
      };
    }
    if (name.includes("V3 MIX")) {
      return {
        "İşlemci Mimarisi": "Qualcomm Hexa-Core 2.4GHz Performans Çipi",
        "Ana İşletim Sistemi": "Sunmi OS (LOKMA Mobil ve POS Çift Mod)",
        "Ekran Teknolojisi": "10.1'' Yüksek Çözünürlüklü Dönebilir Ekran",
        "Entegre Yazıcı": "Dahili 58mm / 80mm Ayarlanabilir Fiş Yazıcısı",
        "Barkod / QR Tarayıcı": "Profesyonel 2D Barkod Tarayıcı (LOKMA Hızlı Satış)",
        "Mobilite": "Sökülebilir Tablet Formu, Masada Sipariş Özelliği",
        "LOKMA Uyumluluğu": "Tek Cihazda Kasa, KDS ve Garson Terminali Gücü"
      };
    }
    if (name.includes("FLEX 3")) {
      return {
        "Akıllı Çekirdek": "Qualcomm Octa-Core İşlemci + NPU (13 TOPS AI Gücü)",
        "İşletim Sistemi": "Sunmi OS 4.0 (LOKMA Kiosk ve KDS Optimize)",
        "Ekran Performansı": "18.5'' / 22'' / 27'' FHD Parlama Yapmayan Geniş Açılı Ekran",
        "Modüler Altyapı": "Çıkarılabilir AI Kamera, Dahili Barkod Okuyucu ve Ödeme Modülü",
        "Bağlantı & Ağ": "Wi-Fi 6E, Bluetooth 5.2, Gigabit Ethernet, Type-C",
        "Tasarım & Çevre": "IP54 Koruma, 17mm Ultra İnce Profil, 15°–80° Eğim",
        "LOKMA Uyumluluğu": "Merkezi Self-Checkout, Mutfak (KDS) ve Dijital Tabela olarak Tam Otonom Çalışma"
      };
    }
    if (name.includes("Blink")) {
      return {
        "Ekran Teknolojisi": "Açılı Yüksek Kontrastlı Renkli Ekran",
        "İşletim Uyumluluğu": "Android ve Windows LOKMA Terminalleriyle Tak-Çalıştır",
        "Bağlantı": "Tek Kablo ile USB Type-C (Güç ve Veri)",
        "Tasarım": "Ergonomik Masaüstü Standı (Kasa Alanı İşgal Etmez)",
        "LOKMA Etkileşimi": "Anlık Sepet Yansıtma ve Dinamik QR Ödeme Gösterimi"
      };
    }
    if (name.includes("S2")) {
      return {
        "Akıllı Terazi": "Dahili Hassas Sensörlü Kapasitif Tartım Modülü",
        "İşlemci": "Quad-Core ARM Cortex-A55",
        "Çift Yönlü Ekran": "15.6'' Ana Ekran + 10.1'' Müşteri Ekranı",
        "Koruma Sınıfı": "Su ve Buhar İzolasyonlu Böcek Geçirmez Tasarım",
        "Dahili Yazıcı": "58mm Termal Fiş ve Etiket Yazıcısı",
        "LOKMA Uyumluluğu": "LOKMA Cloud ile Otomatik Gramaj ve Fiyat Senkronizasyonu"
      };
    }

    if (product.series && product.name.includes("Sunmi")) {
      const specs: any = {
        "Endüstriyel Marka": "Sunmi",
        "Cihaz Serisi": product.series,
        "Sistem Uyumluluğu": "LOKMA Smart OS"
      };

      if (product.series.includes("Mobil POS") || product.series.includes("Endüstriyel")) {
        specs["Mobil Ağ"] = "4G LTE / Çift Bant Wi-Fi / Bluetooth 5.0";
        specs["Batarya"] = "Tüm Gün Dayanan Endüstriyel Lityum Polimer Pil";
        specs["Kasa Tipi"] = "Düşmeye ve Şoka Karşı Zırhlı Yapı";
        if (product.series.includes("Mobil POS")) specs["Yazıcı"] = "Saniyede 70mm Hızında 58mm Fiş Yazıcısı";
      } else if (product.series.includes("Kasa") || product.series.includes("Kiosk") || product.series.includes("CPad")) {
        specs["Ağ Kapasitesi"] = "Gigabit Ethernet ve Anti-Parazit Wi-Fi Modülü";
        specs["Görsel Çıkış"] = "Yüksek Parlaklıklı Çok Noktalı Dokunmatik Ekran";
      }
      return specs;
    }

    if (product.specs && Array.isArray(product.specs)) {
      const specsMap: any = {};
      product.specs.forEach((s: string, i: number) => {
        specsMap[`Sistem Özelliği ${i + 1}`] = s;
      });
      return specsMap;
    }

    return null;
  };

  const hardwareList: any[] = [
    {
      id: "kds_tablet_stand",
      name: "LOKMA KDS Tablet Standı",
      category: "Kasa Sistemleri",
      description:
        "Mutfak ekranı (KDS) veya müşteri ekranı olarak kullanılacak tabletler için tasarlanmış sağlam, ayarlanabilir metal stand.",
      icon: <Monitor className="w-8 h-8 text-neutral-400" />,
      image: "https://m.media-amazon.com/images/I/61jC54RjLHL._AC_SL1500_.jpg",
      price: 35.9,
      rentPrice: 0,
      minRentMonths: 0,
      specs: [
        "10 - 13 inç (33.0 cm) arası tabletlerle uyumlu",
        "360 derece dönebilen başlık",
        "Kaymaz taban ve kablo gizleme haznesi",
      ],
    },
    {
      id: "receipt_printer_80mm",
      name: "LOKMA 80mm Fiş & Mutfak Yazıcısı",
      category: "Kasa Sistemleri",
      description:
        "Otomatik kesicili (Auto-Cutter), ağ (Ethernet) ve USB destekli endüstriyel termal mutfak ve adisyon yazıcısı.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://m.media-amazon.com/images/I/71uV45781aL._AC_SL1500_.jpg",
      price: 139.9,
      rentPrice: 6.9,
      minRentMonths: 12,
      specs: [
        "80mm Termal Kağıt Uyumluluğu",
        "Ethernet / LAN Desteği (Mutfak için)",
        "Duvara monte edilebilir",
      ],
    },

    {
      id: "sunmi_cpad_pay",
      name: "Sunmi CPad PAY",
      category: "KDS & Müşteri Ekranları",
      series: "CPad Serisi",
      description:
        "Müşteriye sepet tutarını göstermek, dijital fiş sunmak veya sadakat programı entegrasyonu sağlamak için kullanılan interaktif müşteri ekranıdır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/icon/cpad-pay.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/video/tvc.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/lg/p5-0.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/lg/p5-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/lg/p5-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/lg/p5-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/lg/p5-4.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/lg/p5-5.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/lg/p5-6.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/cpad-pay/lg/p5-7.jpg",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_cpad",
      name: "Sunmi CPad",
      category: "KDS & Müşteri Ekranları",
      series: "CPad Serisi",
      description:
        "Müşteriye sepet tutarını göstermek, dijital fiş sunmak veya sadakat programı entegrasyonu sağlamak için kullanılan interaktif müşteri ekranıdır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://file.cdn.sunmi.com/newebsite/products/CPad/icon/CPad.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/CPad/icon/CPad.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_flex_3",
      name: "Sunmi FLEX 3",
      category: "Masaüstü Kasa & Kiosk",
      series: "FLEX Serisi",
      description:
        "İşletmenizin her köşesine uyum sağlayan modüler, yapay zeka destekli interaktif ekran. Self-Checkout, Mutfak Ekranı (KDS) veya Bilgi Kiosku olarak kullanılabilir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/icon/flex-3.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/video/tvc-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/xs/p2-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/p2-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/xs/p3-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/p3-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/xs/p4-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/p4-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/xs/p6-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/p6-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/xs/p10-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/p10-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/xs/p10-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/p10-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/xs/p10-1-4.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/p10-1-4.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/xs/p10-2-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/flex-3/lg/p10-2-2.jpg",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_v3_plus",
      name: "Sunmi V3 PLUS",
      category: "Mobil POS & El Terminalleri",
      series: "V-Serisi (Mobil POS)",
      description:
        "Restoran, kafe ve paket servis süreçleri için tasarlanmış, entegre fiş yazıcılı, yüksek performanslı ve taşınabilir akıllı POS terminalidir. Hızlı sipariş alma ve anında fiş kesme imkanı sunar.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/icon/v3-plus.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/video/tvc-poster.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/xs/p5-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/lg/p5-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/xs/p5-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/lg/p5-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/xs/p6-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/lg/p6-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/xs/p6-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-plus/lg/p6-2.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_v3e",
      name: "Sunmi V3e",
      category: "Mobil POS & El Terminalleri",
      series: "V-Serisi (Mobil POS)",
      description:
        "Restoran, kafe ve paket servis süreçleri için tasarlanmış, entegre fiş yazıcılı, yüksek performanslı ve taşınabilir akıllı POS terminalidir. Hızlı sipariş alma ve anında fiş kesme imkanı sunar.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://file.cdn.sunmi.com/newebsite/products/v3e/icon/v3e.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/v3e/xs/p2-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3e/lg/p2-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3e/xs/p2-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3e/lg/p2-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3e/xs/p2-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3e/lg/p2-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3e/xs/p2-2-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3e/lg/p2-2-1.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_v3_family",
      name: "Sunmi V3 Family",
      category: "Mobil POS & El Terminalleri",
      series: "V-Serisi (Mobil POS)",
      description:
        "Restoran, kafe ve paket servis süreçleri için tasarlanmış, entegre fiş yazıcılı, yüksek performanslı ve taşınabilir akıllı POS terminalidir. Hızlı sipariş alma ve anında fiş kesme imkanı sunar.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/icon/v3-family.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/tvc-poster.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/xs/p7-6.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/p7-6.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/xs/p7-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/p7-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/xs/p7-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/p7-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/xs/p7-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-family/lg/p7-3.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_v3_mix",
      name: "Sunmi V3 MIX",
      category: "Mobil POS & El Terminalleri",
      series: "V-Serisi (Mobil POS)",
      description:
        "Restoran, kafe ve paket servis süreçleri için tasarlanmış, entegre fiş yazıcılı, yüksek performanslı ve taşınabilir akıllı POS terminalidir. Hızlı sipariş alma ve anında fiş kesme imkanı sunar.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/v3-mix/icon/v3-mix.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/v3-mix/xs/sunmi-home-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-mix/lg/sunmi-home-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-mix/xs/sunmi-home-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v3-mix/lg/sunmi-home-3.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_v2_pro",
      name: "Sunmi V2 PRO",
      category: "Mobil POS & El Terminalleri",
      series: "V-Serisi (Mobil POS)",
      description:
        "Restoran, kafe ve paket servis süreçleri için tasarlanmış, entegre fiş yazıcılı, yüksek performanslı ve taşınabilir akıllı POS terminalidir. Hızlı sipariş alma ve anında fiş kesme imkanı sunar.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/1/V2PRO.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/1/V2PRO.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_v2s_plus",
      name: "Sunmi V2s PLUS",
      category: "Mobil POS & El Terminalleri",
      series: "V-Serisi (Mobil POS)",
      description:
        "Restoran, kafe ve paket servis süreçleri için tasarlanmış, entegre fiş yazıcılı, yüksek performanslı ve taşınabilir akıllı POS terminalidir. Hızlı sipariş alma ve anında fiş kesme imkanı sunar.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/1/V2sPLUS.png",
      video: "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/lg/2.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/xs/1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/xs/2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/xs/5.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/xs/9.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/xs/10.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/xs/11-5-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/xs/11-5-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/v2s-plus/xs/12.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_v2s",
      name: "Sunmi V2s",
      category: "Mobil POS & El Terminalleri",
      series: "V-Serisi (Mobil POS)",
      description:
        "Restoran, kafe ve paket servis süreçleri için tasarlanmış, entegre fiş yazıcılı, yüksek performanslı ve taşınabilir akıllı POS terminalidir. Hızlı sipariş alma ve anında fiş kesme imkanı sunar.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/1/V2s.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/1/V2s.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_l3",
      name: "Sunmi L3",
      category: "Mobil POS & El Terminalleri",
      series: "L-Serisi (Endüstriyel)",
      description:
        "Zorlu depo ve mağaza ortamları için suya ve düşmeye dayanıklı (IP67/IP68), yüksek hızlı barkod okuyuculu endüstriyel el terminalidir. Yoğun stok sayımı ve depo yönetimi için idealdir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://file.cdn.sunmi.com/newebsite/products/l3/icon/l3.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/l3/video/tvc-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/l3/lg/p1-bg-en.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/l3/xs/p1-bg-en.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/l3/video/tvc-poster.mp4?autoPlay=true\u0026loop=true\u0026screenshot=https://file.cdn.sunmi.com/newebsite/products/l3/lg/tvc-poster.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/l3/xs/tvc-poster.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/l3/lg/p4-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/l3/xs/p4-bg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/l3/lg/p4-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/l3/xs/p4-1.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Octa-core 2.0GHz",
        Ekran: '5.5" HD (1440x720) Corning Gorilla Glass',
        Hafıza: "3GB RAM + 32GB ROM",
        Kamera: "13MP Arka + 2MP Ön, Flaşlı",
        "Barkod Okuyucu": "Profesyonel 1D/2D Zebra Tarayıcı Motoru",
        Dayanıklılık: "IP68 Su/Toz Geçirmez, 1.5m düşmeye dayanıklı",
        Pil: "5000mAh Değiştirilebilir Li-ion",
        Bağlantı: "4G, Wi-Fi 6, Bluetooth 5.0, NFC, Çift SIM",
        Ağırlık: "Yaklaşık 250g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_l2s_pro",
      name: "Sunmi L2s PRO",
      category: "Mobil POS & El Terminalleri",
      series: "L-Serisi (Endüstriyel)",
      description:
        "Zorlu depo ve mağaza ortamları için suya ve düşmeye dayanıklı (IP67/IP68), yüksek hızlı barkod okuyuculu endüstriyel el terminalidir. Yoğun stok sayımı ve depo yönetimi için idealdir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/l2s-pro/icon/l2s-pro.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/l2s-pro/appendix/open-video-new.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/l2s-pro/icon/l2s-pro.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Octa-core 2.0GHz",
        Ekran: '5.5" HD (1440x720) Corning Gorilla Glass',
        Hafıza: "3GB RAM + 32GB ROM",
        Kamera: "13MP Arka + 2MP Ön, Flaşlı",
        "Barkod Okuyucu": "Profesyonel 1D/2D Zebra Tarayıcı Motoru",
        Dayanıklılık: "IP68 Su/Toz Geçirmez, 1.5m düşmeye dayanıklı",
        Pil: "5000mAh Değiştirilebilir Li-ion",
        Bağlantı: "4G, Wi-Fi 6, Bluetooth 5.0, NFC, Çift SIM",
        Ağırlık: "Yaklaşık 250g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_l2ks",
      name: "Sunmi L2Ks",
      category: "Mobil POS & El Terminalleri",
      series: "L-Serisi (Endüstriyel)",
      description:
        "Zorlu depo ve mağaza ortamları için suya ve düşmeye dayanıklı (IP67/IP68), yüksek hızlı barkod okuyuculu endüstriyel el terminalidir. Yoğun stok sayımı ve depo yönetimi için idealdir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://file.cdn.sunmi.com/newebsite/products/l2ks/icon/l2ks.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/l2ks/appendix/open-video.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/l2ks/icon/l2ks.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Octa-core 2.0GHz",
        Ekran: '5.5" HD (1440x720) Corning Gorilla Glass',
        Hafıza: "3GB RAM + 32GB ROM",
        Kamera: "13MP Arka + 2MP Ön, Flaşlı",
        "Barkod Okuyucu": "Profesyonel 1D/2D Zebra Tarayıcı Motoru",
        Dayanıklılık: "IP68 Su/Toz Geçirmez, 1.5m düşmeye dayanıklı",
        Pil: "5000mAh Değiştirilebilir Li-ion",
        Bağlantı: "4G, Wi-Fi 6, Bluetooth 5.0, NFC, Çift SIM",
        Ağırlık: "Yaklaşık 250g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_l2h",
      name: "Sunmi L2H",
      category: "Mobil POS & El Terminalleri",
      series: "L-Serisi (Endüstriyel)",
      description:
        "Zorlu depo ve mağaza ortamları için suya ve düşmeye dayanıklı (IP67/IP68), yüksek hızlı barkod okuyuculu endüstriyel el terminalidir. Yoğun stok sayımı ve depo yönetimi için idealdir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://file.cdn.sunmi.com/newebsite/products/l2h/icon/l2h.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/l2h/appendix/open-video.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/l2h/xs/p1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/l2h/lg/p1.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Octa-core 2.0GHz",
        Ekran: '5.5" HD (1440x720) Corning Gorilla Glass',
        Hafıza: "3GB RAM + 32GB ROM",
        Kamera: "13MP Arka + 2MP Ön, Flaşlı",
        "Barkod Okuyucu": "Profesyonel 1D/2D Zebra Tarayıcı Motoru",
        Dayanıklılık: "IP68 Su/Toz Geçirmez, 1.5m düşmeye dayanıklı",
        Pil: "5000mAh Değiştirilebilir Li-ion",
        Bağlantı: "4G, Wi-Fi 6, Bluetooth 5.0, NFC, Çift SIM",
        Ağırlık: "Yaklaşık 250g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_m3",
      name: "Sunmi M3",
      category: "Mobil POS & El Terminalleri",
      series: "M-Serisi (Mobil Terminal)",
      description:
        "Kompakt, hafif ve ince tasarımıyla garsonların masa başında veya reyon görevlilerinin mağaza içinde sipariş almasını kolaylaştıran taşınabilir el terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://file.cdn.sunmi.com/newebsite/products/m3/icon/m3.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/m3/video/tvc-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/m3/lg/p4-9.png",
        "https://file.cdn.sunmi.com/newebsite/products/m3/lg/p4-10.png",
        "https://file.cdn.sunmi.com/newebsite/products/m3/lg/p4-11.png",
        "https://file.cdn.sunmi.com/newebsite/products/m3/lg/p4-12.png",
        "https://file.cdn.sunmi.com/newebsite/products/m3/lg/p4-13.png",
        "https://file.cdn.sunmi.com/newebsite/products/m3/lg/p4-14.png",
        "https://file.cdn.sunmi.com/newebsite/products/m3/lg/p4-15.png",
        "https://file.cdn.sunmi.com/newebsite/products/m3/lg/p4-16.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_m2_max",
      name: "Sunmi M2 MAX",
      category: "Mobil POS & El Terminalleri",
      series: "M-Serisi (Mobil Terminal)",
      description:
        "Kompakt, hafif ve ince tasarımıyla garsonların masa başında veya reyon görevlilerinin mağaza içinde sipariş almasını kolaylaştıran taşınabilir el terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/1/M2MAX.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/m2max/xl/p8-1-1.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/m2max/md/3-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/m2max/md/3-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/m2max/md/3-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/m2max/md/3-4.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/m2max/md/3-5.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/m2max/md/3-6.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/m2max/md/3-7.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/m2max/md/3-8.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 2.0GHz",
        Ekran: '5.45" HD+ (1440x720) IPS Kapasitif',
        Yazıcı: "Dahili 58mm Termal (70mm/s baskı hızı)",
        Hafıza: "2GB RAM + 16GB ROM (Opsiyonel 3GB+32GB)",
        Kamera: "5.0MP AF (1D/2D barkod okuma destekli)",
        Pil: "7.6V / 2580mAh Lityum Polimer",
        Bağlantı: "4G/3G/2G, Wi-Fi 2.4G/5G, Bluetooth 4.2 BLE",
        Arayüz: "1x Type-C OTG, 1x Nano SIM",
        Ağırlık: "Yaklaşık 364g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_p3_air",
      name: "Sunmi P3 AIR",
      category: "Mobil POS & El Terminalleri",
      series: "P-Serisi (Ödeme POS)",
      description:
        "NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/icon/p3-air.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/video/tvc-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/xs/p3-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/lg/p3-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/xs/p3-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/lg/p3-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/xs/p3-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/lg/p3-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/xs/p3-2-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-air/lg/p3-2-1.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android 11)",
        İşlemci: "Quad-core 2.0GHz Cortex-A53",
        Ekran: '5.5" HD+ (1440x720) / 8.0" IPS',
        "Kart Okuyucu": "NFC, Çipli (EMV), Manyetik (MSR)",
        Sertifikalar: "PCI PTS 6.x, EMV L1/L2, Visa, Mastercard",
        Hafıza: "2GB RAM + 16GB ROM",
        Kamera: "5.0MP Otomatik Odaklamalı / Barkod Okuyucu",
        Pil: "7.2V / 2600mAh (Genişletilmiş Batarya)",
        Bağlantı: "4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli",
        Ağırlık: "Yaklaşık 345g - 430g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_p3_family",
      name: "Sunmi P3 Family",
      category: "Mobil POS & El Terminalleri",
      series: "P-Serisi (Ödeme POS)",
      description:
        "NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/icon/p3-family-en.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/video/tvc-n.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/xs/s3-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/lg/s3-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/xs/s3-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/lg/s3-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/xs/s3-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/lg/s3-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/xs/s3-2-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-family/lg/s3-2-1.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android 11)",
        İşlemci: "Quad-core 2.0GHz Cortex-A53",
        Ekran: '5.5" HD+ (1440x720) / 8.0" IPS',
        "Kart Okuyucu": "NFC, Çipli (EMV), Manyetik (MSR)",
        Sertifikalar: "PCI PTS 6.x, EMV L1/L2, Visa, Mastercard",
        Hafıza: "2GB RAM + 16GB ROM",
        Kamera: "5.0MP Otomatik Odaklamalı / Barkod Okuyucu",
        Pil: "7.2V / 2600mAh (Genişletilmiş Batarya)",
        Bağlantı: "4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli",
        Ağırlık: "Yaklaşık 345g - 430g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_p3_mix",
      name: "Sunmi P3 MIX",
      category: "Mobil POS & El Terminalleri",
      series: "P-Serisi (Ödeme POS)",
      description:
        "NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/icon/p3-mix.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/xs/p4-s-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/xs/p4-s-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/xs/p4-s-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/xs/p4-s-4.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/xs/p4-s-5.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/lg/p4-s-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/lg/p4-s-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/p3-mix/lg/p4-s-3.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android 11)",
        İşlemci: "Quad-core 2.0GHz Cortex-A53",
        Ekran: '5.5" HD+ (1440x720) / 8.0" IPS',
        "Kart Okuyucu": "NFC, Çipli (EMV), Manyetik (MSR)",
        Sertifikalar: "PCI PTS 6.x, EMV L1/L2, Visa, Mastercard",
        Hafıza: "2GB RAM + 16GB ROM",
        Kamera: "5.0MP Otomatik Odaklamalı / Barkod Okuyucu",
        Pil: "7.2V / 2600mAh (Genişletilmiş Batarya)",
        Bağlantı: "4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli",
        Ağırlık: "Yaklaşık 345g - 430g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_p2_lite_se",
      name: "Sunmi P2 LITE SE",
      category: "Mobil POS & El Terminalleri",
      series: "P-Serisi (Ödeme POS)",
      description:
        "NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/2/P2LITESE.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/p2-lite-se/lg/p4-1.png",
        "https://file.cdn.sunmi.com/newebsite/products/p2-lite-se/lg/p4-2.png",
        "https://file.cdn.sunmi.com/newebsite/products/p2-lite-se/lg/p4-3.png",
        "https://file.cdn.sunmi.com/newebsite/products/p2-lite-se/lg/p4-4.png",
        "https://file.cdn.sunmi.com/newebsite/products/p2-lite-se/lg/p4-5.png",
        "https://file.cdn.sunmi.com/newebsite/products/p2-lite-se/xs/p4-5.png",
        "https://file.cdn.sunmi.com/newebsite/products/p2-lite-se/xs/p4-1.png",
        "https://file.cdn.sunmi.com/newebsite/products/p2-lite-se/xs/p4-2.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android 11)",
        İşlemci: "Quad-core 2.0GHz Cortex-A53",
        Ekran: '5.5" HD+ (1440x720) / 8.0" IPS',
        "Kart Okuyucu": "NFC, Çipli (EMV), Manyetik (MSR)",
        Sertifikalar: "PCI PTS 6.x, EMV L1/L2, Visa, Mastercard",
        Hafıza: "2GB RAM + 16GB ROM",
        Kamera: "5.0MP Otomatik Odaklamalı / Barkod Okuyucu",
        Pil: "7.2V / 2600mAh (Genişletilmiş Batarya)",
        Bağlantı: "4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli",
        Ağırlık: "Yaklaşık 345g - 430g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_p2_se",
      name: "Sunmi P2 SE",
      category: "Mobil POS & El Terminalleri",
      series: "P-Serisi (Ödeme POS)",
      description:
        "NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/2/p2se.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/p2-se/appendix/open-box-video.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/2/p2se.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android 11)",
        İşlemci: "Quad-core 2.0GHz Cortex-A53",
        Ekran: '5.5" HD+ (1440x720) / 8.0" IPS',
        "Kart Okuyucu": "NFC, Çipli (EMV), Manyetik (MSR)",
        Sertifikalar: "PCI PTS 6.x, EMV L1/L2, Visa, Mastercard",
        Hafıza: "2GB RAM + 16GB ROM",
        Kamera: "5.0MP Otomatik Odaklamalı / Barkod Okuyucu",
        Pil: "7.2V / 2600mAh (Genişletilmiş Batarya)",
        Bağlantı: "4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli",
        Ağırlık: "Yaklaşık 345g - 430g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_p2",
      name: "Sunmi P2",
      category: "Mobil POS & El Terminalleri",
      series: "P-Serisi (Ödeme POS)",
      description:
        "NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/2/P2.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/2/P2.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android 11)",
        İşlemci: "Quad-core 2.0GHz Cortex-A53",
        Ekran: '5.5" HD+ (1440x720) / 8.0" IPS',
        "Kart Okuyucu": "NFC, Çipli (EMV), Manyetik (MSR)",
        Sertifikalar: "PCI PTS 6.x, EMV L1/L2, Visa, Mastercard",
        Hafıza: "2GB RAM + 16GB ROM",
        Kamera: "5.0MP Otomatik Odaklamalı / Barkod Okuyucu",
        Pil: "7.2V / 2600mAh (Genişletilmiş Batarya)",
        Bağlantı: "4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli",
        Ağırlık: "Yaklaşık 345g - 430g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_p2_smartpad",
      name: "Sunmi P2 SMARTPAD",
      category: "Mobil POS & El Terminalleri",
      series: "P-Serisi (Ödeme POS)",
      description:
        "NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/2/P2SMARTPAD.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/2/P2SMARTPAD.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android 11)",
        İşlemci: "Quad-core 2.0GHz Cortex-A53",
        Ekran: '5.5" HD+ (1440x720) / 8.0" IPS',
        "Kart Okuyucu": "NFC, Çipli (EMV), Manyetik (MSR)",
        Sertifikalar: "PCI PTS 6.x, EMV L1/L2, Visa, Mastercard",
        Hafıza: "2GB RAM + 16GB ROM",
        Kamera: "5.0MP Otomatik Odaklamalı / Barkod Okuyucu",
        Pil: "7.2V / 2600mAh (Genişletilmiş Batarya)",
        Bağlantı: "4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli",
        Ağırlık: "Yaklaşık 345g - 430g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_t3_family",
      name: "Sunmi T3 Family",
      category: "Masaüstü Kasa & Kiosk",
      series: "T-Serisi (Gelişmiş Kasa)",
      description:
        "Yoğun restoran ve perakende işletmeleri için tasarlanmış, güçlü işlemcisi ve entegre yazıcısıyla kesintisiz çalışan, müşteri ekranı opsiyonlu profesyonel masaüstü kasa sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/icon/t3-family.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/video/tvc-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/lg/main0.png",
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/lg/main1.png",
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/lg/main2.png",
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/lg/main3.png",
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/lg/main4.png",
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/lg/main5.png",
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/lg/main6.png",
        "https://file.cdn.sunmi.com/newebsite/products/t3-family/lg/main7.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android tabanlı)",
        İşlemci: "Kryo-260 Octa-core 2.2GHz / Cortex-A55",
        Ekran: '15.6" FHD (1920x1080) Kapasitif Çoklu Dokunmatik',
        "Müşteri Ekranı": 'Opsiyonel 15.6" FHD veya 10.1" HD',
        Hafıza: "4GB RAM + 64GB ROM / 2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 80mm Seiko Termal (250mm/s, Otomatik Kesici)",
        Arayüzler: "5x USB, 1x RJ11 (Kasa), 1x RJ12, 1x RJ45 (LAN), 1x Ses",
        Bağlantı: "Wi-Fi (2.4G/5G), Bluetooth 5.0, Gigabit LAN",
        Ağırlık: "5.1 kg - 7.5 kg",
        "Güç Adaptörü": "Giriş: AC100-240V / Çıkış: DC 24V/2.5A",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_t3_pro_family",
      name: "Sunmi T3 PRO Family",
      category: "Masaüstü Kasa & Kiosk",
      series: "T-Serisi (Gelişmiş Kasa)",
      description:
        "Yoğun restoran ve perakende işletmeleri için tasarlanmış, güçlü işlemcisi ve entegre yazıcısıyla kesintisiz çalışan, müşteri ekranı opsiyonlu profesyonel masaüstü kasa sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/t3-pro/icon/t3-pro-series.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/t3-pro/icon/t3-pro-series.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android tabanlı)",
        İşlemci: "Kryo-260 Octa-core 2.2GHz / Cortex-A55",
        Ekran: '15.6" FHD (1920x1080) Kapasitif Çoklu Dokunmatik',
        "Müşteri Ekranı": 'Opsiyonel 15.6" FHD veya 10.1" HD',
        Hafıza: "4GB RAM + 64GB ROM / 2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 80mm Seiko Termal (250mm/s, Otomatik Kesici)",
        Arayüzler: "5x USB, 1x RJ11 (Kasa), 1x RJ12, 1x RJ45 (LAN), 1x Ses",
        Bağlantı: "Wi-Fi (2.4G/5G), Bluetooth 5.0, Gigabit LAN",
        Ağırlık: "5.1 kg - 7.5 kg",
        "Güç Adaptörü": "Giriş: AC100-240V / Çıkış: DC 24V/2.5A",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_t2s",
      name: "Sunmi T2s",
      category: "Masaüstü Kasa & Kiosk",
      series: "T-Serisi (Gelişmiş Kasa)",
      description:
        "Yoğun restoran ve perakende işletmeleri için tasarlanmış, güçlü işlemcisi ve entegre yazıcısıyla kesintisiz çalışan, müşteri ekranı opsiyonlu profesyonel masaüstü kasa sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/T2.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/t2s/screen-1-video-lg-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/T2.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android tabanlı)",
        İşlemci: "Kryo-260 Octa-core 2.2GHz / Cortex-A55",
        Ekran: '15.6" FHD (1920x1080) Kapasitif Çoklu Dokunmatik',
        "Müşteri Ekranı": 'Opsiyonel 15.6" FHD veya 10.1" HD',
        Hafıza: "4GB RAM + 64GB ROM / 2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 80mm Seiko Termal (250mm/s, Otomatik Kesici)",
        Arayüzler: "5x USB, 1x RJ11 (Kasa), 1x RJ12, 1x RJ45 (LAN), 1x Ses",
        Bağlantı: "Wi-Fi (2.4G/5G), Bluetooth 5.0, Gigabit LAN",
        Ağırlık: "5.1 kg - 7.5 kg",
        "Güç Adaptörü": "Giriş: AC100-240V / Çıkış: DC 24V/2.5A",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_t2s_lite",
      name: "Sunmi T2s LITE",
      category: "Masaüstü Kasa & Kiosk",
      series: "T-Serisi (Gelişmiş Kasa)",
      description:
        "Yoğun restoran ve perakende işletmeleri için tasarlanmış, güçlü işlemcisi ve entegre yazıcısıyla kesintisiz çalışan, müşteri ekranı opsiyonlu profesyonel masaüstü kasa sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/T2LITE.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/t2slite/videos/video-page1-2560-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/T2LITE.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android tabanlı)",
        İşlemci: "Kryo-260 Octa-core 2.2GHz / Cortex-A55",
        Ekran: '15.6" FHD (1920x1080) Kapasitif Çoklu Dokunmatik',
        "Müşteri Ekranı": 'Opsiyonel 15.6" FHD veya 10.1" HD',
        Hafıza: "4GB RAM + 64GB ROM / 2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 80mm Seiko Termal (250mm/s, Otomatik Kesici)",
        Arayüzler: "5x USB, 1x RJ11 (Kasa), 1x RJ12, 1x RJ45 (LAN), 1x Ses",
        Bağlantı: "Wi-Fi (2.4G/5G), Bluetooth 5.0, Gigabit LAN",
        Ağırlık: "5.1 kg - 7.5 kg",
        "Güç Adaptörü": "Giriş: AC100-240V / Çıkış: DC 24V/2.5A",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_t2",
      name: "Sunmi T2",
      category: "Masaüstü Kasa & Kiosk",
      series: "T-Serisi (Gelişmiş Kasa)",
      description:
        "Yoğun restoran ve perakende işletmeleri için tasarlanmış, güçlü işlemcisi ve entegre yazıcısıyla kesintisiz çalışan, müşteri ekranı opsiyonlu profesyonel masaüstü kasa sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/T2.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/t2lite/md/page3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/t2lite/md/page11.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/t2lite/lg/page3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/t2lite/lg/page11.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android tabanlı)",
        İşlemci: "Kryo-260 Octa-core 2.2GHz / Cortex-A55",
        Ekran: '15.6" FHD (1920x1080) Kapasitif Çoklu Dokunmatik',
        "Müşteri Ekranı": 'Opsiyonel 15.6" FHD veya 10.1" HD',
        Hafıza: "4GB RAM + 64GB ROM / 2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 80mm Seiko Termal (250mm/s, Otomatik Kesici)",
        Arayüzler: "5x USB, 1x RJ11 (Kasa), 1x RJ12, 1x RJ45 (LAN), 1x Ses",
        Bağlantı: "Wi-Fi (2.4G/5G), Bluetooth 5.0, Gigabit LAN",
        Ağırlık: "5.1 kg - 7.5 kg",
        "Güç Adaptörü": "Giriş: AC100-240V / Çıkış: DC 24V/2.5A",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_t2_mini",
      name: "Sunmi T2 MINI",
      category: "Masaüstü Kasa & Kiosk",
      series: "T-Serisi (Gelişmiş Kasa)",
      description:
        "Yoğun restoran ve perakende işletmeleri için tasarlanmış, güçlü işlemcisi ve entegre yazıcısıyla kesintisiz çalışan, müşteri ekranı opsiyonlu profesyonel masaüstü kasa sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/T2MINI.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/T2MINI.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android tabanlı)",
        İşlemci: "Kryo-260 Octa-core 2.2GHz / Cortex-A55",
        Ekran: '15.6" FHD (1920x1080) Kapasitif Çoklu Dokunmatik',
        "Müşteri Ekranı": 'Opsiyonel 15.6" FHD veya 10.1" HD',
        Hafıza: "4GB RAM + 64GB ROM / 2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 80mm Seiko Termal (250mm/s, Otomatik Kesici)",
        Arayüzler: "5x USB, 1x RJ11 (Kasa), 1x RJ12, 1x RJ45 (LAN), 1x Ses",
        Bağlantı: "Wi-Fi (2.4G/5G), Bluetooth 5.0, Gigabit LAN",
        Ağırlık: "5.1 kg - 7.5 kg",
        "Güç Adaptörü": "Giriş: AC100-240V / Çıkış: DC 24V/2.5A",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d3_family",
      name: "Sunmi D3 Family",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/icon/d3-family.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/video/tvc-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/xs/p3-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/lg/p3-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/xs/p3-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/lg/p3-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/xs/p3-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/lg/p3-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/xs/p3-2-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d3-family/lg/p3-2-1.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d3_pro",
      name: "Sunmi D3 PRO",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/d3-pro/icon/d3-pro.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/d3-pro/icon/d3-pro.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d3_mini",
      name: "Sunmi D3 MINI",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/d3-mini/icon/d3-mini.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/d3-mini/icon/d3-mini.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d2s_kds",
      name: "Sunmi D2s KDS",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/d2s-kds/icon/product.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/d2s-kds/icon/product.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d2s_plus_combo",
      name: "Sunmi D2s PLUS COMBO",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus-combo/icon/product.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus-combo/xs/p5-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus-combo/xs/p5-1-1.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d2s_plus",
      name: "Sunmi D2s PLUS",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/icon/product.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/lg/p5-1-0.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/lg/p5-2-0.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/lg/p5-3-0.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/lg/p5-2-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/lg/p5-3-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/lg/p5-2-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/lg/p5-2-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/d2s-plus/lg/p5-3-2.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d2s_combo",
      name: "Sunmi D2s COMBO",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/D2SCOMBO.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/D2SCOMBO.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d2s",
      name: "Sunmi D2s",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/D2S.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/D2S.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d2s_lite",
      name: "Sunmi D2s LITE",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/D2SLITE.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/D2SLITE.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_d2_mini",
      name: "Sunmi D2 MINI",
      category: "Masaüstü Kasa & Kiosk",
      series: "D-Serisi (Kompakt Kasa)",
      description:
        "Dar tezgah alanına sahip butik işletmeler için ideal, şık ve az yer kaplayan kompakt masaüstü Android kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/D2MINI.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/D2MINI.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android)",
        İşlemci: "Cortex-A55 Quad-core 1.8GHz",
        Ekran: '15.6" FHD veya 10.1" HD Kapasitif',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Termal Yazıcı (160mm/s)",
        Bağlantı: "Wi-Fi, Bluetooth, Ethernet (LAN)",
        Arayüzler: "4x USB Type-A, 1x RJ11, 1x RJ45",
        Hoparlör: "3W Dahili Hoparlör",
        Ağırlık: "Yaklaşık 1.95 kg",
        Montaj: "VESA Destekli (Masaüstü veya Duvar)",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_s2",
      name: "Sunmi S2",
      category: "Akıllı Tartım",
      series: "S-Serisi (Terazi)",
      description:
        "Manav, kasap, şarküteri ve kuruyemiş gibi tartımlı ürün satan işletmeler için fiş/etiket yazıcı entegreli, hassas sensörlü akıllı terazi sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/S2.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/S2.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Quad-core 1.8GHz",
        Ekran: '15.6" FHD (Müşteri ekranı opsiyonel 10.1")',
        Hafıza: "2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 58mm Fiş / Etiket Yazıcı",
        "Tartım Kapasitesi": "Maks 15kg / Min 40g (e=2g/5g)",
        Özellikler: "Paslanmaz çelik tartı kefesi, böcek önleyici tasarım",
        Arayüz: "USB, RJ11, RJ45 LAN",
        Bağlantı: "Wi-Fi, Ethernet",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_ft2",
      name: "Sunmi FT2",
      category: "Masaüstü Kasa & Kiosk",
      series: "FT-Serisi",
      description:
        "Büyük mağaza ve süpermarket kasaları için yüksek tartım kapasitesine ve hızlı barkod okuma teknolojisine sahip entegre kasa çözümüdür.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/3/ft2.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/ft2/lg/main-en-0.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/ft2/lg/main-en-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/ft2/lg/main-en-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/ft2/lg/main-en-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/ft2/lg/main-en-4.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/ft2/lg/main-en-5.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/ft2/lg/main-en-6.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/ft2/lg/main-en-7.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android tabanlı)",
        İşlemci: "Kryo-260 Octa-core 2.2GHz / Cortex-A55",
        Ekran: '15.6" FHD (1920x1080) Kapasitif Çoklu Dokunmatik',
        "Müşteri Ekranı": 'Opsiyonel 15.6" FHD veya 10.1" HD',
        Hafıza: "4GB RAM + 64GB ROM / 2GB RAM + 16GB ROM",
        Yazıcı: "Dahili 80mm Seiko Termal (250mm/s, Otomatik Kesici)",
        Arayüzler: "5x USB, 1x RJ11 (Kasa), 1x RJ12, 1x RJ45 (LAN), 1x Ses",
        Bağlantı: "Wi-Fi (2.4G/5G), Bluetooth 5.0, Gigabit LAN",
        Ağırlık: "5.1 kg - 7.5 kg",
        "Güç Adaptörü": "Giriş: AC100-240V / Çıkış: DC 24V/2.5A",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_k2",
      name: "Sunmi K2",
      category: "Masaüstü Kasa & Kiosk",
      series: "K-Serisi (Kiosk)",
      description:
        "Müşterilerin kendi siparişlerini ve ödemelerini kolayca yapabilmesi için tasarlanmış, temassız ödeme destekli ve fiş yazıcılı self-servis sipariş (kiosk) sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/4/K2.png",
      video: "https://file.cdn.sunmi.com/newebsite/products/k2/xl/3-1-n.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/k2/xl/3-1-n.mp4?autoPlay=true\u0026screenshot=https://file.cdn.sunmi.com/newebsite/products/k2/xl/3-1-n.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/k2/md/3-1-n.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/k2/md/3-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/k2/md/3-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/k2/xl/3-31.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/k2/md/3-31.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/k2/xl/3-32.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/k2/md/3-32.jpg",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Hexa-core 1.8GHz",
        Ekran: '24" FHD (1920x1080) Çoklu Dokunmatik',
        Hafıza: "4GB RAM + 16GB ROM",
        Yazıcı: "80mm Termal (Otomatik Kesici)",
        "Barkod Okuyucu": "Geniş açılı 1D/2D tarayıcı",
        Kamera: "3D Structured Light veya 1080P",
        Bağlantı: "Wi-Fi, Ethernet, Bluetooth",
        Montaj: "Duvara Monte veya Bağımsız Ayaklı",
        Ağırlık: "Yaklaşık 16.5 kg",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_k2_mini",
      name: "Sunmi K2 MINI",
      category: "Masaüstü Kasa & Kiosk",
      series: "K-Serisi (Kiosk)",
      description:
        "Müşterilerin kendi siparişlerini ve ödemelerini kolayca yapabilmesi için tasarlanmış, temassız ödeme destekli ve fiş yazıcılı self-servis sipariş (kiosk) sistemidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/4/K2MINI.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/4/K2MINI.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS",
        İşlemci: "Hexa-core 1.8GHz",
        Ekran: '24" FHD (1920x1080) Çoklu Dokunmatik',
        Hafıza: "4GB RAM + 16GB ROM",
        Yazıcı: "80mm Termal (Otomatik Kesici)",
        "Barkod Okuyucu": "Geniş açılı 1D/2D tarayıcı",
        Kamera: "3D Structured Light veya 1080P",
        Bağlantı: "Wi-Fi, Ethernet, Bluetooth",
        Montaj: "Duvara Monte veya Bağımsız Ayaklı",
        Ağırlık: "Yaklaşık 16.5 kg",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_80mm_label_printer",
      name: "Sunmi 80MM Label Printer",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Yazıcılar",
      description:
        "Mutfak, bar veya paket servis alanlarında sipariş fişlerini ve yapışkanlı etiketleri hızlı, sessiz ve yüksek kalitede basabilen endüstriyel yazıcılardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/80-label-printer/icon/80-label-printer.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/80-label-printer/icon/80-label-printer.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_mini_ap",
      name: "Sunmi MINI AP",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Ağ & İletişim",
      description:
        "İşletmenin tüm sipariş ve POS trafiğini kesintisiz ve yüksek hızda yönlendirmek için tasarlanmış kurumsal ağ (Wi-Fi/4G) istasyonlarıdır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/icon/mini-ap.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/video/tvc-en.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/lg/s2-2.png",
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/xs/s2-1.png",
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/lg/s2-1.png",
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/xs/s2-f-1-en.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/lg/s2-f-1-en.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/xs/s2-f-2-en.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/lg/s2-f-2-en.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/mini-ap/xs/s2-f-3-en.jpg",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_4g_wi_fi_base_station",
      name: "Sunmi 4G Wi-Fi Base Station",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Ağ & İletişim",
      description:
        "İşletmenin tüm sipariş ve POS trafiğini kesintisiz ve yüksek hızda yönlendirmek için tasarlanmış kurumsal ağ (Wi-Fi/4G) istasyonlarıdır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/w1s.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/w1s.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_80mm_kitchen_cloud_printer",
      name: "Sunmi 80mm Kitchen Cloud Printer",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Yazıcılar",
      description:
        "Mutfak, bar veya paket servis alanlarında sipariş fişlerini ve yapışkanlı etiketleri hızlı, sessiz ve yüksek kalitede basabilen endüstriyel yazıcılardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/80-kitchen-printer/icon/80-printer.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/80-kitchen-printer/icon/80-printer.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_electronic_shelf_label",
      name: "Sunmi Electronic Shelf Label",
      category: "ESL Etiketleri",
      series: "Tümü",
      description:
        "Dijital raf etiketleri (ESL) ile fiyatlarınızı bulut üzerinden tek tuşla, sıfır kağıt israfıyla güncelleyin.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/ESL.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/5/ESL.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_blink2",
      name: "Sunmi Blink2",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Tarayıcılar",
      description:
        "Kasa noktalarında QR kodları, 1D/2D barkodları ve mobil cihaz ekranlarındaki kodları saniyenin altında bir sürede okuyabilen yüksek hassasiyetli tarayıcılardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/blink2/icon/blink2.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/blink2/xs/p2-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/blink2/lg/p2-1-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/blink2/xs/p2-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/blink2/lg/p2-1-2.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/blink2/xs/p2-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/blink2/lg/p2-1-3.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/blink2/xs/p2-2-1.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/blink2/lg/p2-2-1.jpg",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_sunmi_sound_box",
      name: "Sunmi SUNMI Sound Box",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Aksesuarlar",
      description:
        "Kasa çekmecesi, barkod okuyucu standı, batarya ve POS klavyesi gibi LOKMA donanım ekosistemini tamamlayan profesyonel aksesuarlardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/sound-box/icon/sound-box.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/sound-box/icon/sound-box.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_max_cash_drawer",
      name: "Sunmi MAX Cash Drawer",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Aksesuarlar",
      description:
        "Kasa çekmecesi, barkod okuyucu standı, batarya ve POS klavyesi gibi LOKMA donanım ekosistemini tamamlayan profesyonel aksesuarlardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/icon/max-cash-drawer-v1.png",
      video:
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/specs/MAX%20Cash%20Drawer%20Open%20Box.mp4",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/v1/1-1.lg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/v1/2-1.lg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/v1/2-2.lg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/v1/2-3.lg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/v1/3-1.lg.png",
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/v1/3-2.lg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/v1/4-1.lg.jpg",
        "https://file.cdn.sunmi.com/newebsite/products/max-cash-drawer/v1/4-2.lg.jpg",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_blink_scanbox",
      name: "Sunmi Blink ScanBox",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Tarayıcılar",
      description:
        "Kasa noktalarında QR kodları, 1D/2D barkodları ve mobil cihaz ekranlarındaki kodları saniyenin altında bir sürede okuyabilen yüksek hassasiyetli tarayıcılardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/scanner.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/scanner.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_2d_handheld_scanner",
      name: "Sunmi 2D Handheld Scanner",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Tarayıcılar",
      description:
        "Kasa noktalarında QR kodları, 1D/2D barkodları ve mobil cihaz ekranlarındaki kodları saniyenin altında bir sürede okuyabilen yüksek hassasiyetli tarayıcılardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/scannergun.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/scannergun.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_pos_power_bank",
      name: "Sunmi POS Power Bank",
      category: "Mobil POS & El Terminalleri",
      series: "P-Serisi (Ödeme POS)",
      description:
        "NFC, çip ve manyetik kart okuyucuları ile donatılmış, uluslararası ödeme sertifikalarına (PCI PTS) sahip güvenli ve taşınabilir Android ödeme terminalidir.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/charger.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/charger.png",
      ],
      detailedSpecs: {
        "İşletim Sistemi": "Sunmi OS (Android 11)",
        İşlemci: "Quad-core 2.0GHz Cortex-A53",
        Ekran: '5.5" HD+ (1440x720) / 8.0" IPS',
        "Kart Okuyucu": "NFC, Çipli (EMV), Manyetik (MSR)",
        Sertifikalar: "PCI PTS 6.x, EMV L1/L2, Visa, Mastercard",
        Hafıza: "2GB RAM + 16GB ROM",
        Kamera: "5.0MP Otomatik Odaklamalı / Barkod Okuyucu",
        Pil: "7.2V / 2600mAh (Genişletilmiş Batarya)",
        Bağlantı: "4G LTE / 3G / 2G, Wi-Fi, Bluetooth 5.0, eSIM destekli",
        Ağırlık: "Yaklaşık 345g - 430g",
      },
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_89_key_pos_keyboard",
      name: "Sunmi 89-Key POS Keyboard",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Aksesuarlar",
      description:
        "Kasa çekmecesi, barkod okuyucu standı, batarya ve POS klavyesi gibi LOKMA donanım ekosistemini tamamlayan profesyonel aksesuarlardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/keyword.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/keyword.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_mini_cash_drawer",
      name: "Sunmi Mini Cash Drawer",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Aksesuarlar",
      description:
        "Kasa çekmecesi, barkod okuyucu standı, batarya ve POS klavyesi gibi LOKMA donanım ekosistemini tamamlayan profesyonel aksesuarlardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image:
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/moneybox-v1.png",
      images: [
        "https://file.cdn.sunmi.com/newebsite/products/list/xl/icons/6/moneybox-v1.png",
      ],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },
    {
      id: "sunmi_inquiry",
      name: "Sunmi Inquiry",
      category: "Ağ, Yazıcı & Aksesuarlar",
      series: "Aksesuarlar",
      description:
        "Kasa çekmecesi, barkod okuyucu standı, batarya ve POS klavyesi gibi LOKMA donanım ekosistemini tamamlayan profesyonel aksesuarlardır.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://file.cdn.sunmi.com/newebsite/floating/inquery.png",
      images: ["https://file.cdn.sunmi.com/newebsite/floating/inquery.png"],
      price: 299,
      rentPrice: 19.9,
      minRentMonths: 12,
    },

    // ---- SUPERGALAXY SERIES ----

    {
      id: "esl_sg_154b",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag154B",
      category: "ESL Etiketleri",
      description:
        "En küçük 1.54 inç (3.9 cm) 3 renk (Siyah-Beyaz-Kırmızı) destekli etiket, süper hızlı güncelleme.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-08/68956ef03a5a0.jpg",
      price: 12.9,
      rentPrice: 0.9,
      minRentMonths: 12,
      specs: ["1.54 inç (3.9 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"],
      filters: {
        size: 1.54,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_21b",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag21B",
      category: "ESL Etiketleri",
      description:
        "2.1 inç (5.3 cm) 3 renk (Siyah-Beyaz-Kırmızı) destekli etiket, süper hızlı güncelleme.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d14338531dd.png",
      price: 13.9,
      rentPrice: 1.0,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_26b",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag26B",
      category: "ESL Etiketleri",
      description:
        "2.6 inç (6.6 cm) 3 renk (Siyah-Beyaz-Kırmızı) destekli etiket, süper hızlı güncelleme.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-06/666188b221228.jpg",
      price: 16.9,
      rentPrice: 1.2,
      minRentMonths: 12,
      specs: ["2.6 inç (6.6 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"],
      filters: {
        size: 2.6,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_42b",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag42B",
      category: "ESL Etiketleri",
      description:
        "4.2 inç (10.7 cm) büyük boy 3 renk (Siyah-Beyaz-Kırmızı) destekli etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142b76297d.png",
      price: 27.9,
      rentPrice: 2.3,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_58b",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag58B",
      category: "ESL Etiketleri",
      description:
        "5.8 inç (14.7 cm) geniş format 3 renk (Siyah-Beyaz-Kırmızı) destekli etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d14298d25a9.png",
      price: 42.9,
      rentPrice: 3.3,
      minRentMonths: 12,
      specs: ["5.8 inç (14.7 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"],
      filters: {
        size: 5.8,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_75b",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag75B",
      category: "ESL Etiketleri",
      description:
        "7.5 inç (19.1 cm) geniş format 3 renk (Siyah-Beyaz-Kırmızı) destekli etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013939009d.png",
      price: 62.9,
      rentPrice: 4.5,
      minRentMonths: 12,
      specs: ["7.5 inç (19.1 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"],
      filters: {
        size: 7.5,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_116b",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag116B",
      category: "ESL Etiketleri",
      description:
        "11.6 inç (29.5 cm) devasa 3 renk (Siyah-Beyaz-Kırmızı) destekli ekran.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142588faa9.png",
      price: 85.9,
      rentPrice: 5.5,
      minRentMonths: 12,
      specs: ["11.6 inç (29.5 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"],
      filters: {
        size: 11.6,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },

    {
      id: "esl_sg_116",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag116",
      category: "ESL Etiketleri",
      description:
        "Geniş formatlı reyon yönlendirmeleri ve devasa promosyon ekranı.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142588faa9.png",
      price: 89.9,
      rentPrice: 5.9,
      minRentMonths: 12,
      specs: ["11.6 inç (29.5 cm)", "3 Renkli Ekran", "5 Yıl Pil"],
      filters: {
        size: 11.6,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_58",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag58",
      category: "ESL Etiketleri",
      description:
        "Büyük ürün detayları gösterebilen yüksek çözünürlüklü etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d14298d25a9.png",
      price: 44.9,
      rentPrice: 3.5,
      minRentMonths: 12,
      specs: ["5.8 inç (14.7 cm)", "3 Renk Desteği"],
      filters: {
        size: 5.8,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_58q",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag58Q",
      category: "ESL Etiketleri",
      description: "4 renk kapasitesiyle daha canlı görünüm.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe104c8cc89.jpg",
      price: 49.9,
      rentPrice: 3.9,
      minRentMonths: 12,
      specs: ["5.8 inç (14.7 cm)", "4 Renkli"],
      filters: {
        size: 5.8,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_42",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag42",
      category: "ESL Etiketleri",
      description: "Standart büyük boy etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142b76297d.png",
      price: 29.9,
      rentPrice: 2.5,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "3 Renkli"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_42q",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag42Q",
      category: "ESL Etiketleri",
      description: "4.2 inç (10.7 cm) formatında 4 farklı renk kapasitesi.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe11564ffc2.jpg",
      price: 34.9,
      rentPrice: 2.8,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "4 Renk"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_29aq",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag29AQ",
      category: "ESL Etiketleri",
      description: "Market rafları için Premium kasa ve gelişmiş AQ seri.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-08/6895746442731.jpg",
      price: 22.9,
      rentPrice: 1.8,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "Premium"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth", "NFC"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_29",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag29",
      category: "ESL Etiketleri",
      description: "Standart 2.9 inç (7.4 cm) market etiketi.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142f92b942.png",
      price: 19.9,
      rentPrice: 1.5,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "3 Renkli"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_29q",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag29Q",
      category: "ESL Etiketleri",
      description: "2.9 inç (7.4 cm) boyutunda 4 renk kapasitesi.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe12511deb9.png",
      price: 21.9,
      rentPrice: 1.6,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "4 Renk"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_29b",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag29B",
      category: "ESL Etiketleri",
      description:
        "3 renk (Siyah-Beyaz-Kırmızı) desteği, süper hızlı güncelleme.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142f92b942.png",
      price: 17.9,
      rentPrice: 1.3,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_26",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag26",
      category: "ESL Etiketleri",
      description: "Sıkışık raflar için 2.6 inç (6.6 cm) model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-06/666188b221228.jpg",
      price: 17.9,
      rentPrice: 1.3,
      minRentMonths: 12,
      specs: ["2.6 inç (6.6 cm)", "3 Renkli"],
      filters: {
        size: 2.6,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_26q",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag26Q",
      category: "ESL Etiketleri",
      description: "Küçük form faktörde 4 renk.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe12af9e8e5.png",
      price: 19.9,
      rentPrice: 1.5,
      minRentMonths: 12,
      specs: ["2.6 inç (6.6 cm)", "4 Renk"],
      filters: {
        size: 2.6,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_29ab",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag29AB",
      category: "ESL Etiketleri",
      description: "2.9 inç (7.4 cm) AB (Advanced) varyasyonu.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142f92b942.png",
      price: 23.9,
      rentPrice: 1.8,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "Advanced"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth", "NFC"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_21f",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag21F",
      category: "ESL Etiketleri",
      description: "Dondurucu için optimize edilmiş 2.1 inç (5.3 cm) etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-06/6661856043454.jpg",
      price: 18.9,
      rentPrice: 1.4,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "Soğuk Hava (-25°C)"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth", "NFC"],
        colors: 3,
        cold: true,
        water: false,
      },
    },
    {
      id: "esl_sg_21",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag21",
      category: "ESL Etiketleri",
      description: "Kozmetik reyonları için keskin 2.1 inç (5.3 cm) etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d14338531dd.png",
      price: 14.9,
      rentPrice: 1.1,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "3 Renkli"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_sg_21q",
      series: "Supergalaxy Series",
      name: "LOKMA Smart Tag STag21Q",
      category: "ESL Etiketleri",
      description: "Mini boyutta 4 renk özelliği.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe1375c32c2.png",
      price: 16.9,
      rentPrice: 1.2,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "4 Renk"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },

    // ---- DS SLIM SERIES ----

    {
      id: "esl_ds_015b",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS015B",
      category: "ESL Etiketleri",
      description: "1.54 inç (3.9 cm) ultra ince siyah beyaz model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-08/68956ef03a5a0.jpg",
      price: 11.9,
      rentPrice: 0.8,
      minRentMonths: 12,
      specs: ["1.54 inç (3.9 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"],
      filters: {
        size: 1.54,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_021b",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS021B",
      category: "ESL Etiketleri",
      description: "2.1 inç (5.3 cm) ultra ince siyah beyaz model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png",
      images: [
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png",
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d00ff17648f.png",
        "https://www.minewtag.com/upload/goodsgallery/2025-08/68956ef03a5a0.jpg",
      ],
      price: 11.9,
      rentPrice: 0.8,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_026b",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS026B",
      category: "ESL Etiketleri",
      description: "2.66 inç (6.8 cm) ultra ince siyah beyaz model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg",
      images: [
        "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg",
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d141cba5662.png",
        "https://www.minewtag.com/upload/goodsgallery/2025-08/68afbe8f44644.jpg",
      ],
      price: 15.9,
      rentPrice: 1.1,
      minRentMonths: 12,
      specs: ["2.66 inç (6.8 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"],
      filters: {
        size: 2.66,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_029b",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS029B",
      category: "ESL Etiketleri",
      description: "2.9 inç (7.4 cm) ultra ince siyah beyaz model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142eb62d93.png",
      images: [
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142eb62d93.png",
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d13ea1430ab.png",
        "https://www.minewtag.com/upload/goodsgallery/2025-09/68c38d8641c11.jpg",
      ],
      price: 16.9,
      rentPrice: 1.2,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_042b",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS042B",
      category: "ESL Etiketleri",
      description: "4.2 inç (10.7 cm) ultra ince siyah beyaz model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png",
      images: [
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png",
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d13e482f6ad.png",
        "https://www.minewtag.com/upload/goodsgallery/2025-08/68afbfc428d05.jpg",
      ],
      price: 29.9,
      rentPrice: 2.4,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_058b",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS058B",
      category: "ESL Etiketleri",
      description: "5.8 inç (14.7 cm) ultra ince siyah beyaz model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png",
      price: 42.9,
      rentPrice: 3.3,
      minRentMonths: 12,
      specs: ["5.8 inç (14.7 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"],
      filters: {
        size: 5.8,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_075b",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS075B",
      category: "ESL Etiketleri",
      description: "7.5 inç (19.1 cm) ultra ince siyah beyaz model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013891036e.png",
      price: 62.9,
      rentPrice: 4.5,
      minRentMonths: 12,
      specs: ["7.5 inç (19.1 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"],
      filters: {
        size: 7.5,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },

    {
      id: "esl_ds_116",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS116",
      category: "ESL Etiketleri",
      description: "Ultra ince 11.6 inç (29.5 cm) signage modeli.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013fb9239f.png",
      price: 89.9,
      rentPrice: 5.9,
      minRentMonths: 12,
      specs: ["11.6 inç (29.5 cm)", "Ultra Slim"],
      filters: {
        size: 11.6,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_043q",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS043Q",
      category: "ESL Etiketleri",
      description: "4.3 inç (10.9 cm) grafik display ince model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-09/68c388545f05f.jpg",
      price: 36.9,
      rentPrice: 2.8,
      minRentMonths: 12,
      specs: ["4.3 inç (10.9 cm)", "Slim", "4 Renk"],
      filters: {
        size: 4.3,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_042q",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS042Q",
      category: "ESL Etiketleri",
      description: "4.2 inç (10.7 cm) ince kasa 2.5D şeffaf korumalı.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d13d5963cb9.png",
      price: 31.9,
      rentPrice: 2.6,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "Slim"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_042f",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS042F",
      category: "ESL Etiketleri",
      description: "IP67 korumalı ince seri model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-08/68afbfc42f4bf.jpg",
      price: 34.9,
      rentPrice: 2.7,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "IP67", "Slim"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth", "NFC"],
        colors: 3,
        cold: false,
        water: true,
      },
    },
    {
      id: "esl_ds_035q",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS035Q",
      category: "ESL Etiketleri",
      description: "3.5 inç (8.9 cm) ince kasa modeli.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d13e594f9b9.png",
      price: 26.9,
      rentPrice: 2.1,
      minRentMonths: 12,
      specs: ["3.5 inç (8.9 cm)", "Slim"],
      filters: {
        size: 3.5,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_035b",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS035B",
      category: "ESL Etiketleri",
      description: "Siyah beyaz 3.5 inç (8.9 cm) ince kasa modeli.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-09/68c37f463503f.jpg",
      price: 24.9,
      rentPrice: 1.9,
      minRentMonths: 12,
      specs: ["3.5 inç (8.9 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"],
      filters: {
        size: 3.5,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_029q",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS029Q",
      category: "ESL Etiketleri",
      description: "Standart market rafları için ultra ince profil.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d13eacab206.png",
      price: 18.9,
      rentPrice: 1.4,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "Slim", "4 Renk"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_027q",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS027Q",
      category: "ESL Etiketleri",
      description: "2.7 inç (6.9 cm) ara boyut ince etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-08/68956b8e28509.jpg",
      price: 17.9,
      rentPrice: 1.3,
      minRentMonths: 12,
      specs: ["2.7 inç (6.9 cm)", "Slim"],
      filters: {
        size: 2.7,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_026f",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS026F",
      category: "ESL Etiketleri",
      description: "Sadece 7.8mm kalınlığında 2.66 inç (6.8 cm) etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2025-08/68afbe8f569e9.jpg",
      price: 16.9,
      rentPrice: 1.2,
      minRentMonths: 12,
      specs: ["2.6 inç (6.6 cm)", "7.8mm Slim"],
      filters: {
        size: 2.6,
        tech: ["Bluetooth", "NFC"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_021q",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS021Q",
      category: "ESL Etiketleri",
      description: "Raf alanı dar yerler için 4 renkli mini ince etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d141deb0a02.png",
      price: 14.9,
      rentPrice: 1.1,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "4-Renk", "Slim"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth", "NFC"],
        colors: 4,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_ds_021",
      series: "DS Slim Series",
      name: "LOKMA Smart Tag DS021",
      category: "ESL Etiketleri",
      description: "DS serisinin en küçük ve ince etiketlerinden biri.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png",
      price: 12.9,
      rentPrice: 0.9,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "Slim"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },

    // ---- RAINBOW SERIES ----
    {
      id: "esl_rainbow_58",
      series: "Rainbow Series",
      name: "LOKMA Smart Tag RTag58",
      category: "ESL Etiketleri",
      description:
        "Çoklu renk paleti ve yanıp sönen flaş özellikli büyük boy etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png",
      price: 46.9,
      rentPrice: 3.8,
      minRentMonths: 12,
      specs: ["5.8 inç (14.7 cm)", "Rainbow"],
      filters: {
        size: 5.8,
        tech: ["Bluetooth"],
        colors: 7,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_rainbow_42",
      series: "Rainbow Series",
      name: "LOKMA Smart Tag RTag42",
      category: "ESL Etiketleri",
      description: "7 renkli standart büyük boy indirim etiketi.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png",
      price: 32.9,
      rentPrice: 2.4,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "Rainbow"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth"],
        colors: 7,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_rainbow_29",
      series: "Rainbow Series",
      name: "LOKMA Smart Tag RTag29",
      category: "ESL Etiketleri",
      description: "Orta boy raflar için flaşlı çok renkli etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142eb62d93.png",
      price: 22.9,
      rentPrice: 1.8,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "Rainbow"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth"],
        colors: 7,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_rainbow_26",
      series: "Rainbow Series",
      name: "LOKMA Smart Tag RTag26",
      category: "ESL Etiketleri",
      description: "Dikkat çekici mini promosyon etiketi.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg",
      price: 20.9,
      rentPrice: 1.6,
      minRentMonths: 12,
      specs: ["2.6 inç (6.6 cm)", "Rainbow"],
      filters: {
        size: 2.6,
        tech: ["Bluetooth"],
        colors: 7,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_rainbow_21",
      series: "Rainbow Series",
      name: "LOKMA Smart Tag RTag21",
      category: "ESL Etiketleri",
      description: "En küçük formatta renk cümbüşü sunan flaşlı model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png",
      price: 18.9,
      rentPrice: 1.4,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "Rainbow"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth"],
        colors: 7,
        cold: false,
        water: false,
      },
    },

    // ---- MULTI-ZONE SERIES ----
    {
      id: "esl_mz_75",
      series: "Multi-Zone Series",
      name: "LOKMA Smart Tag MZ075",
      category: "ESL Etiketleri",
      description:
        "Yan yana birden fazla ürünü tek ekranda ayırarak göstermek için.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013891036e.png",
      price: 64.9,
      rentPrice: 4.9,
      minRentMonths: 12,
      specs: ["7.5 inç (19.1 cm)", "Multi-Zone"],
      filters: {
        size: 7.5,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_mz_58",
      series: "Multi-Zone Series",
      name: "LOKMA Smart Tag MZ058",
      category: "ESL Etiketleri",
      description: "5.8 inç (14.7 cm) formatında bölünmüş ürün gösterimi.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png",
      price: 49.9,
      rentPrice: 3.8,
      minRentMonths: 12,
      specs: ["5.8 inç (14.7 cm)", "Multi-Zone"],
      filters: {
        size: 5.8,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_mz_42",
      series: "Multi-Zone Series",
      name: "LOKMA Smart Tag MZ042",
      category: "ESL Etiketleri",
      description: "Standart boyutta bağımsız bölgelere sahip fiyat etiketi.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png",
      price: 34.9,
      rentPrice: 2.5,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "Multi-Zone"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },

    // ---- MERCURIUS SERIES ----
    {
      id: "esl_mercurius_58",
      series: "Mercurius Series",
      name: "LOKMA Smart Tag MTag58",
      category: "ESL Etiketleri",
      description: "Geniş formatta elit metalik tasarımlı etiket.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png",
      price: 47.9,
      rentPrice: 3.6,
      minRentMonths: 12,
      specs: ["5.8 inç (14.7 cm)", "Mercurius"],
      filters: {
        size: 5.8,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_mercurius_42",
      series: "Mercurius Series",
      name: "LOKMA Smart Tag MTag42",
      category: "ESL Etiketleri",
      description:
        "Şarküteri ve gurme reyonları için lüks görünümlü 4.2 inç (10.7 cm).",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png",
      price: 32.9,
      rentPrice: 2.6,
      minRentMonths: 12,
      specs: ["4.2 inç (10.7 cm)", "Mercurius"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_mercurius_29",
      series: "Mercurius Series",
      name: "LOKMA Smart Tag MTag29",
      category: "ESL Etiketleri",
      description:
        "Butik mağazalar için tasarlanmış özel premium kasa tasarımı.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d143ceb1e71.png",
      price: 24.9,
      rentPrice: 1.8,
      minRentMonths: 12,
      specs: ["2.9 inç (7.4 cm)", "Mercurius"],
      filters: {
        size: 2.9,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_mercurius_26",
      series: "Mercurius Series",
      name: "LOKMA Smart Tag MTag26",
      category: "ESL Etiketleri",
      description: "Küçük boy, yüksek kalite metalik kasa modeli.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg",
      price: 21.9,
      rentPrice: 1.6,
      minRentMonths: 12,
      specs: ["2.6 inç (6.6 cm)", "Mercurius"],
      filters: {
        size: 2.6,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_mercurius_21",
      series: "Mercurius Series",
      name: "LOKMA Smart Tag MTag21",
      category: "ESL Etiketleri",
      description:
        "Mini kozmetik reyonları için şık çerçeveli 2.1 inç (5.3 cm).",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png",
      price: 17.9,
      rentPrice: 1.3,
      minRentMonths: 12,
      specs: ["2.1 inç (5.3 cm)", "Mercurius"],
      filters: {
        size: 2.1,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },

    // ---- CONFERENCE TABLE SERIES ----
    {
      id: "esl_conference_rs075v",
      series: "Conference Table Series",
      name: "LOKMA Smart Desk Sign RS075V",
      category: "ESL Etiketleri",
      description:
        "Ofis resepsiyonu ve masa numaratörleri için çift taraflı V-şeklinde ekran (6 renk destegi).",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d0120729b52.png",
      price: 95.9,
      rentPrice: 6.9,
      minRentMonths: 12,
      specs: ["7.3 inç (18.5 cm) x 2", "V-Shape", "6 Renk"],
      filters: {
        size: 7.3,
        tech: ["Bluetooth"],
        colors: 6,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_conference_ds073",
      series: "Conference Table Series",
      name: "LOKMA Smart Desk Sign DS073",
      category: "ESL Etiketleri",
      description: "Toplantı masaları için gelişmiş ince profil isimlik.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-09/66e3a7cc2cbec.png",
      price: 85.9,
      rentPrice: 6.5,
      minRentMonths: 12,
      specs: ["7.3 inç (18.5 cm) Çift Taraflı"],
      filters: {
        size: 7.3,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_conference_ws075",
      series: "Conference Table Series",
      name: "LOKMA Smart Desk Sign WS075",
      category: "ESL Etiketleri",
      description: "Geniş format masaüstü elektronik bilgi levhası.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d012b6b97b3.png",
      price: 89.9,
      rentPrice: 6.7,
      minRentMonths: 12,
      specs: ["7.5 inç (19.1 cm)", "Masaüstü Stand"],
      filters: {
        size: 7.5,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },
    {
      id: "esl_conference_stag75",
      series: "Conference Table Series",
      name: "LOKMA Smart Desk Sign STag75",
      category: "ESL Etiketleri",
      description:
        "Masaüstü konferans etiketlemeleri için yüksek okunaklı STag serisi model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013939009d.png",
      price: 79.9,
      rentPrice: 5.9,
      minRentMonths: 12,
      specs: ["7.5 inç (19.1 cm)", "Standlı"],
      filters: {
        size: 7.5,
        tech: ["Bluetooth"],
        colors: 3,
        cold: false,
        water: false,
      },
    },

    // ---- COLD-CHAIN SERIES ----
    {
      id: "esl_cold_42",
      series: "Cold-Chain Series",
      name: "LOKMA Smart Tag CTag42",
      category: "ESL Etiketleri",
      description:
        "Dondurucu reyonları için üretilmiş, -25°C ısıya ve buğulanmaya dayanıklı.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png",
      price: 36.9,
      rentPrice: 2.8,
      minRentMonths: 12,
      specs: ["-25°C Dayanıklı", "4.2 inç (10.7 cm)"],
      filters: {
        size: 4.2,
        tech: ["Bluetooth"],
        colors: 3,
        cold: true,
        water: true,
      },
    },
    {
      id: "esl_cold_26",
      series: "Cold-Chain Series",
      name: "LOKMA Smart Tag CTag26",
      category: "ESL Etiketleri",
      description:
        "Soğuk hava dolapları için kompakt, donmaya ve neme dayanıklı model.",
      image:
        "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg",
      price: 24.9,
      rentPrice: 1.9,
      minRentMonths: 12,
      specs: ["-25°C", "2.6 inç (6.6 cm)"],
      filters: {
        size: 2.6,
        tech: ["Bluetooth"],
        colors: 3,
        cold: true,
        water: true,
      },
    },

    // ---- OTHERS ----
    {
      id: "thermal_roll_80",
      name: "Termal Rulo 80mm (Kasa & Mutfak)",
      category: "Sarf Malzemeleri",
      description:
        "Standart 80mm termal yazıcı rulosu. Tüm LOKMA fiş ve mutfak yazıcılarıyla uyumlu yüksek kalite termal kağıt. (50'li Koli)",
      icon: <Tag className="w-8 h-8 text-neutral-400" />,
      image: "https://m.media-amazon.com/images/I/61Nl8XQfHUL._AC_SL1500_.jpg",
      price: 39.9,
      rentPrice: 0,
      minRentMonths: 0,
    },
    {
      id: "thermal_roll_80_5pack",
      name: "Double Dragon 80mm Termal Rulo (5'li Paket)",
      category: "Sarf Malzemeleri",
      description:
        "Yüksek kalite, BPA içermeyen POS kasa ve mutfak yazıcısı termal kağıdı (80mm x 80mm). Çevre dostu ve leke tutmaz. 5 adet rulo içerir.",
      icon: <Tag className="w-8 h-8 text-neutral-400" />,
      image: "https://m.media-amazon.com/images/I/715AC3Tnm9L._AC_SX679_.jpg",
      images: [
        "https://m.media-amazon.com/images/I/715AC3Tnm9L._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/51rVRWbxOkL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/61hqXKz68QL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/817GkNDM7SL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/711cp4+W8aL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/714n4Z1yQUL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/712aup6qv3L._AC_SL1500_.jpg",
      ],
      price: 8.56,
      rentPrice: 0,
      minRentMonths: 0,
    },
  ];

  const handleUpdateCart = (
    id: string,
    quantity: number,
    mode: "rent" | "buy" | "installment",
    duration: 6 | 12 | 24 | 36 = 12,
  ) => {
    if (quantity <= 0) {
      const newCart = { ...hardwareCart };
      delete newCart[id];
      setHardwareCart(newCart);
      return;
    }
    setHardwareCart({
      ...hardwareCart,
      [id]: { quantity, mode, duration },
    });
  };

  const handleRequestSubmit = async () => {
    if (Object.keys(hardwareCart).length === 0) return;
    setSubmitting(true);
    try {
      const requestData = {
        businessId: business.id,
        businessName: business.companyName || business.brand || "Bilinmiyor",
        items: hardwareCart,
        requestedAt: serverTimestamp(),
        status: "pending",
        requestedBy: admin ? admin.email : "Business Owner",
      };

      await addDoc(collection(db, "pendingHardwareRequests"), requestData);

      setShowSuccessModal(true);
      setHardwareCart({});
    } catch (error) {
      console.error("Donanım talep hatası:", error);
      showToast("Donanım talebi oluşturulurken bir hata oluştu.", "error");
    }
    setSubmitting(false);
  };

  const totalBuy = Object.entries(hardwareCart).reduce((acc, [id, data]) => {
    if (data.mode === "buy") {
      const product = hardwareList.find((p) => p.id === id);
      return acc + (product?.price || 0) * data.quantity;
    }
    return acc;
  }, 0);

  const totalRent = Object.entries(hardwareCart).reduce((acc, [id, data]) => {
    if (data.mode === "rent") {
      const product = hardwareList.find((p) => p.id === id);
      const calculatedPrice = getRentPrice(
        product?.rentPrice || 0,
        data.duration as 6 | 12 | 24,
      );
      return acc + calculatedPrice * data.quantity;
    }
    if (data.mode === "installment") {
      const product = hardwareList.find((p) => p.id === id);
      const calculatedPrice = getInstallmentPrice(
        product?.price || 0,
        data.duration as 24 | 36,
      );
      return acc + calculatedPrice * data.quantity;
    }
    return acc;
  }, 0);

  // Toggle filter logic
  const toggleArrayFilter = (state: any[], setter: any, value: any) => {
    if (state.includes(value)) {
      setter(state.filter((v) => v !== value));
    } else {
      setter([...state, value]);
    }
  };

  const filteredHardware = hardwareList.filter((p) => {
    if (activeCategory !== "Tüm Ekosistem" && p.category !== activeCategory) return false;
    // activeSeries filtresi tamamen kaldırıldı, ürünler alt alta seriler halinde listelenecek.

    if (activeCategory === "ESL Etiketleri") {
      // Additional Filters
      if (filterSeries.length > 0 && p.series && !filterSeries.includes(p.series))
        return false;
      if (p.filters) {
        if (filterSize.length > 0 && !filterSize.includes(p.filters.size))
          return false;
        if (
          filterTech.length > 0 &&
          !filterTech.some((t: string) => p.filters.tech.includes(t))
        )
          return false;
        if (filterColor.length > 0 && !filterColor.includes(p.filters.colors))
          return false;
        if (filterCold && !p.filters.cold) return false;
        if (filterWater && !p.filters.water) return false;
        if (p.rentPrice > maxRentPrice) return false;
      }
    }

    return true;
  });

  // Extract unique filter options from the list
  const availableSizes = Array.from(
    new Set(
      hardwareList
        .filter((p) => p.category === "ESL Etiketleri" && p.filters)
        .map((p) => p.filters.size),
    ),
  ).sort((a, b) => a - b);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-900/60 to-purple-900/40 border border-indigo-500/40 rounded-2xl p-6 mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white mb-2">
            Donanım Mağazası (LOKMA DaaS)
          </h2>
          <p className="text-indigo-200 max-w-2xl">
            İşletmenizin ihtiyacı olan akıllı kasa, terazi ve ESL etiketlerini
            buradan sipariş edebilirsiniz. Kiralama modeli (Device as a Service)
            ile yüksek ilk yatırım maliyeti olmadan donanımlarınızı
            kurabilirsiniz.
          </p>
        </div>
      </div>

      <div className="space-y-16 pb-32">
        {/* Kategori Tabları (Premium Tablet Uyumlu) */}
        <div className="relative w-full">
          {/* Sol/Sağ gradient gölgeleri (Kaydırılabilir alan hissi vermek için) Sadece mobilde görünür */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none md:hidden" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />

          <div className="flex items-center gap-3 overflow-x-auto md:overflow-visible md:flex-wrap pb-4 pt-2 px-2 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setActiveSeries("Tümü");
                }}
                className={`relative shrink-0 px-6 py-3.5 rounded-2xl text-[15px] font-bold tracking-wide whitespace-nowrap transition-all duration-300 shadow-sm border ${
                  activeCategory === category
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-900/30"
                    : "bg-card text-muted-foreground border-border/40 hover:bg-muted/80 hover:text-foreground hover:border-border/80"
                }`}
              >
                {category}
                {activeCategory === category && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                )}
              </button>
            ))}

            {activeCategory === "ESL Etiketleri" && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 shrink-0 px-6 py-3.5 bg-card border border-border/40 rounded-2xl text-[15px] font-bold hover:bg-muted transition-colors ml-auto shadow-sm"
              >
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <span>Filtreler</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          {activeCategory === "ESL Etiketleri" && showFilters && (
            <div className="w-full lg:w-64 shrink-0 space-y-6 bg-card/50 border border-border rounded-xl p-5 h-fit animate-in slide-in-from-left-4">
              {/* Seri */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
                  Seri
                </h4>
                <div className="space-y-2">
                  {CATEGORY_SERIES["ESL Etiketleri"].filter((s) => s !== "Tümü").map((seriesName) => (
                    <label key={seriesName} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border bg-background text-primary"
                        checked={filterSeries.includes(seriesName)}
                        onChange={() => toggleArrayFilter(filterSeries, setFilterSeries, seriesName)}
                      />
                      <span className="text-sm">{seriesName}</span>
                    </label>
                  ))}
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Teknoloji */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
                  Teknoloji
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-border bg-background text-primary"
                      checked={filterTech.includes("Bluetooth")}
                      onChange={() =>
                        toggleArrayFilter(
                          filterTech,
                          setFilterTech,
                          "Bluetooth",
                        )
                      }
                    />
                    <span className="text-sm flex items-center gap-2">
                      <Bluetooth className="w-4 h-4 text-blue-400" /> Bluetooth
                      5.0
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-border bg-background text-primary"
                      checked={filterTech.includes("NFC")}
                      onChange={() =>
                        toggleArrayFilter(filterTech, setFilterTech, "NFC")
                      }
                    />
                    <span className="text-sm flex items-center gap-2">
                      <Nfc className="w-4 h-4 text-indigo-400" /> NFC İletişimi
                    </span>
                  </label>
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Ekran Boyutu */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
                  Ekran Boyutu (İnç)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() =>
                        toggleArrayFilter(filterSize, setFilterSize, size)
                      }
                      className={`px-2 py-1 border rounded text-xs font-medium transition-colors ${filterSize.includes(size) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-foreground/30"}`}
                    >
                      {size}"
                    </button>
                  ))}
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Renk Seçenekleri */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
                  Renk Kapasitesi
                </h4>
                <div className="space-y-2">
                  {[3, 4, 6, 7].map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border bg-background text-primary"
                        checked={filterColor.includes(c)}
                        onChange={() =>
                          toggleArrayFilter(filterColor, setFilterColor, c)
                        }
                      />
                      <span className="text-sm">
                        {c === 7
                          ? "Rainbow (7+ Renk)"
                          : c === 3
                            ? "3 Renkli (Siyah/Beyaz/Kırmızı)"
                            : `${c} Renkli E-Ink`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Dayanıklılık */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
                  Özel Ortam
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-border bg-background text-primary"
                      checked={filterCold}
                      onChange={(e) => setFilterCold(e.target.checked)}
                    />
                    <Snowflake className="w-4 h-4 text-blue-300" /> Soğuk Alan
                    (-25°C)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-border bg-background text-primary"
                      checked={filterWater}
                      onChange={(e) => setFilterWater(e.target.checked)}
                    />
                    <Droplets className="w-4 h-4 text-cyan-400" /> Su Geçirmez
                    (IP67)
                  </label>
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Fiyat Slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Maks. Kiralama
                  </h4>
                  <span className="text-xs font-bold text-indigo-400">
                    €{maxRentPrice.toFixed(2)}/ay
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={maxRentPrice}
                  onChange={(e) => setMaxRentPrice(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          )}

          {/* Sunmi-Style Vertical Series Stacks */}
          <div className="flex-1 flex flex-col gap-24">
            {filteredHardware.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <SlidersHorizontal className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Sonuç Bulunamadı
                </h3>
                <p className="text-muted-foreground mt-1 max-w-sm">
                  Seçtiğiniz filtrelere uygun bir donanım modeli bulunmuyor.
                  Filtreleri esneterek tekrar deneyin.
                </p>
                <button
                  onClick={() => {
                    setFilterSeries([]);
                    setFilterSize([]);
                    setFilterTech([]);
                    setFilterColor([]);
                    setFilterCold(false);
                    setFilterWater(false);
                    setMaxRentPrice(10);
                  }}
                  className="mt-6 px-4 py-2 bg-primary/10 text-primary rounded-lg font-medium hover:bg-primary/20 transition-colors"
                >
                  Filtreleri Temizle
                </button>
              </div>
            )}

            {(activeCategory === "Tüm Ekosistem" 
              ? Object.entries(CATEGORY_SERIES).flatMap(([cat, seriesList]) => 
                  seriesList.map(series => ({ category: cat, series }))
                )
              : (CATEGORY_SERIES[activeCategory as keyof typeof CATEGORY_SERIES] || ["Diğer"]).map(series => ({ category: activeCategory, series }))
            )
              .filter((item) => item.series !== "Tümü")
              .map(({ category, series: seriesName }) => {
                const seriesProducts = filteredHardware.filter(
                  (p) => p.category === category && (p.series === seriesName || (!p.series && seriesName === "Diğer"))
                );

                if (seriesProducts.length === 0) return null;

                return (
                  <div key={`${category}-${seriesName}`} className="animate-in slide-in-from-bottom-8 duration-500">
                    {/* Series Header */}
                    <div className="mb-8">
                      {activeCategory === "Tüm Ekosistem" && (
                        <span className="text-sm font-bold text-indigo-500 tracking-widest uppercase mb-2 block">{category}</span>
                      )}
                      <h3 className="text-4xl md:text-5xl font-black text-foreground tracking-tight mb-3">
                        {seriesName}
                      </h3>
                      <p className="text-lg text-muted-foreground max-w-2xl">
                        {seriesName.includes("T-Serisi") || seriesName.includes("T Series")
                          ? "LOKMA DaaS ile işletmeniz için ödüllü yüksek performanslı akıllı masaüstü terminal ailesi."
                          : seriesName.includes("D-Serisi") || seriesName.includes("D Series")
                            ? "Kompakt tasarım, tavizsiz güç. Günlük operasyonlarınızın tüm ihtiyaçlarını karşılamak için tasarlandı."
                            : seriesName.includes("V-Serisi") || seriesName.includes("V Series")
                              ? "Mobil sipariş, ödeme ve kurye yönetimi için kusursuz bağlantıya sahip hepsi bir arada cihazlar."
                              : seriesName.includes("P-Serisi") || seriesName.includes("P Series")
                                ? "LOKMA ödeme altyapısı ile tam entegre, her masada kolay ödeme almanızı sağlayan akıllı terminaller."
                                : seriesName.includes("M-Serisi")
                                  ? "Kurumsal gücü önünüze seren ultra dayanıklı el terminalleri."
                                  : `${seriesName} donanım çözümleriyle operasyonunuzu bir üst seviyeye taşıyın.`}
                      </p>
                    </div>

                    {/* Series Product Grid */}
                    <div
                      className={`grid gap-6 ${
                        activeCategory === "ESL Etiketleri" && showFilters
                          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
                          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                      }`}
                    >
                      {seriesProducts.map((product) => {
                        const currentSelection = hardwareCart[product.id];

                        return (
                          <div
                            key={product.id}
                            className="bg-muted/30 border border-border/50 rounded-2xl hover:border-primary/30 transition-all flex flex-col overflow-hidden group hover:shadow-xl hover:shadow-black/5"
                          >
                            {/* Ürün Görseli (Uniform Canvas Style) */}
                            <div
                              className="p-4 bg-transparent flex items-center justify-center h-[260px] cursor-pointer relative"
                              onClick={() => {
                                setSelectedProductDetail(product);
                                setActiveModalImage(null);
                              }}
                            >
                              <div className="w-full h-full bg-white rounded-xl flex items-center justify-center p-6 relative overflow-hidden border border-slate-100/10">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply"
                                  />
                                ) : (
                                  <div className="group-hover:scale-110 transition-transform duration-300 text-slate-800">
                                    {product.icon}
                                  </div>
                                )}
                              </div>
                              
                              {/* New Badge (Sunmi Style) */}
                              {product.specs && product.specs.length > 0 && (
                                <div className="absolute top-4 right-4 bg-orange-500/10 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                  New
                                </div>
                              )}

                              {/* Spec Badges */}
                              {product.filters?.cold && (
                                <div className="absolute top-4 left-4 bg-blue-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                  <Snowflake className="w-3 h-3" /> Soğuk
                                </div>
                              )}
                              {product.filters?.water && (
                                <div className="absolute top-4 left-4 bg-cyan-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                  <Droplets className="w-3 h-3" /> IP67
                                </div>
                              )}
                            </div>

                            {/* Ürün Detayları */}
                            <div className="p-6 flex-1 flex flex-col bg-card/50">
                              <div
                                className="cursor-pointer group/desc text-center mb-6"
                                onClick={() => {
                                  setSelectedProductDetail(product);
                                  setActiveModalImage(null);
                                }}
                              >
                                <h4 className="font-bold text-foreground text-xl leading-tight group-hover/desc:text-primary transition-colors">
                                  {product.name}
                                </h4>
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                  {product.description}
                                </p>
                              </div>

                              <div className="mt-auto pt-4 border-t border-border/50">
                                <div className="flex flex-col gap-1 mb-4 text-center">
                                  {currentSelection?.mode === "installment" ? (
                                    <span className="text-sm text-amber-500 font-bold">
                                      €{getInstallmentPrice(product.price, currentSelection.duration as 24 | 36).toFixed(2)}
                                      <span className="text-muted-foreground text-xs font-normal"> /ay ({currentSelection.duration} Ay)</span>
                                    </span>
                                  ) : (
                                    <>
                                      <span className="text-sm font-bold text-foreground">
                                        €{product.price.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">Satın Al</span>
                                      </span>
                                      <span className="text-sm font-bold text-indigo-500">
                                        €{getRentPrice(product.rentPrice, (currentSelection?.duration || 12) as 6 | 12 | 24).toFixed(2)}
                                        <span className="text-xs font-normal text-muted-foreground"> /ay Kiralama</span>
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Cart Controls */}
                                <div className="flex flex-col gap-3 w-full">
                                  <select
                                    className="bg-background border border-input rounded-xl px-3 py-2.5 text-sm w-full focus:ring-2 focus:ring-primary/50 font-medium"
                                    value={currentSelection?.mode || "rent"}
                                    onChange={(e) => {
                                      const newMode = e.target.value as "rent" | "buy" | "installment";
                                      let newDuration = currentSelection?.duration || 12;
                                      if (newMode === "installment") newDuration = 24;
                                      else if (newMode === "rent" && newDuration === 24) newDuration = 12;
                                      handleUpdateCart(product.id, currentSelection?.quantity || 1, newMode, newDuration);
                                    }}
                                  >
                                    <option value="rent">Kiralama Modeli</option>
                                    <option value="buy">Satın Alma Modeli</option>
                                    {product.category === "ESL Etiketleri" && (
                                      <option value="installment">Taksit ile Ödeme</option>
                                    )}
                                  </select>

                                  {(!currentSelection || currentSelection.mode === "rent" || currentSelection.mode === "installment") && (
                                    <select
                                      className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium w-full focus:ring-2 focus:ring-indigo-500/50"
                                      value={currentSelection?.duration || (currentSelection?.mode === "installment" ? 24 : 12)}
                                      onChange={(e) =>
                                        handleUpdateCart(product.id, currentSelection?.quantity || 1, currentSelection?.mode || "rent", parseInt(e.target.value) as 6 | 12 | 24 | 36)
                                      }
                                    >
                                      {currentSelection?.mode !== "installment" && (
                                        <>
                                          <option value={6}>6 Ay Taahhütlü (€{getRentPrice(product.rentPrice, 6).toFixed(2)}/ay)</option>
                                          <option value={12}>12 Ay Taahhütlü (€{getRentPrice(product.rentPrice, 12).toFixed(2)}/ay)</option>
                                          {product.category !== "ESL Etiketleri" && (
                                            <option value={24}>24 Ay Taahhütlü (€{getRentPrice(product.rentPrice, 24).toFixed(2)}/ay)</option>
                                          )}
                                        </>
                                      )}
                                      {currentSelection?.mode === "installment" && (
                                        <>
                                          <option value={24}>24 Ay Taksit (€{getInstallmentPrice(product.price, 24).toFixed(2)}/ay)</option>
                                          <option value={36}>36 Ay Taksit (€{getInstallmentPrice(product.price, 36).toFixed(2)}/ay)</option>
                                        </>
                                      )}
                                    </select>
                                  )}

                                  <div className="flex items-center gap-3 bg-muted/50 border border-border/50 p-1 rounded-xl mt-1">
                                    <button
                                      onClick={() => handleUpdateCart(product.id, (currentSelection?.quantity || 0) - 1, currentSelection?.mode || "rent", currentSelection?.duration || 12)}
                                      className="w-10 h-10 rounded-lg bg-background shadow-sm flex items-center justify-center hover:bg-muted transition-colors font-bold"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      className="flex-1 text-center font-bold text-foreground text-lg bg-transparent border-none focus:outline-none w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none m-0 p-0"
                                      value={currentSelection?.quantity || 0}
                                      onChange={(e) => handleUpdateCart(product.id, parseInt(e.target.value) || 0, currentSelection?.mode || "rent", currentSelection?.duration || 12)}
                                    />
                                    <button
                                      onClick={() => handleUpdateCart(product.id, (currentSelection?.quantity || 0) + 1, currentSelection?.mode || "rent", currentSelection?.duration || 12)}
                                      className="w-10 h-10 rounded-lg bg-primary text-primary-foreground shadow-sm flex items-center justify-center hover:bg-primary/90 transition-colors font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Cart Bar */}
      {Object.keys(hardwareCart).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 pointer-events-none fade-in slide-in-from-bottom-10 animate-in duration-300">
          <div className="max-w-5xl mx-auto flex justify-center">
            <div className="bg-card/95 backdrop-blur-md border border-border shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-6 pointer-events-auto w-full">
              <div className="flex-1 flex items-center gap-4 w-full">
                <div className="w-14 h-14 bg-indigo-500/20 rounded-full flex shrink-0 items-center justify-center relative">
                  <ShoppingCart className="w-7 h-7 text-indigo-400" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-card">
                    {Object.values(hardwareCart).reduce(
                      (a, b) => a + b.quantity,
                      0,
                    )}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg hidden sm:block">
                    Sipariş Özeti
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-1">
                    {totalBuy > 0 && (
                      <span className="text-muted-foreground whitespace-nowrap">
                        Satın Alma:{" "}
                        <span className="font-bold text-white text-base">
                          €{totalBuy.toFixed(2)}
                        </span>
                      </span>
                    )}
                    {totalRent > 0 && (
                      <span className="text-indigo-300 whitespace-nowrap">
                        Kira / Taksit:{" "}
                        <span className="font-bold text-base">
                          €{totalRent.toFixed(2)}
                        </span>{" "}
                        /ay
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 w-full sm:w-auto">
                <button
                  onClick={handleRequestSubmit}
                  disabled={submitting}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Talebi Tamamla{" "}
                      <span className="ml-1 text-green-200">→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Immersive Product Detail Page Takeover */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-[110] bg-background overflow-y-auto overflow-x-hidden flex flex-col hide-scrollbar animate-in slide-in-from-bottom-10 duration-500">
          {/* Navigation Bar */}
          <div className="sticky top-0 w-full bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-4 flex items-center justify-between z-50">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedProductDetail(null);
                  setActiveModalImage(null);
                }}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <div className="text-xs text-primary font-bold tracking-wider uppercase">
                  {selectedProductDetail.category}
                </div>
                <div className="font-bold text-foreground">
                  {selectedProductDetail.name}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-xl font-bold text-foreground">
                  €{selectedProductDetail.price.toFixed(2)}
                </div>
                {selectedProductDetail.rentPrice > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t("rentOr", {
                      price: `€${selectedProductDetail.rentPrice.toFixed(2)}`,
                    })}
                  </div>
                )}
              </div>
              <button
                className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold hover:scale-105 transition-transform"
                onClick={() => {
                  setSelectedProductDetail(null);
                  setActiveModalImage(null);
                }}
              >
                Geri Dön
              </button>
            </div>
          </div>

          {/* Sunmi-Style Hero Section */}
          <div className="relative w-full min-h-[85vh] bg-black text-white flex flex-col items-center justify-start pt-20 md:pt-32 pb-0 overflow-hidden">
            <div className="relative z-20 text-center max-w-5xl mx-auto mb-12 px-4 animate-in slide-in-from-bottom-5 duration-1000 fill-mode-both">
              <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-6 bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent drop-shadow-sm">
                {selectedProductDetail.name}
              </h1>
              <p className="text-xl md:text-3xl font-light text-white/80 leading-relaxed max-w-3xl mx-auto mb-10 tracking-tight">
                {selectedProductDetail.description}
              </p>


            </div>

            <div className="relative z-10 w-full flex-1 flex justify-center items-end px-4 md:px-0 animate-in slide-in-from-bottom-20 duration-1000 delay-200 fill-mode-both mt-auto">
              {(selectedProductDetail as any).video && !activeModalImage ? (
                <div className="w-full max-w-6xl rounded-t-[3rem] overflow-hidden border-t border-l border-r border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                  <video
                    src={(selectedProductDetail as any).video}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative w-full flex justify-center items-end max-w-6xl group translate-y-6">
                  {selectedProductDetail.images && selectedProductDetail.images.length > 1 && (
                    <button
                      className="absolute left-2 md:-left-12 bottom-1/3 z-30 bg-black/40 hover:bg-black/60 text-white rounded-full p-4 backdrop-blur-xl transition-all opacity-0 group-hover:opacity-100 border border-white/20 shadow-2xl hover:scale-110"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentImg = activeModalImage || selectedProductDetail.image;
                        const currentIndex = Math.max(0, selectedProductDetail.images.indexOf(currentImg));
                        const prevIndex = currentIndex <= 0 ? selectedProductDetail.images.length - 1 : currentIndex - 1;
                        setActiveModalImage(selectedProductDetail.images[prevIndex]);
                      }}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}

                  {selectedProductDetail.category === "ESL Etiketleri" ? (
                    <div className="bg-white rounded-t-[2rem] md:rounded-t-[3rem] px-8 md:px-16 pt-12 pb-12 max-w-3xl w-full flex justify-center shadow-[0_-20px_50px_rgba(255,255,255,0.1)] relative cursor-pointer group/img"
                         onClick={() => setLightboxData({ 
                           images: selectedProductDetail.images || [selectedProductDetail.image], 
                           index: Math.max(0, (selectedProductDetail.images || []).indexOf(activeModalImage || selectedProductDetail.image))
                         })}
                    >
                      <img
                        src={activeModalImage || selectedProductDetail.image}
                        alt={selectedProductDetail.name}
                        className="max-w-full md:max-w-[400px] w-full object-contain transition-transform duration-500 group-hover/img:scale-105"
                      />
                    </div>
                  ) : (
                    <img
                      src={activeModalImage || selectedProductDetail.image}
                      alt={selectedProductDetail.name}
                      className="max-w-[900px] w-full object-contain drop-shadow-[0_-20px_50px_rgba(255,255,255,0.1)] cursor-pointer transition-transform duration-500 hover:scale-105"
                      onClick={() => setLightboxData({ 
                        images: selectedProductDetail.images || [selectedProductDetail.image], 
                        index: Math.max(0, (selectedProductDetail.images || []).indexOf(activeModalImage || selectedProductDetail.image))
                      })}
                    />
                  )}

                  {selectedProductDetail.images && selectedProductDetail.images.length > 1 && (
                    <button
                      className="absolute right-2 md:-right-12 bottom-1/3 z-30 bg-black/40 hover:bg-black/60 text-white rounded-full p-4 backdrop-blur-xl transition-all opacity-0 group-hover:opacity-100 border border-white/20 shadow-2xl hover:scale-110"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentImg = activeModalImage || selectedProductDetail.image;
                        const currentIndex = Math.max(0, selectedProductDetail.images.indexOf(currentImg));
                        const nextIndex = (currentIndex + 1) % selectedProductDetail.images.length;
                        setActiveModalImage(selectedProductDetail.images[nextIndex]);
                      }}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {(() => {
            // Dinamik Pazarlama Metinleri
            let interludeTitle = "";
            let interludeDesc = "";
            let marketingPoints = [];

            const productName = selectedProductDetail.name;
            const productCategory = selectedProductDetail.category;

            // KASA SİSTEMLERİ
            if (productName.includes("T3 PRO MAX")) {
              interludeTitle = "Tezgahın tartışılmaz lideri.";
              interludeDesc = `Çift ekranlı mimarisi ve entegre yazıcısıyla ${productName}, yüksek hacimli restoranların tüm operasyonel yükünü tek başına omuzlar. LOKMA'nın merkez üssü.`;
              marketingPoints = [
                { title: "Çift Yönlü İletişim.", subtitle: "Müşteriyle şeffaf bağ.", desc: "Kasiyer ana ekranda siparişi işlerken, yüksek çözünürlüklü ikinci ekran müşteriye fişi, QR ödeme kodunu ve güncel kampanyaları sunar.", bg: "bg-background" },
                { title: "Seiko Baskı Gücü.", subtitle: "Asla duraksamaz.", desc: "Entegre yüksek hızlı Seiko termal yazıcı ile fişleri anında kesin. Yoğun kuyruklarda saniyeler kazanın.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Sınır Tanımayan Performans.", subtitle: "Amiral gemisi.", desc: "Qualcomm sekiz çekirdekli işlemci sayesinde en yoğun saatlerde bile menüler arası geçiş, ödeme alma ve mutfak entegrasyonu sıfır gecikmeyle çalışır.", bg: "bg-background" },
                { title: "Alüminyum Zarafet.", subtitle: "Mekana değer katar.", desc: "İnce çerçeveli tasarım ve gizli kablo yönetimi ile tezgahınızda oluşan karmaşaya son verin.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            } else if (productName.includes("T3 PRO")) {
              interludeTitle = "Profesyonellerin seçimi.";
              interludeDesc = `Hızın ve dayanıklılığın mükemmel uyumu. ${productName}, LOKMA POS altyapısı ile siparişlerinizi milisaniyeler içinde mutfağa uçurur.`;
              marketingPoints = [
                { title: "Yüksek Kapasiteli Bellek.", subtitle: "Çoklu görev ustası.", desc: "Aynı anda hem online siparişleri yönetin hem de salon müşterilerinize hizmet verin. Cihaz asla yavaşlamaz.", bg: "bg-background" },
                { title: "Dayanıklı Metal Gövde.", subtitle: "Endüstri standartlarında.", desc: "Restoranın zorlu ve dinamik ortamına dayanacak şekilde alüminyum alaşımla güçlendirilmiş yapı.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Esnek Bağlantı.", subtitle: "Her cihaza uyumlu.", desc: "Çok sayıda port ve gelişmiş kablosuz bağlantı seçenekleri ile yazar kasa, tartı veya barkod okuyucularınızı anında entegre edin.", bg: "bg-background" },
                { title: "Geleceğe Hazır.", subtitle: "Yatırımınızı koruyun.", desc: "Android 13 işletim sistemi ve güçlü işlemcisiyle, LOKMA'nın yıllar sonraki güncellemelerini bile sorunsuz çalıştıracak donanım garantisi.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            } else if (productName.includes("D3 PRO")) {
              interludeTitle = "Kompakt tasarım, amansız güç.";
              interludeDesc = `Dar tezgahlar için devrim niteliğinde. ${productName}, zarif alüminyum gövdesinin altında zorlu mutfak şartlarına meydan okuyan bir performans barındırır.`;
              marketingPoints = [
                { title: "Ultra İnce Ekran.", subtitle: "Alanı geri kazanın.", desc: "İncecik ekran profili sayesinde kasanızın etrafında çalışmak hiç olmadığı kadar ferah ve kolay.", bg: "bg-background" },
                { title: "Dokunmatik Hassasiyeti.", subtitle: "Islak ellerle bile.", desc: "Sıvı dökülmelerine veya mutfağın zorlu şartlarına rağmen dokunmatik algılayıcılar anında tepki verir.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Estetik Devrimi.", subtitle: "Red Dot Ödüllü.", desc: "Müşterilerinizin gözünü alacak endüstriyel tasarım. Mekanınızın modern kimliğine kusursuz uyum sağlar.", bg: "bg-background" },
                { title: "Durdurulamaz Donanım.", subtitle: "İşletmenizin kalbi.", desc: "Küçük boyutuna aldanmayın. LOKMA altyapısıyla entegre tüm yükü taşıyacak bir masaüstü işlemci barındırır.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            }
            // MOBİL TERMİNALLER VE KİOSKLAR
            else if (productName.includes("FLEX 3")) {
              interludeTitle = "Sınırsız Esneklik. Sınırsız Olanaklar.";
              interludeDesc = `${productName}, tek cihazla Self-Checkout, KDS (Mutfak Ekranı) veya Kiosk özelliklerini restoranınızda istediğiniz noktaya taşımanızı sağlar. Tak-çalıştır modüllerle dilediğiniz gibi özelleştirin.`;
              marketingPoints = [
                { title: "Kusursuz İnce Tasarım.", subtitle: "Sadece 17mm Profil.", desc: "15° ile 80° arasında ayarlanabilir eğim açısı ve ultra ince 16mm alüminyum çerçevesiyle restoranınızın estetiğini bozmadan duvar, masa veya ayaklı stantlara entegre olur.", bg: "bg-background" },
                { title: "Dayanıklı ve Su Geçirmez.", subtitle: "IP54 Güvenlik Sınıfı.", desc: "Su ve toz sıçramalarına karşı tam koruma. LOKMA'nın zorlu mutfak koşullarında veya yoğun müşteri trafiğinde bile kesintisiz ve güvenli çalışma garantisi sunar.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Sınırsız Yapay Zeka Gücü.", subtitle: "13 TOPS NPU İşlemci.", desc: "Qualcomm sekiz çekirdekli işlemci ve dahili NPU ile yüz tanıma, yaş doğrulama ve akıllı kamera sistemleri için saniyede 13 Trilyon işlem kapasitesi sunar.", bg: "bg-background" },
                { title: "Göz Alıcı IPS Ekran.", subtitle: "18.5\" | 22\" | 27\" Boyut.", desc: "Parlamayı önleyen, parmak izi bırakmayan 400 nits parlaklığındaki Full HD kapasitif dokunmatik IPS ekran ile müşterileriniz LOKMA menüsünü her açıdan kusursuz görür.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Tak ve Çalıştır Modüller.", subtitle: "Maksimum Özelleştirme.", desc: "NFC, MSR, 2D Barkod Okuyucu ve 3D Kamera gibi tak-çalıştır aksesuarlarla donanımı saniyeler içinde Self-Checkout kiosku veya müşteri bilgi ekranına dönüştürün.", bg: "bg-background" },
                { title: "Gizli Kablo Yönetimi.", subtitle: "Temiz ve Şık Görünüm.", desc: "Özel tasarım kablo kanalları ve bağlantı yuvaları sayesinde güç ve ağ kabloları tamamen gizlenir. Müşterilerinize sadece kusursuz bir ekran deneyimi sunulur.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Biyometrik Güvenlik.", subtitle: "Parmak İzi ile Güç Düğmesi.", desc: "Güç tuşuna entegre edilmiş parmak izi okuyucu ile yetkisiz erişimleri engelleyin. Kasiyer ve yöneticileriniz tek dokunuşla sisteme güvenli şekilde giriş yapsın.", bg: "bg-background" },
                { title: "Geleceğe Hazır Bağlantı.", subtitle: "Wi-Fi 6 & Bluetooth 5.2.", desc: "En yeni nesil Wi-Fi 6 teknolojisi ile kesintisiz sipariş akışı ve bulut senkronizasyonu. Gigabit Ethernet ve POE desteği ile esnek kurulum seçenekleri.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            }
            else if (productName.includes("V3 MIX")) {
              interludeTitle = "Hibrit gücün yükselişi.";
              interludeDesc = `O hem bir masaüstü kasa, hem de mobil bir sipariş terminali. ${productName}, işletmenizin sınırlarını kaldırarak tüm kontrolü elinize verir.`;
              marketingPoints = [
                { title: "Döndürülebilir Ekran.", subtitle: "Müşteriye doğru çevirin.", desc: "Ekranı 180 derece döndürerek müşterinizin siparişi onaylamasını veya QR kod ile anında ödeme yapmasını sağlayın.", bg: "bg-background" },
                { title: "Seyyar Özgürlük.", subtitle: "Cihazı yerinden sökün.", desc: "Standından kolayca ayırıp masalara gidin. Siparişi alın, ödemeyi çekin ve mutfağa anında iletin.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Entegre Rulo Yazıcı.", subtitle: "Fişler anında elinizde.", desc: "Nereye giderseniz gidin, 58mm termal fiş yazıcısı sizinle beraber. Ekstra donanıma ihtiyaç yok.", bg: "bg-background" },
                { title: "Gün Boyu Pil.", subtitle: "Şarj standı ile kusursuz.", desc: "Masalar arası geçişlerde kendi pilini kullanırken, kasaya oturtulduğunda anında şarj olmaya başlar.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            } else if (productCategory === 'Mobil POS & El Terminalleri') {
              interludeTitle = "Masalara hükmedin.";
              interludeDesc = `Siparişi masada alın, ödemeyi kapıda alın. ${productName}, hafif yapısı ve sağlam kasasıyla kuryelerinizin ve garsonlarınızın en yakın dostu olacak.`;
              marketingPoints = [
                { title: "Avuç İçi Performans.", subtitle: "Hafif ama çok güçlü.", desc: "Sürekli ayakta çalışan personeliniz için tasarlandı. Tek elle rahatça kullanılabilen, gün boyu yormayan 17mm ultra ince ve ergonomik yapı.", bg: "bg-background" },
                { title: "Düşmelere Dayanıklı.", subtitle: "Endüstriyel zırh.", desc: "Restoranın kaotik ortamına uygun, beton zemine 1.2 metreden düşmelere karşı özel olarak sertleştirilmiş polikarbon gövde tasarımı.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Güçlü Batarya.", subtitle: "Vardiyayı çıkarır.", desc: "Gelişmiş pil yönetimi ve 3500mAh yüksek kapasiteli bataryası sayesinde tek şarjla tüm vardiyayı çıkarın. İşin en yoğun anında priz arama derdine son.", bg: "bg-background" },
                { title: "Yüksek Hızlı Tarayıcı.", subtitle: "Saniyeler içinde okur.", desc: "Karanlık ortamlarda bile barkodları ve QR kodları milisaniyeler içinde okuyan entegre donanımsal okuyucu modülü ile hızlı servis.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Yıldırım Hızında Yazıcı.", subtitle: "Saniyede 80mm baskı.", desc: "Dahili yüksek hızlı termal yazıcısı ile müşterinizin yanında saniyeler içerisinde fişinizi veya mutfak bilgi fişinizi yazdırın. Kağıt sıkışmasını önleyen özel tasarım.", bg: "bg-background" },
                { title: "Kesintisiz İletişim.", subtitle: "4G LTE & Wi-Fi.", desc: "Çift bant Wi-Fi (2.4G/5G) ve 4G LTE desteğiyle hem restoranınızın en kör noktasında hem de paket servis esnasında yolda kesintisiz bağlantı.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Gürültüye Meydan Oku.", subtitle: "Güçlendirilmiş Hoparlör.", desc: "Mutfak gibi gürültülü ortamlarda bile LOKMA'dan gelen yeni sipariş veya bildirim seslerini asla kaçırmamanız için 3W gücünde özel hoparlör.", bg: "bg-background" },
                { title: "Kusursuz Görüntü.", subtitle: "5.5\" IPS HD+ Ekran.", desc: "Güneş altında veya loş ışıkta parlamayı engelleyen, parmak izi bırakmayan çoklu dokunmatik ekran ile LOKMA arayüzünde hızlı ve pürüzsüz geçişler.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            }
            // MÜŞTERİ EKRANLARI & TERAZİLER
            else if (productCategory === 'KDS & Müşteri Ekranları') {
              interludeTitle = "Siparişlerin şeffaf yüzü.";
              interludeDesc = `Müşterilerinize ne yediklerini ve ne kadar ödeyeceklerini gösterin. ${productName} ile güven inşa edin ve reklam alanınızı genişletin.`;
              marketingPoints = [
                { title: "Anında Doğrulama.", subtitle: "Hataları sıfıra indirin.", desc: "LOKMA kasasına girilen her ürün anında bu ekranda belirir. Müşteri kendi siparişini canlı takip ederek doğrulayabilir.", bg: "bg-background" },
                { title: "Dijital Reklam Panosu.", subtitle: "Boş zamanı kazanca çevirin.", desc: "Kasa boşta kaldığında otomatik olarak LOKMA'ya yüklediğiniz afiş ve kampanyaları yüksek çözünürlükte oynatmaya başlar.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Temassız QR Ödeme.", subtitle: "Telefonu okut, çık.", desc: "Müşterinin ödeme yapmak için kart uzatmasına gerek kalmaz. Ekranda beliren dinamik QR kod üzerinden saniyeler içinde hesap kapanır.", bg: "bg-background" },
                { title: "Kompakt Alan Tasarrufu.", subtitle: "Tezgahı işgal etmez.", desc: "Bağımsız ve zarif standı sayesinde kasa yanında minimum yer kaplayarak tezgahınızda size çalışma alanı bırakır.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            } else if (productCategory === 'Akıllı Tartım') {
              interludeTitle = "Milisaniyelik hassasiyet.";
              interludeDesc = `Gramı gramına doğru. ${productName}, tartım işlemlerini manuel süreçlerden çıkarıp doğrudan LOKMA sepetinize dijital olarak bağlar.`;
              marketingPoints = [
                { title: "Akıllı LOKMA Tartım.", subtitle: "Tek tuşla sepette.", desc: "Ürünü teraziye koyduğunuz an tartı ağırlığı LOKMA Cloud ile anında senkronize olur. Manuel hesap makinesi kullanmaya son.", bg: "bg-background" },
                { title: "Suya ve Toza Dirençli.", subtitle: "Kasap ve Manavlar için.", desc: "Islak ve yoğun çalışma ortamlarına özel olarak tasarlanmış, su sıçramalarına dayanıklı yalıtımlı yapı.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Çift Yönlü Gösterge.", subtitle: "Şeffaf alışveriş.", desc: "Hem müşterinin hem de personelin tartım sonucunu net şekilde görebileceği ışıklı yüksek kontrastlı paneller.", bg: "bg-background" },
                { title: "Yüksek Doğruluk.", subtitle: "Hatasız hesaplama.", desc: "Hassas sensörler sayesinde en ufak gramajları bile keskin bir şekilde ölçün, dara düşme işlemlerini otomatik yapın.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            }
            // ESL ETİKETLERİ
            else if (productCategory === 'ESL Etiketleri') {
              interludeTitle = "Dijital fiyat devrimi.";
              interludeDesc = `Fiyatları tek tıkla tüm raflarınızda güncelleyin. ${productName} ile kağıt israfına, reyon hatalarına ve saatlerce süren etiket mesailerine son verin.`;
              marketingPoints = [
                { title: "Sonsuz Senkronizasyon.", subtitle: "Merkezden yönetin.", desc: "LOKMA Admin portalından veya mobil uygulamasından yaptığınız tek bir fiyat değişikliği, saniyeler içinde mağazadaki ilgili tüm etiketlere anında yansır.", bg: "bg-background" },
                { title: "Yıllarca Süren Pil Ömrü.", subtitle: "Enerjiyi dondurur.", desc: "Elektronik mürekkep (E-Ink) teknolojisi sayesinde etiketler sadece fiyat değiştiği anda enerji harcar. Bu sayede pilleri yıllarca hiç değiştirmeden çalışır.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Göz Alıcı Renkler.", subtitle: "Kampanyaları öne çıkarın.", desc: "Özel seri renkli mürekkep teknolojisi ile indirimli ürünlerde kırmızı, sarı gibi fosforlu renkleri kullanarak müşterinin dikkatini doğrudan o rafa çekin.", bg: "bg-background" },
                { title: "Kurumsal Estetik.", subtitle: "Marketin kalitesini artırın.", desc: "Yamuk, yırtık veya sararmış kağıt etiketlerden kurtulun. Şık, okunabilir ve modern dijital ekranlarla reyonlarınıza premium bir his katın.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            } else {
              // YEDEK/FALLBACK
              interludeTitle = "Yüksek LOKMA Performansı.";
              interludeDesc = `${productName}, işletmenizdeki teknik altyapıyı güçlendirmek ve LOKMA ekosistemiyle kusursuz çalışmak üzere test edildi ve onaylandı.`;
              marketingPoints = [
                { title: "Sorunsuz Entegrasyon.", subtitle: "Tak ve çalıştır.", desc: "Kurulumu ve LOKMA sistemine tanıtılması saniyeler alır. Hemen işinize kaldığınız yerden devam edebilirsiniz.", bg: "bg-background" },
                { title: "Kararlı Çalışma.", subtitle: "İşiniz durmaz.", desc: "Restoran ve mağaza operasyonlarının doğasına uygun şekilde ağır şartlarda test edilmiş dayanıklı materyaller.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" },
                { title: "Gelişmiş Teknolojik Zemin.", subtitle: "Geleceğe uyar.", desc: "Modern haberleşme protokolleri sayesinde güncellemeleri anında alır ve hep en güncel versiyonda kalır.", bg: "bg-background" },
                { title: "Maksimum Verimlilik.", subtitle: "Zaman kazandırır.", desc: "Manuel operasyonlarınızı dijitalleştirerek personelinizin iş yükünü hafifletir, hatasız işlem yapmanızı sağlar.", bg: "bg-[#f5f5f7] dark:bg-[#1d1d1f]" }
              ];
            }

            return (
              <>
                {/* Premium Interlude */}
                <div className="w-full bg-[#f5f5f7] dark:bg-[#1d1d1f] py-24 md:py-32">
                  <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight mb-8">
                      {interludeTitle}
                    </h2>
                    <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-medium">
                      {interludeDesc}
                    </p>
                  </div>
                </div>

                {/* Immersive Feature Blocks */}
                {(selectedProductDetail.images && selectedProductDetail.images.length > 1) && (
                  <div className="w-full bg-background flex flex-col">
                    {marketingPoints.map((point: any, idx: number) => {
                      const filteredImages = selectedProductDetail.images
                        .filter((img: string) => !img.includes('/xs/'))
                        .slice((selectedProductDetail as any).video ? 0 : 1);
                        
                      const img = filteredImages[idx % filteredImages.length];
                      const isEven = idx % 2 === 0;

                      return (
                        <div key={idx} className={`w-full py-24 md:py-40 ${point.bg}`}>
                          <div className={`max-w-7xl mx-auto px-6 flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-16 lg:gap-24`}>
                            <div className="w-full lg:w-1/2 space-y-6 text-center lg:text-left">
                              <h4 className="text-lg md:text-xl font-bold text-primary tracking-widest uppercase">
                                {point.subtitle}
                              </h4>
                              <h3 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter leading-none" style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}>
                                {point.title}
                              </h3>
                              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mt-6">
                                {point.desc}
                              </p>
                            </div>
                            <div className="w-full lg:w-1/2 flex justify-center">
                              <img
                                src={img}
                                alt={`${selectedProductDetail.name} feature ${idx}`}
                                className="w-full max-w-[600px] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-1000"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}

          {/* Tech Specs Section - Clean Minimalist Grid */}
          <div className="w-full bg-black text-white py-32 border-t border-white/10">
            <div className="max-w-6xl mx-auto px-6">
              <div className="mb-20">
                <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                  Teknik Özellikler
                </h2>
                <div className="w-24 h-1 bg-primary rounded-full"></div>
              </div>

              {getDetailedSpecs(selectedProductDetail) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-16">
                  {Object.entries(getDetailedSpecs(selectedProductDetail)).map(
                    ([k, v], idx) => {
                      return (
                        <div key={k} className="border-t border-white/20 pt-6">
                          <h4 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-3">
                            {k}
                          </h4>
                          <p className="text-2xl font-semibold text-white leading-snug">
                            {v as string}
                          </p>
                        </div>
                      );
                    },
                  )}
                </div>
              )}

              {getDetailedSpecs(selectedProductDetail)?.["LOKMA Batarya Ömrü"] && (
                <div className="mt-24 p-8 md:p-12 bg-white/5 border border-white/10 rounded-3xl flex flex-col md:flex-row items-start md:items-center gap-8 backdrop-blur-xl">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Info className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <strong className="block mb-2 text-2xl font-bold text-white">
                      Pil Ömrü (Dayanıklılık) Hakkında Bilgi
                    </strong>
                    <p className="text-lg text-white/60 leading-relaxed">
                      ESL cihazlarında pil bittiğinde cihaz çöp olmaz veya kullanılamaz hale gelmez. Bu cihazlar standart Lityum Düğme Pil (genelde CR2450) kullanır. Pil ömrü dolduğunda kapağı açılarak pil çok düşük bir maliyetle saniyeler içinde yenilenir ve cihaz 5 yıl daha sorunsuz çalışmaya devam eder.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxData && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4 select-none"
          onClick={() => setLightboxData(null)}
        >
          <div
            className="relative max-w-5xl w-full h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white w-12 h-12 rounded-full flex items-center justify-center transition-colors z-50 backdrop-blur-md"
              onClick={() => setLightboxData(null)}
            >
              ✕
            </button>

            {lightboxData.images.length > 1 && (
              <button
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white w-12 h-12 rounded-full flex items-center justify-center transition-all z-50 backdrop-blur-md border border-white/10 hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxData({
                    ...lightboxData,
                    index:
                      (lightboxData.index - 1 + lightboxData.images.length) %
                      lightboxData.images.length,
                  });
                }}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            <img
              src={lightboxData.images[lightboxData.index]}
              alt="Büyütülmüş Görsel"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl bg-white p-4 md:p-8"
            />

            {lightboxData.images.length > 1 && (
              <button
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white w-12 h-12 rounded-full flex items-center justify-center transition-all z-50 backdrop-blur-md border border-white/10 hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxData({
                    ...lightboxData,
                    index:
                      (lightboxData.index + 1) % lightboxData.images.length,
                  });
                }}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            {lightboxData.images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-white/80 text-sm font-medium tracking-widest border border-white/10">
                {lightboxData.index + 1} / {lightboxData.images.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-card border border-border shadow-2xl rounded-2xl p-8 max-w-md w-full animate-in zoom-in-95 duration-300 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500" />
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Sipariş Alındı!
            </h2>
            <p className="text-muted-foreground mb-6">
              Donanım talebiniz başarıyla oluşturulmuştur.
            </p>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm text-green-200 mb-6 text-left">
              <strong>Kiralama süreci hakkında:</strong> Kiralama bedeli
              donanımlar elinize geçtikten sonra, sistemde kayıtlı banka
              hesabınızdan veya kredi kartınızdan tahsil edilmeye başlanacaktır.
            </div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-foreground text-background font-medium py-3 rounded-xl hover:bg-foreground/90 transition-colors"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
