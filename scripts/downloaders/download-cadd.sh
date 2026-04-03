#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-cadd.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-cadd.sh <db_path> <downloads_dir>}"

echo "    CADD: fetching scores via MyVariant.info API..."

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
  console.log('    CADD: no rsIDs in database yet — run ClinVar/GWAS first');
  db.close(); process.exit(0);
}
console.log('    CADD: querying ' + rsids.size.toLocaleString() + ' rsIDs...');

db.exec('DELETE FROM cadd');
const insert = db.prepare(\`INSERT OR IGNORE INTO cadd
  (chromosome, position, ref_allele, alt_allele, raw_score, phred_score)
  VALUES (?, ?, ?, ?, ?, ?)\`);

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
      q: batch.join(','),
      scopes: 'dbsnp.rsid',
      fields: 'cadd.phred,cadd.rawscore,cadd.chrom,cadd.pos,cadd.ref,cadd.alt,_id',
      size: String(BATCH),
      dotfield: 'true'
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
      const phred = hit['cadd.phred'];
      const raw = hit['cadd.rawscore'];
      if (phred == null && raw == null) continue;
      
      let chr = hit['cadd.chrom'] || '';
      let pos = parseInt(hit['cadd.pos']) || 0;
      let ref = hit['cadd.ref'] || '';
      let alt = hit['cadd.alt'] || '';
      
      if (!chr) {
        const m = (hit._id || '').match(idRegex);
        if (m) { chr = m[1]; pos = parseInt(m[2]); ref = m[3]; alt = m[4]; }
      }
      if (!chr) continue;
      chr = String(chr).replace('chr', '');
      
      rows.push([chr, pos, ref, alt,
        raw != null ? (Array.isArray(raw) ? Math.max(...raw) : parseFloat(raw)) : null,
        phred != null ? (Array.isArray(phred) ? Math.max(...phred) : parseFloat(phred)) : null
      ]);
    }
    if (rows.length) { tx(rows); inserted += rows.length; }
  } catch(e) {}
  
  if (batches % 10 === 0) {
    const pct = Math.round(i/rsidList.length*100);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = i > 0 ? elapsed / i : 0;
    const remaining = Math.round(rate * (rsidList.length - i));
    const eta = remaining > 60 ? Math.round(remaining/60) + 'm' : remaining + 's';
    process.stdout.write('    CADD: ' + inserted.toLocaleString() + ' rows (' + pct + '%) — ~' + eta + ' remaining\\r');
  }
  await new Promise(r => setTimeout(r, 350));
}

db.close();
console.log('    CADD: ' + inserted.toLocaleString() + ' rows imported                    ');
" "$DB_PATH"
