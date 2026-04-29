import { getStorage } from 'firebase-admin/storage';
import { getFirebaseAdmin } from './src/lib/firebase-admin';

async function test() {
  const { storage } = getFirebaseAdmin();
  // list files in kermes_parking
  const [files] = await storage.bucket().getFiles({ prefix: 'kermes/' });
  if (files.length > 0) {
    const file = files[files.length - 1];
    const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });
    console.log("Admin Signed URL:", url);
    // But the frontend uses getDownloadURL! The frontend gets a Firebase storage token url.
    // Let's look at the metadata.
    const [metadata] = await file.getMetadata();
    console.log("Firebase Download Tokens:", metadata.metadata?.firebaseStorageDownloadTokens);
    
    if (metadata.metadata?.firebaseStorageDownloadTokens) {
      const bucket = file.bucket.name;
      const path = encodeURIComponent(file.name);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${path}?alt=media&token=${metadata.metadata.firebaseStorageDownloadTokens}`;
      console.log("Frontend Public URL:", publicUrl);
    }
  }
}

test().catch(console.error);
