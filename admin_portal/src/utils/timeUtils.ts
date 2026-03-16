/**
 * Paylasimli Saat Formati Utility'leri
 * 
 * Tum admin portal genelinde tutarli saat formati saglar.
 * Standart: 24 saat formati, HH:MM (sifir padli)
 */

// Ingilizce gun isimleri (Firestore key'leri)
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

// Gun ismi eslestirme tablolari
const DAY_NAME_MAP: Record<string, string> = {
  // English
  'monday': 'monday', 'tuesday': 'tuesday', 'wednesday': 'wednesday',
  'thursday': 'thursday', 'friday': 'friday', 'saturday': 'saturday', 'sunday': 'sunday',
  // Turkish
  'pazartesi': 'monday', 'sali': 'tuesday', 'salı': 'tuesday',
  'carsamba': 'wednesday', 'çarşamba': 'wednesday', 'persembe': 'thursday', 'perşembe': 'thursday',
  'cuma': 'friday', 'cumartesi': 'saturday', 'pazar': 'sunday',
  // German
  'montag': 'monday', 'dienstag': 'tuesday', 'mittwoch': 'wednesday',
  'donnerstag': 'thursday', 'freitag': 'friday', 'samstag': 'saturday', 'sonntag': 'sunday',
};

// JS Date.getDay() -> key (0=Sunday, 1=Monday, ...)
const JS_DAY_INDEX_TO_KEY: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

export type DayKey = typeof DAY_KEYS[number];

export interface DaySchedule {
  open: string;   // "HH:MM" (24h, sifir padli)
  close: string;  // "HH:MM"
  closed: boolean;
}

export interface ParsedOpeningHours {
  [key: string]: DaySchedule;
}

/**
 * Tek bir saat stringini 24h HH:MM formatina normalize eder.
 * 
 * Desteklenen girdiler:
 * - "11:30 AM" / "10:00PM" / "1:30 pm" (AM/PM)
 * - "22:00" / "9:30" / "09:30" (24h)
 * - "9.30" / "11.30AM" (nokta seperator)
 * - "9" / "22" (sadece saat, dakika yok)
 */
export function normalizeTimeString(input: string): string {
  if (!input || !input.trim()) return '';

  let s = input.trim().toUpperCase();

  // Noktayi iki noktaya cevir
  s = s.replace(/\./g, ':');

  const isPM = s.includes('PM');
  const isAM = s.includes('AM');

  // AM/PM temizle
  s = s.replace(/\s*(AM|PM)\s*/gi, '').trim();

  // Saat:dakika parcala
  const parts = s.match(/^(\d{1,2}):?(\d{2})?$/);
  if (!parts) return input.trim(); // parse edilemezse orijinali dondur

  let hours = parseInt(parts[1], 10);
  const minutes = parts[2] ? parseInt(parts[2], 10) : 0;

  // AM/PM donusumu
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  // Sifir padli format
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Tek bir acilis saati satirini parse eder.
 * 
 * Desteklenen formatlar:
 * - "Monday: 11:30 AM - 10:00 PM"
 * - "Pazartesi: 11:30 - 22:00"  
 * - "Montag: 11:30 – 22:00"
 * - "Monday: Closed"
 * - "Pazartesi: Kapali"
 */
export function parseOpeningHoursLine(line: string): { dayKey: string; open: string; close: string; closed: boolean } | null {
  if (!line || !line.trim()) return null;

  const trimmed = line.trim();

  // Gun ismini ayir (ilk ":" veya ilk bosluktan sonraki metin)
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) return null;

  // "HH:MM" icindeki ":"yi gun:deger ayiricisi olarak algilamaktan kacin
  // Gun ismi her zaman harfle baslar
  let dayPart = '';
  let timePart = '';

  // Gun ismi: satir basindaki harfler + bosluklar, ilk ":" a kadar
  // Ama ":" oncesi rakamsa (ornek: "11:30") bu gun ismi degil
  const firstColonMatch = trimmed.match(/^([a-zA-ZçşğüöıÇŞĞÜÖİäÄ\s]+):\s*(.*)/);
  if (firstColonMatch) {
    dayPart = firstColonMatch[1].trim().toLowerCase();
    timePart = firstColonMatch[2].trim();
  } else {
    return null;
  }

  // Gun ismini normalize et
  const dayKey = DAY_NAME_MAP[dayPart];
  if (!dayKey) return null;

  // Kapali kontrol
  const lowerTime = timePart.toLowerCase();
  if (
    lowerTime.includes('closed') ||
    lowerTime.includes('kapalı') ||
    lowerTime.includes('kapali') ||
    lowerTime.includes('geschlossen') ||
    lowerTime === '-' ||
    lowerTime === ''
  ) {
    return { dayKey, open: '', close: '', closed: true };
  }

  // 24 saat acik kontrol
  if (lowerTime.includes('24 saat') || lowerTime.includes('open 24') || lowerTime.includes('24 stunden')) {
    return { dayKey, open: '00:00', close: '23:59', closed: false };
  }

  // Saat araligini parse et
  // Seperatorler: " – " (en-dash), " - " (hyphen), "–", "-"
  const separator = timePart.includes('–') ? '–' : '-';
  const rangeParts = timePart.split(separator).map(p => p.trim());

  if (rangeParts.length < 2) {
    return { dayKey, open: normalizeTimeString(rangeParts[0]), close: '', closed: false };
  }

  return {
    dayKey,
    open: normalizeTimeString(rangeParts[0]),
    close: normalizeTimeString(rangeParts[1]),
    closed: false,
  };
}

