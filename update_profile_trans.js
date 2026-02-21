const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join(__dirname, 'mobile_app/assets/translations');
const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

const newProfileKeys = {
    tr: {
        login_subtitle: "Siparişlerinizi takip etmek ve özel fırsatlardan yararlanmak için giriş yapın.",
        login_register_button: "Giriş Yap / Kayıt Ol",
        continue_as_guest: "Misafir olarak devam et",
        login_error: "Giriş hatası",
        profile_photo: "Profil Fotoğrafı",
        camera: "Kamera",
        take_new_photo: "Yeni fotoğraf çek",
        gallery: "Galeri",
        choose_from_gallery: "Galeriden seç",
        photo_updated: "Profil fotoğrafı güncellendi",
        greeting: "Merhaba",
        staff_login: "Personel Girişi",
        delivery: "Teslimat",
        reservation: "Rezervasyon",
        version: "Versiyon",
        error: "Hata"
    },
    en: {
        login_subtitle: "Log in to track your orders and enjoy special offers.",
        login_register_button: "Log In / Register",
        continue_as_guest: "Continue as guest",
        login_error: "Login error",
        profile_photo: "Profile Photo",
        camera: "Camera",
        take_new_photo: "Take new photo",
        gallery: "Gallery",
        choose_from_gallery: "Choose from gallery",
        photo_updated: "Profile photo updated",
        greeting: "Hello",
        staff_login: "Staff Login",
        delivery: "Delivery",
        reservation: "Reservation",
        version: "Version",
        error: "Error"
    },
    de: {
        login_subtitle: "Melden Sie sich an, um Ihre Bestellungen zu verfolgen und Sonderangebote zu nutzen.",
        login_register_button: "Anmelden / Registrieren",
        continue_as_guest: "Als Gast fortfahren",
        login_error: "Anmeldefehler",
        profile_photo: "Profilfoto",
        camera: "Kamera",
        take_new_photo: "Neues Foto machen",
        gallery: "Galerie",
        choose_from_gallery: "Aus Galerie wählen",
        photo_updated: "Profilfoto aktualisiert",
        greeting: "Hallo",
        staff_login: "Mitarbeiter-Login",
        delivery: "Lieferung",
        reservation: "Reservierung",
        version: "Version",
        error: "Fehler"
    },
    fr: {
        login_subtitle: "Connectez-vous pour suivre vos commandes et profiter d'offres spéciales.",
        login_register_button: "Connexion / Inscription",
        continue_as_guest: "Continuer en tant qu'invité",
        login_error: "Erreur de connexion",
        profile_photo: "Photo de profil",
        camera: "Caméra",
        take_new_photo: "Prendre une nouvelle photo",
        gallery: "Galerie",
        choose_from_gallery: "Choisir depuis la galerie",
        photo_updated: "Photo de profil mise à jour",
        greeting: "Bonjour",
        staff_login: "Accès personnel",
        delivery: "Livraison",
        reservation: "Réservation",
        version: "Version",
        error: "Erreur"
    },
    it: {
        login_subtitle: "Accedi per tracciare i tuoi ordini e godere di offerte speciali.",
        login_register_button: "Accedi / Registrati",
        continue_as_guest: "Continua come ospite",
        login_error: "Errore di accesso",
        profile_photo: "Foto Profilo",
        camera: "Fotocamera",
        take_new_photo: "Scatta una nuova foto",
        gallery: "Galleria",
        choose_from_gallery: "Scegli dalla galleria",
        photo_updated: "Foto del profilo aggiornata",
        greeting: "Ciao",
        staff_login: "Accesso personale",
        delivery: "Consegna",
        reservation: "Prenotazione",
        version: "Versione",
        error: "Errore"
    },
    es: {
        login_subtitle: "Inicia sesión para rastrear tus pedidos y disfrutar de ofertas especiales.",
        login_register_button: "Iniciar Sesión / Registrarse",
        continue_as_guest: "Continuar como invitado",
        login_error: "Error de inicio de sesión",
        profile_photo: "Foto de perfil",
        camera: "Cámara",
        take_new_photo: "Tomar una foto nueva",
        gallery: "Galería",
        choose_from_gallery: "Elegir de la galería",
        photo_updated: "Foto de perfil actualizada",
        greeting: "Hola",
        staff_login: "Acceso del personal",
        delivery: "Entrega",
        reservation: "Reserva",
        version: "Versión",
        error: "Error"
    }
};

async function updateTrans() {
    for (const lang of LANGUAGES) {
        const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
        let content = {};
        if (fs.existsSync(filePath)) {
            content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        if (!content.profile) content.profile = {};

        content.profile = {
            ...content.profile,
            ...newProfileKeys[lang]
        };

        fs.writeFileSync(filePath, JSON.stringify(content, null, 4));
        console.log(`Updated ${lang}.json`);
    }
}

updateTrans();
