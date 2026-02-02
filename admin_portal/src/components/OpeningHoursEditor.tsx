'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface DaySchedule {
    day: string;
    dayTr: string;
    isOpen: boolean;
    openHour: string;
    openMinute: string;
    closeHour: string;
    closeMinute: string;
}

interface OpeningHoursEditorProps {
    value: DaySchedule[];
    onChange: (schedule: DaySchedule[]) => void;
    googlePlaceId?: string;
    onGoogleRefresh?: () => void;
    isRefreshing?: boolean;
}

const defaultSchedule: DaySchedule[] = [
    { day: 'monday', dayTr: 'Pazartesi', isOpen: true, openHour: '09', openMinute: '00', closeHour: '18', closeMinute: '00' },
    { day: 'tuesday', dayTr: 'Salı', isOpen: true, openHour: '09', openMinute: '00', closeHour: '18', closeMinute: '00' },
    { day: 'wednesday', dayTr: 'Çarşamba', isOpen: true, openHour: '09', openMinute: '00', closeHour: '18', closeMinute: '00' },
    { day: 'thursday', dayTr: 'Perşembe', isOpen: true, openHour: '09', openMinute: '00', closeHour: '18', closeMinute: '00' },
    { day: 'friday', dayTr: 'Cuma', isOpen: true, openHour: '09', openMinute: '00', closeHour: '18', closeMinute: '00' },
    { day: 'saturday', dayTr: 'Cumartesi', isOpen: true, openHour: '10', openMinute: '00', closeHour: '16', closeMinute: '00' },
    { day: 'sunday', dayTr: 'Pazar', isOpen: false, openHour: '00', openMinute: '00', closeHour: '00', closeMinute: '00' },
];

// Apple-style number input with individual character focus
const TimeInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    max: number;
    label: string;
    disabled?: boolean;
    onNext?: () => void;
}> = ({ value, onChange, max, label, disabled, onNext }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(-2);

        const num = parseInt(val, 10);
        if (num > max) val = max.toString().padStart(2, '0');

        onChange(val.padStart(2, '0'));

        // Auto-advance to next field
        if (val.length >= 2 && onNext) {
            setTimeout(onNext, 100);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const num = Math.min(parseInt(value, 10) + 1, max);
            onChange(num.toString().padStart(2, '0'));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const num = Math.max(parseInt(value, 10) - 1, 0);
            onChange(num.toString().padStart(2, '0'));
        } else if (e.key === 'Tab' || e.key === 'Enter') {
            // Natural tab behavior
        }
    };

    return (
        <div className="flex flex-col items-center">
            <span className="text-gray-500 text-[10px] uppercase mb-0.5">{label}</span>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className={`w-10 h-9 text-center text-lg font-mono rounded-lg border transition-all
                    ${disabled
                        ? 'bg-gray-700/50 text-gray-500 border-gray-700 cursor-not-allowed'
                        : 'bg-gray-700 text-white border-gray-600 hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30'
                    }`}
                maxLength={2}
            />
        </div>
    );
};

