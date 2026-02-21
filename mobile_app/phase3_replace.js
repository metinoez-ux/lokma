const fs = require('fs');
const path = require('path');

const phase3Strings = JSON.parse(fs.readFileSync('phase3_strings.json', 'utf8'));

const TRANSLATIONS = {
    tr: {}, en: {}, de: {}, fr: {}, it: {}, es: {}
};

// Map literal static strings
const staticDict = {
    "☕ Molanız Devam Ediyor": { domain: "staff", key: "break_continues", en: "☕ Your Break Continues", de: "☕ Ihre Pause geht weiter", fr: "☕ Votre pause continue", it: "☕ La tua pausa continua", es: "☕ Tu descanso continúa" },
    "Teslimat üstlenmek için molanız sonlandırılacak.\\n\\n": { domain: "staff", key: "break_end_for_delivery_prompt", en: "Your break will end to take this delivery.\\n\\n", de: "Ihre Pause wird beendet, um diese Lieferung zu übernehmen.\\n\\n", fr: "Votre pause prendra fin pour prendre cette livraison.\\n\\n", it: "La tua pausa terminerà per prendere questa consegna.\\n\\n", es: "Su descanso terminará para tomar esta entrega.\\n\\n" },
    "İptal": { domain: "common", key: "cancel", en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla", es: "Cancelar" },
    "Molayı Bitir ve Üstlen": { domain: "staff", key: "end_break_and_take", en: "End Break and Take", de: "Pause beenden und übernehmen", fr: "Finir la pause et prendre", it: "Termina la pausa e prendi", es: "Terminar descanso y tomar" },
    "❌ Mola sonlandırılamadı. Lütfen tekrar deneyin.": { domain: "staff", key: "break_end_failed", en: "❌ Break could not be ended. Please try again.", de: "❌ Pause konnte nicht beendet werden. Bitte versuchen Sie es erneut.", fr: "❌ La pause n'a pas pu être terminée. Veuillez réessayer.", it: "❌ Impossibile terminare la pausa. Riprova.", es: "❌ No se pudo terminar el descanso. Inténtalo de nuevo." },
    "Teslimatı Üstlen": { domain: "driver", key: "take_delivery", en: "Take Delivery", de: "Lieferung übernehmen", fr: "Prendre la livraison", it: "Prendi la consegna", es: "Tomar la entrega" },
    "Bu siparişi üstlenmek istediğinize emin misiniz?\\n\\n": { domain: "driver", key: "confirm_take_delivery", en: "Are you sure you want to take this order?\\n\\n", de: "Möchten Sie diese Bestellung wirklich übernehmen?\\n\\n", fr: "Êtes-vous sûr de vouloir prendre cette commande ?\\n\\n", it: "Sei sicuro di voler prendere questo ordine?\\n\\n", es: "¿Seguro que quieres tomar este pedido?\\n\\n" },
    "Üstlen": { domain: "driver", key: "take", en: "Take", de: "Übernehmen", fr: "Prendre", it: "Prendi", es: "Tomar" },
    "❌ Teslimat zaten başka biri tarafından üstlenilmiş.": { domain: "driver", key: "delivery_already_taken", en: "❌ Delivery already taken by someone else.", de: "❌ Lieferung wurde bereits von jemand anderem übernommen.", fr: "❌ Livraison déjà prise par quelqu'un d'autre.", it: "❌ Consegna già presa da qualcun altro.", es: "❌ Entrega ya tomada por otra persona." },
    "Teslimatlarım": { domain: "driver", key: "my_deliveries", en: "My Deliveries", de: "Meine Lieferungen", fr: "Mes livraisons", it: "Le Mie Consegne", es: "Mis entregas" },
    "Tüm Siparişler": { domain: "driver", key: "all_orders", en: "All Orders", de: "Alle Bestellungen", fr: "Toutes les commandes", it: "Tutti gli ordini", es: "Todos los pedidos" },
    "Sürücü yetkisi bulunamadı": { domain: "driver", key: "driver_permission_not_found", en: "Driver permission not found", de: "Fahrerberechtigung nicht gefunden", fr: "Autorisation de conducteur introuvable", it: "Permesso conducente non trovato", es: "Permiso de conductor no encontrado" },
    "Lütfen yöneticinize başvurun": { domain: "staff", key: "contact_manager", en: "Please contact your manager", de: "Bitte kontaktieren Sie Ihren Manager", fr: "Veuillez contacter votre responsable", it: "Si prega di contattare il proprio manager", es: "Por favor comuníquese con su administrador" },
    "Henüz işletme atanmamış": { domain: "driver", key: "no_business_assigned_yet", en: "No business assigned yet", de: "Noch kein Geschäft zugewiesen", fr: "Aucun magasin attribué pour le moment", it: "Ancora nessun negozio assegnato", es: "Aún no se ha asignado ningún negocio" },
    "Admin panelinden işletme ataması yapılmalı": { domain: "driver", key: "business_assignment_needed_admin", en: "Business assignment must be done from the admin panel", de: "Die Geschäftszuweisung muss über das Admin-Panel erfolgen", fr: "L'attribution du magasin doit être effectuée depuis le panneau d'administration", it: "L'assegnazione del negozio deve essere effettuata dal pannello di amministrazione", es: "La asignación de negocios debe hacerse desde el panel de administración" },
    "Üstlenebilecek teslimat yok": { domain: "driver", key: "no_deliveries_to_take", en: "No deliveries to take", de: "Keine Lieferungen zum Übernehmen", fr: "Aucune livraison à prendre", it: "Nessuna consegna da prendere", es: "No hay entregas para tomar" },
    "Aktif sipariş yok": { domain: "driver", key: "no_active_orders", en: "No active orders", de: "Keine aktiven Bestellungen", fr: "Aucune commande active", it: "Nessun ordine attivo", es: "No hay pedidos activos" },
    "Yükleniyor...": { domain: "common", key: "loading", en: "Loading...", de: "Wird geladen...", fr: "Chargement...", it: "Caricamento...", es: "Cargando..." },
    "Bugün henüz teslimat yok": { domain: "driver", key: "no_deliveries_today", en: "No deliveries today yet", de: "Noch keine Lieferungen heute", fr: "Pas de livraisons aujourd'hui", it: "Nessuna consegna oggi per ora", es: "Aún no hay entregas hoy" },
    "İşletme adresi bulunamadı": { domain: "driver", key: "business_address_not_found", en: "Business address not found", de: "Geschäftsadresse nicht gefunden", fr: "Adresse du magasin introuvable", it: "Indirizzo del negozio non trovato", es: "Dirección de la empresa no encontrada" },
    "Harita Uygulaması Seçin": { domain: "common", key: "select_map_app", en: "Select Map App", de: "Karten-App auswählen", fr: "Sélectionnez l'application de carte", it: "Seleziona App Mappe", es: "Seleccionar aplicación de mapas" },
    "Apple Haritalar": { domain: "common", key: "apple_maps", en: "Apple Maps", de: "Apple Karten", fr: "Plans d'Apple", it: "Mappe Apple", es: "Mapas de Apple" },
    "Google Maps": { domain: "common", key: "google_maps", en: "Google Maps", de: "Google Maps", fr: "Google Maps", it: "Google Maps", es: "Google Maps" },
    "Atanmış İşletmeler": { domain: "driver", key: "assigned_businesses", en: "Assigned Businesses", de: "Zugewiesene Geschäfte", fr: "Magasins attribués", it: "Negozi Assegnati", es: "Negocios asignados" },
    "Sipariş yok": { domain: "orders", key: "no_orders", en: "No orders", de: "Keine Bestellungen", fr: "Pas de commandes", it: "Nessun ordine", es: "Sin pedidos" },
    "GİT": { domain: "common", key: "go_caps", en: "GO", de: "LOS", fr: "ALLER", it: "VAI", es: "IR" },
    "Kurye Takibi": { domain: "orders", key: "courier_tracking", en: "Courier Tracking", de: "Kurierverfolgung", fr: "Suivi de coursier", it: "Tracciamento Corriere", es: "Seguimiento de mensajería" },
    "Güncelle": { domain: "common", key: "update", en: "Update", de: "Aktualisieren", fr: "Mettre à jour", it: "Aggiorna", es: "Actualizar" },
    "Sipariş bulunamadı": { domain: "orders", key: "order_not_found", en: "Order not found", de: "Bestellung nicht gefunden", fr: "Commande introuvable", it: "Ordine non trovato", es: "Pedido no encontrado" },
    "Yolda": { domain: "orders", key: "on_the_way", en: "On the way", de: "Unterwegs", fr: "En route", it: "In arrivo", es: "En camino" },
    "Kurye konumu bekleniyor...": { domain: "orders", key: "waiting_courier_location", en: "Waiting for courier location...", de: "Warten auf Kurierstandort...", fr: "En attente de l'emplacement du coursier...", it: "In attesa della posizione del corriere...", es: "Esperando la ubicación del mensajero..." },
    "Hesabım": { domain: "orders", key: "my_account", en: "My Account", de: "Mein Konto", fr: "Mon compte", it: "Il mio conto", es: "Mi cuenta" },
    "Toplam Hesap": { domain: "orders", key: "total_bill", en: "Total Bill", de: "Gesamtrechnung", fr: "Facture totale", it: "Conto totale", es: "Factura total" },
    "Siparişiniz henüz tamamlanmadı. Teslim edildikten sonra puan verebilirsiniz.": { domain: "orders", key: "cannot_rate_before_completion", en: "Your order is not complete yet. You can rate after it's delivered.", de: "Ihre Bestellung ist noch nicht vollständig. Sie können bewerten, nachdem sie geliefert wurde.", fr: "Votre commande n'est pas encore terminée. Vous pouvez la noter après sa livraison.", it: "Il tuo ordine non è ancora completo. Puoi valutarlo dopo la consegna.", es: "Su pedido aún no está completo. Puede calificar después de que se entregue." },
    "Lütfen işletmeyi puanlayın": { domain: "orders", key: "please_rate_business", en: "Please rate the business", de: "Bitte bewerten Sie das Geschäft", fr: "Veuillez évaluer le magasin", it: "Per favore vota il negozio", es: "Por favor califique el negocio" },
    "Değerlendirmeniz kaydedildi. Teşekkürler! 🎉": { domain: "orders", key: "rating_saved_thanks", en: "Your rating has been saved. Thanks! 🎉", de: "Ihre Bewertung wurde gespeichert. Danke! 🎉", fr: "Votre évaluation a été enregistrée. Merci ! 🎉", it: "La tua recensione è stata salvata. Grazie! 🎉", es: "Su calificación ha sido guardada. ¡Gracias! 🎉" },
    "Değerlendirme Yap": { domain: "orders", key: "make_rating", en: "Rate", de: "Bewerten", fr: "Évaluer", it: "Valuta", es: "Calificar" },
    "İşletmeyi Puanla": { domain: "orders", key: "rate_business", en: "Rate Business", de: "Geschäft bewerten", fr: "Évaluer le magasin", it: "Valuta Negozio", es: "Calificar Negocio" },
    "Yorum Yazın": { domain: "orders", key: "write_comment", en: "Write a Review", de: "Eine Bewertung schreiben", fr: "Rédiger un avis", it: "Scrivi una Recensione", es: "Escribir un comentario" }
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

fs.writeFileSync('phase3_translations_merged.json', JSON.stringify(TRANSLATIONS_MERGED, null, 2));

const targetDirs = [
    path.join(__dirname, 'lib/screens/driver'),
    path.join(__dirname, 'lib/screens/orders')
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
                console.log(`Replaced Phase 3 file: ${fullPath}`);
            }
        }
    }
}

targetDirs.forEach(replaceInDartFiles);
