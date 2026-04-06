'use client';

import React from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

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
              Çalışma Alanı Seçin
            </h1>
            <p className="text-white/60 text-sm">
              Devam etmek için işlem yapmak istediğiniz çalışma alanını seçin.
            </p>
          </div>
          
          <div className="w-full space-y-3">
            {admin.assignments?.map((assignment) => (
              <button
                key={assignment.id}
                onClick={() => {
                  try {
                    localStorage.setItem('mira_active_assignment_id', assignment.id);
                    window.location.reload();
                  } catch (e) {
                    console.error("Failed to select workspace", e);
                  }
                }}
                className="w-full bg-[#0d0d14] border border-white/10 hover:border-white/30 hover:bg-white/5 p-4 rounded-xl text-left transition-all duration-200 flex items-center justify-between group"
              >
                <div>
                  <div className="text-lg font-bold text-white leading-tight mb-1">
                    {assignment.entityName || "İsimsiz Alan"}
                  </div>
                  <div className="text-[10px] text-white/50 uppercase tracking-widest font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] text-[#ea184a]">
                      {assignment.entityType === 'kermes' ? 'volunteer_activism' : 'storefront'}
                    </span>
                    {assignment.role.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#ea184a] group-hover:text-white text-white/30 transition-all duration-200">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </div>
              </button>
            ))}
            
            <button 
              onClick={() => forceLogout('manual')}
              className="w-full mt-6 py-3 text-red-500 hover:text-red-400 font-medium text-sm transition-colors duration-200"
            >
              İptal et ve Çıkış yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
