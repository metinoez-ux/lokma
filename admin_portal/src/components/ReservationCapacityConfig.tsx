"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTranslations } from "next-intl";
import { normalizeTimeString } from "@/utils/timeUtils";

interface DiningDurationConfig {
  partySize1to2: number;
  partySize3to4: number;
  partySize5to6: number;
  partySize7plus: number;
}

interface WeeklyAvailability {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

interface ReservationConfig {
  reservationEnabled: boolean;
  totalSeats: number;
  slotDurationMinutes: number;
  maxPartySize: number;
  minPartySize: number;
  diningDuration: DiningDurationConfig;
  cleaningTimeMinutes: number;
  reservationStartTime: string;
  reservationEndTime: string;
  weeklyAvailability: WeeklyAvailability;
  maxDailyReservations: number;
  autoConfirmUpTo: number;
  minAdvanceHours: number;
  bufferMinutes: number;
}

interface BlockedSlot {
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

interface ReservationCapacityConfigProps {
  businessId: string;
}

const DEFAULT_WEEKLY: WeeklyAvailability = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: true,
  sunday: true,
};

const DEFAULT_CONFIG: ReservationConfig = {
  reservationEnabled: true,
  totalSeats: 0,
  slotDurationMinutes: 30,
  maxPartySize: 10,
  minPartySize: 1,
  diningDuration: {
    partySize1to2: 60,
    partySize3to4: 90,
    partySize5to6: 120,
    partySize7plus: 150,
  },
  cleaningTimeMinutes: 15,
  reservationStartTime: "11:00",
  reservationEndTime: "22:00",
  weeklyAvailability: { ...DEFAULT_WEEKLY },
  maxDailyReservations: 0,
  autoConfirmUpTo: 0,
  minAdvanceHours: 2,
  bufferMinutes: 0,
};

export default function ReservationCapacityConfig({
  businessId,
}: ReservationCapacityConfigProps) {
  const t = useTranslations("AdminBusinessDetail");
  const [config, setConfig] = useState<ReservationConfig>(DEFAULT_CONFIG);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newBlock, setNewBlock] = useState<BlockedSlot>({
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
  });

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load config from Firestore
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const bizDoc = await getDoc(doc(db, "businesses", businessId));
      if (bizDoc.exists()) {
        const data = bizDoc.data();
        const saved = data.reservationConfig;
        if (saved) {
          setConfig({
            reservationEnabled:
              saved.reservationEnabled ?? DEFAULT_CONFIG.reservationEnabled,
            totalSeats:
              saved.totalSeats ??
              data.tableCapacity ??
              DEFAULT_CONFIG.totalSeats,
            slotDurationMinutes:
              saved.slotDurationMinutes ??
              DEFAULT_CONFIG.slotDurationMinutes,
            maxPartySize:
              saved.maxPartySize ?? DEFAULT_CONFIG.maxPartySize,
            minPartySize:
              saved.minPartySize ?? DEFAULT_CONFIG.minPartySize,
            diningDuration: {
              partySize1to2:
                saved.diningDuration?.partySize1to2 ??
                DEFAULT_CONFIG.diningDuration.partySize1to2,
              partySize3to4:
                saved.diningDuration?.partySize3to4 ??
                DEFAULT_CONFIG.diningDuration.partySize3to4,
              partySize5to6:
                saved.diningDuration?.partySize5to6 ??
                DEFAULT_CONFIG.diningDuration.partySize5to6,
              partySize7plus:
                saved.diningDuration?.partySize7plus ??
                DEFAULT_CONFIG.diningDuration.partySize7plus,
            },
            cleaningTimeMinutes:
              saved.cleaningTimeMinutes ?? DEFAULT_CONFIG.cleaningTimeMinutes,
            reservationStartTime:
              normalizeTimeString(saved.reservationStartTime) || DEFAULT_CONFIG.reservationStartTime,
            reservationEndTime:
              normalizeTimeString(saved.reservationEndTime) || DEFAULT_CONFIG.reservationEndTime,
            weeklyAvailability: {
              monday: saved.weeklyAvailability?.monday ?? DEFAULT_WEEKLY.monday,
              tuesday: saved.weeklyAvailability?.tuesday ?? DEFAULT_WEEKLY.tuesday,
              wednesday: saved.weeklyAvailability?.wednesday ?? DEFAULT_WEEKLY.wednesday,
              thursday: saved.weeklyAvailability?.thursday ?? DEFAULT_WEEKLY.thursday,
              friday: saved.weeklyAvailability?.friday ?? DEFAULT_WEEKLY.friday,
              saturday: saved.weeklyAvailability?.saturday ?? DEFAULT_WEEKLY.saturday,
              sunday: saved.weeklyAvailability?.sunday ?? DEFAULT_WEEKLY.sunday,
            },
            maxDailyReservations:
              saved.maxDailyReservations ?? DEFAULT_CONFIG.maxDailyReservations,
            autoConfirmUpTo:
              saved.autoConfirmUpTo ?? DEFAULT_CONFIG.autoConfirmUpTo,
            minAdvanceHours:
              saved.minAdvanceHours ?? DEFAULT_CONFIG.minAdvanceHours,
            bufferMinutes:
              saved.bufferMinutes ?? DEFAULT_CONFIG.bufferMinutes,
          });
        } else {
          // Fallback: use existing tableCapacity if available
          setConfig({
            ...DEFAULT_CONFIG,
            totalSeats: data.tableCapacity || 0,
          });
        }
        // Normalize blocked slot times on read
        const savedSlots = saved?.blockedSlots || [];
        setBlockedSlots(savedSlots.map((slot: BlockedSlot) => ({
          ...slot,
          startTime: normalizeTimeString(slot.startTime) || slot.startTime,
          endTime: normalizeTimeString(slot.endTime) || slot.endTime,
        })));
      }
    } catch (err) {
      console.error("Error loading reservation config:", err);
      showToast(t("hata_olustu"), "error");
    } finally {
      setLoading(false);
    }
  }, [businessId, t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Save config to Firestore
  const saveConfig = async () => {
    setSaving(true);
    try {
      const configData = {
        ...config,
        // Normalize reservation times before save
        reservationStartTime: normalizeTimeString(config.reservationStartTime) || config.reservationStartTime,
        reservationEndTime: normalizeTimeString(config.reservationEndTime) || config.reservationEndTime,
        blockedSlots: blockedSlots.map(slot => ({
          ...slot,
          startTime: normalizeTimeString(slot.startTime) || slot.startTime,
          endTime: normalizeTimeString(slot.endTime) || slot.endTime,
        })),
      };
      await updateDoc(doc(db, "businesses", businessId), {
        reservationConfig: configData,
        tableCapacity: config.totalSeats, // sync with existing field
        updatedAt: Timestamp.now(),
      });
      showToast(t("rc_kaydedildi"), "success");
    } catch (err) {
      console.error("Error saving reservation config:", err);
      showToast(t("hata_olustu"), "error");
    } finally {
      setSaving(false);
    }
  };

  const addBlockedSlot = () => {
    if (!newBlock.date || !newBlock.startTime || !newBlock.endTime) {
      showToast(t("rc_blok_bos_alan"), "error");
      return;
    }
    setBlockedSlots((prev) => [...prev, { ...newBlock }]);
    setNewBlock({ date: "", startTime: "", endTime: "", reason: "" });
    setShowBlockForm(false);
  };

  const removeBlockedSlot = (idx: number) => {
    setBlockedSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculate estimated daily capacity using actual reservation hours
  const calcOpenHours = (() => {
    const [sh, sm] = config.reservationStartTime.split(":").map(Number);
    const [eh, em] = config.reservationEndTime.split(":").map(Number);
    if (isNaN(sh) || isNaN(eh)) return 12;
    return Math.max(0, (eh + em / 60) - (sh + sm / 60));
  })();
  const effectiveSlotMinutes = config.slotDurationMinutes + config.cleaningTimeMinutes + config.bufferMinutes;
  const slotsPerDay = effectiveSlotMinutes > 0 ? (calcOpenHours * 60) / effectiveSlotMinutes : 0;
  const avgDiningSlots = Math.ceil(
    ((config.diningDuration.partySize1to2 +
      config.diningDuration.partySize3to4) /
      2 /
      effectiveSlotMinutes)
  );
  const turnsPerDay =
    avgDiningSlots > 0 ? Math.floor(slotsPerDay / avgDiningSlots) : 0;
  const estimatedDailyCapacity = turnsPerDay * config.totalSeats;

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">
            {t("rc_baslik")}
          </h3>
          <p className="text-sm text-gray-400">{t("rc_aciklama")}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Enable/Disable Toggle */}
          <button
            onClick={() =>
              setConfig((p) => ({
                ...p,
                reservationEnabled: !p.reservationEnabled,
              }))
            }
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              config.reservationEnabled
                ? "bg-green-600/20 text-green-400 border border-green-500/30"
                : "bg-red-600/20 text-red-400 border border-red-500/30"
            }`}
          >
            {config.reservationEnabled
              ? t("rc_aktif")
              : t("rc_deaktif")}
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
          >
            {saving ? t("rc_kaydediliyor") : t("rc_kaydet")}
          </button>
        </div>
      </div>

      {/* Estimated Capacity Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {config.totalSeats}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {t("rc_toplam_sandalye")}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-2xl font-bold text-teal-400">
            {config.slotDurationMinutes} dk
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {t("rc_slot_suresi")}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-2xl font-bold text-blue-400">
            ~{turnsPerDay}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {t("rc_devir_sayisi")}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-2xl font-bold text-green-400">
            ~{estimatedDailyCapacity}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {t("rc_gunluk_kapasite")}
          </p>
        </div>
      </div>

      {/* Core Settings */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <h4 className="text-white font-bold text-sm mb-4">
          {t("rc_temel_ayarlar")}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-gray-400 text-xs block mb-1">
              {t("rc_toplam_sandalye")}
            </label>
            <input
              type="number"
              value={config.totalSeats}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  totalSeats: Math.max(0, parseInt(e.target.value) || 0),
                }))
              }
              min="0"
              max="500"
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-lg font-medium"
              placeholder="20"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">
              {t("rc_slot_suresi")} (dk)
            </label>
            <select
              value={config.slotDurationMinutes}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  slotDurationMinutes: parseInt(e.target.value),
                }))
              }
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-lg font-medium"
            >
              <option value={15}>15 dk</option>
              <option value={30}>30 dk</option>
              <option value={45}>45 dk</option>
              <option value={60}>60 dk</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">
              {t("rc_min_parti")}
            </label>
            <input
              type="number"
              value={config.minPartySize}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  minPartySize: Math.max(1, parseInt(e.target.value) || 1),
                }))
              }
              min="1"
              max="20"
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-lg font-medium"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">
              {t("rc_max_parti")}
            </label>
            <input
              type="number"
              value={config.maxPartySize}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  maxPartySize: Math.max(1, parseInt(e.target.value) || 10),
                }))
              }
              min="1"
              max="50"
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-lg font-medium"
            />
          </div>
        </div>
      </div>

      {/* Dining Duration per Party Size */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <h4 className="text-white font-bold text-sm mb-2">
          {t("rc_oturma_suresi")}
        </h4>
        <p className="text-gray-500 text-xs mb-4">
          {t("rc_oturma_suresi_aciklama")}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-gray-400 text-xs block mb-1">
              1-2 {t("rc_kisi")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.diningDuration.partySize1to2}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    diningDuration: {
                      ...p.diningDuration,
                      partySize1to2: Math.max(
                        15,
                        parseInt(e.target.value) || 60
                      ),
                    },
                  }))
                }
                min="15"
                step="15"
                className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
              />
              <span className="text-gray-500 text-xs whitespace-nowrap">
                dk
              </span>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">
              3-4 {t("rc_kisi")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.diningDuration.partySize3to4}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    diningDuration: {
                      ...p.diningDuration,
                      partySize3to4: Math.max(
                        15,
                        parseInt(e.target.value) || 90
                      ),
                    },
                  }))
                }
                min="15"
                step="15"
                className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
              />
              <span className="text-gray-500 text-xs whitespace-nowrap">
                dk
              </span>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">
              5-6 {t("rc_kisi")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.diningDuration.partySize5to6}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    diningDuration: {
                      ...p.diningDuration,
                      partySize5to6: Math.max(
                        15,
                        parseInt(e.target.value) || 120
                      ),
                    },
                  }))
                }
                min="15"
                step="15"
                className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
              />
              <span className="text-gray-500 text-xs whitespace-nowrap">
                dk
              </span>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">
              7+ {t("rc_kisi")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.diningDuration.partySize7plus}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    diningDuration: {
                      ...p.diningDuration,
                      partySize7plus: Math.max(
                        15,
                        parseInt(e.target.value) || 150
                      ),
                    },
                  }))
                }
                min="15"
                step="15"
                className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
              />
              <span className="text-gray-500 text-xs whitespace-nowrap">
                dk
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Operational Settings */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-6 text-left"
        >
          <div>
            <h4 className="text-white font-bold text-sm">
              {t("rc_gelismis_ayarlar")}
            </h4>
            <p className="text-gray-500 text-xs mt-1">
              {t("rc_gelismis_ayarlar_aciklama")}
            </p>
          </div>
          <span className={`text-gray-400 transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
          </span>
        </button>

        {showAdvanced && (
          <div className="px-6 pb-6 space-y-5">
            {/* Cleaning Time & Buffer */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  {t("rc_temizlik_suresi")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.cleaningTimeMinutes}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        cleaningTimeMinutes: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    min="0"
                    max="120"
                    className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
                  />
                  <span className="text-gray-500 text-xs whitespace-nowrap">dk</span>
                </div>
                <p className="text-gray-600 text-[10px] mt-1">{t("rc_temizlik_suresi_aciklama")}</p>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  {t("rc_buffer_suresi")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.bufferMinutes}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        bufferMinutes: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    min="0"
                    max="120"
                    className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
                  />
                  <span className="text-gray-500 text-xs whitespace-nowrap">dk</span>
                </div>
                <p className="text-gray-600 text-[10px] mt-1">{t("rc_buffer_suresi_aciklama")}</p>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  {t("rc_min_onceden")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.minAdvanceHours}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        minAdvanceHours: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    min="0"
                    max="168"
                    className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
                  />
                  <span className="text-gray-500 text-xs whitespace-nowrap">{t("rc_saat")}</span>
                </div>
                <p className="text-gray-600 text-[10px] mt-1">{t("rc_min_onceden_aciklama")}</p>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  {t("rc_maks_gunluk")}
                </label>
                <input
                  type="number"
                  value={config.maxDailyReservations}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      maxDailyReservations: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  min="0"
                  max="999"
                  className="w-full bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
                  placeholder="0 = limitsiz"
                />
                <p className="text-gray-600 text-[10px] mt-1">{t("rc_maks_gunluk_aciklama")}</p>
              </div>
            </div>

            {/* Reservation Hours */}
            <div>
              <label className="text-gray-400 text-xs block mb-2">
                {t("rc_kabul_saatleri")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={config.reservationStartTime}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, reservationStartTime: e.target.value }))
                  }
                  className="bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
                />
                <span className="text-gray-500 text-sm">-</span>
                <input
                  type="time"
                  value={config.reservationEndTime}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, reservationEndTime: e.target.value }))
                  }
                  className="bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
                />
              </div>
              <p className="text-gray-600 text-[10px] mt-1">{t("rc_kabul_saatleri_aciklama")}</p>
            </div>

            {/* Auto-Confirm */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">
                {t("rc_otomatik_onay")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.autoConfirmUpTo}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      autoConfirmUpTo: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  min="0"
                  max="50"
                  className="w-32 bg-gray-700 text-white px-3 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none font-medium"
                  placeholder="0 = devre disi"
                />
                <span className="text-gray-500 text-xs">{t("rc_kisi")}</span>
              </div>
              <p className="text-gray-600 text-[10px] mt-1">{t("rc_otomatik_onay_aciklama")}</p>
            </div>

            {/* Weekly Availability */}
            <div>
              <label className="text-gray-400 text-xs block mb-2">
                {t("rc_haftalik_musaitlik")}
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  ["monday", t("rc_gun_pzt")],
                  ["tuesday", t("rc_gun_sal")],
                  ["wednesday", t("rc_gun_car")],
                  ["thursday", t("rc_gun_per")],
                  ["friday", t("rc_gun_cum")],
                  ["saturday", t("rc_gun_cmt")],
                  ["sunday", t("rc_gun_paz")],
                ] as [keyof WeeklyAvailability, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() =>
                      setConfig((p) => ({
                        ...p,
                        weeklyAvailability: {
                          ...p.weeklyAvailability,
                          [key]: !p.weeklyAvailability[key],
                        },
                      }))
                    }
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      config.weeklyAvailability[key]
                        ? "bg-green-600/20 text-green-400 border border-green-500/30"
                        : "bg-red-600/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-gray-600 text-[10px] mt-1">{t("rc_haftalik_musaitlik_aciklama")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Blocked Time Slots */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-white font-bold text-sm">
              {t("rc_bloklu_slotlar")}
            </h4>
            <p className="text-gray-500 text-xs mt-1">
              {t("rc_bloklu_slotlar_aciklama")}
            </p>
          </div>
          <button
            onClick={() => setShowBlockForm(!showBlockForm)}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition"
          >
            {showBlockForm ? t("rc_iptal") : t("rc_blok_ekle")}
          </button>
        </div>

        {/* Add Block Form */}
        {showBlockForm && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-600 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  {t("rc_tarih")}
                </label>
                <input
                  type="date"
                  value={newBlock.date}
                  onChange={(e) =>
                    setNewBlock((p) => ({ ...p, date: e.target.value }))
                  }
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  {t("rc_baslangic")}
                </label>
                <input
                  type="time"
                  value={newBlock.startTime}
                  onChange={(e) =>
                    setNewBlock((p) => ({
                      ...p,
                      startTime: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  {t("rc_bitis")}
                </label>
                <input
                  type="time"
                  value={newBlock.endTime}
                  onChange={(e) =>
                    setNewBlock((p) => ({
                      ...p,
                      endTime: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  {t("rc_neden")}
                </label>
                <input
                  type="text"
                  value={newBlock.reason}
                  onChange={(e) =>
                    setNewBlock((p) => ({
                      ...p,
                      reason: e.target.value,
                    }))
                  }
                  placeholder={t("rc_neden_placeholder")}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={addBlockedSlot}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
              >
                {t("rc_blok_ekle")}
              </button>
            </div>
          </div>
        )}

        {/* Blocked Slots List */}
        {blockedSlots.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">{t("rc_blok_yok")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blockedSlots.map((slot, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3 border border-gray-700"
              >
                <div className="flex items-center gap-4">
                  <span className="text-white text-sm font-medium">
                    {slot.date}
                  </span>
                  <span className="text-amber-400 text-sm">
                    {slot.startTime} - {slot.endTime}
                  </span>
                  {slot.reason && (
                    <span className="text-gray-400 text-xs">
                      {slot.reason}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeBlockedSlot(idx)}
                  className="text-red-400 hover:text-red-300 text-xs transition"
                >
                  {t("rc_kaldir")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-4">
        <h5 className="text-blue-300 font-bold text-xs mb-2">
          {t("rc_nasil_calisir")}
        </h5>
        <ul className="text-gray-400 text-xs space-y-1">
          <li>
            {t("rc_aciklama_1")}
          </li>
          <li>
            {t("rc_aciklama_2")}
          </li>
          <li>
            {t("rc_aciklama_3")}
          </li>
          <li>
            {t("rc_aciklama_4")}
          </li>
        </ul>
      </div>
    </div>
  );
}
