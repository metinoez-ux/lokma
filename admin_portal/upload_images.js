const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');
const path = require('path');

let app;
try {
  const serviceAccount = require('./serviceAccountKey.json');
  app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'aylar-a45af.appspot.com'
  });
} catch(e) {
  app = initializeApp({
    storageBucket: 'aylar-a45af.appspot.com'
  });
}

const bucket = getStorage(app).bucket();
const files = require('./optimized_images.json');
const uploadedUrls = {};

async function uploadAll() {
  for (const file of files) {
    if(!fs.existsSync(file)) {
      console.error('File not found:', file);
      continue;
    }
    const fileName = path.basename(file);
    const dest = `kermes_products/${fileName}`;
    console.log(`Uploading ${fileName}...`);
    try {
      await bucket.upload(file, {
        destination: dest,
        metadata: {
          cacheControl: 'public, max-age=31536000',
          contentType: 'image/jpeg'
        }
      });
      const fileRef = bucket.file(dest);
      await fileRef.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
      // save without 'img_' or 'media__' prefix for easier matching
      let key = fileName.replace('.jpg', '').replace('.webp', '');
      key = key.replace('img_', '').replace('media__', '').replace(/_\d+$/, '');
      uploadedUrls[key] = publicUrl;
      console.log(`Uploaded to ${publicUrl} with key ${key}`);
    } catch(err) {
      console.error('Upload failed for', fileName, err);
    }
  }
  fs.writeFileSync('uploaded_urls.json', JSON.stringify(uploadedUrls, null, 2));
  console.log('Finished uploading. Wrote to uploaded_urls.json');
}

uploadAll();
