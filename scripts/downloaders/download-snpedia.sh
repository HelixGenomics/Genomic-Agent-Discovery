#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-snpedia.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-snpedia.sh <db_path> <downloads_dir>}"

CACHE_FILE="$DOWNLOADS_DIR/snpedia-dump.json"

CACHE_TTL="${HELIX_CACHE_TTL:-7776000}"
FORCE="${HELIX_FORCE_DOWNLOAD:-false}"

if [ "$FORCE" = true ]; then
  echo "    SNPedia: force re-crawl requested"
  rm -f "$CACHE_FILE"
elif [ -f "$CACHE_FILE" ]; then
  FSIZE=$(wc -c < "$CACHE_FILE" | tr -d ' ')
  AGE=$(( ($(date +%s) - $(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null)) ))
  IS_VALID=false
  if [ "$FSIZE" -gt 5000 ]; then
    if node -e "JSON.parse(require('fs').readFileSync('$CACHE_FILE','utf8')).length" 2>/dev/null | grep -q '[0-9]'; then
      IS_VALID=true
    fi
  fi
  if [ "$IS_VALID" = true ]; then
    if [ "$AGE" -lt "$CACHE_TTL" ]; then
      echo "    SNPedia: cached ($(( AGE / 86400 ))d old, $(( FSIZE / 1024 ))KB)"
    else
      echo "    SNPedia: cache stale ($(( AGE / 86400 ))d old) — will re-crawl"
      rm -f "$CACHE_FILE"
    fi
  else
    echo "    SNPedia: clearing invalid cache"
    rm -f "$CACHE_FILE"
  fi
fi

if [ ! -f "$CACHE_FILE" ]; then
  # SNPedia data is CC BY-NC-SA 3.0 — must be fetched from their API directly
  echo "    SNPedia: crawling wiki API (CC BY-NC-SA 3.0 licensed data)..."
  echo "    SNPedia: this can take a while (~70K+ pages). Tip: set HTTPS_PROXY to speed up."

    node --input-type=module -e "
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';

const API = 'https://bots.snpedia.com/api.php';
const UA = 'Mozilla/5.0 (compatible; HelixGenomics/1.0; +https://github.com/HelixGenomics/Genomic-Agent-Discovery)';
const PARTIAL_FILE = process.argv[1] + '.partial';
const results = [];
let startOffset = 0;

// Resume from partial file if it exists
if (existsSync(PARTIAL_FILE)) {
  try {
    const partial = JSON.parse(readFileSync(PARTIAL_FILE, 'utf8'));
    if (partial.pageNames && partial.pageNames.length > 0 && partial.results) {
      // Resume content fetching from where we left off
      console.log('    SNPedia: resuming from partial (' + partial.results.length + ' annotated, ' + partial.fetchedCount + ' fetched)');
      await fetchContent(partial.pageNames, partial.results, partial.fetchedCount || 0);
      process.exit(0);
    }
  } catch(e) { /* ignore corrupt partial */ }
}

async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30000)
      });
      if (resp.status === 502 || resp.status === 503 || resp.status === 429) {
        const wait = Math.min(3000 * Math.pow(2, attempt), 30000);
        if (attempt === 0) process.stdout.write('    SNPedia: retrying (' + resp.status + ')...\\r');
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!resp.ok) return null;
      const text = await resp.text();
      if (text.startsWith('<')) return null; // HTML error page
      return JSON.parse(text);
    } catch(e) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }
  }
  return null;
}

// Step 1: List all Rs pages
let apcontinue = '';
let pageNames = [];
let consecutiveErrors = 0;

console.log('    SNPedia: listing Rs pages...');
while (true) {
  const params = new URLSearchParams({
    action: 'query', list: 'allpages', apprefix: 'Rs',
    aplimit: '500', format: 'json'
  });
  if (apcontinue) params.set('apcontinue', apcontinue);

  const data = await fetchWithRetry(API + '?' + params);
  if (!data) {
    consecutiveErrors++;
    if (consecutiveErrors >= 10) {
      console.log('\\n    SNPedia: API unreachable after 10 retries — skipping');
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 5000));
    continue;
  }
  consecutiveErrors = 0;

  const pages = data?.query?.allpages || [];
  for (const p of pages) {
    if (/^Rs\\d+\$/.test(p.title)) pageNames.push(p.title);
  }

  if (data?.continue?.apcontinue) {
    apcontinue = data.continue.apcontinue;
    if (pageNames.length % 5000 < 500) process.stdout.write('    SNPedia: ' + pageNames.length + ' pages listed...\\r');
    await new Promise(r => setTimeout(r, 200));
  } else break;
}
console.log('    SNPedia: ' + pageNames.length + ' Rs pages found');

