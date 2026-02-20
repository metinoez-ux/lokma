const admin = require('firebase-admin');

// Initialize Firebase Admin with Application Default Credentials
// Ensure GOOGLE_APPLICATION_CREDENTIALS environment variable is set or you are running this in an authenticated environment
try {
  admin.initializeApp();
} catch (error) {
  // If running locally, you might need to specify a service account key path
  // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("Firebase default init failed, please ensure you are authenticated:", error);
  process.exit(1);
}

const db = admin.firestore();

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
    "Landing": {
      "home": "Home", "about": "About", "vendorPortal": "Vendor Portal", "support": "Support",
      "login": "Login", "heroTitle": "Delivery.", "heroHighlight": "Grocery.",
      "heroTitleEnd": "All in one app.",
      "heroSubtitle": "More than delivery – your local marketplace for fresh products, restaurants and homemade specialties. Fresh. Fast. Local.",
      "exploreBtn": "Start Exploring", "partnerBtn": "Become a Partner",
      "discoverTitle": "Your Neighborhood, Digital",
      "discoverSubtitle": "Local shops, fresh products, fast delivery. Fresh. Fast. Local.",
      "seeAll": "See All", "market": "Market", "marketDesc": "Fresh and local products",
      "butcher": "Butcher", "butcherDesc": "Masterfully prepared", "catering": "Catering",
      "cateringDesc": "For special occasions", "florist": "Florist", "floristDesc": "Same day delivery",
      "kermes": "Fair", "kermesDesc": "Neighborhood solidarity", "dining": "Dining",
      "diningDesc": "Restaurants and street food", "elLezzetleri": "Homemade",
      "elLezzetleriDesc": "Regional homemade delicacies", "farmer": "From Farmer",
      "farmerDesc": "Direct, fresh, affordable", "b2bBadge": "B2B Partnership",
      "b2bTitle": "Standing by Vendors, on the Path to the Future.",
      "b2bSubtitle": "At LOKMA, we value the work of our vendors. No hidden fees, no complicated contracts. Just growth and fair earnings.",
      "fairCommission": "Fair Commission", "fairCommissionDesc": "We protect your earnings with the lowest rates in the industry.",
      "fastPayment": "Fast Payment", "fastPaymentDesc": "Manage your cash flow with instant payment systems instead of weekly.",
      "wideAudience": "Wide Audience", "wideAudienceDesc": "Reach thousands of customers in your area with our digital advertising power.",
      "easyManagement": "Easy Management", "easyManagementDesc": "Control everything with the user-friendly mobile panel.",
      "applyNow": "Apply Now", "faqTitle": "Frequently Asked Questions",
      "faq1Q": "What is LOKMA?", "faq1A": "LOKMA is a digital marketplace that brings together local vendors and customers. Butchers, markets, florists and more on one platform.",
      "faq2Q": "How can I order?", "faq2A": "Download the app, select your location and discover the nearest businesses. Add products to your cart and complete your order with secure payment.",
      "faq3Q": "How much is the delivery fee?", "faq3A": "Delivery fees vary by region and business. The delivery fee is clearly shown before ordering.",
      "faq4Q": "How can I join as a vendor?", "faq4A": "Click \"Become a Partner\" and fill out the application form. Our team will contact you within 24 hours.",
      "footerPlatform": "Platform", "howItWorks": "How It Works", "categories": "Categories",
      "popularShops": "Popular Shops", "deals": "Deals", "footerCorporate": "Corporate",
      "career": "Career", "press": "Press", "contact": "Contact", "footerLegal": "Legal",
      "terms": "Terms of Use", "privacy": "Privacy Policy", "kvkk": "GDPR",
      "cookies": "Cookie Preferences", "copyright": "© 2024 LOKMA Platform. All rights reserved.",
      "langSupport": "Language Support Active"
    }
  },
  "tr": {
    "Navigation": { "dashboard": "Yetkili Ekranı" },
    "AdminNav": {
      "businesses": "İşletmeler", "orders": "Siparişler", "masterCatalog": "Master Katalog",
      "invoices": "Faturalar", "commissions": "Provizyonlar", "plans": "Planlar",
      "activityLogs": "Log", "userManagement": "Kullanıcı Yönetimi", "analytics": "Analitik",
      "sectors": "Sektör Yönetimi", "kermes": "Kermes", "drivers": "Sürücüler",
      "reservations": "Rezervasyonlar", "shifts": "Vardiyalar", "imageGen": "Görsel Üret",
      "aiMenu": "AI Menü", "settings": "Ayarlar", "dashboard": "Dashboard",
      "customers": "Müşteriler", "suppliers": "Toptancı", "productsCategories": "Ürünler & Kategoriler",
      "staff": "Personel", "logout": "Çıkış Yap"
    },
    "Landing": {
      "home": "Anasayfa", "about": "Hakkımızda", "vendorPortal": "Esnaf Portalı", "support": "Destek",
      "login": "Giriş Yap", "heroTitle": "Lokma,", "heroHighlight": "alın terinin",
      "heroTitleEnd": "yanında duran bir platformdur.",
      "heroSubtitle": "Mahallenizin ruhunu dijital dünyayla birleştiriyoruz. Adil, şeffaf ve topluluk odaklı yeni nesil yaşam ekosistemi.",
      "exploreBtn": "Keşfetmeye Başla", "partnerBtn": "Partnerimiz Olun",
      "discoverTitle": "Mahalleni Keşfet",
      "discoverSubtitle": "En sevdiğiniz yerel dükkanlar şimdi bir tık uzağınızda.",
      "seeAll": "Tümünü Gör", "market": "Market", "marketDesc": "Taze ve yerel ürünler",
      "butcher": "Kasap", "butcherDesc": "Ustalıkla hazırlanmış", "catering": "Catering",
      "cateringDesc": "Özel anlarınız için", "florist": "Çiçek", "floristDesc": "Aynı gün teslimat",
      "kermes": "Kermes", "kermesDesc": "Mahalleli dayanışması", "dining": "Yeme-İçme",
      "diningDesc": "Restoranlar ve sokak lezzetleri", "elLezzetleri": "El Lezzetleri",
      "elLezzetleriDesc": "Yöresel ev yapımı tatlar", "farmer": "Çiftçiden",
      "farmerDesc": "Aracısız, taze, uygun fiyat", "b2bBadge": "B2B Ortaklık",
      "b2bTitle": "Esnafın Yanında, Geleceğin Yolunda.",
      "b2bSubtitle": "LOKMA olarak esnafımızın emeğine değer veriyoruz. Gizli ücretler yok, karmaşık sözleşmeler yok. Sadece büyüme ve adil kazanç var.",
      "fairCommission": "Adil Komisyon", "fairCommissionDesc": "Sektörün en düşük oranlarıyla kazancınızı koruyoruz.",
      "fastPayment": "Hızlı Ödeme", "fastPaymentDesc": "Haftalık değil, anlık ödeme sistemleri ile nakit akışınızı yönetin.",
      "wideAudience": "Geniş Kitle", "wideAudienceDesc": "Bölgenizdeki binlerce müşteriye dijital reklam gücümüzle ulaşın.",
      "easyManagement": "Kolay Yönetim", "easyManagementDesc": "Kullanıcı dostu mobil panel ile her şeyi kontrol edin.",
      "applyNow": "Şimdi Başvuru Yap", "faqTitle": "Sıkça Sorulan Sorular",
      "faq1Q": "LOKMA nedir?", "faq1A": "LOKMA, yerel esnaf ve müşterileri bir araya getiren dijital bir pazar yeridir. Kasaplar, marketler, çiçekçiler ve daha fazlası tek platformda.",
      "faq2Q": "Nasıl sipariş verebilirim?", "faq2A": "Uygulamayı indirin, konumunuzu seçin ve size en yakın işletmeleri keşfedin. Ürünleri sepetinize ekleyin ve güvenli ödeme ile siparişinizi tamamlayın.",
      "faq3Q": "Teslimat ücreti ne kadar?", "faq3A": "Teslimat ücreti bölgeye ve işletmeye göre değişir. Sipariş öncesi teslimat ücreti açıkça gösterilir.",
      "faq4Q": "Esnaf olarak nasıl katılabilirim?", "faq4A": "\"Partnerimiz Olun\" butonuna tıklayarak başvuru formunu doldurun. Ekibimiz 24 saat içinde sizinle iletişime geçecektir.",
      "footerPlatform": "Platform", "howItWorks": "Nasıl Çalışır?", "categories": "Kategoriler",
      "popularShops": "Popüler Mağazalar", "deals": "İndirimler", "footerCorporate": "Kurumsal",
      "career": "Kariyer", "press": "Basın", "contact": "İletişim", "footerLegal": "Yasal",
      "terms": "Kullanım Koşulları", "privacy": "Gizlilik Politikası", "kvkk": "KVKK Aydınlatma",
      "cookies": "Çerez Tercihleri", "copyright": "© 2024 LOKMA Platform. Tüm hakları saklıdır.",
      "langSupport": "Dil Desteği Aktif"
    }
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
    },
    "Landing": {
      "home": "Startseite", "about": "Über uns", "vendorPortal": "Händlerportal", "support": "Support",
      "login": "Anmelden", "heroTitle": "Lieferung.", "heroHighlight": "Lebensmittel.",
      "heroTitleEnd": "Alles in einer App.",
      "heroSubtitle": "Mehr als Lieferung – Ihr lokaler Marktplatz für frische Produkte, Restaurants und hausgemachte Spezialitäten.",
      "exploreBtn": "Erkunden", "partnerBtn": "Partner werden",
      "discoverTitle": "Ihre Nachbarschaft, Digital",
      "discoverSubtitle": "Lokale Geschäfte, frische Produkte, schnelle Lieferung.",
      "seeAll": "Alle ansehen", "market": "Markt", "marketDesc": "Frische und lokale Produkte",
      "butcher": "Metzger", "butcherDesc": "Meisterhaft zubereitet", "catering": "Catering",
      "cateringDesc": "Für besondere Anlässe", "florist": "Florist", "floristDesc": "Lieferung am selben Tag",
      "kermes": "Messe", "kermesDesc": "Nachbarschaftliche Solidarität", "dining": "Essen",
      "diningDesc": "Restaurants und Street Food", "elLezzetleri": "Hausgemacht",
      "elLezzetleriDesc": "Regionale hausgemachte Delikatessen", "farmer": "Vom Bauern",
      "farmerDesc": "Direkt, frisch, günstig", "b2bBadge": "B2B-Partnerschaft",
      "b2bTitle": "An der Seite der Händler, auf dem Weg in die Zukunft.",
      "b2bSubtitle": "Wir schätzen Ihre Arbeit. Keine versteckten Gebühren, keine komplizierten Verträge.",
      "fairCommission": "Faire Provision", "fairCommissionDesc": "Wir schützen Ihre Einnahmen mit den niedrigsten Sätzen.",
      "fastPayment": "Schnelle Bezahlung", "fastPaymentDesc": "Verwalten Sie Ihren Cashflow mit Sofortzahlungssystemen.",
      "wideAudience": "Breites Publikum", "wideAudienceDesc": "Erreichen Sie Tausende von Kunden in Ihrer Nähe.",
      "easyManagement": "Einfache Verwaltung", "easyManagementDesc": "Steuern Sie alles mit dem benutzerfreundlichen mobilen Panel.",
      "applyNow": "Jetzt bewerben", "faqTitle": "Häufig gestellte Fragen",
      "faq1Q": "Was ist LOKMA?", "faq1A": "LOKMA ist ein digitaler Marktplatz, der lokale Händler und Kunden zusammenbringt.",
      "faq2Q": "Wie kann ich bestellen?", "faq2A": "Laden Sie die App herunter, wählen Sie Ihren Standort und entdecken Sie Geschäfte.",
      "faq3Q": "Wie hoch ist die Liefergebühr?", "faq3A": "Die Liefergebühren variieren je nach Region und Geschäft.",
      "faq4Q": "Wie kann ich als Händler beitreten?", "faq4A": "Klicken Sie auf \"Partner werden\" und füllen Sie das Formular aus.",
      "footerPlatform": "Plattform", "howItWorks": "Wie es funktioniert", "categories": "Kategorien",
      "popularShops": "Beliebte Geschäfte", "deals": "Angebote", "footerCorporate": "Unternehmen",
      "career": "Karriere", "press": "Presse", "contact": "Kontakt", "footerLegal": "Rechtliches",
      "terms": "Nutzungsbedingungen", "privacy": "Datenschutz", "kvkk": "DSGVO",
      "cookies": "Cookie-Einstellungen", "copyright": "© 2024 LOKMA Plattform. Alle Rechte vorbehalten.",
      "langSupport": "Sprachunterstützung aktiv"
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
    },
    "Landing": {
      "home": "Accueil", "about": "À propos", "vendorPortal": "Portail Vendeur", "support": "Support",
      "login": "Connexion", "heroTitle": "Livraison.", "heroHighlight": "Épicerie.",
      "heroTitleEnd": "Tout dans une application.",
      "heroSubtitle": "Plus que la livraison – votre marché local pour des produits frais.",
      "exploreBtn": "Explorer", "partnerBtn": "Devenir Partenaire",
      "discoverTitle": "Votre Quartier, Numérique",
      "discoverSubtitle": "Magasins locaux, produits frais, livraison rapide.",
      "seeAll": "Voir Tout", "market": "Marché", "marketDesc": "Produits frais et locaux",
      "butcher": "Boucher", "butcherDesc": "Préparé avec maîtrise", "catering": "Traiteur",
      "cateringDesc": "Pour des occasions spéciales", "florist": "Fleuriste", "floristDesc": "Livraison le jour même",
      "kermes": "Foire", "kermesDesc": "Solidarité de quartier", "dining": "Restauration",
      "diningDesc": "Restaurants et street food", "elLezzetleri": "Fait maison",
      "elLezzetleriDesc": "Délices régionaux", "farmer": "Fermier",
      "farmerDesc": "Direct, frais, abordable", "b2bBadge": "Partenariat B2B",
      "b2bTitle": "Aux côtés des vendeurs.",
      "b2bSubtitle": "Nous valorisons votre travail. Pas de frais cachés.",
      "fairCommission": "Commission Juste", "fairCommissionDesc": "Nous protégeons vos revenus.",
      "fastPayment": "Paiement Rapide", "fastPaymentDesc": "Gérez votre flux de trésorerie.",
      "wideAudience": "Large Public", "wideAudienceDesc": "Atteignez des milliers de clients.",
      "easyManagement": "Gestion Facile", "easyManagementDesc": "Contrôlez tout facilement.",
      "applyNow": "Postuler Maintenant", "faqTitle": "Questions Fréquentes",
      "faq1Q": "Qu'est-ce que LOKMA?", "faq1A": "LOKMA est un marché numérique local.",
      "faq2Q": "Comment puis-je commander?", "faq2A": "Téléchargez l'application et découvrez les magasins.",
      "faq3Q": "Frais de livraison?", "faq3A": "Les frais varient selon la région.",
      "faq4Q": "Comment devenir partenaire?", "faq4A": "Cliquez sur Devenir Partenaire.",
      "footerPlatform": "Plateforme", "howItWorks": "Comment ça marche", "categories": "Catégories",
      "popularShops": "Magasins Populaires", "deals": "Offres", "footerCorporate": "Entreprise",
      "career": "Carrière", "press": "Presse", "contact": "Contact", "footerLegal": "Légal",
      "terms": "Conditions d'utilisation", "privacy": "Confidentialité", "kvkk": "RGPD",
      "cookies": "Préférences des cookies", "copyright": "© 2024 LOKMA. Tous droits réservés.",
      "langSupport": "Support linguistique actif"
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
    },
    "Landing": {
      "home": "Home", "about": "Chi Siamo", "vendorPortal": "Portale Venditori", "support": "Supporto",
      "login": "Accedi", "heroTitle": "Consegna.", "heroHighlight": "Spesa.",
      "heroTitleEnd": "Tutto in un'app.",
      "heroSubtitle": "Il tuo mercato locale per prodotti freschi.",
      "exploreBtn": "Esplora", "partnerBtn": "Diventa Partner",
      "discoverTitle": "Il tuo quartiere, Digitale",
      "discoverSubtitle": "Negozi locali, prodotti freschi.",
      "seeAll": "Vedi Tutto", "market": "Mercato", "marketDesc": "Prodotti freschi e locali",
      "butcher": "Macellaio", "butcherDesc": "Preparato con maestria", "catering": "Catering",
      "cateringDesc": "Per occasioni speciali", "florist": "Fiorista", "floristDesc": "Consegna in giornata",
      "kermes": "Fiera", "kermesDesc": "Solidarietà di quartiere", "dining": "Ristorazione",
      "diningDesc": "Ristoranti e street food", "elLezzetleri": "Fatto in casa",
      "elLezzetleriDesc": "Prelibatezze fatte in casa", "farmer": "Dal Contadino",
      "farmerDesc": "Diretto, fresco, conveniente", "b2bBadge": "Partnership B2B",
      "b2bTitle": "Al fianco dei Venditori.",
      "b2bSubtitle": "Nessuna tariffa nascosta.",
      "fairCommission": "Commissione Equa", "fairCommissionDesc": "Tariffe più basse del settore.",
      "fastPayment": "Pagamento Veloce", "fastPaymentDesc": "Gestisci il tuo flusso di cassa.",
      "wideAudience": "Ampio Pubblico", "wideAudienceDesc": "Raggiungi migliaia di clienti.",
      "easyManagement": "Gestione Facile", "easyManagementDesc": "Controlla tutto facilmente.",
      "applyNow": "Candidati Ora", "faqTitle": "Domande Frequenti",
      "faq1Q": "Cos'è LOKMA?", "faq1A": "Un mercato digitale locale.",
      "faq2Q": "Come posso ordinare?", "faq2A": "Scarica l'app e scopri.",
      "faq3Q": "Costi di consegna?", "faq3A": "Variano in base alla regione.",
      "faq4Q": "Come partecipare?", "faq4A": "Clicca Diventa Partner.",
      "footerPlatform": "Piattaforma", "howItWorks": "Come Funziona", "categories": "Categorie",
      "popularShops": "Negozi Popolari", "deals": "Offerte", "footerCorporate": "Aziendale",
      "career": "Carriera", "press": "Stampa", "contact": "Contatto", "footerLegal": "Legale",
      "terms": "Termini di Utilizzo", "privacy": "Privacy", "kvkk": "GDPR",
      "cookies": "Preferenze Cookie", "copyright": "© 2024 LOKMA. Tutti i diritti riservati.",
      "langSupport": "Supporto linguistico attivo"
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
    },
    "Landing": {
      "home": "Inicio", "about": "Acerca de", "vendorPortal": "Portal de Vendedores", "support": "Soporte",
      "login": "Iniciar sesión", "heroTitle": "Entrega.", "heroHighlight": "Supermercado.",
      "heroTitleEnd": "Todo en una aplicación.",
      "heroSubtitle": "Tu mercado local para productos frescos.",
      "exploreBtn": "Explorar", "partnerBtn": "Hacerse Socio",
      "discoverTitle": "Tu Barrio, Digital",
      "discoverSubtitle": "Tiendas locales, entrega rápida.",
      "seeAll": "Ver Todo", "market": "Mercado", "marketDesc": "Productos frescos y locales",
      "butcher": "Carnicero", "butcherDesc": "Preparado con maestría", "catering": "Catering",
      "cateringDesc": "Para ocasiones especiales", "florist": "Florista", "floristDesc": "Entrega el mismo día",
      "kermes": "Feria", "kermesDesc": "Solidaridad vecinal", "dining": "Restaurantes",
      "diningDesc": "Comida de la calle", "elLezzetleri": "Casero",
      "elLezzetleriDesc": "Delicias caseras", "farmer": "Del Agricultor",
      "farmerDesc": "Directo, fresco, barato", "b2bBadge": "Asociación B2B",
      "b2bTitle": "Junto a los Vendedores.",
      "b2bSubtitle": "Cero tarifas ocultas.",
      "fairCommission": "Comisión Justa", "fairCommissionDesc": "Las tarifas más bajas.",
      "fastPayment": "Pago Rápido", "fastPaymentDesc": "Gestione su flujo de caja.",
      "wideAudience": "Público Amplio", "wideAudienceDesc": "Llega a miles de clientes.",
      "easyManagement": "Gestión Fácil", "easyManagementDesc": "Controle todo fácilmente.",
      "applyNow": "Aplica Ya", "faqTitle": "Preguntas Frecuentes",
      "faq1Q": "¿Qué es LOKMA?", "faq1A": "Un mercado digital local.",
      "faq2Q": "¿Cómo hago un pedido?", "faq2A": "Descarga la aplicación.",
      "faq3Q": "¿Tarifa de entrega?", "faq3A": "Varía según la región.",
      "faq4Q": "¿Cómo unirme?", "faq4A": "Haz clic en Hacerse Socio.",
      "footerPlatform": "Plataforma", "howItWorks": "Cómo Funciona", "categories": "Categorías",
      "popularShops": "Tiendas Populares", "deals": "Ofertas", "footerCorporate": "Corporativo",
      "career": "Carrera", "press": "Prensa", "contact": "Contacto", "footerLegal": "Aviso Legal",
      "terms": "Términos de Uso", "privacy": "Privacidad", "kvkk": "RGPD",
      "cookies": "Preferencias de Cookies", "copyright": "© 2024 LOKMA. Todos los derechos reservados.",
      "langSupport": "Soporte de idioma activo"
    }
  }
};

async function seedData() {
  const batch = db.batch();
  
  for (const [languageCode, content] of Object.entries(translations)) {
    const docRef = db.collection('translations').doc(languageCode);
    batch.set(docRef, content, { merge: true });
    console.log(`Prepared payload for ${languageCode}`);
  }

  try {
    await batch.commit();
    console.log("Successfully seeded translation documents to Firestore.");
  } catch (error) {
    console.error("Error writing to Firestore:", error);
  }
}

seedData();