/**
 * Tum openingHours block'unu parse edip normalize eder.
 * 
 * Desteklenen girdiler:
 * - String: "\n" ile ayrilmis satirlar
 * - String[]: satir dizisi
 * - Zaten Map ise direkt kullan
 */
export function parseOpeningHoursBlock(raw: string | string[] | Record<string, any> | null | undefined): ParsedOpeningHours {
  // Bos kontrol
  if (!raw) {
    return createEmptySchedule();
  }

  // Zaten Map formatindaysa
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const result: ParsedOpeningHours = {};
    for (const key of DAY_KEYS) {
      const val = raw[key];
      if (val && typeof val === 'object') {
        result[key] = {
          open: normalizeTimeString(val.open || ''),
          close: normalizeTimeString(val.close || ''),
          closed: val.closed === true,
        };
      } else {
        result[key] = { open: '', close: '', closed: true };
      }
    }
    return result;
  }

  // String veya Array formatinda
  const lines: string[] = Array.isArray(raw) ? raw : raw.split('\n');
  const result = createEmptySchedule();

  for (const line of lines) {
    // " | " seperatorunu de isle (OpeningHoursEditor ciktisi)
    const subLines = line.includes(' | ') ? line.split(' | ') : [line];
    for (const subLine of subLines) {
      const parsed = parseOpeningHoursLine(subLine);
      if (parsed) {
        result[parsed.dayKey] = {
          open: parsed.open,
          close: parsed.close,
          closed: parsed.closed,
        };
      }
    }
  }

  return result;
}

/**
 * ParsedOpeningHours'u tutarli display stringine donusturur.
 * Format: "DayLabel: HH:MM - HH:MM" veya "DayLabel: Closed"
 */
export function formatOpeningHoursForDisplay(
  schedule: ParsedOpeningHours,
  locale: 'tr' | 'de' | 'en' = 'de'
): string[] {
  const dayLabels: Record<string, Record<string, string>> = {
    tr: {
      monday: 'Pazartesi', tuesday: 'Sali', wednesday: 'Carsamba',
      thursday: 'Persembe', friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar',
    },
    de: {
      monday: 'Montag', tuesday: 'Dienstag', wednesday: 'Mittwoch',
      thursday: 'Donnerstag', friday: 'Freitag', saturday: 'Samstag', sunday: 'Sonntag',
    },
    en: {
      monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
      thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
    },
  };

  const closedLabel: Record<string, string> = {
    tr: 'Kapali', de: 'Geschlossen', en: 'Closed',
  };

  const labels = dayLabels[locale] || dayLabels.de;
  const closed = closedLabel[locale] || closedLabel.de;

  return DAY_KEYS.map(day => {
    const entry = schedule[day];
    const label = labels[day];
    if (!entry || entry.closed) {
      return `${label}: ${closed}`;
    }
    if (!entry.open && !entry.close) {
      return `${label}: ${closed}`;
    }
    return `${label}: ${entry.open} - ${entry.close}`;
  });
}

