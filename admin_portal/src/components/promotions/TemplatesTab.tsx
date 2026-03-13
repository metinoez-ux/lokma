'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PromotionTemplate {
    id: string;
    name: string;
    nameTranslations: Record<string, string>;
    description: string;
    type: string;
    icon: string;
    defaultValue: number;
    defaultDurationDays: number;
    minPlanTier: string; // legacy field (backward compat)
    availablePlans: string[]; // NEW: which plans can see this
    allowedPopupFormats: string[];
    isActive: boolean;
    sortOrder: number;
}

interface Props {
    templates: PromotionTemplate[];
    setTemplates: (t: PromotionTemplate[]) => void;
    loaded: boolean;
    setLoaded: (b: boolean) => void;
}

const PROMOTION_TYPES = [
    // — Klassische Rabattmodelle —
    { value: 'percentOff', label: 'Prozent-Rabatt (%)', icon: '🔥' },
    { value: 'fixedOff', label: 'Fester Rabatt (€)', icon: '🎉' },
    { value: 'freeDelivery', label: 'Gratis Lieferung', icon: '🚚' },
    { value: 'buyXGetY', label: '1 kaufen 1 gratis (BOGO)', icon: '🎁' },
    { value: 'minOrderDiscount', label: 'Min. Bestellrabatt', icon: '💰' },
    // — Zeitbasiert & Events —
    { value: 'happyHour', label: 'Happy Hour', icon: '⏰' },
    { value: 'flashSale', label: 'Flash Sale (Blitzangebot)', icon: '⚡' },
    // — Treue & Belohnung —
    { value: 'loyaltyCard', label: 'Stempelkarte (Treuekarte)', icon: '🎖️' },
    { value: 'cashback', label: 'Cashback (Guthabenerstattung)', icon: '💸' },
    { value: 'spinWheel', label: 'Glücksrad (Gamification)', icon: '🎰' },
    // — Produkt- & Warenkorbbasiert —
    { value: 'bundleDeal', label: 'Bundle / Combo-Paket', icon: '📦' },
    { value: 'productDiscount', label: 'Produktrabatt', icon: '🏷️' },
    { value: 'cartBooster', label: 'Warenkorb-Booster (X€+ → Y gratis)', icon: '🛒' },
    // — Zielgerichtet & Automatisch —
    { value: 'segmentCampaign', label: 'Segment-Kampagne (VIP/Neu/Wiederkehrend)', icon: '🎯' },
    { value: 'firstOrderSurprise', label: 'Erstbestell-Überraschung', icon: '💳' },
    { value: 'pushPromo', label: 'Push-Only Promotion', icon: '📲' },
];

const POPUP_FORMATS = [
    { value: 'bottomSheet', label: 'Bottom Sheet' },
    { value: 'centerModal', label: 'Zentriertes Popup' },
    { value: 'topBanner', label: 'Oberes Banner' },
    { value: 'snackbar', label: 'Benachrichtigungsleiste' },
];

const PLAN_TIERS = [
    { value: 'free', label: 'Free' },
    { value: 'basic', label: 'Basic' },
    { value: 'pro', label: 'Pro' },
    { value: 'ultra', label: 'Ultra' },
];

const defaultTemplate: Omit<PromotionTemplate, 'id'> = {
    name: '',
    nameTranslations: { tr: '', en: '', de: '' },
    description: '',
    type: 'percentOff',
    icon: '🔥',
    defaultValue: 10,
    defaultDurationDays: 30,
    minPlanTier: 'free',
    availablePlans: ['free', 'basic', 'pro', 'ultra'],
    allowedPopupFormats: ['bottomSheet', 'centerModal'],
    isActive: true,
    sortOrder: 0,
};

