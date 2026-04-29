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
 kermesPartnerLine: string;
 tablePrefix: string;
 cta: string;
 steps: { title: string; desc: string }[];
 afiyetOlsun: string;
}

const CARD_TEXTS: Record<CardLang, CardTexts> = {
 tr: {
 partnerLine: 'Bu i\u015fletme bir LOKMA Partneridir',
 kermesPartnerLine: 'Bu Kermes bir LOKMA Partneridir',
 tablePrefix: 'Masa',
 cta: 'Hemen Okut, Masana Gelsin!',
 steps: [
 { title: 'Men\u00fcy\u00fc G\u00f6r:', desc: 'Dijital men\u00fcye eri\u015fin.' },
 { title: 'Sipari\u015f Ver:', desc: 'Masadan sipari\u015f verin.' },
 { title: '\u00d6deme Yap:', desc: 'Masadan \u00f6demenizi yap\u0131n.' },
 { title: 'Grup Sipari\u015fi:', desc: 'Ortak sipari\u015f verin. Hesab\u0131 ay\u0131r\u0131n veya tek ki\u015fi \u00f6desin.' }
 ],
 afiyetOlsun: 'Afiyet Olsun!',
 sectionLabels: { 'Bölüm - H': 'Bölüm - H', 'Bölüm - E': 'Bölüm - E', 'Aile Bölümü': 'Aile Bölümü' }
 },
 de: {
 partnerLine: 'Dieses Restaurant ist ein LOKMA Partner',
 kermesPartnerLine: 'Diese Kermes ist ein LOKMA Partner',
 tablePrefix: 'Tisch',
 cta: 'Jetzt scannen & bestellen!',
 steps: [
 { title: 'Speisekarte:', desc: 'Digitale Karte aufrufen.' },
 { title: 'Bestellen:', desc: 'Direkt vom Tisch bestellen.' },
 { title: 'Bezahlen:', desc: 'Bequem am Tisch bezahlen.' },
 { title: 'Gruppenbestellung:', desc: 'Zusammen bestellen. Rechnung teilen oder einzeln zahlen.' }
 ],
 afiyetOlsun: 'Guten Appetit!',
 sectionLabels: { 'Bölüm - H': 'Bereich - H', 'Bölüm - E': 'Bereich - E', 'Aile Bölümü': 'Familienbereich' }
 },
 en: {
 partnerLine: 'This restaurant is a LOKMA Partner',
 kermesPartnerLine: 'This Kermes is a LOKMA Partner',
 tablePrefix: 'Table',
 cta: 'Scan now, order to your table!',
 steps: [
 { title: 'View Menu:', desc: 'Access the digital menu.' },
 { title: 'Order:', desc: 'Place order from the table.' },
 { title: 'Pay:', desc: 'Pay directly from the table.' },
 { title: 'Group Order:', desc: 'Order together. Split the bill or pay as one.' }
 ],
 afiyetOlsun: 'Bon Appetit!',
 sectionLabels: { 'Bölüm - H': 'Section - H', 'Bölüm - E': 'Section - E', 'Aile Bölümü': 'Family Section' }
 },
 fr: {
 partnerLine: 'Ce restaurant est un partenaire LOKMA',
 kermesPartnerLine: 'Cette Kermes est un partenaire LOKMA',
 tablePrefix: 'Table',
 cta: 'Scannez et commandez !',
 steps: [
 { title: 'Voir le menu:', desc: 'Acc\u00e9der au menu num\u00e9rique.' },
 { title: 'Commander:', desc: 'Commandez depuis la table.' },
 { title: 'Payer:', desc: 'Payez directement \u00e0 table.' },
 { title: 'Commande group\u00e9e:', desc: 'Commandez ensemble. Partagez l\'addition ou payez seul.' }
 ],
 afiyetOlsun: 'Bon App\u00e9tit !',
 sectionLabels: { 'Bölüm - H': 'Section - H', 'Bölüm - E': 'Section - E', 'Aile Bölümü': 'Espace Famille' }
 },
 es: {
 partnerLine: 'Este restaurante es un socio de LOKMA',
 kermesPartnerLine: 'Esta Kermes es un socio de LOKMA',
 tablePrefix: 'Mesa',
 cta: '\u00a1Escanea y pide a tu mesa!',
 steps: [
 { title: 'Ver men\u00fa:', desc: 'Accede al men\u00fa digital.' },
 { title: 'Pedir:', desc: 'Haz el pedido desde tu mesa.' },
 { title: 'Pagar:', desc: 'Paga directamente en la mesa.' },
 { title: 'Pedido Grupal:', desc: 'Pidan juntos. Dividan la cuenta o paguen juntos.' }
 ],
 afiyetOlsun: '\u00a1Buen Provecho!',
 sectionLabels: { 'Bölüm - H': 'Sección - H', 'Bölüm - E': 'Sección - E', 'Aile Bölümü': 'Zona Familiar' }
 },
 it: {
 partnerLine: 'Questo ristorante \u00e8 un partner LOKMA',
 kermesPartnerLine: 'Questa Kermes \u00e8 un partner LOKMA',
 tablePrefix: 'Tavolo',
 cta: 'Scansiona e ordina!',
 steps: [
 { title: 'Vedi menu:', desc: 'Accedi al menu digitale.' },
 { title: 'Ordina:', desc: 'Ordina comodamente dal tavolo.' },
 { title: 'Paga:', desc: 'Paga direttamente al tavolo.' },
 { title: 'Ordine di Gruppo:', desc: 'Ordina insieme. Dividi il conto o paga in un\'unica soluzione.' }
 ],
 afiyetOlsun: 'Buon Appetito!',
 sectionLabels: { 'Bölüm - H': 'Sezione - H', 'Bölüm - E': 'Sezione - E', 'Aile Bölümü': 'Area Famiglia' }
 },
 nl: {
 partnerLine: 'Dit restaurant is een LOKMA Partner',
 kermesPartnerLine: 'Deze Kermes is een LOKMA Partner',
 tablePrefix: 'Tafel',
 cta: 'Scan en bestel!',
 steps: [
 { title: 'Bekijk menu:', desc: 'Toegang tot het digitale menu.' },
 { title: 'Bestellen:', desc: 'Plaats bestelling vanaf tafel.' },
 { title: 'Betalen:', desc: 'Betaal direct aan tafel.' },
 { title: 'Groepsbestelling:', desc: 'Samen bestellen. Splits de rekening of betaal tezamen.' }
 ],
 afiyetOlsun: 'Eet Smakelijk!',
 sectionLabels: { 'Bölüm - H': 'Sectie - H', 'Bölüm - E': 'Sectie - E', 'Aile Bölümü': 'Familiegedeelte' }
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
 isKermes?: boolean;
 sponsorLogos?: { base64: string; name: string; bgColor?: string }[];
 sectionLabel?: string;
 businessLogoBase64?: string;
 tunaLogoBase64?: string;
 },
) {
 const { tableLabel, companyName, logoBase64, qrBase64, lang, appStoreBadge, googlePlayBadge, isKermes, sponsorLogos, sectionLabel, businessLogoBase64, tunaLogoBase64 } = opts;
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
 const contentStartY = stripH + 8.5; // offset past the strip

 doc.setFont('Roboto', 'bold');
 doc.setFontSize(16);
 doc.setTextColor(20, 20, 20);
 const titleMaxWidth = A6_WIDTH - PAD * 2;
 const titleLines = doc.splitTextToSize(companyName, titleMaxWidth);
 doc.text(titleLines, A6_WIDTH / 2, contentStartY, { align: 'center' });
 const titleH = titleLines.length * 6;

  // If business logo is available, render it in the top right corner
  if (businessLogoBase64) {
    try {
      const bizLogoSize = 16;
      const logoX = A6_WIDTH - PAD - bizLogoSize;
      const logoY = stripH + 2;
      doc.addImage(businessLogoBase64, 'PNG', logoX, logoY, bizLogoSize, bizLogoSize);
    } catch (e) {
      console.error("Failed to add business logo to PDF", e);
    }
  }

  let tableY = contentStartY + titleH + 1;

  if (sectionLabel) {
    // Translate section label dynamically
    let translatedSection = sectionLabel;
    if (lang === 'de') {
      translatedSection = translatedSection.replace(/Aile B[oö]l[uü]m[uü]?/ig, 'Familienbereich').replace(/B[oö]l[uü]m/ig, 'Bereich');
    } else if (lang === 'en') {
      translatedSection = translatedSection.replace(/Aile B[oö]l[uü]m[uü]?/ig, 'Family Section').replace(/B[oö]l[uü]m/ig, 'Section');
    } else if (lang === 'nl') {
      translatedSection = translatedSection.replace(/Aile B[oö]l[uü]m[uü]?/ig, 'Familiegedeelte').replace(/B[oö]l[uü]m/ig, 'Sectie');
    } else if (lang === 'fr') {
      translatedSection = translatedSection.replace(/Aile B[oö]l[uü]m[uü]?/ig, 'Espace Famille').replace(/B[oö]l[uü]m/ig, 'Section');
    } else if (lang === 'it') {
      translatedSection = translatedSection.replace(/Aile B[oö]l[uü]m[uü]?/ig, 'Area Famiglia').replace(/B[oö]l[uü]m/ig, 'Sezione');
    } else if (lang === 'es') {
      translatedSection = translatedSection.replace(/Aile B[oö]l[uü]m[uü]?/ig, 'Zona Familiar').replace(/B[oö]l[uü]m/ig, 'Sección');
    }
    
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(translatedSection, A6_WIDTH / 2, tableY, { align: 'center' });
    tableY += 5;
  }

  // Table label ("Masa 1")
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  const displayTable = `${txt.tablePrefix} ${tableLabel}`;
  doc.text(displayTable, A6_WIDTH / 2, tableY, { align: 'center' });

  // ================================================================
  // QR CODE (centered, large)
  // ================================================================
  const qrSize = 42;
  const qrX = (A6_WIDTH - qrSize) / 2;
  const qrY = tableY + 5.5; // reduced space to keep QR in place while text moved down

  // White pad behind QR
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 'F');
  doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);

  // ================================================================
  // CTA + STEPS
  // ================================================================
  // Red CTA
  const ctaY = qrY + qrSize + 10;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...LOKMA_RED);
  doc.text(txt.cta, A6_WIDTH / 2, ctaY, { align: 'center' });

  // Bullet steps
  let currentY = ctaY + 7;
  const leftX = PAD + 5;

  txt.steps.forEach((step) => {
  // Bullet dot (dark)
  doc.setFillColor(40, 40, 40);
  doc.circle(leftX - 3.5, currentY - 1.2, 1.2, 'F');

  // Title (bold)
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(step.title, leftX, currentY);
  const tw = doc.getTextWidth(step.title + ' ');

  // Description (normal)
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);

  const maxW = A6_WIDTH - PAD - leftX - tw;
  if (maxW > 25) {
  const descLines = doc.splitTextToSize(step.desc, maxW);
   if (descLines.length <= 1) {
   doc.text(step.desc, leftX + tw, currentY);
   currentY += 5.5;
   } else {
   // First part on same line, rest below indented
   doc.text(descLines[0], leftX + tw, currentY);
   for (let i = 1; i < descLines.length; i++) {
   currentY += 4.5;
   doc.text(descLines[i], leftX + tw, currentY);
   }
   currentY += 5.5;
   }
   } else {
   // Full wrap below title
   const descLines = doc.splitTextToSize(step.desc, A6_WIDTH - PAD * 2 - 5);
   doc.text(descLines[0], leftX + tw, currentY);
   for (let i = 1; i < descLines.length; i++) {
   currentY += 4.5;
   doc.text(descLines[i], leftX + tw, currentY);
   }
   currentY += 5.5;
   }
  });

  // ================================================================
  // BOTTOM ANCHORED SECTION (Footer, Badges, Afiyet Olsun)
  // ================================================================
  const bottomBarH = 10;
  const bottomBarY = A6_HEIGHT - bottomBarH - 4.5;

  let sponsorH = 0;
  if (sponsorLogos && sponsorLogos.length > 0) {
    sponsorH = 12;
  }
  const sponsorStartY = bottomBarY - sponsorH;

  const divY = sponsorStartY - 0.5; // Moved down by 2.5mm to prevent Afiyet Olsun overlap

  // "Afiyet Olsun!" - Script/Cursive font right above footer
  const afiyetY = divY - 4; // Shifted up relative to the new divY to maintain its screen position
  doc.setFont('DancingScript', 'normal');
  doc.setFontSize(26);
  doc.setTextColor(...LOKMA_RED);
  doc.text(txt.afiyetOlsun, A6_WIDTH / 2, afiyetY, { align: 'center' });

  // THIN DIVIDER LINE
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.25);
  doc.line(PAD, divY, A6_WIDTH - PAD, divY);

  // SPONSOR LOGOS
  if (sponsorLogos && sponsorLogos.length > 0) {
    const sponsorLogoSize = 8; // mm per logo
    const sponsorGap = 3;
    const totalW = sponsorLogos.length * sponsorLogoSize + (sponsorLogos.length - 1) * sponsorGap;
    let sx = (A6_WIDTH - totalW) / 2; // center horizontally

    sponsorLogos.forEach((logo) => {
      try {
        if (logo.bgColor) {
          const hex = logo.bgColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) || 255;
          const g = parseInt(hex.substring(2, 4), 16) || 255;
          const b = parseInt(hex.substring(4, 6), 16) || 255;
          doc.setFillColor(r, g, b);
        } else {
          doc.setFillColor(245, 245, 245);
        }
        doc.circle(sx + sponsorLogoSize / 2, sponsorStartY + sponsorLogoSize / 2, sponsorLogoSize / 2 + 0.5, 'F');
        doc.addImage(logo.base64, 'PNG', sx + 0.5, sponsorStartY + 0.5, sponsorLogoSize - 1, sponsorLogoSize - 1);
      } catch {
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(100, 100, 100);
        doc.text(logo.name, sx + sponsorLogoSize / 2, sponsorStartY + sponsorLogoSize / 2 + 1, { align: 'center' });
      }
      sx += sponsorLogoSize + sponsorGap;
    });
  }

  // DIN A6 LABEL + CORNER CROP MARKS
  const cropLen = 5;
  const cropOffset = 1.5;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(cropOffset, 0, cropOffset, cropLen);
  doc.line(0, cropOffset, cropLen, cropOffset);
  doc.line(A6_WIDTH - cropOffset, 0, A6_WIDTH - cropOffset, cropLen);
  doc.line(A6_WIDTH, cropOffset, A6_WIDTH - cropLen, cropOffset);
  doc.line(cropOffset, A6_HEIGHT, cropOffset, A6_HEIGHT - cropLen);
  doc.line(0, A6_HEIGHT - cropOffset, cropLen, A6_HEIGHT - cropOffset);
  doc.line(A6_WIDTH - cropOffset, A6_HEIGHT, A6_WIDTH - cropOffset, A6_HEIGHT - cropLen);
  doc.line(A6_WIDTH, A6_HEIGHT - cropOffset, A6_WIDTH - cropLen, A6_HEIGHT - cropOffset);

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(190, 190, 190);
  doc.text('DIN A6 \u00b7 105\u00d7148 mm', A6_WIDTH - PAD, A6_HEIGHT - 0.5, { align: 'right' }); // Moved down from A6_HEIGHT - 2

  // BOTTOM BAR: Partner text + Logo (left) + badges (right)
  // LOKMA logo
  const logoW = 25;
  const logoH = logoW / 3.63;

  const partnerText = isKermes ? txt.kermesPartnerLine : txt.partnerLine;
  const rightEdge = A6_WIDTH - PAD;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(6); // increased slightly from 5 as requested
  doc.setTextColor(80, 80, 80);
  doc.text(partnerText, PAD, bottomBarY + 4.8, { align: 'left' }); // Moved down from bottomBarY + 3.5

  const rowY = bottomBarY + 5.5; // Adjusted spacing between text and LOKMA logo

  try {
    doc.addImage(logoBase64, 'PNG', PAD, rowY, logoW, logoH);
  } catch {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...LOKMA_RED);
    doc.text('LOKMA', PAD, rowY + 6);
  }

  // App Store + Google Play badges
  const badgeH = 4.8;
  const badgeRatio = 626 / 186; // Both new badges have this aspect ratio
  const asBadgeW = badgeH * badgeRatio;
  const gpBadgeW = badgeH * badgeRatio; 
  const badgeY = rowY + (logoH - badgeH) / 2;
  const badge2X = rightEdge - gpBadgeW;
  const badge1X = badge2X - asBadgeW - 1.5;

  if (appStoreBadge) {
    try {
      doc.addImage(appStoreBadge, 'PNG', badge1X, badgeY, asBadgeW, badgeH);
    } catch {
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(badge1X, badgeY, asBadgeW, 6, 1, 1, 'F');
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(4);
      doc.setTextColor(255, 255, 255);
      doc.text('App Store', badge1X + asBadgeW / 2, badgeY + 3.5, { align: 'center' });
    }
  }

  if (googlePlayBadge) {
    try {
      doc.addImage(googlePlayBadge, 'PNG', badge2X, badgeY, gpBadgeW, badgeH);
    } catch {
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(badge2X, badgeY, gpBadgeW, 6, 1, 1, 'F');
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(4);
      doc.setTextColor(255, 255, 255);
      doc.text('Google Play', badge2X + gpBadgeW / 2, badgeY + 3.5, { align: 'center' });
    }
  }

  // TUNA Logo in the bottom center
  if (tunaLogoBase64) {
    try {
      const tunaH = badgeH;
      const tunaW = badgeH * badgeRatio;
      const tunaX = (A6_WIDTH - tunaW) / 2;
      const tunaY = rowY + (logoH - tunaH) / 2;
      doc.addImage(tunaLogoBase64, 'PNG', tunaX, tunaY, tunaW, tunaH);
    } catch (e) {
      console.error("Failed to add TUNA logo", e);
    }
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

type SponsorLogoInput = { iconUrl: string; name: string; bgColor?: string };
type SponsorLogoResolved = { base64: string; name: string; bgColor?: string };

async function fetchSponsorLogos(logos?: SponsorLogoInput[]): Promise<SponsorLogoResolved[] | undefined> {
 if (!logos || logos.length === 0) return undefined;
 const resolved = await Promise.all(
 logos.map(async (s) => {
  try {
  const base64 = await fetchImageAsBase64(s.iconUrl);
  return { base64, name: s.name, bgColor: s.bgColor };
  } catch {
  return { base64: '', name: s.name, bgColor: s.bgColor };
  }
 })
 );
 const filtered = resolved.filter(s => s.base64);
 return filtered.length > 0 ? filtered : undefined;
}

export async function generateTableCardPDF(
 tableLabel: string,
 businessId: string,
 companyName: string,
 lang: CardLang = 'tr',
 options?: { isKermes?: boolean; sponsorLogos?: { iconUrl: string; name: string; bgColor?: string }[]; section?: string; sectionLabel?: string; businessLogoUrl?: string },
): Promise<jsPDF> {
 const doc = new jsPDF({
 orientation: 'portrait',
 unit: 'mm',
 format: [A6_WIDTH, A6_HEIGHT],
 });
 registerFonts(doc);

 const basePath = options?.isKermes ? 'kermes' : 'dinein';
 const qrUrl = `https://lokma.web.app/${basePath}/${businessId}/table/${tableLabel}${options?.section ? `?section=${encodeURIComponent(options.section)}` : ''}`;
 const [logoBase64, qrBase64, appStoreBadge, googlePlayBadge, businessLogoBase64, tunaLogoBase64] = await Promise.all([
 fetchImageAsBase64('/logo_qr_lokma_red.png'),
 generateQRCodeBase64(qrUrl),
 fetchImageAsBase64('/app_store_badge.png').catch(() => ''),
 fetchImageAsBase64('/google_play_badge.png').catch(() => ''),
 options?.businessLogoUrl ? fetchImageAsBase64(options.businessLogoUrl).catch(() => undefined) : Promise.resolve(undefined),
 fetchImageAsBase64('/tuna_logo_04_2026.png').catch(() => undefined)
 ]);

 const sponsorLogos = await fetchSponsorLogos(options?.sponsorLogos);
 renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang, appStoreBadge, googlePlayBadge, isKermes: options?.isKermes, sponsorLogos, sectionLabel: options?.sectionLabel, businessLogoBase64, tunaLogoBase64 });
 return doc;
}

