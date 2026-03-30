<p align="center">
  <img src="docs/helix-logo.png" alt="Helix Genomics Agents" width="120">
</p>

<h1 align="center">Genomic Agent Discovery</h1>

<p align="center">
  <strong>AI agents that collaborate to analyze your DNA. Open source. Runs locally. Your data never leaves your machine.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#what-you-get">What You Get</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#configuration-reference">Configuration</a> &bull;
  <a href="#presets">Presets</a> &bull;
  <a href="#database">Database</a> &bull;
  <a href="#privacy--security">Privacy</a>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node 18+" src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg">
  <img alt="MCP Compatible" src="https://img.shields.io/badge/MCP-compatible-blueviolet.svg">
  <img alt="Databases" src="https://img.shields.io/badge/databases-12%2B-orange.svg">
  <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
</p>

---

Upload your raw DNA file from 23andMe, AncestryDNA, MyHeritage, FamilyTreeDNA, or any VCF -- and watch a team of AI agents fan out across 12+ public genomics databases, share discoveries with each other in real time, and produce a comprehensive health report. Everything runs on your machine. Nothing is uploaded anywhere.

<p align="center">
  <em>[screenshot: dashboard showing agents collaborating in real time]</em>
</p>

## Quick Start

```bash
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install && npm run build-db
npm start -- --dna ~/Downloads/my-dna-raw.txt
```

That's it. A dashboard opens in your browser and you can watch the agents work.

> **No API key?** If you have a Claude Max ($100/mo) or Pro ($20/mo) subscription, you don't need one. The Claude CLI authenticates via your subscription — just run `claude login` once and you're set. Your subscription covers unlimited agent runs with full MCP tool support. This is the recommended way to use Genomic Agent Discovery.

## What You Get

**A structured genomic health report** covering cancer genetics, cardiovascular risk, pharmacogenomics (how you metabolize 100+ drugs), neurological traits, and metabolic health -- all cross-referenced across 12 public databases and prioritized by clinical significance.

**A real-time dashboard** where you can watch agents query your DNA, discover findings, send messages to each other, and build on each other's research. It looks like a mission control room for your genome.

**Raw findings in JSON** for downstream analysis, integration with other tools, or building your own visualizations.

<p align="center">
  <em>[screenshot: sample report excerpt showing pharmacogenomics table]</em>
</p>

### What the agents actually do

1. **Parse** your raw DNA file (600K-5M+ variants depending on source)
2. **Query** each variant against ClinVar, GWAS Catalog, AlphaMissense, CADD, PharmGKB, CIViC, and more
3. **Talk to each other** -- the cancer agent might tell the pharma agent "this patient has a DPYD variant, check fluorouracil metabolism"
4. **Deduplicate** automatically so you don't get the same finding five times
5. **Synthesize** cross-domain patterns a single agent would miss
6. **Write** a clear, readable report with appropriate medical disclaimers

## Supported DNA Files

| Format | Provider | Typical Variants | File Extension |
|--------|----------|-----------------|----------------|
| 23andMe | 23andMe | ~600,000 | `.txt` |
| AncestryDNA | Ancestry | ~700,000 | `.txt` |
| MyHeritage | MyHeritage | ~700,000 | `.csv` |
| FamilyTreeDNA | FTDNA | ~700,000 | `.csv` |
| VCF | WGS / Clinical | 3,000,000+ | `.vcf`, `.vcf.gz` |

Format is auto-detected from the file header. You can override with `--format`.

## Installation

### Prerequisites

