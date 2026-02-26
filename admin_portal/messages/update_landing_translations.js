const fs = require('fs');
const path = require('path');

const locales = ['de', 'en', 'es', 'fr', 'it', 'nl'];
const messagesDir = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/messages';

const translations = {
    de: {
        heroHighlight: "Vor deiner Tür.",
        heroSearchBtn: "Essen finden",
        heroSearchPlaceholder: "Lieferadresse eingeben...",
        heroSubtitle: "Bestelle bei den besten Restaurants in deiner Umgebung. Mit Lokma.shop unterstützt du nicht nur dich, sondern auch die lokalen Geschäfte.",
        heroTitle: "Deine Lieblingsgerichte",
        heroTitleEnd: "Und das fair für alle!",
        splitCourierBtn: "Fahrer werden",
        splitCourierDesc: "Arbeite mit flexiblen Zeiten, bestimme deinen eigenen Zeitplan und verdiene unter fairen Bedingungen als Teil der LOKMA-Familie.",
        splitCourierTitle: "Fahr mit uns, verdiene wann du willst!",
        splitPartnerBtn: "Als Restaurant registrieren",
        splitPartnerDesc: "Werde Teil von LOKMA, digitalisiere dich und erreiche Tausende neuer Kunden. Beginne mit niedrigen Provisionen und fairen Bedingungen zu verdienen.",
        splitPartnerTitle: "Erweitere dein Geschäft!",
        whyFairDesc: "Wir unterstützen unsere lokalen Geschäfte beim Wachsen, indem wir nur eine minimale Provision verlangen.",
        whyFairTitle: "Fair und Transparent",
        whyFastDesc: "Deine Bestellungen werden schnell und sicher von Kurieren aus deiner Nachbarschaft geliefert.",
        whyFastTitle: "Schnelle Lieferung",
        whyLokmaTitle: "Warum LOKMA?",
        whyWideDesc: "Vom Metzger bis zum Gemüsehändler, vom Floristen bis zum Restaurant – alle täglichen Bedürfnisse in einer App.",
        whyWideTitle: "Große Auswahl"
    },
    en: {
        heroHighlight: "At your door.",
        heroSearchBtn: "Find Food",
        heroSearchPlaceholder: "Enter delivery address...",
        heroSubtitle: "Order from the best restaurants in your area. With Lokma.shop, you support local businesses right on your street.",
        heroTitle: "Your Favorite Flavors",
        heroTitleEnd: "And merchant-friendly!",
        splitCourierBtn: "Become a Courier",
        splitCourierDesc: "Work with flexible hours, set your own schedule, and earn under fair conditions as a part of the LOKMA family.",
        splitCourierTitle: "Ride with us, earn anytime!",
        splitPartnerBtn: "Restaurant Registration",
        splitPartnerDesc: "Join LOKMA, digitize your business, and reach thousands of new customers. Start earning with low commissions and fair conditions.",
        splitPartnerTitle: "Grow your business!",
        whyFairDesc: "We support our local businesses by taking a minimum commission to help them grow.",
        whyFairTitle: "Fair and Transparent",
        whyFastDesc: "Your orders are delivered to your door quickly and securely by couriers from your neighborhood.",
        whyFastTitle: "Fast Delivery",
        whyLokmaTitle: "Why LOKMA?",
        whyWideDesc: "From the butcher to the greengrocer, from the florist to the restaurant – all your daily needs in one app.",
        whyWideTitle: "Wide Selection"
    },
    es: {
        heroHighlight: "A tu puerta.",
        heroSearchBtn: "Buscar Comida",
        heroSearchPlaceholder: "Ingresar dirección de entrega...",
        heroSubtitle: "Pide a los mejores restaurantes de tu zona. Con Lokma.shop, apoyas a los negocios locales en tu calle.",
        heroTitle: "Tus Sabores Favoritos",
        heroTitleEnd: "¡Y amigable con los comerciantes!",
        splitCourierBtn: "Conviértete en Repartidor",
        splitCourierDesc: "Trabaja con horarios flexibles, establece tu propio horario y gana bajo condiciones justas como parte de la familia LOKMA.",
        splitCourierTitle: "¡Conduce con nosotros, gana cuando quieras!",
        splitPartnerBtn: "Registro de Restaurante",
        splitPartnerDesc: "Únete a LOKMA, digitaliza tu negocio y llega a miles de nuevos clientes. Empieza a ganar con bajas comisiones y condiciones justas.",
        splitPartnerTitle: "¡Haz crecer tu negocio!",
        whyFairDesc: "Apoyamos a nuestros negocios locales cobrando una comisión mínima para ayudarlos a crecer.",
        whyFairTitle: "Justo y Transparente",
        whyFastDesc: "Tus pedidos son entregados en tu puerta de forma rápida y segura por repartidores de tu vecindario.",
        whyFastTitle: "Entrega Rápida",
        whyLokmaTitle: "¿Por qué LOKMA?",
        whyWideDesc: "Desde la carnicería a la frutería, de la floristería al restaurante: todas tus necesidades diarias en una sola aplicación.",
        whyWideTitle: "Amplia Selección"
    },
    fr: {
        heroHighlight: "À votre porte.",
        heroSearchBtn: "Trouver à manger",
        heroSearchPlaceholder: "Entrer l'adresse de livraison...",
        heroSubtitle: "Commandez dans les meilleurs restaurants de votre quartier. Avec Lokma.shop, vous soutenez les commerces locaux de votre rue.",
        heroTitle: "Vos Saveurs Préférées",
        heroTitleEnd: "Et solidaire des commerçants !",
        splitCourierBtn: "Devenir Livreur",
        splitCourierDesc: "Travaillez avec des horaires flexibles, définissez votre propre emploi du temps et gagnez équitablement en rejoignant la famille LOKMA.",
        splitCourierTitle: "Roulez avec nous, gagnez quand vous voulez !",
        splitPartnerBtn: "Inscription Restaurant",
        splitPartnerDesc: "Rejoignez LOKMA, digitalisez votre activité et touchez des milliers de nouveaux clients. Gagnez avec des commissions réduites et des conditions justes.",
        splitPartnerTitle: "Développez votre entreprise !",
        whyFairDesc: "Nous soutenons nos commerces locaux en prenant une commission minimale pour les aider à grandir.",
        whyFairTitle: "Juste et Transparent",
        whyFastDesc: "Vos commandes sont livrées rapidement et en toute sécurité par des livreurs de votre quartier.",
        whyFastTitle: "Livraison Rapide",
        whyLokmaTitle: "Pourquoi LOKMA ?",
        whyWideDesc: "Du boucher au primeur, du fleuriste au restaurant – tous vos besoins quotidiens dans une seule application.",
        whyWideTitle: "Large Sélection"
    },
    it: {
        heroHighlight: "Alla tua porta.",
        heroSearchBtn: "Trova Cibo",
        heroSearchPlaceholder: "Inserisci l'indirizzo di consegna...",
        heroSubtitle: "Ordina dai migliori ristoranti della tua zona. Con Lokma.shop sostieni i negozi locali della tua strada.",
        heroTitle: "I Tuoi Sapori Preferiti",
        heroTitleEnd: "E amico dei commercianti!",
        splitCourierBtn: "Diventa un Corriere",
        splitCourierDesc: "Lavora con orari flessibili, stabilisci il tuo programma e guadagna a condizioni eque come parte della famiglia LOKMA.",
        splitCourierTitle: "Guida con noi, guadagna quando vuoi!",
        splitPartnerBtn: "Registrazione Ristorante",
        splitPartnerDesc: "Unisciti a LOKMA, digitalizza il tuo business e raggiungi migliaia di nuovi clienti. Inizia a guadagnare con basse commissioni e condizioni eque.",
        splitPartnerTitle: "Fai crescere il tuo business!",
        whyFairDesc: "Sosteniamo i nostri negozi locali chiedendo una commissione minima per aiutarli a crescere.",
        whyFairTitle: "Equo e Trasparente",
        whyFastDesc: "I tuoi ordini vengono consegnati a casa tua in modo rapido e sicuro da corrieri del tuo quartiere.",
        whyFastTitle: "Consegna Rapida",
        whyLokmaTitle: "Perché LOKMA?",
        whyWideDesc: "Dal macellaio al fruttivendolo, dal fioraio al ristorante: tutte le tue necessità quotidiane in un'unica app.",
        whyWideTitle: "Ampia Selezione"
    },
    nl: {
        heroHighlight: "Aan je deur.",
        heroSearchBtn: "Vind Eten",
        heroSearchPlaceholder: "Voer bezorgadres in...",
        heroSubtitle: "Bestel bij de beste restaurants in de buurt. Met Lokma.shop steun je ook de lokale ondernemers in jouw straat.",
        heroTitle: "Je Favoriete Smaken",
        heroTitleEnd: "En vriendelijk voor ondernemers!",
        splitCourierBtn: "Word Koerier",
        splitCourierDesc: "Werk met flexibele tijden, bepaal je eigen schema en verdien onder eerlijke voorwaarden als onderdeel van de LOKMA familie.",
        splitCourierTitle: "Rijd met ons, verdien wanneer je wilt!",
        splitPartnerBtn: "Restaurant Registratie",
        splitPartnerDesc: "Word lid van LOKMA, digitaliseer je bedrijf en bereik duizenden nieuwe klanten. Begin met verdienen met lage commissies en eerlijke voorwaarden.",
        splitPartnerTitle: "Laat je bedrijf groeien!",
        whyFairDesc: "We steunen onze lokale ondernemers door een minimale commissie te vragen om ze te helpen groeien.",
        whyFairTitle: "Eerlijk en Transparant",
        whyFastDesc: "Je bestellingen worden snel en veilig aan je deur geleverd door koeriers uit je buurt.",
        whyFastTitle: "Snelle Levering",
        whyLokmaTitle: "Waarom LOKMA?",
        whyWideDesc: "Van de slager tot de groenteboer, van de bloemist tot het restaurant - al je dagelijkse behoeften in één app.",
        whyWideTitle: "Ruime Keuze"
    }
};

locales.forEach(loc => {
    const filePath = path.join(messagesDir, `${loc}.json`);
    if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        if (data.Landing) {
            data.Landing = { ...data.Landing, ...translations[loc] };

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            console.log(`Updated translations for ${loc}`);
        } else {
            console.log(`Landing section not found in ${loc}.json`);
        }
    } else {
        console.log(`File not found: ${loc}.json`);
    }
});
