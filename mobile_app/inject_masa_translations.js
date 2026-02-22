const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join(__dirname, 'assets', 'translations');
const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

const newTranslations = {
    "order_from_table": {
        "tr": "Masanızdan Sipariş Verin",
        "en": "Order from Your Table",
        "de": "Bestellen Sie an Ihrem Tisch",
        "fr": "Commandez de votre table",
        "it": "Ordina dal tuo tavolo",
        "es": "Ordena desde tu mesa"
    },
    "order_qr_desc": {
        "tr": "QR kodu okutarak hızlıca sipariş verebilir veya masa rezervasyonu yapabilirsiniz",
        "en": "You can quickly order by scanning the QR code or make a table reservation",
        "de": "Sie können schnell per QR-Code bestellen oder einen Tisch reservieren",
        "fr": "Vous pouvez commander rapidement en scannant le code QR ou réserver une table",
        "it": "Puoi ordinare rapidamente scansionando il codice QR o prenotare un tavolo",
        "es": "Puede ordenar rápidamente escaneando el código QR o reservar una mesa"
    },
    "return_active_order": {
        "tr": "Aktif Siparişinize Dönün",
        "en": "Return to Active Order",
        "de": "Zur aktiven Bestellung zurückkehren",
        "fr": "Retourner à la commande active",
        "it": "Torna all'ordine attivo",
        "es": "Volver al pedido activo"
    },
    "return_active_desc": {
        "tr": "Önceki masanıza hemen geçin",
        "en": "Quickly switch to your previous table",
        "de": "Wechseln Sie schnell zu Ihren vorherigen Tisch",
        "fr": "Passez rapidement à votre table précédente",
        "it": "Passa rapidamente al tuo tavolo precedente",
        "es": "Cambie rápidamente a su mesa anterior"
    },
    "order_with_qr": {
        "tr": "QR ile Sipariş Ver",
        "en": "Order with QR",
        "de": "Mit QR-Code bestellen",
        "fr": "Commander avec QR",
        "it": "Ordina con QR",
        "es": "Ordenar con QR"
    },
    "scan_qr_table": {
        "tr": "Masanızdaki QR kodu okutun",
        "en": "Scan the QR code on your table",
        "de": "Scannen Sie den QR-Code an Ihrem Tisch",
        "fr": "Scannez le code QR sur votre table",
        "it": "Scansiona il codice QR sul tuo tavolo",
        "es": "Escanee el código QR en su mesa"
    },
    "table_reservation": {
        "tr": "Masa Rezervasyonu",
        "en": "Table Reservation",
        "de": "Tischreservierung",
        "fr": "Réservation de table",
        "it": "Prenotazione tavolo",
        "es": "Reserva de mesa"
    },
    "book_table_advance": {
        "tr": "Önceden masa ayırtın",
        "en": "Book a table in advance",
        "de": "Buchen Sie im Voraus einen Tisch",
        "fr": "Réservez une table à l'avance",
        "it": "Prenota un tavolo in anticipo",
        "es": "Reserve una mesa con anticipación"
    },
    "how_it_works": {
        "tr": "Nasıl Çalışır?",
        "en": "How it Works?",
        "de": "Wie es funktioniert?",
        "fr": "Comment ça marche ?",
        "it": "Come funziona?",
        "es": "¿Cómo funciona?"
    },
    "scan_qr_code": {
        "tr": "QR Kodu Okutun",
        "en": "Scan QR Code",
        "de": "QR-Code scannen",
        "fr": "Scanner le code QR",
        "it": "Scansiona il codice QR",
        "es": "Escanear código QR"
    },
    "scan_qr_table_alt": {
        "tr": "Masanızdaki QR kodu tarayın",
        "en": "Scan the QR code on your table",
        "de": "Scannen Sie den QR-Code an Ihrem Tisch",
        "fr": "Scannez le code QR sur votre table",
        "it": "Scansiona il codice QR sul tuo tavolo",
        "es": "Escanee el código QR en su mesa"
    },
    "choose_from_menu": {
        "tr": "Menüden Seçin",
        "en": "Choose from Menu",
        "de": "Aus der Speisekarte wählen",
        "fr": "Choisir dans le menu",
        "it": "Scegli dal menu",
        "es": "Elija del menú"
    },
    "add_your_meals": {
        "tr": "Yemeklerinizi ekleyin",
        "en": "Add your meals",
        "de": "Fügen Sie Ihre Mahlzeiten hinzu",
        "fr": "Ajoutez vos repas",
        "it": "Aggiungi i tuoi pasti",
        "es": "Agregue sus comidas"
    },
    "confirm_order": {
        "tr": "Siparişi Onaylayın",
        "en": "Confirm Order",
        "de": "Bestellung bestätigen",
        "fr": "Confirmer la commande",
        "it": "Conferma ordine",
        "es": "Confirmar pedido"
    },
    "served_to_table": {
        "tr": "Masanıza servis edilsin",
        "en": "It will be served to your table",
        "de": "Es wird an Ihrem Tisch serviert",
        "fr": "Il sera servi à votre table",
        "it": "Sarà servito al tuo tavolo",
        "es": "Será servido en su mesa"
    },
    "session_expired": {
        "tr": "Sipariş oturumu bulunamadı veya süresi dolmuş.",
        "en": "Order session not found or expired.",
        "de": "Bestellsitzung nicht gefunden oder abgelaufen.",
        "fr": "Session de commande non trouvée ou expirée.",
        "it": "Sessione ordine non trovata o scaduta.",
        "es": "Sesión de pedido no encontrada o caducada."
    }
};

LANGUAGES.forEach(lang => {
    const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let translations = JSON.parse(fileContent);

        if (!translations.home) {
            translations.home = {};
        }

        Object.keys(newTranslations).forEach(key => {
            translations.home[key] = newTranslations[key][lang];
        });

        fs.writeFileSync(filePath, JSON.stringify(translations, null, 2), 'utf8');
        console.log(`Updated ${lang}.json`);
    } else {
        console.warn(`${filePath} not found.`);
    }
});
