const fs = require('fs');
const path = require('path');

const translations = {
    "en": {
        "Navigation": { "dashboard": "Dashboard" },
        "AdminNav": {
            "businesses": "Businesses", "orders": "Orders", "masterCatalog": "Master Catalog",
            "invoices": "Invoices", "commissions": "Commissions", "plans": "Plans",
            "activityLogs": "Activity Logs", "userManagement": "User Management", "analytics": "Analytics",
            "sectors": "Sector Management", "kermes": "Kermes", "drivers": "Drivers",
            "reservations": "Reservations", "shifts": "Shifts", "imageGen": "Image Generator",
            "aiMenu": "AI Menu", "settings": "Settings", "dashboard": "Dashboard",
            "customers": "Customers", "suppliers": "Suppliers", "productsCategories": "Products & Categories",
            "staff": "Staff", "logout": "Logout"
        },
        // Adding the rest of existing Landing manually to avoid deleting it
    },
    "de": {
        "Navigation": { "dashboard": "Dashboard" },
        "AdminNav": {
            "businesses": "Geschäfte", "orders": "Bestellungen", "masterCatalog": "Master-Katalog",
            "invoices": "Rechnungen", "commissions": "Provisionen", "plans": "Pläne",
            "activityLogs": "Aktivitätsprotokolle", "userManagement": "Benutzerverwaltung", "analytics": "Analytik",
            "sectors": "Sektormanagement", "kermes": "Kermes", "drivers": "Fahrer",
            "reservations": "Reservierungen", "shifts": "Schichten", "imageGen": "Bildgenerator",
            "aiMenu": "KI-Menü", "settings": "Einstellungen", "dashboard": "Dashboard",
            "customers": "Kunden", "suppliers": "Lieferanten", "productsCategories": "Produkte & Kategorien",
            "staff": "Personal", "logout": "Abmelden"
        }
    },
    "fr": {
        "Navigation": { "dashboard": "Tableau de bord" },
        "AdminNav": {
            "businesses": "Entreprises", "orders": "Commandes", "masterCatalog": "Catalogue Principal",
            "invoices": "Factures", "commissions": "Commissions", "plans": "Plans",
            "activityLogs": "Journaux d'activité", "userManagement": "Gestion des Utilisateurs", "analytics": "Analytique",
            "sectors": "Gestion Secteur", "kermes": "Kermes", "drivers": "Chauffeurs",
            "reservations": "Réservations", "shifts": "Horaires", "imageGen": "Générateur d'images",
            "aiMenu": "Menu IA", "settings": "Paramètres", "dashboard": "Tableau de bord",
            "customers": "Clients", "suppliers": "Fournisseurs", "productsCategories": "Produits & Catégories",
            "staff": "Personnel", "logout": "Déconnexion"
        }
    },
    "it": {
        "Navigation": { "dashboard": "Dashboard" },
        "AdminNav": {
            "businesses": "Aziende", "orders": "Ordini", "masterCatalog": "Catalogo Master",
            "invoices": "Fatture", "commissions": "Commissioni", "plans": "Piani",
            "activityLogs": "Registri Attività", "userManagement": "Gestione Utenti", "analytics": "Analitica",
            "sectors": "Gestione Settore", "kermes": "Kermes", "drivers": "Autisti",
            "reservations": "Prenotazioni", "shifts": "Turni", "imageGen": "Generatore Immagini",
            "aiMenu": "Menu IA", "settings": "Impostazioni", "dashboard": "Dashboard",
            "customers": "Clienti", "suppliers": "Fornitori", "productsCategories": "Prodotti & Categorie",
            "staff": "Personale", "logout": "Esci"
        }
    },
    "es": {
        "Navigation": { "dashboard": "Panel" },
        "AdminNav": {
            "businesses": "Negocios", "orders": "Pedidos", "masterCatalog": "Catálogo Maestro",
            "invoices": "Facturas", "commissions": "Comisiones", "plans": "Planes",
            "activityLogs": "Registros de Actividad", "userManagement": "Gestión de Usuarios", "analytics": "Analítica",
            "sectors": "Gestión Surtido", "kermes": "Kermes", "drivers": "Conductores",
            "reservations": "Reservas", "shifts": "Turnos", "imageGen": "Generador de Imágenes",
            "aiMenu": "Menú IA", "settings": "Ajustes", "dashboard": "Panel",
            "customers": "Clientes", "suppliers": "Proveedores", "productsCategories": "Productos y Categorías",
            "staff": "Personal", "logout": "Cerrar sesión"
        }
    }
};

for (const [lang, newContent] of Object.entries(translations)) {
    const filePath = path.join(__dirname, 'messages', `${lang}.json`);
    if (fs.existsSync(filePath)) {
        let current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        current.AdminNav = newContent.AdminNav;
        current.Navigation = newContent.Navigation;
        fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
        console.log(`Updated ${lang}.json`);
    }
}
