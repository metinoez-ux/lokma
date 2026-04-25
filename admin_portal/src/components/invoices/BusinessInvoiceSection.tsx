'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/utils/currency';
import { Invoice, LOKMA_COMPANY_INFO } from '@/types';
import InvoicePreviewModal from '@/components/invoices/InvoicePreviewModal';

// Durum renkleri
const statusColors: Record<string, string> = {
  draft: 'bg-gray-600',
  pending: 'bg-yellow-600',
  paid: 'bg-green-600',
  failed: 'bg-red-600',
  cancelled: 'bg-gray-500',
  overdue: 'bg-amber-600',
  storno: 'bg-purple-600',
};

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  pending: 'Bekliyor',
  paid: 'Ödendi',
  failed: 'Başarısız',
  cancelled: 'İptal',
  overdue: 'Gecikmiş',
  storno: 'Storno',
};

type PeriodPreset = 'current_quarter' | 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'last_year' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom_range' | 'custom_day' | 'all';

export default function BusinessInvoiceSection({ invoices }: { invoices: Invoice[] }) {
  const t = useTranslations('AdminInvoices');
  
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [singleDay, setSingleDay] = useState<string>('');
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const getPresetDateRange = (preset: PeriodPreset): { from: Date; to: Date } | null => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    switch (preset) {
      case 'this_month': return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0, 23, 59, 59) };
      case 'last_month': return { from: new Date(year, month - 1, 1), to: new Date(year, month, 0, 23, 59, 59) };
      case 'current_quarter': {
        const qStart = Math.floor(month / 3) * 3;
        return { from: new Date(year, qStart, 1), to: new Date(year, qStart + 3, 0, 23, 59, 59) };
      }
      case 'q1': return { from: new Date(year, 0, 1), to: new Date(year, 3, 0, 23, 59, 59) };
      case 'q2': return { from: new Date(year, 3, 1), to: new Date(year, 6, 0, 23, 59, 59) };
      case 'q3': return { from: new Date(year, 6, 1), to: new Date(year, 9, 0, 23, 59, 59) };
      case 'q4': return { from: new Date(year, 9, 1), to: new Date(year, 12, 0, 23, 59, 59) };
      case 'last_3_months': return { from: new Date(year, month - 2, 1), to: new Date(year, month + 1, 0, 23, 59, 59) };
      case 'last_6_months': return { from: new Date(year, month - 5, 1), to: new Date(year, month + 1, 0, 23, 59, 59) };
      case 'this_year': return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59) };
      case 'last_year': return { from: new Date(year - 1, 0, 1), to: new Date(year - 1, 11, 31, 23, 59, 59) };
      case 'custom_range': if (dateFrom && dateTo) return { from: new Date(dateFrom), to: new Date(dateTo + 'T23:59:59') }; return null;
      case 'custom_day': if (singleDay) return { from: new Date(singleDay), to: new Date(singleDay + 'T23:59:59') }; return null;
      case 'all': default: return null;
    }
  };

  const getCurrentQuarterLabel = () => {
    const q = Math.floor(new Date().getMonth() / 3) + 1;
    return `Q${q} ${new Date().getFullYear()}`;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      if (filterStatus !== 'all' && invoice.status !== filterStatus) return false;
      const range = getPresetDateRange(periodPreset);
      if (range) {
        const invoiceDate = invoice.issueDate instanceof Date ? invoice.issueDate : new Date(invoice.issueDate || invoice.createdAt || 0);
        if (invoiceDate < range.from || invoiceDate > range.to) return false;
      }
      return true;
    });
  }, [invoices, filterStatus, periodPreset, dateFrom, dateTo, singleDay]);



  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl overflow-hidden">
        <button 
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="w-full px-4 py-3 flex justify-between items-center bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
        >
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <span>⚙️</span>
            {isFiltersOpen ? t('filtreleri_gizle') || 'Filtreleri Gizle' : t('filtreleme_secenekleri') || 'Filtreleme Seçenekleri'}
          </span>
          <span className="text-muted-foreground text-xs">{isFiltersOpen ? '▲' : '▼'}</span>
        </button>
        
        {isFiltersOpen && (
          <div className="p-4 space-y-4 border-t border-border">
            <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-muted-foreground text-xs mb-1">{t('durum') || 'Durum'}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
            >
              <option value="all">{t('tumu') || 'Tümü'}</option>
              <option value="pending">{t('bekleyen') || 'Bekleyen'}</option>
              <option value="paid">{t('odenen') || 'Ödenen'}</option>
              <option value="failed">{t('basarisiz') || 'Başarısız'}</option>
              <option value="overdue">{t('gecikmis') || 'Gecikmiş'}</option>
            </select>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => { setFilterStatus('all'); setPeriodPreset('all'); setDateFrom(''); setDateTo(''); setSingleDay(''); }}
            className="px-4 py-2 bg-gray-600 text-foreground text-sm rounded-lg hover:bg-gray-500"
          >
            ↺ Zurücksetzen
          </button>
        </div>

        <div>
          <label className="block text-muted-foreground text-xs mb-2">Zeitraum</label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'current_quarter' as PeriodPreset, label: `Aktuelles Quartal (${getCurrentQuarterLabel()})` },
              { key: 'this_month' as PeriodPreset, label: 'Dieser Monat' },
              { key: 'last_month' as PeriodPreset, label: 'Letzter Monat' },
              { key: 'last_3_months' as PeriodPreset, label: 'Letzte 3 Monate' },
              { key: 'last_6_months' as PeriodPreset, label: 'Letzte 6 Monate' },
              { key: 'this_year' as PeriodPreset, label: 'Dieses Jahr' },
              { key: 'last_year' as PeriodPreset, label: 'Letztes Jahr' },
              { key: 'all' as PeriodPreset, label: 'Alle' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setPeriodPreset(key); setDateFrom(''); setDateTo(''); setSingleDay(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodPreset === key
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'bg-muted/50 text-foreground/90 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-muted-foreground text-xs mb-2">Quartal {new Date().getFullYear()}</label>
          <div className="flex gap-2">
            {(['q1', 'q2', 'q3', 'q4'] as PeriodPreset[]).map((q) => (
              <button
                key={q}
                onClick={() => { setPeriodPreset(q); setDateFrom(''); setDateTo(''); setSingleDay(''); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${periodPreset === q
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-muted/50 text-foreground/90 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {q.toUpperCase()} ({q === 'q1' ? 'Jan–Mär' : q === 'q2' ? 'Apr–Jun' : q === 'q3' ? 'Jul–Sep' : 'Okt–Dez'})
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-muted-foreground text-xs mb-1">Von</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); if (dateTo) setPeriodPreset('custom_range'); setSingleDay(''); }}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-muted-foreground text-xs mb-1">Bis</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); if (dateFrom) setPeriodPreset('custom_range'); setSingleDay(''); }}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm"
            />
          </div>
          <div className="text-muted-foreground/80 text-sm pb-2">oder</div>
          <div>
            <label className="block text-muted-foreground text-xs mb-1">Einzeltag</label>
            <input
              type="date"
              value={singleDay}
              onChange={(e) => { setSingleDay(e.target.value); setPeriodPreset('custom_day'); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm"
            />
          </div>
        </div>

        {periodPreset !== 'all' && (() => {
          const range = getPresetDateRange(periodPreset);
          if (!range) return null;
          return (
            <div className="text-xs text-muted-foreground/80 flex items-center gap-2 mt-4">
              <span>📅</span>
              <span>
                {range.from.toLocaleDateString('de-DE')} – {range.to.toLocaleDateString('de-DE')}
              </span>
              <span className="text-muted-foreground">|</span>
              <span>{filteredInvoices.length} Rechnung(en)</span>
            </div>
          );
        })()}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-foreground text-sm">{t('fatura_no') || 'Fatura No'}</th>
              <th className="px-4 py-3 text-left text-foreground text-sm">{t('donem') || 'Dönem'}</th>
              <th className="px-4 py-3 text-right text-foreground text-sm">{t('tutar') || 'Tutar'}</th>
              <th className="px-4 py-3 text-center text-foreground text-sm">{t('durum') || 'Durum'}</th>
              <th className="px-4 py-3 text-center text-foreground text-sm">{t('son_odeme') || 'Son Ödeme'}</th>
              <th className="px-4 py-3 text-center text-foreground text-sm">{t('i_slemler') || 'İşlemler'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground/80">
                  {t('henuz_fatura_bulunmuyor') || 'Kayıt bulunamadı.'}
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <span className="text-foreground font-mono">{invoice.invoiceNumber || invoice.id.slice(0,8)}</span>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    <div>
                      <p>{invoice.period || '-'}</p>
                      {invoice.description && (
                        <p className="text-xs text-muted-foreground/80 mt-0.5 max-w-[200px] truncate" title={invoice.description}>
                          {invoice.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-foreground font-bold">{formatCurrency(invoice.grandTotal || 0, invoice.currency)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs text-white ${statusColors[invoice.status] || 'bg-gray-500'}`}>
                      {statusLabels[invoice.status] || invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-foreground text-sm">
                    {invoice.dueDate ? new Date((invoice.dueDate as any)?.toDate ? (invoice.dueDate as any).toDate() : invoice.dueDate).toLocaleDateString('de-DE') : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {invoice.pdfUrl ? (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 flex items-center gap-1"
                        >
                          📄 PDF
                        </a>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              const { generateInvoicePDF } = await import('@/services/invoicePDFService');
                              const merchantInvoice = {
                                ...invoice,
                                type: 'subscription' as const,
                                status: 'issued' as const,
                                seller: {
                                  name: LOKMA_COMPANY_INFO.name,
                                  address: LOKMA_COMPANY_INFO.address,
                                  city: LOKMA_COMPANY_INFO.city,
                                  postalCode: LOKMA_COMPANY_INFO.postalCode,
                                  country: LOKMA_COMPANY_INFO.country,
                                  vatId: LOKMA_COMPANY_INFO.vatId,
                                  email: LOKMA_COMPANY_INFO.email,
                                  taxId: LOKMA_COMPANY_INFO.taxId,
                                  iban: LOKMA_COMPANY_INFO.iban,
                                  bic: LOKMA_COMPANY_INFO.bic,
                                },
                                buyer: {
                                  name: invoice.butcherName || 'Business',
                                  address: invoice.butcherAddress || '',
                                  city: '',
                                  postalCode: '',
                                  country: 'Deutschland',
                                },
                                lineItems: [{
                                  description: invoice.description || 'LOKMA Abonnement',
                                  quantity: 1,
                                  unit: 'Monat',
                                  unitPrice: invoice.subtotal,
                                  taxRate: (invoice.taxRate || 19) as 0 | 7 | 19,
                                  netAmount: invoice.subtotal,
                                  vatAmount: invoice.taxAmount,
                                  grossAmount: invoice.grandTotal,
                                }],
                                paymentStatus: (invoice.status === 'paid' ? 'paid' : 'pending') as 'pending' | 'paid',
                                paymentDueDate: new Date(invoice.dueDate && typeof (invoice.dueDate as any).toDate === 'function' ? (invoice.dueDate as any).toDate() : invoice.dueDate || Date.now()),
                                issuedAt: new Date(invoice.issueDate && typeof (invoice.issueDate as any).toDate === 'function' ? (invoice.issueDate as any).toDate() : invoice.issueDate || Date.now()),
                              };
                              const pdfBlob = await generateInvoicePDF(merchantInvoice as any);
                              const url = URL.createObjectURL(pdfBlob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${invoice.invoiceNumber}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              console.error('PDF error:', err);
                              alert('PDF oluşturulamadı');
                            }
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
                        >
                          📄 PDF
                        </button>
                      )}
                      
                      {/* XML Button */}
                      <button
                        onClick={() => {
                          import('@/services/eRechnungService').then(({ downloadXRechnungXML }) => {
                            const merchantInvoice = {
                              id: invoice.id,
                              invoiceNumber: invoice.invoiceNumber,
                              type: 'subscription' as const,
                              status: 'issued' as const,
                              seller: {
                                name: LOKMA_COMPANY_INFO.name,
                                address: LOKMA_COMPANY_INFO.address,
                                city: LOKMA_COMPANY_INFO.city,
                                postalCode: LOKMA_COMPANY_INFO.postalCode,
                                country: LOKMA_COMPANY_INFO.country,
                                vatId: LOKMA_COMPANY_INFO.vatId,
                                email: LOKMA_COMPANY_INFO.email
                              },
                              buyer: {
                                name: invoice.butcherName || 'Business',
                                address: invoice.butcherAddress || '',
                                city: '',
                                postalCode: '',
                                country: 'Deutschland'
                              },
                              lineItems: [{
                                description: invoice.description || 'LOKMA Abonnement',
                                quantity: 1,
                                unit: 'Monat',
                                unitPrice: invoice.subtotal,
                                taxRate: (invoice.taxRate || 19) as 0 | 7 | 19,
                                netAmount: invoice.subtotal,
                                vatAmount: invoice.taxAmount,
                                grossAmount: invoice.grandTotal
                              }],
                              netTotal: invoice.subtotal,
                              vatBreakdown: [{
                                rate: (invoice.taxRate || 19) as 0 | 7 | 19,
                                netAmount: invoice.subtotal,
                                vatAmount: invoice.taxAmount
                              }],
                              vatTotal: invoice.taxAmount,
                              grossTotal: invoice.grandTotal,
                              currency: invoice.currency || 'EUR',
                              paymentStatus: (invoice.status === 'paid' ? 'paid' : 'pending') as 'pending' | 'paid',
                              paymentDueDate: new Date(invoice.dueDate && typeof (invoice.dueDate as any).toDate === 'function' ? (invoice.dueDate as any).toDate() : invoice.dueDate || Date.now()),
                              businessId: invoice.butcherId || '',
                              createdAt: new Date(invoice.createdAt && typeof (invoice.createdAt as any).toDate === 'function' ? (invoice.createdAt as any).toDate() : invoice.createdAt || Date.now()),
                              updatedAt: new Date(invoice.updatedAt && typeof (invoice.updatedAt as any).toDate === 'function' ? (invoice.updatedAt as any).toDate() : invoice.updatedAt || Date.now()),
                              issuedAt: new Date(invoice.issueDate && typeof (invoice.issueDate as any).toDate === 'function' ? (invoice.issueDate as any).toDate() : invoice.issueDate || Date.now())
                            };
                            downloadXRechnungXML(merchantInvoice as any);
                          });
                        }}
                        className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-500"
                        title={t('xrechnung_xml_i_ndir_b2b_e_fatura') || 'XRechnung XML'}
                      >
                        XML
                      </button>

                      {/* Preview Button */}
                      <button
                        onClick={() => setPreviewInvoice(invoice)}
                        className="px-3 py-1 bg-teal-600 text-white text-xs rounded hover:bg-teal-500"
                      >
                        👁️ Vorschau
                      </button>

                      <Link
                        href={`/account/invoices/${invoice.id}`}
                        className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
                      >
                        Detay
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {previewInvoice && (
        <InvoicePreviewModal
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  );
}
