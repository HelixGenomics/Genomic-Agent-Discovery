#!/usr/bin/env bash
# Placeholder: GWAS Catalog downloader
# Downloads full associations TSV from EBI GWAS Catalog and imports into gwas table
#
# Source: https://www.ebi.ac.uk/gwas/api/search/downloads/full
# Expected rows: ~400,000
#
# Usage: bash download-gwas.sh <db_path> <downloads_dir>

DB_PATH="${1:?Database path required}"
DOWNLOADS_DIR="${2:?Downloads directory required}"

echo "    [PLACEHOLDER] GWAS: Would download associations TSV from EBI GWAS Catalog"
echo "    [PLACEHOLDER] GWAS: Would parse and insert ~400K rows into gwas table"
echo "    [PLACEHOLDER] Source: https://www.ebi.ac.uk/gwas/api/search/downloads/full"
