-- Genotype database schema for helix-genomics-agents
-- Created per-run in state/{jobId}/genotypes.db

-- Main genotype table: one row per variant
CREATE TABLE IF NOT EXISTS genotypes (
    rsid        TEXT    PRIMARY KEY,
    chromosome  TEXT    NOT NULL,
    position    INTEGER NOT NULL,
    genotype    TEXT    NOT NULL
);

-- Index for fast lookups by genomic position
CREATE INDEX IF NOT EXISTS idx_genotypes_chr_pos
    ON genotypes (chromosome, position);

-- Index for chromosome-level queries
CREATE INDEX IF NOT EXISTS idx_genotypes_chromosome
    ON genotypes (chromosome);

-- Metadata table: stores parsing info and file provenance
CREATE TABLE IF NOT EXISTS metadata (
    key   TEXT PRIMARY KEY,
    value TEXT
);
