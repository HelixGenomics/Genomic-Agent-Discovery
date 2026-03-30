// ============================================================
// Helix Genomics Agents — Agent Spawner
// ============================================================
//
// Spawns individual Claude CLI processes (or uses the Anthropic
// SDK directly as a fallback) for each agent in the pipeline.
//
// Each agent gets:
//   - Its own .mcp.json config file pointing to the MCP server
//   - Environment variables for state directory and agent identity
//   - A log file for stdout/stderr capture
//
// Usage:
//   import { spawnAgent, writeMcpConfig, isClaudeCliAvailable } from "./spawner.mjs";
//   const handle = await spawnAgent(agentConfig, mcpConfigPath, stateDir);
//
// ============================================================

import { spawn, execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, statSync, createWriteStream } from "fs";
import { join, resolve } from "path";

// ---------------------------------------------------------------------------
// Claude model name mapping
// ---------------------------------------------------------------------------

const MODEL_MAP = {
  haiku:  "claude-haiku-4-5-20250414",
  sonnet: "claude-sonnet-4-20250514",
  opus:   "claude-opus-4-20250514",
};

/**
 * Resolve a short model name (haiku/sonnet/opus) to the full model ID.
 * If the name is already a full model ID, returns it unchanged.
 * @param {string} model
 * @returns {string}
 */
export function resolveModelName(model) {
  return MODEL_MAP[model] || model;
}

// ---------------------------------------------------------------------------
// Check if the Claude CLI is available on the system
// ---------------------------------------------------------------------------

let _claudeCliAvailable = null;

/**
 * Check whether the `claude` CLI is installed and accessible.
 * Result is cached after first call.
 * @returns {boolean}
 */
export function isClaudeCliAvailable() {
  if (_claudeCliAvailable !== null) return _claudeCliAvailable;
  try {
    execSync("claude --version", { stdio: "pipe", timeout: 5000 });
    _claudeCliAvailable = true;
  } catch {
    _claudeCliAvailable = false;
  }
  return _claudeCliAvailable;
}

// ---------------------------------------------------------------------------
// Write MCP configuration file for an agent
// ---------------------------------------------------------------------------

/**
 * Write the .mcp.json config file for a single agent.
 *
 * This config tells the Claude CLI (or MCP client) how to start
 * the Helix Genomics MCP server with the correct environment.
 *
 * @param {object} options
 * @param {string} options.agentId - Agent identifier
 * @param {string} options.stateDir - Path to the shared state directory
 * @param {string} options.genotypeDbPath - Path to the patient genotype database
 * @param {string} options.unifiedDbPath - Path to the unified annotation database
 * @param {string} options.mcpServerPath - Path to the MCP server entry point
 * @param {string} options.outputPath - Where to write the .mcp.json file
 * @returns {string} The path to the written config file
 */
export function writeMcpConfig({
  agentId,
  stateDir,
  genotypeDbPath,
  unifiedDbPath,
  mcpServerPath,
  outputPath,
}) {
  const config = {
    mcpServers: {
      "helix-genomics": {
        command: "node",
        args: [mcpServerPath],
        env: {
          HELIX_STATE_DIR: stateDir,
          HELIX_AGENT_ID: agentId,
          GENOTYPE_DB: genotypeDbPath,
          UNIFIED_DB: unifiedDbPath,
        },
      },
    },
  };

  // Ensure the output directory exists
  const dir = join(outputPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(config, null, 2), "utf8");
  return outputPath;
}

// ---------------------------------------------------------------------------
// Spawn an agent using the Claude CLI
// ---------------------------------------------------------------------------

