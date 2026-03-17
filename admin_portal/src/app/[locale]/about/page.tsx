'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        title: 'Über uns',
        intro: 'LOKMA ist eine innovative Plattform, die 2024 in Deutschland gegründet wurde und lokale Händler mit der digitalen Welt verbindet.',
        missionTitle: 'Unsere Mission',
        mission: 'Die Kraft des traditionellen Handels mit moderner Technologie zu vereinen und einen fairen, transparenten Marktplatz zu schaffen. Dafür zu sorgen, dass unsere Händler den verdienten Lohn für ihre Arbeit erhalten.',
        visionTitle: 'Unsere Vision',
        vision: 'Ein nachhaltiges, gemeinschaftsorientiertes digitales Ökosystem aufzubauen, das lokale Händler in ganz Europa unterstützt.',
        valuesTitle: 'Unsere Werte',
        v1: 'Fairness', v1d: 'Wir schützen die Einnahmen der Händler mit den niedrigsten Provisionsraten der Branche.',
        v2: 'Transparenz', v2d: 'Keine versteckten Gebühren, keine komplizierten Verträge. Alles offen und klar.',
        v3: 'Gemeinschaft', v3d: 'Wir bringen die Nachbarschaftskultur in die digitale Welt.',
        v4: 'Innovation', v4d: 'Wir erleichtern die Arbeit unserer Händler mit modernsten Technologien.',
        cta: 'Werden Sie unser Partner',
    },
    tr: {
        title: 'Hakkımızda',
        intro: 'LOKMA, 2024 yılında Almanya\'da kurulan, yerel esnafı dijital dünya ile buluşturan yenilikçi bir platformdur.',
        missionTitle: 'Misyonumuz',
        mission: 'Geleneksel ticaretin gücünü modern teknoloji ile birleştirerek, adil ve şeffaf bir pazar yeri oluşturmak. Esnafımızın alın terinin karşılığını almasını sağlamak.',
        visionTitle: 'Vizyonumuz',
        vision: 'Avrupa\'nın her köşesinde yerel esnafı destekleyen, topluluk odaklı, sürdürülebilir bir dijital ekosistem kurmak.',
        valuesTitle: 'Değerlerimiz',
        v1: 'Adalet', v1d: 'Sektörün en düşük komisyon oranları ile esnafın kazancını koruyoruz.',
        v2: 'Şeffaflık', v2d: 'Gizli ücret yok, karmaşık sözleşme yok. Her şey açık ve net.',
        v3: 'Topluluk', v3d: 'Mahalle kültürünü dijital dünyada yaşatıyoruz.',
        v4: 'Yenilikçilik', v4d: 'En son teknolojiler ile esnafımızın işini kolaylaştırıyoruz.',
        cta: 'Partnerimiz Olun',
    },
    en: {
        title: 'About Us',
        intro: 'LOKMA is an innovative platform founded in Germany in 2024 that connects local merchants with the digital world.',
        missionTitle: 'Our Mission',
        mission: 'To combine the power of traditional commerce with modern technology and create a fair, transparent marketplace. To ensure our merchants receive fair compensation for their hard work.',
        visionTitle: 'Our Vision',
        vision: 'To build a sustainable, community-oriented digital ecosystem that supports local merchants across all of Europe.',
        valuesTitle: 'Our Values',
        v1: 'Fairness', v1d: 'We protect merchant earnings with the industry\'s lowest commission rates.',
        v2: 'Transparency', v2d: 'No hidden fees, no complicated contracts. Everything open and clear.',
        v3: 'Community', v3d: 'We bring neighborhood culture into the digital world.',
        v4: 'Innovation', v4d: 'We make our merchants\' work easier with cutting-edge technology.',
        cta: 'Become Our Partner',
    },
    fr: {
        title: 'À propos',
        intro: 'LOKMA est une plateforme innovante fondée en Allemagne en 2024 qui connecte les commerçants locaux au monde numérique.',
        missionTitle: 'Notre Mission',
        mission: 'Combiner la force du commerce traditionnel avec la technologie moderne pour créer un marché équitable et transparent. Veiller à ce que nos commerçants reçoivent une juste rémunération.',
        visionTitle: 'Notre Vision',
        vision: 'Construire un écosystème numérique durable et communautaire qui soutient les commerçants locaux dans toute l\'Europe.',
        valuesTitle: 'Nos Valeurs',
        v1: 'Équité', v1d: 'Nous protégeons les revenus des commerçants avec les taux de commission les plus bas du marché.',
        v2: 'Transparence', v2d: 'Pas de frais cachés, pas de contrats compliqués. Tout est ouvert et clair.',
        v3: 'Communauté', v3d: 'Nous apportons la culture de quartier dans le monde numérique.',
        v4: 'Innovation', v4d: 'Nous facilitons le travail de nos commerçants avec les technologies de pointe.',
        cta: 'Devenez notre partenaire',
    },
    it: {
        title: 'Chi siamo',
        intro: 'LOKMA è una piattaforma innovativa fondata in Germania nel 2024 che connette i commercianti locali con il mondo digitale.',
        missionTitle: 'La nostra Missione',
        mission: 'Combinare la forza del commercio tradizionale con la tecnologia moderna per creare un mercato equo e trasparente. Garantire ai nostri commercianti un giusto compenso.',
        visionTitle: 'La nostra Visione',
        vision: 'Costruire un ecosistema digitale sostenibile e orientato alla comunità che supporti i commercianti locali in tutta Europa.',
        valuesTitle: 'I nostri Valori',
        v1: 'Equità', v1d: 'Proteggiamo i guadagni dei commercianti con le commissioni più basse del settore.',
        v2: 'Trasparenza', v2d: 'Nessun costo nascosto, nessun contratto complicato. Tutto aperto e chiaro.',
        v3: 'Comunità', v3d: 'Portiamo la cultura di quartiere nel mondo digitale.',
        v4: 'Innovazione', v4d: 'Facilitiamo il lavoro dei nostri commercianti con tecnologie all\'avanguardia.',
        cta: 'Diventa nostro partner',
    },
    es: {
        title: 'Sobre nosotros',
        intro: 'LOKMA es una plataforma innovadora fundada en Alemania en 2024 que conecta a los comerciantes locales con el mundo digital.',
        missionTitle: 'Nuestra Misión',
        mission: 'Combinar la fuerza del comercio tradicional con la tecnología moderna para crear un mercado justo y transparente. Asegurar que nuestros comerciantes reciban una compensación justa.',
        visionTitle: 'Nuestra Visión',
        vision: 'Construir un ecosistema digital sostenible y orientado a la comunidad que apoye a los comerciantes locales en toda Europa.',
        valuesTitle: 'Nuestros Valores',
        v1: 'Equidad', v1d: 'Protegemos los ingresos de los comerciantes con las comisiones más bajas del sector.',
        v2: 'Transparencia', v2d: 'Sin tarifas ocultas, sin contratos complicados. Todo abierto y claro.',
        v3: 'Comunidad', v3d: 'Llevamos la cultura del barrio al mundo digital.',
        v4: 'Innovación', v4d: 'Facilitamos el trabajo de nuestros comerciantes con tecnología de vanguardia.',
        cta: 'Conviértase en nuestro socio',
    },
    nl: {
        title: 'Over ons',
        intro: 'LOKMA is een innovatief platform opgericht in Duitsland in 2024 dat lokale handelaren verbindt met de digitale wereld.',
        missionTitle: 'Onze Missie',
        mission: 'De kracht van traditionele handel combineren met moderne technologie om een eerlijke, transparante marktplaats te creeren. Ervoor zorgen dat onze handelaren een eerlijke vergoeding krijgen voor hun harde werk.',
        visionTitle: 'Onze Visie',
        vision: 'Een duurzaam, gemeenschapsgericht digitaal ecosysteem opbouwen dat lokale handelaren in heel Europa ondersteunt.',
        valuesTitle: 'Onze Waarden',
        v1: 'Eerlijkheid', v1d: 'Wij beschermen de inkomsten van handelaren met de laagste commissietarieven in de sector.',
        v2: 'Transparantie', v2d: 'Geen verborgen kosten, geen ingewikkelde contracten. Alles open en duidelijk.',
        v3: 'Gemeenschap', v3d: 'Wij brengen de buurtcultuur naar de digitale wereld.',
        v4: 'Innovatie', v4d: 'Wij vergemakkelijken het werk van onze handelaren met geavanceerde technologie.',
        cta: 'Word onze partner',
    },
};

export default function AboutPage() {
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[800px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-8">{t('title')}</h1>

                    <div className="space-y-8 text-gray-600 dark:text-white/80 text-lg leading-relaxed">
                        <p>
                            <strong className="text-gray-900 dark:text-white">LOKMA</strong> — {t('intro')}
                        </p>

                        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('missionTitle')}</h2>
                            <p>{t('mission')}</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('visionTitle')}</h2>
                            <p>{t('vision')}</p>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-6">{t('valuesTitle')}</h2>

                        <div className="grid md:grid-cols-2 gap-6">
                            {(['v1', 'v2', 'v3', 'v4'] as const).map(v => (
                                <div key={v} className="bg-[#fb335b]/10 border border-[#fb335b]/20 rounded-xl p-6">
                                    <h3 className="font-bold text-[#fb335b] mb-2">{t(v)}</h3>
                                    <p className="text-sm">{t(`${v}d`)}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 text-center">
                            <Link
                                href="/partner"
                                className="inline-block bg-[#fb335b] hover:bg-red-600 text-white px-8 py-4 rounded-xl font-bold transition-all"
                            >
                                {t('cta')}
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            <PublicFooter themeAware={true} />
        </div>
    );
}
