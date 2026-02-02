'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, query, collection, where, getDocs, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

interface Invitation {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: Date;
    invitedByEmail: string;
}

function RegisterContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(true);
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form fields
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [street, setStreet] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('Deutschland');

    useEffect(() => {
        const loadInvitation = async () => {
            if (!token) {
                setError('Geçersiz davetiye linki.');
                setLoading(false);
                return;
            }

            try {
                const invitationsQuery = query(
                    collection(db, 'admin_invitations'),
                    where('token', '==', token)
                );
                const snapshot = await getDocs(invitationsQuery);

                if (snapshot.empty) {
                    setError('Davetiye bulunamadı veya geçersiz.');
                    setLoading(false);
                    return;
                }

                const invDoc = snapshot.docs[0];
                const invData = invDoc.data();
                const expiresAt = invData.expiresAt?.toDate();

                if (new Date() > expiresAt) {
                    setError('Bu davetiyenin süresi dolmuş. Lütfen yeni bir davetiye isteyin.');
                    setLoading(false);
                    return;
                }

                if (invData.status !== 'pending') {
                    setError('Bu davetiye zaten kullanılmış.');
                    setLoading(false);
                    return;
                }

                setInvitation({
                    id: invDoc.id,
                    email: invData.email,
                    role: invData.role,
                    status: invData.status,
                    expiresAt,
                    invitedByEmail: invData.invitedByEmail,
                });
            } catch (err) {
                console.error('Load invitation error:', err);
                setError('Davetiye yüklenirken hata oluştu.');
            }
            setLoading(false);
        };

        loadInvitation();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('Şifreler eşleşmiyor.');
            return;
        }

        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalıdır.');
            return;
        }

        if (!firstName || !lastName || !phone) {
            setError('Lütfen tüm zorunlu alanları doldurun.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            // Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, invitation!.email, password);
            await updateProfile(userCredential.user, {
                displayName: `${firstName} ${lastName}`,
            });

            // Update invitation with registration data
            await updateDoc(doc(db, 'admin_invitations', invitation!.id), {
                status: 'registered',
                registrationData: {
                    firstName,
                    lastName,
                    phone,
                    dateOfBirth,
                    address: {
                        street,
                        houseNumber,
                        postalCode,
                        city,
                        state,
                        country,
                    },
                },
                registeredAt: Timestamp.now(),
                userId: userCredential.user.uid,
            });

            // Create user profile
            await updateDoc(doc(db, 'user_profiles', userCredential.user.uid), {
                firstName,
                lastName,
                email: invitation!.email,
                phone,
                dateOfBirth,
                address: {
                    street,
                    houseNumber,
                    postalCode,
                    city,
                    state,
                    country,
                },
                createdAt: Timestamp.now(),
            });

            setSuccess(true);
        } catch (err) {
            console.error('Registration error:', err);
            if (err instanceof Error) {
                if (err.message.includes('email-already-in-use')) {
                    setError('Bu e-posta adresi zaten kayıtlı.');
                } else {
                    setError('Kayıt sırasında bir hata oluştu.');
                }
            }
        }
        setSubmitting(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Kayıt Tamamlandı!</h1>
                    <p className="text-gray-600 mb-6">
                        Bilgileriniz alındı. Hesabınız yönetici onayından sonra aktif olacaktır.
                        Onay verildiğinde e-posta ile bilgilendirileceksiniz.
                    </p>
                    <Link
                        href="/"
                        className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700"
                    >
                        Ana Sayfaya Dön
                    </Link>
                </div>
            </div>
        );
    }

    if (error && !invitation) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-red-600 mb-2">Hata</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <Link
                        href="/"
                        className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700"
                    >
                        Ana Sayfaya Dön
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl mb-4">
                            <span className="text-white text-2xl font-bold">M</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Super Admin Kaydı</h1>
                        <p className="text-gray-500 mt-2">
                            <span className="font-medium text-blue-600">{invitation?.email}</span> için hesap oluşturun
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                            Davet eden: {invitation?.invitedByEmail}
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Password */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Şifre *</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="En az 6 karakter"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Şifre Tekrar *</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Şifreyi tekrarlayın"
                                    required
                                />
                            </div>
                        </div>

                        {/* Personal Info */}
                        <div className="border-t pt-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Kişisel Bilgiler</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad *</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Soyad *</label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="+49 123 456789"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Doğum Tarihi</label>
                                    <input
                                        type="date"
                                        value={dateOfBirth}
                                        onChange={(e) => setDateOfBirth(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        <div className="border-t pt-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Adres Bilgileri</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sokak</label>
                                    <input
                                        type="text"
                                        value={street}
                                        onChange={(e) => setStreet(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kapı No</label>
                                    <input
                                        type="text"
                                        value={houseNumber}
                                        onChange={(e) => setHouseNumber(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Posta Kodu</label>
                                    <input
                                        type="text"
                                        value={postalCode}
                                        onChange={(e) => setPostalCode(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Şehir</label>
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Eyalet</label>
                                    <select
                                        value={state}
                                        onChange={(e) => setState(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Seçin...</option>
                                        <option value="Nordrhein-Westfalen">Nordrhein-Westfalen</option>
                                        <option value="Bayern">Bayern</option>
                                        <option value="Baden-Württemberg">Baden-Württemberg</option>
                                        <option value="Niedersachsen">Niedersachsen</option>
                                        <option value="Hessen">Hessen</option>
                                        <option value="Berlin">Berlin</option>
                                        <option value="Sachsen">Sachsen</option>
                                        <option value="Rheinland-Pfalz">Rheinland-Pfalz</option>
                                        <option value="Hamburg">Hamburg</option>
                                        <option value="Schleswig-Holstein">Schleswig-Holstein</option>
                                        <option value="Brandenburg">Brandenburg</option>
                                        <option value="Thüringen">Thüringen</option>
                                        <option value="Sachsen-Anhalt">Sachsen-Anhalt</option>
                                        <option value="Mecklenburg-Vorpommern">Mecklenburg-Vorpommern</option>
                                        <option value="Saarland">Saarland</option>
                                        <option value="Bremen">Bremen</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ülke</label>
                                    <select
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="Deutschland">🇩🇪 Deutschland</option>
                                        <option value="Österreich">🇦🇹 Österreich</option>
                                        <option value="Schweiz">🇨🇭 Schweiz</option>
                                        <option value="Türkei">🇹🇷 Türkei</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {submitting ? 'Kaydediliyor...' : 'Kaydı Tamamla'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        }>
            <RegisterContent />
        </Suspense>
    );
}
