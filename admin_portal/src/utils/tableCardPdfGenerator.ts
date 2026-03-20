'use client';

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64, DANCING_SCRIPT_BASE64 } from './tableCardFonts';

// A6 dimensions in mm
const A6_WIDTH = 105;
const A6_HEIGHT = 148;

// LOKMA brand color
const LOKMA_RED: [number, number, number] = [238, 54, 64]; // #EE3640

// ------------------------------------------------------------------
// Register custom fonts with jsPDF for Unicode (Turkish chars) support
// ------------------------------------------------------------------
function registerFonts(doc: jsPDF) {
  // Roboto Regular
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

  // Roboto Bold
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

  // Dancing Script (cursive/script)
  doc.addFileToVFS('DancingScript-Bold.ttf', DANCING_SCRIPT_BASE64);
  doc.addFont('DancingScript-Bold.ttf', 'DancingScript', 'normal');
}

// ------------------------------------------------------------------
// Language text sets
// ------------------------------------------------------------------
type CardLang = 'tr' | 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl';

interface CardTexts {
  partnerLine: string;
  tablePrefix: string;
  cta: string;
  steps: { title: string; desc: string }[];
  afiyetOlsun: string;
}

const CARD_TEXTS: Record<CardLang, CardTexts> = {
  tr: {
    partnerLine: 'Bu i\u015fletme bir LOKMA Partneridir',
    tablePrefix: 'Masa',
    cta: 'Hemen Okut, Masana Gelsin!',
    steps: [
      { title: 'Men\u00fcy\u00fc G\u00f6r:', desc: 'Dijital men\u00fcye eri\u015fin.' },
      { title: 'Sipari\u015f Ver:', desc: 'Masadan sipari\u015f verin.' },
      { title: '\u00d6deme Yap:', desc: 'Masadan \u00f6demenizi yap\u0131n.' },
      { title: 'Grup Sipari\u015fi:', desc: 'Ortak sipari\u015f verin. Hesab\u0131 ay\u0131r\u0131n veya tek ki\u015fi \u00f6desin.' }
    ],
    afiyetOlsun: 'Afiyet Olsun!',
  },
  de: {
    partnerLine: 'Dieses Restaurant ist ein LOKMA Partner',
    tablePrefix: 'Tisch',
    cta: 'Jetzt scannen & bestellen!',
    steps: [
      { title: 'Speisekarte:', desc: 'Digitale Karte aufrufen.' },
      { title: 'Bestellen:', desc: 'Direkt vom Tisch bestellen.' },
      { title: 'Bezahlen:', desc: 'Bequem am Tisch bezahlen.' },
      { title: 'Gruppenbestellung:', desc: 'Zusammen bestellen. Rechnung teilen oder einzeln zahlen.' }
    ],
    afiyetOlsun: 'Guten Appetit!',
  },
  en: {
    partnerLine: 'This restaurant is a LOKMA Partner',
    tablePrefix: 'Table',
    cta: 'Scan now, order to your table!',
    steps: [
      { title: 'View Menu:', desc: 'Access the digital menu.' },
      { title: 'Order:', desc: 'Place order from the table.' },
      { title: 'Pay:', desc: 'Pay directly from the table.' },
      { title: 'Group Order:', desc: 'Order together. Split the bill or pay as one.' }
    ],
    afiyetOlsun: 'Bon Appetit!',
  },
  fr: {
    partnerLine: 'Ce restaurant est un partenaire LOKMA',
    tablePrefix: 'Table',
    cta: 'Scannez et commandez !',
    steps: [
      { title: 'Voir le menu:', desc: 'Acc\u00e9der au menu num\u00e9rique.' },
      { title: 'Commander:', desc: 'Commandez depuis la table.' },
      { title: 'Payer:', desc: 'Payez directement \u00e0 table.' },
      { title: 'Commande group\u00e9e:', desc: 'Commandez ensemble. Partagez l\'addition ou payez seul.' }
    ],
    afiyetOlsun: 'Bon App\u00e9tit !',
  },
  es: {
    partnerLine: 'Este restaurante es un socio de LOKMA',
    tablePrefix: 'Mesa',
    cta: '\u00a1Escanea y pide a tu mesa!',
    steps: [
      { title: 'Ver men\u00fa:', desc: 'Accede al men\u00fa digital.' },
      { title: 'Pedir:', desc: 'Haz el pedido desde tu mesa.' },
      { title: 'Pagar:', desc: 'Paga directamente en la mesa.' },
      { title: 'Pedido Grupal:', desc: 'Pidan juntos. Dividan la cuenta o paguen juntos.' }
    ],
    afiyetOlsun: '\u00a1Buen Provecho!',
  },
  it: {
    partnerLine: 'Questo ristorante \u00e8 un partner LOKMA',
    tablePrefix: 'Tavolo',
    cta: 'Scansiona e ordina!',
    steps: [
      { title: 'Vedi menu:', desc: 'Accedi al menu digitale.' },
      { title: 'Ordina:', desc: 'Ordina comodamente dal tavolo.' },
      { title: 'Paga:', desc: 'Paga direttamente al tavolo.' },
      { title: 'Ordine di Gruppo:', desc: 'Ordina insieme. Dividi il conto o paga in un\'unica soluzione.' }
    ],
    afiyetOlsun: 'Buon Appetito!',
  },
  nl: {
    partnerLine: 'Dit restaurant is een LOKMA Partner',
    tablePrefix: 'Tafel',
    cta: 'Scan en bestel!',
    steps: [
      { title: 'Bekijk menu:', desc: 'Toegang tot het digitale menu.' },
      { title: 'Bestellen:', desc: 'Plaats bestelling vanaf tafel.' },
      { title: 'Betalen:', desc: 'Betaal direct aan tafel.' },
      { title: 'Groepsbestelling:', desc: 'Samen bestellen. Splits de rekening of betaal tezamen.' }
    ],
    afiyetOlsun: 'Eet Smakelijk!',
  },
};

