'use client';

import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// A6 dimensions in mm
const A6_WIDTH = 105;
const A6_HEIGHT = 148;

// LOKMA brand color
const LOKMA_RED: [number, number, number] = [255, 0, 51]; // #FF0033

// ------------------------------------------------------------------
// Language text sets
// ------------------------------------------------------------------
type CardLang = 'tr' | 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl';

interface CardTexts {
  partnerLine: string;
  tablePrefix: string;
  cta: string;
  step1: string;
  step2: string;
  step3: string;
  groupOrderInfo: string;
  bannerSub: string;
  afiyetOlsun: string;
}

const CARD_TEXTS: Record<CardLang, CardTexts> = {
  tr: {
    partnerLine: 'Bu isletme bir LOKMA Partneridir',
    tablePrefix: 'Masa',
    cta: 'Hemen Okut, Masana Gelsin!',
    step1: 'Menuyu Gor',
    step2: 'Siparis Ver',
    step3: 'Kalkmadan Ode',
    groupOrderInfo: 'Grup siparisi icin QR kodu MASADAN SADECE 1 KISI okutmalidir. Acilan sayfadaki linki WhatsApp vb. ile arkadaslariniza gondererek herkesin ayni siparise urun eklemesini saglayabilirsiniz.',
    bannerSub: 'iOS & Android  |  lokma.app',
    afiyetOlsun: 'Afiyet Olsun!',
  },
  de: {
    partnerLine: 'Dieses Unternehmen ist ein LOKMA Partner',
    tablePrefix: 'Tisch',
    cta: 'Jetzt scannen, direkt bestellen!',
    step1: 'Speisekarte',
    step2: 'Bestellen',
    step3: 'Am Tisch bezahlen',
    groupOrderInfo: 'Für eine Gruppenbestellung sollte NUR 1 PERSON den QR-Code scannen. Teilen Sie dann den Link (zB über WhatsApp) mit Ihrem Tisch, damit jeder Artikel zur gemeinsamen Bestellung hinzufügen kann.',
    bannerSub: 'iOS & Android  |  lokma.app',
    afiyetOlsun: 'Guten Appetit!',
  },
  en: {
    partnerLine: 'This business is a LOKMA Partner',
    tablePrefix: 'Table',
    cta: 'Scan now, order to your table!',
    step1: 'View Menu',
    step2: 'Place Order',
    step3: 'Pay at Table',
    groupOrderInfo: 'For a group order, ONLY 1 PERSON should scan the QR code. Share the link from the opened page with your table to allow everyone to add items to the joint order from their own phones.',
    bannerSub: 'iOS & Android  |  lokma.app',
    afiyetOlsun: 'Bon Appetit!',
  },
  fr: {
    partnerLine: 'Cet etablissement est un partenaire LOKMA',
    tablePrefix: 'Table',
    cta: 'Scannez et commandez a votre table !',
    step1: 'Voir le menu',
    step2: 'Commander',
    step3: 'Payer a table',
    groupOrderInfo: 'Pour une commande de groupe, 1 SEULE PERSONNE doit scanner le code QR. Partagez le lien avec votre table pour que chacun puisse ajouter des articles a la commande commune.',
    bannerSub: 'iOS & Android  |  lokma.app',
    afiyetOlsun: 'Bon Appetit !',
  },
  es: {
    partnerLine: 'Este negocio es un socio de LOKMA',
    tablePrefix: 'Mesa',
    cta: 'Escanea y pide en tu mesa!',
    step1: 'Ver menu',
    step2: 'Hacer pedido',
    step3: 'Pagar en mesa',
    groupOrderInfo: 'Para un pedido grupal, SOLO 1 PERSONA debe escanear el codigo QR. Comparta el enlace con su mesa para que todos puedan agregar articulos al pedido conjunto.',
    bannerSub: 'iOS & Android  |  lokma.app',
    afiyetOlsun: 'Buen Provecho!',
  },
  it: {
    partnerLine: 'Questo locale e un partner LOKMA',
    tablePrefix: 'Tavolo',
    cta: 'Scansiona e ordina al tavolo!',
    step1: 'Vedi menu',
    step2: 'Ordina',
    step3: 'Paga al tavolo',
    groupOrderInfo: 'Per un ordine di gruppo, SOLO 1 PERSONA deve scansionare il codice QR. Condividi il link con il tuo tavolo in modo che tutti possano aggiungere articoli all\'ordine congiunto.',
    bannerSub: 'iOS & Android  |  lokma.app',
    afiyetOlsun: 'Buon Appetito!',
  },
  nl: {
    partnerLine: 'Dit bedrijf is een LOKMA Partner',
    tablePrefix: 'Tafel',
    cta: 'Scan en bestel aan tafel!',
    step1: 'Bekijk menu',
    step2: 'Bestellen',
    step3: 'Betaal aan tafel',
    groupOrderInfo: 'Voor een groepsbestelling hoeft SLECHTS 1 PERSOON de QR-code te scannen. Deel de link met uw tafel, zodat iedereen vanaf zijn eigen telefoon items kan toevoegen aan de gezamenlijke bestelling.',
    bannerSub: 'iOS & Android  |  lokma.app',
    afiyetOlsun: 'Eet Smakelijk!',
  },
};