export async function generateDualLangTableCardPDF(
 tableLabel: string,
 businessId: string,
 companyName: string,
 country?: string,
 options?: { isKermes?: boolean; sponsorLogos?: SponsorLogoInput[]; section?: string; sectionLabel?: string; businessLogoUrl?: string },
): Promise<jsPDF> {
 const [lang1, lang2] = getCardLanguages(country);

 const doc = new jsPDF({
 orientation: 'portrait',
 unit: 'mm',
 format: [A6_WIDTH, A6_HEIGHT],
 });
 registerFonts(doc);

 const basePath = options?.isKermes ? 'kermes' : 'dinein';
 const qrUrl = `https://lokma.web.app/${basePath}/${businessId}/table/${tableLabel}${options?.section ? `?section=${encodeURIComponent(options.section)}` : ''}`;
 const [logoBase64, qrBase64, appStoreBadge, googlePlayBadge, businessLogoBase64, tunaLogoBase64] = await Promise.all([
 fetchImageAsBase64('/logo_qr_lokma_red.png'),
 generateQRCodeBase64(qrUrl),
 fetchImageAsBase64('/app_store_badge.png').catch(() => ''),
 fetchImageAsBase64('/google_play_badge.png').catch(() => ''),
 options?.businessLogoUrl ? fetchImageAsBase64(options.businessLogoUrl).catch(() => undefined) : Promise.resolve(undefined),
 fetchImageAsBase64('/tuna_logo_04_2026.png').catch(() => undefined)
 ]);

 const sponsorLogos = await fetchSponsorLogos(options?.sponsorLogos);
 const extra = { isKermes: options?.isKermes, sponsorLogos, sectionLabel: options?.sectionLabel, businessLogoBase64, tunaLogoBase64 };
 renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang: lang1, appStoreBadge, googlePlayBadge, ...extra });
 doc.addPage([A6_WIDTH, A6_HEIGHT]);
 renderCardPage(doc, { tableLabel, companyName, logoBase64, qrBase64, lang: lang2, appStoreBadge, googlePlayBadge, ...extra });

 return doc;
}

