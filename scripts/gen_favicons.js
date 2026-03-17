const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_IMAGE = '/Users/metinoz/Library/CloudStorage/SynologyDrive-Mtn/LOKMA/grafik/AppIcons/appstore.png';
const ADMIN_PUBLIC_DIR = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/public';
const LANDING_PUBLIC_DIR = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/landing_page';

async function generateFavicons() {
  try {
    // 1. icon-192.png
    await sharp(SOURCE_IMAGE)
      .resize(192, 192)
      .toFile(path.join(ADMIN_PUBLIC_DIR, 'icon-192.png'));
    
    // 2. icon-512.png
    await sharp(SOURCE_IMAGE)
      .resize(512, 512)
      .toFile(path.join(ADMIN_PUBLIC_DIR, 'icon-512.png'));

    // 3. apple-touch-icon.png
    await sharp(SOURCE_IMAGE)
      .resize(180, 180)
      .toFile(path.join(ADMIN_PUBLIC_DIR, 'apple-touch-icon.png'));

    // 4. favicon.png (if used, let's just make it 512x512 to match logo)
    await sharp(SOURCE_IMAGE)
      .resize(512, 512)
      .toFile(path.join(ADMIN_PUBLIC_DIR, 'favicon.png'));

    // 5. favicon.ico - We can just resize to 32x32 and save as png, or use sharp's raw to create ico (sharp doesn't natively support ico write easily, so many just use a 32x32 PNG renamed or just serve a PNG. Let's make a 32x32 png).
    // Some browsers strictly want .ico, but modern ones are perfectly fine with a renamed png or explicitly serving image/png for .ico. To be safe, we'll write a 32x32 PNG but save it with .ico extension - it works for 99% of frameworks including NextJS.
    await sharp(SOURCE_IMAGE)
      .resize(32, 32)
      .toFormat('png')
      .toFile(path.join(ADMIN_PUBLIC_DIR, 'favicon.ico'));

    // 6. landing page favicon.png / favicon.ico
    await sharp(SOURCE_IMAGE)
      .resize(32, 32)
      .toFormat('png')
      .toFile(path.join(LANDING_PUBLIC_DIR, 'favicon.ico'));
      
    await sharp(SOURCE_IMAGE)
      .resize(180, 180)
      .toFile(path.join(LANDING_PUBLIC_DIR, 'apple-touch-icon.png'));

    console.log('Successfully generated all favicons!');
  } catch (error) {
    console.error('Error generating favicons:', error);
  }
}

generateFavicons();
