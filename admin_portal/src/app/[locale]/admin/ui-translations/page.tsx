'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import Papa from 'papaparse';

import trData from '../../../../../messages/tr.json';
import enData from '../../../../../messages/en.json';
import deData from '../../../../../messages/de.json';
import frData from '../../../../../messages/fr.json';
import itData from '../../../../../messages/it.json';
import esData from '../../../../../messages/es.json';

// Define the shape of our translations data
type TranslationKey = {
    namespace: string;
    key: string;
    translations: Record<string, string>;
};

const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

const LOCAL_MESSAGES: Record<string, any> = {
    tr: trData,
    en: enData,
    de: deData,
    fr: frData,
    it: itData,
    es: esData
};

// Helper to flatten nested objects
function flattenObject(obj: any, prefix = ''): Record<string, string> {
    let result: Record<string, string> = {};
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(result, flattenObject(obj[key], prefix + key + '.'));
        } else {
            result[prefix + key] = String(obj[key]);
        }
    }
    return result;
}

// Helper to unflatten dotted keys back to nested objects
function unflattenObject(flatObj: Record<string, string>): any {
    const result: any = {};
    for (const key in flatObj) {
        const parts = key.split('.');
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = flatObj[key];
    }
    return result;
}

export default function TranslationsPage() {
    const t = useTranslations('AdminNav');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [translationKeys, setTranslationKeys] = useState<TranslationKey[]>([]);
    const [selectedNamespace, setSelectedNamespace] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMissingOnly, setFilterMissingOnly] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ROWS_PER_PAGE = 15;

    // Extract namespaces for the filter dropdown
    const namespaces = ['All', ...Array.from(new Set(translationKeys.map(k => k.namespace)))];

    useEffect(() => {
        loadTranslations();
    }, []);

    const processTranslationsToMap = (data: any, langCode: string, map: Map<string, TranslationKey>) => {
        Object.keys(data).forEach(topLevelKey => {
            const sectionData = data[topLevelKey];
            const flatSection = typeof sectionData === 'object' && sectionData !== null
                ? flattenObject(sectionData)
                : { '': String(sectionData) };

            Object.keys(flatSection).forEach(deepKey => {
                const keyPath = deepKey ? deepKey : topLevelKey;
                const namespace = deepKey ? topLevelKey : 'Global';
                const mapKey = `${namespace}.${keyPath}`;

                if (!map.has(mapKey)) {
                    map.set(mapKey, {
                        namespace,
                        key: keyPath,
                        translations: { tr: '', en: '', de: '', fr: '', it: '', es: '' }
                    });
                }

                map.get(mapKey)!.translations[langCode] = flatSection[deepKey] || '';
            });
        });
    };

    const loadTranslations = async () => {
        setLoading(true);
        try {
            const translationsMap = new Map<string, TranslationKey>();

            // 1. Process local JSON files FIRST as a baseline
            Object.entries(LOCAL_MESSAGES).forEach(([langCode, data]) => {
                if (LANGUAGES.includes(langCode)) {
                    processTranslationsToMap(data, langCode, translationsMap);
                }
            });

            // 2. Overlay Firestore data
            const snapshot = await getDocs(collection(db, 'translations'));
            snapshot.docs.forEach(docSnap => {
                const langCode = docSnap.id;
                if (!LANGUAGES.includes(langCode)) return;

                const data = docSnap.data();
                processTranslationsToMap(data, langCode, translationsMap);
            });

            const keysArray = Array.from(translationsMap.values());
            keysArray.sort((a, b) => {
                if (a.namespace !== b.namespace) return a.namespace.localeCompare(b.namespace);
                return a.key.localeCompare(b.key);
            });

            setTranslationKeys(keysArray);
        } catch (error) {
            console.error('Error fetching translations:', error);
            alert('Çeviriler yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleTranslationChange = (index: number, lang: string, value: string) => {
        const updatedKeys = [...translationKeys];
        updatedKeys[index].translations[lang] = value;
        setTranslationKeys(updatedKeys);
    };

    const saveTranslations = async () => {
        setSaving(true);
        try {
            const flatDocumentsByLang: Record<string, Record<string, string>> = {};
            LANGUAGES.forEach(lang => { flatDocumentsByLang[lang] = {}; });

            translationKeys.forEach(item => {
                LANGUAGES.forEach(lang => {
                    // Reconstruct full dotted path
                    const fullKey = item.namespace === 'Global' ? item.key : `${item.namespace}.${item.key}`;
                    if (item.translations[lang]) {
                        flatDocumentsByLang[lang][fullKey] = item.translations[lang];
                    }
                });
            });

            const promises = LANGUAGES.map(lang => {
                const unflattened = unflattenObject(flatDocumentsByLang[lang]);
                // using setDoc without merge completely replaces the document, cleaning up deleted keys.
                return setDoc(doc(db, 'translations', lang), unflattened);
            });

            await Promise.all(promises);
            alert('Çeviriler başarıyla güncellendi!');
        } catch (error) {
            console.error('Error saving translations:', error);
            alert('Kaydetme sırasında bir hata oluştu!');
        } finally {
            setSaving(false);
        }
    };

    const addTranslationKey = () => {
        const namespace = prompt("Ana kategori girin (örn: App, AdminPortal, Global):");
        if (!namespace) return;
        const key = prompt("Alt kırılımları nokta ile ayırarak girin (örn: Auth.loginButton, Orders.emptyState):");
        if (!key) return;

        const mapKey = `${namespace}.${key}`;
        const exists = translationKeys.some(k => k.namespace === namespace && k.key === key);

        if (exists) {
            alert("Bu anahtar zaten mevcut!");
            return;
        }

        setTranslationKeys([{
            namespace,
            key,
            translations: { tr: '', en: '', de: '', fr: '', it: '', es: '' }
        }, ...translationKeys]);
    };

    const exportToCsv = () => {
        const csvData = translationKeys.map(item => {
            return {
                Namespace: item.namespace,
                Key: item.key,
                TR: item.translations.tr || '',
                EN: item.translations.en || '',
                DE: item.translations.de || '',
                FR: item.translations.fr || '',
                IT: item.translations.it || '',
                ES: item.translations.es || '',
            }
        });

        const csv = Papa.unparse(csvData);
        // Add BOM so Excel opens UTF-8 correctly
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'lokma_translations.csv';
        link.click();
    };

    const importFromCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedData = results.data as any[];
                let updatedKeys = [...translationKeys];
                let importedCount = 0;

                parsedData.forEach(row => {
                    const ns = row.Namespace || row.namespace;
                    const k = row.Key || row.key;

                    if (!ns || !k) return;

                    const existingIndex = updatedKeys.findIndex(item => item.namespace === ns && item.key === k);

                    if (existingIndex >= 0) {
                        updatedKeys[existingIndex].translations = {
                            tr: row.TR || row.tr || updatedKeys[existingIndex].translations.tr,
                            en: row.EN || row.en || updatedKeys[existingIndex].translations.en,
                            de: row.DE || row.de || updatedKeys[existingIndex].translations.de,
                            fr: row.FR || row.fr || updatedKeys[existingIndex].translations.fr,
                            it: row.IT || row.it || updatedKeys[existingIndex].translations.it,
                            es: row.ES || row.es || updatedKeys[existingIndex].translations.es,
                        };
                    } else {
                        updatedKeys.push({
                            namespace: ns,
                            key: k,
                            translations: {
                                tr: row.TR || row.tr || '',
                                en: row.EN || row.en || '',
                                de: row.DE || row.de || '',
                                fr: row.FR || row.fr || '',
                                it: row.IT || row.it || '',
                                es: row.ES || row.es || '',
                            }
                        });
                    }
                    importedCount++;
                });

                // Re-sort to maintain order
                updatedKeys.sort((a, b) => {
                    if (a.namespace !== b.namespace) return a.namespace.localeCompare(b.namespace);
                    return a.key.localeCompare(b.key);
                });

                setTranslationKeys(updatedKeys);
                alert(`${importedCount} satır CSV başarıyla içe aktarıldı. Kalıcı olarak kaydetmek için "Tümünü Kaydet" butonuna basmayı unutmayın.`);

                // Clear the input value so the exact same file can be selected again if needed
                event.target.value = '';
            },
            error: (error) => {
                console.error("CSV parse error:", error);
                alert("CSV dosyası okunurken bir hata oluştu.");
            }
        });
    };

    // Filter keys based on search, selected namespace, and missing status
    const filteredKeys = translationKeys.filter(item => {
        const matchesNamespace = selectedNamespace === 'All' || item.namespace === selectedNamespace;
        const matchesSearch = item.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            Object.values(item.translations).some(val => val.toLowerCase().includes(searchTerm.toLowerCase()));

        let matchesMissing = true;
        if (filterMissingOnly) {
            // If any locale exists but is empty/whitespace, or if any missing translations
            matchesMissing = LANGUAGES.some(lang => !item.translations[lang] || item.translations[lang].trim() === '');
        }

        return matchesNamespace && matchesSearch && matchesMissing;
    });

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedNamespace, filterMissingOnly]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredKeys.length / ROWS_PER_PAGE);
    const paginatedKeys = filteredKeys.slice(
        (currentPage - 1) * ROWS_PER_PAGE,
        currentPage * ROWS_PER_PAGE
    );

    if (loading) {
        return (
            <div className="p-8 text-center max-w-7xl mx-auto">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Çeviriler Yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Arayüz Çevirileri (CMS)</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Uygulama genelindeki tüm sabit metinleri (UI) dinamik olarak yönetin.
                    </p>
                </div>
                <div className="flex gap-3">
                    {/* CSV Upload Data input implicitly handles click events on label wrap */}
                    <label className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors font-medium border border-slate-600 shadow-sm flex items-center gap-2 cursor-pointer">
                        <span>📥</span>
                        <span className="hidden sm:inline">CSV İçe Aktar</span>
                        <input type="file" accept=".csv" onChange={importFromCsv} className="hidden" />
                    </label>
                    <button
                        onClick={exportToCsv}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors font-medium border border-slate-600 shadow-sm flex items-center gap-2"
                    >
                        <span>📤</span>
                        <span className="hidden sm:inline">CSV Dışa Aktar</span>
                    </button>
                    <div className="w-px h-10 bg-slate-700 mx-1"></div>
                    <button
                        onClick={addTranslationKey}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium border border-slate-600 shadow-sm flex items-center gap-2"
                    >
                        <span>+</span>
                        <span className="hidden sm:inline">Yeni Ekle</span>
                    </button>
                    <button
                        onClick={saveTranslations}
                        disabled={saving}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                Kaydediliyor...
                            </span>
                        ) : (
                            <>
                                <span>💾</span>
                                <span>Tümünü Kaydet</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[250px]">
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Anahtar (key) veya metin içinde ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="w-48">
                        <select
                            value={selectedNamespace}
                            onChange={(e) => setSelectedNamespace(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                        >
                            <option value="All">Tüm Alanlar (Namespaces)</option>
                            <optgroup label="Admin Panel (Web)">
                                {namespaces.filter(ns => ['Navigation', 'AdminNav', 'Landing', 'AdminPortal', 'Global'].includes(ns) && ns !== 'All').map(ns => (
                                    <option key={ns} value={ns}>{ns}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Mobil Uygulama (App)">
                                {namespaces.filter(ns => !['Navigation', 'AdminNav', 'Landing', 'AdminPortal', 'Global', 'All'].includes(ns)).map(ns => (
                                    <option key={ns} value={ns}>{ns}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filterMissingOnly}
                                onChange={(e) => setFilterMissingOnly(e.target.checked)}
                                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                            />
                            <span className="text-sm text-slate-300 font-medium select-none">Sadece Eksik Çeviriler</span>
                        </label>
                    </div>
                </div>

                {/* Translations Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-semibold uppercase text-xs w-64 min-w-[250px]">Key (Arahtarı)</th>
                                {LANGUAGES.map(lang => (
                                    <th key={lang} className="px-4 py-3 font-semibold uppercase text-xs text-center min-w-[160px]">
                                        {lang}
                                        {lang === 'tr' && ' 🇹🇷'}
                                        {lang === 'en' && ' 🇬🇧'}
                                        {lang === 'de' && ' 🇩🇪'}
                                        {lang === 'fr' && ' 🇫🇷'}
                                        {lang === 'it' && ' 🇮🇹'}
                                        {lang === 'es' && ' 🇪🇸'}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700 bg-slate-800">
                            {paginatedKeys.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        Bu kriterlere uygun çeviri bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                paginatedKeys.map((item) => {
                                    // Find the original index to reliably update the full state
                                    const originalIndex = translationKeys.findIndex(k => k.namespace === item.namespace && k.key === item.key);
                                    return (
                                        <tr key={`${item.namespace}.${item.key}`} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3 border-r border-slate-700/50">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-indigo-400 font-mono mb-1">{item.namespace}</span>
                                                    <span className="text-white font-medium">{item.key}</span>
                                                </div>
                                            </td>
                                            {LANGUAGES.map(lang => (
                                                <td key={lang} className="px-2 py-2 border-r border-slate-700/50 last:border-0 relative group">
                                                    <textarea
                                                        value={item.translations[lang] || ''}
                                                        onChange={(e) => handleTranslationChange(originalIndex, lang, e.target.value)}
                                                        className="w-full bg-slate-900/50 hover:bg-slate-900 focus:bg-slate-900 border border-transparent hover:border-slate-600 focus:border-indigo-500 rounded px-3 py-2 text-sm text-slate-200 transition-colors resize-y min-h-[42px] focus:outline-none"
                                                        rows={1}
                                                        placeholder={`${lang} çevirisi...`}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="bg-slate-900/80 px-4 py-3 border-t border-slate-700 flex items-center justify-between">
                        <div className="text-sm text-slate-400 select-none">
                            Toplam <span className="font-semibold text-white">{filteredKeys.length}</span> kayıttan <span className="font-semibold text-white">{(currentPage - 1) * ROWS_PER_PAGE + 1} - {Math.min(currentPage * ROWS_PER_PAGE, filteredKeys.length)}</span> arası gösteriliyor.
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded bg-slate-800 border border-slate-600 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                            >
                                Önceki
                            </button>
                            <div className="px-3 py-1.5 rounded bg-slate-800 border border-slate-600 text-white font-medium select-none text-sm flex items-center">
                                {currentPage} / {totalPages}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded bg-slate-800 border border-slate-600 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                            >
                                Sonraki
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
