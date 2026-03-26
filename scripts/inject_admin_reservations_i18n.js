const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'admin_portal', 'messages');
const locales = ['tr', 'en', 'de', 'nl', 'fr', 'es', 'it'];

const translations = {
  tr: {
    title_rezervasyon: "🍽️ Rezervasyon",
    bu_hafta: "📅 Bu Hafta",
    bu_ay: "📅 Bu Ay",
    masa_yonetimi: "Masa Yönetimi",
    masa_yonetimi_dashboard: "Masa Yönetimi Dashboard",
    kapat: "Kapat",
    cancel_reason_masa_musait_degil: "Masa müsait değil",
    cancel_reason_isletme_kapali: "İşletme kapalı",
    cancel_reason_personel_yetersiz: "Personel yetersiz",
    cancel_reason_musteri_iletisim_yok: "Müşteri ile iletişim kurulamadı",
    cancel_reason_diger: "Diğer"
  },
  en: {
    title_rezervasyon: "🍽️ Reservations",
    bu_hafta: "📅 This Week",
    bu_ay: "📅 This Month",
    masa_yonetimi: "Table Management",
    masa_yonetimi_dashboard: "Table Management Dashboard",
    kapat: "Close",
    cancel_reason_masa_musait_degil: "No table available",
    cancel_reason_isletme_kapali: "Business closed",
    cancel_reason_personel_yetersiz: "Insufficient staff",
    cancel_reason_musteri_iletisim_yok: "Could not contact customer",
    cancel_reason_diger: "Other"
  },
  de: {
    title_rezervasyon: "🍽️ Reservierungen",
    bu_hafta: "📅 Diese Woche",
    bu_ay: "📅 Dieser Monat",
    masa_yonetimi: "Tischverwaltung",
    masa_yonetimi_dashboard: "Tischverwaltung Dashboard",
    kapat: "Schließen",
    cancel_reason_masa_musait_degil: "Kein Tisch verfügbar",
    cancel_reason_isletme_kapali: "Betrieb geschlossen",
    cancel_reason_personel_yetersiz: "Unzureichendes Personal",
    cancel_reason_musteri_iletisim_yok: "Kunde konnte nicht erreicht werden",
    cancel_reason_diger: "Andere"
  },
  // standard fallbacks for others
  nl: {
    title_rezervasyon: "🍽️ Reserveringen",
    bu_hafta: "📅 Deze Week",
    bu_ay: "📅 Deze Maand",
    masa_yonetimi: "Tafelbeheer",
    masa_yonetimi_dashboard: "Tafelbeheer Dashboard",
    kapat: "Sluiten",
    cancel_reason_masa_musait_degil: "Geen tafel beschikbaar",
    cancel_reason_isletme_kapali: "Bedrijf gesloten",
    cancel_reason_personel_yetersiz: "Onvoldoende personeel",
    cancel_reason_musteri_iletisim_yok: "Kon geen contact opnemen met de klant",
    cancel_reason_diger: "Ander"
  },
  fr: {
    title_rezervasyon: "🍽️ Réservations",
    bu_hafta: "📅 Cette Semaine",
    bu_ay: "📅 Ce Mois",
    masa_yonetimi: "Gestion des Tables",
    masa_yonetimi_dashboard: "Tableau de Bord de la Gestion",
    kapat: "Fermer",
    cancel_reason_masa_musait_degil: "Aucune table disponible",
    cancel_reason_isletme_kapali: "Établissement fermé",
    cancel_reason_personel_yetersiz: "Personnel insuffisant",
    cancel_reason_musteri_iletisim_yok: "Impossible de contacter le client",
    cancel_reason_diger: "Autre"
  },
  es: {
    title_rezervasyon: "🍽️ Reservas",
    bu_hafta: "📅 Esta Semana",
    bu_ay: "📅 Este Mes",
    masa_yonetimi: "Gestión de Mesas",
    masa_yonetimi_dashboard: "Panel de Gestión de Mesas",
    kapat: "Cerrar",
    cancel_reason_masa_musait_degil: "No hay mesa disponible",
    cancel_reason_isletme_kapali: "Establecimiento cerrado",
    cancel_reason_personel_yetersiz: "Personal insuficiente",
    cancel_reason_musteri_iletisim_yok: "No se pudo contactar al cliente",
    cancel_reason_diger: "Otro"
  },
  it: {
    title_rezervasyon: "🍽️ Prenotazioni",
    bu_hafta: "📅 Questa Settimana",
    bu_ay: "📅 Questo Mese",
    masa_yonetimi: "Gestione Tavoli",
    masa_yonetimi_dashboard: "Dashboard Gestione Tavoli",
    kapat: "Chiudi",
    cancel_reason_masa_musait_degil: "Nessun tavolo disponibile",
    cancel_reason_isletme_kapali: "Ristorante chiuso",
    cancel_reason_personel_yetersiz: "Personale insufficiente",
    cancel_reason_musteri_iletisim_yok: "Impossibile contattare il cliente",
    cancel_reason_diger: "Altro"
  }
};

let modifiedFiles = 0;

for (const loc of locales) {
  const filePath = path.join(localesDir, `${loc}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`Missing file: ${filePath}`);
    continue;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    
    if (!data.AdminReservations) {
        data.AdminReservations = {};
    }

    let modified = false;
    for (const [key, value] of Object.entries(translations[loc] || translations.en)) {
        if (!data.AdminReservations[key]) {
            data.AdminReservations[key] = value;
            modified = true;
        }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Injected keys into ${loc}.json`);
      modifiedFiles++;
    } else {
        console.log(`Keys already present in ${loc}.json`);
    }
  } catch (err) {
    console.error(`Failed to process ${loc}.json: ${err.message}`);
  }
}

console.log(`Done. Modified ${modifiedFiles} out of ${locales.length} dictionaries.`);
