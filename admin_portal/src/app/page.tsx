'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Translations
const translations: Record<string, Record<string, string>> = {
  tr: {
    home: 'Anasayfa',
    about: 'Hakkımızda',
    vendorPortal: 'Esnaf Portalı',
    support: 'Destek',
    login: 'Giriş Yap',
    heroTitle: 'Lokma,',
    heroHighlight: 'alın terinin',
    heroTitleEnd: 'yanında duran bir platformdur.',
    heroSubtitle: 'Mahallenizin ruhunu dijital dünyayla birleştiriyoruz. Adil, şeffaf ve topluluk odaklı yeni nesil yaşam ekosistemi.',
    exploreBtn: 'Keşfetmeye Başla',
    partnerBtn: 'Partnerimiz Olun',
    discoverTitle: 'Mahalleni Keşfet',
    discoverSubtitle: 'En sevdiğiniz yerel dükkanlar şimdi bir tık uzağınızda.',
    seeAll: 'Tümünü Gör',
    market: 'Market',
    marketDesc: 'Taze ve yerel ürünler',
    butcher: 'Kasap',
    butcherDesc: 'Ustalıkla hazırlanmış',
    catering: 'Catering',
    cateringDesc: 'Özel anlarınız için',
    florist: 'Çiçek',
    floristDesc: 'Aynı gün teslimat',
    kermes: 'Kermes',
    kermesDesc: 'Mahalleli dayanışması',
    dining: 'Yeme-İçme',
    diningDesc: 'Restoranlar ve sokak lezzetleri',
    elLezzetleri: 'El Lezzetleri',
    elLezzetleriDesc: 'Yöresel ev yapımı tatlar',
    farmer: 'Çiftçiden',
    farmerDesc: 'Aracısız, taze, uygun fiyat',
    b2bBadge: 'B2B Ortaklık',
    b2bTitle: 'Esnafın Yanında, Geleceğin Yolunda.',
    b2bSubtitle: 'LOKMA olarak esnafımızın emeğine değer veriyoruz. Gizli ücretler yok, karmaşık sözleşmeler yok. Sadece büyüme ve adil kazanç var.',
    fairCommission: 'Adil Komisyon',
    fairCommissionDesc: 'Sektörün en düşük oranlarıyla kazancınızı koruyoruz.',
    fastPayment: 'Hızlı Ödeme',
    fastPaymentDesc: 'Haftalık değil, anlık ödeme sistemleri ile nakit akışınızı yönetin.',
    wideAudience: 'Geniş Kitle',
    wideAudienceDesc: 'Bölgenizdeki binlerce müşteriye dijital reklam gücümüzle ulaşın.',
    easyManagement: 'Kolay Yönetim',
    easyManagementDesc: 'Kullanıcı dostu mobil panel ile her şeyi kontrol edin.',
    applyNow: 'Şimdi Başvuru Yap',
    faqTitle: 'Sıkça Sorulan Sorular',
    faq1Q: 'LOKMA nedir?',
    faq1A: 'LOKMA, yerel esnaf ve müşterileri bir araya getiren dijital bir pazar yeridir. Kasaplar, marketler, çiçekçiler ve daha fazlası tek platformda.',
    faq2Q: 'Nasıl sipariş verebilirim?',
    faq2A: 'Uygulamayı indirin, konumunuzu seçin ve size en yakın işletmeleri keşfedin. Ürünleri sepetinize ekleyin ve güvenli ödeme ile siparişinizi tamamlayın.',
    faq3Q: 'Teslimat ücreti ne kadar?',
    faq3A: 'Teslimat ücreti bölgeye ve işletmeye göre değişir. Sipariş öncesi teslimat ücreti açıkça gösterilir.',
    faq4Q: 'Esnaf olarak nasıl katılabilirim?',
    faq4A: '"Partnerimiz Olun" butonuna tıklayarak başvuru formunu doldurun. Ekibimiz 24 saat içinde sizinle iletişime geçecektir.',
    footerPlatform: 'Platform',
    howItWorks: 'Nasıl Çalışır?',
    categories: 'Kategoriler',
    popularShops: 'Popüler Mağazalar',
    deals: 'İndirimler',
    footerCorporate: 'Kurumsal',
    career: 'Kariyer',
    press: 'Basın',
    contact: 'İletişim',
    footerLegal: 'Yasal',
    terms: 'Kullanım Koşulları',
    privacy: 'Gizlilik Politikası',
    kvkk: 'KVKK Aydınlatma',
    cookies: 'Çerez Tercihleri',
    copyright: '© 2024 LOKMA Platform. Tüm hakları saklıdır.',
    langSupport: 'Dil Desteği Aktif',
  },
  de: {
    home: 'Startseite',
    about: 'Über uns',
    vendorPortal: 'Händlerportal',
    support: 'Support',
    login: 'Anmelden',
    heroTitle: 'Lieferdienst.',
    heroHighlight: 'Einkauf.',
    heroTitleEnd: 'Alles in einer App.',
    heroSubtitle: 'Mehr als nur Lieferung – dein lokaler Marktplatz für frische Produkte, Restaurants und handgemachte Spezialitäten. Fresh. Fast. Local.',
    exploreBtn: 'Jetzt entdecken',
    partnerBtn: 'Partner werden',
    discoverTitle: 'Deine Nachbarschaft, digital',
    discoverSubtitle: 'Lokale Geschäfte, frische Produkte, schnelle Lieferung. Fresh. Fast. Local.',
    seeAll: 'Alle anzeigen',
    market: 'Supermarkt',
    marketDesc: 'Frische und lokale Produkte',
    butcher: 'Metzger',
    butcherDesc: 'Meisterhaft zubereitet',
    catering: 'Catering',
    cateringDesc: 'Für besondere Anlässe',
    florist: 'Blumen',
    floristDesc: 'Lieferung am selben Tag',
    kermes: 'Basar',
    kermesDesc: 'Nachbarschaftssolidarität',
    dining: 'Gastronomie',
    diningDesc: 'Restaurants und Straßenküche',
    elLezzetleri: 'Hausgemacht',
    elLezzetleriDesc: 'Regionale hausgemachte Spezialitäten',
    farmer: 'Vom Bauern',
    farmerDesc: 'Direkt, frisch, günstig',
    b2bBadge: 'B2B Partnerschaft',
    b2bTitle: 'An der Seite der Händler, auf dem Weg in die Zukunft.',
    b2bSubtitle: 'Bei LOKMA schätzen wir die Arbeit unserer Händler. Keine versteckten Gebühren, keine komplizierten Verträge. Nur Wachstum und fairer Verdienst.',
    fairCommission: 'Faire Provision',
    fairCommissionDesc: 'Wir schützen Ihren Verdienst mit den niedrigsten Raten der Branche.',
    fastPayment: 'Schnelle Zahlung',
    fastPaymentDesc: 'Verwalten Sie Ihren Cashflow mit sofortigen statt wöchentlichen Zahlungssystemen.',
    wideAudience: 'Breites Publikum',
    wideAudienceDesc: 'Erreichen Sie Tausende von Kunden in Ihrer Region mit unserer digitalen Werbekraft.',
    easyManagement: 'Einfache Verwaltung',
    easyManagementDesc: 'Kontrollieren Sie alles mit dem benutzerfreundlichen mobilen Panel.',
    applyNow: 'Jetzt bewerben',
    faqTitle: 'Häufig gestellte Fragen',
    faq1Q: 'Was ist LOKMA?',
    faq1A: 'LOKMA ist ein digitaler Marktplatz, der lokale Händler und Kunden zusammenbringt. Metzger, Supermärkte, Floristen und mehr auf einer Plattform.',
    faq2Q: 'Wie kann ich bestellen?',
    faq2A: 'Laden Sie die App herunter, wählen Sie Ihren Standort und entdecken Sie die nächstgelegenen Geschäfte. Fügen Sie Produkte zum Warenkorb hinzu und schließen Sie Ihre Bestellung mit sicherer Zahlung ab.',
    faq3Q: 'Wie hoch sind die Lieferkosten?',
    faq3A: 'Die Lieferkosten variieren je nach Region und Geschäft. Die Lieferkosten werden vor der Bestellung deutlich angezeigt.',
    faq4Q: 'Wie kann ich als Händler beitreten?',
    faq4A: 'Klicken Sie auf "Partner werden" und füllen Sie das Bewerbungsformular aus. Unser Team wird sich innerhalb von 24 Stunden bei Ihnen melden.',
    footerPlatform: 'Plattform',
    howItWorks: 'Wie es funktioniert',
    categories: 'Kategorien',
    popularShops: 'Beliebte Geschäfte',
    deals: 'Angebote',
    footerCorporate: 'Unternehmen',
    career: 'Karriere',
    press: 'Presse',
    contact: 'Kontakt',
    footerLegal: 'Rechtliches',
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutz',
    kvkk: 'DSGVO',
    cookies: 'Cookie-Einstellungen',
    copyright: '© 2024 LOKMA Platform. Alle Rechte vorbehalten.',
    langSupport: 'Sprachunterstützung aktiv',
  },
  en: {
    home: 'Home',
    about: 'About',
    vendorPortal: 'Vendor Portal',
    support: 'Support',
    login: 'Login',
    heroTitle: 'Delivery.',
    heroHighlight: 'Grocery.',
    heroTitleEnd: 'All in one app.',
    heroSubtitle: 'More than delivery – your local marketplace for fresh products, restaurants and homemade specialties. Fresh. Fast. Local.',
    exploreBtn: 'Start Exploring',
    partnerBtn: 'Become a Partner',
    discoverTitle: 'Your Neighborhood, Digital',
    discoverSubtitle: 'Local shops, fresh products, fast delivery. Fresh. Fast. Local.',
    seeAll: 'See All',
    market: 'Market',
    marketDesc: 'Fresh and local products',
    butcher: 'Butcher',
    butcherDesc: 'Masterfully prepared',
    catering: 'Catering',
    cateringDesc: 'For special occasions',
    florist: 'Florist',
    floristDesc: 'Same day delivery',
    kermes: 'Fair',
    kermesDesc: 'Neighborhood solidarity',
    dining: 'Dining',
    diningDesc: 'Restaurants and street food',
    elLezzetleri: 'Homemade',
    elLezzetleriDesc: 'Regional homemade delicacies',
    farmer: 'From Farmer',
    farmerDesc: 'Direct, fresh, affordable',
    b2bBadge: 'B2B Partnership',
    b2bTitle: 'Standing by Vendors, on the Path to the Future.',
    b2bSubtitle: 'At LOKMA, we value the work of our vendors. No hidden fees, no complicated contracts. Just growth and fair earnings.',
    fairCommission: 'Fair Commission',
    fairCommissionDesc: 'We protect your earnings with the lowest rates in the industry.',
    fastPayment: 'Fast Payment',
    fastPaymentDesc: 'Manage your cash flow with instant payment systems instead of weekly.',
    wideAudience: 'Wide Audience',
    wideAudienceDesc: 'Reach thousands of customers in your area with our digital advertising power.',
    easyManagement: 'Easy Management',
    easyManagementDesc: 'Control everything with the user-friendly mobile panel.',
    applyNow: 'Apply Now',
    faqTitle: 'Frequently Asked Questions',
    faq1Q: 'What is LOKMA?',
    faq1A: 'LOKMA is a digital marketplace that brings together local vendors and customers. Butchers, markets, florists and more on one platform.',
    faq2Q: 'How can I order?',
    faq2A: 'Download the app, select your location and discover the nearest businesses. Add products to your cart and complete your order with secure payment.',
    faq3Q: 'How much is the delivery fee?',
    faq3A: 'Delivery fees vary by region and business. The delivery fee is clearly shown before ordering.',
    faq4Q: 'How can I join as a vendor?',
    faq4A: 'Click "Become a Partner" and fill out the application form. Our team will contact you within 24 hours.',
    footerPlatform: 'Platform',
    howItWorks: 'How It Works',
    categories: 'Categories',
    popularShops: 'Popular Shops',
    deals: 'Deals',
    footerCorporate: 'Corporate',
    career: 'Career',
    press: 'Press',
    contact: 'Contact',
    footerLegal: 'Legal',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    kvkk: 'GDPR',
    cookies: 'Cookie Preferences',
    copyright: '© 2024 LOKMA Platform. All rights reserved.',
    langSupport: 'Language Support Active',
  },
  fr: {
    home: 'Accueil',
    about: 'À propos',
    vendorPortal: 'Portail Vendeur',
    support: 'Support',
    login: 'Connexion',
    heroTitle: 'Lokma,',
    heroHighlight: 'soutient',
    heroTitleEnd: 'le travail honnête.',
    heroSubtitle: 'Nous connectons l\'esprit de votre quartier au monde numérique. Un écosystème équitable, transparent et axé sur la communauté.',
    exploreBtn: 'Commencer',
    partnerBtn: 'Devenir Partenaire',
    discoverTitle: 'Découvrez votre quartier',
    discoverSubtitle: 'Vos boutiques locales préférées sont maintenant à portée de clic.',
    seeAll: 'Voir tout',
    market: 'Supermarché',
    marketDesc: 'Produits frais et locaux',
    butcher: 'Boucherie',
    butcherDesc: 'Préparé avec maîtrise',
    catering: 'Traiteur',
    cateringDesc: 'Pour vos occasions spéciales',
    florist: 'Fleuriste',
    floristDesc: 'Livraison le jour même',
    kermes: 'Kermesse',
    kermesDesc: 'Solidarité de quartier',
    dining: 'Restauration',
    diningDesc: 'Restaurants et cuisine de rue',
    elLezzetleri: 'Fait Maison',
    elLezzetleriDesc: 'Délices régionaux faits maison',
    farmer: 'Du Fermier',
    farmerDesc: 'Direct, frais, abordable',
    b2bBadge: 'Partenariat B2B',
    b2bTitle: 'Aux côtés des commerçants, vers l\'avenir.',
    b2bSubtitle: 'Chez LOKMA, nous valorisons le travail de nos commerçants. Pas de frais cachés, pas de contrats compliqués.',
    fairCommission: 'Commission équitable',
    fairCommissionDesc: 'Nous protégeons vos revenus avec les taux les plus bas.',
    fastPayment: 'Paiement rapide',
    fastPaymentDesc: 'Gérez votre trésorerie avec des paiements instantanés.',
    wideAudience: 'Large audience',
    wideAudienceDesc: 'Atteignez des milliers de clients avec notre publicité digitale.',
    easyManagement: 'Gestion facile',
    easyManagementDesc: 'Contrôlez tout avec le panneau mobile convivial.',
    applyNow: 'Postuler maintenant',
    faqTitle: 'Questions fréquentes',
    faq1Q: 'Qu\'est-ce que LOKMA?',
    faq1A: 'LOKMA est une place de marché numérique qui réunit commerçants locaux et clients.',
    faq2Q: 'Comment commander?',
    faq2A: 'Téléchargez l\'app, sélectionnez votre emplacement et découvrez les commerces les plus proches.',
    faq3Q: 'Combien coûte la livraison?',
    faq3A: 'Les frais de livraison varient selon la région et le commerce.',
    faq4Q: 'Comment rejoindre en tant que commerçant?',
    faq4A: 'Cliquez sur "Devenir Partenaire" et remplissez le formulaire.',
    footerPlatform: 'Plateforme',
    howItWorks: 'Comment ça marche',
    categories: 'Catégories',
    popularShops: 'Boutiques populaires',
    deals: 'Offres',
    footerCorporate: 'Entreprise',
    career: 'Carrière',
    press: 'Presse',
    contact: 'Contact',
    footerLegal: 'Légal',
    terms: 'Conditions d\'utilisation',
    privacy: 'Politique de confidentialité',
    kvkk: 'RGPD',
    cookies: 'Préférences cookies',
    copyright: '© 2024 LOKMA Platform. Tous droits réservés.',
    langSupport: 'Support multilingue actif',
  },
  it: {
    home: 'Home',
    about: 'Chi siamo',
    vendorPortal: 'Portale Venditori',
    support: 'Supporto',
    login: 'Accedi',
    heroTitle: 'Lokma,',
    heroHighlight: 'sostiene',
    heroTitleEnd: 'il duro lavoro.',
    heroSubtitle: 'Connettiamo lo spirito del tuo quartiere con il mondo digitale. Un ecosistema equo, trasparente e orientato alla comunità.',
    exploreBtn: 'Inizia',
    partnerBtn: 'Diventa Partner',
    discoverTitle: 'Scopri il tuo quartiere',
    discoverSubtitle: 'I tuoi negozi locali preferiti sono ora a portata di clic.',
    seeAll: 'Vedi tutto',
    market: 'Supermercato',
    marketDesc: 'Prodotti freschi e locali',
    butcher: 'Macelleria',
    butcherDesc: 'Preparato con maestria',
    catering: 'Catering',
    cateringDesc: 'Per le tue occasioni speciali',
    florist: 'Fiorista',
    floristDesc: 'Consegna in giornata',
    kermes: 'Fiera',
    kermesDesc: 'Solidarietà di quartiere',
    dining: 'Ristorazione',
    diningDesc: 'Ristoranti e cibo di strada',
    elLezzetleri: 'Fatto in Casa',
    elLezzetleriDesc: 'Delizie regionali fatte in casa',
    farmer: 'Dal Contadino',
    farmerDesc: 'Diretto, fresco, conveniente',
    b2bBadge: 'Partnership B2B',
    b2bTitle: 'Al fianco dei commercianti, verso il futuro.',
    b2bSubtitle: 'In LOKMA apprezziamo il lavoro dei nostri commercianti. Nessun costo nascosto, nessun contratto complicato.',
    fairCommission: 'Commissione equa',
    fairCommissionDesc: 'Proteggiamo i tuoi guadagni con le tariffe più basse.',
    fastPayment: 'Pagamento veloce',
    fastPaymentDesc: 'Gestisci il tuo flusso di cassa con pagamenti istantanei.',
    wideAudience: 'Ampio pubblico',
    wideAudienceDesc: 'Raggiungi migliaia di clienti con la nostra pubblicità digitale.',
    easyManagement: 'Gestione facile',
    easyManagementDesc: 'Controlla tutto con il pannello mobile intuitivo.',
    applyNow: 'Candidati ora',
    faqTitle: 'Domande frequenti',
    faq1Q: 'Cos\'è LOKMA?',
    faq1A: 'LOKMA è un marketplace digitale che riunisce commercianti locali e clienti.',
    faq2Q: 'Come ordinare?',
    faq2A: 'Scarica l\'app, seleziona la tua posizione e scopri i negozi più vicini.',
    faq3Q: 'Quanto costa la consegna?',
    faq3A: 'Le spese di consegna variano in base alla regione e al negozio.',
    faq4Q: 'Come aderire come commerciante?',
    faq4A: 'Clicca su "Diventa Partner" e compila il modulo.',
    footerPlatform: 'Piattaforma',
    howItWorks: 'Come funziona',
    categories: 'Categorie',
    popularShops: 'Negozi popolari',
    deals: 'Offerte',
    footerCorporate: 'Azienda',
    career: 'Carriera',
    press: 'Stampa',
    contact: 'Contatto',
    footerLegal: 'Legale',
    terms: 'Termini di utilizzo',
    privacy: 'Privacy Policy',
    kvkk: 'GDPR',
    cookies: 'Preferenze cookie',
    copyright: '© 2024 LOKMA Platform. Tutti i diritti riservati.',
    langSupport: 'Supporto multilingue attivo',
  },
  es: {
    home: 'Inicio',
    about: 'Nosotros',
    vendorPortal: 'Portal de Vendedores',
    support: 'Soporte',
    login: 'Iniciar sesión',
    heroTitle: 'Lokma,',
    heroHighlight: 'apoya',
    heroTitleEnd: 'el trabajo honesto.',
    heroSubtitle: 'Conectamos el espíritu de tu barrio con el mundo digital. Un ecosistema justo, transparente y orientado a la comunidad.',
    exploreBtn: 'Empezar',
    partnerBtn: 'Ser Socio',
    discoverTitle: 'Descubre tu barrio',
    discoverSubtitle: 'Tus tiendas locales favoritas están ahora a un clic.',
    seeAll: 'Ver todo',
    market: 'Supermercado',
    marketDesc: 'Productos frescos y locales',
    butcher: 'Carnicería',
    butcherDesc: 'Preparado con maestría',
    catering: 'Catering',
    cateringDesc: 'Para tus ocasiones especiales',
    florist: 'Floristería',
    floristDesc: 'Entrega en el mismo día',
    kermes: 'Feria',
    kermesDesc: 'Solidaridad vecinal',
    dining: 'Gastronomía',
    diningDesc: 'Restaurantes y comida callejera',
    elLezzetleri: 'Casero',
    elLezzetleriDesc: 'Delicias regionales caseras',
    farmer: 'Del Agricultor',
    farmerDesc: 'Directo, fresco, asequible',
    b2bBadge: 'Asociación B2B',
    b2bTitle: 'Junto a los comerciantes, hacia el futuro.',
    b2bSubtitle: 'En LOKMA valoramos el trabajo de nuestros comerciantes. Sin costes ocultos, sin contratos complicados.',
    fairCommission: 'Comisión justa',
    fairCommissionDesc: 'Protegemos tus ganancias con las tarifas más bajas.',
    fastPayment: 'Pago rápido',
    fastPaymentDesc: 'Gestiona tu flujo de caja con pagos instantáneos.',
    wideAudience: 'Amplia audiencia',
    wideAudienceDesc: 'Llega a miles de clientes con nuestra publicidad digital.',
    easyManagement: 'Gestión fácil',
    easyManagementDesc: 'Controla todo con el panel móvil intuitivo.',
    applyNow: 'Solicitar ahora',
    faqTitle: 'Preguntas frecuentes',
    faq1Q: '¿Qué es LOKMA?',
    faq1A: 'LOKMA es un mercado digital que une comerciantes locales y clientes.',
    faq2Q: '¿Cómo pedir?',
    faq2A: 'Descarga la app, selecciona tu ubicación y descubre las tiendas más cercanas.',
    faq3Q: '¿Cuánto cuesta el envío?',
    faq3A: 'Los gastos de envío varían según la región y la tienda.',
    faq4Q: '¿Cómo unirse como comerciante?',
    faq4A: 'Haz clic en "Ser Socio" y completa el formulario.',
    footerPlatform: 'Plataforma',
    howItWorks: 'Cómo funciona',
    categories: 'Categorías',
    popularShops: 'Tiendas populares',
    deals: 'Ofertas',
    footerCorporate: 'Empresa',
    career: 'Carreras',
    press: 'Prensa',
    contact: 'Contacto',
    footerLegal: 'Legal',
    terms: 'Términos de uso',
    privacy: 'Política de privacidad',
    kvkk: 'RGPD',
    cookies: 'Preferencias de cookies',
    copyright: '© 2024 LOKMA Platform. Todos los derechos reservados.',
    langSupport: 'Soporte multilingüe activo',
  },
  nl: {
    home: 'Home',
    about: 'Over ons',
    vendorPortal: 'Verkopersportaal',
    support: 'Ondersteuning',
    login: 'Inloggen',
    heroTitle: 'Lokma,',
    heroHighlight: 'steunt',
    heroTitleEnd: 'eerlijk hard werken.',
    heroSubtitle: 'We verbinden de geest van je buurt met de digitale wereld. Een eerlijk, transparant en gemeenschapsgericht ecosysteem.',
    exploreBtn: 'Ontdekken',
    partnerBtn: 'Word Partner',
    discoverTitle: 'Ontdek je buurt',
    discoverSubtitle: 'Je favoriete lokale winkels zijn nu slechts een klik verwijderd.',
    seeAll: 'Alles zien',
    market: 'Supermarkt',
    marketDesc: 'Verse en lokale producten',
    butcher: 'Slagerij',
    butcherDesc: 'Met vakmanschap bereid',
    catering: 'Catering',
    cateringDesc: 'Voor je speciale gelegenheden',
    florist: 'Bloemist',
    floristDesc: 'Bezorging op dezelfde dag',
    kermes: 'Kermis',
    kermesDesc: 'Buurt solidariteit',
    dining: 'Horeca',
    diningDesc: 'Restaurants en straatvoedsel',
    elLezzetleri: 'Huisgemaakt',
    elLezzetleriDesc: 'Regionale huisgemaakte lekkernijen',
    farmer: 'Van de Boer',
    farmerDesc: 'Direct, vers, betaalbaar',
    b2bBadge: 'B2B Partnerschap',
    b2bTitle: 'Naast de handelaren, naar de toekomst.',
    b2bSubtitle: 'Bij LOKMA waarderen we het werk van onze handelaren. Geen verborgen kosten, geen ingewikkelde contracten.',
    fairCommission: 'Eerlijke commissie',
    fairCommissionDesc: 'We beschermen je inkomsten met de laagste tarieven.',
    fastPayment: 'Snelle betaling',
    fastPaymentDesc: 'Beheer je cashflow met directe betalingen.',
    wideAudience: 'Breed publiek',
    wideAudienceDesc: 'Bereik duizenden klanten met onze digitale advertenties.',
    easyManagement: 'Eenvoudig beheer',
    easyManagementDesc: 'Beheer alles met het gebruiksvriendelijke mobiele paneel.',
    applyNow: 'Nu aanmelden',
    faqTitle: 'Veelgestelde vragen',
    faq1Q: 'Wat is LOKMA?',
    faq1A: 'LOKMA is een digitale marktplaats die lokale handelaren en klanten samenbrengt.',
    faq2Q: 'Hoe bestellen?',
    faq2A: 'Download de app, selecteer je locatie en ontdek de dichtstbijzijnde winkels.',
    faq3Q: 'Hoeveel kost de bezorging?',
    faq3A: 'Bezorgkosten variëren per regio en winkel.',
    faq4Q: 'Hoe aansluiten als handelaar?',
    faq4A: 'Klik op "Word Partner" en vul het formulier in.',
    footerPlatform: 'Platform',
    howItWorks: 'Hoe het werkt',
    categories: 'Categorieën',
    popularShops: 'Populaire winkels',
    deals: 'Aanbiedingen',
    footerCorporate: 'Bedrijf',
    career: 'Carrière',
    press: 'Pers',
    contact: 'Contact',
    footerLegal: 'Juridisch',
    terms: 'Gebruiksvoorwaarden',
    privacy: 'Privacybeleid',
    kvkk: 'AVG',
    cookies: 'Cookie-voorkeuren',
    copyright: '© 2024 LOKMA Platform. Alle rechten voorbehouden.',
    langSupport: 'Meertalige ondersteuning actief',
  },
};

