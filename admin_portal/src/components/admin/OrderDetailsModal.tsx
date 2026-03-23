'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORDER_STATUSES, ORDER_TYPES, OrderStatus } from '@/hooks/useOrders';
import { formatCurrency as globalFormatCurrency } from '@/lib/utils/currency';

interface OrderDetailsModalProps {
    order: any;
    onClose: () => void;
    t: any;
    businesses: Record<string, string>;
    checkedItems: Record<number, boolean>;
    dateLocale: string;
    onUpdateOrderStatus: (id: string, status: OrderStatus, reason?: string, unavailableItems?: any[]) => void;
    onToggleItemChecked: (orderId: string, itemIdx: number) => void;
    printerSettings?: any;
    printingOrderId?: string | null;
    onPrint?: (order: any) => void;
    onShowPrinterPanel?: () => void;
}

export default function OrderDetailsModal({
    order,
    onClose,
    t,
    businesses,
    checkedItems,
    dateLocale,
    onUpdateOrderStatus,
    onToggleItemChecked,
    printerSettings,
    printingOrderId,
    onPrint,
    onShowPrinterPanel,
}: OrderDetailsModalProps) {
    // Local Modals State
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [showUnavailableModal, setShowUnavailableModal] = useState(false);
    const [unavailableItems, setUnavailableItems] = useState<any[]>([]);

    const formatCurrency = (amount: number, currencyCode?: string) => {
        return globalFormatCurrency(amount, currencyCode);
    };

    // Derived values
    const totalItems = order.items?.length || 0;
    const checkedCount = Object.values(checkedItems || {}).filter(Boolean).length;
    const allChecked = totalItems > 0 && checkedCount >= totalItems;
    const hasItems = totalItems > 0;

    // Helper: Get unchecked (unavailable) items for an order
    const getUncheckedItems = () => {
        return (order.items || [])
            .map((item: any, idx: number) => ({
                idx,
                name: item.productName || item.name,
                quantity: item.quantity,
                price: item.price || 0,
                checked: !!(checkedItems || {})[idx]
            }))
            .filter((i: any) => !i.checked);
    };

    // Helper: Get the next logical status action button config
    const getNextStatusAction = () => {
        const status = order.status;

        if (['pending', 'accepted'].includes(status) && status === 'pending') {
            if (hasItems && checkedCount > 0) {
                if (allChecked) {
                    return { label: t('siparisi_onayla'), action: 'accepted' as OrderStatus, style: 'bg-blue-600 hover:bg-blue-700', hasUnavailable: false };
                } else {
                    return { label: t('eksik_urunlerle_onayla'), action: 'accepted' as OrderStatus, style: 'bg-yellow-600 hover:bg-yellow-700', hasUnavailable: true };
                }
            }
            return null; // No action yet — need to check some items first
        }

        if (status === 'accepted') {
            return { label: t('hazirlamaya_basla'), action: 'preparing' as OrderStatus, style: 'bg-amber-600 hover:bg-amber-700', hasUnavailable: false };
        }

        if (status === 'preparing') {
            return { label: t('siparis_hazir'), action: 'ready' as OrderStatus, style: 'bg-green-600 hover:bg-green-700', hasUnavailable: false };
        }

        // For dine-in ready orders, mark as delivered (= completed/served)
        if (status === 'ready' && order.type === 'dine_in') {
            return { label: t('action_served'), action: 'delivered' as OrderStatus, style: 'bg-teal-600 hover:bg-teal-700', hasUnavailable: false };
        }

        return null;
    };

    // Filter status buttons based on order type mapping
    const getFilteredStatuses = () => {
        // Define which statuses belong to which type
        const typeMapping: Record<string, OrderStatus[]> = {
            delivery: ['pending', 'accepted', 'preparing', 'ready', 'onTheWay', 'delivered', 'cancelled'],
            dine_in: ['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'], // Note: 'delivered' serves as 'served'
            pickup: ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']
        };

        const allowedKeys = typeMapping[order.type] || Object.keys(ORDER_STATUSES);
        
        const mainStatuses = Object.entries(ORDER_STATUSES).filter(([key]) => allowedKeys.includes(key as OrderStatus));
        // Find keys not in the mapping but exist in ORDER_STATUSES
        const edgeCaseStatuses = Object.entries(ORDER_STATUSES).filter(([key]) => !allowedKeys.includes(key as OrderStatus));

        return { mainStatuses, edgeCaseStatuses };
    };

    const { mainStatuses, edgeCaseStatuses } = getFilteredStatuses();

    // Custom Handle Status Change that opens modal if cancelled
    const handleStatusChangeInternal = (status: OrderStatus) => {
        if (status === 'cancelled') {
            setShowCancelModal(true);
        } else {
            onUpdateOrderStatus(order.id, status);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                <div className="bg-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                    <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                        <h2 className="text-xl font-bold text-white">
                            📦 {t('modal.order')} #{order.orderNumber || order.id.slice(0, 6).toUpperCase()} <span className="text-muted-foreground text-sm ml-2 font-normal">({t(ORDER_TYPES[order.type]?.labelKey || 'type_pickup')})</span>
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-muted-foreground hover:text-white transition-colors p-2 rounded-full hover:bg-gray-700"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Status */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('modal.status')}</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${ORDER_STATUSES[order.status]?.color || 'gray'}-600/20 text-${ORDER_STATUSES[order.status]?.color || 'gray'}-400`}>
                                {t(ORDER_STATUSES[order.status]?.labelKey || 'status_pending')}
                            </span>
                        </div>

                        {/* Business */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('modal.business')}</span>
                            <Link href={`/admin/butchers/${order.businessId}`} className="text-blue-400 hover:underline">
                                {businesses[order.businessId] || order.businessId}
                            </Link>
                        </div>

                        {/* Type */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('modal.type')}</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${ORDER_TYPES[order.type]?.color || 'gray'}-600/20 text-${ORDER_TYPES[order.type]?.color || 'gray'}-400`}>
                                {t(ORDER_TYPES[order.type]?.labelKey || 'type_pickup')}
                            </span>
                        </div>

                        {/* Scheduled Pickup Time (Pre-order indicator) */}
                        {order.scheduledAt && (() => {
                            const d = typeof order.scheduledAt.toDate === 'function' ? order.scheduledAt.toDate() : new Date(order.scheduledAt);
                            if (isNaN(d.getTime())) return null;
                            const isFuture = d.getTime() > Date.now() + 30 * 60 * 1000;
                            return (
                                <div className={`flex items-center justify-between ${isFuture ? 'bg-purple-600/10 border border-purple-500/30 rounded-lg px-3 py-2' : ''}`}>
                                    <span className={isFuture ? 'text-purple-300 font-medium' : 'text-muted-foreground'}>
                                        {isFuture ? `🕐 ${t('scheduledPickup')}` : t('pickupTime')}
                                    </span>
                                    <span className={isFuture ? 'text-purple-200 font-bold' : 'text-white'}>
                                        {d.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })} · {d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            );
                        })()}

                        {/* Dine-in Info */}
                        {order.type === 'dine_in' && (
                            <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                                <h4 className="text-amber-400 font-medium text-sm flex items-center gap-2">🍽️ {t('modal.dineInDetail')}</h4>
                                {order.tableNumber && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{t('modal.table')}</span>
                                        <span className="text-white font-bold text-lg">#{order.tableNumber}</span>
                                    </div>
                                )}
                                {order.waiterName && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{t('modal.waiter')}</span>
                                        <span className="text-white">{order.waiterName}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">{t('modal.payment')}</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.paymentStatus === 'paid'
                                        ? 'bg-green-600/20 text-green-400'
                                        : 'bg-red-600/20 text-red-400'
                                        }`}>
                                        {order.paymentStatus === 'paid'
                                            ? `✅ ${t('modal.paid')}${order.paymentMethod === 'card' ? ` (${t('modal.card')})` : order.paymentMethod === 'cash' ? ` (${t('modal.cash')})` : ''}`
                                            : `⏳ ${t('modal.unpaid')}`}
                                    </span>
                                </div>
                                {order.servedByName && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{t('modal.servedBy')}</span>
                                        <span className="text-teal-400 font-medium">🍽️ {order.servedByName}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Customer */}
                        <div className="flex items-center justify-between border-t border-border pt-4">
                            <span className="text-muted-foreground">{t('modal.customer')}</span>
                            <div className="text-right">
                                <p className="text-white font-medium">{order.customerName || t('modal.guest')}</p>
                                {order.customerPhone && (
                                    <a href={`tel:${order.customerPhone}`} className="text-blue-400 text-sm hover:underline">
                                        {order.customerPhone}
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Address */}
                        {order.address && (
                            <div className="flex items-center justify-between bg-gray-700/30 rounded-lg p-3">
                                <span className="text-muted-foreground">{t('modal.address')}</span>
                                <div className="text-right text-white text-sm">
                                    <p>{order.address.street}</p>
                                    <p>{order.address.postalCode} {order.address.city}</p>
                                </div>
                            </div>
                        )}

                        {/* Items */}
                        <div className="border-t border-border pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-white font-semibold">{t('modal.products')}</h4>
                                {order.items?.length > 0 && (
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shadow-sm border ${allChecked
                                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                        : 'bg-card text-muted-foreground border-gray-600'
                                        }`}>
                                        ✓ {checkedCount}/{order.items.length}
                                    </span>
                                )}
                            </div>
                            
                            {/* Group Order Kitchen Summary */}
                            {order.isGroupOrder && order.items?.length > 0 && (
                                <div className="mb-4">
                                    <h5 className="text-amber-400 font-medium text-sm mb-2">👨‍🍳 {t('modal.kitchenSummary')}</h5>
                                    <div className="bg-card/80 border border-gray-600 rounded-lg p-3 space-y-1 text-sm text-gray-200">
                                        {Object.values(
                                            order.items.reduce((acc: any, item: any) => {
                                                const opts = (item.selectedOptions || []).map((o: any) => o.optionName || o.name).join(', ');
                                                const key = `${item.productId}-${opts}`;
                                                if (!acc[key]) {
                                                    acc[key] = { name: item.productName || item.name, quantity: 0, opts: item.selectedOptions };
                                                }
                                                acc[key].quantity += (item.quantity || 1);
                                                return acc;
                                            }, {})
                                        ).map((aggr: any, idx: number) => (
                                            <div key={idx} className="flex items-start">
                                                <span className="font-bold text-white mr-2 whitespace-nowrap">{aggr.quantity}x</span> 
                                                <span>
                                                    {aggr.name}
                                                    {aggr.opts && aggr.opts.length > 0 && (
                                                        <span className="text-muted-foreground ml-1 text-xs">({aggr.opts.map((o: any) => o.optionName || o.name).join(', ')})</span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {order.isGroupOrder && (
                                <h5 className="text-teal-400 font-medium text-sm mt-4 mb-2">🍽️ {t('modal.participantBreakdown')}</h5>
                            )}

                            <div className="space-y-4">
                                {/* Render items (grouped by participant if group order, otherwise flat) */}
                                {(() => {
                                    const renderItem = (item: any, originalIdx: number) => {
                                        const isChecked = !!(checkedItems || {})[originalIdx];
                                        const posNum = item.positionNumber || (originalIdx + 1);
                                        return (
                                            <div key={originalIdx} className={`rounded-xl px-3 py-2 transition-all mb-1.5 border border-transparent ${isChecked ? 'bg-green-900/20 border-green-500/20' : 'bg-gray-700/30 border-gray-600/30 shadow-sm'}`}>
                                                <div className="flex items-center gap-2.5 text-sm">
                                                    <button
                                                        onClick={() => onToggleItemChecked(order.id, originalIdx)}
                                                        className={`w-5 h-5 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all ${isChecked
                                                            ? 'bg-green-500 border-green-500 text-white'
                                                            : 'border-gray-500 hover:border-green-400 bg-card'
                                                            }`}
                                                    >
                                                        {isChecked && <span className="text-xs font-bold font-sans">✓</span>}
                                                    </button>
                                                    <span className="bg-amber-500/90 text-white text-[10px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0">#{posNum}</span>
                                                    {/* Free Drink Badge */}
                                                    {item.isFreeDrink && (
                                                        <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0 tracking-wide">{t('free')}</span>
                                                    )}
                                                    <span className={`flex-1 font-medium ${isChecked ? 'text-green-300 line-through opacity-70' : item.isFreeDrink ? 'text-emerald-300' : 'text-gray-200'}`}>
                                                        {item.quantity}x {item.productName || item.name}
                                                    </span>
                                                    <span className={`${isChecked ? 'text-green-400 opacity-70' : item.isFreeDrink ? 'text-emerald-400 font-semibold' : 'text-white font-medium'}`}>
                                                        {item.isFreeDrink ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="line-through text-gray-500 text-[10px]">{formatCurrency(item.originalPrice || item.unitPrice || 0, order?.currency)}</span>
                                                                <span>0,00 €</span>
                                                            </div>
                                                        ) : (
                                                            formatCurrency(item.totalPrice ?? ((item.unitPrice || item.price || 0) * (item.quantity || 1)), order?.currency)
                                                        )}
                                                    </span>
                                                </div>
                                                {/* Show selected options */}
                                                {item.selectedOptions && item.selectedOptions.length > 0 && (
                                                    <div className="pl-14 space-y-1 mt-1.5">
                                                        {item.selectedOptions.map((opt: any, optIdx: number) => (
                                                            <div key={optIdx} className="flex justify-between text-xs">
                                                                <span className={`${isChecked ? 'text-green-300/60 line-through' : 'text-purple-300'}`}>↳ {opt.optionName || opt.name}</span>
                                                                {(opt.priceModifier || opt.price) ? (
                                                                    <span className={`${isChecked ? 'text-green-400/60' : 'text-purple-400'} font-medium`}>+{formatCurrency(opt.priceModifier || opt.price, order?.currency)}</span>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Show item note */}
                                                {item.itemNote && (
                                                    <div className="pl-14 mt-1.5 p-1.5 bg-yellow-900/20 rounded-md border border-yellow-500/10">
                                                        <span className="text-xs text-amber-200 font-medium whitespace-pre-line">📝 {item.itemNote}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    };

                                    if (order.isGroupOrder) {
                                        const groupedByParticipant: Record<string, { item: any, index: number }[]> = {};
                                        order.items?.forEach((item: any, idx: number) => {
                                            const pName = item.participantName || t('modal.guest');
                                            if (!groupedByParticipant[pName]) groupedByParticipant[pName] = [];
                                            groupedByParticipant[pName].push({ item, index: idx });
                                        });

                                        return Object.entries(groupedByParticipant).map(([pName, items]) => (
                                            <div key={pName} className="bg-card border border-gray-600 rounded-xl p-3 shadow-sm mb-3">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-purple-400 text-sm">👤</span>
                                                    <span className="text-white text-sm font-semibold border-b border-gray-600 pb-0.5 w-full">{pName}</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {items.map(info => renderItem(info.item, info.index))}
                                                </div>
                                            </div>
                                        ));
                                    }

                                    return (
                                        <div className="space-y-1">
                                            {order.items?.map((item: any, idx: number) => renderItem(item, idx))}
                                        </div>
                                    );
                                })()}
                            </div>
                            
                            {/* Step-by-step status transition button */}
                            {(() => {
                                const action = getNextStatusAction();
                                if (!action) return null;

                                const handleClick = () => {
                                    if (action.hasUnavailable) {
                                        const unchecked = getUncheckedItems();
                                        setUnavailableItems(unchecked);
                                        setShowUnavailableModal(true);
                                    } else {
                                        onUpdateOrderStatus(order.id, action.action);
                                    }
                                };

                                return (
                                    <button
                                        onClick={handleClick}
                                        className={`w-full mt-5 px-4 py-3.5 text-white rounded-xl shadow-lg transition flex items-center justify-center gap-2 font-bold text-lg ${action.style} ${action.hasUnavailable ? '' : 'animate-pulse ring-2 ring-white/20'}`}
                                    >
                                        {action.label}
                                    </button>
                                );
                            })()}
                        </div>

                        {/* Totals */}
                        <div className="border-t border-border pt-5 space-y-2.5 bg-background/30 -mx-6 px-6 pb-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{t('modal.subtotal')}</span>
                                <span className="text-white font-medium">{formatCurrency(order.subtotal || 0, order.currency)}</span>
                            </div>
                            {(order.deliveryFee ?? 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('modal.deliveryFee')}</span>
                                    <span className="text-white font-medium">{formatCurrency(order.deliveryFee || 0, order.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-bold pt-2 border-t border-border/50 mt-1">
                                <span className="text-white">{t('modal.total')}</span>
                                <span className="text-emerald-400 drop-shadow-sm">{formatCurrency(order.total || 0, order.currency)}</span>
                            </div>
                        </div>

                        {/* Notes */}
                        {order.notes && (
                            <div className="border-t border-border pt-4 pb-1">
                                <h4 className="text-amber-400 font-semibold text-sm mb-2 flex items-center gap-1">📝 {t('modal.notes')}</h4>
                                <p className="text-yellow-50 bg-yellow-900/30 border border-yellow-500/40 rounded-xl p-3.5 shadow-sm leading-relaxed whitespace-pre-wrap">{order.notes}</p>
                            </div>
                        )}

                        {/* Status Actions */}
                        <div className="border-t border-border pt-4">
                            <h4 className="text-foreground text-sm font-medium mb-3">{t('modal.updateStatus')}</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {mainStatuses.map(([key, value]) => (
                                    <button
                                        key={key}
                                        onClick={() => handleStatusChangeInternal(key as OrderStatus)}
                                        disabled={order.status === key}
                                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${order.status === key
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600'
                                            : key === 'cancelled'
                                                ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50'
                                                : `bg-gray-700 text-white hover:bg-gray-600`
                                            }`}
                                    >
                                        {key === 'cancelled' && <span className="mr-1.5">❌</span>}
                                        {t(value.labelKey)}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Edge Case Statuses (Collapsible) */}
                            {edgeCaseStatuses.length > 0 && (
                                <details className="mt-4 group bg-card/50 border border-border rounded-lg overflow-hidden transition-all">
                                    <summary className="px-4 py-2 text-sm text-muted-foreground font-medium cursor-pointer flex items-center justify-between hover:bg-gray-700/50 transition-colors">
                                        {t('modal.otherStatuses') || "Diğer Durumlar (Edge Cases)"}
                                        <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
                                    </summary>
                                    <div className="p-3 grid grid-cols-2 gap-2 border-t border-border bg-background/30">
                                        {edgeCaseStatuses.map(([key, value]) => (
                                            <button
                                                key={key}
                                                onClick={() => handleStatusChangeInternal(key as OrderStatus)}
                                                disabled={order.status === key}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${order.status === key
                                                    ? 'bg-gray-700 text-gray-600 cursor-not-allowed border border-gray-600/50'
                                                    : 'bg-gray-700/50 text-foreground hover:bg-gray-600 hover:text-white border border-gray-600'
                                                    }`}
                                            >
                                                {t(value.labelKey)}
                                            </button>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>

                        {/* Print Action */}
                        <div className="border-t border-border pt-5 pb-2">
                            <button
                                onClick={() => printerSettings?.enabled && printerSettings?.printerIp ? onPrint?.(order) : onShowPrinterPanel?.()}
                                disabled={printingOrderId === order.id}
                                className={`w-full px-4 py-3.5 rounded-xl transition flex items-center justify-center gap-2 font-medium shadow-sm active:scale-[0.98] ${
                                    !printerSettings?.enabled || !printerSettings?.printerIp
                                        ? 'bg-gray-700 border border-gray-600 text-foreground hover:bg-gray-600 hover:text-white'
                                        : 'bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200'
                                }`}
                            >
                                {!printerSettings?.enabled || !printerSettings?.printerIp
                                    ? '🖨️ Drucker einrichten'
                                    : printingOrderId === order.id ? '⏳ Druckt...' : '🖨️ Bon drucken'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cancellation Reason Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
                    <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl border border-border">
                        <div className="p-5 border-b border-border flex items-center justify-between bg-card/50">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                ❌ {t('cancelModal.title')}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelReason('');
                                }}
                                className="text-muted-foreground hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-700"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-foreground text-sm leading-relaxed">
                                {t('cancelModal.subtitle') || t('cancelModal.description')}
                            </p>

                            {/* Quick Select Buttons */}
                            <div className="flex flex-wrap gap-2 pt-1 pb-2">
                                {['outOfStock', 'customerRequest', 'duplicate', 'noDelivery', 'closed'].map((reasonKey) => (
                                    <button
                                        key={reasonKey}
                                        onClick={() => setCancelReason(t(`cancelModal.reasons.${reasonKey}`))}
                                        className="bg-gray-700/50 hover:bg-gray-600 border border-gray-600 text-gray-200 px-3 py-2 rounded-lg text-sm transition-colors text-left"
                                    >
                                        {t(`cancelModal.reasons.${reasonKey}`)}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-px bg-gray-700 flex-1"></span>
                                <span className="text-muted-foreground text-xs font-medium">{t('cancelModal.customReason')}</span>
                                <span className="h-px bg-gray-700 flex-1"></span>
                            </div>

                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder={t('cancelModal.placeholder') || t('cancelModal.reasonPlaceholder')}
                                className="w-full bg-background border border-gray-600 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none h-28"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowCancelModal(false);
                                        setCancelReason('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition font-medium"
                                >
                                    {t('cancelModal.cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        if (cancelReason.trim()) {
                                            onUpdateOrderStatus(order.id, 'cancelled', cancelReason.trim());
                                            setShowCancelModal(false);
                                            setCancelReason('');
                                        }
                                    }}
                                    disabled={!cancelReason.trim()}
                                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm shadow-red-900/50"
                                >
                                    {t('cancelModal.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unavailable Items Modal */}
            {showUnavailableModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
                    <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl border border-border">
                        <div className="p-5 border-b border-border flex items-center justify-between bg-card/50">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                ⚠️ {t('missingModal.title')}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowUnavailableModal(false);
                                    setUnavailableItems([]);
                                }}
                                className="text-muted-foreground hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-700"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <p className="text-foreground text-sm leading-relaxed">
                                {t('missingModal.description')}
                            </p>

                            <div className="bg-background/80 border border-border border-l-4 border-l-yellow-500 rounded-xl p-4 max-h-48 overflow-y-auto shadow-inner">
                                <ul className="space-y-1.5 list-disc list-inside text-gray-200 text-sm">
                                    {unavailableItems.map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center group">
                                            <span>
                                                <span className="text-yellow-400 font-medium">{item.quantity}x</span> {item.name}
                                            </span>
                                            <span className="text-gray-500 text-xs font-medium">{formatCurrency(item.price, order.currency)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            
                            <p className="text-amber-400/90 text-sm font-medium bg-amber-900/20 p-3 rounded-lg border border-amber-900/50 text-center flex items-center gap-2 justify-center">
                                <span>Tutar otomatik olarak iade edilecek veya ödemeden düşülecektir.</span>
                            </p>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setShowUnavailableModal(false);
                                        setUnavailableItems([]);
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition font-medium"
                                >
                                    {t('missingModal.cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        onUpdateOrderStatus(order.id, 'accepted', undefined, unavailableItems);
                                        setShowUnavailableModal(false);
                                        setUnavailableItems([]);
                                    }}
                                    className="flex-1 px-4 py-3 bg-yellow-600 text-gray-900 rounded-xl hover:bg-yellow-500 transition shadow-sm font-bold flex items-center justify-center gap-2"
                                >
                                    ⚠️ {t('missingModal.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
