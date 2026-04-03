import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Deal {
    id: string;
    title: string;
    description: string;
    discountType: 'percent' | 'fixed' | 'freeDelivery' | 'buyXGetY' | 'cashback' | 'bundleDeal' | 'flashSale' | 'productDiscount' | 'cartBooster';
    discountValue: number;
    buyX?: number;       // BOGO: buy X
    getY?: number;       // BOGO: get Y free
    minOrderAmount?: number;  // Cart booster / min order
    targetProductId?: string; // Ürün bazlı indirim
    businessIds: string[];
    targetAudience: 'all' | 'new' | 'returning' | 'vip';
    validFrom: string;
    validUntil: string;
    isActive: boolean;
    imageUrl?: string;
    createdAt?: any;
}

export function useDeals(businessId: string | null, isSuperAdmin: boolean) {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // C-6: Read from businesses/{id}/promotions instead of standalone 'deals' collection
                if (businessId) {
                    // Business admin: only their own deals
                    const snap = await getDocs(query(
                        collection(db, 'businesses', businessId, 'promotions'),
                        where('sourceType', '==', 'deal'),
                        orderBy('createdAt', 'desc')
                    ));
                    setDeals(snap.docs.map(d => ({ id: d.id, businessIds: [businessId], ...d.data() } as Deal)));
                } else if (isSuperAdmin) {
                    // Super Admin: fallback to legacy deals collection for visibility
                    const snap = await getDocs(query(collection(db, 'deals'), orderBy('createdAt', 'desc')));
                    setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal)));
                }
            } catch (e) {
                console.error('useDeals load error:', e);
            }
            setLoading(false);
        };
        load();
    }, [businessId, isSuperAdmin]);

    const saveDeal = async (form: Omit<Deal, 'id'>, editingId: string | null) => {
        const promoData = {
            ...form,
            sourceType: 'deal', // marks this as a deal-originated promotion
            type: form.discountType === 'percent' ? 'percentOff' : form.discountType === 'fixed' ? 'fixedDiscount' : form.discountType,
            value: form.discountValue,
            valueType: form.discountType === 'percent' ? 'percent' : 'fixed',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (editingId) {
            // Update in all target businesses
            for (const bizId of form.businessIds) {
                try {
                    await updateDoc(doc(db, 'businesses', bizId, 'promotions', editingId), promoData);
                } catch {
                    // If doc doesn't exist in this business, create it
                    await addDoc(collection(db, 'businesses', bizId, 'promotions'), promoData);
                }
            }
            // Also keep legacy deals collection in sync
            await updateDoc(doc(db, 'deals', editingId), { ...form }).catch(() => { });
            setDeals(deals.map(d => d.id === editingId ? { ...d, ...form } : d));
        } else {
            let firstId = '';
            for (const bizId of form.businessIds) {
                const ref = await addDoc(collection(db, 'businesses', bizId, 'promotions'), promoData);
                if (!firstId) firstId = ref.id;
            }
            // Also write to legacy deals collection for Super Admin visibility
            const legacyRef = await addDoc(collection(db, 'deals'), { ...form, createdAt: new Date() });
            setDeals([{ id: legacyRef.id, ...form } as Deal, ...deals]);
        }
    };

    const deleteDeal = async (dealId: string) => {
        const deal = deals.find(d => d.id === dealId);
        if (deal && deal.businessIds) {
            for (const bizId of deal.businessIds) {
                await deleteDoc(doc(db, 'businesses', bizId, 'promotions', dealId)).catch(() => {});
            }
        }
        await deleteDoc(doc(db, 'deals', dealId));
        setDeals(deals.filter(d => d.id !== dealId));
    };

    const toggleDealActive = async (dealId: string, currentStatus: boolean) => {
        const deal = deals.find(d => d.id === dealId);
        const newStatus = !currentStatus;
        
        if (deal && deal.businessIds) {
            for (const bizId of deal.businessIds) {
                await updateDoc(doc(db, 'businesses', bizId, 'promotions', dealId), { isActive: newStatus }).catch(() => {});
            }
        }
        await updateDoc(doc(db, 'deals', dealId), { isActive: newStatus }).catch(() => {});
        setDeals(deals.map(d => d.id === dealId ? { ...d, isActive: newStatus } : d));
    };

    return { deals, loading, saveDeal, deleteDeal, toggleDealActive };
}
