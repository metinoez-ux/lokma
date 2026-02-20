'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

// Define the shape of our translations data
type TranslationKey = {
    namespace: string;
    key: string;
    translations: Record<string, string>;
};

const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

export default function TranslationsPage() {
    const t = useTranslations('AdminNav');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [translationKeys, setTranslationKeys] = useState<TranslationKey[]>([]);
    const [selectedNamespace, setSelectedNamespace] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');

    // Extract namespaces for the filter dropdown
    const namespaces = ['All', ...Array.from(new Set(translationKeys.map(k => k.namespace)))];

    useEffect(() => {
        loadTranslations();
    }, []);

    const loadTranslations = async () => {
        setLoading(true);
        try {
            // 1. Fetch all language documents from translations collection
            const snapshot = await getDocs(collection(db, 'translations'));

            // 2. Build a unified map where structure is: 
            // Map<"Namespace.Key", { tr: "deger", en: "value" }>
            const translationsMap = new Map<string, TranslationKey>();

            snapshot.docs.forEach(docSnap => {
                const langCode = docSnap.id; // e.g. 'tr', 'en'
                if (!LANGUAGES.includes(langCode)) return;

                const data = docSnap.data();

                // Iterate top-level namespaces (e.g., 'AdminNav', 'Landing')
                Object.keys(data).forEach(namespace => {
                    const keys = data[namespace];

                    if (typeof keys === 'object' && keys !== null) {
                        Object.keys(keys).forEach(key => {
                            const mapKey = `${namespace}.${key}`;

                            if (!translationsMap.has(mapKey)) {
                                translationsMap.set(mapKey, {
                                    namespace,
                                    key,
                                    translations: {
                                        tr: '', en: '', de: '', fr: '', it: '', es: ''
                                    }
                                });
                            }

                            const entry = translationsMap.get(mapKey)!;
                            entry.translations[langCode] = keys[key] || '';
                        });
                    }
                });
            });

            // 3. Convert Map to Array and sort
            const keysArray = Array.from(translationsMap.values());
            keysArray.sort((a, b) => {
                if (a.namespace !== b.namespace) {
                    return a.namespace.localeCompare(b.namespace);
                }
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
            // Rebuild the documents for each language
            const documentsByLang: Record<string, any> = {};
            LANGUAGES.forEach(lang => { documentsByLang[lang] = {}; });

            translationKeys.forEach(item => {
                LANGUAGES.forEach(lang => {
                    if (!documentsByLang[lang][item.namespace]) {
                        documentsByLang[lang][item.namespace] = {};
                    }
                    documentsByLang[lang][item.namespace][item.key] = item.translations[lang] || '';
                });
            });

            // Write them back to Firestore
            const promises = LANGUAGES.map(lang =>
                setDoc(doc(db, 'translations', lang), documentsByLang[lang], { merge: true })
            );

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
        const namespace = prompt("Yeni namespace girin (örn: AdminNav, Landing):");
        if (!namespace) return;
        const key = prompt("Yeni anahtar kelimesini girin (örn: welcomeMessage):");
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

    // Filter keys based on search and selected namespace
    const filteredKeys = translationKeys.filter(item => {
        const matchesNamespace = selectedNamespace === 'All' || item.namespace === selectedNamespace;
        const matchesSearch = item.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            Object.values(item.translations).some(val => val.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesNamespace && matchesSearch;
    });

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
                    <button
                        onClick={addTranslationKey}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium border border-slate-600 shadow-sm flex items-center gap-2"
                    >
                        <span>+</span>
                        <span>Yeni Ekle</span>
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
                            {namespaces.map(ns => (
                                <option key={ns} value={ns}>{ns === 'All' ? 'Tüm Alanlar (Namespaces)' : ns}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Translations Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-900/50 text-slate-400 sticky top-0 border-b border-slate-700">
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
                            {filteredKeys.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                filteredKeys.map((item) => {
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
            </div>
        </div>
    );
}
