const fs = require('fs');
const path = require('path');

const trPath = '/Users/metinoz/Developer/LOKMA/admin_portal/messages/tr.json';
const dePath = '/Users/metinoz/Developer/LOKMA/admin_portal/messages/de.json';
const enPath = '/Users/metinoz/Developer/LOKMA/admin_portal/messages/en.json';

const trData = JSON.parse(fs.readFileSync(trPath, 'utf8'));
const deData = JSON.parse(fs.readFileSync(dePath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Helper to add translation
function addTranslation(namespace, key, trObj) {
  if (!trData[namespace]) trData[namespace] = {};
  if (!deData[namespace]) deData[namespace] = {};
  if (!enData[namespace]) enData[namespace] = {};

  if (!trData[namespace][key]) trData[namespace][key] = trObj.tr || trObj.de;
  if (!deData[namespace][key]) deData[namespace][key] = trObj.de || trObj.tr;
  if (!enData[namespace][key]) enData[namespace][key] = trObj.en || trObj.tr;
}

// -------------------------------------------------------------
// 1. Commissions -> AdminCommissions
const ns_comm = 'AdminCommissions';
const commKVs = {
  provizyon_raporu: { tr: "💰 Provizyon Raporu", de: "💰 Provisionsbericht", en: "💰 Commission Report" },
  ciro: { tr: "Ciro", de: "Umsatz", en: "Revenue" },
  tahsil_edilen: { tr: "Tahsil Edilen", de: "Eingezogen", en: "Collected" },
  kart_provizyon: { tr: "Kart Provizyon", de: "Karten-Provision", en: "Card Commission" },
  nakit_provizyon: { tr: "Nakit Provizyon", de: "Bar-Provision", en: "Cash Commission" },
  temizle: { tr: "Temizle", de: "Zurücksetzen", en: "Clear" },
  plan: { tr: "Plan", de: "Plan", en: "Plan" },
  provizyon: { tr: "Provizyon", de: "Provision", en: "Commission" },
  kart: { tr: "Kart", de: "Karte", en: "Card" },
  nakit: { tr: "Nakit", de: "Bar", en: "Cash" },
  oran: { tr: "Oran", de: "Satz", en: "Rate" },
  net_kdv: { tr: "Net + KDV", de: "Netto + MwSt", en: "Net + VAT" },
  siparis_detaylari_yukleniyor: { tr: "Sipariş detayları yükleniyor...", de: "Bestelldetails werden geladen...", en: "Loading order details..." },
  siparis_detayi_bulunamadi_sadece_provizyon: { tr: "Sipariş detayı bulunamadı, sadece provizyon bilgisi gösteriliyor.", de: "Bestelldetail nicht gefunden, nur Provision wird angezeigt.", en: "Order detail not found, only commission is shown." },
  teslim_edildi: { tr: "✅ Teslim Edildi", de: "✅ Zugestellt", en: "✅ Delivered" },
  iptal: { tr: "❌ İptal", de: "❌ Storniert", en: "❌ Cancelled" },
  musteri_bilgileri: { tr: "MÜŞTERİ BİLGİLERİ", de: "KUNDENDATEN", en: "CUSTOMER INFO" },
  ad_soyad: { tr: "Ad Soyad", de: "Name", en: "Name" },
  telefon: { tr: "Telefon", de: "Telefon", en: "Phone" },
  eposta: { tr: "E-posta", de: "E-Mail", en: "Email" },
  teslimat_adresi: { tr: "Teslimat Adresi", de: "Lieferadresse", en: "Delivery Address" },
  siparis_icerigi: { tr: "SİPARİŞ İÇERİĞİ", de: "BESTELLINHALT", en: "ORDER CONTENTS" },
  kurye_bilgileri: { tr: "KURYE BİLGİLERİ", de: "FAHRER-INFO", en: "DRIVER INFO" },
  kurye_adi: { tr: "Kurye Adı", de: "Name d. Fahrers", en: "Driver Name" },
  kurye_telefon: { tr: "Kurye Telefonu", de: "Telefon d. Fahrers", en: "Driver Phone" },
  teslimat_kaniti: { tr: "Teslimat Kanıtı", de: "Liefernachweis", en: "Proof of Delivery" },
  zaman_cizelgesi: { tr: "ZAMAN ÇİZELGESİ", de: "ZEITLEISTE", en: "TIMELINE" },
  toplam_sure: { tr: "Toplam Süre", de: "Dauer", en: "Total Time" },
  provizyon_detayi: { tr: "PROVİZYON DETAYI", de: "PROVISIONSDETAILS", en: "COMMISSION DETAILS" },
  siparis_tutari: { tr: "Sipariş Tutarı", de: "Bestellwert", en: "Order Total" },
  siparis_basi_ucret: { tr: "Sipariş Başı Ücret", de: "Gebühr pro Bestellung", en: "Fee per Order" },
  siparis_notu: { tr: "SİPARİŞ NOTU", de: "BESTELLNOTIZ", en: "ORDER NOTE" }
};
for(const k in commKVs) addTranslation(ns_comm, k, commKVs[k]);

// -------------------------------------------------------------
// 2. Ameise -> Ameise 
const ns_ameise = 'Ameise';
const ameiseKVs = {
  zugriff_verweigert: { tr: "Erişim Reddedildi", de: "Zugriff verweigert", en: "Access Denied" },
  datenimport_export: { tr: "Veri İçe/Dışa Aktarma ve Temizleme", de: "Datenimport, Export und Bereinigung", en: "Data import, export and cleanup" },
  betriebe_export_import: { tr: "İşletme İçe/Dışa Aktar", de: "Betriebe Export / Import", en: "Business Export / Import" },
  betriebe_export_desc: { tr: "Tüm işletmeleri kategorileri, ürünleri ve açılış saatleriyle birlikte JSON olarak yedekleyin veya geri yükleyin.", de: "Alle Betriebe mit Kategorien, Produkten, Öffnungszeiten und allen Daten als JSON sichern oder wiederherstellen.", en: "Export or import all businesses along with categories, products, and schedules as JSON." },
  exportiere: { tr: "Dışa aktarılıyor...", de: "Exportiere...", en: "Exporting..." },
  import_vorschu: { tr: "İçe Aktarma Önizlemesi", de: "Import-Vorschau", en: "Import Preview" },
  schliessen: { tr: "Kapat", de: "Schließen", en: "Close" },
  importiere: { tr: "İçe aktarılıyor...", de: "Importiere...", en: "Importing..." },
  abbrechen: { tr: "İptal", de: "Abbrechen", en: "Cancel" },
  betrieb_import_google: { tr: "Google Places İşletme Aktar", de: "Betrieb Import (Google Places)", en: "Business Import (Google Places)" }
};
for(const k in ameiseKVs) addTranslation(ns_ameise, k, ameiseKVs[k]);

// Write files back
fs.writeFileSync(trPath, JSON.stringify(trData, null, 4));
fs.writeFileSync(dePath, JSON.stringify(deData, null, 4));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 4));

console.log("Translations added properly.");
