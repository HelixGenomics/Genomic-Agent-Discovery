#!/usr/bin/env bash
# ============================================================
# Helix Genomics Agents — Exomiser Setup Script
# ============================================================
#
# Downloads and configures Exomiser for phenotype-driven variant
# prioritization. This is OPTIONAL — the pipeline works without it.
#
# Exomiser is the gold standard for rare disease variant
# prioritization, created by Peter Robinson (HPO creator).
#
# Requirements:
#   - Java 21+ (check with: java --version)
#   - ~3 GB disk space (CLI + hg38 annotation data)
#   - Internet connection for initial download
#
# Usage:
#   bash scripts/setup-exomiser.sh
#   npm run setup-exomiser
#
# License: Exomiser is AGPL-3.0. It runs as an external process
# and is NOT linked into our MIT codebase.
#
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXOMISER_DIR="$PROJECT_DIR/data/exomiser"
EXOMISER_VERSION="15.0.0"
EXOMISER_JAR="$EXOMISER_DIR/exomiser-cli-${EXOMISER_VERSION}/exomiser-cli-${EXOMISER_VERSION}.jar"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "  ${GREEN}[OK]${RESET}    $1"; }
warn()  { echo -e "  ${YELLOW}[WARN]${RESET}  $1"; }
fail()  { echo -e "  ${RED}[FAIL]${RESET}  $1"; }
step()  { echo -e "\n  ${CYAN}${BOLD}$1${RESET}"; }

echo ""
echo -e "  ${CYAN}=================================================${RESET}"
echo -e "       ${BOLD}EXOMISER SETUP${RESET}"
echo -e "       ${DIM}Phenotype-driven variant prioritization${RESET}"
echo -e "  ${CYAN}=================================================${RESET}"

# ---------------------------------------------------------------------------
# Step 1: Check Java
# ---------------------------------------------------------------------------

step "Checking Java..."

if ! command -v java &> /dev/null; then
  fail "Java not found. Exomiser requires Java 21+."
  echo ""
  echo "  Install Java:"
  echo "    macOS:  brew install openjdk@21"
  echo "    Ubuntu: sudo apt install openjdk-21-jre"
  echo "    Or:     https://adoptium.net/temurin/releases/"
  echo ""
  exit 1
fi

JAVA_VERSION=$(java --version 2>&1 | head -1 | grep -oE '[0-9]+' | head -1)
if [ "$JAVA_VERSION" -lt 21 ] 2>/dev/null; then
  fail "Java $JAVA_VERSION found, but Exomiser requires Java 21+."
  echo "  Install: brew install openjdk@21 (macOS) or sudo apt install openjdk-21-jre (Ubuntu)"
  exit 1
fi

info "Java $JAVA_VERSION found"

# ---------------------------------------------------------------------------
# Step 2: Download Exomiser CLI
# ---------------------------------------------------------------------------

step "Downloading Exomiser CLI v${EXOMISER_VERSION}..."

mkdir -p "$EXOMISER_DIR"

if [ -f "$EXOMISER_JAR" ]; then
  info "Exomiser CLI already downloaded"
else
  DOWNLOAD_URL="https://github.com/exomiser/Exomiser/releases/download/${EXOMISER_VERSION}/exomiser-cli-${EXOMISER_VERSION}-distribution.zip"
  ZIP_FILE="$EXOMISER_DIR/exomiser-cli-${EXOMISER_VERSION}-distribution.zip"

  echo "    Downloading from GitHub Releases (~163 MB)..."
  if curl -L --progress-bar -o "$ZIP_FILE" "$DOWNLOAD_URL"; then
    echo "    Extracting..."
    cd "$EXOMISER_DIR" && unzip -q -o "$ZIP_FILE"
    rm -f "$ZIP_FILE"

    if [ -f "$EXOMISER_JAR" ]; then
      info "Exomiser CLI extracted"
    else
      fail "Extraction failed — jar not found at $EXOMISER_JAR"
      exit 1
    fi
  else
    fail "Download failed"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Step 3: Download annotation data (hg38 + phenotype)
# ---------------------------------------------------------------------------

step "Checking annotation data..."

DATA_DIR="$EXOMISER_DIR/exomiser-cli-${EXOMISER_VERSION}/data"

# Check if data already exists
if [ -d "$DATA_DIR" ] && [ "$(ls -A "$DATA_DIR" 2>/dev/null | wc -l)" -gt 2 ]; then
  info "Annotation data already present in $DATA_DIR"
else
  echo "    Annotation data not found."
  echo ""
  echo "    Exomiser requires pre-built annotation databases (~2.5 GB)."
  echo "    These must be downloaded separately from the Exomiser data server."
  echo ""
  echo "    To download the data, run Exomiser's built-in data setup:"
  echo ""
  echo "      cd $EXOMISER_DIR/exomiser-cli-${EXOMISER_VERSION}"
  echo "      java -jar exomiser-cli-${EXOMISER_VERSION}.jar download --assembly hg38"
  echo ""
  echo "    Or download manually from: https://data.monarchinitiative.org/exomiser/"
  echo ""
  warn "Exomiser CLI is installed but annotation data is needed before use"
fi

# ---------------------------------------------------------------------------
# Step 4: Configure application.properties
# ---------------------------------------------------------------------------

step "Writing configuration..."

PROPS_FILE="$EXOMISER_DIR/exomiser-cli-${EXOMISER_VERSION}/application.properties"

if [ ! -f "$PROPS_FILE" ] || ! grep -q "exomiser.data-directory" "$PROPS_FILE" 2>/dev/null; then
  cat > "$PROPS_FILE" << EOF
# Exomiser configuration for Helix Genomics Agents
exomiser.data-directory=$DATA_DIR
exomiser.hg38.data-version=2402
exomiser.phenotype.data-version=2402
EOF
  info "Configuration written to application.properties"
else
  info "Configuration already exists"
fi

# ---------------------------------------------------------------------------
# Step 5: Verify installation
# ---------------------------------------------------------------------------

step "Verifying installation..."

if java -jar "$EXOMISER_JAR" --help > /dev/null 2>&1; then
  info "Exomiser CLI is working"
else
  warn "Exomiser CLI may need annotation data before full verification"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo -e "  ${GREEN}${BOLD}Exomiser setup complete!${RESET}"
echo ""
echo -e "  CLI:     ${EXOMISER_JAR}"
echo -e "  Data:    ${DATA_DIR}"
echo -e "  Version: ${EXOMISER_VERSION}"
echo ""
echo -e "  ${DIM}Exomiser is AGPL-3.0 licensed and runs as an external process.${RESET}"
echo -e "  ${DIM}It is not linked into the Helix codebase (MIT licensed).${RESET}"
echo ""
echo -e "  ${DIM}Agents can now use the 'prioritize_variants' MCP tool${RESET}"
echo -e "  ${DIM}for phenotype-driven rare disease variant prioritization.${RESET}"
echo ""
