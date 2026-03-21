'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

// Translations inline for vendor page (not yet in messages files)
const vendorTexts: Record<string, Record<string, string>> = {
    de: {
        heroTag: 'FÜR UNTERNEHMER',
        heroTitle: 'Ihr komplettes Geschäft.',
        heroHighlight: 'Digital.',
        heroSub: 'LOKMA bietet Ihnen alles aus einer Hand: POS-Kassensystem, digitale Preisschilder, Lieferdienst und Online-Shop – nahtlos integriert.',
        ctaApply: 'Jetzt Partner werden',
        ctaLearnMore: 'Mehr erfahren',
        ctaSub: '✓ Keine Einrichtungsgebühr · ✓ Faire Konditionen · ✓ Persönlicher Support',

        whyTitle: 'Warum LOKMA?',
        whySub: 'Die All-in-One Lösung für Ihr Geschäft',
        why1Title: 'Alles aus einer Hand',
        why1Desc: 'POS, ESL, Lieferung und Online-Shop – ein System, ein Ansprechpartner, keine Insellösungen.',
        why2Title: 'Faire Konditionen',
        why2Desc: 'Niedrige Provisionen ab 7% – bis zu 3x günstiger als Lieferando. Mehr Umsatz bleibt bei Ihnen.',
        why3Title: 'Echtzeit-Synchronisation',
        why3Desc: 'Preisänderungen am Kassensystem werden sofort auf den digitalen Preisschildern und im Online-Shop angezeigt.',
        why4Title: 'Eigene Kurierflotte',
        why4Desc: 'Zuverlässige Lieferung durch unsere eigenen Kuriere – oder nutzen Sie Ihre eigenen Fahrer.',
        why5Title: '24/7 Support',
        why5Desc: 'Persönlicher Ansprechpartner und technischer Support – wann immer Sie ihn brauchen.',
        why6Title: 'Analyse & Insights',
        why6Desc: 'Detaillierte Verkaufsanalysen, Kundenverhalten und Umsatzberichte in Echtzeit.',

        posTitle: 'Intelligentes Kassensystem',
        posSub: 'Professionelle POS-Terminals für jeden Bedarf – vom Desktop bis zum Handheld.',
        posF1: 'Touch-Display & integrierter Drucker',
        posF2: 'Echtzeit-Bestandsverwaltung',
        posF3: 'Anbindung an LOKMA Online-Shop',
        posF4: 'Kartenzahlung & kontaktlos',
        posLink: 'Alle POS-Geräte ansehen',

        eslTitle: 'Digitale Preisschilder (ESL)',
        eslSub: 'Elektronische Regaletiketten – Preise in Echtzeit aktualisieren, papierlos und fehlerfrei.',
        eslF1: 'Automatische Preis-Synchronisation',
        eslF2: 'E-Ink Display – jahrelang ohne Batterie',
        eslF3: 'Multi-Farb-Display für Aktionen',
        eslF4: 'NFC-fähig für Kundeninteraktion',
        eslLink: 'ESL-System entdecken',

        deliveryTitle: 'Lieferung & Logistik',
        deliverySub: 'Eigene Kurierflotte oder Ihre Fahrer – flexible Lieferoptionen für Ihr Geschäft.',
        deliveryF1: 'GPS-Tracking in Echtzeit',
        deliveryF2: 'Automatische Routenoptimierung',
        deliveryF3: 'Flexible Lieferzeiten',
        deliveryF4: 'Proof of Delivery mit Foto',
        deliveryLink: 'Mehr über Lieferung',

        statsTitle: 'Zahlen, die überzeugen',
        stat1: '500+',
        stat1Label: 'Partner-Geschäfte',
        stat2: '7%',
        stat2Label: 'Ab Provision',
        stat3: '<30 Min',
        stat3Label: 'Ø Lieferzeit',
        stat4: '99.9%',
        stat4Label: 'Uptime',

        stepsTitle: 'In 3 Schritten starten',
        step1Title: 'Registrieren',
        step1Desc: 'Füllen Sie das Formular aus – wir melden uns innerhalb von 24 Stunden.',
        step2Title: 'Einrichten',
        step2Desc: 'Wir installieren Ihr POS-System und richten Ihren Online-Shop ein.',
        step3Title: 'Loslegen',
        step3Desc: 'Verkaufen Sie online und im Geschäft – alles synchronisiert.',

        bottomCta: 'Bereit für die Digitalisierung?',
        bottomCtaSub: 'Starten Sie noch heute mit LOKMA und erreichen Sie Tausende neuer Kunden.',
        bottomCtaBtn: 'Kostenlos registrieren',
        loginLink: 'Bereits Handler? Hier einloggen',
        pricingLink: 'Preise ansehen',
    },
    tr: {
        heroTag: 'İŞLETMELER İÇİN',
        heroTitle: 'İşletmeniz. Komple.',
        heroHighlight: 'Dijital.',
        heroSub: 'LOKMA size hepsini bir arada sunar: POS kasa sistemi, dijital fiyat etiketleri, kurye hizmeti ve online mağaza – kusursuz entegrasyon.',
        ctaApply: 'Şimdi Partner Olun',
        ctaLearnMore: 'Daha fazla bilgi',
        ctaSub: '✓ Kurulum ücretsiz · ✓ Adil koşullar · ✓ Kişisel destek',

        whyTitle: 'Neden LOKMA?',
        whySub: 'İşletmeniz için tek elden çözüm',
        why1Title: 'Hepsi Bir Arada',
        why1Desc: 'POS, ESL, teslimat ve online mağaza – tek sistem, tek muhatap, ada çözümler yok.',
        why2Title: 'Adil Koşullar',
        why2Desc: '%7\'den başlayan komisyon – rakiplere göre 3 kat daha uygun. Kazancınız sizde kalır.',
        why3Title: 'Gerçek Zamanlı Senkronizasyon',
        why3Desc: 'Kasadaki fiyat değişiklikleri anında dijital etiketlerde ve online mağazada güncellenir.',
        why4Title: 'Kendi Kurye Filomuz',
        why4Desc: 'Güvenilir teslimat kendi kuryelerimizle – veya kendi sürücülerinizi kullanın.',
        why5Title: '7/24 Destek',
        why5Desc: 'Kişisel muhatap ve teknik destek – her zaman yanınızdayız.',
        why6Title: 'Analiz & Raporlar',
        why6Desc: 'Detaylı satış analizleri, müşteri davranışları ve ciro raporları gerçek zamanlı.',

        posTitle: 'Akıllı Kasa Sistemi',
        posSub: 'Her ihtiyaca uygun profesyonel POS terminalleri – masaüstünden elde taşınabilir modele.',
        posF1: 'Dokunmatik ekran & entegre yazıcı',
        posF2: 'Gerçek zamanlı stok yönetimi',
        posF3: 'LOKMA online mağaza entegrasyonu',
        posF4: 'Kart & temassız ödeme',
        posLink: 'Tüm POS cihazlarını görüntüle',

        eslTitle: 'Dijital Fiyat Etiketleri (ESL)',
        eslSub: 'Elektronik raf etiketleri – fiyatları gerçek zamanlı güncelleyin, kağıtsız ve hatasız.',
        eslF1: 'Otomatik fiyat senkronizasyonu',
        eslF2: 'E-Ink ekran – yıllarca pil gerektirmez',
        eslF3: 'Kampanyalar için çok renkli ekran',
        eslF4: 'Müşteri etkileşimi için NFC',
        eslLink: 'ESL sistemini keşfedin',

        deliveryTitle: 'Teslimat & Lojistik',
        deliverySub: 'Kendi kurye filomuz veya sizin şoförleriniz – esnek teslimat seçenekleri.',
        deliveryF1: 'Gerçek zamanlı GPS takip',
        deliveryF2: 'Otomatik rota optimizasyonu',
        deliveryF3: 'Esnek teslimat süreleri',
        deliveryF4: 'Fotoğraflı teslimat kanıtı',
        deliveryLink: 'Teslimat hakkında daha fazla',

        statsTitle: 'İkna eden rakamlar',
        stat1: '500+',
        stat1Label: 'Partner İşletme',
        stat2: '%7',
        stat2Label: 'Komisyon',
        stat3: '<30 Dk',
        stat3Label: 'Ø Teslimat',
        stat4: '%99.9',
        stat4Label: 'Çalışma süresi',

        stepsTitle: '3 Adımda Başlayın',
        step1Title: 'Kaydolun',
        step1Desc: 'Formu doldurun – 24 saat içinde size ulaşalım.',
        step2Title: 'Kurulum',
        step2Desc: 'POS sisteminizi kurar, online mağazanızı hazırlarız.',
        step3Title: 'Başlayın',
        step3Desc: 'Online ve mağazada satın – hepsi senkronize.',

        bottomCta: 'Dijitalleşmeye hazır mısınız?',
        bottomCtaSub: 'LOKMA ile bugun baslayin ve binlerce yeni musteriye ulasin.',
        bottomCtaBtn: 'Ucretsiz kaydolun',
        loginLink: 'Zaten uye misiniz? Giris yapin',
        pricingLink: 'Fiyatlari goruntuleyun',
    },
    en: {
        heroTag: 'FOR BUSINESSES',
        heroTitle: 'Your complete business.',
        heroHighlight: 'Digital.',
        heroSub: 'LOKMA offers everything from one source: POS system, digital price tags, delivery service and online shop – seamlessly integrated.',
        ctaApply: 'Become a Partner',
        ctaLearnMore: 'Learn more',
        ctaSub: '✓ No setup fee · ✓ Fair conditions · ✓ Personal support',

        whyTitle: 'Why LOKMA?',
        whySub: 'The all-in-one solution for your business',
        why1Title: 'All-in-One',
        why1Desc: 'POS, ESL, delivery and online shop – one system, one contact, no isolated solutions.',
        why2Title: 'Fair Conditions',
        why2Desc: 'Low commissions from 7% – up to 3x cheaper than competitors. More revenue stays with you.',
        why3Title: 'Real-Time Sync',
        why3Desc: 'Price changes at the register are instantly displayed on digital labels and in the online shop.',
        why4Title: 'Own Courier Fleet',
        why4Desc: 'Reliable delivery through our own couriers – or use your own drivers.',
        why5Title: '24/7 Support',
        why5Desc: 'Personal contact and technical support – whenever you need it.',
        why6Title: 'Analytics & Insights',
        why6Desc: 'Detailed sales analytics, customer behavior and revenue reports in real time.',

        posTitle: 'Smart POS System',
        posSub: 'Professional POS terminals for every need – from desktop to handheld.',
        posF1: 'Touchscreen & integrated printer',
        posF2: 'Real-time inventory management',
        posF3: 'LOKMA online shop integration',
        posF4: 'Card & contactless payments',
        posLink: 'View all POS devices',

        eslTitle: 'Digital Price Tags (ESL)',
        eslSub: 'Electronic shelf labels – update prices in real time, paperless and error-free.',
        eslF1: 'Automatic price synchronization',
        eslF2: 'E-Ink display – years without battery change',
        eslF3: 'Multi-color display for promotions',
        eslF4: 'NFC-enabled for customer interaction',
        eslLink: 'Discover ESL system',

        deliveryTitle: 'Delivery & Logistics',
        deliverySub: 'Our courier fleet or your drivers – flexible delivery options for your business.',
        deliveryF1: 'Real-time GPS tracking',
        deliveryF2: 'Automatic route optimization',
        deliveryF3: 'Flexible delivery times',
        deliveryF4: 'Photo proof of delivery',
        deliveryLink: 'More about delivery',

        statsTitle: 'Numbers that convince',
        stat1: '500+',
        stat1Label: 'Partner Businesses',
        stat2: '7%',
        stat2Label: 'From Commission',
        stat3: '<30 Min',
        stat3Label: 'Ø Delivery',
        stat4: '99.9%',
        stat4Label: 'Uptime',

        stepsTitle: 'Start in 3 Steps',
        step1Title: 'Register',
        step1Desc: 'Fill out the form – we\'ll get back to you within 24 hours.',
        step2Title: 'Setup',
        step2Desc: 'We install your POS system and set up your online shop.',
        step3Title: 'Go Live',
        step3Desc: 'Sell online and in-store – everything synchronized.',

        bottomCta: 'Ready for digitalization?',
        bottomCtaSub: 'Start with LOKMA today and reach thousands of new customers.',
        bottomCtaBtn: 'Register for free',
        pricingLink: 'View Pricing',
        loginLink: 'Already a partner? Log in here',
    },
    fr: {
        heroTag: 'POUR LES ENTREPRISES',
        heroTitle: 'Votre commerce complet.',
        heroHighlight: 'Numérique.',
        heroSub: 'LOKMA vous offre tout en un : système de caisse POS, étiquettes de prix numériques, service de livraison et boutique en ligne – parfaitement intégrés.',
        ctaApply: 'Devenir partenaire',
        ctaLearnMore: 'En savoir plus',
        ctaSub: '✓ Pas de frais d\'installation · ✓ Conditions équitables · ✓ Support personnel',
        whyTitle: 'Pourquoi LOKMA ?',
        whySub: 'La solution tout-en-un pour votre commerce',
        why1Title: 'Tout-en-un',
        why1Desc: 'POS, ESL, livraison et boutique en ligne – un seul système, un seul interlocuteur, pas de solutions isolées.',
        why2Title: 'Conditions équitables',
        why2Desc: 'Commissions basses à partir de 7% – jusqu\'à 3x moins cher que les concurrents. Plus de revenus restent chez vous.',
        why3Title: 'Synchronisation en temps réel',
        why3Desc: 'Les changements de prix à la caisse s\'affichent instantanément sur les étiquettes numériques et dans la boutique en ligne.',
        why4Title: 'Propre flotte de coursiers',
        why4Desc: 'Livraison fiable par nos propres coursiers – ou utilisez vos propres chauffeurs.',
        why5Title: 'Support 24/7',
        why5Desc: 'Interlocuteur personnel et support technique – chaque fois que vous en avez besoin.',
        why6Title: 'Analyses & Insights',
        why6Desc: 'Analyses de ventes détaillées, comportement client et rapports de revenus en temps réel.',
        posTitle: 'Système de caisse intelligent',
        posSub: 'Terminaux POS professionnels pour tous les besoins – du bureau au portable.',
        posF1: 'Écran tactile & imprimante intégrée',
        posF2: 'Gestion des stocks en temps réel',
        posF3: 'Intégration boutique en ligne LOKMA',
        posF4: 'Paiement par carte & sans contact',
        posLink: 'Voir tous les dispositifs POS',
        eslTitle: 'Étiquettes de prix numériques (ESL)',
        eslSub: 'Étiquettes électroniques – mettez à jour les prix en temps réel, sans papier et sans erreur.',
        eslF1: 'Synchronisation automatique des prix',
        eslF2: 'Écran E-Ink – des années sans changer la batterie',
        eslF3: 'Écran multi-couleurs pour les promotions',
        eslF4: 'NFC pour l\'interaction client',
        eslLink: 'Découvrir le système ESL',
        deliveryTitle: 'Livraison & Logistique',
        deliverySub: 'Notre flotte ou vos chauffeurs – options de livraison flexibles pour votre commerce.',
        deliveryF1: 'Suivi GPS en temps réel',
        deliveryF2: 'Optimisation automatique des itinéraires',
        deliveryF3: 'Horaires de livraison flexibles',
        deliveryF4: 'Preuve de livraison par photo',
        deliveryLink: 'En savoir plus sur la livraison',
        statsTitle: 'Des chiffres convaincants',
        stat1: '500+', stat1Label: 'Commerces partenaires',
        stat2: '7%', stat2Label: 'À partir de commission',
        stat3: '<30 Min', stat3Label: 'Ø Livraison',
        stat4: '99.9%', stat4Label: 'Disponibilité',
        stepsTitle: 'Démarrez en 3 étapes',
        step1Title: 'Inscrivez-vous', step1Desc: 'Remplissez le formulaire – nous vous répondons dans les 24 heures.',
        step2Title: 'Configuration', step2Desc: 'Nous installons votre système POS et configurons votre boutique en ligne.',
        step3Title: 'C\'est parti', step3Desc: 'Vendez en ligne et en magasin – tout est synchronisé.',
        bottomCta: 'Prêt pour la numérisation ?',
        bottomCtaSub: 'Commencez avec LOKMA des aujourd\'hui et atteignez des milliers de nouveaux clients.',
        bottomCtaBtn: 'S\'inscrire gratuitement',
        pricingLink: 'Voir les tarifs',
        loginLink: 'Deja partenaire ? Connectez-vous ici',
    },
    it: {
        heroTag: 'PER LE AZIENDE',
        heroTitle: 'Il tuo business completo.',
        heroHighlight: 'Digitale.',
        heroSub: 'LOKMA ti offre tutto in uno: sistema POS, etichette digitali, servizio di consegna e negozio online – perfettamente integrati.',
        ctaApply: 'Diventa partner',
        ctaLearnMore: 'Scopri di più',
        ctaSub: '✓ Nessun costo di installazione · ✓ Condizioni eque · ✓ Supporto personale',
        whyTitle: 'Perché LOKMA?',
        whySub: 'La soluzione all-in-one per il tuo business',
        why1Title: 'Tutto in uno',
        why1Desc: 'POS, ESL, consegna e negozio online – un sistema, un referente, nessuna soluzione isolata.',
        why2Title: 'Condizioni eque',
        why2Desc: 'Commissioni basse dal 7% – fino a 3 volte più economico dei concorrenti. Più ricavi restano a te.',
        why3Title: 'Sincronizzazione in tempo reale',
        why3Desc: 'Le modifiche di prezzo alla cassa vengono mostrate istantaneamente sulle etichette digitali e nel negozio online.',
        why4Title: 'Flotta corrieri propria',
        why4Desc: 'Consegna affidabile con i nostri corrieri – o usa i tuoi autisti.',
        why5Title: 'Supporto 24/7',
        why5Desc: 'Referente personale e supporto tecnico – ogni volta che ne hai bisogno.',
        why6Title: 'Analisi & Report',
        why6Desc: 'Analisi vendite dettagliate, comportamento clienti e report ricavi in tempo reale.',
        posTitle: 'Sistema POS intelligente',
        posSub: 'Terminali POS professionali per ogni esigenza – dal desktop al portatile.',
        posF1: 'Touchscreen e stampante integrata',
        posF2: 'Gestione inventario in tempo reale',
        posF3: 'Integrazione negozio online LOKMA',
        posF4: 'Pagamento con carta e contactless',
        posLink: 'Vedi tutti i dispositivi POS',
        eslTitle: 'Etichette prezzo digitali (ESL)',
        eslSub: 'Etichette elettroniche – aggiorna i prezzi in tempo reale, senza carta e senza errori.',
        eslF1: 'Sincronizzazione automatica dei prezzi',
        eslF2: 'Display E-Ink – anni senza cambio batteria',
        eslF3: 'Display multi-colore per promozioni',
        eslF4: 'NFC per interazione con il cliente',
        eslLink: 'Scopri il sistema ESL',
        deliveryTitle: 'Consegna & Logistica',
        deliverySub: 'La nostra flotta o i tuoi autisti – opzioni di consegna flessibili per il tuo business.',
        deliveryF1: 'Tracking GPS in tempo reale',
        deliveryF2: 'Ottimizzazione automatica dei percorsi',
        deliveryF3: 'Orari di consegna flessibili',
        deliveryF4: 'Prova di consegna con foto',
        deliveryLink: 'Scopri di più sulla consegna',
        statsTitle: 'Numeri che convincono',
        stat1: '500+', stat1Label: 'Attività partner',
        stat2: '7%', stat2Label: 'Da commissione',
        stat3: '<30 Min', stat3Label: 'Ø Consegna',
        stat4: '99.9%', stat4Label: 'Uptime',
        stepsTitle: 'Inizia in 3 passi',
        step1Title: 'Registrati', step1Desc: 'Compila il modulo – ti rispondiamo entro 24 ore.',
        step2Title: 'Configurazione', step2Desc: 'Installiamo il tuo sistema POS e configuriamo il tuo negozio online.',
        step3Title: 'Via!', step3Desc: 'Vendi online e in negozio – tutto sincronizzato.',
        bottomCta: 'Pronto per la digitalizzazione?',
        bottomCtaSub: 'Inizia con LOKMA oggi e raggiungi migliaia di nuovi clienti.',
        bottomCtaBtn: 'Registrati gratis',
        pricingLink: 'Vedi i prezzi',
        loginLink: 'Gia partner? Accedi qui',
    },
    es: {
        heroTag: 'PARA EMPRESAS',
        heroTitle: 'Tu negocio completo.',
        heroHighlight: 'Digital.',
        heroSub: 'LOKMA te ofrece todo en uno: sistema POS, etiquetas de precio digitales, servicio de entrega y tienda online – perfectamente integrados.',
        ctaApply: 'Ser socio',
        ctaLearnMore: 'Más información',
        ctaSub: '✓ Sin coste de instalación · ✓ Condiciones justas · ✓ Soporte personalizado',
        whyTitle: '¿Por qué LOKMA?',
        whySub: 'La solución todo en uno para tu negocio',
        why1Title: 'Todo en uno',
        why1Desc: 'POS, ESL, entrega y tienda online – un sistema, un contacto, sin soluciones aisladas.',
        why2Title: 'Condiciones justas',
        why2Desc: 'Comisiones bajas desde el 7% – hasta 3 veces más barato que la competencia. Más ingresos se quedan contigo.',
        why3Title: 'Sincronización en tiempo real',
        why3Desc: 'Los cambios de precio en la caja se muestran al instante en las etiquetas digitales y en la tienda online.',
        why4Title: 'Flota de mensajeros propia',
        why4Desc: 'Entrega fiable con nuestros propios mensajeros – o usa tus propios conductores.',
        why5Title: 'Soporte 24/7',
        why5Desc: 'Contacto personal y soporte técnico – siempre que lo necesites.',
        why6Title: 'Análisis e Informes',
        why6Desc: 'Análisis de ventas detallados, comportamiento del cliente e informes de ingresos en tiempo real.',
        posTitle: 'Sistema POS inteligente',
        posSub: 'Terminales POS profesionales para cada necesidad – de escritorio a portátil.',
        posF1: 'Pantalla táctil e impresora integrada',
        posF2: 'Gestión de inventario en tiempo real',
        posF3: 'Integración tienda online LOKMA',
        posF4: 'Pago con tarjeta y sin contacto',
        posLink: 'Ver todos los dispositivos POS',
        eslTitle: 'Etiquetas de precio digitales (ESL)',
        eslSub: 'Etiquetas electrónicas – actualiza precios en tiempo real, sin papel y sin errores.',
        eslF1: 'Sincronización automática de precios',
        eslF2: 'Pantalla E-Ink – años sin cambio de batería',
        eslF3: 'Pantalla multicolor para promociones',
        eslF4: 'NFC para interacción con el cliente',
        eslLink: 'Descubre el sistema ESL',
        deliveryTitle: 'Entrega y Logística',
        deliverySub: 'Nuestra flota o tus conductores – opciones de entrega flexibles para tu negocio.',
        deliveryF1: 'Rastreo GPS en tiempo real',
        deliveryF2: 'Optimización automática de rutas',
        deliveryF3: 'Horarios de entrega flexibles',
        deliveryF4: 'Prueba de entrega con foto',
        deliveryLink: 'Más sobre entregas',
        statsTitle: 'Cifras que convencen',
        stat1: '500+', stat1Label: 'Negocios asociados',
        stat2: '7%', stat2Label: 'Desde comisión',
        stat3: '<30 Min', stat3Label: 'Ø Entrega',
        stat4: '99.9%', stat4Label: 'Disponibilidad',
        stepsTitle: 'Empieza en 3 pasos',
        step1Title: 'Regístrate', step1Desc: 'Rellena el formulario – te respondemos en 24 horas.',
        step2Title: 'Configuración', step2Desc: 'Instalamos tu sistema POS y configuramos tu tienda online.',
        step3Title: '¡A vender!', step3Desc: 'Vende online y en tienda – todo sincronizado.',
        bottomCta: '¿Listo para la digitalización?',
        bottomCtaSub: 'Empieza con LOKMA hoy y alcanza a miles de nuevos clientes.',
        bottomCtaBtn: 'Registrarse gratis',
        pricingLink: 'Ver precios',
        loginLink: 'Ya eres socio? Inicia sesion aqui',
    },
    nl: {
        heroTag: 'VOOR BEDRIJVEN',
        heroTitle: 'Uw complete bedrijf.',
        heroHighlight: 'Digitaal.',
        heroSub: 'LOKMA biedt u alles uit een hand: POS-kassasysteem, digitale prijskaartjes, bezorgservice en online winkel – naadloos geintegreerd.',
        ctaApply: 'Word partner',
        ctaLearnMore: 'Meer informatie',
        ctaSub: '\u2713 Geen installatiekosten \u00b7 \u2713 Eerlijke voorwaarden \u00b7 \u2713 Persoonlijke ondersteuning',
        whyTitle: 'Waarom LOKMA?',
        whySub: 'De alles-in-een oplossing voor uw bedrijf',
        why1Title: 'Alles-in-een',
        why1Desc: 'POS, ESL, bezorging en online winkel – een systeem, een contactpersoon, geen geisoleerde oplossingen.',
        why2Title: 'Eerlijke voorwaarden',
        why2Desc: 'Lage commissies vanaf 7% – tot 3x goedkoper dan concurrenten. Meer omzet blijft bij u.',
        why3Title: 'Realtime synchronisatie',
        why3Desc: 'Prijswijzigingen aan de kassa worden direct weergegeven op digitale etiketten en in de online winkel.',
        why4Title: 'Eigen koeiersvloot',
        why4Desc: 'Betrouwbare bezorging door onze eigen koeriers – of gebruik uw eigen chauffeurs.',
        why5Title: '24/7 Ondersteuning',
        why5Desc: 'Persoonlijk contactpersoon en technische ondersteuning – wanneer u het nodig heeft.',
        why6Title: 'Analyse en Inzichten',
        why6Desc: 'Gedetailleerde verkoopanalyses, klantgedrag en omzetrapporten in realtime.',
        posTitle: 'Slim kassasysteem',
        posSub: 'Professionele POS-terminals voor elke behoefte – van desktop tot handheld.',
        posF1: 'Touchscreen en geintegreerde printer',
        posF2: 'Realtime voorraadbeheer',
        posF3: 'LOKMA online winkel integratie',
        posF4: 'Kaart- en contactloos betalen',
        posLink: 'Bekijk alle POS-apparaten',
        eslTitle: 'Digitale prijskaartjes (ESL)',
        eslSub: 'Elektronische schapetiketten – prijzen in realtime bijwerken, papierloos en foutloos.',
        eslF1: 'Automatische prijssynchronisatie',
        eslF2: 'E-Ink display – jarenlang zonder batterijwissel',
        eslF3: 'Meerkleurendisplay voor acties',
        eslF4: 'NFC-geschikt voor klantinteractie',
        eslLink: 'ESL-systeem ontdekken',
        deliveryTitle: 'Bezorging en Logistiek',
        deliverySub: 'Onze koeiersvloot of uw chauffeurs – flexibele bezorgopties voor uw bedrijf.',
        deliveryF1: 'Realtime GPS-tracking',
        deliveryF2: 'Automatische route-optimalisatie',
        deliveryF3: 'Flexibele bezorgtijden',
        deliveryF4: 'Bewijs van bezorging met foto',
        deliveryLink: 'Meer over bezorging',
        statsTitle: 'Overtuigende cijfers',
        stat1: '500+', stat1Label: 'Partnerbedrijven',
        stat2: '7%', stat2Label: 'Vanaf commissie',
        stat3: '<30 Min', stat3Label: '\u00d8 Bezorging',
        stat4: '99.9%', stat4Label: 'Uptime',
        stepsTitle: 'Start in 3 stappen',
        step1Title: 'Registreer', step1Desc: 'Vul het formulier in – we nemen binnen 24 uur contact met u op.',
        step2Title: 'Installatie', step2Desc: 'Wij installeren uw POS-systeem en richten uw online winkel in.',
        step3Title: 'Aan de slag', step3Desc: 'Verkoop online en in de winkel – alles gesynchroniseerd.',
        bottomCta: 'Klaar voor digitalisering?',
        bottomCtaSub: 'Begin vandaag met LOKMA en bereik duizenden nieuwe klanten.',
        bottomCtaBtn: 'Gratis registreren',
        pricingLink: 'Prijzen bekijken',
        loginLink: 'Al partner? Log hier in',
    },
};

