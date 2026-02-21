const fs = require('fs');
const path = require('path');

const TRANSLATIONS = {
    tr: {}, en: {}, de: {}, fr: {}, it: {}, es: {}
};

// Map literal static strings
const staticDict = {
    "Yardım": { domain: "profile", key: "help", en: "Help", de: "Hilfe", fr: "Aide", it: "Aiuto", es: "Ayuda" },
    "Sıkça Sorulan Sorular": { domain: "profile", key: "faq", en: "Frequently Asked Questions", de: "Häufig gestellte Fragen", fr: "Foire aux questions", it: "Domande frequenti", es: "Preguntas frecuentes" },
    "Yardıma mı ihtiyacınız var?": { domain: "profile", key: "need_help", en: "Need help?", de: "Brauchen Sie Hilfe?", fr: "Besoin d'aide ?", it: "Hai bisogno di aiuto?", es: "¿Necesitas ayuda?" },
    "Bize ulaşmak için:": { domain: "profile", key: "contact_us", en: "Contact us:", de: "Kontaktiere uns:", fr: "Nous contacter :", it: "Contattaci:", es: "Contáctenos:" },
    "E-posta kopyalandı": { domain: "common", key: "email_copied", en: "Email copied", de: "E-Mail kopiert", fr: "E-mail copié", it: "Email copiata", es: "Correo electrónico copiado" },
    "Lütfen en az 3 karakter girin.": { domain: "common", key: "min_3_chars", en: "Please enter at least 3 characters.", de: "Bitte geben Sie mindestens 3 Zeichen ein.", fr: "Veuillez entrer au moins 3 caractères.", it: "Inserisci almeno 3 caratteri.", es: "Pida ingresar al menos 3 caracteres." },
    "Bağlantı Hatası: $e": { domain: "common", key: "connection_error_e", en: "Connection Error: $e", de: "Verbindungsfehler: $e", fr: "Erreur de connexion : $e", it: "Errore di connessione: $e", es: "Error de conexión: $e" },
    "Bilgileriniz başarıyla güncellendi": { domain: "profile", key: "info_updated_successfully", en: "Your information was updated successfully", de: "Ihre Informationen wurden erfolgreich aktualisiert", fr: "Vos informations ont été mises à jour avec succès", it: "Le tue informazioni sono state aggiornate con successo", es: "Tu información se actualizó con éxito" },
    "Kaydedilirken hata oluştu: $e": { domain: "common", key: "error_saving_e", en: "Error occurred while saving: $e", de: "Beim Speichern ist ein Fehler aufgetreten: $e", fr: "Une erreur s'est produite lors de l'enregistrement : $e", it: "Errore durante il salvataggio: $e", es: "Ocurrió un error al guardar: $e" },
    "Bilgilerim & Adres": { domain: "profile", key: "my_info_and_address", en: "My Info & Address", de: "Meine Info & Adresse", fr: "Mes infos et adresse", it: "Le mie info e indirizzo", es: "Mi información y dirección" },
    "Konum Bul": { domain: "profile", key: "find_location", en: "Find Location", de: "Standort finden", fr: "Trouver l'emplacement", it: "Trova Posizione", es: "Encontrar ubicación" },
    "Bilgileri Güncelle": { domain: "profile", key: "update_info", en: "Update Info", de: "Info aktualisieren", fr: "Mettre à jour les informations", it: "Aggiorna Info", es: "Actualizar info" },
    "Masa Rezervasyonlarım": { domain: "profile", key: "my_table_reservations", en: "My Table Reservations", de: "Meine Tischreservierungen", fr: "Mes réservations de table", it: "Le mie prenotazioni di tavolo", es: "Mis reservas de mesa" },
    "Lütfen giriş yapın": { domain: "auth", key: "please_login", en: "Please login", de: "Bitte einloggen", fr: "Veuillez vous connecter", it: "Effettua il login", es: "Por favor inicie sesión" },
    "Rezervasyonlar yüklenirken hata oluştu": { domain: "profile", key: "error_loading_reservations", en: "Error loading reservations", de: "Fehler beim Laden von Reservierungen", fr: "Erreur lors du chargement des réservations", it: "Errore nel caricamento delle prenotazioni", es: "Error al cargar reservas" },
    "Henüz rezervasyonunuz yok": { domain: "profile", key: "no_reservations_yet", en: "No reservations yet", de: "Noch keine Reservierungen", fr: "Aucune réservation pour le moment", it: "Ancora nessuna prenotazione", es: "Aún no hay reservas" },
    "İşletme detay sayfasından masa rezervasyonu yapabilirsiniz": { domain: "profile", key: "can_make_reservation_from_business_page", en: "You can make a table reservation from the business details page", de: "Sie können eine Tischreservierung auf der Geschäft-Detailseite vornehmen", fr: "Vous pouvez faire une réservation de table depuis la page des détails du magasin", it: "Puoi effettuare una prenotazione del tavolo dalla pagina dei dettagli dell'azienda", es: "Puede hacer una reserva de mesa desde la página de detalles del negocio" },
    "Aktif Rezervasyonlar": { domain: "profile", key: "active_reservations", en: "Active Reservations", de: "Aktive Reservierungen", fr: "Réservations actives", it: "Prenotazioni attive", es: "Reservas activas" },
    "Geçmiş Rezervasyonlar": { domain: "profile", key: "past_reservations", en: "Past Reservations", de: "Vergangene Reservierungen", fr: "Réservations passées", it: "Prenotazioni passate", es: "Reservas pasadas" },
    "Masa Kart Numaranız": { domain: "orders", key: "your_table_card_number", en: "Your Table Card Number", de: "Ihre Tischkartennummer", fr: "Numéro de votre carte de table", it: "Numero della tua carta del tavolo", es: "Número de su tarjeta de mesa" },
    "Takvime Ekle": { domain: "profile", key: "add_to_calendar", en: "Add to Calendar", de: "Zum Kalender hinzufügen", fr: "Ajouter au calendrier", it: "Aggiungi al calendario", es: "Añadir al calendario" },
    "Rezervasyonu İptal Et": { domain: "profile", key: "cancel_reservation", en: "Cancel Reservation", de: "Reservierung stornieren", fr: "Annuler la réservation", it: "Annulla prenotazione", es: "Cancelar reserva" },
    "Bu rezervasyonu iptal etmek istediğinize emin misiniz?": { domain: "profile", key: "confirm_cancel_reservation", en: "Are you sure you want to cancel this reservation?", de: "Möchten Sie diese Reservierung wirklich stornieren?", fr: "Êtes-vous sûr de vouloir annuler cette réservation ?", it: "Sei sicuro di voler annullare questa prenotazione?", es: "¿Está seguro de que desea cancelar esta reserva?" },
    "Hayır": { domain: "common", key: "no", en: "No", de: "Nein", fr: "Non", it: "No", es: "No" },
    "Rezervasyon iptal edildi": { domain: "profile", key: "reservation_cancelled", en: "Reservation cancelled", de: "Reservierung storniert", fr: "Réservation annulée", it: "Prenotazione annullata", es: "Reserva cancelada" },
    "Evet, İptal Et": { domain: "common", key: "yes_cancel", en: "Yes, Cancel", de: "Ja, Abbrechen", fr: "Oui, Annuler", it: "Sì, Annulla", es: "Sí, Cancelar" },
    "Takvim dosyası açılamadı": { domain: "profile", key: "could_not_open_calendar_file", en: "Could not open calendar file", de: "Kalenderdatei konnte nicht geöffnet werden", fr: "Impossible d'ouvrir le fichier de calendrier", it: "Impossibile aprire il file del calendario", es: "No se pudo abrir el archivo de calendario" },
    "Bildirimler": { domain: "profile", key: "notifications", en: "Notifications", de: "Benachrichtigungen", fr: "Notifications", it: "Notifiche", es: "Notificaciones" },
    "Giriş yapmanız gerekiyor.": { domain: "auth", key: "need_to_login", en: "You need to log in.", de: "Sie müssen sich einloggen.", fr: "Vous devez vous connecter.", it: "Devi accedere.", es: "Necesitas iniciar sesión." },
    "Bir hata oluştu.": { domain: "common", key: "an_error_occurred", en: "An error occurred.", de: "Ein Fehler ist aufgetreten.", fr: "Une erreur est survenue.", it: "Si è verificato un errore.", es: "Ocurrió un error." },
    "Henüz bildiriminiz yok.": { domain: "profile", key: "no_notifications_yet", en: "You have no notifications yet.", de: "Sie haben noch keine Benachrichtigungen.", fr: "Vous n'avez pas encore de notifications.", it: "Non hai ancora nessuna notifica.", es: "Aún no tienes notificaciones." },
    "✅ Ödeme tercihleri kaydedildi": { domain: "profile", key: "payment_prefs_saved", en: "✅ Payment preferences saved", de: "✅ Zahlungseinstellungen gespeichert", fr: "✅ Préférences de paiement enregistrées", it: "✅ Preferenze di pagamento salvate", es: "✅ Preferencias de pago guardadas" },
    "Hata: $e": { domain: "common", key: "error_e", en: "Error: $e", de: "Fehler: $e", fr: "Erreur : $e", it: "Errore: $e", es: "Error: $e" },
    "Ödeme Yöntemleri": { domain: "profile", key: "payment_methods", en: "Payment Methods", de: "Zahlungsmethoden", fr: "Méthodes de paiement", it: "Metodi di pagamento", es: "Métodos de pago" },
    "Sipariş verirken hangi ödeme yöntemlerini kullanmak istediğinizi seçin.": { domain: "profile", key: "select_payment_methods_prompt", en: "Select the payment methods you'd like to use when placing an order.", de: "Wählen Sie die Zahlungsmethoden aus, die Sie bei der Bestellung verwenden möchten.", fr: "Sélectionnez les méthodes de paiement que vous souhaitez utiliser lors du passage d'une commande.", it: "Seleziona i metodi di pagamento che desideri utilizzare per effettuare un ordine.", es: "Seleccione los métodos de pago que le gustaría utilizar al realizar un pedido." },
    "Kaydet": { domain: "common", key: "save", en: "Save", de: "Speichern", fr: "Enregistrer", it: "Salva", es: "Guardar" },
    "LOKMA": { domain: "auth", key: "lokma", en: "LOKMA", de: "LOKMA", fr: "LOKMA", it: "LOKMA", es: "LOKMA" },
    "Fresh. Fast. Local.": { domain: "auth", key: "slogan", en: "Fresh. Fast. Local.", de: "Frisch. Schnell. Lokal.", fr: "Frais. Rapide. Local.", it: "Fresco. Veloce. Locale.", es: "Fresco. Rápido. Local." },
    "Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm verileriniz silinecektir.": { domain: "profile", key: "confirm_delete_account_prompt", en: "Are you sure you want to delete your account? This action cannot be undone and all your data will be deleted.", de: "Möchten Sie Ihr Konto wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden und alle Ihre Daten werden gelöscht.", fr: "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible et toutes vos données seront supprimées.", it: "Sei sicuro di voler eliminare il tuo account? Questa azione non può essere annullata e tutti i tuoi dati verranno eliminati.", es: "¿Está seguro de que desea eliminar su cuenta? Esta acción no se puede deshacer y se eliminarán todos sus datos." },
    "Ülke Seçin": { domain: "profile", key: "select_country", en: "Select Country", de: "Land auswählen", fr: "Sélectionner le pays", it: "Seleziona Paese", es: "Seleccionar país" },
    "Misafir olarak devam et": { domain: "auth", key: "continue_as_guest", en: "Continue as Guest", de: "Als Gast fortfahren", fr: "Continuer en tant qu'invité", it: "Continua come ospite", es: "Continuar como invitado" },
    "G": { domain: "auth", key: "letter_g", en: "G", de: "G", fr: "G", it: "G", es: "G" },
    "Şifremi Unuttum": { domain: "auth", key: "forgot_password", en: "Forgot Password", de: "Passwort vergessen", fr: "Mot de passe oublié", it: "Hai dimenticato la password", es: "Olvidé mi contraseña" },
    "SMS ile doğrulama kodu gönderilecek": { domain: "auth", key: "sms_code_will_be_sent", en: "Verification code will be sent via SMS", de: "Verifizierungscode wird per SMS gesendet", fr: "Le code de vérification sera envoyé par SMS", it: "Il codice di verifica verrà inviato via SMS", es: "El código de verificación se enviará por SMS" },
    "6 haneli doğrulama kodunu girin": { domain: "auth", key: "enter_6_digit_code", en: "Enter the 6-digit verification code", de: "Geben Sie den 6-stelligen Bestätigungscode ein", fr: "Entrez le code de vérification à 6 chiffres", it: "Inserisci il codice di verifica a 6 cifre", es: "Ingresa el código de verificación de 6 dígitos" },
    "Kodu Tekrar Gönder": { domain: "auth", key: "resend_code", en: "Resend Code", de: "Code erneut senden", fr: "Renvoyer le code", it: "Invia di nuovo il codice", es: "Reenviar código" },
    "💡 Güçlü şifre için:": { domain: "auth", key: "for_strong_password", en: "💡 For a strong password:", de: "💡 Für ein starkes Passwort:", fr: "💡 Pour un mot de passe fort :", it: "💡 Per una password sicura:", es: "💡 Para una contraseña segura:" },
    "Google giriş hatası: $e": { domain: "auth", key: "google_login_error_e", en: "Google login error: $e", de: "Google-Anmeldefehler: $e", fr: "Erreur de connexion Google : $e", it: "Errore di accesso a Google: $e", es: "Error de inicio de sesión de Google: $e" },
    "Misafir giriş hatası: $e": { domain: "auth", key: "guest_login_error_e", en: "Guest login error: $e", de: "Gast-Anmeldefehler: $e", fr: "Erreur de connexion invité : $e", it: "Errore di accesso ospite: $e", es: "Error de inicio de sesión de invitado: $e" },
    "E-posta ve şifre gerekli": { domain: "auth", key: "email_pass_required", en: "Email and password required", de: "E-Mail und Passwort erforderlich", fr: "E-mail et mot de passe requis", it: "Email e password richiesti", es: "Correo electrónico y contraseña requeridos" },
    "Şifreler eşleşmiyor": { domain: "auth", key: "passwords_do_not_match", en: "Passwords do not match", de: "Passwörter stimmen nicht überein", fr: "Les mots de passe ne correspondent pas", it: "Le password non corrispondono", es: "Las contraseñas no coinciden" },
    "✅ Kayıt başarılı! Doğrulama e-postası gönderildi.": { domain: "auth", key: "registration_success_email_sent", en: "✅ Registration successful! Verification email sent.", de: "✅ Registrierung erfolgreich! Bestätigungs-E-Mail gesendet.", fr: "✅ Inscription réussie ! E-mail de vérification envoyé.", it: "✅ Registrazione avvenuta con successo! Email di verifica inviata.", es: "✅ ¡Registro exitoso! Correo de verificación enviado." },
    "Giriş hatası: $e": { domain: "auth", key: "login_error_e", en: "Login error: $e", de: "Anmeldefehler: $e", fr: "Erreur de connexion : $e", it: "Errore di accesso: $e", es: "Error de inicio de sesión: $e" },
    "Lütfen e-posta adresinizi girin": { domain: "auth", key: "please_enter_email", en: "Please enter your email address", de: "Bitte geben Sie Ihre E-Mail-Adresse ein", fr: "Veuillez entrer votre adresse e-mail", it: "Inscerisci il tuo indirizzo email", es: "Por favor, introduzca su dirección de correo electrónico" },
    "📧 Şifre sıfırlama e-postası gönderildi": { domain: "auth", key: "pass_reset_email_sent", en: "📧 Password reset email sent", de: "📧 E-Mail zum Zurücksetzen des Passworts gesendet", fr: "📧 E-mail de réinitialisation du mot de passe envoyé", it: "📧 Email di reimpostazione password inviata", es: "📧 Correo de restablecimiento de contraseña enviado" },
    "Telefon numarası gerekli": { domain: "auth", key: "phone_number_required", en: "Phone number required", de: "Telefonnummer erforderlich", fr: "Numéro de téléphone requis", it: "Numero di telefono richiesto", es: "Se requiere número de teléfono" },
    "📱 SMS kodu gönderildi": { domain: "auth", key: "sms_code_sent", en: "📱 SMS code sent", de: "📱 SMS-Code gesendet", fr: "📱 Code SMS envoyé", it: "📱 Codice SMS inviato", es: "📱 Código SMS enviado" },
    "Hata: ${error.message ?? error.code}": { domain: "common", key: "error_message_or_code", en: "Error: ${error.message ?? error.code}", de: "Fehler: ${error.message ?? error.code}", fr: "Erreur : ${error.message ?? error.code}", it: "Errore: ${error.message ?? error.code}", es: "Error: ${error.message ?? error.code}" },
    "SMS Hatası: $e": { domain: "auth", key: "sms_error_e", en: "SMS Error: $e", de: "SMS-Fehler: $e", fr: "Erreur SMS : $e", it: "Errore SMS: $e", es: "Error de SMS: $e" },
    "6 haneli kodu girin": { domain: "auth", key: "enter_6_digit_short", en: "Enter 6-digit code", de: "Geben Sie den 6-stelligen Code ein", fr: "Entrez le code à 6 chiffres", it: "Inserisci il codice a 6 cifre", es: "Ingrese el código de 6 dígitos" },
    "Doğrulama ID bulunamadı": { domain: "auth", key: "verification_id_not_found", en: "Verification ID not found", de: "Verifizierungs-ID nicht gefunden", fr: "ID de vérification introuvable", it: "ID di verifica non trovato", es: "ID de verificación no encontrado" }
};

