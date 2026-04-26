import fs from 'fs';
import path from 'path';

const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/HardwareTabContent.tsx';
let content = fs.readFileSync(file, 'utf8');

// Regex to find each product block
const productRegex = /id:\s*"([^"]+)"([\s\S]*?)price:/g;

async function scrapeProduct(slug) {
  try {
    const res = await fetch(`https://www.sunmi.com/en/${slug}/`);
    if (!res.ok) return null;
    const html = await res.text();

    const mp4Regex = /https?:\/\/[^"'\s]+\.mp4/gi;
    const imgRegex = /https?:\/\/[^"'\s]+\.(png|jpg|jpeg)/gi;

    const mp4Matches = [...html.matchAll(mp4Regex)];
    const imgMatches = [...html.matchAll(imgRegex)];

    const uniqueMp4s = [...new Set(mp4Matches.map(m => m[0]))];
    const uniqueImgs = [...new Set(imgMatches.map(m => m[0]))]
      .filter(url => url.includes(slug) || url.includes(slug.split('-')[0])) // only relevant images
      .filter(url => !url.includes('logo') && !url.includes('footer') && !url.includes('icon')); // skip small ui elements

    return {
      videos: uniqueMp4s,
      images: uniqueImgs.slice(0, 8) // max 8 images
    };
  } catch (err) {
    return null;
  }
}

async function main() {
  const matches = [...content.matchAll(productRegex)];
  
  for (const match of matches) {
    const fullBlock = match[0];
    const id = match[1];
    
    // Convert sunmi_p3_family -> p3-family
    const slug = id.replace('sunmi_', '').replace(/_/g, '-');
    console.log(`Scraping ${slug}...`);
    
    const media = await scrapeProduct(slug);
    if (!media || (media.images.length === 0 && media.videos.length === 0)) {
       console.log(`No media found for ${slug}`);
       continue;
    }
    
    // Now we modify the block
    let newBlock = fullBlock;
    
    // Inject video if found
    if (media.videos.length > 0 && !newBlock.includes('video:')) {
       const tvc = media.videos.find(v => v.includes('tvc')) || media.videos.find(v => !v.includes('poster')) || media.videos[0];
       // insert video before images:
       newBlock = newBlock.replace(/image:\s*"[^"]+",/, `image: "$&",\n      video: "${tvc}",`);
    }

    // Replace images array if we found new images
    if (media.images.length > 1) {
       const imagesString = `images: [\n        "${media.images.join('",\n        "')}"\n      ],\n      price:`;
       if (newBlock.includes('images:')) {
          newBlock = newBlock.replace(/images:\s*\[[\s\S]*?\],\s*price:/, imagesString);
       } else {
          newBlock = newBlock.replace(/price:/, `${imagesString}`);
       }
    }
    
    content = content.replace(fullBlock, newBlock);
  }
  
  fs.writeFileSync(file, content, 'utf8');
  console.log("Done updating HardwareTabContent.tsx!");
}

main();
