import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { B2BOrder } from '@/types';

const COLLECTION = 'b2b_orders';

/**
 * Fetch orders for a butcher.
 */
export const getOrders = async (butcherId: string, limitCount = 50): Promise<B2BOrder[]> => {
    try {
        const q = query(
            collection(db, COLLECTION),
            where('butcherId', '==', butcherId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)); // Date conversion usually handled by client or specialized converter
    } catch (error) {
        console.error('Error fetching orders:', error);
        throw error;
    }
};

/**
 * Create a new order.
 */
export const addOrder = async (orderData: Partial<B2BOrder>) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION), {
            ...orderData,
            createdAt: serverTimestamp(),
            // Ensure status is at least 'draft'
            status: orderData.status || 'draft'
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
};

/**
 * Update order status (e.g., from 'draft' to 'sent').
 */
export const updateOrderStatus = async (orderId: string, status: B2BOrder['status'], method?: B2BOrder['method']) => {
    try {
        const updateData: any = { status };
        if (method) updateData.method = method;
        if (status === 'sent') updateData.sentAt = serverTimestamp();

        await updateDoc(doc(db, COLLECTION, orderId), updateData);
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
};