// Countries with their default languages and flags
const countries = [
  { code: 'DE', name: 'Deutschland', flag: '🇩🇪', defaultLang: 'de' },
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷', defaultLang: 'tr' },
  { code: 'AT', name: 'Österreich', flag: '🇦🇹', defaultLang: 'de' },
  { code: 'CH', name: 'Schweiz', flag: '🇨🇭', defaultLang: 'de' },
  { code: 'NL', name: 'Nederland', flag: '🇳🇱', defaultLang: 'nl' },
  { code: 'BE', name: 'België', flag: '🇧🇪', defaultLang: 'nl' },
  { code: 'FR', name: 'France', flag: '🇫🇷', defaultLang: 'fr' },
  { code: 'IT', name: 'Italia', flag: '🇮🇹', defaultLang: 'it' },
  { code: 'ES', name: 'España', flag: '🇪🇸', defaultLang: 'es' },
  { code: 'MX', name: 'México', flag: '🇲🇽', defaultLang: 'es' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', defaultLang: 'en' },
  { code: 'US', name: 'United States', flag: '🇺🇸', defaultLang: 'en' },
];

const languages = [
  { code: 'tr', name: 'Türkçe', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'de', name: 'Deutsch', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Español', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'nl', name: 'Nederlands', nativeName: 'Nederlands', flag: '🇳🇱' },
];


export default function LandingPage() {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Refs for dropdown menus
  const countryRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  // Default to Turkish language, auto-detect country
  const [currentLang, setCurrentLang] = useState('tr');
  const [currentCountry, setCurrentCountry] = useState('DE');
  const [isLoading, setIsLoading] = useState(true);

  // Get translations
  const t = translations[currentLang] || translations.tr;

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(event.target as Node)) {
        setCountryMenuOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-detect country on mount
  useEffect(() => {
    const detectCountry = async () => {
      try {
        // Try to get country from browser timezone or IP
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.country_code) {
          const country = countries.find(c => c.code === data.country_code);
          if (country) {
            setCurrentCountry(data.country_code);
          }
        }
      } catch {
        // Default to Germany if detection fails
        setCurrentCountry('DE');
      } finally {
        setIsLoading(false);
      }
    };

    // Check localStorage first
    const savedLang = localStorage.getItem('lokma_lang');
    const savedCountry = localStorage.getItem('lokma_country');

    if (savedLang) setCurrentLang(savedLang);
    if (savedCountry) {
      setCurrentCountry(savedCountry);
      setIsLoading(false);
    } else {
      detectCountry();
    }
  }, []);

  // Save preferences
  const handleLangChange = (lang: string) => {
    setCurrentLang(lang);
    localStorage.setItem('lokma_lang', lang);
    setLangMenuOpen(false);
  };

  const handleCountryChange = (code: string) => {
    setCurrentCountry(code);
    localStorage.setItem('lokma_country', code);
    setCountryMenuOpen(false);
  };

  const currentCountryData = countries.find(c => c.code === currentCountry) || countries[0];
  const currentLangData = languages.find(l => l.code === currentLang) || languages[0];

  const categories = [
    { name: t.market, desc: t.marketDesc, href: '/categories/market', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEVs9F1p-MauF5eNVA5eYldgqFpE207b2eUycOdE0Uyr_CqLuTg-L8jHJfA2MapdFAsgKuscHd815tjfnDTb0r09kbgyUo0qCeV_pdArR78YGmWV4Ah7gImVt0eglMLTefRbnnIRHlc2Wn-DDBswILQM34KAG0dHhSBr_nGBf77YX0Tp8XJyygy72UBCsJr12piLHGPcsnKUZntLIaWwL5GnXuEDLIXEg8zJlj2wR0czCyrtkrN1k2av-KFNptTEM0FkAO2V7BkWk' },
    { name: t.butcher, desc: t.butcherDesc, href: '/categories/butcher', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArw-TkI2-SzpObLta2IQwojPsIP3VeIb78vV1IvBMdZe2dyV7_lQ3ejmcKzmRW_qI_AY3dvMowCaJQGjOBTWD__v0TJDuKOIWPMQUB0OByMsff8xDw_3EhTca9SfbfP2aljgaBfA5HWa9FksjyRI_XMnkZj809dOi1CSpn2bjA8lZKvZ0UvaPuMnrK2FkEINZ_l902_fWpxTpsjiv1SnxG9pTaUMr0fG6RwsJmdsGiQQ_wd17fZ4dUQnDkPF6aO50W4YikUgcgKcM' },
    { name: t.catering, desc: t.cateringDesc, href: '/categories/catering', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6p0c2Yu4v2xu5b5_oWKBYFUaEbjFub1JTnbRD4umr449cO38ryv7h55GzrDk5EYhI73-ZF9qzi0BKdtrFWNqP6hrJ0Yr1Tld8Gsz49uXLf29gGddlUathh8DkVu4Z6tL9DmIbOmLxnL52f1Am60XBC8bVmTMNjlly5mZag0jUEHS2-QYmGZSy6gOdZlAU3ip5UxbJFm7V5qs1OJLcvtMuDsQg-DRdLFtToh0woYl3NnQNO1G17fYm3TfZUOTYjBGGczhirbx-poE' },
    { name: t.florist, desc: t.floristDesc, href: '/categories/florist', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQpcy6BGPQ6eU9911vrabfP4EqYYFKxKc4mjpbRnbTrog2lUWY6g4emwly6xjlPYKn7lbIWK-R_1bHOG93YJmXJxgGskqSKnW-9Zb2S8t_t_x--ugIlPjsGEcZkjQVxXyqutg8pQ3HwjOgO8d_Wml9yG4ViXjFydYFeQHPMbxxr4tckWaitFQVMzRB1iTV1ogl1HU0HnO9Vo5nMoGLTYssJy72z8aB9WEtaIU6QJcFIpc7wShj7BVwvDySvDPwK3ih2a5o_OALWog' },
    { name: t.kermes, desc: t.kermesDesc, href: '/kermes', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCN09M8elc_C8OsSIqRq-4dpdi0B-qBOhsauyUuAp91K2z0i5sTqYiSW45WkV5wgkkse8HanK1NKfhP0vWQqKQ9_epsxzAdfWJC0I-ArkTqSakmgGaAJmggZCP49tE8O-2sb6ieERfa8FWONxW2CzC_UJqCjhWmydjDGGoSwurrb4PCXDMh-_Z2Kpau2YrdXVG99DoqL6hJ0d0BVQEN3K_6yopBcWsWfdzTZtz4slgoekRrrgG-KFEq6d6fCwpFay9xvuR37QDm_qk' },
    { name: t.dining, desc: t.diningDesc, href: '/categories/dining', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2Tm8hx8ZWjL9LUYjxUcedhtjUX68PIeLaZvkaT6nt9_NB6pVHJYBVlSFL-8o1dWUcMOlQaFkjCFI4-hFGy96FuZF1ESb8Bhbe7tDu3wq6DnBpK-6UOOu8k2LEjcZkLcsEMe7RlZFJGJk-ZlLqrUoK68i7Orf8PLMRTnJDyIWYxAxBBlJ97DWYt_nwAb74kA4wEUVBSmC6IbiyMjOUDjewpKHVse2j62g80G8XUYlZVQAj8Rlc77oPKcWs8yX6H8R0WL059U0n7X8' },
    { name: t.elLezzetleri, desc: t.elLezzetleriDesc, href: '/el-lezzetleri', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop' },
    { name: t.farmer, desc: t.farmerDesc, href: '/ciftciden', img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&h=300&fit=crop' },
  ];

  const benefits = [
    { icon: 'payments', title: t.fairCommission, desc: t.fairCommissionDesc },
    { icon: 'bolt', title: t.fastPayment, desc: t.fastPaymentDesc },
    { icon: 'groups', title: t.wideAudience, desc: t.wideAudienceDesc },
    { icon: 'verified', title: t.easyManagement, desc: t.easyManagementDesc },
  ];

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
  ];

  const scrollToCategories = () => {
    document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#120a0a] flex items-center justify-center">
        <div className="animate-pulse">
          <Image src="/lokma_logo.png" alt="LOKMA" width={80} height={80} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#120a0a] text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full bg-[#120a0a]/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-20 lg:px-40 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image src="/lokma_logo.png" alt="LOKMA" width={40} height={40} className="rounded-lg" />
            <h2 className="text-2xl font-extrabold tracking-tighter uppercase">LOKMA</h2>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link className="text-sm font-medium hover:text-[#fb335b] transition-colors" href="/">{t.home}</Link>
            <Link className="text-sm font-medium hover:text-[#fb335b] transition-colors" href="/about">{t.about}</Link>
            <Link className="text-sm font-medium hover:text-[#fb335b] transition-colors" href="/vendor">{t.vendorPortal}</Link>
            <Link className="text-sm font-medium hover:text-[#fb335b] transition-colors" href="/support">{t.support}</Link>
          </nav>

          <div className="flex items-center gap-3">
            {/* Unified Region & Language Selector */}
            <div className="relative" ref={countryRef}>
              <button
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-all border border-white/10"
                onClick={() => setCountryMenuOpen(!countryMenuOpen)}
              >
                <span className="text-lg">{currentCountryData.flag}</span>
                <span className="text-sm font-medium hidden sm:block">{currentLangData.name}</span>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
              {countryMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl">
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-[#fb335b]/10 to-transparent">
                    <h3 className="font-bold text-base">Bölge & Dil Ayarları</h3>
                    <p className="text-xs text-white/50 mt-1">Tercihlerinizi seçin</p>
                  </div>

                  <div className="p-4">
                    {/* Language Section */}
                    <div className="mb-5">
                      <label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px]">language</span>
                        Dil Seçin
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all text-left ${currentLang === lang.code
                              ? 'bg-[#fb335b]/20 border border-[#fb335b]/50 text-white'
                              : 'bg-white/5 hover:bg-white/10 border border-transparent'
                              }`}
                            onClick={() => handleLangChange(lang.code)}
                          >
                            <span className="text-base">{lang.flag}</span>
                            <span className="font-medium">{lang.name}</span>
                            {currentLang === lang.code && (
                              <span className="material-symbols-outlined text-[#fb335b] ml-auto text-[14px]">check_circle</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Country/Region Section */}
                    <div>
                      <label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px]">public</span>
                        Bölge / Ülke
                      </label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {countries.map((country) => (
                          <button
                            key={country.code}
                            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all text-left ${currentCountry === country.code
                              ? 'bg-[#fb335b]/20 border border-[#fb335b]/50 text-white'
                              : 'bg-white/5 hover:bg-white/10 border border-transparent'
                              }`}
                            onClick={() => handleCountryChange(country.code)}
                          >
                            <span className="text-base">{country.flag}</span>
                            <span className="font-medium truncate">{country.name}</span>
                            {currentCountry === country.code && (
                              <span className="material-symbols-outlined text-[#fb335b] ml-auto text-[14px] flex-shrink-0">check_circle</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 border-t border-white/10 bg-white/2">
                    <p className="text-xs text-white/40 text-center">
                      {currentCountryData.flag} {currentCountryData.name} • {currentLangData.name}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Link href="/login" className="hidden sm:flex bg-[#fb335b] hover:bg-red-600 px-5 py-2 rounded-lg text-sm font-bold transition-all">
              {t.login}
            </Link>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#120a0a] border-b border-white/10 p-4">
            <nav className="flex flex-col gap-4">
              <Link className="text-sm font-medium py-2" href="/">{t.home}</Link>
              <Link className="text-sm font-medium py-2" href="/about">{t.about}</Link>
              <Link className="text-sm font-medium py-2" href="/vendor">{t.vendorPortal}</Link>
              <Link className="text-sm font-medium py-2" href="/support">{t.support}</Link>
              <Link className="bg-[#fb335b] text-center py-3 rounded-lg font-bold" href="/login">{t.login}</Link>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#120a0a]/80 via-[#120a0a]/60 to-[#120a0a] z-10"></div>
          <div
            className="w-full h-full bg-cover bg-center scale-105"
            style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDxlIp_cD3tTcUm8UmL7N2cZGr6NZqZCJ7RasQV4R1B59JtwYF5moSxLKUhfuAOnjMNjfJO8TP77IfY4Aejq4ei3S6lHURkI5hp5WUFhkDsRxP2ecyP17Lwdk4VKiX1R0F7nbq6cYJIlYZ1KhBE-KzdUuD14p-x3rJkNNohha-fPWqb0IXnNIeA7Nqmsrh19-FCKclMewBfYiG6KQIziWAuCqaK4LBNzZzhVQOzdHqWijWivs5NQOILJAemBnnJNF_rfjiROKELPMI')` }}
          />
        </div>

        <div className="relative z-20 container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight drop-shadow-2xl">
              {t.heroTitle} <span className="text-[#fb335b] italic">{t.heroHighlight}</span> {t.heroTitleEnd}
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-medium">
              {t.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <button
                onClick={scrollToCategories}
                className="bg-[#fb335b] hover:bg-red-600 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-xl shadow-[#fb335b]/20 transition-all flex items-center justify-center gap-2"
              >
                {t.exploreBtn}
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <Link
                href="/partner"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all text-center"
              >
                {t.partnerBtn}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <main className="relative z-20 bg-[#120a0a] px-4 md:px-20 lg:px-40 pb-20">
        <section id="categories" className="max-w-[1200px] mx-auto py-20">
          <div className="flex items-end justify-between mb-10 px-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{t.discoverTitle}</h2>
              <p className="text-white/60 mt-2">{t.discoverSubtitle}</p>
            </div>
            <Link className="text-[#fb335b] font-bold flex items-center gap-1 group" href="/categories">
              {t.seeAll}
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">chevron_right</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
            {categories.map((cat) => (
              <Link key={cat.name} href={cat.href} className="group relative aspect-square overflow-hidden rounded-2xl cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10"></div>
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url('${cat.img}')` }}
                />
                <div className="absolute bottom-6 left-6 z-20">
                  <h3 className="text-2xl font-bold">{cat.name}</h3>
                  <p className="text-sm text-white/70">{cat.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* B2B Section */}
        <section className="max-w-[1200px] mx-auto py-20 px-4">
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col lg:flex-row items-stretch">
            <div className="flex-1 p-8 md:p-16 flex flex-col justify-center space-y-8">
              <div>
                <span className="inline-block bg-[#fb335b]/20 text-[#fb335b] px-4 py-1 rounded-full text-sm font-bold mb-4 tracking-wider uppercase">{t.b2bBadge}</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">{t.b2bTitle}</h2>
                <p className="text-white/60 text-lg mt-6 max-w-lg">
                  {t.b2bSubtitle}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {benefits.map((b) => (
                  <div key={b.title} className="flex items-start gap-4">
                    <div className="bg-[#fb335b]/20 p-2 rounded-lg text-[#fb335b]">
                      <span className="material-symbols-outlined">{b.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-bold">{b.title}</h4>
                      <p className="text-sm text-white/50">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link
                  href="/partner/apply"
                  className="inline-block bg-[#fb335b] hover:bg-red-600 text-white px-10 py-4 rounded-xl font-extrabold transition-all shadow-lg shadow-[#fb335b]/20"
                >
                  {t.applyNow}
                </Link>
              </div>
            </div>

            <div className="flex-1 min-h-[400px] relative overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center grayscale hover:grayscale-0 transition-all duration-1000"
                style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBwG1qu9yNk5CCFgEYc5ml_rZBG9Ou6Qi4r7WXK7qvpuS4qOearAQpUzF_D5jdrvJp1TvZLAE7-EO_jDKT-ccPj1bOOWMnCD649xi-fSk7S0BOLGk5mU804M2nZqlJY5Irlt5SEMoIf13Nfq3RIZzHflFPg9vZ6OREmPHJupw4Xwz0b6ta6QV807gp3w3F6fyk_RwVfCpM7f_Z57zCCl8cJ2untx8m_Sr68fvQPUtvlMALWNfgkwE39Aznvn1hFdAy0NipWx7Fn3Ew')` }}
              />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-[1200px] mx-auto py-20 px-4">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center mb-12">{t.faqTitle}</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-6 text-left"
                  onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                >
                  <span className="font-bold text-lg">{faq.q}</span>
                  <span className={`material-symbols-outlined transition-transform ${faqOpen === index ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {faqOpen === index && (
                  <div className="px-6 pb-6 text-white/70">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* App Download CTA */}
      <section className="py-16 px-4 md:px-20 lg:px-40 bg-gradient-to-b from-[#120a0a] to-[#0a0505]">
        <div className="max-w-[800px] mx-auto bg-gradient-to-br from-white/10 to-transparent border border-white/20 rounded-3xl p-8 md:p-12 text-center">
          <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="material-symbols-outlined text-[18px]">smartphone</span>
            Alışveriş Uygulamada
          </div>
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            <span className="text-[#fb335b]">LOKMA</span> Uygulamasını İndir
          </h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto text-lg">
            Tüm kategoriler, özel kampanyalar ve anlık teslimat takibi uygulamamızda.
            <span className="text-white font-medium"> Fresh. Fast. Local.</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="https://apps.apple.com/app/lokma" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="App Store'dan İndir"
                className="h-14"
              />
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.lokma.app" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Google Play'den İndir"
                className="h-14"
              />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0505] border-t border-white/5 py-12 px-4 md:px-20 lg:px-40">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/lokma_logo.png" alt="LOKMA" width={32} height={32} className="rounded-lg" />
              <h2 className="text-xl font-black tracking-tight">LOKMA</h2>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed">
              LOKMA, geleneksel ticaretin gücünü modern teknolojiyle birleştiren adil bir pazar yeridir.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold uppercase text-xs tracking-widest">{t.footerPlatform}</h4>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link className="hover:text-[#fb335b]" href="/how-it-works">{t.howItWorks}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/categories">{t.categories}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/popular">{t.popularShops}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/deals">{t.deals}</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold uppercase text-xs tracking-widest">{t.footerCorporate}</h4>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link className="hover:text-[#fb335b]" href="/about">{t.about}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/careers">{t.career}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/press">{t.press}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/contact">{t.contact}</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold uppercase text-xs tracking-widest">{t.footerLegal}</h4>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link className="hover:text-[#fb335b]" href="/terms">{t.terms}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/privacy">{t.privacy}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/kvkk">{t.kvkk}</Link></li>
              <li><Link className="hover:text-[#fb335b]" href="/cookies">{t.cookies}</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">{t.copyright}</p>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className="material-symbols-outlined text-[14px]">language</span>
            {languages.length} {t.langSupport}
          </div>
        </div>
      </footer>

      {/* Material Symbols Font */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    </div>
  );
}
