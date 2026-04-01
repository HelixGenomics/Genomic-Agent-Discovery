<p align="center">
  <img src="docs/helix-logo.png" alt="Helix Genomics Agents" width="120">
</p>

<h1 align="center">Genomic Agent Discovery</h1>

<p align="center">
  <strong>AI agents that collaborate to analyze your DNA. Open source. Runs locally. Your data never leaves your machine.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#dashboard">Dashboard</a> &bull;
  <a href="#presets">Presets</a> &bull;
  <a href="#agent-prompts">Agent Prompts</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#configuration-reference">Configuration</a> &bull;
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


## Maternal Debendox Exposure and Offspring Trisomy 9: A Multi-Domain Pharmacogenomic Analysis

This is something personally important to me and one of the main reasons for building a system like this. My brother has a rare condition Trisomy 9 Mosaicism. I built an agent preset that would research into the effects of specific medications (specifically Debendox) and how it could relate to the causation of my brothers condition as my mother took it during pregancny when whe was 18 during the 8-10 pregancny period. She was always convinced that this medicine was what caused her sons condition. Here I will publish the final findings of the report generated and its significance. 

### First here is a full sped up version of the pipeline running with full agent communcition.


<p align="center">
  <img src="docs/screenshots/DebendoxT9.gif" alt="Pipeline running — agents analyzing, findings arriving, inter-agent chat" width="720">
  <br>
  <em>Real-time pipeline: 7 agents collaborating on Debendox / Trisomy 9 Investigation</em>
</p>

