#!/usr/bin/env node
/**
 * Generate a synthetic 23andMe-format genome file for demo/recording purposes.
 *
 * Pulls real rsIDs from the unified database so agents will find actual hits,
 * then seeds dramatic variants (BRCA2, CYP2D6, DPYD, MTHFR, APOE, etc.)
 * with specific genotypes to trigger impressive cross-agent communication.
 */

import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'helix-unified.db');
const OUTPUT_PATH = join(__dirname, '..', 'data', 'demo-genome.txt');

const db = new Database(DB_PATH, { readonly: true });

// ============================================================
// SEEDED VARIANTS — these produce the cinematic agent cross-talk
// ============================================================
const seededVariants = [
  // --- BRCA2 — Cancer agent sends URGENT to pharma agent ---
  { rsid: 'rs80359605',  chr: '13', pos: '32332592',  geno: 'AG' },  // Pathogenic BRCA2 — breast/ovarian cancer risk
  { rsid: 'rs80359530',  chr: '13', pos: '32338917',  geno: 'CT' },  // Pathogenic BRCA2 — frameshift
  { rsid: 'rs80359351',  chr: '13', pos: '32355250',  geno: 'AG' },  // Pathogenic BRCA2

  // --- DPYD — Pharma agent flags fluoropyrimidine chemo toxicity ---
  { rsid: 'rs3918290',   chr: '1',  pos: '97450058',  geno: 'AG' },  // IVS14+1G>A — 5-FU toxicity, 50% dose reduction
  { rsid: 'rs67376798',  chr: '1',  pos: '97082391',  geno: 'AT' },  // 5-FU toxicity risk
  { rsid: 'rs55886062',  chr: '1',  pos: '97515787',  geno: 'AC' },  // DPYD drug response

  // --- CYP2D6 — Poor metabolizer, SSRI toxicity risk ---
  { rsid: 'rs3892097',   chr: '22', pos: '42128945',  geno: 'GA' },  // CYP2D6*4 — poor metabolizer allele
  { rsid: 'rs1065852',   chr: '22', pos: '42130692',  geno: 'GA' },  // CYP2D6*10 — reduced function
  { rsid: 'rs16947',     chr: '22', pos: '42126611',  geno: 'GA' },  // CYP2D6*2 — normal/altered function
  { rsid: 'rs28371725',  chr: '22', pos: '42126938',  geno: 'GA' },  // CYP2D6*41 — decreased function
  { rsid: 'rs5030655',   chr: '22', pos: '42127941',  geno: 'AG' },  // CYP2D6*6 — no function

  // --- MTHFR — Cardiovascular + folate metabolism ---
  { rsid: 'rs1801133',   chr: '1',  pos: '11796321',  geno: 'CT' },  // C677T — thermolabile, reduced enzyme activity
  { rsid: 'rs1801131',   chr: '1',  pos: '11794419',  geno: 'GT' },  // A1298C — compound het with C677T

  // --- APOE — Alzheimer's risk, cardiovascular ---
  { rsid: 'rs429358',    chr: '19', pos: '44908684',  geno: 'CT' },  // APOE epsilon-4 carrier — Alzheimer's risk
  { rsid: 'rs7412',      chr: '19', pos: '44908822',  geno: 'CC' },  // APOE — confirms e3/e4 genotype
  { rsid: 'rs405509',    chr: '19', pos: '44905579',  geno: 'GT' },  // APOE promoter — coronary artery disease

  // --- CHEK2 — Additional cancer risk, works with BRCA2 ---
  { rsid: 'rs555607708', chr: '22', pos: '29091857',  geno: 'AG' },  // CHEK2 — breast cancer risk

  // --- Factor V Leiden — Blood clotting, cardiovascular drama ---
  { rsid: 'rs6025',      chr: '1',  pos: '169519049', geno: 'CT' },  // Factor V Leiden — thrombophilia risk

  // --- TPMT — Thiopurine drug metabolism (another pharma hit) ---
  { rsid: 'rs1800460',   chr: '6',  pos: '18130918',  geno: 'CT' },  // TPMT*3B — reduced thiopurine metabolism
  { rsid: 'rs1142345',   chr: '6',  pos: '18130687',  geno: 'AG' },  // TPMT*3C — azathioprine dose adjustment

  // --- HFE — Hemochromatosis (rare disease agent picks this up) ---
  { rsid: 'rs1800562',   chr: '6',  pos: '26093141',  geno: 'GA' },  // C282Y — hereditary hemochromatosis carrier
  { rsid: 'rs1799945',   chr: '6',  pos: '26091179',  geno: 'CG' },  // H63D — compound het hemochromatosis

  // --- SLCO1B1 — Statin myopathy risk ---
  { rsid: 'rs4149056',   chr: '12', pos: '21331549',  geno: 'TC' },  // SLCO1B1*5 — statin-induced myopathy

  // --- VKORC1 — Warfarin sensitivity ---
  { rsid: 'rs9923231',   chr: '16', pos: '31107689',  geno: 'CT' },  // VKORC1 — warfarin dose sensitivity

  // --- IL1B — Inflammatory pathway (cancer story variant) ---
  { rsid: 'rs16944',     chr: '2',  pos: '113311202', geno: 'AG' },  // IL1B -511 — gastric cancer, inflammatory
  { rsid: 'rs1143634',   chr: '2',  pos: '113306667', geno: 'CT' },  // IL1B +3954 — inflammatory response

  // --- CDH1 — Stomach cancer (pairs with IL1B for the cancer story) ---
  { rsid: 'rs16260',     chr: '16', pos: '68771195',  geno: 'CA' },  // CDH1 promoter — gastric cancer risk

  // --- MUTYH — Colorectal cancer (rare disease crossover) ---
  { rsid: 'rs36053993',  chr: '1',  pos: '45798475',  geno: 'GA' },  // MUTYH Y179C — colorectal cancer

  // --- CFTR — Cystic fibrosis carrier (rare disease agent) ---
  { rsid: 'rs75527207',  chr: '7',  pos: '117199644', geno: 'AG' },  // CFTR carrier — F508del adjacent marker

  // --- GBA — Gaucher/Parkinson's (rare disease + neuro crossover) ---
  { rsid: 'rs76763715',  chr: '1',  pos: '155205634', geno: 'CT' },  // GBA N370S — Gaucher carrier, Parkinson's risk
];

