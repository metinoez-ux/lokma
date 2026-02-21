const fs = require('fs');
const path = require('path');

const translations = {
    en: {
        Orders: {
            title: "Order Center",
            filters: {
                today: "Today",
                week: "This Week",
                month: "This Month",
                allDates: "All Time",
                allStatuses: "All Statuses",
                allTypes: "All Types",
                searchBusiness: "Search Business...",
                allBusinesses: "All Businesses",
                noResults: "No results found",
                narrowSearch: "more... (Narrow search)"
            },
            stats: {
                total: "Total",
                pending: "Pending",
                preparing: "Preparing",
                revenue: "Revenue"
            },
            workflow: {
                title: "Order Statuses (Live)",
                subtitle: "Current orders",
                pending: "Pending",
                preparing: "Preparing",
                ready: "Ready",
                inTransit: "In Transit",
                completed: "Completed"
            },
            kanban: {
                loading: "Loading orders...",
                empty: "No orders found",
                more: "more",
                table: "Table",
                group: "Group",
                person: "person",
                waiter: "Waiter",
                customerApp: "Customer App",
                servedBy: "served by"
            },
            modal: {
                order: "Order",
                status: "Status",
                business: "Business",
                type: "Type",
                dineInDetail: "Dine-In Detail",
                table: "Table",
                waiter: "Waiter",
                payment: "Payment",
                paid: "Paid",
                unpaid: "Unpaid",
                card: "Card",
                cash: "Cash",
                servedBy: "Served By",
                customer: "Customer",
                guest: "Guest",
                address: "Address",
                products: "Products",
                kitchenSummary: "Kitchen Summary",
                participantBreakdown: "Participant Breakdown",
                subtotal: "Subtotal",
                deliveryFee: "Delivery",
                total: "Total",
                notes: "Order Notes",
                updateStatus: "Update Status",
                deleteOrder: "Delete Order"
            },
            actions: {
                accept: "Accept Order",
                acceptWithMissing: "Accept with missing items",
                startPreparing: "Start Preparing",
                ready: "Order Ready",
                served: "Served"
            },
            cancelModal: {
                title: "Order Cancellation Reason",
                subtitle: "Please specify why the order was cancelled. This will be sent to the customer.",
                reasons: {
                    outOfStock: "Item out of stock",
                    closed: "Business is closed",
                    noDelivery: "Delivery unavailable",
                    duplicate: "Duplicate order",
                    customerRequest: "Customer request"
                },
                customReason: "or type custom reason:",
                placeholder: "Enter cancellation reason...",
                warning: "A cancellation notice will be sent to the customer, and refund info added if paid.",
                cancel: "Cancel",
                confirm: "Confirm Cancellation"
            },
            missingModal: {
                title: "Missing Items",
                subtitle: "Unchecked items will be marked unavailable. The customer will be notified.",
                unavailable: "Unavailable",
                cardPaid: "Customer paid by card.",
                partialRefund: "partial refund will be issued via the same method.",
                warning: "Customer will be notified of missing items. This affects business performance score.",
                cancel: "Cancel",
                confirm: "Accept with Missing Items"
            }
        }
    },
    de: {
        Orders: {
            title: "Bestellzentrum",
            filters: {
                today: "Heute",
                week: "Diese Woche",
                month: "Diesen Monat",
                allDates: "Alle Zeiten",
                allStatuses: "Alle Status",
                allTypes: "Alle Typen",
                searchBusiness: "Betrieb suchen...",
                allBusinesses: "Alle Betriebe",
                noResults: "Keine Ergebnisse",
                narrowSearch: "mehr... (Suche eingrenzen)"
            },
            stats: {
                total: "Gesamt",
                pending: "Ausstehend",
                preparing: "In Zubereitung",
                revenue: "Umsatz"
            },
            workflow: {
                title: "Bestellstatus (Live)",
                subtitle: "Aktuelle Bestellungen",
                pending: "Ausstehend",
                preparing: "In Zubereitung",
                ready: "Bereit",
                inTransit: "Auf dem Weg",
                completed: "Abgeschlossen"
            },
            kanban: {
                loading: "Bestellungen werden geladen...",
                empty: "Keine Bestellungen gefunden",
                more: "mehr",
                table: "Tisch",
                group: "Gruppe",
                person: "Person",
                waiter: "Kellner",
                customerApp: "Kunden-App",
                servedBy: "bedient von"
            },
            modal: {
                order: "Bestellung",
                status: "Status",
                business: "Betrieb",
                type: "Typ",
                dineInDetail: "Dine-In Detail",
                table: "Tisch",
                waiter: "Kellner",
                payment: "Zahlung",
                paid: "Bezahlt",
                unpaid: "Unbezahlt",
                card: "Karte",
                cash: "Bar",
                servedBy: "Bedient von",
                customer: "Kunde",
                guest: "Gast",
                address: "Adresse",
                products: "Produkte",
                kitchenSummary: "Küchen-Übersicht",
                participantBreakdown: "Teilnehmer-Aufschlüsselung",
                subtotal: "Zwischensumme",
                deliveryFee: "Lieferung",
                total: "Gesamt",
                notes: "Bestellnotizen",
                updateStatus: "Status aktualisieren",
                deleteOrder: "Bestellung löschen"
            },
            actions: {
                accept: "Bestellung annehmen",
                acceptWithMissing: "Mit fehlenden Artikeln annehmen",
                startPreparing: "Zubereitung starten",
                ready: "Bestellung bereit",
                served: "Serviert"
            },
            cancelModal: {
                title: "Stornierungsgrund",
                subtitle: "Bitte geben Sie an, warum die Bestellung storniert wurde. Dies wird dem Kunden mitgeteilt.",
                reasons: {
                    outOfStock: "Artikel nicht auf Lager",
                    closed: "Betrieb ist geschlossen",
                    noDelivery: "Lieferung nicht möglich",
                    duplicate: "Doppelte Bestellung",
                    customerRequest: "Kundenwunsch"
                },
                customReason: "oder eigenen Grund eingeben:",
                placeholder: "Stornierungsgrund eingeben...",
                warning: "Der Kunde wird über die Stornierung benachrichtigt. Bei Kartenzahlung erfolgt eine Rückerstattung.",
                cancel: "Abbrechen",
                confirm: "Stornierung bestätigen"
            },
            missingModal: {
                title: "Fehlende Artikel",
                subtitle: "Nicht markierte Artikel werden als nicht verfügbar gekennzeichnet. Der Kunde wird benachrichtigt.",
                unavailable: "Nicht verfügbar",
                cardPaid: "Kunde hat mit Karte bezahlt.",
                partialRefund: "Eine Teilrückerstattung wird über dieselbe Methode ausgestellt.",
                warning: "Der Kunde wird über fehlende Artikel benachrichtigt. Dies beeinflusst die Leistungsbewertung des Betriebs.",
                cancel: "Abbrechen",
                confirm: "Mit fehlenden Artikeln annehmen"
            }
        }
    },
    fr: {
        Orders: {
            title: "Centre de commandes",
            filters: {
                today: "Aujourd'hui",
                week: "Cette semaine",
                month: "Ce mois-ci",
                allDates: "Toutes les dates",
                allStatuses: "Tous les statuts",
                allTypes: "Tous les types",
                searchBusiness: "Rechercher une entreprise...",
                allBusinesses: "Toutes les entreprises",
                noResults: "Aucun résultat trouvé",
                narrowSearch: "plus... (Affiner la recherche)"
            },
            stats: {
                total: "Total",
                pending: "En attente",
                preparing: "En préparation",
                revenue: "Revenu"
            },
            workflow: {
                title: "Statut des commandes (Direct)",
                subtitle: "Commandes actuelles",
                pending: "En attente",
                preparing: "En préparation",
                ready: "Prêt",
                inTransit: "En route",
                completed: "Terminé"
            },
            kanban: {
                loading: "Chargement des commandes...",
                empty: "Aucune commande trouvée",
                more: "plus",
                table: "Table",
                group: "Groupe",
                person: "personne",
                waiter: "Serveur",
                customerApp: "App Client",
                servedBy: "servi par"
            },
            modal: {
                order: "Commande",
                status: "Statut",
                business: "Entreprise",
                type: "Type",
                dineInDetail: "Détail sur place",
                table: "Table",
                waiter: "Serveur",
                payment: "Paiement",
                paid: "Payé",
                unpaid: "Impayé",
                card: "Carte",
                cash: "Espèces",
                servedBy: "Servi par",
                customer: "Client",
                guest: "Invité",
                address: "Adresse",
                products: "Produits",
                kitchenSummary: "Résumé Cuisine",
                participantBreakdown: "Répartition des participants",
                subtotal: "Sous-total",
                deliveryFee: "Livraison",
                total: "Total",
                notes: "Notes de commande",
                updateStatus: "Mettre à jour le statut",
                deleteOrder: "Supprimer la commande"
            },
            actions: {
                accept: "Accepter la commande",
                acceptWithMissing: "Accepter avec articles manquants",
                startPreparing: "Commencer la préparation",
                ready: "Commande prête",
                served: "Servi"
            },
            cancelModal: {
                title: "Raison de l'annulation",
                subtitle: "Veuillez préciser la raison de l'annulation. Cela sera communiqué au client.",
                reasons: {
                    outOfStock: "Article en rupture de stock",
                    closed: "L'établissement est fermé",
                    noDelivery: "Livraison indisponible",
                    duplicate: "Commande en double",
                    customerRequest: "Demande du client"
                },
                customReason: "ou tapez une raison personnalisée:",
                placeholder: "Saisissez la raison...",
                warning: "Un avis d'annulation sera envoyé au client et un remboursement sera initié si payé.",
                cancel: "Annuler",
                confirm: "Confirmer l'annulation"
            },
            missingModal: {
                title: "Articles manquants",
                subtitle: "Les articles non cochés seront marqués comme indisponibles. Le client sera informé.",
                unavailable: "Indisponible",
                cardPaid: "Le client a payé par carte.",
                partialRefund: "Un remboursement partiel sera effectué.",
                warning: "Le client sera informé des articles manquants. Cela affecte le score de performance.",
                cancel: "Annuler",
                confirm: "Accepter avec articles manquants"
            }
        }
    },
    it: {
        Orders: {
            title: "Centro Ordini",
            filters: {
                today: "Oggi",
                week: "Questa settimana",
                month: "Questo mese",
                allDates: "Tutte le date",
                allStatuses: "Tutti gli stati",
                allTypes: "Tutti i tipi",
                searchBusiness: "Cerca attività...",
                allBusinesses: "Tutte le attività",
                noResults: "Nessun risultato",
                narrowSearch: "altro... (Ristringi ricerca)"
            },
            stats: {
                total: "Totale",
                pending: "In attesa",
                preparing: "In preparazione",
                revenue: "Fatturato"
            },
            workflow: {
                title: "Stato Ordini (Live)",
                subtitle: "Ordini attuali",
                pending: "In attesa",
                preparing: "In preparazione",
                ready: "Pronto",
                inTransit: "In transito",
                completed: "Completato"
            },
            kanban: {
                loading: "Caricamento ordini...",
                empty: "Nessun ordine trovato",
                more: "altro",
                table: "Tavolo",
                group: "Gruppo",
                person: "persona",
                waiter: "Cameriere",
                customerApp: "App Cliente",
                servedBy: "servito da"
            },
            modal: {
                order: "Ordine",
                status: "Stato",
                business: "Attività",
                type: "Tipo",
                dineInDetail: "Dettaglio Locale",
                table: "Tavolo",
                waiter: "Cameriere",
                payment: "Pagamento",
                paid: "Pagato",
                unpaid: "Non pagato",
                card: "Carta",
                cash: "Contanti",
                servedBy: "Servito da",
                customer: "Cliente",
                guest: "Ospite",
                address: "Indirizzo",
                products: "Prodotti",
                kitchenSummary: "Riepilogo Cucina",
                participantBreakdown: "Ripartizione partecipanti",
                subtotal: "Subtotale",
                deliveryFee: "Consegna",
                total: "Totale",
                notes: "Note ordine",
                updateStatus: "Aggiorna Stato",
                deleteOrder: "Elimina Ordine"
            },
            actions: {
                accept: "Accetta Ordine",
                acceptWithMissing: "Accetta con articoli mancanti",
                startPreparing: "Inizia preparazione",
                ready: "Ordine Pronto",
                served: "Servito"
            },
            cancelModal: {
                title: "Motivo Annullamento",
                subtitle: "Specifica perché l'ordine è stato annullato. Verrà comunicato al cliente.",
                reasons: {
                    outOfStock: "Articolo esaurito",
                    closed: "Attività chiusa",
                    noDelivery: "Consegna non disponibile",
                    duplicate: "Ordine doppio",
                    customerRequest: "Richiesta cliente"
                },
                customReason: "o inserisci motivo personalizzato:",
                placeholder: "Inserisci motivo...",
                warning: "Verrà inviata una notifica al cliente e verrà rimborsato se ha già pagato.",
                cancel: "Annulla",
                confirm: "Conferma Annullamento"
            },
            missingModal: {
                title: "Articoli Mancanti",
                subtitle: "Gli articoli non spuntati saranno contrassegnati come non disponibili. Il cliente verrà avvisato.",
                unavailable: "Non disponibile",
                cardPaid: "Il cliente ha pagato con carta.",
                partialRefund: "Un rimborso parziale verrà emesso.",
                warning: "Il cliente verrà avvisato degli articoli mancanti. Questo influisce sul punteggio.",
                cancel: "Annulla",
                confirm: "Accetta con Mancanti"
            }
        }
    },
    es: {
        Orders: {
            title: "Centro de Pedidos",
            filters: {
                today: "Hoy",
                week: "Esta semana",
                month: "Este mes",
                allDates: "Todas las fechas",
                allStatuses: "Todos los estados",
                allTypes: "Todos los tipos",
                searchBusiness: "Buscar negocio...",
                allBusinesses: "Todos los negocios",
                noResults: "No se encontraron resultados",
                narrowSearch: "más... (Limitar búsqueda)"
            },
            stats: {
                total: "Total",
                pending: "Pendiente",
                preparing: "Preparando",
                revenue: "Ingresos"
            },
            workflow: {
                title: "Estados de Pedido (En vivo)",
                subtitle: "Pedidos actuales",
                pending: "Pendiente",
                preparing: "Preparando",
                ready: "Listo",
                inTransit: "En camino",
                completed: "Completado"
            },
            kanban: {
                loading: "Cargando pedidos...",
                empty: "No se encontraron pedidos",
                more: "más",
                table: "Mesa",
                group: "Grupo",
                person: "persona",
                waiter: "Camarero",
                customerApp: "App Cliente",
                servedBy: "servido por"
            },
            modal: {
                order: "Pedido",
                status: "Estado",
                business: "Negocio",
                type: "Tipo",
                dineInDetail: "Detalle Local",
                table: "Mesa",
                waiter: "Camarero",
                payment: "Pago",
                paid: "Pagado",
                unpaid: "No pagado",
                card: "Tarjeta",
                cash: "Efectivo",
                servedBy: "Servido por",
                customer: "Cliente",
                guest: "Invitado",
                address: "Dirección",
                products: "Productos",
                kitchenSummary: "Resumen Cocina",
                participantBreakdown: "Desglose participantes",
                subtotal: "Subtotal",
                deliveryFee: "Entrega",
                total: "Total",
                notes: "Notas del pedido",
                updateStatus: "Actualizar Estado",
                deleteOrder: "Eliminar Pedido"
            },
            actions: {
                accept: "Aceptar Pedido",
                acceptWithMissing: "Aceptar con faltantes",
                startPreparing: "Empezar preparación",
                ready: "Pedido Listo",
                served: "Servido"
            },
            cancelModal: {
                title: "Motivo de Cancelación",
                subtitle: "Especifique por qué se canceló. Esto se comunicará al cliente.",
                reasons: {
                    outOfStock: "Artículo agotado",
                    closed: "Negocio cerrado",
                    noDelivery: "Entrega no disponible",
                    duplicate: "Pedido duplicado",
                    customerRequest: "Petición del cliente"
                },
                customReason: "o escriba motivo personalizado:",
                placeholder: "Ingrese motivo...",
                warning: "Se enviará notificación al cliente y se reembolsará si pagó.",
                cancel: "Cancelar",
                confirm: "Confirmar Cancelación"
            },
            missingModal: {
                title: "Artículos Faltantes",
                subtitle: "Los artículos desmarcados se marcarán como no disponibles. Se avisará al cliente.",
                unavailable: "No disponible",
                cardPaid: "El cliente pagó con tarjeta.",
                partialRefund: "Se emitirá un reembolso parcial.",
                warning: "El cliente será notificado de artículos faltantes. Esto afecta la puntuación.",
                cancel: "Cancelar",
                confirm: "Aceptar con Faltantes"
            }
        }
    }
};

const langs = ['en', 'de', 'fr', 'it', 'es'];
langs.forEach(lang => {
    const filePath = path.join(__dirname, 'messages', `${lang}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    data.AdminPortal = translations[lang];

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${lang}.json with AdminPortal namespace.`);
});
