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

interface TableManagementPanelProps {
  businessId: string;
  businessName: string;
  country?: string;
}

export default function TableManagementPanel({
  businessId,
  businessName,
  country,
}: TableManagementPanelProps) {
  const t = useTranslations("AdminBusinessDetail");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tables, setTables] = useState<TableDef[]>([]);
  const [maxReservationTables, setMaxReservationTables] = useState(0);
  const [tableCapacity, setTableCapacity] = useState(0);
  const [tableSections, setTableSections] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load data from Firestore
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const bizDoc = await getDoc(doc(db, "businesses", businessId));
      if (bizDoc.exists()) {
        const d = bizDoc.data();
        setTables(d.tables || []);
        setMaxReservationTables(d.maxReservationTables || 0);
        setTableCapacity(d.tableCapacity || 0);
        setTableSections(d.tableSections || []);
      }
    } catch (e) {
      console.error("Error loading table data:", e);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save to Firestore
  const saveData = async (
    newTables: TableDef[],
    newMax: number,
    newCapacity: number,
    newSections: string[]
  ) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "businesses", businessId), {
        tables: newTables,
        maxReservationTables: newMax,
        tableCapacity: newCapacity,
        tableSections: newSections,
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
    newSections?: string[]
  ) => {
    const t2 = newTables ?? tables;
    const m = newMax ?? maxReservationTables;
    const c = newCapacity ?? tableCapacity;
    const s = newSections ?? tableSections;
    if (newTables !== undefined) setTables(t2);
    if (newMax !== undefined) setMaxReservationTables(m);
    if (newCapacity !== undefined) setTableCapacity(c);
    if (newSections !== undefined) setTableSections(s);
    saveData(t2, m, c, s);
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

        {/* Quick setup row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-gray-400 text-sm block mb-1">{t("toplam_masa_adedi")}</label>
            <input
              type="number"
              value={maxReservationTables}
              onChange={(e) => setMaxReservationTables(Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
              max="200"
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-lg font-medium"
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
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-lg font-medium"
              placeholder={t("or80")}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                const count = maxReservationTables || 0;
                if (count <= 0) return;
                const newTables = Array.from({ length: count }, (_, i) => ({
                  label: String(i + 1),
                  section: "",
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
                const newTable: TableDef = {
                  label: String(nextNum),
                  section: "",
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

        {/* Section management */}
        {tables.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-300">{t("bolumler")}</h3>
              <button
                onClick={() => {
                  const name = prompt(t("yeniBolumAdiOr1Kat"));
                  if (!name?.trim()) return;
                  if (tableSections.includes(name.trim())) {
                    showToast(t("buBolumZatenMevcut"), "error");
                    return;
                  }
                  const newSections = [...tableSections, name.trim()];
                  updateAndSave(undefined, undefined, undefined, newSections);
                }}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition"
              >
                {t("bolumEkle")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tableSections.length === 0 && (
                <span className="text-xs text-gray-500 italic">
                  {t("henuzBolumYokTumMasalarTek")}
                </span>
              )}
              {tableSections.map((section, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-gray-700 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-white">{section}</span>
                  <span className="text-gray-500 text-xs ml-1">
                    ({tables.filter((t) => t.section === section).length} {t("masa")})
                  </span>
                  <button
                    onClick={() => {
                      const updated = tables.map((t) =>
                        t.section === section ? { ...t, section: "" } : t
                      );
                      const newSections = tableSections.filter((_, i) => i !== idx);
                      updateAndSave(updated, undefined, undefined, newSections);
                    }}
                    className="ml-1 text-red-400 hover:text-red-300 transition text-xs"
                    title={t("bolumuSil")}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table list */}
        {tables.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">
                {t("masalar")} ({tables.length})
              </h3>
              <button
                onClick={() => updateAndSave(tables, maxReservationTables, tableCapacity, tableSections)}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-md transition"
              >
                {t("kaydet")}
              </button>
            </div>

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
                        <span className="text-gray-500 text-xs">
                          ({tablesInSection.length} {t("masa")})
                        </span>
                      </div>
                    )}
                    {!sec && tableSections.length > 0 && tablesInSection.length > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-400 text-sm font-bold">
                          {t("bolumAtanmamis")}
                        </span>
                        <span className="text-gray-500 text-xs">
                          ({tablesInSection.length} {t("masa")})
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {tablesInSection.map((table) => (
                        <div
                          key={table._idx}
                          className="bg-gray-800 rounded-lg border border-gray-700 p-3 flex flex-col gap-2 hover:border-amber-500/50 transition"
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 text-xs">M</span>
                            <input
                              type="text"
                              value={table.label}
                              onChange={(e) => {
                                const updated = [...tables];
                                updated[table._idx] = {
                                  ...updated[table._idx],
                                  label: e.target.value,
                                };
                                setTables(updated);
                              }}
                              className="w-full bg-gray-700 text-white text-center px-2 py-1 rounded border border-gray-600 focus:border-amber-500 focus:outline-none text-sm font-bold"
                              placeholder="#"
                            />
                          </div>
                          {tableSections.length > 0 && (
                            <select
                              value={table.section || ""}
                              onChange={(e) => {
                                const updated = [...tables];
                                updated[table._idx] = {
                                  ...updated[table._idx],
                                  section: e.target.value,
                                };
                                setTables(updated);
                              }}
                              className="w-full bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600 focus:border-amber-500 focus:outline-none text-xs"
                            >
                              <option value="">--</option>
                              {tableSections.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => {
                              const updated = tables.filter((_, i) => i !== table._idx);
                              updateAndSave(updated, updated.length);
                            }}
                            className="text-red-500/60 hover:text-red-400 text-xs transition"
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
          <div className="bg-gray-800/50 rounded-xl p-8 border border-dashed border-gray-600 text-center">
            <p className="text-white font-semibold mt-3">{t("henuzMasaTanimlanmadi")}</p>
            <p className="text-gray-400 text-sm mt-1">
              {t("yukaridanMasaSayisiniGirerekOtomatikOlusturun")}
            </p>
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
                    businessName || "Isletme",
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
                    businessName || "Isletme",
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
                    const tableQrTarget = `https://lokma.web.app/dinein/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableQrTarget)}`;
                    const link = document.createElement("a");
                    link.href = qrUrl;
                    link.download = `Masa_${table.label}_QR.png`;
                    link.target = "_blank";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                QR PNG
              </button>
            </div>
          </div>

          {/* Compact grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
            {tables.map((table, idx) => {
              const qrData = `https://lokma.web.app/dinein/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
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
                        businessName || "Isletme",
                        country
                      );
                    }}
                    className="bg-gray-800 rounded-lg border border-gray-700 p-2 flex flex-col items-center gap-1 hover:border-red-500 hover:bg-gray-700/50 transition cursor-pointer group"
                    title={t("masaKartiIndir", { label: table.label })}
                  >
                    <div className="w-full aspect-square bg-white rounded flex items-center justify-center overflow-hidden">
                      <img
                        src={qrImageUrl}
                        alt={`Masa ${table.label}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-300 group-hover:text-red-400 transition">
                      M{table.label}
                      {table.section && (
                        <span className="text-gray-500 font-normal ml-0.5 text-[10px]">
                          -- {table.section}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {t("masaKartiInfo")}
          </p>
        </div>
      )}
    </div>
  );
}
