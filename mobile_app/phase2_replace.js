const fs = require('fs');
const path = require('path');

const phase2Strings = JSON.parse(fs.readFileSync('phase2_strings.json', 'utf8'));

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
    "Bekleyen Teslimatlar": { domain: "driver", key: "pending_deliveries", en: "Pending Deliveries", de: "Ausstehende Lieferungen", fr: "Livraisons en attente", it: "Consegne in attesa", es: "Entregas pendientes" },
    "Bekleyen teslimat yok": { domain: "driver", key: "no_pending_deliveries", en: "No pending deliveries", de: "Keine ausstehenden Lieferungen", fr: "Aucune livraison en attente", it: "Nessuna consegna in attesa", es: "No hay entregas pendientes" },
    "Kasaya teslim edilecek nakit": { domain: "staff", key: "cash_to_register", en: "Cash to deliver to the register", de: "Bargeld an die Kasse zu übergeben", fr: "Espèces à remettre à la caisse", it: "Contanti da consegnare alla cassa", es: "Efectivo para entregar a la caja" },
    "💵 Adım 1: Ödeme Tahsili": { domain: "payments", key: "step1_payment_collection", en: "💵 Step 1: Payment Collection", de: "💵 Schritt 1: Zahlungseinzug", fr: "💵 Étape 1 : Collecte de paiement", it: "💵 Fase 1: Incasso pagamento", es: "💵 Paso 1: Cobro de pagos" },
    "Parayı müşteriden tahsil ettiniz mi?": { domain: "payments", key: "did_you_collect_money", en: "Did you collect the money from the customer?", de: "Haben Sie das Geld vom Kunden kassiert?", fr: "Avez-vous encaissé l'argent du client ?", it: "Hai riscosso i soldi dal cliente?", es: "¿Cobró el dinero al cliente?" },
    "✓ Evet, Tahsil Ettim": { domain: "payments", key: "yes_collected", en: "✓ Yes, Collected", de: "✓ Ja, Kassiert", fr: "✓ Oui, Encaissé", it: "✓ Sì, Riscosso", es: "✓ Sí, Cobrado" },
    "❌ Fotoğraf gerekli!": { domain: "driver", key: "photo_required", en: "❌ Photo required!", de: "❌ Foto erforderlich!", fr: "❌ Photo obligatoire !", it: "❌ Foto richiesta!", es: "❌ ¡Se requiere foto!" },
    "✅ Teslimat tamamlandı!": { domain: "driver", key: "delivery_completed_success", en: "✅ Delivery completed!", de: "✅ Lieferung abgeschlossen!", fr: "✅ Livraison terminée !", it: "✅ Consegna completata!", es: "✅ ¡Entrega completada!" },
    "📤 Fotoğraf yükleniyor...": { domain: "driver", key: "uploading_photo", en: "📤 Uploading photo...", de: "📤 Foto wird hochgeladen...", fr: "📤 Téléchargement de la photo...", it: "📤 Caricamento foto...", es: "📤 Subiendo foto..." },
    "🚗 Yola Çık": { domain: "driver", key: "head_out", en: "🚗 Head Out", de: "🚗 Losfahren", fr: "🚗 Partir", it: "🚗 Parti", es: "🚗 Salida" },
    "Siparişi aldınız ve yola çıkıyor musunuz?": { domain: "driver", key: "did_you_take_order_and_head_out", en: "Did you take the order and head out?", de: "Haben Sie die Bestellung entgegengenommen und fahren nun los?", fr: "Avez-vous pris la commande et partez-vous ?", it: "Hai preso l'ordine e stai partendo?", es: "¿Tomaste el pedido y vas de salida?" },
    "Hayır": { domain: "common", key: "no", en: "No", de: "Nein", fr: "Non", it: "No", es: "No" },
    "Evet, Yola Çıkıyorum": { domain: "driver", key: "yes_heading_out", en: "Yes, Heading Out", de: "Ja, ich fahre los", fr: "Oui, je pars", it: "Sì, sto partendo", es: "Sí, voy de salida" },
    "🚗 Yoldasınız! İyi teslimatlar.": { domain: "driver", key: "you_are_on_the_way", en: "🚗 You are on the way! Good deliveries.", de: "🚗 Sie sind unterwegs! Gute Lieferungen.", fr: "🚗 Vous êtes en route ! Bonnes livraisons.", it: "🚗 Sei in viaggio! Buone consegne.", es: "🚗 ¡Estás en camino! Buenas entregas." },
    "⚠️ Teslimatı İptal Et": { domain: "driver", key: "cancel_delivery", en: "⚠️ Cancel Delivery", de: "⚠️ Lieferung stornieren", fr: "⚠️ Annuler la livraison", it: "⚠️ Annulla la consegna", es: "⚠️ Cancelar entrega" },
    "İptal sebebini seçin:": { domain: "common", key: "choose_cancel_reason", en: "Choose cancellation reason:", de: "Wählen Sie den Stornierungsgrund:", fr: "Choisissez le motif d'annulation :", it: "Scegli il motivo dell'annullamento:", es: "Elija el motivo de cancelación:" },
    "Adres doğru değil / Müşteriye ulaşılamadı": { domain: "driver", key: "address_wrong_or_customer_unreachable", en: "Address incorrect / Customer unreachable", de: "Adresse falsch / Kunde nicht erreichbar", fr: "Adresse incorrecte / Client injoignable", it: "Indirizzo errato / Cliente irraggiungibile", es: "Dirección incorrecta / Cliente inalcanzable" },
    "Diğer": { domain: "common", key: "other", en: "Other", de: "Sonstiges", fr: "Autre", it: "Altro", es: "Otros" },
    "Sipariş tekrar havuza düşecek.": { domain: "driver", key: "order_returns_to_pool", en: "Order will return to the pool.", de: "Die Bestellung kehrt in den Pool zurück.", fr: "La commande retournera dans le pool.", it: "L'ordine tornerà nel pool.", es: "El pedido volverá al grupo." },
    "Evet, İptal Et": { domain: "common", key: "yes_cancel", en: "Yes, Cancel", de: "Ja, Abbrechen", fr: "Oui, Annuler", it: "Sì, Annulla", es: "Sí, Cancelar" },
    "❌ Teslimat iptal edildi": { domain: "driver", key: "delivery_cancelled", en: "❌ Delivery cancelled", de: "❌ Lieferung storniert", fr: "❌ Livraison annulée", it: "❌ Consegna annullata", es: "❌ Entrega cancelada" },
    "Telefon açılamadı": { domain: "common", key: "could_not_open_phone", en: "Could not open phone", de: "Telefon konnte nicht geöffnet werden", fr: "Impossible d'ouvrir le téléphone", it: "Impossibile aprire il telefono", es: "No se pudo abrir el teléfono" },
    "Adres bulunamadı": { domain: "common", key: "address_not_found", en: "Address not found", de: "Adresse nicht gefunden", fr: "Adresse introuvable", it: "Indirizzo non trovato", es: "Dirección no encontrada" },
    "Harita Uygulaması Seçin": { domain: "common", key: "select_map_app", en: "Select Map App", de: "Karten-App auswählen", fr: "Sélectionnez l'application de carte", it: "Seleziona App Mappe", es: "Seleccionar aplicación de mapas" },
    "Apple Haritalar": { domain: "common", key: "apple_maps", en: "Apple Maps", de: "Apple Karten", fr: "Plans d'Apple", it: "Mappe Apple", es: "Mensajes de Apple" },
    "Varsayılan iOS harita uygulaması": { domain: "common", key: "default_ios_map", en: "Default iOS map app", de: "Standard iOS Karten-App", fr: "Application cartographique iOS par défaut", it: "App mappe iOS predefinita", es: "Aplicación de mapas iOS predeterminada" },
    "Google Maps": { domain: "common", key: "google_maps", en: "Google Maps", de: "Google Maps", fr: "Google Maps", it: "Google Maps", es: "Google Maps" },
    "Google harita uygulaması": { domain: "common", key: "google_map_app", en: "Google map app", de: "Google Karten-App", fr: "Application de carte Google", it: "App mappa Google", es: "Aplicación de mapa de Google" },
    "Aktif Teslimat": { domain: "driver", key: "active_delivery", en: "Active Delivery", de: "Aktive Lieferung", fr: "Livraison active", it: "Consegna attiva", es: "Entrega activa" },
    "👤 Müşteri": { domain: "common", key: "customer_icon", en: "👤 Customer", de: "👤 Kunde", fr: "👤 Client", it: "👤 Cliente", es: "👤 Cliente" },
    "ARA": { domain: "common", key: "call_caps", en: "CALL", de: "ANRUFEN", fr: "APPELER", it: "CHIAMA", es: "LLAMAR" },
    "📍 Adres": { domain: "common", key: "address_icon", en: "📍 Address", de: "📍 Adresse", fr: "📍 Adresse", it: "📍 Indirizzo", es: "📍 Dirección" },
    "GİT": { domain: "common", key: "go_caps", en: "GO", de: "LOS", fr: "ALLER", it: "VAI", es: "IR" },
    "✅ TESLİMAT TAMAMLANDI": { domain: "driver", key: "delivery_completed_caps", en: "✅ DELIVERY COMPLETED", de: "✅ LIEFERUNG ABGESCHLOSSEN", fr: "✅ LIVRAISON TERMINÉE", it: "✅ CONSEGNA COMPLETATA", es: "✅ ENTREGA COMPLETADA" },
    "🚗 YOL AL": { domain: "driver", key: "head_out_caps", en: "🚗 HEAD OUT", de: "🚗 LOSFAHREN", fr: "🚗 PARTIR", it: "🚗 PARTI", es: "🚗 SALIDA" },
    "Siparişi nasıl teslim ettiniz?": { domain: "driver", key: "how_did_you_deliver", en: "How did you deliver the order?", de: "Wie haben Sie die Bestellung ausgeliefert?", fr: "Comment avez-vous livré la commande ?", it: "Come hai consegnato l'ordine?", es: "¿Cómo entregó el pedido?" },
    "Görev Seçimi": { domain: "staff", key: "role_selection", en: "Role Selection", de: "Rollenauswahl", fr: "Sélection des rôles", it: "Selezione Ruolo", es: "Selección de rol" },
    "Bu vardiyada hangi görevleri üstleneceksiniz?": { domain: "staff", key: "which_roles_this_shift", en: "Which roles will you take on this shift?", de: "Welche Rollen übernehmen Sie in dieser Schicht?", fr: "Quels rôles assumerez-vous pendant ce quart ?", it: "Quali ruoli assumerai in questo turno?", es: "¿Qué roles asumirá en este turno?" },
    "Tümü": { domain: "common", key: "all", en: "All", de: "Alle", fr: "Tous", it: "Tutti", es: "Todos" },
    "Temizle": { domain: "common", key: "clear", en: "Clear", de: "Löschen", fr: "Effacer", it: "Pulisci", es: "Limpiar" },
    "Vardiyayı Bitir": { domain: "staff", key: "end_shift", en: "End Shift", de: "Schicht beenden", fr: "Terminer le quart", it: "Termina il turno", es: "Terminar turno" },
    "Vardiyayı sonlandırmak istediğinize emin misiniz?": { domain: "staff", key: "confirm_end_shift", en: "Are you sure you want to end your shift?", de: "Möchten Sie Ihre Schicht wirklich beenden?", fr: "Êtes-vous sûr de vouloir terminer votre quart ?", it: "Sei sicuro di voler terminare il tuo turno?", es: "¿Está seguro de que desea terminar su turno?" },
    "Bitir": { domain: "common", key: "finish", en: "Finish", de: "Beenden", fr: "Terminer", it: "Termina", es: "Terminar" },
    "Masa Seçimi": { domain: "staff", key: "table_selection", en: "Table Selection", de: "Tischauswahl", fr: "Sélection de table", it: "Selezione Tavolo", es: "Selección de mesa" },
    "Bu vardiyada servis yapacağınız masaları seçin": { domain: "staff", key: "select_tables_for_shift", en: "Select the tables you will serve this shift", de: "Wählen Sie die Tische aus, die Sie in dieser Schicht bedienen werden", fr: "Sélectionnez les tables que vous servirez ce quart", it: "Seleziona i tavoli che servirai in questo turno", es: "Seleccione las mesas que servirá en este turno" },
    "Vardiya Tamamlandı": { domain: "staff", key: "shift_completed", en: "Shift Completed", de: "Schicht abgeschlossen", fr: "Quart de travail terminé", it: "Turno Completato", es: "Turno Completado" },
    "Masa Numaraları": { domain: "staff", key: "table_numbers", en: "Table Numbers", de: "Tischnummern", fr: "Numéros de table", it: "Numeri di tavolo", es: "Números de mesa" },
    "Çalışma Saatlerim": { domain: "staff", key: "my_work_hours", en: "My Work Hours", de: "Meine Arbeitszeiten", fr: "Mes heures de travail", it: "Le mie ore di lavoro", es: "Mis horas de trabajo" },
    "Henüz vardiya kaydı yok": { domain: "staff", key: "no_shift_records_yet", en: "No shift records yet", de: "Noch keine Schichtaufzeichnungen", fr: "Aucun enregistrement de quart de travail pour l'instant", it: "Ancora nessun registro dei turni", es: "Aún no hay registros de turno" },
    "Mola": { domain: "staff", key: "break", en: "Break", de: "Pause", fr: "Pause", it: "Pausa", es: "Descanso" },
    "Çalışma": { domain: "staff", key: "working", en: "Working", de: "Arbeiten", fr: "Au travail", it: "Lavoro", es: "Trabajando" },
    "BAŞLA": { domain: "common", key: "start_caps", en: "START", de: "START", fr: "COMMENCER", it: "INIZIA", es: "INICIAR" },
    "Bugün Toplam": { domain: "staff", key: "today_total", en: "Today's Total", de: "Heutige Gesamtsumme", fr: "Total d'aujourd'hui", it: "Totale di Oggi", es: "Total de hoy" },
    "Görevler": { domain: "staff", key: "tasks", en: "Tasks", de: "Aufgaben", fr: "Tâches", it: "Compiti", es: "Tareas" },
    "Paketinizde bu özellik aktif değil. Lütfen yöneticinizle iletişime geçin.": { domain: "staff", key: "feature_not_active_in_plan", en: "This feature is not active in your plan. Please contact your manager.", de: "Diese Funktion ist in Ihrem Plan nicht aktiv. Bitte kontaktieren Sie Ihren Manager.", fr: "Cette fonctionnalité n'est pas active dans votre forfait. Veuillez contacter votre responsable.", it: "Questa funzione non è attiva nel tuo piano. Contatta il tuo manager.", es: "Esta función no está activa en tu plan. Por favor contacte a su administrador." },
    "Masa Durumu": { domain: "staff", key: "table_status", en: "Table Status", de: "Tischstatus", fr: "Statut de la table", it: "Stato del tavolo", es: "Estado de la mesa" },
    "Personel yetkisi bulunamadı": { domain: "staff", key: "staff_permission_not_found", en: "Staff permission not found", de: "Personalberechtigung nicht gefunden", fr: "Autorisation du personnel introuvable", it: "Permesso personale non trovato", es: "Permiso de personal no encontrado" },
    "Bu sayfaya erişmek için işletme yöneticinize başvurun": { domain: "staff", key: "contact_manager_for_access", en: "Contact your store manager to access this page", de: "Kontaktieren Sie Ihren Store-Manager, um auf diese Seite zuzugreifen", fr: "Contactez votre responsable de magasin pour accéder à cette page", it: "Contatta il responsabile del negozio per accedere a questa pagina", es: "Póngase en contacto con el gerente de su tienda para acceder a esta página" },
    "Kurye Siparişleri": { domain: "driver", key: "courier_orders", en: "Courier Orders", de: "Kurierbestellungen", fr: "Commandes par coursier", it: "Ordini del corriere", es: "Pedidos de mensajería" },
    "Masa Servisleri": { domain: "staff", key: "table_services", en: "Table Services", de: "Tischbedienungen", fr: "Services à table", it: "Servizi al tavolo", es: "Servicios de mesa" },
    "Benim Masalarım": { domain: "staff", key: "my_tables", en: "My Tables", de: "Meine Tische", fr: "Mes tables", it: "I Miei Tavoli", es: "Mis mesas" },
    "Diğer Masalar": { domain: "staff", key: "other_tables", en: "Other Tables", de: "Andere Tische", fr: "Autres tables", it: "Altri Tavoli", es: "Otras mesas" },
    "🍽️ Siparişi Servis Et": { domain: "staff", key: "serve_order_btn", en: "🍽️ Serve Order", de: "🍽️ Bestellung servieren", fr: "🍽️ Servir la commande", it: "🍽️ Servi Ordine", es: "🍽️ Servir el pedido" },
    "✅ Servis Ettim": { domain: "staff", key: "served_success", en: "✅ Served", de: "✅ Serviert", fr: "✅ Servi", it: "✅ Servito", es: "✅ Servido" },
    "Yeni Sipariş": { domain: "staff", key: "new_order", en: "New Order", de: "Neue Bestellung", fr: "Nouvelle commande", it: "Nuovo Ordine", es: "Nuevo pedido" },
    "Bu masa için aktif sipariş yok": { domain: "staff", key: "no_active_order_for_table", en: "No active order for this table", de: "Keine aktive Bestellung für diesen Tisch", fr: "Aucune commande active pour cette table", it: "Nessun ordine attivo per questo tavolo", es: "No hay orden activa para esta mesa" },
    "🍽️ Servis Et": { domain: "staff", key: "serve_it", en: "🍽️ Serve", de: "🍽️ Servieren", fr: "🍽️ Servir", it: "🍽️ Servi", es: "🍽️ Servir" },
    "💵 Nakit": { domain: "payments", key: "cash", en: "💵 Cash", de: "💵 Bargeld", fr: "💵 Espèces", it: "💵 Contanti", es: "💵 Efectivo" },
    "✅ Nakit ödeme alındı!": { domain: "payments", key: "cash_payment_received", en: "✅ Cash payment received!", de: "✅ Barzahlung erhalten!", fr: "✅ Paiement en espèces reçu !", it: "✅ Pagamento in contanti ricevuto!", es: "✅ ¡Pago en efectivo recibido!" },
    "Hata: $e": { domain: "common", key: "error_e", en: "Error: $e", de: "Fehler: $e", fr: "Erreur : $e", it: "Errore: $e", es: "Error: $e" },
    "💳 Kart": { domain: "payments", key: "card", en: "💳 Card", de: "💳 Karte", fr: "💳 Carte", it: "💳 Carta", es: "💳 Tarjeta" },
    "✅ Kart ödeme alındı!": { domain: "payments", key: "card_payment_received", en: "✅ Card payment received!", de: "✅ Kartenzahlung erhalten!", fr: "✅ Paiement par carte reçu !", it: "✅ Pagamento con carta ricevuto!", es: "✅ ¡Pago con tarjeta recibido!" },
    "Boş masa": { domain: "staff", key: "empty_table", en: "Empty table", de: "Leerer Tisch", fr: "Table vide", it: "Tavolo vuoto", es: "Mesa vacía" },
    "Sipariş Başlat": { domain: "staff", key: "start_order", en: "Start Order", de: "Bestellung starten", fr: "Commencer la commande", it: "Avvia ordine", es: "Iniciar pedido" },
    "R": { domain: "common", key: "letter_r", en: "R", de: "R", fr: "R", it: "R", es: "R" },
    "GENEL TOPLAM": { domain: "common", key: "grand_total_caps", en: "GRAND TOTAL", de: "GESAMTSUMME", fr: "TOTAL GÉNÉRAL", it: "TOTALE GENERALE", es: "TOTAL GENERAL" },
    "Henüz sipariş yok": { domain: "orders", key: "no_orders_yet", en: "No orders yet", de: "Noch keine Bestellungen", fr: "Aucune commande pour le moment", it: "Ancora nessun ordine", es: "Aún no hay pedidos" },
    "🧾 Toptan Hesap Öde": { domain: "payments", key: "pay_bulk_bill", en: "🧾 Pay Bulk Bill", de: "🧾 Sammelrechnung bezahlen", fr: "🧾 Payer la facture globale", it: "🧾 Paga conto unico", es: "🧾 Pagar cuenta total" },
    "✅ Sipariş servis edildi!": { domain: "staff", key: "order_served_success", en: "✅ Order served!", de: "✅ Bestellung serviert!", fr: "✅ Commande servie !", it: "✅ Ordine servito!", es: "✅ ¡Pedido servido!" },
    "Sipariş Ekle": { domain: "staff", key: "add_order", en: "Add Order", de: "Bestellung hinzufügen", fr: "Ajouter la commande", it: "Aggiungi ordine", es: "Añadir pedido" },
    "🃏 Masa Kart Numarası Seçin": { domain: "staff", key: "select_table_card_number", en: "🃏 Select Table Card Number", de: "🃏 Tischkartennummer auswählen", fr: "🃏 Sélectionner le numéro de la carte de table", it: "🃏 Seleziona numero carta tavolo", es: "🃏 Seleccionar número de tarjeta de mesa" },
    "Müşteriye verilecek masa kartını seçin": { domain: "staff", key: "select_card_to_give_customer", en: "Select the assigned table card for the customer", de: "Wählen Sie die zugewiesene Tischkarte für den Kunden aus", fr: "Sélectionnez la carte attribuée au client", it: "Seleziona la carta assegnata al cliente", es: "Seleccione la tarjeta asignada para el cliente" },
    "Hata oluştu. Tekrar deneyin.": { domain: "common", key: "error_occurred_try_again", en: "Error occurred. Try again.", de: "Ein Fehler ist aufgetreten. Versuchen Sie es erneut.", fr: "Une erreur s'est produite. Réessayez.", it: "Si è verificato un errore. Riprova.", es: "Ocurrió un error. Inténtalo de nuevo." },
    "Telefon numarası bulunamadı": { domain: "common", key: "phone_number_not_found", en: "Phone number not found", de: "Telefonnummer nicht gefunden", fr: "Numéro de téléphone introuvable", it: "Numero di telefono non trovato", es: "Número de teléfono no encontrado" },
    "Rezervasyonlar": { domain: "staff", key: "reservations", en: "Reservations", de: "Reservierungen", fr: "Réservations", it: "Prenotazioni", es: "Reservaciones" },
    "İşletme bulunamadı": { domain: "common", key: "business_not_found", en: "Store not found", de: "Geschäft nicht gefunden", fr: "Magasin introuvable", it: "Negozio non trovato", es: "Negocio no encontrado" },
    "Bir işletmeye atanmış olmanız gerekiyor": { domain: "staff", key: "must_be_assigned_to_business", en: "You must be assigned to a store", de: "Sie müssen einem Geschäft zugewiesen sein", fr: "Vous devez être rattaché à un magasin", it: "Devi essere assegnato a un negozio", es: "Debe ser asignado a una tienda" },
    "Rezervasyon bulunamadı": { domain: "staff", key: "reservation_not_found", en: "Reservation not found", de: "Reservierung nicht gefunden", fr: "Réservation introuvable", it: "Prenotazione non trovata", es: "Reservación no encontrada" },
    "Bu filtrelerle rezervasyon yok": { domain: "staff", key: "no_reservations_with_filters", en: "No reservations found with these filters", de: "Keine Reservierungen mit diesen Filtern gefunden", fr: "Aucune réservation avec ces filtres", it: "Nessuna prenotazione con questi filtri", es: "No hay reservas con estos filtros" },
    "Onayla": { domain: "common", key: "approve", en: "Approve", de: "Genehmigen", fr: "Approuver", it: "Approva", es: "Aprobar" },
    "Reddet": { domain: "common", key: "reject", en: "Reject", de: "Ablehnen", fr: "Refuser", it: "Rifiuta", es: "Rechazar" },
    "Evet, Başlat": { domain: "staff", key: "yes_start", en: "Yes, Start", de: "Ja, starten", fr: "Oui, commencer", it: "Sì, Inizia", es: "Sí, empezar" },
    "Servis Edildi": { domain: "staff", key: "served", en: "Served", de: "Serviert", fr: "Servi", it: "Servito", es: "Servido" },
    "Hesap": { domain: "staff", key: "bill", en: "Bill", de: "Rechnung", fr: "Facture", it: "Conto", es: "Cuenta" },
    "Masa PIN Kodu": { domain: "staff", key: "table_pin_code", en: "Table PIN Code", de: "Tisch PIN-Code", fr: "Code PIN de la table", it: "Codice PIN tavolo", es: "Código PIN de la mesa" },
    "Bu kodu müşteriye verin.\\nMüşteri bu kodla siparişlerini takip edebilir.": { domain: "staff", key: "give_pin_to_customer", en: "Give this code to the customer.\\nThe customer can track their orders with this code.", de: "Geben Sie diesen Code dem Kunden.\\nMit diesem Code kann der Kunde seine Bestellungen verfolgen.", fr: "Donnez ce code au client.\\nLe client peut suivre ses commandes avec ce code.", it: "Dai questo codice al cliente.\\nIl cliente può tracciare i suoi ordini con questo codice.", es: "Entregue este código al cliente.\\nEl cliente puede realizar un seguimiento de sus pedidos con este código." },
    "PIN kopyalandı": { domain: "common", key: "pin_copied", en: "PIN copied", de: "PIN kopiert", fr: "PIN copié", it: "PIN copiato", es: "PIN copiado" },
    "Kopyala": { domain: "common", key: "copy", en: "Copy", de: "Kopieren", fr: "Copier", it: "Copia", es: "Copiar" },
    "Sipariş gönderilemedi: $e": { domain: "orders", key: "order_send_failed", en: "Order could not be sent: $e", de: "Bestellung konnte nicht gesendet werden: $e", fr: "La commande n'a pas pu être envoyée : $e", it: "Impossibile inviare l'ordine: $e", es: "El pedido no se pudo enviar: $e" },
    "Sipariş almak için bir işletmeye atanmış olmanız gerekir.": { domain: "staff", key: "must_be_assigned_for_taking_orders", en: "You must be assigned to a store to take orders.", de: "Sie müssen einem Geschäft zugewiesen sein, um Bestellungen entgegenzunehmen.", fr: "Vous devez être affecté à un magasin pour prendre des commandes.", it: "Devi essere assegnato a un negozio per prendere ordini.", es: "Debe estar asignado a una tienda para tomar pedidos." },
    "Sipariş alacağınız masayı seçin": { domain: "staff", key: "select_table_for_order", en: "Select the table to take order for", de: "Wählen Sie den Tisch aus, für den Sie bestellen möchten", fr: "Sélectionnez la table pour laquelle commander", it: "Seleziona il tavolo per cui prendere l'ordine", es: "Seleccione la mesa para la orden" },
    "Açık": { domain: "staff", key: "open", en: "Open", de: "Geöffnet", fr: "Ouvert", it: "Aperto", es: "Abierto" },
    "Ekle": { domain: "common", key: "add", en: "Add", de: "Hinzufügen", fr: "Ajouter", it: "Aggiungi", es: "Añadir" },
    "Müşteri Öder (Online)": { domain: "payments", key: "customer_pays_online", en: "Customer Pays (Online)", de: "Kunde zahlt (Online)", fr: "Le client paie (en ligne)", it: "Il cliente paga (online)", es: "El cliente paga (en línea)" },
    "Müşteri kendi telefonundan ödeme yapacak": { domain: "payments", key: "customer_will_pay_own_phone", en: "Customer will pay from their own phone", de: "Der Kunde bezahlt von seinem eigenen Telefon", fr: "Le client paiera depuis son propre téléphone", it: "Il cliente pagherà dal proprio telefono", es: "El cliente pagará desde su propio teléfono" },
    "Masa Seçimi": { domain: "staff", key: "table_select_title", en: "Table Selection", de: "Tischauswahl", fr: "Sélection de table", it: "Selezione del tavolo", es: "Selección de mesa" }
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

fs.writeFileSync('phase2_translations_merged.json', JSON.stringify(TRANSLATIONS_MERGED, null, 2));

const targetDir = path.join(__dirname, 'lib/screens/staff');

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
                console.log(`Replaced Phase 2 file: ${fullPath}`);
            }
        }
    }
}

replaceInDartFiles(targetDir);
