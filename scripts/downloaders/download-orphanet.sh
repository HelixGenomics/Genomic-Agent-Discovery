#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-orphanet.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-orphanet.sh <db_path> <downloads_dir>}"

URL="https://www.orphadata.com/data/xml/en_product6.xml"
FILE="$DOWNLOADS_DIR/en_product6.xml"

CACHE_TTL="${HELIX_CACHE_TTL:-7776000}"
FORCE="${HELIX_FORCE_DOWNLOAD:-false}"

if [ "$FORCE" = true ]; then
  echo "    Orphanet: force downloading en_product6.xml..."
  curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
elif [ -f "$FILE" ]; then
  AGE=$(( ($(date +%s) - $(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE" 2>/dev/null)) ))
  if [ "$AGE" -lt "$CACHE_TTL" ]; then
    echo "    Orphanet: cached ($(( AGE / 86400 ))d old)"
  else
    echo "    Orphanet: cache stale ($(( AGE / 86400 ))d old), re-downloading..."
    curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
  fi
else
  echo "    Orphanet: downloading en_product6.xml..."
  curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
fi

echo "    Orphanet: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.exec('DELETE FROM orphanet');

const insert = db.prepare(\`INSERT INTO orphanet
  (gene, gene_id, orpha_code, disease_name, association_type, status, source)
  VALUES (?, ?, ?, ?, ?, ?, ?)\`);

const xml = readFileSync(process.argv[2], 'utf8');
let count = 0;
const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
let batch = [];

// Match each <Disorder id=...>...</Disorder> block
const disorderRe = /<Disorder id=\"\\d+\">([\s\S]*?)<\\/Disorder>\\s*(?:<Disorder|<\\/DisorderList)/g;

// Simpler approach: split by <Disorder id= markers
const disorders = xml.split(/<Disorder id=\"/);

for (let i = 1; i < disorders.length; i++) {
  const block = disorders[i];
  
  const orphaCode = (block.match(/<OrphaCode>(\\d+)<\\/OrphaCode>/) || [])[1] || '';
  
  // Get disease name (has lang='en' attribute)
  const diseaseName = (block.match(/<Name lang=\"en\">([^<]*)<\\/Name>/) || [])[1] || '';
  
  // Find all DisorderGeneAssociation blocks  
  const assocs = block.split(/<DisorderGeneAssociation>/);
  
  for (let j = 1; j < assocs.length; j++) {
    const a = assocs[j].split(/<\\/DisorderGeneAssociation>/)[0];
    
    const gene = (a.match(/<Symbol>([^<]*)<\\/Symbol>/) || [])[1] || '';
    if (!gene) continue;
    
    // Get association type - inside DisorderGeneAssociationType > Name
    const assocType = (a.match(/<DisorderGeneAssociationType[^>]*>[\\s\\S]*?<Name[^>]*>([^<]*)<\\/Name>/) || [])[1] || '';
    const status = (a.match(/<DisorderGeneAssociationStatus[^>]*>[\\s\\S]*?<Name[^>]*>([^<]*)<\\/Name>/) || [])[1] || '';
    const source = (a.match(/<SourceOfValidation>([^<]*)<\\/SourceOfValidation>/) || [])[1] || '';
    
    batch.push([gene, null, orphaCode, diseaseName, assocType, status, source]);
    if (batch.length >= 2000) { tx(batch); count += batch.length; batch = []; }
  }
}

if (batch.length) { tx(batch); count += batch.length; }
db.close();
console.log('    Orphanet: ' + count.toLocaleString() + ' rows imported');
" "$DB_PATH" "$FILE"