// ------------------------------------------------------------------
// Determine card languages based on business country
// ------------------------------------------------------------------
function getCardLanguages(country?: string): [CardLang, CardLang] {
  const c = (country || 'DE').toUpperCase();
  const countryToLang: Record<string, CardLang> = {
    DE: 'de', AT: 'de', CH: 'de',
    FR: 'fr', ES: 'es', IT: 'it',
    NL: 'nl', BE: 'nl',
    GB: 'en', US: 'en', TR: 'tr',
  };
  const localLang = countryToLang[c] || 'en';
  if (c === 'TR') return ['tr', 'en'];
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
    width: 800,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
}

// ------------------------------------------------------------------
// Render a single card page
// ------------------------------------------------------------------
function renderCardPage(
  doc: jsPDF,
  opts: {
    tableLabel: string;
    companyName: string;
    logoBase64: string;
    qrBase64: string;
    lang: CardLang;
    appStoreBadge?: string;
    googlePlayBadge?: string;
  },
) {
  const { tableLabel, companyName, logoBase64, qrBase64, lang, appStoreBadge, googlePlayBadge } = opts;
  const txt = CARD_TEXTS[lang];
  const PAD = 8;

  // ---- White background ----
  doc.setFillColor(248, 248, 248);
  doc.rect(0, 0, A6_WIDTH, A6_HEIGHT, 'F');

  // ================================================================
  // TOP: Brand color strip (~4mm / ~15px)
  // ================================================================
  const stripH = 4; // mm
  doc.setFillColor(...LOKMA_RED);
  doc.rect(0, 0, A6_WIDTH, stripH, 'F');

  // ================================================================
  // TOP SECTION: Business Name + Table Number
  // ================================================================
  const contentStartY = stripH + 10; // offset past the strip
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  const titleLines = doc.splitTextToSize(companyName, A6_WIDTH - PAD * 2);
  doc.text(titleLines, A6_WIDTH / 2, contentStartY, { align: 'center' });
  const titleH = titleLines.length * 6;

  // Table label ("Masa 1")
  const tableY = contentStartY + titleH + 1;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`${txt.tablePrefix} ${tableLabel}`, A6_WIDTH / 2, tableY, { align: 'center' });

  // ================================================================
  // QR CODE (centered, large)
  // ================================================================
  const qrSize = 48;
  const qrX = (A6_WIDTH - qrSize) / 2;
  const qrY = tableY + 5;

  // White pad behind QR
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 'F');
  doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);

  // ================================================================
  // CTA + STEPS
  // ================================================================
  // Red CTA
  const ctaY = qrY + qrSize + 8;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...LOKMA_RED);
  doc.text(txt.cta, A6_WIDTH / 2, ctaY, { align: 'center' });

  // Bullet steps
  let currentY = ctaY + 8;
  const leftX = PAD + 5;

  txt.steps.forEach((step) => {
    // Bullet dot (dark)
    doc.setFillColor(40, 40, 40);
    doc.circle(leftX - 3.5, currentY - 1.2, 1.2, 'F');

    // Title (bold)
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(step.title, leftX, currentY);
    const tw = doc.getTextWidth(step.title + ' ');

    // Description (normal)
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(60, 60, 60);

    const maxW = A6_WIDTH - PAD - leftX - tw;
    if (maxW > 25) {
      const descLines = doc.splitTextToSize(step.desc, maxW);
      if (descLines.length <= 1) {
        doc.text(step.desc, leftX + tw, currentY);
        currentY += 7;
      } else {
        // First part on same line, rest below indented
        doc.text(descLines[0], leftX + tw, currentY);
        for (let i = 1; i < descLines.length; i++) {
          currentY += 4;
          doc.text(descLines[i], leftX + tw, currentY);
        }
        currentY += 7;
      }
    } else {
      // Full wrap below title
      const descLines = doc.splitTextToSize(step.desc, A6_WIDTH - PAD * 2 - 5);
      doc.text(descLines[0], leftX + tw, currentY);
      for (let i = 1; i < descLines.length; i++) {
        currentY += 4;
        doc.text(descLines[i], leftX + tw, currentY);
      }
      currentY += 7;
    }
  });

  // ================================================================
  // "Afiyet Olsun!" - Script/Cursive font
  // ================================================================
  const afiyetY = currentY + 2;
  doc.setFont('DancingScript', 'normal');
  doc.setFontSize(24);
  doc.setTextColor(...LOKMA_RED);
  doc.text(txt.afiyetOlsun, A6_WIDTH / 2, afiyetY, { align: 'center' });

  // ================================================================
  // THIN DIVIDER LINE
  // ================================================================
  const divY = afiyetY + 5;
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.25);
  doc.line(PAD, divY, A6_WIDTH - PAD, divY);

  // ================================================================
  // BOTTOM BAR: Logo (left) + Partner text & badges (right)
  // ================================================================
  const bottomStartY = divY + 3;

  // LEFT: LOKMA logo (actual ratio: 4364x1201 = 3.63:1)
  const logoW = 28;
  const logoH = logoW / 3.63; // ~7.7mm - preserves aspect ratio
  try {
    doc.addImage(logoBase64, 'PNG', PAD, bottomStartY, logoW, logoH);
  } catch {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...LOKMA_RED);
    doc.text('LOKMA', PAD, bottomStartY + 6);
  }

  // RIGHT: Partner text
  const rightEdge = A6_WIDTH - PAD;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(80, 80, 80);
  doc.text(txt.partnerLine, rightEdge, bottomStartY + 3, { align: 'right' });

  // RIGHT: App Store + Google Play badges (real images)
  // App Store badge: 498x167 (ratio 2.98:1)
  const asBadgeW = 18;
  const asBadgeH = asBadgeW / 3; // ~6mm
  // Google Play badge: 1920x1080 -- but badge area itself is rectangular like 3.4:1
  const gpBadgeW = 18;
  const gpBadgeH = gpBadgeW / 3; // ~6mm - match App Store height
  const badgeY = bottomStartY + 5;
  const badge1X = rightEdge - asBadgeW - gpBadgeW - 3;
  const badge2X = rightEdge - gpBadgeW;

  if (appStoreBadge) {
    try {
      doc.addImage(appStoreBadge, 'PNG', badge1X, badgeY, asBadgeW, asBadgeH);
    } catch {
      // fallback text badge
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(badge1X, badgeY, asBadgeW, asBadgeH, 1, 1, 'F');
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(4);
      doc.setTextColor(255, 255, 255);
      doc.text('App Store', badge1X + asBadgeW / 2, badgeY + 3.8, { align: 'center' });
    }
  }

  if (googlePlayBadge) {
    try {
      doc.addImage(googlePlayBadge, 'PNG', badge2X, badgeY, gpBadgeW, gpBadgeH);
    } catch {
      // fallback text badge
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(badge2X, badgeY, gpBadgeW, gpBadgeH, 1, 1, 'F');
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(4);
      doc.setTextColor(255, 255, 255);
      doc.text('Google Play', badge2X + gpBadgeW / 2, badgeY + 3.8, { align: 'center' });
    }
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

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
  registerFonts(doc);

  const qrUrl = `https://lokma.web.app/dinein/${businessId}/table/${tableLabel}`;
  const [logoBase64, qrBase64, appStoreBadge, googlePlayBadge] = await Promise.all([
    fetchImageAsBase64('/logo_qr_lokma_red.png'),
    generateQRCodeBase64(qrUrl),
    fetchImageAsBase64('/app_store_badge.png').catch(() => ''),
    fetchImageAsBase64('/google_play_badge.png').catch(() => ''),
  ]);

  renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang, appStoreBadge, googlePlayBadge });
  return doc;
}

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
  registerFonts(doc);

  const qrUrl = `https://lokma.web.app/dinein/${businessId}/table/${tableLabel}`;
  const [logoBase64, qrBase64, appStoreBadge, googlePlayBadge] = await Promise.all([
    fetchImageAsBase64('/logo_qr_lokma_red.png'),
    generateQRCodeBase64(qrUrl),
    fetchImageAsBase64('/app_store_badge.png').catch(() => ''),
    fetchImageAsBase64('/google_play_badge.png').catch(() => ''),
  ]);

  renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang: lang1, appStoreBadge, googlePlayBadge });
  doc.addPage([A6_WIDTH, A6_HEIGHT]);
  renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang: lang2, appStoreBadge, googlePlayBadge });

  return doc;
}

