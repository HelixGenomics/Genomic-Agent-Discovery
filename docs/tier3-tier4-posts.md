# Tier 3 & Tier 4 Posts

---

## Hashnode Article

**Title:** How I Built AI Agents That Talk to Each Other to Analyze Your DNA

**Tags:** AI, Open Source, JavaScript, Bioinformatics

**Body:**

Cross-post the Dev.to article with canonical URL set to the Dev.to version:

```yaml
---
title: How I Built AI Agents That Talk to Each Other to Analyze Your DNA
canonical_url: https://dev.to/YOUR_USERNAME/i-built-a-multi-agent-system-where-ai-agents-collaborate-to-analyze-your-genome-XXXX
tags: ai, opensource, javascript, bioinformatics
---
```

Same content as `devto-article.md`. Hashnode's community discovery will promote it automatically.

---

## Medium Article

**Submit to:** Towards Data Science, Better Programming, or The Startup

**Title:** What If AI Agents Could Read Your DNA?

**Subtitle:** I built an open-source tool where specialized AI agents collaborate across 12 genomics databases to analyze raw DNA files — and it all runs on your machine.

**Body (shorter, more narrative than Dev.to):**

I had my 23andMe raw data file sitting in my downloads folder for three years. I knew it contained 600,000 genetic variants, but I had no idea what most of them meant.

The tools available to analyze it were either expensive, required uploading your most personal data to someone else's servers, or only checked one database at a time. So I built something different.

**Genomic Agent Discovery** is an open-source tool where a team of AI agents collaborates in real-time to analyze your raw DNA file across 12 public genomics databases. Everything runs locally on your machine.

### The Key Insight: Agents Need to Talk

A single AI with one big prompt doesn't work well for genomic analysis. Cancer genetics and drug metabolism are different domains. A cancer specialist doesn't know which variants affect chemotherapy dosing, and a pharmacogenomics expert doesn't know which cancer variants to worry about.

But when you give them a way to communicate, something interesting happens.

In one analysis, the cancer agent found a BRCA2 pathogenic variant and sent an urgent message to the pharmacogenomics agent: "this patient may need chemotherapy — check fluoropyrimidine metabolism." The pharma agent confirmed the patient carries a DPYD variant that causes severe toxicity to a common chemotherapy drug, and broadcast a critical alert to all agents.

No single agent would have connected those dots.

### How It Works

The agents communicate through a custom server using Anthropic's MCP (Model Context Protocol). Each agent has access to 18 tools — database queries, patient genotype lookups, and communication tools for publishing findings and sending messages to other agents.

