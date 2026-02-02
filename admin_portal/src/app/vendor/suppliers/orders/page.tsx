'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface Supplier {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
}

interface OrderItem {
    productName: string;
    quantity: number;
    unit: string;
    notes?: string;
}

function SupplierOrdersContent() {
    const searchParams = useSearchParams();
    const preSelectedSupplierId = searchParams.get('supplierId');

    const [businessId, setBusinessId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState('');
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<string>('');
    const [items, setItems] = useState<OrderItem[]>([{ productName: '', quantity: 1, unit: 'kg', notes: '' }]);
    const [deliveryDate, setDeliveryDate] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [sendMethod, setSendMethod] = useState<'email' | 'whatsapp'>('whatsapp');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Get business ID and load suppliers
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    const bId = data.butcherId || data.businessId;
                    setBusinessId(bId);

                    if (bId) {
                        // Get business name
                        const businessDoc = await getDoc(doc(db, 'businesses', bId));
                        if (businessDoc.exists()) {
                            setBusinessName(businessDoc.data().companyName || '');
                        }

                        // Load suppliers
                        const q = query(collection(db, 'businesses', bId, 'suppliers'));
                        const snapshot = await getDocs(q);
                        const sups = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Supplier[];
                        setSuppliers(sups);

                        // Pre-select supplier if provided
                        if (preSelectedSupplierId) {
                            setSelectedSupplier(preSelectedSupplierId);
                        }
                    }
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [preSelectedSupplierId]);

    const addItem = () => {
        setItems([...items, { productName: '', quantity: 1, unit: 'kg', notes: '' }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const getSelectedSupplier = () => suppliers.find(s => s.id === selectedSupplier);

    const generateOrderText = () => {
        const supplier = getSelectedSupplier();
        const today = new Date().toLocaleDateString('tr-TR');

        let text = `📦 SİPARİŞ FORMU\n`;
        text += `━━━━━━━━━━━━━━━━━━\n`;
        text += `📅 Tarih: ${today}\n`;
        text += `🏪 İşletme: ${businessName}\n`;
        text += `🏭 Toptancı: ${supplier?.name}\n`;
        if (deliveryDate) {
            text += `🚚 Teslimat: ${new Date(deliveryDate).toLocaleDateString('tr-TR')}\n`;
        }
        text += `\n📋 ÜRÜNLER:\n`;
        text += `━━━━━━━━━━━━━━━━━━\n`;

        items.forEach((item, i) => {
            if (item.productName) {
                text += `${i + 1}. ${item.productName}\n`;
                text += `   📦 ${item.quantity} ${item.unit}\n`;
                if (item.notes) {
                    text += `   📝 ${item.notes}\n`;
                }
                text += `\n`;
            }
        });

        if (orderNotes) {
            text += `━━━━━━━━━━━━━━━━━━\n`;
            text += `📝 NOT: ${orderNotes}\n`;
        }

        text += `\n✅ Sipariş onaylandığında lütfen bilgi veriniz.\n`;
        text += `📱 MiraPortal B2B`;

        return text;
    };

    const handleSend = async () => {
        const supplier = getSelectedSupplier();
        if (!supplier) {
            showToast('Lütfen toptancı seçin', 'error');
            return;
        }

        const validItems = items.filter(i => i.productName);
        if (validItems.length === 0) {
            showToast('En az bir ürün ekleyin', 'error');
            return;
        }

        setSending(true);

        try {
            // Save order to Firestore
            const orderData = {
                supplierId: selectedSupplier,
                supplierName: supplier.name,
                items: validItems,
                deliveryDate: deliveryDate || null,
                notes: orderNotes || null,
                status: 'sent',
                sendMethod,
                createdAt: new Date(),
            };

            await addDoc(collection(db, 'businesses', businessId!, 'supplier_orders'), orderData);

            const orderText = generateOrderText();

            if (sendMethod === 'whatsapp' && supplier.whatsapp) {
                // Open WhatsApp
                const whatsappNumber = supplier.whatsapp.replace(/\D/g, '');
                const encodedText = encodeURIComponent(orderText);
                window.open(`https://wa.me/${whatsappNumber}?text=${encodedText}`, '_blank');
                showToast('WhatsApp açıldı, siparişi gönderin!', 'success');
            } else if (sendMethod === 'email' && supplier.email) {
                // Send email via API
                const response = await fetch('/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: supplier.email,
                        subject: `Sipariş - ${businessName} - ${new Date().toLocaleDateString('tr-TR')}`,
                        text: orderText,
                    }),
                });

                if (response.ok) {
                    showToast('E-posta gönderildi!', 'success');
                } else {
                    showToast('E-posta gönderilemedi', 'error');
                }
            } else {
                showToast('Toptancının iletişim bilgisi eksik', 'error');
            }

            // Reset form
            setItems([{ productName: '', quantity: 1, unit: 'kg', notes: '' }]);
            setOrderNotes('');
        } catch (error) {
            console.error('Error:', error);
            showToast('Sipariş kaydedilemedi', 'error');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">📦 Toptancı Siparişi</h1>
                <p className="text-gray-400">Toptancınıza kolayca sipariş gönderin</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Order Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Supplier Selection */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-white font-bold mb-4">🏭 Toptancı Seç</h2>
                        <select
                            value={selectedSupplier}
                            onChange={(e) => setSelectedSupplier(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600"
                        >
                            <option value="">Toptancı seçin...</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {suppliers.length === 0 && (
                            <p className="text-yellow-400 text-sm mt-2">
                                ⚠️ Önce <a href="/vendor/suppliers" className="underline">toptancı ekleyin</a>
                            </p>
                        )}
                    </div>

                    {/* Items */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-white font-bold">📋 Ürünler</h2>
                            <button
                                onClick={addItem}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                            >
                                ➕ Ürün Ekle
                            </button>
                        </div>

                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={index} className="bg-gray-700/50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
                                            {index + 1}
                                        </span>
                                        {items.length > 1 && (
                                            <button
                                                onClick={() => removeItem(index)}
                                                className="ml-auto text-red-400 hover:text-red-300"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                value={item.productName}
                                                onChange={(e) => updateItem(index, 'productName', e.target.value)}
                                                placeholder="Ürün adı (örn: Dana Kıyma)"
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-20 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                                min="0"
                                                step="0.5"
                                            />
                                            <select
                                                value={item.unit}
                                                onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                            >
                                                <option value="kg">kg</option>
                                                <option value="adet">Adet</option>
                                                <option value="paket">Paket</option>
                                                <option value="koli">Koli</option>
                                            </select>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={item.notes || ''}
                                        onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                        placeholder="Not: özel kesim, kalınlık vs."
                                        className="w-full mt-2 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Delivery & Notes */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-white font-bold mb-4">📅 Teslimat & Notlar</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Teslimat Tarihi</label>
                                <input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Gönderim Yöntemi</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSendMethod('whatsapp')}
                                        className={`flex-1 px-4 py-2 rounded-lg ${sendMethod === 'whatsapp' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                                            }`}
                                    >
                                        💬 WhatsApp
                                    </button>
                                    <button
                                        onClick={() => setSendMethod('email')}
                                        className={`flex-1 px-4 py-2 rounded-lg ${sendMethod === 'email' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                                            }`}
                                    >
                                        ✉️ E-posta
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-gray-400 text-sm mb-1">Genel Not</label>
                            <textarea
                                value={orderNotes}
                                onChange={(e) => setOrderNotes(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                rows={3}
                                placeholder="Ek bilgiler, acil notlar..."
                            />
                        </div>
                    </div>
                </div>

                {/* Preview & Send */}
                <div className="space-y-6">
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 sticky top-6">
                        <h2 className="text-white font-bold mb-4">📄 Önizleme</h2>
                        <pre className="bg-gray-900 rounded-lg p-4 text-gray-300 text-xs whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                            {generateOrderText()}
                        </pre>
                        <button
                            onClick={handleSend}
                            disabled={sending || !selectedSupplier}
                            className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-lg disabled:opacity-50"
                        >
                            {sending ? '⏳ Gönderiliyor...' : sendMethod === 'whatsapp' ? '💬 WhatsApp ile Gönder' : '✉️ E-posta Gönder'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SupplierOrdersPage() {
    return (
        <Suspense fallback={
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        }>
            <SupplierOrdersContent />
        </Suspense>
    );
}
