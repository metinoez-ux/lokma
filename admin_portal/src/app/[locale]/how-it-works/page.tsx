'use client';

import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
 de: {
 title: 'Wie funktioniert es?',
 subtitle: 'Mit LOKMA bestellen ist ganz einfach. In 6 einfachen Schritten beim lokalen Händler einkaufen.',
 s1: 'App herunterladen', s1d: 'Laden Sie die LOKMA-App kostenlos aus dem App Store oder Google Play herunter.',
 s2: 'Standort wählen', s2d: 'Erlauben Sie den Standortzugriff oder geben Sie Ihre Adresse manuell ein. Wir finden die nächsten Geschäfte.',
 s3: 'Kategorien entdecken', s3d: 'Wählen Sie aus Kategorien wie Supermarkt, Metzger, Restaurant, Blumenladen und mehr.',
 s4: 'Produkte in den Warenkorb', s4d: 'Wählen Sie Ihre gewünschten Produkte, bestimmen Sie die Mengen und legen Sie sie in den Warenkorb.',
 s5: 'Sichere Bezahlung', s5d: 'Wählen Sie zwischen Kreditkarte, PayPal oder Barzahlung bei Lieferung.',
 s6: 'Lieferung abwarten', s6d: 'Verfolgen Sie Ihre Bestellung live. Die Lieferung erfolgt bis an Ihre Haustür.',
 cta: 'Jetzt starten!',
 },
 tr: {
 title: 'Nasıl Çalışır?',
 subtitle: 'LOKMA ile sipariş vermek çok kolay. 6 basit adımda yerel esnaftan alışveriş yapın.',
 s1: 'Uygulamayı İndir', s1d: 'App Store veya Google Play\'den LOKMA uygulamasını ücretsiz indirin.',
 s2: 'Konumunuzu Seçin', s2d: 'Konum izni verin veya adresinizi manuel olarak girin. Size en yakın işletmeleri bulalım.',
 s3: 'Kategorileri Keşfedin', s3d: 'Market, kasap, restoran, çiçekçi ve daha fazla kategoriden dilediğinizi seçin.',
 s4: 'Ürünleri Sepete Ekleyin', s4d: 'İstediğiniz ürünleri seçin, miktarları belirleyin ve sepetinize ekleyin.',
 s5: 'Güvenli Ödeme', s5d: 'Kredi kartı, PayPal veya kapıda ödeme seçeneklerinden birini tercih edin.',
 s6: 'Teslimatı Bekleyin', s6d: 'Siparişinizi canlı takip edin. Kapınıza kadar teslimat yapılır.',
 cta: 'Hemen Başlayın!',
 },
 en: {
 title: 'How It Works',
 subtitle: 'Ordering with LOKMA is simple. Shop from local merchants in 6 easy steps.',
 s1: 'Download the App', s1d: 'Download the LOKMA app for free from the App Store or Google Play.',
 s2: 'Choose Your Location', s2d: 'Allow location access or enter your address manually. We\'ll find the nearest businesses for you.',
 s3: 'Explore Categories', s3d: 'Choose from categories like supermarket, butcher, restaurant, florist and more.',
 s4: 'Add Products to Cart', s4d: 'Select your desired products, set quantities and add them to your cart.',
 s5: 'Secure Payment', s5d: 'Choose between credit card, PayPal or cash on delivery.',
 s6: 'Await Delivery', s6d: 'Track your order live. Delivery right to your doorstep.',
 cta: 'Get Started Now!',
 },
 fr: {
 title: 'Comment ça marche ?',
 subtitle: 'Commander avec LOKMA est simple. Achetez chez les commerçants locaux en 6 étapes.',
 s1: 'Téléchargez l\'appli', s1d: 'Téléchargez l\'application LOKMA gratuitement sur l\'App Store ou Google Play.',
 s2: 'Choisissez votre position', s2d: 'Autorisez l\'accès à la localisation ou saisissez votre adresse. Nous trouverons les commerces les plus proches.',
 s3: 'Explorez les catégories', s3d: 'Choisissez parmi supermarché, boucherie, restaurant, fleuriste et plus.',
 s4: 'Ajoutez au panier', s4d: 'Sélectionnez vos produits, définissez les quantités et ajoutez-les à votre panier.',
 s5: 'Paiement sécurisé', s5d: 'Choisissez entre carte bancaire, PayPal ou paiement à la livraison.',
 s6: 'Attendez la livraison', s6d: 'Suivez votre commande en direct. Livraison jusqu\'à votre porte.',
 cta: 'Commencez maintenant !',
 },
 it: {
 title: 'Come funziona?',
 subtitle: 'Ordinare con LOKMA è semplice. Acquista dai commercianti locali in 6 semplici passi.',
 s1: 'Scarica l\'app', s1d: 'Scarica gratuitamente l\'app LOKMA dall\'App Store o da Google Play.',
 s2: 'Scegli la tua posizione', s2d: 'Consenti l\'accesso alla posizione o inserisci il tuo indirizzo. Troveremo i negozi più vicini.',
 s3: 'Esplora le categorie', s3d: 'Scegli tra supermercato, macelleria, ristorante, fioraio e altro.',
 s4: 'Aggiungi al carrello', s4d: 'Seleziona i prodotti desiderati, imposta le quantità e aggiungili al carrello.',
 s5: 'Pagamento sicuro', s5d: 'Scegli tra carta di credito, PayPal o pagamento alla consegna.',
 s6: 'Attendi la consegna', s6d: 'Segui il tuo ordine in tempo reale. Consegna fino alla tua porta.',
 cta: 'Inizia ora!',
 },
 es: {
 title: '¿Cómo funciona?',
 subtitle: 'Pedir con LOKMA es muy fácil. Compra en comercios locales en 6 simples pasos.',
 s1: 'Descarga la app', s1d: 'Descarga la aplicación LOKMA gratis desde App Store o Google Play.',
 s2: 'Elige tu ubicación', s2d: 'Permite el acceso a la ubicación o ingresa tu dirección. Encontraremos los comercios más cercanos.',
 s3: 'Explora categorías', s3d: 'Elige entre supermercado, carnicería, restaurante, floristería y más.',
 s4: 'Añade al carrito', s4d: 'Selecciona tus productos, define las cantidades y añádelos al carrito.',
 s5: 'Pago seguro', s5d: 'Elige entre tarjeta de crédito, PayPal o pago contra reembolso.',
 s6: 'Espera la entrega', s6d: 'Sigue tu pedido en vivo. Entrega hasta tu puerta.',
 cta: '¡Empieza ahora!',
 },
 nl: {
 title: 'Hoe werkt het?',
 subtitle: 'Bestellen met LOKMA is eenvoudig. Winkelen bij lokale handelaren in 6 simpele stappen.',
 s1: 'Download de app', s1d: 'Download de LOKMA-app gratis uit de App Store of Google Play.',
 s2: 'Kies uw locatie', s2d: 'Sta locatietoegang toe of voer uw adres handmatig in. Wij vinden de dichtstbijzijnde winkels.',
 s3: 'Ontdek categorieen', s3d: 'Kies uit categorieen zoals supermarkt, slager, restaurant, bloemist en meer.',
 s4: 'Producten in winkelwagen', s4d: 'Selecteer uw gewenste producten, stel hoeveelheden in en voeg ze toe aan uw winkelwagen.',
 s5: 'Veilig betalen', s5d: 'Kies tussen creditcard, PayPal of contante betaling bij bezorging.',
 s6: 'Wacht op bezorging', s6d: 'Volg uw bestelling live. Bezorging tot aan uw deur.',
 cta: 'Nu beginnen!',
 },
};

