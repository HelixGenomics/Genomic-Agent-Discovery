#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-civic.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-civic.sh <db_path> <downloads_dir>}"

URL="https://civicdb.org/downloads/nightly/nightly-ClinicalEvidenceSummaries.tsv"
FILE="$DOWNLOADS_DIR/civic-evidence.tsv"

if [ -f "$FILE" ]; then
  AGE=$(( ($(date +%s) - $(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE" 2>/dev/null)) ))
  if [ "$AGE" -lt 86400 ]; then
    echo "    CIViC: cached ($(( AGE / 3600 ))h old)"
  else
    curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
  fi
else
  echo "    CIViC: downloading nightly evidence summaries..."
  curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
fi

echo "    CIViC: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.exec('DELETE FROM civic');

const insert = db.prepare(\`INSERT INTO civic
  (gene, variant, rsid, disease, drugs, evidence_type, evidence_level,
   evidence_direction, clinical_significance, rating, source_url, pubmed_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`);

const lines = readFileSync(process.argv[2], 'utf8').split('\\n');
let headerMap = null, count = 0;
const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
let batch = [];

for (const line of lines) {
  if (!line.trim()) continue;
  if (!headerMap) {
    const h = line.split('\\t');
    headerMap = {};
    h.forEach((name, i) => headerMap[name.trim().toLowerCase()] = i);
    continue;
  }
  const c = line.split('\\t');
  const col = (name) => { const i = headerMap[name]; return (i !== undefined && c[i] && c[i] !== '') ? c[i].trim() : null; };
  
  // molecular_profile contains gene + variant, e.g. 'PDGFRA D842V' or 'BRAF V600E'
  const mp = col('molecular_profile') || '';
  const parts = mp.split(/\\s+/);
  const gene = parts[0] || null;
  const variant = parts.slice(1).join(' ') || mp;
  if (!gene) continue;
  
  // Try to extract rsid from variant
  let rsid = null;
  const rsMatch = (variant || '').match(/(rs\\d+)/);
  if (rsMatch) rsid = rsMatch[1];
  
  const rating = col('rating');
  const citationId = col('citation_id');
  const evidenceUrl = col('evidence_civic_url');
  
  batch.push([
    gene, variant || null, rsid,
    col('disease'), col('therapies'),
    col('evidence_type'), col('evidence_level'),
    col('evidence_direction'), col('significance'),
    rating ? parseInt(rating) || null : null,
    evidenceUrl || (citationId ? 'https://pubmed.ncbi.nlm.nih.gov/' + citationId : null),
    citationId
  ]);
  if (batch.length >= 2000) { tx(batch); count += batch.length; batch = []; }
}
if (batch.length) { tx(batch); count += batch.length; }
db.close();
console.log('    CIViC: ' + count.toLocaleString() + ' rows imported');
" "$DB_PATH" "$FILE"
