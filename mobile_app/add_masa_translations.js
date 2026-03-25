const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'assets', 'translations');

const translations = {
  tr: {
    masa_action_title: "Nasıl devam etmek istersiniz?",
    masa_action_reserve: "Masa Rezervasyonu",
    masa_action_reserve_desc: "Hemen yerinizi ayırtın",
    masa_action_browse: "Menüye Göz At",
    masa_action_browse_desc: "Sipariş öncesi menüyü inceleyin"
  },
  de: {
    masa_action_title: "Wie möchten Sie fortfahren?",
    masa_action_reserve: "Tisch Reservieren",
    masa_action_reserve_desc: "Jeden Sitzplatz sofort sichern",
    masa_action_browse: "Menü ansehen",
    masa_action_browse_desc: "Menü vor der Bestellung überprüfen"
  },
  en: {
    masa_action_title: "How would you like to proceed?",
    masa_action_reserve: "Table Reservation",
    masa_action_reserve_desc: "Secure your seat immediately",
    masa_action_browse: "Browse Menu",
    masa_action_browse_desc: "Check the menu before ordering"
  },
  nl: {
    masa_action_title: "Hoe wilt u verdergaan?",
    masa_action_reserve: "Tafelreservering",
    masa_action_reserve_desc: "Reserveer direct uw plek",
    masa_action_browse: "Bekijk menu",
    masa_action_browse_desc: "Bekijk het menu voordat u bestelt"
  },
  fr: {
    masa_action_title: "Comment souhaitez-vous procéder ?",
    masa_action_reserve: "Réservation de table",
    masa_action_reserve_desc: "Sécurisez votre place immédiatement",
    masa_action_browse: "Parcourir le menu",
    masa_action_browse_desc: "Consultez le menu avant de commander"
  },
  it: {
    masa_action_title: "Come vuoi procedere?",
    masa_action_reserve: "Prenotazione tavolo",
    masa_action_reserve_desc: "Assicurati subito il tuo posto",
    masa_action_browse: "Sfoglia il menu",
    masa_action_browse_desc: "Controlla il menu prima di ordinare"
  },
  es: {
    masa_action_title: "¿Cómo te gustaría proceder?",
    masa_action_reserve: "Reserva de mesa",
    masa_action_reserve_desc: "Asegura tu lugar de inmediato",
    masa_action_browse: "Ver menú",
    masa_action_browse_desc: "Revise el menú antes de ordenar"
  }
};

for (const [lang, keys] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.marketplace) {
      data.marketplace = {};
    }
    
    // Assign individual translations
    Object.assign(data.marketplace, keys);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated ${lang}.json`);
  } else {
    console.error(`Missing ${lang}.json`);
  }
}
