#!/usr/bin/env node
// ============================================================
// Helix Genomics Agents — Database Verification Script
// ============================================================
//
// Verifies the unified annotation database has all required tables
// with minimum expected row counts. Prints a summary table with
// pass/fail status for each data source.
//
// Usage:
//   node scripts/verify-database.mjs
//   node scripts/verify-database.mjs /path/to/custom.db
//   npm run verify-db
//
// Exit codes:
//   0 — All tables present with sufficient data
//   1 — Missing tables or insufficient data (warnings printed)
//   2 — Database file not found or unreadable
//
// ============================================================

import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Expected tables and their minimum row counts for a "good" database.
// These are conservative minimums — a fully-built database will have
// significantly more rows in most tables.
// ---------------------------------------------------------------------------

const EXPECTED_TABLES = [
  {
    table: "clinvar",
    description: "ClinVar clinical variant interpretations",
    min_rows: 100_000,
    source_url: "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/",
  },
  {
    table: "gwas",
    description: "GWAS Catalog trait-variant associations",
    min_rows: 10_000,
    source_url: "https://www.ebi.ac.uk/gwas/",
  },
  {
    table: "cpic_alleles",
    description: "CPIC pharmacogene allele definitions",
    min_rows: 100,
    source_url: "https://cpicpgx.org/",
  },
  {
    table: "cpic_recommendations",
    description: "CPIC drug dosing recommendations",
    min_rows: 100,
    source_url: "https://cpicpgx.org/",
  },
  {
    table: "alphamissense",
    description: "AlphaMissense pathogenicity predictions",
    min_rows: 50_000,
    source_url: "https://zenodo.org/records/8208688",
  },
  {
    table: "cadd",
    description: "CADD deleteriousness scores",
    min_rows: 50_000,
    source_url: "https://cadd.gs.washington.edu/",
  },
  {
    table: "gnomad",
    description: "gnomAD population allele frequencies",
    min_rows: 50_000,
    source_url: "https://gnomad.broadinstitute.org/",
  },
  {
    table: "hpo",
    description: "HPO gene-phenotype associations",
    min_rows: 10_000,
    source_url: "https://hpo.jax.org/",
  },
  {
    table: "disgenet",
    description: "DisGeNET disease-gene associations",
    min_rows: 5_000,
    source_url: "https://www.disgenet.org/",
  },
  {
    table: "civic",
    description: "CIViC cancer variant evidence",
    min_rows: 1_000,
    source_url: "https://civicdb.org/",
  },
  {
    table: "pharmgkb",
    description: "PharmGKB drug-gene annotations",
    min_rows: 1_000,
    source_url: "https://www.pharmgkb.org/",
  },
  {
    table: "orphanet",
    description: "Orphanet rare disease gene associations",
    min_rows: 1_000,
    source_url: "https://www.orphadata.com/",
  },
  {
    table: "snpedia",
    description: "SNPedia community SNP annotations",
    min_rows: 5_000,
    source_url: "https://www.snpedia.com/",
  },
  {
    table: "gene_info",
    description: "Gene information lookup",
    min_rows: 1_000,
    source_url: "https://www.ncbi.nlm.nih.gov/gene/",
  },
];

// ---------------------------------------------------------------------------
// Color helpers (simple ANSI — no chalk dependency for scripts)
// ---------------------------------------------------------------------------

const C = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

// ---------------------------------------------------------------------------
// Main verification
// ---------------------------------------------------------------------------

