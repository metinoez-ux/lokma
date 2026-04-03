export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import https from 'https';
import http from 'http';

// All 62 TUNA Food products with VERIFIED image URLs from live tunafood.com
const TUNA_PRODUCTS = [
 // ═══ SUCUK (8) ═══
 { id: 'tuna-parmak-sucuk-1000', name: { de: 'Mittelscharf Sucuk 1000 g', tr: 'Parmak Sucuk 1000 g' }, category: 'sucuk', weight: '1000 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/501_parmak_sucuk_1kg_2-1.png', nutrition: { energy: '1497 kJ – 361 kcal', fat: '30,7 gr', saturatedFat: '6,5 gr', carbs: '3 gr', sugar: '2,4 gr', protein: '18 gr', salt: '3 gr' }, consumptionInfo: { articleNumber: '501', barcode: '4050164005014', shelfLife: '4,5 Monat', packaging: '1000 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },
 { id: 'tuna-kangal-sucuk-1000', name: { de: 'Kangal Sucuk 1000 g', tr: 'Kangal Sucuk 1000 g' }, category: 'sucuk', weight: '1000 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/502_kangal_sucuk_1kg_2-1.png', nutrition: { energy: '1497 kJ – 361 kcal', fat: '30,7 gr', saturatedFat: '6,5 gr', carbs: '3 gr', sugar: '2,4 gr', protein: '18 gr', salt: '3 gr' }, consumptionInfo: { articleNumber: '301', barcode: '4050164003010', shelfLife: '4,5 Monat', packaging: '1000 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },
 { id: 'tuna-sadrazam-sucuk-1000', name: { de: 'Extra Scharf Sucuk 1000 g', tr: 'Sadrazam Sucuk 1000 g' }, category: 'sucuk', weight: '1000 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/503_sadrazam_sucuk_1kg-1.png', nutrition: { energy: '1497 kJ – 361 kcal', fat: '30,7 gr', saturatedFat: '6,5 gr', carbs: '3 gr', sugar: '2,4 gr', protein: '18 gr', salt: '3 gr' }, consumptionInfo: { articleNumber: '503', barcode: '4050164005034', shelfLife: '4,5 Monat', packaging: '1000 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },
 { id: 'tuna-dilim-sucuk-250', name: { de: 'Sucuk in Scheiben 250 g', tr: 'Dilim Sucuk 250 g' }, category: 'sucuk', weight: '250 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/101_dilim_sucuk_2-1.png', nutrition: { energy: '1497 kJ – 361 kcal', fat: '30,7 gr', saturatedFat: '6,5 gr', carbs: '3 gr', sugar: '2,4 gr', protein: '18 gr', salt: '3 gr' }, consumptionInfo: { articleNumber: '101', barcode: '4050164001016', shelfLife: '4,5 Monat', packaging: '250 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },
 { id: 'tuna-sucuk-burger-250', name: { de: 'Sucuk Burger 250 g', tr: 'Sucuk Burger 250 g' }, category: 'sucuk', weight: '250 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/12/508_de_sucuk_burger_250gr.png', nutrition: { energy: '1497 kJ – 361 kcal', fat: '30,7 gr', saturatedFat: '6,5 gr', carbs: '3 gr', sugar: '2,4 gr', protein: '18 gr', salt: '3 gr' }, consumptionInfo: { articleNumber: '201', barcode: '4050164002013', shelfLife: '4,5 Monat' } },
 { id: 'tuna-mini-sucuk-30', name: { de: 'Mini Sucuk 30 g', tr: 'Mini Sucuk 30 g' }, category: 'sucuk', weight: '30 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/507_mini_sucuk-1.png', nutrition: { energy: '1497 kJ – 361 kcal', fat: '30,7 gr', saturatedFat: '6,5 gr', carbs: '3 gr', sugar: '2,4 gr', protein: '18 gr', salt: '3 gr' }, consumptionInfo: { articleNumber: '701', barcode: '4050164007014', shelfLife: '4,5 Monat', packaging: '30 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },
 { id: 'tuna-parmak-sucuk-400', name: { de: 'Mittelscharf Sucuk 400 g', tr: 'Parmak Sucuk 400 g' }, category: 'sucuk', weight: '400 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/504_parmak_sucuk_400g_2-1.png', nutrition: { energy: '1497 kJ – 361 kcal', fat: '30,7 gr', saturatedFat: '6,5 gr', carbs: '3 gr', sugar: '2,4 gr', protein: '18 gr', salt: '3 gr' }, consumptionInfo: { articleNumber: '401', barcode: '4050164004013', shelfLife: '4,5 Monat', packaging: '400 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },
 { id: 'tuna-sadrazam-sucuk-400', name: { de: 'Extra Scharf Sucuk 400 g', tr: 'Sadrazam Sucuk 400 g' }, category: 'sucuk', weight: '400 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/506_sadrazam_sucuk_400g-1.png', nutrition: { energy: '1497 kJ – 361 kcal', fat: '30,7 gr', saturatedFat: '6,5 gr', carbs: '3 gr', sugar: '2,4 gr', protein: '18 gr', salt: '3 gr' }, consumptionInfo: { articleNumber: '403', barcode: '4050164004037', shelfLife: '4,5 Monat', packaging: '400 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },

 // ═══ WURST & AUFSCHNITT (6) ═══
 { id: 'tuna-rindfleischwurst-paprika-150', name: { de: 'Rindfleischwurst in Scheiben mit Paprika 150 g', tr: 'Biberli Dana Salam Dilim 150 g' }, category: 'wurst', weight: '150 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/597_dilim_biberli_salam_200g-1.png', nutrition: { energy: '1086 kJ – 261 kcal', fat: '21 gr', saturatedFat: '9 gr', carbs: '3 gr', sugar: '2,3 gr', protein: '15 gr', salt: '2 gr' }, consumptionInfo: { articleNumber: '116', barcode: '4050164001160', shelfLife: '120 Tage' } },
 { id: 'tuna-rindswurst-scheiben-150', name: { de: 'Rindswurst in Scheiben 150 g', tr: 'Dana Salam Dilim 150 g' }, category: 'wurst', weight: '150 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/596_dilim_sigir_salam_200g-1.png', nutrition: { energy: '1086 kJ – 261 kcal', fat: '21 gr', saturatedFat: '9 gr', carbs: '3 gr', sugar: '2,3 gr', protein: '15 gr', salt: '2 gr' }, consumptionInfo: { articleNumber: '114', barcode: '4050164001146', shelfLife: '120 Tage' } },
 { id: 'tuna-haehnchenwurst-scheiben-150', name: { de: 'Hähnchenwurst in Scheiben 150 g', tr: 'Tavuk Salam Dilim 150 g' }, category: 'wurst', weight: '150 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/598_dilim_tavuk_salam_200g-1.png', nutrition: { energy: '937 kJ – 225 kcal', fat: '16 gr', saturatedFat: '5,6 gr', carbs: '6 gr', sugar: '3 gr', protein: '14 gr', salt: '2 gr' }, consumptionInfo: { articleNumber: '115', barcode: '4050164001153', shelfLife: '120 Tage' } },
 { id: 'tuna-salami-ungarisch-400', name: { de: 'Salami ungarisch 400 g', tr: 'Macar Salam 400 g' }, category: 'wurst', weight: '400 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/599_macar_salam_2-1.png', nutrition: { energy: '1086 kJ – 261 kcal', fat: '21 gr', saturatedFat: '9 gr', carbs: '3 gr', sugar: '2,3 gr', protein: '15 gr', salt: '2 gr' }, consumptionInfo: { articleNumber: '605', barcode: '4050164006055', shelfLife: '4,5 Monat', packaging: '400 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },
 { id: 'tuna-rindswurst-400', name: { de: 'Rindswurst 400 g', tr: 'Dana Salam 400 g' }, category: 'wurst', weight: '400 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/561_sade_salam_baton_400g-1.png', nutrition: { energy: '1086 kJ – 261 kcal', fat: '21 gr', saturatedFat: '9 gr', carbs: '3 gr', sugar: '2,3 gr', protein: '15 gr', salt: '2 gr' }, consumptionInfo: { articleNumber: '601', barcode: '4050164006017', shelfLife: '4,5 Monat', packaging: '400 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },
 { id: 'tuna-haehnchenwurst-400', name: { de: 'Hähnchenwurst 400 g', tr: 'Tavuk Salam 400 g' }, category: 'wurst', weight: '400 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/567_tavuk_salam_baton_400g-1.png', nutrition: { energy: '937 kJ – 225 kcal', fat: '16 gr', saturatedFat: '5,6 gr', carbs: '6 gr', sugar: '3 gr', protein: '14 gr', salt: '2 gr' }, consumptionInfo: { articleNumber: '603', barcode: '4050164006031', shelfLife: '4,5 Monat', packaging: '400 gr in spezieller Vakuumverpackung', storageTemp: 'Hält 4,5 Monat zwischen +2 und +7 °C an.' } },

 // ═══ WÜRSTCHEN (3) ═══
 { id: 'tuna-haehnchenwuerstchen-400', name: { de: 'Hähnchenwürstchen 400 g', tr: 'Tavuk Sosis 400 g' }, category: 'wurstchen', weight: '400 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/12/656_tavuk_sosis_400g-1.png' },
 { id: 'tuna-rindswuerstchen-dose-250', name: { de: 'Rindswürstchen in der Dose 250 g', tr: 'Dana Sosis (Konserve) 250 g' }, category: 'wurstchen', weight: '250 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/12/sigir_sosis_konserve-1.png' },
 { id: 'tuna-haehnchenwuerstchen-dose-250', name: { de: 'Hähnchenwürstchen in der Dose 250 g', tr: 'Tavuk Sosis (Konserve) 250 g' }, category: 'wurstchen', weight: '250 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/12/tavuk_sosis_konserve-1.png' },

 // ═══ PASTIRMA (1) ═══
 { id: 'tuna-pastirma-100', name: { de: 'Rinderrohschinken 100 g', tr: 'Pastırma 100 g' }, category: 'pastirma', weight: '100 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/12/Pastirma_1x.png' },

 // ═══ TİEFKÜHLPRODUKTE (14) ═══
 { id: 'tuna-inegol-kofte-600', name: { de: 'İnegöl Buletten 600 g', tr: 'İnegöl Köfte 600 g' }, category: 'dondurulmus', weight: '600 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/658_inegol_kofte_600g-1.png', nutrition: { energy: '912 kJ – 218 kcal', fat: '16 gr', saturatedFat: '7 gr', carbs: '4 gr', sugar: '0,5 gr', protein: '14 gr', salt: '1,7 gr' }, consumptionInfo: { articleNumber: '658', barcode: '4050164006581', shelfLife: '12 Monat' } },
 { id: 'tuna-rinds-burger-600', name: { de: 'Rinds-Burger 600 g', tr: 'Dana Burger 600 g' }, category: 'dondurulmus', weight: '600 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/656_dana_burger_600g-1.png', nutrition: { energy: '912 kJ – 218 kcal', fat: '16 gr', saturatedFat: '7 gr', carbs: '4 gr', sugar: '0,5 gr', protein: '14 gr', salt: '1,7 gr' }, consumptionInfo: { articleNumber: '659' } },
 { id: 'tuna-kofte-600', name: { de: 'Tuna Buletten 600 g', tr: 'Tuna Köfte 600 g' }, category: 'dondurulmus', weight: '600 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/659_tuna_kofte_600g-1.png', nutrition: { energy: '912 kJ – 218 kcal', fat: '16 gr', saturatedFat: '7 gr', carbs: '4 gr', sugar: '0,5 gr', protein: '14 gr', salt: '1,7 gr' }, consumptionInfo: { articleNumber: '656', barcode: '4050164006567', shelfLife: '12 Monat' } },
 { id: 'tuna-adana-kebap-560', name: { de: 'Adana Kebap 560 g', tr: 'Adana Kebap 560 g' }, category: 'dondurulmus', weight: '560 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/657_adana_kebap_560g-1.png', nutrition: { energy: '912 kJ – 218 kcal', fat: '16 gr', saturatedFat: '7 gr', carbs: '4 gr', sugar: '0,5 gr', protein: '14 gr', salt: '1,7 gr' }, consumptionInfo: { articleNumber: '660', barcode: '4050164006604', shelfLife: '12 Monat' } },
 { id: 'tuna-fleisch-doner-500', name: { de: 'Fleisch Döner gar 500 g', tr: 'Et Döner Pişmiş 500 g' }, category: 'dondurulmus', weight: '500 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/851_et_doner-1.png', nutrition: { energy: '912 kJ – 218 kcal', fat: '16 gr', saturatedFat: '7 gr', carbs: '4 gr', sugar: '0,5 gr', protein: '14 gr', salt: '1,7 gr' }, consumptionInfo: { articleNumber: '851', barcode: '4050164008516', shelfLife: '12 Monat' } },
 { id: 'tuna-haehnchen-burger-540', name: { de: 'Hähnchen Burger 540 g', tr: 'Tavuk Burger 540 g' }, category: 'dondurulmus', weight: '540 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/685_tavuk_burger_540g-1.png' },
 { id: 'tuna-haehnchen-fileto-600', name: { de: 'Hähnchen-Fileto 600 g', tr: 'Tavuk Fileto 600 g' }, category: 'dondurulmus', weight: '600 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/686_tavuk_fileto_600g-1.png' },
 { id: 'tuna-haehnchen-nuggets-500', name: { de: 'Hähnchen Nuggets 500 g', tr: 'Tavuk Nugget 500 g' }, category: 'dondurulmus', weight: '500 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/684_tavuk_nugget_500g-1.png', nutrition: { energy: '853 kJ – 206 kcal', fat: '10 gr', saturatedFat: '3,2 gr', carbs: '14 gr', sugar: '3,3 gr', protein: '13 gr', salt: '1,3 gr' }, consumptionInfo: { articleNumber: '655', barcode: '4050164006550', shelfLife: '12 Monat' } },
 { id: 'tuna-haehnchen-doner-500', name: { de: 'Hähnchen Döner gar 500 g', tr: 'Tavuk Döner Pişmiş 500 g' }, category: 'dondurulmus', weight: '500 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/852_tavuk_doner-1.png' },
 { id: 'tuna-manti-750', name: { de: 'Mantı 750 g', tr: 'Mantı 750 g' }, category: 'dondurulmus', weight: '750 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/688_tuna_manti_750g-1.png', nutrition: { energy: '727 kJ – 177 kcal', fat: '3,5 gr', saturatedFat: '1,4 gr', carbs: '28 gr', sugar: '0,7 gr', protein: '7,5 gr', salt: '0,8 gr' }, consumptionInfo: { articleNumber: '852', barcode: '4050164008523', shelfLife: '12 Monat' } },
 { id: 'tuna-doner-zuhause-500', name: { de: 'Döner für zu Hause 500 g', tr: 'Evde Döner 500 g' }, category: 'dondurulmus', weight: '500 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/673_ev_tipi_doner-1.jpg' },
 { id: 'tuna-hackfleisch-darm-500', name: { de: 'Normales Hackfleisch im Darm 500 g', tr: 'Sucuklu Kıyma 500 g' }, category: 'dondurulmus', weight: '500 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/672_ev_tipi_kiyma-1.jpg' },
 { id: 'tuna-pizza-sucuk', name: { de: 'Pizza Sucuk', tr: 'Sucuklu Pizza' }, category: 'dondurulmus', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2024/03/pizza-sucuk.jpg' },
 { id: 'tuna-lahmacun', name: { de: 'Lahmacun', tr: 'Lahmacun' }, category: 'dondurulmus', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2024/03/lahmacun.jpg' },

 // ═══ LAMMFLEISCH (10) ═══
 { id: 'tuna-lamm-ganz', name: { de: 'Lamm Ganz', tr: 'Bütün Kuzu' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/tum_kuzu-1.png', defaultUnit: 'kg' },
 { id: 'tuna-lamm-koteletten', name: { de: 'Lamm-Koteletten', tr: 'Kuzu Pirzola' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/414_Kuzu_pirzola-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-lammkeule-ohne-knochen', name: { de: 'Lammkeule ohne Knochen', tr: 'Kemiksiz Kuzu But' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/411_kuzu_but_kemiksiz-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-lamm-beinfleisch', name: { de: 'Lamm Beinfleisch', tr: 'Kuzu İncik' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/418_kuzu_incik-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-lammrippen', name: { de: 'Lammrippen', tr: 'Kuzu Kaburga' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/415_kuzu_kaburga-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-lammleber', name: { de: 'Lammleber', tr: 'Kuzu Ciğer' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/421_kuzu_ciger-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-lammhals', name: { de: 'Lammhals', tr: 'Kuzu Gerdan' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/417_kuzu_boyun-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-lamm-keule', name: { de: 'Lamm-Keule', tr: 'Kuzu But (Kemikli)' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/410_kuzu_kemikli-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-lammschulter', name: { de: 'Lammschulter', tr: 'Kuzu Kol' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/416_kuzu_on_kol-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-lamm-schaedel', name: { de: 'Lamm Schädel', tr: 'Kuzu Kelle' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/tunafood-temsili-urun-resmi-1.png', defaultUnit: 'kg' },

 // ═══ RINDFLEISCH (9) ═══
 { id: 'tuna-roastbeef', name: { de: 'Roastbeef', tr: 'Rozbif' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/195_roastbeef-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-ganzes-bullenfleisch', name: { de: 'Ganzes Bullenfleisch', tr: 'Bütün Dana Karkas' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/tosun_karkas-1.png', defaultUnit: 'kg' },
 { id: 'tuna-jungbulle-contrfilet', name: { de: 'Jungbulle Contrfilet', tr: 'Dana Bonfile' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/196_bonfile-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-jungbulle-lappen', name: { de: 'Jungbulle Lappen mit Knochen', tr: 'Dana Kaburga (Kemikli)' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/183_tosun_kaburga_kemikli-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-jungbulle-tantuni', name: { de: 'Jungbulle Tantuni Fleisch', tr: 'Dana Tantuni Et' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/189_tosun_tantuni-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-jungbulle-gulasch', name: { de: 'Jungbulle Gulaschfleisch', tr: 'Dana Kuşbaşı' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/192_tosun_kusbasi-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-jungbulle-teilstueck', name: { de: 'Jungbulle Teilstück', tr: 'Dana Lop Et' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/186_tosun_parca-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-rinderzunge', name: { de: 'Rinderzunge', tr: 'Dana Dil' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/359_sutdana_dil-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-rind-pansen', name: { de: 'Rind Pansen', tr: 'Dana İşkembe' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/358_sutdana_iskembe-1.jpg', defaultUnit: 'kg' },

 // ═══ HACKFLEISCH (3) ═══
 { id: 'tuna-hackfleisch-mager-2kg', name: { de: 'Hackfleisch Mager 2 kg', tr: 'Yağsız Kıyma 2 kg' }, category: 'et', weight: '2 kg', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/210_yagsiz_kiyma-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-rinderhackfleisch-normal', name: { de: 'Rinderhackfleisch Normal', tr: 'Dana Kıyma Normal' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/204_azyagli_kiyma-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-rinderhackfleisch-fettig', name: { de: 'Rinderhackfleisch Fettig', tr: 'Dana Kıyma Yağlı' }, category: 'et', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/207_yagli_kiyma-1.jpg', defaultUnit: 'kg' },

 // ═══ KAVURMA (2) ═══
 { id: 'tuna-kavurma-3kg', name: { de: 'Gebratenes Rindfleisch 3 Kg', tr: 'Baton Kavurma 3 Kg' }, category: 'kavurma', weight: '3 kg', imageSource: 'https://tunafood.com/wp-content/uploads/2024/03/tunafood-baton-kavurma-582.png' },
 { id: 'tuna-kavurma-geschnitten', name: { de: 'Gebratenes Rindfleisch, Geschnitten', tr: 'Dilim Kavurma' }, category: 'kavurma', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2024/03/tunafood-dilim-kavurma-589.png' },

 // ═══ GEFLÜGEL (6) ═══
 { id: 'tuna-haehnchen-ganz', name: { de: 'Hähnchen Ganz', tr: 'Bütün Tavuk' }, category: 'tavuk', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/452_tum_tavuk-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-haehnchenschenkel', name: { de: 'Hähnchenschenkel', tr: 'Tavuk Baget' }, category: 'tavuk', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/459_tavuk_incik-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-haehnchenkeule', name: { de: 'Hähnchenkeule', tr: 'Tavuk But' }, category: 'tavuk', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/453_tavuk_but-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-haehnchenfluegel', name: { de: 'Hähnchenflügel', tr: 'Tavuk Kanat' }, category: 'tavuk', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/458_tavuk_kanat-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-haehnchenfilet', name: { de: 'Hähnchenfilet 600 g', tr: 'Tavuk Göğüs 600 g' }, category: 'tavuk', weight: '600 g', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/456_tavuk_gogus-1.jpg', defaultUnit: 'kg' },
 { id: 'tuna-haehnchenkoteletten', name: { de: 'Hähnchenkoteletten', tr: 'Tavuk Pirzola' }, category: 'tavuk', weight: '', imageSource: 'https://tunafood.com/wp-content/uploads/2020/11/460_tavuk_pirzola-1.jpg', defaultUnit: 'kg' },
];

// Category metadata with TR/DE names and icons
const TUNA_CATEGORIES: Record<string, { name: { tr: string; de: string }; icon: string; order: number }> = {
 sucuk: { name: { tr: 'Sucuk', de: 'Sucuk' }, icon: '🧄', order: 0 },
 wurst: { name: { tr: 'Salam', de: 'Wurst & Aufschnitt' }, icon: '🥓', order: 1 },
 wurstchen: { name: { tr: 'Sosis', de: 'Würstchen' }, icon: '🌭', order: 2 },
 pastirma: { name: { tr: 'Pastırma', de: 'Rinderrohschinken' }, icon: '🥩', order: 3 },
 dondurulmus: { name: { tr: 'Dondurulmuş Ürünler', de: 'Tiefkühlprodukte' }, icon: '🧊', order: 4 },
 et: { name: { tr: 'Et Ürünleri', de: 'Fleisch Produkte' }, icon: '🥩', order: 5 },
 tavuk: { name: { tr: 'Tavuk Ürünleri', de: 'Geflügel' }, icon: '🐔', order: 6 },
 kavurma: { name: { tr: 'Kavurma', de: 'Braten' }, icon: '🍖', order: 7 },
};

function downloadImage(url: string): Promise<Buffer> {
 return new Promise((resolve, reject) => {
 const doRequest = (reqUrl: string, redirectCount = 0) => {
 if (redirectCount > 5) return reject(new Error('Too many redirects'));
 const client = reqUrl.startsWith('https') ? https : http;
 client.get(reqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res: any) => {
 if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
 return doRequest(res.headers.location, redirectCount + 1);
 }
 if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
 const chunks: Buffer[] = [];
 res.on('data', (c: Buffer) => chunks.push(c));
 res.on('end', () => resolve(Buffer.concat(chunks)));
 }).on('error', reject);
 };
 doRequest(url);
 });
}

export async function POST() {
 try {
 const { db: adminDb, storage: adminStorage } = getFirebaseAdmin();
 const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'aylar-a45af.firebasestorage.app';
 const bucket = adminStorage.bucket(bucketName);
 const results: { uploaded: string[]; failed: string[]; skipped: string[] } = {
 uploaded: [], failed: [], skipped: [],
 };

 // 1. Seed category template
 const templateRef = adminDb.collection('defaultMenuTemplates').doc('kasap');
 await templateRef.set({
 name: 'Kasap Şablonu (TUNA Food)',
 description: 'TUNA Food ürün kataloğu: Sucuk, Salam, Sosis, Pastırma, Dondurulmuş, Et, Tavuk, Kavurma',
 updatedAt: new Date().toISOString(),
 categories: Object.entries(TUNA_CATEGORIES).map(([, cat]) => cat),
 }, { merge: true });

 // 2. Process each product: download image → upload to Storage → create Firestore doc
 for (const product of TUNA_PRODUCTS) {
 try {
 // Check if product already has imageUrl in Firestore
 const existingDoc = await adminDb.collection('master_products').doc(product.id).get();
 if (existingDoc.exists && existingDoc.data()?.imageUrl) {
 results.skipped.push(product.id);
 continue;
 }

 // Download image from tunafood.com
 let imageUrl = '';
 if (product.imageSource) {
 try {
 const imageBuffer = await downloadImage(product.imageSource);
 const ext = product.imageSource.match(/\.(png|jpg|jpeg|webp)/i)?.[1] || 'png';
 const storagePath = `products/tuna/${product.id}.${ext}`;
 const file = bucket.file(storagePath);

 await file.save(imageBuffer, {
 metadata: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` },
 public: true,
 });

 imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
 results.uploaded.push(product.id);
 } catch (imgErr: any) {
 console.error(`Image upload failed for ${product.id}:`, imgErr.message);
 results.failed.push(`${product.id} (image: ${imgErr.message})`);
 }
 }

 // Create/update Firestore document
 const catMeta = TUNA_CATEGORIES[product.category];
 const productData: Record<string, any> = {
 id: product.id,
 name: product.name.de,
 nameTr: product.name.tr,
 nameDe: product.name.de,
 category: product.category,
 categoryName: catMeta?.name || {},
 defaultUnit: (product as any).defaultUnit || 'adet',
 weight: product.weight || '',
 imageUrl,
 allowedBusinessTypes: ['kasap'],
 isActive: true,
 source: 'tunafood.com',
 updatedAt: new Date().toISOString(),
 createdAt: existingDoc.exists ? (existingDoc.data()?.createdAt || new Date().toISOString()) : new Date().toISOString(),
 };

 // Add nutrition if available
 if ((product as any).nutrition) {
 productData.nutrition = (product as any).nutrition;
 }

 // Add consumption info if available
 if ((product as any).consumptionInfo) {
 productData.consumptionInfo = (product as any).consumptionInfo;
 if ((product as any).consumptionInfo.barcode) {
 productData.barcode = (product as any).consumptionInfo.barcode;
 }
 }

 await adminDb.collection('master_products').doc(product.id).set(productData, { merge: true });

 } catch (err: any) {
 console.error(`Failed to process ${product.id}:`, err.message);
 results.failed.push(`${product.id}: ${err.message}`);
 }
 }

 return NextResponse.json({
 success: true,
 message: `TUNA Food ürünleri başarıyla seed edildi.`,
 stats: {
 total: TUNA_PRODUCTS.length,
 uploaded: results.uploaded.length,
 skipped: results.skipped.length,
 failed: results.failed.length,
 categories: Object.keys(TUNA_CATEGORIES).length,
 },
 details: results,
 });
 } catch (error: any) {
 console.error('Seed TUNA products error:', error);
 return NextResponse.json(
 { success: false, error: error.message || 'Seed işlemi başarısız' },
 { status: 500 }
 );
 }
}
