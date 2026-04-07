const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const imagesDir = '/Users/metinoz/.gemini/antigravity/brain/3df1b37e-9149-4b4f-9986-5d490f34f869';
const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.png'));

console.log(`Found ${files.length} images to optimize.`);

const uploadCommands = [];

for (const file of files) {
  const filePath = path.join(imagesDir, file);
  const outFileName = file.replace('.png', '.webp');
  const outPath = path.join(imagesDir, outFileName);
  
  try {
    // Try using sharp if available via Node
    require('child_process').execSync(`npx sharp -i "${filePath}" -o "${outPath}" resize 500 webp`);
  } catch (e) {
    try {
      // Fallback: sips on macOS to convert to HEIC or jpeg, but we want webp
      // sips can convert to jpeg
      const outJpegPath = outPath.replace('.webp', '.jpg');
      require('child_process').execSync(`sips -s format jpeg -Z 500 "${filePath}" --out "${outJpegPath}"`);
      console.log(`Optimized ${file} to ${outJpegPath} using sips`);
      uploadCommands.push(outJpegPath);
    } catch(err) {
      console.error(`Failed to optimize ${file}`);
    }
    continue;
  }
  console.log(`Optimized ${file} to webp using sharp`);
  uploadCommands.push(outPath);
}

// Upload via firebase cli? Or via gsutil? 
// Let's use gsutil or similar if available, or write a script next step.
fs.writeFileSync('optimized_images.json', JSON.stringify(uploadCommands, null, 2));