const icons = ['download', 'location_on', 'category', 'shopping_cart', 'payment', 'local_shipping'];

export default function HowItWorksPage() {
 const locale = useLocale();
 const tx = texts[locale] || texts['en'];
 const t = (k: string) => tx[k] || k;

 const steps = Array.from({ length: 6 }, (_, i) => ({
 number: String(i + 1).padStart(2, '0'),
 title: t(`s${i + 1}`),
 description: t(`s${i + 1}d`),
 icon: icons[i],
 }));

 return (
 <div className="relative flex min-h-screen flex-col bg-background dark:bg-[#0f172a] text-foreground font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
 <PublicHeader themeAware={true} />

 <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40">
 <div className="max-w-[1000px] mx-auto">
 <div className="text-center mb-16">
 <h1 className="text-4xl md:text-5xl font-black mb-6">{t('title')}</h1>
 <p className="text-xl text-muted-foreground/80 /60 max-w-2xl mx-auto">{t('subtitle')}</p>
 </div>

 <div className="space-y-8">
 {steps.map((step, index) => (
 <div
 key={step.number}
 className={`flex flex-col md:flex-row items-start gap-8 p-8 rounded-2xl ${index % 2 === 0 ? 'bg-muted/30 dark:bg-background/5' : 'bg-[#ea184a]/5'} border border-border/50 `}
 >
 <div className="flex-shrink-0">
 <div className="w-16 h-16 bg-[#ea184a] rounded-2xl flex items-center justify-center">
 <span className="material-symbols-outlined text-white text-3xl">{step.icon}</span>
 </div>
 </div>
 <div>
 <div className="text-[#ea184a] font-bold text-sm mb-2">{step.number}</div>
 <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
 <p className="text-muted-foreground/80 /60 text-lg">{step.description}</p>
 </div>
 </div>
 ))}
 </div>

 <div className="mt-16 text-center">
 <h3 className="text-2xl font-bold mb-6">{t('cta')}</h3>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <a
 href="https://apps.apple.com/app/lokma"
 className="flex items-center justify-center gap-3 bg-background text-black px-8 py-4 rounded-xl font-bold hover:bg-muted transition-all"
 >
 <span className="text-2xl"></span>
 App Store
 </a>
 <a
 href="https://play.google.com/store/apps/details?id=com.lokma.app"
 className="flex items-center justify-center gap-3 bg-background text-black px-8 py-4 rounded-xl font-bold hover:bg-muted transition-all"
 >
 <span className="text-2xl">▶️</span>
 Google Play
 </a>
 </div>
 </div>
 </div>
 </main>

 <PublicFooter themeAware={true} />
 <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
 </div>
 );
}
