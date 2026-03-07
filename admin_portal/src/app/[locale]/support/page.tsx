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
        subtitle: 'Size nasıl yardımcı olabiliriz?',
        email: 'E-posta',
        phone: 'Telefon',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Hızlı destek',
        faqTitle: 'Sıkça Sorulan Sorular',
        catGeneral: 'Genel',
        catOrder: 'Sipariş',
        catPartner: 'Esnaf Ortaklığı',
        q1: 'LOKMA nedir?',
        a1: 'LOKMA, yerel esnaf ve müşterileri bir araya getiren dijital bir pazar yeridir. Kasaplar, marketler, çiçekçiler ve daha fazlası tek platformda.',
        q2: 'LOKMA hangi ülkelerde aktif?',
        a2: 'Şu anda Almanya, Avusturya ve İsviçre\'de aktif olarak hizmet veriyoruz. Yakında diğer Avrupa ülkelerinde de açılacağız.',
        q3: 'Uygulama ücretsiz mi?',
        a3: 'Evet, LOKMA uygulamasını indirmek ve kullanmak tamamen ücretsizdir.',
        q4: 'Nasıl sipariş verebilirim?',
        a4: 'Uygulamayı indirin, konumunuzu seçin ve size en yakın işletmeleri keşfedin. Ürünleri sepetinize ekleyin ve güvenli ödeme ile siparişinizi tamamlayın.',
        q5: 'Teslimat ücreti ne kadar?',
        a5: 'Teslimat ücreti bölgeye ve işletmeye göre değişir. Sipariş öncesi teslimat ücreti açıkça gösterilir.',
        q6: 'Siparişimi iptal edebilir miyim?',
        a6: 'İşletme siparişinizi onaylamadan önce iptal edebilirsiniz. Onaylandıktan sonra iptal için işletme ile iletişime geçmeniz gerekir.',
        q7: 'Ödeme yöntemleri nelerdir?',
        a7: 'Kredi/banka kartı, PayPal ve kapıda ödeme seçenekleri mevcuttur. Ödeme yöntemleri işletmeye göre değişebilir.',
        q8: 'Esnaf olarak nasıl katılabilirim?',
        a8: '"Partnerimiz Olun" butonuna tıklayarak başvuru formunu doldurun. Ekibimiz 24 saat içinde sizinle iletişime geçecektir.',
        q9: 'Komisyon oranları nedir?',
        a9: 'LOKMA, sektörün en düşük komisyon oranlarını sunar. Detaylı bilgi için iletişime geçin.',
        q10: 'Ödemeler ne zaman yapılır?',
        a10: 'Ödemeler haftalık olarak banka hesabınıza aktarılır. Anlık ödeme seçeneği de mevcuttur.',
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
        phone: 'Téléphone',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Support rapide',
        faqTitle: 'Questions fréquentes',
        catGeneral: 'Général',
        catOrder: 'Commandes',
        catPartner: 'Partenariats',
        q1: 'Qu\'est-ce que LOKMA ?',
        a1: 'LOKMA est une place de marché numérique qui connecte les entreprises locales et les clients. Boucheries, supermarchés, fleuristes et plus – tout sur une seule plateforme.',
        q2: 'Dans quels pays LOKMA est-il actif ?',
        a2: 'Nous sommes actuellement actifs en Allemagne, en Autriche et en Suisse. Nous serons bientôt disponibles dans d\'autres pays européens.',
        q3: 'L\'application est-elle gratuite ?',
        a3: 'Oui, le téléchargement et l\'utilisation de l\'application LOKMA sont entièrement gratuits.',
        q4: 'Comment passer commande ?',
        a4: 'Téléchargez l\'application, sélectionnez votre emplacement et découvrez les commerces les plus proches. Ajoutez des produits à votre panier et finalisez votre commande avec un paiement sécurisé.',
        q5: 'Quel est le coût de la livraison ?',
        a5: 'Les frais de livraison varient selon la région et le commerce. Les frais de livraison sont clairement indiqués avant la commande.',
        q6: 'Puis-je annuler ma commande ?',
        a6: 'Vous pouvez annuler votre commande avant que le commerce ne la confirme. Après confirmation, vous devez contacter le commerce pour l\'annulation.',
        q7: 'Quels modes de paiement sont disponibles ?',
        a7: 'Carte de crédit/débit, PayPal et paiement à la livraison sont disponibles. Les modes de paiement peuvent varier selon le commerce.',
        q8: 'Comment devenir partenaire ?',
        a8: 'Cliquez sur « Devenir partenaire » et remplissez le formulaire d\'inscription. Notre équipe vous contactera dans les 24 heures.',
        q9: 'Quels sont les taux de commission ?',
        a9: 'LOKMA offre les taux de commission les plus bas du secteur. Contactez-nous pour plus d\'informations.',
        q10: 'Quand les paiements sont-ils effectués ?',
        a10: 'Les paiements sont virés sur votre compte bancaire chaque semaine. Le paiement instantané est également disponible.',
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
        q1: 'Cos\'è LOKMA?',
        a1: 'LOKMA è un marketplace digitale che collega imprese locali e clienti. Macellerie, supermercati, fioristi e altro – tutto su un\'unica piattaforma.',
        q2: 'In quali paesi è attivo LOKMA?',
        a2: 'Attualmente siamo attivi in Germania, Austria e Svizzera. Presto saremo disponibili anche in altri paesi europei.',
        q3: 'L\'app è gratuita?',
        a3: 'Sì, scaricare e utilizzare l\'app LOKMA è completamente gratuito.',
        q4: 'Come posso effettuare un ordine?',
        a4: 'Scarica l\'app, seleziona la tua posizione e scopri i negozi più vicini. Aggiungi prodotti al carrello e completa l\'ordine con pagamento sicuro.',
        q5: 'Quanto costa la consegna?',
        a5: 'Le spese di consegna variano in base alla regione e al negozio. La tariffa viene mostrata chiaramente prima dell\'ordine.',
        q6: 'Posso annullare il mio ordine?',
        a6: 'Puoi annullare l\'ordine prima che il negozio lo confermi. Dopo la conferma, devi contattare il negozio per la cancellazione.',
        q7: 'Quali metodi di pagamento sono disponibili?',
        a7: 'Carta di credito/debito, PayPal e pagamento alla consegna sono disponibili. I metodi di pagamento possono variare in base al negozio.',
        q8: 'Come posso diventare partner?',
        a8: 'Clicca su "Diventa partner" e compila il modulo di iscrizione. Il nostro team ti contatterà entro 24 ore.',
        q9: 'Quali sono le commissioni?',
        a9: 'LOKMA offre le commissioni più basse del settore. Contattaci per informazioni dettagliate.',
        q10: 'Quando vengono effettuati i pagamenti?',
        a10: 'I pagamenti vengono trasferiti sul tuo conto bancario settimanalmente. È disponibile anche il pagamento istantaneo.',
        backHome: '← Home',
    },
    es: {
        title: 'Centro de soporte',
        subtitle: '¿Cómo podemos ayudarte?',
        email: 'Correo electrónico',
        phone: 'Teléfono',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Soporte rápido',
        faqTitle: 'Preguntas frecuentes',
        catGeneral: 'General',
        catOrder: 'Pedidos',
        catPartner: 'Colaboraciones',
        q1: '¿Qué es LOKMA?',
        a1: 'LOKMA es un marketplace digital que conecta negocios locales y clientes. Carnicerías, supermercados, floristerías y más – todo en una sola plataforma.',
        q2: '¿En qué países está activo LOKMA?',
        a2: 'Actualmente estamos activos en Alemania, Austria y Suiza. Pronto estaremos disponibles en otros países europeos.',
        q3: '¿La app es gratuita?',
        a3: 'Sí, descargar y usar la aplicación LOKMA es completamente gratuito.',
        q4: '¿Cómo puedo hacer un pedido?',
        a4: 'Descarga la app, selecciona tu ubicación y descubre los comercios más cercanos. Agrega productos al carrito y completa tu pedido con pago seguro.',
        q5: '¿Cuánto cuesta el envío?',
        a5: 'Los gastos de envío varían según la región y el comercio. La tarifa se muestra claramente antes de realizar el pedido.',
        q6: '¿Puedo cancelar mi pedido?',
        a6: 'Puedes cancelar tu pedido antes de que el comercio lo confirme. Después de la confirmación, debes contactar con el comercio para la cancelación.',
        q7: '¿Qué métodos de pago están disponibles?',
        a7: 'Tarjeta de crédito/débito, PayPal y pago contra entrega están disponibles. Los métodos de pago pueden variar según el comercio.',
        q8: '¿Cómo puedo unirme como vendedor?',
        a8: 'Haz clic en "Ser socio" y rellena el formulario de solicitud. Nuestro equipo se pondrá en contacto contigo en 24 horas.',
        q9: '¿Cuáles son las comisiones?',
        a9: 'LOKMA ofrece las comisiones más bajas del sector. Contáctanos para información detallada.',
        q10: '¿Cuándo se realizan los pagos?',
        a10: 'Los pagos se transfieren a tu cuenta bancaria semanalmente. El pago instantáneo también está disponible.',
        backHome: '← Inicio',
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
        <div className="min-h-screen bg-[#0a0a0f] text-white font-['Plus_Jakarta_Sans',sans-serif]">
            <PublicHeader themeAware={false} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
                <div className="max-w-[800px] mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black mb-4">{tx.title}</h1>
                    <p className="text-white/60 text-lg mb-12">{tx.subtitle}</p>

                    {/* Contact Cards */}
                    <div className="grid md:grid-cols-3 gap-6 mb-16">
                        <a href="mailto:destek@lokma.shop" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#fb335b]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#fb335b] text-4xl mb-4 block">mail</span>
                            <h3 className="font-bold mb-2">{tx.email}</h3>
                            <p className="text-sm text-white/60">destek@lokma.shop</p>
                        </a>
                        <a href="tel:+4917612345678" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#fb335b]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#fb335b] text-4xl mb-4 block">phone</span>
                            <h3 className="font-bold mb-2">{tx.phone}</h3>
                            <p className="text-sm text-white/60">+49 176 123 456 78</p>
                        </a>
                        <a href="https://wa.me/4917612345678" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#fb335b]/50 transition-all text-center">
                            <span className="material-symbols-outlined text-[#fb335b] text-4xl mb-4 block">chat</span>
                            <h3 className="font-bold mb-2">{tx.whatsapp}</h3>
                            <p className="text-sm text-white/60">{tx.whatsappDesc}</p>
                        </a>
                    </div>

                    {/* FAQ */}
                    <h2 className="text-2xl font-bold mb-8">{tx.faqTitle}</h2>

                    {faqs.map((section) => (
                        <div key={section.category} className="mb-8">
                            <h3 className="text-lg font-bold text-[#fb335b] mb-4">{section.category}</h3>
                            <div className="space-y-3">
                                {section.items.map((faq, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
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
                                            <div className="px-5 pb-5 text-white/70">
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

            <PublicFooter themeAware={false} />
        </div>
    );
}