export const OpeningHoursEditor: React.FC<OpeningHoursEditorProps> = ({
    value,
    onChange,
    googlePlaceId,
    onGoogleRefresh,
    isRefreshing = false,
}) => {
    const [schedule, setSchedule] = useState<DaySchedule[]>(value?.length > 0 ? value : defaultSchedule);

    useEffect(() => {
        if (value?.length > 0) {
            setSchedule(value);
        }
    }, [value]);

    const updateDay = (index: number, updates: Partial<DaySchedule>) => {
        const newSchedule = [...schedule];
        newSchedule[index] = { ...newSchedule[index], ...updates };
        setSchedule(newSchedule);
        onChange(newSchedule);
    };

    const toggleDay = (index: number) => {
        updateDay(index, { isOpen: !schedule[index].isOpen });
    };

    // Copy hours from one day to all weekdays or weekend
    const copyToWeekdays = (sourceIndex: number) => {
        const source = schedule[sourceIndex];
        const newSchedule = schedule.map((day, i) => {
            if (i < 5) { // Mon-Fri
                return { ...day, isOpen: source.isOpen, openHour: source.openHour, openMinute: source.openMinute, closeHour: source.closeHour, closeMinute: source.closeMinute };
            }
            return day;
        });
        setSchedule(newSchedule);
        onChange(newSchedule);
    };

    const copyToAll = (sourceIndex: number) => {
        const source = schedule[sourceIndex];
        const newSchedule = schedule.map(day => ({
            ...day,
            isOpen: source.isOpen,
            openHour: source.openHour,
            openMinute: source.openMinute,
            closeHour: source.closeHour,
            closeMinute: source.closeMinute,
        }));
        setSchedule(newSchedule);
        onChange(newSchedule);
    };

    return (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
            {/* Header with Google Refresh */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🕒</span>
                    <h3 className="text-white font-medium">Çalışma Saatleri</h3>
                </div>
                {googlePlaceId && onGoogleRefresh && (
                    <button
                        onClick={onGoogleRefresh}
                        disabled={isRefreshing}
                        className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-sm font-medium flex items-center gap-2 transition disabled:opacity-50"
                    >
                        {isRefreshing ? (
                            <>
                                <span className="animate-spin">🔄</span>
                                Senkronize ediliyor...
                            </>
                        ) : (
                            <>
                                🌍 Google'dan Tazele
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Schedule Grid */}
            <div className="divide-y divide-gray-700/50">
                {(schedule && schedule.length > 0) ? schedule.map((day, index) => (
                    <div
                        key={day?.day || index}
                        className={`p-3 flex items-center gap-4 transition-colors ${day?.isOpen ? 'bg-transparent' : 'bg-red-900/10'
                            }`}
                    >
                        {/* Day Toggle */}
                        <button
                            onClick={() => toggleDay(index)}
                            className={`w-24 py-1.5 rounded-lg text-sm font-medium transition-all ${day.isOpen
                                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                                }`}
                        >
                            {day.dayTr}
                        </button>

                        {/* Time Inputs */}
                        {day.isOpen ? (
                            <div className="flex items-center gap-1">
                                <TimeInput
                                    value={day.openHour}
                                    onChange={(v) => updateDay(index, { openHour: v })}
                                    max={23}
                                    label="Saat"
                                />
                                <span className="text-gray-500 text-xl font-light">:</span>
                                <TimeInput
                                    value={day.openMinute}
                                    onChange={(v) => updateDay(index, { openMinute: v })}
                                    max={59}
                                    label="Dk"
                                />

                                <span className="text-gray-500 mx-2">—</span>

                                <TimeInput
                                    value={day.closeHour}
                                    onChange={(v) => updateDay(index, { closeHour: v })}
                                    max={23}
                                    label="Saat"
                                />
                                <span className="text-gray-500 text-xl font-light">:</span>
                                <TimeInput
                                    value={day.closeMinute}
                                    onChange={(v) => updateDay(index, { closeMinute: v })}
                                    max={59}
                                    label="Dk"
                                />

                                {/* Copy Actions */}
                                <div className="ml-4 flex gap-1">
                                    {index === 0 && (
                                        <button
                                            onClick={() => copyToWeekdays(index)}
                                            className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition"
                                            title="Tüm hafta içine kopyala"
                                        >
                                            📋 Haftaya
                                        </button>
                                    )}
                                    <button
                                        onClick={() => copyToAll(index)}
                                        className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30 transition"
                                        title="Tüm günlere kopyala"
                                    >
                                        📋 Hepsine
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <span className="text-red-400 text-sm font-medium">Kapalı</span>
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="p-4 text-center text-gray-500">
                        Çalışma saati bilgisi yok
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-700/30 border-t border-gray-700">
                <p className="text-gray-500 text-xs">
                    💡 Günleri tıklayarak açık/kapalı yapabilir, saatleri yukarı/aşağı ok tuşlarıyla ayarlayabilirsiniz.
                </p>
            </div>
        </div>
    );
};

// Helper: Parse Google opening hours string to DaySchedule array
export const parseGoogleHoursToSchedule = (googleHours: any): DaySchedule[] => {
    const dayMap: Record<string, { day: string; dayTr: string }> = {
        'Monday': { day: 'monday', dayTr: 'Pazartesi' },
        'Tuesday': { day: 'tuesday', dayTr: 'Salı' },
        'Wednesday': { day: 'wednesday', dayTr: 'Çarşamba' },
        'Thursday': { day: 'thursday', dayTr: 'Perşembe' },
        'Friday': { day: 'friday', dayTr: 'Cuma' },
        'Saturday': { day: 'saturday', dayTr: 'Cumartesi' },
        'Sunday': { day: 'sunday', dayTr: 'Pazar' },
    };

    const defaultSchedule: DaySchedule[] = Object.values(dayMap).map(d => ({
        ...d,
        isOpen: true,
        openHour: '09',
        openMinute: '00',
        closeHour: '18',
        closeMinute: '00',
    }));

    // Type safety: ensure googleHours is a string
    if (!googleHours || typeof googleHours !== 'string') {
        return defaultSchedule;
    }

    const schedule: DaySchedule[] = Object.values(dayMap).map(d => ({
        ...d,
        isOpen: false,
        openHour: '00',
        openMinute: '00',
        closeHour: '00',
        closeMinute: '00',
    }));

    // Parse "Monday: 9:00 AM – 6:00 PM | Tuesday: 9:00 AM – 6:00 PM | ..."
    const days = googleHours.split(' | ');

    days.forEach(dayStr => {
        const parts = dayStr.split(': ');
        if (parts.length < 2) return;

        const dayNameEng = parts[0].trim();
        const hours = parts.slice(1).join(': ').trim();

        const dayInfo = dayMap[dayNameEng];
        if (!dayInfo) return;

        const dayIndex = schedule.findIndex(s => s.day === dayInfo.day);
        if (dayIndex === -1) return;

        if (hours.toLowerCase() === 'closed' || hours.toLowerCase() === 'kapalı') {
            schedule[dayIndex].isOpen = false;
        } else {
            // Parse "9:00 AM – 6:00 PM" or "09:00 – 18:00"
            const timeMatch = hours.match(/(\d{1,2}):(\d{2})\s*(?:AM|PM)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(?:AM|PM)?/i);
            if (timeMatch) {
                let openH = parseInt(timeMatch[1], 10);
                const openM = timeMatch[2];
                let closeH = parseInt(timeMatch[3], 10);
                const closeM = timeMatch[4];

                // Handle AM/PM if present
                if (hours.toLowerCase().includes('pm')) {
                    const firstPm = hours.toLowerCase().indexOf('pm');
                    const secondPm = hours.toLowerCase().lastIndexOf('pm');

                    // If close time has PM and it's not 12
                    if (firstPm < hours.indexOf('–') && openH < 12 && hours.toLowerCase().indexOf('am') === -1) {
                        openH += 12;
                    }
                    if (closeH < 12 && secondPm > hours.indexOf('–')) {
                        closeH += 12;
                    }
                }

                schedule[dayIndex] = {
                    ...schedule[dayIndex],
                    isOpen: true,
                    openHour: openH.toString().padStart(2, '0'),
                    openMinute: openM,
                    closeHour: closeH.toString().padStart(2, '0'),
                    closeMinute: closeM,
                };
            }
        }
    });

    return schedule;
};

// Helper: Convert DaySchedule array to string for storage
export const scheduleToString = (schedule: DaySchedule[]): string => {
    // Null safety check
    if (!schedule || schedule.length === 0) return '';

    const dayNames: Record<string, string> = {
        'monday': 'Monday',
        'tuesday': 'Tuesday',
        'wednesday': 'Wednesday',
        'thursday': 'Thursday',
        'friday': 'Friday',
        'saturday': 'Saturday',
        'sunday': 'Sunday',
    };

    return schedule
        .map(day => {
            if (!day) return '';
            const dayName = dayNames[day.day] || day.day;
            if (!day.isOpen) return `${dayName}: Closed`;
            return `${dayName}: ${day.openHour}:${day.openMinute} – ${day.closeHour}:${day.closeMinute}`;
        })
        .filter(Boolean)
        .join(' | ');
};

export default OpeningHoursEditor;
