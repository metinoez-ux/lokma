import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    const admin = await getFirebaseAdmin();
    
    // Generate a new temporary password
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%*+';
    let tempPassword = '';
    for(let i=0; i<10; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    tempPassword = tempPassword.replace(/./, chars.charAt(Math.floor(Math.random() * 26) + 26)); // ensure letter
    tempPassword = tempPassword.replace(/.$/, chars.charAt(Math.floor(Math.random() * 10) + 52)); // ensure number/symbol
    
    // Update user password in Firebase Auth
    await admin.auth.updateUser(uid, {
      password: tempPassword
    });

    return NextResponse.json({ success: true, tempPassword });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: error.message || 'Error returning new password' }, { status: 500 });
  }
}
