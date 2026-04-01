#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-cpic.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-cpic.sh <db_path> <downloads_dir>}"

ALLELE_FILE="$DOWNLOADS_DIR/cpic-alleles.json"
REC_FILE="$DOWNLOADS_DIR/cpic-recommendations.json"
DRUG_FILE="$DOWNLOADS_DIR/cpic-drugs.json"

needs_download() {
  local f="$1"
  if [ ! -f "$f" ]; then return 0; fi
  local age=$(( $(date +%s) - $(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null) ))
  [ "$age" -gt 604800 ]
}

if needs_download "$ALLELE_FILE"; then
  echo "    CPIC: downloading alleles..."
  curl -sL "https://api.cpicpgx.org/v1/allele?select=id,genesymbol,name,clinicalfunctionalstatus,activityvalue&limit=10000" -o "$ALLELE_FILE"
else
  echo "    CPIC: alleles cached"
fi

if needs_download "$REC_FILE"; then
  echo "    CPIC: downloading recommendations..."
  curl -sL "https://api.cpicpgx.org/v1/recommendation?select=id,drugid,drugrecommendation,classification,phenotypes,activityscore,lookupkey&limit=10000" -o "$REC_FILE"
else
  echo "    CPIC: recommendations cached"
fi

if needs_download "$DRUG_FILE"; then
  echo "    CPIC: downloading drug names..."
  curl -sL "https://api.cpicpgx.org/v1/drug?select=drugid,name&limit=10000" -o "$DRUG_FILE"
else
  echo "    CPIC: drugs cached"
fi

echo "    CPIC: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');

// Alleles
db.exec('DELETE FROM cpic_alleles');
const insertAllele = db.prepare(\`INSERT INTO cpic_alleles
  (gene, allele, function, activity_score, defining_rsids,
   frequency_eur, frequency_afr, frequency_eas, frequency_sas, frequency_amr)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`);

const alleles = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let ac = 0;
const txA = db.transaction((rows) => { for (const r of rows) insertAllele.run(...r); });
let batch = [];

for (const a of alleles) {
  batch.push([
    a.genesymbol || '', a.name || '', a.clinicalfunctionalstatus || null,
    a.activityvalue != null ? parseFloat(a.activityvalue) || null : null,
    null, null, null, null, null, null
  ]);
  if (batch.length >= 1000) { txA(batch); ac += batch.length; batch = []; }
}
if (batch.length) { txA(batch); ac += batch.length; }

// Build drug name lookup
const drugs = JSON.parse(readFileSync(process.argv[4], 'utf8'));
const drugMap = {};
for (const d of drugs) { if (d.drugid && d.name) drugMap[d.drugid] = d.name; }

// Recommendations
db.exec('DELETE FROM cpic_recommendations');
const insertRec = db.prepare(\`INSERT INTO cpic_recommendations
  (gene, drug, phenotype, activity_score, recommendation, strength, cpic_level, guideline_url, last_updated)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`);

const recs = JSON.parse(readFileSync(process.argv[3], 'utf8'));
let rc = 0;
const txR = db.transaction((rows) => { for (const r of rows) insertRec.run(...r); });
batch = [];

for (const r of recs) {
  const gene = r.lookupkey ? Object.keys(r.lookupkey)[0] : '';
  const drugName = drugMap[r.drugid] || r.drugid || '';
  const phenotype = r.phenotypes ? Object.values(r.phenotypes).flat().join('; ') : '';
  const actScore = r.activityscore ? Object.values(r.activityscore).flat().join('; ') : '';
  
  batch.push([
    gene, drugName, phenotype || null, actScore || null,
    r.drugrecommendation || null, r.classification || null,
    null, null, null
  ]);
  if (batch.length >= 1000) { txR(batch); rc += batch.length; batch = []; }
}
if (batch.length) { txR(batch); rc += batch.length; }

db.close();
console.log('    CPIC: ' + ac + ' alleles, ' + rc + ' recommendations imported');
" "$DB_PATH" "$ALLELE_FILE" "$REC_FILE" "$DRUG_FILE"
