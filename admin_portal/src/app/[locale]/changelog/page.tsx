'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, orderBy, query, limit, startAfter, DocumentSnapshot, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ChangelogEntry {
  id: string;
  timestamp: string;
  hash: string;
  description: string;
  note: string;
  createdAt: number;
}

const PAGE_SIZE = 50;

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [pageCache, setPageCache] = useState<Map<number, { entries: ChangelogEntry[]; lastDoc: DocumentSnapshot | null }>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      if (pageCache.has(page)) {
        const cached = pageCache.get(page)!;
        setEntries(cached.entries);
        setLastDoc(cached.lastDoc);
        setCurrentPage(page);
        setLoading(false);
        return;
      }

      let q;
      if (page === 1) {
        q = query(collection(db, 'changelog'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      } else {
        // For subsequent pages, we need the lastDoc from previous page
        const prevCache = pageCache.get(page - 1);
        if (prevCache && prevCache.lastDoc) {
          q = query(collection(db, 'changelog'), orderBy('createdAt', 'desc'), startAfter(prevCache.lastDoc), limit(PAGE_SIZE));
        } else {
          // Fallback: reload from beginning
          q = query(collection(db, 'changelog'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE * page));
        }
      }

      const snap = await getDocs(q);
      
      let items: ChangelogEntry[];
      let newLastDoc: DocumentSnapshot | null;
      
      if (page > 1 && !pageCache.has(page - 1)) {
        // If we had to load all from beginning, take only last page
        const allDocs = snap.docs;
        const startIdx = (page - 1) * PAGE_SIZE;
        const pageDocs = allDocs.slice(startIdx);
        items = pageDocs.map(d => ({ id: d.id, ...d.data() } as ChangelogEntry));
        newLastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
      } else {
        items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChangelogEntry));
        newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      }

      setEntries(items);
      setLastDoc(newLastDoc);
      setCurrentPage(page);
      
      // Cache this page
      setPageCache(prev => {
        const next = new Map(prev);
        next.set(page, { entries: items, lastDoc: newLastDoc });
        return next;
      });
    } catch (e: unknown) {
      console.error('Changelog fetch error:', e);
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }, [pageCache]);

  useEffect(() => {
    // Get total count
    const loadCount = async () => {
      try {
        const coll = collection(db, 'changelog');
        const snapshot = await getCountFromServer(coll);
        setTotalCount(snapshot.data().count);
      } catch {
        // Fallback - just load without count
        setTotalCount(0);
      }
    };
    loadCount();
    loadPage(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      color: '#e0e0e0',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '32px 16px 20px',
        maxWidth: 960,
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #E50D6B, #ff6b9d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
            boxShadow: '0 4px 20px rgba(229,13,107,0.3)',
          }}>
            {'\u23F0'}
          </div>
          <div>
            <h1 style={{
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
              background: 'linear-gradient(90deg, #E50D6B, #ff6b9d, #fff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}>
              LOKMA Time Machine
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
              Commit Log &middot; {totalCount > 0 ? `${totalCount} commits` : 'Admin Portal + Mobile App + Backend'}
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          background: 'rgba(229,13,107,0.08)',
          border: '1px solid rgba(229,13,107,0.2)',
          borderRadius: 8,
          fontSize: 11,
          color: '#aaa',
          lineHeight: 1.5,
        }}>
          Her satir = LOKMA platformunun o anki komple hali.
          Geri donmek icin: <code style={{ color: '#E50D6B', background: 'rgba(229,13,107,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>git checkout &lt;HASH&gt;</code>
        </div>
      </div>

      {/* Entries */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{'\u23F3'}</div>
            Yukleniyor...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#ff6b6b' }}>
            Hata: {error}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            Henuz kayit yok
          </div>
        ) : (
          <>
            {/* Page info */}
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12, padding: '0 4px',
              fontSize: 12, color: '#666',
            }}>
              <span>Sayfa {currentPage} / {totalPages}</span>
              <span>{entries.length} kayit</span>
            </div>

            {/* Entries list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {entries.map((entry, i) => {
                const hasNote = entry.note && entry.note !== '-';
                return (
                  <div key={entry.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '10px 12px',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderRadius: 6,
                    borderLeft: hasNote ? '3px solid #E50D6B' : '3px solid transparent',
                  }}>
                    {/* Top row: timestamp + hash */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#777', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        {entry.timestamp}
                      </span>
                      <code style={{
                        fontSize: 11,
                        color: '#E50D6B',
                        background: 'rgba(229,13,107,0.1)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontWeight: 600,
                        letterSpacing: '0.3px',
                      }}>
                        {entry.hash}
                      </code>
                      {hasNote && (
                        <span style={{
                          fontSize: 10,
                          color: '#ff6b9d',
                          background: 'rgba(229,13,107,0.1)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>
                          {entry.note}
                        </span>
                      )}
                    </div>
                    {/* Description */}
                    <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {entry.description}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
              marginTop: 24, paddingBottom: 40, flexWrap: 'wrap',
            }}>
              <button
                onClick={() => loadPage(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(229,13,107,0.3)',
                  background: currentPage <= 1 ? 'transparent' : 'rgba(229,13,107,0.1)',
                  color: currentPage <= 1 ? '#555' : '#E50D6B',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                &larr; Onceki
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = idx + 1;
                } else if (currentPage <= 4) {
                  pageNum = idx + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + idx;
                } else {
                  pageNum = currentPage - 3 + idx;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => loadPage(pageNum)}
                    disabled={loading}
                    style={{
                      width: 36, height: 36,
                      borderRadius: 8,
                      border: pageNum === currentPage ? '1px solid #E50D6B' : '1px solid rgba(255,255,255,0.1)',
                      background: pageNum === currentPage ? 'rgba(229,13,107,0.2)' : 'transparent',
                      color: pageNum === currentPage ? '#E50D6B' : '#888',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: pageNum === currentPage ? 700 : 400,
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => loadPage(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(229,13,107,0.3)',
                  background: currentPage >= totalPages ? 'transparent' : 'rgba(229,13,107,0.1)',
                  color: currentPage >= totalPages ? '#555' : '#E50D6B',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Sonraki &rarr;
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
