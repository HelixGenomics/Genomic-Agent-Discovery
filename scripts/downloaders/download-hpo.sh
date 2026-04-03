#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-hpo.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-hpo.sh <db_path> <downloads_dir>}"

URL="https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/genes_to_phenotype.txt"
FILE="$DOWNLOADS_DIR/genes_to_phenotype.txt"

CACHE_TTL="${HELIX_CACHE_TTL:-7776000}"
FORCE="${HELIX_FORCE_DOWNLOAD:-false}"

if [ "$FORCE" = true ]; then
  echo "    HPO: force downloading genes_to_phenotype.txt..."
  curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
elif [ -f "$FILE" ]; then
  AGE=$(( ($(date +%s) - $(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE" 2>/dev/null)) ))
  if [ "$AGE" -lt "$CACHE_TTL" ]; then
    echo "    HPO: cached ($(( AGE / 86400 ))d old)"
  else
    echo "    HPO: cache stale ($(( AGE / 86400 ))d old), re-downloading..."
    curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
  fi
else
  echo "    HPO: downloading genes_to_phenotype.txt..."
  curl -L --retry 3 --progress-bar -o "$FILE" "$URL"
fi

echo "    HPO: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.exec('DELETE FROM hpo');

const insert = db.prepare(\`INSERT INTO hpo
  (gene, gene_id, hpo_id, hpo_name, disease_id, disease_name, frequency, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`);

const lines = readFileSync(process.argv[2], 'utf8').split('\\n');
let count = 0;
const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
let batch = [];

for (const line of lines) {
  if (!line || line.startsWith('#')) continue;
  const c = line.split('\\t');
  if (c.length < 4) continue;
  batch.push([c[1]||null, c[0]||null, c[2]||null, c[3]||null,
              c[5]||null, c[6]||null, c[4]||null, c[8]||null]);
  if (batch.length >= 5000) { tx(batch); count += batch.length; batch = []; }
}
if (batch.length) { tx(batch); count += batch.length; }
db.close();
console.log('    HPO: ' + count.toLocaleString() + ' rows imported');
" "$DB_PATH" "$FILE"
