'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * Legacy /admin/butchers/[id] redirect
 * All butcher detail now uses unified /admin/business/[id]
 */
export default function ButcherDetailRedirect() {
  
  const t = useTranslations('AdminButchers[id');
const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/admin/business/${id}`);
  }, [router, id]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
        <p className="text-gray-400">{t('yonlendiriliyor')}</p>
      </div>
    </div>
  );
}
