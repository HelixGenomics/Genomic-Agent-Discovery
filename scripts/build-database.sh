#!/usr/bin/env bash
# ============================================================
# Helix Genomics Agents — Master Database Build Script
# ============================================================
#
# Downloads and indexes public genomic annotation databases into
# a unified SQLite database (data/helix-unified.db).
#
# Data sources:
#   - ClinVar (NCBI clinical variant interpretations)
#   - GWAS Catalog (genome-wide association studies)
#   - CPIC (pharmacogenomics drug dosing guidelines)
#   - AlphaMissense (DeepMind pathogenicity predictions)
#   - CADD (variant deleteriousness scores)
#   - gnomAD (population allele frequencies)
#   - HPO (Human Phenotype Ontology gene associations)
#   - DisGeNET (disease-gene associations)
#   - CIViC (cancer variant clinical evidence)
#   - PharmGKB (pharmacogenomics knowledge base)
#   - Orphanet (rare disease gene associations)
#   - SNPedia (community-curated SNP annotations)
#
# Usage:
#   bash scripts/build-database.sh
#   npm run build-db
#
# Safe to re-run — downloads are cached in data/downloads/
# and only re-downloaded if the source has been updated.
#
# ============================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"
DOWNLOADS_DIR="$DATA_DIR/downloads"
DB_PATH="$DATA_DIR/helix-unified.db"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "  ${GREEN}[OK]${RESET}    $1"; }
warn()    { echo -e "  ${YELLOW}[WARN]${RESET}  $1"; }
fail()    { echo -e "  ${RED}[FAIL]${RESET}  $1"; exit 1; }
step()    { echo -e "\n  ${CYAN}${BOLD}$1${RESET}"; }
dimtext() { echo -e "  ${DIM}$1${RESET}"; }

# Track timing
START_TIME=$(date +%s)

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------

echo ""
echo -e "  ${CYAN}=================================================${RESET}"
echo -e "       ${BOLD}DATABASE BUILD${RESET}"
echo -e "       ${DIM}Downloading & indexing genomic databases${RESET}"
echo -e "  ${CYAN}=================================================${RESET}"

# ---------------------------------------------------------------------------
# Step 1: Create directories
# ---------------------------------------------------------------------------

step "Creating directories..."

mkdir -p "$DATA_DIR"
mkdir -p "$DOWNLOADS_DIR"

info "data/ directory: $DATA_DIR"
info "downloads/ cache: $DOWNLOADS_DIR"

# ---------------------------------------------------------------------------
# Step 2: Initialize SQLite database with schema
# ---------------------------------------------------------------------------

step "Initializing database schema..."

# Remove existing database if corrupt or incomplete
if [ -f "$DB_PATH" ]; then
  # Quick integrity check
  if command -v sqlite3 &> /dev/null; then
    INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>/dev/null || echo "corrupt")
    if [ "$INTEGRITY" != "ok" ]; then
      warn "Existing database failed integrity check — rebuilding"
      rm -f "$DB_PATH"
    fi
  fi
fi

# Create database with full schema using Node.js (better-sqlite3)
node -e "
import Database from 'better-sqlite3';
import { existsSync } from 'fs';

const db = new Database('${DB_PATH}');

// Enable WAL mode for better write performance during build
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache

