#!/usr/bin/env bash
# Placeholder: ClinVar downloader
# Downloads variant_summary.txt.gz from NCBI FTP and imports into clinvar table
#
# Source: https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz
# Expected rows: ~2.5 million
#
# Usage: bash download-clinvar.sh <db_path> <downloads_dir>

DB_PATH="${1:?Database path required}"
DOWNLOADS_DIR="${2:?Downloads directory required}"

echo "    [PLACEHOLDER] ClinVar: Would download variant_summary.txt.gz from NCBI FTP"
echo "    [PLACEHOLDER] ClinVar: Would parse TSV and insert ~2.5M rows into clinvar table"
echo "    [PLACEHOLDER] Source: https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz"