/**
 * Spawn a Claude CLI process for a single agent.
 *
 * @param {object} agentConfig - Agent configuration
 * @param {string} agentConfig.id - Agent identifier
 * @param {string} agentConfig.model - Model name (haiku/sonnet/opus or full ID)
 * @param {string} agentConfig.systemPrompt - System prompt text
 * @param {string} agentConfig.userPrompt - User prompt (initial message)
 * @param {string} agentConfig.maxTokens - Max output tokens
 * @param {string} mcpConfigPath - Path to the .mcp.json file for this agent
 * @param {string} stateDir - Path to the shared state directory
 * @param {object} [options] - Additional options
 * @param {string} [options.apiKey] - Anthropic API key (falls back to env)
 * @param {string} [options.projectRoot] - Project root directory
 * @returns {Promise<object>} Process handle with metadata
 */
export async function spawnAgent(agentConfig, mcpConfigPath, stateDir, options = {}) {
  const {
    id: agentId,
    model = "haiku",
    systemPrompt,
    userPrompt,
  } = agentConfig;

  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  const projectRoot = options.projectRoot || process.cwd();

  // Create the log file for this agent
  const logDir = join(stateDir, "logs");
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  const logPath = join(logDir, `${agentId}.log`);
  const logStream = createWriteStream(logPath, { flags: "a" });

  // Write a header to the log
  const startHeader = [
    `${"=".repeat(60)}`,
    `Agent: ${agentId}`,
    `Model: ${model} (${resolveModelName(model)})`,
    `Started: ${new Date().toISOString()}`,
    `MCP Config: ${mcpConfigPath}`,
    `${"=".repeat(60)}`,
    ``,
  ].join("\n");
  logStream.write(startHeader);

  // Decide whether to use Claude CLI or SDK fallback
  const useCli = isClaudeCliAvailable();

  if (useCli) {
    return spawnWithCli({
      agentId,
      model,
      systemPrompt,
      userPrompt,
      mcpConfigPath,
      stateDir,
      logPath,
      logStream,
      apiKey,
      projectRoot,
    });
  } else {
    return spawnWithSdk({
      agentId,
      model,
      systemPrompt,
      userPrompt,
      mcpConfigPath,
      stateDir,
      logPath,
      logStream,
      apiKey,
      projectRoot,
    });
  }
}

// ---------------------------------------------------------------------------
// Spawn using the Claude CLI
// ---------------------------------------------------------------------------

function spawnWithCli({
  agentId,
  model,
  systemPrompt,
  userPrompt,
  mcpConfigPath,
  stateDir,
  logPath,
  logStream,
  apiKey,
  projectRoot,
}) {
  const resolvedModel = resolveModelName(model);

  // Build the claude CLI arguments
  const args = [
    "--model", resolvedModel,
    "--system-prompt", systemPrompt,
    "--mcp-config", mcpConfigPath,
    "--print",
    "--no-input",
    userPrompt,
  ];

  // Set up environment
  const env = {
    ...process.env,
    HELIX_STATE_DIR: stateDir,
    HELIX_AGENT_ID: agentId,
  };

  if (apiKey) {
    env.ANTHROPIC_API_KEY = apiKey;
  }

  // Spawn the process
  const proc = spawn("claude", args, {
    env,
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    // Detach so the orchestrator can track but not block
    detached: false,
  });

  // Pipe stdout and stderr to the log file
  if (proc.stdout) {
    proc.stdout.on("data", (chunk) => {
      logStream.write(chunk);
    });
  }

  if (proc.stderr) {
    proc.stderr.on("data", (chunk) => {
      logStream.write(`[stderr] ${chunk}`);
    });
  }

  // Create a promise that resolves when the process exits
  const exitPromise = new Promise((resolve) => {
    proc.on("close", (code, signal) => {
      const footer = [
        ``,
        `${"=".repeat(60)}`,
        `Agent ${agentId} exited: code=${code} signal=${signal}`,
        `Ended: ${new Date().toISOString()}`,
        `${"=".repeat(60)}`,
      ].join("\n");
      logStream.write(footer);
      logStream.end();
      resolve({ code, signal });
    });

    proc.on("error", (err) => {
      logStream.write(`\n[ERROR] Process error: ${err.message}\n`);
      logStream.end();
      resolve({ code: -1, signal: null, error: err.message });
    });
  });

  return {
    process: proc,
    pid: proc.pid,
    logPath,
    logStream,
    exitPromise,
    mode: "cli",
    agentId,
    model,
  };
}

