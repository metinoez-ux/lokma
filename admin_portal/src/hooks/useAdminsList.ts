'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Admin } from '@/types';

interface UseAdminsListReturn {
  admins: Admin[];
  loading: boolean;
  error: string | null;
  /** Sadece driver olanlar */
  drivers: Admin[];
  /** Sadece staff olanlar (driver olmayan) */
  staff: Admin[];
}

/**
 * useAdminsList - Bir isletmenin admin/staff listesi
 *
 * Dashboard, staff-dashboard, drivers, benutzerverwaltung icin tek kaynak.
 * businessId verilirse o isletmenin admin'lerini, verilmezse tum admin'leri getirir.
 *
 * Kullanim:
 *   const { admins, drivers, staff, loading } = useAdminsList(businessId);
 *   const { admins, loading } = useAdminsList(); // tum adminler (super admin icin)
 */
export function useAdminsList(businessId?: string | null): UseAdminsListReturn {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // businessId varsa filtrelenmiis, yoksa tumu
    const constraints = businessId
      ? [where('butcherId', '==', businessId)]
      : [];

    const q = query(
      collection(db, 'admins'),
      ...constraints,
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Admin));
      setAdmins(list);
      setLoading(false);
    }, (err) => {
      console.error('[useAdminsList] Error:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [businessId]);

  // Derived: sadece driver'lar
  const drivers = admins.filter(a => (a as any).isDriver === true);
  // Derived: staff (driver olmayan)
  const staff = admins.filter(a => (a as any).isDriver !== true);

  return { admins, loading, error, drivers, staff };
}