export async function downloadTableCardPDF(
 tableLabel: string,
 businessId: string,
 companyName: string,
 country?: string,
 options?: { isKermes?: boolean; sponsorLogos?: SponsorLogoInput[]; section?: string; sectionLabel?: string; businessLogoUrl?: string },
): Promise<void> {
 const doc = await generateDualLangTableCardPDF(tableLabel, businessId, companyName, country, options);
 doc.save(`Masa_${tableLabel}_LOKMA_Kart.pdf`);
}

export async function downloadAllTableCardPDFs(
 tables: Array<{ label: string; section?: string; sectionLabel?: string }>,
 businessId: string,
 companyName: string,
 country?: string,
 options?: { isKermes?: boolean; sponsorLogos?: SponsorLogoInput[]; businessLogoUrl?: string },
): Promise<void> {
 for (const table of tables) {
 const doc = await generateDualLangTableCardPDF(table.label, businessId, companyName, country, { ...options, section: table.section, sectionLabel: table.sectionLabel });
 doc.save(`Masa_${table.label}_LOKMA_Kart.pdf`);
 await new Promise((resolve) => setTimeout(resolve, 300));
 }
}

export async function downloadAllTableCardsAsSinglePDF(
 tables: Array<{ label: string; section?: string; sectionLabel?: string }>,
 businessId: string,
 companyName: string,
 country?: string,
 options?: { isKermes?: boolean; sponsorLogos?: SponsorLogoInput[]; businessLogoUrl?: string },
): Promise<void> {
 if (tables.length === 0) return;

 const [lang1, lang2] = getCardLanguages(country);
 const [logoBase64, appStoreBadge, googlePlayBadge, businessLogoBase64, tunaLogoBase64] = await Promise.all([
 fetchImageAsBase64('/logo_qr_lokma_red.png'),
 fetchImageAsBase64('/app_store_badge.png').catch(() => ''),
 fetchImageAsBase64('/google_play_badge.png').catch(() => ''),
 options?.businessLogoUrl ? fetchImageAsBase64(options.businessLogoUrl).catch(() => undefined) : Promise.resolve(undefined),
 fetchImageAsBase64('/tuna_logo_04_2026.png').catch(() => undefined)
 ]);

 const sponsorLogos = await fetchSponsorLogos(options?.sponsorLogos);

 const doc = new jsPDF({
 orientation: 'portrait',
 unit: 'mm',
 format: [A6_WIDTH, A6_HEIGHT],
 });
 registerFonts(doc);

 for (let i = 0; i < tables.length; i++) {
 const table = tables[i];
 const extra = { isKermes: options?.isKermes, sponsorLogos, sectionLabel: table.sectionLabel, businessLogoBase64, tunaLogoBase64 };
 const qrUrl = `https://lokma.web.app/${extra.isKermes ? 'kermes' : 'dinein'}/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
 const qrBase64 = await generateQRCodeBase64(qrUrl);

 if (i > 0) doc.addPage([A6_WIDTH, A6_HEIGHT]);
 renderCardPage(doc, { tableLabel: table.label, companyName, logoBase64, qrBase64, lang: lang1, appStoreBadge, googlePlayBadge, ...extra });

 doc.addPage([A6_WIDTH, A6_HEIGHT]);
 renderCardPage(doc, { tableLabel: table.label, companyName, logoBase64, qrBase64, lang: lang2, appStoreBadge, googlePlayBadge, ...extra });
 }

 doc.save(`LOKMA_Tum_Masa_Kartlari_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

// ------------------------------------------------------------------
// PNG GENERATION
// ------------------------------------------------------------------

export async function downloadTableCardPNG(
  tableLabel: string,
  businessId: string,
  options?: { isKermes?: boolean; section?: string; qrBaseUrl?: string }
): Promise<void> {
  const basePath = options?.isKermes ? 'kermes' : 'dinein';
  let qrUrl = `https://lokma.web.app/${basePath}/${businessId}/table/${tableLabel}${options?.section ? `?section=${encodeURIComponent(options.section)}` : ''}`;
  
  if (options?.qrBaseUrl) {
    qrUrl = `${options.qrBaseUrl}/${businessId}/table/${tableLabel}${options?.section ? `?section=${encodeURIComponent(options.section)}` : ''}`;
  }

  const qrBase64 = await generateQRCodeBase64(qrUrl);

  const link = document.createElement('a');
  link.href = qrBase64;
  link.download = `Masa_${tableLabel}_QR.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadAllTableCardPNGs(
  tables: Array<{ label: string; section?: string }>,
  businessId: string,
  options?: { isKermes?: boolean; qrBaseUrl?: string }
): Promise<void> {
  // Rather than zipping, we will download them sequentially with a small delay
  for (const table of tables) {
    const basePath = options?.isKermes ? 'kermes' : 'dinein';
    let qrUrl = `https://lokma.web.app/${basePath}/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
    
    if (options?.qrBaseUrl) {
      qrUrl = `${options.qrBaseUrl}/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
    }

    const qrBase64 = await generateQRCodeBase64(qrUrl);
    
    const link = document.createElement('a');
    link.href = qrBase64;
    link.download = `Masa_${table.label}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Wait 300ms before next download to prevent browser blocking all of them
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

export type { CardLang };
export { getCardLanguages, CARD_TEXTS };