let safeReplacements = [];
const TRANSLATIONS_MERGED = {
    tr: {}, en: {}, de: {}, fr: {}, it: {}, es: {}
};

for (const [trString, entry] of Object.entries(staticDict)) {
    const fullKey = `${entry.domain}.${entry.key}`;
    TRANSLATIONS_MERGED.tr[entry.domain] = { ...TRANSLATIONS_MERGED.tr[entry.domain], [entry.key]: trString };
    TRANSLATIONS_MERGED.en[entry.domain] = { ...TRANSLATIONS_MERGED.en[entry.domain], [entry.key]: entry.en };
    TRANSLATIONS_MERGED.de[entry.domain] = { ...TRANSLATIONS_MERGED.de[entry.domain], [entry.key]: entry.de };
    TRANSLATIONS_MERGED.fr[entry.domain] = { ...TRANSLATIONS_MERGED.fr[entry.domain], [entry.key]: entry.fr };
    TRANSLATIONS_MERGED.it[entry.domain] = { ...TRANSLATIONS_MERGED.it[entry.domain], [entry.key]: entry.it };
    TRANSLATIONS_MERGED.es[entry.domain] = { ...TRANSLATIONS_MERGED.es[entry.domain], [entry.key]: entry.es };

    safeReplacements.push({ orig: trString, fullKey });
}

