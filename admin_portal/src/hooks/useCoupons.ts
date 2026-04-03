import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Coupon {
    id: string;
    code: string;
    discountType: 'percent' | 'fixed' | 'freeDelivery';
    discountValue: number;
    minOrderAmount: number;
    maxDiscount: number;
    usageLimit: number;
    usageCount: number;
    perUserLimit: number;
    couponType: 'single_use' | 'multi_use' | 'one_per_user';
    validFrom: string;
    validUntil: string;
    businessId?: string;
    isActive: boolean;
    newCustomersOnly?: boolean;
    createdAt?: any;
}

export function useCoupons(businessId: string | null, isSuperAdmin: boolean) {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const colRef = businessId && !isSuperAdmin
                    ? query(collection(db, 'coupons'), where('businessId', '==', businessId), orderBy('createdAt', 'desc'))
                    : query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
                
                const snap = await getDocs(colRef);
                setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Coupon)));
            } catch (e) {
                console.error('useCoupons load error:', e);
            }
            setLoading(false);
        };
        load();
    }, [businessId, isSuperAdmin]);

    const saveCoupon = async (form: Omit<Coupon, 'id'>, editingId: string | null) => {
        // Filter out undefined values -- Firestore rejects undefined
        const cleanData: Record<string, any> = {};
        for (const [key, value] of Object.entries(form)) {
            if (value !== undefined) cleanData[key] = value;
        }

        if (editingId) {
            await updateDoc(doc(db, 'coupons', editingId), cleanData);
            setCoupons(coupons.map(c => c.id === editingId ? { ...c, ...form } : c));
        } else {
            cleanData.createdAt = new Date();
            const ref = await addDoc(collection(db, 'coupons'), cleanData);
            setCoupons([{ id: ref.id, ...form } as Coupon, ...coupons]);
        }
    };

    const deleteCoupon = async (couponId: string) => {
        await deleteDoc(doc(db, 'coupons', couponId));
        setCoupons(coupons.filter(c => c.id !== couponId));
    };

    const toggleCouponActive = async (couponId: string, currentStatus: boolean) => {
        await updateDoc(doc(db, 'coupons', couponId), { isActive: !currentStatus });
        setCoupons(coupons.map(c => c.id === couponId ? { ...c, isActive: !currentStatus } : c));
    };

    return { coupons, loading, saveCoupon, deleteCoupon, toggleCouponActive };
}
