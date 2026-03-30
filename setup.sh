#!/usr/bin/env bash
# ============================================================
# Helix Genomics Agents — One-Shot Setup Script
# ============================================================
#
# This script sets up everything you need to run the analysis.
# Safe to run multiple times (idempotent).
#
# Usage:
#   bash setup.sh              # Full setup including database build
#   bash setup.sh --skip-db    # Skip database download (faster)
#
# ============================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUIRED_NODE_MAJOR=18
SKIP_DB=false

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --skip-db)  SKIP_DB=true ;;
    --help|-h)
      echo "Usage: bash setup.sh [--skip-db]"
      echo ""
      echo "  --skip-db    Skip building the reference database"
      echo "  --help       Show this help"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

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
fail()    { echo -e "  ${RED}[FAIL]${RESET}  $1"; }
step()    { echo -e "\n  ${CYAN}${BOLD}$1${RESET}"; }
dimtext() { echo -e "  ${DIM}$1${RESET}"; }

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------

echo ""
echo -e "  ${CYAN}=================================================${RESET}"
echo -e "       ${BOLD}HELIX GENOMICS AGENTS — SETUP${RESET}"
echo -e "       ${DIM}Multi-Agent DNA Analysis Pipeline${RESET}"
echo -e "  ${CYAN}=================================================${RESET}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Check prerequisites
# ---------------------------------------------------------------------------

step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
  fail "Node.js is not installed."
  echo "  Install Node.js 18+: https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  fail "Node.js ${REQUIRED_NODE_MAJOR}+ required (you have v${NODE_VERSION})"
  echo "  Update Node.js: https://nodejs.org/"
  exit 1
fi
info "Node.js v${NODE_VERSION}"

# Check npm
if ! command -v npm &> /dev/null; then
  fail "npm is not installed."
  exit 1
fi
NPM_VERSION=$(npm -v)
info "npm v${NPM_VERSION}"

# Check for sqlite3 (needed for database build)
if command -v sqlite3 &> /dev/null; then
  SQLITE_VERSION=$(sqlite3 --version | awk '{print $1}')
  info "SQLite v${SQLITE_VERSION}"
else
  warn "sqlite3 CLI not found (optional — better-sqlite3 npm module will be used)"
fi

# ---------------------------------------------------------------------------
# Step 2: Install dependencies
# ---------------------------------------------------------------------------

step "Installing npm dependencies..."

cd "$SCRIPT_DIR"

if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
  # Check if package.json is newer than node_modules
  if [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    dimtext "package.json changed, updating dependencies..."
    npm install --no-fund --no-audit 2>&1 | tail -1
    info "Dependencies updated"
  else
    info "Dependencies already installed (up to date)"
  fi
else
  npm install --no-fund --no-audit 2>&1 | tail -1
  info "Dependencies installed"
fi

# ---------------------------------------------------------------------------
# Step 3: Create .env from .env.example
# ---------------------------------------------------------------------------

step "Configuring environment..."

if [ -f ".env" ]; then
  # Check if it has a real API key
  if grep -q "sk-ant-api03-your-key-here" ".env" 2>/dev/null; then
    warn ".env exists but still has placeholder API key"
    dimtext "Edit .env and add your real ANTHROPIC_API_KEY"
  elif grep -q "ANTHROPIC_API_KEY=" ".env" 2>/dev/null; then
    info ".env configured"
  else
    warn ".env exists but missing ANTHROPIC_API_KEY"
  fi
else
  if [ -f ".env.example" ]; then
    cp .env.example .env
    info "Created .env from .env.example"
    warn "You need to add your ANTHROPIC_API_KEY to .env"
    dimtext "Edit .env and replace 'sk-ant-api03-your-key-here' with your real key"
  else
    warn "No .env.example found — creating minimal .env"
    echo "# Helix Genomics Agents — Environment" > .env
    echo "ANTHROPIC_API_KEY=" >> .env
    warn "Add your ANTHROPIC_API_KEY to .env"
  fi
fi

# ---------------------------------------------------------------------------
# Step 4: Create required directories
# ---------------------------------------------------------------------------

step "Setting up directories..."

mkdir -p data
mkdir -p data/downloads
mkdir -p state
mkdir -p output

info "data/ directory ready"
info "state/ directory ready"
info "output/ directory ready"

# ---------------------------------------------------------------------------
# Step 5: Build reference database (unless --skip-db)
# ---------------------------------------------------------------------------

if [ "$SKIP_DB" = true ]; then
  step "Skipping database build (--skip-db)"
  dimtext "Run later with: npm run build-db"
else
  step "Building reference database..."
  dimtext "This downloads and indexes public genomic databases."
  dimtext "First run may take 10-30 minutes depending on internet speed."
  echo ""

  if [ -f "scripts/build-database.sh" ]; then
    bash scripts/build-database.sh
  else
    warn "scripts/build-database.sh not found — skipping database build"
    dimtext "Create the script or run: npm run build-db"
  fi
fi

# ---------------------------------------------------------------------------
# Step 6: Verify database
# ---------------------------------------------------------------------------

DB_PATH="data/helix-unified.db"

if [ -f "$DB_PATH" ]; then
  step "Verifying database..."
  if [ -f "scripts/verify-database.mjs" ]; then
    node scripts/verify-database.mjs || warn "Database verification had warnings (see above)"
  else
    info "Database file exists: ${DB_PATH}"
    dimtext "Run verification later with: npm run verify-db"
  fi
else
  if [ "$SKIP_DB" = false ]; then
    warn "Database not found at ${DB_PATH}"
    dimtext "The build may not have completed. Try: npm run build-db"
  fi
fi

# ---------------------------------------------------------------------------
# Done — Print quick-start instructions
# ---------------------------------------------------------------------------

echo ""
echo -e "  ${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo -e "  ${CYAN}${BOLD}Quick Start${RESET}"
echo ""

# Check if API key is configured
if [ -f ".env" ] && grep -q "ANTHROPIC_API_KEY=sk-ant-" ".env" 2>/dev/null && ! grep -q "your-key-here" ".env" 2>/dev/null; then
  echo -e "  Your API key is configured. You're ready to go!"
  echo ""
else
  echo -e "  ${YELLOW}1. Add your Anthropic API key:${RESET}"
  echo -e "     ${DIM}Edit .env and set ANTHROPIC_API_KEY=sk-ant-...${RESET}"
  echo ""
fi

if [ ! -f "$DB_PATH" ]; then
  echo -e "  ${YELLOW}2. Build the reference database:${RESET}"
  echo -e "     ${DIM}npm run build-db${RESET}"
  echo ""
fi

echo -e "  ${BOLD}Run your first analysis:${RESET}"
echo ""
echo -e "     ${DIM}# Quick scan (~\$0.50, 2-3 minutes)${RESET}"
echo -e "     node src/cli.mjs --dna ~/your-dna-file.txt --preset quick-scan"
echo ""
echo -e "     ${DIM}# Pharmacogenomics only (~\$0.50)${RESET}"
echo -e "     node src/cli.mjs --dna ~/your-dna-file.txt --preset pharmacogenomics"
echo ""
echo -e "     ${DIM}# Full health analysis (~\$5-15)${RESET}"
echo -e "     node src/cli.mjs --dna ~/your-dna-file.txt --preset full-health"
echo ""
echo -e "  ${DIM}See all options: node src/cli.mjs --help${RESET}"
echo ""
