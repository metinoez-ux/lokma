import fs from 'fs';

const html = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/temp_specs.html', 'utf8');

const specsRegex = /<h[34][^>]*>(.*?)<\/h[34]>\s*<p[^>]*>(.*?)<\/p>/gi;
const matches = [...html.matchAll(specsRegex)];

if (matches.length > 0) {
  matches.forEach(m => {
    const key = m[1].replace(/<[^>]+>/g, '').trim();
    const val = m[2].replace(/<[^>]+>/g, '').trim();
    if (key && val) {
       console.log(`${key}: ${val}`);
    }
  });
} else {
  console.log("No h3/p matches found. Trying div lists...");
  const listRegex = /<li[^>]*>\s*<span[^>]*>(.*?)<\/span>\s*<span[^>]*>(.*?)<\/span>/gi;
  const listMatches = [...html.matchAll(listRegex)];
  listMatches.forEach(m => {
    const key = m[1].replace(/<[^>]+>/g, '').trim();
    const val = m[2].replace(/<[^>]+>/g, '').trim();
    console.log(`${key}: ${val}`);
  });
}
