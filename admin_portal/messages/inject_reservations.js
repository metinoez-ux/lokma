const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'nl', 'fr', 'es', 'it'];
const dir = __dirname;

const translations = {
  tr: {
    "rezervasyon_reddet": "Rezervasyonu Reddet",
    "rezervasyon_iptal_et": "Rezervasyonu İptal Et",
    "choose_reject_reason": "Reddetme Sebebi Seçin:",
    "iptal_sebebi": "İptal Sebebi:",
    "reject_reason_masa_dolu": "Masa Dolu / Kapasite Aşımı",
    "reject_reason_saat_uygun_degil": "Saat Uygun Değil / Kapalıyız",
    "reject_reason_eksik_bilgi": "İletişim Bilgisi Eksik/Yanlış",
    "cancel_reason_diger": "Diğer",
    "cancel_reason_masa_musait_degil": "Masa Müsait Değil",
    "cancel_reason_isletme_kapali": "İşletme Kapalı",
    "cancel_reason_personel_yetersiz": "Personel Yetersiz",
    "cancel_reason_musteri_iletisim_yok": "Müşteri İletişim Yok",
    "ek_notlar": "Ek Notlar (İsteğe Bağlı)",
    "musteriye_iletilecek_not": "Müşteriye iletilecek notu yazın...",
    "reddet": "Reddet",
    "iptal_et": "İptal Et"
  },
  en: {
    "rezervasyon_reddet": "Reject Reservation",
    "rezervasyon_iptal_et": "Cancel Reservation",
    "choose_reject_reason": "Choose Rejection Reason:",
    "iptal_sebebi": "Cancellation Reason:",
    "reject_reason_masa_dolu": "Table Full / Over Capacity",
    "reject_reason_saat_uygun_degil": "Time Not Suitable / Closed",
    "reject_reason_eksik_bilgi": "Contact Info Missing/Incorrect",
    "cancel_reason_diger": "Other",
    "cancel_reason_masa_musait_degil": "Table Unavailable",
    "cancel_reason_isletme_kapali": "Business Closed",
    "cancel_reason_personel_yetersiz": "Insufficient Staff",
    "cancel_reason_musteri_iletisim_yok": "No Customer Contact",
    "ek_notlar": "Additional Notes (Optional)",
    "musteriye_iletilecek_not": "Write note to customer...",
    "reddet": "Reject",
    "iptal_et": "Cancel"
  },
  de: {
    "rezervasyon_reddet": "Reservierung ablehnen",
    "rezervasyon_iptal_et": "Reservierung stornieren",
    "choose_reject_reason": "Ablehnungsgrund wählen:",
    "iptal_sebebi": "Stornierungsgrund:",
    "reject_reason_masa_dolu": "Tisch besetzt / Überkapazität",
    "reject_reason_saat_uygun_degil": "Zeit unpassend / Geschlossen",
    "reject_reason_eksik_bilgi": "Kontaktinfo fehlt/falsch",
    "cancel_reason_diger": "Sonstiges",
    "cancel_reason_masa_musait_degil": "Tisch nicht verfügbar",
    "cancel_reason_isletme_kapali": "Geschäft geschlossen",
    "cancel_reason_personel_yetersiz": "Personalmangel",
    "cancel_reason_musteri_iletisim_yok": "Kein Kundenkontakt",
    "ek_notlar": "Zusätzliche Notizen (Optional)",
    "musteriye_iletilecek_not": "Notiz an den Kunden schreiben...",
    "reddet": "Ablehnen",
    "iptal_et": "Stornieren"
  },
  nl: {
    "rezervasyon_reddet": "Reservering afwijzen",
    "rezervasyon_iptal_et": "Reservering annuleren",
    "choose_reject_reason": "Kies afwijzingsreden:",
    "iptal_sebebi": "Annuleringsreden:",
    "reject_reason_masa_dolu": "Tafel vol / Boven capaciteit",
    "reject_reason_saat_uygun_degil": "Tijdstip ongeschikt / Gesloten",
    "reject_reason_eksik_bilgi": "Contactgegevens missen/fout",
    "cancel_reason_diger": "Anders",
    "cancel_reason_masa_musait_degil": "Tafel niet beschikbaar",
    "cancel_reason_isletme_kapali": "Bedrijf gesloten",
    "cancel_reason_personel_yetersiz": "Te weinig personeel",
    "cancel_reason_musteri_iletisim_yok": "Geen klantcontact",
    "ek_notlar": "Extra notities (Optioneel)",
    "musteriye_iletilecek_not": "Schrijf notitie naar klant...",
    "reddet": "Afwijzen",
    "iptal_et": "Annuleren"
  },
  fr: {
    "rezervasyon_reddet": "Rejeter la réservation",
    "rezervasyon_iptal_et": "Annuler la réservation",
    "choose_reject_reason": "Choisissez le motif d'annulation:",
    "iptal_sebebi": "Motif d'annulation:",
    "reject_reason_masa_dolu": "Table complète / Surcapacité",
    "reject_reason_saat_uygun_degil": "Heure inadaptée / Fermé",
    "reject_reason_eksik_bilgi": "Infos de contact manquantes/incorrectes",
    "cancel_reason_diger": "Autre",
    "cancel_reason_masa_musait_degil": "Table indisponible",
    "cancel_reason_isletme_kapali": "Entreprise fermée",
    "cancel_reason_personel_yetersiz": "Personnel insuffisant",
    "cancel_reason_musteri_iletisim_yok": "Aucun contact client",
    "ek_notlar": "Notes supplémentaires (Optionnel)",
    "musteriye_iletilecek_not": "Écrire une note au client...",
    "reddet": "Rejeter",
    "iptal_et": "Annuler"
  },
  es: {
    "rezervasyon_reddet": "Rechazar reserva",
    "rezervasyon_iptal_et": "Cancelar reserva",
    "choose_reject_reason": "Elija la razón de rechazo:",
    "iptal_sebebi": "Razón de cancelación:",
    "reject_reason_masa_dolu": "Mesa llena / Sobrecapacidad",
    "reject_reason_saat_uygun_degil": "Hora no adecuada / Cerrado",
    "reject_reason_eksik_bilgi": "Falta información de contacto/incorrecta",
    "cancel_reason_diger": "Otro",
    "cancel_reason_masa_musait_degil": "Mesa no disponible",
    "cancel_reason_isletme_kapali": "Negocio cerrado",
    "cancel_reason_personel_yetersiz": "Personal insuficiente",
    "cancel_reason_musteri_iletisim_yok": "Sin contacto de cliente",
    "ek_notlar": "Notas adicionales (Opcional)",
    "musteriye_iletilecek_not": "Escribir nota al cliente...",
    "reddet": "Rechazar",
    "iptal_et": "Cancelar"
  },
  it: {
    "rezervasyon_reddet": "Rifiuta prenotazione",
    "rezervasyon_iptal_et": "Annulla prenotazione",
    "choose_reject_reason": "Scegli il motivo del rifiuto:",
    "iptal_sebebi": "Motivo della cancellazione:",
    "reject_reason_masa_dolu": "Tavolo occupato / Sovraccapacità",
    "reject_reason_saat_uygun_degil": "Ora non adatta / Chiuso",
    "reject_reason_eksik_bilgi": "Info di contatto mancanti/errate",
    "cancel_reason_diger": "Altro",
    "cancel_reason_masa_musait_degil": "Tavolo non disponibile",
    "cancel_reason_isletme_kapali": "Azienda chiusa",
    "cancel_reason_personel_yetersiz": "Personale insufficiente",
    "cancel_reason_musteri_iletisim_yok": "Nessun contatto cliente",
    "ek_notlar": "Note aggiuntive (Opzionale)",
    "musteriye_iletilecek_not": "Scrivi nota al cliente...",
    "reddet": "Rifiuta",
    "iptal_et": "Annulla"
  }
};

locales.forEach(loc => {
  const filePath = path.join(dir, `${loc}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  let data = JSON.parse(content);
  
  if (!data['AdminPortal']) {
    data['AdminPortal'] = {};
  }
  if (!data['AdminPortal']['Reservations']) {
    data['AdminPortal']['Reservations'] = {};
  }
  
  const newTrans = translations[loc];
  for (const [key, val] of Object.entries(newTrans)) {
    data['AdminPortal']['Reservations'][key] = val;
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Updated ${loc}.json`);
});
