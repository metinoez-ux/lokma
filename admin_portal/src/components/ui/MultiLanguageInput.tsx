import React, { useState } from 'react';

// Common languages for the Lokma portal
const LANGUAGES = [
    { code: 'tr', label: 'TR', name: 'Türkçe' },
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'de', label: 'DE', name: 'Deutsch' },
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'it', label: 'IT', name: 'Italiano' },
    { code: 'es', label: 'ES', name: 'Español' },
];

export type TranslationsMap = Record<string, string>;

interface MultiLanguageInputProps {
    value: TranslationsMap | string;
    onChange: (newValue: TranslationsMap) => void;
    label: string;
    placeholder?: string;
    required?: boolean;
    error?: string;
    isTextArea?: boolean;
}

export default function MultiLanguageInput({
    value,
    onChange,
    label,
    placeholder,
    required,
    error,
    isTextArea = false
}: MultiLanguageInputProps) {
    const [activeTab, setActiveTab] = useState('tr');

    // Ensure value is a record
    const ensureMap = (val: TranslationsMap | string | undefined | null): TranslationsMap => {
        if (!val) return { tr: '' };
        if (typeof val === 'string') return { tr: val };
        return { ...val } as TranslationsMap; // Clone
    };

    const currentValueMap = ensureMap(value);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newMap = { ...currentValueMap };
        newMap[activeTab] = e.target.value;
        onChange(newMap);
    };

    return (
        <div className="mb-4">
            <div className="flex justify-between items-end mb-2">
                <label className="block text-sm text-gray-400">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-800 rounded-t-lg border-b border-gray-700 overflow-x-auto scrollbar-thin">
                {LANGUAGES.map((lang) => {
                    const hasValue = currentValueMap[lang.code] && currentValueMap[lang.code].trim().length > 0;
                    const isActive = activeTab === lang.code;

                    return (
                        <button
                            key={lang.code}
                            type="button"
                            onClick={() => setActiveTab(lang.code)}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap
                                ${isActive
                                    ? 'text-white border-blue-500 bg-gray-700'
                                    : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-700/50'
                                }`}
                            title={lang.name}
                        >
                            {lang.label}
                            {hasValue && !isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                            )}
                            {!hasValue && lang.code === 'tr' && required && (
                                <span className="text-red-500">*</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Input Area */}
            <div className="relative">
                {isTextArea ? (
                    <textarea
                        value={currentValueMap[activeTab] || ''}
                        onChange={handleTextChange}
                        placeholder={placeholder || `${LANGUAGES.find(l => l.code === activeTab)?.name} olarak girin...`}
                        className={`w-full bg-gray-900 border-x border-b rounded-b-lg px-4 py-3 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-blue-500
                            ${error && activeTab === 'tr' ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-600'}`}
                    />
                ) : (
                    <input
                        type="text"
                        value={currentValueMap[activeTab] || ''}
                        onChange={handleTextChange}
                        placeholder={placeholder || `${LANGUAGES.find(l => l.code === activeTab)?.name} olarak girin...`}
                        className={`w-full bg-gray-900 border-x border-b rounded-b-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500
                            ${error && activeTab === 'tr' ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-600'}`}
                    />
                )}

                {/* Language indicator overlay */}
                <div className="absolute top-3 right-3 pointer-events-none opacity-20 font-bold text-gray-500 select-none">
                    {activeTab.toUpperCase()}
                </div>
            </div>

            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
    );
}
