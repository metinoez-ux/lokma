const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.join(__dirname, '../missing_i18n_report.json');
const MESSAGES_DIR = path.join(__dirname, '../messages');
const SRC_DIR = path.join(__dirname, '../');

async function fix() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error("Report not found at", REPORT_PATH);
    return;
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  console.log(`Found ${report.length} missing keys in report.`);

  // Load locale files
  const locales = ['tr', 'en', 'de', 'es', 'fr', 'it', 'nl'];
  const localeData = {};
  for (const locale of locales) {
    const p = path.join(MESSAGES_DIR, `${locale}.json`);
    if (fs.existsSync(p)) {
      localeData[locale] = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } else {
      localeData[locale] = {};
    }
  }

  function setNestedValue(obj, pathString, value) {
    const parts = pathString.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  let fixedCount = 0;
  let notFoundCount = 0;

  // Group by file to reduce reads
  const fileGroups = {};
  for (const entry of report) {
    if (!fileGroups[entry.file]) fileGroups[entry.file] = [];
    fileGroups[entry.file].push(entry);
  }

  for (const file in fileGroups) {
    const relativeFile = file.startsWith('/') ? file.slice(1) : file;
    const absolutePath = path.join(SRC_DIR, relativeFile);
    if (!fs.existsSync(absolutePath)) {
      console.warn("File not found:", absolutePath);
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const entries = fileGroups[file];

    for (const entry of entries) {
      // Look for t('key') || 'Fallback'
      // Or t("key") || "Fallback"
      // Escape key for regex
      const escapedKey = entry.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Regex to match: t('key') || 'Fallback'
      const regex1 = new RegExp(`${entry.func}\\s*\\(\\s*['"]${escapedKey}['"]\\s*\\)\\s*\\|\\|\\s*['"]([^'"]+)['"]`);
      // Also match without quotes if they are using backticks: \`Fallback\`
      const regex2 = new RegExp(`${entry.func}\\s*\\(\\s*['"]${escapedKey}['"]\\s*\\)\\s*\\|\\|\\s*\`([^\`]+)\``);

      let match = content.match(regex1) || content.match(regex2);
      
      let fallbackText = '';
      if (match) {
        fallbackText = match[1];
      } else {
        // sometimes there is no fallback, or it is multiline. Just use the last part of the key as fallback
        fallbackText = entry.key.split('.').pop();
        // Capitalize and replace underscores
        fallbackText = fallbackText.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
        notFoundCount++;
      }

      // Special case: fullKey tells us where to put it in the JSON
      // e.g. "AdminCustomerService.cancelModal.reasons.outOfStock"
      
      const targetPath = entry.fullKey || entry.key;

      for (const locale of locales) {
        if (localeData[locale]) {
          setNestedValue(localeData[locale], targetPath, fallbackText);
        }
      }
      fixedCount++;
    }
  }

  console.log(`Extracted/generated fallbacks for ${fixedCount} keys. (${notFoundCount} guessed from key name)`);

  // Save back to JSON
  for (const locale of locales) {
    if (localeData[locale]) {
      const p = path.join(MESSAGES_DIR, `${locale}.json`);
      fs.writeFileSync(p, JSON.stringify(localeData[locale], null, 2) + '\\n');
      console.log(`Updated ${locale}.json`);
    }
  }
}

fix().catch(console.error);
