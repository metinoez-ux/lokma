// =============================================================================
// MIRA INVENTORY MANAGEMENT - TypeScript Types
// Synchronized with Flutter: lib/data/inventory_management.dart
// =============================================================================

// Inventory Movement Type
export type InventoryMovementType =
    | 'giris'     // Stock In
    | 'cikis'     // Stock Out
    | 'duzeltme'  // Adjustment
    | 'transfer'  // Transfer
    | 'iade'      // Returned
    | 'skt';      // Expired

export const MOVEMENT_TYPES: Record<InventoryMovementType, string> = {
    giris: 'Stok Girişi',
    cikis: 'Stok Çıkışı',
    duzeltme: 'Düzeltme',
    transfer: 'Transfer',
    iade: 'İade',
    skt: 'SKT Geçmiş',
};

// Inventory Entry - ERP style stock tracking
export interface InventoryEntry {
    id: string;
    vendorId: string;
    masterProductSku: string;

    // Quantities
    quantity: number;
    unitType: string;

    // Tracking Numbers (ERP)
    chargeNumber?: string;    // Şarj numarası
    batchNumber?: string;     // Parti numarası
    lotNumber?: string;       // Lot numarası
    invoiceNumber?: string;   // Fatura numarası
    supplierCode?: string;    // Tedarikçi kodu

    // Dates
    entryDate: Date;          // Giriş tarihi (otomatik)
    productionDate?: Date;    // Üretim tarihi
    expirationDate?: Date;    // SKT

    // Movement
    movementType: InventoryMovementType;
    notes?: string;
    createdByUserId?: string;

    // Pricing
    purchasePrice?: number;   // Alış fiyatı
    sellingPrice?: number;    // Satış fiyatı
}

// Stock Summary
export interface StockSummary {
    vendorId: string;
    masterProductSku: string;
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    earliestExpiration?: Date;
    batchCount: number;
    batches: InventoryEntry[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function isExpired(entry: InventoryEntry): boolean {
    if (!entry.expirationDate) return false;
    return new Date() > new Date(entry.expirationDate);
}

export function daysUntilExpiration(entry: InventoryEntry): number | null {
    if (!entry.expirationDate) return null;
    const diff = new Date(entry.expirationDate).getTime() - new Date().getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(entry: InventoryEntry, days = 3): boolean {
    const daysLeft = daysUntilExpiration(entry);
    return daysLeft !== null && daysLeft <= days;
}

export function generateTrackingCode(entry: InventoryEntry): string {
    const parts = [entry.masterProductSku];
    if (entry.chargeNumber) parts.push(`CH${entry.chargeNumber}`);
    if (entry.batchNumber) parts.push(`B${entry.batchNumber}`);
    if (entry.lotNumber) parts.push(`L${entry.lotNumber}`);
    return parts.join('-');
}

// Create stock-in entry with auto date
export function createStockInEntry(
    params: Omit<InventoryEntry, 'id' | 'entryDate' | 'movementType'>
): Omit<InventoryEntry, 'id'> {
    return {
        ...params,
        entryDate: new Date(),
        movementType: 'giris',
    };
}
