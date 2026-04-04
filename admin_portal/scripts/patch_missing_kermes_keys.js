const fs = require('fs');
const path = require('path');

const locales = ['de', 'en', 'es', 'fr', 'it', 'nl', 'tr'];
const dir = path.join(__dirname, '../messages');

const translations = {
    tr: { 
        email_opsiyonel: "E-posta (Istege Bagli)",
        surucu_atandi_bilgi: "kisi surucu olarak atandi. Siparis teslimatlari bu kisilere yonlendirilecek.",
        kaydedildi: "Kaydedildi",
        hata_olustu: "Bir hata olustu",
        personel_silindi: "Personel sistemden tamamen silindi",
        personel_silinirken_hata: "Personel silinirken hata",
        personel_olusturuldu: "Personel olusturuldu ve atandi",
        personel_zaten_var_uyari: "Bu e-posta veya telefon ile kayitli kullanici var. Arama ile bulup atayin.",
        isletme_bilgisi_bulunamadi: "Isletme bilgisi bulunamadi.",
        bir_hata_olustu: "Bir hata olustu",
        cinsiyet_zorunlu: "Kermes personeli icin cinsiyet secimi zorunludur",
    },
    de: { 
        email_opsiyonel: "E-Mail (Optional)",
        surucu_atandi_bilgi: "Person(en) als Fahrer zugewiesen. Bestellungen werden an sie weitergeleitet.",
        kaydedildi: "Gespeichert",
        hata_olustu: "Ein Fehler ist aufgetreten",
        personel_silindi: "Personal wurde vollstaendig aus dem System entfernt",
        personel_silinirken_hata: "Fehler beim Entfernen des Personals",
        personel_olusturuldu: "Personal wurde erstellt und zugewiesen",
        personel_zaten_var_uyari: "Ein Benutzer mit dieser E-Mail oder Telefonnummer existiert bereits. Suchen und zuweisen.",
        isletme_bilgisi_bulunamadi: "Unternehmensinformationen nicht gefunden.",
        bir_hata_olustu: "Ein Fehler ist aufgetreten",
        cinsiyet_zorunlu: "Geschlechtsauswahl ist fuer Kermes-Personal erforderlich",
    },
    en: { 
        email_opsiyonel: "Email (Optional)",
        surucu_atandi_bilgi: "person(s) assigned as driver. Orders will be routed to them.",
        kaydedildi: "Saved",
        hata_olustu: "An error occurred",
        personel_silindi: "Staff member has been completely removed from the system",
        personel_silinirken_hata: "Error while removing staff member",
        personel_olusturuldu: "Staff member created and assigned",
        personel_zaten_var_uyari: "A user with this email or phone already exists. Search and assign instead.",
        isletme_bilgisi_bulunamadi: "Business information not found.",
        bir_hata_olustu: "An error occurred",
        cinsiyet_zorunlu: "Gender selection is required for Kermes staff",
    },
    es: { 
        email_opsiyonel: "Correo Electronico (Opcional)",
        surucu_atandi_bilgi: "persona(s) asignada(s) como conductor. Los pedidos se enviaran a ellos.",
        kaydedildi: "Guardado",
        hata_olustu: "Se ha producido un error",
        personel_silindi: "El personal ha sido eliminado completamente del sistema",
        personel_silinirken_hata: "Error al eliminar el personal",
        personel_olusturuldu: "Personal creado y asignado",
        personel_zaten_var_uyari: "Ya existe un usuario con este correo o telefono. Busque y asigne.",
        isletme_bilgisi_bulunamadi: "Informacion de la empresa no encontrada.",
        bir_hata_olustu: "Se ha producido un error",
        cinsiyet_zorunlu: "La seleccion de genero es obligatoria para el personal del Kermes",
    },
    fr: { 
        email_opsiyonel: "E-mail (Facultatif)",
        surucu_atandi_bilgi: "personne(s) assignee(s) comme livreur. Les commandes leur seront envoyees.",
        kaydedildi: "Enregistre",
        hata_olustu: "Une erreur s'est produite",
        personel_silindi: "Le personnel a ete completement supprime du systeme",
        personel_silinirken_hata: "Erreur lors de la suppression du personnel",
        personel_olusturuldu: "Personnel cree et assigne",
        personel_zaten_var_uyari: "Un utilisateur avec cet e-mail ou telephone existe deja. Recherchez et assignez.",
        isletme_bilgisi_bulunamadi: "Informations de l'entreprise introuvables.",
        bir_hata_olustu: "Une erreur s'est produite",
        cinsiyet_zorunlu: "La selection du sexe est requise pour le personnel Kermes",
    },
    it: { 
        email_opsiyonel: "Email (Opzionale)",
        surucu_atandi_bilgi: "persona/e assegnata/e come autista. Gli ordini verranno inviati a loro.",
        kaydedildi: "Salvato",
        hata_olustu: "Si e verificato un errore",
        personel_silindi: "Il personale e stato completamente rimosso dal sistema",
        personel_silinirken_hata: "Errore durante la rimozione del personale",
        personel_olusturuldu: "Personale creato e assegnato",
        personel_zaten_var_uyari: "Un utente con questa email o telefono esiste gia. Cerca e assegna.",
        isletme_bilgisi_bulunamadi: "Informazioni aziendali non trovate.",
        bir_hata_olustu: "Si e verificato un errore",
        cinsiyet_zorunlu: "La selezione del genere e obbligatoria per il personale Kermes",
    },
    nl: { 
        email_opsiyonel: "E-mail (Optioneel)",
        surucu_atandi_bilgi: "persoon/personen toegewezen als chauffeur. Bestellingen worden naar hen doorgestuurd.",
        kaydedildi: "Opgeslagen",
        hata_olustu: "Er is een fout opgetreden",
        personel_silindi: "Personeel is volledig uit het systeem verwijderd",
        personel_silinirken_hata: "Fout bij het verwijderen van personeel",
        personel_olusturuldu: "Personeel aangemaakt en toegewezen",
        personel_zaten_var_uyari: "Er bestaat al een gebruiker met dit e-mailadres of telefoonnummer. Zoek en wijs toe.",
        isletme_bilgisi_bulunamadi: "Bedrijfsinformatie niet gevonden.",
        bir_hata_olustu: "Er is een fout opgetreden",
        cinsiyet_zorunlu: "Geslachtsselectie is vereist voor Kermes-personeel",
    }
};

for (const loc of locales) {
    const file = path.join(dir, `${loc}.json`);
    if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(raw);
        if (json.AdminKermesDetail) {
            let patched = false;
            for (const [key, value] of Object.entries(translations[loc])) {
                if (!json.AdminKermesDetail[key]) {
                    json.AdminKermesDetail[key] = value;
                    patched = true;
                }
            }
            if (patched) {
                fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
                console.log(`Patched ${loc}.json`);
            } else {
                console.log(`${loc}.json - all keys present`);
            }
        }
    }
}