/**
 * ParsedOpeningHours'u Firestore'a kaydetmek icin string formatina donusturur.
 * Format: "Monday: HH:MM - HH:MM" (her zaman Ingilizce gun ismi, 24h)
 */
export function scheduleToFirestoreString(schedule: ParsedOpeningHours): string {
  const dayLabels: Record<string, string> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  };

  return DAY_KEYS.map(day => {
    const entry = schedule[day];
    const label = dayLabels[day];
    if (!entry || entry.closed || (!entry.open && !entry.close)) {
      return `${label}: Closed`;
    }
    return `${label}: ${entry.open} - ${entry.close}`;
  }).join('\n');
}

/**
 * Verilen gun icin isletmenin acik olup olmadigini kontrol eder.
 * Suan icin kullanilir (now parametresi test icin).
 */
export function checkIsOpenNow(
  schedule: ParsedOpeningHours,
  now?: Date
): { isOpen: boolean; todaySchedule: DaySchedule | null } {
  const currentTime = now || new Date();
  const dayKey = JS_DAY_INDEX_TO_KEY[currentTime.getDay()];
  const todaySchedule = schedule[dayKey];

  if (!todaySchedule || todaySchedule.closed || !todaySchedule.open || !todaySchedule.close) {
    return { isOpen: false, todaySchedule: todaySchedule || null };
  }

  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const [openH, openM] = todaySchedule.open.split(':').map(Number);
  const [closeH, closeM] = todaySchedule.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  let closeMinutes = closeH * 60 + closeM;

  // Gece yarisi gecen durumlar (orn. 22:00 - 02:00)
  if (closeMinutes <= openMinutes) {
    // Gece yarisi sonrasiysa veya acilis saatinden sonraysa acik
    if (nowMinutes >= openMinutes || nowMinutes <= closeMinutes) {
      return { isOpen: true, todaySchedule };
    }
    return { isOpen: false, todaySchedule };
  }

  const isOpen = nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
  return { isOpen, todaySchedule };
}

/**
 * Bos bir haftalik program olusturur (tum gunler kapali).
 */
export function createEmptySchedule(): ParsedOpeningHours {
  const result: ParsedOpeningHours = {};
  for (const day of DAY_KEYS) {
    result[day] = { open: '', close: '', closed: true };
  }
  return result;
}

/**
 * Eski format stringinden (openingHours) haftanin belirli bir gunu icin
 * saat bilgisini cikarir. checkShopStatus yerine kullanilir.
 */
export function getScheduleForToday(
  openingHours: string | string[] | Record<string, any> | null | undefined,
  now?: Date
): { isOpen: boolean; text: string; todayOpen?: string; todayClose?: string } {
  const schedule = parseOpeningHoursBlock(openingHours);
  const currentTime = now || new Date();
  const dayKey = JS_DAY_INDEX_TO_KEY[currentTime.getDay()];
  const todaySchedule = schedule[dayKey];

  if (!todaySchedule) {
    return { isOpen: false, text: 'Geschlossen' };
  }

  if (todaySchedule.closed || (!todaySchedule.open && !todaySchedule.close)) {
    return { isOpen: false, text: 'Heute geschlossen' };
  }

  const { isOpen } = checkIsOpenNow(schedule, currentTime);

  if (isOpen) {
    return {
      isOpen: true,
      text: `Offen bis ${todaySchedule.close}`,
      todayOpen: todaySchedule.open,
      todayClose: todaySchedule.close,
    };
  }

  return {
    isOpen: false,
    text: `Geschlossen (${todaySchedule.open} - ${todaySchedule.close})`,
    todayOpen: todaySchedule.open,
    todayClose: todaySchedule.close,
  };
}

export { DAY_KEYS, DAY_NAME_MAP, JS_DAY_INDEX_TO_KEY };
