'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ChangelogEntry {
  id: string;
  timestamp: string;
  hash: string;
  description: string;
  note: string;
  createdAt: number;
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChangelog = async () => {
      try {
        const q = query(collection(db, 'changelog'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChangelogEntry));
        setEntries(items);
      } catch (e) {
        console.error('Changelog fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadChangelog();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      color: '#e0e0e0',
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: '40px 24px 24px',
        maxWidth: 900,
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #E50D6B, #ff6b9d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 4px 20px rgba(229,13,107,0.3)',
          }}>
            {'\u23F0'}
          </div>
          <div>
            <h1 style={{
              fontSize: 28,
              fontWeight: 800,
              margin: 0,
              background: 'linear-gradient(90deg, #E50D6B, #ff6b9d, #fff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}>
              LOKMA Time Machine
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#888', letterSpacing: '0.5px' }}>
              Commit Log &middot; Admin Portal + Mobile App + Backend
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 20,
          padding: '12px 16px',
          background: 'rgba(229,13,107,0.08)',
          border: '1px solid rgba(229,13,107,0.2)',
          borderRadius: 10,
          fontSize: 12,
          color: '#aaa',
          lineHeight: 1.6,
        }}>
          Her satir = LOKMA platformunun o anki komple hali.
          Geri donmek icin: <code style={{ color: '#E50D6B', background: 'rgba(229,13,107,0.15)', padding: '2px 6px', borderRadius: 4 }}>git checkout &lt;HASH&gt;</code>
        </div>
      </div>

      {/* Entries */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 60px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{'\u23F3'}</div>
            Yukleniyor...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
            Henuz kayit yok
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.map((entry, i) => (
              <div key={entry.id} style={{
                display: 'grid',
                gridTemplateColumns: '180px 80px 1fr auto',
                gap: 16,
                padding: '14px 16px',
                background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderRadius: 8,
                alignItems: 'center',
                borderLeft: entry.note && entry.note !== '-'
                  ? '3px solid #E50D6B'
                  : '3px solid transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
              >
                {/* Timestamp */}
                <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                  {entry.timestamp}
                </div>

                {/* Hash */}
                <code style={{
                  fontSize: 12,
                  color: '#E50D6B',
                  background: 'rgba(229,13,107,0.1)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}>
                  {entry.hash}
                </code>

                {/* Description */}
                <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.4 }}>
                  {entry.description}
                </div>

                {/* Note */}
                {entry.note && entry.note !== '-' && (
                  <div style={{
                    fontSize: 11,
                    color: '#ff6b9d',
                    background: 'rgba(229,13,107,0.1)',
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
