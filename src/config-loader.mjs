// ============================================================
// Helix Genomics Agents — Configuration Loader
// ============================================================
//
// Loads and merges configuration from multiple sources in order
// of increasing priority:
//
//   1. config/default.yaml         (base defaults)
//   2. config/presets/<name>.yaml   (optional preset)
//   3. User config file             (--config flag)
//   4. Environment variables        (ANTHROPIC_API_KEY, etc.)
//   5. CLI flag overrides           (--model, --dna-file, etc.)
//
// Supports ${ENV_VAR} interpolation in any string value.
//
// Usage:
//   import { loadConfig } from "./config-loader.mjs";
//   const config = loadConfig(cliArgs);
//
// ============================================================

import { readFileSync, existsSync } from "fs";
import { join, dirname, resolve, isAbsolute } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Deep merge: target is mutated, source values overwrite target values.
// Arrays are replaced entirely (not concatenated) — this matches user
// expectation that specifying focus_genes in a preset replaces the default.
// ---------------------------------------------------------------------------

function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  if (!target || typeof target !== "object") return structuredClone(source);

  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (srcVal === null || srcVal === undefined) {
      // Explicit null in source clears the key
      target[key] = srcVal;
    } else if (Array.isArray(srcVal)) {
      // Arrays replace entirely — no merging array elements
      target[key] = structuredClone(srcVal);
    } else if (typeof srcVal === "object" && !Array.isArray(srcVal)) {
      // Recurse into nested objects
      if (typeof tgtVal !== "object" || Array.isArray(tgtVal)) {
        target[key] = {};
      }
      deepMerge(target[key], srcVal);
    } else {
      // Scalars overwrite
      target[key] = srcVal;
    }
  }

  return target;
}

// ---------------------------------------------------------------------------
// Interpolate ${ENV_VAR} references in string values throughout the config.
// Walks the entire config tree. Unset env vars become empty strings.
// ---------------------------------------------------------------------------

