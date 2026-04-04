"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onKermesOrderCancelledStock = exports.onKermesOrderPaidStock = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const db = admin.firestore();
/**
 * Kermes Siparis ODEME YAPILINCA (isPaid: false -> true):
 * 1. Her urun icin stok azalt (currentStock -= quantity)
 * 2. Stok 0'a dusunce isAvailable = false yap
 * 3. product_sales sub-collection'a satis kaydi yaz (Hybrid A)
 * 4. Root-level kermes_product_sales'a da yaz (Hybrid B - cross-kermes sorgular icin)
 */
exports.onKermesOrderPaidStock = (0, firestore_1.onDocumentUpdated)({
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    // --- ODEME TRIGGER: isPaid false -> true ---
    const wasPaid = before.isPaid === true;
    const isPaid = after.isPaid === true;
    if (wasPaid || !isPaid)
        return; // Zaten odenmi veya hala odenmemis, atla
    const orderId = event.params.orderId;
    const kermesId = after.kermesId;
    const items = after.items;
    const tableSection = after.tableSection;
    const sectionLabel = after.tableSectionLabel || tableSection || "";
    const orderNumber = after.orderNumber || "";
    const deliveryType = after.deliveryType || "gelAl";
    if (!kermesId || !items || items.length === 0)
        return;
    console.log(`[KermesStock] Siparis ${orderId} ODENDI, stok azaltiliyor ve satis kaydi yaziliyor...`);
    // Kermes tarihini al (gun bazli gruplama icin)
    const now = new Date();
    const kermesDate = now.toISOString().slice(0, 10); // "2026-04-05"
    const batch = db.batch();
    let stockUpdated = 0;
    for (const item of items) {
        const productId = item.productId || item.id;
        const productName = item.name || item.productName || "";
        const quantity = item.quantity || 1;
        const unitPrice = item.price || item.unitPrice || 0;
        const totalPrice = unitPrice * quantity;
        const category = item.category || "";
        if (!productId)
            continue;
        // 1. Stok azalt (stockEnabled olan urunler icin)
        const productRef = db
            .collection("kermes_events")
            .doc(kermesId)
            .collection("products")
            .doc(productId);
        try {
            const productDoc = await productRef.get();
            if (productDoc.exists) {
                const productData = productDoc.data();
                const stockEnabled = productData.stockEnabled === true;
                if (stockEnabled) {
                    const currentStock = productData.currentStock || 0;
                    const newStock = Math.max(0, currentStock - quantity);
                    const lowStockThreshold = productData.lowStockThreshold || 5;
                    const stockUpdate = {
                        currentStock: newStock,
                        lastStockUpdateAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastStockUpdateBy: "system_payment",
                    };
                    // Stok 0'a dustuyse otomatik unavailable yap
                    if (newStock <= 0) {
                        stockUpdate.isAvailable = false;
                        console.log(`[KermesStock] ${productName} (${productId}): TUKENDI! Stok 0.`);
                    }
                    else if (newStock <= lowStockThreshold) {
                        console.log(`[KermesStock] ${productName} (${productId}): Dusuk stok uyarisi! Kalan: ${newStock}`);
                    }
                    batch.update(productRef, stockUpdate);
                    stockUpdated++;
                }
            }
        }
        catch (err) {
            console.error(`[KermesStock] Stok guncelleme hatasi (${productId}):`, err);
        }
        // 2. HYBRID A: Satis kaydini sub-collection'a yaz
        const saleData = {
            productId,
            productName,
            productCategory: category,
            quantity,
            unitPrice,
            totalPrice,
            section: tableSection || "bilinmiyor",
            sectionLabel: sectionLabel || "Bilinmiyor",
            orderId,
            orderNumber,
            deliveryType,
            soldAt: admin.firestore.FieldValue.serverTimestamp(),
            kermesDate,
        };
        const subSaleRef = db
            .collection("kermes_events")
            .doc(kermesId)
            .collection("product_sales")
            .doc();
        batch.set(subSaleRef, saleData);
        // 3. HYBRID B: Root-level satis kaydini da yaz (cross-kermes sorgular icin)
        const rootSaleRef = db.collection("kermes_product_sales").doc();
        batch.set(rootSaleRef, {
            ...saleData,
            kermesId,
        });
    }
    try {
        await batch.commit();
        if (stockUpdated > 0) {
            console.log(`[KermesStock] Siparis ${orderId}: ${stockUpdated} urun stogu guncellendi (odeme sonrasi)`);
        }
        console.log(`[KermesStock] Siparis ${orderId}: ${items.length} satis kaydi yazildi`);
    }
    catch (err) {
        console.error(`[KermesStock] Batch commit hatasi:`, err);
    }
});
/**
 * Kermes Siparis Iptal Edilince (status -> cancelled):
 * 1. Stok geri ekle (currentStock += quantity)
 * 2. Urun tekrar available yap (eger stok > 0 ise)
 * NOT: Bu ayni onDocumentUpdated trigger altinda calisiyor.
 *      isPaid ve cancelled ayri kosullar oldugu icin
 *      her ikisi de ayni function icinde kontrol edilebilir,
 *      ama okunabilirlik icin ayri export yapiyoruz.
 */
exports.onKermesOrderCancelledStock = (0, firestore_1.onDocumentUpdated)({
    document: "kermes_orders/{orderId}",
    region: "europe-west1",
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    // Sadece status "cancelled" oldugunda calis
    if (before.status === after.status)
        return;
    if (after.status !== "cancelled")
        return;
    if (before.status === "cancelled")
        return;
    const orderId = event.params.orderId;
    const kermesId = after.kermesId;
    const items = after.items;
    if (!kermesId || !items || items.length === 0)
        return;
    console.log(`[KermesStock] Siparis ${orderId} iptal edildi, stok geri ekleniyor...`);
    const batch = db.batch();
    let restored = 0;
    for (const item of items) {
        const productId = item.productId || item.id;
        const quantity = item.quantity || 1;
        if (!productId)
            continue;
        const productRef = db
            .collection("kermes_events")
            .doc(kermesId)
            .collection("products")
            .doc(productId);
        try {
            const productDoc = await productRef.get();
            if (productDoc.exists) {
                const productData = productDoc.data();
                const stockEnabled = productData.stockEnabled === true;
                if (stockEnabled) {
                    const currentStock = productData.currentStock || 0;
                    const newStock = currentStock + quantity;
                    batch.update(productRef, {
                        currentStock: newStock,
                        isAvailable: true,
                        lastStockUpdateAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastStockUpdateBy: "system_cancel",
                    });
                    restored++;
                }
            }
        }
        catch (err) {
            console.error(`[KermesStock] Stok geri ekleme hatasi (${productId}):`, err);
        }
    }
    try {
        await batch.commit();
        console.log(`[KermesStock] Siparis ${orderId}: ${restored} urun stogu geri eklendi`);
    }
    catch (err) {
        console.error(`[KermesStock] Batch commit hatasi:`, err);
    }
});
//# sourceMappingURL=kermesStockFunctions.js.map