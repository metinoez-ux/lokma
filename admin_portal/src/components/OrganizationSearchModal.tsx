'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeTurkish } from '@/lib/utils';

interface Organization {
    id: string;
    name: string;
    shortName?: string;
    type: 'vikz' | 'ditib' | 'diyanet' | 'igmg' | 'bagimsiz' | 'other';
    city: string;
    state?: string;
    postalCode?: string;
    address?: string;
    country: string;
    phone?: string;
    email?: string;
    website?: string;
}

interface OrganizationSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (org: Organization) => void;
}

const TYPE_LABELS: Record<Organization['type'], string> = {
    vikz: 'VIKZ',
    ditib: 'DİTİB',
    diyanet: 'Diyanet',
    igmg: 'IGMG',
    bagimsiz: 'Bağımsız',
    other: 'Diğer',
};

const TYPE_COLORS: Record<Organization['type'], string> = {
    vikz: 'bg-blue-600',
    ditib: 'bg-green-600',
    diyanet: 'bg-purple-600',
    igmg: 'bg-amber-600',
    bagimsiz: 'bg-gray-600',
    other: 'bg-slate-600',
};

export default function OrganizationSearchModal({
    isOpen,
    onClose,
    onSelect,
}: OrganizationSearchModalProps) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Load organizations on mount
    useEffect(() => {
        if (isOpen) {
            loadOrganizations();
        }
    }, [isOpen]);

    const loadOrganizations = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'organizations'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as Organization[];
            setOrganizations(data);
        } catch (error) {
            console.error('Error loading organizations:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter organizations based on search query
    const filteredOrganizations = organizations.filter(org => {
        if (!searchQuery) return true;
        const normalizedQuery = normalizeTurkish(searchQuery.toLowerCase());
        return (
            normalizeTurkish(org.name.toLowerCase()).includes(normalizedQuery) ||
            normalizeTurkish(org.shortName?.toLowerCase() || '').includes(normalizedQuery) ||
            normalizeTurkish(org.city.toLowerCase()).includes(normalizedQuery) ||
            (org.postalCode || '').includes(searchQuery)
        );
    });

    const handleSelect = (org: Organization) => {
        onSelect(org);
        onClose();
        setSearchQuery(''); // Reset search
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            🕌 Dernek Seç
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="İsim, şehir veya posta kodu ile ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                        autoFocus
                    />

                    {/* Result count */}
                    <p className="text-sm text-gray-400 mt-2">
                        {loading ? 'Yükleniyor...' : `${filteredOrganizations.length} dernek bulundu`}
                    </p>
                </div>

                {/* Organization List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : filteredOrganizations.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400 text-lg">Sonuç bulunamadı</p>
                            <p className="text-gray-500 text-sm mt-2">
                                Farklı bir arama terimi deneyin
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredOrganizations.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSelect(org)}
                                    className="w-full text-left bg-gray-900 hover:bg-gray-850 border border-gray-700 hover:border-blue-500 rounded-xl p-4 transition group"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            {/* Organization Name */}
                                            <h3 className="text-white font-medium group-hover:text-blue-400 transition truncate">
                                                {org.name}
                                            </h3>

                                            {/* Short Name */}
                                            {org.shortName && (
                                                <p className="text-gray-400 text-sm mt-1">
                                                    {org.shortName}
                                                </p>
                                            )}

                                            {/* Location */}
                                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                                                <span>📍</span>
                                                <span>
                                                    {org.postalCode && `${org.postalCode} `}
                                                    {org.city}
                                                    {org.state && `, ${org.state}`}
                                                </span>
                                            </div>

                                            {/* Address */}
                                            {org.address && (
                                                <p className="text-gray-500 text-sm mt-1 truncate">
                                                    {org.address}
                                                </p>
                                            )}

                                            {/* Contact */}
                                            {org.phone && (
                                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                                    <span>📞</span>
                                                    <span>{org.phone}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Type Badge */}
                                        <div className="flex-shrink-0">
                                            <span
                                                className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white ${TYPE_COLORS[org.type]}`}
                                            >
                                                {TYPE_LABELS[org.type]}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
