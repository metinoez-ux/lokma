import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { Supplier, SupplierCategory } from '@/types';

const COLLECTION = 'butcher_suppliers';

/**
 * Fetch all suppliers for a specific butcher.
 */
export const getSuppliers = async (butcherId: string): Promise<Supplier[]> => {
    try {
        const q = query(
            collection(db, COLLECTION),
            where('butcherId', '==', butcherId),
            orderBy('name', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
    }
};

/**
 * Add a new supplier.
 */
export const addSupplier = async (butcherId: string, data: Partial<Supplier>) => {
    try {
        await addDoc(collection(db, COLLECTION), {
            ...data,
            butcherId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error adding supplier:', error);
        throw error;
    }
};

/**
 * Update an existing supplier.
 */
export const updateSupplier = async (id: string, data: Partial<Supplier>) => {
    try {
        const docRef = doc(db, COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating supplier:', error);
        throw error;
    }
};

/**
 * Delete a supplier.
 */
export const deleteSupplier = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION, id));
    } catch (error) {
        console.error('Error deleting supplier:', error);
        throw error;
    }
};
