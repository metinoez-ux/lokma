"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {  ShoppingCart, CheckCircle, Monitor, Smartphone, Scale, Tag, SlidersHorizontal, Snowflake, Droplets, Nfc, Bluetooth , Info } from 'lucide-react';

export default function HardwareTabContent({
  business,
  admin,
  showToast,
}: any) {
  const [hardwareCart, setHardwareCart] = useState<Record<string, { quantity: number, mode: 'rent' | 'buy' | 'installment', duration: 6 | 12 | 24 }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const categories = ['Kasa Sistemleri', 'Mobil Cihazlar', 'Tartım & Terazi', 'ESL Etiketleri', 'Sarf Malzemeleri'];
  const [activeCategory, setActiveCategory] = useState(categories[3]);
  const [activeSeries, setActiveSeries] = useState("Tümü");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<any | null>(null);

  // Filters State
  const [showFilters, setShowFilters] = useState(true);
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

  const getDetailedSpecs = (product: any) => {
    if (product.detailedSpecs) return product.detailedSpecs;
    if (product.category === 'ESL Etiketleri' && product.filters?.size) {
      const size = product.filters.size;
      return {
        productSize: size > 10 ? "272 * 196 * 14mm" : size > 5 ? "139 * 110 * 13mm" : "105 * 88 * 13mm",
        screenSize: `${size} inches`,
        productWeight: size > 10 ? "416g" : size > 5 ? "145g" : "65g",
        enduranceTime: "5 Yıl (Günde 5 güncelleme ile)",
        displayColor: product.filters.colors === 2 ? "Black / White" : product.filters.colors === 3 ? "Black / White / Red" : "Black / White / Red / Yellow",
        resolution: size > 10 ? "960 * 640" : size > 5 ? "648 * 480" : "400 * 300"
      };
    }
    return null;
  };

  const hardwareList: any[] = [
    {
      id: "kds_tablet_stand",
      name: "LOKMA KDS Tablet Standı",
      category: "Kasa Sistemleri",
      description: "Mutfak ekranı (KDS) veya müşteri ekranı olarak kullanılacak tabletler için tasarlanmış sağlam, ayarlanabilir metal stand.",
      icon: <Monitor className="w-8 h-8 text-neutral-400" />,
      image: "https://m.media-amazon.com/images/I/61jC54RjLHL._AC_SL1500_.jpg",
      price: 35.90,
      rentPrice: 0,
      minRentMonths: 0,
      specs: ["10 - 13 inç (33.0 cm) arası tabletlerle uyumlu", "360 derece dönebilen başlık", "Kaymaz taban ve kablo gizleme haznesi"]
    },
    {
      id: "receipt_printer_80mm",
      name: "LOKMA 80mm Fiş & Mutfak Yazıcısı",
      category: "Kasa Sistemleri",
      description: "Otomatik kesicili (Auto-Cutter), ağ (Ethernet) ve USB destekli endüstriyel termal mutfak ve adisyon yazıcısı.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://m.media-amazon.com/images/I/71uV45781aL._AC_SL1500_.jpg",
      price: 139.90,
      rentPrice: 6.90,
      minRentMonths: 12,
      specs: ["80mm Termal Kağıt Uyumluluğu", "Ethernet / LAN Desteği (Mutfak için)", "Duvara monte edilebilir"]
    },
    {
      id: "pos_d3_pro",
      name: "Sunmi D3 Pro (Masaüstü POS)",
      category: "Kasa Sistemleri",
      description: "15.6\" FHD ekran, entegre fiş yazıcı. Hızlı sipariş ve kasa yönetimi için.",
      icon: <Monitor className="w-8 h-8 text-blue-400" />,
      image: "https://minew.com/wp-content/uploads/2023/10/V2-PRO.png",
      price: 699,
      rentPrice: 39.90,
      minRentMonths: 12
    },
    {
      id: "pos_v2_pro",
      name: "Sunmi V2s (Mobil POS)",
      category: "Mobil Cihazlar",
      description: "Garson siparişleri veya paket servis için taşınabilir el terminali.",
      icon: <Smartphone className="w-8 h-8 text-green-400" />,
      image: "https://sunmi.com/wp-content/uploads/2021/08/v2s-1.png",
      price: 249,
      rentPrice: 15.90,
      minRentMonths: 12
    },
    {
      id: "scale_s2",
      name: "Sunmi S2 (Akıllı Terazi)",
      category: "Tartım & Terazi",
      description: "Anlık fiyat sekronizasyonlu, gramajı doğrudan hesaba düşen terazi.",
      icon: <Scale className="w-8 h-8 text-amber-400" />,
      image: "https://sunmi.com/wp-content/uploads/2021/08/s2-1.png",
      price: 899,
      rentPrice: 49.90,
      minRentMonths: 12
    },

    // ---- SUPERGALAXY SERIES ----

    { id: "esl_sg_154b", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag154B", category: "ESL Etiketleri", description: "En küçük 1.54 inç (3.9 cm) siyah beyaz etiket, süper hızlı güncelleme.", image: "https://www.minewtag.com/upload/goodsgallery/2025-08/68956ef03a5a0.jpg", price: 12.90, rentPrice: 0.90, minRentMonths: 12, specs: ["1.54 inç (3.9 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"], filters: { size: 1.54, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_21b", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag21B", category: "ESL Etiketleri", description: "2.1 inç (5.3 cm) siyah beyaz etiket, süper hızlı güncelleme.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png", price: 13.90, rentPrice: 1.00, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"], filters: { size: 2.1, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_26b", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag26B", category: "ESL Etiketleri", description: "2.6 inç (6.6 cm) siyah beyaz etiket, süper hızlı güncelleme.", image: "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg", price: 16.90, rentPrice: 1.20, minRentMonths: 12, specs: ["2.6 inç (6.6 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"], filters: { size: 2.6, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_42b", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag42B", category: "ESL Etiketleri", description: "4.2 inç (10.7 cm) büyük boy siyah beyaz etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png", price: 27.90, rentPrice: 2.30, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"], filters: { size: 4.2, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_58b", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag58B", category: "ESL Etiketleri", description: "5.8 inç (14.7 cm) geniş format siyah beyaz etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png", price: 42.90, rentPrice: 3.30, minRentMonths: 12, specs: ["5.8 inç (14.7 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"], filters: { size: 5.8, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_75b", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag75B", category: "ESL Etiketleri", description: "7.5 inç (19.1 cm) geniş format siyah beyaz etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013891036e.png", price: 62.90, rentPrice: 4.50, minRentMonths: 12, specs: ["7.5 inç (19.1 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"], filters: { size: 7.5, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_116b", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag116B", category: "ESL Etiketleri", description: "11.6 inç (29.5 cm) devasa siyah beyaz ekran.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142477638a.png", price: 85.90, rentPrice: 5.50, minRentMonths: 12, specs: ["11.6 inç (29.5 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"], filters: { size: 11.6, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },

    { id: "esl_sg_116", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag116", category: "ESL Etiketleri", description: "Geniş formatlı reyon yönlendirmeleri ve devasa promosyon ekranı.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142477638a.png", price: 89.90, rentPrice: 5.90, minRentMonths: 12, specs: ["11.6 inç (29.5 cm)", "3 Renkli Ekran", "5 Yıl Pil"], filters: { size: 11.6, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_58", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag58", category: "ESL Etiketleri", description: "Büyük ürün detayları gösterebilen yüksek çözünürlüklü etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png", price: 44.90, rentPrice: 3.50, minRentMonths: 12, specs: ["5.8 inç (14.7 cm)", "3 Renk Desteği"], filters: { size: 5.8, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_58q", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag58Q", category: "ESL Etiketleri", description: "4 renk kapasitesiyle daha canlı görünüm.", image: "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe0ffba778b.jpg", price: 49.90, rentPrice: 3.90, minRentMonths: 12, specs: ["5.8 inç (14.7 cm)", "4 Renkli"], filters: { size: 5.8, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_sg_42", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag42", category: "ESL Etiketleri", description: "Standart büyük boy etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png", price: 29.90, rentPrice: 2.50, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "3 Renkli"], filters: { size: 4.2, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_42q", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag42Q", category: "ESL Etiketleri", description: "4.2 inç (10.7 cm) formatında 4 farklı renk kapasitesi.", image: "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe114fa0743.jpg", price: 34.90, rentPrice: 2.80, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "4 Renk"], filters: { size: 4.2, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_sg_29aq", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag29AQ", category: "ESL Etiketleri", description: "Market rafları için Premium kasa ve gelişmiş AQ seri.", image: "https://www.minewtag.com/upload/goodsgallery/2025-08/68957464486ca.jpg", price: 22.90, rentPrice: 1.80, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "Premium"], filters: { size: 2.9, tech: ["Bluetooth", "NFC"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_29", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag29", category: "ESL Etiketleri", description: "Standart 2.9 inç (7.4 cm) market etiketi.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142eb62d93.png", price: 19.90, rentPrice: 1.50, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "3 Renkli"], filters: { size: 2.9, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_29q", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag29Q", category: "ESL Etiketleri", description: "2.9 inç (7.4 cm) boyutunda 4 renk kapasitesi.", image: "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe1240c012a.jpg", price: 21.90, rentPrice: 1.60, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "4 Renk"], filters: { size: 2.9, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_sg_29b", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag29B", category: "ESL Etiketleri", description: "Sadece siyah ve beyaz renk, süper hızlı güncelleme.", image: "https://www.minewtag.com/upload/goodsgallery/2025-09/68c38b8fd20bf.jpg", price: 17.90, rentPrice: 1.30, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)"], filters: { size: 2.9, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_26", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag26", category: "ESL Etiketleri", description: "Sıkışık raflar için 2.6 inç (6.6 cm) model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg", price: 17.90, rentPrice: 1.30, minRentMonths: 12, specs: ["2.6 inç (6.6 cm)", "3 Renkli"], filters: { size: 2.6, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_26q", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag26Q", category: "ESL Etiketleri", description: "Küçük form faktörde 4 renk.", image: "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe129adc5ad.jpg", price: 19.90, rentPrice: 1.50, minRentMonths: 12, specs: ["2.6 inç (6.6 cm)", "4 Renk"], filters: { size: 2.6, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_sg_29ab", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag29AB", category: "ESL Etiketleri", description: "2.9 inç (7.4 cm) AB (Advanced) varyasyonu.", image: "https://www.minewtag.com/upload/goodsgallery/2025-09/68c38d8641c11.jpg", price: 23.90, rentPrice: 1.80, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "Advanced"], filters: { size: 2.9, tech: ["Bluetooth", "NFC"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_21f", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag21F", category: "ESL Etiketleri", description: "Dondurucu için optimize edilmiş 2.1 inç (5.3 cm) etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-06/66618500247b9.jpg", price: 18.90, rentPrice: 1.40, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "Soğuk Hava (-25°C)"], filters: { size: 2.1, tech: ["Bluetooth", "NFC"], colors: 3, cold: true, water: false } },
    { id: "esl_sg_21", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag21", category: "ESL Etiketleri", description: "Kozmetik reyonları için keskin 2.1 inç (5.3 cm) etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png", price: 14.90, rentPrice: 1.10, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "3 Renkli"], filters: { size: 2.1, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_sg_21q", series: "Supergalaxy Series", name: "LOKMA Smart Tag STag21Q", category: "ESL Etiketleri", description: "Mini boyutta 4 renk özelliği.", image: "https://www.minewtag.com/upload/goodsgallery/2025-04/67fe13668f7d7.jpg", price: 16.90, rentPrice: 1.20, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "4 Renk"], filters: { size: 2.1, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },

    // ---- DS SLIM SERIES ----

    { id: "esl_ds_015b", series: "DS Slim Series", name: "LOKMA Smart Tag DS015B", category: "ESL Etiketleri", description: "1.54 inç (3.9 cm) ultra ince siyah beyaz model.", image: "https://www.minewtag.com/upload/goodsgallery/2025-08/68956ef03a5a0.jpg", price: 11.90, rentPrice: 0.80, minRentMonths: 12, specs: ["1.54 inç (3.9 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"], filters: { size: 1.54, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_021b", series: "DS Slim Series", name: "LOKMA Smart Tag DS021B", category: "ESL Etiketleri", description: "2.1 inç (5.3 cm) ultra ince siyah beyaz model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png", price: 11.90, rentPrice: 0.80, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"], filters: { size: 2.1, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_026b", series: "DS Slim Series", name: "LOKMA Smart Tag DS026B", category: "ESL Etiketleri", description: "2.66 inç (6.8 cm) ultra ince siyah beyaz model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg", price: 15.90, rentPrice: 1.10, minRentMonths: 12, specs: ["2.66 inç (6.8 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"], filters: { size: 2.66, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_029b", series: "DS Slim Series", name: "LOKMA Smart Tag DS029B", category: "ESL Etiketleri", description: "2.9 inç (7.4 cm) ultra ince siyah beyaz model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142eb62d93.png", price: 16.90, rentPrice: 1.20, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"], filters: { size: 2.9, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_042b", series: "DS Slim Series", name: "LOKMA Smart Tag DS042B", category: "ESL Etiketleri", description: "4.2 inç (10.7 cm) ultra ince siyah beyaz model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png", price: 29.90, rentPrice: 2.40, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"], filters: { size: 4.2, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_058b", series: "DS Slim Series", name: "LOKMA Smart Tag DS058B", category: "ESL Etiketleri", description: "5.8 inç (14.7 cm) ultra ince siyah beyaz model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png", price: 42.90, rentPrice: 3.30, minRentMonths: 12, specs: ["5.8 inç (14.7 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"], filters: { size: 5.8, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_075b", series: "DS Slim Series", name: "LOKMA Smart Tag DS075B", category: "ESL Etiketleri", description: "7.5 inç (19.1 cm) ultra ince siyah beyaz model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013891036e.png", price: 62.90, rentPrice: 4.50, minRentMonths: 12, specs: ["7.5 inç (19.1 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"], filters: { size: 7.5, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },

    { id: "esl_ds_116", series: "DS Slim Series", name: "LOKMA Smart Tag DS116", category: "ESL Etiketleri", description: "Ultra ince 11.6 inç (29.5 cm) signage modeli.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013eb7b658.png", price: 89.90, rentPrice: 5.90, minRentMonths: 12, specs: ["11.6 inç (29.5 cm)", "Ultra Slim"], filters: { size: 11.6, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_043q", series: "DS Slim Series", name: "LOKMA Smart Tag DS043Q", category: "ESL Etiketleri", description: "4.3 inç (10.9 cm) grafik display ince model.", image: "https://www.minewtag.com/upload/goodsgallery/2025-09/68c3885456ab0.jpg", price: 36.90, rentPrice: 2.80, minRentMonths: 12, specs: ["4.3 inç (10.9 cm)", "Slim", "4 Renk"], filters: { size: 4.3, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_ds_042q", series: "DS Slim Series", name: "LOKMA Smart Tag DS042Q", category: "ESL Etiketleri", description: "4.2 inç (10.7 cm) ince kasa 2.5D şeffaf korumalı.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d13d4ac8eb1.png", price: 31.90, rentPrice: 2.60, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "Slim"], filters: { size: 4.2, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_ds_042f", series: "DS Slim Series", name: "LOKMA Smart Tag DS042F", category: "ESL Etiketleri", description: "IP67 korumalı ince seri model.", image: "https://www.minewtag.com/upload/goodsgallery/2025-08/68afbfc428d05.jpg", price: 34.90, rentPrice: 2.70, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "IP67", "Slim"], filters: { size: 4.2, tech: ["Bluetooth", "NFC"], colors: 3, cold: false, water: true } },
    { id: "esl_ds_035q", series: "DS Slim Series", name: "LOKMA Smart Tag DS035Q", category: "ESL Etiketleri", description: "3.5 inç (8.9 cm) ince kasa modeli.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d13e482f6ad.png", price: 26.90, rentPrice: 2.10, minRentMonths: 12, specs: ["3.5 inç (8.9 cm)", "Slim"], filters: { size: 3.5, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_ds_035b", series: "DS Slim Series", name: "LOKMA Smart Tag DS035B", category: "ESL Etiketleri", description: "Siyah beyaz 3.5 inç (8.9 cm) ince kasa modeli.", image: "https://www.minewtag.com/upload/goodsgallery/2025-09/68c37f463715c.jpg", price: 24.90, rentPrice: 1.90, minRentMonths: 12, specs: ["3.5 inç (8.9 cm)", "3 Renkli (Siyah-Beyaz-Kırmızı)", "Slim"], filters: { size: 3.5, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_029q", series: "DS Slim Series", name: "LOKMA Smart Tag DS029Q", category: "ESL Etiketleri", description: "Standart market rafları için ultra ince profil.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d13ea1430ab.png", price: 18.90, rentPrice: 1.40, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "Slim", "4 Renk"], filters: { size: 2.9, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_ds_027q", series: "DS Slim Series", name: "LOKMA Smart Tag DS027Q", category: "ESL Etiketleri", description: "2.7 inç (6.9 cm) ara boyut ince etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2025-08/68956b8ded1f8.jpg", price: 17.90, rentPrice: 1.30, minRentMonths: 12, specs: ["2.7 inç (6.9 cm)", "Slim"], filters: { size: 2.7, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_ds_026f", series: "DS Slim Series", name: "LOKMA Smart Tag DS026F", category: "ESL Etiketleri", description: "Sadece 7.8mm kalınlığında 2.66 inç (6.8 cm) etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2025-08/68afbe8f44644.jpg", price: 16.90, rentPrice: 1.20, minRentMonths: 12, specs: ["2.6 inç (6.6 cm)", "7.8mm Slim"], filters: { size: 2.6, tech: ["Bluetooth", "NFC"], colors: 3, cold: false, water: false } },
    { id: "esl_ds_021q", series: "DS Slim Series", name: "LOKMA Smart Tag DS021Q", category: "ESL Etiketleri", description: "Raf alanı dar yerler için 4 renkli mini ince etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d141cba5662.png", price: 14.90, rentPrice: 1.10, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "4-Renk", "Slim"], filters: { size: 2.1, tech: ["Bluetooth", "NFC"], colors: 4, cold: false, water: false } },
    { id: "esl_ds_021", series: "DS Slim Series", name: "LOKMA Smart Tag DS021", category: "ESL Etiketleri", description: "DS serisinin en küçük ve ince etiketlerinden biri.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png", price: 12.90, rentPrice: 0.90, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "Slim"], filters: { size: 2.1, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },

    // ---- RAINBOW SERIES ----
    { id: "esl_rainbow_58", series: "Rainbow Series", name: "LOKMA Smart Tag RTag58", category: "ESL Etiketleri", description: "Çoklu renk paleti ve yanıp sönen flaş özellikli büyük boy etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png", price: 46.90, rentPrice: 3.80, minRentMonths: 12, specs: ["5.8 inç (14.7 cm)", "Rainbow"], filters: { size: 5.8, tech: ["Bluetooth"], colors: 7, cold: false, water: false } },
    { id: "esl_rainbow_42", series: "Rainbow Series", name: "LOKMA Smart Tag RTag42", category: "ESL Etiketleri", description: "7 renkli standart büyük boy indirim etiketi.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png", price: 32.90, rentPrice: 2.40, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "Rainbow"], filters: { size: 4.2, tech: ["Bluetooth"], colors: 7, cold: false, water: false } },
    { id: "esl_rainbow_29", series: "Rainbow Series", name: "LOKMA Smart Tag RTag29", category: "ESL Etiketleri", description: "Orta boy raflar için flaşlı çok renkli etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142eb62d93.png", price: 22.90, rentPrice: 1.80, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "Rainbow"], filters: { size: 2.9, tech: ["Bluetooth"], colors: 7, cold: false, water: false } },
    { id: "esl_rainbow_26", series: "Rainbow Series", name: "LOKMA Smart Tag RTag26", category: "ESL Etiketleri", description: "Dikkat çekici mini promosyon etiketi.", image: "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg", price: 20.90, rentPrice: 1.60, minRentMonths: 12, specs: ["2.6 inç (6.6 cm)", "Rainbow"], filters: { size: 2.6, tech: ["Bluetooth"], colors: 7, cold: false, water: false } },
    { id: "esl_rainbow_21", series: "Rainbow Series", name: "LOKMA Smart Tag RTag21", category: "ESL Etiketleri", description: "En küçük formatta renk cümbüşü sunan flaşlı model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png", price: 18.90, rentPrice: 1.40, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "Rainbow"], filters: { size: 2.1, tech: ["Bluetooth"], colors: 7, cold: false, water: false } },

    // ---- MULTI-ZONE SERIES ----
    { id: "esl_mz_75", series: "Multi-Zone Series", name: "LOKMA Smart Tag MZ075", category: "ESL Etiketleri", description: "Yan yana birden fazla ürünü tek ekranda ayırarak göstermek için.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013891036e.png", price: 64.90, rentPrice: 4.90, minRentMonths: 12, specs: ["7.5 inç (19.1 cm)", "Multi-Zone"], filters: { size: 7.5, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_mz_58", series: "Multi-Zone Series", name: "LOKMA Smart Tag MZ058", category: "ESL Etiketleri", description: "5.8 inç (14.7 cm) formatında bölünmüş ürün gösterimi.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png", price: 49.90, rentPrice: 3.80, minRentMonths: 12, specs: ["5.8 inç (14.7 cm)", "Multi-Zone"], filters: { size: 5.8, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_mz_42", series: "Multi-Zone Series", name: "LOKMA Smart Tag MZ042", category: "ESL Etiketleri", description: "Standart boyutta bağımsız bölgelere sahip fiyat etiketi.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png", price: 34.90, rentPrice: 2.50, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "Multi-Zone"], filters: { size: 4.2, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },

    // ---- MERCURIUS SERIES ----
    { id: "esl_mercurius_58", series: "Mercurius Series", name: "LOKMA Smart Tag MTag58", category: "ESL Etiketleri", description: "Geniş formatta elit metalik tasarımlı etiket.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1428acba6a.png", price: 47.90, rentPrice: 3.60, minRentMonths: 12, specs: ["5.8 inç (14.7 cm)", "Mercurius"], filters: { size: 5.8, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_mercurius_42", series: "Mercurius Series", name: "LOKMA Smart Tag MTag42", category: "ESL Etiketleri", description: "Şarküteri ve gurme reyonları için lüks görünümlü 4.2 inç (10.7 cm).", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png", price: 32.90, rentPrice: 2.60, minRentMonths: 12, specs: ["4.2 inç (10.7 cm)", "Mercurius"], filters: { size: 4.2, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_mercurius_29", series: "Mercurius Series", name: "LOKMA Smart Tag MTag29", category: "ESL Etiketleri", description: "Butik mağazalar için tasarlanmış özel premium kasa tasarımı.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d143c0654ab.png", price: 24.90, rentPrice: 1.80, minRentMonths: 12, specs: ["2.9 inç (7.4 cm)", "Mercurius"], filters: { size: 2.9, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_mercurius_26", series: "Mercurius Series", name: "LOKMA Smart Tag MTag26", category: "ESL Etiketleri", description: "Küçük boy, yüksek kalite metalik kasa modeli.", image: "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg", price: 21.90, rentPrice: 1.60, minRentMonths: 12, specs: ["2.6 inç (6.6 cm)", "Mercurius"], filters: { size: 2.6, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_mercurius_21", series: "Mercurius Series", name: "LOKMA Smart Tag MTag21", category: "ESL Etiketleri", description: "Mini kozmetik reyonları için şık çerçeveli 2.1 inç (5.3 cm).", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d1432e239b3.png", price: 17.90, rentPrice: 1.30, minRentMonths: 12, specs: ["2.1 inç (5.3 cm)", "Mercurius"], filters: { size: 2.1, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },

    // ---- CONFERENCE TABLE SERIES ----
    { id: "esl_conference_rs075v", series: "Conference Table Series", name: "LOKMA Smart Desk Sign RS075V", category: "ESL Etiketleri", description: "Ofis resepsiyonu ve masa numaratörleri için çift taraflı V-şeklinde ekran (6 renk destegi).", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d011f7e9221.png", price: 95.90, rentPrice: 6.90, minRentMonths: 12, specs: ["7.3 inç (18.5 cm) x 2", "V-Shape", "6 Renk"], filters: { size: 7.3, tech: ["Bluetooth"], colors: 6, cold: false, water: false } },
    { id: "esl_conference_ds073", series: "Conference Table Series", name: "LOKMA Smart Desk Sign DS073", category: "ESL Etiketleri", description: "Toplantı masaları için gelişmiş ince profil isimlik.", image: "https://www.minewtag.com/upload/goodsgallery/2024-09/66e3a7c24a6cd.png", price: 85.90, rentPrice: 6.50, minRentMonths: 12, specs: ["7.3 inç (18.5 cm) Çift Taraflı"], filters: { size: 7.3, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_conference_ws075", series: "Conference Table Series", name: "LOKMA Smart Desk Sign WS075", category: "ESL Etiketleri", description: "Geniş format masaüstü elektronik bilgi levhası.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d012acb24d4.png", price: 89.90, rentPrice: 6.70, minRentMonths: 12, specs: ["7.5 inç (19.1 cm)", "Masaüstü Stand"], filters: { size: 7.5, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },
    { id: "esl_conference_stag75", series: "Conference Table Series", name: "LOKMA Smart Desk Sign STag75", category: "ESL Etiketleri", description: "Masaüstü konferans etiketlemeleri için yüksek okunaklı STag serisi model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d013891036e.png", price: 79.90, rentPrice: 5.90, minRentMonths: 12, specs: ["7.5 inç (19.1 cm)", "Standlı"], filters: { size: 7.5, tech: ["Bluetooth"], colors: 3, cold: false, water: false } },

    // ---- COLD-CHAIN SERIES ----
    { id: "esl_cold_42", series: "Cold-Chain Series", name: "LOKMA Smart Tag CTag42", category: "ESL Etiketleri", description: "Dondurucu reyonları için üretilmiş, -25°C ısıya ve buğulanmaya dayanıklı.", image: "https://www.minewtag.com/upload/goodsgallery/2024-08/66d142a9c8819.png", price: 36.90, rentPrice: 2.80, minRentMonths: 12, specs: ["-25°C Dayanıklı", "4.2 inç (10.7 cm)"], filters: { size: 4.2, tech: ["Bluetooth"], colors: 3, cold: true, water: true } },
    { id: "esl_cold_26", series: "Cold-Chain Series", name: "LOKMA Smart Tag CTag26", category: "ESL Etiketleri", description: "Soğuk hava dolapları için kompakt, donmaya ve neme dayanıklı model.", image: "https://www.minewtag.com/upload/goodsgallery/2024-06/666188a934068.jpg", price: 24.90, rentPrice: 1.90, minRentMonths: 12, specs: ["-25°C", "2.6 inç (6.6 cm)"], filters: { size: 2.6, tech: ["Bluetooth"], colors: 3, cold: true, water: true } },

    // ---- OTHERS ----
    {
      id: "thermal_roll_80",
      name: "Termal Rulo 80mm (Kasa & Mutfak)",
      category: "Sarf Malzemeleri",
      description: "Standart 80mm termal yazıcı rulosu. Tüm LOKMA fiş ve mutfak yazıcılarıyla uyumlu yüksek kalite termal kağıt. (50'li Koli)",
      icon: <Tag className="w-8 h-8 text-neutral-400" />,
      image: "https://m.media-amazon.com/images/I/61Nl8XQfHUL._AC_SL1500_.jpg",
      price: 39.90,
      rentPrice: 0,
      minRentMonths: 0
    },
    {
      id: "thermal_roll_80_5pack",
      name: "Double Dragon 80mm Termal Rulo (5'li Paket)",
      category: "Sarf Malzemeleri",
      description: "Yüksek kalite, BPA içermeyen POS kasa ve mutfak yazıcısı termal kağıdı (80mm x 80mm). Çevre dostu ve leke tutmaz. 5 adet rulo içerir.",
      icon: <Tag className="w-8 h-8 text-neutral-400" />,
      image: "https://m.media-amazon.com/images/I/715AC3Tnm9L._AC_SX679_.jpg",
      images: [
        "https://m.media-amazon.com/images/I/715AC3Tnm9L._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/51rVRWbxOkL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/61hqXKz68QL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/817GkNDM7SL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/711cp4+W8aL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/714n4Z1yQUL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/712aup6qv3L._AC_SL1500_.jpg"
      ],
      price: 8.56,
      rentPrice: 0,
      minRentMonths: 0
    }
  ];

  const handleUpdateCart = (id: string, quantity: number, mode: 'rent' | 'buy' | 'installment', duration: 6 | 12 | 24 = 12) => {
    if (quantity <= 0) {
      const newCart = { ...hardwareCart };
      delete newCart[id];
      setHardwareCart(newCart);
      return;
    }
    setHardwareCart({
      ...hardwareCart,
      [id]: { quantity, mode, duration }
    });
  };

  const handleRequestSubmit = async () => {
    if (Object.keys(hardwareCart).length === 0) return;
    setSubmitting(true);
    try {
      const requestData = {
        businessId: business.id,
        businessName: business.companyName || business.brand || 'Bilinmiyor',
        items: hardwareCart,
        requestedAt: serverTimestamp(),
        status: 'pending',
        requestedBy: admin ? admin.email : 'Business Owner',
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
    if (data.mode === 'buy') {
      const product = hardwareList.find(p => p.id === id);
      return acc + (product?.price || 0) * data.quantity;
    }
    return acc;
  }, 0);

  const totalRent = Object.entries(hardwareCart).reduce((acc, [id, data]) => {
    if (data.mode === 'rent' || data.mode === 'installment') {
      const product = hardwareList.find(p => p.id === id);
      const calculatedPrice = getRentPrice(product?.rentPrice || 0, data.duration);
      return acc + calculatedPrice * data.quantity;
    }
    return acc;
  }, 0);

  // Toggle filter logic
  const toggleArrayFilter = (state: any[], setter: any, value: any) => {
    if (state.includes(value)) {
      setter(state.filter(v => v !== value));
    } else {
      setter([...state, value]);
    }
  };

  const filteredHardware = hardwareList.filter(p => {
    if (p.category !== activeCategory) return false;
    
    if (activeCategory === 'ESL Etiketleri') {
      if (activeSeries !== 'Tümü' && p.series !== activeSeries) return false;
      
      // Additional Filters
      if (p.filters) {
        if (filterSize.length > 0 && !filterSize.includes(p.filters.size)) return false;
        if (filterTech.length > 0 && !filterTech.some((t: string) => p.filters.tech.includes(t))) return false;
        if (filterColor.length > 0 && !filterColor.includes(p.filters.colors)) return false;
        if (filterCold && !p.filters.cold) return false;
        if (filterWater && !p.filters.water) return false;
        if (p.rentPrice > maxRentPrice) return false;
      }
    }
    
    return true;
  });

  // Extract unique filter options from the list
  const availableSizes = Array.from(new Set(hardwareList.filter(p => p.category === 'ESL Etiketleri' && p.filters).map(p => p.filters.size))).sort((a,b) => a-b);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-900/60 to-purple-900/40 border border-indigo-500/40 rounded-2xl p-6 mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white mb-2">Donanım Mağazası (LOKMA DaaS)</h2>
          <p className="text-indigo-200 max-w-2xl">
            İşletmenizin ihtiyacı olan akıllı kasa, terazi ve ESL etiketlerini buradan sipariş edebilirsiniz. Kiralama modeli (Device as a Service) ile yüksek ilk yatırım maliyeti olmadan donanımlarınızı kurabilirsiniz.
          </p>
        </div>
      </div>

      <div className="space-y-6 pb-32">
        
        {/* Kategori Tabları */}
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === category 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          {activeCategory === 'ESL Etiketleri' && (
             <button 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors shrink-0"
             >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filtreler</span>
             </button>
          )}
        </div>

        {activeCategory === 'ESL Etiketleri' && (
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {['Tümü', 'Slim Series', 'Rainbow Series', 'Multi-Zone Series', 'Supergalaxy Series', 'Mercurius Series', 'Conference Table Series', 'Cold-Chain Series'].map((series) => (
              <button
                key={series}
                onClick={() => setActiveSeries(series)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                  activeSeries === series 
                    ? 'bg-indigo-500 text-white border-indigo-500' 
                    : 'bg-transparent text-muted-foreground border-border hover:border-indigo-500/50 hover:text-foreground'
                }`}
              >
                {series}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          {activeCategory === 'ESL Etiketleri' && showFilters && (
            <div className="w-full lg:w-64 shrink-0 space-y-6 bg-card/50 border border-border rounded-xl p-5 h-fit animate-in slide-in-from-left-4">
              
              {/* Teknoloji */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Teknoloji</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-border bg-background text-primary" checked={filterTech.includes("Bluetooth")} onChange={() => toggleArrayFilter(filterTech, setFilterTech, "Bluetooth")} />
                    <span className="text-sm flex items-center gap-2"><Bluetooth className="w-4 h-4 text-blue-400" /> Bluetooth 5.0</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-border bg-background text-primary" checked={filterTech.includes("NFC")} onChange={() => toggleArrayFilter(filterTech, setFilterTech, "NFC")} />
                    <span className="text-sm flex items-center gap-2"><Nfc className="w-4 h-4 text-indigo-400" /> NFC İletişimi</span>
                  </label>
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Ekran Boyutu */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Ekran Boyutu (İnç)</h4>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map(size => (
                    <button 
                      key={size}
                      onClick={() => toggleArrayFilter(filterSize, setFilterSize, size)}
                      className={`px-2 py-1 border rounded text-xs font-medium transition-colors ${filterSize.includes(size) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-foreground/30'}`}
                    >
                      {size}"
                    </button>
                  ))}
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Renk Seçenekleri */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Renk Kapasitesi</h4>
                <div className="space-y-2">
                  {[2, 3, 4, 6, 7].map(c => (
                     <label key={c} className="flex items-center gap-2 cursor-pointer">
                       <input type="checkbox" className="rounded border-border bg-background text-primary" checked={filterColor.includes(c)} onChange={() => toggleArrayFilter(filterColor, setFilterColor, c)} />
                       <span className="text-sm">
                         {c === 2 ? 'Siyah/Beyaz' : c === 7 ? 'Rainbow (7+ Renk)' : `${c} Renkli E-Ink`}
                       </span>
                     </label>
                  ))}
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Dayanıklılık */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Özel Ortam</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" className="rounded border-border bg-background text-primary" checked={filterCold} onChange={(e) => setFilterCold(e.target.checked)} />
                    <Snowflake className="w-4 h-4 text-blue-300" /> Soğuk Alan (-25°C)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" className="rounded border-border bg-background text-primary" checked={filterWater} onChange={(e) => setFilterWater(e.target.checked)} />
                    <Droplets className="w-4 h-4 text-cyan-400" /> Su Geçirmez (IP67)
                  </label>
                </div>
              </div>
              <hr className="border-border/50" />

              {/* Fiyat Slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Maks. Kiralama</h4>
                  <span className="text-xs font-bold text-indigo-400">€{maxRentPrice.toFixed(2)}/ay</span>
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

          {/* Product Grid */}
          <div className={`flex-1 grid gap-6 ${
              activeCategory === 'ESL Etiketleri' && showFilters 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' 
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}>
            
            {filteredHardware.length === 0 && (
              <div className="col-span-full py-20 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <SlidersHorizontal className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Sonuç Bulunamadı</h3>
                <p className="text-muted-foreground mt-1 max-w-sm">
                  Seçtiğiniz filtrelere uygun bir donanım modeli bulunmuyor. Filtreleri esneterek tekrar deneyin.
                </p>
                <button 
                  onClick={() => { setFilterSize([]); setFilterTech([]); setFilterColor([]); setFilterCold(false); setFilterWater(false); setMaxRentPrice(10); }}
                  className="mt-6 px-4 py-2 bg-primary/10 text-primary rounded-lg font-medium hover:bg-primary/20 transition-colors"
                >
                  Filtreleri Temizle
                </button>
              </div>
            )}

            {filteredHardware.map((product) => {
              const currentSelection = hardwareCart[product.id];
              
              return (
                <div key={product.id} className="bg-card border border-border rounded-xl hover:border-primary/50 transition-colors flex flex-col overflow-hidden group">
                  
                  {/* Ürün Görseli */}
                  <div 
                    className="p-6 bg-white/5 dark:bg-white flex items-center justify-center h-[200px] cursor-pointer relative"
                    onClick={() => product.image ? setSelectedProductDetail(product) : null}
                  >
                    {product.image ? (
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500" 
                      />
                    ) : (
                      <div className="group-hover:scale-110 transition-transform duration-300">
                        {product.icon}
                      </div>
                    )}
                    {product.image && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-auto">Büyüt</span>
                      </div>
                    )}
                    
                    {/* Badge Overlay */}
                    {product.filters?.cold && (
                      <div className="absolute top-2 left-2 bg-blue-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                        <Snowflake className="w-3 h-3" /> Soğuk
                      </div>
                    )}
                    {product.filters?.water && (
                      <div className="absolute top-2 right-2 bg-cyan-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                        <Droplets className="w-3 h-3" /> IP67
                      </div>
                    )}
                  </div>
                  
                  
                  {/* Thumbnails */}
                  {product.images && product.images.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto p-3 border-t border-border/50 hide-scrollbar bg-card/30">
                      {product.images.map((img: string, idx: number) => (
                        <div 
                          key={idx} 
                          className="w-12 h-12 shrink-0 rounded border border-border/50 overflow-hidden cursor-pointer hover:border-primary transition-colors"
                          onClick={() => setSelectedImage(img)}
                        >
                          <img 
                            src={img} 
                            alt={`${product.name} - ${idx}`} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ürün Detayları */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h4 className="font-bold text-foreground text-lg leading-tight">{product.name}</h4>
                    <p className="text-xs text-muted-foreground mt-2 mb-4 line-clamp-3">{product.description}</p>
                    
                    {product.specs && (
                      <ul className="text-[11px] text-muted-foreground list-disc pl-4 mb-4 space-y-1 bg-muted/20 border border-border/50 p-2.5 rounded-lg">
                        {product.specs.map((spec: string, idx: number) => (
                          <li key={idx} className="text-foreground/80">{spec}</li>
                        ))}
                      </ul>
                    )}
                    
                    <div className="mt-auto pt-4 border-t border-border/50">
                      <div className="flex flex-col gap-1 mb-4">
                        <span className="text-sm">
                          <span className="font-semibold text-white">Satın Al:</span> €{product.price.toFixed(2)}
                        </span>
                        <span className="text-sm text-indigo-300">
                          <span className="font-semibold">Kirala:</span> €{product.rentPrice.toFixed(2)} /ay <span className="text-[10px] text-muted-foreground ml-1">({product.minRentMonths} ay taahhüt)</span>
                        </span>
                      </div>

                      <div className="flex flex-col gap-3 w-full">
                        <select 
                          className="bg-background border border-input rounded-md px-3 py-2 text-sm w-full focus:ring-2 focus:ring-primary/50"
                          value={currentSelection?.mode || 'rent'}
                          onChange={(e) => {
                            const newMode = e.target.value as 'rent' | 'buy' | 'installment';
                            let newDuration = currentSelection?.duration || 12;
                            if (newMode === 'installment') newDuration = 24;
                            else if (newMode === 'rent' && newDuration === 24) newDuration = 12;
                            handleUpdateCart(product.id, currentSelection?.quantity || 1, newMode, newDuration);
                          }}
                        >
                          <option value="rent">Kiralama Modeli</option>
                          <option value="buy">Satın Alma Modeli</option>
                          {product.category === 'ESL Etiketleri' && (
                            <option value="installment">Taksit ile Ödeme (24 Ay)</option>
                          )}
                        </select>

                        {(!currentSelection || currentSelection.mode === 'rent' || currentSelection.mode === 'installment') && (
                          <select 
                            className="bg-indigo-900/20 border border-indigo-500/30 rounded-md px-3 py-2 text-xs text-indigo-200 w-full focus:ring-2 focus:ring-indigo-500/50"
                            value={currentSelection?.duration || (currentSelection?.mode === 'installment' ? 24 : 12)}
                            onChange={(e) => handleUpdateCart(product.id, currentSelection?.quantity || 1, currentSelection?.mode || 'rent', parseInt(e.target.value) as 6 | 12 | 24)}
                            disabled={currentSelection?.mode === 'installment'}
                          >
                            {currentSelection?.mode !== 'installment' && (
                              <>
                                <option value={6}>6 Ay Taahhütlü (€{getRentPrice(product.rentPrice, 6).toFixed(2)}/ay)</option>
                                <option value={12}>12 Ay Taahhütlü (€{getRentPrice(product.rentPrice, 12).toFixed(2)}/ay)</option>
                                {product.category !== 'ESL Etiketleri' && (
                                  <option value={24}>24 Ay Taahhütlü (€{getRentPrice(product.rentPrice, 24).toFixed(2)}/ay)</option>
                                )}
                              </>
                            )}
                            {currentSelection?.mode === 'installment' && (
                              <option value={24}>
                                24 Ay Taksit (Süre Sonunda Sizin Olur) (€{getRentPrice(product.rentPrice, 24).toFixed(2)}/ay)
                              </option>
                            )}
                          </select>
                        )}
                      
                        <div className="flex items-center gap-3 bg-background border border-border p-1 rounded-lg">
                          <button 
                            onClick={() => handleUpdateCart(product.id, (currentSelection?.quantity || 0) - 1, currentSelection?.mode || 'rent', currentSelection?.duration || 12)}
                            className="w-10 h-10 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                          >
                            -
                          </button>
                          <input 
                            type="number"
                            min="0"
                            className="flex-1 text-center font-bold text-foreground text-lg bg-transparent border-none focus:outline-none w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none m-0 p-0"
                            value={currentSelection?.quantity || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              handleUpdateCart(product.id, val, currentSelection?.mode || 'rent', currentSelection?.duration || 12);
                            }}
                          />
                          <button 
                            onClick={() => handleUpdateCart(product.id, (currentSelection?.quantity || 0) + 1, currentSelection?.mode || 'rent', currentSelection?.duration || 12)}
                            className="w-10 h-10 rounded-md bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )
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
                    {Object.values(hardwareCart).reduce((a, b) => a + b.quantity, 0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg hidden sm:block">Sipariş Özeti</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-1">
                    {totalBuy > 0 && (
                      <span className="text-muted-foreground whitespace-nowrap">
                        Satın Alma: <span className="font-bold text-white text-base">€{totalBuy.toFixed(2)}</span>
                      </span>
                    )}
                    {totalRent > 0 && (
                      <span className="text-indigo-300 whitespace-nowrap">
                        Kira / Taksit: <span className="font-bold text-base">€{totalRent.toFixed(2)}</span> /ay
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
                    <>Talebi Tamamla <span className="ml-1 text-green-200">→</span></>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      
      {/* Product Detail Modal */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 overflow-y-auto py-10" onClick={() => setSelectedProductDetail(null)}>
          <div className="relative bg-card w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row my-auto" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute top-4 right-4 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 text-foreground w-10 h-10 rounded-full flex items-center justify-center transition-colors z-20"
              onClick={() => setSelectedProductDetail(null)}
            >
              ✕
            </button>
            
            {/* Left side: Images */}
            <div className="w-full md:w-1/2 bg-white dark:bg-white/5 flex flex-col p-8 items-center justify-center border-b md:border-b-0 md:border-r border-border/50">
               <img src={selectedImage || selectedProductDetail.image} alt={selectedProductDetail.name} className="max-w-full max-h-[350px] object-contain mb-8" />
               {selectedProductDetail.images && selectedProductDetail.images.length > 0 && (
                 <div className="flex gap-3 overflow-x-auto p-2 max-w-full hide-scrollbar">
                    {[selectedProductDetail.image, ...selectedProductDetail.images].map((img: string, i: number) => (
                      <div key={i} onClick={() => setSelectedImage(img)} className="w-16 h-16 border border-border/50 rounded-lg cursor-pointer shrink-0 overflow-hidden hover:border-primary transition-colors bg-white">
                         <img src={img} className="w-full h-full object-cover" />
                      </div>
                    ))}
                 </div>
               )}
            </div>

            {/* Right side: Specs */}
            <div className="w-full md:w-1/2 p-8 flex flex-col max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="text-sm text-primary font-medium mb-2">{selectedProductDetail.category}</div>
              <h2 className="text-3xl font-bold text-foreground mb-4">{selectedProductDetail.name}</h2>
              <p className="text-muted-foreground mb-8 text-base">{selectedProductDetail.description}</p>
              
              {/* Detailed Specs Table */}
              {getDetailedSpecs(selectedProductDetail) && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-foreground mb-4 border-b border-border/50 pb-2 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Teknik Detaylar
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(getDetailedSpecs(selectedProductDetail)).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border/30 pb-2 text-sm">
                        <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-medium text-foreground text-right max-w-[60%]">{v as string}</span>
                      </div>
                    ))}
                  </div>
                  
                  {getDetailedSpecs(selectedProductDetail)?.enduranceTime && (
                    <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-foreground flex items-start gap-3">
                      <Info className="w-6 h-6 shrink-0 text-primary mt-0.5" />
                      <div>
                        <strong className="block mb-1 text-primary">Pil Ömrü (Dayanıklılık) Hakkında Bilgi</strong>
                        ESL cihazlarında pil bittiğinde cihaz <strong>çöp olmaz veya kullanılamaz hale gelmez.</strong> Bu cihazlar standart Lityum Düğme Pil (genelde CR2450) kullanır. Pil ömrü dolduğunda kapağı açılarak pil çok düşük bir maliyetle saniyeler içinde yenilenir ve cihaz 5 yıl daha sorunsuz çalışmaya devam eder.
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-auto pt-6 border-t border-border/50 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
                 <div>
                   <div className="text-3xl font-bold text-foreground">€{selectedProductDetail.price.toFixed(2)}</div>
                   {selectedProductDetail.rentPrice > 0 && <div className="text-sm text-muted-foreground">veya €{selectedProductDetail.rentPrice.toFixed(2)} / ay kiralama</div>}
                 </div>
                 <button className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20" onClick={() => { 
                   setSelectedProductDetail(null);
                   // Optionally scroll to order section
                 }}>
                   Siparişe Dön
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full h-[80vh] flex items-center justify-center">
            <button 
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
            >
              ✕
            </button>
            <img 
              src={selectedImage} 
              alt="Büyütülmüş Görsel" 
              className="max-w-full max-h-full object-contain rounded-xl bg-white p-4 shadow-2xl" 
            />
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
            <h2 className="text-2xl font-bold text-foreground mb-3">Sipariş Alındı!</h2>
            <p className="text-muted-foreground mb-6">
              Donanım talebiniz başarıyla oluşturulmuştur.
            </p>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm text-green-200 mb-6 text-left">
              <strong>Kiralama süreci hakkında:</strong> Kiralama bedeli donanımlar elinize geçtikten sonra, sistemde kayıtlı banka hesabınızdan veya kredi kartınızdan tahsil edilmeye başlanacaktır.
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
