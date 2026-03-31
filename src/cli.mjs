#!/usr/bin/env node
// ============================================================
// Helix Genomics Agents — CLI Entry Point
// ============================================================
//
// Usage:
//   node src/cli.mjs --dna <file> [options]
//   helix-agents --dna <file> [options]
//
// Options:
//   --dna <file>          DNA file path (required)
//   --preset <name>       Use a preset configuration
//   --config <file>       Custom YAML config file
//   --model <model>       Override default model (haiku|sonnet|opus)
//   --format <format>     Force DNA file format
//   --focus <conditions>  Comma-separated conditions
//   --genes <genes>       Comma-separated genes to prioritize
//   --no-dashboard        Disable browser dashboard
//   --port <port>         Dashboard port (default: 3000)
//   --cost-limit <usd>    Hard cost limit in USD
//   --output <dir>        Output directory
//   --help                Show help
//
// ============================================================

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import chalk from "chalk";
import { loadConfig, resolveProjectPath, getAllAgents } from "./config-loader.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Version requirement check
// ---------------------------------------------------------------------------

const NODE_MAJOR = parseInt(process.versions.node.split(".")[0], 10);
if (NODE_MAJOR < 18) {
  console.error(
    chalk.red(`\nError: Node.js 18+ is required (you have ${process.versions.node}).`) +
    "\n\nInstall the latest LTS:\n  https://nodejs.org/\n"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function printBanner() {
  console.log(chalk.cyan(`
  ${"=".repeat(50)}

       ${chalk.bold.white("HELIX GENOMICS AGENTS")}
       ${chalk.dim("Multi-Agent DNA Analysis Pipeline")}

  ${"=".repeat(50)}
  `));
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp() {
  printBanner();
  console.log(`
${chalk.bold("Usage:")} node src/cli.mjs --dna <file> [options]

${chalk.bold("Required:")}
  ${chalk.green("--dna <file>")}            Path to raw DNA file (23andMe, AncestryDNA,
                            MyHeritage, VCF, FTDNA)

${chalk.bold("Analysis Options:")}
  ${chalk.green("--preset <name>")}         Use a preset configuration:
                              ${chalk.dim("cancer-research")}    Cancer & tumor genetics deep-dive
                              ${chalk.dim("pharmacogenomics")}   Drug metabolism analysis
                              ${chalk.dim("cardiovascular")}     Heart & vascular genetics
                              ${chalk.dim("full-health")}        Comprehensive whole-genome scan
                              ${chalk.dim("quick-scan")}         Fast overview (~$0.50, 2-3 min)
                              ${chalk.dim("rare-disease")}       VUS & rare variant investigation
  ${chalk.green("--config <file>")}         Custom YAML config (merged on top of preset)
  ${chalk.green("--model <model>")}         Override default model: haiku, sonnet, opus
  ${chalk.green("--format <format>")}       Force DNA file format:
                              auto, 23andme, ancestrydna, myheritage, vcf, ftdna
  ${chalk.green("--focus <conditions>")}    Comma-separated conditions to investigate
                              e.g. "breast cancer,Lynch syndrome"
  ${chalk.green("--genes <genes>")}         Comma-separated genes to prioritize
                              e.g. "BRCA1,BRCA2,TP53"

${chalk.bold("Output Options:")}
  ${chalk.green("--output <dir>")}          Output directory (default: ./output)
  ${chalk.green("--no-dashboard")}          Disable the real-time browser dashboard
  ${chalk.green("--port <port>")}           Dashboard port (default: 3000)

${chalk.bold("Cost Control:")}
  ${chalk.green("--cost-limit <usd>")}      Hard cost limit in USD (aborts if exceeded)

${chalk.bold("Other:")}
  ${chalk.green("--help")}                  Show this help message

${chalk.bold("Examples:")}
  ${chalk.dim("# Quick scan with defaults")}
  node src/cli.mjs --dna ~/dna/genome.txt --preset quick-scan

  ${chalk.dim("# Cancer-focused analysis with cost cap")}
  node src/cli.mjs --dna ~/dna/genome.txt --preset cancer-research --cost-limit 10

  ${chalk.dim("# Full analysis with custom genes")}
  node src/cli.mjs --dna ~/dna/genome.txt --preset full-health --genes BRCA1,APOE,MTHFR

  ${chalk.dim("# Pharmacogenomics only, no dashboard")}
  node src/cli.mjs --dna ~/dna/genome.txt --preset pharmacogenomics --no-dashboard

${chalk.bold("Setup (Claude Pro/Max — recommended, free to run):")}
  npm install
  claude login             ${chalk.dim("# one-time OAuth login with your Claude subscription")}
  npm run build-db         ${chalk.dim("# downloads reference databases")}

${chalk.bold("Setup (Anthropic API key):")}
  npm install
  cp .env.example .env    ${chalk.dim("# add ANTHROPIC_API_KEY=sk-ant-...")}
  ${chalk.dim("# then set api.provider: anthropic-api in config/default.yaml")}
  npm run build-db
`);
}

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  let i = 2; // skip node and script path

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      i++;
      continue;
    }

    if (arg === "--no-dashboard") {
      args["no-dashboard"] = true;
      i++;
      continue;
    }

    if (arg === "--serve") {
      args.serve = true;
      i++;
      continue;
    }

    // All other flags take a value
    const flagMap = {
      "--dna":        "dna_file",
      "--preset":     "preset",
      "--config":     "config",
      "--model":      "model",
      "--format":     "format",
      "--focus":      "focus_conditions",
      "--genes":      "focus_genes",
      "--port":       "port",
      "--cost-limit": "cost_limit",
      "--output":     "output",
    };

    if (flagMap[arg]) {
      if (i + 1 >= argv.length) {
        console.error(chalk.red(`Error: ${arg} requires a value`));
        process.exit(1);
      }
      args[flagMap[arg]] = argv[i + 1];
      i += 2;
      continue;
    }

    // Unknown flag
    console.error(chalk.yellow(`Warning: Unknown option "${arg}" (ignored)`));
    i++;
  }

  return args;
}

