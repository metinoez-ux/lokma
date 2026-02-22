'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

interface ShiftRecord {
    id: string;
    staffId: string;
    staffName: string;
    date: string;
    status: string;
    startedAt: Date | null;
    endedAt: Date | null;
    totalMinutes: number;
    pauseMinutes: number;
    assignedTables: number[];
    isDeliveryDriver: boolean;
    isOtherRole?: boolean;
}

export default function StaffShiftsPage() {
    
  const t = useTranslations('AdminStaffshifts');
const { admin, loading: adminLoading } = useAdmin();
    const router = useRouter();

    const [shifts, setShifts] = useState<ShiftRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [exporting, setExporting] = useState(false);

    const businessId = admin?.butcherId;

    useEffect(() => {
        if (!adminLoading && businessId) {
            loadShifts();
        }
    }, [adminLoading, businessId, selectedMonth]);

    const loadShifts = async () => {
        if (!businessId) return;
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const endStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

            const q = query(
                collection(db, 'businesses', businessId, 'shifts'),
                where('date', '>=', startStr),
                where('date', '<=', endStr),
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);
            const records: ShiftRecord[] = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    staffId: d.staffId || '',
                    staffName: d.staffName || 'Bilinmiyor',
                    date: d.date || '',
                    status: d.status || '',
                    startedAt: d.startedAt?.toDate ? d.startedAt.toDate() : null,
                    endedAt: d.endedAt?.toDate ? d.endedAt.toDate() : null,
                    totalMinutes: d.totalMinutes || 0,
                    pauseMinutes: d.pauseMinutes || 0,
                    assignedTables: d.assignedTables || [],
                    isDeliveryDriver: d.isDeliveryDriver || false,
                    isOtherRole: d.isOtherRole || false,
                };
            });

            setShifts(records);
        } catch (error) {
            console.error('Shift loading error:', error);
            toast.error(t('vardiya_verileri_yuklenirken_hata_olustu'));
        } finally {
            setLoading(false);
        }
    };

    // Group shifts by staff
    const staffSummary = useMemo(() => {
        const map = new Map<string, { name: string; totalMinutes: number; pauseMinutes: number; shiftCount: number; driverShifts: number }>();
        shifts.forEach(s => {
            const existing = map.get(s.staffId) || { name: s.staffName, totalMinutes: 0, pauseMinutes: 0, shiftCount: 0, driverShifts: 0 };
            existing.totalMinutes += s.totalMinutes;
            existing.pauseMinutes += s.pauseMinutes;
            existing.shiftCount += 1;
            if (s.isDeliveryDriver) existing.driverShifts += 1;
            map.set(s.staffId, existing);
        });
        return Array.from(map.entries()).map(([id, data]) => ({ staffId: id, ...data }));
    }, [shifts]);

    const formatMinutes = (m: number) => {
        const h = Math.floor(m / 60);
        const min = m % 60;
        return `${h}s ${min}dk`;
    };

    const formatDate = (d: Date | null) => {
        if (!d) return '-';
        return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const monthLabel = useMemo(() => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const months = ['Ocak', t('subat'), 'Mart', 'Nisan', t('mayis'), 'Haziran', 'Temmuz', t('agustos'), t('eylul'), 'Ekim', t('kasim'), t('aralik')];
        return `${months[m - 1]} ${y}`;
    }, [selectedMonth]);

    // ─── Export Functions ─────────────────────────────────────────
    const exportCSV = () => {
        setExporting(true);
        try {
            const headers = ['Personel', t('tarih'), t('baslangic'), t('bitis'), t('toplam_dk'), 'Mola (dk)', 'Net (dk)', 'Masalar', 'Kurye', t('durum')];
            const rows = shifts.map(s => [
                s.staffName,
                s.date,
                s.startedAt ? s.startedAt.toLocaleString('tr-TR') : '-',
                s.endedAt ? s.endedAt.toLocaleString('tr-TR') : '-',
                String(s.totalMinutes),
                String(s.pauseMinutes),
                String(s.totalMinutes - s.pauseMinutes),
                s.assignedTables.join(', ') || '-',
                s.isDeliveryDriver ? 'Kurye' : (s.isOtherRole ? 'Diğer' : 'Servis'),
                s.status,
            ]);

            // Add summary section
            rows.push([]);
            rows.push([t('ozet')]);
            rows.push(['Personel', t('toplam_vardiya'), t('toplam_sure'), t('toplam_mola'), t('net_calisma'), t('kurye_vardiya')]);
            staffSummary.forEach(s => {
                rows.push([
                    s.name,
                    String(s.shiftCount),
                    formatMinutes(s.totalMinutes),
                    formatMinutes(s.pauseMinutes),
                    formatMinutes(s.totalMinutes - s.pauseMinutes),
                    String(s.driverShifts),
                ]);
            });

            const csvContent = [headers.join(';'), ...rows.map(r => (r as string[]).join(';'))].join('\n');
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vardiya_raporu_${selectedMonth}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('CSV raporu indirildi.');
        } catch (error) {
            toast.error(t('export_hatasi'));
        } finally {
            setExporting(false);
        }
    };

    const exportPDF = () => {
        setExporting(true);
        try {
            // Build a printable HTML page and trigger print (browser PDF)
            const printContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Vardiya Raporu - ${monthLabel}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 30px; color: #1a1a1a; font-size: 11px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 20px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; border-bottom: 2px solid #d1d5db; }
        td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        .summary-table th { background: #1e3a5f; color: white; }
        .summary-table td { font-weight: 600; }
        .section-title { font-size: 14px; font-weight: bold; margin: 25px 0 10px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 5px; }
        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 9px; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 600; }
        .badge-active { background: #d1fae5; color: #065f46; }
        .badge-ended { background: #e5e7eb; color: #374151; }
        .badge-driver { background: #dbeafe; color: #1e40af; }
        .badge-other { background: #f3e8ff; color: #9333ea; }
        @media print { body { padding: 15px; } }
    </style>
</head>
<body>
    <h1>📋 Vardiya Raporu</h1>
    <p class="subtitle">${monthLabel} — Toplam ${shifts.length} vardiya kaydı</p>

    <div class="section-title">Personel Özeti</div>
    <table class="summary-table">
        <thead><tr><th>Personel</th><th>Vardiya</th><th>Toplam</th><th>Mola</th><th>Net Çalışma</th><th>Kurye</th></tr></thead>
        <tbody>
            ${staffSummary.map(s => `<tr>
                <td>${s.name}</td>
                <td>${s.shiftCount}</td>
                <td>${formatMinutes(s.totalMinutes)}</td>
                <td>${formatMinutes(s.pauseMinutes)}</td>
                <td>${formatMinutes(s.totalMinutes - s.pauseMinutes)}</td>
                <td>${s.driverShifts > 0 ? `<span class="badge badge-driver">${s.driverShifts} kurye</span>` : '-'}</td>
            </tr>`).join('')}
        </tbody>
    </table>

    <div class="section-title">Detaylı Vardiya Kayıtları</div>
    <table>
        <thead><tr><th>Personel</th><th>Tarih</th><th>Başlangıç</th><th>Bitiş</th><th>Toplam</th><th>Mola</th><th>Net</th><th>Masalar</th><th>Kurye</th><th>Durum</th></tr></thead>
        <tbody>
            ${shifts.map(s => `<tr>
                <td>${s.staffName}</td>
                <td>${s.date}</td>
                <td>${formatDate(s.startedAt)}</td>
                <td>${formatDate(s.endedAt)}</td>
                <td>${formatMinutes(s.totalMinutes)}</td>
                <td>${formatMinutes(s.pauseMinutes)}</td>
                <td>${formatMinutes(s.totalMinutes - s.pauseMinutes)}</td>
                <td>${s.assignedTables.length > 0 ? s.assignedTables.join(', ') : '-'}</td>
                <td>${s.isDeliveryDriver ? t('span_class_badge_badge_driver_kurye_span') : (s.isOtherRole ? t('span_class_badge_badge_other_diger_span') : '-')}</td>
                <td><span class="badge ${s.status === 'active' ? 'badge-active' : 'badge-ended'}">${s.status === 'active' ? t('aktif') : t('tamamlandi')}</span></td>
            </tr>`).join('')}
        </tbody>
    </table>

    <div class="footer">
        LOKMA — Vardiya Raporu oluşturulma tarihi: ${new Date().toLocaleString('tr-TR')}
    </div>
</body>
</html>`;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(printContent);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.print();
                }, 500);
                toast.success(t('pdf_raporu_hazirlandi'));
            }
        } catch (error) {
            toast.error(t('pdf_export_hatasi'));
        } finally {
            setExporting(false);
        }
    };

    if (adminLoading) return <div className="p-8 text-white">{t('yukleniyor')}</div>;
    if (!admin?.butcherId) return <div className="p-8 text-white">{t('bu_sayfaya_erisim_yetkiniz_yok')}</div>;

    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-white">
            <div className="w-full max-w-6xl mx-auto px-6 py-8">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/admin/dashboard')}
                    className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors group"
                >
                    <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
                    {t('panela_geri_don')}
                </button>

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            {t('calisma_saatleri')}
                        </h1>
                        <p className="text-gray-400 mt-1">{t('personel_vardiya_takibi_ve_raporlama')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Month Selector */}
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                        />
                        {/* Export Buttons */}
                        <button
                            onClick={exportCSV}
                            disabled={exporting || shifts.length === 0}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-green-500/10"
                        >
                            📊 Excel (CSV)
                        </button>
                        <button
                            onClick={exportPDF}
                            disabled={exporting || shifts.length === 0}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-red-500/10"
                        >
                            📄 PDF
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">{t('toplam_vardiya')}</p>
                        <p className="text-3xl font-black text-white mt-1">{shifts.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">{t('personel_sayisi')}</p>
                        <p className="text-3xl font-black text-cyan-400 mt-1">{staffSummary.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">{t('toplam_calisma')}</p>
                        <p className="text-3xl font-black text-green-400 mt-1">
                            {formatMinutes(staffSummary.reduce((t, s) => t + s.totalMinutes, 0))}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">{t('toplam_mola')}</p>
                        <p className="text-3xl font-black text-amber-400 mt-1">
                            {formatMinutes(staffSummary.reduce((t, s) => t + s.pauseMinutes, 0))}
                        </p>
                    </div>
                </div>

                {/* Staff Summary Table */}
                {staffSummary.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span className="w-1 h-5 bg-cyan-500 rounded-full"></span>
                            {t('personel_ozeti')} {monthLabel}
                        </h2>
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Personel</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Vardiya</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('toplam')}</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Mola</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('net_calisma')}</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Kurye</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffSummary.map((s, i) => (
                                        <tr key={s.staffId} className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-800/50'}`}>
                                            <td className="px-5 py-3 font-medium text-white">{s.name}</td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-300">{s.shiftCount}</td>
                                            <td className="px-4 py-3 text-center text-sm text-green-400 font-bold">{formatMinutes(s.totalMinutes)}</td>
                                            <td className="px-4 py-3 text-center text-sm text-amber-400">{formatMinutes(s.pauseMinutes)}</td>
                                            <td className="px-4 py-3 text-center text-sm text-cyan-400 font-bold">{formatMinutes(s.totalMinutes - s.pauseMinutes)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {s.driverShifts > 0 ? (
                                                    <span className="bg-blue-900/40 text-blue-400 border border-blue-700/40 px-2 py-0.5 rounded-full text-xs font-medium">
                                                        🛵 {s.driverShifts}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600 text-xs">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Detailed Shifts Table */}
                <div>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
                        {t('detayli_vardiya_kayitlari')}
                    </h2>
                    {loading ? (
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-400">{t('yukleniyor')}</p>
                        </div>
                    ) : shifts.length === 0 ? (
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                            <p className="text-4xl mb-3">📭</p>
                            <p className="text-gray-400 text-lg font-medium">{monthLabel} {t('icin_kayit_bulunamadi')}</p>
                            <p className="text-gray-500 text-sm mt-1">{t('farkli_bir_ay_secmeyi_deneyin')}</p>
                        </div>
                    ) : (
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden overflow-x-auto">
                            <table className="w-full min-w-[900px]">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Personel</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">{t('tarih')}</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">{t('baslangic')}</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">{t('bitis')}</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">{t('toplam')}</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">Mola</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">Net</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">Masalar</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">Rol</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase">{t('durum')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shifts.map((s, i) => (
                                        <tr key={s.id} className={`border-b border-gray-700/30 hover:bg-gray-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-800/50'}`}>
                                            <td className="px-4 py-2.5 font-medium text-white text-sm">{s.staffName}</td>
                                            <td className="px-3 py-2.5 text-center text-xs text-gray-300 font-mono">{s.date}</td>
                                            <td className="px-3 py-2.5 text-center text-xs text-gray-300">{formatDate(s.startedAt)}</td>
                                            <td className="px-3 py-2.5 text-center text-xs text-gray-300">{formatDate(s.endedAt)}</td>
                                            <td className="px-3 py-2.5 text-center text-xs text-green-400 font-bold">{formatMinutes(s.totalMinutes)}</td>
                                            <td className="px-3 py-2.5 text-center text-xs text-amber-400">{formatMinutes(s.pauseMinutes)}</td>
                                            <td className="px-3 py-2.5 text-center text-xs text-cyan-400 font-bold">{formatMinutes(s.totalMinutes - s.pauseMinutes)}</td>
                                            <td className="px-3 py-2.5 text-center text-xs text-gray-400">
                                                {s.assignedTables.length > 0 ? s.assignedTables.join(', ') : '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                {s.isDeliveryDriver ? (
                                                    <span className="bg-blue-900/40 text-blue-400 border border-blue-700/40 px-2 py-0.5 rounded-full text-[10px] font-medium">{t('kurye')}</span>
                                                ) : s.isOtherRole ? (
                                                    <span className="bg-purple-900/40 text-purple-400 border border-purple-700/40 px-2 py-0.5 rounded-full text-[10px] font-medium">{t('diger')}</span>
                                                ) : (
                                                    <span className="bg-gray-700/40 text-gray-400 border border-gray-600/40 px-2 py-0.5 rounded-full text-[10px] font-medium">🍽 Servis</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === 'active'
                                                    ? 'bg-green-900/40 text-green-400 border border-green-700/40'
                                                    : 'bg-gray-700/40 text-gray-400 border border-gray-600/40'
                                                    }`}>
                                                    {s.status === 'active' ? t('aktif') : '✓ Bitti'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
