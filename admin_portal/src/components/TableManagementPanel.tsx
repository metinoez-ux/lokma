"use client";

import { useState, useEffect, useCallback } from "react";
import {
 doc,
 getDoc,
 updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTranslations } from "next-intl";

interface TableDef {
 label: string;
 section: string;
 sortOrder: number;
}

interface SectionDef {
 name: string;
 genderRestriction: string;
}

interface GenderTypeConfig {
 key: string;
 label: string;
 icon: string;
 color: string;
 isDefault?: boolean;
}

// Fallback - Super Admin Firestore'dan yuklenmezse kullanilir
const FALLBACK_GENDER_TYPES: GenderTypeConfig[] = [
 { key: 'mixed', label: 'Karisik / Aile', icon: 'A', color: 'bg-green-500/20 text-green-400 border-green-500/40', isDefault: true },
 { key: 'women_only', label: 'Kadin Bolumu', icon: 'K', color: 'bg-pink-500/20 text-pink-400 border-pink-500/40', isDefault: true },
 { key: 'men_only', label: 'Erkek Bolumu', icon: 'E', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', isDefault: true },
];

const getGenderDisplay = (key: string, types: GenderTypeConfig[]) => {
 const found = types.find(t => t.key === key);
 if (found) return found;
 // key dogrudan label olarak kullanilmis olabilir (legacy)
 const byLabel = types.find(t => t.label === key);
 return byLabel || { key, label: key, icon: key.charAt(0).toUpperCase(), color: 'bg-gray-500/20 text-gray-400 border-gray-500/40' };
};

interface TableManagementPanelProps {
 businessId: string;
 businessName: string;
 country?: string;
 /** Firestore koleksiyon yolu (varsayilan: "businesses") */
 collectionPath?: string;
 /** QR kod icin temel URL (varsayilan: "https://lokma.web.app/dinein") */
 qrBaseUrl?: string;
}

export default function TableManagementPanel({
 businessId,
 businessName,
 country,
 collectionPath = "businesses",
 qrBaseUrl = "https://lokma.web.app/dinein",
}: TableManagementPanelProps) {
 const t = useTranslations("AdminBusinessDetail");

 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [tables, setTables] = useState<TableDef[]>([]);
 const [maxReservationTables, setMaxReservationTables] = useState(0);
 const [tableCapacity, setTableCapacity] = useState(0);
 const [tableSections, setTableSections] = useState<string[]>([]);
 const [sectionDefs, setSectionDefs] = useState<SectionDef[]>([]);
 const [selectedBulkSection, setSelectedBulkSection] = useState<string>("");
 const [selectedTableLabels, setSelectedTableLabels] = useState<string[]>([]);
 const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
 const [showSectionInput, setShowSectionInput] = useState(false);
 const [newSectionName, setNewSectionName] = useState("");
 const [newSectionGender, setNewSectionGender] = useState<string>('mixed');
 const [genderTypes, setGenderTypes] = useState<GenderTypeConfig[]>(FALLBACK_GENDER_TYPES);
 const [showQuickSetup, setShowQuickSetup] = useState(false);
 const [quickSetupCount, setQuickSetupCount] = useState("");

 const showToast = (msg: string, type: "success" | "error") => {
 setToast({ msg, type });
 setTimeout(() => setToast(null), 3000);
 };

 // Load data from Firestore
 const loadData = useCallback(async () => {
 setLoading(true);
 try {
 // Paralel yukle: isletme verisi + global gender tipleri
 const [bizDoc, configDoc] = await Promise.all([
  getDoc(doc(db, collectionPath, businessId)),
  getDoc(doc(db, 'kermes_config', 'settings')),
 ]);

 // Global gender tipleri
 if (configDoc.exists() && configDoc.data()?.gender_types) {
  setGenderTypes(configDoc.data()!.gender_types as GenderTypeConfig[]);
  setNewSectionGender(configDoc.data()!.gender_types[0]?.key || 'mixed');
 } else {
  setGenderTypes(FALLBACK_GENDER_TYPES);
 }

 if (bizDoc.exists()) {
  const d = bizDoc.data();
  setTables(d.tables || []);
  setMaxReservationTables(d.maxReservationTables || 0);
  setTableCapacity(d.tableCapacity || 0);
  // V2 migration: eger tableSectionsV2 varsa onu kullan, yoksa eski tableSections'tan migrate et
  const v2 = d.tableSectionsV2 as SectionDef[] | undefined;
  if (v2 && v2.length > 0) {
   setSectionDefs(v2);
   setTableSections(v2.map((s: SectionDef) => s.name));
  } else {
   const legacy = (d.tableSections || []) as string[];
   setTableSections(legacy);
   setSectionDefs(legacy.map((name: string) => ({ name, genderRestriction: 'mixed' as const })));
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

 // Save to Firestore
 const saveData = async (
 newTables: TableDef[],
 newMax: number,
 newCapacity: number,
 newSections: string[],
 newDefs?: SectionDef[]
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
 });
 showToast(t("kaydedildi"), "success");
 } catch (e) {
 console.error("Error saving table data:", e);
 showToast(t("kaydetmeHatasi"), "error");
 } finally {
 setSaving(false);
 }
 };

 // Update state + auto-save
 const updateAndSave = (
 newTables?: TableDef[],
 newMax?: number,
 newCapacity?: number,
 newSections?: string[],
 newDefs?: SectionDef[]
 ) => {
 const t2 = newTables ?? tables;
 const m = newMax ?? maxReservationTables;
 const c = newCapacity ?? tableCapacity;
 const s = newSections ?? tableSections;
 if (newTables !== undefined) setTables(t2);
 if (newMax !== undefined) setMaxReservationTables(m);
 if (newCapacity !== undefined) setTableCapacity(c);
 if (newSections !== undefined) setTableSections(s);
 saveData(t2, m, c, s, newDefs);
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
 <div
 className={`px-4 py-2 rounded-lg text-sm font-medium ${
 toast.type === "success"
 ? "bg-green-500/20 text-green-400"
 : "bg-red-500/20 text-red-400"
 }`}
 >
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

  {/* Table Management */}
  <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
  <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
  {t("masaYonetimi")}
  {saving && (
  <span className="text-xs text-amber-400 font-normal animate-pulse">
  {t("kaydediliyor")}
  </span>
  )}
  </h2>

  {/* Section management (ALWAYS VISIBLE AND FIRST) */}
  <div className="mb-8 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
  <div className="flex items-center justify-between mb-3">
  <div>
  <h3 className="text-base font-semibold text-white">{t("bolumler") || "Bölümler"}</h3>
  <p className="text-xs text-gray-400 mt-1">Önce masaların yer alacağı bölümleri oluşturun (Örn: Aile Bölümü, Bahçe, vs.)</p>
  </div>
  {!showSectionInput ? (
  <button
  onClick={() => setShowSectionInput(true)}
  className="px-3 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition shadow-sm flex items-center gap-1"
  >
  <span className="font-bold text-lg leading-none">+</span> {t("bolumEkle") || "Bolum Ekle"}
  </button>
  ) : (
  <div className="flex items-center gap-2">
  <input
  type="text"
  autoFocus
  value={newSectionName}
  onChange={(e) => setNewSectionName(e.target.value)}
  onKeyDown={(e) => {
  if (e.key === "Enter" && newSectionName.trim()) {
   if (tableSections.includes(newSectionName.trim())) {
   showToast(t("buBolumZatenMevcut"), "error");
   return;
   }
   const newSections = [...tableSections, newSectionName.trim()];
   const newDefs = [...sectionDefs, { name: newSectionName.trim(), genderRestriction: newSectionGender }];
   setSectionDefs(newDefs);
   updateAndSave(undefined, undefined, undefined, newSections, newDefs);
   setNewSectionName("");
   setNewSectionGender(genderTypes[0]?.key || 'mixed');
   setShowSectionInput(false);
  } else if (e.key === "Escape") {
  setNewSectionName("");
  setShowSectionInput(false);
  }
  }}
  placeholder={t("yeniBolumAdiOr1Kat") || "Bolum adi (Orn: VIP)"}
  className="px-3 py-1.5 text-sm bg-gray-700 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 w-48"
  />
  <select
  title="Bolum Cinsiyet Tipi"
  value={newSectionGender}
  onChange={(e) => setNewSectionGender(e.target.value)}
  className="px-2 py-1.5 text-sm bg-gray-700 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-amber-500"
  >
  {genderTypes.map((gt) => (
   <option key={gt.key} value={gt.key}>{gt.icon} {gt.label}</option>
  ))}
  </select>
  <button
  onClick={() => {
  if (!newSectionName.trim()) return;
  if (tableSections.includes(newSectionName.trim())) {
  showToast(t("buBolumZatenMevcut"), "error");
  return;
  }
  const newSections = [...tableSections, newSectionName.trim()];
  const newDefs = [...sectionDefs, { name: newSectionName.trim(), genderRestriction: newSectionGender }];
  setSectionDefs(newDefs);
  updateAndSave(undefined, undefined, undefined, newSections, newDefs);
  setNewSectionName("");
  setNewSectionGender(genderTypes[0]?.key || 'mixed');
  setShowSectionInput(false);
  }}
  className="px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
  >
  Ekle
  </button>
  <button
  onClick={() => { setNewSectionName(""); setShowSectionInput(false); }}
  className="px-2 py-1.5 text-sm text-gray-400 hover:text-white transition"
  >
  Iptal
  </button>
  </div>
  )}
  </div>
  <div className="flex flex-wrap gap-2 mt-4">
  {tableSections.length === 0 && (
  <span className="text-sm font-medium text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 w-full mb-2">
  ℹ️ Masalarınızı oluşturup sonradan çoklu seçim ile (checkbox) onlara bölümler atayabilirsiniz.
  </span>
   )}
   {tableSections.map((section, idx) => {
   const def = sectionDefs.find(d => d.name === section);
   const gr = def?.genderRestriction || 'mixed';
   const gd = getGenderDisplay(gr, genderTypes);
   return (
   <div key={idx} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm shadow-sm border ${gd.color}`}>
   <span className="font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center bg-black/20">{gd.icon}</span>
   <span className="text-white font-medium">{section}</span>
   <span className="text-gray-300 text-xs ml-0.5 font-normal">
   ({tables.filter((t) => t.section === section).length} {t("masa")})
   </span>
   <button
   onClick={() => {
   if (tables.some(t => t.section === section)) {
       showToast("Hata: Bu bölümde masalar bulunuyor! Lütfen önce bu masaları silin veya bölümünü değiştirin.", "error");
       return;
   }
   const newSections = tableSections.filter((_, i) => i !== idx);
   const newDefs = sectionDefs.filter(d => d.name !== section);
   setSectionDefs(newDefs);
   updateAndSave(undefined, undefined, undefined, newSections, newDefs);
   if (selectedBulkSection === section) setSelectedBulkSection(newSections[0] || "");
   }}
   className="ml-2 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition text-xs font-bold"
   title={t("bolumuSil")}
   >
   ✕
   </button>
   </div>
   );
   })}
   </div>
  </div>

  {/* Quick setup row */}
  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
  <div>
  <label className="text-gray-400 text-sm block mb-1">{t("toplam_masa_adedi")}</label>
  <input
  type="number"
  value={maxReservationTables}
  onChange={(e) => setMaxReservationTables(Math.max(0, parseInt(e.target.value) || 0))}
  min="0"
  max="200"
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
  <div>
  <label className="text-gray-400 text-sm block mb-1">Hedef Bölüm (Opsiyonel)</label>
  <select
    title="Hedef Bölüm"
    value={selectedBulkSection}
    onChange={(e) => setSelectedBulkSection(e.target.value)}
    className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-amber-600 focus:border-amber-400 focus:outline-none text-sm font-medium"
  >
    <option value="" disabled>-- Seçiniz --</option>
    {tableSections.map(s => <option key={s} value={s}>{s}</option>)}
  </select>
  </div>
  <div className="flex items-end">
  <button
  onClick={() => {
  const count = maxReservationTables || 0;
  if (count <= 0) return;
  const targetSection = selectedBulkSection || "";
  const newTables = Array.from({ length: count }, (_, i) => ({
  label: String(i + 1),
  section: targetSection,
  sortOrder: i,
  }));
  updateAndSave(newTables, count);
  showToast(t("masaOlusturuldu", { count }), "success");
  }}
  className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition"
  >
  {t("topluOlustur", { count: maxReservationTables || "N" })}
  </button>
  </div>
  <div className="flex items-end">
  <button
  onClick={() => {
  const existingLabels = tables.map((t) => t.label);
  let nextNum = tables.length + 1;
  while (existingLabels.includes(String(nextNum))) nextNum++;
  
  const targetSection = selectedBulkSection || "";

  const newTable: TableDef = {
  label: String(nextNum),
  section: targetSection,
  sortOrder: tables.length,
  };
  const newTables = [...tables, newTable];
  updateAndSave(newTables, newTables.length);
  }}
  className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition"
  >
  {t("tek_masa_ekle")}
  </button>
  </div>
  </div>

 {/* Table list */}
 {tables.length > 0 && (
  <div>
  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
  <div className="flex items-center gap-4">
  <h3 className="text-sm font-semibold text-gray-300">
  {t("masalar")} ({tables.length})
  </h3>
  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-white transition">
    <input 
       type="checkbox" 
       title="Tümünü Seç"
       aria-label="Tüm Masaları Seç"
       className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
       checked={selectedTableLabels.length === tables.length && tables.length > 0}
       onChange={(e) => {
         if (e.target.checked) setSelectedTableLabels(tables.map(t => t.label));
         else setSelectedTableLabels([]);
       }}
    />
    Tümünü Seç
  </label>
  </div>
  <button
  onClick={() => updateAndSave(tables, maxReservationTables, tableCapacity, tableSections)}
  className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-md transition"
  >
  {t("kaydet")}
  </button>
  </div>

  {/* Bulk Actions Toolbar */}
  {selectedTableLabels.length > 0 && (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-center justify-between flex-wrap gap-4">
       <span className="text-amber-400 text-sm font-medium">
         {selectedTableLabels.length} Masa Seçildi
       </span>
       <div className="flex items-center gap-3">
         <select
            title="Bölüm Seçimi"
            aria-label="Toplu Atama İçin Bölüm Seçimi"
            className="bg-gray-800 text-white px-3 py-1.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-sm"
            id="bulkSectionAssignSelect"
            defaultValue=""
         >
           <option value="" disabled>Bölüme Ata...</option>
           {tableSections.map(s => <option key={s} value={s}>{s}</option>)}
         </select>
         <button
           onClick={() => {
              const sel = (document.getElementById('bulkSectionAssignSelect') as HTMLSelectElement).value;
              if (!sel) return;
              const updated = tables.map(t => selectedTableLabels.includes(t.label) ? { ...t, section: sel } : t);
              updateAndSave(updated);
              setSelectedTableLabels([]);
              showToast(`${selectedTableLabels.length} masa "${sel}" bölümüne atandı.`, "success");
           }}
           className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
         >
           Uygula
         </button>
         <div className="w-px h-5 bg-gray-600 mx-1"></div>
         <button
           onClick={() => {
              if (confirm(`Seçili ${selectedTableLabels.length} masayı silmek istediğinize emin misiniz?`)) {
                const updated = tables.filter(t => !selectedTableLabels.includes(t.label));
                updateAndSave(updated, updated.length);
                setSelectedTableLabels([]);
              }
           }}
           className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition"
         >
           Seçilileri Sil
         </button>
       </div>
    </div>
  )}

 {/* Group by section */}
 {(() => {
 const sections =
 tableSections.length > 0 ? [...tableSections, ""] : [""];
 return sections.map((sec) => {
 const tablesInSection = tables
 .map((t, idx) => ({ ...t, _idx: idx }))
 .filter((t) => t.section === sec);
 if (tablesInSection.length === 0 && sec !== "") return null;
 return (
 <div key={sec || "__nosection"} className="mb-4">
 {sec && (
 <div className="flex items-center gap-2 mb-2">
 <span className="text-amber-400 text-sm font-bold">{sec}</span>
 <span className="text-muted-foreground/80 text-xs">
 ({tablesInSection.length} {t("masa")})
 </span>
 </div>
 )}
 {!sec && tableSections.length > 0 && tablesInSection.length > 0 && (
  <div className="flex items-center gap-2 mb-2 p-2 bg-red-500/10 rounded-lg border border-red-500/30">
  <span className="text-red-400 text-sm font-bold">
  ⚠️ {t("bolumAtanmamis")}
  </span>
  <span className="text-muted-foreground/80 text-xs">
  ({tablesInSection.length} {t("masa")})
  </span>
  </div>
  )}
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
 {tablesInSection.map((table) => (
  <div
  key={table._idx}
  onClick={() => {
     if (selectedTableLabels.includes(table.label)) {
        setSelectedTableLabels(prev => prev.filter(l => l !== table.label));
     } else {
        setSelectedTableLabels(prev => [...prev, table.label]);
     }
  }}
  className={`cursor-pointer rounded-lg border p-3 flex flex-col gap-2 transition ${selectedTableLabels.includes(table.label) ? 'bg-amber-500/10 border-amber-500' : 'bg-gray-800 border-gray-700 hover:border-amber-500/50'}`}
  >
  <div className="flex items-center gap-2">
  <input 
      type="checkbox"
      title={`Masa ${table.label} Seçimi`}
      aria-label={`Masa ${table.label} Seçimi`}
      checked={selectedTableLabels.includes(table.label)}
      readOnly
      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500 flex-shrink-0"
  />
  <span className="text-muted-foreground/80 text-xs font-bold leading-none mt-1 items-center flex">M</span>
  <input
  type="text"
  value={table.label}
  onClick={e => e.stopPropagation()}
  onChange={(e) => {
  const updated = [...tables];
  updated[table._idx] = {
  ...updated[table._idx],
  label: e.target.value,
  };
  setTables(updated);
  }}
  className="w-full bg-gray-700 text-white text-center px-1 py-1 rounded border border-gray-600 focus:border-amber-500 focus:outline-none text-sm font-bold"
  placeholder="#"
  />
  </div>
  {tableSections.length > 0 && (
  <select
  title="Masa Bölümü"
  value={table.section || ""}
  onChange={(e) => {
  const updated = [...tables];
  updated[table._idx] = {
  ...updated[table._idx],
  section: e.target.value,
  };
  setTables(updated);
  }}
  className={`w-full bg-gray-700 text-gray-300 px-2 py-1 rounded border focus:outline-none text-xs ${!table.section ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-gray-600 focus:border-amber-500'}`}
  >
  <option value="" disabled>Bölüm Seçiniz!</option>
  {tableSections.map((s) => (
  <option key={s} value={s}>
  {s}
  </option>
  ))}
  </select>
  )}
  <button
  onClick={(e) => {
  e.stopPropagation();
  const updated = tables.filter((_, i) => i !== table._idx);
  updateAndSave(updated, updated.length);
  }}
  className="mt-1 text-gray-500 hover:text-red-400 text-xs transition self-end bg-gray-800/50 hover:bg-gray-700 px-2 py-1 rounded"
  >
  {t("sil")}
  </button>
  </div>
 ))}
 </div>
 </div>
 );
 });
 })()}
 </div>
 )}

 {/* Empty state */}
 {tables.length === 0 && (
 <div className="bg-gray-800/50 rounded-xl p-8 border border-dashed border-gray-600 text-center flex flex-col items-center justify-center">
 <p className="text-white text-lg font-semibold mt-3">{t("henuzMasaTanimlanmadi")}</p>
 <p className="text-gray-400 text-sm mt-2 mb-6 max-w-md mx-auto">
   İşletmenizdeki masa planını oluşturmak için başlangıçta kaç masanız olduğunu girerek hızlıca sistemi kurabilirsiniz. Daha sonra bu masaları bölümlere ayırabilir veya yenilerini ekleyebilirsiniz.
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
    type="number"
    autoFocus
    min="1"
    max="200"
    value={quickSetupCount}
    onChange={(e) => setQuickSetupCount(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter" && quickSetupCount) {
        const count = parseInt(quickSetupCount, 10);
        if (isNaN(count) || count <= 0) return;
        const newTables = Array.from({ length: count }, (_, i) => ({
          label: String(i + 1),
          section: "",
          sortOrder: i,
        }));
        updateAndSave(newTables, count);
        setMaxReservationTables(count);
        showToast(`${count} adet masa basariyla olusturuldu!`, "success");
        setQuickSetupCount("");
        setShowQuickSetup(false);
      } else if (e.key === "Escape") {
        setQuickSetupCount("");
        setShowQuickSetup(false);
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
        label: String(i + 1),
        section: "",
        sortOrder: i,
      }));
      updateAndSave(newTables, count);
      setMaxReservationTables(count);
      showToast(`${count} adet masa basariyla olusturuldu!`, "success");
      setQuickSetupCount("");
      setShowQuickSetup(false);
    }}
    className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition text-base"
  >
    Olustur
  </button>
  <button
    onClick={() => { setQuickSetupCount(""); setShowQuickSetup(false); }}
    className="px-3 py-2.5 text-gray-400 hover:text-white transition text-base"
  >
    Iptal
  </button>
  </div>
  )}
 </div>
 )}
 </div>

 {/* QR Code Grid */}
 {tables.length > 0 && (
 <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
 <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
 <h2 className="text-lg font-bold text-white flex items-center gap-2">
 {t("masaQrKodlari")}
 <span className="text-sm font-normal text-gray-400">
 -- {tables.length} {t("masa")}
 </span>
 </h2>
 <div className="flex items-center gap-2 flex-wrap">
 <button
 onClick={async () => {
 const { downloadAllTableCardsAsSinglePDF } = await import(
 "@/utils/tableCardPdfGenerator"
 );
 await downloadAllTableCardsAsSinglePDF(
 tables,
 businessId,
 businessName || t("isletme_fallback"),
 country
 );
 }}
 className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
 >
 {t("pdfKartTek")}
 </button>
 <button
 onClick={async () => {
 const { downloadAllTableCardPDFs } = await import(
 "@/utils/tableCardPdfGenerator"
 );
 await downloadAllTableCardPDFs(
 tables,
 businessId,
 businessName || t("isletme_fallback"),
 country
 );
 }}
 className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
 >
 {t("pdfKartlarAyri")}
 </button>
 <button
 onClick={() => {
 for (const table of tables) {
 const tableQrTarget = `${qrBaseUrl}/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
 const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableQrTarget)}`;
 const link = document.createElement("a");
 link.href = qrUrl;
 link.download = `${t("masa_prefix")}_${table.label}_QR.png`;
 link.target = "_blank";
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 }
 }}
 className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
 >
 {t("qr_png")}
 </button>
 </div>
 </div>

 {/* Compact grid */}
 <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
 {tables.map((table, idx) => {
 const qrData = `${qrBaseUrl}/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
 const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
 qrData
 )}`;
 return (
 <div key={idx} className="flex flex-col gap-1">
 <button
 onClick={async () => {
 const { downloadTableCardPDF } = await import(
 "@/utils/tableCardPdfGenerator"
 );
 await downloadTableCardPDF(
 table.label,
 businessId,
 businessName || t("isletme_fallback"),
 country
 );
 }}
 className="bg-gray-800 rounded-lg border border-gray-700 p-2 flex flex-col items-center gap-1 hover:border-red-500 hover:bg-gray-700/50 transition cursor-pointer group"
 title={t("masaKartiIndir", { label: table.label })}
 >
 <div className="w-full aspect-square bg-background rounded flex items-center justify-center overflow-hidden">
 <img
 src={qrImageUrl}
 alt={`${t("masa_prefix")} ${table.label}`}
 className="w-full h-full object-contain"
 loading="lazy"
 />
 </div>
 <span className="text-xs font-bold text-gray-300 group-hover:text-red-400 transition">
 M{table.label}
 {table.section && (
 <span className="text-muted-foreground/80 font-normal ml-0.5 text-[10px]">
 -- {table.section}
 </span>
 )}
 </span>
 </button>
 </div>
 );
 })}
 </div>
 <p className="text-xs text-muted-foreground/80 mt-3">
 {t("masaKartiInfo")}
 </p>
 </div>
 )}
 </div>
 );
}