// ---------------------------------------------------------------
// ClinVar: Clinical variant interpretations
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS clinvar (
    variation_id     INTEGER PRIMARY KEY,
    rsid             TEXT,
    gene             TEXT,
    chromosome       TEXT,
    position         INTEGER,
    ref_allele       TEXT,
    alt_allele       TEXT,
    clinical_significance TEXT,
    review_status    TEXT,
    condition        TEXT,
    last_evaluated   TEXT,
    origin           TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_clinvar_rsid ON clinvar (rsid);
  CREATE INDEX IF NOT EXISTS idx_clinvar_gene ON clinvar (gene);
  CREATE INDEX IF NOT EXISTS idx_clinvar_chr_pos ON clinvar (chromosome, position);
  CREATE INDEX IF NOT EXISTS idx_clinvar_significance ON clinvar (clinical_significance);
\`);

// ---------------------------------------------------------------
// GWAS Catalog: Genome-wide association study results
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS gwas (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    rsid             TEXT,
    gene             TEXT,
    chromosome       TEXT,
    position         INTEGER,
    trait             TEXT,
    p_value          REAL,
    odds_ratio       REAL,
    beta             REAL,
    ci_lower         REAL,
    ci_upper         REAL,
    risk_allele      TEXT,
    study_accession  TEXT,
    pubmed_id        TEXT,
    sample_size      INTEGER,
    ancestry         TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_gwas_rsid ON gwas (rsid);
  CREATE INDEX IF NOT EXISTS idx_gwas_gene ON gwas (gene);
  CREATE INDEX IF NOT EXISTS idx_gwas_trait ON gwas (trait);
  CREATE INDEX IF NOT EXISTS idx_gwas_chr_pos ON gwas (chromosome, position);
\`);

// ---------------------------------------------------------------
// CPIC: Pharmacogenomics drug dosing guidelines
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS cpic_alleles (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gene             TEXT NOT NULL,
    allele           TEXT NOT NULL,
    function         TEXT,
    activity_score   REAL,
    defining_rsids   TEXT,
    frequency_eur    REAL,
    frequency_afr    REAL,
    frequency_eas    REAL,
    frequency_sas    REAL,
    frequency_amr    REAL
  );
  CREATE INDEX IF NOT EXISTS idx_cpic_alleles_gene ON cpic_alleles (gene);

  CREATE TABLE IF NOT EXISTS cpic_recommendations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gene             TEXT NOT NULL,
    drug             TEXT NOT NULL,
    phenotype        TEXT,
    activity_score   TEXT,
    recommendation   TEXT,
    strength         TEXT,
    cpic_level       TEXT,
    guideline_url    TEXT,
    last_updated     TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_cpic_rec_gene ON cpic_recommendations (gene);
  CREATE INDEX IF NOT EXISTS idx_cpic_rec_drug ON cpic_recommendations (drug);
\`);

// ---------------------------------------------------------------
// AlphaMissense: DeepMind pathogenicity predictions
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS alphamissense (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    chromosome       TEXT NOT NULL,
    position         INTEGER NOT NULL,
    ref_allele       TEXT NOT NULL,
    alt_allele       TEXT NOT NULL,
    gene             TEXT,
    transcript       TEXT,
    protein_change   TEXT,
    score            REAL NOT NULL,
    classification   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_am_chr_pos ON alphamissense (chromosome, position);
  CREATE INDEX IF NOT EXISTS idx_am_gene ON alphamissense (gene);
\`);

// ---------------------------------------------------------------
// CADD: Combined Annotation Dependent Depletion scores
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS cadd (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    chromosome       TEXT NOT NULL,
    position         INTEGER NOT NULL,
    ref_allele       TEXT NOT NULL,
    alt_allele       TEXT NOT NULL,
    raw_score        REAL,
    phred_score      REAL
  );
  CREATE INDEX IF NOT EXISTS idx_cadd_chr_pos ON cadd (chromosome, position);
\`);

// ---------------------------------------------------------------
// gnomAD: Population allele frequencies
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS gnomad (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    rsid             TEXT,
    chromosome       TEXT NOT NULL,
    position         INTEGER NOT NULL,
    ref_allele       TEXT NOT NULL,
    alt_allele       TEXT NOT NULL,
    gene             TEXT,
    af_total         REAL,
    af_eur           REAL,
    af_afr           REAL,
    af_eas           REAL,
    af_sas           REAL,
    af_amr           REAL,
    af_mid           REAL,
    homozygote_count INTEGER,
    filter_status    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_gnomad_rsid ON gnomad (rsid);
  CREATE INDEX IF NOT EXISTS idx_gnomad_chr_pos ON gnomad (chromosome, position);
  CREATE INDEX IF NOT EXISTS idx_gnomad_gene ON gnomad (gene);
\`);

// ---------------------------------------------------------------
// HPO: Human Phenotype Ontology gene associations
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS hpo (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gene             TEXT NOT NULL,
    gene_id          TEXT,
    hpo_id           TEXT NOT NULL,
    hpo_name         TEXT,
    disease_id       TEXT,
    disease_name     TEXT,
    frequency        TEXT,
    source           TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_hpo_gene ON hpo (gene);
  CREATE INDEX IF NOT EXISTS idx_hpo_id ON hpo (hpo_id);
  CREATE INDEX IF NOT EXISTS idx_hpo_disease ON hpo (disease_id);
\`);

// ---------------------------------------------------------------
// DisGeNET: Disease-gene associations
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS disgenet (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gene             TEXT NOT NULL,
    gene_id          TEXT,
    disease_id       TEXT NOT NULL,
    disease_name     TEXT,
    score            REAL,
    evidence_index   REAL,
    source           TEXT,
    pmid             TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_disgenet_gene ON disgenet (gene);
  CREATE INDEX IF NOT EXISTS idx_disgenet_disease ON disgenet (disease_id);
\`);

// ---------------------------------------------------------------
// CIViC: Clinical Interpretation of Variants in Cancer
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS civic (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gene             TEXT NOT NULL,
    variant          TEXT,
    rsid             TEXT,
    disease          TEXT,
    drugs            TEXT,
    evidence_type    TEXT,
    evidence_level   TEXT,
    evidence_direction TEXT,
    clinical_significance TEXT,
    rating           INTEGER,
    source_url       TEXT,
    pubmed_id        TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_civic_gene ON civic (gene);
  CREATE INDEX IF NOT EXISTS idx_civic_rsid ON civic (rsid);
  CREATE INDEX IF NOT EXISTS idx_civic_disease ON civic (disease);
\`);

// ---------------------------------------------------------------
// PharmGKB: Pharmacogenomics Knowledge Base
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS pharmgkb (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gene             TEXT NOT NULL,
    rsid             TEXT,
    drug             TEXT,
    phenotype        TEXT,
    significance     TEXT,
    evidence_level   TEXT,
    annotation_text  TEXT,
    source_url       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pharmgkb_gene ON pharmgkb (gene);
  CREATE INDEX IF NOT EXISTS idx_pharmgkb_rsid ON pharmgkb (rsid);
  CREATE INDEX IF NOT EXISTS idx_pharmgkb_drug ON pharmgkb (drug);
\`);

// ---------------------------------------------------------------
// Orphanet: Rare disease gene associations
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS orphanet (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gene             TEXT NOT NULL,
    gene_id          TEXT,
    orpha_code       TEXT NOT NULL,
    disease_name     TEXT,
    association_type TEXT,
    status           TEXT,
    source           TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orphanet_gene ON orphanet (gene);
  CREATE INDEX IF NOT EXISTS idx_orphanet_orpha ON orphanet (orpha_code);
\`);

// ---------------------------------------------------------------
// SNPedia: Community-curated SNP annotations
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS snpedia (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    rsid             TEXT NOT NULL,
    magnitude        REAL,
    repute           TEXT,
    summary          TEXT,
    genotype         TEXT,
    genotype_summary TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_snpedia_rsid ON snpedia (rsid);
\`);

// ---------------------------------------------------------------
// Gene info: Quick gene lookup table
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS gene_info (
    gene_symbol      TEXT PRIMARY KEY,
    gene_id          TEXT,
    full_name        TEXT,
    chromosome       TEXT,
    start_pos        INTEGER,
    end_pos          INTEGER,
    strand           TEXT,
    gene_type        TEXT,
    summary          TEXT
  );
\`);

// ---------------------------------------------------------------
// Build metadata: Track what was built and when
// ---------------------------------------------------------------
db.exec(\`
  CREATE TABLE IF NOT EXISTS build_metadata (
    source           TEXT PRIMARY KEY,
    version          TEXT,
    row_count        INTEGER,
    built_at         TEXT,
    download_url     TEXT,
    checksum         TEXT
  );
\`);

db.close();
console.log('  [OK]    Database schema initialized: ${DB_PATH}');
" --input-type=module

# ---------------------------------------------------------------------------
# Step 3: Download and import each data source
# ---------------------------------------------------------------------------
# Each script downloads its source, parses it, and inserts into the database.
# Downloads are cached — re-running skips already-downloaded files.

step "Downloading and importing data sources..."
echo ""

SOURCES=(
  "download-clinvar.sh:ClinVar clinical variant interpretations"
  "download-gwas.sh:GWAS Catalog trait-variant associations"
  "download-cpic.sh:CPIC pharmacogenomics guidelines"
  "download-alphamissense.sh:AlphaMissense pathogenicity predictions"
  "download-cadd.sh:CADD deleteriousness scores"
  "download-gnomad.sh:gnomAD population frequencies"
  "download-hpo.sh:HPO gene-phenotype associations"
  "download-disgenet.sh:DisGeNET disease-gene associations"
  "download-civic.sh:CIViC cancer variant evidence"
  "download-pharmgkb.sh:PharmGKB drug-gene annotations"
  "download-orphanet.sh:Orphanet rare disease genes"
  "download-snpedia.sh:SNPedia variant summaries"
)

TOTAL=${#SOURCES[@]}
CURRENT=0
SUCCEEDED=0
FAILED=0

for entry in "${SOURCES[@]}"; do
  SCRIPT_NAME="${entry%%:*}"
  DESCRIPTION="${entry#*:}"
  CURRENT=$((CURRENT + 1))

  echo -e "  ${DIM}[${CURRENT}/${TOTAL}]${RESET} ${DESCRIPTION}..."

  DOWNLOAD_SCRIPT="$SCRIPT_DIR/downloaders/$SCRIPT_NAME"
  if [ -f "$DOWNLOAD_SCRIPT" ]; then
    if bash "$DOWNLOAD_SCRIPT" "$DB_PATH" "$DOWNLOADS_DIR" 2>&1; then
      SUCCEEDED=$((SUCCEEDED + 1))
      info "  $DESCRIPTION"
    else
      FAILED=$((FAILED + 1))
      warn "  $DESCRIPTION (failed — see errors above)"
    fi
  else
    warn "  $SCRIPT_NAME not found — skipping"
    FAILED=$((FAILED + 1))
  fi
done

# ---------------------------------------------------------------------------
# Step 4: Optimize database
# ---------------------------------------------------------------------------

step "Optimizing database..."

node -e "
import Database from 'better-sqlite3';
const db = new Database('${DB_PATH}');
db.pragma('journal_mode = WAL');
db.exec('ANALYZE');
db.exec('VACUUM');
db.close();
console.log('  [OK]    Database optimized');
" --input-type=module

# ---------------------------------------------------------------------------
# Step 5: Verify database
# ---------------------------------------------------------------------------

step "Verifying database..."

VERIFY_SCRIPT="$SCRIPT_DIR/verify-database.mjs"
if [ -f "$VERIFY_SCRIPT" ]; then
  node "$VERIFY_SCRIPT" || true
else
  warn "verify-database.mjs not found — skipping verification"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo -e "  ${GREEN}${BOLD}Database build complete!${RESET}"
echo ""
echo -e "  Database:  ${DB_PATH}"

if [ -f "$DB_PATH" ]; then
  DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
  echo -e "  Size:      ${DB_SIZE}"
fi

echo -e "  Sources:   ${SUCCEEDED} succeeded, ${FAILED} pending/failed"
echo -e "  Time:      ${MINUTES}m ${SECONDS}s"
echo ""

if [ "$FAILED" -gt 0 ]; then
  dimtext "Some data sources are not yet implemented. This is expected during"
  dimtext "early development. Implement downloaders in scripts/downloaders/"
  dimtext "and re-run: npm run build-db"
  echo ""
fi