// ------------------------------------------------------------------
// Determine card languages based on business country
// ------------------------------------------------------------------
// Rule: always Turkish + local language
// Exception: Turkey = Turkish + English
function getCardLanguages(country?: string): [CardLang, CardLang] {
  const c = (country || 'DE').toUpperCase();
  const countryToLang: Record<string, CardLang> = {
    DE: 'de',
    AT: 'de',
    CH: 'de',
    FR: 'fr',
    ES: 'es',
    IT: 'it',
    NL: 'nl',
    BE: 'nl',
    GB: 'en',
    US: 'en',
    TR: 'tr',
  };
  const localLang = countryToLang[c] || 'en';

  if (c === 'TR') {
    // Turkiye: Turkce + Ingilizce
    return ['tr', 'en'];
  }
  // Diger ulkeler: Turkce + yerel dil
  return ['tr', localLang];
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generateQRCodeBase64(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 600,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
}

// ------------------------------------------------------------------
// Render a single card page onto an existing jsPDF doc
// ------------------------------------------------------------------
function renderCardPage(
  doc: jsPDF,
  opts: {
    tableLabel: string;
    companyName: string;
    logoBase64: string;
    qrBase64: string;
    lang: CardLang;
  },
) {
  const { tableLabel, companyName, logoBase64, qrBase64, lang } = opts;
  const txt = CARD_TEXTS[lang];

  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, A6_WIDTH, A6_HEIGHT, 'F');

  // Top red accent line
  doc.setFillColor(...LOKMA_RED);
  doc.rect(0, 0, A6_WIDTH, 3, 'F');

  // LOKMA Logo
  const logoWidth = 55;
  const logoHeight = 16;
  const logoX = (A6_WIDTH - logoWidth) / 2;
  const logoY = 10;
  try {
    doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch {
    doc.setFontSize(24);
    doc.setTextColor(...LOKMA_RED);
    doc.setFont('helvetica', 'bold');
    doc.text('LOKMA', A6_WIDTH / 2, logoY + 12, { align: 'center' });
  }

  // Partner text
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.text(txt.partnerLine, A6_WIDTH / 2, 31, { align: 'center' });

  // Divider line
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(20, 35, A6_WIDTH - 20, 35);

  // Business name
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  const displayName =
    companyName.length > 30 ? companyName.substring(0, 28) + '...' : companyName;
  doc.text(displayName, A6_WIDTH / 2, 41, { align: 'center' });

  // Table label badge
  const tableLabelText = `${txt.tablePrefix} ${tableLabel}`;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(32, 44, 41, 8, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'bold');
  doc.text(tableLabelText, A6_WIDTH / 2, 49.5, { align: 'center' });

  // QR Code
  const qrSize = 42;
  const qrX = (A6_WIDTH - qrSize) / 2;
  const qrY = 56;

  // QR border/shadow
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 2, 2, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 2, 2, 'S');

  // QR image
  doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);

  // CTA text
  doc.setFontSize(11);
  doc.setTextColor(...LOKMA_RED);
  doc.setFont('helvetica', 'bold');
  doc.text(txt.cta, A6_WIDTH / 2, 106, { align: 'center' });

  // Feature steps
  const featureY = 111;
  const features = [
    { icon: '1', text: txt.step1 },
    { icon: '2', text: txt.step2 },
    { icon: '3', text: txt.step3 },
  ];
  const featureWidth = A6_WIDTH / 3;
  features.forEach((feature, i) => {
    const x = featureWidth * i + featureWidth / 2;

    // Circle
    doc.setFillColor(...LOKMA_RED);
    doc.circle(x, featureY + 3, 3.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(feature.icon, x, featureY + 4.2, { align: 'center' });

    // Text
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(feature.text, x, featureY + 11, { align: 'center' });
  });

  // Group Order Info
  doc.setFontSize(5.5);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  const groupTextLines = doc.splitTextToSize(txt.groupOrderInfo, A6_WIDTH - 20);
  doc.text(groupTextLines, A6_WIDTH / 2, 126, { align: 'center' });

  // "Afiyet Olsun" text - above the bottom banner
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'italic');
  doc.text(txt.afiyetOlsun, A6_WIDTH / 2, 134, { align: 'center' });

  // Bottom red banner
  const bannerHeight = 10;
  const bannerY = A6_HEIGHT - bannerHeight;
  doc.setFillColor(...LOKMA_RED);
  doc.rect(0, bannerY, A6_WIDTH, bannerHeight, 'F');

  // Banner text
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text(txt.bannerSub, A6_WIDTH / 2, bannerY + 5.5, { align: 'center' });
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Generates an A6 table card for a single language.
 */
