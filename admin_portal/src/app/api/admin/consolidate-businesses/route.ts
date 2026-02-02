/**
 * Consolidation API: Check status of businesses/butcher_partners migration
 * 
 * GET /api/admin/consolidate-businesses - Check current status
 * POST /api/admin/consolidate-businesses - Run consolidation (already completed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    // Security check
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.MIGRATION_ADMIN_KEY || 'migrate-2026';

    if (adminKey !== expectedKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { db } = getFirebaseAdmin();

        // Update admins collection - add businessId alongside butcherId
        console.log('📋 Updating admins collection...');
        const adminsSnapshot = await db.collection('admins').get();
        let adminsUpdated = 0;

        const batchSize = 500;
        let batch = db.batch();
        let batchCount = 0;

        for (const doc of adminsSnapshot.docs) {
            const data = doc.data();
            const updates: Record<string, any> = {};

            // Add businessId if butcherId exists
            if (data.butcherId && !data.businessId) {
                updates.businessId = data.butcherId;
            }

            // Add businessName if butcherName exists
            if (data.butcherName && !data.businessName) {
                updates.businessName = data.butcherName;
            }

            if (Object.keys(updates).length > 0) {
                batch.update(doc.ref, updates);
                batchCount++;
                adminsUpdated++;
            }

            if (batchCount >= batchSize) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        // Verify
        const businessesCount = (await db.collection('businesses').count().get()).data().count;

        const result = {
            success: true,
            message: 'Admin fields updated',
            stats: {
                adminsUpdated,
                businessesCount
            }
        };

        console.log('🎉 Update complete!', result);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('❌ Update failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// GET endpoint to check current status
export async function GET() {
    try {
        const { db } = getFirebaseAdmin();

        const businessesCount = (await db.collection('businesses').count().get()).data().count;

        // Check admins with butcherId vs businessId
        const adminsSnapshot = await db.collection('admins').get();
        let withButcherId = 0;
        let withBusinessId = 0;
        let withBoth = 0;

        for (const doc of adminsSnapshot.docs) {
            const data = doc.data();
            const hasButcherId = !!data.butcherId;
            const hasBusinessId = !!data.businessId;

            if (hasButcherId && hasBusinessId) withBoth++;
            else if (hasButcherId) withButcherId++;
            else if (hasBusinessId) withBusinessId++;
        }

        return NextResponse.json({
            businessesCount,
            admins: {
                total: adminsSnapshot.size,
                withButcherIdOnly: withButcherId,
                withBusinessIdOnly: withBusinessId,
                withBoth
            },
            status: withButcherId === 0 ? 'COMPLETED' : 'NEEDS_UPDATE'
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
