const fs = require('fs');
const path = require('path');

const TRANSLATIONS = {
    tr: {}, en: {}, de: {}, fr: {}, it: {}, es: {}
};

// Map literal static strings
const staticDict = {
    "Menü Öğesi Ekle": { domain: "kermes", key: "add_menu_item", en: "Add Menu Item", de: "Menüpunkt hinzufügen", fr: "Ajouter un élément au menu", it: "Aggiungi voce menu", es: "Añadir elemento al menú" },
    "İptal": { domain: "common", key: "cancel", en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla", es: "Cancelar" },
    "Ekle": { domain: "common", key: "add", en: "Add", de: "Hinzufügen", fr: "Ajouter", it: "Aggiungi", es: "Añadir" },
    "Park Alanı Ekle": { domain: "kermes", key: "add_parking_area", en: "Add Parking Area", de: "Parkplatz hinzufügen", fr: "Ajouter un parking", it: "Aggiungi area di parcheggio", es: "Añadir aparcamiento" },
    "Kermes başarıyla eklendi! Onay bekleniyor.": { domain: "kermes", key: "kermes_added_waiting_approval", en: "Kermes added successfully! Awaiting approval.", de: "Kermes erfolgreich hinzugefügt! Warten auf Genehmigung.", fr: "Kermès ajoutée avec succès ! En attente d'approbation.", it: "Kermes aggiunta con successo! In attesa di approvazione.", es: "¡Kermes agregada exitosamente! Esperando aprobación." },
    "Hata: $e": { domain: "common", key: "error_e", en: "Error: $e", de: "Fehler: $e", fr: "Erreur : $e", it: "Errore: $e", es: "Error: $e" },
    "HADEF": { domain: "kermes", key: "hadef", en: "HADEF", de: "HADEF", fr: "HADEF", it: "HADEF", es: "HADEF" },
    "Yeni Kermes Ekle": { domain: "kermes", key: "add_new_kermes", en: "Add New Kermes", de: "Neues Kermes hinzufügen", fr: "Ajouter une nouvelle kermès", it: "Aggiungi nuova kermes", es: "Añadir nueva kermes" },
    "Kermes bilgilerini eksiksiz doldurun. Eklenen kermes admin onayından sonra yayınlanacaktır.": { domain: "kermes", key: "fill_kermes_info_prompt", en: "Fill out the Kermes information completely. The added Kermes will be published after admin approval.", de: "Füllen Sie die Kermes-Informationen vollständig aus. Die hinzugefügte Kermes wird nach Genehmigung durch den Administrator veröffentlicht.", fr: "Remplissez complètement les informations de la kermès. La kermès ajoutée sera publiée après l'approbation de l'administrateur.", it: "Compila completamente le informazioni della kermes. La kermes aggiunta sarà pubblicata dopo l'approvazione dell'amministratore.", es: "Complete toda la información de kermes. La kermes agregada se publicará después de la aprobación del administrador." },
    "Dernek Seç": { domain: "kermes", key: "select_association", en: "Select Association", de: "Verein auswählen", fr: "Sélectionner l'association", it: "Seleziona associazione", es: "Seleccionar asociación" },
    "Seçilen Dernek:": { domain: "kermes", key: "selected_association", en: "Selected Association:", de: "Ausgewählter Verein:", fr: "Association sélectionnée :", it: "Associazione selezionata:", es: "Asociación seleccionada:" },
    "Tuna Et Mamülleri (Avrupa)": { domain: "kermes", key: "tuna_meat_europe", en: "Tuna Meat Products (Europe)", de: "Tuna Fleischprodukte (Europa)", fr: "Produits carnés Tuna (Europe)", it: "Prodotti a base di carne Tuna (Europa)", es: "Productos cárnicos Tuna (Europa)" },
    "Akdeniz Toros (Türkiye)": { domain: "kermes", key: "akdeniz_toros_turkey", en: "Akdeniz Toros (Turkey)", de: "Akdeniz Toros (Türkei)", fr: "Akdeniz Toros (Turquie)", it: "Akdeniz Toros (Turchia)", es: "Akdeniz Toros (Turquía)" },
    "Sponsor Yok": { domain: "kermes", key: "no_sponsor", en: "No Sponsor", de: "Kein Sponsor", fr: "Pas de sponsor", it: "Nessun sponsor", es: "Sin patrocinador" },
    "KERMESİ KAYDET": { domain: "kermes", key: "save_kermes_caps", en: "SAVE KERMES", de: "KERMES SPEICHERN", fr: "ENREGISTRER KERMÈS", it: "SALVA KERMES", es: "GUARDAR KERMES" },
    "Sipariş hatası: $e": { domain: "orders", key: "order_error_e", en: "Order error: $e", de: "Bestellfehler: $e", fr: "Erreur de commande : $e", it: "Errore dell'ordine: $e", es: "Error de pedido: $e" },
    "Sepetiniz boş": { domain: "cart", key: "your_cart_is_empty", en: "Your cart is empty", de: "Dein Warenkorb ist leer", fr: "Votre panier est vide", it: "Il tuo carrello è vuoto", es: "Tu carrito esta vacío" },
    "Toplam Tutar": { domain: "cart", key: "total_amount", en: "Total Amount", de: "Gesamtbetrag", fr: "Montant total", it: "Importo totale", es: "Cantidad total" },
    "Nasıl sipariş vermek istersiniz?": { domain: "orders", key: "how_would_you_like_to_order", en: "How would you like to order?", de: "Wie möchten Sie bestellen?", fr: "Comment souhaitez-vous commander ?", it: "Come vorresti ordinare?", es: "¿Cómo le gustaría hacer el pedido?" },
    "Ailecek sipariş özelliği yakında kullanıma sunulacak!": { domain: "orders", key: "family_order_coming_soon", en: "Family ordering feature will be available soon!", de: "Die Funktion für Familienbestellungen ist bald verfügbar!", fr: "La fonctionnalité de commande familiale sera bientôt disponible !", it: "La funzione di ordine famigliare sarà disponibile a breve!", es: "¡La función para pedidos familiares estará disponible pronto!" },
    "Siparişinizi nasıl almak istersiniz?": { domain: "orders", key: "how_to_receive_order", en: "How would you like to receive your order?", de: "Wie möchten Sie Ihre Bestellung erhalten?", fr: "Comment souhaitez-vous recevoir votre commande ?", it: "Come vorresti ricevere il tuo ordine?", es: "¿Cómo le gustaría recibir su pedido?" },
    "Siparişiniz için bilgilerinizi girin": { domain: "orders", key: "enter_info_for_order", en: "Enter your information for the order", de: "Geben Sie Ihre Informationen für die Bestellung ein", fr: "Saisissez vos informations pour la commande", it: "Inserisci le tue informazioni per l'ordine", es: "Ingrese su información para el pedido" },
    "Diğer Kermesleri Keşfet": { domain: "kermes", key: "discover_other_kermes", en: "Discover Other Kermes", de: "Andere Kermes entdecken", fr: "Découvrez d'autres kermès", it: "Scopri altre kermes", es: "Descubrir otras kermes" },
    "Toplam": { domain: "common", key: "total", en: "Total", de: "Gesamt", fr: "Total", it: "Totale", es: "Total" },
    "Ödeme Yöntemi": { domain: "payments", key: "payment_method", en: "Payment Method", de: "Zahlungsmethode", fr: "Méthode de paiement", it: "Metodo di pagamento", es: "Método de pago" },
    "TARİH": { domain: "common", key: "date_caps", en: "DATE", de: "DATUM", fr: "DATE", it: "DATA", es: "FECHA" },
    "SAAT": { domain: "common", key: "time_caps", en: "TIME", de: "UHRZEIT", fr: "HEURE", it: "ORA", es: "HORA" },
    "★ Popüler": { domain: "common", key: "popular_star", en: "★ Popular", de: "★ Beliebt", fr: "★ Populaire", it: "★ Popolare", es: "★ Popular" },
    "ONLİNE SİPARİŞ": { domain: "orders", key: "online_order_caps", en: "ONLINE ORDER", de: "ONLINE BESTELLUNG", fr: "COMMANDE EN LIGNE", it: "ORDINE ONLINE", es: "PEDIDO EN LÍNEA" },
    "Menü ve\\nSipariş": { domain: "kermes", key: "menu_and_order_newlines", en: "Menu and\\nOrder", de: "Menü und\\nBestellung", fr: "Menu et\\nCommande", it: "Menu e\\nOrdine", es: "Menú y\\nPedido" },
    "LOKASYON": { domain: "common", key: "location_caps", en: "LOCATION", de: "STANDORT", fr: "EMPLACEMENT", it: "POSIZIONE", es: "UBICACIÓN" },
    "NAVİGASYON": { domain: "common", key: "navigation_caps", en: "NAVIGATION", de: "NAVIGATION", fr: "NAVIGATION", it: "NAVIGAZIONE", es: "NAVEGACIÓN" },
    "P": { domain: "common", key: "letter_p", en: "P", de: "P", fr: "P", it: "P", es: "P" },
    "Park Bilgisi": { domain: "kermes", key: "parking_info", en: "Parking Info", de: "Parkinformationen", fr: "Informations sur le parking", it: "Info parcheggio", es: "Información de estacionamiento" },
    "Müsait Park Alanı": { domain: "kermes", key: "available_parking_area", en: "Available Parking Area", de: "Verfügbarer Parkplatz", fr: "Aire de stationnement disponible", it: "Area di parcheggio disponibile", es: "Área de estacionamiento disponible" },
    "CANLI": { domain: "common", key: "live_caps", en: "LIVE", de: "LIVE", fr: "EN DIRECT", it: "IN DIRETTA", es: "EN VIVO" },
    "SAATLİK TAHMİN": { domain: "kermes", key: "hourly_forecast_caps", en: "HOURLY FORECAST", de: "STÜNDLICHE VORHERSAGE", fr: "PRÉVISIONS HORAIRES", it: "PREVISIONI ORARIE", es: "PRONÓSTICO POR HORA" },
    "YETKİLİ KİŞİ": { domain: "kermes", key: "authorized_person_caps", en: "AUTHORIZED PERSON", de: "AUTORISIERTE PERSON", fr: "PERSONNE AUTORISÉE", it: "PERSONA AUTORIZZATA", es: "PERSONA AUTORIZADA" },
    "Sıralama": { domain: "common", key: "sorting", en: "Sorting", de: "Sortierung", fr: "Tri", it: "Ordinamento", es: "Ordenando" },
    "Kermes bulunamadı": { domain: "kermes", key: "kermes_not_found", en: "Kermes not found", de: "Kermes nicht gefunden", fr: "Kermès introuvable", it: "Kermes non trovata", es: "Kermes no encontrada" },
    "MEVCUT KONUM": { domain: "common", key: "current_location_caps", en: "CURRENT LOCATION", de: "AKTUELLER STANDORT", fr: "EMPLACEMENT ACTUEL", it: "POSIZIONE ATTUALE", es: "UBICACIÓN ACTUAL" },
    "Farklı Kermes Siparişi": { domain: "cart", key: "different_kermes_order", en: "Different Kermes Order", de: "Andere Kermes-Bestellung", fr: "Différentes commandes de kermès", it: "Ordine di kermes diverso", es: "Diferentes pedidos de kermes" },
    "Sepeti Değiştir": { domain: "cart", key: "change_cart", en: "Change Cart", de: "Warenkorb ändern", fr: "Changer de panier", it: "Cambia carrello", es: "Cambiar carrito" },
    "MENÜ": { domain: "common", key: "menu_caps", en: "MENU", de: "MENÜ", fr: "MENU", it: "MENU", es: "MENÚ" },
    "Menüde ürün bulunmuyor": { domain: "common", key: "no_products_in_menu", en: "No products in the menu", de: "Keine Produkte auf der Speisekarte", fr: "Aucun produit au menu", it: "Nessun prodotto nel menu", es: "No hay productos en el menú" },
    "Sepeti Görüntüle": { domain: "cart", key: "view_cart", en: "View Cart", de: "Warenkorb ansehen", fr: "Voir le panier", it: "Visualizza carrello", es: "Ver carrito" },
    "Tükendi": { domain: "common", key: "sold_out", en: "Sold Out", de: "Ausverkauft", fr: "Épuisé", it: "Esaurito", es: "Agotado" },
    "Kurye teslimatı için adres seçimi yakında eklenecek.": { domain: "orders", key: "address_selection_courier_coming_soon", en: "Address selection for courier delivery will be added soon.", de: "Die Adressauswahl für die Kurierlieferung wird bald hinzugefügt.", fr: "La sélection d'adresse pour la livraison par coursier sera bientôt ajoutée.", it: "La selezione dell'indirizzo per la consegna del corriere verrà aggiunta a breve.", es: "La selección de direcciones para la entrega por mensajería se agregará pronto." },
    "Sipariş oluşturulamadı: $e": { domain: "orders", key: "could_not_create_order_e", en: "Could not create order: $e", de: "Bestellung konnte nicht erstellt werden: $e", fr: "Impossible de créer la commande : $e", it: "Impossibile creare l'ordine: $e", es: "No se pudo crear el pedido: $e" },
    "Sipariş Alındı!": { domain: "orders", key: "order_received", en: "Order Received!", de: "Bestellung erhalten!", fr: "Commande reçue !", it: "Ordine ricevuto!", es: "¡Pedido recibido!" },
    "Toplam:": { domain: "common", key: "total_colon", en: "Total:", de: "Gesamt:", fr: "Total :", it: "Totale:", es: "Total:" },
    "Tamam": { domain: "common", key: "ok", en: "OK", de: "OK", fr: "D'accord", it: "OK", es: "OK" },
    "Acil Park Anonsu": { domain: "kermes", key: "emergency_parking_announcement", en: "Emergency Parking Announcement", de: "Notfall Parkankündigung", fr: "Annonce de parking d'urgence", it: "Annuncio parcheggio di emergenza", es: "Anuncio de estacionamiento de emergencia" },
    "Bu mesaj kermesteki tüm kullanıcılara push bildirim olarak gönderilecek.": { domain: "kermes", key: "announcement_will_be_sent_to_all", en: "This message will be sent to all users at the Kermes as a push notification.", de: "Diese Nachricht wird als Push-Benachrichtigung an alle Benutzer der Kermes gesendet.", fr: "Ce message sera envoyé à tous les utilisateurs de la kermès sous forme de notification push.", it: "Questo messaggio verrà inviato a tutti gli utenti alla Kermes come notifica push.", es: "Este mensaje se enviará a todos los usuarios de la Kermes como notificación push." },
    "Gönder": { domain: "common", key: "send", en: "Send", de: "Senden", fr: "Envoyer", it: "Invia", es: "Enviar" },
    "Acil anons gönderildi!": { domain: "kermes", key: "emergency_announcement_sent", en: "Emergency announcement sent!", de: "Notfallankündigung gesendet!", fr: "Annonce d'urgence envoyée !", it: "Annuncio di emergenza inviato!", es: "¡Anuncio de emergencia enviado!" },
    "Haritayı Seç": { domain: "common", key: "select_map", en: "Select Map", de: "Karte auswählen", fr: "Sélectionnez la carte", it: "Seleziona Mappa", es: "Seleccionar mapa" },
    "Varsayılan": { domain: "common", key: "default", en: "Default", de: "Standard", fr: "Défaut", it: "Predefinito", es: "Por defecto" },
    "Acil Anons": { domain: "kermes", key: "emergency_announcement", en: "Emergency Announcement", de: "Notfallankündigung", fr: "Annonce d'urgence", it: "Annuncio di emergenza", es: "Anuncio de emergencia" },
    "Park İmkanları": { domain: "kermes", key: "parking_facilities", en: "Parking Facilities", de: "Parkmöglichkeiten", fr: "Installations de stationnement", it: "Strutture di parcheggio", es: "Instalaciones de estacionamiento" },
    "Park bilgisi bulunamadı": { domain: "kermes", key: "parking_info_not_found", en: "Parking info not found", de: "Parkinformationen nicht gefunden", fr: "Informations de stationnement introuvables", it: "Informazioni sul parcheggio non trovate", es: "Información de estacionamiento no encontrada" },
    "İlk Park Alanını Ekle": { domain: "kermes", key: "add_first_parking_area", en: "Add First Parking Area", de: "Ersten Parkplatz hinzufügen", fr: "Ajouter la première aire de stationnement", it: "Aggiungi prima area di parcheggio", es: "Añadir primera zona de aparcamiento" },
    "Park Ekle": { domain: "kermes", key: "add_parking", en: "Add Parking", de: "Parkplatz hinzufügen", fr: "Ajouter un parking", it: "Aggiungi parcheggio", es: "Añadir aparcamiento" },
    "Yol Tarifi": { domain: "common", key: "directions", en: "Directions", de: "Wegbeschreibung", fr: "Itinéraire", it: "Indicazioni", es: "Dirección" },
    "Adres kopyalandı": { domain: "common", key: "address_copied", en: "Address copied", de: "Adresse kopiert", fr: "Adresse copiée", it: "Indirizzo copiato", es: "Dirección copiada" },
    "Yeni Park Alanı": { domain: "kermes", key: "new_parking_area", en: "New Parking Area", de: "Neuer Parkplatz", fr: "Nouvelle aire de stationnement", it: "Nuova area di parcheggio", es: "Nueva área de estacionamiento" },
    "Park alanı eklendi": { domain: "kermes", key: "parking_area_added", en: "Parking area added", de: "Parkplatz hinzugefügt", fr: "Aire de stationnement ajoutée", it: "Area di parcheggio aggiunta", es: "Área de estacionamiento agregada" },
    "🚀 Hızlı Ekle": { domain: "common", key: "quick_add_rocket", en: "🚀 Quick Add", de: "🚀 Schnell hinzufügen", fr: "🚀 Ajout rapide", it: "🚀 Aggiunta rapida", es: "🚀 Añadido rápido" },
    "📍 Konum alındı!": { domain: "kermes", key: "location_received_pin", en: "📍 Location received!", de: "📍 Standort erhalten!", fr: "📍 Emplacement reçu !", it: "📍 Posizione ricevuta!", es: "📍 ¡Ubicación recibida!" },
    "Konum hatası: $e": { domain: "common", key: "location_error_e", en: "Location error: $e", de: "Standortfehler: $e", fr: "Erreur de localisation : $e", it: "Errore di posizione: $e", es: "Error de ubicación: $e" },
    "📍 Kermes adresi eklendi!": { domain: "kermes", key: "kermes_address_added_pin", en: "📍 Kermes address added!", de: "📍 Kermes-Adresse hinzugefügt!", fr: "📍 Adresse de kermès ajoutée !", it: "📍 Indirizzo kermes aggiunto!", es: "📍 ¡Dirección de kermes agregada!" },
    "Kermes Adresi": { domain: "kermes", key: "kermes_address", en: "Kermes Address", de: "Kermes Adresse", fr: "Adresse de la kermès", it: "Indirizzo Kermes", es: "Dirección de Kermes" },
    "🔍 Adres Ara (Google)": { domain: "common", key: "search_address_google", en: "🔍 Search Address (Google)", de: "🔍 Adresse suchen (Google)", fr: "🔍 Rechercher l'adresse (Google)", it: "🔍 Cerca indirizzo (Google)", es: "🔍 Buscar dirección (Google)" },
    "📍 Adres Bilgileri": { domain: "common", key: "address_details_pin", en: "📍 Address Details", de: "📍 Adressdetails", fr: "📍 Détails de l'adresse", it: "📍 Dettagli dell'indirizzo", es: "📍 Detalles de la dirección" },
    "📝 Açıklama": { domain: "common", key: "description_memo", en: "📝 Description", de: "📝 Beschreibung", fr: "📝 Description", it: "📝 Descrizione", es: "📝 Descripción" },
    "Adres bilgilerini doldurun": { domain: "common", key: "fill_address_info", en: "Fill out address info", de: "Adressinformationen ausfüllen", fr: "Remplir les informations de l'adresse", it: "Compila info indirizzo", es: "Rellena la información de la dirección" },
    "✅ Park alanı eklendi!": { domain: "kermes", key: "parking_area_added_success", en: "✅ Parking area added!", de: "✅ Parkplatz hinzugefügt!", fr: "✅ Aire de stationnement ajoutée !", it: "✅ Area di parcheggio aggiunta!", es: "✅ ¡Área de estacionamiento agregada!" },
    "📷 Resimler": { domain: "kermes", key: "images_camera", en: "📷 Images", de: "📷 Bilder", fr: "📷 Images", it: "📷 Immagini", es: "📷 Imágenes" },
    "Kaydediliyor...": { domain: "common", key: "saving", en: "Saving...", de: "Speichern...", fr: "Enregistrement...", it: "Salvataggio...", es: "Guardando..." },
    "Değişiklikleri Kaydet": { domain: "common", key: "save_changes", en: "Save Changes", de: "Änderungen speichern", fr: "Enregistrer les modifications", it: "Salva modifiche", es: "Guardar cambios" },
    "✅ Park alanı güncellendi!": { domain: "kermes", key: "parking_area_updated_success", en: "✅ Parking area updated!", de: "✅ Parkplatz aktualisiert!", fr: "✅ Aire de stationnement mise à jour !", it: "✅ Area di parcheggio aggiornata!", es: "✅ ¡Área de estacionamiento actualizada!" },
    "Park Alanını Sil": { domain: "kermes", key: "delete_parking_area", en: "Delete Parking Area", de: "Parkplatz löschen", fr: "Supprimer l'aire de stationnement", it: "Elimina area parcheggio", es: "Eliminar zona de aparcamiento" },
    "Bu park alanını silmek istediğinize emin misiniz?": { domain: "kermes", key: "confirm_delete_parking_area", en: "Are you sure you want to delete this parking area?", de: "Möchten Sie diesen Parkplatz wirklich löschen?", fr: "Êtes-vous sûr de vouloir supprimer cette aire de stationnement ?", it: "Sei sicuro di voler eliminare quest'area di parcheggio?", es: "¿Está seguro de que desea eliminar esta zona de aparcamiento?" },
    "Sil": { domain: "common", key: "delete", en: "Delete", de: "Löschen", fr: "Supprimer", it: "Elimina", es: "Eliminar" },
    "Park alanı silindi": { domain: "kermes", key: "parking_area_deleted", en: "Parking area deleted", de: "Parkplatz gelöscht", fr: "Aire de stationnement supprimée", it: "Area parcheggio eliminata", es: "Zona de aparcamiento eliminada" },
    "Yakınlaştırmak için sıkıştırın": { domain: "kermes", key: "pinch_to_zoom", en: "Pinch to zoom", de: "Zum Zoomen kneifen", fr: "Pincez pour zoomer", it: "Pizzica per rimpicciolire", es: "Pellizcar para acercar" }
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

fs.writeFileSync('kermes_translations_merged.json', JSON.stringify(TRANSLATIONS_MERGED, null, 2));

const targetDirs = [
    path.join(__dirname, 'lib/screens/kermes'),
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
                console.log(`Replaced Kermes file: ${fullPath}`);
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
        console.log(`Updated Kermes JSON in ${lang}.json`);
    } else {
        console.warn(`${lang}.json not found!`);
    }
}
