'use client';

import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ============================================================
// CANONICAL ORDER TYPE
// Single source of truth for order field mapping
// ============================================================

export interface Order {
  id: string;
  orderNumber: string;
  businessId: string;
  businessName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: any[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  type: string; // 'pickup' | 'delivery' | 'dine_in'
  createdAt: any;
  scheduledAt: any;
  isScheduledOrder: boolean;
  address: any;
  notes: string;
  tableNumber?: string;
  waiterName?: string;
  groupSessionId?: string;
  isGroupOrder: boolean;
  groupParticipantCount: number;
  paymentStatus: string;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  currency?: string;
  // Keep raw doc data accessible
  _raw: any;
}

// ============================================================
// CANONICAL FIELD MAPPING
// This is the SINGLE place where Firestore doc -> Order happens
// ============================================================

function mapDocToOrder(docId: string, d: any): Order {
  // Type normalization: Dart stores 'dineIn', admin expects 'dine_in'
  const rawType = d.orderType || d.deliveryMethod || d.deliveryType || d.fulfillmentType || 'pickup';
  const normalizedType = rawType === 'dineIn' ? 'dine_in' : rawType;

  return {
    id: docId,
    orderNumber: d.orderNumber || docId.slice(0, 6).toUpperCase(),
    // BusinessId: use businessId first, fallback to butcherId
    businessId: d.businessId || d.butcherId || '',
    businessName: d.businessName || d.butcherName || '',
    customerId: d.userId || d.customerId || '',
    customerName: d.customerName || d.userDisplayName || d.userName || '',
    customerPhone: d.customerPhone || d.userPhone || '',
    items: d.items || [],
    subtotal: d.subtotal || d.totalPrice || d.totalAmount || 0,
    deliveryFee: d.deliveryFee || 0,
    total: d.totalPrice || d.totalAmount || d.total || 0,
    // Status: use raw status, fallback to 'pending'
    status: d.status || 'pending',
    type: normalizedType,
    createdAt: d.createdAt,
    scheduledAt: d.scheduledDeliveryTime || d.deliveryDate || d.scheduledDateTime || d.pickupTime,
    isScheduledOrder: !!d.isScheduledOrder,
    address: d.deliveryAddress ? { street: d.deliveryAddress } : d.address,
    notes: d.notes || d.orderNote || d.customerNote || '',
    tableNumber: d.tableNumber,
    waiterName: d.waiterName,
    groupSessionId: d.groupSessionId,
    isGroupOrder: !!d.isGroupOrder,
    groupParticipantCount: d.groupParticipantCount || 0,
    paymentStatus: d.paymentStatus || 'unpaid',
    paymentMethod: d.paymentMethod,
    stripePaymentIntentId: d.stripePaymentIntentId,
    currency: d.currency,
    _raw: d,
  };
}

// ============================================================
// DATE FILTER HELPER
// ============================================================

export type DateFilter = 'today' | 'week' | 'month' | 'all';

function getStartDateForFilter(filter: DateFilter): Date {
  if (filter === 'all') return new Date(2020, 0, 1);
  
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  
  if (filter === 'week') date.setDate(date.getDate() - 7);
  else if (filter === 'month') date.setDate(date.getDate() - 30);
  // 'today' = start of today, already set
  
  return date;
}

// ============================================================
// ORDER STATUS CONSTANTS
// ============================================================

export const ORDER_STATUSES = {
  pending:   { label: 'Ausstehend',      color: 'yellow',  icon: '' },
  accepted:  { label: 'Bestatigt',       color: 'blue',    icon: '' },
  preparing: { label: 'In Zubereitung',  color: 'amber',   icon: '' },
  ready:     { label: 'Bereit',          color: 'green',   icon: '' },
  served:    { label: 'Serviert',        color: 'teal',    icon: '' },
  onTheWay:  { label: 'Unterwegs',       color: 'indigo',  icon: '' },
  delivered: { label: 'Geliefert',       color: 'emerald', icon: '' },
  completed: { label: 'Abgeschlossen',   color: 'emerald', icon: '' },
  cancelled: { label: 'Storniert',       color: 'red',     icon: '' },
} as const;

export const ORDER_TYPES = {
  pickup:   { label: 'Abholung',   icon: '', color: 'green' },
  delivery: { label: 'Lieferung',  icon: '', color: 'blue' },
  dine_in:  { label: 'Vor Ort',    icon: '', color: 'amber' },
} as const;

// ============================================================
// ORDERS CONTEXT - Shared state across components
// ============================================================

interface OrdersContextValue {
  /** All orders from Firestore for current date range and business */
  orders: Order[];
  /** Loading state */
  loading: boolean;
  /** Date filter - controls Firestore query range */
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  /** Status filter - client-side filtering */
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  /** Type filter - client-side filtering */
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  /** Business filter - for super admin to filter by business */
  businessFilter: string;
  setBusinessFilter: (b: string) => void;
  /** Orders after applying status/type/business filters */
  filteredOrders: Order[];
  /** Quick stats from filteredOrders */
  stats: {
    total: number;
    pending: number;
    preparing: number;
    ready: number;
    onTheWay: number;
    completed: number;
    cancelled: number;
    revenue: number;
  };
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

// ============================================================
// ORDERS PROVIDER
// ============================================================

interface OrdersProviderProps {
  children: ReactNode;
  /** If provided, only show orders for this business (partner view) */
  businessId?: string | null;
  /** Initial date filter, default 'all' */
  initialDateFilter?: DateFilter;
}

export function OrdersProvider({ 
  children, 
  businessId: fixedBusinessId,
  initialDateFilter = 'all',
}: OrdersProviderProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [businessFilter, setBusinessFilter] = useState('all');

  // Single Firestore listener
  useEffect(() => {
    setLoading(true);
    
    const startDate = getStartDateForFilter(dateFilter);
    
    const q = query(
      collection(db, 'meat_orders'),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let mapped = snapshot.docs.map(doc => mapDocToOrder(doc.id, doc.data()));
      
      // If fixedBusinessId is provided, filter server-side result client-side
      // This matches the Bestellzentrum approach: fetch all, filter by business
      if (fixedBusinessId) {
        mapped = mapped.filter(o => 
          o.businessId === fixedBusinessId || 
          o._raw.butcherId === fixedBusinessId
        );
      }
      
      setOrders(mapped);
      setLoading(false);
    }, (error) => {
      console.error('[useOrders] Error loading orders:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dateFilter, fixedBusinessId]);

  // Client-side filtering
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (typeFilter !== 'all' && order.type !== typeFilter) return false;
      if (businessFilter !== 'all' && order.businessId !== businessFilter) return false;
      return true;
    });
  }, [orders, statusFilter, typeFilter, businessFilter]);

  // Stats from filtered orders
  const stats = useMemo(() => ({
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => ['pending', 'accepted'].includes(o.status)).length,
    preparing: filteredOrders.filter(o => o.status === 'preparing').length,
    ready: filteredOrders.filter(o => o.status === 'ready').length,
    onTheWay: filteredOrders.filter(o => o.status === 'onTheWay').length,
    completed: filteredOrders.filter(o => ['delivered', 'served'].includes(o.status)).length,
    cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
    revenue: filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0),
  }), [filteredOrders]);