function interpolateEnvVars(obj) {
  if (typeof obj === "string") {
    return obj.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
      return process.env[varName] || "";
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateEnvVars);
  }
  if (obj && typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateEnvVars(value);
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Load a YAML file and return parsed object. Returns null if file not found.
// ---------------------------------------------------------------------------

function loadYaml(filePath) {
  const resolved = isAbsolute(filePath) ? filePath : resolve(PROJECT_ROOT, filePath);
  if (!existsSync(resolved)) return null;
  const raw = readFileSync(resolved, "utf8");
  return YAML.parse(raw);
}

// ---------------------------------------------------------------------------
// Apply environment variable overrides.
// These take precedence over file-based config.
// ---------------------------------------------------------------------------

function applyEnvOverrides(config) {
  // API key — most commonly set via environment
  if (process.env.ANTHROPIC_API_KEY) {
    config.api = config.api || {};
    config.api.key = process.env.ANTHROPIC_API_KEY;
  }

  // Default model override
  if (process.env.HELIX_DEFAULT_MODEL) {
    config.agent_defaults = config.agent_defaults || {};
    config.agent_defaults.model = process.env.HELIX_DEFAULT_MODEL;
  }

  // Cost limit
  if (process.env.HELIX_COST_LIMIT) {
    config.cost = config.cost || {};
    config.cost.hard_limit_usd = parseFloat(process.env.HELIX_COST_LIMIT);
  }

  // Dashboard port
  if (process.env.HELIX_DASHBOARD_PORT) {
    config.dashboard = config.dashboard || {};
    config.dashboard.port = parseInt(process.env.HELIX_DASHBOARD_PORT, 10);
  }

  // Database path
  if (process.env.HELIX_DB_PATH) {
    config.database = config.database || {};
    config.database.path = process.env.HELIX_DB_PATH;
  }

  // State directory
  if (process.env.HELIX_STATE_DIR) {
    config.advanced = config.advanced || {};
    config.advanced.state_directory = process.env.HELIX_STATE_DIR;
  }

  return config;
}

// ---------------------------------------------------------------------------
// Apply CLI flag overrides.
// These have the highest priority.
//
// Expected cliArgs shape (from a minimist-like parser):
//   {
//     config:     "path/to/config.yaml",
//     preset:     "cancer",
//     "dna-file": "my-dna.txt",
//     model:      "sonnet",
//     port:       3000,
//     "no-dashboard": true,
//     "cost-limit": 25.00,
//     "no-web-search": true,
//     ...
//   }
// ---------------------------------------------------------------------------

function applyCLIOverrides(config, args) {
  if (!args) return config;

  // DNA file
  if (args["dna-file"] || args.dna_file) {
    config.input = config.input || {};
    config.input.dna_file = args["dna-file"] || args.dna_file;
  }

  // Model
  if (args.model) {
    config.agent_defaults = config.agent_defaults || {};
    config.agent_defaults.model = args.model;
  }

  // Sex
  if (args.sex) {
    config.input = config.input || {};
    config.input.sex = args.sex;
  }

  // Ancestry
  if (args.ancestry) {
    config.input = config.input || {};
    config.input.ancestry = args.ancestry;
  }

  // Medical history
  if (args["medical-history"] || args.medical_history) {
    config.input = config.input || {};
    config.input.medical_history = args["medical-history"] || args.medical_history;
  }

  // Dashboard port
  if (args.port) {
    config.dashboard = config.dashboard || {};
    config.dashboard.port = parseInt(args.port, 10);
  }

  // Disable dashboard
  if (args["no-dashboard"]) {
    config.dashboard = config.dashboard || {};
    config.dashboard.enabled = false;
  }

  // Cost limit
  if (args["cost-limit"] || args.cost_limit) {
    config.cost = config.cost || {};
    config.cost.hard_limit_usd = parseFloat(args["cost-limit"] || args.cost_limit);
  }

  // Disable web search for all agents
  if (args["no-web-search"]) {
    config.agent_defaults = config.agent_defaults || {};
    config.agent_defaults.web_search = false;
  }

  // Focus conditions (comma-separated)
  if (args["focus-conditions"] || args.focus_conditions) {
    config.research = config.research || {};
    const raw = args["focus-conditions"] || args.focus_conditions;
    config.research.focus_conditions = typeof raw === "string" ? raw.split(",").map((s) => s.trim()) : raw;
  }

  // Focus genes (comma-separated)
  if (args["focus-genes"] || args.focus_genes) {
    config.research = config.research || {};
    const raw = args["focus-genes"] || args.focus_genes;
    config.research.focus_genes = typeof raw === "string" ? raw.split(",").map((s) => s.trim()) : raw;
  }

  // Skip domains (comma-separated)
  if (args["skip-domains"] || args.skip_domains) {
    config.research = config.research || {};
    const raw = args["skip-domains"] || args.skip_domains;
    config.research.skip_domains = typeof raw === "string" ? raw.split(",").map((s) => s.trim()) : raw;
  }

  // Output directory
  if (args.output || args["output-dir"] || args.output_dir) {
    config.output = config.output || {};
    config.output.directory = args.output || args["output-dir"] || args.output_dir;
  }

  // Output formats (comma-separated)
  if (args.formats) {
    config.output = config.output || {};
    config.output.formats = typeof args.formats === "string" ? args.formats.split(",").map((s) => s.trim()) : args.formats;
  }

  // Database path
  if (args["db-path"] || args.db_path) {
    config.database = config.database || {};
    config.database.path = args["db-path"] || args.db_path;
  }

  // Concurrency limit
  if (args.concurrency) {
    config.advanced = config.advanced || {};
    config.advanced.concurrency_limit = parseInt(args.concurrency, 10);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Validation: check that required fields are present and valid.
// Throws an Error with a descriptive message on failure.
// ---------------------------------------------------------------------------

function validate(config) {
  const errors = [];

  // API key is required for api-key-based providers.
  // claude-cli provider uses OAuth login instead — no key needed.
  const provider = config.api?.provider || "claude-cli";
  const needsApiKey = provider !== "claude-cli";
  if (needsApiKey && !config.api?.key) {
    errors.push(
      "Missing API key. Set ANTHROPIC_API_KEY environment variable or " +
      "add api.key to your config file.\n" +
      "  Tip: If you have a Claude Pro/Max subscription, use the free OAuth setup instead:\n" +
      "  Set api.provider: claude-cli in your config and run: claude login"
    );
  }

  // DNA file is required for analysis (but not for build-db)
  // We check this softly — the CLI command handler can enforce it
  // only when actually running analysis.
  if (config.input?.dna_file === null || config.input?.dna_file === undefined) {
    // Not an error — might be running build-db or other non-analysis command
    // The analyze command should check this separately
  } else if (config.input?.dna_file) {
    const dnaPath = isAbsolute(config.input.dna_file)
      ? config.input.dna_file
      : resolve(process.cwd(), config.input.dna_file);
    if (!existsSync(dnaPath)) {
      errors.push(`DNA file not found: ${config.input.dna_file} (resolved to ${dnaPath})`);
    }
  }

  // Validate model names
  const validModels = ["haiku", "sonnet", "opus"];
  if (config.agent_defaults?.model && !validModels.includes(config.agent_defaults.model)) {
    errors.push(
      `Invalid default model "${config.agent_defaults.model}". ` +
      `Must be one of: ${validModels.join(", ")}`
    );
  }

  // Validate pipeline agents have required fields
  if (config.pipeline?.phases) {
    for (const phase of config.pipeline.phases) {
      if (!phase.id) {
        errors.push("Pipeline phase missing 'id' field.");
      }
      if (phase.agents) {
        for (const agent of phase.agents) {
          if (!agent.id) {
            errors.push(`Agent in phase "${phase.id}" missing 'id' field.`);
          }
          if (!agent.role) {
            errors.push(`Agent "${agent.id}" missing 'role' field.`);
          }
        }
      }
    }
  }

  // Validate cost settings
  if (config.cost?.hard_limit_usd !== undefined && config.cost.hard_limit_usd < 0) {
    errors.push("cost.hard_limit_usd cannot be negative.");
  }

  if (errors.length > 0) {
    const msg = "Configuration errors:\n" + errors.map((e) => `  - ${e}`).join("\n");
    throw new Error(msg);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Main entry point: loadConfig(cliArgs)
//
// Loads, merges, interpolates, and validates the configuration.
// Returns a frozen config object ready for use.
//
// Merge order (lowest to highest priority):
//   1. config/default.yaml
//   2. config/presets/<preset>.yaml  (if --preset specified)
//   3. User config file              (if --config specified)
//   4. Environment variables
//   5. CLI flags
//
// Options in cliArgs:
//   config:  path to user config YAML file
//   preset:  name of a preset (e.g. "cancer", "quick", "comprehensive")
//   ...      any other CLI flags (see applyCLIOverrides)
// ---------------------------------------------------------------------------

export function loadConfig(cliArgs = {}) {
  // Step 1: Load base defaults
  const defaultConfig = loadYaml(join(PROJECT_ROOT, "config", "default.yaml"));
  if (!defaultConfig) {
    throw new Error("Could not load config/default.yaml. Is the project structure intact?");
  }

  let config = structuredClone(defaultConfig);

  // Step 2: Merge preset if specified
  if (cliArgs.preset) {
    const presetName = cliArgs.preset.replace(/[^a-zA-Z0-9_-]/g, "");
    const presetPath = join(PROJECT_ROOT, "config", "presets", `${presetName}.yaml`);
    const preset = loadYaml(presetPath);
    if (!preset) {
      throw new Error(
        `Preset "${presetName}" not found. Expected file: ${presetPath}\n` +
        `Available presets: check config/presets/ directory.`
      );
    }
    config = deepMerge(config, preset);
  }

  // Step 3: Merge user config file if specified
  if (cliArgs.config) {
    const userConfig = loadYaml(cliArgs.config);
    if (!userConfig) {
      throw new Error(`Config file not found: ${cliArgs.config}`);
    }
    config = deepMerge(config, userConfig);
  }

  // Step 4: Interpolate ${ENV_VAR} references in all string values
  config = interpolateEnvVars(config);

  // Step 5: Apply direct environment variable overrides
  config = applyEnvOverrides(config);

  // Step 6: Apply CLI flag overrides (highest priority)
  config = applyCLIOverrides(config, cliArgs);

  // Step 7: Validate required fields
  config = validate(config);

  // Attach metadata
  config._meta = {
    project_root: PROJECT_ROOT,
    loaded_at: new Date().toISOString(),
    preset: cliArgs.preset || null,
    user_config: cliArgs.config || null,
  };

  return config;
}

// ---------------------------------------------------------------------------
// Utility exports for use by other modules
// ---------------------------------------------------------------------------

/**
 * Resolve a path relative to the project root.
 * If the path is already absolute, returns it unchanged.
 */
export function resolveProjectPath(relativePath) {
  if (isAbsolute(relativePath)) return relativePath;
  return resolve(PROJECT_ROOT, relativePath);
}

/**
 * Get the list of all agents from a loaded config, flattened across phases.
 * Each agent gets phase_id and phase_label attached.
 */
export function getAllAgents(config) {
  const agents = [];
  if (!config.pipeline?.phases) return agents;

  for (const phase of config.pipeline.phases) {
    if (!phase.agents) continue;
    for (const agent of phase.agents) {
      agents.push({
        ...agent,
        phase_id: phase.id,
        phase_label: phase.label,
        phase_parallel: phase.parallel ?? true,
        phase_wait_for: phase.wait_for ?? null,
        // Apply agent_defaults for any missing fields
        model: agent.model || config.agent_defaults?.model || "haiku",
        max_tokens: agent.max_tokens || config.agent_defaults?.max_tokens || 16384,
        temperature: agent.temperature ?? config.agent_defaults?.temperature ?? 0.3,
        web_search: agent.web_search ?? config.agent_defaults?.web_search ?? true,
        check_messages_every: agent.check_messages_every ?? config.agent_defaults?.check_messages_every ?? 7,
      });
    }
  }

  return agents;
}

/**
 * Get phases in execution order, respecting wait_for dependencies.
 * Returns an array of phase objects with their agents.
 */
export function getPhaseOrder(config) {
  if (!config.pipeline?.phases) return [];
  // Phases are already in order in the config — just return them
  // The orchestrator handles wait_for dependencies at runtime
  return config.pipeline.phases.map((phase) => ({
    ...phase,
    agents: (phase.agents || []).map((agent) => ({
      ...agent,
      model: agent.model || config.agent_defaults?.model || "haiku",
      max_tokens: agent.max_tokens || config.agent_defaults?.max_tokens || 16384,
      temperature: agent.temperature ?? config.agent_defaults?.temperature ?? 0.3,
      web_search: agent.web_search ?? config.agent_defaults?.web_search ?? true,
    })),
  }));
}
