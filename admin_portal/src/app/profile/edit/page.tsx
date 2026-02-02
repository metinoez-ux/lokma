'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserProfile } from '@/types';

export default function ProfileEditPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<Partial<UserProfile>>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        address: {
            street: '',
            houseNumber: '',
            apartmentNumber: '',
            postalCode: '',
            city: '',
            state: '',
            country: 'Deutschland',
        },
        language: 'de',
    });
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            // Load existing profile
            const profileDoc = await getDoc(doc(db, 'user_profiles', user.uid));
            if (profileDoc.exists()) {
                const data = profileDoc.data() as UserProfile;
                setProfile({
                    ...profile,
                    ...data,
                    email: user.email || '',
                });
            } else {
                // Pre-fill from Firebase Auth
                const nameParts = user.displayName?.split(' ') || [];
                setProfile({
                    ...profile,
                    firstName: nameParts[0] || '',
                    lastName: nameParts.slice(1).join(' ') || '',
                    email: user.email || '',
                });
            }
            setLoading(false);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const handleSave = async () => {
        console.log('🔄 handleSave started');
        if (!auth.currentUser) {
            console.error('❌ No current user!');
            return;
        }

        setSaving(true);
        try {
            const userId = auth.currentUser.uid;
            console.log('👤 Saving for user:', userId);

            // Update Firebase Auth display name
            const displayName = `${profile.firstName} ${profile.lastName}`.trim();
            console.log('📝 Display name:', displayName);
            await updateProfile(auth.currentUser, { displayName });
            console.log('✅ Firebase Auth profile updated');

            // Save to Firestore - user_profiles collection (detailed profile)
            const profileRef = doc(db, 'user_profiles', userId);
            const existingDoc = await getDoc(profileRef);

            const profileData = {
                ...profile,
                updatedAt: new Date(),
            };

            if (existingDoc.exists()) {
                await updateDoc(profileRef, profileData);
                console.log('✅ user_profiles UPDATED');
            } else {
                await setDoc(profileRef, {
                    ...profileData,
                    createdAt: new Date(),
                });
                console.log('✅ user_profiles CREATED');
            }

            // ALSO sync essential fields to users collection for admin panel visibility
            const usersRef = doc(db, 'users', userId);
            const usersDoc = await getDoc(usersRef);
            const usersData = {
                displayName: displayName,
                firstName: profile.firstName,
                lastName: profile.lastName,
                phoneNumber: profile.phone || auth.currentUser?.phoneNumber || null,
                dialCode: profile.dialCode || '+49',
                address: profile.address,
                language: profile.language,
                updatedAt: new Date(),
            };
            console.log('📊 usersData to save:', usersData);

            if (usersDoc.exists()) {
                await updateDoc(usersRef, usersData);
                console.log('✅ users collection UPDATED');
            } else {
                await setDoc(usersRef, {
                    ...usersData,
                    email: auth.currentUser?.email || null,
                    createdAt: new Date(),
                    isAdmin: false,
                });
                console.log('✅ users collection CREATED');
            }

            console.log('🎉 All saves complete, redirecting...');
            router.push('/profile');
        } catch (error) {
            console.error('❌ Save error:', error);
            alert('Kaydedilirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
        }
        setSaving(false);
    };

    const updateAddress = (field: string, value: string) => {
        setProfile({
            ...profile,
            address: {
                ...profile.address!,
                [field]: value,
            },
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/profile" className="text-gray-600 hover:text-gray-900">
                        ← İptal
                    </Link>
                    <h1 className="font-bold text-gray-900">Profili Düzenle</h1>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="text-blue-600 font-medium hover:text-blue-800 disabled:opacity-50"
                    >
                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6">
                {/* Personal Info */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Kişisel Bilgiler</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ad *</label>
                            <input
                                type="text"
                                value={profile.firstName}
                                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Mehmet"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Soyad *</label>
                            <input
                                type="text"
                                value={profile.lastName}
                                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Yılmaz"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                        <input
                            type="email"
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            disabled={!!auth.currentUser?.email}
                            className={`w-full px-4 py-3 border rounded-lg ${auth.currentUser?.email ? 'bg-gray-50 text-gray-500' : 'focus:ring-2 focus:ring-blue-500'}`}
                            placeholder="ornek@email.com"
                        />
                        {auth.currentUser?.email ? (
                            <p className="text-xs text-gray-400 mt-1">E-posta Firebase&apos;de kayıtlı, değiştirilemez</p>
                        ) : (
                            <p className="text-xs text-blue-500 mt-1">💡 E-posta ekleyerek web portalına giriş yapabilirsiniz</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                            <div className="flex gap-2">
                                <select
                                    value={profile.dialCode || '+49'}
                                    onChange={(e) => setProfile({ ...profile, dialCode: e.target.value })}
                                    className="w-24 px-2 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="+49">🇩🇪 +49</option>
                                    <option value="+90">🇹🇷 +90</option>
                                    <option value="+43">🇦🇹 +43</option>
                                    <option value="+41">🇨🇭 +41</option>
                                    <option value="+31">🇳🇱 +31</option>
                                    <option value="+32">🇧🇪 +32</option>
                                    <option value="+1">🇺🇸 +1</option>
                                    <option value="+44">🇬🇧 +44</option>
                                </select>
                                <input
                                    type="tel"
                                    value={profile.phone}
                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="0177 57100571"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Doğum Tarihi</label>
                            <input
                                type="date"
                                value={profile.dateOfBirth}
                                onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Adres Bilgileri</h2>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sokak / Cadde</label>
                            <input
                                type="text"
                                value={profile.address?.street}
                                onChange={(e) => updateAddress('street', e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Hauptstraße"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kapı No</label>
                            <input
                                type="text"
                                value={profile.address?.houseNumber}
                                onChange={(e) => updateAddress('houseNumber', e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="12"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Daire No (Opsiyonel)</label>
                        <input
                            type="text"
                            value={profile.address?.apartmentNumber}
                            onChange={(e) => updateAddress('apartmentNumber', e.target.value)}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="3. Kat, Daire 5"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Posta Kodu (PLZ)</label>
                            <input
                                type="text"
                                value={profile.address?.postalCode}
                                onChange={(e) => updateAddress('postalCode', e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="41836"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Şehir</label>
                            <input
                                type="text"
                                value={profile.address?.city}
                                onChange={(e) => updateAddress('city', e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Hückelhoven"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Eyalet (Bundesland)</label>
                            <select
                                value={profile.address?.state}
                                onChange={(e) => updateAddress('state', e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Seçin...</option>
                                <option value="Baden-Württemberg">Baden-Württemberg</option>
                                <option value="Bayern">Bayern</option>
                                <option value="Berlin">Berlin</option>
                                <option value="Brandenburg">Brandenburg</option>
                                <option value="Bremen">Bremen</option>
                                <option value="Hamburg">Hamburg</option>
                                <option value="Hessen">Hessen</option>
                                <option value="Mecklenburg-Vorpommern">Mecklenburg-Vorpommern</option>
                                <option value="Niedersachsen">Niedersachsen</option>
                                <option value="Nordrhein-Westfalen">Nordrhein-Westfalen</option>
                                <option value="Rheinland-Pfalz">Rheinland-Pfalz</option>
                                <option value="Saarland">Saarland</option>
                                <option value="Sachsen">Sachsen</option>
                                <option value="Sachsen-Anhalt">Sachsen-Anhalt</option>
                                <option value="Schleswig-Holstein">Schleswig-Holstein</option>
                                <option value="Thüringen">Thüringen</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ülke</label>
                            <select
                                value={profile.address?.country}
                                onChange={(e) => updateAddress('country', e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Deutschland">🇩🇪 Deutschland</option>
                                <option value="Österreich">🇦🇹 Österreich</option>
                                <option value="Schweiz">🇨🇭 Schweiz</option>
                                <option value="Niederlande">🇳🇱 Niederlande</option>
                                <option value="Belgien">🇧🇪 Belgien</option>
                                <option value="Türkei">🇹🇷 Türkei</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Preferences */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Tercihler</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dil</label>
                        <select
                            value={profile.language}
                            onChange={(e) => setProfile({ ...profile, language: e.target.value as 'de' | 'tr' | 'en' })}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="de">🇩🇪 Deutsch</option>
                            <option value="tr">🇹🇷 Türkçe</option>
                            <option value="en">🇬🇧 English</option>
                        </select>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                    {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
            </main>
        </div>
    );
}