The communication has two channels:
- A **shared findings board** where agents publish discoveries (with automatic deduplication so five agents don't all report the same thing)
- A **chatroom** with priority levels where agents send targeted or broadcast messages

All 12 databases — ClinVar, GWAS Catalog, AlphaMissense, CPIC, and 8 more — are bundled into a single local SQLite file built with one command. Query latency is sub-millisecond.

### Five Presets, or Build Your Own

The tool comes with five built-in presets: Cancer Research (7 agents), Cardiovascular (6 agents), Pharmacogenomics (4 agents), Rare Disease (7 agents), and a Quick Scan. Or build your own custom pipeline with whatever agents you want.

Every agent's instructions are fully transparent — you can read exactly what each agent is told to investigate before starting the analysis.

### Privacy by Design

Your DNA data never leaves your machine. The annotation databases are public data downloaded once. The only network calls are to the AI provider — and even those are eliminated if you use Ollama for fully offline analysis.

### Try It

```
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install && npm run build-db
npm start -- --dna ~/Downloads/23andme-raw.txt
```

Works with Claude, OpenAI, Gemini, or Ollama (free). MIT licensed.

[GitHub](https://github.com/HelixGenomics/Genomic-Agent-Discovery)

*Disclaimer: This is a research tool, not medical advice. Always discuss significant genetic findings with a qualified healthcare provider.*

---

## LinkedIn Post

I had my raw 23andMe file sitting in my downloads for three years and never did anything with it.

The options were: upload your DNA to someone else's servers, pay $200+, or check one database at a time.

So I built an open-source tool that does it all locally.

Genomic Agent Discovery uses multiple AI agents that work together — each specializing in a domain like cancer genetics, pharmacogenomics, or cardiovascular risk. They query your variants against 12 public databases (ClinVar, GWAS, AlphaMissense, CPIC, and more) and coordinate with each other through a real-time chatroom.

When the cancer agent finds a BRCA2 variant, it messages the pharma agent to check chemotherapy metabolism. That kind of cross-domain coordination catches compound risks a single analysis would miss.

Setup is 4 commands. Works with Claude, OpenAI, Gemini, or Ollama (fully free and local). Your DNA data never leaves your machine.

MIT licensed. Open source. Contributions welcome — especially from anyone with clinical genetics expertise.

https://github.com/HelixGenomics/Genomic-Agent-Discovery

#OpenSource #Genomics #AI

---

## Lobste.rs

**Title:** Genomic Agent Discovery: Multi-agent DNA analysis across 12 databases via MCP

**Tags:** ai, javascript, opensource, science

Just submit the GitHub link. No text body needed — Lobste.rs is link-based like HN.

First you need an invite. Go to https://lobste.rs/invitations and submit to the invitation queue with your GitHub profile URL. Mention you're the author of the project. Authors of submitted content get invited quickly.

---

## Biostars.org Post

**Title:** Open-source tool: AI agents analyze raw DNA files across ClinVar, GWAS, AlphaMissense, CPIC, and 8 more databases

**Category:** Tool

**Body:**

Hi Biostars,

I've released an open-source tool called Genomic Agent Discovery that uses multiple AI agents to analyze raw consumer DNA data (23andMe, AncestryDNA, MyHeritage, FTDNA, VCF) against 12 public genomics databases.

**Databases included (all bundled into one local SQLite):**
- ClinVar (~2.5M variants)
- GWAS Catalog (~400K associations)
- CPIC (34 pharmacogenes)
- AlphaMissense (~70M DeepMind predictions)
- CADD, gnomAD, HPO, DisGeNET, CIViC, PharmGKB, Orphanet, SNPedia

**How it works:**

Specialized agents run in parallel — cancer genetics, pharmacogenomics, cardiovascular, rare disease. Each agent queries relevant genes using MCP tools (query_gene, query_clinvar, query_gwas, etc.) and publishes findings to a shared board with automatic deduplication. Agents communicate through a chatroom with priority levels for cross-domain coordination.

5 built-in presets or build custom pipelines. Every agent prompt is visible and transparent.

**Setup:**
```
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install && npm run build-db
npm start -- --dna raw-dna.txt
```

Works with multiple LLM providers including Ollama for fully local/free analysis. MIT licensed.

GitHub: https://github.com/HelixGenomics/Genomic-Agent-Discovery

Looking for feedback from people with clinical genetics expertise — the agent prompts could be improved with domain knowledge. Contributions welcome.

*This is a research tool, not for clinical use.*

---

## Newsletter Outreach Emails

### Console.dev

**Subject:** Open-source submission: Genomic Agent Discovery

**Body:**

Hi,

I'd like to submit Genomic Agent Discovery for consideration in Console.

It's an open-source (MIT) tool where multiple AI agents collaborate to analyze raw DNA files across 12 public genomics databases. The agents communicate through a custom MCP server — publishing findings to a shared board with auto-deduplication and messaging each other through a prioritized chatroom.

Key details:
- Node.js / React, MIT licensed
- 12 databases bundled into one SQLite file (ClinVar, GWAS, AlphaMissense, CPIC, etc.)
- Works with Claude CLI, OpenAI, Gemini, or Ollama (fully local/free)
- Real-time browser dashboard
- GitHub: https://github.com/HelixGenomics/Genomic-Agent-Discovery

Thanks for considering it.

### TLDR Newsletter

**Subject:** Open-source: AI agents that collaborate to analyze your DNA locally

**Body:**

Hi,

Built an open-source tool (MIT) where AI agents work together to analyze raw DNA files (23andMe, AncestryDNA, VCF) across 12 public genomics databases. Everything runs locally — privacy-first, no data leaves your machine.

The interesting bit: agents communicate through Anthropic's MCP protocol with a shared findings board and chatroom. When the cancer agent finds a variant, it alerts the pharma agent to check drug metabolism.

4 commands to set up. Works with Ollama for fully free/local analysis.

GitHub: https://github.com/HelixGenomics/Genomic-Agent-Discovery

Happy to provide more details if it's a fit for TLDR.

### Changelog

**Subject:** Genomic Agent Discovery — open-source multi-agent DNA analysis

**Body:**

Hi Changelog team,

Sharing an open-source project that might be interesting for the newsletter/podcast.

Genomic Agent Discovery is a multi-agent system where AI agents collaborate to analyze raw DNA files across 12 public genomics databases (ClinVar, GWAS, AlphaMissense, CPIC, gnomAD, and 7 more). The agents coordinate through Anthropic's MCP protocol — sharing findings and sending each other prioritized messages.

It's MIT licensed, runs locally (DNA data never leaves your machine), and works with Claude, OpenAI, Gemini, or Ollama for fully offline analysis.

GitHub: https://github.com/HelixGenomics/Genomic-Agent-Discovery

---

## Discord/Slack Community Intros

### Anthropic Discord / Claude Community

Hey! Built an open-source project using MCP that might interest people here.

It's a multi-agent genomic analysis tool — specialized agents (cancer, pharma, cardio, rare disease) coordinate through a custom MCP server with 18 tools. They publish findings to a shared board with auto-dedup and message each other through a prioritized chatroom.

The MCP communication pattern (shared findings + agent chatroom) might be useful for other multi-agent projects too.

GitHub: https://github.com/HelixGenomics/Genomic-Agent-Discovery

### Bioinformatics Communities

Hi all — released an open-source tool that queries 12 genomics databases (ClinVar, GWAS, AlphaMissense, CPIC, gnomAD, etc.) using multiple AI agents that coordinate with each other. Takes raw DNA files from 23andMe, AncestryDNA, or VCF.

Everything runs locally. Looking for feedback from bioinformaticians on the database queries and agent prompts.

GitHub: https://github.com/HelixGenomics/Genomic-Agent-Discovery
Discord: https://discord.gg/6Agw8yEA

### General Data Science / ML Communities

Built a multi-agent system where AI agents collaborate to analyze raw DNA files. Each agent specializes in a domain and they coordinate through Anthropic's MCP protocol — shared findings board with deduplication + chatroom with priority levels.

The architecture might be interesting beyond genomics — the MCP-based agent communication pattern could work for any domain where specialized agents need to coordinate.

MIT licensed: https://github.com/HelixGenomics/Genomic-Agent-Discovery

---

## GitHub Awesome List PRs

Submit pull requests to add Genomic Agent Discovery to these lists:

### danielecook/Awesome-Bioinformatics
Add under a relevant section (e.g., "Variant Annotation" or "Analysis Pipelines"):
```markdown
- **[Genomic Agent Discovery](https://github.com/HelixGenomics/Genomic-Agent-Discovery)** - Multi-agent AI system that analyzes raw DNA files across 12 databases (ClinVar, GWAS, AlphaMissense, CPIC, etc.). Agents coordinate via MCP. [[open-source](https://github.com/HelixGenomics/Genomic-Agent-Discovery)]
```

### ZhihaoXie/awesome-bioinformatics-tools
Same format, add under appropriate category.

### GitHub Repo Topics
Make sure these topics are set on the repo:
`bioinformatics`, `genomics`, `mcp`, `ai-agents`, `dna-analysis`, `open-source`, `clinvar`, `pharmacogenomics`, `claude`, `llm`