The full preset agent json template can be found here:
 
 ```json
 {
   "helixTemplate": "1.0",
   "name": "Debendox / Trisomy 9 Investigation",
   "description": "5-collector tiered pipeline investigating maternal Debendox exposure and trisomy 9 — drug metabolism, folate pathways, meiotic segregation, chr9 dosage, and DNA repair",
   "basePreset": "custom",
   "agents": [
     {
       "id": "chromosome9-collector",
       "label": "Chromosome 9 Gene Dosage",
       "model": "haiku",
       "role": "collector",
       "prompt": "You are a cytogenetics researcher investigating the clinical impact of trisomy 9 (an extra copy of chromosome 9). The patient's mother was exposed to Debendox during pregnancy.\n\nResearch approach:\n1. Research which genes on chromosome 9 are dosage-sensitive — meaning an extra copy would have clinical consequences. Use web search for 'chromosome 9 dosage sensitive genes' and 'trisomy 9 clinical features'.\n2. Query chromosome 9 genes in the patient's genotype data. Look for pathogenic variants that become more significant with an extra copy.\n3. Investigate the critical regions of chromosome 9 — 9p21 (tumor suppression), 9q34 (multiple disease genes). Research what conditions map to these regions.\n4. Look for loss-of-heterozygosity patterns that might indicate which copy of chromosome 9 is trisomic.\n5. Research the literature on trisomy 9 mosaicism specifically — what percentage of cells need to be trisomic for clinical effects? What are the most commonly reported features?\n\nBe THOROUGH. You are the cheap model — query extensively, cross-reference databases, and follow every lead. The synthesizer needs rich data from you.\n\nPublish 3-5 findings about chromosome 9 gene dosage impact."
     },
     {
       "id": "folate-b6-collector",
       "label": "Folate & B-Vitamin Metabolism",
       "model": "haiku",
       "role": "collector",
       "prompt": "You are a researcher investigating the connection between folate/B-vitamin metabolism and chromosomal nondisjunction. Debendox contained pyridoxine (vitamin B6), and folate metabolism is critical for proper chromosome segregation.\n\nResearch approach:\n1. Research the established link between folate metabolism and aneuploidy risk. Use web search for 'MTHFR trisomy risk', 'folate deficiency nondisjunction', 'maternal folate chromosome segregation'. Find the key papers.\n2. Query the patient's data for variants in folate pathway genes — but research the pathway first. What are ALL the enzymes involved in one-carbon metabolism? Don't just check MTHFR.\n3. Investigate the B6 connection specifically — Debendox contained pyridoxine. Research which enzymes in the folate/methionine cycle are B6-dependent. Query those genes.\n4. Research homocysteine and DNA methylation — elevated homocysteine causes pericentromeric hypomethylation, which is a proposed mechanism for nondisjunction. What genes affect homocysteine levels?\n5. Look at folate transport genes, not just metabolism genes. Research whether the mother could have had inadequate folate delivery to the embryo.\n\nRemember: prenatal folic acid supplementation was not standard practice in 1980 when Debendox was prescribed.\n\nBe THOROUGH. Query extensively and follow every lead.\n\nPublish 3-5 findings connecting B-vitamin genetics to aneuploidy risk."
     },
     {
       "id": "meiotic-segregation-collector",
       "label": "Meiotic Segregation & Aneuploidy",
       "model": "haiku",
       "role": "collector",
       "prompt": "You are a researcher specializing in chromosome segregation and the genetics of aneuploidy. Investigate what genetic factors could predispose this patient's mother to chromosomal nondisjunction.\n\nResearch approach:\n1. Research the molecular machinery of chromosome segregation — cohesin complex, synaptonemal complex, spindle assembly checkpoint, kinetochore. Use web search for 'genetics of nondisjunction' and 'maternal age aneuploidy mechanisms'.\n2. For each component of the segregation machinery, query the patient's data for variants. Start with the most studied genes, then explore less common ones.\n3. Research whether drug exposure (specifically antihistamines like doxylamine) can disrupt spindle assembly or chromosome cohesion. Search the literature.\n4. Investigate DNA methyltransferase genes — centromeric DNA methylation is required for proper cohesion. Hypomethylation causes nondisjunction. Query these genes.\n5. Look at recombination genes — abnormal recombination patterns on chromosome 9 could predispose to its specific nondisjunction.\n\nBe THOROUGH. The mechanism of trisomy 9 is unknown — you're looking for genetic susceptibility factors that, combined with Debendox exposure, could have increased the risk.\n\nPublish 3-5 findings about aneuploidy susceptibility."
     },
     {
       "id": "debendox-metabolism-collector",
       "label": "Debendox Drug Metabolism",
       "model": "haiku",
       "role": "collector",
       "prompt": "You are a pharmacogenomics researcher investigating how this patient's mother metabolized Debendox. Debendox was a combination of doxylamine (antihistamine), dicyclomine (anticholinergic), and pyridoxine (vitamin B6).\n\nResearch approach:\n1. Start with get_all_pharmacogenomics to see the full metabolizer panel. Identify ALL abnormal results.\n2. Research which specific enzymes metabolize each Debendox component. Use web search — 'doxylamine metabolism CYP enzymes', 'dicyclomine pharmacokinetics'. Don't assume — find the evidence.\n3. For each metabolizing enzyme, check the patient's data. Classify metabolizer status. A poor or intermediate metabolizer would have prolonged drug exposure.\n4. Research placental drug transport — ABCB1 (P-glycoprotein) and ABCG2 (BCRP) control what crosses the placental barrier to reach the fetus. Query these genes. A reduced-function variant could mean increased fetal exposure.\n5. Investigate N-acetyltransferase (NAT2) — doxylamine is acetylated. Research the clinical significance of slow vs fast acetylator status for this drug.\n6. Consider the compound effect: if the mother was a slow metabolizer AND had reduced placental efflux, fetal exposure could have been significantly elevated.\n\nBe THOROUGH. Query every relevant gene, cross-reference with the pharmacogenomics database, and search the literature.\n\nPublish 3-5 findings about Debendox metabolism and fetal exposure risk."
     },
     {
       "id": "epigenetic-repair-collector",
       "label": "Epigenetics & DNA Repair",
       "model": "haiku",
       "role": "collector",
       "prompt": "You are a researcher investigating DNA repair and epigenetic factors that could predispose to chromosomal instability, particularly in the context of drug exposure during early pregnancy.\n\nResearch approach:\n1. Research the connection between DNA repair deficiency and aneuploidy. Use web search for 'DNA repair aneuploidy susceptibility' and 'BRCA1 spindle assembly checkpoint'. Several DNA repair genes have dual roles in chromosome segregation.\n2. Query the patient's data for variants in DNA repair pathway genes. Cross-reference with ClinVar for pathogenicity.\n3. Investigate epigenetic regulators — research how DNA methylation and histone modification affect chromosome stability. Which genes control pericentromeric methylation? Query those.\n4. Research telomere maintenance genetics — short telomeres are associated with increased aneuploidy. Check telomere-related genes.\n5. Investigate oxidative stress response genes — Debendox metabolites could generate reactive oxygen species. Research which genetic variants make cells more vulnerable to oxidative DNA damage.\n6. Look specifically at chromosome 9 epigenetic regulators — EHMT1 and SET are both on chromosome 9 and regulate histone methylation.\n\nBe THOROUGH. You're looking for a genetic 'second hit' that, combined with Debendox exposure, could have created the conditions for chromosome 9 nondisjunction.\n\nPublish 3-5 findings about DNA repair and epigenetic risk factors."
     },
     {
       "id": "synthesizer",
       "label": "Debendox-Trisomy 9 Synthesizer",
       "model": "sonnet",
       "role": "synthesizer",
       "prompt": "You are a senior clinical geneticist synthesizing findings from 5 specialist agents investigating the connection between maternal Debendox exposure and trisomy 9.\n\nRead ALL findings and messages from every agent. Your synthesis should:\n\n1. MAP THE CAUSAL CHAIN: Connect the evidence across agents. Does the drug metabolism profile → altered folate/B6 metabolism → centromeric hypomethylation → impaired chromosome cohesion → nondisjunction of chromosome 9? Evaluate each link with the evidence found.\n\n2. IDENTIFY COMPOUND RISK: Where do multiple moderate-risk variants converge? A mother who is both a slow metabolizer (prolonged drug exposure) AND has impaired folate metabolism (reduced methylation) AND has variants in cohesion genes faces compounded risk.\n\n3. EVALUATE ALTERNATIVES: Consider other mechanisms — direct genotoxic effects of Debendox, oxidative stress-mediated damage, pre-existing aneuploidy susceptibility unrelated to the drug, post-zygotic mosaic origin.\n\n4. ASSESS CONFIDENCE: For each proposed mechanism, rate the strength of evidence from the patient's data. Distinguish between 'this patient carries risk variants' and 'these variants are proven to cause nondisjunction'.\n\n5. CONTEXTUALIZE: Debendox was withdrawn in 1983. Trisomy 9 occurs in ~1 in 25,000-50,000 births. MTHFR variants are the best-studied folate-aneuploidy link. The question is not 'did Debendox cause this' but 'what genetic factors could have increased susceptibility'.\n\nUse web search to validate your synthesis against published literature.\n\nPublish up to 10 synthesized findings with confidence levels."
     },
     {
       "id": "narrator",
       "label": "Debendox-Trisomy 9 Report",
       "model": "sonnet",
       "role": "narrator",
       "prompt": "Write a comprehensive investigative report for a family seeking to understand their genetic landscape in context of maternal Debendox exposure and offspring trisomy 9.\n\nRead ALL findings from collectors and the synthesizer. This report should be thorough but written with empathy — this family has been seeking answers for decades.\n\nSections:\n1. Executive Summary\n2. Background (Debendox components, trisomy 9, what the scientific literature says)\n3. Maternal Drug Metabolism Profile\n4. Folate & B-Vitamin Pathway Analysis\n5. Chromosomal Segregation Risk Factors\n6. Chromosome 9 Gene Dosage Impact\n7. DNA Repair & Epigenetic Factors\n8. Integrated Risk Assessment (the proposed mechanism and its strength)\n9. Limitations & Disclaimers (cannot prove causation from genetics alone, chip limitations, not a medical diagnosis)\n10. Recommended Next Steps (genetic counseling, additional testing, what this means for the family)\n\nBe honest about what genetics can and cannot tell us. But also acknowledge the significance of what was found."
     }
   ],
   "settings": {
     "defaultModel": "haiku",
     "costLimit": 30,
     "temperature": 0.3,
     "maxToolCalls": 200,
     "checkMessages": 7,
     "webSearch": true
   },
   "medicalHistory": ""
 }
 ```

