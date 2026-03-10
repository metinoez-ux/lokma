import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

/**
 * Stripe Terminal Connection Token
 * Flutter SDK'nın terminal reader'a bağlanabilmesi için backend'den token alır.
 * Her SDK başlatmasında bir kez çağrılır.
 */
export async function POST() {
    try {
        const connectionToken = await stripe.terminal.connectionTokens.create();
        return NextResponse.json({ secret: connectionToken.secret });
    } catch (error: any) {
        console.error('[Terminal] Connection token error:', error);
        return NextResponse.json(
            { error: error.message || 'Connection token creation failed' },
            { status: 500 }
        );
    }
}
