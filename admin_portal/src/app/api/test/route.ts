import { NextRequest, NextResponse } from 'next/server';

// Minimal test endpoint - no firebase-admin imports
export async function POST(request: NextRequest) {
    return NextResponse.json({
        test: true,
        message: 'Test endpoint works!',
        timestamp: new Date().toISOString()
    });
}

export async function GET(request: NextRequest) {
    return NextResponse.json({
        test: true,
        message: 'Test endpoint works (GET)!',
        timestamp: new Date().toISOString()
    });
}
