# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/HelixGenomics/Genomic-Agent-Discovery/releases/tag/v1.0.0
