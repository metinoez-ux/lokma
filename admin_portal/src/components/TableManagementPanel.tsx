"use client";

import { useState, useEffect, useCallback } from "react";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTranslations, useLocale } from "next-intl";

interface TableDef {
  label: string;
  section: string;
  sortOrder: number;
}

interface SectionDef {
  name: string;
  genderRestriction: string;
  prepZones?: string[];
  tezgahlar?: string[];
  hasDineIn?: boolean;
}

interface GenderTypeConfig {
  key: string;
  label: string;
  icon: string;
  color: string;
  allowedStaffGender?: 'female' | 'male' | 'all';
  isDefault?: boolean;
}

const FALLBACK_GENDER_TYPES: GenderTypeConfig[] = [
  { key: 'mixed', label: 'Karışık / Aile', icon: 'A', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40', allowedStaffGender: 'all', isDefault: true },
  { key: 'women_only', label: 'Kadın Bölümü', icon: 'K', color: 'bg-pink-500/20 text-pink-400 border-pink-500/40', allowedStaffGender: 'female', isDefault: true },
  { key: 'men_only', label: 'Erkek Bölümü', icon: 'E', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', allowedStaffGender: 'male', isDefault: true },
];

const getGenderDisplay = (key: string, types: GenderTypeConfig[]) => {
  const found = types.find(t => t.key === key);
  if (found) return found;
  const byLabel = types.find(t => t.label === key);
  return byLabel || { key, label: key, icon: key.charAt(0).toUpperCase(), color: 'bg-gray-500/20 text-gray-400 border-gray-500/40' };
};

interface TableManagementPanelProps {
  businessId: string;
  businessName: string;
  country?: string;
  collectionPath?: string;
  qrBaseUrl?: string;
  isKermes?: boolean;
  sponsorLogos?: { iconUrl: string; name: string; bgColor?: string }[];
}

export default function TableManagementPanel({
  businessId,
  businessName,
  country,
  collectionPath = "businesses",
  qrBaseUrl = "https://lokma.web.app/dinein",
  isKermes,
  sponsorLogos,
}: TableManagementPanelProps) {
  const t = useTranslations("AdminBusinessDetail");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [tables, setTables] = useState<TableDef[]>([]);
  const [maxReservationTables, setMaxReservationTables] = useState(0);
  const [tableCapacity, setTableCapacity] = useState(0);
  const [tableSections, setTableSections] = useState<string[]>([]);
  const [sectionDefs, setSectionDefs] = useState<SectionDef[]>([]);
  const [selectedBulkSection, setSelectedBulkSection] = useState<string>("");
  const [selectedTableLabels, setSelectedTableLabels] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showSectionInput, setShowSectionInput] = useState(false);
  const [selectedSectionType, setSelectedSectionType] = useState<string>('');
  const [genderTypes, setGenderTypes] = useState<GenderTypeConfig[]>(FALLBACK_GENDER_TYPES);
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickSetupCount, setQuickSetupCount] = useState("");
  // Hangi bolumlerin QR bolumu acik
  const [expandedQR, setExpandedQR] = useState<string[]>([]);
  const [editingSection, setEditingSection] = useState<{oldName: string, newName: string} | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bizDoc, configDoc] = await Promise.all([
        getDoc(doc(db, collectionPath, businessId)),
        getDoc(doc(db, 'kermes_config', 'settings')),
      ]);

      if (configDoc.exists() && configDoc.data()?.gender_types) {
        setGenderTypes(configDoc.data()!.gender_types as GenderTypeConfig[]);
      } else {
        setGenderTypes(FALLBACK_GENDER_TYPES);
      }

      if (bizDoc.exists()) {
        const d = bizDoc.data();
        setTables(d.tables || []);
        setMaxReservationTables(d.maxReservationTables || 0);
        setTableCapacity(d.tableCapacity || 0);
        setDeliveryZones(d.deliveryZones || []);
        setAvatarUrl(d.logoUrl || d.logo || d.avatar || "");
        const v2 = d.tableSectionsV2 as SectionDef[] | undefined;
        if (v2 && v2.length > 0) {
          setSectionDefs(v2);
          setTableSections(v2.map((s: SectionDef) => s.name));
          setExpandedQR(v2.map((s: SectionDef) => s.name));
        } else {
          const legacy = (d.tableSections || []) as string[];
          setTableSections(legacy);
          setSectionDefs(legacy.map((name: string) => ({ name, genderRestriction: 'mixed' as const })));
          setExpandedQR(legacy);
        }
      }
    } catch (e) {
      console.error("Error loading table data:", e);
    } finally {
      setLoading(false);
    }
  }, [businessId, collectionPath]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const generateShortLink = async (targetUrl: string) => {
    try {
      const resp = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });
      const data = await resp.json();
      if (data.code) {
        const shortUrl = `lokma.shop/tv/${data.code}`;
        try {
          await navigator.clipboard.writeText(shortUrl);
          showToast(`Kısa link panoya kopyalandı: ${shortUrl}\n\nTelevizyonunuzda bu adresi girin.`, 'success');
        } catch (err) {
          alert(`TV Ekranına bu adresi giriniz:\n${shortUrl}`);
        }
      } else {
        showToast('Hata: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Kısa link oluşturulamadı.', 'error');
    }
  };



  const saveData = async (
    newTables: TableDef[],
    newMax: number,
    newCapacity: number,
    newSections: string[],
    newDefs?: SectionDef[], newDeliveryZones?: any[]
  ) => {
    setSaving(true);
    try {
      const defsToSave = newDefs ?? sectionDefs;
      await updateDoc(doc(db, collectionPath, businessId), {
        tables: newTables,
        maxReservationTables: newMax,
        tableCapacity: newCapacity,
        tableSections: newSections,
        tableSectionsV2: defsToSave,
      deliveryZones: newDeliveryZones ?? deliveryZones,
      });
      showToast(t("kaydedildi"), "success");
    } catch (e) {
      console.error("Error saving table data:", e);
      showToast(t("kaydetmeHatasi"), "error");
    } finally {
      setSaving(false);
    }
  };

  const updateAndSave = (
    newTables?: TableDef[],
    newMax?: number,
    newCapacity?: number,
    newSections?: string[],
    newDefs?: SectionDef[],
    newDeliveryZones?: any[]
  ) => {
    const t2 = newTables ?? tables;
    const m = newMax ?? maxReservationTables;
    const c = newCapacity ?? tableCapacity;
    const s = newSections ?? tableSections;
    if (newTables !== undefined) setTables(t2);
    if (newMax !== undefined) setMaxReservationTables(m);
    if (newCapacity !== undefined) setTableCapacity(c);
    if (newSections !== undefined) setTableSections(s);
    if (newDeliveryZones !== undefined) setDeliveryZones(newDeliveryZones);
    saveData(t2, m, c, s, newDefs, newDeliveryZones);
  };


  const handleRenameSection = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || tableSections.includes(trimmed)) {
       setEditingSection(null);
       return;
    }
    const newSections = tableSections.map(s => s === oldName ? trimmed : s);
    const newTables = tables.map(t => t.section === oldName ? { ...t, section: trimmed } : t);
    const newDefs = sectionDefs.map(d => d.name === oldName ? { ...d, name: trimmed } : d);
    updateAndSave(newTables, undefined, undefined, newSections, newDefs, undefined);
    setEditingSection(null);
  };

  // Tek masa ekle (bolume ozel)
  const addSingleTable = (sectionName: string) => {
    const sectionDef = sectionDefs.find(d => d.name === sectionName);
    const gr = sectionDef?.genderRestriction || 'mixed';
    const existingLabels = tables.map((t) => t.label);
    const existingNums = existingLabels.map(l => parseInt(l.replace(/^M/, ''))).filter(n => !isNaN(n));
    let candidate = gr === 'women_only' ? 2 : 1;
    const step = gr === 'mixed' ? 1 : 2;
    while (existingNums.includes(candidate)) {
      candidate += step;
    }
    const newTable: TableDef = {
      label: `M${candidate}`,
      section: sectionName,
      sortOrder: tables.length,
    };
    const newTables = [...tables, newTable];
    updateAndSave(newTables, newTables.length);
    showToast(`M${candidate} eklendi (${sectionName})`, 'success');
  };

  // Toplu masa olustur (bolume ozel)
  const bulkCreateTables = (sectionName: string, count: number) => {
    if (count <= 0) return;
    const sectionDef = sectionDefs.find(d => d.name === sectionName);
    const gr = sectionDef?.genderRestriction || 'mixed';
    const startNum = gr === 'women_only' ? 2 : 1;
    const step = gr === 'mixed' ? 1 : 2;
    const existingLabels = tables.map(t => t.label);
    const newTables: TableDef[] = [];
    let candidate = startNum;
    let created = 0;
    while (created < count) {
      const label = `M${candidate}`;
      if (!existingLabels.includes(label)) {
        newTables.push({
          label,
          section: sectionName,
          sortOrder: tables.length + created,
        });
        created++;
      }
      candidate += step;
    }
    const allTables = [...tables, ...newTables];
    updateAndSave(allTables, allTables.length);
    showToast(t("masaOlusturuldu", { count }), "success");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${toast.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-2xl font-bold text-amber-400">{maxReservationTables || 0}</p>
          <p className="text-xs text-gray-400 mt-1">{t("toplam_masa")}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-2xl font-bold text-teal-400">{tableCapacity || 0}</p>
          <p className="text-xs text-gray-400 mt-1">{t("oturma_kapasitesi")}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-2xl font-bold text-green-400">{tables.length}</p>
          <p className="text-xs text-gray-400 mt-1">{t("tanimliMasa")}</p>
        </div>
      </div>

      {/* Global settings: kapasite + masa sayisi */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          {t("masaYonetimi")}
          {saving && <span className="text-xs text-amber-400 font-normal animate-pulse">{t("kaydediliyor")}</span>}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-gray-400 text-sm block mb-1">{t("toplam_masa_adedi")}</label>
            <input
              type="number"
              value={maxReservationTables}
              onChange={(e) => setMaxReservationTables(Math.max(0, parseInt(e.target.value) || 0))}
              min="0" max="200"
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-base font-medium"
              placeholder={t("or20")}
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">{t("oturmaKapasitesiKisi")}</label>
            <input
              type="number"
              value={tableCapacity}
              onChange={(e) => setTableCapacity(Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-base font-medium"
              placeholder={t("or80")}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => updateAndSave(tables, maxReservationTables, tableCapacity, tableSections)}
              className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition"
            >
              {t("kaydet")}
            </button>
          </div>
        </div>

        {/* Section management */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-white">{t("bolumler") || "Bölümler"}</h3>
              <p className="text-xs text-gray-400 mt-1">Masaların yer alacağı bölümleri oluşturun. Her bölüm kendi masalarını ve QR kodlarını içerir.</p>
            </div>
            {!showSectionInput ? (
              <button
                onClick={() => setShowSectionInput(true)}
                className="px-3 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition shadow-sm flex items-center gap-1"
              >
                {t("bolumEkle") || "+ Bölüm Ekle"}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {genderTypes
                    .filter(gt => !tableSections.some(s => {
                      const def = sectionDefs.find(d => d.name === s);
                      return def?.genderRestriction === gt.key;
                    }))
                    .map((gt) => (
                      <button
                        key={gt.key}
                        onClick={() => {
                          const sectionName = gt.label;
                          if (tableSections.includes(sectionName)) { showToast("Bu bölüm zaten mevcut!", "error"); return; }
                          const newSections = [...tableSections, sectionName];
                          const newDefs = [...sectionDefs, { name: sectionName, genderRestriction: gt.key }];
                          setSectionDefs(newDefs);
                          setExpandedQR(prev => [...prev, sectionName]);
                          updateAndSave(undefined, undefined, undefined, newSections, newDefs);
                          setShowSectionInput(false);
                        }}
                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg border border-gray-600 flex items-center gap-1.5 transition"
                      >
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-black/20 font-bold">{gt.icon}</span>
                        {gt.label} Ekle
                      </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="Farklı bir isim.. (Örn: Merkezi Mutfak, 3. Kat)"
                    value={selectedSectionType}
                    onChange={(e) => setSelectedSectionType(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (!selectedSectionType.trim()) return;
                        const sectionName = selectedSectionType.trim();
                        if (tableSections.includes(sectionName)) {
                          showToast("Bu bölüm zaten mevcut!", "error");
                          return;
                        }
                        const newSections = [...tableSections, sectionName];
                        const newDefs = [...sectionDefs, { name: sectionName, genderRestriction: 'mixed' }];
                        setSectionDefs(newDefs);
                        setExpandedQR(prev => [...prev, sectionName]);
                        updateAndSave(undefined, undefined, undefined, newSections, newDefs);
                        setSelectedSectionType('');
                        setShowSectionInput(false);
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-700 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-amber-500 w-72"
                  />
                  <button
                    onClick={() => {
                      if (!selectedSectionType.trim()) return;
                      const sectionName = selectedSectionType.trim();
                      if (tableSections.includes(sectionName)) {
                        showToast(t("buBolumZatenMevcut"), "error");
                        return;
                      }
                      const newSections = [...tableSections, sectionName];
                      const newDefs = [...sectionDefs, { name: sectionName, genderRestriction: 'mixed' }];
                      setSectionDefs(newDefs);
                      setExpandedQR(prev => [...prev, sectionName]);
                      updateAndSave(undefined, undefined, undefined, newSections, newDefs);
                      setSelectedSectionType('');
                      setShowSectionInput(false);
                    }}
                    disabled={!selectedSectionType.trim()}
                    className="px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition"
                  >Ekle</button>
                  <button
                    onClick={() => { setSelectedSectionType(''); setShowSectionInput(false); }}
                    className="px-2 py-1.5 text-sm text-gray-400 hover:text-white transition"
                  >İptal</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bolum kartlari - masalar ve QR kodlari icinde */}
        {tableSections.length === 0 && (
          <span className="text-sm font-medium text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 w-full mb-2 block">
            Önce bölümler oluşturun, sonra her bölüme masalar ekleyebilirsiniz.
          </span>
        )}

        <div className="space-y-4">
          {tableSections.filter(sec => {
            const def = sectionDefs.find(d => d.name === sec);
            return def?.hasDineIn !== false; // Sadece masası olanlar
          }).map((section, idx) => {
            const def = sectionDefs.find(d => d.name === section);
            const gr = def?.genderRestriction || 'mixed';
            const gd = getGenderDisplay(gr, genderTypes);
            const sectionTables = tables.filter(tb => tb.section === section);
            const isQrExpanded = expandedQR.includes(section);

            return (
              <div key={idx} className={`rounded-xl border ${gd.color} overflow-hidden`}>
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center bg-black/20">
                      {gr === 'mixed' && !genderTypes.some(g => g.label === section) ? section.charAt(0).toUpperCase() : gd.icon}
                    </span>
                    
                    {editingSection?.oldName === section ? (
                      <div className="flex items-center gap-1">
                        <input
                           autoFocus
                           className="text-black px-2 py-0.5 rounded text-sm font-semibold w-40 outline-none"
                           value={editingSection.newName}
                           onChange={(e) => setEditingSection({...editingSection, newName: e.target.value})}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') handleRenameSection(section, editingSection.newName);
                             if (e.key === 'Escape') setEditingSection(null);
                           }}
                        />
                        <button className="bg-green-600 hover:bg-green-500 text-white rounded p-1 flex items-center justify-center shadow-sm" onClick={() => handleRenameSection(section, editingSection.newName)}><span className="material-symbols-outlined text-[14px]">check</span></button>
                        <button className="bg-red-600 hover:bg-red-500 text-white rounded p-1 flex items-center justify-center shadow-sm" onClick={() => setEditingSection(null)}><span className="material-symbols-outlined text-[14px]">close</span></button>
                      </div>
                    ) : (
                      <span 
                        className="text-white font-semibold flex items-center gap-1 cursor-pointer hover:text-purple-300 transition" 
                        onClick={() => setEditingSection({oldName: section, newName: section})}
                        title="İsmi Değiştirmek İçin Tıkla"
                      >
                         {section} <span className="material-symbols-outlined text-[13px] opacity-60">edit</span>
                      </span>
                    )}

                    <span className="text-gray-300 text-xs font-normal min-w-[60px]">
                      ({sectionTables.length} Masa)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {/* Mutfak KDS / Musteri TV ekran linkleri (Sadece Kermes ise) */}
                    {isKermes && (
                      <>
                        <a
                          href={`/${locale}/kermes-display/${businessId}/${encodeURIComponent(section)}`}
                          target="_blank"
                          className="px-2.5 py-1 text-xs bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg transition font-medium flex items-center gap-1"
                          title="Aşçı KDS Ekranı (Bu bölüm siparişleri)"
                        >🧑‍🍳 KDS</a>
                        <a
                          href={`/${locale}/kermes-tv/${businessId}?section=${encodeURIComponent(section)}`}
                          target="_blank"
                          className="px-2.5 py-1 text-xs bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg transition font-medium flex items-center gap-1"
                          title="Müşteri TV Ekranı (Bu bölüm)"
                        >📺 TV'yi Aç</a>
                        <button
                          onClick={() => generateShortLink(`/${locale}/kermes-tv/${businessId}?section=${encodeURIComponent(section)}`)}
                          className="px-2.5 py-1 text-xs bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg transition font-medium flex items-center gap-1"
                          title="Kısa TV Linki Otomatik Kopyala"
                        >🔗 Kısa Link</button>
                      </>
                    )}
                    {/* Tek masa ekle */}
                    <button
                      onClick={() => addSingleTable(section)}
                      className="px-2.5 py-1 text-xs bg-teal-600/80 hover:bg-teal-500 text-white rounded-lg transition font-medium"
                      title="Bu bölüme tek masa ekle"
                    >+ Masa</button>
                    {/* Bolum sil */}
                    <button
                      onClick={() => {
                        if (sectionTables.length > 0) {
                          showToast("Hata: Bu bölümde masalar var! Önce masaları silin.", "error");
                          return;
                        }
                        const newSections = tableSections.filter((_, i) => i !== idx);
                        const newDefs = sectionDefs.filter(d => d.name !== section);
                        setSectionDefs(newDefs);
                        updateAndSave(undefined, undefined, undefined, newSections, newDefs);
                        if (selectedBulkSection === section) setSelectedBulkSection(newSections[0] || "");
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition text-xs font-bold"
                      title={t("bolumuSil")}
                    >x</button>
                  </div>
                </div>

                {/* Toplu masa olusturma (bolum icinde, kompakt) */}
                <div className="px-4 pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number" placeholder="Adet" min="1" max="50"
                      id={`bulk-count-${idx}`}
                      className="w-20 bg-gray-800/80 text-white text-xs px-2 py-1.5 rounded-md border border-gray-600 focus:border-amber-500 focus:outline-none text-center"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const count = parseInt((e.target as HTMLInputElement).value) || 0;
                          if (count > 0) {
                            bulkCreateTables(section, count);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`bulk-count-${idx}`) as HTMLInputElement;
                        const count = parseInt(input?.value) || 0;
                        if (count > 0) {
                          bulkCreateTables(section, count);
                          if (input) input.value = '';
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-white rounded-md text-xs font-medium transition"
                    >Toplu Oluştur</button>
                    <span className="text-[10px] text-gray-500">
                      {gr === 'women_only' ? 'Çift(2,4,6..)' : gr === 'men_only' ? 'Tek(1,3,5..)' : 'Ardışık(1,2,3..)'} numara atar
                    </span>
                  </div>
                </div>

                {/* Masalar gridi (bolum icinde) */}
                {sectionTables.length > 0 && (
                  <div className="px-4 pb-3">
                    {/* Bulk actions (secili masalar icin) */}
                    {(() => {
                      const sectionSelected = selectedTableLabels.filter(l => sectionTables.some(t => t.label === l));
                      if (sectionSelected.length === 0) return null;
                      return (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-2 flex items-center justify-between flex-wrap gap-2">
                          <span className="text-amber-400 text-xs font-medium">{sectionSelected.length} Masa Seçildi</span>
                          <div className="flex items-center gap-2">
                            <select
                              title="Bölüm Seçimi"
                              className="bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 text-xs"
                              id={`bulkAssign-${idx}`} defaultValue=""
                            >
                              <option value="" disabled>Bölüme Ata...</option>
                              {tableSections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button
                              onClick={() => {
                                const sel = (document.getElementById(`bulkAssign-${idx}`) as HTMLSelectElement).value;
                                if (!sel) return;
                                const updated = tables.map(t => sectionSelected.includes(t.label) ? { ...t, section: sel } : t);
                                updateAndSave(updated);
                                setSelectedTableLabels(prev => prev.filter(l => !sectionSelected.includes(l)));
                                showToast(`${sectionSelected.length} masa "${sel}" bölümüne atandı.`, "success");
                              }}
                              className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded transition"
                            >Uygula</button>
                            <button
                              onClick={() => {
                                if (confirm(`Seçili ${sectionSelected.length} masayı silmek istediğinize emin misiniz?`)) {
                                  const updated = tables.filter(t => !sectionSelected.includes(t.label));
                                  updateAndSave(updated, updated.length);
                                  setSelectedTableLabels(prev => prev.filter(l => !sectionSelected.includes(l)));
                                }
                              }}
                              className="px-2 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded transition"
                            >Sil</button>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {sectionTables.map((table) => {
                        const globalIdx = tables.findIndex(t => t.label === table.label && t.section === table.section);
                        return (
                          <div
                            key={table.label}
                            onClick={() => {
                              if (selectedTableLabels.includes(table.label)) {
                                setSelectedTableLabels(prev => prev.filter(l => l !== table.label));
                              } else {
                                setSelectedTableLabels(prev => [...prev, table.label]);
                              }
                            }}
                            className={`cursor-pointer rounded-lg border p-2.5 flex flex-col gap-1.5 transition ${selectedTableLabels.includes(table.label) ? 'bg-amber-500/10 border-amber-500' : 'bg-gray-800 border-gray-700 hover:border-amber-500/50'}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                title={`Masa ${table.label} Seçimi`}
                                checked={selectedTableLabels.includes(table.label)}
                                readOnly
                                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500 flex-shrink-0"
                              />
                              <input
                                type="text"
                                value={table.label}
                                onClick={e => e.stopPropagation()}
                                onChange={(e) => {
                                  const updated = [...tables];
                                  if (globalIdx >= 0) {
                                    updated[globalIdx] = { ...updated[globalIdx], label: e.target.value };
                                    setTables(updated);
                                  }
                                }}
                                className="w-full bg-gray-700 text-white text-center px-1 py-0.5 rounded border border-gray-600 focus:border-amber-500 focus:outline-none text-xs font-bold"
                                placeholder="#"
                              />
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = tables.filter((_, i) => i !== globalIdx);
                                updateAndSave(updated, updated.length);
                              }}
                              className="text-gray-500 hover:text-red-400 text-[10px] transition self-end bg-gray-800/50 hover:bg-gray-700 px-1.5 py-0.5 rounded"
                            >{t("sil")}</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* QR kodlari (toggle ile acilir) */}
                {sectionTables.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-3 border-t border-gray-700 pt-3 mt-3">
                      <span className="text-sm font-semibold text-gray-300">QR Kod Baskıları ({sectionTables.length})</span>
                      <button
                        onClick={() => setExpandedQR(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section])}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
                      >
                        {isQrExpanded ? "Gizle" : "Göster"}
                        <span className={`material-symbols-outlined text-[14px] transition-transform ${isQrExpanded ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
                      </button>
                    </div>
                    {isQrExpanded && (
                      <div>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <button
                            onClick={async () => {
                              const { downloadAllTableCardsAsSinglePDF } = await import("@/utils/tableCardPdfGenerator");
                              const ts = sectionTables.map(t => {
                                const def = sectionDefs.find(d => d.name === t.section);
                                const gr = def?.genderRestriction || 'mixed';
                                const sLabel = gr === 'women_only' ? 'Bölüm - H' : gr === 'men_only' ? 'Bölüm - E' : 'Aile Bölümü';
                                return { ...t, sectionLabel: sLabel };
                              });
                              await downloadAllTableCardsAsSinglePDF(ts, businessId, businessName || t("isletme_fallback"), country, { isKermes, sponsorLogos, businessLogoUrl: avatarUrl });
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                            Tümünü PDF İndir (Tek Dosya)
                          </button>
                          <button
                            onClick={async () => {
                              const { downloadAllTableCardPDFs } = await import("@/utils/tableCardPdfGenerator");
                              const ts = sectionTables.map(t => {
                                const def = sectionDefs.find(d => d.name === t.section);
                                const gr = def?.genderRestriction || 'mixed';
                                const sLabel = gr === 'women_only' ? 'Bölüm - H' : gr === 'men_only' ? 'Bölüm - E' : 'Aile Bölümü';
                                return { ...t, sectionLabel: sLabel };
                              });
                              await downloadAllTableCardPDFs(ts, businessId, businessName || t("isletme_fallback"), country, { isKermes, sponsorLogos, businessLogoUrl: avatarUrl });
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">file_copy</span>
                            Ayrı Ayrı PDF İndir
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                for (const table of sectionTables) {
                                  const tableQrTarget = `${qrBaseUrl}/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
                                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(tableQrTarget)}`;
                                  const response = await fetch(qrUrl);
                                  const blob = await response.blob();
                                  const blobUrl = URL.createObjectURL(blob);
                                  const link = document.createElement("a");
                                  link.href = blobUrl;
                                  link.download = `${t("masa_prefix")}_${table.label}_QR.png`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  await new Promise(resolve => setTimeout(resolve, 300));
                                  URL.revokeObjectURL(blobUrl);
                                }
                              } catch (error) {
                                console.error("Error downloading PNGs:", error);
                                alert("İndirme işlemi sırasında bir hata oluştu.");
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">image</span>
                            Tümünü QR PNG
                          </button>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                          {sectionTables.map((table) => {
                            const qrData = `${qrBaseUrl}/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
                            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
                            return (
                              <div
                                key={table.label}
                                className="bg-gray-800 rounded-lg border border-gray-700 p-1.5 flex flex-col items-center gap-1 hover:border-red-500 hover:bg-gray-700/50 transition group"
                              >
                                <div className="w-full aspect-square bg-background rounded flex items-center justify-center overflow-hidden">
                                  <img src={qrImageUrl} alt={`${t("masa_prefix")} ${table.label}`} className="w-full h-full object-contain" loading="lazy" />
                                </div>
                                <span className="text-[10px] font-bold text-gray-300">{table.label}</span>
                                <div className="flex gap-1 w-full">
                                  <button
                                    onClick={async () => {
                                      const { downloadTableCardPDF } = await import("@/utils/tableCardPdfGenerator");
                                      const gr = def?.genderRestriction || 'mixed';
                                      let sLabel = 'Aile Bölümü';
                                      if ((def as any)?.type === 'station') {
                                        sLabel = def?.name || 'Stant';
                                      } else if (gr === 'women_only') {
                                        sLabel = 'Bölüm - H';
                                      } else if (gr === 'men_only') {
                                        sLabel = 'Bölüm - E';
                                      }
                                      await downloadTableCardPDF(table.label, businessId, businessName || t("isletme_fallback"), country, { isKermes, sponsorLogos, sectionLabel: sLabel, businessLogoUrl: avatarUrl });
                                    }}
                                    className="flex-1 bg-red-600/80 hover:bg-red-500 text-white rounded text-[9px] py-0.5 font-medium transition text-center"
                                    title="PDF İndir"
                                  >PDF</button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrData)}`;
                                        const response = await fetch(qrUrl);
                                        const blob = await response.blob();
                                        const blobUrl = URL.createObjectURL(blob);
                                        const link = document.createElement("a");
                                        link.href = blobUrl;
                                        link.download = `Masa_${table.label}_QR.png`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(blobUrl);
                                      } catch (error) {
                                        console.error("QR Code indirilemedi:", error);
                                        window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrData)}`, "_blank");
                                      }
                                    }}
                                    className="flex-1 bg-blue-600/80 hover:bg-blue-500 text-white rounded text-[9px] py-0.5 font-medium transition text-center"
                                    title="QR PNG İndir"
                                  >QR PNG</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground/80 mt-2">{t("masaKartiInfo")}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Bos bolum */}
                {sectionTables.length === 0 && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-500 italic">Henüz bu bölüme masa eklenmedi. Yukarıdaki butonları kullanın.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bolumsuz masalar (varsa) */}
        {(() => {
          const unassigned = tables.filter(t => !t.section || !tableSections.includes(t.section));
          if (unassigned.length === 0) return null;
          return (
            <div className="mt-4 p-4 bg-red-500/10 rounded-xl border border-red-500/30">
              <p className="text-red-400 text-sm font-bold mb-2">Bölüm Atanmamış Masalar ({unassigned.length})</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {unassigned.map((table) => {
                  const globalIdx = tables.findIndex(t => t.label === table.label);
                  return (
                    <div key={table.label} className="bg-gray-800 rounded-lg border border-red-500/30 p-2 flex flex-col gap-1.5">
                      <span className="text-white text-xs font-bold text-center">{table.label}</span>
                      <select
                        title="Bolum Sec"
                        value={table.section || ""}
                        onChange={(e) => {
                          const updated = [...tables];
                          if (globalIdx >= 0) {
                            updated[globalIdx] = { ...updated[globalIdx], section: e.target.value };
                            updateAndSave(updated);
                          }
                        }}
                        className="w-full bg-gray-700 text-gray-300 px-1 py-0.5 rounded border border-red-500 text-[10px]"
                      >
                        <option value="" disabled>Bolum Sec!</option>
                        {tableSections.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        onClick={() => {
                          const updated = tables.filter((_, i) => i !== globalIdx);
                          updateAndSave(updated, updated.length);
                        }}
                        className="text-gray-500 hover:text-red-400 text-[10px] transition self-center"
                      >{t("sil")}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Empty state (hic masa yok) */}
        {tables.length === 0 && tableSections.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-6 border border-dashed border-gray-600 text-center">
            <p className="text-gray-400 text-sm">Her bolumun icindeki butonlarla masa ekleyebilirsiniz.</p>
          </div>
        )}

        {tables.length === 0 && tableSections.length === 0 && (
          <div className="bg-gray-800/50 rounded-xl p-8 border border-dashed border-gray-600 text-center flex flex-col items-center justify-center">
            <p className="text-white text-lg font-semibold mt-3">{t("henuzMasaTanimlanmadi")}</p>
            <p className="text-gray-400 text-sm mt-2 mb-6 max-w-md mx-auto">
              Once yukardaki "Bolum Ekle" butonu ile bolumlerinizi olusturun, sonra her bolume masalarini ekleyin.
            </p>
            {!showQuickSetup ? (
              <button
                onClick={() => setShowQuickSetup(true)}
                className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all text-lg flex items-center justify-center gap-2"
              >
                <span className="text-2xl leading-none mb-1">+</span> Hizli Masa Kurulumu Baslat
              </button>
            ) : (
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="number" autoFocus min="1" max="200"
                  value={quickSetupCount}
                  onChange={(e) => setQuickSetupCount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && quickSetupCount) {
                      const count = parseInt(quickSetupCount, 10);
                      if (isNaN(count) || count <= 0) return;
                      const newTables = Array.from({ length: count }, (_, i) => ({
                        label: String(i + 1), section: "", sortOrder: i,
                      }));
                      updateAndSave(newTables, count);
                      setMaxReservationTables(count);
                      showToast(`${count} adet masa basariyla olusturuldu!`, "success");
                      setQuickSetupCount(""); setShowQuickSetup(false);
                    } else if (e.key === "Escape") {
                      setQuickSetupCount(""); setShowQuickSetup(false);
                    }
                  }}
                  placeholder="Masa sayisi"
                  className="px-4 py-2.5 text-base bg-gray-700 border border-gray-500 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 w-32 text-center"
                />
                <button
                  onClick={() => {
                    const count = parseInt(quickSetupCount, 10);
                    if (isNaN(count) || count <= 0) return;
                    const newTables = Array.from({ length: count }, (_, i) => ({
                      label: String(i + 1), section: "", sortOrder: i,
                    }));
                    updateAndSave(newTables, count);
                    setMaxReservationTables(count);
                    showToast(`${count} adet masa basariyla olusturuldu!`, "success");
                    setQuickSetupCount(""); setShowQuickSetup(false);
                  }}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition text-base"
                >Olustur</button>
                <button onClick={() => { setQuickSetupCount(""); setShowQuickSetup(false); }} className="px-3 py-2.5 text-gray-400 hover:text-white transition text-base">Iptal</button>
              </div>
            )}
          </div>
        )}
      
      {/* TESLIMAT NOKTALARI */}
      {isKermes && (
        <div className="mt-8 mb-6 p-6 pb-8 bg-purple-900/10 border border-purple-500/30 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">📺 Teslimat Noktaları (TV Ekranları)</h2>
            <button onClick={() => {
              const newDz = [...deliveryZones, { id: 'dz_' + Date.now(), name: 'Yeni Ekran', prepZoneFilters: [] }];
              updateAndSave(undefined, undefined, undefined, undefined, undefined, newDz);
            }} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition">+ TV Ekranı Ekle</button>
          </div>
          <p className="text-sm text-gray-400 mb-6">Buradan eklediğiniz Teslimat Noktaları...</p>
          <div className="flex flex-col gap-3">
            {deliveryZones.map((dz, idx) => (
              <div key={dz.id} className="bg-gray-800/80 p-4 rounded-xl border border-gray-700 flex flex-wrap lg:flex-nowrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Ekran Adı</label>
                  <input type="text" value={dz.name} onChange={(e) => {
                    const upd = [...deliveryZones]; upd[idx].name = e.target.value; setDeliveryZones(upd);
                  }} onBlur={() => updateAndSave(undefined, undefined, undefined, undefined, undefined, deliveryZones)} className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700" />
                </div>
                <div className="w-[180px]">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Bağlı Bölüm</label>
                  <select value={dz.sectionFilter || ""} onChange={(e) => {
                    const upd = [...deliveryZones]; upd[idx].sectionFilter = e.target.value || null; updateAndSave(undefined, undefined, undefined, undefined, undefined, upd);
                  }} className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700">
                    <option value="">Tümü</option>
                    {tableSections.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-400 mb-2">İstasyon Seçimi (TV'de Görünecekler)</label>
                  {(() => {
                     const sDef = dz.sectionFilter ? sectionDefs.find(d => d.name === dz.sectionFilter) : null;
                     const available = sDef ? (sDef.prepZones || []) : Array.from(new Set(sectionDefs.flatMap(d => d.prepZones || [])));
                     
                     if (available.length === 0) {
                        return <div className="text-xs text-gray-500 italic bg-gray-900 border border-gray-800 rounded px-3 py-1.5 inline-block">Bu bölüme kayıtlı istasyon bulunamadı.</div>;
                     }
                     
                     return (
                        <div className="flex flex-wrap gap-2">
                          {available.map(pz => {
                             const isSelected = (dz.prepZoneFilters || []).includes(pz);
                             return (
                               <label key={pz} className={`cursor-pointer transition px-2.5 py-1 text-xs rounded-full flex items-center gap-1.5 border ${isSelected ? 'bg-amber-500 text-black border-amber-500 font-bold' : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700'}`}>
                                  <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                      const upd = [...deliveryZones];
                                      if (!upd[idx].prepZoneFilters) upd[idx].prepZoneFilters = [];
                                      if (e.target.checked) {
                                          if (!upd[idx].prepZoneFilters.includes(pz)) upd[idx].prepZoneFilters.push(pz);
                                      } else {
                                          upd[idx].prepZoneFilters = upd[idx].prepZoneFilters.filter((x: string) => x !== pz);
                                      }
                                      setDeliveryZones(upd);
                                      updateAndSave(undefined, undefined, undefined, undefined, undefined, upd);
                                  }} />
                                  <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isSelected ? 'border-black bg-black text-amber-500' : 'border-gray-500'}`}>
                                     {isSelected && <span className="material-symbols-outlined text-[10px] font-bold">check</span>}
                                  </div>
                                  {pz}
                               </label>
                             );
                          })}
                        </div>
                     )
                  })()}
                </div>
                <div className="pb-1 flex items-center gap-2">
                  <a
                    href={`/${locale}/kermes-tv/${businessId}?deliveryZone=${dz.id}`}
                    target="_blank"
                    className="px-3 py-2 text-sm bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center gap-1 transition"
                    title="Bu Özel TV Ekranını Aç"
                  >📺 TV'yi Aç</a>
                  <button
                    onClick={() => generateShortLink(`/${locale}/kermes-tv/${businessId}?deliveryZone=${dz.id}`)}
                    className="px-3 py-2 text-sm bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-1 transition"
                    title="Kısa TV Linki Otomatik Kopyala"
                  >🔗 Kısa Link</button>
                  <button onClick={() => {
                    if (confirm('Silinecek?')) {
                      const upd = deliveryZones.filter((_, i) => i !== idx);
                      updateAndSave(undefined, undefined, undefined, undefined, undefined, upd);
                    }
                  }} className="px-3 py-2 text-sm bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition">Sil</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