## The final interpretation can be found here: 
 
 - docs/narrator.md

I believe this provides a significant relation to the medication and my brothers diagnosis. I am looking for other people who have had similar outcomes related to debendox + birth defects for futher research in order to determine statistically that some of these interactions could of caused said defects. If anyone knows of such people please reach out to me at admin@helixsequencing.com.



Upload your raw DNA file from 23andMe, AncestryDNA, MyHeritage, FamilyTreeDNA, or any VCF -- and watch a team of AI agents fan out across 12+ public genomics databases, share discoveries with each other in real time, and produce a comprehensive health report. Everything runs on your machine. Nothing is uploaded anywhere.

<p align="center">
  <img src="docs/screenshots/gif-pipeline-running.gif" alt="Pipeline running — agents analyzing, findings arriving, inter-agent chat" width="720">
  <br>
  <em>Real-time pipeline: 7 agents collaborating on a cancer genomics analysis</em>
</p>

## Quick Start

### Have a Claude Pro or Max subscription? (Recommended)

No API key needed. Your subscription covers everything.

```bash
# 1. Install Claude CLI if you haven't already
npm install -g @anthropic-ai/claude-code

# 2. Log in once — opens browser OAuth (free, uses your Claude Pro/Max subscription)
claude login

# 3. Clone, build, and run
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install && npm run build-db
npm start -- --dna ~/Downloads/my-dna-raw.txt
```

