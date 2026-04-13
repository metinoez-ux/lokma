'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, orderBy, Timestamp, doc, updateDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

export interface KermesRoster {
  id: string;
  kermesId: string;
  userId: string;
  role: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  createdAt?: any;
  createdBy?: string;
  batchId?: string;
  status?: 'pending' | 'accepted' | 'rejected';
}

interface KermesRosterTabProps {
  kermesId: string;
  assignedStaffIds: string[]; // List of UIDs of assigned staff/drivers/waiters etc.
  workspaceStaff: any[]; // List of real user objects mapped from users & admins to display names
  adminUid: string;
  kermesStart: string; // YYYY-MM-DD
  kermesEnd: string; // YYYY-MM-DD
  isSuperAdmin?: boolean;
  adminGender?: string;
  kermesSections?: any[];
  customRoles?: any[];
}

export default function KermesRosterTab({ kermesId, assignedStaffIds, workspaceStaff, adminUid, kermesStart, kermesEnd, isSuperAdmin, adminGender, kermesSections = [], customRoles = [] }: KermesRosterTabProps) {
  const t = useTranslations('Kermes');
  
  const [rosters, setRosters] = useState<KermesRoster[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create state
  const [isCreating, setIsCreating] = useState(false);
  const [isFullKermes, setIsFullKermes] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    role: '',
    startDate: kermesStart || '',
    endDate: kermesStart || '',
    startTime: '08:00',
    endTime: '16:00',
  });

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetRoster, setTargetRoster] = useState<KermesRoster | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Coverage Dashboard State
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageRole, setCoverageRole] = useState('Genel Sorumlu');

  useEffect(() => {
    if (!kermesId) return;
    setLoading(true);
    
    const q = query(collection(db, 'kermes_events', kermesId, 'rosters'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as KermesRoster));
      
      // Çift sıralama komutu Firebase'de "Index" hatasına neden olduğu için sıralamayı UI tarafında yapıyoruz:
      data.sort((a, b) => {
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
      
      setRosters(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching rosters realtime: ', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [kermesId]);

  const isCreatingRef = React.useRef(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingRef.current) return;
    
    if (!form.userId || !form.role || !form.startDate || !form.endDate || !form.startTime || !form.endTime) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }
    
    // Yyyy-mm-dd string parsing logic that avoids timezone issues:
    const sParts = form.startDate.split('-');
    const eParts = form.endDate.split('-');
    const sDate = new Date(parseInt(sParts[0]), parseInt(sParts[1]) - 1, parseInt(sParts[2]), 12, 0, 0);
    const eDate = new Date(parseInt(eParts[0]), parseInt(eParts[1]) - 1, parseInt(eParts[2]), 12, 0, 0);

    if (sDate > eDate) {
      alert('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }

    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const datesToAssign: string[] = [];
      const current = new Date(sDate);
      while (current <= eDate) {
        datesToAssign.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      // 1. Çakışma Kontrolü (Overlap Check) - Hiçbir kayıt yapmadan önce tüm tarihleri kontrol et
      const strictOverlaps: string[] = [];
      const softOverlaps: string[] = [];

      for (const d of datesToAssign) {
        const overlaps = rosters.filter(r => 
          r.userId === form.userId && 
          r.date === d && 
          (r.startTime < form.endTime && form.startTime < r.endTime)
        );

        if (overlaps.length > 0) {
          const identicalRoleOverlap = overlaps.find(r => r.role === form.role);
          
          if (identicalRoleOverlap) {
            strictOverlaps.push(`${d} (${identicalRoleOverlap.startTime}-${identicalRoleOverlap.endTime})`);
          } else {
            const rolesStr = overlaps.map(r => `"${r.role}"`).join(', ');
            softOverlaps.push(`${d}: ${rolesStr}`);
          }
        }
      }

      if (strictOverlaps.length > 0) {
        alert(`Çakışma Hatası: Seçili personelin aşağıdaki tarihlerde zaten "${form.role}" görevi bulunuyor:\n\n${strictOverlaps.join('\n')}\n\nLütfen aynı saate aynı görevi tekrar eklemeyin.`);
        return;
      }

      if (softOverlaps.length > 0) {
        const confirmProceed = window.confirm(
          `Dikkat: Bu personelin seçilen tarihlerde aynı saat aralığıyla çakışan BAŞKA görevleri bulunuyor:\n\n${softOverlaps.join('\n')}\n\nYine de "${form.role}" görevini atamak istiyor musunuz?`
        );
        if (!confirmProceed) {
          return;
        }
      }

      // 2. Veritabanına Yazma
      const batchId = crypto.randomUUID();
      const isMultipleDays = datesToAssign.length > 1;
      
      const formatEU = (str: string) => {
        const parts = str.split('-');
        if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        return str;
      };
      
      const euStart = formatEU(form.startDate);
      const euEnd = formatEU(form.endDate);
      const msgRange = isMultipleDays ? `${euStart} - ${euEnd}` : euStart;

      // Toplu yazım işlemi için Firestore WriteBatch kullanıyoruz, tekil insert yerine çok daha güvenli
      const batch = writeBatch(db);

      for (let i = 0; i < datesToAssign.length; i++) {
        const d = datesToAssign[i];
        const isFirst = i === 0;

        const payload: any = {
          kermesId,
          userId: form.userId,
          role: form.role,
          date: d,
          startTime: form.startTime,
          endTime: form.endTime,
          createdAt: Timestamp.now(),
          createdBy: adminUid,
          skipNotification: !isFirst,
          batchId,
          status: 'pending',
        };

        if (isFirst) {
           payload.notificationDateSpan = msgRange;
           payload.notificationBodyOverride = isMultipleDays 
             ? `${msgRange} tarihleri aralığında saat ${form.startTime} - ${form.endTime} arasında ${form.role} olarak görevlendirildiniz.`
             : `${msgRange} tarihinde saat ${form.startTime} - ${form.endTime} arasında ${form.role} olarak görevlendirildiniz.`;
        }

        const docRef = doc(collection(db, 'kermes_events', kermesId, 'rosters'));
        batch.set(docRef, payload);
      }
      
      await batch.commit();

      // UI real-time dinleyici (onSnapshot) ile anlık otomatik güncelleneceği için:
      // Optimistic update kısmını siliyoruz, böylece UI'da hayalet (tekarlanmış) listeleme (double render) hatası olmuyor.
      
      setForm(prev => ({ ...prev, userId: '', role: '' })); // Keep dates to easily assign next person
      setIsFullKermes(false);
    } catch (err) {
      console.error(err);
      alert('Kaydedilirken hata oluştu.');
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (roster: KermesRoster) => {
    setTargetRoster(roster);
    setDeleteModalOpen(true);
  };

  const confirmSingleDelete = async () => {
    if (!targetRoster) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'kermes_events', kermesId, 'rosters', targetRoster.id));
      setRosters(prev => prev.filter(r => r.id !== targetRoster.id));
      setDeleteModalOpen(false);
      setTargetRoster(null);
    } catch (e) {
      console.error(e);
      alert('Silinemedi');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!targetRoster) return;
    setIsDeleting(true);
    try {
      const userRosters = rosters.filter(r => r.userId === targetRoster.userId);
      const batch = writeBatch(db);
      
      userRosters.forEach(r => {
         const ref = doc(db, 'kermes_events', kermesId, 'rosters', r.id);
         batch.delete(ref);
      });
      
      await batch.commit();
      
      setRosters(prev => prev.filter(r => r.userId !== targetRoster.userId));
      setDeleteModalOpen(false);
      setTargetRoster(null);
    } catch (e) {
      console.error(e);
      alert('Toplu silme başarısız!');
    } finally {
      setIsDeleting(false);
    }
  };

  const getUserName = (userId: string) => {
    const s = workspaceStaff.find(w => w.id === userId || w.userId === userId);
    if (!s) return 'Bilinmiyor / Seçiniz';
    return s.profile?.name || s.name || (s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : '') || 'İsimsiz';
  };

  // Gender-based access control
  const isMaleAdmin = adminGender === 'male' || adminGender === 'erkek';
  const isFemaleAdmin = adminGender === 'female' || adminGender === 'kadin';

  const allowedStaffIds = assignedStaffIds.filter(uid => {
    if (isSuperAdmin) return true;
    const staff = workspaceStaff.find(w => w.id === uid || w.userId === uid);
    const staffGender = staff?.gender || staff?.profile?.gender || '';
    const isMaleStaff = staffGender === 'male' || staffGender === 'erkek';
    const isFemaleStaff = staffGender === 'female' || staffGender === 'kadin';
    
    if (isFemaleAdmin && isMaleStaff) return false;
    if (isMaleAdmin && isFemaleStaff) return false;
    return true;
  });

  const allowedRosters = rosters.filter(r => {
    if (isSuperAdmin) return true;
    const staff = workspaceStaff.find(w => w.id === r.userId || w.userId === r.userId);
    const staffGender = staff?.gender || staff?.profile?.gender || '';
    const isMaleStaff = staffGender === 'male' || staffGender === 'erkek';
    const isFemaleStaff = staffGender === 'female' || staffGender === 'kadin';
    
    if (isFemaleAdmin && isMaleStaff) return false;
    if (isMaleAdmin && isFemaleStaff) return false;
    return true;
  });

  // Group by date for display
  const groupedRosters = allowedRosters.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = [];
    acc[curr.date].push(curr);
    return acc;
  }, {} as Record<string, KermesRoster[]>);

  // Default Roles based on Kermes configuration
  const dynamicFoodRoles = React.useMemo(() => {
    if (!kermesSections || kermesSections.length === 0) {
      return ['Ocakbaşı - Kumpir', 'Tatlı Standı', 'İçecek Standı', 'Gözleme'];
    }
    const roles: string[] = [];
    kermesSections.forEach(sec => {
      if (sec.prepZones) {
        sec.prepZones.forEach((pz: string) => {
          if (!roles.includes(pz)) roles.push(pz);
        });
      }
    });
    return roles.length > 0 ? roles : ['Ocakbaşı - Kumpir', 'Tatlı Standı', 'İçecek Standı', 'Gözleme'];
  }, [kermesSections]);

  const dynamicSahaRoles = React.useMemo(() => {
    if (!customRoles || customRoles.length === 0) {
       return ['Genel Sorumlu', 'Garson', 'Sürücü / Nakliye', 'Güvenlik', 'Temizlik', 'Park Görevlisi', 'Çocuk Bakıcısı', 'VIP Görevlisi'];
    }
    const base = ['Genel Sorumlu', 'Garson', 'Sürücü / Nakliye'];
    const crNames = customRoles.map(cr => cr.name);
    return [...base, ...crNames.filter(n => !base.includes(n))];
  }, [customRoles]);

  const defaultRoles = [...dynamicSahaRoles, ...dynamicFoodRoles];

  // Helper for Gender Restrictions in Roles
  const isRoleDisabled = React.useCallback((r: string) => {
    if (!form.userId) return false;
    
    const selectedStaff = workspaceStaff.find(w => w.id === form.userId || w.userId === form.userId);
    if (!selectedStaff) return false;
    
    const staffGender = selectedStaff?.gender || selectedStaff?.profile?.gender || '';
    const isMaleStaff = staffGender === 'male' || staffGender === 'erkek';
    const isFemaleStaff = staffGender === 'female' || staffGender === 'kadin';
    
    // 1. Önce Admin'in Sistemden (Mutfak Sekmesi) Açıkça Yaptığı Cinsiyet Atamasını Kontrol Et
    const mappedSection = kermesSections?.find(sec => sec.prepZones?.includes(r));
    if (mappedSection && mappedSection.genderRestriction) {
      if (mappedSection.genderRestriction === 'female' && isMaleStaff) return true;
      if (mappedSection.genderRestriction === 'male' && isFemaleStaff) return true;
      // Eğer bir section'a aitse ve kısıtlama kontrolünden geçtiyse string-bazlı (geleneksel) fallback'e DÜŞMEMESİ gerekir.
      if (['female', 'male', 'all'].includes(mappedSection.genderRestriction)) {
         return false;
      }
    }
    
    // 2. Fallback: Personel Bölümü vb. atanmamışsa veya Sistem İçi Geleneksel/Manuel rollerse isminden çıkarım yap
    const lowerRole = r.toLowerCase();
    
    // Erkek personeller için olan bölümler ve açık etiketler
    const isMaleRole = lowerRole.includes('(e)') || 
                       lowerRole.includes('(erkek)') || 
                       lowerRole.includes('erkekler') || 
                       lowerRole.includes('ocakbaşı') || 
                       lowerRole.includes('kumpir') || 
                       lowerRole.includes('park görevlisi') || 
                       lowerRole.includes('güvenlik') || 
                       lowerRole.includes('sürücü');
                       
    // Kadın personeller için olan bölümler ve açık etiketler
    const isFemaleRole = lowerRole.includes('(k)') || 
                         lowerRole.includes('(kadin)') || 
                         lowerRole.includes('(kadın)') || 
                         lowerRole.includes('kadınlar') || 
                         lowerRole.includes('kadinlar') || 
                         lowerRole.includes('gözleme') || 
                         lowerRole.includes('tatlı') || 
                         lowerRole.includes('çocuk bakıcısı');

    if (isMaleRole && isFemaleStaff) return true;
    if (isFemaleRole && isMaleStaff) return true;
    
    return false;
  }, [form.userId, workspaceStaff, kermesSections]);

  // Helper function to format minutes to HH:MM
  const minsToTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Helper function to parse HH:MM to minutes
  const timeToMins = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Calculate Coverage Gaps
  const calculateGaps = () => {
    if (!kermesStart || !kermesEnd) return [];
    
    const sParts = kermesStart.split('-');
    const eParts = kermesEnd.split('-');
    if (sParts.length !== 3 || eParts.length !== 3) return [];

    const sDate = new Date(parseInt(sParts[0]), parseInt(sParts[1]) - 1, parseInt(sParts[2]), 12, 0, 0);
    const eDate = new Date(parseInt(eParts[0]), parseInt(eParts[1]) - 1, parseInt(eParts[2]), 12, 0, 0);
    
    const reqStart = 8 * 60; // 480
    const reqEnd = 20 * 60;  // 1200

    const results: { date: string, dateObj: Date, gaps: string[], empty: boolean, role: string }[] = [];
    
    defaultRoles.forEach(roleToCheck => {
      const current = new Date(sDate);
      while (current <= eDate) {
        const dStr = current.toISOString().split('T')[0];
        const dayRosters = rosters.filter(r => r.date === dStr && r.role === roleToCheck && r.status !== 'rejected');
        
        if (dayRosters.length === 0) {
           results.push({ date: dStr, dateObj: new Date(current), gaps: ['08:00 - 20:00 (Tüm Gün Boş)'], empty: true, role: roleToCheck });
        } else {
           const intervals = dayRosters.map(r => [timeToMins(r.startTime), timeToMins(r.endTime)]);
           intervals.sort((a,b) => a[0] - b[0]);
           
           const merged: number[][] = [];
           for (const iv of intervals) {
             if (merged.length === 0) merged.push(iv);
             else {
               const last = merged[merged.length - 1];
               if (iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
               else merged.push(iv);
             }
           }

           let gapStart = reqStart;
           const dailyGaps: string[] = [];
           
           for (const iv of merged) {
             if (iv[0] > gapStart) {
               const gS = Math.min(gapStart, reqEnd);
               const gE = Math.min(iv[0], reqEnd);
               if (gS < gE) dailyGaps.push(`${minsToTime(gS)} - ${minsToTime(gE)}`);
             }
             gapStart = Math.max(gapStart, iv[1]);
           }
           if (gapStart < reqEnd) {
              dailyGaps.push(`${minsToTime(gapStart)} - ${minsToTime(reqEnd)}`);
           }

           if (dailyGaps.length > 0) {
              results.push({ date: dStr, dateObj: new Date(current), gaps: dailyGaps, empty: false, role: roleToCheck });
           }
        }
        current.setDate(current.getDate() + 1);
      }
    });

    results.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.role.localeCompare(b.role);
    });
    
    return results;
  };

  const allGaps = coverageOpen ? calculateGaps() : [];
  const gapAnalysis = coverageRole === 'ALL' ? allGaps : allGaps.filter(g => g.role === coverageRole);
  const getGapCount = (role: string) => allGaps.filter(g => g.role === role).length;

  const handleGapClick = (dateStr: string, gapText: string, targetRole: string) => {
    const match = gapText.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
    if (match) {
       setForm(prev => ({
         ...prev,
         role: targetRole,
         startDate: dateStr,
         endDate: dateStr,
         startTime: match[1],
         endTime: match[2],
         userId: '' // Reset user selection to enforce picking
       }));
       setIsFullKermes(false);
       
       const formEl = document.getElementById('new-roster-form');
       if (formEl) {
         formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
         formEl.classList.add('ring-2', 'ring-orange-500', 'ring-offset-2', 'ring-offset-background');
         setTimeout(() => {
           formEl.classList.remove('ring-2', 'ring-orange-500', 'ring-offset-2', 'ring-offset-background');
         }, 1500);
       }
    }
  };

  const getRoleColor = (role: string) => {
    switch ((role || '').toLowerCase()) {
      case 'genel sorumlu': return 'bg-purple-500/10 text-purple-400 border-purple-500/20 ring-purple-500/30';
      case 'garson': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ring-emerald-500/30';
      case 'sürücü / nakliye': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 ring-amber-500/30';
      case 'ocakbaşı - kumpir': return 'bg-orange-500/10 text-orange-400 border-orange-500/20 ring-orange-500/30';
      case 'güvenlik': return 'bg-slate-500/10 text-slate-400 border-slate-500/20 ring-slate-500/30';
      case 'temizlik': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 ring-cyan-500/30';
      case 'park görevlisi': return 'bg-lime-500/10 text-lime-400 border-lime-500/20 ring-lime-500/30';
      case 'çocuk bakıcısı': return 'bg-rose-500/10 text-rose-400 border-rose-500/20 ring-rose-500/30';
      case 'vip görevlisi': return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20 ring-fuchsia-500/30';
      case 'tatlı standı': return 'bg-pink-500/10 text-pink-400 border-pink-500/20 ring-pink-500/30';
      case 'içecek standı': return 'bg-blue-500/10 text-blue-400 border-blue-500/20 ring-blue-500/30';
      case 'gözleme': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 ring-yellow-500/30';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20 ring-zinc-500/30';
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-blue-900/10 to-indigo-900/10 border border-blue-500/20 rounded-xl p-5">
        <h3 className="text-lg font-bold text-blue-100 flex items-center gap-2 mb-2">
          <span>📅</span> Vardiya ve Mesai Planlama
        </h3>
        <p className="text-sm text-blue-200/70">
          Personel havuzunuzdaki kişileri kermes süresi boyunca belirli gün ve saatlere görevlendirerek takvimi netleştirin.
        </p>
      </div>

      <div id="new-roster-form" className="bg-card border border-border rounded-xl p-5 shadow-sm transition-all duration-500">
        <h4 className="font-semibold text-foreground mb-4">Yeni Vardiya Ekle</h4>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs text-muted-foreground">Personel Seç</label>
              <button 
                type="button" 
                onClick={() => {
                  const el = document.querySelector('[data-tab="personel"]') as HTMLElement;
                  if (el) el.click();
                  else window.location.href = '?tab=personel';
                }}
                className="text-[10px] text-blue-500 hover:underline"
              >
                Yeni Ekle
              </button>
            </div>
            <select 
              value={form.userId} 
              onChange={e => setForm({...form, userId: e.target.value})}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Seçiniz</option>
              {allowedStaffIds.map(uid => (
                <option key={uid} value={uid}>{getUserName(uid)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Görev / Rol</label>
            <select 
              value={form.role} 
              onChange={e => setForm({...form, role: e.target.value})}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Seçiniz</option>
              <optgroup label="Saha & Lojistik Görevleri">
                {dynamicSahaRoles.map(r => {
                  const disabled = isRoleDisabled(r);
                  return (
                    <option key={r} value={r} disabled={disabled} className={disabled ? 'text-gray-400 bg-gray-50 dark:bg-gray-800' : ''}>
                      {r} {disabled ? '(Uyumsuz)' : ''}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Stand & Mutfak Bölümleri">
                {dynamicFoodRoles.map(r => {
                  const disabled = isRoleDisabled(r);
                  return (
                    <option key={r} value={r} disabled={disabled} className={disabled ? 'text-gray-400 bg-gray-50 dark:bg-gray-800' : ''}>
                      {r} {disabled ? '(Uyumsuz)' : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </div>
          <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-muted-foreground">Tarih Aralığı (Başlangıç - Bitiş)</label>
              <label className="text-[10px] flex items-center gap-1 cursor-pointer text-blue-500 hover:text-blue-600 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded">
                <input 
                  type="checkbox" 
                  checked={isFullKermes} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsFullKermes(checked);
                    if (checked) {
                      setForm(prev => ({...prev, startDate: kermesStart || '', endDate: kermesEnd || ''}));
                    }
                  }} 
                  className="rounded border-blue-300 w-3 h-3 text-blue-600 focus:ring-blue-500" 
                />
                Tüm Kermes Boyunca
              </label>
            </div>
            <div className="flex items-center gap-1">
              <input 
                type="date" 
                value={form.startDate}
                min={kermesStart || ''}
                max={kermesEnd || ''}
                disabled={isFullKermes}
                onChange={e => {
                  const val = e.target.value;
                  setForm(prev => ({...prev, startDate: val, endDate: prev.endDate < val ? val : prev.endDate}));
                }}
                className="w-full bg-background border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="text-muted-foreground">-</span>
              <input 
                type="date" 
                value={form.endDate}
                min={form.startDate || kermesStart || ''}
                max={kermesEnd || ''}
                disabled={isFullKermes}
                onChange={e => setForm({...form, endDate: e.target.value})}
                className="w-full bg-background border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Saat (Başlangıç - Bitiş)</label>
            <div className="flex items-center gap-1">
              <input 
                type="time" 
                value={form.startTime}
                onChange={e => setForm({...form, startTime: e.target.value})}
                className="w-full bg-background border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-muted-foreground">-</span>
              <input 
                type="time" 
                value={form.endTime}
                onChange={e => setForm({...form, endTime: e.target.value})}
                className="w-full bg-background border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <button 
              type="submit" 
              disabled={isCreating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg py-2 px-4 transition disabled:opacity-50"
            >
              {isCreating ? '...' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>

      {/* Coverage Dashboard Accordion */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <button 
          onClick={() => setCoverageOpen(!coverageOpen)}
          className="w-full bg-slate-900/40 hover:bg-slate-800/60 p-4 flex items-center justify-between transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h4 className="font-bold text-foreground text-base">Görev Kapsama & Boşluk Analizi</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Seçilen görevde hangi tarih ve saat aralıklarında personel atanmadığını tespit edin (08:00 - 20:00 standardına göre).</p>
            </div>
          </div>
          <div className="text-muted-foreground">
            {coverageOpen ? (
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            ) : (
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            )}
          </div>
        </button>

        {coverageOpen && (
          <div className="p-5 border-t border-border bg-background/50">
             <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCoverageRole('ALL')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                      coverageRole === 'ALL' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 ring-2 ring-blue-500/50' 
                        : 'bg-card border border-border text-foreground hover:bg-black/10'
                    }`}
                  >
                    TÜMÜ 
                    <span className={`${coverageRole === 'ALL' ? 'bg-white text-blue-600' : 'bg-blue-500/10 text-blue-500'} px-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-extrabold`}>
                      {allGaps.length}
                    </span>
                  </button>
                  <div className="w-[1px] h-6 bg-border mx-1 self-center"></div>
                  {defaultRoles.map(r => {
                    const count = getGapCount(r);
                    return (
                      <button
                        key={r}
                        onClick={() => setCoverageRole(r)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          coverageRole === r 
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-900/20 ring-2 ring-orange-500/50' 
                            : 'bg-card border border-border text-foreground hover:bg-black/10'
                        }`}
                      >
                        {r}
                        {count > 0 ? (
                          <span className={`${coverageRole === r ? 'bg-white text-orange-600' : 'bg-red-500 text-white shadow-sm'} px-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold`}>
                            {count}
                          </span>
                        ) : (
                          <span className={`${coverageRole === r ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600'} px-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold`}>
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
             </div>

             <div className="space-y-3">
               {gapAnalysis.length === 0 ? (
                 <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                   <div className="bg-emerald-500/20 text-emerald-500 p-2 rounded-full">
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   </div>
                   <div>
                     <p className="text-emerald-500 font-bold">Mükemmel!</p>
                     <p className="text-sm text-emerald-600/80 mt-0.5">
                       {coverageRole === 'ALL' 
                         ? '08:00 ile 20:00 arasında tüm kermes günleri boyunca HİÇBİR GÖREVDE açık saat bulunmuyor.' 
                         : `"${coverageRole}" görevi için 08:00 ile 20:00 arasında tüm kermes günleri boyunca hiçbir açık saat bulunmuyor.`}
                     </p>
                   </div>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {gapAnalysis.map((gapInfo, i) => (
                      <div key={i} className={`rounded-xl border p-4 ${gapInfo.empty ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
                         <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider bg-black/20 px-2 py-1 rounded text-foreground/80 shadow-sm">
                              {gapInfo.dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })}
                            </span>
                            {gapInfo.empty && <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded animate-pulse">KRİTİK AÇIK</span>}
                         </div>
                         {coverageRole === 'ALL' && (
                           <div className="mb-2 w-max text-[11px] font-bold px-2 py-0.5 bg-background border border-border rounded shadow-sm text-foreground/90">
                              {gapInfo.role}
                           </div>
                         )}
                         <div className="space-y-1.5 mt-2">
                           {gapInfo.gaps.map((gapText, j) => (
                             <button 
                               key={j} 
                               onClick={() => handleGapClick(gapInfo.date, gapText, gapInfo.role)}
                               className={`group w-full flex items-center justify-between p-2 rounded-lg transition-colors border border-transparent ${gapInfo.empty ? 'hover:bg-red-500/20 hover:border-red-500/30' : 'hover:bg-orange-500/20 hover:border-orange-500/30'}`}
                             >
                               <div className={`flex items-center gap-2 text-sm font-semibold ${gapInfo.empty ? 'text-red-400' : 'text-orange-400'}`}>
                                 <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 {gapText}
                               </div>
                               <span className={`text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${gapInfo.empty ? 'text-red-300' : 'text-orange-300'}`}>
                                 Atama Yap <span>&rarr;</span>
                               </span>
                             </button>
                           ))}
                         </div>
                      </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-4">Vardiya Takvimi</h4>
        {loading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Takvim yükleniyor...</div>
        ) : Object.keys(groupedRosters).length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl text-muted-foreground">
            Buna kermese henüz vardiya eklenmedi.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedRosters).sort().map(dateStr => {
              const dateObj = new Date(dateStr);
              return (
                <div key={dateStr} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px bg-border flex-1"></div>
                    <span className="text-sm font-semibold text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20">
                      {dateObj.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <div className="h-px bg-border flex-1"></div>
                  </div>
                  
                  <div className="space-y-6 mt-6">
                    {Object.entries(groupedRosters[dateStr].reduce((acc, roster) => {
                      if (!acc[roster.role]) acc[roster.role] = [];
                      acc[roster.role].push(roster);
                      return acc;
                    }, {} as Record<string, typeof groupedRosters[string]>)).sort().map(([role, list]) => {
                      const roleBadge = getRoleColor(role);
                      const borderColor = roleBadge.match(/border-([a-z]+-[0-9]+)/)?.[0] || 'border-border';
                      const bgColor = roleBadge.match(/bg-([a-z]+-[0-9]+)\/10/)?.[0] || 'bg-muted';
                      const textColor = roleBadge.match(/text-([a-z]+-[0-9]+)/)?.[0] || 'text-foreground';
                      
                      return (
                        <div key={role} className="relative bg-card/30 border border-border rounded-2xl p-4 shadow-sm">
                          {/* Role Header */}
                          <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${borderColor}/20`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgColor}/20 ${textColor} ${borderColor}`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <h5 className={`font-bold text-base ${textColor}`}>{role}</h5>
                              <span className="text-xs font-semibold text-muted-foreground">{list.length} Personel Görevlendirildi</span>
                            </div>
                          </div>
                          
                          {/* Cards Grid under this Role */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {list.map(roster => {
                              const staffName = getUserName(roster.userId);
                              return (
                                <div key={roster.id} className={`group relative ${bgColor}/5 hover:${bgColor}/10 border ${borderColor}/30 rounded-xl p-3 flex items-center gap-3 transition-colors cursor-default`}>
                                  
                                  {/* Avatar */}
                                  <div className={`w-10 h-10 rounded-full ${bgColor}/20 border ${borderColor}/50 flex items-center justify-center font-bold text-sm ${textColor} shadow-inner`}>
                                    {getInitials(staffName)}
                                  </div>
                                  
                                  {/* Info */}
                                  <div className="flex-1 min-w-0 pr-6">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="font-bold text-foreground text-sm truncate">{staffName}</p>
                                      {/* Status Badge */}
                                      {roster.status === 'accepted' && (
                                        <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Kabul
                                        </span>
                                      )}
                                      {roster.status === 'rejected' && (
                                        <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded ml-2">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg> Red
                                        </span>
                                      )}
                                      {(!roster.status || roster.status === 'pending') && (
                                        <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-2">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Bekleyen
                                        </span>
                                      )}
                                    </div>
                                    <div className={`flex items-center gap-1.5 mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${bgColor}/20 ${textColor} w-max border ${borderColor}/30`}>
                                      <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>{roster.startTime} - {roster.endTime}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Delete Action */}
                                  <button 
                                    onClick={() => handleDeleteClick(roster)}
                                    className="text-red-500 hover:bg-red-500/10 rounded-md transition-all p-1.5 absolute right-2 top-1/2 -translate-y-1/2"
                                    title="Vardiyayı Sil"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteModalOpen && targetRoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Vardiya İptal Seçenekleri</h3>
              <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
                <strong>{getUserName(targetRoster.userId)}</strong> adlı personelin vardiyasını siliyorsunuz. Bu kişinin kermes boyunca toplam <strong>{rosters.filter(r => r.userId === targetRoster.userId).length}</strong> adet aktif görev ataması bulunuyor.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={confirmSingleDelete}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">Sadece Bu Vardiyayı Sil</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{targetRoster.date} tarihindeki görevi siler.</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>

                <button
                  onClick={confirmBulkDelete}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 group"
                >
                  <div className="text-left">
                    <div className="font-semibold text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300">Tüm Atamalarını Tek Seferde Temizle</div>
                    <div className="text-xs text-red-500/70 dark:text-red-400/70 mt-1">Bu kermesteki aktif tüm görevlerini iptal eder.</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </div>
                </button>
              </div>
              
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="w-full mt-4 py-3 font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