fs.writeFileSync('phase4_translations_merged.json', JSON.stringify(TRANSLATIONS_MERGED, null, 2));

const targetDirs = [
    path.join(__dirname, 'lib/screens/cart'),
    path.join(__dirname, 'lib/screens/checkout'),
    path.join(__dirname, 'lib/screens/profile'),
    path.join(__dirname, 'lib/screens/auth')
];

function replaceInDartFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDartFiles(fullPath);
        } else if (fullPath.endsWith('.dart')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            for (const item of safeReplacements) {
                const escapesOrig = item.orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                const constRegex1 = new RegExp(`const\\s+Text\\(\\s*'${escapesOrig}'\\s*\\)`, 'g');
                if (constRegex1.test(content)) {
                    content = content.replace(constRegex1, `Text(tr('${item.fullKey}'))`);
                    modified = true;
                }
                const constRegex2 = new RegExp(`const\\s+Text\\(\\s*"${escapesOrig}"\\s*\\)`, 'g');
                if (constRegex2.test(content)) {
                    content = content.replace(constRegex2, `Text(tr('${item.fullKey}'))`);
                    modified = true;
                }

                const regex1 = new RegExp(`Text\\(\\s*'${escapesOrig}'\\s*\\)`, 'g');
                if (regex1.test(content)) {
                    content = content.replace(regex1, `Text(tr('${item.fullKey}'))`);
                    modified = true;
                }
                const regex2 = new RegExp(`Text\\(\\s*"${escapesOrig}"\\s*\\)`, 'g');
                if (regex2.test(content)) {
                    content = content.replace(regex2, `Text(tr('${item.fullKey}'))`);
                    modified = true;
                }
            }

            if (modified) {
                if (!content.includes('import \'package:easy_localization/easy_localization.dart\';')) {
                    content = content.replace(
                        /import 'package:flutter\/material\.dart';/,
                        `import 'package:flutter/material.dart';\nimport 'package:easy_localization/easy_localization.dart';`
                    );
                }
                fs.writeFileSync(fullPath, content);
                console.log(`Replaced Phase 4 file: ${fullPath}`);
            }
        }
    }
}

targetDirs.forEach(replaceInDartFiles);

// Merge into localized JSONs
const transDir = path.join(__dirname, 'assets/translations');
const languages = ['tr', 'en', 'de', 'fr', 'it', 'es'];

for (const lang of languages) {
    const filePath = path.join(transDir, `${lang}.json`);
    if (fs.existsSync(filePath)) {
        let current = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const newTranslations = TRANSLATIONS_MERGED[lang];
        if (newTranslations) {
            for (const [domain, keysObj] of Object.entries(newTranslations)) {
                if (!current[domain]) {
                    current[domain] = {};
                }
                // Merge keys
                for (const [k, v] of Object.entries(keysObj)) {
                    current[domain][k] = v;
                }
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
        console.log(`Updated Phase 4 in ${lang}.json`);
    } else {
        console.warn(`${lang}.json not found!`);
    }
}