A dashboard opens in your browser and you can watch the agents work. That's it — no API keys, no per-token charges.

**Dashboard-first mode:** Want to configure everything in the browser first?

```bash
npm start -- --serve
# Opens http://localhost:3000 — select your DNA file, pick a preset, customize agents, then click Start
```

### Using an Anthropic API key instead

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # get one at console.anthropic.com

git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install && npm run build-db
npm start -- --dna ~/Downloads/my-dna-raw.txt --provider anthropic-api
```

Typical cost: $1–5 per analysis run depending on preset. See [Provider options](#step-2-connect-an-llm) for OpenAI, Gemini, Ollama, and others.

## Dashboard

The dashboard is a real-time mission control for your genomic analysis. It provides full visibility into agent status, findings, inter-agent communication, and costs — all in a single page.

### Setup Panel

When you launch the dashboard, you'll see the setup panel where you configure your analysis before starting.

<p align="center">
  <img src="docs/screenshots/01-setup-panel.png" alt="Dashboard setup panel" width="720">
  <br>
  <em>Setup panel — select a preset, configure settings, and start your analysis</em>
</p>

### Preset Selection

Choose from 6 built-in research presets, each tuned for a specific domain. Selecting a preset instantly configures the agent pipeline, prompts, models, and focus areas.

<p align="center">
  <img src="docs/screenshots/-preset-switching.gif" alt="Switching between presets" width="720">
  <br>
  <em>Switch between presets — each configures a different agent team with specialized prompts</em>
</p>

Available presets:

| Preset | Agents | Est. Cost | Focus |
|--------|--------|-----------|-------|
| **Quick Scan** ⚡ | 2 | $0.05–0.10 | Fast overview across all domains |
| **Cancer Research** 🔬 | 7 | $0.50–2.00 | Deep cancer & tumor genetics with DPYD safety, platinum chemo, immunotherapy, and targeted therapy agents |
| **Cardiovascular** ❤️ | 6 | $0.30–1.00 | Lipid genetics, arrhythmia risk, coagulation, and structural heart |
| **Pharmacogenomics** 💊 | 4 | $0.20–0.80 | CYP enzyme panel, drug transporters, and full CPIC pharmacogene coverage |
| **Rare Disease** 🧬 | 7 | $0.40–1.50 | Metabolic disorders, neurological conditions, connective tissue, immunodeficiency, and rare cancer syndromes |
| **Custom** ⚙️ | You decide | Varies | Build your own agent pipeline from scratch |

### Database Status

The setup panel shows a live view of your annotation databases — which are loaded, how many rows each contains, and the total database size. This tells you at a glance whether you need to run `npm run build-db`.

<p align="center">
  <img src="docs/screenshots/03-database-status-expanded.png" alt="Database status panel expanded" width="720">
  <br>
  <em>13 databases loaded — 8.4M total rows across ClinVar, GWAS, CPIC, AlphaMissense, and more</em>
</p>

### Editable Agent Prompts & Tier Grouping

Every preset shows its agents grouped by tier: **Collection** (cheap models, high tool calls), **Synthesis** (smarter models combining findings), and **Report** (final output). Click any agent to expand and edit its prompt, change its model, or adjust settings.

<p align="center">
  <img src="docs/screenshots/05-editable-agent-prompts.png" alt="Editable agent prompts with tier grouping" width="720">
  <br>
  <em>Cancer preset — 5 haiku collectors, 1 sonnet synthesizer, 1 haiku report writer. All prompts editable.</em>
</p>

<p align="center">
  <img src="docs/screenshots/06-tier-grouping.png" alt="Tier grouping showing collection, synthesis, and report phases" width="720">
  <br>
  <em>Tiered pipeline: cheap models do high-volume database queries, expensive models synthesize findings</em>
</p>

### Template Import & Export

Share your custom agent configurations as JSON template files. Export your current setup (including any prompt edits) and import templates shared by others.

<p align="center">
  <img src="docs/screenshots/04-template-import-export.png" alt="Template import and export buttons" width="720">
  <br>
  <em>Import/Export buttons below the preset selector — share templates as JSON files</em>
</p>

Templates include all agents, prompts, model assignments, and settings. An example Debendox/Trisomy 9 investigation template is included in `config/templates/`.

### Output Configuration

Toggle markdown output and set a shared output directory for all agent reports. Files are named automatically based on agent IDs (e.g., `cancer-collector.md`, `synthesizer.md`).

<p align="center">
  <img src="docs/screenshots/07-output-config.png" alt="Output directory configuration" width="720">
  <br>
  <em>Output config — single shared directory, file preview chips show what will be generated</em>
</p>

The default output directory is `MD_DOCS/` in your repo root. Edit the path to save anywhere. Each agent writes its findings to a separate markdown file.

### Pipeline Animation

Once the analysis starts, the dashboard shows a real-time canvas visualization of the agent pipeline. Agents are distributed across concentric rings (scales to 20+ agents), with animated connections showing data flow and collaboration.

<p align="center">
  <img src="docs/screenshots/gif-pipeline-running.gif" alt="Full pipeline animation" width="720">
  <br>
  <em>Live pipeline — agents spawn, run, share findings, chat with each other, and complete</em>
</p>

The pipeline view shows:
- **Agent status** — spawning (blue pulse), running (green glow), done (solid green), error (red)
- **Findings** — each discovery appears in real-time with gene, confidence, and clinical category
- **Inter-agent chat** — agents coordinate in real-time (e.g., cancer agent alerts pharma agent about DPYD variant)
- **Cost tracking** — estimated cost updates as agents consume tokens
- **Log sizes** — see how much each agent has written

### Full Configuration Walkthrough

<p align="center">
  <img src="docs/screenshots/gif-config-walkthrough.gif" alt="Full configuration walkthrough" width="720">
  <br>
  <em>Complete walkthrough of the setup panel — presets, prompts, output, settings, and launch</em>
</p>

## What You Get

**A structured genomic health report** covering cancer genetics, cardiovascular risk, pharmacogenomics (how you metabolize 100+ drugs), neurological traits, and metabolic health -- all cross-referenced across 12 public databases and prioritized by clinical significance.

**A real-time dashboard** where you can watch agents query your DNA, discover findings, send messages to each other, and build on each other's research. It looks like a mission control room for your genome.

**Raw findings in JSON** for downstream analysis, integration with other tools, or building your own visualizations.


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
| 23andMe | 23andMe | ~600,000 | `.txt`, `.zip` |
| AncestryDNA | Ancestry | ~700,000 | `.txt`, `.zip` |
| MyHeritage | MyHeritage | ~700,000 | `.csv`, `.zip` |
| FamilyTreeDNA | FTDNA | ~700,000 | `.csv`, `.zip` |
| VCF | WGS / Clinical | 3,000,000+ | `.vcf`, `.vcf.gz` |

Format is auto-detected from the file header. You can override with `--format`.

**Archive support:** `.zip` and `.gz` files are automatically extracted before parsing. Just drop the file as-is from your provider — no need to unzip first.

**Chip detection:** When you select a file in the dashboard, it automatically detects your provider, chip version, SNP count, estimated imputed variants, and biological sex from chrX/chrY patterns.

## Installation

### Prerequisites

- **Node.js 18+** ([download](https://nodejs.org/))
- ~2GB disk space for the annotation database
- **One of the following** for LLM access (see below)

### Step 1: Clone and install

```bash
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install
```

### Step 2: Build the annotation database

This downloads 12 public genomics databases and compiles them into a single SQLite file. **Run this before your first analysis.**

```bash
npm run build-db
```

**What happens:**
1. Downloads ClinVar variants from NCBI (~100MB, ~4M rows)
2. Downloads GWAS Catalog associations from EBI (~50MB, ~400K rows)
3. Fetches CPIC pharmacogenomics data via REST API (~3.5K entries)
4. Downloads HPO gene-phenotype links from GitHub (~330K associations)
5. Downloads Orphanet rare disease genes from orphadata.com (~8K entries)
6. Downloads CIViC cancer evidence nightly dump (~5K entries)
7. Crawls SNPedia annotations via MediaWiki API (CC BY-NC-SA 3.0, ~400+ curated SNPs)
8. Fetches AlphaMissense/CADD/gnomAD scores via MyVariant.info API (batch queries, ~15 min each)
9. Optimizes and indexes the database

**Expected time:** 30-60 minutes on first run (mostly API rate limits). Re-runs are fast — downloads are cached for 7 days.

**Expected size:** ~1-2 GB

**Optional sources (require free registration):**
- **DisGeNET** — Register at https://www.disgenet.org/signup/ then download "Curated gene-disease associations" and place in `data/downloads/disgenet-curated.tsv.gz`

If these aren't available, the build continues without them — the script prints instructions.

**SNPedia annotations:** SNPedia data is licensed CC BY-NC-SA 3.0 and must be fetched directly from their API. The crawl covers 108K+ pages and can take 2-4 hours due to rate limiting. Downloads are cached for 30 days so you only crawl once. If it times out, re-run `npm run build-db` — it resumes from where it left off.

**Proxy support:** Some data sources have rate limits. You can set `HTTPS_PROXY` to speed up downloads:

```bash
HTTPS_PROXY=http://your-proxy:port npm run build-db
```

```bash
# Verify your database after build
npm run verify-db
```

### Step 3: Connect an LLM

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

## Presets

### Quick Scan ⚡

Fast 2-agent overview. A general health scanner checks the top genes across all domains (cancer, cardio, neuro, metabolic, coagulation) plus the full pharmacogenomics panel. A narrator produces a concise summary.

### Cancer Research 🔬

<p align="center">
  <img src="docs/screenshots/04-cancer-preset.png" alt="Cancer Research preset" width="720">
  <br>
  <em>Cancer Research preset — 7 specialized agents including DPYD safety, platinum chemo, immunotherapy, and targeted therapy</em>
</p>

Deep investigation with 7 agents:
- **Cancer & Tumor Genetics** — BRCA1/2, TP53, APC, Lynch syndrome genes, DNA repair pathways
- **DPYD Safety Agent** — Fluoropyrimidine toxicity screening (5-FU, capecitabine)
- **Platinum Chemotherapy** — ERCC1/2, GSTP1, BRCA1/2 for platinum response
- **Immunotherapy Markers** — HLA alleles, PD-L1, checkpoint inhibitor response prediction
- **Targeted Therapy** — PARP inhibitor eligibility, ATR/PI3K/RET/NTRK pathways
- **Cancer Synthesizer** (Sonnet) — Cross-references all findings for compound risk patterns
- **Report Writer** — Structured cancer genetics report with hereditary syndrome assessment

### Cardiovascular ❤️

<p align="center">
  <img src="docs/screenshots/12-cardio-preset.png" alt="Cardiovascular preset" width="720">
  <br>
  <em>Cardiovascular preset with expanded arrhythmia risk agent prompt</em>
</p>

6 agents covering:
- **Cardiovascular Genetics** — Lipid metabolism, structural heart, arrhythmia genes
- **Lipid & Cholesterol** — FH scoring, statin response, Lp(a), HDL/triglyceride genetics
- **Arrhythmia Risk** — Long QT, Brugada, CPVT, atrial fibrillation risk loci
- **Coagulation Factors** — Factor V Leiden, prothrombin, MTHFR, warfarin pharmacogenomics
- **Cardio Synthesizer** (Sonnet) — Integrated cardiovascular risk stratification
- **Report Writer** — Full cardiovascular genetics report

### Pharmacogenomics 💊

<p align="center">
  <img src="docs/screenshots/10-pharma-preset.png" alt="Pharmacogenomics preset" width="720">
  <br>
  <em>Pharmacogenomics preset with CYP enzyme panel prompt expanded</em>
</p>

4 agents for comprehensive drug metabolism analysis:
- **CYP Enzyme Panel** — All clinically significant CYP450 enzymes (CYP2D6, CYP2C19, CYP2C9, CYP3A4/5, CYP2B6, CYP1A2)
- **Drug Transporters** — SLCO1B1, ABCG2, ABCB1, OCT1/2 for drug distribution
- **Pharmacogenomics Panel** — Full 34 CPIC pharmacogene analysis
- **PGx Synthesizer** (Sonnet) — Cross-gene drug interactions and polypharmacy risk

### Rare Disease 🧬

<p align="center">
  <img src="docs/screenshots/11-rare-disease.png" alt="Rare Disease preset" width="720">
  <br>
  <em>Rare Disease preset — 7 agents covering metabolic, neurological, connective tissue, immunodeficiency, and rare cancer syndromes</em>
</p>

7 agents for rare/orphan disease investigation:
- **Metabolic Disorders** — Lysosomal storage, organic acid disorders, urea cycle, Wilson's disease
- **Neurological Conditions** — Parkinson's, CMT, epilepsy, hereditary spastic paraplegia, ALS
- **Connective Tissue** — Marfan, EDS, osteogenesis imperfecta, aortic aneurysm genes
- **Primary Immunodeficiency** — SCID genes, CGD, complement deficiencies, autoinflammatory
- **Rare Cancer Syndromes** — PTEN, MEN, VHL, NF1/2, tuberous sclerosis, BAP1
- **Rare Disease Synthesizer** (Sonnet) — Pattern recognition across systems, compound heterozygosity
- **Report Writer** — VUS prioritization with computational evidence scores

### Custom ⚙️

<p align="center">
  <img src="docs/screenshots/09-custom-preset.png" alt="Custom preset" width="720">
  <br>
  <em>Custom preset — add agents, set models, write your own research prompts</em>
</p>

Build your own pipeline from scratch. Add as many agents as you want, assign models (haiku/sonnet/opus), and write custom research prompts. Full control over what gets investigated and how.

## Agent Prompts

Every agent's research instructions are fully transparent. You can review the exact prompt each agent receives before starting analysis.

Prompts are embedded directly in the dashboard UI — no need to dig through YAML files. For built-in presets, prompts are read-only (they're expert-tuned). For Custom presets, everything is editable.

Example prompt (Cancer & Tumor Genetics agent):

```
You are a cancer genomics specialist. Focus on: tumor suppressor genes
(TP53, BRCA1/2, APC), DNA repair pathways (BRCA1, BRCA2, PALB2, RAD51),
mismatch repair genes (MLH1, MSH2, MSH6, PMS2), and cancer predisposition
syndromes (Lynch, Li-Fraumeni, FAP).