- **Node.js 18+** ([download](https://nodejs.org/))
- ~2GB disk space for the annotation database
- **One of the following** for LLM access (see below)

### Step 1: Clone and build

```bash
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install && npm run build-db
```

The `build-db` step downloads 12 public databases and compiles them into a single optimized SQLite file. This takes 5-15 minutes on a decent connection and only needs to happen once.

### Step 2: Connect an LLM

You need a way for agents to think. Pick **one** of these options:

#### Option A: Claude CLI with subscription (RECOMMENDED)

**Best experience. No API key. Unlimited runs. Full MCP tool support.**

If you have a [Claude Max](https://claude.ai) ($100/mo) or [Claude Pro](https://claude.ai) ($20/mo) subscription, this is the way to go. Your subscription covers all agent costs — no per-token charges, no surprise bills.

```bash
# Install the Claude CLI (one time)
npm install -g @anthropic-ai/claude-code

# Log in with your Claude account (one time — opens browser for OAuth)
claude login

# That's it. Run your analysis:
npm start -- --dna ~/Downloads/my-dna-raw.txt
```

The Claude CLI authenticates via OAuth and handles everything automatically. Agents get full MCP tool access to query all 12+ genomics databases. This is the default mode — no config changes needed.

#### Option B: Anthropic API key (pay-per-use)

```bash
# Set your key
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Run with API mode
npm start -- --dna my-dna.txt --provider anthropic-api
```

Get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys). Typical analysis costs $1-5 depending on preset.

#### Option C: OpenAI (GPT-4o, o1)

```bash
export OPENAI_API_KEY=sk-your-key-here
npm start -- --dna my-dna.txt --provider openai
```

Model mapping: `haiku` → gpt-4o-mini, `sonnet` → gpt-4o, `opus` → o1.

#### Option D: Google Gemini

```bash
export GEMINI_API_KEY=your-key-here
npm start -- --dna my-dna.txt --provider gemini
```

#### Option E: Ollama (FREE — runs locally)

```bash
# Install Ollama: https://ollama.ai
ollama pull llama3.1
npm start -- --dna my-dna.txt --provider ollama
```

Completely free. Runs on your hardware. Model mapping: `haiku` → llama3.1:8b, `sonnet` → llama3.1:70b.

#### Option F: Any OpenAI-compatible API (Groq, Together, Mistral, etc.)

```bash
export OPENAI_COMPATIBLE_API_KEY=your-key-here
export OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai/v1
npm start -- --dna my-dna.txt --provider openai-compatible
```

### Provider comparison

| Provider | API Key? | MCP Tools? | Cost | Best For |
|----------|----------|------------|------|----------|
| **Claude CLI** | No (OAuth) | Full | Subscription ($20-100/mo) | Best experience, unlimited use |
| Anthropic API | Yes | Full via CLI | ~$1-5/run | Pay-per-use, full features |
| OpenAI | Yes | Function calling | ~$1-5/run | Already have OpenAI key |
| Gemini | Yes | Function calling | ~$1-3/run | Google ecosystem |
| Ollama | No | Function calling | Free | Privacy, no internet needed |
| OpenAI-compatible | Yes | Function calling | Varies | Groq (fast), Together (cheap) |

> **Note:** Claude CLI mode provides the richest experience because MCP tools are natively supported — agents can directly query your genomics databases in real-time. Other providers use function calling as a bridge, which works but may be less reliable for complex multi-step research.

### Environment variables

```bash
# Provider keys (only set the one you're using)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai/v1
OLLAMA_URL=http://localhost:11434

# General settings
HELIX_DEFAULT_MODEL=sonnet          # Override default model for all agents
HELIX_COST_LIMIT=50.00              # Hard cost limit in USD (API providers only)
HELIX_DASHBOARD_PORT=3000           # Dashboard port
HELIX_DB_PATH=/path/to/unified.db   # Custom database path
```

You can also place these in a `.env` file (copy `.env.example` to get started).

## Usage

### Basic Analysis

```bash
# Analyze with default settings (5 collectors, auto-detect format)
npm start -- analyze ~/Downloads/23andme-raw.txt

# Specify format explicitly
npm start -- analyze --format ancestrydna ~/Downloads/AncestryDNA.txt

# Provide medical context for more relevant analysis
npm start -- analyze --medical-history "45M, family history of colon cancer, on statins" my-dna.txt
```

### With Presets

Presets are pre-tuned configurations for common use cases. They adjust which agents run, what genes they focus on, and how deep they go.

| Preset | Description | Agents | Est. Cost |
|--------|-------------|--------|-----------|
| `cancer` | Deep dive into tumor suppressors, oncogenes, DNA repair, cancer predisposition syndromes | 3 collectors + synthesizer + narrator | ~$2-4 |
| `pharma` | Comprehensive pharmacogenomics panel across all 34 CPIC genes with drug interaction tables | 2 collectors + synthesizer + narrator | ~$1-3 |
| `cardio` | Cardiovascular risk: lipid genes, cardiomyopathy, arrhythmia, coagulation, hypertension | 2 collectors + synthesizer + narrator | ~$1-3 |
| `neuro` | Neurological and psychiatric genetics: Alzheimer's, Parkinson's, psychiatric pharmacogenomics | 2 collectors + synthesizer + narrator | ~$1-3 |
| `metabolic` | Diabetes risk, obesity genetics, iron metabolism, thyroid, metabolic syndromes | 2 collectors + synthesizer + narrator | ~$1-2 |
| `full` | Everything. All 5 domain collectors + synthesis + report. Maximum coverage. | 5 collectors + synthesizer + narrator | ~$5-10 |

```bash
# Use a preset
npm start -- --preset cancer analyze my-dna.txt

# Presets can be combined with overrides
npm start -- --preset pharma --config my-overrides.yaml analyze my-dna.txt
```

### Custom Research Focus

Narrow the analysis to specific conditions, genes, or variants:

```bash
# Focus on specific conditions
npm start -- analyze --focus-conditions "breast cancer,ovarian cancer" my-dna.txt

# Focus on specific genes
npm start -- analyze --focus-genes "BRCA1,BRCA2,PALB2,CHEK2" my-dna.txt

# Focus on specific variants you already know about
npm start -- analyze --focus-variants "rs1801133,rs4244285" my-dna.txt
```

### Custom Configuration

Create a YAML config file for full control:

```yaml
# my-config.yaml
api:
  key: ${ANTHROPIC_API_KEY}

input:
  sex: male
  ancestry: EUR
  medical_history: "45-year-old male, family history of colon cancer"

pipeline:
  phases:
    - id: collectors
      parallel: true
      agents:
        - id: my-custom-agent
          role: collector
          model: sonnet
          label: "My Research Focus"
          prompt: |
            You are investigating the relationship between MTHFR variants
            and neural tube defects. Focus on folate metabolism, methylation
            pathways, and the interaction with B-vitamin status.
          focus_genes: [MTHFR, MTR, MTRR, FOLR1]
          max_findings: 5

cost:
  hard_limit_usd: 10.00

output:
  formats: [markdown, json, html]
```

```bash
npm start -- --config my-config.yaml analyze my-dna.txt
```

## Configuration Reference

### Pipeline Configuration

The pipeline runs in phases. Each phase contains one or more agents. Phases execute sequentially; agents within a parallel phase run concurrently.

```yaml
pipeline:
  phases:
    - id: collectors          # Unique phase ID
      label: "My Collectors"  # Display name in dashboard
      parallel: true          # Run agents concurrently
      agents: [...]           # Agent definitions

    - id: synthesis
      parallel: false
      wait_for: collectors    # Wait for this phase to finish
      agents: [...]
```

### Agent Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | string | required | Unique identifier for this agent |
| `role` | string | required | `collector`, `synthesizer`, or `narrator` |
| `model` | string | `haiku` | Model tier: `haiku`, `sonnet`, or `opus` |
| `label` | string | agent id | Display name in dashboard |
| `prompt` | string | -- | Inline system prompt |
| `prompt_file` | string | -- | Load prompt from file (alternative to `prompt`) |
| `prompt_append` | string | -- | Additional text appended to the prompt |
| `focus_genes` | string[] | `[]` | Genes this agent should prioritize |
| `focus_conditions` | string[] | `[]` | Conditions to investigate |
| `max_findings` | number | `5` | Maximum findings this agent can publish |
| `web_search` | boolean | `true` | Allow this agent to search the web |

### Research Focus

```yaml
research:
  focus_conditions: ["breast cancer", "type 2 diabetes"]
  focus_genes: ["BRCA1", "APOE", "MTHFR"]
  focus_variants: ["rs1801133", "rs4244285"]
  skip_domains: [neuro]  # Skip entire domains to save cost
```

### Cost Controls

```yaml
cost:
  warn_threshold_usd: 5.00    # Dashboard warning (doesn't stop)
  hard_limit_usd: 50.00       # Kills all agents if exceeded
  track_tokens: true           # Show token usage per agent
```

### Dashboard Settings

```yaml
dashboard:
  enabled: true
  port: 3000
  open_browser: true
  poll_interval_ms: 2000
```

### Agent Defaults

Applied to all agents unless overridden individually:

```yaml
agent_defaults:
  model: haiku
  max_tokens: 16384
  temperature: 0.3
  web_search: true
  check_messages_every: 7     # Check chatroom every N tool calls
```

## Architecture

### How It Works

```
                    Your DNA File
                         |
                    [DNA Parser]
                         |
                  Patient Genotype DB
                         |
         +-----------+---+---+-----------+
         |           |       |           |
     [Cancer]   [Cardio]  [Pharma]  [Neuro]  [Metabolic]
     Collector  Collector Collector Collector  Collector
         |           |       |           |         |
         +-----+-----+-------+-----+-----+---------+
               |                    |
          Agent Chatroom      Shared Findings
               |                    |
               +--------+-----------+
                        |
                   [Synthesizer]
                        |
                    [Narrator]
                        |
                  Final Report
```

1. **Parse**: Your raw DNA file is parsed into a SQLite database of genotypes (rsid, chromosome, position, alleles)
2. **Annotate**: The MCP server connects each agent to both your genotype DB and the unified annotation DB (12+ public sources)
3. **Collect**: Five domain-specialist agents run in parallel, each querying genes in their domain, cross-referencing databases, and publishing findings
4. **Communicate**: Agents share discoveries through a real-time chatroom and can read each other's published findings. The pharma agent sees what the cancer agent found and vice versa.
5. **Deduplicate**: Every finding is checked against existing findings using keyword overlap analysis. Duplicate research is blocked before it happens.
6. **Synthesize**: A synthesis agent reads all findings and identifies cross-domain patterns, resolves contradictions, and prioritizes by clinical actionability
7. **Narrate**: A report-writing agent produces the final human-readable report with appropriate structure and medical disclaimers
8. **Dashboard**: The entire process is visible through a real-time web dashboard showing agent status, findings, chat, cost, and progress

### MCP Tools

Every agent connects to the MCP server and has access to these tools:

#### Agent Communication

| Tool | Description |
|------|-------------|
| `publish_finding` | Share a finding with other agents and the dashboard. Auto-deduplicates. |
| `get_phase1_findings` | Read all findings published by all agents so far |
| `send_message` | Send a message to a specific agent or broadcast to all. Supports priority levels. |
| `get_messages` | Check the agent chatroom for messages addressed to you or broadcast |
| `log_web_search` | Log a web search before performing it. Warns if another agent already searched similar. |
| `get_web_searches` | See all web searches performed by all agents |

#### Patient Genotype Queries

| Tool | Description |
|------|-------------|
| `get_patient_summary` | High-level stats: variant count, chromosome distribution, inferred sex |
| `query_genotype` | Look up patient's alleles for a single rsID |
| `query_genotypes_batch` | Batch lookup for up to 200 rsIDs at once |

#### Annotation Database Queries

| Tool | Description |
|------|-------------|
| `query_gene` | Find all known variants for a gene across ClinVar, GWAS, and AlphaMissense, then check which the patient carries |
| `query_clinvar` | ClinVar pathogenicity classifications and review status |
| `query_gwas` | GWAS Catalog trait associations, p-values, and effect sizes |
| `query_alphamissense` | DeepMind AI pathogenicity predictions |
| `query_cadd` | CADD deleteriousness scores (PHRED-scaled) |
| `query_hpo` | Human Phenotype Ontology gene-phenotype associations |
| `query_disease_genes` | DisGeNET disease-gene associations ranked by score |
| `query_civic` | CIViC cancer variant clinical evidence |
| `query_pharmgkb` | PharmGKB drug-gene interaction annotations |
| `query_snpedia` | SNPedia community-curated variant summaries |

#### Pharmacogenomics

| Tool | Description |
|------|-------------|
| `get_pharmacogenomics` | Detailed pharmacogenomic analysis for a single gene (alleles, diplotypes, drug recommendations) |
| `get_all_pharmacogenomics` | Complete panel across all 34 CPIC pharmacogenes |

### Agent Communication

Agents don't just run in isolation. They coordinate through two mechanisms:

**Shared Findings Board** -- When an agent discovers something significant, it publishes a finding to a shared board. All other agents can read these findings and build on them. The board auto-deduplicates using keyword overlap analysis so agents don't waste time on redundant discoveries.

**Agent Chatroom** -- Agents can send direct messages to specific agents or broadcast to all. Messages have priority levels (`normal`, `urgent`, `critical`). Agents periodically check the chatroom for messages addressed to them. This enables cross-domain coordination -- the cancer agent can alert the pharma agent about a variant that affects chemotherapy metabolism.

Both mechanisms are visible in the real-time dashboard.

### Pipeline Phases

The default pipeline has three phases:

| Phase | Agents | Model | Purpose |
|-------|--------|-------|---------|
| **Collectors** (parallel) | 5 domain specialists | Haiku | Fast, focused data gathering across cancer, cardio, pharma, neuro, metabolic |
| **Synthesis** | 1 synthesizer | Sonnet | Cross-reference findings, identify patterns, resolve contradictions |
| **Narration** | 1 report writer | Opus | Write clear, structured, human-readable report |

This phase-based design is intentional: cheap fast models do the high-volume database querying, a mid-tier model does the analytical synthesis, and a top-tier model writes the final report. You can customize this entirely.

## Database

### Included Sources

The unified annotation database combines 12 public genomics databases into a single optimized SQLite file:

| Source | Description | Approx. Size | What It Provides |
|--------|-------------|--------------|-----------------|
| **ClinVar** | NCBI clinical variant database | ~2.5M variants | Pathogenicity classifications, phenotype associations, review status |
| **GWAS Catalog** | Genome-wide association studies | ~400K associations | Trait associations, p-values, effect sizes, study references |
| **CPIC** | Clinical Pharmacogenetics Consortium | 34 pharmacogenes | Star allele definitions, drug dosing guidelines, diplotype-phenotype maps |
| **AlphaMissense** | DeepMind AI predictions | ~70M missense variants | AI-predicted pathogenicity scores for all possible missense changes |
| **CADD** | Combined Annotation Dependent Depletion | Genome-wide | Variant deleteriousness scores, PHRED-scaled |
| **gnomAD** | Genome Aggregation Database | Multi-ancestry | Population allele frequencies across 6+ ancestry groups |
| **HPO** | Human Phenotype Ontology | Gene-level | Gene-to-clinical-phenotype mappings |
| **DisGeNET** | Disease-Gene Network | Gene-level | Curated and text-mined disease-gene relationships |
| **CIViC** | Clinical Interpretation of Variants in Cancer | Cancer variants | Expert-curated cancer variant clinical evidence |
| **PharmGKB** | Pharmacogenomics Knowledge Base | Drug-gene pairs | Drug-gene interactions, dosing annotations, clinical guidelines |
| **Orphanet** | Rare Disease Database | Gene-level | Rare/orphan disease gene associations |
| **SNPedia** | Community SNP Wiki | ~100K variants | Plain-language variant summaries and genotype interpretations |

### Building the Database

```bash
# Build all sources (recommended, ~5-15 min)
npm run build-db

# Verify the build
npm run verify-db
```

You can disable individual sources in your config to speed up the build or reduce disk usage:

```yaml
database:
  sources:
    clinvar: true
    gwas: true
    cpic: true
    alphamissense: false   # Skip if you don't need AI pathogenicity predictions
    cadd: true
    gnomad: true
    hpo: true
    disgenet: true
    civic: true
    pharmgkb: true
    orphanet: true
    snpedia: true
```

### Database Schema

The genotype database (created per analysis run):

```sql
CREATE TABLE genotypes (
    rsid        TEXT PRIMARY KEY,
    chromosome  TEXT NOT NULL,
    position    INTEGER NOT NULL,
    genotype    TEXT NOT NULL
);

CREATE TABLE metadata (
    key   TEXT PRIMARY KEY,
    value TEXT
);
```

The unified annotation database contains one table per source (clinvar, gwas, cpic_allele_definitions, cpic_recommendations, cpic_diplotypes, alphamissense, gnomad, hpo_genes, disgenet, civic_variants, pharmgkb_annotations, orphanet, snpedia) with source-appropriate schemas.

## Writing Custom Agents

### Role System

Every agent has a role that determines its behavior in the pipeline:

| Role | Purpose | When to Use |
|------|---------|-------------|
| `collector` | Query databases, gather findings, publish discoveries | Data gathering phases |
| `synthesizer` | Read all findings, identify patterns, cross-reference | Analysis phases |
| `narrator` | Write the final human-readable report | Output phases |

### Custom Prompts

The prompt is the most important part of an agent definition. It tells the agent what to focus on, which tools to use, and how to structure its output.

```yaml
agents:
  - id: rare-disease-investigator
    role: collector
    model: sonnet
    label: "Rare Disease Specialist"
    prompt: |
      You are a rare disease genetics specialist. Your job is to identify
      variants that may be associated with rare or orphan diseases.

      Start with get_patient_summary to understand the data scope.
      Then systematically query genes associated with rare diseases
      using query_disease_genes and cross-reference with Orphanet data.

      Pay special attention to:
      - Variants with very low population frequency in gnomAD
      - ClinVar entries marked as "Pathogenic" or "Likely pathogenic"
      - Genes associated with autosomal recessive conditions (check
        for homozygous or compound heterozygous variants)

      Check messages from other agents every few tool calls.
      Publish your 3-5 most significant findings.
    focus_genes:
      - CFTR
      - SMN1
      - GBA
      - HEXA
    max_findings: 5
```

### Example: Adding a Custom Agent to the Default Pipeline

```yaml
# my-config.yaml — merges on top of defaults
pipeline:
  phases:
    - id: collectors
      agents:
        # Your custom agent runs alongside the default 5
        - id: immunology-collector
          role: collector
          model: haiku
          label: "Immunology & HLA"
          prompt: |
            You are an immunogenetics specialist. Focus on HLA alleles,
            immune-related genes, autoimmune disease risk, and vaccine
            response genetics.
          focus_genes: [HLA_A, HLA_B, HLA_C, HLA_DRB1, IL6, TNF, CTLA4]
          max_findings: 5
```

## Presets

**`cancer`** -- Deep investigation of hereditary cancer syndromes. Covers BRCA1/2, Lynch syndrome genes (MLH1, MSH2, MSH6, PMS2), Li-Fraumeni (TP53), FAP (APC), and other tumor suppressor and oncogene pathways. Cross-references with CIViC for clinical cancer evidence.

**`pharma`** -- Comprehensive pharmacogenomics panel. Analyzes all 34 CPIC pharmacogenes covering drug metabolism enzymes (CYP2D6, CYP2C19, CYP2C9, CYP3A5), drug transporters (SLCO1B1, ABCG2), and high-risk genes (DPYD, TPMT, NUDT15). Outputs a drug interaction table.

**`cardio`** -- Cardiovascular genetics. Familial hypercholesterolemia (LDLR, APOB, PCSK9), cardiomyopathy (MYBPC3, MYH7), arrhythmia/long QT (SCN5A, KCNQ1, KCNH2), Factor V Leiden, and hypertension pathways.

**`neuro`** -- Neurological and psychiatric genetics. APOE for Alzheimer's risk, Parkinson's genes (LRRK2, GBA, SNCA), psychiatric pharmacogenomics (COMT, SLC6A4), and seizure-related genes.

**`metabolic`** -- Metabolic and endocrine genetics. Type 2 diabetes risk (TCF7L2, KCNJ11), MODY genes (HNF1A, GCK), obesity (FTO, MC4R), hereditary hemochromatosis (HFE), and thyroid function.

**`full`** -- All five domain collectors plus synthesis and narration. Maximum coverage, maximum insight. Best for a first-time comprehensive analysis.

## Output

### Findings Format

Each finding published by an agent follows this structure:

```json
{
  "timestamp": "2026-03-30T14:22:03.441Z",
  "from": "cancer-collector",
  "type": "risk",
  "domain": "cancer",
  "gene": "CHEK2",
  "finding": "Patient carries rs555607708 (c.1100delC) in CHEK2...",
  "confidence": 0.85,
  "variants": ["rs555607708"]
}
```

Finding types: `risk`, `protective`, `convergence`, `pharmacogenomic`, `notable`

### Report Formats

| Format | File | Description |
|--------|------|-------------|
| Markdown | `output/report.md` | Human-readable report with full formatting |
| JSON | `output/findings.json` | Structured findings for programmatic use |
| HTML | `output/report.html` | Styled report for viewing in a browser |

### Cost Summary

Every run outputs a cost breakdown:

```
=== Cost Summary ===
cancer-collector    (haiku)   : $0.12  (14K input, 3K output)
cardio-collector    (haiku)   : $0.09  (11K input, 2K output)
pharma-collector    (haiku)   : $0.15  (18K input, 4K output)
neuro-collector     (haiku)   : $0.08  (10K input, 2K output)
metabolic-collector (haiku)   : $0.07  ( 9K input, 2K output)
synthesizer         (sonnet)  : $0.45  (22K input, 5K output)
narrator            (opus)    : $1.80  (28K input, 8K output)
                               ------
Total                         : $2.76
```

## Privacy & Security

This project was designed with a single principle: **your DNA data never leaves your machine**.

- All analysis runs locally on your hardware
- Your raw DNA file is parsed into a local SQLite database that stays in the project directory
- The annotation database is built from publicly available data -- no proprietary databases
- The only network calls are to the Anthropic API (for running the AI agents) and optionally to the web (if agents perform research searches)
- Your API key is read from an environment variable or `.env` file -- it is never logged, stored in config, or sent anywhere other than Anthropic's API
- State files (findings, chat logs) are stored locally and can be deleted at any time
- No telemetry, no analytics, no tracking

## Limitations & Disclaimer

**This is NOT medical advice.** This software is a research tool that summarizes publicly available genetic information. It does not diagnose conditions, prescribe treatments, or replace professional medical guidance. Always discuss significant genetic findings with a qualified healthcare provider or genetic counselor.

**Raw chip data only.** Consumer DNA chips (23andMe, AncestryDNA, etc.) test 600K-700K variants out of the ~3 billion base pairs in your genome. Many clinically important variants may not be covered by your chip. The absence of a pathogenic variant in your results does NOT mean you don't carry it -- it may simply not be on the chip.

**No imputation.** This tool analyzes only the variants directly genotyped in your raw data file. It does not perform statistical imputation to infer ungenotyped variants.

**Database currency.** The annotation databases are downloaded at build time. ClinVar, GWAS Catalog, and other sources are updated regularly. Rebuild the database periodically (`npm run build-db`) to get the latest annotations.

**Population-specific considerations.** Risk calculations and allele frequencies may be more accurate for some ancestral populations than others, reflecting the composition of existing genetic studies. Specify your ancestry in the config for the most appropriate frequency comparisons.

## Contributing

Contributions are welcome. Some areas where help is especially valuable:

- **New database sources** -- Adding more public annotation databases to the unified DB
- **Parsers** -- Supporting additional DNA file formats
- **Agent prompts** -- Improving the domain-specialist prompts with clinical genetics expertise
- **Presets** -- Creating focused presets for specific research areas
- **Documentation** -- Improving guides, tutorials, and examples

```bash
# Run tests
npm test

# Verify database integrity
npm run verify-db
```

Please open an issue before starting work on large changes so we can discuss the approach.

## License

MIT. See [LICENSE](LICENSE) for details.

## Credits

Built by [Helix Sequencing](https://helixsequencing.com) -- privacy-first consumer genomics.

Uses the [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic for agent-to-tool communication.

Annotation data sourced from: [ClinVar](https://www.ncbi.nlm.nih.gov/clinvar/) (NCBI), [GWAS Catalog](https://www.ebi.ac.uk/gwas/) (NHGRI-EBI), [CPIC](https://cpicpgx.org/), [AlphaMissense](https://alphamissense.hegelab.org/) (DeepMind), [CADD](https://cadd.gs.washington.edu/), [gnomAD](https://gnomad.broadinstitute.org/) (Broad Institute), [HPO](https://hpo.jax.org/), [DisGeNET](https://www.disgenet.org/), [CIViC](https://civicdb.org/), [PharmGKB](https://www.pharmgkb.org/), [Orphanet](https://www.orpha.net/), [SNPedia](https://www.snpedia.com/).
