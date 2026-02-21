const fs = require('fs');
const path = require('path');

const TRANSLATIONS = {
    tr: {}, en: {}, de: {}, fr: {}, it: {}, es: {}
};

// Map literal static strings
const staticDict = {
    "Catering Hizmetleri": { domain: "marketplace", key: "catering_services", en: "Catering Services", de: "Cateringdienste", fr: "Services de traiteur", it: "Servizi di catering", es: "Servicios de cátering" },
    "Fiyatları Görmek İçin Giriş Yapın": { domain: "marketplace", key: "login_to_see_prices", en: "Login to See Prices", de: "Anmelden, um Preise zu sehen", fr: "Connectez-vous pour voir les prix", it: "Accedi per vedere i prezzi", es: "Inicie sesión para ver los precios" },
    "Catering fiyatları üyelere özeldir": { domain: "marketplace", key: "catering_prices_members_only", en: "Catering prices are member-exclusive", de: "Catering-Preise sind exklusiv für Mitglieder", fr: "Les prix de la restauration sont réservés aux membres", it: "I prezzi del catering sono esclusivi per i membri", es: "Los precios de catering son exclusivos para miembros" },
    "Giriş Yap": { domain: "auth", key: "login", en: "Login", de: "Anmelden", fr: "Connexion", it: "Accedi", es: "Iniciar sesión" },
    "Yakında Catering İşletmeleri": { domain: "marketplace", key: "catering_businesses_nearby", en: "Catering Businesses Nearby", de: "Catering-Unternehmen in der Nähe", fr: "Entreprises de restauration à proximité", it: "Aziende di catering nelle vicinanze", es: "Empresas de catering cercanas" },
    "Catering hizmeti veren işletmeler henüz eklenmedi": { domain: "marketplace", key: "no_catering_businesses_added_yet", en: "No catering businesses have been added yet", de: "Noch keine Catering-Unternehmen hinzugefügt", fr: "Aucune entreprise de restauration n'a encore été ajoutée", it: "Nessuna azienda di catering è stata ancora aggiunta", es: "Aún no se han añadido empresas de catering" },
    "💰 Fiyat teklifi için iletişime geçin": { domain: "marketplace", key: "contact_for_price_quote", en: "💰 Contact for a price quote", de: "💰 Kontakt für ein Preisangebot", fr: "💰 Contactez pour un devis", it: "💰 Contatta per un preventivo di prezzo", es: "💰 Contactar para obtener un presupuesto" },
    "🔒 Giriş yapın ve fiyatları görün": { domain: "marketplace", key: "login_and_see_prices_lock", en: "🔒 Login and see prices", de: "🔒 Anmelden und Preise sehen", fr: "🔒 Connectez-vous et voyez les prix", it: "🔒 Accedi e vedi i prezzi", es: "🔒 Inicie sesión y vea los precios" },
    "🎉 Catering Hizmeti": { domain: "marketplace", key: "catering_service_party", en: "🎉 Catering Service", de: "🎉 Catering-Service", fr: "🎉 Service traiteur", it: "🎉 Servizio Cating", es: "🎉 Servicio de cátering" },
    "Kahve Shop": { domain: "marketplace", key: "coffee_shop", en: "Coffee Shop", de: "Coffeeshop", fr: "Café", it: "Caffetteria", es: "Cafetería" },
    "İşletme Şu An Kapalı": { domain: "marketplace", key: "store_currently_closed", en: "Store is currently closed", de: "Geschäft ist derzeit geschlossen", fr: "Le magasin est actuellement fermé", it: "Il negozio è attualmente chiuso", es: "La tienda está cerrada actualmente" },
    "Ön Sipariş Aktif": { domain: "marketplace", key: "pre_order_active", en: "Pre-order Active", de: "Vorbestellung aktiv", fr: "Pré-commande active", it: "Preordine attivo", es: "Pedido anticipado activo" },
    "Açık İşletmeleri Bul": { domain: "marketplace", key: "find_open_businesses", en: "Find Open Businesses", de: "Offene Geschäfte finden", fr: "Trouver des entreprises ouvertes", it: "Trova aziende aperte", es: "Buscar empresas abiertas" },
    "Haftalık Çalışma Saatleri": { domain: "marketplace", key: "weekly_working_hours", en: "Weekly Working Hours", de: "Wöchentliche Arbeitszeiten", fr: "Heures de travail hebdomadaires", it: "Orari di lavoro settimanali", es: "Horas de trabajo semanales" },
    "Yorumlar": { domain: "marketplace", key: "reviews", en: "Reviews", de: "Bewertungen", fr: "Avis", it: "Recensioni", es: "Reseñas" },
    "Henüz yorum yapılmamış.": { domain: "marketplace", key: "no_reviews_yet", en: "No reviews yet.", de: "Noch keine Bewertungen.", fr: "Aucun avis pour le moment.", it: "Nessuna recensione ancora.", es: "No hay reseñas todavía." },
    "Kategoriler": { domain: "marketplace", key: "categories", en: "Categories", de: "Kategorien", fr: "Catégories", it: "Categorie", es: "Categorías" },
    "Tedarik Standartları": { domain: "marketplace", key: "supply_standards", en: "Supply Standards", de: "Lieferstandards", fr: "Normes d'approvisionnement", it: "Standard di fornitura", es: "Estándares de suministro" },
    "Üretim Standartları": { domain: "marketplace", key: "production_standards", en: "Production Standards", de: "Produktionsstandards", fr: "Normes de production", it: "Standard di produzione", es: "Estándares de producción" },
    "Çalışma Saatleri": { domain: "marketplace", key: "business_hours", en: "Business Hours", de: "Öffnungszeiten", fr: "Heures d'ouverture", it: "Orario di lavoro", es: "Horas de oficina" },
    "Bilgi yüklenirken hata oluştu.": { domain: "common", key: "error_loading_info", en: "Error loading info.", de: "Fehler beim Laden von Informationen.", fr: "Erreur lors du chargement des informations.", it: "Errore durante il caricamento delle info.", es: "Error al cargar la información." },
    "Çalışma saatleri görüntülenemiyor.": { domain: "marketplace", key: "business_hours_cannot_be_displayed", en: "Business hours cannot be displayed.", de: "Öffnungszeiten können nicht angezeigt werden.", fr: "Les heures d'ouverture ne peuvent pas être affichées.", it: "L'orario di lavoro non può essere visualizzato.", es: "El horario de apertura no se puede mostrar." },
    "Çalışma saatleri bilgisi yükleniyor...": { domain: "marketplace", key: "loading_business_hours", en: "Loading business hours...", de: "Öffnungszeiten werden geladen...", fr: "Chargement des heures d'ouverture...", it: "Caricamento orario di lavoro...", es: "Cargando el horario de oficina..." },
    "Çalışma saatleri bilgisi bulunamadı.": { domain: "marketplace", key: "business_hours_not_found", en: "Business hours info not found.", de: "Informationen zu Öffnungszeiten nicht gefunden.", fr: "Informations sur les heures d'ouverture introuvables.", it: "Info orario di lavoro non trovate.", es: "Información de horario de apertura no encontrada." },
    "Çalışma saatleri bilgisi girilmemiş.": { domain: "marketplace", key: "business_hours_not_entered", en: "Business hours info not entered.", de: "Informationen zu Öffnungszeiten nicht eingetragen.", fr: "Informations sur les heures d'ouverture non saisies.", it: "Info orario di lavoro non inserite.", es: "Información de horario de apertura no ingresada." },
    "Detaylı saat bilgisi için işletmeyi arayın.": { domain: "marketplace", key: "call_store_for_hours", en: "Call store for detailed hour info.", de: "Rufen Sie das Geschäft für detaillierte Stundeninfos an.", fr: "Appelez le magasin pour des informations détaillées sur les horaires.", it: "Chiama il negozio per informazioni orarie dettagliate.", es: "Llame al establecimiento para obtener información detallada de los horarios." },
    "Saat formatı desteklenmiyor.": { domain: "marketplace", key: "time_format_not_supported", en: "Time format not supported.", de: "Zeitformat wird nicht unterstützt.", fr: "Format d'heure non pris en charge.", it: "Formato ora non supportato.", es: "Formato de tiempo no compatible." },
    "Saat bilgisi boş.": { domain: "marketplace", key: "time_info_empty", en: "Time info is empty.", de: "Zeitinformation ist leer.", fr: "Les infos d'heure sont vides.", it: "Informazioni sull'ora vuote.", es: "La información de tiempo está vacía." },
    "Bu tarihte teslim edilecektir.": { domain: "orders", key: "will_be_delivered_on_this_date", en: "Will be delivered on this date.", de: "Wird an diesem Datum geliefert.", fr: "Sera livré à cette date.", it: "Verrà consegnato in questa data.", es: "Se entregará en esta fecha." },
    "Premium kalite. %100 Yerli.": { domain: "marketplace", key: "premium_quality_100_local", en: "Premium quality. 100% Local.", de: "Premium-Qualität. 100% Lokal.", fr: "Qualité premium. 100 % local.", it: "Qualità premium. 100% Locale.", es: "Calidad premium. 100% Local." },
    "Sepetinize Eklendi!": { domain: "cart", key: "added_to_cart_exclamation", en: "Added to Cart!", de: "Zum Warenkorb hinzugefügt!", fr: "Ajouté au panier !", it: "Aggiunto al carrello!", es: "¡Añadido a la cesta!" },
    "Dieser Artikel ist zurzeit nicht verfügbar.": { domain: "marketplace", key: "item_not_available_de", en: "This item is currently not available.", de: "Dieser Artikel ist zurzeit nicht verfügbar.", fr: "Cet article n'est actuellement pas disponible.", it: "Questo articolo non è attualmente disponibile.", es: "Este artículo no está disponible actualmente." },
    "Nicht verfügbar": { domain: "marketplace", key: "not_available_de", en: "Not available", de: "Nicht verfügbar", fr: "Indisponible", it: "Non disponibile", es: "No disponible" },
    "Masada Sipariş": { domain: "orders", key: "table_order", en: "Table Order", de: "Tischbestellung", fr: "Commande à table", it: "Ordine al Tavolo", es: "Pedido en mesa" },
    "Bu işletmede masada olduğunuzu onaylıyor musunuz?": { domain: "orders", key: "confirm_you_are_at_table_here", en: "Do you confirm you are at a table in this business?", de: "Bestätigen Sie, dass Sie in diesem Geschäft an einem Tisch sitzen?", fr: "Confirmez-vous être à une table de ce magasin ?", it: "Confermi di essere al tavolo in questa attività?", es: "¿Confirma que está en una mesa de este negocio?" },
    "İptal": { domain: "common", key: "cancel", en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla", es: "Cancelar" },
    "Masada sipariş modu aktif! Menüden ürün ekleyin.": { domain: "orders", key: "table_order_mode_active_add_products", en: "Table order mode is active! Add products from the menu.", de: "Tischbestellmodus ist aktiv! Fügen Sie Produkte aus dem Menü hinzu.", fr: "Le mode commande à table est actif ! Ajoutez des produits du menu.", it: "La modalità ordine al tavolo è attiva! Aggiungi i prodotti dal menu.", es: "¡El modo de pedido en mesa está activo! Añade productos del menú." },
    "Onaylıyorum": { domain: "common", key: "i_confirm", en: "I confirm", de: "Ich bestätige", fr: "Je confirme", it: "Confermo", es: "Confirmo" },
    "Sonuç bulunamadı": { domain: "common", key: "no_results_found", en: "No results found", de: "Keine Ergebnisse gefunden", fr: "Aucun résultat trouvé", it: "Nessun risultato trovato", es: "No se han encontrado resultados" },
    "Soğuk Zincir Teslimat": { domain: "marketplace", key: "cold_chain_delivery", en: "Cold Chain Delivery", de: "Kühlkettenlieferung", fr: "Livraison de la chaîne du froid", it: "Consegna della catena del freddo", es: "Entrega en cadena de frío" },
    "Et ürünlerimiz, soğuk zincir kırılmadan özel korumalı kutularda maksimum hızla size ulaştırılır.": { domain: "marketplace", key: "cold_chain_delivery_desc", en: "Our meat products are delivered to you at maximum speed in specially protected boxes without breaking the cold chain.", de: "Unsere Fleischprodukte werden in speziell geschützten Kartons mit maximaler Geschwindigkeit zu Ihnen geliefert, ohne die Kühlkette zu unterbrechen.", fr: "Nos produits carnés vous sont livrés à vitesse maximale dans des boîtes spécialement protégées sans rompre la chaîne du froid.", it: "I nostri prodotti a base di carne ti vengono consegnati alla massima velocità in scatole appositamente protette senza interrompere la catena del freddo.", es: "Nuestros productos cárnicos se le entregan a la máxima velocidad en cajas especialmente protegidas sin romper la cadena de frío." },
    "Anladım": { domain: "common", key: "got_it", en: "Got it", de: "Verstanden", fr: "Compris", it: "Capito", es: "Entendido" },
    "GEL AL": { domain: "orders", key: "pickup_caps", en: "PICKUP", de: "ABHOLUNG", fr: "RETRAIT", it: "RITIRO", es: "RECOGIDA" },
    "KURYE": { domain: "orders", key: "courier_caps", en: "COURIER", de: "KURIER", fr: "COURSIER", it: "CORRIERE", es: "MENSAJERO" },
    "Mesafe:": { domain: "common", key: "distance_colon", en: "Distance:", de: "Entfernung:", fr: "Distance :", it: "Distanza:", es: "Distancia:" },
    "Bir hata oluştu": { domain: "common", key: "an_error_occurred", en: "An error occurred", de: "Ein Fehler ist aufgetreten", fr: "Une erreur est survenue", it: "Si è verificato un errore", es: "Ocurrió un error" },
    "TEŞEKKÜR EDERİZ!": { domain: "orders", key: "thank_you_caps", en: "THANK YOU!", de: "VIELEN DANK!", fr: "MERCI !", it: "GRAZIE!", es: "¡GRACIAS!" },
    "Afiyet olsun": { domain: "orders", key: "enjoy_your_meal", en: "Enjoy your meal", de: "Guten Appetit", fr: "Bon appétit", it: "Buon appetito", es: "Buen provecho" },
    "Hesabı Göster": { domain: "orders", key: "show_receipt", en: "Show Receipt", de: "Quittung anzeigen", fr: "Afficher le reçu", it: "Mostra Ricevuta", es: "Mostrar recibo" },
    "Gel Al": { domain: "orders", key: "pickup", en: "Pickup", de: "Abholung", fr: "Retrait", it: "Ritiro", es: "Recogida" },
    "Düzenle": { domain: "common", key: "edit", en: "Edit", de: "Bearbeiten", fr: "Modifier", it: "Modifica", es: "Editar" },
    "Ürün Notu": { domain: "cart", key: "item_note", en: "Item Note", de: "Artikelnotiz", fr: "Note d'article", it: "Nota articolo", es: "Nota de artículo" },
    "Sil": { domain: "common", key: "delete", en: "Delete", de: "Löschen", fr: "Supprimer", it: "Elimina", es: "Eliminar" },
    "Kaydet": { domain: "common", key: "save", en: "Save", de: "Speichern", fr: "Enregistrer", it: "Salva", es: "Guardar" },
    "Bir şey mi unuttun?": { domain: "cart", key: "did_you_forget_something", en: "Did you forget something?", de: "Haben Sie etwas vergessen?", fr: "Avez-vous oublié quelque chose ?", it: "Hai dimenticato qualcosa?", es: "¿Olvidaste algo?" },
    "Gesponsert": { domain: "marketplace", key: "sponsored_de", en: "Sponsored", de: "Gesponsert", fr: "Sponsorisé", it: "Sponsorizzato", es: "Patrocinado" },
    "Ara Toplam": { domain: "cart", key: "subtotal", en: "Subtotal", de: "Zwischensumme", fr: "Sous-total", it: "Subtotale", es: "Subtotal" },
    "Teslimat Ücreti": { domain: "cart", key: "delivery_fee", en: "Delivery Fee", de: "Liefergebühr", fr: "Frais de livraison", it: "Tassa di consegna", es: "Gastos de envío" },
    "Sipariş vermek için masanızdaki QR kodu taratın": { domain: "orders", key: "scan_qr_to_order", en: "Scan the QR code on your table to order", de: "Scannen Sie den QR-Code auf Ihrem Tisch, um zu bestellen", fr: "Scannez le code QR sur votre table pour commander", it: "Scansiona il codice QR sul tuo tavolo per ordinare", es: "Escanee el código QR en su mesa para ordenar" },
    "Manuel masa numarası gir": { domain: "orders", key: "enter_manual_table_number", en: "Enter manual table number", de: "Tischschlüsselnummer manuell eingeben", fr: "Entrez le numéro de table manuellement", it: "Inserisci numero tabella manuale", es: "Introduce el número de mesa manual" },
    "Masa Numarası": { domain: "orders", key: "table_number", en: "Table Number", de: "Tischnummer", fr: "Numéro de table", it: "Numero di Tavolo", es: "Número de mesa" },
    "Onayla": { domain: "common", key: "confirm", en: "Confirm", de: "Bestätigen", fr: "Confirmer", it: "Conferma", es: "Confirmar" },
    "4 haneli PIN girin": { domain: "orders", key: "enter_4_digit_pin", en: "Enter 4-digit PIN", de: "4-stellige PIN eingeben", fr: "Entrez le code PIN à 4 chiffres", it: "Inserisci il PIN a 4 cifre", es: "Introduce el PIN de 4 dígitos" },
    "Gruba Katıl": { domain: "orders", key: "join_group", en: "Join Group", de: "Gruppe beitreten", fr: "Rejoindre le groupe", it: "Unisciti al gruppo", es: "Unirse al grupo" },
    "Hayır, tek başıma sipariş vereyim": { domain: "orders", key: "no_order_by_myself", en: "No, I'll order by myself", de: "Nein, ich werde alleine bestellen", fr: "Non, je commanderai tout seul", it: "No, ordinerò da solo", es: "No, pediré yo solo" },
    "Birden fazla kişi mi sipariş verecek?": { domain: "orders", key: "will_multiple_people_order", en: "Will multiple people be ordering?", de: "Werden mehrere Personen bestellen?", fr: "Est-ce que plusieurs personnes vont commander ?", it: "Ordinano più persone?", es: "¿Pedirán varias personas?" },
    "Grup Siparişi Başlat": { domain: "orders", key: "start_group_order", en: "Start Group Order", de: "Gruppenbestellung starten", fr: "Démarrer la commande de groupe", it: "Avvia l'ordine di gruppo", es: "Iniciar pedido grupal" },
    "Tek Kişi Sipariş": { domain: "orders", key: "single_person_order", en: "Single Person Order", de: "Einzelpersonenbestellung", fr: "Commande pour une seule personne", it: "Ordine Persona Singola", es: "Orden de Persona Sola" },
    "Değiştir": { domain: "common", key: "change", en: "Change", de: "Ändern", fr: "Changer", it: "Cambio", es: "Cambiar" },
    "Sepetiniz boş": { domain: "cart", key: "your_cart_is_empty", en: "Your cart is empty", de: "Dein Warenkorb ist leer", fr: "Votre panier est vide", it: "Il tuo carrello è vuoto", es: "Tu carrito esta vacío" },
    "Ürünler": { domain: "common", key: "products", en: "Products", de: "Produkte", fr: "Produits", it: "Prodotti", es: "Productos" },
    "Ürün yüklenemedi": { domain: "common", key: "product_could_not_be_loaded", en: "Product could not be loaded", de: "Produkt konnte nicht geladen werden", fr: "Le produit n'a pas pu être chargé", it: "Impossibile caricare il prodotto", es: "El producto no se pudo cargar" },
    "Toplam": { domain: "common", key: "total", en: "Total", de: "Gesamt", fr: "Total", it: "Totale", es: "Total" },
    "Siparişi Onayla": { domain: "orders", key: "confirm_order", en: "Confirm Order", de: "Bestellung bestätigen", fr: "Confirmer la commande", it: "Confermare l'ordine", es: "Confirmar pedido" },
    "Sepet yüklenirken hata oluştu": { domain: "cart", key: "error_loading_cart", en: "Error loading cart", de: "Fehler beim Laden des Warenkorbs", fr: "Erreur lors du chargement du panier", it: "Errore durante il caricamento del carrello", es: "Error al cargar el carrito" },
    "Ana Sayfaya Dön": { domain: "common", key: "return_to_homepage", en: "Return to Homepage", de: "Zurück zur Startseite", fr: "Retour à l'accueil", it: "Ritorna alla Home Page", es: "Volver a la portada" },
    "Sipariş vermek için giriş yapmalısınız": { domain: "orders", key: "login_required_to_order", en: "You must log in to place an order", de: "Sie müssen sich einloggen, um eine Bestellung aufzugeben", fr: "Vous devez vous connecter pour passer une commande", it: "Devi effettuare l'accesso per effettuare un ordine", es: "Debes iniciar sesión para hacer un pedido" },
    "Sipariş Özeti": { domain: "orders", key: "order_summary", en: "Order Summary", de: "Bestellungszusammenfassung", fr: "Résumé de la commande", it: "Riepilogo dell'ordine", es: "Resumen de pedido" },
    "Sonra Ödeyeceğim": { domain: "payments", key: "will_pay_later", en: "I'll Pay Later", de: "Ich werde später bezahlen", fr: "Je paierai plus tard", it: "Pagherò Più Tardi", es: "Pagaré más tarde" },
    "Kart ile": { domain: "payments", key: "with_card", en: "With Card", de: "Mit Karte", fr: "Par Carte", it: "Con Carta", es: "Con Tarjeta" },
    "Lütfen masa numaranızı girin": { domain: "orders", key: "please_enter_table_number", en: "Please enter your table number", de: "Bitte geben Sie Ihre Tischnummer ein", fr: "Veuillez entrer votre numéro de table", it: "Inserisci il numero del tuo tavolo", es: "Por favor, introduzca su número de mesa" },
    "Marketler": { domain: "marketplace", key: "markets", en: "Markets", de: "Märkte", fr: "Marchés", it: "Mercati", es: "Mercados" },
    "Mağaza Türleri": { domain: "marketplace", key: "store_types", en: "Store Types", de: "Geschäftstypen", fr: "Types de magasins", it: "Tipi di negozio", es: "Tipos de tienda" },
    "Görmek istediğin sektörleri seç": { domain: "marketplace", key: "select_sectors_to_see", en: "Select the sectors you want to see", de: "Wählen Sie die Sektoren aus, die Sie sehen möchten", fr: "Sélectionnez les secteurs que vous souhaitez voir", it: "Seleziona i settori che desideri visualizzare", es: "Selecciona los sectores que quieres ver" },
    "Temizle": { domain: "common", key: "clear", en: "Clear", de: "Löschen", fr: "Effacer", it: "Cancella", es: "Limpiar" },
    "Filtreleri Temizle": { domain: "common", key: "clear_filters", en: "Clear Filters", de: "Filter löschen", fr: "Effacer les filtres", it: "Cancella Filtri", es: "Borrar filtros" },
    "Produktinfo": { domain: "marketplace", key: "product_info_de", en: "Product Info", de: "Produktinfo", fr: "Informations sur le produit", it: "Info prodotto", es: "Información del producto" },
    "Zutaten / Tags": { domain: "marketplace", key: "ingredients_tags_de", en: "Ingredients / Tags", de: "Zutaten / Tags", fr: "Ingrédients / Tags", it: "Ingredienti/Tag", es: "Ingredientes / Etiquetas" },
    "Masa Rezervasyonu": { domain: "orders", key: "table_reservation", en: "Table Reservation", de: "Tischreservierung", fr: "Réservation de table", it: "Prenotazione Tavolo", es: "Reserva de mesa" },
    "Kişi Sayısı": { domain: "orders", key: "number_of_people", en: "Number of People", de: "Anzahl Personen", fr: "Nombre de personnes", it: "Numero di Persone", es: "Número de personas" },
    "Tarih": { domain: "common", key: "date", en: "Date", de: "Datum", fr: "Date", it: "Data", es: "Fecha" },
    "Saat": { domain: "common", key: "time", en: "Time", de: "Uhrzeit", fr: "Heure", it: "Ora", es: "Hora" },
    "Bu tarih için uygun saat bulunamadı": { domain: "orders", key: "no_available_time_for_this_date", en: "No available time found for this date", de: "Für dieses Datum wurde keine verfügbare Zeit gefunden", fr: "Aucune heure disponible trouvée pour cette date", it: "Nessun orario disponibile per questa data", es: "No se encontró tiempo disponible para esta fecha" },
    "DOLU": { domain: "orders", key: "full_caps", en: "FULL", de: "VOLL", fr: "COMPLET", it: "COMPLETO", es: "LLENO" },
    "Notlar": { domain: "common", key: "notes", en: "Notes", de: "Notizen", fr: "Notes", it: "Note", es: "Notas" },
    "Opsiyonel": { domain: "common", key: "optional", en: "Optional", de: "Optional", fr: "Optionnel", it: "Opzionale", es: "Opcional" },
    "Rezervasyon Talebi Gönder": { domain: "orders", key: "send_reservation_request", en: "Send Reservation Request", de: "Reservierungsanfrage senden", fr: "Envoyer une demande de réservation", it: "Invia richiesta di prenotazione", es: "Enviar solicitud de reserva" },
    "İşletme onayı gereklidir": { domain: "orders", key: "business_approval_required", en: "Business approval is required", de: "Unternehmenszustimmung ist erforderlich", fr: "L'approbation de l'entreprise est requise", it: "È richiesta l'approvazione dell'attività", es: "Se requiere aprobación comercial" },
    "Market, ürün veya şehir ara...": { domain: "discovery", key: "search_market_product_city", en: "Search market, product, or city...", de: "Suche Markt, Produkt oder Stadt...", fr: "Recherche marché, produit, ou ville...", it: "Cerca mercato, prodotto o città...", es: "Buscar mercado, producto o ciudad..." },
    "Bu kriterlere uygun market bulunamadı": { domain: "discovery", key: "no_market_found_for_criteria", en: "No market found matching these criteria", de: "Es wurde kein Markt gefunden, der diesen Kriterien entspricht", fr: "Aucun marché correspondant à ces critères n'a été trouvé", it: "Nessun mercato trovato con questi criteri", es: "No se encontró ningún mercado que coincida con estos criterios" },
    "Filtreleri değiştirmeyi deneyin": { domain: "discovery", key: "try_changing_filters", en: "Try changing the filters", de: "Versuchen Sie, die Filter zu ändern", fr: "Essayez de modifier les filtres", it: "Prova a cambiare i filtri", es: "Intente cambiar los filtros" },
    "Filtrele": { domain: "common", key: "filter", en: "Filter", de: "Filtern", fr: "Filtrer", it: "Filtro", es: "Filtrar" },
    "Sıfırla": { domain: "common", key: "reset", en: "Reset", de: "Zurücksetzen", fr: "Réinitialiser", it: "Ripristina", es: "Reiniciar" },
    "Sıralama": { domain: "common", key: "sorting", en: "Sorting", de: "Sortierung", fr: "Tri", it: "Ordinamento", es: "Clasificación" },
    "Hızlı Filtreler": { domain: "discovery", key: "quick_filters", en: "Quick Filters", de: "Schnellfilter", fr: "Filtres rapides", it: "Filtri rapidi", es: "Filtros rápidos" },
    "İşletme Türü": { domain: "discovery", key: "business_type", en: "Business Type", de: "Geschäftstyp", fr: "Type d'entreprise", it: "Tipo di affare", es: "Tipo de negocio" },
    "Önerilen": { domain: "discovery", key: "recommended", en: "Recommended", de: "Empfohlen", fr: "Recommandé", it: "Consigliato", es: "Recomendado" },
    "Yemek, restoran veya mutfak ara...": { domain: "discovery", key: "search_food_restaurant_cuisine", en: "Search food, restaurant or cuisine...", de: "Suchen Sie nach Essen, Restaurant oder Küche...", fr: "Rechercher de la nourriture, un restaurant ou une cuisine...", it: "Cerca cibo, ristorante o cucina...", es: "Busca comida, restaurante o cocina..." },
    "Kapat": { domain: "common", key: "close", en: "Close", de: "Schließen", fr: "Fermer", it: "Chiudi", es: "Cerrar" },
    "Menüyü Gör": { domain: "marketplace", key: "see_menu", en: "See Menu", de: "Menü ansehen", fr: "Voir le menu", it: "Vedere il menu", es: "Ver el menú" },
    "Nasıl Çalışır?": { domain: "discovery", key: "how_it_works", en: "How it works?", de: "Wie funktioniert es?", fr: "Comment ça marche ?", it: "Come funziona?", es: "¿Cómo funciona?" },
    "İsminiz": { domain: "orders", key: "your_name", en: "Your Name", de: "Ihr Name", fr: "Votre nom", it: "Il tuo nome", es: "Su nombre" },
    "Grup PIN Kodu": { domain: "orders", key: "group_pin_code", en: "Group PIN Code", de: "Gruppen-PIN-Code", fr: "Code PIN du groupe", it: "Codice PIN del gruppo", es: "Código PIN del grupo" },
    "Oturumu Kapat": { domain: "auth", key: "close_session", en: "Close Session", de: "Sitzung schließen", fr: "Fermer la session", it: "Chiudi sessione", es: "Cerrar sesión" },
    "Vazgeç": { domain: "common", key: "give_up", en: "Give up", de: "Aufgeben", fr: "Abandonner", it: "Abbandonando", es: "Rendirse" },
    "Şifreyi Öğrenemiyorum / Oturumu Sıfırla": { domain: "orders", key: "cannot_learn_password_reset_session", en: "I can't learn the password / Reset session", de: "Ich kann das Passwort nicht herausfinden / Sitzung zurücksetzen", fr: "Je n'arrive pas à connaître le mot de passe / Réinitialiser la session", it: "Non riesco a scoprire la password / Reimposta sessione", es: "No puedo descifrar la contraseña / Restablecer sesión" },
    "Tamam, Anladım": { domain: "common", key: "ok_got_it", en: "OK, got it", de: "OK, verstanden", fr: "Ok, j'ai compris", it: "Va bene, ho capito", es: "Vale, lo tengo" },
    "Yemek veya restoran ara...": { domain: "discovery", key: "search_food_or_restaurant", en: "Search food or restaurant...", de: "Essen oder Restaurant suchen...", fr: "Rechercher un plat ou un restaurant...", it: "Cerca cibo o ristorante...", es: "Busca comida o restaurante..." },
    "Siparişlerim": { domain: "orders", key: "my_orders", en: "My Orders", de: "Meine Bestellungen", fr: "Mes commandes", it: "I miei ordini", es: "Mis pedidos" },
    "Tekrar Sipariş Ver": { domain: "orders", key: "order_again", en: "Order Again", de: "Erneut bestellen", fr: "Commander à nouveau", it: "Ordina ancora", es: "Pedir otra vez" },
    "Tümü": { domain: "common", key: "all", en: "All", de: "Alle", fr: "Tout", it: "Tutti", es: "Todo" },
    "Tekrarla": { domain: "common", key: "repeat", en: "Repeat", de: "Wiederholen", fr: "Répéter", it: "Ripetere", es: "Repetir" },
    "Hesap Oluştur": { domain: "auth", key: "create_account", en: "Create Account", de: "Konto erstellen", fr: "Créer un compte", it: "Creare un profilo", es: "Crear una cuenta" },
    "Geç": { domain: "common", key: "skip", en: "Skip", de: "Überspringen", fr: "Sauter", it: "Saltare", es: "Omitir" },
    "Grubu İptal Et": { domain: "orders", key: "cancel_group", en: "Cancel Group", de: "Gruppe abbrechen", fr: "Annuler le groupe", it: "Annulla gruppo", es: "Cancelar el grupo" },
    "Gruptan Ayrıl": { domain: "orders", key: "leave_group", en: "Leave Group", de: "Gruppe verlassen", fr: "Quitter le groupe", it: "Lascia il gruppo", es: "Deja un grupo" },
    "Ürün bulunamadı": { domain: "common", key: "product_not_found", en: "Product not found", de: "Produkt nicht gefunden", fr: "Produit introuvable", it: "Prodotto non trovato", es: "Producto no encontrado" },
    "Ekle": { domain: "common", key: "add", en: "Add", de: "Hinzufügen", fr: "Ajouter", it: "Aggiungere", es: "Agregar" },
    "Henüz ürün eklemediniz": { domain: "cart", key: "no_products_added_yet", en: "You haven't added any products yet", de: "Sie haben noch keine Produkte hinzugefügt", fr: "Vous n'avez pas encore ajouté de produits", it: "Non hai ancora aggiunto alcun prodotto", es: "Aún no has agregado ningún producto" },
    "Benim Toplamım": { domain: "orders", key: "my_total", en: "My Total", de: "Mein Gesamtbetrag", fr: "Mon total", it: "Il mio totale", es: "Mi total" },
    "Kişi Bazlı": { domain: "orders", key: "per_person", en: "Per Person", de: "Pro Person", fr: "Par personne", it: "A persona", es: "Por persona" },
    "Masa Toplam": { domain: "orders", key: "table_total", en: "Table Total", de: "Tischgesamtbetrag", fr: "Total de la table", it: "Totale Tavolo", es: "Total de mesa" },
    "Ödenen": { domain: "orders", key: "paid", en: "Paid", de: "Bezahlt", fr: "Payé", it: "Pagato", es: "Pagado" },
    "Kalan Hesap": { domain: "orders", key: "remaining_bill", en: "Remaining Bill", de: "Verbleibende Rechnung", fr: "Facture restante", it: "Conto rimanente", es: "Factura restante" },
    "Henüz sipariş yok": { domain: "orders", key: "no_orders_yet", en: "No orders yet", de: "Noch keine Bestellungen", fr: "Pas encore de commandes", it: "Non ci sono ancora ordini", es: "No hay pedidos aún" },
    "Toplam Ürünler": { domain: "cart", key: "total_products", en: "Total Products", de: "Gesamte Produkte", fr: "Total de produits", it: "Prodotti in totale", es: "Productos totales" },
    "✅ Seçimi Tamam": { domain: "orders", key: "selection_done", en: "✅ Selection Done", de: "✅ Auswahl abgeschlossen", fr: "✅ Sélection effectuée", it: "✅ Selezione Completata", es: "✅ Selección hecha" },
    "⏳ Seçiyor": { domain: "orders", key: "selecting", en: "⏳ Selecting", de: "⏳ Auswählen", fr: "⏳ En sélectionnant", it: "⏳ Selezione", es: "⏳ Seleccionando" },
    "💳 Ödendi": { domain: "orders", key: "paid_card", en: "💳 Paid", de: "💳 Bezahlt", fr: "💳 Payé", it: "💳 Pagato", es: "💳 Pagado" },
    "Siparişimi Değiştir": { domain: "orders", key: "change_my_order", en: "Change My Order", de: "Meine Bestellung ändern", fr: "Modifier ma commande", it: "Cambia il Mio Ordine", es: "Cambiar mi pedido" },
    "Tüm katılımcılar henüz hazır değil": { domain: "orders", key: "not_all_participants_ready", en: "All participants are not ready yet", de: "Alle Teilnehmer sind noch nicht bereit", fr: "Tous les participants ne sont pas encore prêts", it: "Tutti i partecipanti non sono ancora pronti", es: "No todos los participantes están listos todavía" },
    "🍳 Yeni Ürünleri Mutfağa Yolla": { domain: "orders", key: "send_new_items_to_kitchen", en: "🍳 Send New Items to Kitchen", de: "🍳 Neue Artikel an die Küche senden", fr: "🍳 Envoyer de nouveaux articles à la cuisine", it: "🍳 Invia Nuovi Articoli in Cucina", es: "🍳 Enviar artículos nuevos a la cocina" },
    "Hesabımı Öde": { domain: "payments", key: "pay_my_bill", en: "Pay My Bill", de: "Meine Rechnung bezahlen", fr: "Payer ma facture", it: "Paga il Mio Conto", es: "Pagar mi cuenta" },
    "Nakit Öde": { domain: "payments", key: "pay_cash", en: "Pay with Cash", de: "In bar bezahlen", fr: "Payer en espèces", it: "Paga in contanti", es: "Pagar en efectivo" },
    "Kart ile Öde": { domain: "payments", key: "pay_with_card", en: "Pay with Card", de: "Mit Karte bezahlen", fr: "Payer par carte", it: "Paga con Carta", es: "Pagar con Tarjeta" },
    "Masa Hesabını Öde": { domain: "payments", key: "pay_table_bill", en: "Pay Table Bill", de: "Tischrechnung bezahlen", fr: "Payer la facture de la table", it: "Paga il Conto del Tavolo", es: "Pagar la factura de la mesa" },
    "Grup siparişi iptal edildi": { domain: "orders", key: "group_order_cancelled", en: "Group order cancelled", de: "Gruppenbestellung storniert", fr: "Commande de groupe annulée", it: "Ordine di gruppo annullato", es: "Pedido de grupo cancelado" },
    "İptal Et": { domain: "common", key: "cancel", en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla", es: "Cancelar" },
    "Gruptan ayrıldınız": { domain: "orders", key: "left_the_group", en: "You left the group", de: "Sie haben die Gruppe verlassen", fr: "Vous avez quitté le groupe", it: "Hai lasciato il gruppo", es: "Dejaste el grupo" },
    "Ayrıl": { domain: "common", key: "leave", en: "Leave", de: "Verlassen", fr: "Partir", it: "Partire", es: "Salir" },
    "Katılımcıyı Çıkar": { domain: "orders", key: "remove_participant", en: "Remove Participant", de: "Teilnehmer entfernen", fr: "Supprimer le participant", it: "Rimuovi Partecipante", es: "Eliminar participante" },
    "Çıkar": { domain: "common", key: "remove", en: "Remove", de: "Entfernen", fr: "Retirer", it: "Rimuovi", es: "Quitar" },
    "Geçerli bir masa numarası girin": { domain: "orders", key: "enter_valid_table_number", en: "Enter a valid table number", de: "Geben Sie eine gültige Tischnummer ein", fr: "Entrez un numéro de table valide", it: "Inserisci un numero di tavolo valido", es: "Introduzca un número de mesa válido" },
    "Garson siparişlerine bağlandınız! ✓": { domain: "staff", key: "connected_to_waiter_orders", en: "Connected to waiter orders! ✓", de: "Mit Kellnerbestellungen verbunden! ✓", fr: "Connecté aux commandes de serveurs ! ✓", it: "Collegato agli ordini dei camerieri! ✓", es: "¡Conectado a los pedidos de los camareros! ✓" },
    "Siparişiniz mutfağa gönderildi! 🎉": { domain: "orders", key: "order_sent_to_kitchen", en: "Your order has been sent to the kitchen! 🎉", de: "Ihre Bestellung wurde an die Küche gesendet! 🎉", fr: "Votre commande a été envoyée en cuisine ! 🎉", it: "Il tuo ordine è stato inviato in cucina! 🎉", es: "¡Tu pedido ha sido enviado a la cocina! 🎉" },
    "Sipariş gönderilemedi: $e": { domain: "orders", key: "could_not_send_order_e", en: "Could not send the order: $e", de: "Bestellung konnte nicht gesendet werden: $e", fr: "Impossible d'envoyer la commande : $e", it: "Impossibile inviare l'ordine: $e", es: "No se pudo enviar el pedido: $e" },
    "Masa numaranızı girerek doğrudan mutfağa sipariş verebilirsiniz.": { domain: "orders", key: "enter_table_number_order_direct", en: "You can place your order directly to the kitchen by entering your table number.", de: "Durch Eingabe Ihrer Tischnummer können Sie Ihre Bestellung direkt an die Küche aufgeben.", fr: "Vous pouvez passer votre commande directement en cuisine en entrant votre numéro de table.", it: "Puoi inviare il tuo ordine direttamente in cucina inserendo il numero del tuo tavolo.", es: "Puedes hacer tu pedido directamente a la cocina ingresando tu número de mesa." },
    "Menüyü Aç": { domain: "marketplace", key: "open_menu", en: "Open Menu", de: "Menü öffnen", fr: "Ouvrir le menu", it: "Apri il menu", es: "Abrir menú" },
    "Bağlan": { domain: "common", key: "connect", en: "Connect", de: "Verbinden", fr: "Connecter", it: "Collegare", es: "Conectar" }
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
    path.join(__dirname, 'lib/screens/marketplace'),
    path.join(__dirname, 'lib/screens/home'),
    path.join(__dirname, 'lib/screens/customer')
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
        console.log(`Updated JSON in ${lang}.json`);
    } else {
        console.warn(`${lang}.json not found!`);
    }
}