// ---------------------------------------------------------------------------
// Prerequisite checks
// ---------------------------------------------------------------------------

function checkPrerequisites(config) {
  const issues = [];

  // Check authentication — method depends on provider
  const provider = config.api?.provider || "claude-cli";
  if (provider === "claude-cli") {
    // OAuth via Claude CLI — verify the binary exists
    try {
      execSync("claude --version", { stdio: "pipe", timeout: 5000 });
    } catch {
      issues.push(
        "Claude CLI not found or not logged in.\n" +
        "     Install: https://claude.ai/download  (requires Claude Pro or Max plan)\n" +
        "     Then run: claude login"
      );
    }
  } else if (!config.api?.key || config.api.key === "" || config.api.key.includes("your-key-here")) {
    issues.push(
      "ANTHROPIC_API_KEY is not set.\n" +
      "     Set it in your environment: export ANTHROPIC_API_KEY=sk-ant-...\n" +
      "     Or copy .env.example to .env and add your key there.\n" +
      "     Tip: Claude Pro/Max subscribers can use free OAuth instead — see README."
    );
  }

  // Check DNA file
  if (!config.input?.dna_file) {
    issues.push("No DNA file specified. Use --dna <file> to provide your raw DNA data.");
  } else {
    const dnaPath = resolve(config.input.dna_file);
    if (!existsSync(dnaPath)) {
      issues.push(`DNA file not found: ${dnaPath}`);
    }
  }

  // Check database
  const dbPath = resolveProjectPath(config.database?.path || "./data/helix-unified.db");
  if (!existsSync(dbPath)) {
    issues.push(
      `Reference database not found: ${dbPath}\n` +
      "     Run: bash setup.sh  (or: npm run build-db)"
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Print pipeline summary
// ---------------------------------------------------------------------------

function printPipelineSummary(config) {
  const agents = getAllAgents(config);
  const phases = config.pipeline?.phases || [];

  console.log(chalk.bold("\n  Pipeline Configuration\n"));

  if (config._meta?.preset) {
    console.log(`  Preset:     ${chalk.cyan(config._meta.preset)}`);
  }

  console.log(`  DNA File:   ${chalk.white(config.input?.dna_file || "(none)")}`);
  console.log(`  Database:   ${chalk.dim(config.database?.path || "./data/helix-unified.db")}`);
  console.log(`  Output:     ${chalk.dim(config.output?.directory || "./output")}`);
  console.log(`  Cost Limit: ${chalk.yellow("$" + (config.cost?.hard_limit_usd || "50.00"))}`);
  console.log(`  Dashboard:  ${config.dashboard?.enabled !== false ? chalk.green("enabled") + chalk.dim(` (port ${config.dashboard?.port || 3000})`) : chalk.dim("disabled")}`);
  console.log();

  for (const phase of phases) {
    const phaseAgents = (phase.agents || []).map((a) => {
      const model = a.model || config.agent_defaults?.model || "haiku";
      return `${chalk.white(a.label || a.id)} ${chalk.dim(`(${model})`)}`;
    });
    const parallel = phase.parallel ? chalk.dim(" [parallel]") : chalk.dim(" [sequential]");
    const waitFor = phase.wait_for ? chalk.dim(` (after ${phase.wait_for})`) : "";

    console.log(`  ${chalk.bold.cyan(`Phase: ${phase.label || phase.id}`)}${parallel}${waitFor}`);
    for (const desc of phaseAgents) {
      console.log(`    -> ${desc}`);
    }
  }

  console.log();
  console.log(`  Total agents: ${chalk.bold(agents.length)}`);

  // Research focus
  const conditions = config.research?.focus_conditions || [];
  const genes = config.research?.focus_genes || [];
  if (conditions.length > 0) {
    console.log(`  Focus:      ${chalk.white(conditions.join(", "))}`);
  }
  if (genes.length > 0) {
    console.log(`  Genes:      ${chalk.white(genes.join(", "))}`);
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let orchestrator = null;
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(chalk.yellow(`\n  Received ${signal}. Shutting down gracefully...`));

  if (orchestrator && typeof orchestrator.shutdown === "function") {
    try {
      await orchestrator.shutdown();
      console.log(chalk.green("  All agents stopped. Partial results saved."));
    } catch (err) {
      console.error(chalk.red(`  Error during shutdown: ${err.message}`));
    }
  }

  console.log(chalk.dim("  Goodbye.\n"));
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  // Handle --help
  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(0);
  }

  // Handle --serve: start only the API server without running an analysis
  if (args.serve) {
    printBanner();
    const port = parseInt(args.port || "3000", 10);
    const stateDir = resolve(PROJECT_ROOT, "./state");
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
    const { createApiServer } = await import("./api-server.mjs");
    const placeholderOrchestrator = { agents: {}, getAgents: () => ({}) };
    // Load minimal config (no dna required)
    let serveConfig = {};
    try {
      const { loadConfig } = await import("./config-loader.mjs");
      serveConfig = loadConfig({ port: String(port) });
    } catch { /* ignore config errors in serve mode */ }
    const app = createApiServer(serveConfig, stateDir, placeholderOrchestrator);
    app.listen(port, () => {
      console.log(chalk.green(`\n  Helix Genomics Agents — Setup Mode`));
      console.log(chalk.cyan(`  Open `) + chalk.underline.cyan(`http://localhost:${port}`) + chalk.cyan(` to configure and start your analysis\n`));
    });
    // Keep alive — do not exit
    return;
  }

  // Print banner
  printBanner();

  // Load .env file if present (simple manual parse for key=value lines)
  const envPath = resolve(PROJECT_ROOT, ".env");
  if (existsSync(envPath)) {
    try {
      const { readFileSync } = await import("fs");
      const envContent = readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // .env parse failure is non-fatal
    }
  }

  // Load configuration (merges default -> preset -> user config -> env -> CLI flags)
  let config;
  try {
    config = loadConfig(args);
  } catch (err) {
    console.error(chalk.red(`\n  Configuration Error\n`));
    console.error(chalk.red(`  ${err.message}\n`));
    process.exit(1);
  }

  // Check prerequisites
  const issues = checkPrerequisites(config);
  if (issues.length > 0) {
    console.error(chalk.red.bold("\n  Prerequisites not met:\n"));
    for (const issue of issues) {
      console.error(chalk.red(`  x ${issue}`));
    }
    console.error();
    process.exit(1);
  }

  // Print pipeline summary
  printPipelineSummary(config);

  // Create output directory
  const outputDir = resolveProjectPath(config.output?.directory || "./output");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Create state directory for this run
  const jobId = `run-${Date.now()}`;
  const stateDir = resolveProjectPath(config.advanced?.state_directory || "./state");
  const jobStateDir = resolve(stateDir, jobId);
  mkdirSync(jobStateDir, { recursive: true });

  console.log(chalk.dim(`  Job ID: ${jobId}`));
  console.log(chalk.dim(`  State:  ${jobStateDir}\n`));

  // Start dashboard if enabled
  if (config.dashboard?.enabled !== false) {
    try {
      const { createApiServer } = await import("./api-server.mjs");
      const port = config.dashboard?.port || 3000;

      // Orchestrator will be set once created; for now pass a placeholder
      const placeholderOrchestrator = { agents: {}, getAgents: () => ({}) };
      const app = createApiServer(config, stateDir, placeholderOrchestrator);
      const server = app.listen(port, () => {
        console.log(chalk.green(`  Dashboard: `) + chalk.underline.cyan(`http://localhost:${port}`));
        console.log(chalk.dim(`  API:       http://localhost:${port}/api/status/${jobId}\n`));
      });

      // Auto-open browser
      if (config.dashboard?.open_browser !== false) {
        try {
          const open = (await import("open")).default;
          setTimeout(() => open(`http://localhost:${port}`), 1500);
        } catch {
          // open module failure is non-fatal
        }
      }

      // Clean up server on shutdown
      const origShutdown = shutdown;
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGTERM");

      const shutdownWithServer = async (signal) => {
        server.close();
        await origShutdown(signal);
      };

      process.on("SIGINT", () => shutdownWithServer("SIGINT"));
      process.on("SIGTERM", () => shutdownWithServer("SIGTERM"));
    } catch (err) {
      console.warn(chalk.yellow(`  Warning: Could not start dashboard: ${err.message}`));
      console.warn(chalk.dim("  Continuing without dashboard...\n"));
    }
  }

  // Create and run orchestrator
  console.log(chalk.bold.cyan("  Starting analysis...\n"));

  try {
    const { Orchestrator } = await import("./orchestrator.mjs");
    orchestrator = new Orchestrator(config, { jobId, stateDir: jobStateDir });

    // Apply per-agent overrides injected from the dashboard (e.g. custom md output paths)
    if (process.env.HELIX_AGENT_OVERRIDES) {
      try {
        orchestrator.agentOverrides = JSON.parse(process.env.HELIX_AGENT_OVERRIDES);
      } catch { /* ignore malformed JSON */ }
    }

    const results = await orchestrator.run();

    // Generate reports
    console.log(chalk.bold("\n  Generating reports..."));
    try {
      const { generateReports } = await import("./output/report-generator.mjs");
      const reportFiles = await generateReports(jobStateDir, outputDir, config);
      console.log(chalk.green("  Reports generated:"));
      for (const f of reportFiles) {
        console.log(chalk.dim(`    -> ${f}`));
      }
    } catch (err) {
      console.warn(chalk.yellow(`  Warning: Report generation failed: ${err.message}`));
    }

    // Print summary
    console.log(chalk.bold.green(`\n  Analysis complete.`));
    console.log(chalk.dim(`  Findings: ${jobStateDir}/shared-findings.jsonl`));
    console.log(chalk.dim(`  Output:   ${outputDir}/\n`));

    if (results?.cost) {
      console.log(chalk.dim(`  Total cost: $${results.cost.total?.toFixed(4) || "unknown"}`));
    }
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && err.message.includes("orchestrator")) {
      console.error(chalk.yellow("\n  The agent orchestrator has not been built yet."));
      console.error(chalk.dim("  src/agents/orchestrator.mjs is required to run analysis."));
      console.error(chalk.dim("  Configuration and setup are working correctly.\n"));
      process.exit(1);
    }
    console.error(chalk.red(`\n  Analysis failed: ${err.message}\n`));
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
