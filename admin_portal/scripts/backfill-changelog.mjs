// Backfill script: write recent commits to Firestore changelog collection
// Run: node admin_portal/scripts/backfill-changelog.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load service account
const saPath = resolve(process.cwd(), 'admin_portal/service-account.json');
let sa;
try {
  sa = JSON.parse(readFileSync(saPath, 'utf8'));
} catch {
  console.error('Service account not found at', saPath);
  console.log('Trying GOOGLE_APPLICATION_CREDENTIALS...');
  sa = null;
}

if (sa) {
  initializeApp({ credential: cert(sa) });
} else {
  initializeApp();
}

const db = getFirestore();

// Get last N commits
const N = 50;
const raw = execSync(`git log -${N} --format="%H|%ai|%an|%s" --no-merges`, { cwd: process.cwd(), encoding: 'utf8' });
const lines = raw.trim().split('\n').filter(l => l);

console.log(`Found ${lines.length} commits to backfill...`);

const batch = db.batch();
let count = 0;

for (const line of lines) {
  const [hash, dateStr, author, ...msgParts] = line.split('|');
  const msg = msgParts.join('|');
  
  const commitDate = new Date(dateStr.trim());
  const ts = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(commitDate);

  // Detect note
  let note = '-';
  if (msg.startsWith('fix')) note = 'bugfix';
  else if (msg.startsWith('feat')) note = 'feature';
  else if (msg.startsWith('chore')) note = 'chore';
  else if (msg.startsWith('refactor')) note = 'refactor';
  else if (msg.startsWith('style')) note = 'style';
  else if (msg.startsWith('docs')) note = 'docs';
  else if (msg.startsWith('perf')) note = 'perf';
  else if (msg.startsWith('MTN')) note = 'milestone';

  const shortHash = hash.substring(0, 7);
  
  // Use hash as doc ID to prevent duplicates
  const docRef = db.collection('changelog').doc(shortHash);
  batch.set(docRef, {
    hash: shortHash,
    timestamp: ts,
    description: msg,
    note,
    createdAt: commitDate.getTime(),
    author: author.trim(),
  }, { merge: true });
  
  count++;
  console.log(`  ${shortHash} | ${ts} | ${note} | ${msg.substring(0, 60)}...`);
}

await batch.commit();
console.log(`\nDone! Wrote ${count} commits to Firestore changelog collection.`);