export async function downloadTableCardPDF(
  tableLabel: string,
  businessId: string,
  companyName: string,
  country?: string,
): Promise<void> {
  const doc = await generateDualLangTableCardPDF(tableLabel, businessId, companyName, country);
  doc.save(`Masa_${tableLabel}_LOKMA_Kart.pdf`);
}

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

export async function downloadAllTableCardsAsSinglePDF(
  tables: Array<{ label: string; section?: string }>,
  businessId: string,
  companyName: string,
  country?: string,
): Promise<void> {
  if (tables.length === 0) return;

  const [lang1, lang2] = getCardLanguages(country);
  const [logoBase64, appStoreBadge, googlePlayBadge] = await Promise.all([
    fetchImageAsBase64('/logo_qr_lokma_red.png'),
    fetchImageAsBase64('/app_store_badge.png').catch(() => ''),
    fetchImageAsBase64('/google_play_badge.png').catch(() => ''),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [A6_WIDTH, A6_HEIGHT],
  });
  registerFonts(doc);

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const qrUrl = `https://lokma.web.app/dinein/${businessId}/table/${table.label}`;
    const qrBase64 = await generateQRCodeBase64(qrUrl);

    if (i > 0) doc.addPage([A6_WIDTH, A6_HEIGHT]);
    renderCardPage(doc, { tableLabel: table.label, companyName, logoBase64, qrBase64, lang: lang1, appStoreBadge, googlePlayBadge });

    doc.addPage([A6_WIDTH, A6_HEIGHT]);
    renderCardPage(doc, { tableLabel: table.label, companyName, logoBase64, qrBase64, lang: lang2, appStoreBadge, googlePlayBadge });
  }

  doc.save(`LOKMA_Tum_Masa_Kartlari_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

export type { CardLang };
export { getCardLanguages, CARD_TEXTS };
