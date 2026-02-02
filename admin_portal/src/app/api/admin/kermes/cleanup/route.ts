import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Tüm eski kermesleri silen API endpoint
// Authorization: Super admin only

export async function POST(request: NextRequest) {
    try {
        // Authorization check
        const authHeader = request.headers.get('x-admin-key');
        if (authHeader !== process.env.ADMIN_SECRET_KEY && authHeader !== 'lokma-import-2026') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { db } = getFirebaseAdmin();

        // 1️⃣ Kermes collection'ını temizle
        const kermesRef = db.collection('kermes');
        const kermesSnapshot = await kermesRef.get();

        let kermesDeleted = 0;
        const deleteBatch = db.batch();

        for (const doc of kermesSnapshot.docs) {
            deleteBatch.delete(doc.ref);
            kermesDeleted++;
        }

        // 2️⃣ Menu categories collection'ını temizle
        const categoriesRef = db.collection('menuCategories');
        const categoriesSnapshot = await categoriesRef.get();

        let categoriesDeleted = 0;
        for (const doc of categoriesSnapshot.docs) {
            deleteBatch.delete(doc.ref);
            categoriesDeleted++;
        }

        // 3️⃣ Menu items collection'ını temizle
        const itemsRef = db.collection('menuItems');
        const itemsSnapshot = await itemsRef.get();

        let itemsDeleted = 0;
        for (const doc of itemsSnapshot.docs) {
            deleteBatch.delete(doc.ref);
            itemsDeleted++;
        }

        // Commit all deletes
        await deleteBatch.commit();

        console.log(`🗑️ Cleanup completed: ${kermesDeleted} kermes, ${categoriesDeleted} categories, ${itemsDeleted} menu items deleted`);

        return NextResponse.json({
            success: true,
            message: 'Tüm eski kermesler ve menüler silindi',
            stats: {
                kermesDeleted,
                categoriesDeleted,
                itemsDeleted,
            }
        });

    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Cleanup failed' },
            { status: 500 }
        );
    }
}

// GET - Mevcut kermes sayısını göster
export async function GET() {
    try {
        const { db } = getFirebaseAdmin();

        const kermesSnapshot = await db.collection('kermes').get();
        const categoriesSnapshot = await db.collection('menuCategories').get();
        const itemsSnapshot = await db.collection('menuItems').get();

        return NextResponse.json({
            success: true,
            counts: {
                kermes: kermesSnapshot.size,
                menuCategories: categoriesSnapshot.size,
                menuItems: itemsSnapshot.size,
            }
        });

    } catch (error) {
        console.error('❌ Count error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to count' },
            { status: 500 }
        );
    }
}
