
import React from 'react';

interface OpeningHoursDisplayProps {
    rawHours: string;
}

const OpeningHoursDisplay: React.FC<OpeningHoursDisplayProps> = ({ rawHours }) => {
    if (!rawHours) return null;

    // Expected format: "Monday: Closed | Tuesday: 9:00 AM – 6:00 PM | ..."
    const days = rawHours.split(' | ');

    // Get current day index (0 = Sunday, 1 = Monday ...)
    // Google usually orders starting Monday if using weekday_text, but we should rely on string content or index.
    // JS getDay(): 0=Sun, 1=Mon...6=Sat. 
    // Let's just highlight based on string matching current English day name if possible, or just list them nicely.

    // Actually, let's map JS day integer to a string to find match.
    const todayIndex = new Date().getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[todayIndex];

    // Map English Google days to Turkish
    const trDays: Record<string, string> = {
        'Monday': 'Pazartesi',
        'Tuesday': 'Salı',
        'Wednesday': 'Çarşamba',
        'Thursday': 'Perşembe',
        'Friday': 'Cuma',
        'Saturday': 'Cumartesi',
        'Sunday': 'Pazar'
    };

    // Helper to convert 12h AM/PM to 24h format (e.g. "7:30 AM" -> "07:30")
    const to24Hour = (timeStr: string): string => {
        return timeStr.replace(/(\d{1,2}):(\d{2})\s?(AM|PM)/gi, (match, h, m, period) => {
            let hour = parseInt(h, 10);
            const minute = m;
            const isPM = period.toUpperCase() === 'PM';

            if (isPM && hour < 12) hour += 12;
            if (!isPM && hour === 12) hour = 0;

            return `${hour.toString().padStart(2, '0')}:${minute}`;
        });
    };

    return (
        <div className="mt-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="text-lg">🕒</span> Çalışma Saatleri (Canlı Önizleme)
            </h4>
            <div className="space-y-2">
                {days.map((dayStr, idx) => {
                    // dayStr ex: "Monday: 9:00 AM – 6:00 PM"
                    const parts = dayStr.split(': ');
                    if (parts.length < 2) return <div key={idx} className="text-gray-400 text-xs">{dayStr}</div>;

                    const dayNameEng = parts[0];
                    let hours = parts.slice(1).join(': ');

                    // Convert to 24h format
                    hours = to24Hour(hours);

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
