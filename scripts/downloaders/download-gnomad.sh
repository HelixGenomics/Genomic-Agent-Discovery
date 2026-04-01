#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:?Usage: download-gnomad.sh <db_path> <downloads_dir>}"
DOWNLOADS_DIR="${2:?Usage: download-gnomad.sh <db_path> <downloads_dir>}"

echo "    gnomAD: fetching allele frequencies via MyVariant.info API..."

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
  console.log('    gnomAD: no rsIDs in database yet — run ClinVar/GWAS first');
  db.close(); process.exit(0);
}
console.log('    gnomAD: querying ' + rsids.size.toLocaleString() + ' rsIDs...');

db.exec('DELETE FROM gnomad');
const insert = db.prepare(\`INSERT OR IGNORE INTO gnomad
  (rsid, chromosome, position, ref_allele, alt_allele, gene, af_total,
   af_eur, af_afr, af_eas, af_sas, af_amr, af_mid, homozygote_count, filter_status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`);

const BATCH = 900;
const rsidList = [...rsids];
let inserted = 0, batches = 0;
const idRegex = /chr(\w+):g\.(\d+)([A-Z])>([A-Z])/;

for (let i = 0; i < rsidList.length; i += BATCH) {
  const batch = rsidList.slice(i, i + BATCH);
  batches++;
  
  try {
    const body = new URLSearchParams({
      q: batch.join(','), scopes: 'dbsnp.rsid',
      fields: 'gnomad_exome.af,gnomad_exome.filter,gnomad_exome.ac,dbsnp.rsid,dbsnp.chrom,dbsnp.hg38,dbnsfp.genename,_id',
      size: String(BATCH), dotfield: 'true'
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
      // gnomAD AF is nested: gnomad_exome.af.af, gnomad_exome.af.af_afr, etc
      const afTotal = hit['gnomad_exome.af.af'];
      if (afTotal == null) continue;
      
      let chr = hit['dbsnp.chrom'] || '';
      let pos = 0, ref = '', alt = '';
      const hg38 = hit['dbsnp.hg38'];
      if (hg38) { pos = hg38.start || 0; ref = hg38.ref || ''; alt = hg38.alt || ''; }
      if (!chr || !pos) {
        const m = (hit._id || '').match(idRegex);
        if (m) { chr = m[1]; pos = parseInt(m[2]); ref = m[3]; alt = m[4]; }
      }
      if (!chr) continue;
      chr = String(chr).replace('chr', '');
      
      let gene = hit['dbnsfp.genename'];
      if (Array.isArray(gene)) gene = gene[0];
      
      const filter = hit['gnomad_exome.filter'];
      const filterStr = Array.isArray(filter) ? filter.join(',') : (filter || null);
      const homCount = hit['gnomad_exome.ac.ac_hom'] ?? null;
      
      rows.push([
        hit.query?.startsWith('rs') ? hit.query : null,
        chr, pos, ref, alt, gene || null,
        typeof afTotal === 'number' ? afTotal : parseFloat(afTotal) || null,
        hit['gnomad_exome.af.af_nfe'] ?? null,  // EUR = NFE (non-Finnish European)
        hit['gnomad_exome.af.af_afr'] ?? null,
        hit['gnomad_exome.af.af_eas'] ?? null,
        hit['gnomad_exome.af.af_sas'] ?? null,
        hit['gnomad_exome.af.af_amr'] ?? null,
        hit['gnomad_exome.af.af_mid'] ?? null,
        typeof homCount === 'number' ? homCount : null,
        filterStr
      ]);
    }
    if (rows.length) { tx(rows); inserted += rows.length; }
  } catch(e) {}
  
  if (batches % 50 === 0) process.stdout.write('    gnomAD: ' + inserted.toLocaleString() + ' rows (' + Math.round(i/rsidList.length*100) + '%)...\\r');
  await new Promise(r => setTimeout(r, 350));
}
db.close();
console.log('    gnomAD: ' + inserted.toLocaleString() + ' rows imported');
" "$DB_PATH"
