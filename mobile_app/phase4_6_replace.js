const fs = require('fs');
const path = require('path');

const TRANSLATIONS = {
    tr: {}, en: {}, de: {}, fr: {}, it: {}, es: {}
};

// Map literal static strings
const staticDict = {
    "Favorilerim": { domain: "profile", key: "my_favorites", en: "My Favorites", de: "Meine Favoriten", fr: "Mes favoris", it: "I miei preferiti", es: "Mis favoritos" },
    "Siparişi Görüntüle": { domain: "orders", key: "view_order", en: "View Order", de: "Bestellung ansehen", fr: "Voir la commande", it: "Visualizza ordine", es: "Ver pedido" },
    "Puan Ver": { domain: "orders", key: "rate", en: "Rate", de: "Bewerten", fr: "Évaluer", it: "Valuta", es: "Calificar" },
    "Tekrar Sipariş Ver": { domain: "orders", key: "order_again", en: "Order Again", de: "Erneut bestellen", fr: "Commander à nouveau", it: "Ordina di nuovo", es: "Pedir otra vez" },
    "Geri bildirim için giriş yapmalısınız.": { domain: "auth", key: "login_required_for_feedback", en: "You must log in to submit feedback.", de: "Sie müssen sich anmelden, um Feedback zu hinterlassen.", fr: "Vous devez vous connecter pour laisser des commentaires.", it: "Devi accedere per inviare feedback.", es: "Debes iniciar sesión para enviar comentarios." },
    "Lütfen en az bir kategoriyi puanlayın.": { domain: "common", key: "rate_at_least_one_category", en: "Please rate at least one category.", de: "Bitte bewerten Sie mindestens eine Kategorie.", fr: "Veuillez évaluer au moins une catégorie.", it: "Si prega di valutare almeno una categoria.", es: "Por favor califique al menos una categoría." },
    "Geri bildiriminiz için teşekkürler! 🙏": { domain: "common", key: "thank_you_for_feedback_pray", en: "Thank you for your feedback! 🙏", de: "Vielen Dank für Ihr Feedback! 🙏", fr: "Merci pour vos commentaires ! 🙏", it: "Grazie per il tuo feedback! 🙏", es: "¡Gracias por tus comentarios! 🙏" },
    "Hata: $e": { domain: "common", key: "error_e", en: "Error: $e", de: "Fehler: $e", fr: "Erreur : $e", it: "Errore: $e", es: "Error: $e" },
    "Geri Bildirim": { domain: "common", key: "feedback", en: "Feedback", de: "Feedback", fr: "Retour", it: "Feedback", es: "Comentarios" },
    "Bu Ay Zaten Değerlendirdiniz": { domain: "common", key: "already_rated_this_month", en: "You already rated this month", de: "Sie haben diesen Monat bereits bewertet", fr: "Vous avez déjà évalué ce mois-ci", it: "Hai già valutato questo mese", es: "Ya calificaste este mes" },
    "Her ay bir kez geri bildirim verebilirsiniz.\\nGelecek ay tekrar değerlendirebilirsiniz!": { domain: "common", key: "feedback_once_a_month", en: "You can provide feedback once a month.\\nYou can rate again next month!", de: "Sie können einmal im Monat Feedback geben.\\nSie können nächsten Monat wieder bewerten!", fr: "Vous pouvez donner votre avis une fois par mois.\\nVous pourrez à nouveau évaluer le mois prochain !", it: "Puoi fornire feedback una volta al mese.\\nPuoi valutare di nuovo il mese prossimo!", es: "Puede proporcionar comentarios una vez al mes.\\n¡Puede volver a calificar el mes que viene!" },
    "📝 Görüşleriniz Bizim İçin Değerli": { domain: "common", key: "your_opinions_valuable_memo", en: "📝 Your opinions are valuable to us", de: "📝 Ihre Meinungen sind uns wichtig", fr: "📝 Vos avis nous sont précieux", it: "📝 Le tue opinioni sono preziose per noi", es: "📝 Sus opiniones son valiosas para nosotros" },
    "Geri bildiriminiz anonim olarak işlenir.": { domain: "common", key: "feedback_processed_anonymously", en: "Your feedback is processed anonymously.", de: "Ihr Feedback wird anonym verarbeitet.", fr: "Vos commentaires sont traités anonymement.", it: "Il tuo feedback viene elaborato in modo anonimo.", es: "Sus comentarios se procesan de forma anónima." },
    "Kurye Değerlendirmesi": { domain: "orders", key: "courier_rating", en: "Courier Rating", de: "Kurierbewertung", fr: "Évaluation du coursier", it: "Valutazione Corriero", es: "Calificación del mensajero" },
    "Eklemek İstediğiniz Not": { domain: "common", key: "note_to_add", en: "Note to add", de: "Noch hinzuzufügende Notiz", fr: "Note à ajouter", it: "Nota da aggiungere", es: "Nota a añadir" },
    "Gönder": { domain: "common", key: "send", en: "Send", de: "Senden", fr: "Envoyer", it: "Invia", es: "Enviar" },
    "Abbrechen": { domain: "common", key: "cancel_de", en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla", es: "Cancelar" },
    "İptal": { domain: "common", key: "cancel", en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla", es: "Cancelar" },
    "Sonuçları Filtrele": { domain: "common", key: "filter_results", en: "Filter Results", de: "Ergebnisse filtern", fr: "Filtrer les résultats", it: "Filtra Risultati", es: "Filtrar Resultados" },
    "Sıfırla": { domain: "common", key: "reset", en: "Reset", de: "Zurücksetzen", fr: "Réinitialiser", it: "Ripristina", es: "Restablecer" },
    "Filtreler": { domain: "common", key: "filters", en: "Filters", de: "Filter", fr: "Filtres", it: "Filtri", es: "Filtros" },
    "Sıralama": { domain: "common", key: "sorting", en: "Sorting", de: "Sortierung", fr: "Triage", it: "Ordinamento", es: "Clasificación" },
    "İşletmeleri Göster": { domain: "common", key: "show_businesses", en: "Show Businesses", de: "Zeige Unternehmen", fr: "Afficher les entreprises", it: "Mostra Aziende", es: "Mostrar negocios" },
    "Aranıyor...": { domain: "common", key: "searching", en: "Searching...", de: "Suchen...", fr: "Recherche...", it: "Ricerca...", es: "Buscando..." },
    "Sonuç bulunamadı": { domain: "common", key: "no_results_found", en: "No results found", de: "Keine Ergebnisse gefunden", fr: "Aucun résultat trouvé", it: "Nessun risultato trovato", es: "No se encontraron resultados" },
    "Farklı bir arama terimi deneyin": { domain: "common", key: "try_different_search_term", en: "Try a different search term", de: "Versuchen Sie einen anderen Suchbegriff", fr: "Essayez un terme de recherche différent", it: "Prova con un termine di ricerca diverso", es: "Prueba con otro término de búsqueda" },
    "Daha Fazla Göster": { domain: "common", key: "show_more", en: "Show More", de: "Mehr anzeigen", fr: "Afficher plus", it: "Mostra di più", es: "Mostrar más" },
    "Bildirim ayarları kaydedildi": { domain: "profile", key: "notification_settings_saved", en: "Notification settings saved", de: "Benachrichtigungseinstellungen gespeichert", fr: "Les paramètres de notification ont été enregistrés", it: "Impostazioni di notifica salvate", es: "Configuración de notificaciones guardada" },
    "Dikkat!": { domain: "common", key: "attention_exclamation", en: "Attention!", de: "Achtung!", fr: "Attention !", it: "Attenzione!", es: "¡Atención!" },
    "Sipariş bildirimlerini kapatırsanız, siparişleriniz hakkında önemli güncellemeleri alamazsınız.\\n\\nDevam etmek istiyor musunuz?": { domain: "profile", key: "disable_order_notifications_warning", en: "If you turn off order notifications, you will not be able to receive important updates about your orders.\\n\\nDo you want to continue?", de: "Wenn Sie Bestellbenachrichtigungen deaktivieren, erhalten Sie keine wichtigen Aktualisierungen mehr zu Ihren Bestellungen.\\n\\nMöchten Sie fortfahren?", fr: "Si vous désactivez les notifications de commande, vous ne pourrez pas recevoir de mises à jour importantes concernant vos commandes.\\n\\nVoulez-vous continuer ?", it: "Se disattivi le notifiche degli ordini, non riceverai aggiornamenti importanti sui tuoi ordini.\\n\\nVuoi continuare?", es: "Si desactiva las notificaciones de pedidos, no podrá recibir actualizaciones importantes sobre sus pedidos.\\n\\n¿Desea continuar?" },
    "Kapat": { domain: "common", key: "close", en: "Close", de: "Schließen", fr: "Fermer", it: "Chiudi", es: "Cerrar" },
    "Bildirim Ayarları": { domain: "profile", key: "notification_settings", en: "Notification Settings", de: "Benachrichtigungseinstellungen", fr: "Paramètres de notification", it: "Impostazioni notifiche", es: "Ajustes de notificaciones" },
    "Kaydet": { domain: "common", key: "save", en: "Save", de: "Speichern", fr: "Enregistrer", it: "Salva", es: "Guardar" },
    "Uygulama Dili / Language": { domain: "common", key: "app_language", en: "App Language", de: "App-Sprache", fr: "Langue de l'application", it: "Lingua App", es: "Idioma de la aplicación" },
    "Dilinizi seçin. Daha sonra profilden değiştirebilirsiniz.": { domain: "common", key: "select_language_prompt_first", en: "Select your language. You can change it later from the profile.", de: "Wählen Sie Ihre Sprache. Sie können sie später in Ihrem Profil ändern.", fr: "Sélectionnez votre langue. Vous pourrez la modifier ultérieurement depuis le profil.", it: "Seleziona la tua lingua. Puoi modificarla in seguito dal profilo.", es: "Selecciona tu idioma. Puedes cambiarlo más tarde desde el perfil." },
    "Devam Et": { domain: "common", key: "continue_text", en: "Continue", de: "Weiter", fr: "Continuer", it: "Continua", es: "Continuar" },
    "LOKMA Cüzdan": { domain: "wallet", key: "lokma_wallet", en: "LOKMA Wallet", de: "LOKMA Wallet", fr: "Portefeuille LOKMA", it: "Portafoglio LOKMA", es: "Billetera LOKMA" },
    "Müşteri Kartınız": { domain: "wallet", key: "your_customer_card", en: "Your Customer Card", de: "Ihre Kundenkarte", fr: "Votre carte client", it: "La tua carta cliente", es: "Tu tarjeta de cliente" },
    "MEMBER": { domain: "wallet", key: "member_caps", en: "MEMBER", de: "MITGLIED", fr: "MEMBRE", it: "MEMBRO", es: "MIEMBRO" },
    "KART SAHİBİ": { domain: "wallet", key: "card_holder_caps", en: "CARD HOLDER", de: "KARTENINHABER", fr: "TITULAIRE DE LA CARTE", it: "TITOLARE DELLA CARTA", es: "TITULAR DE LA TARJETA" },
    "MÜŞTERİ NO": { domain: "wallet", key: "customer_id_caps", en: "CUSTOMER ID", de: "KUNDEN-ID", fr: "ID CLIENT", it: "ID CLIENTE", es: "ID DE CLIENTE" },
    "Aksiyon Kodu": { domain: "wallet", key: "action_code", en: "Action Code", de: "Aktionscode", fr: "Code d'action", it: "Codice Azione", es: "Código de acción" },
    "İndirim veya kampanya kodu girin": { domain: "wallet", key: "enter_discount_or_promo_code", en: "Enter discount or promotional code", de: "Geben Sie Rabatt- oder Aktionscode ein", fr: "Saisir un code de réduction ou promotionnel", it: "Inserisci sconto o codice promozionale", es: "Ingrese el código de descuento o promocional" },
    "Avantajlar": { domain: "wallet", key: "benefits", en: "Benefits", de: "Vorteile", fr: "Avantages", it: "Benefici", es: "Beneficios" },
    "QR Tarayıcı yakında aktif olacak!": { domain: "wallet", key: "qr_scanner_coming_soon", en: "QR Scanner will be active soon!", de: "QR-Scanner wird bald aktiv sein!", fr: "Le scanner QR sera bientôt actif !", it: "Lo scanner QR sarà presto attivo!", es: "¡El escáner QR estará activo pronto!" },
    "Kart paylaşımı yakında aktif olacak!": { domain: "wallet", key: "card_sharing_coming_soon", en: "Card sharing will be active soon!", de: "Das Teilen von Karten wird bald aktiv sein!", fr: "Le partage de cartes sera bientôt actif !", it: "La condivisione delle carte sarà presto attiva!", es: "¡Compartir tarjetas estará activo pronto!" }
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

const targetDirs = [
    path.join(__dirname, 'lib/screens/favorites'),
    path.join(__dirname, 'lib/screens/feedback'),
    path.join(__dirname, 'lib/screens/search'),
    path.join(__dirname, 'lib/screens/settings'),
    path.join(__dirname, 'lib/screens/splash'),
    path.join(__dirname, 'lib/screens/wallet')
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
                console.log(`Replaced string in file: ${fullPath}`);
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
        console.log(`Updated final JSON in ${lang}.json`);
    } else {
        console.warn(`${lang}.json not found!`);
    }
}
