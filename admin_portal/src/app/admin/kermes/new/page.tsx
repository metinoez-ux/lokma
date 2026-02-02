'use client';

import { useState, useEffect, Suspense } from 'react';
import { addDoc, collection, doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';
import OrganizationSearchModal from '@/components/OrganizationSearchModal';

interface Organization {
    id: string;
    name: string;
    city: string;
    address: string;
    postalCode: string;
    phone: string;
    email: string;
}

interface KermesFeature {
    id: string;
    label: string;
    icon: string;
    color: string;
    isActive: boolean;
}

interface ParkingLocation {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    note: string;
    images: string[];
}

// Varsayılan özellikler (Firestore'dan yüklenemezse)
const DEFAULT_FEATURES: KermesFeature[] = [
    { id: 'family_area', label: 'Aile Bölümü', icon: '👨‍👩‍👧‍👦', color: '#E91E63', isActive: true },
    { id: 'parking', label: 'Otopark', icon: '🅿️', color: '#2196F3', isActive: true },
    { id: 'accessible', label: 'Engelli Erişimi', icon: '♿', color: '#9C27B0', isActive: true },
    { id: 'kids_area', label: 'Çocuk Alanı', icon: '🧒', color: '#4CAF50', isActive: true },
    { id: 'outdoor', label: 'Açık Alan', icon: '🌳', color: '#8BC34A', isActive: true },
    { id: 'indoor', label: 'Kapalı Alan', icon: '🏠', color: '#FF5722', isActive: true },
    { id: 'live_music', label: 'Canlı Müzik', icon: '🎵', color: '#607D8B', isActive: true },
    { id: 'prayer_room', label: 'Namaz Alanı', icon: '🕌', color: '#795548', isActive: true },
    { id: 'vegetarian', label: 'Vejetaryen', icon: '🥗', color: '#4CAF50', isActive: true },
    { id: 'halal', label: 'Helal', icon: '☪️', color: '#009688', isActive: true },
    { id: 'free_entry', label: 'Ücretsiz Giriş', icon: '🎟️', color: '#FF9800', isActive: true },
    { id: 'wifi', label: 'WiFi', icon: '📶', color: '#3F51B5', isActive: true },
];

export default function NewKermesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-lg">Yükleniyor...</div>
            </div>
        }>
            <NewKermesContent />
        </Suspense>
    );
}

function NewKermesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orgId = searchParams.get('orgId');

    const [loading, setLoading] = useState(false);
    const [orgLoading, setOrgLoading] = useState(!!orgId);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [eventFeatures, setEventFeatures] = useState<KermesFeature[]>([]);
    const [showOrgSearchModal, setShowOrgSearchModal] = useState(false);

    // Ana form verileri
    const [formData, setFormData] = useState({
        // Etkinlik bilgileri - Birincil dil
        title: '',
        description: '',
        // Etkinlik bilgileri - İkincil dil
        titleSecondary: '',
        descriptionSecondary: '',
        secondaryLanguage: 'de', // de, tr, nl, fr, en vb.
        // Tarih ve saat
        date: '',
        endDate: '',
        openingTime: '',
        closingTime: '',
        // Konum bilgileri - Ana
        location: '',
        address: '',
        city: '',
        postalCode: '',
        country: '', // Google Places'tan otomatik algılanır
        // Konum bilgileri - 2. Sokak Adı
        alternativeAddress: '',
        // Yetkili kişi bilgileri
        contactFirstName: '',
        contactLastName: '',
        contactPhone: '',
        phoneCountryCode: '+49',
    });

    // Ülke seçenekleri
    const COUNTRY_OPTIONS = [
        { code: 'DE', name: 'Deutschland', phoneCode: '+49', flag: '🇩🇪', lang: 'de' },
        { code: 'TR', name: 'Türkiye', phoneCode: '+90', flag: '🇹🇷', lang: 'tr' },
        { code: 'NL', name: 'Nederland', phoneCode: '+31', flag: '🇳🇱', lang: 'nl' },
        { code: 'AT', name: 'Österreich', phoneCode: '+43', flag: '🇦🇹', lang: 'de' },
        { code: 'CH', name: 'Schweiz', phoneCode: '+41', flag: '🇨🇭', lang: 'de' },
        { code: 'BE', name: 'België', phoneCode: '+32', flag: '🇧🇪', lang: 'nl' },
        { code: 'FR', name: 'France', phoneCode: '+33', flag: '🇫🇷', lang: 'fr' },
        { code: 'GB', name: 'United Kingdom', phoneCode: '+44', flag: '🇬🇧', lang: 'en' },
    ];

    // Seçilen ülkeye göre ikincil dil ismini al - dinamik (bulunduğun ülke dilinde)
    const getSecondaryLanguageName = () => {
        return 'bulunduğun ülke dilinde';
    };

    // Ülke değiştiğinde dil ve telefon kodunu otomatik güncelle
    const handleCountryChange = (countryCode: string) => {
        const country = COUNTRY_OPTIONS.find(c => c.code === countryCode);
        if (country) {
            setFormData(prev => ({
                ...prev,
                country: countryCode,
                secondaryLanguage: country.lang,
                phoneCountryCode: country.phoneCode,
            }));
        }
    };

    // 🚚 Kurye/Nakliyat Servisi
    const [hasDelivery, setHasDelivery] = useState(false);
    const [deliveryFee, setDeliveryFee] = useState(2.95);
    const [minOrderAmount, setMinOrderAmount] = useState(25);
    const [minCartForFreeDelivery, setMinCartForFreeDelivery] = useState(0); // Ücretsiz teslimat eşiği

    // 🅿️ Park İmkanları
    const [parkingLocations, setParkingLocations] = useState<ParkingLocation[]>([]);
    const [generalParkingNote, setGeneralParkingNote] = useState('');

    // 💰 Pfand/Depozito Sistemi
    const [hasPfandSystem, setHasPfandSystem] = useState(false);
    const [pfandAmount, setPfandAmount] = useState(0.25);

    // 📊 KDV Sistemi
    const [showKdv, setShowKdv] = useState(false);
    const [kdvRate, setKdvRate] = useState(7);
    const [pricesIncludeKdv, setPricesIncludeKdv] = useState(true);

    // Etkinlik özellikleri
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['halal']);
    const [customFeatures, setCustomFeatures] = useState<string[]>([]);
    const [newCustomFeature, setNewCustomFeature] = useState('');

    // Kermes özelliklerini Firestore'dan yükle
    useEffect(() => {
        const loadFeatures = async () => {
            try {
                const docRef = doc(db, 'settings', 'kermes_features');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const activeFeatures = (data.features || []).filter((f: KermesFeature) => f.isActive);
                    setEventFeatures(activeFeatures);
                } else {
                    setEventFeatures(DEFAULT_FEATURES);
                }
            } catch (error) {
                console.error('Özellikler yüklenemedi:', error);
                setEventFeatures(DEFAULT_FEATURES);
            }
        };
        loadFeatures();
    }, []);

    useEffect(() => {
        if (orgId) {
            loadOrganization(orgId);
        }
    }, [orgId]);

    const loadOrganization = async (id: string) => {
        setOrgLoading(true);
        try {
            const docRef = doc(db, 'organizations', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const org = { id: docSnap.id, ...docSnap.data() } as Organization;
                setOrganization(org);

                setFormData(prev => ({
                    ...prev,
                    location: org.name,
                    address: org.address || '',
                    city: org.city || '',
                    postalCode: org.postalCode || '',
                    title: `${org.city} Kermesi`,
                    contactPhone: org.phone || '',
                }));
            }
        } catch (error) {
            console.error('Error loading organization:', error);
        } finally {
            setOrgLoading(false);
        }
    };

    // Handle organization selection from modal
    const handleOrganizationSelect = (org: any) => {
        setOrganization(org);
        setFormData(prev => ({
            ...prev,
            location: org.name,
            address: org.address || '',
            city: org.city || '',
            postalCode: org.postalCode || '',
            title: `${org.city} Kermesi`,
            contactPhone: org.phone || '',
        }));
    };

    const toggleFeature = (featureId: string) => {
        setSelectedFeatures(prev =>
            prev.includes(featureId)
                ? prev.filter(f => f !== featureId)
                : [...prev, featureId]
        );
    };

    const addCustomFeature = () => {
        if (newCustomFeature.trim() && customFeatures.length < 3) {
            setCustomFeatures([...customFeatures, newCustomFeature.trim()]);
            setNewCustomFeature('');
        }
    };

    const removeCustomFeature = (index: number) => {
        setCustomFeatures(customFeatures.filter((_, i) => i !== index));
    };

    const addParkingLocation = () => {
        setParkingLocations([...parkingLocations, {
            street: '',
            city: formData.city || '',
            postalCode: formData.postalCode || '',
            country: 'Deutschland',
            note: '',
            images: [],
        }]);
    };

    const removeParkingLocation = (index: number) => {
        setParkingLocations(parkingLocations.filter((_, i) => i !== index));
    };

    const updateParkingLocation = (index: number, field: keyof ParkingLocation, value: string) => {
        const updated = [...parkingLocations];
        updated[index] = { ...updated[index], [field]: value };
        setParkingLocations(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser) return;

        setLoading(true);
        try {
            const kermesData: Record<string, unknown> = {
                // Etkinlik bilgileri - Birincil
                title: formData.title,
                description: formData.description || null,
                // Etkinlik bilgileri - İkincil dil
                titleSecondary: formData.titleSecondary || null,
                descriptionSecondary: formData.descriptionSecondary || null,
                secondaryLanguage: formData.secondaryLanguage,
                // Tarih ve saat
                date: formData.date ? Timestamp.fromDate(new Date(formData.date)) : null,
                startDate: formData.date ? Timestamp.fromDate(new Date(formData.date)) : null,
                endDate: formData.endDate ? Timestamp.fromDate(new Date(formData.endDate)) : null,
                openingTime: formData.openingTime || null,
                closingTime: formData.closingTime || null,
                // Konum bilgileri - Ana
                location: formData.location,
                address: formData.address || null,
                city: formData.city || null,
                postalCode: formData.postalCode || null,
                country: formData.country || null,
                // Konum bilgileri - 2. Sokak Adı
                secondStreetName: formData.alternativeAddress || null,
                // Yetkili kişi
                contactFirstName: formData.contactFirstName || null,
                contactLastName: formData.contactLastName || null,
                contactName: `${formData.contactFirstName} ${formData.contactLastName}`.trim() || null, // Eski uyumluluk için
                contactPhone: formData.phoneCountryCode + ' ' + formData.contactPhone.replace(/^[\+0-9\s]+/, ''),
                phoneCountryCode: formData.phoneCountryCode,
                // Etkinlik özellikleri
                features: selectedFeatures,
                customFeatures: customFeatures,
                // 🚚 Kurye/Nakliyat
                hasDelivery: hasDelivery,
                deliveryFee: hasDelivery ? deliveryFee : 0,
                minOrderAmount: hasDelivery ? minOrderAmount : 0,
                minCartForFreeDelivery: hasDelivery ? minCartForFreeDelivery : 0,
                // 🅿️ Park İmkanları
                parkingLocations: parkingLocations,
                generalParkingNote: generalParkingNote || null,
                // 💰 Pfand/Depozito
                hasPfandSystem: hasPfandSystem,
                pfandAmount: hasPfandSystem ? pfandAmount : 0,
                // 📊 KDV
                showKdv: showKdv,
                kdvRate: showKdv ? kdvRate : 0,
                pricesIncludeKdv: pricesIncludeKdv,
                // Sistem bilgileri
                organizerId: auth.currentUser.uid,
                isActive: true,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            // Save organization reference if selected
            if (organization) {
                kermesData.organizationId = organization.id;
                kermesData.organizationName = organization.name;
            }

            await addDoc(collection(db, 'kermes_events'), kermesData);
            router.push('/admin/kermes');
        } catch (error) {
            console.error('Error creating event:', error);
            setLoading(false);
        }
    };

    if (orgLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-lg">Organizasyon yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="max-w-4xl mx-auto mb-6">
                <Link href="/admin/kermes" className="text-gray-400 hover:text-white mb-4 inline-flex items-center gap-2">
                    ← Geri
                </Link>
                <h1 className="text-2xl font-bold text-pink-400 mt-2">🎪 Yeni Kermes Oluştur</h1>
            </div>

            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
                {/* Organization Info Banner */}
                {organization && (
                    <div className="bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🕌</span>
                            <div>
                                <h2 className="font-bold text-white">{organization.name}</h2>
                                <p className="text-gray-300 text-sm">
                                    {organization.address}, {organization.postalCode} {organization.city}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 📍 Konum Bilgileri */}
                <div className="bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4">📍 Konum Bilgileri</h2>

                    {/* Dernek Seç Button */}
                    <div className="mb-4">
                        <button
                            type="button"
                            onClick={() => setShowOrgSearchModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-500 hover:to-purple-500 transition shadow-lg flex items-center gap-2"
                        >
                            <span>🕌</span>
                            <span>Dernek Seç</span>
                        </button>
                        <p className="text-xs text-gray-500 mt-1">
                            VIKZ derneklerinden birini seçerek konum bilgilerini otomatik doldurabilirsiniz
                        </p>
                    </div>

                    {/* Selected Organization Display */}
                    {organization && (
                        <div className="mb-4 p-4 bg-gray-900 border border-blue-500 rounded-lg">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-sm text-gray-400 mb-1">Seçilen Dernek:</p>
                                    <h3 className="text-white font-medium">{organization.name}</h3>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                                        <span>📍</span>
                                        <span>
                                            {organization.postalCode && `${organization.postalCode} `}
                                            {organization.city}
                                        </span>
                                    </div>
                                    {organization.address && (
                                        <p className="text-sm text-gray-500 mt-1">{organization.address}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOrganization(null)}
                                    className="text-gray-400 hover:text-white transition ml-2"
                                    title="Seçimi temizle"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Konum Adı */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Konum Adı *
                            </label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="Örn: Merkez Cami"
                                required
                            />
                        </div>

                        {/* Ülke - Google Places'tan otomatik algılanır */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Ülke
                            </label>
                            <input
                                type="text"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="Adres girilince otomatik algılanır..."
                            />
                            <p className="text-xs text-gray-500 mt-1">Adres seçtiğinizde ülke otomatik algılanır</p>
                        </div>

                        {/* Ana Adres - Google Places */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Ana Adres
                            </label>
                            <PlacesAutocomplete
                                value={formData.address}
                                onChange={(value) => setFormData({ ...formData, address: value })}
                                onPlaceSelect={(place) => {
                                    setFormData({
                                        ...formData,
                                        address: place.street || place.formattedAddress || formData.address,
                                        city: place.city || formData.city,
                                        postalCode: place.postalCode || formData.postalCode,
                                        country: place.country || formData.country,
                                    });
                                }}
                                placeholder="Tam adres girin veya arayın..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Posta Kodu
                            </label>
                            <input
                                type="text"
                                value={formData.postalCode}
                                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="12345"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Şehir
                            </label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="Şehir"
                            />
                        </div>

                        {/* 2. Sokak Adı (Opsiyonel) */}
                        <div className="md:col-span-2 pt-4 border-t border-gray-700">
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                📍 2. Sokak Adı (Opsiyonel)
                            </label>
                            <input
                                type="text"
                                value={formData.alternativeAddress}
                                onChange={(e) => setFormData({ ...formData, alternativeAddress: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="İkinci sokak adresi varsa girin..."
                            />
                        </div>
                    </div>
                </div>

                {/* 📝 Etkinlik Bilgileri */}
                <div className="bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4">📝 Etkinlik Bilgileri</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Birincil Dil - Etkinlik Adı */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Etkinlik Adı (Türkçe) *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="Örn: Ramazan Kermesi 2026"
                                required
                            />
                        </div>

                        {/* İkincil Dil - Etkinlik Adı */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Etkinlik Adı ({getSecondaryLanguageName()})
                            </label>
                            <input
                                type="text"
                                value={formData.titleSecondary}
                                onChange={(e) => setFormData({ ...formData, titleSecondary: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder={formData.secondaryLanguage === 'de' ? 'z.B. Ramadan Kermes 2026' : 'Örn: Ramazan Kermesi 2026'}
                            />
                        </div>

                        {/* Birincil Dil - Açıklama */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Açıklama / Kermes Sloganı (Türkçe)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                rows={2}
                                placeholder="Etkinlik hakkında bilgi..."
                            />
                        </div>

                        {/* İkincil Dil - Açıklama */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Açıklama / Kermes Sloganı ({getSecondaryLanguageName()})
                            </label>
                            <textarea
                                value={formData.descriptionSecondary}
                                onChange={(e) => setFormData({ ...formData, descriptionSecondary: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                rows={2}
                                placeholder={formData.secondaryLanguage === 'de' ? 'Veranstaltungsinformationen...' : 'Event information...'}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Başlangıç Tarihi *
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Bitiş Tarihi
                            </label>
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Açılış Saati
                            </label>
                            <input
                                type="time"
                                value={formData.openingTime}
                                onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Kapanış Saati
                            </label>
                            <input
                                type="time"
                                value={formData.closingTime}
                                onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* 👤 Yetkili Kişi */}
                <div className="bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4">👤 Yetkili Kişi</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Ad */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Ad
                            </label>
                            <input
                                type="text"
                                value={formData.contactFirstName}
                                onChange={(e) => setFormData({ ...formData, contactFirstName: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="Yetkili adı"
                            />
                        </div>

                        {/* Soyad */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Soyad
                            </label>
                            <input
                                type="text"
                                value={formData.contactLastName}
                                onChange={(e) => setFormData({ ...formData, contactLastName: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="Yetkili soyadı"
                            />
                        </div>

                        {/* Telefon Numarası - Ülke Kodu + Numara */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Telefon Numarası
                            </label>
                            <div className="flex gap-2">
                                {/* Ülke Kodu Dropdown */}
                                <select
                                    value={formData.phoneCountryCode}
                                    onChange={(e) => setFormData({ ...formData, phoneCountryCode: e.target.value })}
                                    className="w-32 px-3 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                >
                                    {COUNTRY_OPTIONS.map((country) => (
                                        <option key={country.code} value={country.phoneCode}>
                                            {country.flag} {country.phoneCode}
                                        </option>
                                    ))}
                                </select>
                                {/* Telefon Numarası */}
                                <input
                                    type="tel"
                                    value={formData.contactPhone}
                                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                    className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    placeholder="178 000 0000"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Örn: {formData.phoneCountryCode} 178 000 0000
                            </p>
                        </div>
                    </div>
                </div>

                {/* 🚚 Kurye/Nakliyat Servisi */}
                <div className="bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">🚚 Kurye / Nakliyat Servisi</h2>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={hasDelivery}
                                onChange={(e) => setHasDelivery(e.target.checked)}
                                className="w-5 h-5 rounded text-pink-600 focus:ring-pink-500"
                            />
                            <span className="text-white">Kurye Servisi Mevcut</span>
                        </label>
                    </div>

                    {hasDelivery && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Nakliyat Ücreti (€)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={deliveryFee}
                                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Minimum Sipariş Tutarı (€)
                                    <span className="text-yellow-400 text-xs ml-2">(Bu tutarın altında kurye kabul edilmez)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={minOrderAmount}
                                    onChange={(e) => setMinOrderAmount(parseFloat(e.target.value) || 0)}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Ücretsiz Teslimat İçin Min. (€)
                                    <span className="text-green-400 text-xs ml-2">(Bu tutardan sonra teslimat ücretsiz)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={minCartForFreeDelivery}
                                    onChange={(e) => setMinCartForFreeDelivery(parseFloat(e.target.value) || 0)}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500"
                                    placeholder="0 = yok"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* ⚙️ Genel Ayarlar (Pfand + KDV) */}
                <div className="bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4">⚙️ Genel Ayarlar</h2>

                    {/* Checkbox'lar Yan Yana */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Pfand Toggle */}
                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-pink-500 transition">
                            <input
                                type="checkbox"
                                checked={hasPfandSystem}
                                onChange={(e) => setHasPfandSystem(e.target.checked)}
                                className="w-5 h-5 rounded text-pink-600 focus:ring-pink-500"
                            />
                            <div>
                                <span className="text-white font-medium">💰 Pfand / Depozito Sistemi</span>
                                <p className="text-gray-400 text-xs">Bardak/tabak için depozito</p>
                            </div>
                        </label>

                        {/* KDV Toggle */}
                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-pink-500 transition">
                            <input
                                type="checkbox"
                                checked={showKdv}
                                onChange={(e) => setShowKdv(e.target.checked)}
                                className="w-5 h-5 rounded text-pink-600 focus:ring-pink-500"
                            />
                            <div>
                                <span className="text-white font-medium">📊 KDV / Vergi Göster</span>
                                <p className="text-gray-400 text-xs">Fişlerde KDV ayrı gösterilsin</p>
                            </div>
                        </label>
                    </div>

                    {/* Detay Alanları - Aktifse Göster */}
                    {(hasPfandSystem || showKdv) && (
                        <div className="pt-4 border-t border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Pfand Detayları */}
                            {hasPfandSystem && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        💰 Varsayılan Pfand Tutarı (€)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={pfandAmount}
                                        onChange={(e) => setPfandAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500"
                                    />
                                    <p className="text-gray-400 text-xs mt-1">
                                        Ürün bazında değiştirilebilir
                                    </p>
                                </div>
                            )}

                            {/* KDV Detayları */}
                            {showKdv && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        📊 KDV Oranı
                                    </label>
                                    <select
                                        value={kdvRate}
                                        onChange={(e) => setKdvRate(parseInt(e.target.value))}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500"
                                    >
                                        <option value={7}>%7 (Yiyecek)</option>
                                        <option value={19}>%19 (Genel)</option>
                                    </select>
                                    <div className="flex gap-4 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input
                                                type="radio"
                                                checked={pricesIncludeKdv}
                                                onChange={() => setPricesIncludeKdv(true)}
                                                className="text-pink-600 focus:ring-pink-500"
                                            />
                                            <span className="text-gray-300">Brüt (dahil)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input
                                                type="radio"
                                                checked={!pricesIncludeKdv}
                                                onChange={() => setPricesIncludeKdv(false)}
                                                className="text-pink-600 focus:ring-pink-500"
                                            />
                                            <span className="text-gray-300">Net (hariç)</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 🅿️ Park İmkanları */}
                <div className="bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">🅿️ Park İmkanları</h2>
                        <button
                            type="button"
                            onClick={addParkingLocation}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm"
                        >
                            + Park Alanı Ekle
                        </button>
                    </div>

                    {parkingLocations.length === 0 ? (
                        <p className="text-gray-400 text-sm">
                            Henüz park alanı eklenmedi. "Park Alanı Ekle" butonuyla başlayın.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {parkingLocations.map((parking, index) => (
                                <div key={index} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="flex items-center gap-2">
                                            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                                {index + 1}
                                            </span>
                                            <span className="text-white font-medium">Park İmkanı {index + 1}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeParkingLocation(index)}
                                            className="text-red-400 hover:text-red-300 text-sm"
                                        >
                                            🗑️ Sil
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-gray-400 mb-1">Sokak / Cadde Adresi</label>
                                            <PlacesAutocomplete
                                                value={parking.street}
                                                onChange={(val) => updateParkingLocation(index, 'street', val)}
                                                onPlaceSelect={(place) => {
                                                    // PlaceResult type has: formattedAddress, street, city, postalCode, country
                                                    const updated = [...parkingLocations];
                                                    updated[index] = {
                                                        ...updated[index],
                                                        street: place.street || place.formattedAddress || '',
                                                        city: place.city || updated[index].city,
                                                        postalCode: place.postalCode || updated[index].postalCode,
                                                    };
                                                    setParkingLocations(updated);
                                                }}
                                                placeholder="Google ile ara..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Şehir</label>
                                            <input
                                                type="text"
                                                value={parking.city}
                                                onChange={(e) => updateParkingLocation(index, 'city', e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-white rounded-lg text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Posta Kodu</label>
                                            <input
                                                type="text"
                                                value={parking.postalCode}
                                                onChange={(e) => updateParkingLocation(index, 'postalCode', e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-white rounded-lg text-sm"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-gray-400 mb-1">Açıklama / Not</label>
                                            <input
                                                type="text"
                                                value={parking.note}
                                                onChange={(e) => updateParkingLocation(index, 'note', e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-white rounded-lg text-sm"
                                                placeholder="Örn: Cadde boyu sağlı sollu park edilebilir"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Genel Park Notu (Opsiyonel)
                        </label>
                        <input
                            type="text"
                            value={generalParkingNote}
                            onChange={(e) => setGeneralParkingNote(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500"
                            placeholder="Tüm ziyaretçiler için genel park bilgisi..."
                        />
                    </div>
                </div>

                {/* ✨ Etkinlik Özellikleri */}
                <div className="bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-2">✨ Etkinlik Özellikleri</h2>
                    <p className="text-gray-400 text-sm mb-4">Bu kermeste hangi özellikler mevcut?</p>

                    <div className="flex flex-wrap gap-3">
                        {eventFeatures.length === 0 ? (
                            <p className="text-gray-500 text-sm">Özellikler yükleniyor...</p>
                        ) : eventFeatures.map(feature => (
                            <button
                                key={feature.id}
                                type="button"
                                onClick={() => toggleFeature(feature.id)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition ${selectedFeatures.includes(feature.id)
                                    ? 'text-white border-2'
                                    : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:border-gray-500'
                                    }`}
                                style={selectedFeatures.includes(feature.id) ? { backgroundColor: feature.color, borderColor: feature.color } : {}}
                            >
                                {feature.icon} {feature.label}
                            </button>
                        ))}
                    </div>

                    {/* Özel Özellikler */}
                    <div className="mt-6 pt-4 border-t border-gray-700">
                        <h3 className="text-sm font-medium text-gray-300 mb-2">Özel Özellikler (Max 3)</h3>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newCustomFeature}
                                onChange={(e) => setNewCustomFeature(e.target.value)}
                                placeholder="Yeni özellik adı..."
                                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-sm"
                                maxLength={30}
                            />
                            <button
                                type="button"
                                onClick={addCustomFeature}
                                disabled={!newCustomFeature.trim() || customFeatures.length >= 3}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                + Ekle
                            </button>
                        </div>
                        {customFeatures.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {customFeatures.map((feature, index) => (
                                    <span
                                        key={index}
                                        className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm flex items-center gap-2"
                                    >
                                        ✨ {feature}
                                        <button
                                            type="button"
                                            onClick={() => removeCustomFeature(index)}
                                            className="text-purple-400 hover:text-white"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-pink-500 hover:to-purple-500 transition disabled:opacity-50"
                >
                    {loading ? 'Oluşturuluyor...' : '🎪 Kermes Oluştur'}
                </button>
            </form>

            {/* Organization Search Modal */}
            <OrganizationSearchModal
                isOpen={showOrgSearchModal}
                onClose={() => setShowOrgSearchModal(false)}
                onSelect={handleOrganizationSelect}
            />
        </div>
    );
}
