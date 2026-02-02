import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Check environment variables
        const envCheck = {
            hasAdminServiceAccount: !!process.env.ADMIN_SERVICE_ACCOUNT,
            hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
            adminServiceAccountLength: process.env.ADMIN_SERVICE_ACCOUNT?.length || 0,
            firebaseServiceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
        };

        return NextResponse.json({
            success: true,
            message: 'Env check completed',
            envCheck,
        });
    } catch (error) {
        return NextResponse.json({
            error: 'Check failed',
            details: String(error),
        }, { status: 500 });
    }
}
