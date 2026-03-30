#!/usr/bin/env bash
# Placeholder: SNPedia downloader
# Downloads community-curated SNP annotations from SNPedia via MediaWiki API
#
# Source: https://www.snpedia.com/index.php/SNPedia:API
# Expected rows: ~100,000 (annotation entries for ~30K SNPs)
#
# Note: SNPedia data is scraped from their wiki API. Rate-limit respectfully.
#
# Usage: bash download-snpedia.sh <db_path> <downloads_dir>

DB_PATH="${1:?Database path required}"
DOWNLOADS_DIR="${2:?Downloads directory required}"

echo "    [PLACEHOLDER] SNPedia: Would query SNPedia MediaWiki API for SNP annotations"
echo "    [PLACEHOLDER] SNPedia: Would parse and insert ~100K genotype annotations"
echo "    [PLACEHOLDER] Source: https://www.snpedia.com/index.php/SNPedia:API"
