import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirebaseMetrics } from '@/services/firebase_metrics';

export async function GET(request: NextRequest) {
    try {
        // Verify admin authentication
        const admin = getFirebaseAdmin();

        // Get service account key from environment
        const serviceAccountKey = process.env.ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountKey) {
            return NextResponse.json(
                { error: 'Service account not configured' },
                { status: 500 }
            );
        }

        // Fetch metrics
        const metrics = await getFirebaseMetrics(serviceAccountKey);

        return NextResponse.json(metrics);
    } catch (error) {
        console.error('Metrics API error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch metrics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