// Track seeded rsIDs so we don't duplicate them
const seededRsids = new Set(seededVariants.map(v => v.rsid));

console.log(`Seeded ${seededVariants.length} dramatic variants`);

// ============================================================
// PULL REAL rsIDs FROM DATABASE
// ============================================================
console.log('Pulling rsIDs from database...');

// Get rsIDs from multiple tables for variety
const clinvarRsids = db.prepare(`
  SELECT DISTINCT rsid, chromosome, position
  FROM clinvar
  WHERE rsid IS NOT NULL AND rsid != '' AND rsid LIKE 'rs%'
  ORDER BY RANDOM()
  LIMIT 400000
`).all();

const gwasRsids = db.prepare(`
  SELECT DISTINCT rsid, chromosome, position
  FROM gwas
  WHERE rsid IS NOT NULL AND rsid != '' AND rsid LIKE 'rs%'
  ORDER BY RANDOM()
  LIMIT 100000
`).all();

const gnomadRsids = db.prepare(`
  SELECT DISTINCT rsid, chromosome, position
  FROM gnomad
  WHERE rsid IS NOT NULL AND rsid != '' AND rsid LIKE 'rs%'
  ORDER BY RANDOM()
  LIMIT 100000
`).all();

const snpediaRsids = db.prepare(`
  SELECT DISTINCT rsid
  FROM snpedia
  WHERE rsid IS NOT NULL AND rsid != '' AND rsid LIKE 'rs%'
  ORDER BY RANDOM()
  LIMIT 50000
`).all();

const pharmRsids = db.prepare(`
  SELECT DISTINCT rsid
  FROM pharmgkb
  WHERE rsid IS NOT NULL AND rsid != '' AND rsid LIKE 'rs%'
`).all();

console.log(`  ClinVar: ${clinvarRsids.length}`);
console.log(`  GWAS: ${gwasRsids.length}`);
console.log(`  gnomAD: ${gnomadRsids.length}`);
console.log(`  SNPedia: ${snpediaRsids.length}`);
console.log(`  PharmGKB: ${pharmRsids.length}`);

// ============================================================
// MERGE & DEDUPLICATE
// ============================================================
const allVariants = new Map();
const bases = ['A', 'C', 'G', 'T'];
const commonGenotypes = ['AA', 'CC', 'GG', 'TT', 'AG', 'AC', 'AT', 'CG', 'CT', 'GT'];

function randomGenotype() {
  // Bias toward homozygous reference (more realistic)
  const r = Math.random();
  if (r < 0.65) {
    // Homozygous
    const b = bases[Math.floor(Math.random() * 4)];
    return b + b;
  } else {
    // Heterozygous
    return commonGenotypes[Math.floor(Math.random() * commonGenotypes.length)];
  }
}

// Add seeded variants first
for (const v of seededVariants) {
  allVariants.set(v.rsid, { rsid: v.rsid, chr: v.chr, pos: v.pos, geno: v.geno });
}

// Add database variants
for (const row of [...clinvarRsids, ...gwasRsids, ...gnomadRsids]) {
  if (!seededRsids.has(row.rsid) && !allVariants.has(row.rsid)) {
    allVariants.set(row.rsid, {
      rsid: row.rsid,
      chr: String(row.chromosome),
      pos: String(row.position),
      geno: randomGenotype()
    });
  }
}

// For SNPedia/PharmGKB rows without position, we'll skip them (need chr+pos for 23andMe format)
// but note them for awareness
let skippedNoPos = 0;
for (const row of [...snpediaRsids, ...pharmRsids]) {
  if (!seededRsids.has(row.rsid) && !allVariants.has(row.rsid)) {
    // Look up position from clinvar
    const lookup = db.prepare(`SELECT chromosome, position FROM clinvar WHERE rsid = ? LIMIT 1`).get(row.rsid);
    if (lookup) {
      allVariants.set(row.rsid, {
        rsid: row.rsid,
        chr: String(lookup.chromosome),
        pos: String(lookup.position),
        geno: randomGenotype()
      });
    } else {
      skippedNoPos++;
    }
  }
}