export default function VendorPage() {
    const locale = useLocale();
    const tx = vendorTexts[locale] || vendorTexts['de'];

    const advantages = [
        { icon: 'hub', title: tx.why1Title, desc: tx.why1Desc },
        { icon: 'handshake', title: tx.why2Title, desc: tx.why2Desc },
        { icon: 'sync', title: tx.why3Title, desc: tx.why3Desc },
        { icon: 'local_shipping', title: tx.why4Title, desc: tx.why4Desc },
        { icon: 'support_agent', title: tx.why5Title, desc: tx.why5Desc },
        { icon: 'analytics', title: tx.why6Title, desc: tx.why6Desc },
    ];

    const stats = [
        { value: tx.stat1, label: tx.stat1Label },
        { value: tx.stat2, label: tx.stat2Label },
        { value: tx.stat3, label: tx.stat3Label },
        { value: tx.stat4, label: tx.stat4Label },
    ];

    const steps = [
        { num: '01', title: tx.step1Title, desc: tx.step1Desc, icon: 'edit_note' },
        { num: '02', title: tx.step2Title, desc: tx.step2Desc, icon: 'build' },
        { num: '03', title: tx.step3Title, desc: tx.step3Desc, icon: 'rocket_launch' },
    ];

    return (
        <div className="relative flex min-h-screen flex-col bg-white text-gray-900 font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={false} />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#fb335b]/5 rounded-full blur-[120px]" />
                    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
                    <div className="text-center">
                        <span className="inline-flex items-center gap-2 bg-[#fb335b]/10 text-[#fb335b] px-5 py-2 rounded-full text-sm font-bold mb-8 tracking-widest uppercase border border-[#fb335b]/20">
                            <span className="material-symbols-outlined text-[18px]">storefront</span>
                            {tx.heroTag}
                        </span>

                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight mb-8">
                            {tx.heroTitle}<br />
                            <span className="bg-gradient-to-r from-[#fb335b] to-[#ff6b6b] bg-clip-text text-transparent">{tx.heroHighlight}</span>
                        </h1>

                        <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto mb-12 leading-relaxed">
                            {tx.heroSub}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                            <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-[#fb335b] hover:bg-red-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-[#fb335b]/25 transition-all hover:scale-105 active:scale-95">
                                {tx.ctaApply}
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </Link>
                            <Link href="#features" className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-900 px-10 py-4 rounded-2xl font-bold text-lg transition-all">
                                {tx.ctaLearnMore}
                                <span className="material-symbols-outlined text-[18px]">expand_more</span>
                            </Link>
                            <Link href="/vendor/pricing" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border-2 border-[#fb335b]/30 text-[#fb335b] px-10 py-4 rounded-2xl font-bold text-lg transition-all hover:border-[#fb335b]">
                                <span className="material-symbols-outlined text-[18px]">payments</span>
                                {tx.pricingLink}
                            </Link>
                        </div>
                        <p className="text-gray-400 text-sm font-medium mb-4">{tx.ctaSub}</p>
                        <Link href="/login" className="inline-flex items-center gap-2 text-gray-500 hover:text-[#fb335b] text-sm font-medium transition-colors">
                            <span className="material-symbols-outlined text-[16px]">login</span>
                            {tx.loginLink}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="relative z-10 py-8 border-y border-gray-100 bg-gray-50">
                <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="text-3xl md:text-4xl font-black text-[#fb335b]">{s.value}</div>
                            <div className="text-sm text-gray-500 font-medium mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Why LOKMA */}
            <section id="features" className="py-24 px-4 md:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{tx.whyTitle}</h2>
                        <p className="text-gray-500 text-lg">{tx.whySub}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {advantages.map((a, i) => (
                            <div key={i} className="group bg-gray-50 border border-gray-200 hover:border-[#fb335b]/30 p-8 rounded-2xl transition-all duration-300 hover:-translate-y-1">
                                <div className="w-14 h-14 bg-[#fb335b]/10 text-[#fb335b] rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">{a.icon}</span>
                                </div>
                                <h3 className="text-xl font-bold mb-3">{a.title}</h3>
                                <p className="text-gray-500 leading-relaxed">{a.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* POS System */}
            <section className="py-24 px-4 md:px-8 bg-gradient-to-b from-transparent via-gray-50 to-transparent">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="inline-flex items-center gap-2 text-[#fb335b] text-sm font-bold uppercase tracking-widest mb-6">
                                <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                                POS System
                            </span>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{tx.posTitle}</h2>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">{tx.posSub}</p>
                            <ul className="space-y-4 mb-10">
                                {[tx.posF1, tx.posF2, tx.posF3, tx.posF4].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700">
                                        <span className="w-6 h-6 bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/hardware" className="inline-flex items-center gap-2 text-[#fb335b] font-bold hover:underline">
                                {tx.posLink} <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </Link>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#fb335b]/5 to-purple-500/5 rounded-3xl blur-xl" />
                            <div className="relative bg-gray-50 border border-gray-200 rounded-3xl p-8 overflow-hidden">
                                <Image src="/images/hardware/sunmi_d3_pro_1.jpg" alt="POS Terminal" width={500} height={400} className="rounded-2xl w-full h-auto object-cover" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ESL System */}
            <section className="py-24 px-4 md:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1 relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-3xl blur-xl" />
                            <div className="relative bg-gray-50 border border-gray-200 rounded-3xl p-8 overflow-hidden">
                                <Image src="/images/hardware/esl_market_fruits.jpg" alt="ESL Digital Labels" width={500} height={400} className="rounded-2xl w-full h-auto object-cover" />
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <span className="inline-flex items-center gap-2 text-blue-600 text-sm font-bold uppercase tracking-widest mb-6">
                                <span className="material-symbols-outlined text-[18px]">price_change</span>
                                ESL Technology
                            </span>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{tx.eslTitle}</h2>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">{tx.eslSub}</p>
                            <ul className="space-y-4 mb-10">
                                {[tx.eslF1, tx.eslF2, tx.eslF3, tx.eslF4].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700">
                                        <span className="w-6 h-6 bg-blue-500/20 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/hardware" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline">
                                {tx.eslLink} <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Delivery & Logistics */}
            <section className="py-24 px-4 md:px-8 bg-gradient-to-b from-transparent via-gray-50 to-transparent">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="inline-flex items-center gap-2 text-emerald-600 text-sm font-bold uppercase tracking-widest mb-6">
                                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                                Delivery
                            </span>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{tx.deliveryTitle}</h2>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">{tx.deliverySub}</p>
                            <ul className="space-y-4 mb-10">
                                {[tx.deliveryF1, tx.deliveryF2, tx.deliveryF3, tx.deliveryF4].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700">
                                        <span className="w-6 h-6 bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/kurye" className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:underline">
                                {tx.deliveryLink} <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </Link>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-3xl blur-xl" />
                            <div className="relative bg-gray-50 border border-gray-200 rounded-3xl p-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                                        <span className="material-symbols-outlined text-4xl text-emerald-600 mb-3 block">gps_fixed</span>
                                        <p className="text-sm text-gray-500">{tx.deliveryF1}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                                        <span className="material-symbols-outlined text-4xl text-emerald-600 mb-3 block">route</span>
                                        <p className="text-sm text-gray-500">{tx.deliveryF2}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                                        <span className="material-symbols-outlined text-4xl text-emerald-600 mb-3 block">schedule</span>
                                        <p className="text-sm text-gray-500">{tx.deliveryF3}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
                                        <span className="material-symbols-outlined text-4xl text-emerald-600 mb-3 block">photo_camera</span>
                                        <p className="text-sm text-gray-500">{tx.deliveryF4}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Steps */}
            <section className="py-24 px-4 md:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{tx.stepsTitle}</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {steps.map((step, i) => (
                            <div key={i} className="relative group text-center">
                                {i < steps.length - 1 && (
                                    <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-gray-200 to-transparent z-0" />
                                )}
                                <div className="relative z-10">
                                    <div className="w-24 h-24 mx-auto mb-6 bg-[#fb335b]/10 border-2 border-[#fb335b]/20 group-hover:border-[#fb335b] rounded-2xl flex items-center justify-center transition-all duration-300">
                                        <span className="material-symbols-outlined text-4xl text-[#fb335b]">{step.icon}</span>
                                    </div>
                                    <div className="text-[#fb335b] font-black text-sm mb-3 tracking-widest">{step.num}</div>
                                    <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                                    <p className="text-gray-500">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="py-24 px-4 md:px-8">
                <div className="max-w-4xl mx-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#fb335b]/10 to-purple-500/10 rounded-3xl blur-xl" />
                    <div className="relative bg-gradient-to-br from-[#fb335b]/5 to-purple-500/5 border border-gray-200 rounded-3xl p-12 md:p-16 text-center">
                        <h2 className="text-4xl md:text-5xl font-black mb-6">{tx.bottomCta}</h2>
                        <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">{tx.bottomCtaSub}</p>
                        <Link href="/partner/apply" className="inline-flex items-center justify-center gap-3 bg-[#fb335b] hover:bg-red-600 text-white px-12 py-5 rounded-2xl font-bold text-xl shadow-2xl shadow-[#fb335b]/25 transition-all hover:scale-105 active:scale-95">
                            {tx.bottomCtaBtn}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            </section>

            <PublicFooter themeAware={false} />
        </div>
    );
}