function verify(dbPath) {
  console.log("");
  console.log(`  ${C.bold("Database Verification")}`);
  console.log(`  ${C.dim(dbPath)}`);
  console.log("");

  if (!existsSync(dbPath)) {
    console.error(`  ${C.red("ERROR")} Database file not found: ${dbPath}`);
    console.error(`  ${C.dim("Run: npm run build-db")}`);
    process.exit(2);
  }

  let db;
  try {
    db = new Database(dbPath, { readonly: true });
    db.pragma("cache_size = -8000");
  } catch (err) {
    console.error(`  ${C.red("ERROR")} Cannot open database: ${err.message}`);
    process.exit(2);
  }

  // Get existing tables
  const existingTables = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => row.name)
  );

  // Print header
  const colTable = 25;
  const colRows = 12;
  const colMin = 12;
  const colStatus = 10;
  const colDesc = 40;

  const header =
    "Table".padEnd(colTable) +
    "Rows".padStart(colRows) +
    "Min".padStart(colMin) +
    "Status".padStart(colStatus) +
    "  Description";

  console.log(`  ${C.dim(header)}`);
  console.log(`  ${C.dim("-".repeat(colTable + colRows + colMin + colStatus + colDesc + 2))}`);

  let totalPassed = 0;
  let totalFailed = 0;
  let totalEmpty = 0;
  let totalMissing = 0;
  let totalRows = 0;

  for (const expected of EXPECTED_TABLES) {
    const { table, description, min_rows } = expected;
    let rowCount = 0;
    let status;
    let statusColor;

    if (!existingTables.has(table)) {
      status = "MISSING";
      statusColor = C.red;
      totalMissing++;
    } else {
      try {
        const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        rowCount = result.count;
        totalRows += rowCount;
      } catch {
        rowCount = 0;
      }

      if (rowCount === 0) {
        status = "EMPTY";
        statusColor = C.yellow;
        totalEmpty++;
      } else if (rowCount < min_rows) {
        status = "LOW";
        statusColor = C.yellow;
        totalFailed++;
      } else {
        status = "PASS";
        statusColor = C.green;
        totalPassed++;
      }
    }

    const line =
      table.padEnd(colTable) +
      formatNumber(rowCount).padStart(colRows) +
      formatNumber(min_rows).padStart(colMin) +
      statusColor(status.padStart(colStatus)) +
      "  " + C.dim(description);

    console.log(`  ${line}`);
  }

  // Summary
  console.log(`  ${C.dim("-".repeat(colTable + colRows + colMin + colStatus + colDesc + 2))}`);
  console.log(`  ${"Total".padEnd(colTable)}${formatNumber(totalRows).padStart(colRows)}`);
  console.log("");

  // Build metadata
  if (existingTables.has("build_metadata")) {
    const builds = db.prepare("SELECT source, version, row_count, built_at FROM build_metadata ORDER BY built_at DESC").all();
    if (builds.length > 0) {
      console.log(`  ${C.bold("Build History")}`);
      for (const b of builds) {
        console.log(`  ${C.dim(`${b.source}: ${b.row_count || "?"} rows, built ${b.built_at || "unknown"}`)}`);
      }
      console.log("");
    }
  }

  db.close();

  // Result summary
  const allGood = totalFailed === 0 && totalMissing === 0 && totalEmpty === 0;

  if (allGood) {
    console.log(`  ${C.green(C.bold("All checks passed!"))} ${totalPassed} tables verified.`);
  } else {
    if (totalPassed > 0) {
      console.log(`  ${C.green(`${totalPassed} passed`)}`);
    }
    if (totalFailed > 0) {
      console.log(`  ${C.yellow(`${totalFailed} below minimum row count`)}`);
    }
    if (totalEmpty > 0) {
      console.log(`  ${C.yellow(`${totalEmpty} empty (data not yet imported)`)}`);
    }
    if (totalMissing > 0) {
      console.log(`  ${C.red(`${totalMissing} missing tables`)}`);
    }
    console.log("");
    console.log(`  ${C.dim("To populate empty tables, implement the corresponding")}`);
    console.log(`  ${C.dim("downloader script and re-run: npm run build-db")}`);
  }

  console.log("");

  // Exit with appropriate code
  if (totalMissing > 0) {
    process.exit(1);
  }
  return allGood;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n) {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const dbPath = process.argv[2] || resolve(PROJECT_ROOT, "data", "helix-unified.db");
verify(dbPath);
