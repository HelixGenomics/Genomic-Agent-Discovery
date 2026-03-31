# Contributing to Genomic Agent Discovery

Thank you for your interest in contributing. This project is MIT-licensed and welcomes contributions of all kinds.

## Before You Start

Please open an issue before starting work on large changes — it avoids duplicated effort and lets us discuss the approach.

For small fixes (typos, obvious bugs, documentation), just open a PR directly.

## Setup

```bash
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY (or other provider key) to .env
```

To build the annotation database (required for running analyses):

```bash
npm run build-db   # ~10-30 minutes, downloads public genomics databases
```

To run tests:

```bash
npm test
```

## Project Structure

```
src/
  cli.mjs              Entry point — CLI argument parsing
  orchestrator.mjs     Pipeline execution, phase coordination
  mcp-server.mjs       MCP tool server (18 tools agents can call)
  api-server.mjs       Dashboard HTTP/API server
  config-loader.mjs    YAML config loading and merging
  agents/
    spawner.mjs        Spawns Claude CLI subprocesses
    roles.mjs          Role-specific agent behavior
    prompts.mjs        Default system prompts per domain
  parsers/
    index.mjs          Format auto-detection dispatcher
    *.mjs              Per-format parsers (23andMe, AncestryDNA, etc.)
  db/
    genotype-db.mjs    Per-run patient genotype SQLite database
    loader.mjs         Unified annotation database queries
config/
  default.yaml         Base configuration
  presets/             Pre-tuned analysis configurations (YAML)
scripts/
  build-database.sh    Downloads and indexes all 12 public databases
  downloaders/         Per-source download scripts
  verify-database.mjs  Database integrity checker
dashboard-react/       React dashboard source (Vite)
  src/
    App.jsx            Main dashboard component (setup panel + live view)
    App.css            Dashboard styles
    index.css          Theme variables and base styles
  vite.config.js       Vite config with API proxy
dashboard/             Built dashboard output (served by api-server)
docs/
  screenshots/         Dashboard screenshots and GIFs for README
  capture-*.mjs        Puppeteer scripts to regenerate screenshots/GIFs
```

## Dashboard Development

The dashboard is a React app built with Vite in `dashboard-react/`.

```bash
cd dashboard-react
npm install
npm run dev          # Starts Vite dev server on http://localhost:5199
```

The Vite dev server proxies `/api` requests to `localhost:3000` (the API server). To see the dashboard with live data, also start the API server:

```bash
npm start -- --dna my-dna.txt   # Starts API server + analysis
```

To build the production dashboard (outputs to `dashboard/`):

```bash
cd dashboard-react
npm run build
```

### Regenerating Screenshots & GIFs

Screenshots and GIFs for the README are captured with Puppeteer scripts in `docs/`:

```bash
# Start the dev server first
cd dashboard-react && npm run dev &

# From project root:
node docs/capture-screenshots.mjs    # 12 static screenshots
node docs/capture-gifs.mjs           # 3 workflow GIFs
node docs/capture-pipeline-gif.mjs   # Pipeline animation GIF (mocks API data)
```

Requires `puppeteer` (dev dependency) and `ffmpeg` for GIF assembly.

## Areas Where Help Is Most Valuable

### New Database Sources
The `scripts/downloaders/` directory contains one script per source. To add a new database:
1. Add a downloader script in `scripts/downloaders/`
2. Add an import step in `scripts/build-database.sh`
3. Add corresponding query logic in `src/db/loader.mjs`
4. Expose it as an MCP tool in `src/mcp-server.mjs`

### Parsers
New DNA file formats go in `src/parsers/`. Follow the existing parsers — each exports a single async `parse<Format>(filePath, options)` function that resolves to `{ variants, metadata, stats }`. Register the new parser in `src/parsers/index.mjs`.

### Agent Prompts
Domain-specialist prompts are in `src/agents/prompts.mjs`. Improvements from people with clinical genetics expertise are especially welcome. Keep prompts focused and tool-call-efficient.

### Presets
Presets are YAML files in `config/presets/`. A preset defines which agents run, what genes/conditions they focus on, and model tiers. See `config/presets/pharmacogenomics.yaml` for a minimal example.

### Dashboard
The React dashboard in `dashboard-react/` welcomes UI improvements, accessibility enhancements, and new visualizations. The setup panel presets and agent prompts are defined in the `PRESETS` array at the top of `App.jsx`.

### Documentation
Guides, tutorials, and worked examples are always useful.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Add tests for new functionality where practical
- Run `npm test` before submitting
- Update `README.md` if you're adding user-facing features
- Keep the medical disclaimer framing in place — this is a research tool, not a diagnostic

## Code Style

- ES modules (`.mjs`) throughout
- No build step — code runs directly with Node.js 18+
- Async/await over callbacks
- Prefer clarity over cleverness — this codebase will be read by people with varying backgrounds

## Reporting Issues

Please include:
- Node.js version (`node -v`)
- DNA file format and approximate size
- Preset or config used
- Full error output (redact any personal data)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
