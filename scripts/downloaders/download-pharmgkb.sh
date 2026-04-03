#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-pharmgkb.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-pharmgkb.sh <db_path> <downloads_dir>}"

FILE="$DOWNLOADS_DIR/pharmgkb-clinical-annotations.zip"
TSV_FILE="$DOWNLOADS_DIR/pharmgkb-annotations.tsv"

extract_pharmgkb_zip() {
  local zipfile="$1"
  local outdir="$2"
  local tmpdir="$outdir/pharmgkb_tmp"
  rm -rf "$tmpdir"
  mkdir -p "$tmpdir"

  if ! unzip -o "$zipfile" -d "$tmpdir" >/dev/null 2>&1; then
    echo "    PharmGKB: failed to extract zip"
    rm -rf "$tmpdir"
    return 1
  fi

  # Look for the main clinical_annotations.tsv file specifically
  local found=""
  found=$(find "$tmpdir" -name "clinical_annotations.tsv" 2>/dev/null | head -1)
  if [ -z "$found" ]; then
    # Fallback: any TSV file
    found=$(find "$tmpdir" -name "*.tsv" 2>/dev/null | head -1)
  fi

  if [ -n "$found" ]; then
    cp "$found" "$outdir/pharmgkb-annotations.tsv"
    rm -rf "$tmpdir"
    return 0
  else
    echo "    PharmGKB: no TSV found in zip"
    rm -rf "$tmpdir"
    return 1
  fi
}

CACHE_TTL="${HELIX_CACHE_TTL:-7776000}"
FORCE="${HELIX_FORCE_DOWNLOAD:-false}"

# Check for cached TSV
if [ "$FORCE" = true ]; then
  rm -f "$TSV_FILE" "$FILE"
elif [ -f "$TSV_FILE" ]; then
  FSIZE=$(wc -c < "$TSV_FILE" | tr -d ' ')
  AGE=$(( ($(date +%s) - $(stat -f %m "$TSV_FILE" 2>/dev/null || stat -c %Y "$TSV_FILE" 2>/dev/null)) ))
  if [ "$AGE" -lt "$CACHE_TTL" ] && [ "$FSIZE" -gt 10000 ]; then
    echo "    PharmGKB: cached ($(( AGE / 86400 ))d old, $(( FSIZE / 1024 ))KB)"
  else
    rm -f "$TSV_FILE"
  fi
fi

# Extract from cached zip if TSV doesn't exist
if [ ! -f "$TSV_FILE" ] && [ -f "$FILE" ]; then
  echo "    PharmGKB: extracting cached zip..."
  extract_pharmgkb_zip "$FILE" "$DOWNLOADS_DIR" || true
fi

# Download if we still don't have the TSV
if [ ! -f "$TSV_FILE" ]; then
  echo "    PharmGKB: downloading clinical annotations..."
  HTTP_CODE=$(curl -sL -w "%{http_code}" -o "$FILE" "https://api.pharmgkb.org/v1/download/file/data/clinicalAnnotations.zip" 2>/dev/null || echo "000")

  # Validate we got an actual zip file
  IS_ZIP=false
  if [ -f "$FILE" ] && file "$FILE" 2>/dev/null | grep -qi "zip"; then
    IS_ZIP=true
  fi

  if [ "$HTTP_CODE" != "200" ] || [ "$IS_ZIP" = false ]; then
    echo ""
    echo "    PharmGKB: download failed or requires registration."
    echo "    This database is optional — the build will continue without it."
    echo ""
    echo "    To add PharmGKB data later:"
    echo "      1. Go to https://www.pharmgkb.org/downloads"
    echo "      2. Download 'Clinical Annotations' (clinicalAnnotations.zip)"
    echo "      3. Place as: $FILE"
    echo "      4. Re-run: npm run build-db"
    echo ""
    rm -f "$FILE"
    exit 0
  fi

  extract_pharmgkb_zip "$FILE" "$DOWNLOADS_DIR" || {
    echo "    PharmGKB: extraction failed"
    exit 0
  }
fi

if [ ! -f "$TSV_FILE" ]; then
  echo "    PharmGKB: no data file available — skipping"
  exit 0
fi

echo "    PharmGKB: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.exec('DELETE FROM pharmgkb');

const insert = db.prepare(\`INSERT INTO pharmgkb
  (gene, rsid, drug, phenotype, significance, evidence_level, annotation_text, source_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`);

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
  // Flexible column lookup — tries multiple known header variations
  const col = (...names) => {
    for (const name of names) {
      const i = headerMap[name.toLowerCase()];
      if (i !== undefined && c[i] && c[i].trim()) return c[i].trim();
    }
    return null;
  };

  const gene = col('gene', 'gene symbols', 'genes');
  if (!gene) continue;

  batch.push([
    gene,
    col('variant/haplotypes', 'rsid', 'variant'),
    col('drug(s)', 'drug', 'chemicals'),
    col('phenotype(s)', 'phenotype', 'phenotype category'),
    col('phenotype category', 'significance', 'clinical significance'),
    col('level of evidence', 'evidence level', 'level'),
    null, // annotation text not in this TSV — only in the evidence file
    col('url', 'pharmgkb accession id')
  ]);
  if (batch.length >= 1000) { tx(batch); count += batch.length; batch = []; }
}
if (batch.length) { tx(batch); count += batch.length; }
db.close();
console.log('    PharmGKB: ' + count.toLocaleString() + ' rows imported');
" "$DB_PATH" "$TSV_FILE"
