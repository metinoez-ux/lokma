'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';

export interface GenderTypeConfig {
  key: string;       // Firestore'a kaydedilan deger, orn: "women_only"
  label: string;     // Gosterilen ad, orn: "Kadin Bolumu"
  icon: string;      // Tek karakter rozet, orn: "K"
  color: string;     // Tailwind class grubu, orn: "bg-pink-500/20 text-pink-400 border-pink-500/40"
  isDefault?: boolean; // Bu tip silinemez
}

const FIRESTORE_DOC = 'kermes_config';
const FIRESTORE_FIELD = 'gender_types';

const DEFAULT_TYPES: GenderTypeConfig[] = [
  { key: 'mixed', label: 'Karisik / Aile', icon: 'A', color: 'bg-green-500/20 text-green-400 border-green-500/40', isDefault: true },
  { key: 'women_only', label: 'Kadin Bolumu', icon: 'K', color: 'bg-pink-500/20 text-pink-400 border-pink-500/40', isDefault: true },
  { key: 'men_only', label: 'Erkek Bolumu', icon: 'E', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', isDefault: true },
];

const COLOR_PRESETS = [
  'bg-green-500/20 text-green-400 border-green-500/40',
  'bg-pink-500/20 text-pink-400 border-pink-500/40',
  'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'bg-purple-500/20 text-purple-400 border-purple-500/40',
  'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'bg-teal-500/20 text-teal-400 border-teal-500/40',
  'bg-red-500/20 text-red-400 border-red-500/40',
  'bg-orange-500/20 text-orange-400 border-orange-500/40',
];

export default function KermesGenderTypesPage() {
  const { admin, loading: adminLoading } = useAdmin();
  const [types, setTypes] = useState<GenderTypeConfig[]>(DEFAULT_TYPES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[3]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, FIRESTORE_DOC, 'settings'));
        if (snap.exists() && snap.data()[FIRESTORE_FIELD]) {
          setTypes(snap.data()[FIRESTORE_FIELD] as GenderTypeConfig[]);
        } else {
          setTypes(DEFAULT_TYPES);
        }
      } catch (err) {
        console.error(err);
        setTypes(DEFAULT_TYPES);
      } finally {
        setLoading(false);
      }
    };
    if (!adminLoading && admin?.role === 'super_admin') load();
  }, [adminLoading, admin]);

  const save = async (updated: GenderTypeConfig[]) => {
    setSaving(true);
    try {
      await setDoc(doc(db, FIRESTORE_DOC, 'settings'), { [FIRESTORE_FIELD]: updated }, { merge: true });
      showToast('Kaydedildi');
    } catch (err) {
      console.error(err);
      showToast('Kaydetme hatasi', false);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const k = newKey.trim().replace(/\s+/g, '_').toLowerCase();
    if (!k || !newLabel.trim() || !newIcon.trim()) {
      showToast('Tum alanlari doldurun', false);
      return;
    }
    if (types.some(t => t.key === k)) {
      showToast('Bu anahtar zaten mevcut', false);
      return;
    }
    const next = [...types, { key: k, label: newLabel.trim(), icon: newIcon.trim().charAt(0).toUpperCase(), color: newColor }];
    setTypes(next);
    save(next);
    setNewKey(''); setNewLabel(''); setNewIcon('');
  };

  const handleDelete = (key: string) => {
    const t = types.find(t => t.key === key);
    if (t?.isDefault) { showToast('Varsayilan tipler silinemez', false); return; }
    const next = types.filter(t => t.key !== key);
    setTypes(next);
    save(next);
  };

  const handleLabelEdit = (key: string, label: string) => {
    const next = types.map(t => t.key === key ? { ...t, label } : t);
    setTypes(next);
  };

  const handleColorEdit = (key: string, color: string) => {
    const next = types.map(t => t.key === key ? { ...t, color } : t);
    setTypes(next);
    save(next);
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!admin || admin.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Yetkiniz yok.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white font-medium shadow-lg ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <Link href="/admin/kermes" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
          ← Kermes Yonetimi
        </Link>

        <div className="flex items-center justify-between mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Bolum Cinsiyet Tipleri
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Kermes masa bolumlerinde goruntulenen cinsiyet kısıtlama secenekleri. Buraya eklenen tipler, Masa Yonetimi panelinde seceneklere otomatik yansır.
            </p>
          </div>
        </div>

        {/* Mevcut tipler */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Mevcut Tipler</h2>
          <div className="space-y-3">
            {types.map((t) => (
              <div key={t.key} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                {/* Renk onizleme */}
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${t.color}`}>
                  {t.icon}
                </span>

                {/* Etiket (duzenlenebilir) */}
                <div className="flex-1 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <input
                    aria-label={`${t.label} gosterim adi`}
                    title={`${t.label} gosterim adini duzenle`}
                    value={t.label}
                    onChange={(e) => handleLabelEdit(t.key, e.target.value)}
                    onBlur={() => save(types)}
                    className="flex-1 bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm border border-gray-600 focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground font-mono px-2 py-1 bg-gray-800 rounded">
                    key: {t.key}
                  </span>
                  {t.isDefault && (
                    <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                      varsayilan
                    </span>
                  )}
                </div>

                {/* Renk secici */}
                <div className="flex gap-1">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      title={preset}
                      onClick={() => handleColorEdit(t.key, preset)}
                      className={`w-5 h-5 rounded-full border-2 transition ${t.color === preset ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'} ${preset}`}
                    />
                  ))}
                </div>

                {/* Sil */}
                <button
                  onClick={() => handleDelete(t.key)}
                  disabled={t.isDefault}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-25 disabled:cursor-not-allowed transition"
                  title={t.isDefault ? 'Varsayilan tipler silinemez' : 'Sil'}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Yeni tip ekle */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Yeni Tip Ekle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Anahtar (key) *</label>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="orn: vip_lounge"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm border border-gray-600 focus:border-amber-500 focus:outline-none"
              />
              <p className="text-xs text-muted-foreground mt-1">Bosluk yerine alt cizgi kullanin. Kucuk harf.</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Gosterim Adi *</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="orn: VIP Salonu"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm border border-gray-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Rozet Harfi (1 karakter) *</label>
              <input
                value={newIcon}
                maxLength={1}
                onChange={(e) => setNewIcon(e.target.value)}
                placeholder="orn: V"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm border border-gray-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Renk</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    title={`Renk sec: ${preset}`}
                    aria-label={`Renk sec: ${preset}`}
                    onClick={() => setNewColor(preset)}
                    className={`w-8 h-8 rounded-full border-2 transition ${newColor === preset ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'} ${preset}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border ${newColor}`}>
              {newIcon || '?'}
            </div>
            <div className="text-sm text-foreground">{newLabel || 'Yeni Tip'}</div>
            <button
              onClick={handleAdd}
              disabled={saving || !newKey || !newLabel || !newIcon}
              className="ml-auto px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition"
            >
              {saving ? 'Kaydediliyor...' : 'Ekle ve Kaydet'}
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Degisiklikler tum kermes olay Masa Yonetim panellerine anlik yansir.
          <br />Firestore yolu: <span className="font-mono">kermes_config/settings → gender_types[]</span>
        </p>
      </div>
    </div>
  );
}
