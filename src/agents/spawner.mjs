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
// Model name mapping per provider
// ---------------------------------------------------------------------------

const MODEL_MAPS = {
  // Claude models (used by claude-cli and anthropic-api)
  anthropic: {
    haiku:  "claude-haiku-4-5-20251001",
    sonnet: "claude-sonnet-4-6",
    opus:   "claude-opus-4-6",
  },
  // OpenAI models
  openai: {
    haiku:  "gpt-4o-mini",       // Fast, cheap (maps to haiku role)
    sonnet: "gpt-4o",            // Balanced (maps to sonnet role)
    opus:   "o1",                // Most capable (maps to opus role)
  },
  // Google Gemini models
  gemini: {
    haiku:  "gemini-2.0-flash",
    sonnet: "gemini-2.5-pro",
    opus:   "gemini-2.5-pro",
  },
  // Ollama local models
  ollama: {
    haiku:  "llama3.1:8b",
    sonnet: "llama3.1:70b",
    opus:   "deepseek-coder-v2:latest",
  },
  // OpenAI-compatible (defaults, user should override)
  "openai-compatible": {
    haiku:  "llama-3.1-8b",
    sonnet: "llama-3.1-70b",
    opus:   "llama-3.1-405b",
  },
};

const MODEL_MAP = MODEL_MAPS.anthropic; // Default fallback

/**
 * Resolve a short model name (haiku/sonnet/opus) to the full model ID
 * for the given provider.
 * @param {string} model - Short name or full model ID
 * @param {string} [provider="anthropic"] - Provider name
 * @returns {string}
 */
