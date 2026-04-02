# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-04-01

### Added
- **Template import/export** — share agent configurations as JSON files, also supports importing YAML presets
- **Editable agent prompts** — preset prompts are now fully editable in the dashboard (was read-only)
- **Per-agent settings** — model, max tool calls, temperature, check messages, and web search per agent
- **Tier grouping** — agents displayed by tier (Collection → Synthesis → Report) showing the pipeline flow
- **Database status panel** — live view of all 13 annotation databases with row counts, sizes, and status indicators
- **Custom agent pipeline from templates** — imported templates auto-build pipeline phases from agent roles
- **Agent role selector** — custom agents can be assigned as collector, synthesizer, or narrator
- `GET /api/db-status` endpoint returning table row counts and build metadata
- **ACMG SF v3.2 gene list** — 73 clinically actionable genes with conditions, available as MCP tool `get_acmg_genes`
- **CPIC drug-gene lookup** — 23 pharmacogenes mapped to 150+ drugs with guideline levels, available as MCP tool `get_cpic_drugs`
- **Exomiser integration** — phenotype-driven variant prioritization via `prioritize_variants` MCP tool. Runs Exomiser as external subprocess (AGPL-3.0, license-safe). Setup: `npm run setup-exomiser`
- Debendox/Trisomy 9 example template in `config/templates/`

### Fixed
- Template import now preserves all per-agent settings (role, maxToolCalls, temperature, webSearch)
- Per-agent model overrides now actually applied to spawned CLI processes (was ignored)
- Per-agent prompt edits now passed through to agent system prompts (was ignored)
- `maxToolCalls` now passed as `--max-turns` to Claude CLI (was not used)
- Custom agents from imported templates now build proper pipeline phases (was not wired up)
- Dashboard no longer auto-redirects to setup when job completes — stays on results
- Findings and chat panels no longer overlap — stacked in right column with resize support
- Contact emails updated to admin@helixsequencing.com

### Changed
- **All preset prompts rewritten** — research-driven instead of checklist-driven. Agents now research first, then query. Uses web search for current guidelines before investigating patient data.
- All collector prompts include thoroughness instruction: "You are the cheap model — do the heavy lifting"
- Cost estimates updated to reflect higher tool usage ($0.50-8.00 depending on preset)
- Cost estimation in status bar now accounts for input tokens (5x output) and web search overhead
- Agent cards color-coded by tier (cyan=collector, purple=synthesizer, amber=narrator) and status
- Agent model parsed from log headers instead of hardcoded to haiku
- Web search duplicate detection improved with word-overlap matching (was prefix-only)
- Duplicate search warning now suggests checking messages or using different angle
- 3-column layout when running: Agents (left) | Chat (center) | Findings (right) — no overlap
- Agent status detection uses exit code from log footer instead of keyword matching (fixes false errors)
- Analysis subprocess and agent processes now run detached — survive server restarts
- Phase timeout (30 min) prevents orchestrator hanging if an agent process is orphaned
- First agent auto-expands on load for both presets and custom agents
- Custom agent cards are collapsible (click header to toggle)
- Prompt textareas are vertically resizable

## [1.1.0] - 2026-04-01

### Added
- GitHub professionalism: CHANGELOG.md, SECURITY.md, CODE_OF_CONDUCT.md
- CI workflow (Node 18/20/22), release workflow (auto on tag push)
- FUNDING.yml, issue template config
- 20 GitHub topics for discoverability

### Fixed
- PharmGKB downloader: fixed zip extraction and column name mapping (0 → 4,932 rows)
- DisGeNET downloader: properly detects HTML auth-wall responses
- SNPedia downloader: rewritten with retry/resume, JSON cache validation
- Test glob pattern for CI compatibility

## [1.0.0] - 2026-04-01

### Added
- Multi-agent genomic analysis pipeline with 7 parallel domain specialists
- 18 MCP tools for database queries, cross-referencing, and variant annotation
- 12 public genomics databases compiled into a unified SQLite annotation database:
  - ClinVar, GWAS Catalog, CPIC, AlphaMissense, CADD, gnomAD, HPO, DisGeNET, CIViC, PharmGKB, Orphanet, SNPedia
- Real-time React dashboard with setup panel, agent status, findings feed, and inter-agent chat
- 6 built-in research presets (cancer, cardiovascular, pharmacogenomics, neurological, metabolic, comprehensive)
- DNA file parser supporting 23andMe, AncestryDNA, MyHeritage, FamilyTreeDNA, and VCF formats
- Claude CLI OAuth integration — works with Claude Pro/Max subscriptions (no API key needed)
- Multi-provider LLM support (Anthropic API, OpenAI, Gemini, Ollama)
- Phase-based pipeline: parse → plan → collect → synthesize → report
- Structured markdown health reports with clinical significance ratings
- One-command database build from public sources (`npm run build-db`)
- Database verification script (`npm run verify-db`)
- Privacy-first architecture — all data stays local, nothing uploaded

### Fixed
- PharmGKB downloader: fixed zip extraction and column name mapping
- DisGeNET downloader: properly detects auth-wall HTML responses instead of caching them
- SNPedia downloader: uses Semantic MediaWiki bulk API instead of individual page crawling

[1.2.0]: https://github.com/HelixGenomics/Genomic-Agent-Discovery/releases/tag/v1.2.0
[1.1.0]: https://github.com/HelixGenomics/Genomic-Agent-Discovery/releases/tag/v1.1.0
[1.0.0]: https://github.com/HelixGenomics/Genomic-Agent-Discovery/releases/tag/v1.0.0
