'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const supportTexts: Record<string, Record<string, string>> = {
    de: {
        title: 'Support-Center',
        subtitle: 'Wie können wir Ihnen helfen?',
        email: 'E-Mail',
        phone: 'Telefon',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Schneller Support',
        faqTitle: 'Häufig gestellte Fragen',
        catGeneral: 'Allgemein',
        catOrder: 'Bestellung',
        catPartner: 'Partnerschaften',
        q1: 'Was ist LOKMA?',
        a1: 'LOKMA ist ein digitaler Marktplatz, der lokale Unternehmen und Kunden zusammenbringt. Metzger, Supermärkte, Blumenläden und mehr – alles auf einer Plattform.',
        q2: 'In welchen Ländern ist LOKMA aktiv?',
        a2: 'Derzeit sind wir in Deutschland, Österreich und der Schweiz aktiv. Bald werden wir auch in weiteren europäischen Ländern verfügbar sein.',
        q3: 'Ist die App kostenlos?',
        a3: 'Ja, das Herunterladen und Nutzen der LOKMA-App ist völlig kostenlos.',
        q4: 'Wie kann ich bestellen?',
        a4: 'Laden Sie die App herunter, wählen Sie Ihren Standort und entdecken Sie die nächsten Geschäfte. Fügen Sie Produkte zum Warenkorb hinzu und schließen Sie Ihre Bestellung mit sicherer Zahlung ab.',
        q5: 'Wie hoch sind die Lieferkosten?',
        a5: 'Die Lieferkosten variieren je nach Region und Geschäft. Die Liefergebühr wird vor der Bestellung deutlich angezeigt.',
        q6: 'Kann ich meine Bestellung stornieren?',
        a6: 'Sie können Ihre Bestellung stornieren, bevor das Geschäft sie bestätigt. Nach der Bestätigung müssen Sie das Geschäft kontaktieren.',
        q7: 'Welche Zahlungsmethoden gibt es?',
        a7: 'Kredit-/Bankkarte, PayPal und Barzahlung bei Lieferung sind verfügbar. Die Zahlungsmethoden können je nach Geschäft variieren.',
        q8: 'Wie kann ich als Händler beitreten?',
        a8: 'Klicken Sie auf „Partner werden" und füllen Sie das Anmeldeformular aus. Unser Team wird sich innerhalb von 24 Stunden bei Ihnen melden.',
        q9: 'Wie hoch sind die Provisionen?',
        a9: 'LOKMA bietet die niedrigsten Provisionen der Branche. Kontaktieren Sie uns für detaillierte Informationen.',
        q10: 'Wann werden Zahlungen geleistet?',
        a10: 'Zahlungen werden wöchentlich auf Ihr Bankkonto überwiesen. Sofortige Auszahlung ist ebenfalls verfügbar.',
        backHome: '← Startseite',
    },
    tr: {
        title: 'Destek Merkezi',
        subtitle: 'Size nasil yardimci olabiliriz?',
        email: 'E-posta',
        phone: 'Telefon',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Hizli destek',
        faqTitle: 'Sikca Sorulan Sorular',
        catGeneral: 'Genel',
        catOrder: 'Siparis',
        catPartner: 'Esnaf Ortakligi',
        q1: 'LOKMA nedir?',
        a1: 'LOKMA, yerel esnaf ve musterileri bir araya getiren dijital bir pazar yeridir. Kasaplar, marketler, cicekler ve daha fazlasi tek platformda.',
        q2: 'LOKMA hangi ulkelerde aktif?',
        a2: 'Su anda Almanya, Avusturya ve Isvicre\'de aktif olarak hizmet veriyoruz. Yakinda diger Avrupa ulkelerinde de acilacagiz.',
        q3: 'Uygulama ucretsiz mi?',
        a3: 'Evet, LOKMA uygulamasini indirmek ve kullanmak tamamen ucretsizdir.',
        q4: 'Nasil siparis verebilirim?',
        a4: 'Uygulamayi indirin, konumunuzu secin ve size en yakin isletmeleri kesfedin. Urunleri sepetinize ekleyin ve guvenli odeme ile siparisinizi tamamlayin.',
        q5: 'Teslimat ucreti ne kadar?',
        a5: 'Teslimat ucreti bolgeye ve isletmeye gore degisir. Siparis oncesi teslimat ucreti acikca gosterilir.',
        q6: 'Siparisimi iptal edebilir miyim?',
        a6: 'Isletme siparisinizi onaylamadan once iptal edebilirsiniz. Onaylandiktan sonra iptal icin isletme ile iletisime gecmeniz gerekir.',
        q7: 'Odeme yontemleri nelerdir?',
        a7: 'Kredi/banka karti, PayPal ve kapida odeme secenekleri mevcuttur. Odeme yontemleri isletmeye gore degisebilir.',
        q8: 'Esnaf olarak nasil katilabilirim?',
        a8: '"Partnerimiz Olun" butonuna tiklayarak basvuru formunu doldurun. Ekibimiz 24 saat icinde sizinle iletisime gececektir.',
        q9: 'Komisyon oranlari nedir?',
        a9: 'LOKMA, sektorun en dusuk komisyon oranlarini sunar. Detayli bilgi icin iletisime gecin.',
        q10: 'Odemeler ne zaman yapilir?',
        a10: 'Odemeler haftalik olarak banka hesabiniza aktarilir. Anlik odeme secenegi de mevcuttur.',
        backHome: '← Ana Sayfa',
    },
    en: {
        title: 'Support Center',
        subtitle: 'How can we help you?',
        email: 'Email',
        phone: 'Phone',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Quick support',
        faqTitle: 'Frequently Asked Questions',
        catGeneral: 'General',
        catOrder: 'Orders',
        catPartner: 'Business Partnership',
        q1: 'What is LOKMA?',
        a1: 'LOKMA is a digital marketplace connecting local businesses and customers. Butchers, supermarkets, florists and more – all on one platform.',
        q2: 'In which countries is LOKMA active?',
        a2: 'We are currently active in Germany, Austria, and Switzerland. We will soon be available in other European countries.',
        q3: 'Is the app free?',
        a3: 'Yes, downloading and using the LOKMA app is completely free.',
        q4: 'How can I place an order?',
        a4: 'Download the app, select your location, and discover the nearest businesses. Add products to your cart and complete your order with secure payment.',
        q5: 'How much are delivery fees?',
        a5: 'Delivery fees vary by region and business. The delivery fee is clearly shown before ordering.',
        q6: 'Can I cancel my order?',
        a6: 'You can cancel your order before the business confirms it. After confirmation, you need to contact the business for cancellation.',
        q7: 'What payment methods are available?',
        a7: 'Credit/debit card, PayPal, and cash on delivery are available. Payment methods may vary by business.',
        q8: 'How can I join as a vendor?',
        a8: 'Click "Become a Partner" and fill out the application form. Our team will contact you within 24 hours.',
        q9: 'What are the commission rates?',
        a9: 'LOKMA offers the lowest commission rates in the industry. Contact us for detailed information.',
        q10: 'When are payments made?',
        a10: 'Payments are transferred to your bank account weekly. Instant payout is also available.',
        backHome: '← Home',
    },
    fr: {
        title: 'Centre d\'assistance',
        subtitle: 'Comment pouvons-nous vous aider ?',
        email: 'E-mail',
        phone: 'Telephone',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Support rapide',
        faqTitle: 'Questions frequentes',
        catGeneral: 'General',
        catOrder: 'Commandes',
        catPartner: 'Partenariats',
        q1: 'Qu\'est-ce que LOKMA ?',
        a1: 'LOKMA est une place de marche numerique qui connecte les entreprises locales et les clients. Boucheries, supermarches, fleuristes et plus – tout sur une seule plateforme.',
        q2: 'Dans quels pays LOKMA est-il actif ?',
        a2: 'Nous sommes actuellement actifs en Allemagne, en Autriche et en Suisse. Nous serons bientot disponibles dans d\'autres pays europeens.',
        q3: 'L\'application est-elle gratuite ?',
        a3: 'Oui, le telechargement et l\'utilisation de l\'application LOKMA sont entierement gratuits.',
        q4: 'Comment passer commande ?',
        a4: 'Telechargez l\'application, selectionnez votre emplacement et decouvrez les commerces les plus proches. Ajoutez des produits a votre panier et finalisez votre commande avec un paiement securise.',
        q5: 'Quel est le cout de la livraison ?',
        a5: 'Les frais de livraison varient selon la region et le commerce. Les frais de livraison sont clairement indiques avant la commande.',
        q6: 'Puis-je annuler ma commande ?',
        a6: 'Vous pouvez annuler votre commande avant que le commerce ne la confirme. Apres confirmation, vous devez contacter le commerce pour l\'annulation.',
        q7: 'Quels modes de paiement sont disponibles ?',
        a7: 'Carte de credit/debit, PayPal et paiement a la livraison sont disponibles. Les modes de paiement peuvent varier selon le commerce.',
        q8: 'Comment devenir partenaire ?',
        a8: 'Cliquez sur \"Devenir partenaire\" et remplissez le formulaire d\'inscription. Notre equipe vous contactera dans les 24 heures.',
        q9: 'Quels sont les taux de commission ?',
        a9: 'LOKMA offre les taux de commission les plus bas du secteur. Contactez-nous pour plus d\'informations.',
        q10: 'Quand les paiements sont-ils effectues ?',
        a10: 'Les paiements sont vires sur votre compte bancaire chaque semaine. Le paiement instantane est egalement disponible.',
        backHome: '← Accueil',
    },
    it: {
        title: 'Centro assistenza',
        subtitle: 'Come possiamo aiutarti?',
        email: 'E-mail',
        phone: 'Telefono',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Supporto rapido',
        faqTitle: 'Domande frequenti',
        catGeneral: 'Generale',
        catOrder: 'Ordini',
        catPartner: 'Partnership',
        q1: 'Cos\'e LOKMA?',
        a1: 'LOKMA e un marketplace digitale che collega imprese locali e clienti. Macellerie, supermercati, fioristi e altro – tutto su un\'unica piattaforma.',
        q2: 'In quali paesi e attivo LOKMA?',
        a2: 'Attualmente siamo attivi in Germania, Austria e Svizzera. Presto saremo disponibili anche in altri paesi europei.',
        q3: 'L\'app e gratuita?',
        a3: 'Si, scaricare e utilizzare l\'app LOKMA e completamente gratuito.',
        q4: 'Come posso effettuare un ordine?',
        a4: 'Scarica l\'app, seleziona la tua posizione e scopri i negozi piu vicini. Aggiungi prodotti al carrello e completa l\'ordine con pagamento sicuro.',
        q5: 'Quanto costa la consegna?',
        a5: 'Le spese di consegna variano in base alla regione e al negozio. La tariffa viene mostrata chiaramente prima dell\'ordine.',
        q6: 'Posso annullare il mio ordine?',
        a6: 'Puoi annullare l\'ordine prima che il negozio lo confermi. Dopo la conferma, devi contattare il negozio per la cancellazione.',
        q7: 'Quali metodi di pagamento sono disponibili?',
        a7: 'Carta di credito/debito, PayPal e pagamento alla consegna sono disponibili. I metodi di pagamento possono variare in base al negozio.',
        q8: 'Come posso diventare partner?',
        a8: 'Clicca su "Diventa partner" e compila il modulo di iscrizione. Il nostro team ti contattara entro 24 ore.',
        q9: 'Quali sono le commissioni?',
        a9: 'LOKMA offre le commissioni piu basse del settore. Contattaci per informazioni dettagliate.',
        q10: 'Quando vengono effettuati i pagamenti?',
        a10: 'I pagamenti vengono trasferiti sul tuo conto bancario settimanalmente. E disponibile anche il pagamento istantaneo.',
        backHome: '← Home',
    },
    es: {
        title: 'Centro de soporte',
        subtitle: 'Como podemos ayudarte?',
        email: 'Correo electronico',
        phone: 'Telefono',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Soporte rapido',
        faqTitle: 'Preguntas frecuentes',
        catGeneral: 'General',
        catOrder: 'Pedidos',
        catPartner: 'Colaboraciones',
        q1: 'Que es LOKMA?',
        a1: 'LOKMA es un marketplace digital que conecta negocios locales y clientes. Carnicerias, supermercados, floristerias y mas – todo en una sola plataforma.',
        q2: 'En que paises esta activo LOKMA?',
        a2: 'Actualmente estamos activos en Alemania, Austria y Suiza. Pronto estaremos disponibles en otros paises europeos.',
        q3: 'La app es gratuita?',
        a3: 'Si, descargar y usar la aplicacion LOKMA es completamente gratuito.',
        q4: 'Como puedo hacer un pedido?',
        a4: 'Descarga la app, selecciona tu ubicacion y descubre los comercios mas cercanos. Agrega productos al carrito y completa tu pedido con pago seguro.',
        q5: 'Cuanto cuesta el envio?',
        a5: 'Los gastos de envio varian segun la region y el comercio. La tarifa se muestra claramente antes de realizar el pedido.',
        q6: 'Puedo cancelar mi pedido?',
        a6: 'Puedes cancelar tu pedido antes de que el comercio lo confirme. Despues de la confirmacion, debes contactar con el comercio para la cancelacion.',
        q7: 'Que metodos de pago estan disponibles?',
        a7: 'Tarjeta de credito/debito, PayPal y pago contra entrega estan disponibles. Los metodos de pago pueden variar segun el comercio.',
        q8: 'Como puedo unirme como vendedor?',
        a8: 'Haz clic en "Ser socio" y rellena el formulario de solicitud. Nuestro equipo se pondra en contacto contigo en 24 horas.',
        q9: 'Cuales son las comisiones?',
        a9: 'LOKMA ofrece las comisiones mas bajas del sector. Contactanos para informacion detallada.',
        q10: 'Cuando se realizan los pagos?',
        a10: 'Los pagos se transfieren a tu cuenta bancaria semanalmente. El pago instantaneo tambien esta disponible.',
        backHome: '← Inicio',
    },
    nl: {
        title: 'Ondersteuningscentrum',
        subtitle: 'Hoe kunnen wij u helpen?',
        email: 'E-mail',
        phone: 'Telefoon',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Snelle ondersteuning',
        faqTitle: 'Veelgestelde vragen',
        catGeneral: 'Algemeen',
        catOrder: 'Bestellingen',
        catPartner: 'Partnerschappen',
        q1: 'Wat is LOKMA?',
        a1: 'LOKMA is een digitale marktplaats die lokale bedrijven en klanten samenbrengt. Slagers, supermarkten, bloemisten en meer – alles op een platform.',
        q2: 'In welke landen is LOKMA actief?',
        a2: 'Momenteel zijn we actief in Duitsland, Oostenrijk en Zwitserland. Binnenkort zullen we ook in andere Europese landen beschikbaar zijn.',
        q3: 'Is de app gratis?',
        a3: 'Ja, het downloaden en gebruiken van de LOKMA-app is volledig gratis.',
        q4: 'Hoe kan ik bestellen?',
        a4: 'Download de app, selecteer uw locatie en ontdek de dichtstbijzijnde winkels. Voeg producten toe aan uw winkelwagen en rond uw bestelling af met veilige betaling.',
        q5: 'Hoeveel kost de bezorging?',
        a5: 'De bezorgkosten varieren per regio en winkel. De bezorgkosten worden voor de bestelling duidelijk weergegeven.',
        q6: 'Kan ik mijn bestelling annuleren?',
        a6: 'U kunt uw bestelling annuleren voordat de winkel deze bevestigt. Na bevestiging moet u contact opnemen met de winkel voor annulering.',
        q7: 'Welke betaalmethoden zijn er?',
        a7: 'Creditcard/betaalkaart, PayPal en contante betaling bij levering zijn beschikbaar. Betaalmethoden kunnen per winkel varieren.',
        q8: 'Hoe kan ik als handelaar meedoen?',
        a8: 'Klik op "Word partner" en vul het aanmeldformulier in. Ons team neemt binnen 24 uur contact met u op.',
        q9: 'Wat zijn de commissietarieven?',
        a9: 'LOKMA biedt de laagste commissietarieven in de sector. Neem contact met ons op voor gedetailleerde informatie.',
        q10: 'Wanneer worden betalingen gedaan?',
        a10: 'Betalingen worden wekelijks overgemaakt naar uw bankrekening. Directe uitbetaling is ook beschikbaar.',
        backHome: '← Startpagina',
    },
};