export function resolveModelName(model, provider = "anthropic") {
  // claude-cli uses the same models as anthropic
  const key = provider === "claude-cli" ? "anthropic"
            : provider === "anthropic-api" ? "anthropic"
            : provider;
  const map = MODEL_MAPS[key] || MODEL_MAPS.anthropic;
  return map[model] || model;
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
    mdOutputPath: customMdPath = null,
  } = agentConfig;

  const provider = options.provider || "claude-cli";
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
    `Provider: ${provider}`,
    `Model: ${model} (${resolveModelName(model, provider)})`,
    `Started: ${new Date().toISOString()}`,
    `MCP Config: ${mcpConfigPath}`,
    `${"=".repeat(60)}`,
    ``,
  ].join("\n");
  logStream.write(startHeader);

  const commonOpts = {
    agentId, model, systemPrompt, userPrompt,
    mcpConfigPath, stateDir, logPath, logStream,
    apiKey, projectRoot, provider, customMdPath,
  };

  // Route to the correct spawner based on provider
  switch (provider) {
    case "claude-cli": {
      // Claude CLI with OAuth (subscription plan) — no API key needed
      // Also works with API key if ANTHROPIC_API_KEY is set
      if (!isClaudeCliAvailable()) {
        logStream.write(`[error] Claude CLI not found. Install it:\n`);
        logStream.write(`  npm install -g @anthropic-ai/claude-code\n`);
        logStream.write(`\nThen log in once:\n`);
        logStream.write(`  claude login\n\n`);
        logStream.write(`Or switch to API mode: --provider anthropic-api\n`);
        logStream.end();
        return {
          process: null, pid: null, logPath, logStream: null,
          exitPromise: Promise.resolve({ code: 1, error: "Claude CLI not installed" }),
          mode: "error", agentId, model,
        };
      }
      return spawnWithCli(commonOpts);
    }

    case "anthropic-api": {
      // Direct Anthropic SDK — requires API key, no MCP tools
      if (!apiKey) {
        logStream.write(`[error] ANTHROPIC_API_KEY not set. Add it to .env or export it.\n`);
        logStream.end();
        return {
          process: null, pid: null, logPath, logStream: null,
          exitPromise: Promise.resolve({ code: 1, error: "API key not set" }),
          mode: "error", agentId, model,
        };
      }
      return spawnWithSdk(commonOpts);
    }

    case "openai":
    case "gemini":
    case "ollama":
    case "openai-compatible": {
      // For non-Anthropic providers: if Claude CLI is available, we still
      // use it because it handles MCP natively. The model name is resolved
      // to the provider's equivalent.
      //
      // If Claude CLI is not available, fall back to direct SDK calls
      // with a manual MCP bridge (function calling ↔ MCP tools).
      if (isClaudeCliAvailable()) {
        logStream.write(`[info] Using Claude CLI with MCP for ${provider} agent.\n`);
        logStream.write(`[info] Model mapped: ${model} -> ${resolveModelName(model, provider)}\n\n`);
        return spawnWithCli(commonOpts);
      } else {
        logStream.write(`[info] Claude CLI not available. Using ${provider} SDK directly.\n`);
        logStream.write(`[info] NOTE: Direct SDK mode has limited MCP tool support.\n`);
        logStream.write(`[info] For best results, install Claude CLI: npm install -g @anthropic-ai/claude-code\n\n`);
        return spawnWithProviderSdk(commonOpts);
      }
    }

    default:
      logStream.write(`[error] Unknown provider: ${provider}\n`);
      logStream.write(`Supported: claude-cli, anthropic-api, openai, gemini, ollama, openai-compatible\n`);
      logStream.end();
      return {
        process: null, pid: null, logPath, logStream: null,
        exitPromise: Promise.resolve({ code: 1, error: `Unknown provider: ${provider}` }),
        mode: "error", agentId, model,
      };
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
  provider = "claude-cli",
  customMdPath = null,
}) {
  const resolvedModel = resolveModelName(model, provider);

  // Build the claude CLI arguments
  const args = [
    "--model", resolvedModel,
    "--system-prompt", systemPrompt,
    "--mcp-config", mcpConfigPath,
    "--print",
    "--dangerously-skip-permissions",
    "--no-session-persistence",
    userPrompt,
  ];

  // Set up environment
  // For claude-cli mode (OAuth/subscription), we do NOT need an API key.
  // The Claude CLI handles authentication via its own OAuth token.
  const env = {
    ...process.env,
    HELIX_STATE_DIR: stateDir,
    HELIX_AGENT_ID: agentId,
  };

  // Only set API key if explicitly provided (not needed for claude-cli with plan)
  if (apiKey && provider !== "claude-cli") {
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

  // Pipe stdout and stderr to the log file; capture clean stdout for .md output
  const mdChunks = [];
  if (proc.stdout) {
    proc.stdout.on("data", (chunk) => {
      logStream.write(chunk);
      mdChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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

      // Write clean agent output as a .md file alongside the .log
      if (mdChunks.length > 0) {
        const mdBuffer = Buffer.concat(mdChunks);
        try {
          writeFileSync(logPath.replace(/\.log$/, ".md"), mdBuffer);
        } catch { /* ignore */ }
        // Also write to user-specified custom path if provided
        if (customMdPath) {
          try {
            const customDir = customMdPath.replace(/\/[^/]+$/, "");
            if (customDir && customDir !== customMdPath) {
              mkdirSync(customDir, { recursive: true });
            }
            writeFileSync(customMdPath, mdBuffer);
          } catch (err) {
            logStream.write(`\n[warn] Could not write to custom md path "${customMdPath}": ${err.message}\n`);
          }
        }

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
  customMdPath = null,
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

      // Write the response to the log and capture for .md
      let mdContent = "";
      for (const block of response.content) {
        if (block.type === "text") {
          logStream.write(block.text);
          logStream.write("\n");
          mdContent += block.text + "\n";
        }
      }

      // Write clean agent output as .md
      if (mdContent) {
        try {
          writeFileSync(logPath.replace(/\.log$/, ".md"), mdContent, "utf8");
        } catch { /* ignore */ }
        if (customMdPath) {
          try {
            const customDir = customMdPath.replace(/\/[^/]+$/, "");
            if (customDir && customDir !== customMdPath) {
              mkdirSync(customDir, { recursive: true });
            }
            writeFileSync(customMdPath, mdContent, "utf8");
          } catch { /* ignore */ }
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
// Spawn using non-Anthropic provider SDKs (OpenAI, Gemini, Ollama)
// ---------------------------------------------------------------------------

async function spawnWithProviderSdk({
  agentId,
  model,
  systemPrompt,
  userPrompt,
  stateDir,
  logPath,
  logStream,
  apiKey,
  provider,
}) {
  const resolvedModel = resolveModelName(model, provider);

  logStream.write(`[${provider}] Spawning agent with ${provider} SDK\n`);
  logStream.write(`[${provider}] Model: ${resolvedModel}\n`);
  logStream.write(`[${provider}] NOTE: Non-Claude providers have limited MCP tool support.\n`);
  logStream.write(`[${provider}] For full MCP support, use claude-cli mode with a Claude subscription.\n\n`);

  const exitPromise = (async () => {
    try {
      let response;

      if (provider === "openai" || provider === "openai-compatible") {
        // OpenAI or compatible API
        const OpenAI = (await import("openai")).default;
        const clientOpts = { apiKey: apiKey || process.env.OPENAI_API_KEY };
        if (provider === "openai-compatible") {
          clientOpts.apiKey = apiKey || process.env.OPENAI_COMPATIBLE_API_KEY;
          clientOpts.baseURL = process.env.OPENAI_COMPATIBLE_BASE_URL || undefined;
        }
        const client = new OpenAI(clientOpts);
        const result = await client.chat.completions.create({
          model: resolvedModel,
          max_tokens: 16384,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        response = result.choices[0]?.message?.content || "";
        logStream.write(response + "\n");

      } else if (provider === "gemini") {
        // Google Gemini via REST API
        const geminiKey = apiKey || process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
          }),
        });
        const data = await res.json();
        response = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        logStream.write(response + "\n");

      } else if (provider === "ollama") {
        // Ollama local API
        const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
        const res = await fetch(`${ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            stream: false,
          }),
        });
        const data = await res.json();
        response = data.message?.content || "";
        logStream.write(response + "\n");
      }

      logStream.write(`\n${"=".repeat(60)}\nAgent ${agentId} completed (${provider} SDK)\nEnded: ${new Date().toISOString()}\n${"=".repeat(60)}\n`);
      logStream.end();
      return { code: 0, signal: null };
    } catch (err) {
      logStream.write(`\n[${provider}] ERROR: ${err.message}\n`);
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
    mode: provider,
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
