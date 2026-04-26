const fs = require('fs');

async function scrapeVideos() {
  try {
    const res = await fetch('https://www.sunmi.com/en/p3-family/');
    const html = await res.text();
    
    const mp4Regex = /https?:\/\/[^"']+\.mp4/gi;
    const matches = [...html.matchAll(mp4Regex)];
    
    const uniqueMatches = [...new Set(matches.map(m => m[0]))];
    console.log(JSON.stringify(uniqueMatches, null, 2));
  } catch (err) {
    console.error(err);
  }
}

scrapeVideos();
