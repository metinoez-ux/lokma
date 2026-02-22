'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { Supplier, B2BOrderItem, SupplierCategory } from '@/types';
import { getSuppliers } from '@/services/supplierService';
import { addOrder } from '@/services/orderService';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function CreateOrderPage() {
    
  const t = useTranslations('AdminOrdersCreate');
const { admin } = useAdmin();
    const router = useRouter();

    // Wizard State
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Data State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [items, setItems] = useState<B2BOrderItem[]>([]);
    const [rawText, setRawText] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [orderNote, setOrderNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load Suppliers
    useEffect(() => {
        if (admin?.butcherId) {
            getSuppliers(admin.butcherId).then(setSuppliers);
        }
    }, [admin]);

    // Parsing Logic (Smart Paste)
    const parseTextToItems = (text: string) => {
        // Simple regex: look for Number + Word + Rest
        // e.g. "50 kg dana", "10 koli ayran"
        const lines = text.split('\n');
        const newItems: B2BOrderItem[] = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // Regex: Start with number, optional space, optional unit word, rest is name
            // This is basic. In a real app, use an LLM or stricter regex.
            const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZçğıöşüÇĞİÖŞÜ]+)?\s+(.+)$/);

            if (match) {
                newItems.push({
                    name: match[3],
                    quantity: parseFloat(match[1].replace(',', '.')),
                    unit: match[2] || 'adt'
                });
            } else {
                // Fallback: whole line is name, 1 unit
                newItems.push({
                    name: trimmed,
                    quantity: 1,
                    unit: 'adt'
                });
            }
        });

        setItems([...items, ...newItems]);
        setRawText(''); // Clear input
    };

    const handleSendOrder = async (method: 'whatsapp' | 'pdf' | 'email') => {
        if (!admin?.butcherId || !selectedSupplier) return;

        setIsSubmitting(true);
        try {
            // 1. Save to DB
            const orderId = await addOrder({
                butcherId: admin.butcherId,
                supplierId: selectedSupplier.id,
                supplierName: selectedSupplier.name,
                items,
                status: method === 'whatsapp' ? 'sent' : 'draft', // WhatsApp is immediate send, others are draft/sent based on logic
                totalAmount: 0,
                currency: 'EUR',
                method,
                note: orderNote,
                createdAt: new Date(),
                deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined
            });

            // 2. Actions
            if (method === 'whatsapp') {
                const message = `Merhaba ${selectedSupplier.name},\n\nSipariş Listem:\n` +
                    items.map(i => `- ${i.quantity} ${i.unit} ${i.name}`).join('\n') +
                    (orderNote ? `\n\nNot: ${orderNote}` : '') +
                    (deliveryDate ? `\nTeslimat: ${deliveryDate}` : '');

                const url = `https://wa.me/${selectedSupplier.phone}?text=${encodeURIComponent(message)}`;
                window.open(url, '_blank');
            } else if (method === 'pdf') {
                // Trigger print/download (Simple window print for V1)
                window.print();
            }

            // 3. Redirect
            router.push('/admin/orders');
        } catch (e) {
            console.error(e);
            alert(t('siparis_olusturulurken_hata_olustu'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans text-white">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <Link href="/admin/orders" className="text-gray-400 text-sm hover:text-white mb-2 inline-block">← İptal</Link>
                        <h1 className="text-3xl font-bold">{t('yeni_siparis_olustur')}</h1>
                        <p className="text-gray-400">{t('adim')} {step}/3: {step === 1 ? t('tedarikci_secimi') : step === 2 ? t('urunleri_gir') : t('onizleme_gonder')}</p>
                    </div>
                </div>

                {/* STEP 1: SELECT SUPPLIER */}
                {step === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suppliers.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-gray-800 rounded-xl">
                                <p className="text-gray-400 mb-4">{t('kayitli_tedarikciniz_yok')}</p>
                                <Link href="/admin/orders/suppliers" className="text-green-400 underline font-bold">{t('tedarikci_ekle')}</Link>
                            </div>
                        )}
                        {suppliers.map(s => (
                            <button
                                key={s.id}
                                onClick={() => { setSelectedSupplier(s); setStep(2); }}
                                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 transition p-6 rounded-xl text-left group"
                            >
                                <div className="text-2xl mb-2">
                                    {s.category === 'meat' ? '🥩' : s.category === 'vegetable' ? '🥦' : '📦'}
                                </div>
                                <h3 className="font-bold text-lg group-hover:text-green-400 transition">{s.name}</h3>
                                {s.companyName && <p className="text-sm text-gray-500">{s.companyName}</p>}
                            </button>
                        ))}
                    </div>
                )}

                {/* STEP 2: BUILD ITEMS */}
                {step === 2 && (
                    <div className="space-y-8">
                        {/* Smart Paste Area */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <h3 className="font-bold mb-2 flex items-center gap-2">
                                <span>🤖</span> {t('hizli_ekle_smart_paste')}
                            </h3>
                            <p className="text-xs text-gray-400 mb-2">{t('listenizi_alt_alta_yapistirin_orn_50_kg_')}</p>
                            <div className="flex gap-2">
                                <textarea
                                    value={rawText}
                                    onChange={e => setRawText(e.target.value)}
                                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white h-24"
                                    placeholder={`10 koli Ayran\n50 kg Dana Kıyma\n20 adt Ekmek`}
                                />
                                <button
                                    onClick={() => parseTextToItems(rawText)}
                                    className="bg-blue-600 hover:bg-blue-500 px-6 rounded-lg font-bold"
                                >
                                    {t('cevir')}
                                </button>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <h3 className="font-bold mb-4">{t('siparis_listesi')}{items.length})</h3>
                            {items.length === 0 ? (
                                <div className="text-center text-gray-500 py-4">{t('listeniz_bos')}</div>
                            ) : (
                                <div className="space-y-2">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-gray-900 p-3 rounded-lg border border-gray-700">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    newItems[idx].quantity = parseFloat(e.target.value);
                                                    setItems(newItems);
                                                }}
                                                className="w-20 bg-transparent border-b border-gray-600 focus:border-green-500 outline-none text-center font-mono font-bold"
                                            />
                                            <input
                                                type="text"
                                                value={item.unit}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    newItems[idx].unit = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                className="w-16 bg-transparent border-b border-gray-600 focus:border-green-500 outline-none text-center text-sm text-gray-400"
                                            />
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    newItems[idx].name = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                className="flex-1 bg-transparent border-b border-gray-600 focus:border-green-500 outline-none font-bold"
                                            />
                                            <button
                                                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                                className="text-red-400 hover:bg-red-900/30 p-2 rounded"
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Manual Add Button */}
                            <button
                                onClick={() => setItems([...items, { name: '', quantity: 1, unit: 'adt' }])}
                                className="mt-4 text-sm text-blue-400 hover:text-blue-300 font-bold"
                            >
                                {t('satir_ekle')}
                            </button>
                        </div>

                        <div className="flex justify-between">
                            <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white">← Geri</button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={items.length === 0}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-900/20"
                            >
                                Devam Et →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: PREVIEW & SEND */}
                {step === 3 && selectedSupplier && (
                    <div className="space-y-8">
                        <div className="bg-white text-black p-8 rounded-xl shadow-2xl relative" id="print-area">
                            {/* Print Header */}
                            <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black uppercase">{t('siparis_formu')}</h2>
                                    <p className="text-sm text-gray-600">{formatLocalDate(new Date())}</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="font-bold">{admin?.butcherId || t('mira')}</h3>
                                    <p className="text-sm">{t('musteri_no')} {admin?.butcherId?.substring(0, 6)}</p>
                                </div>
                            </div>

                            {/* Supplier Info */}
                            <div className="mb-6 bg-gray-100 p-4 rounded-lg">
                                <span className="text-xs font-bold uppercase text-gray-500 block mb-1">{t('alici_tedari_kci')}</span>
                                <h3 className="text-xl font-bold">{selectedSupplier.name}</h3>
                                <p className="text-gray-600">{selectedSupplier.phone}</p>
                            </div>

                            {/* Items Table (Print Friendly) */}
                            <table className="w-full mb-8">
                                <thead>
                                    <tr className="border-b border-black text-left text-sm uppercase">
                                        <th className="pb-2 w-24">Miktar</th>
                                        <th className="pb-2 w-20">Birim</th>
                                        <th className="pb-2">{t('urun_adi')}</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono text-lg">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-200">
                                            <td className="py-2 font-bold">{item.quantity}</td>
                                            <td className="py-2 text-gray-600">{item.unit}</td>
                                            <td className="py-2">{item.name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Notes */}
                            <div className="mb-8">
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{t('siparis_notu')}</label>
                                <textarea
                                    value={orderNote}
                                    onChange={e => setOrderNote(e.target.value)}
                                    className="w-full bg-yellow-50 border border-yellow-200 p-3 rounded text-sm min-h-[80px]"
                                    placeholder={t('varsa_ozel_notunuz')}
                                />
                            </div>

                            <div className="mb-8">
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{t('teslimat_tarihi_i_stege_bagli')}</label>
                                <input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={e => setDeliveryDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 p-2 rounded"
                                />
                            </div>

                            <div className="text-center text-xs text-gray-400 mt-12 border-t pt-4">
                                {t('mira_retail_os_tarafindan_olusturulmustu')}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleSendOrder('whatsapp')}
                                disabled={isSubmitting}
                                className="bg-green-500 hover:bg-green-400 text-white p-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                            >
                                <span>💬</span> {t('whatsapp_ile_gonder')}
                            </button>
                            <button
                                onClick={() => {
                                    // Print Logic
                                    window.print();
                                    handleSendOrder('pdf'); // Just saves status
                                }}
                                disabled={isSubmitting}
                                className="bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                            >
                                <span>🖨️</span> {t('pdf_yazdir')}
                            </button>
                        </div>

                        <button onClick={() => setStep(2)} className="w-full text-center text-gray-500 hover:text-gray-300 mt-4">{t('duzenlemeye_don')}</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Simple helper
function formatLocalDate(date: Date) {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
