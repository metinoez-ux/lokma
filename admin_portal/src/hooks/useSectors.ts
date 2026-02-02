'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUSINESS_TYPES, getBusinessTypesList } from '@/lib/business-types';

export interface Sector {
    id: string;
    label: string;
    icon: string;
    color: string;
    description: string;
    category: 'yemek' | 'market' | 'hizmet';
    isActive: boolean;
    sortOrder: number;
    features: string[];
}

// Fallback to hardcoded types if Firestore is empty or fails
const fallbackSectors: Sector[] = getBusinessTypesList().map((type, index) => ({
    id: type.value,
    label: type.label,
    icon: type.icon,
    color: type.color,
    description: type.description,
    category: (BUSINESS_TYPES[type.value as keyof typeof BUSINESS_TYPES]?.category || 'yemek') as 'yemek' | 'market' | 'hizmet',
    isActive: true,
    sortOrder: index + 1,
    features: BUSINESS_TYPES[type.value as keyof typeof BUSINESS_TYPES]?.features || [],
}));

export function useSectors() {
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSectors = async () => {
            try {
                const q = query(collection(db, 'sectors'), orderBy('sortOrder'));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    // No sectors in Firestore, use fallback
                    setSectors(fallbackSectors);
                } else {
                    const sectorData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                    })) as Sector[];
                    setSectors(sectorData);
                }
            } catch (err) {
                console.error('Error fetching sectors:', err);
                setError('Sektörler yüklenemedi');
                // Use fallback on error
                setSectors(fallbackSectors);
            } finally {
                setLoading(false);
            }
        };

        fetchSectors();
    }, []);

    // Helper functions
    const getSectorById = (id: string): Sector | undefined => {
        return sectors.find(s => s.id === id);
    };

    const getActiveSectors = (): Sector[] => {
        return sectors.filter(s => s.isActive);
    };

    const getSectorsByCategory = (category: 'yemek' | 'market' | 'hizmet'): Sector[] => {
        return sectors.filter(s => s.isActive && s.category === category);
    };

    const getSectorIcon = (id: string): string => {
        return getSectorById(id)?.icon || '🏪';
    };

    const getSectorLabel = (id: string): string => {
        return getSectorById(id)?.label || 'İşletme';
    };

    // Convert to legacy format for backwards compatibility
    const getBusinessTypesList = (): Array<{ value: string; label: string; icon: string; color: string; description: string }> => {
        return sectors.map(s => ({
            value: s.id,
            label: s.label,
            icon: s.icon,
            color: s.color,
            description: s.description,
        }));
    };

    return {
        sectors,
        loading,
        error,
        getSectorById,
        getActiveSectors,
        getSectorsByCategory,
        getSectorIcon,
        getSectorLabel,
        getBusinessTypesList,
    };
}

// Also export a simple fetch function for non-hook usage
export async function fetchSectors(): Promise<Sector[]> {
    try {
        const q = query(collection(db, 'sectors'), orderBy('sortOrder'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return fallbackSectors;
        }

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as Sector[];
    } catch (err) {
        console.error('Error fetching sectors:', err);
        return fallbackSectors;
    }
}
