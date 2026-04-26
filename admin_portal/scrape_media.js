const fs = require('fs');

async function scrapeMedia() {
  try {
    const res = await fetch('https://www.sunmi.com/en/p3-family/');
    const html = await res.text();
    
    const mp4Regex = /https?:\/\/[^"'\s]+\.mp4/gi;
    const imgRegex = /https?:\/\/[^"'\s]+\.(png|jpg|jpeg)/gi;

    const mp4Matches = [...html.matchAll(mp4Regex)];
    const imgMatches = [...html.matchAll(imgRegex)];
    
    const uniqueMp4s = [...new Set(mp4Matches.map(m => m[0]))];
    const uniqueImgs = [...new Set(imgMatches.map(m => m[0]))];

    console.log("Videos:", JSON.stringify(uniqueMp4s, null, 2));
    console.log("Images:", JSON.stringify(uniqueImgs.filter(url => url.includes('p3')), null, 2));
  } catch (err) {
    console.error(err);
  }
}

scrapeMedia();
