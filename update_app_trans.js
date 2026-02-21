const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join(__dirname, 'mobile_app/assets/translations');
const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

const newOrdersKeys = {
    tr: {
        title: "Siparişlerim",
        login_prompt: "Siparişlerinizi görmek için giriş yapın",
        login_button: "Giriş Yap",
        error: "Hata",
        no_orders_title: "Henüz siparişiniz yok",
        no_orders_subtitle: "Sipariş vermek için bir işletme seçin!",
        no_active_orders: "Aktif siparişiniz yok",
        past_orders: "Geçmiş Siparişler",
        past_group_orders: "Geçmiş Grup Siparişlerim",
        status_pending: "Beklemede",
        status_accepted: "Onaylandı",
        status_preparing: "Hazırlanıyor",
        status_ready: "Hazır",
        status_served: "Servis Edildi",
        status_on_the_way: "Yolda",
        status_delivered: "Teslim Edildi",
        status_cancelled: "İptal",
        yesterday: "Dün",
        order_detail: "Sipariş Detayı",
        order_no: "Sipariş No",
        unavailable_items: "ürün mevcut değil"
    },
    en: {
        title: "My Orders",
        login_prompt: "Log in to see your orders",
        login_button: "Log In",
        error: "Error",
        no_orders_title: "No orders yet",
        no_orders_subtitle: "Select a business to place an order!",
        no_active_orders: "No active orders",
        past_orders: "Past Orders",
        past_group_orders: "Past Group Orders",
        status_pending: "Pending",
        status_accepted: "Accepted",
        status_preparing: "Preparing",
        status_ready: "Ready",
        status_served: "Served",
        status_on_the_way: "On the way",
        status_delivered: "Delivered",
        status_cancelled: "Cancelled",
        yesterday: "Yesterday",
        order_detail: "Order Detail",
        order_no: "Order No",
        unavailable_items: "items unavailable"
    },
    de: {
        title: "Meine Bestellungen",
        login_prompt: "Melden Sie sich an, um Bestellungen zu sehen",
        login_button: "Anmelden",
        error: "Fehler",
        no_orders_title: "Noch keine Bestellungen",
        no_orders_subtitle: "Wählen Sie ein Geschäft, um zu bestellen!",
        no_active_orders: "Keine aktiven Bestellungen",
        past_orders: "Vergangene Bestellungen",
        past_group_orders: "Ausgeführte Gruppenbest.",
        status_pending: "Ausstehend",
        status_accepted: "Akzeptiert",
        status_preparing: "In Zubereitung",
        status_ready: "Bereit",
        status_served: "Serviert",
        status_on_the_way: "Unterwegs",
        status_delivered: "Zugestellt",
        status_cancelled: "Storniert",
        yesterday: "Gestern",
        order_detail: "Bestelldetails",
        order_no: "Bestell-Nr",
        unavailable_items: "Artikel nicht verfügbar"
    },
    fr: {
        title: "Mes Commandes",
        login_prompt: "Connectez-vous pour voir vos commandes",
        login_button: "Connexion",
        error: "Erreur",
        no_orders_title: "Aucune commande",
        no_orders_subtitle: "Sélectionnez un commerce pour commander!",
        no_active_orders: "Aucune commande active",
        past_orders: "Commandes Passées",
        past_group_orders: "Commandes de Groupe Passées",
        status_pending: "En attente",
        status_accepted: "Acceptée",
        status_preparing: "En préparation",
        status_ready: "Prêt",
        status_served: "Servie",
        status_on_the_way: "En route",
        status_delivered: "Livrée",
        status_cancelled: "Annulée",
        yesterday: "Hier",
        order_detail: "Détail de la Commande",
        order_no: "N° de Commande",
        unavailable_items: "articles indisponibles"
    },
    it: {
        title: "I Miei Ordini",
        login_prompt: "Accedi per vedere i tuoi ordini",
        login_button: "Accedi",
        error: "Errore",
        no_orders_title: "Ancora nessun ordine",
        no_orders_subtitle: "Seleziona un'attività per ordinare!",
        no_active_orders: "Nessun ordine attivo",
        past_orders: "Ordini Passati",
        past_group_orders: "Ordini di Gruppo Passati",
        status_pending: "In attesa",
        status_accepted: "Accettato",
        status_preparing: "In preparazione",
        status_ready: "Pronto",
        status_served: "Servito",
        status_on_the_way: "In arrivo",
        status_delivered: "Consegnato",
        status_cancelled: "Annullato",
        yesterday: "Ieri",
        order_detail: "Dettaglio Ordine",
        order_no: "N. Ordine",
        unavailable_items: "articoli non disponibili"
    },
    es: {
        title: "Mis Pedidos",
        login_prompt: "Inicia sesión para ver tus pedidos",
        login_button: "Iniciar Sesión",
        error: "Error",
        no_orders_title: "Aún no hay pedidos",
        no_orders_subtitle: "¡Selecciona un negocio para ordenar!",
        no_active_orders: "Sin pedidos activos",
        past_orders: "Pedidos Anteriores",
        past_group_orders: "Pedidos de Grupo Ant.",
        status_pending: "Pendiente",
        status_accepted: "Aceptado",
        status_preparing: "En preparación",
        status_ready: "Listo",
        status_served: "Servido",
        status_on_the_way: "En camino",
        status_delivered: "Entregado",
        status_cancelled: "Cancelado",
        yesterday: "Ayer",
        order_detail: "Detalle del Pedido",
        order_no: "Pedido N°",
        unavailable_items: "artículos no disponibles"
    }
};

async function updateTrans() {
    for (const lang of LANGUAGES) {
        const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
        let content = {};
        if (fs.existsSync(filePath)) {
            content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        if (!content.orders) content.orders = {};

        content.orders = {
            ...content.orders,
            ...newOrdersKeys[lang]
        };

        // Write it back
        fs.writeFileSync(filePath, JSON.stringify(content, null, 4));
        console.log(`Updated ${lang}.json`);
    }
}

updateTrans();