Use query_gene to investigate key cancer genes. Use query_civic for clinical
cancer variant evidence. Cross-reference with ClinVar and GWAS. Pay special
attention to pathogenic and likely-pathogenic variants in high-penetrance
cancer genes.

Publish your 3-5 most significant findings.
```

Each prompt tells the agent:
1. **What domain to focus on** — specific genes, conditions, pathways
2. **Which tools to use** — database queries, cross-referencing strategies
3. **How many findings to publish** — controls output volume
4. **What to prioritize** — pathogenic variants, clinical actionability, drug interactions

## Usage

### Basic Analysis

```bash
# Analyze with default settings (auto-detect format)
npm start -- analyze ~/Downloads/23andme-raw.txt

# Specify format explicitly
npm start -- analyze --format ancestrydna ~/Downloads/AncestryDNA.txt

# Provide medical context for more relevant analysis
npm start -- analyze --medical-history "45M, family history of colon cancer, on statins" my-dna.txt
```

### With Presets

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
3. **Collect**: Domain-specialist agents run in parallel, each querying genes in their domain, cross-referencing databases, and publishing findings
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
| **Collectors** (parallel) | Domain specialists | Haiku | Fast, focused data gathering across genomic domains |
| **Synthesis** | 1 synthesizer | Sonnet | Cross-reference findings, identify patterns, resolve contradictions |
| **Narration** | 1 report writer | Haiku/Opus | Write clear, structured, human-readable report |

This phase-based design is intentional: cheap fast models do the high-volume database querying, a mid-tier model does the analytical synthesis, and the report writer produces the final output. You can customize this entirely.

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

The database is built from scratch using public data sources — no pre-built downloads required. Each source has its own downloader script in `scripts/downloaders/`.

```bash
# Build all sources (~15-30 min depending on connection)
npm run build-db

