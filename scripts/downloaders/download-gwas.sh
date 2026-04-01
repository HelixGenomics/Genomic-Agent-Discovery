#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-gwas.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-gwas.sh <db_path> <downloads_dir>}"

URL="https://ftp.ebi.ac.uk/pub/databases/gwas/releases/latest/gwas-catalog-associations_ontology-annotated-full.zip"
ZIP_FILE="$DOWNLOADS_DIR/gwas-catalog-associations.zip"
FILE="$DOWNLOADS_DIR/gwas-catalog-associations.tsv"

if [ -f "$FILE" ]; then
  FSIZE=$(wc -c < "$FILE" | tr -d ' ')
  AGE=$(( ($(date +%s) - $(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE" 2>/dev/null)) ))
  if [ "$AGE" -lt 604800 ] && [ "$FSIZE" -gt 1000000 ]; then
    echo "    GWAS: cached ($(( AGE / 3600 ))h old, $(( FSIZE / 1048576 ))MB)"
  else
    rm -f "$FILE" "$ZIP_FILE"
  fi
fi

if [ ! -f "$FILE" ] || [ "$(wc -c < "$FILE" | tr -d ' ')" -lt 1000000 ]; then
  if [ ! -f "$ZIP_FILE" ]; then
    echo "    GWAS: downloading associations from EBI FTP..."
    curl -L --retry 3 --progress-bar -o "$ZIP_FILE" "$URL"
  fi
  echo "    GWAS: extracting..."
  TMP_DIR="$DOWNLOADS_DIR/gwas_tmp_$$"
  mkdir -p "$TMP_DIR"
  unzip -o "$ZIP_FILE" -d "$TMP_DIR" 2>/dev/null
  FOUND=$(find "$TMP_DIR" -name "*.tsv" | head -1)
  if [ -n "$FOUND" ]; then
    mv "$FOUND" "$FILE"
    rm -rf "$TMP_DIR" "$ZIP_FILE"
  else
    echo "    GWAS: ERROR - no TSV found in zip"
    rm -rf "$TMP_DIR"
    exit 1
  fi
fi

echo "    GWAS: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec('DELETE FROM gwas');

const insert = db.prepare(\`INSERT INTO gwas
  (rsid, gene, chromosome, position, trait, p_value, odds_ratio, beta,
   ci_lower, ci_upper, risk_allele, study_accession, pubmed_id, sample_size, ancestry)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`);

const rl = createInterface({ input: createReadStream(process.argv[2]), crlfDelay: Infinity });

let count = 0, headerMap = null;
const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
let batch = [];

function col(cols, name) {
  const idx = headerMap[name];
  if (idx === undefined) return null;
  const v = cols[idx];
  return (v && v !== '' && v !== 'NR' && v !== 'NS') ? v : null;
}

for await (const line of rl) {
  if (!headerMap) {
    const headers = line.split('\\t');
    headerMap = {};
    headers.forEach((h, i) => headerMap[h.trim()] = i);
    continue;
  }
  const cols = line.split('\\t');
  
  let rsid = col(cols, 'SNPS');
  if (rsid && rsid.includes(';')) rsid = rsid.split(/[;,\\s]/)[0].trim();
  
  const gene = col(cols, 'MAPPED_GENE') || col(cols, 'REPORTED GENE(S)');
  const chr = col(cols, 'CHR_ID');
  const pos = parseInt(col(cols, 'CHR_POS')) || null;
  const trait = col(cols, 'DISEASE/TRAIT');
  const pval = parseFloat(col(cols, 'P-VALUE')) || null;
  
  const orBeta = col(cols, 'OR or BETA');
  let odds = null, beta = null;
  if (orBeta) {
    const v = parseFloat(orBeta);
    if (!isNaN(v)) {
      const ciText = col(cols, '95% CI (TEXT)') || '';
      if (ciText.match(/unit|sd|increase|decrease/i)) beta = v;
      else odds = v;
    }
  }
  
  let ciLower = null, ciUpper = null;
  const ciText = col(cols, '95% CI (TEXT)');
  if (ciText) {
    const m = ciText.match(/(\\d+\\.?\\d*)\\s*[-\u2013]\\s*(\\d+\\.?\\d*)/);
    if (m) { ciLower = parseFloat(m[1]); ciUpper = parseFloat(m[2]); }
  }
  
  let riskAllele = col(cols, 'STRONGEST SNP-RISK ALLELE');
  if (riskAllele && riskAllele.includes('-')) {
    riskAllele = riskAllele.split('-').pop().trim();
  }
  
  const studyAcc = col(cols, 'STUDY ACCESSION');
  const pubmed = col(cols, 'PUBMEDID');
  
  let sampleSize = null;
  const sampleText = col(cols, 'INITIAL SAMPLE SIZE');
  if (sampleText) {
    const m = sampleText.replace(/,/g, '').match(/(\\d+)/);
    if (m) sampleSize = parseInt(m[1]);
  }
  
  batch.push([rsid, gene, chr, pos, trait, pval, odds, beta, ciLower, ciUpper,
              riskAllele, studyAcc, pubmed, sampleSize, null]);
  
  if (batch.length >= 5000) {
    tx(batch);
    count += batch.length;
    batch = [];
    if (count % 100000 === 0) process.stdout.write('    GWAS: ' + count.toLocaleString() + ' rows...\\r');
  }
}
if (batch.length) { tx(batch); count += batch.length; }
db.close();
console.log('    GWAS: ' + count.toLocaleString() + ' rows imported');
" "$DB_PATH" "$FILE"
