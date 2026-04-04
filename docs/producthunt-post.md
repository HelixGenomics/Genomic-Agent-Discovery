# Product Hunt Launch

## Tagline (60 chars max)
AI agents collaborate to analyze your DNA — open source, local

## Description

Upload your raw DNA file (23andMe, AncestryDNA, VCF) and watch a team of AI agents fan out across 12 public genomics databases, share discoveries with each other in real-time, and produce a comprehensive health report.

Everything runs on your machine. Your DNA data never leaves your computer. Zero telemetry.

**How it works:**

Specialized agents run in parallel — cancer genetics, pharmacogenomics, cardiovascular, rare disease — each querying your variants against ClinVar, GWAS Catalog, AlphaMissense, CPIC, and 8 more databases. They coordinate through a custom MCP server with 18 tools: publishing findings to a shared board (with automatic deduplication) and messaging each other through a chatroom with priority levels.

When the cancer agent finds a BRCA2 variant, it sends an urgent message to the pharma agent to check chemotherapy metabolism. That kind of cross-domain coordination is something a single prompt can't do.

**Setup in 4 commands:**
```
npm install -g @anthropic-ai/claude-code && claude login
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery && npm install && npm run build-db
npm start -- --dna my-dna.txt
```

**Works with:** Claude CLI (subscription, no API key), Anthropic API, OpenAI, Gemini, Ollama (fully free & local), or any OpenAI-compatible endpoint.

**5 built-in presets:** Cancer Research (7 agents), Cardiovascular (6), Pharmacogenomics (4), Rare Disease (7), or build your own Custom pipeline. Every agent prompt is fully transparent and visible before analysis starts.

MIT licensed. Open source. PRs welcome.

## Topics
- Open Source
- Artificial Intelligence
- Health
- Developer Tools
- Genomics

## First Comment (post immediately after launch)

Hi Product Hunt! I built this because I had my raw 23andMe file sitting in my downloads for years and never did anything useful with it.

The existing options either want you to upload your DNA to their servers, only check one database at a time, or cost a fortune. So I built something that:

- Runs entirely on your machine (privacy-first)
- Queries 12 public databases bundled into one local SQLite file
- Uses multiple AI agents that actually coordinate with each other
- Works with Ollama so you can run it fully offline for free

The part I'm most interested in feedback on is the agent communication architecture — they use Anthropic's MCP protocol to share findings and send each other messages. It produces noticeably better results than having one agent do everything.

Would love to hear what you think, especially from anyone with a genetics or bioinformatics background. The agent prompts could always be improved with domain expertise.

GitHub: https://github.com/HelixGenomics/Genomic-Agent-Discovery

## Maker Comment (reply to first comment)

Some stats on the database that gets built with one command:
- ClinVar: 2.5M variant classifications
- GWAS Catalog: 400K trait associations
- AlphaMissense: 70M DeepMind pathogenicity predictions
- CPIC: 34 pharmacogenes with drug dosing guidelines
- Plus gnomAD, CADD, HPO, DisGeNET, CIViC, PharmGKB, Orphanet, SNPedia

All public data, all local, all queryable by the AI agents through MCP tools.

## Media to Upload
1. gif-pipeline-running.gif (hero image / video)
2. 01-setup-panel.png
3. 04-cancer-preset.png
4. 06-prompts-expanded.png
5. 07-output-config.png
