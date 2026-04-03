export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { decryptApiKey } from '@/lib/crypto';

/**
 * Server-side proxy for Imagen 4 image generation.
 * Reads the API key from encrypted Firestore vault → never exposed to client.
 */

const CONFIG_DOC = 'config/apiKeys';
const IMAGEN_KEY_ID = 'imagen';

// ── Auth helper: verify Firebase token (any admin) ─────────────────
async function verifyAdmin(req: NextRequest): Promise<boolean> {
 try {
 const authHeader = req.headers.get('Authorization');
 if (!authHeader?.startsWith('Bearer ')) return false;

 const token = authHeader.split('Bearer ')[1];
 const { auth, db } = getFirebaseAdmin();
 const decodedToken = await auth.verifyIdToken(token);

 // Check admin status
 const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();
 return adminDoc.exists && !!adminDoc.data();
 } catch {
 return false;
 }
}

// ── POST: Generate image via Imagen 4 ─────────────────
export async function POST(req: NextRequest) {
 const isAdmin = await verifyAdmin(req);
 if (!isAdmin) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 try {
 const { prompt, aspectRatio } = await req.json();
 if (!prompt) {
 return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
 }

 // Get encrypted Imagen key from vault
 const { db } = getFirebaseAdmin();
 const configDoc = await db.doc(CONFIG_DOC).get();
 const configData = configDoc.data();
 const imagenEntry = configData?.[IMAGEN_KEY_ID];

 if (!imagenEntry?.encryptedValue) {
 return NextResponse.json(
 { error: 'Imagen API key not configured. Go to Settings → API Keys to add it.' },
 { status: 400 }
 );
 }

 const apiKey = decryptApiKey(imagenEntry.encryptedValue);

 // Call Imagen 4 API
 const response = await fetch(
 `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
 {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 instances: [{ prompt }],
 parameters: {
 sampleCount: 1,
 aspectRatio: aspectRatio || '1:1',
 },
 }),
 }
 );

 if (!response.ok) {
 const errorData = await response.json().catch(() => ({}));
 const errorMsg = errorData?.error?.message || `Imagen API error: ${response.status}`;
 return NextResponse.json({ error: errorMsg }, { status: response.status });
 }

 const result = await response.json();
 const imageData = result.predictions?.[0]?.bytesBase64Encoded;

 if (!imageData) {
 return NextResponse.json({ error: 'No image returned from API' }, { status: 500 });
 }

 return NextResponse.json({ imageBase64: imageData });
 } catch (error: any) {
 console.error('Image generation error:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
