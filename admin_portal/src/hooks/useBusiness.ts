'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface BusinessData {
  id: string;
  companyName?: string;
  name?: string;
  businessType?: string;
  address?: any;
  phone?: string;
  email?: string;
  isActive?: boolean;
  supportsDelivery?: boolean;
  temporaryDeliveryPaused?: boolean;
  temporaryPickupPaused?: boolean;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  features?: Record<string, any>;
  [key: string]: any; // Firestore doc'tan gelen tum field'lar
}

interface UseBusinessReturn {
  business: BusinessData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * useBusiness - Tek bir isletme belgesini Firestore'dan getirir ve cache'ler.
 *
 * Real-time listener ile calisan versiyon.
 * Ayni businessId icin tekrar cagirildiginda yeni listener olusturur.
 *
 * Kullanim:
 *   const { business, loading } = useBusiness(businessId);
 */
export function useBusiness(businessId: string | null | undefined): UseBusinessReturn {
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One-shot refresh
  const refresh = useCallback(async () => {
    if (!businessId) return;
    try {
      const snap = await getDoc(doc(db, 'businesses', businessId));
      if (snap.exists()) {
        setBusiness({ id: snap.id, ...snap.data() } as BusinessData);
      }
    } catch (e: any) {
      console.error('[useBusiness] Refresh error:', e);
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      setBusiness(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      doc(db, 'businesses', businessId),
      (snap) => {
        if (snap.exists()) {
          setBusiness({ id: snap.id, ...snap.data() } as BusinessData);
        } else {
          setBusiness(null);
          setError('Business not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useBusiness] Listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [businessId]);

  return { business, loading, error, refresh };
}