  const value = useMemo<OrdersContextValue>(() => ({
    orders,
    loading,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    businessFilter,
    setBusinessFilter,
    filteredOrders,
    stats,
  }), [orders, loading, dateFilter, statusFilter, typeFilter, businessFilter, filteredOrders, stats]);

  return (
    <OrdersContext.Provider value={value}>
      {children}
    </OrdersContext.Provider>
  );
}

// ============================================================
// useOrders HOOK
// ============================================================

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return ctx;
}

// ============================================================
// STANDALONE useOrders (no provider required)
// For pages that don't share state with other components
// ============================================================

export interface UseOrdersStandaloneOptions {
  businessId?: string | null;
  initialDateFilter?: DateFilter;
}

export function useOrdersStandalone(options: UseOrdersStandaloneOptions = {}) {
  const { businessId, initialDateFilter = 'all' } = options;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    const startDate = getStartDateForFilter(dateFilter);
    
    const q = query(
      collection(db, 'meat_orders'),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let mapped = snapshot.docs.map(doc => mapDocToOrder(doc.id, doc.data()));
      
      if (businessId) {
        mapped = mapped.filter(o => 
          o.businessId === businessId || 
          o._raw.butcherId === businessId
        );
      }
      
      setOrders(mapped);
      setLoading(false);
    }, (error) => {
      console.error('[useOrdersStandalone] Error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dateFilter, businessId]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (typeFilter !== 'all' && order.type !== typeFilter) return false;
      return true;
    });
  }, [orders, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => ['pending', 'accepted'].includes(o.status)).length,
    preparing: filteredOrders.filter(o => o.status === 'preparing').length,
    ready: filteredOrders.filter(o => o.status === 'ready').length,
    onTheWay: filteredOrders.filter(o => o.status === 'onTheWay').length,
    completed: filteredOrders.filter(o => ['delivered', 'served'].includes(o.status)).length,
    cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
    revenue: filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0),
  }), [filteredOrders]);

  return {
    orders,
    loading,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    filteredOrders,
    stats,
  };
}