export default function SupportPage() {
    const [openFaq, setOpenFaq] = useState<string | null>(null);
    const locale = useLocale();
    const tx = supportTexts[locale] || supportTexts['de'];

    const faqs = [
        {
            category: tx.catGeneral,
            items: [
                { q: tx.q1, a: tx.a1 },
                { q: tx.q2, a: tx.a2 },
                { q: tx.q3, a: tx.a3 },
            ]
        },
        {
            category: tx.catOrder,
            items: [
                { q: tx.q4, a: tx.a4 },
                { q: tx.q5, a: tx.a5 },
                { q: tx.q6, a: tx.a6 },
                { q: tx.q7, a: tx.a7 },
            ]
        },
        {
            category: tx.catPartner,
            items: [
                { q: tx.q8, a: tx.a8 },
                { q: tx.q9, a: tx.a9 },
                { q: tx.q10, a: tx.a10 },
            ]
        },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif]">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[800px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-4">{tx.title}</h1>
                    <p className="text-gray-500 dark:text-white/60 text-lg mb-12">{tx.subtitle}</p>

                    {/* Contact Cards */}
                    <div className="grid md:grid-cols-3 gap-6 mb-16">
                        <a href="mailto:destek@lokma.shop" className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 hover:border-[#ea184a]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ea184a] text-4xl mb-4 block">mail</span>
                            <h3 className="font-bold mb-2">{tx.email}</h3>
                            <p className="text-sm text-gray-500 dark:text-white/50">destek@lokma.shop</p>
                        </a>
                        <a href="tel:+4917612345678" className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 hover:border-[#ea184a]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ea184a] text-4xl mb-4 block">phone</span>
                            <h3 className="font-bold mb-2">{tx.phone}</h3>
                            <p className="text-sm text-gray-500 dark:text-white/50">+49 176 123 456 78</p>
                        </a>
                        <a href="https://wa.me/4917612345678" className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 hover:border-[#ea184a]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#ea184a] text-4xl mb-4 block">chat</span>
                            <h3 className="font-bold mb-2">{tx.whatsapp}</h3>
                            <p className="text-sm text-gray-500 dark:text-white/50">{tx.whatsappDesc}</p>
                        </a>
                    </div>

                    {/* FAQ */}
                    <h2 className="text-2xl font-bold mb-8">{tx.faqTitle}</h2>

                    {faqs.map((section) => (
                        <div key={section.category} className="mb-8">
                            <h3 className="text-lg font-bold text-[#ea184a] mb-4">{section.category}</h3>
                            <div className="space-y-3">
                                {section.items.map((faq, idx) => (
                                    <div key={idx} className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                                        <button
                                            className="w-full flex items-center justify-between p-5 text-left"
                                            onClick={() => setOpenFaq(openFaq === `${section.category}-${idx}` ? null : `${section.category}-${idx}`)}
                                        >
                                            <span className="font-medium">{faq.q}</span>
                                            <span className={`material-symbols-outlined transition-transform ${openFaq === `${section.category}-${idx}` ? 'rotate-180' : ''}`}>
                                                expand_more
                                            </span>
                                        </button>
                                        {openFaq === `${section.category}-${idx}` && (
                                            <div className="px-5 pb-5 text-gray-600 dark:text-white/60">
                                                {faq.a}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <PublicFooter themeAware={true} />
        </div>
    );
}
