#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-alphamissense.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-alphamissense.sh <db_path> <downloads_dir>}"

echo "    AlphaMissense: fetching scores via MyVariant.info API..."

node --input-type=module -e "
import Database from 'better-sqlite3';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

const rsids = new Set();
try {
  for (const r of db.prepare('SELECT DISTINCT rsid FROM clinvar WHERE rsid IS NOT NULL AND rsid LIKE ?').iterate('rs%'))
    rsids.add(r.rsid);
} catch(e) {}
try {
  for (const r of db.prepare('SELECT DISTINCT rsid FROM gwas WHERE rsid IS NOT NULL AND rsid LIKE ?').iterate('rs%'))
    rsids.add(r.rsid);
} catch(e) {}

if (rsids.size === 0) {
  console.log('    AlphaMissense: no rsIDs in database yet — run ClinVar/GWAS first');
  db.close(); process.exit(0);
}
console.log('    AlphaMissense: querying ' + rsids.size.toLocaleString() + ' rsIDs...');

db.exec('DELETE FROM alphamissense');
const insert = db.prepare(\`INSERT OR IGNORE INTO alphamissense
  (chromosome, position, ref_allele, alt_allele, gene, transcript, protein_change, score, classification)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`);

const BATCH = 900;
const rsidList = [...rsids];
let inserted = 0, batches = 0;
const startTime = Date.now();
const idRegex = /chr(\w+):g\.(\d+)([A-Z])>([A-Z])/;

for (let i = 0; i < rsidList.length; i += BATCH) {
  const batch = rsidList.slice(i, i + BATCH);
  batches++;
  
  try {
    const body = new URLSearchParams({
      q: batch.join(','), scopes: 'dbsnp.rsid',
      fields: 'dbnsfp.alphamissense.score,dbnsfp.alphamissense.pred,dbnsfp.genename,_id',
      size: String(BATCH), dotfield: 'true'
    });
    
    const resp = await fetch('https://myvariant.info/v1/query', {
      method: 'POST', body,
      headers: { 'User-Agent': 'HelixGenomics/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (!resp.ok) { await new Promise(r => setTimeout(r, 5000)); continue; }
    const results = await resp.json();
    if (!Array.isArray(results)) continue;
    
    const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
    const rows = [];
    
    for (const hit of results) {
      if (!hit || hit.notfound) continue;
      let score = hit['dbnsfp.alphamissense.score'];
      if (score == null) continue;
      if (Array.isArray(score)) score = Math.max(...score);
      score = parseFloat(score);
      if (isNaN(score)) continue;
      
      let cls = hit['dbnsfp.alphamissense.pred'];
      if (Array.isArray(cls)) cls = cls[0];
      // Map single letter to full name
      if (cls === 'P') cls = 'likely_pathogenic';
      else if (cls === 'B') cls = 'likely_benign';
      else if (cls === 'A') cls = 'ambiguous';
      
      let chr = '', pos = 0, ref = '', alt = '';
      const m = (hit._id || '').match(idRegex);
      if (m) { chr = m[1]; pos = parseInt(m[2]); ref = m[3]; alt = m[4]; }
      if (!chr) continue;
      
      let gene = hit['dbnsfp.genename'];
      if (Array.isArray(gene)) gene = gene[0];
      
      rows.push([chr, pos, ref, alt, gene || null, null, null, score, cls || null]);
    }
    if (rows.length) { tx(rows); inserted += rows.length; }
  } catch(e) {}
  
  if (batches % 10 === 0) {
    const pct = Math.round(i/rsidList.length*100);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = i > 0 ? elapsed / i : 0;
    const remaining = Math.round(rate * (rsidList.length - i));
    const eta = remaining > 60 ? Math.round(remaining/60) + 'm' : remaining + 's';
    process.stdout.write('    AlphaMissense: ' + inserted.toLocaleString() + ' rows (' + pct + '%) — ~' + eta + ' remaining\\r');
  }
  await new Promise(r => setTimeout(r, 350));
}
db.close();
console.log('    AlphaMissense: ' + inserted.toLocaleString() + ' rows imported                    ');
" "$DB_PATH"
