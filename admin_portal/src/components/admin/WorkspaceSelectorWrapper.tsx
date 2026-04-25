'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

function WorkspaceItem({ assignment, onClick, t }: { assignment: any; onClick: () => void; t: any }) {
  const [addressInfo, setAddressInfo] = useState<{ city?: string; zip?: string } | null>(null);

  useEffect(() => {
    if (assignment.city && assignment.postalCode) {
      setAddressInfo({ city: assignment.city, zip: assignment.postalCode });
      return;
    }

    const fetchEntity = async () => {
      try {
        const collectionName = assignment.entityType === 'kermes' ? 'kermes' : 'restaurants';
        const docRef = doc(db, collectionName, assignment.entityId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAddressInfo({
            city: data.city || '',
            zip: data.postalCode || ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch entity location', err);
      }
    };
    fetchEntity();
  }, [assignment]);

  // Translate roles safely
  const roleRaw = assignment.role?.toLowerCase() || '';
  let localizedRole = assignment.role?.replace(/_/g, ' ').toUpperCase() || '';
  if (roleRaw.includes('driver') || roleRaw.includes('teslimat')) localizedRole = t('role_driver');
  else if (roleRaw.includes('staff') || roleRaw.includes('personel')) localizedRole = t('role_staff');
  else if (roleRaw.includes('admin')) localizedRole = t('role_admin');
  else if (roleRaw.includes('waiter') || roleRaw.includes('garson')) localizedRole = t('role_waiter');

  return (
    <button
      onClick={onClick}
      className="w-full bg-[#0d0d14] border border-white/10 hover:border-white/30 hover:bg-white/5 p-4 rounded-xl text-left transition-all duration-200 flex items-center justify-between group"
    >
      <div>
        <div className="text-lg font-bold text-white leading-tight mb-1">
          {assignment.entityName || t('unnamed_area')}
        </div>
        {addressInfo && (addressInfo.city || addressInfo.zip) && (
          <div className="text-xs text-white/70 mb-2 font-medium">
             {addressInfo.zip} {addressInfo.city}
          </div>
        )}
        <div className="text-[10px] text-white/50 uppercase tracking-widest font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px] text-[#ea184a]">
            {assignment.entityType === 'kermes' ? 'volunteer_activism' : 'storefront'}
          </span>
          {localizedRole}
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#ea184a] group-hover:text-white text-white/30 transition-all duration-200">
        <span className="material-symbols-outlined text-sm">chevron_right</span>
      </div>
    </button>
  );
}

export default function WorkspaceSelectorWrapper({ children }: { children: React.ReactNode }) {
  const { admin, loading, forceLogout } = useAdmin();
  const router = useRouter();
  const t = useTranslations('AdminLogin');

  if (loading) return null;

  if (admin && (admin as any).needsWorkspaceSelection) {
    return (
      <div className="min-h-screen bg-background dark:bg-[#0f172a] flex flex-col items-center justify-center p-4 z-50 fixed inset-0">
        <div className="w-full max-w-md bg-[#111118] border border-white/5 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">
              {t('select_workspace_title')}
            </h1>
            <p className="text-white/60 text-sm">
              {t('select_workspace_desc')}
            </p>
          </div>

          <div className="w-full space-y-3">
            {(() => {
              // Group and filter assignments to keep highest privilege per entity
              const entityMap = new Map();
              
              const getRoleWeight = (roleRaw: string) => {
                const role = roleRaw?.toLowerCase() || '';
                if (role.includes('super') || role.includes('lokma_admin')) return 100;
                if (role.includes('admin') || role.includes('manager') || role.includes('yonetici')) return 80;
                if (role.includes('staff') || role.includes('personel') || role.includes('mutfak') || role.includes('kasa')) return 50;
                if (role.includes('garson') || role.includes('waiter')) return 40;
                if (role.includes('driver') || role.includes('teslimat')) return 30;
                return 10;
              };

              admin.assignments?.forEach((assignment: any) => {
                const entityId = assignment.entityId;
                const key = entityId || assignment.id;
                
                if (!entityMap.has(key)) {
                  entityMap.set(key, assignment);
                } else {
                  const existing = entityMap.get(key);
                  const existingWeight = getRoleWeight(existing.role);
                  const newWeight = getRoleWeight(assignment.role);
                  
                  if (newWeight > existingWeight) {
                    entityMap.set(key, assignment);
                  }
                }
              });

              return Array.from(entityMap.values()).map((assignment: any) => (
                <WorkspaceItem
                  key={assignment.id}
                  assignment={assignment}
                  t={t}
                  onClick={() => {
                    try {
                      localStorage.setItem('mira_active_assignment_id', assignment.id);
                      window.location.reload();
                    } catch (e) {
                      console.error("Failed to select workspace", e);
                    }
                  }}
                />
              ));
            })()}

            <button
              onClick={() => forceLogout('manual')}
              className="w-full mt-6 py-3 text-red-500 hover:text-red-400 font-medium text-sm transition-colors duration-200"
            >
              {t('cancel_and_logout')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
