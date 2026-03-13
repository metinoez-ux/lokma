'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { auth } from '@/lib/firebase';
import { CompanySettings, GermanLegalForm, GERMAN_LEGAL_FORM_LABELS } from '@/types';
import { getCompanySettings, saveCompanySettings } from '@/lib/companySettings';

const DEFAULT_SETTINGS: CompanySettings = {
    companyName: '',
    legalForm: 'gmbh',
    address: '',
    postalCode: '',
    city: '',
    country: 'Deutschland',
    phone: '',
    customerServicePhone: '',
    businessInfoPhone: '',
    email: '',
    website: '',
    taxId: '',
    vatId: '',
    iban: '',
    bic: '',
    bankName: '',
    accountHolder: '',
    registerCourt: '',
    registerNumber: '',
    managingDirector: '',
    authorizedRepresentative: '',
};

export default function CompanySettingsPage() {
    const router = useRouter();
    const t = useTranslations('AdminCompanySettings');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState<{ uid: string; email: string } | null>(null);
    const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [originalSettings, setOriginalSettings] = useState<string>('');

    // Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) { router.push('/login'); return; }
            setCurrentUser({ uid: user.uid, email: user.email || '' });
        });
        return () => unsub();
    }, [router]);

    // Load settings
    useEffect(() => {
        if (!currentUser) return;
        (async () => {
            try {
                const s = await getCompanySettings();
                setSettings(s);
                setOriginalSettings(JSON.stringify(s));
            } catch (err) {
                console.error('Failed to load company settings:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [currentUser]);

    // Track changes
    useEffect(() => {
        if (originalSettings) {
            setHasChanges(JSON.stringify(settings) !== originalSettings);
        }
    }, [settings, originalSettings]);

    const handleSave = async () => {
        if (!currentUser) return;
        setSaving(true);
        try {
            await saveCompanySettings(settings, currentUser.uid);
            const now = new Date().toLocaleString('de-DE');
            setSavedAt(now);
            setOriginalSettings(JSON.stringify(settings));
            setHasChanges(false);
            alert(`✅ ${t('saveSuccess')}`);
        } catch (err) {
            console.error('Save error:', err);
            alert(`❌ ${t('saveError')}`);
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field: keyof CompanySettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            🏢 {t('title')}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {t('subtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {savedAt && (
                            <span className="text-xs text-gray-500">
                                {t('lastSaved')}: {savedAt}
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className={`px-6 py-2.5 rounded-lg font-medium text-white transition-all ${hasChanges
                                ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30'
                                : 'bg-gray-600 cursor-not-allowed opacity-50'
                                }`}
                        >
                            {saving ? `⏳ ${t('saving')}` : hasChanges ? `💾 ${t('save')}` : `✅ ${t('saved')}`}
                        </button>
                    </div>
                </div>

                {/* Unsaved changes warning */}
                {hasChanges && (
                    <div className="bg-amber-600/20 border border-amber-600/40 rounded-xl p-3 mb-6 flex items-center gap-3">
                        <span className="text-amber-400">⚠️</span>
                        <span className="text-amber-300 text-sm">{t('unsavedChanges')}</span>
                    </div>
                )}

                {/* Form Sections */}
                <div className="space-y-6">

                    {/* === SECTION 1: Firmendaten === */}
                    <Section title={t('companyData')} icon="🏛️" description={t('companyDataDesc')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label={`${t('companyName')} *`} required>
                                <input
                                    type="text"
                                    value={settings.companyName}
                                    onChange={e => updateField('companyName', e.target.value)}
                                    placeholder="z.B. LOKMA GmbH"
                                    className="input-field"
                                />
                            </Field>
                            <Field label={`${t('legalForm')} *`} required>
                                <select
                                    value={settings.legalForm}
                                    onChange={e => updateField('legalForm', e.target.value as GermanLegalForm)}
                                    className="input-field"
                                >
                                    {Object.entries(GERMAN_LEGAL_FORM_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                        <Field label={`${t('streetAddress')} *`} full required>
                            <input
                                type="text"
                                value={settings.address}
                                onChange={e => updateField('address', e.target.value)}
                                placeholder="z.B. Schulte-Braucks-Str. 1"
                                className="input-field"
                            />
                        </Field>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Field label={`${t('postalCode')} *`} required>
                                <input
                                    type="text"
                                    value={settings.postalCode}
                                    onChange={e => updateField('postalCode', e.target.value)}
                                    placeholder="41836"
                                    className="input-field"
                                    maxLength={5}
                                />
                            </Field>
                            <Field label={`${t('city')} *`} required>
                                <input
                                    type="text"
                                    value={settings.city}
                                    onChange={e => updateField('city', e.target.value)}
                                    placeholder="Hückelhoven"
                                    className="input-field"
                                />
                            </Field>
                            <Field label={t('country')}>
                                <input
                                    type="text"
                                    value={settings.country}
                                    onChange={e => updateField('country', e.target.value)}
                                    className="input-field"
                                />
                            </Field>
                        </div>
                    </Section>

                    {/* === SECTION 2: Kontaktdaten === */}
                    <Section title={t('contactData')} icon="📞" description={t('contactDataDesc')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label={`${t('mainPhone')} *`} required>
                                <input
                                    type="tel"
                                    value={settings.phone}
                                    onChange={e => updateField('phone', e.target.value)}
                                    placeholder="+49 2433 123456"
                                    className="input-field"
                                />
                            </Field>
                            <Field label={`${t('email')} *`} required>
                                <input
                                    type="email"
                                    value={settings.email}
                                    onChange={e => updateField('email', e.target.value)}
                                    placeholder="info@lokma.shop"
                                    className="input-field"
                                />
                            </Field>
                            <Field label={t('customerServicePhone')}>
                                <input
                                    type="tel"
                                    value={settings.customerServicePhone || ''}
                                    onChange={e => updateField('customerServicePhone', e.target.value)}
                                    placeholder="+49 800 ..."
                                    className="input-field"
                                />
                            </Field>
                            <Field label={t('businessInfoPhone')}>
                                <input
                                    type="tel"
                                    value={settings.businessInfoPhone || ''}
                                    onChange={e => updateField('businessInfoPhone', e.target.value)}
                                    placeholder="+49 800 ..."
                                    className="input-field"
                                />
                            </Field>
                        </div>
                        <Field label={t('website')} full>
                            <input
                                type="url"
                                value={settings.website || ''}
                                onChange={e => updateField('website', e.target.value)}
                                placeholder="https://lokma.shop"
                                className="input-field"
                            />
                        </Field>
                    </Section>

                    {/* === SECTION 3: Steuerdaten === */}
                    <Section title={t('taxData')} icon="📋" description={t('taxDataDesc')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label={`${t('taxNumber')} *`} required>
                                <input
                                    type="text"
                                    value={settings.taxId}
                                    onChange={e => updateField('taxId', e.target.value)}
                                    placeholder="z.B. 123/456/78901"
                                    className="input-field"
                                />
                                <p className="text-gray-500 text-xs mt-1">{t('taxNumberHint')}</p>
                            </Field>
                            <Field label={`${t('vatId')} *`} required>
                                <input
                                    type="text"
                                    value={settings.vatId}
                                    onChange={e => updateField('vatId', e.target.value)}
                                    placeholder="DE123456789"
                                    className="input-field"
                                />
                                <p className="text-gray-500 text-xs mt-1">{t('vatIdHint')}</p>
                            </Field>
                        </div>
                    </Section>

                    {/* === SECTION 4: Bankverbindung === */}
                    <Section title={t('bankDetails')} icon="🏦" description={t('bankDetailsDesc')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label={`${t('iban')} *`} required>
                                <input
                                    type="text"
                                    value={settings.iban}
                                    onChange={e => updateField('iban', e.target.value)}
                                    placeholder="DE89 3704 0044 0532 0130 00"
                                    className="input-field font-mono"
                                />
                            </Field>
                            <Field label={`${t('bicSwift')} *`} required>
                                <input
                                    type="text"
                                    value={settings.bic}
                                    onChange={e => updateField('bic', e.target.value)}
                                    placeholder="COBADEFFXXX"
                                    className="input-field font-mono"
                                />
                            </Field>
                            <Field label={t('bankName')}>
                                <input
                                    type="text"
                                    value={settings.bankName || ''}
                                    onChange={e => updateField('bankName', e.target.value)}
                                    placeholder="z.B. Commerzbank"
                                    className="input-field"
                                />
                            </Field>
                            <Field label={t('accountHolder')}>
                                <input
                                    type="text"
                                    value={settings.accountHolder || ''}
                                    onChange={e => updateField('accountHolder', e.target.value)}
                                    placeholder={t('accountHolderPlaceholder')}
                                    className="input-field"
                                />
                            </Field>
                        </div>
                    </Section>

                    {/* === SECTION 5: Register (dynamic per legal form) === */}
                    {(() => {
                        // Config: which legal forms have which register types
                        const registerConfig: Record<string, { title: string; icon: string; desc: string; numLabel: string; numPlaceholder: string } | null> = {
                            einzelunternehmen: null, // kein Register
                            freiberufler: null,
                            gbr: null,
                            gmbh: { title: 'Handelsregister', icon: '📖', desc: 'Registergericht und Handelsregisternummer', numLabel: 'Handelsregisternummer', numPlaceholder: 'z.B. HRB 12345' },
                            ug: { title: 'Handelsregister', icon: '📖', desc: 'Registergericht und Handelsregisternummer', numLabel: 'Handelsregisternummer', numPlaceholder: 'z.B. HRB 12345' },
                            ag: { title: 'Handelsregister', icon: '📖', desc: 'Registergericht und Handelsregisternummer', numLabel: 'Handelsregisternummer', numPlaceholder: 'z.B. HRB 12345' },
                            se: { title: 'Handelsregister', icon: '📖', desc: 'Registergericht und Handelsregisternummer', numLabel: 'Handelsregisternummer', numPlaceholder: 'z.B. HRB 12345' },
                            kgaa: { title: 'Handelsregister', icon: '📖', desc: 'Registergericht und Handelsregisternummer', numLabel: 'Handelsregisternummer', numPlaceholder: 'z.B. HRB 12345' },
                            kg: { title: 'Handelsregister', icon: '📖', desc: 'Registergericht und Handelsregisternummer', numLabel: 'Handelsregisternummer', numPlaceholder: 'z.B. HRA 12345' },
                            ohg: { title: 'Handelsregister', icon: '📖', desc: 'Registergericht und Handelsregisternummer', numLabel: 'Handelsregisternummer', numPlaceholder: 'z.B. HRA 12345' },
                            gmbh_co_kg: { title: 'Handelsregister', icon: '📖', desc: 'Registergericht und Handelsregisternummer', numLabel: 'Handelsregisternummer', numPlaceholder: 'z.B. HRA 12345' },
                            ev: { title: 'Vereinsregister', icon: '📖', desc: 'Registergericht und Vereinsregisternummer', numLabel: 'Vereinsregisternummer', numPlaceholder: 'z.B. VR 12345' },
                            eg: { title: 'Genossenschaftsregister', icon: '📖', desc: 'Registergericht und Genossenschaftsregisternummer', numLabel: 'Genossenschaftsregisternummer', numPlaceholder: 'z.B. GnR 12345' },
                            partg: { title: 'Partnerschaftsregister', icon: '📖', desc: 'Registergericht und Partnerschaftsregisternummer', numLabel: 'Partnerschaftsregisternummer', numPlaceholder: 'z.B. PR 12345' },
                            partg_mbb: { title: 'Partnerschaftsregister', icon: '📖', desc: 'Registergericht und Partnerschaftsregisternummer', numLabel: 'Partnerschaftsregisternummer', numPlaceholder: 'z.B. PR 12345' },
                            stiftung: null,
                        };
                        const rc = registerConfig[settings.legalForm];
                        if (!rc) return null;
                        return (
                            <Section title={rc.title} icon={rc.icon} description={rc.desc}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label={t('court')}>
                                        <input
                                            type="text"
                                            value={settings.registerCourt || ''}
                                            onChange={e => updateField('registerCourt', e.target.value)}
                                            placeholder="z.B. Amtsgericht Mönchengladbach"
                                            className="input-field"
                                        />
                                    </Field>
                                    <Field label={rc.numLabel}>
                                        <input
                                            type="text"
                                            value={settings.registerNumber || ''}
                                            onChange={e => updateField('registerNumber', e.target.value)}
                                            placeholder={rc.numPlaceholder}
                                            className="input-field"
                                        />
                                    </Field>
                                </div>
                            </Section>
                        );
                    })()}

                    {/* === SECTION 6: Vertretung (dynamic per legal form) === */}
                    {(() => {
                        const leaderConfig: Record<string, { title: string; icon: string; desc: string; directorLabel: string; directorPlaceholder: string; showRepresentative: boolean }> = {
                            einzelunternehmen: { title: 'Inhaber/in', icon: '👤', desc: 'Inhaber/in des Einzelunternehmens', directorLabel: 'Inhaber/in', directorPlaceholder: 'Vor- und Nachname', showRepresentative: false },
                            freiberufler: { title: 'Inhaber/in', icon: '👤', desc: 'Selbstständige/r Freiberufler/in', directorLabel: 'Inhaber/in', directorPlaceholder: 'Vor- und Nachname', showRepresentative: false },
                            gbr: { title: 'Gesellschafter', icon: '👥', desc: 'Gesellschafter der GbR', directorLabel: 'Geschäftsführende/r Gesellschafter/in', directorPlaceholder: 'z.B. Max Mustermann, Erika Mustermann', showRepresentative: true },
                            gmbh: { title: 'Geschäftsführung', icon: '👔', desc: 'Geschäftsführer und Vertretungsberechtigte', directorLabel: 'Geschäftsführer', directorPlaceholder: 'z.B. Metin Öz', showRepresentative: true },
                            ug: { title: 'Geschäftsführung', icon: '👔', desc: 'Geschäftsführer und Vertretungsberechtigte', directorLabel: 'Geschäftsführer', directorPlaceholder: 'z.B. Metin Öz', showRepresentative: true },
                            gmbh_co_kg: { title: 'Geschäftsführung', icon: '👔', desc: 'Komplementär-GmbH Geschäftsführer', directorLabel: 'Geschäftsführer (Komplementär-GmbH)', directorPlaceholder: 'z.B. Metin Öz', showRepresentative: true },
                            kg: { title: 'Geschäftsführung', icon: '👔', desc: 'Komplementär und Vertretungsberechtigte', directorLabel: 'Persönlich haftende/r Gesellschafter/in (Komplementär)', directorPlaceholder: 'Vor- und Nachname', showRepresentative: true },
                            ohg: { title: 'Geschäftsführung', icon: '👔', desc: 'Geschäftsführende Gesellschafter', directorLabel: 'Geschäftsführende/r Gesellschafter/in', directorPlaceholder: 'Vor- und Nachname', showRepresentative: true },
                            ag: { title: 'Vorstand', icon: '👔', desc: 'Vorstandsmitglieder und Aufsichtsratsvorsitzender', directorLabel: 'Vorstandsvorsitzende/r', directorPlaceholder: 'z.B. Dr. Max Mustermann', showRepresentative: true },
                            kgaa: { title: 'Vertretung', icon: '👔', desc: 'Komplementär und Vorstand', directorLabel: 'Persönlich haftende/r Gesellschafter/in', directorPlaceholder: 'Vor- und Nachname', showRepresentative: true },
                            se: { title: 'Vorstand', icon: '👔', desc: 'Vorstand / Verwaltungsrat', directorLabel: 'Vorstandsvorsitzende/r', directorPlaceholder: 'z.B. Dr. Max Mustermann', showRepresentative: true },
                            eg: { title: 'Vorstand', icon: '👔', desc: 'Vorstandsmitglieder der Genossenschaft', directorLabel: 'Vorstandsvorsitzende/r', directorPlaceholder: 'Vor- und Nachname', showRepresentative: true },
                            partg: { title: 'Partner', icon: '👥', desc: 'Namensgebende Partner', directorLabel: 'Partner', directorPlaceholder: 'z.B. Dr. Müller, Dr. Schmidt', showRepresentative: false },
                            partg_mbb: { title: 'Partner', icon: '👥', desc: 'Namensgebende Partner', directorLabel: 'Partner', directorPlaceholder: 'z.B. Dr. Müller, Dr. Schmidt', showRepresentative: false },
                            ev: { title: 'Vorstand', icon: '👔', desc: 'Vereinsvorstand gem. § 26 BGB', directorLabel: 'Vorstandsvorsitzende/r', directorPlaceholder: 'Vor- und Nachname', showRepresentative: true },
                            stiftung: { title: 'Stiftungsvorstand', icon: '👔', desc: 'Vorstand der Stiftung', directorLabel: 'Vorstandsvorsitzende/r', directorPlaceholder: 'Vor- und Nachname', showRepresentative: true },
                        };
                        const lc = leaderConfig[settings.legalForm] || leaderConfig['gmbh'];
                        return (
                            <Section title={lc.title} icon={lc.icon} description={lc.desc}>
                                <div className={`grid grid-cols-1 ${lc.showRepresentative ? 'md:grid-cols-2' : ''} gap-4`}>
                                    <Field label={lc.directorLabel}>
                                        <input
                                            type="text"
                                            value={settings.managingDirector || ''}
                                            onChange={e => updateField('managingDirector', e.target.value)}
                                            placeholder={lc.directorPlaceholder}
                                            className="input-field"
                                        />
                                    </Field>
                                    {lc.showRepresentative && (
                                        <Field label={t('authorizedRep')}>
                                            <input
                                                type="text"
                                                value={settings.authorizedRepresentative || ''}
                                                onChange={e => updateField('authorizedRepresentative', e.target.value)}
                                                placeholder={t('ifApplicable')}
                                                className="input-field"
                                            />
                                        </Field>
                                    )}
                                </div>
                            </Section>
                        );
                    })()}

                    {/* Info Box */}
                    <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">ℹ️</span>
                            <div>
                                <h4 className="text-blue-400 font-medium text-sm">{t('dataUsageTitle')}</h4>
                                <p className="text-gray-400 text-xs mt-1">
                                    {t('dataUsageDesc')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Save Button */}
                    <div className="flex justify-end pt-4 pb-8">
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className={`px-8 py-3 rounded-xl font-medium text-white transition-all text-lg ${hasChanges
                                ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30'
                                : 'bg-gray-600 cursor-not-allowed opacity-50'
                                }`}
                        >
                            {saving ? `⏳ ${t('beingSaved')}` : hasChanges ? `💾 ${t('saveSettings')}` : `✅ ${t('allSaved')}`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Global styles for input fields */}
            <style jsx global>{`
                .input-field {
                    width: 100%;
                    padding: 0.625rem 0.875rem;
                    background: #1f2937;
                    color: white;
                    border: 1px solid #374151;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    outline: none;
                }
                .input-field:focus {
                    border-color: #ef4444;
                    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
                }
                .input-field::placeholder {
                    color: #6b7280;
                }
                .input-field option {
                    background: #1f2937;
                    color: white;
                }
            `}</style>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, icon, description, children }: {
    title: string;
    icon: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/80">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span>{icon}</span> {title}
                </h2>
                <p className="text-gray-400 text-xs mt-0.5">{description}</p>
            </div>
            <div className="p-6 space-y-4">
                {children}
            </div>
        </div>
    );
}

function Field({ label, children, required, full }: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    full?: boolean;
}) {
    return (
        <div className={full ? 'col-span-full' : ''}>
            <label className="block text-gray-300 text-sm font-medium mb-1.5">
                {label}
            </label>
            {children}
        </div>
    );
}
