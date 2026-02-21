const fs = require('fs');
const path = require('path');

const mapRaw = fs.readFileSync('phase1_map.json', 'utf8');
const map = JSON.parse(mapRaw);

const TRANSLATIONS = {
    tr: {}, en: {}, de: {}, fr: {}, it: {}, es: {}
};

const dict = [
    { tr: "Mesafe:", en: "Distance:", de: "Entfernung:", fr: "Distance :", it: "Distanza:", es: "Distancia:", domain: "common", key: "distance" },
    { tr: "Nasıl Almak İstersiniz?", en: "How would you like to receive it?", de: "Wie möchten Sie es erhalten?", fr: "Comment souhaitez-vous le recevoir ?", it: "Come vorresti riceverlo?", es: "¿Cómo le gustaría recibirlo?", domain: "cart", key: "how_to_receive" },
    { tr: "İptal", en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla", es: "Cancelar", domain: "common", key: "cancel" },
    { tr: "Giriş Gerekli", en: "Login Required", de: "Anmeldung erforderlich", fr: "Connexion requise", it: "Accesso richiesto", es: "Inicio de sesión requerido", domain: "common", key: "login_required" },
    { tr: "Link panoya kopyalandı! WhatsApp\\", en: "Link copied to clipboard! WhatsApp\\", de: "Link in die Zwischenablage kopiert! WhatsApp\\", fr: "Lien copié dans le presse-papiers ! WhatsApp\\", it: "Link copiato negli appunti! WhatsApp\\", es: "¡Enlace copiado al portapapeles! WhatsApp\\", domain: "kermes", key: "link_copied_whatsapp" },
    { tr: "WhatsApp açılamadı. Link panoya kopyalandı.", en: "Could not open WhatsApp. Link copied to clipboard.", de: "WhatsApp konnte nicht geöffnet werden. Link in die Zwischenablage kopiert.", fr: "Impossible d'ouvrir WhatsApp. Lien copié.", it: "Impossibile aprire WhatsApp. Link copiato negli appunti.", es: "No se pudo abrir WhatsApp. Enlace copiado al portapapeles.", domain: "kermes", key: "whatsapp_failed_link_copied" },
    { tr: "Link kopyalandı!", en: "Link copied!", de: "Link kopiert!", fr: "Lien copié !", it: "Link copiato!", es: "¡Enlace copiado!", domain: "common", key: "link_copied" },
    { tr: "Grup Siparişi Oluşturuldu!", en: "Group Order Created!", de: "Gruppenbestellung erstellt!", fr: "Commande de groupe créée !", it: "Ordine di gruppo creato!", es: "¡Pedido de grupo creado!", domain: "kermes", key: "group_order_created" },
    { tr: "Kopyalandı", en: "Copied", de: "Kopiert", fr: "Copié", it: "Copiato", es: "Copiado", domain: "common", key: "copied" },
    { tr: "Siparişe Devam Et", en: "Continue with Order", de: "Mit Bestellung fortfahren", fr: "Continuer la commande", it: "Continua con l'ordine", es: "Continuar con el pedido", domain: "cart", key: "continue_order" },
    { tr: "Sipariş numarası kopyalandı", en: "Order number copied", de: "Bestellnummer kopiert", fr: "Numéro de commande copié", it: "Numero d'ordine copiato", es: "Número de pedido copiado", domain: "orders", key: "order_number_copied" },
    { tr: "Ödeme Tamamlandı!", en: "Payment Completed!", de: "Zahlung abgeschlossen!", fr: "Paiement terminé !", it: "Pagamento completato!", es: "¡Pago completado!", domain: "payments", key: "payment_completed" },
    { tr: "Tamam", en: "OK", de: "OK", fr: "OK", it: "OK", es: "Aceptar", domain: "common", key: "ok" },
    { tr: "Nakit Ödeme", en: "Cash Payment", de: "Barzahlung", fr: "Paiement en espèces", it: "Pagamento in contanti", es: "Pago en efectivo", domain: "payments", key: "cash_payment" },
    { tr: "Kermes alanındaki kasada bu QR kodu göstererek nakit ödeme yapabilirsiniz.", en: "You can pay cash at the Kermes area by showing this QR code.", de: "Sie können bar bezahlen, indem Sie diesen QR-Code an der Kasse zeigen.", fr: "Vous pouvez payer en espèces en montrant ce code QR.", it: "Puoi pagare in contanti mostrando questo codice QR alla cassa.", es: "Puede pagar en efectivo mostrando este código QR en la caja.", domain: "kermes", key: "pay_cash_at_kermes_qr" },
    { tr: "Anladım", en: "Understood", de: "Verstanden", fr: "Compris", it: "Ho capito", es: "Entendido", domain: "common", key: "understood" },
    { tr: "Sipariş İptali", en: "Order Cancellation", de: "Bestellstornierung", fr: "Annulation de commande", it: "Cancellazione dell'ordine", es: "Cancelación de pedido", domain: "orders", key: "order_cancellation" },
    { tr: "Siparişinizi iptal etmek istediğinize emin misiniz?", en: "Are you sure you want to cancel your order?", de: "Möchten Sie Ihre Bestellung wirklich stornieren?", fr: "Voulez-vous vraiment annuler votre commande ?", it: "Sei sicuro di voler annullare l'ordine?", es: "¿Estás seguro de que deseas cancelar tu pedido?", domain: "orders", key: "confirm_cancel_order" },
    { tr: "Ödemeniz 2-3 iş günü içinde iade edilecektir.", en: "Your payment will be refunded in 2-3 business days.", de: "Ihre Zahlung wird innerhalb von 2-3 Werktagen zurückerstattet.", fr: "Votre paiement sera remboursé sous 2 à 3 jours ouvrables.", it: "Il pagamento verrà rimborsato in 2-3 giorni lavorativi.", es: "Su pago será reembolsado en 2-3 días hábiles.", domain: "payments", key: "refund_in_days" },
    { tr: "Vazgeç", en: "Give up", de: "Aufgeben", fr: "Annuler", it: "Rinuncia", es: "Renunciar", domain: "common", key: "give_up" },
    { tr: "İptal Et", en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla", es: "Cancelar", domain: "common", key: "cancel_verb" },
    { tr: "Sipariş İptal Edildi", en: "Order Cancelled", de: "Bestellung storniert", fr: "Commande annulée", it: "Ordine Annullato", es: "Pedido Cancelado", domain: "orders", key: "order_cancelled" },
    { tr: "Ödemeniz iade edildi.", en: "Your payment was refunded.", de: "Ihre Zahlung wurde zurückerstattet.", fr: "Votre paiement a été remboursé.", it: "Il tuo pagamento è stato rimborsato.", es: "Su pago fue reembolsado.", domain: "payments", key: "payment_refunded" },
    { tr: "💡 İade tutarı 2-3 iş günü içinde hesabınıza yansıyacaktır. Bu teknik bir işlem süresidir.", en: "💡 The refund will reflect in 2-3 business days due to processing times.", de: "💡 Die Rückerstattung wird aufgrund von Bearbeitungszeiten in 2-3 Werktagen angezeigt.", fr: "💡 Le remboursement apparaîtra sous 2 à 3 jours ouvrables.", it: "💡 Il rimborso sarà visibile in 2-3 giorni lavorativi per i tempi di elaborazione.", es: "💡 El reembolso se reflejará en 2-3 días hábiles debido a los tiempos de procesamiento.", domain: "payments", key: "refund_notice" },
    { tr: "İptal Edilemiyor", en: "Cannot be Cancelled", de: "Stornierung nicht möglich", fr: "Impossible d'annuler", it: "Impossibile annullare", es: "No se puede cancelar", domain: "orders", key: "cannot_cancel" },
    { tr: "Siparişiniz hazırlanmaya başladığı için artık iptal edilemiyor. 🍳", en: "Your order has started preparation and cannot be cancelled anymore. 🍳", de: "Ihre Bestellung wird bereits zubereitet und kann nicht mehr storniert werden. 🍳", fr: "Votre commande est en préparation et ne peut plus être annulée. 🍳", it: "Il tuo ordine è in preparazione e non può più essere annullato. 🍳", es: "Tu pedido ha comenzado a prepararse y ya no se puede cancelar. 🍳", domain: "orders", key: "order_started_prep_no_cancel" },
    { tr: "Lütfen tezgahta personel ile iletişime geçin.", en: "Please contact the staff at the counter.", de: "Bitte wenden Sie sich an das Personal am Schalter.", fr: "Veuillez contacter le personnel au comptoir.", it: "Si prega di contattare il personale al bancone.", es: "Póngase en contacto con el personal del mostrador.", domain: "kermes", key: "contact_staff_at_counter" },
    { tr: "Bu QR kodu tezgah personeline gösterin", en: "Show this QR code to the counter staff", de: "Zeigen Sie diesen QR-Code dem Personal am Schalter", fr: "Montrez ce code QR au personnel du comptoir", it: "Mostra questo codice QR al personale del bancone", es: "Muestre este código QR al personal del mostrador", domain: "kermes", key: "show_qr_to_counter_staff" },
    { tr: "Sipariş Numarası", en: "Order Number", de: "Bestellnummer", fr: "Numéro de commande", it: "Numero d'ordine", es: "Número de pedido", domain: "orders", key: "order_number_title" },
    { tr: "Siparişiniz ödeme yapıldıktan sonra\\nhazırlanmaya başlanacaktır", en: "Your order will begin preparation\\nafter payment", de: "Ihre Bestellung wird nach\\nZahlungseingang zubereitet", fr: "Votre commande sera préparée\\naprès le paiement", it: "Il tuo ordine verrà preparato\\ndopo il pagamento", es: "Su pedido comenzará a prepararse\\ndespués del pago", domain: "orders", key: "order_prep_after_payment" },
    { tr: "Toplam", en: "Total", de: "Gesamt", fr: "Total", it: "Totale", es: "Total", domain: "common", key: "total" },
    { tr: "💵 Nakit Ödeme", en: "💵 Cash Payment", de: "💵 Barzahlung", fr: "💵 Paiement en espèces", it: "💵 Pagamento in contanti", es: "💵 Pago en efectivo", domain: "payments", key: "cash_payment_icon" },
    { tr: "SİPARİŞ İPTAL EDİLDİ", en: "ORDER CANCELLED", de: "BESTELLUNG STORNIERT", fr: "COMMANDE ANNULÉE", it: "ORDINE ANNULLATO", es: "PEDIDO CANCELADO", domain: "orders", key: "order_cancelled_caps" },
    { tr: "Sipariş Türü", en: "Order Type", de: "Bestellart", fr: "Type de commande", it: "Tipo di ordine", es: "Tipo de pedido", domain: "cart", key: "order_type" },
    { tr: "Nasıl sipariş vermek istersiniz?", en: "How would you like to place your order?", de: "Wie möchten Sie bestellen?", fr: "Comment souhaitez-vous commander ?", it: "Come desideri ordinare?", es: "¿Cómo desea realizar su pedido?", domain: "cart", key: "how_to_order" },
    { tr: "Ailecek Sipariş Başlat", en: "Start Family Order", de: "Familienbestellung starten", fr: "Commencer une commande familiale", it: "Avvia Ordine Familiare", es: "Iniciar pedido familiar", domain: "kermes", key: "start_family_order" },
    { tr: "Adınız", en: "Your Name", de: "Ihr Name", fr: "Votre Nom", it: "Il tuo nome", es: "Su nombre", domain: "common", key: "your_name" },
    { tr: "Sipariş Süresi", en: "Order Duration", de: "Bestelldauer", fr: "Durée de la commande", it: "Durata dell'ordine", es: "Duración del pedido", domain: "kermes", key: "order_duration" },
    { tr: "Katılımcılar bu süre içinde sipariş verebilir", en: "Participants can order within this time", de: "Teilnehmer können in dieser Zeit bestellen", fr: "Les participants peuvent commander pendant ce temps", it: "I partecipanti possono ordinare in questo periodo", es: "Los participantes pueden pedir en este tiempo", domain: "kermes", key: "participants_can_order" },
    { tr: "Link oluşturulduktan sonra WhatsApp ile paylaşabilirsiniz", en: "After the link is created, you can share it via WhatsApp", de: "Nachdem der Link erstellt wurde, können Sie ihn über WhatsApp teilen", fr: "Une fois le lien créé, vous pouvez le partager via WhatsApp", it: "Dopo che il link è stato creato, puoi condividerlo tramite WhatsApp", es: "Después de que se crea el enlace, puede compartirlo a través de WhatsApp", domain: "kermes", key: "share_link_whatsapp" },
    { tr: "Link Oluştur", en: "Create Link", de: "Link erstellen", fr: "Créer un lien", it: "Crea link", es: "Crear enlace", domain: "common", key: "create_link" },
    { tr: "Ödeme Yöntemi", en: "Payment Method", de: "Zahlungsmethode", fr: "Mode de paiement", it: "Metodo di pagamento", es: "Método de pago", domain: "payments", key: "payment_method" },
    { tr: "Menüyü Gör & Sipariş Ver", en: "View Menu & Order", de: "Menü ansehen & bestellen", fr: "Voir le menu et commander", it: "Vedi menu odina", es: "Ver menú y pedir", domain: "discovery", key: "view_menu_order" },
    { tr: "P", en: "P", de: "P", fr: "P", it: "P", es: "P", domain: "common", key: "letter_p" },
    { tr: "Park İmkanları", en: "Parking Options", de: "Parkmöglichkeiten", fr: "Options de stationnement", it: "Opzioni di parcheggio", es: "Opciones de aparcamiento", domain: "discovery", key: "parking_options" },
    { tr: "Müsait park alanı", en: "Available parking space", de: "Verfügbarer Parkplatz", fr: "Place de parking disponible", it: "Spazio parcheggio disponibile", es: "Plaza de aparcamiento disponible", domain: "discovery", key: "available_parking" },
    { tr: "Hava Durumu", en: "Weather", de: "Wetter", fr: "Météo", it: "Meteo", es: "Clima", domain: "common", key: "weather" },
    { tr: "Yetkili Kişi", en: "Authorized Person", de: "Befugte Person", fr: "Personne autorisée", it: "Persona autorizzata", es: "Persona autorizada", domain: "staff", key: "authorized_person" },
    { tr: "Sipariş Alındı!", en: "Order Received!", de: "Bestellung eingegangen!", fr: "Commande reçue !", it: "Ordine ricevuto!", es: "¡Pedido recibido!", domain: "orders", key: "order_received" },
    { tr: "🕌 Dernek Seç", en: "🕌 Select Association", de: "🕌 Verein wählen", fr: "🕌 Sélectionner l'association", it: "🕌 Seleziona l'associazione", es: "🕌 Seleccionar asociación", domain: "kermes", key: "select_association_icon" },
    { tr: "Sonuç bulunamadı", en: "No results found", de: "Keine Ergebnisse gefunden", fr: "Aucun résultat trouvé", it: "Nessun risultato trovato", es: "No se encontraron resultados", domain: "common", key: "no_results_found" },
    { tr: "Farklı bir arama terimi deneyin", en: "Try a different search term", de: "Probieren Sie einen anderen Suchbegriff", fr: "Essayez un terme de recherche différent", it: "Prova un altro termine di ricerca", es: "Intente un término de búsqueda diferente", domain: "common", key: "try_different_search" }
];

let safeReplacements = [];

for (const entry of dict) {
    const fullKey = `${entry.domain}.${entry.key}`;
    const domainObj = TRANSLATIONS.tr[entry.domain] || {};

    // tr
    TRANSLATIONS.tr[entry.domain] = { ...TRANSLATIONS.tr[entry.domain], [entry.key]: entry.tr };
    TRANSLATIONS.en[entry.domain] = { ...TRANSLATIONS.en[entry.domain], [entry.key]: entry.en };
    TRANSLATIONS.de[entry.domain] = { ...TRANSLATIONS.de[entry.domain], [entry.key]: entry.de };
    TRANSLATIONS.fr[entry.domain] = { ...TRANSLATIONS.fr[entry.domain], [entry.key]: entry.fr };
    TRANSLATIONS.it[entry.domain] = { ...TRANSLATIONS.it[entry.domain], [entry.key]: entry.it };
    TRANSLATIONS.es[entry.domain] = { ...TRANSLATIONS.es[entry.domain], [entry.key]: entry.es };

    safeReplacements.push({
        orig: entry.tr,
        fullKey: fullKey
    });
}

fs.writeFileSync('phase1_translations_all.json', JSON.stringify(TRANSLATIONS, null, 2));

const targetDir = path.join(__dirname, 'lib/widgets');

function replaceInDartFiles(dir) {
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

                // If it already mistakenly replaced with `widgets.tamam` previously, we must fix it here.
                const oldKeyMapRegex1 = new RegExp(`Text\\(\\s*tr\\(\\s*'widgets\\.[a-z_]+'\\s*\\)\\s*\\)`, 'g');

                // Revert previous `widgets.` mappings back to correctly map to domain mappings.
                // We actually know what happened in the previous run. It replaced Text('Tamam') with Text(tr('widgets.tamam')). 
                // We need to change `tr('widgets.tamam')` to `tr('common.ok')`
                const oldFullKey = `widgets.${map[item.orig]?.split('.')[1] || ''}`;

                if (oldFullKey !== 'widgets.') {
                    const erronousReplace1 = new RegExp(`tr\\('${oldFullKey}'\\)`, 'g');
                    if (erronousReplace1.test(content)) {
                        content = content.replace(erronousReplace1, `tr('${item.fullKey}')`);
                        modified = true;
                    }
                }

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
                fs.writeFileSync(fullPath, content);
                console.log(`Re-mapped Phase 1 File: ${fullPath}`);
            }
        }
    }
}

replaceInDartFiles(targetDir);