export default function TemplatesTab({ templates, setTemplates, loaded, setLoaded }: Props) {
    const [loading, setLoading] = useState(!loaded);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<PromotionTemplate | null>(null);
    const [form, setForm] = useState<Omit<PromotionTemplate, 'id'>>(defaultTemplate);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<PromotionTemplate | null>(null);

    useEffect(() => {
        if (loaded) return;
        const load = async () => {
            setLoading(true);
            try {
                const snap = await getDocs(query(collection(db, 'promotionTemplates'), orderBy('sortOrder', 'asc')));
                setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as PromotionTemplate)));
            } catch (e) {
                console.error('TemplatesTab load error:', e);
            }
            setLoading(false);
            setLoaded(true);
        };
        load();
    }, []);

    const openAdd = () => { setEditing(null); setForm({ ...defaultTemplate, sortOrder: templates.length }); setShowModal(true); };
    const openEdit = (t: PromotionTemplate) => {
        setEditing(t);
        // If availablePlans missing, derive from minPlanTier (backward compat)
        const plans = t.availablePlans || PLAN_TIERS.filter(p => (PLAN_TIERS.findIndex(pt => pt.value === p.value)) >= (PLAN_TIERS.findIndex(pt => pt.value === (t.minPlanTier || 'free')))).map(p => p.value);
        setForm({ name: t.name, nameTranslations: t.nameTranslations || { tr: '', en: '', de: '' }, description: t.description, type: t.type, icon: t.icon, defaultValue: t.defaultValue, defaultDurationDays: t.defaultDurationDays, minPlanTier: t.minPlanTier || 'free', availablePlans: plans, allowedPopupFormats: t.allowedPopupFormats || [], isActive: t.isActive, sortOrder: t.sortOrder });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() && !form.nameTranslations?.tr?.trim()) return;
        setSaving(true);
        try {
            const data = { ...form, name: form.nameTranslations?.tr || form.name };
            if (editing) {
                await updateDoc(doc(db, 'promotionTemplates', editing.id), data);
                setTemplates(templates.map(t => t.id === editing.id ? { ...t, ...data } : t));
            } else {
                const ref = await addDoc(collection(db, 'promotionTemplates'), data);
                setTemplates([...templates, { id: ref.id, ...data }]);
            }
            setShowModal(false);
        } catch (e) {
            console.error('Template save error:', e);
        }
        setSaving(false);
    };

    const handleDelete = async (tpl: PromotionTemplate) => {
        await deleteDoc(doc(db, 'promotionTemplates', tpl.id));
        setTemplates(templates.filter(t => t.id !== tpl.id));
        setConfirmDelete(null);
    };

    const toggleActive = async (tpl: PromotionTemplate) => {
        await updateDoc(doc(db, 'promotionTemplates', tpl.id), { isActive: !tpl.isActive });
        setTemplates(templates.map(t => t.id === tpl.id ? { ...t, isActive: !t.isActive } : t));
    };

    const toggleFormat = (fmt: string) => {
        const current = form.allowedPopupFormats;
        setForm({ ...form, allowedPopupFormats: current.includes(fmt) ? current.filter(f => f !== fmt) : [...current, fmt] });
    };

    const togglePlan = (plan: string) => {
        const current = form.availablePlans || [];
        setForm({ ...form, availablePlans: current.includes(plan) ? current.filter(p => p !== plan) : [...current, plan] });
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-white font-bold text-lg">📋 Kampagnen-Vorlagen</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Unternehmen können diese Vorlagen mit einem Klick aktivieren</p>
                </div>
                <button onClick={openAdd} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition">
                    + Vorlage hinzufügen
                </button>
            </div>

            {templates.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <span className="text-5xl">📋</span>
                    <h3 className="text-lg font-medium text-white mt-4">Noch keine Vorlagen</h3>
                    <p className="text-gray-400 mt-2">Vorlagen ermöglichen Unternehmen schnelle Kampagnenerstellung</p>
                    <button onClick={openAdd} className="mt-4 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition">+ Erste Vorlage erstellen</button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {templates.sort((a, b) => a.sortOrder - b.sortOrder).map(tpl => {
                        const typeInfo = PROMOTION_TYPES.find(t => t.value === tpl.type);
                        const tierColors: Record<string, string> = { free: 'text-gray-400', basic: 'text-blue-400', pro: 'text-amber-400', ultra: 'text-purple-400' };
                        return (
                            <div key={tpl.id} className={`bg-gray-800 rounded-xl overflow-hidden border p-4 ${tpl.isActive ? 'border-violet-800/50' : 'border-gray-700 opacity-60'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{tpl.icon}</span>
                                        <div>
                                            <h3 className="text-white font-semibold">{tpl.nameTranslations?.tr || tpl.name}</h3>
                                            <p className="text-gray-400 text-sm">{tpl.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => toggleActive(tpl)} className={`p-1.5 rounded-lg text-sm text-white ${tpl.isActive ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'}`}>{tpl.isActive ? '✅' : '⏸️'}</button>
                                        <button onClick={() => openEdit(tpl)} className="p-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-white text-sm">✏️</button>
                                        <button onClick={() => setConfirmDelete(tpl)} className="p-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm">🗑️</button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
                                    <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{typeInfo?.icon} {typeInfo?.label}</span>
                                    <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded">⏱ {tpl.defaultDurationDays} Tage</span>
                                    {(tpl.availablePlans || [tpl.minPlanTier]).map(plan => {
                                        const planColors: Record<string, string> = { free: 'bg-gray-600 text-gray-200', basic: 'bg-blue-900/50 text-blue-300', pro: 'bg-amber-900/50 text-amber-300', ultra: 'bg-purple-900/50 text-purple-300' };
                                        return <span key={plan} className={`px-2 py-0.5 rounded ${planColors[plan] || 'bg-gray-700 text-gray-300'}`}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</span>;
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">{editing ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>

                        <div className="space-y-4">
                            {/* Icon + Names */}
                            <div className="flex gap-3">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Icon</label>
                                    <input type="text" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                                        className="w-16 px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-2xl text-center" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-gray-400 text-sm mb-1 block">Vorlagenname (TR) *</label>
                                    <input type="text" value={form.nameTranslations?.tr || ''}
                                        onChange={e => setForm({ ...form, nameTranslations: { ...form.nameTranslations, tr: e.target.value } })}
                                        placeholder="z.B. Gratis-Lieferungstag"
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Englisch (EN)</label>
                                    <input type="text" value={form.nameTranslations?.en || ''}
                                        onChange={e => setForm({ ...form, nameTranslations: { ...form.nameTranslations, en: e.target.value } })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Deutsch (DE)</label>
                                    <input type="text" value={form.nameTranslations?.de || ''}
                                        onChange={e => setForm({ ...form, nameTranslations: { ...form.nameTranslations, de: e.target.value } })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Französisch (FR)</label>
                                    <input type="text" value={form.nameTranslations?.fr || ''}
                                        onChange={e => setForm({ ...form, nameTranslations: { ...form.nameTranslations, fr: e.target.value } })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Spanisch (ES)</label>
                                    <input type="text" value={form.nameTranslations?.es || ''}
                                        onChange={e => setForm({ ...form, nameTranslations: { ...form.nameTranslations, es: e.target.value } })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Italienisch (IT)</label>
                                    <input type="text" value={form.nameTranslations?.it || ''}
                                        onChange={e => setForm({ ...form, nameTranslations: { ...form.nameTranslations, it: e.target.value } })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Niederländisch (NL)</label>
                                    <input type="text" value={form.nameTranslations?.nl || ''}
                                        onChange={e => setForm({ ...form, nameTranslations: { ...form.nameTranslations, nl: e.target.value } })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Beschreibung</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    rows={2} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none focus:ring-2 focus:ring-violet-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Rabatttyp</label>
                                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                                        {PROMOTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">Standardwert</label>
                                    <input type="number" value={form.defaultValue} onChange={e => setForm({ ...form, defaultValue: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Dauer (Tage)</label>
                                <input type="number" value={form.defaultDurationDays} onChange={e => setForm({ ...form, defaultDurationDays: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500" />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">In welchen Plänen sichtbar?</label>
                                <div className="flex flex-wrap gap-2">
                                    {PLAN_TIERS.map(p => {
                                        const isSelected = (form.availablePlans || []).includes(p.value);
                                        const planColors: Record<string, string> = { free: 'bg-gray-600', basic: 'bg-blue-600', pro: 'bg-amber-600', ultra: 'bg-purple-600' };
                                        return (
                                            <button key={p.value} type="button" onClick={() => togglePlan(p.value)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${isSelected ? `${planColors[p.value] || 'bg-violet-600'} text-white` : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                    }`}>
                                                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs ${isSelected ? 'border-white bg-white/20' : 'border-gray-500'}`}>
                                                    {isSelected && '✓'}
                                                </span>
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-gray-500 text-xs mt-1.5">Unternehmen mit den ausgewählten Plänen können diese Vorlage sehen</p>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">Popup-Formate</label>
                                <div className="flex flex-wrap gap-2">
                                    {POPUP_FORMATS.map(f => (
                                        <button key={f.value} onClick={() => toggleFormat(f.value)}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition ${form.allowedPopupFormats.includes(f.value) ? 'bg-violet-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} id="tpl-active" className="w-4 h-4 accent-violet-500" />
                                <label htmlFor="tpl-active" className="text-gray-300 text-sm cursor-pointer">Aktiv (für Unternehmen sichtbar)</label>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition">Abbrechen</button>
                            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition disabled:opacity-50">
                                {saving ? 'Wird gespeichert...' : 'Speichern'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center">
                        <span className="text-4xl">🗑️</span>
                        <h3 className="text-white font-bold mt-3">Vorlage löschen</h3>
                        <p className="text-gray-400 text-sm mt-2">Sind Sie sicher, dass Sie die Vorlage "{confirmDelete.nameTranslations?.tr || confirmDelete.name}" endgültig löschen möchten?</p>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">Abbrechen</button>
                            <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500">Löschen</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
