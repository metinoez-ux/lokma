'use client';

import { useEffect, useState } from 'react';

interface GroupRedirectClientProps {
  groupId: string;
}

export default function GroupRedirectClient({ groupId }: GroupRedirectClientProps) {
  const [status, setStatus] = useState<'loading' | 'fallback'>('loading');

  useEffect(() => {
    const deepLink = `lokma://group/${groupId}`;
    const iosAppStore = 'https://apps.apple.com/app/lokma/id6504684498';
    const androidPlayStore = 'https://play.google.com/store/apps/details?id=com.lokma.app';

    // Try to open the app via deep link
    const timeout = setTimeout(() => {
      setStatus('fallback');
    }, 2500);

    // Attempt deep link
    window.location.href = deepLink;

    return () => clearTimeout(timeout);
  }, [groupId]);

  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);

  const handleStoreRedirect = () => {
    if (isIOS) {
      window.location.href = 'https://apps.apple.com/app/lokma/id6504684498';
    } else if (isAndroid) {
      window.location.href = 'https://play.google.com/store/apps/details?id=com.lokma.app';
    } else {
      window.location.href = 'https://lokma.shop';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      color: '#fff',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '24px',
    }}>
      {/* Logo */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <img
          src="/app-icon.png"
          alt="LOKMA"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {status === 'loading' ? (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
            Grup Siparisine Yonlendiriliyor...
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 32 }}>
            LOKMA uygulamasi aciliyor
          </p>
          {/* Spinner */}
          <div style={{
            width: 36,
            height: 36,
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
            Grup Siparisine Katil
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 8, maxWidth: 320 }}>
            Bu gruba katilmak icin LOKMA uygulamasini indirmeniz gerekiyor.
          </p>
          <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 32 }}>
            Davet kodu: <span style={{ color: '#f97316', fontWeight: 600 }}>{groupId}</span>
          </p>

          <button
            onClick={handleStoreRedirect}
            style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px 32px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(249, 115, 22, 0.3)',
              marginBottom: 16,
            }}
          >
            LOKMA Uygulamasini Indir
          </button>

          <a
            href={`lokma://group/${groupId}`}
            style={{
              color: '#94a3b8',
              fontSize: 13,
              textDecoration: 'underline',
            }}
          >
            Uygulama yuklu mu? Dogrudan ac
          </a>
        </>
      )}
    </div>
  );
}