console.log(`\nTotal unique variants: ${allVariants.size}`);
console.log(`Skipped (no position): ${skippedNoPos}`);

// ============================================================
// SORT BY CHROMOSOME + POSITION (like real 23andMe files)
// ============================================================
const chrOrder = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','X','Y','MT'];
const chrRank = Object.fromEntries(chrOrder.map((c, i) => [c, i]));

const sorted = [...allVariants.values()].sort((a, b) => {
  const chrDiff = (chrRank[a.chr] ?? 99) - (chrRank[b.chr] ?? 99);
  if (chrDiff !== 0) return chrDiff;
  return Number(a.pos) - Number(b.pos);
});

// ============================================================
// WRITE 23andMe FORMAT FILE
// ============================================================
const header = `# This data file generated by 23andMe at: Wed Apr 02 12:00:00 2026
#
# Below is a text version of your data.  Fields are TAB-separated
# Each line corresponds to a single SNP.  For each SNP, we provide its identifier
# (an rsid or an internal id), its location on the reference human genome, and the
# genotype call oriented with respect to the plus strand on the human reference sequence.
# We are using reference human assembly build 37 (also known as Annotation Release 104).
# Note that it is possible that data downloaded at different times may be different due to
# ongoing improvements in our ability to call genotypes. More information about these changes
# can be found at: https://www.23andme.com/you/download/revisions/
#
# More information on reference human assembly build 37 (aka Annotation Release 104):
# http://www.ncbi.nlm.nih.gov/mapview/map_search.cgi?taxid=9606
#
# rsid\tchromosome\tposition\tgenotype`;

const lines = sorted.map(v => `${v.rsid}\t${v.chr}\t${v.pos}\t${v.geno}`);
const content = header + '\n' + lines.join('\n') + '\n';

writeFileSync(OUTPUT_PATH, content);

console.log(`\nWrote ${sorted.length} variants to ${OUTPUT_PATH}`);
console.log(`File size: ${(Buffer.byteLength(content) / 1024 / 1024).toFixed(1)} MB`);

// ============================================================
// SUMMARY OF SEEDED VARIANTS
// ============================================================
console.log('\n=== SEEDED DRAMATIC VARIANTS ===');
console.log('These will trigger cross-agent communication:\n');

const categories = {
  'BRCA2 (Cancer → Pharma URGENT)': ['rs80359605', 'rs80359530', 'rs80359351'],
  'DPYD (Chemo toxicity — 50% dose reduction)': ['rs3918290', 'rs67376798', 'rs55886062'],
  'CYP2D6 (Poor metabolizer — SSRI toxicity)': ['rs3892097', 'rs1065852', 'rs16947', 'rs28371725', 'rs5030655'],
  'MTHFR (Folate/cardiovascular)': ['rs1801133', 'rs1801131'],
  'APOE e4 (Alzheimer\'s risk)': ['rs429358', 'rs7412', 'rs405509'],
  'Factor V Leiden (Thrombophilia)': ['rs6025'],
  'TPMT (Thiopurine metabolism)': ['rs1800460', 'rs1142345'],
  'HFE (Hemochromatosis)': ['rs1800562', 'rs1799945'],
  'SLCO1B1 (Statin myopathy)': ['rs4149056'],
  'VKORC1 (Warfarin sensitivity)': ['rs9923231'],
  'IL1B + CDH1 (Gastric cancer pathway)': ['rs16944', 'rs1143634', 'rs16260'],
  'MUTYH (Colorectal cancer)': ['rs36053993'],
  'CFTR (Cystic fibrosis carrier)': ['rs75527207'],
  'GBA (Gaucher/Parkinson\'s)': ['rs76763715'],
  'CHEK2 (Breast cancer)': ['rs555607708'],
};

for (const [cat, rsids] of Object.entries(categories)) {
  console.log(`  ${cat}: ${rsids.join(', ')}`);
}

console.log('\n=== EXPECTED AGENT CROSS-TALK ===');
console.log('1. Cancer agent finds BRCA2 pathogenic → sends URGENT to Pharma');
console.log('2. Pharma agent checks DPYD → "50% dose reduction for fluoropyrimidine chemo"');
console.log('3. Pharma agent finds CYP2D6 poor metabolizer → flags SSRI/codeine toxicity');
console.log('4. Cardiovascular agent finds APOE e4 + Factor V Leiden + MTHFR');
console.log('5. Rare disease agent finds HFE hemochromatosis + CFTR carrier + GBA');
console.log('6. Cancer + Cardio agents both flag IL1B inflammatory pathway');
console.log('7. Pharma flags TPMT + SLCO1B1 + VKORC1 — triple drug interaction alert');

db.close();
