# Hacker News Post

## Title

Show HN: Open-source multi-agent genomic analysis – AI agents collaborate to analyze your DNA locally

## URL

https://github.com/HelixGenomics/Genomic-Agent-Discovery

## Text (paste into the text box — HN lets you do URL *or* text, but for Show HN you can do both if you put the URL as the link and add a comment immediately)

---

## First Comment (post this immediately after submitting)

Hi HN — I built this because I had my raw 23andMe file sitting in my downloads folder for years and wanted to actually do something useful with it.

The problem with existing tools is they either (a) want you to upload your DNA to their servers, (b) check one database at a time, or (c) cost a fortune. So I built something that runs locally, queries 12 public databases, and uses multiple AI agents that actually talk to each other.

**What's interesting architecturally:**

The agents communicate through a custom MCP (Model Context Protocol) server with 18 tools. When the cancer genetics agent finds a BRCA2 pathogenic variant, it sends an URGENT message to the pharmacogenomics agent: "this patient may need chemotherapy — check DPYD fluoropyrimidine metabolism immediately." The pharma agent confirms the patient is a DPYD*2A carrier and broadcasts a CRITICAL alert to all agents: "50% dose reduction required for any fluoropyrimidine-based chemo."

This kind of cross-domain coordination is something a single prompt can't do well. The cancer agent doesn't know about drug metabolism, and the pharma agent doesn't know which cancer variants to worry about — but together they catch compound risks.

**The agent communication has two channels:**

1. A shared findings board with automatic keyword-overlap deduplication (agents can't publish redundant findings)
2. A chatroom with priority levels (normal/urgent/critical) where agents send targeted or broadcast messages

Both are visible in a real-time browser dashboard.

**The databases (all bundled into one local SQLite file):**

ClinVar (2.5M variant classifications), GWAS Catalog (400K trait associations), CPIC (34 pharmacogenes with star alleles and drug dosing), AlphaMissense (70M DeepMind pathogenicity predictions), CADD, gnomAD, HPO, DisGeNET, CIViC, PharmGKB, Orphanet, SNPedia. One command downloads and indexes everything: `npm run build-db`.

**Setup:**

```
npm install -g @anthropic-ai/claude-code && claude login
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery && npm install && npm run build-db
npm start -- --dna ~/Downloads/23andme-raw.txt
```

Works with Claude CLI (uses your subscription, no API key), Anthropic API, OpenAI, Gemini, Ollama (fully free and local), or any OpenAI-compatible endpoint.

**What I'd love feedback on:**

- The agent prompt design — I'm not a clinical geneticist, so the domain prompts could probably be improved by people with that background
- The MCP-based agent communication pattern — curious if others have found better approaches for multi-agent coordination
- Whether the deduplication heuristic (keyword overlap analysis) is too aggressive or too lenient

All agent prompts are fully transparent in the dashboard UI — you can read exactly what each agent is told to do before starting an analysis.

MIT licensed. Happy to answer questions about the architecture.
