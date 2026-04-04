---
title: I Built a Multi-Agent System Where AI Agents Collaborate to Analyze Your Genome
published: true
tags: opensource, ai, javascript, beginners
cover_image: docs/screenshots/gif-pipeline-running.gif
---

I had my raw 23andMe file sitting in my downloads folder for three years. Every tool I found to analyze it either wanted me to upload my DNA to their servers, checked one database at a time, or charged $200+.

So I built something different: an open-source tool where multiple AI agents work together to analyze your raw DNA file across 12 public genomics databases. It runs entirely on your machine.

**GitHub:** [github.com/HelixGenomics/Genomic-Agent-Discovery](https://github.com/HelixGenomics/Genomic-Agent-Discovery)

## What Actually Happens

You give it a raw DNA file. It spawns a team of specialized AI agents — cancer genetics, pharmacogenomics, cardiovascular, rare disease — and they run in parallel, each querying your variants against databases like ClinVar, GWAS Catalog, AlphaMissense, and 9 more.

The interesting part: the agents talk to each other.

When the cancer agent finds a BRCA2 pathogenic variant, it sends an URGENT message to the pharmacogenomics agent: "this patient may need chemotherapy — check DPYD fluoropyrimidine metabolism immediately." The pharma agent confirms the patient is a DPYD*2A carrier and broadcasts a CRITICAL alert: "50% dose reduction required for any fluoropyrimidine-based chemo."

A single agent with one big prompt can't do this well. The cancer agent doesn't know about drug metabolism. The pharma agent doesn't know which cancer variants to worry about. But together they catch compound risks.

## The Architecture

```
                Your DNA File
                     |
                [DNA Parser]
                     |
              Patient Genotype DB
                     |
       +--------+----+----+--------+
       |        |         |        |
   [Cancer] [Cardio] [Pharma] [Rare Disease]
       |        |         |        |
       +----+---+----+----+---+----+
            |              |
       Agent Chatroom  Shared Findings
            |              |
            +------+-------+
                   |
              [Synthesizer]
                   |
               [Narrator]
                   |
             Final Report
```

### The MCP Server

Every agent connects to a custom MCP (Model Context Protocol) server that exposes 18 tools:

**Database queries:**
- `query_gene` — find all known variants for a gene across ClinVar, GWAS, AlphaMissense
- `query_clinvar` — pathogenicity classifications
- `query_gwas` — trait associations with p-values
- `query_alphamissense` — DeepMind AI pathogenicity predictions
- `query_pharmgkb` — drug-gene interactions
- Plus `query_cadd`, `query_hpo`, `query_disease_genes`, `query_civic`, `query_snpedia`

**Patient genotype:**
- `query_genotype` / `query_genotypes_batch` — look up what alleles the patient carries
- `get_patient_summary` — variant count, chromosome distribution

**Pharmacogenomics:**
- `get_all_pharmacogenomics` — complete panel across all 34 CPIC pharmacogenes

**Agent communication (this is the interesting part):**
- `publish_finding` — share a discovery with all agents. Auto-deduplicates using keyword overlap analysis.
- `send_message` — send a direct or broadcast message with priority levels (normal/urgent/critical)
- `get_messages` — check the chatroom for messages addressed to you
- `get_phase1_findings` — read all findings published by all agents

### How Deduplication Works

When an agent tries to publish a finding, it's checked against every existing finding using keyword overlap. If there's too much overlap, it's rejected. This prevents five agents from all publishing "patient carries rs1801133 in MTHFR" independently.

### How Agent Chat Works

Agents poll the chatroom every N tool calls (configurable, default 7). They're never blocked — it's async event-driven. The cancer agent publishes its BRCA2 finding and fires off the message, then keeps working. When the pharma agent next checks messages, it sees the urgent request and reprioritizes.

## The 12 Databases

All bundled into one local SQLite file with a single command:

```bash
npm run build-db
```

| Source | Size | What It Provides |
|--------|------|-----------------|
| ClinVar | ~2.5M variants | Pathogenicity classifications |
| GWAS Catalog | ~400K associations | Trait associations, p-values |
| CPIC | 34 pharmacogenes | Star alleles, drug dosing |
| AlphaMissense | ~70M predictions | DeepMind AI pathogenicity |
| CADD | Genome-wide | Deleteriousness scores |
| gnomAD | Multi-ancestry | Population frequencies |
| HPO | Gene-level | Phenotype mappings |
| DisGeNET | Gene-level | Disease-gene associations |
| CIViC | Cancer variants | Clinical evidence |
| PharmGKB | Drug-gene pairs | Drug interactions |
| Orphanet | Gene-level | Rare disease associations |
| SNPedia | ~100K variants | Community summaries |

The database build takes ~10 minutes (downloading public data) and only needs to happen once.

## Setup

Four commands:

```bash
npm install -g @anthropic-ai/claude-code
claude login
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery && npm install && npm run build-db
npm start -- --dna ~/Downloads/23andme-raw.txt
```

If you have a Claude subscription, that's it — no API key, no per-token charges. It uses OAuth.

Also works with:
- **Anthropic API** — `--provider anthropic-api`
- **OpenAI** — `--provider openai`
- **Gemini** — `--provider gemini`
- **Ollama** — `--provider ollama` (fully free, fully local, no network calls at all)

## The Dashboard

A real-time browser dashboard shows everything:

- Agent status — spawning, running, done, error
- Findings feed — each discovery with gene, confidence, and category
- Inter-agent chat — watch agents coordinate in real-time
- Cost tracking — estimated spend per agent
- Canvas visualization — agents distributed across concentric rings with animated connections

Every agent's prompt is visible in the dashboard before you start. You can read exactly what each agent is told to investigate. For the Custom preset, prompts are fully editable.

## Five Built-In Presets

| Preset | Agents | What It Covers |
|--------|--------|---------------|
| Quick Scan | 2 | Fast overview across all domains |
| Cancer Research | 7 | BRCA, Lynch, DPYD safety, platinum chemo, immunotherapy, targeted therapy |
| Cardiovascular | 6 | FH scoring, arrhythmia, coagulation, lipid genetics |
| Pharmacogenomics | 4 | All CYP enzymes, drug transporters, full CPIC panel |
| Rare Disease | 7 | Metabolic, neurological, connective tissue, immunodeficiency, rare cancer syndromes |

Or build your own Custom pipeline with as many agents as you want.

## Privacy

Your DNA data never leaves your machine. The only network calls are to whatever LLM provider you choose (and even that is eliminated if you use Ollama). No telemetry, no analytics, no data retention.

## What I'd Love Feedback On

- **Agent prompts** — I'm not a clinical geneticist. If you are, the domain prompts could probably be improved with your expertise.
- **The MCP communication pattern** — has anyone found better approaches for multi-agent coordination?
- **Deduplication** — is keyword overlap too aggressive or too lenient?

MIT licensed. PRs welcome.

**GitHub:** [github.com/HelixGenomics/Genomic-Agent-Discovery](https://github.com/HelixGenomics/Genomic-Agent-Discovery)

---

*Disclaimer: This is a research tool, not medical advice. Consumer DNA chips cover 600K-700K of ~3B base pairs. Always discuss significant findings with a genetic counselor.*