export async function generateTableCardPDF(
  tableLabel: string,
  businessId: string,
  companyName: string,
  lang: CardLang = 'tr',
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [A6_WIDTH, A6_HEIGHT],
  });

  const qrUrl = `https://lokma.web.app/dinein/${businessId}/table/${tableLabel}`;
  const [logoBase64, qrBase64] = await Promise.all([
    fetchImageAsBase64('/lokma_logo_wide.png'),
    generateQRCodeBase64(qrUrl),
  ]);

  renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang });
  return doc;
}

/**
 * Generates a dual-language A6 table card PDF (2 pages: primary + secondary).
 * Language pair is determined by the business country.
 */
export async function generateDualLangTableCardPDF(
  tableLabel: string,
  businessId: string,
  companyName: string,
  country?: string,
): Promise<jsPDF> {
  const [lang1, lang2] = getCardLanguages(country);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [A6_WIDTH, A6_HEIGHT],
  });

  const qrUrl = `https://lokma.web.app/dinein/${businessId}/table/${tableLabel}`;
  const [logoBase64, qrBase64] = await Promise.all([
    fetchImageAsBase64('/lokma_logo_wide.png'),
    generateQRCodeBase64(qrUrl),
  ]);

  // Page 1: primary language
  renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang: lang1 });

  // Page 2: secondary language
  doc.addPage([A6_WIDTH, A6_HEIGHT]);
  renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang: lang2 });

  return doc;
}

/**
 * Downloads a dual-language table card PDF for a single table.
 */
export async function downloadTableCardPDF(
  tableLabel: string,
  businessId: string,
  companyName: string,
  country?: string,
): Promise<void> {
  const doc = await generateDualLangTableCardPDF(tableLabel, businessId, companyName, country);
  doc.save(`Masa_${tableLabel}_LOKMA_Kart.pdf`);
}

/**
 * Downloads all table cards as individual dual-language PDFs.
 */
export async function downloadAllTableCardPDFs(
  tables: Array<{ label: string; section?: string }>,
  businessId: string,
  companyName: string,
  country?: string,
): Promise<void> {
  for (const table of tables) {
    const doc = await generateDualLangTableCardPDF(table.label, businessId, companyName, country);
    doc.save(`Masa_${table.label}_LOKMA_Kart.pdf`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

/**
 * Downloads all table cards combined into a single multi-page dual-language PDF.
 * Each table gets 2 consecutive pages (primary lang, then secondary lang).
 */
export async function downloadAllTableCardsAsSinglePDF(
  tables: Array<{ label: string; section?: string }>,
  businessId: string,
  companyName: string,
  country?: string,
): Promise<void> {
  if (tables.length === 0) return;

  const [lang1, lang2] = getCardLanguages(country);
  const logoBase64 = await fetchImageAsBase64('/lokma_logo_wide.png');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [A6_WIDTH, A6_HEIGHT],
  });

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const qrUrl = `https://lokma.web.app/dinein/${businessId}/table/${table.label}`;
    const qrBase64 = await generateQRCodeBase64(qrUrl);

    // Add page break between tables (not before first)
    if (i > 0) {
      doc.addPage([A6_WIDTH, A6_HEIGHT]);
    }

    // Page for primary language (e.g. Turkish)
    renderCardPage(doc, {
      tableLabel: table.label,
      companyName,
      logoBase64,
      qrBase64,
      lang: lang1,
    });

    // Page for secondary language (e.g. German)
    doc.addPage([A6_WIDTH, A6_HEIGHT]);
    renderCardPage(doc, {
      tableLabel: table.label,
      companyName,
      logoBase64,
      qrBase64,
      lang: lang2,
    });
  }

  doc.save(
    `LOKMA_Tum_Masa_Kartlari_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
  );
}

// Re-export the type for external use
export type { CardLang };
export { getCardLanguages, CARD_TEXTS };
