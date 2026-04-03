#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-disgenet.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-disgenet.sh <db_path> <downloads_dir>}"

URL="https://www.disgenet.org/static/disgenet_ap1/files/downloads/curated_gene_disease_associations.tsv.gz"
FILE="$DOWNLOADS_DIR/disgenet-curated.tsv.gz"

CACHE_TTL="${HELIX_CACHE_TTL:-7776000}"
FORCE="${HELIX_FORCE_DOWNLOAD:-false}"

NEED_DOWNLOAD=true
if [ "$FORCE" = true ]; then
  rm -f "$FILE"
elif [ -f "$FILE" ]; then
  FSIZE=$(wc -c < "$FILE" | tr -d ' ')
  AGE=$(( ($(date +%s) - $(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE" 2>/dev/null)) ))
  # Validate it's actually gzip, not an HTML login page
  IS_GZIP=false
  if file "$FILE" 2>/dev/null | grep -qi "gzip"; then
    IS_GZIP=true
  fi
  if [ "$AGE" -lt "$CACHE_TTL" ] && [ "$FSIZE" -gt 100000 ] && [ "$IS_GZIP" = true ]; then
    echo "    DisGeNET: cached ($(( AGE / 86400 ))d old, $(( FSIZE / 1024 ))KB)"
    NEED_DOWNLOAD=false
  else
    rm -f "$FILE"
  fi
fi

if [ "$NEED_DOWNLOAD" = true ]; then
  echo "    DisGeNET: downloading curated associations..."
  HTTP_CODE=$(curl -L --retry 3 -w "%{http_code}" -o "$FILE" "$URL" 2>/dev/null || echo "000")

  # Validate the response is actually gzip data, not an HTML auth page returning 200
  IS_GZIP=false
  if [ -f "$FILE" ] && file "$FILE" 2>/dev/null | grep -qi "gzip"; then
    IS_GZIP=true
  fi

  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "000" ] || [ "$IS_GZIP" = false ]; then
    echo ""
    echo "    DisGeNET: requires free registration for bulk downloads."
    echo "    This database is optional — the build will continue without it."
    echo ""
    echo "    To add DisGeNET data later:"
    echo "      1. Register at https://www.disgenet.org/signup/"
    echo "      2. Download 'Curated gene-disease associations' from https://www.disgenet.org/downloads"
    echo "      3. Place the .tsv.gz file as: $FILE"
    echo "      4. Re-run: npm run build-db"
    echo ""
    rm -f "$FILE"
    exit 0
  fi

  FSIZE=$(wc -c < "$FILE" | tr -d ' ')
  if [ "$FSIZE" -lt 100000 ]; then
    echo "    DisGeNET: download too small ($(( FSIZE / 1024 ))KB) — likely incomplete."
    rm -f "$FILE"
    exit 0
  fi
fi

echo "    DisGeNET: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.exec('DELETE FROM disgenet');

const insert = db.prepare(\`INSERT INTO disgenet
  (gene, gene_id, disease_id, disease_name, score, evidence_index, source, pmid)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`);

const rl = createInterface({
  input: createReadStream(process.argv[2]).pipe(createGunzip()),
  crlfDelay: Infinity
});

let count = 0, headerMap = null;
const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
let batch = [];

for await (const line of rl) {
  if (!headerMap) {
    const h = line.split('\\t');
    headerMap = {};
    h.forEach((name, i) => headerMap[name.trim()] = i);
    continue;
  }
  const c = line.split('\\t');
  const gene = c[headerMap['geneSymbol']] || '';
  if (!gene) continue;
  
  batch.push([
    gene,
    c[headerMap['geneId']] || null,
    c[headerMap['diseaseId']] || null,
    c[headerMap['diseaseName']] || null,
    parseFloat(c[headerMap['score']]) || null,
    parseFloat(c[headerMap['EI']]) || null,
    c[headerMap['source']] || null,
    c[headerMap['NofPmids']] || null
  ]);
  if (batch.length >= 5000) { tx(batch); count += batch.length; batch = []; }
}
if (batch.length) { tx(batch); count += batch.length; }
db.close();
console.log('    DisGeNET: ' + count.toLocaleString() + ' rows imported');
" "$DB_PATH" "$FILE"