// ---------------------------------------------------------------------------
// Spawn using the Anthropic SDK (fallback when CLI is not available)
// ---------------------------------------------------------------------------

async function spawnWithSdk({
  agentId,
  model,
  systemPrompt,
  userPrompt,
  mcpConfigPath,
  stateDir,
  logPath,
  logStream,
  apiKey,
  projectRoot,
}) {
  const resolvedModel = resolveModelName(model);

  logStream.write(`[sdk] Claude CLI not available. Using Anthropic SDK directly.\n`);
  logStream.write(`[sdk] Model: ${resolvedModel}\n`);
  logStream.write(`[sdk] NOTE: SDK mode does not support MCP tools. Agent will run without tool access.\n`);
  logStream.write(`[sdk] For full functionality, install the Claude CLI: npm install -g @anthropic-ai/claude-cli\n\n`);

  // Dynamically import the Anthropic SDK
  let Anthropic;
  try {
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = mod.default || mod.Anthropic;
  } catch (err) {
    logStream.write(`[sdk] ERROR: Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk\n`);
    logStream.write(`[sdk] Cannot spawn agent without either Claude CLI or Anthropic SDK.\n`);
    logStream.end();

    return {
      process: null,
      pid: null,
      logPath,
      logStream: null,
      exitPromise: Promise.resolve({ code: 1, signal: null, error: "No Claude CLI or SDK available" }),
      mode: "sdk-error",
      agentId,
      model,
    };
  }

  // Create the client
  const client = new Anthropic({ apiKey });

  // Run the API call as an async task
  const exitPromise = (async () => {
    try {
      logStream.write(`[sdk] Sending request to ${resolvedModel}...\n\n`);

      const response = await client.messages.create({
        model: resolvedModel,
        max_tokens: 16384,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Write the response to the log
      for (const block of response.content) {
        if (block.type === "text") {
          logStream.write(block.text);
          logStream.write("\n");
        }
      }

      const footer = [
        ``,
        `${"=".repeat(60)}`,
        `Agent ${agentId} completed (SDK mode)`,
        `Tokens: ${response.usage?.input_tokens || "?"} input, ${response.usage?.output_tokens || "?"} output`,
        `Stop reason: ${response.stop_reason}`,
        `Ended: ${new Date().toISOString()}`,
        `${"=".repeat(60)}`,
      ].join("\n");
      logStream.write(footer);
      logStream.end();

      return { code: 0, signal: null, usage: response.usage };
    } catch (err) {
      logStream.write(`\n[sdk] ERROR: ${err.message}\n`);
      logStream.end();
      return { code: 1, signal: null, error: err.message };
    }
  })();

  return {
    process: null,
    pid: null,
    logPath,
    logStream,
    exitPromise,
    mode: "sdk",
    agentId,
    model,
  };
}

// ---------------------------------------------------------------------------
// Kill a spawned agent process
// ---------------------------------------------------------------------------

/**
 * Terminate a spawned agent process.
 * @param {object} handle - The handle returned by spawnAgent
 * @param {string} [signal="SIGTERM"] - Signal to send
 * @returns {boolean} True if a signal was sent
 */
export function killAgent(handle, signal = "SIGTERM") {
  if (!handle || !handle.process) return false;

  try {
    handle.process.kill(signal);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Get the log file size for an agent
// ---------------------------------------------------------------------------

/**
 * Get the size of an agent's log file in bytes.
 * @param {string} logPath - Path to the log file
 * @returns {number} Size in bytes, or 0 if not found
 */
export function getLogSize(logPath) {
  try {
    return statSync(logPath).size;
  } catch {
    return 0;
  }
}
