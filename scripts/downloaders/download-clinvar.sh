#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-clinvar.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-clinvar.sh <db_path> <downloads_dir>}"

URL="https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz"
FILE="$DOWNLOADS_DIR/variant_summary.txt.gz"

# Download with cache (7 days)
if [ -f "$FILE" ]; then
  AGE=$(( ($(date +%s) - $(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE" 2>/dev/null)) ))
  if [ "$AGE" -lt 604800 ]; then
    echo "    ClinVar: cached ($(( AGE / 3600 ))h old)"
  else
    echo "    ClinVar: cache stale, re-downloading..."
    curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
  fi
else
  echo "    ClinVar: downloading variant_summary.txt.gz..."
  curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
fi

echo "    ClinVar: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Clear existing data
db.exec('DELETE FROM clinvar');

const insert = db.prepare(\`INSERT OR REPLACE INTO clinvar
  (variation_id, rsid, gene, chromosome, position, ref_allele, alt_allele,
   clinical_significance, review_status, condition, last_evaluated, origin)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`);

const rl = createInterface({
  input: createReadStream(process.argv[2]).pipe(createGunzip()),
  crlfDelay: Infinity
});

let count = 0, skipped = 0, header = null;
const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
let batch = [];

for await (const line of rl) {
  if (!header) { header = line.split('\\t'); continue; }
  const cols = line.split('\\t');
  
  // Filter to GRCh38 only
  if (cols[16] !== 'GRCh38') { skipped++; continue; }
  
  const variationId = parseInt(cols[30]) || null;
  if (!variationId) { skipped++; continue; }
  
  const rsRaw = cols[9];
  const rsid = (rsRaw && rsRaw !== '-1' && rsRaw !== 'na' && rsRaw !== '-')
    ? (rsRaw.startsWith('rs') ? rsRaw : 'rs' + rsRaw)
    : null;
  
  const ref = (cols[21] && cols[21].toLowerCase() !== 'na') ? cols[21] : null;
  const alt = (cols[22] && cols[22].toLowerCase() !== 'na') ? cols[22] : null;
  
  batch.push([
    variationId, rsid, cols[4] || null, cols[18] || null,
    parseInt(cols[19]) || null, ref, alt,
    cols[6] || null, cols[24] || null, cols[13] || null,
    cols[8] || null, cols[14] || null
  ]);
  
  if (batch.length >= 5000) {
    tx(batch);
    count += batch.length;
    batch = [];
    if (count % 100000 === 0) process.stdout.write('    ClinVar: ' + count.toLocaleString() + ' rows...\\r');
  }
}

if (batch.length) { tx(batch); count += batch.length; }
db.close();
console.log('    ClinVar: ' + count.toLocaleString() + ' rows imported (' + skipped.toLocaleString() + ' skipped)');
" "$DB_PATH" "$FILE"
