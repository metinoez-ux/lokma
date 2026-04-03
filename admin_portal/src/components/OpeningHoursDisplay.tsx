
import React from 'react';
import { useTranslations } from 'next-intl';
import { normalizeTimeString } from '@/utils/timeUtils';

interface OpeningHoursDisplayProps {
 rawHours: string;
}

const OpeningHoursDisplay: React.FC<OpeningHoursDisplayProps> = ({ rawHours }) => {
 
 const t = useTranslations('AdminComponentOpeningHoursDisplay');
if (!rawHours) return null;

 // Hem "\n" hem " | " seperatorunu destekle (eski ve yeni format)
 const days = rawHours.includes('\n') ? rawHours.split('\n') : rawHours.split(' | ');

 // Bugunun gun ismini bul
 const todayIndex = new Date().getDay();
 const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
 const todayName = dayNames[todayIndex];

 // Gun ismi cevirisi
 const trDays: Record<string, string> = {
 'Monday': 'Pazartesi',
 'Tuesday': t('sali'),
 'Wednesday': t('carsamba'),
 'Thursday': t('persembe'),
 'Friday': 'Cuma',
 'Saturday': 'Cumartesi',
 'Sunday': 'Pazar'
 };

 return (
 <div className="mt-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
 <h4 className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-2">
 <span className="text-lg">🕒</span> {t('calisma_saatleri_canli_onizleme')}
 </h4>
 <div className="space-y-2">
 {days.map((dayStr, idx) => {
 const trimmed = dayStr.trim();
 if (!trimmed) return null;

 // "Monday: 9:00 AM – 6:00 PM" veya "Monday: 11:30 - 22:00"
 const colonMatch = trimmed.match(/^([a-zA-ZçşğüöıÇŞĞÜÖİäÄ\s]+):\s*(.*)/);
 if (!colonMatch) return <div key={idx} className="text-gray-400 text-xs">{trimmed}</div>;

 const dayNameEng = colonMatch[1].trim();
 let hours = colonMatch[2].trim();

 // Saat kismini 24h formatina normalize et
 const lowerHours = hours.toLowerCase();
 if (!lowerHours.includes('closed') && !lowerHours.includes('kapal') && !lowerHours.includes('geschlossen')) {
 const separator = hours.includes('\u2013') ? '\u2013' : '-';
 const rangeParts = hours.split(separator).map(p => p.trim());
 if (rangeParts.length >= 2) {
 hours = `${normalizeTimeString(rangeParts[0])} - ${normalizeTimeString(rangeParts[1])}`;
 }
 }

 const isToday = dayNameEng === todayName;
 const trDayName = trDays[dayNameEng] || dayNameEng;

 return (
 <div
 key={idx}
 className={`flex justify-between items-center text-sm p-2 rounded ${isToday ? 'bg-blue-900/30 border border-blue-500/30' : 'hover:bg-gray-700/30'}`}
 >
 <span className={`font-medium ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
 {trDayName}
 </span>
 <span className={`${isToday ? 'text-blue-200' : 'text-gray-400'}`}>
 {hours}
 </span>
 </div>
 );
 })}
 </div>
 </div>
 );
};

export default OpeningHoursDisplay;