// Step 2: Fetch content in batches
await fetchContent(pageNames, results, 0);

async function fetchContent(pageNames, results, startFrom) {
  let consecutiveErrors = 0;

  console.log('    SNPedia: fetching page content...');
  for (let i = startFrom; i < pageNames.length; i += 50) {
    const batch = pageNames.slice(i, i + 50);
    const params = new URLSearchParams({
      action: 'query', prop: 'revisions', rvprop: 'content',
      titles: batch.join('|'), format: 'json', rvslots: 'main'
    });

    const data = await fetchWithRetry(API + '?' + params);
    if (!data) {
      consecutiveErrors++;
      if (consecutiveErrors >= 15) {
        console.log('\\n    SNPedia: too many errors — saving partial progress');
        writeFileSync(PARTIAL_FILE, JSON.stringify({ pageNames, results, fetchedCount: i }));
        console.log('    SNPedia: ' + results.length + ' annotated so far. Re-run to resume.');
        if (results.length > 0) {
          writeFileSync(process.argv[1], JSON.stringify(results));
        }
        process.exit(0);
      }
      await new Promise(r => setTimeout(r, 5000));
      i -= 50; // retry this batch
      continue;
    }
    consecutiveErrors = 0;

    const pages = data?.query?.pages || {};
    for (const [, page] of Object.entries(pages)) {
      if (!page.title || page.missing !== undefined) continue;
      const rsid = page.title.toLowerCase();
      const content = page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'] || '';

      const summary = content.match(/\\|\\s*[Ss]ummary\\s*=\\s*([^\\n|}]+)/);
      const mag = content.match(/\\|\\s*[Mm]agnitude\\s*=\\s*([\\d.]+)/);
      const rep = content.match(/\\|\\s*[Rr]epute\\s*=\\s*(\\w+)/);

      if (summary) {
        results.push({
          rsid,
          magnitude: mag ? parseFloat(mag[1]) : null,
          repute: rep ? rep[1].trim() : null,
          summary: summary[1].trim()
        });
      }
    }

    if (i % 2500 < 50) {
      process.stdout.write('    SNPedia: ' + results.length + ' annotated / ' + i + ' of ' + pageNames.length + ' checked...\\r');
    }

    // Save progress every 5000 pages
    if (i % 5000 < 50 && i > startFrom) {
      writeFileSync(PARTIAL_FILE, JSON.stringify({ pageNames, results, fetchedCount: i }));
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('');

  if (results.length === 0) {
    console.error('    SNPedia: no annotated SNPs found — API may be having issues');
    console.error('    SNPedia: this database is optional — the build will continue without it.');
    process.exit(0);
  }

  writeFileSync(process.argv[1], JSON.stringify(results));
  try { unlinkSync(PARTIAL_FILE); } catch(e) {}
  console.log('    SNPedia: ' + results.length + ' annotated SNPs collected');
}
" "$CACHE_FILE"
fi

# Only import if we have a valid cache file
if [ ! -f "$CACHE_FILE" ]; then
  echo "    SNPedia: no data available — skipping import"
  exit 0
fi

echo "    SNPedia: importing into database..."

node --input-type=module -e "
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database(process.argv[1]);
db.pragma('journal_mode = WAL');
db.exec('DELETE FROM snpedia');

const insert = db.prepare(\`INSERT INTO snpedia
  (rsid, magnitude, repute, summary, genotype, genotype_summary)
  VALUES (?, ?, ?, ?, ?, ?)\`);

const snps = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let count = 0;
const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
let batch = [];

for (const s of snps) {
  batch.push([s.rsid, s.magnitude, s.repute, s.summary, null, null]);
  if (batch.length >= 2000) { tx(batch); count += batch.length; batch = []; }
}
if (batch.length) { tx(batch); count += batch.length; }
db.close();
console.log('    SNPedia: ' + count.toLocaleString() + ' rows imported');
" "$DB_PATH" "$CACHE_FILE"