# Verify the build
npm run verify-db
```

**How it works:**

1. **Schema initialization** — Creates all tables and indexes in SQLite
2. **Source downloads** — Each downloader fetches from its public source (NCBI, EBI, CPIC API, etc.)
3. **Parsing & import** — Data is parsed and batch-inserted using transactions for speed
4. **Optimization** — Runs ANALYZE and VACUUM for query performance

Downloads are cached in `data/downloads/` — re-running only re-downloads stale files (>7 days).

**Data source details:**

| Source | Method | Notes |
|--------|--------|-------|
| ClinVar | FTP download (TSV.gz) | Filters to GRCh38 assembly |
| GWAS Catalog | HTTP download (TSV) | Full associations from EBI |
| CPIC | REST API (JSON) | Alleles, recommendations, drug names |
| HPO | GitHub release (TSV) | Gene-to-phenotype associations |
| Orphanet | HTTP download (XML) | Rare disease gene associations |
| CIViC | Nightly TSV dump | Cancer variant clinical evidence |
| SNPedia | MediaWiki API | Paginated queries for annotated SNPs |
| AlphaMissense | MyVariant.info API | Batch queries for known rsIDs |
| CADD | MyVariant.info API | Batch queries for known rsIDs |
| gnomAD | MyVariant.info API | Batch queries for known rsIDs |
| DisGeNET | HTTP download (TSV.gz) | Requires free registration — prints instructions if auth fails |
| PharmGKB | HTTP download (ZIP) | Requires free registration — prints instructions if auth fails |

**Build order matters:** AlphaMissense, CADD, and gnomAD use the MyVariant.info API to fetch scores for rsIDs already in your database (from ClinVar and GWAS). Run ClinVar/GWAS first for best coverage.

**Registration-gated sources:** DisGeNET and PharmGKB require free accounts for bulk downloads. If auth fails, the build continues without them and prints step-by-step instructions for manual download.

### Database Schema

**Per-analysis genotype database:**

```sql
CREATE TABLE genotypes (
    rsid        TEXT PRIMARY KEY,
    chromosome  TEXT NOT NULL,
    position    INTEGER NOT NULL,
    genotype    TEXT NOT NULL
);
```

**Unified annotation database tables:**

| Table | Key Columns | Description |
|-------|-------------|-------------|
| `clinvar` | variation_id, rsid, gene, clinical_significance | Clinical variant interpretations |
| `gwas` | rsid, gene, trait, p_value, odds_ratio | Genome-wide association results |
| `cpic_alleles` | gene, allele, function, activity_score | Pharmacogene allele definitions |
| `cpic_recommendations` | gene, drug, phenotype, recommendation | Drug dosing guidelines |
| `alphamissense` | chromosome, position, score, classification | AI pathogenicity predictions |
| `cadd` | chromosome, position, raw_score, phred_score | Variant deleteriousness |
| `gnomad` | rsid, af_total, af_eur/afr/eas/sas/amr | Population allele frequencies |
| `hpo` | gene, hpo_id, hpo_name, disease_name | Gene-phenotype associations |
| `disgenet` | gene, disease_id, disease_name, score | Disease-gene associations |
| `civic` | gene, variant, disease, drugs, evidence_level | Cancer variant evidence |
| `pharmgkb` | gene, rsid, drug, evidence_level | Drug-gene annotations |
| `orphanet` | gene, orpha_code, disease_name | Rare disease associations |
| `snpedia` | rsid, magnitude, repute, summary | Community variant annotations |
| `gene_info` | gene_symbol, full_name, chromosome | Quick gene lookups |
| `build_metadata` | source, version, row_count, built_at | Build provenance tracking |

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
        # Your custom agent runs alongside the default collectors
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

### Markdown Agent Output

When markdown output is enabled in the dashboard (on by default), each agent writes its findings to a separate `.md` file in the configured output directory:

```
MD_DOCS/
├── cancer-collector.md
├── dpyd-safety.md
├── platinum-chemo.md
├── immunotherapy.md
├── targeted-therapy.md
├── synthesizer.md
└── narrator.md
```

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
- The only network calls are to the LLM API (for running the AI agents) and optionally to the web (if agents perform research searches)
- Your API key is read from an environment variable or `.env` file -- it is never logged, stored in config, or sent anywhere other than the API provider
- State files (findings, chat logs) are stored locally and can be deleted at any time
- No telemetry, no analytics, no tracking

## Limitations & Disclaimer

**This is NOT medical advice.** This software is a research tool that summarizes publicly available genetic information. It does not diagnose conditions, prescribe treatments, or replace professional medical guidance. Always discuss significant genetic findings with a qualified healthcare provider or genetic counselor.

**Raw chip data only.** Consumer DNA chips (23andMe, AncestryDNA, etc.) test 600K-700K variants out of the ~3 billion base pairs in your genome. Many clinically important variants may not be covered by your chip. The absence of a pathogenic variant in your results does NOT mean you don't carry it -- it may simply not be on the chip.

**No imputation.** This tool analyzes only the variants directly genotyped in your raw data file. It does not perform statistical imputation to infer ungenotyped variants.

**Database currency.** The annotation databases are downloaded at build time. ClinVar, GWAS Catalog, and other sources are updated regularly. Rebuild the database periodically (`npm run build-db`) to get the latest annotations.

**Population-specific considerations.** Risk calculations and allele frequencies may be more accurate for some ancestral populations than others, reflecting the composition of existing genetic studies. Specify your ancestry in the config for the most appropriate frequency comparisons.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines. Some areas where help is especially valuable:

- **New database sources** -- Adding more public annotation databases to the unified DB
- **Parsers** -- Supporting additional DNA file formats
- **Agent prompts** -- Improving the domain-specialist prompts with clinical genetics expertise
- **Presets** -- Creating focused presets for specific research areas
- **Dashboard** -- UI improvements, new visualizations, accessibility
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
