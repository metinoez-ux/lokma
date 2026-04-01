import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
    // AUTHENTICATION CHECK
    const authResult = await verifyApiAuth(request);
    if (authResult instanceof NextResponse) {
        return authResult; // Unauthorized
    }
    const verifiedAdmin = authResult;

    // We can restrict to super admins or let all admins see it. 
    // Since it's just auth providers (not sensitive data besides login method), 
    // it's generally safe for admins who already see the users list.

    let auth;
    try {
        const admin = getFirebaseAdmin();
        auth = admin.auth;
    } catch (initError) {
        console.error('Firebase Admin init error:', initError);
        return NextResponse.json({
            error: 'Firebase Admin initialization failed',
            details: initError instanceof Error ? initError.message : String(initError),
        }, { status: 500 });
    }

    try {
        const providerMap: Record<string, string[]> = {};
        
        // Fetch all users using pagination
        let pageToken: string | undefined = undefined;
        let batchCount = 0;
        const maxBatches = 50; // Max 50,000 users just to prevent infinite loops

        do {
            const listUsersResult: any = await auth.listUsers(1000, pageToken);
            
            for (const user of listUsersResult.users) {
                // Determine providers
                const providers: string[] = [];
                for (const provider of user.providerData) {
                    if (provider.providerId) {
                        providers.push(provider.providerId);
                    }
                }
                
                // If the user has a customProvider or logged in anonymously, providerData might be empty.
                if (providers.length > 0) {
                    providerMap[user.uid] = providers;
                }
            }

            pageToken = listUsersResult.pageToken;
            batchCount++;
        } while (pageToken && batchCount < maxBatches);

        return NextResponse.json({ providerMap });

    } catch (error) {
        console.error('Fetch Auth Providers error:', error);
        return NextResponse.json({
            error: 'Could not fetch auth providers',
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
